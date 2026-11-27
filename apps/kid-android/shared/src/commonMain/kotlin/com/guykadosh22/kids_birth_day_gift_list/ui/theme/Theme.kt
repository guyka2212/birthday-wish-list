package com.guykadosh22.kids_birth_day_gift_list.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kidsbirthdaygiftlist.shared.generated.resources.Res
import kidsbirthdaygiftlist.shared.generated.resources.rubik
import org.jetbrains.compose.resources.Font

/** Color tokens. Primary sky blue and CTA yellow come from the FigJam wireframe. */
object BwlColors {
    val Sky = Color(0xFF3FA9F5)
    val SkyDeep = Color(0xFF1C7FD1)
    val SkySoft = Color(0xFFE3F2FF)
    val Sun = Color(0xFFFFC93C)
    val SunDeep = Color(0xFFF2A900)
    val Ink = Color(0xFF1D2B4F)
    val InkSoft = Color(0xFF5B6A8A)
    val Bg = Color(0xFFF2F8FF)
    val Surface = Color(0xFFFFFFFF)
    val Line = Color(0xFFE1ECF8)
    val Candy = Color(0xFFFF6FB5)
    val Mint = Color(0xFF2BC48A)
    val Grape = Color(0xFF8B5CF6)
    val Orange = Color(0xFFFF8C42)
    val Danger = Color(0xFFE5484D)
    val Disabled = Color(0xFFB8C2D3)
}

/** Spacing tokens (dp). */
object Space {
    val xs = 4.dp
    val s = 8.dp
    val m = 12.dp
    val l = 16.dp
    val xl = 24.dp
    val xxl = 32.dp
    /** minimum touch target for small fingers */
    val tap = 52.dp
}

object Radius {
    val card = RoundedCornerShape(24.dp)
    val button = RoundedCornerShape(18.dp)
    val chip = RoundedCornerShape(50)
    val field = RoundedCornerShape(16.dp)
}

