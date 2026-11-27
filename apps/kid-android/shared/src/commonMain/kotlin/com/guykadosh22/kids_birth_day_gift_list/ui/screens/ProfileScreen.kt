package com.guykadosh22.kids_birth_day_gift_list.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.guykadosh22.kids_birth_day_gift_list.LocalPlatform
import com.guykadosh22.kids_birth_day_gift_list.data.KidProfile
import com.guykadosh22.kids_birth_day_gift_list.data.ProfileUpdate
import com.guykadosh22.kids_birth_day_gift_list.data.Repository
import com.guykadosh22.kids_birth_day_gift_list.ui.ProfileViewModel
import com.guykadosh22.kids_birth_day_gift_list.ui.SessionViewModel
import com.guykadosh22.kids_birth_day_gift_list.ui.components.PhotoPicker
import com.guykadosh22.kids_birth_day_gift_list.ui.components.CityPicker
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ProfilePhoto
import com.guykadosh22.kids_birth_day_gift_list.ui.components.rememberImage
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import com.guykadosh22.kids_birth_day_gift_list.ui.components.Avatar
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BigButton
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BwlCard
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BwlTextField
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ButtonKind
import com.guykadosh22.kids_birth_day_gift_list.ui.components.Chip
import com.guykadosh22.kids_birth_day_gift_list.ui.components.LoadingState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.Pill
import com.guykadosh22.kids_birth_day_gift_list.ui.components.bouncyClick
import com.guykadosh22.kids_birth_day_gift_list.ui.errorMessage
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.BwlColors
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.LocalStrings
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Space

/** פרופיל — large avatar, username / email / password (with eye toggle) and a לערוך button, as on the board. */
@Composable
fun ProfileScreen(
    repo: Repository,
    profile: KidProfile?,
    language: String,
    photoBytes: ByteArray?,
    session: SessionViewModel,
    onProfile: (KidProfile) -> Unit,
    onLanguage: (String) -> Unit,
    onLogout: () -> Unit,
    onDeleted: () -> Unit,
) {
    if (profile == null) {
        LoadingState(rows = 4)
        return
    }
    val s = LocalStrings.current
    val platform = LocalPlatform.current
    val vm = viewModel { ProfileViewModel(repo) }
    val busy by vm.busy.collectAsState()
    val error by vm.error.collectAsState()

    var editing by rememberSaveable { mutableStateOf(false) }
    var username by rememberSaveable(profile.username) { mutableStateOf(profile.username) }
    var email by rememberSaveable(profile.email) { mutableStateOf(profile.email) }
    var avatar by rememberSaveable(profile.avatar) { mutableStateOf(profile.avatar) }
    var city by rememberSaveable(profile.city) { mutableStateOf(profile.city ?: "") }
    var currentPassword by rememberSaveable { mutableStateOf("") }
    var newPassword by rememberSaveable { mutableStateOf("") }
    var confirmDelete by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(Space.l),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Space.m),
    ) {
        val scope = rememberCoroutineScope()
        if (editing) {
            // change the photo right away: take a new one or pick from the gallery
            PhotoPicker(
                photoBytes, avatar,
                onPicked = { bytes -> scope.launch { if (!session.setPhoto(bytes)) platform.toast(s.photoUploadFailed) } },
                onRemove = { scope.launch { session.setPhoto(null) } },
                size = 128.dp,
            )
            Text(s.orCharacter, style = MaterialTheme.typography.labelMedium, color = BwlColors.InkSoft)
            Row(horizontalArrangement = Arrangement.spacedBy(Space.xs)) {
                Avatars.forEach { a ->
                    Box(Modifier.weight(1f).bouncyClick { avatar = a }, contentAlignment = Alignment.Center) {
                        Avatar(a, size = 30.dp, ring = if (a == avatar) BwlColors.SkyDeep else Color.Transparent)
                    }
                }
            }
        } else {
            ProfilePhoto(rememberImage(photoBytes), avatar, size = 128.dp, ring = BwlColors.Sky)
        }
        Pill(
            if (profile.consentStatus == "verified") s.parentOk else s.parentPending,
            if (profile.consentStatus == "verified") Color(0xFFDDF7EC) else Color(0xFFFFF3C4),
            if (profile.consentStatus == "verified") BwlColors.Mint else BwlColors.Ink,
        )
        if (profile.consentStatus != "verified") {
            BigButton(s.resendConsent, { vm.resendConsent { platform.toast(s.consentSent) } }, kind = ButtonKind.Ghost)
        }

        BwlTextField(username, { username = it }, s.username, enabled = editing)
        BwlTextField(email, { email = it.trim() }, s.email, keyboardType = KeyboardType.Email, enabled = editing)
        // the city can be changed any time (it decides which shops the kid sees)
        CityPicker(repo, city, { picked ->
            city = picked
            vm.save(ProfileUpdate(city = picked)) { onProfile(it); platform.toast(s.profileSaved) }
        })
        if (editing) {
            BwlTextField(currentPassword, { currentPassword = it }, s.currentPassword, password = true)
            BwlTextField(newPassword, { newPassword = it }, s.newPassword, password = true, supporting = s.passwordRules)
        } else {
            BwlTextField("••••••••", {}, s.password, password = true, enabled = false)
        }
        error?.let { Text(errorMessage(it, s), color = BwlColors.Danger) }

        BigButton(
            text = if (editing) s.save else s.edit,
            loading = busy,
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                if (!editing) {
                    editing = true
                } else {
                    vm.save(
                        ProfileUpdate(
                            username = username.trim().takeIf { it != profile.username },
                            email = email.takeIf { it != profile.email },
                            avatar = avatar.takeIf { it != profile.avatar },
                            currentPassword = currentPassword.ifBlank { null },
                            newPassword = newPassword.ifBlank { null },
                        ),
                    ) {
                        onProfile(it)
                        editing = false
                        currentPassword = ""
                        newPassword = ""
                        platform.toast(s.profileSaved)
                    }
                }
            },
        )
        if (editing) BigButton(s.cancel, { editing = false; username = profile.username; email = profile.email; avatar = profile.avatar }, Modifier.fillMaxWidth(), kind = ButtonKind.Ghost)

        BwlCard(Modifier.fillMaxWidth()) {
            Text(s.language, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(Space.s))
            Row(horizontalArrangement = Arrangement.spacedBy(Space.s)) {
                Chip("עברית", language == "he", { onLanguage("he") }, leading = "🇮🇱")
                Chip("English", language == "en", { onLanguage("en") }, leading = "🇬🇧")
            }
        }
        BigButton(s.logout, onLogout, Modifier.fillMaxWidth(), kind = ButtonKind.Soft, leading = "👋")
        BigButton(s.deleteAccount, { confirmDelete = true }, Modifier.fillMaxWidth(), kind = ButtonKind.Danger)
        Spacer(Modifier.height(Space.xl))
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text(s.deleteAccountQ) },
            text = { Text(s.deleteAccountBody) },
            confirmButton = { TextButton(onClick = { confirmDelete = false; vm.deleteAccount(onDeleted) }) { Text(s.delete, color = BwlColors.Danger) } },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text(s.cancel) } },
        )
    }
}
