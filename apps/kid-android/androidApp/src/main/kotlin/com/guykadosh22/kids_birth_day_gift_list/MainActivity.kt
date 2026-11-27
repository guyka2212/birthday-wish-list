package com.guykadosh22.kids_birth_day_gift_list

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.PickVisualMediaRequest
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    // ---- profile photo: gallery (system photo picker, no storage permission) or camera (preview intent, no camera permission) ----
    private var photoCallback: ((ByteArray?) -> Unit)? = null
    private val pickFromGallery = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        deliverPhoto { uri?.let { PhotoProcessing.fromUri(this, it) } }
    }
    private val takeWithCamera = registerForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        deliverPhoto { bitmap?.let { PhotoProcessing.toSquareJpeg(it) } }
    }

    private fun deliverPhoto(produce: () -> ByteArray?) {
        val cb = photoCallback ?: return
        photoCallback = null
        lifecycleScope.launch {
            val bytes = withContext(Dispatchers.Default) { runCatching(produce).getOrNull() }
            cb(bytes)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val app = application as KidApp
        val openListId = intent?.getStringExtra(EXTRA_LIST_ID)

        val platform = object : PlatformActions {
            override fun copyToClipboard(text: String) {
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("wish list", text))
            }

            override fun share(text: String, title: String) {
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                startActivity(Intent.createChooser(send, title))
            }

            override fun toast(text: String) = Toast.makeText(this@MainActivity, text, Toast.LENGTH_SHORT).show()

            override fun requestNotificationPermission() {
                if (Build.VERSION.SDK_INT >= 33 &&
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                ) {
                    askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
                GiftWorker.schedule(this@MainActivity)
            }

            override fun saveLanguage(lang: String) = app.prefs.edit().putString("lang", lang).apply()
            override fun loadLanguage(): String = app.prefs.getString("lang", "he") ?: "he"
            override fun pickPhoto(fromCamera: Boolean, onResult: (ByteArray?) -> Unit) {
                photoCallback = onResult
                runCatching {
                    if (fromCamera) takeWithCamera.launch(null)
                    else pickFromGallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                }.onFailure {
                    photoCallback = null
                    onResult(null)
                }
            }

            override fun markActivitySeen(createdAt: Long) {
                if (createdAt > app.prefs.getLong(GiftWorker.KEY_SEEN, 0)) app.prefs.edit().putLong(GiftWorker.KEY_SEEN, createdAt).apply()
            }
        }

        if (app.repo.api.isLoggedIn) platform.requestNotificationPermission()

        setContent { App(app.repo, platform, openListId) }
    }

    companion object {
        const val EXTRA_LIST_ID = "listId"
    }
}
