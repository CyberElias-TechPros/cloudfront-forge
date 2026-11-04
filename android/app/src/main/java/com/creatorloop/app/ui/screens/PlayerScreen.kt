package com.creatorloop.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.creatorloop.app.player.WatchViewModel
import com.creatorloop.app.player.YouTubePlayer
import com.creatorloop.app.ui.*
import com.creatorloop.app.util.YouTubeUrl
import com.creatorloop.app.util.openExternal

@Composable
fun PlayerScreen(onNavigate: (String) -> Unit, viewModel: WatchViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val view = LocalView.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var answer by remember { mutableStateOf("") }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) { Lifecycle.Event.ON_RESUME -> viewModel.onForeground(true); Lifecycle.Event.ON_PAUSE -> viewModel.onForeground(false); else -> Unit }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer); viewModel.onForeground(false) }
    }
    DisposableEffect(state.playing) { view.keepScreenOn = state.playing; onDispose { view.keepScreenOn = false } }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ScreenHeader("Watch", action = { IconButton(onClick = { onNavigate("queue") }) { Icon(Icons.Default.Close, "Back to queue") } })
        when {
            state.loading -> LoadingState()
            state.error != null -> ErrorState(state.error!!, viewModel::retry)
            else -> {
                val video = state.video ?: return@Column
                Text(video.title, style = MaterialTheme.typography.titleLarge)
                Text(video.creatorName, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (!state.playerFailed && video.youtubeVideoId.isNotBlank()) {
                    YouTubePlayer(video.youtubeVideoId, viewModel::onPlayerEvent, Modifier.fillMaxWidth().aspectRatio(16f / 9f))
                } else {
                    LoopCard {
                        Icon(Icons.Default.OpenInNew, null)
                        Text("This video can't play in the verified player.", style = MaterialTheme.typography.titleMedium)
                        Text("You can open it in YouTube, but external playback does not count toward verified rewards.", style = MaterialTheme.typography.bodyMedium)
                        Button(onClick = { context.openExternal(video.youtubeUrl.ifBlank { YouTubeUrl.watchUrl(video.youtubeVideoId) }) }) { Text("Open in YouTube") }
                    }
                }
                MessageBanner(state.warning)
                LoopCard {
                    Text("Verified attention", style = MaterialTheme.typography.titleMedium)
                    Text("${state.verifiedSeconds}s / ${state.requiredSeconds}s", style = MaterialTheme.typography.headlineSmall)
                    LinearProgressIndicator(progress = { if (state.requiredSeconds == 0) 0f else (state.verifiedSeconds.toFloat() / state.requiredSeconds).coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp))
                    Text(if (state.sessionsEnabled) "Keep the app open and play at normal speed. Background playback does not count." else "Verified rewards are disabled in this environment.", style = MaterialTheme.typography.bodySmall)
                    if (video.magicWord != null) Text("Comment proof word: ${video.magicWord}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.secondary)
                    Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Checkbox(state.commented, viewModel::setCommented)
                        Text("I left a genuine comment on YouTube")
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { context.openExternal(video.youtubeUrl.ifBlank { YouTubeUrl.watchUrl(video.youtubeVideoId) }) }, modifier = Modifier.weight(1f)) { Text("Open YouTube") }
                        Button(onClick = { viewModel.claim() }, enabled = !state.claiming && !state.voided && state.claim == null, modifier = Modifier.weight(1f)) { Text(if (state.claiming) "Claiming…" else "Claim reward") }
                    }
                }
                state.claim?.let { claim ->
                    LoopCard {
                        Text(if (claim.creditsAwarded > 0 || claim.xpAwarded > 0) "Reward recorded" else "No reward granted", style = MaterialTheme.typography.titleMedium)
                        Text("+${claim.xpAwarded.toInt()} XP · +${claim.creditsAwarded.toInt()} credits", style = MaterialTheme.typography.headlineSmall)
                        Text(claim.evidence?.reason ?: claim.status, style = MaterialTheme.typography.bodyMedium)
                        Button(onClick = { onNavigate("queue") }, modifier = Modifier.fillMaxWidth()) { Text("Back to queue") }
                    }
                }
            }
        }
    }
    if (state.challenge != null) {
        AlertDialog(onDismissRequest = {}, title = { Text("Attention check") }, text = {
            Column { Text(state.challenge!!.question, style = MaterialTheme.typography.titleMedium); OutlinedTextField(answer, { answer = it }, label = { Text("Answer") }, singleLine = true) }
        }, confirmButton = { TextButton(onClick = { viewModel.answerChallenge(answer); answer = "" }, enabled = !state.challengeBusy) { Text("Submit") } })
    }
}
