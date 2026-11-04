package com.creatorloop.app.player

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import kotlinx.serialization.json.*

data class PlayerEvent(val type: String, val time: Double = 0.0, val duration: Double = 0.0,
                       val rate: Double = 1.0, val muted: Boolean = false, val state: Int = -1, val code: Int = 0)

/** Narrow, read-only telemetry bridge. The page cannot call app APIs or receive auth material. */
class PlayerBridge(private val expectedVideoId: String, private val onEvent: (PlayerEvent) -> Unit) {
    private val main = Handler(Looper.getMainLooper())
    private val json = Json { ignoreUnknownKeys = true }
    @JavascriptInterface
    fun onEvent(raw: String) {
        val event = runCatching {
            val obj = json.parseToJsonElement(raw).jsonObject
            val type = obj["type"]?.jsonPrimitive?.contentOrNull ?: return@runCatching null
            if (type !in setOf("ready", "state", "tick", "rate", "error", "timeout", "autoplayBlocked", "visibility")) return@runCatching null
            val videoId = obj["videoId"]?.jsonPrimitive?.contentOrNull
            if (videoId != null && videoId != expectedVideoId) return@runCatching null
            PlayerEvent(type,
                time = obj["time"]?.jsonPrimitive?.doubleOrNull?.coerceIn(0.0, 86400.0) ?: 0.0,
                duration = obj["duration"]?.jsonPrimitive?.doubleOrNull?.coerceIn(0.0, 86400.0) ?: 0.0,
                rate = obj["rate"]?.jsonPrimitive?.doubleOrNull?.coerceIn(0.0, 4.0) ?: 1.0,
                muted = obj["muted"]?.jsonPrimitive?.booleanOrNull ?: false,
                state = obj["state"]?.jsonPrimitive?.intOrNull ?: -1,
                code = obj["code"]?.jsonPrimitive?.intOrNull ?: 0)
        }.getOrNull() ?: return
        main.post { onEvent(event) }
    }
}
