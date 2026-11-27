package com.guykadosh22.kids_birth_day_gift_list

import android.app.Application
import android.content.SharedPreferences
import com.guykadosh22.kids_birth_day_gift_list.data.ApiClient
import com.guykadosh22.kids_birth_day_gift_list.data.KeystoreTokenStore
import com.guykadosh22.kids_birth_day_gift_list.data.Repository
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp

class KidApp : Application() {
    lateinit var repo: Repository
        private set
    val prefs: SharedPreferences by lazy { getSharedPreferences("bwl_prefs", MODE_PRIVATE) }

    override fun onCreate() {
        super.onCreate()
        // The app only ever talks to our API over HTTPS; it never sees database credentials.
        repo = Repository(ApiClient(BuildConfig.API_BASE_URL, KeystoreTokenStore(this), HttpClient(OkHttp)))
    }
}
