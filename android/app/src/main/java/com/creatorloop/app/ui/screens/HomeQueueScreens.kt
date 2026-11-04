@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.creatorloop.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.creatorloop.app.data.*
import com.creatorloop.app.ui.*
import com.creatorloop.app.util.YouTubeUrl

@Composable
fun HomeScreen(onNavigate: (String) -> Unit, viewModel: HomeViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            ScreenHeader("Your squad", "Genuine feedback, verified attention.", action = {
                IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh") }
            })
            StaleBanner(state.savedAt, state.message)
            MessageBanner(action.message); MessageBanner(action.error, true)
        }
        when {
            state.loading && state.data == null -> item { LoadingState() }
            state.error != null && state.data == null -> item { ErrorState(state.error!!, viewModel::refresh) }
            else -> {
                val data = state.data ?: return@LazyColumn
                item {
                    LoopCard {
                        Text("Hi ${data.member.name}", style = MaterialTheme.typography.titleLarge)
                        Text("Level ${data.level} · ${formatNumber(data.totalXp)} XP", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(12.dp))
                        LinearProgressIndicator(progress = { if (data.xpToNext > 0) (data.totalXp % (data.xpToNext + data.totalXp)).toFloat() / (data.xpToNext + data.totalXp) else 0f }, modifier = Modifier.fillMaxWidth())
                        Spacer(Modifier.height(16.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            StatCard("Credits", formatNumber(data.credits), Icons.Default.Paid, Modifier.weight(1f))
                            StatCard("Streak", "${data.streak}d", Icons.Default.LocalFireDepartment, Modifier.weight(1f), MaterialTheme.colorScheme.secondary)
                            StatCard("Squads", "${data.communityCount}", Icons.Default.Groups, Modifier.weight(1f), MaterialTheme.colorScheme.tertiary)
                        }
                        Spacer(Modifier.height(12.dp))
                        Button(onClick = { viewModel.dailyBonus() }, enabled = !action.busy, modifier = Modifier.fillMaxWidth()) { Text("Claim daily bonus") }
                    }
                }
                item { SectionTitle("Daily quests", "Missions") { onNavigate("missions") } }
                if (data.quests.isEmpty()) item { EmptyState("No quests yet", "Join a squad and watch a video to start today's quests.", Icons.Default.Flag) }
                items(data.quests, key = { it.id }) { quest ->
                    LoopCard {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) { Text(quest.title, style = MaterialTheme.typography.titleMedium); Text("${quest.progress}/${quest.target} · +${quest.xp} XP / +${quest.credits} credits", style = MaterialTheme.typography.bodySmall) }
                            StatusChip(quest.status)
                        }
                        Spacer(Modifier.height(8.dp))
                        LinearProgressIndicator(progress = { if (quest.target == 0) 0f else quest.progress.toFloat() / quest.target }, modifier = Modifier.fillMaxWidth())
                    }
                }
                item { SectionTitle("Watch queue", "See all") { onNavigate("queue") } }
                if (data.queue.isEmpty()) item { EmptyState("Queue is clear", "Submit a video or join another squad to see more.", Icons.Default.VideoLibrary) }
                items(data.queue, key = { it.id }) { video -> VideoCard(video, onClick = { onNavigate("player/${video.id}") }) }
                item { SectionTitle("Your submissions", "Submit") { onNavigate("submit") } }
                if (data.submissions.isEmpty()) item { EmptyState("No submissions", "Share your first video with the squad.", Icons.Default.Upload) }
                items(data.submissions.take(3), key = { it.id }) { video -> VideoCard(video, onClick = { onNavigate("profile") }) }
                item { SectionTitle("Recent activity", "Notifications") { onNavigate("notifications") } }
                items(data.activity.take(5), key = { it.id }) { item ->
                    LoopCard { Text(item.title, style = MaterialTheme.typography.titleMedium); Text(item.message, style = MaterialTheme.typography.bodyMedium); Text(relativeTime(item.createdAt), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        OutlinedButton(onClick = { onNavigate("rewards") }, modifier = Modifier.weight(1f)) { Text("Rewards") }
                        OutlinedButton(onClick = { onNavigate("coach") }, modifier = Modifier.weight(1f)) { Text("AI Coach") }
                    }
                }
            }
        }
    }
}

