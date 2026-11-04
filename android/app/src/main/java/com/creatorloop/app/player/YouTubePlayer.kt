package com.creatorloop.app.player

import android.annotation.SuppressLint
import android.webkit.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.io.ByteArrayInputStream

/** The app's only WebView: a locked-down YouTube IFrame, never an app shell. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun YouTubePlayer(videoId: String, onEvent: (PlayerEvent) -> Unit, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val currentOnEvent by rememberUpdatedState(onEvent)
    var webView by remember { mutableStateOf<WebView?>(null) }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> { webView?.onPause(); webView?.evaluateJavascript("if(window.player&&player.pauseVideo)player.pauseVideo();", null) }
                Lifecycle.Event.ON_RESUME -> webView?.onResume()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer); webView?.destroy(); webView = null }
    }
    AndroidView(modifier = modifier, factory = {
        WebView(context).apply {
            CookieManager.getInstance().apply { setAcceptCookie(false); setAcceptThirdPartyCookies(this@apply, false) }
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = false
                allowFileAccess = false
                allowContentAccess = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                mediaPlaybackRequiresUserGesture = true
                javaScriptCanOpenWindowsAutomatically = false
                setSupportMultipleWindows(false)
                cacheMode = WebSettings.LOAD_DEFAULT
                userAgentString = settings.userAgentString
            }
            setDownloadListener { _, _, _, _, _ -> /* downloads are intentionally disabled */ }
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = true
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest): WebResourceResponse? {
                    return if (request.url.scheme == "https") null
                    else WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))
                }
            }
            addJavascriptInterface(PlayerBridge(videoId) { currentOnEvent(it) }, "LoopBridge")
            val html = context.assets.open("player.html").bufferedReader().use { it.readText() }.replace("__VIDEO_ID__", videoId)
            loadDataWithBaseURL("https://loop.freegameplay.site", html, "text/html", "utf-8", null)
            webView = this
        }
    })
}
