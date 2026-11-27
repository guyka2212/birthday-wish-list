package com.guykadosh22.kids_birth_day_gift_list.ui.screens

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.guykadosh22.kids_birth_day_gift_list.LocalPlatform
import com.guykadosh22.kids_birth_day_gift_list.data.ActivityItem
import com.guykadosh22.kids_birth_day_gift_list.data.HomeSummary
import com.guykadosh22.kids_birth_day_gift_list.data.Product
import com.guykadosh22.kids_birth_day_gift_list.data.Repository
import com.guykadosh22.kids_birth_day_gift_list.data.formatShekel
import com.guykadosh22.kids_birth_day_gift_list.ui.HomeViewModel
import com.guykadosh22.kids_birth_day_gift_list.ui.UiState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BigButton
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BwlCard
import com.guykadosh22.kids_birth_day_gift_list.ui.components.EmptyState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ErrorState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.LoadingState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ProductImage
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ProgressBar
import com.guykadosh22.kids_birth_day_gift_list.ui.components.SectionTitle
import com.guykadosh22.kids_birth_day_gift_list.ui.errorMessage
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.BwlColors
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.LocalStrings
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Radius
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Space
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.listTheme
import kotlinx.coroutines.launch

/** Home (empty on the board — designed here): countdown, active list progress, share, trending, surprise-safe activity. */
@Composable
fun HomeScreen(repo: Repository, onOpenList: (String) -> Unit, onCreateList: () -> Unit) {
    val s = LocalStrings.current
    val platform = LocalPlatform.current
    val vm = viewModel { HomeViewModel(repo) }
    val state by vm.state.collectAsState()
    val scope = rememberCoroutineScope()
    var sharing by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { vm.load(silent = state is UiState.Ready) }

    when (val st = state) {
        UiState.Loading -> LoadingState(rows = 4)
        is UiState.Error -> ErrorState(errorMessage(st.error, s), onRetry = { vm.load() })
        is UiState.Ready -> {
            val home = st.data
            LaunchedEffect(home.activity.firstOrNull()?.id) {
                home.activity.firstOrNull()?.let { platform.markActivitySeen(it.createdAt) }
                if (home.unread > 0) vm.markRead()
            }
            LazyColumn(contentPadding = PaddingValues(Space.l), verticalArrangement = Arrangement.spacedBy(Space.l)) {
                item { Greeting(home) }
                item {
                    val list = home.activeList
                    if (list == null) {
                        BwlCard(Modifier.fillMaxWidth()) {
                            EmptyState("📝", s.noListsYetHome, null, action = s.createFirstList, onAction = onCreateList)
                        }
                    } else {
                        val theme = listTheme(list.theme, list.themeId)
                        BwlCard(Modifier.fillMaxWidth(), onClick = { onOpenList(list.id) }) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(theme.emoji, fontSize = 32.sp)
                                Spacer(Modifier.width(Space.s))
                                Column(Modifier.weight(1f)) {
                                    Text(s.activeList, style = MaterialTheme.typography.labelMedium, color = BwlColors.InkSoft)
                                    Text(list.name, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                            }
                            Spacer(Modifier.height(Space.m))
                            val frac = if (list.itemCount == 0) 0f else list.purchasedCount.toFloat() / list.itemCount
                            ProgressBar(frac, Modifier.semantics { contentDescription = s.giftsBought(list.purchasedCount, list.itemCount) })
                            Spacer(Modifier.height(Space.s))
                            Text("🎁 " + s.giftsBought(list.purchasedCount, list.itemCount), style = MaterialTheme.typography.bodyMedium)
                            Spacer(Modifier.height(Space.m))
                            BigButton(
                                text = s.shareMyList,
                                leading = "📤",
                                loading = sharing,
                                modifier = Modifier.fillMaxWidth(),
                                onClick = {
                                    scope.launch {
                                        sharing = true
                                        runCatching { list.share?.takeIf { it.enabled } ?: vm.share(list.id).share }
                                            .onSuccess { share ->
                                                if (share != null) {
                                                    platform.copyToClipboard(share.url)
                                                    platform.share(s.shareMessage(home.profile.firstName, share.url), s.shareTitle)
                                                }
                                            }
                                            .onFailure { platform.toast(errorMessage(it, s)) }
                                        sharing = false
                                    }
                                },
                            )
                        }
                    }
                }
                if (home.trending.isNotEmpty()) {
                    item { SectionTitle(s.trending) }
                    item {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(Space.m)) {
                            items(home.trending, key = { it.id }) { p -> TrendingCard(p) { home.activeList?.let { onOpenList(it.id) } ?: onCreateList() } }
                        }
                    }
                }
                item { SectionTitle(s.recentActivity) }
                if (home.activity.isEmpty()) {
                    item { BwlCard(Modifier.fillMaxWidth()) { Text("🤫 " + s.noActivity, style = MaterialTheme.typography.bodyLarge, color = BwlColors.InkSoft) } }
                } else {
                    items(home.activity, key = { it.id }) { ActivityRow(it) }
                }
                item { Spacer(Modifier.height(Space.xl)) }
            }
        }
    }
}