@Composable
private fun rubikFamily(): FontFamily = FontFamily(
    listOf(400, 500, 600, 700, 800).map { w ->
        Font(Res.font.rubik, weight = FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
    },
)

@Composable
private fun typography(): Typography {
    val f = rubikFamily()
    return Typography(
        displaySmall = TextStyle(fontFamily = f, fontWeight = FontWeight.ExtraBold, fontSize = 34.sp, lineHeight = 40.sp),
        headlineMedium = TextStyle(fontFamily = f, fontWeight = FontWeight.Bold, fontSize = 26.sp, lineHeight = 32.sp),
        headlineSmall = TextStyle(fontFamily = f, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 28.sp),
        titleLarge = TextStyle(fontFamily = f, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 26.sp),
        titleMedium = TextStyle(fontFamily = f, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, lineHeight = 22.sp),
        titleSmall = TextStyle(fontFamily = f, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 20.sp),
        bodyLarge = TextStyle(fontFamily = f, fontWeight = FontWeight.Normal, fontSize = 17.sp, lineHeight = 24.sp),
        bodyMedium = TextStyle(fontFamily = f, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 21.sp),
        bodySmall = TextStyle(fontFamily = f, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 18.sp),
        labelLarge = TextStyle(fontFamily = f, fontWeight = FontWeight.Bold, fontSize = 17.sp, lineHeight = 22.sp),
        labelMedium = TextStyle(fontFamily = f, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 18.sp),
        labelSmall = TextStyle(fontFamily = f, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp),
    )
}

private val colors = lightColorScheme(
    primary = BwlColors.SkyDeep,
    onPrimary = Color.White,
    primaryContainer = BwlColors.SkySoft,
    onPrimaryContainer = BwlColors.Ink,
    secondary = BwlColors.Sun,
    onSecondary = BwlColors.Ink,
    tertiary = BwlColors.Candy,
    background = BwlColors.Bg,
    onBackground = BwlColors.Ink,
    surface = BwlColors.Surface,
    onSurface = BwlColors.Ink,
    surfaceVariant = BwlColors.SkySoft,
    onSurfaceVariant = BwlColors.InkSoft,
    outline = BwlColors.Line,
    error = BwlColors.Danger,
)

val LocalStrings = staticCompositionLocalOf { HebrewStrings }

@Composable
fun BwlTheme(language: String = "he", content: @Composable () -> Unit) {
    val strings = if (language == "en") EnglishStrings else HebrewStrings
    CompositionLocalProvider(
        LocalStrings provides strings,
        LocalLayoutDirection provides if (language == "en") LayoutDirection.Ltr else LayoutDirection.Rtl,
    ) {
        MaterialTheme(
            colorScheme = colors,
            typography = typography(),
            shapes = Shapes(small = Radius.field, medium = Radius.button, large = Radius.card),
            content = content,
        )
    }
}

/** Guest-shop theme colors (mirror of packages/shared/src/themes.ts) for the theme picker preview. */
data class GiftTheme(val id: String, val emoji: String, val nameHe: String, val nameEn: String, val primary: Color, val accent: Color, val bg: Color, val text: Color, val confetti: List<String>)

val GiftThemes = listOf(
    GiftTheme("space", "🚀", "חלל", "Space", Color(0xFF4C3BCF), Color(0xFFFFD23F), Color(0xFF0F0C29), Color(0xFFF4F1FF), listOf("🪐", "⭐", "🌙", "👽")),
    GiftTheme("unicorn", "🦄", "חד-קרן", "Unicorn", Color(0xFFB530D6), Color(0xFF7FE7DC), Color(0xFFFFF0FB), Color(0xFF3B1145), listOf("🌈", "✨", "💖", "🧁")),
    GiftTheme("football", "⚽", "כדורגל", "Football", Color(0xFF167A3B), Color(0xFFFFFFFF), Color(0xFFE9F9EE), Color(0xFF0D3B1E), listOf("🥅", "🏆", "👟", "📣")),
    GiftTheme("dinosaurs", "🦖", "דינוזאורים", "Dinosaurs", Color(0xFF4E7D17), Color(0xFFFF8C42), Color(0xFFF3FBE6), Color(0xFF26400A), listOf("🦕", "🌋", "🥚", "🦴")),
    GiftTheme("ocean", "🌊", "אוקיינוס", "Ocean", Color(0xFF0069A3), Color(0xFF00F5D4), Color(0xFFE6F7FF), Color(0xFF06324D), listOf("🐠", "🐙", "🐬", "🐚")),
    GiftTheme("gaming", "🎮", "גיימינג", "Gaming", Color(0xFF7B2FF7), Color(0xFF00E5FF), Color(0xFF14101F), Color(0xFFEDE7FF), listOf("👾", "🕹️", "⚡", "💎")),
)

fun giftTheme(id: String?) = GiftThemes.firstOrNull { it.id == id } ?: GiftThemes[1]

fun hexColor(hex: String, fallback: Color = BwlColors.Sky): Color =
    hex.removePrefix("#").toLongOrNull(16)?.let { Color(0xFF000000 or it) } ?: fallback

/** Server theme (preset or quiz-generated) → the app's theme model. */
fun com.guykadosh22.kids_birth_day_gift_list.data.ThemeDto.toGift() = GiftTheme(
    id = id, emoji = emoji, nameHe = nameHe, nameEn = nameEn,
    primary = hexColor(primary), accent = hexColor(accent), bg = hexColor(bg), text = hexColor(text),
    confetti = confetti.drop(1).take(4),
)

/** Theme for a list: the server-resolved one when present, otherwise the preset by id. */
fun listTheme(theme: com.guykadosh22.kids_birth_day_gift_list.data.ThemeDto?, themeId: String?) = theme?.toGift() ?: giftTheme(themeId)
