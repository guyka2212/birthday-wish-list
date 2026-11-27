package com.guykadosh22.kids_birth_day_gift_list.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.SubcomposeAsyncImage
import com.guykadosh22.kids_birth_day_gift_list.data.Product
import com.guykadosh22.kids_birth_day_gift_list.data.formatShekel
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.BwlColors
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.CategoryEmoji
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.GiftTheme
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.LocalStrings
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Radius
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Space

/** Top bar from the board: round profile picture + ${USERNAME}. */
@Composable
fun TopBar(username: String, avatar: String, title: String? = null, photo: androidx.compose.ui.graphics.ImageBitmap? = null, onAvatarClick: () -> Unit = {}, trailing: @Composable () -> Unit = {}) {
    Box(
        Modifier
            .fillMaxWidth()
            .background(Brush.horizontalGradient(listOf(BwlColors.Sky, Color(0xFF5BC0FF))))
            .statusBarsPadding()
            .padding(horizontal = Space.l, vertical = Space.s),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.bouncyClick(onClick = onAvatarClick).semantics { contentDescription = username }) {
                ProfilePhoto(photo, avatar, size = 52.dp)
            }
            Spacer(Modifier.width(Space.m))
            Column(Modifier.weight(1f)) {
                Text(username, color = Color.White, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (title != null) Text(title, color = Color.White.copy(alpha = 0.9f), style = MaterialTheme.typography.bodySmall)
            }
            trailing()
        }
    }
}

enum class Tab { Home, Lists, New, Profile }

/** Bottom nav from the board. In RTL the first tab (בית) sits on the right. */
@Composable
fun BottomNav(selected: Tab?, onSelect: (Tab) -> Unit) {
    val s = LocalStrings.current
    val items = listOf(
        Triple(Tab.Home, s.tabHome, Icons.Filled.Home),
        Triple(Tab.Lists, s.tabLists, Icons.Filled.List),
        Triple(Tab.New, s.tabNew, Icons.Filled.Add),
        Triple(Tab.Profile, s.tabProfile, Icons.Filled.Person),
    )
    Row(
        Modifier
            .fillMaxWidth()
            .shadow(16.dp, RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
            .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
            .background(BwlColors.Sky)
            .navigationBarsPadding()
            .padding(horizontal = Space.s, vertical = Space.s),
        horizontalArrangement = Arrangement.SpaceAround,
    ) {
        items.forEach { (tab, label, icon) -> NavItem(label, icon, tab == selected, isNew = tab == Tab.New) { onSelect(tab) } }
    }
}

@Composable
private fun NavItem(label: String, icon: ImageVector, selected: Boolean, isNew: Boolean, onClick: () -> Unit) {
    val bg by animateColorAsState(if (selected) Color.White else Color.Transparent)
    val scale by animateFloatAsState(if (selected) 1.08f else 1f)
    Column(
        Modifier
            .heightIn(min = 56.dp)
            .clip(RoundedCornerShape(20.dp))
            .bouncyClick(role = Role.Tab, onClick = onClick)
            .semantics { this.selected = selected; contentDescription = label }
            .padding(horizontal = Space.m, vertical = Space.xs),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(40.dp).scale(scale).clip(CircleShape).background(if (isNew && !selected) BwlColors.Sun else bg),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = if (selected) BwlColors.SkyDeep else if (isNew) BwlColors.Ink else Color.White)
        }
        Text(label, color = Color.White, style = MaterialTheme.typography.labelMedium, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium)
    }
}

@Composable
fun ProductImage(product: Product, modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(RoundedCornerShape(18.dp))
            .background(Brush.linearGradient(listOf(Color(0xFFFFF7DD), Color(0xFFE3F2FF)))),
        contentAlignment = Alignment.Center,
    ) {
        SubcomposeAsyncImage(
            model = product.imageUrl,
            contentDescription = product.title,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxWidth().padding(Space.m),
            loading = { Text(CategoryEmoji[product.category] ?: "🎁", fontSize = 40.sp, modifier = Modifier.alpha(0.5f)) },
            error = { Text(CategoryEmoji[product.category] ?: "🎁", fontSize = 40.sp) },
        )
    }
}

/**
 * Product tile for the edit screen grid. Out-of-stock items are greyed out; purchased ones show "already gifted"
 * (never who bought it).
 */
