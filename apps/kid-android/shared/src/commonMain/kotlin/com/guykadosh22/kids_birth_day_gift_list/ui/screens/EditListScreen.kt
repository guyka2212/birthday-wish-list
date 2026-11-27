package com.guykadosh22.kids_birth_day_gift_list.ui.screens

import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.RangeSlider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.guykadosh22.kids_birth_day_gift_list.LocalPlatform
import com.guykadosh22.kids_birth_day_gift_list.data.CatalogFilter
import com.guykadosh22.kids_birth_day_gift_list.data.ListDetail
import com.guykadosh22.kids_birth_day_gift_list.data.Repository
import com.guykadosh22.kids_birth_day_gift_list.data.ShopFilterItem
import com.guykadosh22.kids_birth_day_gift_list.ui.EditListViewModel
import com.guykadosh22.kids_birth_day_gift_list.ui.ShareAction
import com.guykadosh22.kids_birth_day_gift_list.ui.UiState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BigButton
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BwlCard
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ButtonKind
import com.guykadosh22.kids_birth_day_gift_list.ui.components.Chip
import com.guykadosh22.kids_birth_day_gift_list.ui.components.EmptyState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ErrorState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.LoadingState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.Pill
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ProductImage
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ProductTile
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ThemePreview
import com.guykadosh22.kids_birth_day_gift_list.ui.components.bouncyClick
import com.guykadosh22.kids_birth_day_gift_list.ui.errorMessage
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.BwlColors
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.CategoryEmoji
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.LocalStrings
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Radius
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Space
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.giftTheme

