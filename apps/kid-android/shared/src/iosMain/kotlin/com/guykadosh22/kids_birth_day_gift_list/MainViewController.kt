package com.guykadosh22.kids_birth_day_gift_list

import androidx.compose.ui.window.ComposeUIViewController
import com.guykadosh22.kids_birth_day_gift_list.data.ApiClient
import com.guykadosh22.kids_birth_day_gift_list.data.InMemoryTokenStore
import com.guykadosh22.kids_birth_day_gift_list.data.Repository

// iOS is not a shipped target yet (see DECISIONS.md); this keeps the shared module compiling for it.
fun MainViewController() = ComposeUIViewController {
    App(Repository(ApiClient("https://birthday-wish-list-api.vercel.app", InMemoryTokenStore())), NoopPlatform)
}
