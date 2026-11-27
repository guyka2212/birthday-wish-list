package com.guykadosh22.kids_birth_day_gift_list

import com.guykadosh22.kids_birth_day_gift_list.data.ApiClient
import com.guykadosh22.kids_birth_day_gift_list.data.ApiException
import com.guykadosh22.kids_birth_day_gift_list.data.AuthTokens
import com.guykadosh22.kids_birth_day_gift_list.data.CatalogFilter
import com.guykadosh22.kids_birth_day_gift_list.data.InMemoryTokenStore
import com.guykadosh22.kids_birth_day_gift_list.data.Repository
import com.guykadosh22.kids_birth_day_gift_list.data.formatShekel
import com.guykadosh22.kids_birth_day_gift_list.ui.components.isoDateToMillis
import com.guykadosh22.kids_birth_day_gift_list.ui.components.millisToIsoDate
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SharedCommonTest {
    private val json = headersOf(HttpHeaders.ContentType, "application/json")

    @Test
    fun formatsShekels() {
        assertEquals("₪129", formatShekel(12_900))
        assertEquals("₪149.90", formatShekel(14_990))
        assertEquals("₪0.05", formatShekel(5))
    }

    @Test
    fun convertsDatesBothWays() {
        for (d in listOf("2016-12-20", "2000-02-29", "1999-01-01", "2026-11-27")) {
            assertEquals(d, millisToIsoDate(isoDateToMillis(d)!!))
        }
        assertNull(isoDateToMillis("nope"))
    }

    @Test
    fun filterCountsActiveFilters() {
        assertEquals(0, CatalogFilter().activeCount)
        assertEquals(3, CatalogFilter(shopIds = setOf("a"), categories = setOf("toys"), maxPriceShekel = 200).activeCount)
    }

    @Test
    fun refreshesTheAccessTokenOnceAfter401AndRetries() = runTest {
        var refreshCalls = 0
        val engine = MockEngine { req ->
            when (req.url.encodedPath) {
                "/kid/me" ->
                    if (req.headers[HttpHeaders.Authorization] == "Bearer new-access") {
                        respond("""{"id":"u1","username":"Noa","firstName":"נועה","email":"n@x.com","avatar":"🦄"}""", HttpStatusCode.OK, json)
                    } else {
                        respond("""{"error":{"code":"unauthorized","message":"expired"}}""", HttpStatusCode.Unauthorized, json)
                    }
                "/auth/kid/refresh" -> {
                    refreshCalls++
                    respond("""{"accessToken":"new-access","refreshToken":"new-refresh-token-0123456789","expiresIn":900}""", HttpStatusCode.OK, json)
                }
                else -> respond("", HttpStatusCode.NotFound)
            }
        }
        val store = InMemoryTokenStore(AuthTokens("old-access", "old-refresh-token-0123456789"))
        val repo = Repository(ApiClient("http://test", store, HttpClient(engine)))
        assertEquals("נועה", repo.me().firstName)
        assertEquals(1, refreshCalls)
        assertEquals("new-access", store.load()?.accessToken)
    }

    @Test
    fun logsOutWhenRefreshFails() = runTest {
        var expired = false
        val engine = MockEngine { req ->
            when (req.url.encodedPath) {
                "/auth/kid/refresh" -> respond("""{"error":{"code":"unauthorized","message":"reused"}}""", HttpStatusCode.Unauthorized, json)
                else -> respond("""{"error":{"code":"unauthorized","message":"expired"}}""", HttpStatusCode.Unauthorized, json)
            }
        }
        val store = InMemoryTokenStore(AuthTokens("a", "refresh-token-0123456789"))
        val api = ApiClient("http://test", store, HttpClient(engine), onSessionExpired = { expired = true })
        val e = assertFailsWith<ApiException> { Repository(api).lists() }
        assertEquals(401, e.status)
        assertTrue(expired)
        assertNull(store.load())
    }

    @Test
    fun mapsServerErrorsToApiException() = runTest {
        val engine = MockEngine { respond("""{"error":{"code":"consent_required","message":"parent needed"}}""", HttpStatusCode.Forbidden, json) }
        val repo = Repository(ApiClient("http://test", InMemoryTokenStore(AuthTokens("a", "refresh-token-0123456789")), HttpClient(engine)))
        val e = assertFailsWith<ApiException> { repo.enableShare("l1") }
        assertEquals("consent_required", e.code)
        assertEquals(403, e.status)
    }
}
