package com.guykadosh22.kids_birth_day_gift_list.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.guykadosh22.kids_birth_day_gift_list.data.QuizQuestion
import com.guykadosh22.kids_birth_day_gift_list.data.Repository
import com.guykadosh22.kids_birth_day_gift_list.data.ThemeDto
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BigButton
import com.guykadosh22.kids_birth_day_gift_list.ui.components.BwlCard
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ButtonKind
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ErrorState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.LoadingState
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ProgressBar
import com.guykadosh22.kids_birth_day_gift_list.ui.components.ThemePreview
import com.guykadosh22.kids_birth_day_gift_list.ui.components.bouncyClick
import com.guykadosh22.kids_birth_day_gift_list.ui.errorMessage
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.BwlColors
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.EnglishStrings
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.LocalStrings
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Radius
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Space
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.hexColor
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.toGift

/** Questions are fetched once per app run (they only change with a server release). */
private var cachedQuestions: List<QuizQuestion>? = null

/**
 * "Build my shop" quiz: one question per step with big emoji tiles. When every question is answered the server
 * generates the theme, which is shown as a live preview. [onComplete] gets the answers + theme (or null while redoing).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun QuizFlow(
    repo: Repository,
    kidFirstName: String,
    listName: String,
    initial: Map<String, String>?,
    onComplete: (answers: Map<String, String>?, theme: ThemeDto?) -> Unit,
) {
    val s = LocalStrings.current
    val en = s === EnglishStrings
    var questions by remember { mutableStateOf(cachedQuestions) }
    var loadError by remember { mutableStateOf<Throwable?>(null) }
    var reload by remember { mutableStateOf(0) }
    var answers by remember { mutableStateOf(initial ?: emptyMap()) }
    var step by remember { mutableStateOf(if (initial != null) Int.MAX_VALUE else -1) } // -1 = intro, MAX = finished
    var theme by remember { mutableStateOf<ThemeDto?>(null) }
    var previewError by remember { mutableStateOf<Throwable?>(null) }

    LaunchedEffect(reload) {
        if (questions == null) {
            loadError = null
            runCatching { repo.quiz() }.onSuccess { cachedQuestions = it; questions = it }.onFailure { loadError = it }
        }
    }
    val qs = questions
    val finished = qs != null && step >= qs.size
    LaunchedEffect(finished, answers) {
        if (finished) {
            previewError = null
            runCatching { repo.previewTheme(answers) }
                .onSuccess { theme = it; onComplete(answers, it) }
                .onFailure { previewError = it }
        }
    }

    BwlCard(Modifier.fillMaxWidth(), color = Color(0xFFFFF7FC)) {
        when {
            loadError != null -> ErrorState(errorMessage(loadError!!, s), onRetry = { reload++ })
            qs == null -> LoadingState(rows = 2)
            step == -1 -> Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Space.m)) {
                Text("🎨🦄🎸🍕", fontSize = 36.sp)
                Text(s.quizTitle, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
                Text(s.quizSubtitle, style = MaterialTheme.typography.bodyLarge, color = BwlColors.InkSoft, textAlign = TextAlign.Center)
                BigButton(s.quizStart, { step = 0 }, Modifier.fillMaxWidth())
            }
            finished -> Column(verticalArrangement = Arrangement.spacedBy(Space.m)) {
                Text("🎉 " + s.quizDone, style = MaterialTheme.typography.titleLarge)
                val t = theme
                when {
                    previewError != null -> ErrorState(errorMessage(previewError!!, s), onRetry = { answers = answers.toMap() })
                    t == null -> LoadingState(rows = 1)
                    else -> {
                        ThemePreview(t.toGift(), kidFirstName, listName, Modifier.fillMaxWidth())
                        Text(if (en) t.taglineEn else t.taglineHe, style = MaterialTheme.typography.bodyMedium, color = BwlColors.InkSoft)
                    }
                }
                BigButton(s.quizRedo, { step = 0; theme = null; onComplete(null, null) }, Modifier.fillMaxWidth(), kind = ButtonKind.Soft, leading = "🔄")
            }
            else -> {
                val q = qs[step]
                Text(s.quizStep(step + 1, qs.size), style = MaterialTheme.typography.labelMedium, color = BwlColors.InkSoft)
                Spacer(Modifier.height(Space.xs))
                ProgressBar((step + 1).toFloat() / qs.size, color = BwlColors.Candy)
                Spacer(Modifier.height(Space.m))
                AnimatedContent(step, transitionSpec = { (slideInHorizontally { -it / 3 } + fadeIn()) togetherWith fadeOut() }) { _ ->
                    Column(verticalArrangement = Arrangement.spacedBy(Space.m)) {
                        Text("${q.emoji} ${if (en) q.en else q.he}", style = MaterialTheme.typography.headlineSmall)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s), verticalArrangement = Arrangement.spacedBy(Space.s)) {
                            q.options.forEach { o ->
                                val picked = answers[q.id] == o.id
                                val label = if (en) o.en else o.he
                                Column(
                                    Modifier
                                        .width(92.dp)
                                        .clip(Radius.card)
                                        .background(if (picked) BwlColors.SkySoft else Color.White)
                                        .border(2.dp, if (picked) BwlColors.SkyDeep else BwlColors.Line, Radius.card)
                                        .bouncyClick(role = Role.RadioButton) {
                                            answers = answers + (q.id to o.id)
                                            step += 1
                                        }
                                        .semantics { contentDescription = label; selected = picked }
                                        .padding(vertical = Space.m, horizontal = Space.xs),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    if (o.swatch != null) {
                                        Box(Modifier.size(40.dp).clip(CircleShape).background(hexColor(o.swatch)))
                                    } else {
                                        Text(o.emoji, fontSize = 36.sp)
                                    }
                                    Spacer(Modifier.height(Space.xs))
                                    Text(label, style = MaterialTheme.typography.labelMedium, textAlign = TextAlign.Center, maxLines = 2)
                                }
                            }
                        }
                    }
                }
                if (step > 0) {
                    Row(Modifier.fillMaxWidth().padding(top = Space.s)) {
                        BigButton(s.quizBack, { step -= 1 }, kind = ButtonKind.Ghost, height = 40.dp)
                    }
                }
            }
        }
    }
}