@Composable
private fun Greeting(home: HomeSummary) {
    val s = LocalStrings.current
    val t = rememberInfiniteTransition()
    val wobble by t.animateFloat(-6f, 6f, infiniteRepeatable(tween(700), RepeatMode.Reverse))
    Box(
        Modifier.fillMaxWidth().clip(Radius.card)
            .background(Brush.linearGradient(listOf(Color(0xFFFF9AD5), Color(0xFFFFC93C), Color(0xFF7FE7DC))))
            .padding(Space.xl),
    ) {
        Column {
            Text(s.hello(home.profile.firstName), style = MaterialTheme.typography.headlineSmall, color = BwlColors.Ink)
            Spacer(Modifier.height(Space.s))
            val d = home.daysToBirthday
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (d != null) {
                    Box(Modifier.size(72.dp).clip(CircleShape).background(Color.White), contentAlignment = Alignment.Center) {
                        Text(if (d == 0) "🎉" else d.toString(), style = MaterialTheme.typography.headlineMedium, color = BwlColors.SkyDeep)
                    }
                    Spacer(Modifier.width(Space.m))
                }
                Text(
                    when { d == null -> s.noBirthday; d == 0 -> s.birthdayToday; else -> s.daysToBirthday(d) },
                    style = MaterialTheme.typography.titleMedium, color = BwlColors.Ink, modifier = Modifier.weight(1f),
                )
                Text("🎂", fontSize = 40.sp, modifier = Modifier.rotate(wobble))
            }
        }
    }
}

@Composable
private fun TrendingCard(p: Product, onClick: () -> Unit) {
    BwlCard(Modifier.width(150.dp), onClick = onClick, padding = PaddingValues(Space.s)) {
        ProductImage(p, Modifier.fillMaxWidth().aspectRatio(1f))
        Spacer(Modifier.height(Space.xs))
        Text(p.title, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.height(40.dp))
        Text(formatShekel(p.priceAgorot), style = MaterialTheme.typography.titleMedium, color = BwlColors.SkyDeep)
    }
}

@Composable
private fun ActivityRow(a: ActivityItem) {
    BwlCard(Modifier.fillMaxWidth(), color = if (a.read) BwlColors.Surface else Color(0xFFFFF7DD)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(if (a.kind == "gift_bought") "🎁" else "✨", fontSize = 30.sp)
            Spacer(Modifier.width(Space.m))
            Column(Modifier.weight(1f)) {
                Text(if (a.kind == "gift_bought") LocalStrings.current.notifTitle else a.title, style = MaterialTheme.typography.titleSmall)
                Text(a.body, style = MaterialTheme.typography.bodySmall, color = BwlColors.InkSoft)
            }
        }
    }
}
