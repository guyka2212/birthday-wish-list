package com.guykadosh22.kids_birth_day_gift_list.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.guykadosh22.kids_birth_day_gift_list.data.Repository
import com.guykadosh22.kids_birth_day_gift_list.data.SignupRequest
import com.guykadosh22.kids_birth_day_gift_list.LocalPlatform
import com.guykadosh22.kids_birth_day_gift_list.ui.AuthViewModel
import com.guykadosh22.kids_birth_day_gift_list.ui.SessionViewModel
import com.guykadosh22.kids_birth_day_gift_list.ui.components.PhotoPicker
import com.guykadosh22.kids_birth_day_gift_list.ui.components.CityPicker
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import com.guykadosh22.kids_birth_day_gift_list.ui.components.Avatar
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BigButton
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BwlCard
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BwlTextField
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ButtonKind
import com.guykadosh22.kids_birth_day_gift_list.ui.components.DateField
import com.guykadosh22.kids_birth_day_gift_list.ui.components.bouncyClick
import com.guykadosh22.kids_birth_day_gift_list.ui.errorMessage
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.BwlColors
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.LocalStrings
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Space

val Avatars = listOf("🦄", "🦖", "🚀", "🐱", "🐶", "🦊", "🐼", "🐸", "🦁", "🐙", "⚽", "🎮")

private enum class Mode { Login, Signup, Forgot }

private val emailRegex = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
private fun validPassword(p: String) = p.length >= 8 && p.any { it.isLetter() } && p.any { it.isDigit() }

