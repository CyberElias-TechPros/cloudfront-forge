package com.creatorloop.app.push

import android.net.Uri
import com.creatorloop.app.BuildConfig

/** Only in-app destinations are accepted; push payloads can never launch arbitrary URLs. */
object DeepLinks {
    fun route(value: String?): String? {
        if (value.isNullOrBlank()) return null
        if (value.startsWith("creatorloop")) {
            val uri = runCatching { Uri.parse(value) }.getOrNull() ?: return null
            if (uri.host == "youtube") return "settings?youtube=${uri.getQueryParameter("result").orEmpty()}"
            return null
        }
        val uri = runCatching { Uri.parse(value) }.getOrNull() ?: return null
        if (uri.scheme == "https" && uri.host != BuildConfig.APP_LINK_HOST) return null
        val parts = uri.pathSegments
        return when (parts.firstOrNull()) {
            "queue" -> uri.getQueryParameter("videoId")?.let { "player/$it" } ?: "queue"
            "reviews" -> parts.getOrNull(1)?.let { "review/$it" } ?: "reviews"
            "communities" -> parts.getOrNull(1)?.let { "community/$it" } ?: "communities"
            "missions" -> "missions"
            "shop", "rewards" -> "rewards"
            "notifications" -> "notifications"
            "profile" -> "profile"
            "coach" -> "coach"
            else -> null
        }
    }
}
