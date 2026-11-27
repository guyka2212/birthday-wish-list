package com.guykadosh22.kids_birth_day_gift_list.data

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json

/** Persists auth tokens. The Android implementation encrypts them with an Android Keystore key. */
interface TokenStore {
    fun load(): AuthTokens?
    fun save(tokens: AuthTokens?)
}

class InMemoryTokenStore(private var tokens: AuthTokens? = null) : TokenStore {
    override fun load() = tokens
    override fun save(tokens: AuthTokens?) { this.tokens = tokens }
}

class ApiException(val status: Int, val code: String, message: String) : Exception(message) {
    val isNetwork get() = status == 0
    val isAuth get() = status == 401
}

val AppJson = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = false }

/** Thin HTTP client: JSON, bearer auth, and a single-flight token refresh on 401. */
class ApiClient(
    val baseUrl: String,
    private val tokens: TokenStore,
    engineClient: HttpClient? = null,
    /** called when the session can't be refreshed (user must log in again) */
    var onSessionExpired: () -> Unit = {},
) {
    private val http: HttpClient = (engineClient ?: HttpClient()).config {
        install(ContentNegotiation) { json(AppJson) }
        install(HttpTimeout) { requestTimeoutMillis = 20_000; connectTimeoutMillis = 10_000 }
        defaultRequest { url(baseUrl.trimEnd('/') + "/") }
        expectSuccess = false
    }
    private val refreshMutex = Mutex()

    val isLoggedIn get() = tokens.load() != null
    fun currentTokens(): AuthTokens? = tokens.load()
    fun setTokens(t: AuthTokens?) = tokens.save(t)

    suspend inline fun <reified T> get(path: String, auth: Boolean = true, noinline block: HttpRequestBuilder.() -> Unit = {}): T =
        send(HttpMethod.Get, path, auth, block).body()

    suspend inline fun <reified T> post(path: String, payload: Any? = null, auth: Boolean = true): T =
        send(HttpMethod.Post, path, auth) { if (payload != null) { contentType(ContentType.Application.Json); setBody(payload) } }.body()

    suspend inline fun <reified T> put(path: String, payload: Any, auth: Boolean = true): T =
        send(HttpMethod.Put, path, auth) { contentType(ContentType.Application.Json); setBody(payload) }.body()

    suspend inline fun <reified T> patch(path: String, payload: Any, auth: Boolean = true): T =
        send(HttpMethod.Patch, path, auth) { contentType(ContentType.Application.Json); setBody(payload) }.body()

    suspend inline fun <reified T> delete(path: String, auth: Boolean = true): T = send(HttpMethod.Delete, path, auth).body()

    suspend fun send(method: HttpMethod, path: String, auth: Boolean, block: HttpRequestBuilder.() -> Unit = {}): HttpResponse {
        var response = execute(method, path, auth, block)
        if (auth && response.status == HttpStatusCode.Unauthorized) {
            if (refresh()) response = execute(method, path, auth, block)
        }
        if (!response.status.isSuccess()) throw toError(response)
        return response
    }

    private suspend fun execute(method: HttpMethod, path: String, auth: Boolean, block: HttpRequestBuilder.() -> Unit): HttpResponse =
        try {
            http.request(path.trimStart('/')) {
                this.method = method
                if (auth) tokens.load()?.let { bearerAuth(it.accessToken) }
                block()
            }
        } catch (e: Exception) {
            if (e is ApiException) throw e
            throw ApiException(0, "network", e.message ?: "network error")
        }

    /** Returns true if new tokens were obtained. Concurrent 401s share one refresh. */
    private suspend fun refresh(): Boolean = refreshMutex.withLock {
        val current = tokens.load() ?: return false
        val res = try {
            http.request("auth/kid/refresh") {
                method = HttpMethod.Post
                contentType(ContentType.Application.Json)
                setBody(RefreshRequest(current.refreshToken))
            }
        } catch (e: Exception) {
            return false
        }
        if (res.status.isSuccess()) {
            tokens.save(res.body<AuthTokens>())
            true
        } else {
            // someone else may have refreshed already with the same token
            if (tokens.load()?.accessToken != current.accessToken) return true
            tokens.save(null)
            onSessionExpired()
            false
        }
    }

    private suspend fun toError(res: HttpResponse): ApiException {
        val text = runCatching { res.bodyAsText() }.getOrDefault("")
        val err = runCatching { AppJson.decodeFromString(ApiErrorBody.serializer(), text).error }.getOrNull()
        return ApiException(res.status.value, err?.code ?: "http_${res.status.value}", err?.message ?: res.status.description)
    }
}
