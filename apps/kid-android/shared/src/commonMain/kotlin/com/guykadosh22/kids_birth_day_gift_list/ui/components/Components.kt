package com.guykadosh22.kids_birth_day_gift_list.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.BwlColors
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.LocalStrings
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Radius
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Space

/** Springy press feedback for anything tappable. */
@Composable
fun Modifier.bouncyClick(enabled: Boolean = true, role: Role = Role.Button, onClick: () -> Unit): Modifier {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.94f else 1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium))
    return this.scale(scale).clickable(interactionSource = source, indication = null, enabled = enabled, role = role, onClick = onClick)
}

enum class ButtonKind { Sun, Sky, Soft, Danger, Ghost }

@Composable
fun BigButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: ButtonKind = ButtonKind.Sun,
    enabled: Boolean = true,
    loading: Boolean = false,
    leading: String? = null,
    height: Dp = Space.tap,
) {
    val (bg, fg) = when (kind) {
        ButtonKind.Sun -> BwlColors.Sun to BwlColors.Ink
        ButtonKind.Sky -> BwlColors.SkyDeep to Color.White
        ButtonKind.Soft -> BwlColors.SkySoft to BwlColors.SkyDeep
        ButtonKind.Danger -> Color(0xFFFFE9EA) to BwlColors.Danger
        ButtonKind.Ghost -> Color.Transparent to BwlColors.SkyDeep
    }
    val active = enabled && !loading
    Box(
        modifier = modifier
            .heightIn(min = height)
            .then(if (kind == ButtonKind.Sun || kind == ButtonKind.Sky) Modifier.shadow(if (active) 6.dp else 0.dp, Radius.button, ambientColor = bg, spotColor = bg) else Modifier)
            .clip(Radius.button)
            .background(if (active) bg else bg.copy(alpha = 0.5f))
            .bouncyClick(enabled = active, onClick = onClick)
            .padding(horizontal = Space.xl, vertical = Space.m),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(24.dp), color = fg, strokeWidth = 3.dp)
        } else {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                if (leading != null) {
                    Text(leading, fontSize = 20.sp)
                    Spacer(Modifier.width(Space.s))
                }
                Text(text, style = MaterialTheme.typography.labelLarge, color = fg, textAlign = TextAlign.Center)
            }
        }
    }
}

@Composable
fun BwlCard(modifier: Modifier = Modifier, color: Color = BwlColors.Surface, onClick: (() -> Unit)? = null, padding: PaddingValues = PaddingValues(Space.l), content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier
            .shadow(8.dp, Radius.card, ambientColor = BwlColors.Sky.copy(alpha = 0.25f), spotColor = BwlColors.Sky.copy(alpha = 0.25f))
            .clip(Radius.card)
            .background(color)
            .then(if (onClick != null) Modifier.bouncyClick(onClick = onClick) else Modifier)
            .padding(padding),
        content = content,
    )
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier, trailing: @Composable RowScope.() -> Unit = {}) {
    Row(modifier.fillMaxWidth().padding(vertical = Space.s), verticalAlignment = Alignment.CenterVertically) {
        Text(text, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f).semantics { heading() })
        trailing()
    }
}

@Composable
fun Avatar(emoji: String, size: Dp = 48.dp, ring: Color = Color.White, modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(size)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(Color(0xFFFFF3C4), Color(0xFFFFD6EC))))
            .border(3.dp, ring, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(emoji, fontSize = (size.value * 0.5f).sp)
    }
}

@Composable
fun Chip(text: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, leading: String? = null) {
    val bg = if (selected) BwlColors.SkyDeep else BwlColors.Surface
    val fg = if (selected) Color.White else BwlColors.Ink
    Row(
        modifier
            .heightIn(min = 44.dp)
            .clip(Radius.chip)
            .background(bg)
            .border(1.5.dp, if (selected) BwlColors.SkyDeep else BwlColors.Line, Radius.chip)
            .bouncyClick(role = Role.Checkbox, onClick = onClick)
            .semantics { contentDescription = text + if (selected) " ✓" else "" }
            .padding(horizontal = Space.l, vertical = Space.s),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leading != null) {
            Text(leading)
            Spacer(Modifier.width(Space.xs))
        }
        Text(text, style = MaterialTheme.typography.labelMedium, color = fg)
    }
}

