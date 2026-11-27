package com.guykadosh22.kids_birth_day_gift_list

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import coil3.ImageLoader
import coil3.compose.setSingletonImageLoaderFactory
import coil3.network.ktor3.KtorNetworkFetcherFactory
import coil3.svg.SvgDecoder
import com.guykadosh22.kids_birth_day_gift_list.data.Repository
import com.guykadosh22.kids_birth_day_gift_list.ui.SessionViewModel
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BottomNav
import com.guykadosh22.kids_birth_day_gift_list.ui.components.Tab
import com.guykadosh22.kids_birth_day_gift_list.ui.components.TopBar
import com.guykadosh22.kids_birth_day_gift_list.ui.screens.AuthScreen
import com.guykadosh22.kids_birth_day_gift_list.ui.screens.EditListScreen
import com.guykadosh22.kids_birth_day_gift_list.ui.screens.HomeScreen
import com.guykadosh22.kids_birth_day_gift_list.ui.screens.ListsScreen
import com.guykadosh22.kids_birth_day_gift_list.ui.screens.NewListScreen
import com.guykadosh22.kids_birth_day_gift_list.ui.screens.ProfileScreen
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.BwlColors
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.BwlTheme
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.LocalStrings

object Routes {
    const val HOME = "home"
    const val LISTS = "lists"
    const val NEW = "new"
    const val PROFILE = "profile"
    const val EDIT = "edit/{id}"
    fun edit(id: String) = "edit/$id"
}

@Composable
fun App(repo: Repository, platform: PlatformActions, openListId: String? = null) {
    setSingletonImageLoaderFactory { ctx ->
        ImageLoader.Builder(ctx).components {
            add(KtorNetworkFetcherFactory())
            add(SvgDecoder.Factory())
        }.build()
    }
    var language by remember { mutableStateOf(platform.loadLanguage()) }
    CompositionLocalProvider(LocalPlatform provides platform) {
        BwlTheme(language) {
            val session = viewModel { SessionViewModel(repo) }
            val loggedIn by session.loggedIn.collectAsState()
            if (!loggedIn) {
                AuthScreen(repo, language, onLoggedIn = { session.onLoggedIn(); platform.requestNotificationPermission() })
            } else {
                MainShell(repo, session, language, openListId, onLanguage = { language = it; platform.saveLanguage(it) })
            }
        }
    }
}

@Composable
private fun MainShell(repo: Repository, session: SessionViewModel, language: String, openListId: String?, onLanguage: (String) -> Unit) {
    val s = LocalStrings.current
    val nav = rememberNavController()
    val profile by session.profile.collectAsState()
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route
    val tab = when (route) {
        Routes.HOME -> Tab.Home
        Routes.LISTS, Routes.EDIT -> Tab.Lists
        Routes.NEW -> Tab.New
        Routes.PROFILE -> Tab.Profile
        else -> null
    }
    LaunchedEffect(openListId) { openListId?.let { nav.navigate(Routes.edit(it)) } }

    Scaffold(
        containerColor = BwlColors.Bg,
        topBar = {
            TopBar(
                username = profile?.username ?: "…",
                avatar = profile?.avatar ?: "🎈",
                title = when (tab) { Tab.Home -> s.tabHome; Tab.Lists -> if (route == Routes.EDIT) s.editList else s.myLists; Tab.New -> s.newList; Tab.Profile -> s.profile; null -> null },
                onAvatarClick = { nav.goTab(Routes.PROFILE) },
            )
        },
        bottomBar = {
            BottomNav(tab) { t ->
                nav.goTab(
                    when (t) { Tab.Home -> Routes.HOME; Tab.Lists -> Routes.LISTS; Tab.New -> Routes.NEW; Tab.Profile -> Routes.PROFILE },
                )
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).background(Color.Transparent)) {
            NavHost(nav, startDestination = Routes.HOME) {
                composable(Routes.HOME) {
                    HomeScreen(repo, onOpenList = { nav.navigate(Routes.edit(it)) }, onCreateList = { nav.goTab(Routes.NEW) })
                }
                composable(Routes.LISTS) {
                    ListsScreen(repo, onEdit = { nav.navigate(Routes.edit(it)) }, onCreate = { nav.goTab(Routes.NEW) })
                }
                composable(Routes.NEW) {
                    NewListScreen(repo, profile?.firstName ?: "") { id ->
                        nav.navigate(Routes.LISTS) { popUpTo(Routes.HOME) }
                        nav.navigate(Routes.edit(id))
                    }
                }
                composable(Routes.PROFILE) {
                    ProfileScreen(
                        repo, profile, language,
                        onProfile = { session.setProfile(it) },
                        onLanguage = onLanguage,
                        onLogout = { session.logout() },
                        onDeleted = { session.onAccountDeleted() },
                    )
                }
                composable(Routes.EDIT) { e ->
                    val id = e.savedStateHandle.get<String>("id") ?: return@composable
                    EditListScreen(repo, id, profile?.firstName ?: "", profile?.consentStatus == "verified")
                }
            }
        }
    }
}

private fun NavHostController.goTab(route: String) {
    navigate(route) {
        popUpTo(Routes.HOME) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