/** לערוך — search (חיפוש) + filter (סינון) over products from registered shops; tap to add/remove. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditListScreen(repo: Repository, listId: String, kidFirstName: String, consentVerified: Boolean) {
    val s = LocalStrings.current
    val platform = LocalPlatform.current
    val vm = viewModel(key = "edit-$listId") { EditListViewModel(repo, listId) }
    val state by vm.state.collectAsState()
    val message by vm.messages.collectAsState()
    var showFilter by remember { mutableStateOf(false) }
    var showShare by remember { mutableStateOf(false) }
    var showTheme by remember { mutableStateOf(false) }

    LaunchedEffect(message) {
        message?.let { platform.toast(errorMessage(it, s)); vm.messages.value = null }
    }

    when (val ls = state.list) {
        UiState.Loading -> LoadingState(rows = 5)
        is UiState.Error -> ErrorState(errorMessage(ls.error, s), onRetry = { vm.loadList() })
        is UiState.Ready -> {
            val list = ls.data
            val inList = list.items.associateBy { it.product.id }
            LazyVerticalGrid(
                columns = GridCells.Adaptive(160.dp),
                contentPadding = PaddingValues(Space.l),
                horizontalArrangement = Arrangement.spacedBy(Space.m),
                verticalArrangement = Arrangement.spacedBy(Space.m),
            ) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    ListHeader(list, onShare = { showShare = true }, onTheme = { showTheme = true })
                }
                item(span = { GridItemSpan(maxLineSpan) }) { MyGiftsStrip(list) { vm.toggle(it) } }
                item(span = { GridItemSpan(maxLineSpan) }) {
                    SearchAndFilter(state.filter, onQuery = { vm.setFilter(state.filter.copy(query = it)) }, onFilter = { showFilter = true })
                }
                when (val cat = state.catalog) {
                    UiState.Loading -> item(span = { GridItemSpan(maxLineSpan) }) { LoadingState(rows = 2) }
                    is UiState.Error -> item(span = { GridItemSpan(maxLineSpan) }) { ErrorState(errorMessage(cat.error, s), onRetry = { vm.loadCatalog() }) }
                    is UiState.Ready -> if (cat.data.isEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            EmptyState("🔍", s.noProducts, s.noProductsBody, action = if (state.filter != CatalogFilter()) s.clearFilters else null, onAction = { vm.setFilter(CatalogFilter()) })
                        }
                    } else {
                        items(cat.data, key = { it.id }) { p ->
                            val item = inList[p.id]
                            ProductTile(p, inList = item != null, purchased = item?.purchased == true, busy = p.id in state.busyProductIds, onToggle = { vm.toggle(p) })
                        }
                    }
                }
                item(span = { GridItemSpan(maxLineSpan) }) { Spacer(Modifier.height(Space.xl)) }
            }

            if (showFilter) {
                ModalBottomSheet(onDismissRequest = { showFilter = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
                    FilterSheet(state.filter, state.shops, onApply = { vm.setFilter(it); showFilter = false })
                }
            }
            if (showShare) {
                ModalBottomSheet(onDismissRequest = { showShare = false }) {
                    ShareSheet(list, kidFirstName, consentVerified, state.shareBusy, vm)
                }
            }
            if (showTheme) {
                ModalBottomSheet(onDismissRequest = { showTheme = false }) {
                    Column(Modifier.padding(Space.l).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(Space.m)) {
                        ThemePicker(list.themeId) { vm.updateDetails(com.guykadosh22.kids_birth_day_gift_list.data.ListUpdate(themeId = it)) }
                        ThemePreview(giftTheme(list.themeId), kidFirstName, list.name, Modifier.fillMaxWidth())
                        BigButton(s.done, { showTheme = false }, Modifier.fillMaxWidth())
                    }
                }
            }
        }
    }
}

@Composable
private fun ListHeader(list: ListDetail, onShare: () -> Unit, onTheme: () -> Unit) {
    val s = LocalStrings.current
    val theme = giftTheme(list.themeId)
    BwlCard(Modifier.fillMaxWidth(), color = theme.bg) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(56.dp).clip(CircleShape).background(theme.primary).bouncyClick(onClick = onTheme)
                    .semantics { contentDescription = s.pickTheme },
                contentAlignment = Alignment.Center,
            ) { Text(theme.emoji, fontSize = 28.sp) }
            Spacer(Modifier.width(Space.m))
            Column(Modifier.weight(1f)) {
                Text(list.name, style = MaterialTheme.typography.titleLarge, color = theme.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(s.giftsBought(list.purchasedCount, list.itemCount), style = MaterialTheme.typography.bodySmall, color = theme.text.copy(alpha = 0.8f))
            }
            BigButton(s.share, onShare, kind = ButtonKind.Sun, leading = "📤", height = 48.dp)
        }
    }
}

@Composable
private fun MyGiftsStrip(list: ListDetail, onRemove: (com.guykadosh22.kids_birth_day_gift_list.data.Product) -> Unit) {
    val s = LocalStrings.current
    Column {
        Text("${s.myGifts} (${list.items.size})", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(bottom = Space.s))
        if (list.items.isEmpty()) {
            Text(s.emptyListBody, style = MaterialTheme.typography.bodyMedium, color = BwlColors.InkSoft)
        } else {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(Space.s)) {
                items(list.items, key = { it.id }) { item ->
                    Column(
                        Modifier.width(96.dp).clip(Radius.card).background(BwlColors.Surface).padding(Space.xs)
                            .semantics { contentDescription = item.product.title + if (item.purchased) ", ${s.alreadyBought}" else "" },
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box {
                            ProductImage(item.product, Modifier.size(80.dp).alpha(if (item.purchased) 0.6f else 1f))
                            if (item.purchased) {
                                Pill("✓", BwlColors.Mint, Color.White, Modifier.align(Alignment.TopStart))
                            } else {
                                Box(
                                    Modifier.align(Alignment.TopEnd).size(30.dp).clip(CircleShape).background(Color.White)
                                        .bouncyClick { onRemove(item.product) }.semantics { contentDescription = s.remove + " " + item.product.title },
                                    contentAlignment = Alignment.Center,
                                ) { Text("✕", fontSize = 13.sp, color = BwlColors.Danger) }
                            }
                        }
                        Text(item.product.title, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchAndFilter(filter: CatalogFilter, onQuery: (String) -> Unit, onFilter: () -> Unit) {
    val s = LocalStrings.current
    Column(verticalArrangement = Arrangement.spacedBy(Space.s)) {
        Text(s.catalog, style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(
            value = filter.query,
            onValueChange = { if (it.length <= 60) onQuery(it) },
            placeholder = { Text(s.search) },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            singleLine = true,
            shape = Radius.field,
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = s.search },
            colors = OutlinedTextFieldDefaults.colors(focusedContainerColor = Color.White, unfocusedContainerColor = Color.White, unfocusedBorderColor = BwlColors.Line),
        )
        BigButton(
            text = if (filter.activeCount > 0) "${s.filter} (${filter.activeCount})" else s.filter,
            onClick = onFilter,
            kind = if (filter.activeCount > 0) ButtonKind.Sky else ButtonKind.Soft,
            leading = "🎛️",
            height = 46.dp,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** סינון — by shop (סינון לפי חנויות), category, price range and stock. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FilterSheet(current: CatalogFilter, shops: List<ShopFilterItem>, onApply: (CatalogFilter) -> Unit) {
    val s = LocalStrings.current
    var f by remember { mutableStateOf(current) }
    Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = Space.l).navigationBarsPadding(),
        verticalArrangement = Arrangement.spacedBy(Space.m),
    ) {
        Text(s.filterByShops, style = MaterialTheme.typography.titleLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s), verticalArrangement = Arrangement.spacedBy(Space.s)) {
            shops.forEach { shop ->
                Chip(shop.name, shop.id in f.shopIds, onClick = {
                    f = f.copy(shopIds = if (shop.id in f.shopIds) f.shopIds - shop.id else f.shopIds + shop.id)
                }, leading = "🏪")
            }
        }
        Text(s.categories, style = MaterialTheme.typography.titleMedium)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s), verticalArrangement = Arrangement.spacedBy(Space.s)) {
            s.categoryNames.forEach { (id, label) ->
                Chip(label, id in f.categories, onClick = {
                    f = f.copy(categories = if (id in f.categories) f.categories - id else f.categories + id)
                }, leading = CategoryEmoji[id])
            }
        }
        Text("${s.priceRange}: ₪${f.minPriceShekel} – ₪${f.maxPriceShekel}${if (f.maxPriceShekel >= CatalogFilter.MAX_PRICE_SHEKEL) "+" else ""}", style = MaterialTheme.typography.titleMedium)
        RangeSlider(
            value = f.minPriceShekel.toFloat()..f.maxPriceShekel.toFloat(),
            onValueChange = { r -> f = f.copy(minPriceShekel = (r.start / 10).toInt() * 10, maxPriceShekel = (r.endInclusive / 10).toInt() * 10) },
            valueRange = 0f..CatalogFilter.MAX_PRICE_SHEKEL.toFloat(),
            modifier = Modifier.semantics { contentDescription = s.priceRange },
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(s.inStockOnly, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            Switch(checked = f.inStockOnly, onCheckedChange = { f = f.copy(inStockOnly = it) })
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Space.m)) {
            BigButton(s.clearFilters, { f = CatalogFilter(query = current.query) }, Modifier.weight(1f), kind = ButtonKind.Soft)
            BigButton(s.apply, { onApply(f) }, Modifier.weight(1f))
        }
        Spacer(Modifier.height(Space.l))
    }
}

@Composable
private fun ShareSheet(list: ListDetail, kidFirstName: String, consentVerified: Boolean, busy: Boolean, vm: EditListViewModel) {
    val s = LocalStrings.current
    val platform = LocalPlatform.current
    val share = list.share
    Column(Modifier.fillMaxWidth().padding(Space.l).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(Space.m)) {
        Text(s.shareTitle, style = MaterialTheme.typography.headlineSmall)
        if (!consentVerified) {
            BwlCard(Modifier.fillMaxWidth(), color = Color(0xFFFFF3C4)) {
                Text("👨‍👩‍👧 " + s.consentNeeded, style = MaterialTheme.typography.bodyLarge)
                Spacer(Modifier.height(Space.s))
                BigButton(s.resendConsent, { vm.resendConsent { platform.toast(s.consentSent) } }, Modifier.fillMaxWidth(), kind = ButtonKind.Soft)
            }
            return@Column
        }
        if (share == null || !share.enabled) {
            Text(if (share == null) "🔗" else s.sharingOff, style = MaterialTheme.typography.bodyLarge, color = BwlColors.InkSoft)
            BigButton(s.turnOn, { vm.share(ShareAction.Enable) }, Modifier.fillMaxWidth(), loading = busy, leading = "🔗")
        } else {
            Box(Modifier.fillMaxWidth().clip(Radius.field).background(BwlColors.SkySoft).padding(Space.m)) {
                Text(share.url, style = MaterialTheme.typography.bodyMedium, color = BwlColors.SkyDeep, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            BigButton(
                s.share, {
                    platform.copyToClipboard(share.url)
                    platform.share(s.shareMessage(kidFirstName, share.url), s.shareTitle)
                }, Modifier.fillMaxWidth(), leading = "📤", height = 60.dp,
            )
            BigButton(s.copyLink, { platform.copyToClipboard(share.url); platform.toast(s.copied) }, Modifier.fillMaxWidth(), kind = ButtonKind.Soft, leading = "📋")
            Row(horizontalArrangement = Arrangement.spacedBy(Space.m)) {
                BigButton(s.newLink, { vm.share(ShareAction.Regenerate) { platform.toast(s.newLinkBody) } }, Modifier.weight(1f), kind = ButtonKind.Soft, loading = busy)
                BigButton(s.turnOff, { vm.share(ShareAction.Disable) }, Modifier.weight(1f), kind = ButtonKind.Danger, loading = busy)
            }
            Text(s.newLinkBody, style = MaterialTheme.typography.bodySmall, color = BwlColors.InkSoft)
        }
        Spacer(Modifier.height(Space.s))
    }
}