@Composable
fun AuthScreen(repo: Repository, language: String, session: SessionViewModel, onLoggedIn: () -> Unit) {
    val s = LocalStrings.current
    val vm = viewModel { AuthViewModel(repo) }
    val busy by vm.busy.collectAsState()
    val error by vm.error.collectAsState()
    val info by vm.info.collectAsState()
    var mode by rememberSaveable { mutableStateOf(Mode.Login) }

    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var username by rememberSaveable { mutableStateOf("") }
    var firstName by rememberSaveable { mutableStateOf("") }
    var parentEmail by rememberSaveable { mutableStateOf("") }
    var birthday by rememberSaveable { mutableStateOf("") }
    var city by rememberSaveable { mutableStateOf("") }
    var avatar by rememberSaveable { mutableStateOf(Avatars.first()) }
    // saveable: opening the camera/gallery can recreate the activity, which would otherwise drop the picked photo
    var photo by rememberSaveable { mutableStateOf<ByteArray?>(null) }
    val platform = LocalPlatform.current
    val scope = rememberCoroutineScope()
    // after sign-up: save the photo (if one was chosen), then enter the app
    val afterSignup: () -> Unit = {
        val chosen = photo
        if (chosen == null) onLoggedIn() else scope.launch {
            if (!session.setPhoto(chosen)) platform.toast(s.photoUploadFailed)
            onLoggedIn()
        }
    }
    var tried by rememberSaveable { mutableStateOf(false) }

    Box(
        Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(BwlColors.Sky, Color(0xFF8FD3FF), BwlColors.Bg))),
    ) {
        Column(
            Modifier.fillMaxSize().statusBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(Space.xl),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Space.l),
        ) {
            Text("🎁🎈🎂", fontSize = 48.sp, modifier = Modifier.padding(top = Space.xl))
            Text(s.welcomeTitle, style = MaterialTheme.typography.headlineMedium, color = Color.White, textAlign = TextAlign.Center)
            Text(s.welcomeSubtitle, style = MaterialTheme.typography.bodyLarge, color = Color.White.copy(alpha = 0.95f), textAlign = TextAlign.Center)

            BwlCard(Modifier.fillMaxWidth()) {
                AnimatedContent(mode) { m ->
                    Column(verticalArrangement = Arrangement.spacedBy(Space.m)) {
                        Text(
                            when (m) { Mode.Login -> s.login; Mode.Signup -> s.signup; Mode.Forgot -> s.forgotPassword },
                            style = MaterialTheme.typography.headlineSmall,
                        )
                        if (m == Mode.Signup) {
                            // first thing we ask: a picture — take one now or pick from the gallery
                            PhotoPicker(photo, avatar, onPicked = { photo = it }, onRemove = { photo = null })
                            Text(if (photo == null) s.orCharacter else s.chooseAvatar, style = MaterialTheme.typography.titleSmall)
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Space.xs)) {
                                Avatars.take(6).forEach { a ->
                                    Box(Modifier.weight(1f).bouncyClick { avatar = a }, contentAlignment = Alignment.Center) {
                                        Avatar(a, size = 46.dp, ring = if (a == avatar) BwlColors.SkyDeep else Color.Transparent)
                                    }
                                }
                            }
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Space.xs)) {
                                Avatars.drop(6).forEach { a ->
                                    Box(Modifier.weight(1f).bouncyClick { avatar = a }, contentAlignment = Alignment.Center) {
                                        Avatar(a, size = 46.dp, ring = if (a == avatar) BwlColors.SkyDeep else Color.Transparent)
                                    }
                                }
                            }
                            BwlTextField(firstName, { firstName = it }, s.firstName, error = if (tried && firstName.isBlank()) "✱" else null)
                            BwlTextField(username, { username = it }, s.username, error = if (tried && username.trim().length < 2) "✱" else null)
                        }
                        BwlTextField(email, { email = it.trim() }, s.email, keyboardType = KeyboardType.Email, error = if (tried && !emailRegex.matches(email)) "✱" else null)
                        if (m != Mode.Forgot) {
                            BwlTextField(
                                password, { password = it }, s.password, password = true,
                                supporting = if (m == Mode.Signup) s.passwordRules else null,
                                error = if (tried && m == Mode.Signup && !validPassword(password)) s.passwordRules else null,
                            )
                        }
                        if (m == Mode.Signup) {
                            DateField(birthday, { birthday = it }, s.birthday)
                            CityPicker(repo, city, { city = it }, error = if (tried && city.isBlank()) s.cityRequired else null)
                            BwlTextField(
                                parentEmail, { parentEmail = it.trim() }, s.parentEmail, keyboardType = KeyboardType.Email,
                                supporting = s.parentEmailHint,
                                error = if (tried && !emailRegex.matches(parentEmail)) s.parentEmailHint else null,
                            )
                        }

                        val msg = error?.let { errorMessage(it, s) } ?: info
                        if (msg != null) {
                            Text(
                                msg,
                                color = if (error != null) BwlColors.Danger else BwlColors.Mint,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                            )
                        }

                        BigButton(
                            text = when (m) { Mode.Login -> s.login; Mode.Signup -> s.signup; Mode.Forgot -> s.apply },
                            loading = busy,
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                tried = true
                                when (m) {
                                    Mode.Login -> if (emailRegex.matches(email) && password.isNotEmpty()) vm.login(email, password, onLoggedIn)
                                    Mode.Forgot -> if (emailRegex.matches(email)) vm.forgot(email, s.forgotSent)
                                    Mode.Signup -> if (emailRegex.matches(email) && validPassword(password) && emailRegex.matches(parentEmail) &&
                                        firstName.isNotBlank() && username.trim().length >= 2 && city.isNotBlank()
                                    ) {
                                        vm.signup(
                                            SignupRequest(
                                                username = username.trim(), firstName = firstName.trim(), email = email, password = password,
                                                parentEmail = parentEmail, birthday = birthday.ifBlank { null }, avatar = avatar, locale = language, city = city,
                                            ),
                                            afterSignup,
                                        )
                                    }
                                }
                            },
                        )
                        if (m == Mode.Login) BigButton(s.forgotPassword, { mode = Mode.Forgot; vm.error.value = null; vm.info.value = null }, Modifier.fillMaxWidth(), kind = ButtonKind.Ghost)
                    }
                }
            }
            BigButton(
                text = if (mode == Mode.Login) s.noAccount else s.haveAccount,
                onClick = { mode = if (mode == Mode.Login) Mode.Signup else Mode.Login; tried = false; vm.error.value = null; vm.info.value = null },
                kind = ButtonKind.Soft,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(Space.xxl))
        }
    }
}