@Composable
fun BwlTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    password: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    supporting: String? = null,
    error: String? = null,
    singleLine: Boolean = true,
    minLines: Int = 1,
    enabled: Boolean = true,
) {
    val s = LocalStrings.current
    var visible by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = modifier.fillMaxWidth(),
        enabled = enabled,
        singleLine = singleLine,
        minLines = minLines,
        isError = error != null,
        supportingText = (error ?: supporting)?.let { { Text(it) } },
        shape = Radius.field,
        visualTransformation = if (password && !visible) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboardType),
        trailingIcon = if (password) {
            {
                // the board's {eye} control
                Box(
                    Modifier.size(44.dp).clip(CircleShape).background(BwlColors.SkySoft)
                        .bouncyClick { visible = !visible }
                        .semantics { contentDescription = if (visible) s.hidePassword else s.showPassword },
                    contentAlignment = Alignment.Center,
                ) { Text(if (visible) "🙈" else "👁️", fontSize = 20.sp) }
            }
        } else null,
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = BwlColors.Surface,
            unfocusedContainerColor = BwlColors.Surface,
            disabledContainerColor = BwlColors.Bg,
            unfocusedBorderColor = BwlColors.Line,
            focusedBorderColor = BwlColors.Sky,
        ),
    )
}

// ---------------- states ----------------

@Composable
fun LoadingState(modifier: Modifier = Modifier, rows: Int = 4) {
    val s = LocalStrings.current
    val t = rememberInfiniteTransition()
    val a by t.animateFloat(0.35f, 0.85f, infiniteRepeatable(tween(800), RepeatMode.Reverse))
    Column(modifier.fillMaxWidth().padding(Space.l).semantics { contentDescription = s.loading }, verticalArrangement = Arrangement.spacedBy(Space.m)) {
        repeat(rows) {
            Box(Modifier.fillMaxWidth().height(84.dp).clip(Radius.card).background(BwlColors.SkySoft).alpha(a))
        }
    }
}

@Composable
fun EmptyState(emoji: String, title: String, body: String? = null, modifier: Modifier = Modifier, action: String? = null, onAction: (() -> Unit)? = null) {
    val t = rememberInfiniteTransition()
    val bob by t.animateFloat(0f, -10f, infiniteRepeatable(tween(900), RepeatMode.Reverse))
    Column(modifier.fillMaxWidth().padding(Space.xl), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Space.m)) {
        Text(emoji, fontSize = 64.sp, modifier = Modifier.padding(top = Space.l).offset(y = bob.dp))
        Text(title, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
        if (body != null) Text(body, style = MaterialTheme.typography.bodyLarge, color = BwlColors.InkSoft, textAlign = TextAlign.Center)
        if (action != null && onAction != null) BigButton(action, onAction, Modifier.padding(top = Space.s))
    }
}

@Composable
fun ErrorState(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    val s = LocalStrings.current
    EmptyState("🙈", s.errorTitle, message, modifier, s.retry, onRetry)
}

@Composable
fun FullScreenBox(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { content() }
}

@Composable
fun Pill(text: String, bg: Color, fg: Color, modifier: Modifier = Modifier) {
    Surface(modifier, shape = Radius.chip, color = bg) {
        Text(text, color = fg, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
    }
}

@Composable
fun ProgressBar(fraction: Float, modifier: Modifier = Modifier, color: Color = BwlColors.Mint) {
    val anim by animateFloatAsState(fraction.coerceIn(0f, 1f), tween(900))
    Box(modifier.fillMaxWidth().height(16.dp).clip(Radius.chip).background(BwlColors.SkySoft)) {
        Box(Modifier.fillMaxWidth(anim).height(16.dp).clip(Radius.chip).background(Brush.horizontalGradient(listOf(color, BwlColors.Sun))))
    }
}
