package com.creatorloop.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.*
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.creatorloop.app.push.DeepLinks
import com.creatorloop.app.push.NotificationChannels
import com.creatorloop.app.ui.AppViewModel
import com.creatorloop.app.ui.LoopApp
import com.creatorloop.app.ui.theme.LoopTheme
import dagger.hilt.android.AndroidEntryPoint
import androidx.hilt.navigation.compose.hiltViewModel

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private var incoming by mutableStateOf<Intent?>(null)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        NotificationChannels.create(this)
        incoming = intent
        setContent {
            val appViewModel: AppViewModel = hiltViewModel()
            val theme by appViewModel.theme.collectAsStateWithLifecycle()
            val state by appViewModel.state.collectAsStateWithLifecycle()
            val route = remember(incoming) { routeFromIntent(incoming) }
            LoopTheme(theme) { LoopApp(state, appViewModel, route) }
        }
    }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); incoming = intent }
    private fun routeFromIntent(intent: Intent?): String? {
        intent?.getStringExtra("route")?.let { DeepLinks.route(it)?.let { r -> return r } ?: return it.takeIf { r -> r.matches(Regex("[a-zA-Z0-9/_?=&.%:-]+")) } }
        if (intent?.action == Intent.ACTION_SEND) {
            val text = intent.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
            val url = Regex("https?://[^\\s]+").find(text)?.value
            if (url != null) return "submit?url=${Uri.encode(url)}"
        }
        return DeepLinks.route(intent?.dataString)
    }
}
