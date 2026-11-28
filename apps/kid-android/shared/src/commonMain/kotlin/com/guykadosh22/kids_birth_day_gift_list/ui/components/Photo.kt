package com.guykadosh22.kids_birth_day_gift_list.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.guykadosh22.kids_birth_day_gift_list.LocalPlatform
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.BwlColors
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.LocalStrings
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Space
import org.jetbrains.compose.resources.decodeToImageBitmap

/** Decodes JPEG/PNG bytes to an ImageBitmap (null if the bytes aren't a valid image). */
@Composable
fun rememberImage(bytes: ByteArray?): ImageBitmap? = remember(bytes) {
    bytes?.let { runCatching { it.decodeToImageBitmap() }.getOrNull() }
}

/** Round profile picture: the kid's photo when there is one, otherwise their emoji character. */
@Composable
fun ProfilePhoto(photo: ImageBitmap?, emoji: String, size: Dp, ring: Color = Color.White, modifier: Modifier = Modifier) {
    if (photo == null) {
        Avatar(emoji, size = size, ring = ring, modifier = modifier)
    } else {
        Image(
            bitmap = photo,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = modifier.size(size).clip(CircleShape).border(3.dp, ring, CircleShape),
        )
    }
}

/**
 * "Add your picture": a big round preview and two buttons — take a photo now, or pick one from the gallery.
 * [onPicked] gets the resized JPEG bytes; [onRemove] is shown only when a photo is set.
 */
@Composable
fun PhotoPicker(photoBytes: ByteArray?, emoji: String, onPicked: (ByteArray) -> Unit, onRemove: (() -> Unit)? = null, size: Dp = 120.dp) {
    val s = LocalStrings.current
    val platform = LocalPlatform.current
    val photo = rememberImage(photoBytes)
    // pick up a photo whose callback was lost because the screen was recreated while the camera was open
    val latestOnPicked by androidx.compose.runtime.rememberUpdatedState(onPicked)
    androidx.compose.runtime.LaunchedEffect(Unit) { platform.takePendingPhoto()?.let { latestOnPicked(it) } }
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Space.s)) {
        Box(contentAlignment = Alignment.BottomEnd) {
            ProfilePhoto(photo, emoji, size, ring = BwlColors.Sky)
            Box(
                Modifier.size(40.dp).clip(CircleShape).background(BwlColors.Sun)
                    .bouncyClick { platform.pickPhoto(fromCamera = true) { it?.let(onPicked) } },
                contentAlignment = Alignment.Center,
            ) { Text("📷") }
        }
        Text(s.photoTitle, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        Text(s.photoPrivacy, style = MaterialTheme.typography.bodySmall, color = BwlColors.InkSoft, textAlign = TextAlign.Center)
        Row(horizontalArrangement = Arrangement.spacedBy(Space.s)) {
            BigButton(s.takePhoto, { platform.pickPhoto(fromCamera = true) { it?.let(onPicked) } }, kind = ButtonKind.Sun, leading = "📷", height = 48.dp)
            BigButton(s.fromGallery, { platform.pickPhoto(fromCamera = false) { it?.let(onPicked) } }, kind = ButtonKind.Soft, leading = "🖼️", height = 48.dp)
        }
        if (photoBytes != null && onRemove != null) BigButton(s.removePhoto, onRemove, kind = ButtonKind.Ghost, height = 40.dp)
    }
}
