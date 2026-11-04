package com.creatorloop.app.util

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent

object YouTubeUrl {
    private val pattern = Regex("(?:youtube\\.com/(?:watch\\?v=|shorts/|live/|embed/)|youtu\\.be/)([A-Za-z0-9_-]{6,20})")
    fun videoId(url: String): String? = pattern.find(url)?.groupValues?.getOrNull(1)
    fun isValid(url: String): Boolean = videoId(url) != null
    fun watchUrl(videoId: String): String = "https://www.youtube.com/watch?v=$videoId"
}

fun Context.openExternal(url: String) {
    val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return
    if (uri.scheme !in setOf("https", "http")) return
    try {
        startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: ActivityNotFoundException) {
        runCatching { CustomTabsIntent.Builder().build().launchUrl(this, uri) }
    }
}

fun Context.shareText(text: String) {
    val intent = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
    runCatching { startActivity(Intent.createChooser(intent, "Share").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}
