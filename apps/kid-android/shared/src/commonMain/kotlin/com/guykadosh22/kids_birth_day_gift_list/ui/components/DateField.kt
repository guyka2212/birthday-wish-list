package com.guykadosh22.kids_birth_day_gift_list.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.LocalStrings

/** Read-only field that opens a Material date picker. Value is YYYY-MM-DD or "". */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateField(value: String, onChange: (String) -> Unit, label: String, modifier: Modifier = Modifier) {
    val s = LocalStrings.current
    var open by remember { mutableStateOf(false) }
    Box(modifier.fillMaxWidth()) {
        BwlTextField(value = displayDate(value), onValueChange = {}, label = label, enabled = false)
        Box(Modifier.matchParentSize().bouncyClick(role = Role.Button) { open = true })
    }
    if (open) {
        val state = rememberDatePickerState(initialSelectedDateMillis = isoDateToMillis(value))
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { onChange(millisToIsoDate(it)) }
                    open = false
                }) { Text(s.save) }
            },
            dismissButton = { TextButton(onClick = { open = false }) { Text(s.cancel) } },
        ) { DatePicker(state = state) }
    }
}

fun displayDate(iso: String): String {
    val p = iso.split("-")
    return if (p.size == 3) "${p[2]}/${p[1]}/${p[0]}" else ""
}

/** Epoch millis (UTC) → YYYY-MM-DD using the civil-from-days algorithm (no extra date library needed). */
fun millisToIsoDate(ms: Long): String {
    val z = ms.floorDiv(86_400_000L) + 719_468
    val era = z.floorDiv(146_097L)
    val doe = z - era * 146_097
    val yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365
    val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
    val mp = (5 * doy + 2) / 153
    val d = doy - (153 * mp + 2) / 5 + 1
    val m = if (mp < 10) mp + 3 else mp - 9
    val y = yoe + era * 400 + if (m <= 2) 1 else 0
    return "${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}"
}

fun isoDateToMillis(iso: String): Long? {
    val p = iso.split("-").mapNotNull { it.toIntOrNull() }
    if (p.size != 3) return null
    var (y, m, d) = Triple(p[0].toLong(), p[1].toLong(), p[2].toLong())
    y -= if (m <= 2) 1 else 0
    val era = y.floorDiv(400L)
    val yoe = y - era * 400
    val doy = (153 * (if (m > 2) m - 3 else m + 9) + 2) / 5 + d - 1
    val doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
    return (era * 146_097 + doe - 719_468) * 86_400_000L
}