@Composable
fun ProductTile(product: Product, inList: Boolean, purchased: Boolean, busy: Boolean, onToggle: () -> Unit, modifier: Modifier = Modifier) {
    val s = LocalStrings.current
    val disabled = (!product.inStock && !inList) || purchased
    val border by animateColorAsState(if (inList) BwlColors.Mint else Color.Transparent)
    Column(
        modifier
            .shadow(6.dp, Radius.card, ambientColor = BwlColors.Sky.copy(alpha = 0.2f), spotColor = BwlColors.Sky.copy(alpha = 0.2f))
            .clip(Radius.card)
            .background(BwlColors.Surface)
            .background(border.copy(alpha = 0.08f))
            .alpha(if (!product.inStock && !inList) 0.55f else 1f)
            .bouncyClick(enabled = !disabled && !busy, role = Role.Checkbox, onClick = onToggle)
            .semantics {
                contentDescription = buildString {
                    append(product.title); append(", "); append(formatShekel(product.priceAgorot)); append(", "); append(product.shop.name)
                    if (purchased) append(", ${s.alreadyBought}") else if (inList) append(", ${s.inList}") else if (!product.inStock) append(", ${s.outOfStock}")
                }
            }
            .padding(Space.s),
    ) {
        Box {
            ProductImage(product, Modifier.fillMaxWidth().aspectRatio(1f))
            val badge = when {
                purchased -> Triple(s.alreadyBought, BwlColors.Mint, Color.White)
                inList -> Triple("✓ ${s.inList}", BwlColors.Mint, Color.White)
                !product.inStock -> Triple(s.outOfStock, BwlColors.Disabled, BwlColors.Ink)
                else -> null
            }
            if (badge != null) Pill(badge.first, badge.second, badge.third, Modifier.align(Alignment.TopStart).padding(Space.xs))
        }
        Spacer(Modifier.height(Space.s))
        Text(product.title, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.heightIn(min = 40.dp))
        Text(product.shop.name, style = MaterialTheme.typography.bodySmall, color = BwlColors.InkSoft, maxLines = 1, overflow = TextOverflow.Ellipsis)
        product.shop.distanceKm?.let { Text("📍 " + s.kmAway(it), style = MaterialTheme.typography.labelSmall, color = BwlColors.InkSoft) }
        Row(Modifier.fillMaxWidth().padding(top = Space.xs), verticalAlignment = Alignment.CenterVertically) {
            Text(formatShekel(product.priceAgorot), style = MaterialTheme.typography.titleMedium, color = BwlColors.SkyDeep, modifier = Modifier.weight(1f))
            if (!purchased && (product.inStock || inList)) {
                Box(
                    Modifier.size(36.dp).clip(CircleShape).background(if (inList) BwlColors.Mint else BwlColors.Sun),
                    contentAlignment = Alignment.Center,
                ) { Text(if (inList) "✓" else "+", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = if (inList) Color.White else BwlColors.Ink) }
            }
        }
    }
}

/** Live preview of the guest shop in the chosen theme. */
@Composable
fun ThemePreview(theme: GiftTheme, kidName: String, listName: String, modifier: Modifier = Modifier) {
    val s = LocalStrings.current
    Column(modifier.clip(Radius.card).background(theme.bg).padding(Space.l)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(theme.emoji, fontSize = 34.sp)
            Spacer(Modifier.width(Space.s))
            Column(Modifier.weight(1f)) {
                Text(listName.ifBlank { s.listName }, color = theme.text, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(kidName, color = theme.text.copy(alpha = 0.75f), style = MaterialTheme.typography.bodySmall)
            }
            Text(theme.confetti.joinToString(" "), fontSize = 14.sp)
        }
        Spacer(Modifier.height(Space.m))
        Row(horizontalArrangement = Arrangement.spacedBy(Space.s)) {
            repeat(3) { i ->
                Column(Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(if (theme.bg.luminanceApprox() < 0.3f) Color.White.copy(alpha = 0.1f) else Color.White).padding(Space.s)) {
                    Box(Modifier.fillMaxWidth().aspectRatio(1.3f).clip(RoundedCornerShape(10.dp)).background(theme.primary.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                        Text(listOf("🎁", "🧸", "📚")[i], fontSize = 22.sp)
                    }
                    Spacer(Modifier.height(6.dp))
                    Box(Modifier.fillMaxWidth().height(22.dp).clip(RoundedCornerShape(8.dp)).background(theme.accent), contentAlignment = Alignment.Center) {
                        Text("🛒", fontSize = 11.sp)
                    }
                }
            }
        }
        Text(s.preview, color = theme.text.copy(alpha = 0.7f), style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(top = Space.s))
    }
}

private fun Color.luminanceApprox() = 0.299f * red + 0.587f * green + 0.114f * blue