@Composable
fun QueueScreen(onNavigate: (String) -> Unit, viewModel: QueueViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val communities by viewModel.communities.state.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            ScreenHeader("Watch queue", "Verified attention earns rewards.", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } })
            StaleBanner(state.savedAt, state.message)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                FilterChip(selected = filter == null, onClick = { viewModel.setCommunity(null) }, label = { Text("All") })
                communities.data.orEmpty().take(4).forEach { community ->
                    FilterChip(selected = filter == community.id, onClick = { viewModel.setCommunity(community.id) }, label = { Text(community.name) })
                }
            }
        }
        when {
            state.loading && state.data == null -> item { LoadingState() }
            state.error != null && state.data == null -> item { ErrorState(state.error!!, viewModel::refresh) }
            state.data.orEmpty().isEmpty() -> item { EmptyState("Nothing to watch", "You're all caught up. Submit a video or check another squad.", Icons.Default.VideoLibrary) }
            else -> items(state.data.orEmpty(), key = { it.id }) { video ->
                VideoCard(video, onClick = { onNavigate("player/${video.id}") }, trailing = { StatusChip(video.status) })
            }
        }
        item { OutlinedButton(onClick = { onNavigate("submit") }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.Upload, null); Spacer(Modifier.width(8.dp)); Text("Submit a video") } }
    }
}

@Composable
fun SubmitScreen(initialUrl: String?, onNavigate: (String) -> Unit, viewModel: SubmitViewModel = hiltViewModel()) {
    val url by viewModel.url.collectAsStateWithLifecycle()
    val title by viewModel.title.collectAsStateWithLifecycle()
    val niche by viewModel.niche.collectAsStateWithLifecycle()
    val magicWord by viewModel.magicWord.collectAsStateWithLifecycle()
    val communityId by viewModel.communityId.collectAsStateWithLifecycle()
    val communities by viewModel.communities.state.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    LaunchedEffect(initialUrl) { if (!initialUrl.isNullOrBlank() && url.isBlank()) viewModel.setUrl(initialUrl) }
    var expanded by remember { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeader("Submit a video", "Share a YouTube link with your squad.") }
        item { MessageBanner(action.message); MessageBanner(action.error, true) }
        item {
            LoopCard {
                OutlinedTextField(url, viewModel::setUrl, label = { Text("YouTube URL") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    supportingText = { Text(if (url.isBlank() || YouTubeUrl.isValid(url)) "youtube.com/watch?v=… or youtu.be/…" else "Enter a valid YouTube link") },
                    isError = url.isNotBlank() && !YouTubeUrl.isValid(url))
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(title, viewModel::setTitle, label = { Text("Title (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(niche, viewModel::setNiche, label = { Text("Niche (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(magicWord, viewModel::setMagicWord, label = { Text("Magic word for comment proof (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(12.dp))
                ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
                    val selected = communities.data.orEmpty().firstOrNull { it.id == communityId }
                    OutlinedTextField(selected?.name ?: "All my squads", {}, readOnly = true, label = { Text("Community") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) }, modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable))
                    ExposedDropdownMenu(expanded, { expanded = false }) {
                        DropdownMenuItem(text = { Text("All my squads") }, onClick = { viewModel.setCommunity(""); expanded = false })
                        communities.data.orEmpty().forEach { community ->
                            DropdownMenuItem(text = { Text(community.name) }, onClick = { viewModel.setCommunity(community.id); expanded = false })
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
                Button(onClick = { viewModel.submit() }, enabled = !action.busy && YouTubeUrl.isValid(url), modifier = Modifier.fillMaxWidth().height(52.dp)) {
                    Text(if (action.busy) "Submitting…" else "Submit to fair queue")
                }
            }
        }
        item { Text("Submissions are rate-limited and ratio-gated so everyone gets fair attention. Rewards are decided by the server, not the device.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}
