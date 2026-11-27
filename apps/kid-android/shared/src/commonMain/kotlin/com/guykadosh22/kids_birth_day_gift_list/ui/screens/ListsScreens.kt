package com.guykadosh22.kids_birth_day_gift_list.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.guykadosh22.kids_birth_day_gift_list.LocalPlatform
import com.guykadosh22.kids_birth_day_gift_list.data.ListCreate
import com.guykadosh22.kids_birth_day_gift_list.data.ListSummary
import com.guykadosh22.kids_birth_day_gift_list.data.Repository
import com.guykadosh22.kids_birth_day_gift_list.ui.ListsViewModel
import com.guykadosh22.kids_birth_day_gift_list.ui.NewListViewModel
import com.guykadosh22.kids_birth_day_gift_list.ui.UiState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BigButton
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BwlCard
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BwlTextField
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ButtonKind
import com.guykadosh22.kids_birth_day_gift_list.ui.components.DateField
import com.guykadosh22.kids_birth_day_gift_list.ui.components.EmptyState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ErrorState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.LoadingState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.Pill
import com.guykadosh22.kids_birth_day_gift_list.ui.components.SectionTitle
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ThemePreview
import com.guykadosh22.kids_birth_day_gift_list.ui.components.bouncyClick
import com.guykadosh22.kids_birth_day_gift_list.ui.errorMessage
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.BwlColors
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.EnglishStrings
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.GiftTheme
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.GiftThemes
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.LocalStrings
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Radius
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Space
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.listTheme

/** רשימות — list cards: name, description and an edit (לערוך) button, as on the board. */
@Composable
fun ListsScreen(repo: Repository, onEdit: (String) -> Unit, onCreate: () -> Unit) {
    val s = LocalStrings.current
    val platform = LocalPlatform.current
    val vm = viewModel { ListsViewModel(repo) }
    val state by vm.state.collectAsState()
    var confirmDelete by remember { mutableStateOf<ListSummary?>(null) }
    LaunchedEffect(Unit) { if (state is UiState.Ready) vm.load() }

    when (val st = state) {
        UiState.Loading -> LoadingState(rows = 5)
        is UiState.Error -> ErrorState(errorMessage(st.error, s), onRetry = { vm.load() })
        is UiState.Ready -> if (st.data.isEmpty()) {
            EmptyState("🗒️", s.noLists, s.noListsBody, action = s.createFirstList, onAction = onCreate)
        } else {
            LazyColumn(contentPadding = PaddingValues(Space.l), verticalArrangement = Arrangement.spacedBy(Space.m)) {
                item { SectionTitle(s.myLists) }
                items(st.data, key = { it.id }) { list ->
                    ListCard(list, onEdit = { onEdit(list.id) }, onDelete = { confirmDelete = list })
                }
                item { Spacer(Modifier.height(Space.xl)) }
            }
        }
    }

    confirmDelete?.let { list ->
        AlertDialog(
            onDismissRequest = { confirmDelete = null },
            title = { Text(s.deleteListQ) },
            text = { Text("\"${list.name}\" — ${s.deleteListBody}") },
            confirmButton = {
                TextButton(onClick = {
                    vm.delete(list.id) { platform.toast(errorMessage(it, s)) }
                    confirmDelete = null
                }) { Text(s.delete, color = BwlColors.Danger) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = null }) { Text(s.cancel) } },
        )
    }
}

