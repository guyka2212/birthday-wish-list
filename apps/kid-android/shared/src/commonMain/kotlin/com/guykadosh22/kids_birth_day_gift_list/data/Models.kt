package com.guykadosh22.kids_birth_day_gift_list.data

import kotlinx.serialization.Serializable

// Mirrors packages/shared/src/types.ts in the monorepo.

@Serializable
data class AuthTokens(val accessToken: String, val refreshToken: String, val expiresIn: Int = 900)

@Serializable
data class KidProfile(
    val id: String,
    val username: String,
    val firstName: String,
    val email: String,
    val avatar: String,
    val birthday: String? = null,
    val locale: String = "he",
    val consentStatus: String = "pending",
    val hasPhoto: Boolean = false,
    /** city id (see GET /cities); the catalog shows only shops near it */
    val city: String? = null,
)

@Serializable
data class ShopSummary(val id: String, val name: String, val city: String, val logoUrl: String? = null, val brandColor: String = "#3FA9F5", val distanceKm: Int? = null)

@Serializable
data class Product(
    val id: String,
    val title: String,
    val description: String = "",
    val category: String,
    val priceAgorot: Int,
    val imageUrl: String? = null,
    val ageMin: Int? = null,
    val ageMax: Int? = null,
    val stock: Int = 0,
    val inStock: Boolean = false,
    val shop: ShopSummary,
)

@Serializable
data class ShareInfo(val slug: String, val enabled: Boolean, val url: String)

@Serializable
data class ListSummary(
    val id: String,
    val name: String,
    val description: String = "",
    val birthday: String? = null,
    val themeId: String = "unicorn",
    val theme: ThemeDto? = null,
    val quiz: Map<String, String>? = null,
    val showPhoto: Boolean = true,
    val itemCount: Int = 0,
    val purchasedCount: Int = 0,
    val share: ShareInfo? = null,
    val createdAt: Long = 0,
    val updatedAt: Long = 0,
)

@Serializable
data class ListItem(val id: String, val status: String, val product: Product) {
    val purchased get() = status == "purchased"
}

@Serializable
data class ListDetail(
    val id: String,
    val name: String,
    val description: String = "",
    val birthday: String? = null,
    val themeId: String = "unicorn",
    val theme: ThemeDto? = null,
    val quiz: Map<String, String>? = null,
    val showPhoto: Boolean = true,
    val itemCount: Int = 0,
    val purchasedCount: Int = 0,
    val share: ShareInfo? = null,
    val items: List<ListItem> = emptyList(),
)

@Serializable
data class ActivityItem(val id: String, val kind: String, val title: String, val body: String, val createdAt: Long, val read: Boolean)

@Serializable
data class HomeSummary(
    val profile: KidProfile,
    val activeList: ListSummary? = null,
    val daysToBirthday: Int? = null,
    val trending: List<Product> = emptyList(),
    val activity: List<ActivityItem> = emptyList(),
    val unread: Int = 0,
)

@Serializable
data class ShopFilterItem(val id: String, val name: String, val city: String, val logoUrl: String? = null, val brandColor: String = "#3FA9F5", val products: Int = 0, val distanceKm: Int? = null)

@Serializable data class CityItem(val id: String, val he: String, val en: String)

@Serializable data class Items<T>(val items: List<T>)

@Serializable data class ApiErrorBody(val error: ApiErrorDetail)
@Serializable data class ApiErrorDetail(val code: String, val message: String)

// ---- requests ----
@Serializable data class LoginRequest(val email: String, val password: String)
@Serializable data class RefreshRequest(val refreshToken: String)
@Serializable data class ForgotRequest(val email: String)

@Serializable
data class SignupRequest(
    val username: String,
    val firstName: String,
    val email: String,
    val password: String,
    val parentEmail: String,
    val birthday: String? = null,
    val avatar: String? = null,
    val locale: String? = null,
    val city: String,
)

@Serializable
data class ProfileUpdate(
    val username: String? = null,
    val firstName: String? = null,
    val email: String? = null,
    val avatar: String? = null,
    val locale: String? = null,
    val city: String? = null,
    val currentPassword: String? = null,
    val newPassword: String? = null,
)

@Serializable
data class ListCreate(
    val name: String,
    val description: String = "",
    val birthday: String? = null,
    val themeId: String = "unicorn",
    /** quiz answers (question id → option id); the server builds a custom theme from them */
    val quiz: Map<String, String>? = null,
)

@Serializable
data class ListUpdate(
    val name: String? = null,
    val description: String? = null,
    val birthday: String? = null,
    val themeId: String? = null,
    val quiz: Map<String, String>? = null,
    val showPhoto: Boolean? = null,
)

/** A guest-shop theme from the server: a preset or one generated from the quiz. */
@Serializable
data class ThemeDto(
    val id: String,
    val nameHe: String,
    val nameEn: String,
    val emoji: String,
    val primary: String,
    val accent: String,
    val bg: String,
    val text: String,
    val onPrimary: String,
    val onAccent: String,
    val dark: Boolean = false,
    val confetti: List<String> = emptyList(),
    val taglineHe: String = "",
    val taglineEn: String = "",
)

@Serializable data class QuizOption(val id: String, val he: String, val en: String, val emoji: String, val swatch: String? = null)
@Serializable data class QuizQuestion(val id: String, val he: String, val en: String, val emoji: String, val options: List<QuizOption>)
@Serializable data class QuizResponse(val questions: List<QuizQuestion>)
@Serializable data class PreviewRequest(val quiz: Map<String, String>)
@Serializable data class PhotoUpload(val photo: String)
@Serializable data class PhotoResponse(val contentType: String, val photo: String)

@Serializable data class AddItem(val productId: String)

data class CatalogFilter(
    val query: String = "",
    val shopIds: Set<String> = emptySet(),
    val categories: Set<String> = emptySet(),
    val minPriceShekel: Int = 0,
    val maxPriceShekel: Int = MAX_PRICE_SHEKEL,
    val inStockOnly: Boolean = false,
) {
    val activeCount: Int
        get() = shopIds.size + categories.size + (if (minPriceShekel > 0 || maxPriceShekel < MAX_PRICE_SHEKEL) 1 else 0) + (if (inStockOnly) 1 else 0)

    companion object { const val MAX_PRICE_SHEKEL = 1000 }
}

/** ₪ formatting from agorot: 14990 → "₪149.90", 12900 → "₪129" */
fun formatShekel(agorot: Int): String {
    val shekels = agorot / 100
    val cents = agorot % 100
    return if (cents == 0) "₪$shekels" else "₪$shekels.${cents.toString().padStart(2, '0')}"
}
