package com.guykadosh22.kids_birth_day_gift_list

import androidx.compose.runtime.staticCompositionLocalOf

/** Things only the host platform can do (implemented in androidApp's MainActivity). */
interface PlatformActions {
    fun copyToClipboard(text: String)
    /** opens the native share sheet (WhatsApp etc.) */
    fun share(text: String, title: String)
    fun toast(text: String)
    fun requestNotificationPermission() {}
    fun saveLanguage(lang: String) {}
    fun loadLanguage(): String = "he"
    /** remembers the newest activity timestamp so background polling only notifies about new gifts */
    fun markActivitySeen(createdAt: Long) {}
    /**
     * Lets the kid choose a profile photo: from the gallery, or by taking one with the camera.
     * Calls back with a small square JPEG (already resized), or null if cancelled.
     */
    fun pickPhoto(fromCamera: Boolean, onResult: (ByteArray?) -> Unit) = onResult(null)
}

object NoopPlatform : PlatformActions {
    override fun copyToClipboard(text: String) {}
    override fun share(text: String, title: String) {}
    override fun toast(text: String) {}
}

val LocalPlatform = staticCompositionLocalOf<PlatformActions> { NoopPlatform }