@Composable
private fun ListCard(list: ListSummary, onEdit: () -> Unit, onDelete: () -> Unit) {
    val s = LocalStrings.current
    val theme = listTheme(list.theme, list.themeId)
    BwlCard(Modifier.fillMaxWidth(), onClick = onEdit) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(56.dp).clip(CircleShape).background(theme.bg), contentAlignment = Alignment.Center) { Text(theme.emoji, fontSize = 28.sp) }
            Spacer(Modifier.width(Space.m))
            Column(Modifier.weight(1f)) {
                Text(list.name, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (list.description.isNotBlank()) {
                    Text(list.description, style = MaterialTheme.typography.bodyMedium, color = BwlColors.InkSoft, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                Row(Modifier.padding(top = Space.xs), horizontalArrangement = Arrangement.spacedBy(Space.xs)) {
                    Pill("🎁 " + s.gifts(list.itemCount), BwlColors.SkySoft, BwlColors.SkyDeep)
                    if (list.purchasedCount > 0) Pill("✓ ${list.purchasedCount}", Color(0xFFDDF7EC), BwlColors.Mint)
                    if (list.share?.enabled == true) Pill("🔗", Color(0xFFFFF3C4), BwlColors.Ink)
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Space.xs)) {
                BigButton(s.edit, onEdit, kind = ButtonKind.Sun, height = 44.dp)
                Box(
                    Modifier.size(44.dp).clip(CircleShape).bouncyClick(onClick = onDelete).semantics { contentDescription = s.delete + " " + list.name },
                    contentAlignment = Alignment.Center,
                ) { Text("🗑️", fontSize = 18.sp) }
            }
        }
    }
}

/** חדש — name + description + party date + theme with live preview + big ליצור button. */
@Composable
fun NewListScreen(repo: Repository, kidFirstName: String, onCreated: (String) -> Unit) {
    val s = LocalStrings.current
    val vm = viewModel { NewListViewModel(repo) }
    val busy by vm.busy.collectAsState()
    val error by vm.error.collectAsState()
    var name by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var date by rememberSaveable { mutableStateOf("") }
    var quiz by remember { mutableStateOf<Map<String, String>?>(null) }
    var tried by rememberSaveable { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(Space.l),
        verticalArrangement = Arrangement.spacedBy(Space.m),
    ) {
        SectionTitle(s.newList)
        BwlTextField(name, { if (it.length <= 60) name = it }, s.listName, error = if (tried && name.isBlank()) s.nameRequired else null)
        BwlTextField(description, { if (it.length <= 300) description = it }, s.listDescription, singleLine = false, minLines = 3)
        DateField(date, { date = it }, s.partyDate)
        // the guest-shop theme is created from the kid's quiz answers
        QuizFlow(repo, kidFirstName, name, initial = null) { answers, _ -> quiz = answers }
        if (tried && quiz == null) Text(s.quizNeeded, color = BwlColors.Danger)
        error?.let { Text(errorMessage(it, s), color = BwlColors.Danger) }
        Spacer(Modifier.height(Space.s))
        BigButton(
            text = s.create,
            leading = "✨",
            loading = busy,
            height = 68.dp,
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                tried = true
                val answers = quiz
                if (name.isNotBlank() && answers != null) vm.create(ListCreate(name.trim(), description.trim(), date.ifBlank { null }, quiz = answers)) { onCreated(it.id) }
            },
        )
        Spacer(Modifier.height(Space.xl))
    }
}

@Composable
fun ThemePicker(selected: String, onSelect: (String) -> Unit) {
    val s = LocalStrings.current
    Text(s.pickTheme, style = MaterialTheme.typography.titleMedium)
    LazyRow(horizontalArrangement = Arrangement.spacedBy(Space.s), contentPadding = PaddingValues(vertical = Space.xs)) {
        items(GiftThemes, key = { it.id }) { t -> ThemeChip(t, t.id == selected) { onSelect(t.id) } }
    }
}

@Composable
private fun ThemeChip(t: GiftTheme, selected: Boolean, onClick: () -> Unit) {
    val s = LocalStrings.current
    val name = if (s === EnglishStrings) t.nameEn else t.nameHe
    Column(
        Modifier
            .width(88.dp)
            .clip(Radius.card)
            .background(if (selected) t.primary else BwlColors.Surface)
            .bouncyClick(onClick = onClick)
            .semantics { contentDescription = name + if (selected) " ✓" else "" }
            .padding(Space.s),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(Modifier.size(52.dp).clip(CircleShape).background(t.bg), contentAlignment = Alignment.Center) { Text(t.emoji, fontSize = 28.sp) }
        Spacer(Modifier.height(Space.xs))
        Text(name, style = MaterialTheme.typography.labelMedium, color = if (selected) Color.White else BwlColors.Ink, maxLines = 1)
    }
}
