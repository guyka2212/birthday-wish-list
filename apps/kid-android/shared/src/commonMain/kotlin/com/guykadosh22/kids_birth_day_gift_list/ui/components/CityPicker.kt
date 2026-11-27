package com.guykadosh22.kids_birth_day_gift_list.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.guykadosh22.kids_birth_day_gift_list.data.CityItem
import com.guykadosh22.kids_birth_day_gift_list.data.Repository
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.EnglishStrings
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.LocalStrings
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Space

/** Read-only field that opens a searchable list of cities. [value] is a city id ("" = none). */
@Composable
fun CityPicker(repo: Repository, value: String, onChange: (String) -> Unit, modifier: Modifier = Modifier, error: String? = null) {
    val s = LocalStrings.current
    val en = s === EnglishStrings
    var cities by remember { mutableStateOf<List<CityItem>>(emptyList()) }
    var open by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    LaunchedEffect(Unit) { runCatching { repo.cities() }.onSuccess { cities = it } }
    val label = cities.firstOrNull { it.id == value }?.let { if (en) it.en else it.he } ?: ""

    Box(modifier.fillMaxWidth()) {
        BwlTextField(value = label.let { if (it.isEmpty()) "" else "📍 $it" }, onValueChange = {}, label = s.city, enabled = false, supporting = s.cityHint, error = error)
        Box(Modifier.matchParentSize().bouncyClick(role = Role.Button) { open = true })
    }
    if (open) {
        val filtered = cities
            .filter { query.isBlank() || it.he.contains(query.trim()) || it.en.contains(query.trim(), ignoreCase = true) }
            .sortedBy { if (en) it.en else it.he }
        AlertDialog(
            onDismissRequest = { open = false },
            title = { Text(s.city) },
            text = {
                Column {
                    BwlTextField(query, { query = it }, s.searchCity)
                    LazyColumn(Modifier.heightIn(max = 360.dp).padding(top = Space.s)) {
                        items(filtered, key = { it.id }) { c ->
                            Text(
                                (if (c.id == value) "✓ " else "") + (if (en) c.en else c.he),
                                style = MaterialTheme.typography.bodyLarge,
                                modifier = Modifier.fillMaxWidth().bouncyClick { onChange(c.id); open = false }.padding(vertical = Space.m, horizontal = Space.s),
                            )
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { open = false }) { Text(s.close) } },
        )
    }
}
