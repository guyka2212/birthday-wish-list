package com.guykadosh22.kids_birth_day_gift_list.data

import io.ktor.client.request.parameter

/** All server calls the kid app makes. */
class Repository(val api: ApiClient) {
    // ---- auth ----
    suspend fun login(email: String, password: String) {
        api.setTokens(api.post<AuthTokens>("auth/kid/login", LoginRequest(email.trim(), password), auth = false))
    }

    suspend fun signup(req: SignupRequest) {
        api.setTokens(api.post<AuthTokens>("auth/kid/signup", req, auth = false))
    }

    suspend fun forgotPassword(email: String) {
        api.post<Unit>("auth/kid/forgot", ForgotRequest(email.trim()), auth = false)
    }

    suspend fun logout() {
        api.currentTokens()?.let { t -> runCatching { api.post<Unit>("auth/kid/logout", RefreshRequest(t.refreshToken), auth = false) } }
        api.setTokens(null)
    }

    // ---- profile ----
    suspend fun me(): KidProfile = api.get("kid/me")
    suspend fun updateProfile(u: ProfileUpdate): KidProfile = api.patch("kid/me", u)
    suspend fun deleteAccount() {
        api.delete<Unit>("kid/me")
        api.setTokens(null)
    }
    suspend fun resendConsent() { api.post<Unit>("kid/me/consent/resend") }
    suspend fun home(): HomeSummary = api.get("kid/me/home")
    suspend fun activitySince(since: Long): List<ActivityItem> =
        api.get<Items<ActivityItem>>("kid/me/activity") { parameter("since", since) }.items
    suspend fun markActivityRead() { api.post<Unit>("kid/me/activity/read") }

    // ---- profile photo (base64 JPEG, private to the kid) ----
    suspend fun uploadPhoto(base64: String) { api.put<Unit>("kid/me/photo", PhotoUpload(base64)) }
    suspend fun photo(): PhotoResponse = api.get("kid/me/photo")
    suspend fun deletePhoto() { api.delete<Unit>("kid/me/photo") }

    // ---- cities (public; cached for the app run) ----
    private var cities: List<CityItem>? = null
    suspend fun cities(): List<CityItem> = cities ?: api.get<Items<CityItem>>("cities", auth = false).items.also { cities = it }

    // ---- theme quiz ----
    suspend fun quiz(): List<QuizQuestion> = api.get<QuizResponse>("kid/quiz").questions
    suspend fun previewTheme(answers: Map<String, String>): ThemeDto = api.post("kid/themes/preview", PreviewRequest(answers))

    // ---- catalog ----
    suspend fun catalog(f: CatalogFilter): List<Product> = api.get<Items<Product>>("kid/catalog") {
        if (f.query.isNotBlank()) parameter("q", f.query.trim())
        if (f.shopIds.isNotEmpty()) parameter("shopIds", f.shopIds.joinToString(","))
        if (f.categories.isNotEmpty()) parameter("categories", f.categories.joinToString(","))
        if (f.minPriceShekel > 0) parameter("minPrice", f.minPriceShekel * 100)
        if (f.maxPriceShekel < CatalogFilter.MAX_PRICE_SHEKEL) parameter("maxPrice", f.maxPriceShekel * 100)
        if (f.inStockOnly) parameter("inStockOnly", "true")
        parameter("limit", 100)
    }.items

    suspend fun shops(): List<ShopFilterItem> = api.get<Items<ShopFilterItem>>("kid/catalog/shops").items

    // ---- lists ----
    suspend fun lists(): List<ListSummary> = api.get<Items<ListSummary>>("kid/lists").items
    suspend fun list(id: String): ListDetail = api.get("kid/lists/$id")
    suspend fun createList(req: ListCreate): ListDetail = api.post("kid/lists", req)
    suspend fun updateList(id: String, req: ListUpdate): ListDetail = api.patch("kid/lists/$id", req)
    suspend fun deleteList(id: String) { api.delete<Unit>("kid/lists/$id") }
    suspend fun addItem(listId: String, productId: String): ListDetail = api.post("kid/lists/$listId/items", AddItem(productId))
    suspend fun removeItem(listId: String, productId: String): ListDetail = api.delete("kid/lists/$listId/items/$productId")

    // ---- sharing ----
    suspend fun enableShare(listId: String): ListSummary = api.post("kid/lists/$listId/share")
    suspend fun regenerateShare(listId: String): ListSummary = api.post("kid/lists/$listId/share/regenerate")
    suspend fun disableShare(listId: String): ListSummary = api.delete("kid/lists/$listId/share")
}
