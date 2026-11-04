package com.creatorloop.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.creatorloop.app.data.*
import com.creatorloop.app.ui.*

@Composable
fun SearchScreen(onNavigate: (String) -> Unit, viewModel: SearchViewModel = hiltViewModel()) {
    val query by viewModel.text.collectAsStateWithLifecycle()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val collaborators by viewModel.collaborators.state.collectAsStateWithLifecycle()
    var tab by remember { mutableStateOf("communities") }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            ScreenHeader("Discover")
            OutlinedTextField(query, viewModel::setQuery, label = { Text("Search squads and videos") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("communities" to "Squads", "videos" to "Videos", "collaborators" to "Collaborators").forEach { (value, label) ->
                    FilterChip(selected = tab == value, onClick = { tab = value }, label = { Text(label) })
                }
            }
            StaleBanner(state.savedAt, state.message)
        }
        when (tab) {
            "communities" -> {
                val items = state.data?.communities.orEmpty()
                if (items.isEmpty()) item { EmptyState("No squads found", "Try a different search.", Icons.Default.Groups) }
                items(items, key = { it.id }) { community -> Surface(onClick = { onNavigate("community/${community.id}") }, shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface) { Column(Modifier.padding(16.dp)) { Text(community.name, style = MaterialTheme.typography.titleMedium); Text(community.description, style = MaterialTheme.typography.bodyMedium); Text("${community.memberCount} members", style = MaterialTheme.typography.bodySmall) } } }
            }
            "videos" -> {
                val items = state.data?.videos.orEmpty()
                if (items.isEmpty()) item { EmptyState("No videos found", "Try a different search.", Icons.Default.VideoLibrary) }
                items(items, key = { it.id }) { video -> VideoCard(video, onClick = { onNavigate("player/${video.id}") }) }
            }
            else -> {
                val items = collaborators.data.orEmpty()
                if (items.isEmpty()) item { EmptyState("No collaborators", "Complete your profile to be discovered.", Icons.Default.Handshake) }
                items(items, key = { it.id }) { person ->
                    Surface(onClick = { onNavigate("member/${person.id}") }, shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface) {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Avatar(person.avatar, person.name)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) { Text(person.name, style = MaterialTheme.typography.titleMedium); Text("${person.niche} · ${person.experience} · ${person.intent}", style = MaterialTheme.typography.bodySmall); if (person.goals.isNotBlank()) Text(person.goals, style = MaterialTheme.typography.bodyMedium, maxLines = 2) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun InsightsScreen(onNavigate: (String) -> Unit, viewModel: InsightsViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeader("Insights", "How your content is performing.", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } }); StaleBanner(state.savedAt, state.message) }
        when {
            state.loading && state.data == null -> item { LoadingState() }
            state.error != null && state.data == null -> item { ErrorState(state.error!!, viewModel::refresh) }
            else -> {
                val data = state.data ?: return@LazyColumn
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatCard("Videos", "${data.videos}", Icons.Default.VideoLibrary, Modifier.weight(1f))
                        StatCard("Watches", "${data.watches}", Icons.Default.Visibility, Modifier.weight(1f))
                        StatCard("Comments", "${data.comments}", Icons.Default.Comment, Modifier.weight(1f))
                    }
                }
                item {
                    LoopCard {
                        Text("Watch minutes: ${data.watchMinutes}", style = MaterialTheme.typography.titleMedium)
                        Text("Average review score: ${"%.1f".format(data.averageScore)}/10", style = MaterialTheme.typography.bodyMedium)
                        Spacer(Modifier.height(16.dp))
                        Text("Daily trend", style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.height(8.dp))
                        val max = (data.trend.maxOfOrNull { it.second } ?: 1).coerceAtLeast(1)
                        Row(Modifier.fillMaxWidth().height(120.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            data.trend.takeLast(14).forEach { (_, value) ->
                                Box(Modifier.weight(1f).fillMaxHeight(value.toFloat() / max).background(MaterialTheme.colorScheme.primary, MaterialTheme.shapes.small))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun LeaderboardScreen(onNavigate: (String) -> Unit, viewModel: LeaderboardViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selected by viewModel.selected.collectAsStateWithLifecycle()
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            ScreenHeader("Leaderboard", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } })
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("all_time" to "All time", "monthly" to "Monthly", "weekly" to "Weekly").forEach { (value, label) ->
                    FilterChip(selected = selected == value, onClick = { viewModel.setTimeframe(value) }, label = { Text(label) })
                }
            }
            StaleBanner(state.savedAt, state.message)
        }
        when {
            state.loading && state.data == null -> item { LoadingState() }
            state.error != null && state.data == null -> item { ErrorState(state.error!!, viewModel::refresh) }
            else -> items(state.data.orEmpty(), key = { it.id }) { entry ->
                Surface(onClick = { onNavigate("member/${entry.id}") }, shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("#${entry.rank}", style = MaterialTheme.typography.titleLarge, modifier = Modifier.width(56.dp))
                        Avatar(entry.photoUrl, entry.name)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) { Text(entry.name, style = MaterialTheme.typography.titleMedium); Text("${formatNumber(entry.xp)} XP · rep ${entry.reputation}", style = MaterialTheme.typography.bodySmall) }
                        Text("${entry.score}", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }
    }
}

@Composable
fun CoachScreen(onNavigate: (String) -> Unit, viewModel: CoachViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val conversations by viewModel.conversations.state.collectAsStateWithLifecycle()
    var input by remember { mutableStateOf("") }
    var picker by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        ScreenHeader("AI Coach", "Growth advice grounded in your activity.", action = {
            Row { IconButton(onClick = { viewModel.newConversation() }) { Icon(Icons.Default.Add, "New conversation") }; IconButton(onClick = { picker = !picker }) { Icon(Icons.Default.History, "Conversations") } }
        })
        if (picker) {
            LoopCard {
                conversations.data.orEmpty().forEach { conversation ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        TextButton(onClick = { viewModel.openConversation(conversation.id); picker = false }, modifier = Modifier.weight(1f)) { Text(conversation.title, maxLines = 1) }
                        IconButton(onClick = { viewModel.deleteConversation(conversation.id) }) { Icon(Icons.Default.Delete, "Delete conversation") }
                    }
                }
                if (conversations.data.orEmpty().isEmpty()) Text("No conversations yet.", style = MaterialTheme.typography.bodyMedium)
            }
        }
        MessageBanner(state.error, true)
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (state.messages.isEmpty()) item { EmptyState("Ask the coach", "Try: How do I improve my hook? or Review my channel strategy.", Icons.Default.Psychology) }
            items(state.messages, key = { it.id }) { message ->
                val isUser = message.role == "user"
                Surface(color = if (isUser) MaterialTheme.colorScheme.primary.copy(alpha = .18f) else MaterialTheme.colorScheme.surface,
                    shape = MaterialTheme.shapes.large, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) { Text(if (isUser) "You" else "Coach", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary); Text(message.content.ifBlank { "…" }, style = MaterialTheme.typography.bodyLarge) }
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(input, { input = it }, label = { Text("Message") }, modifier = Modifier.weight(1f), maxLines = 3)
            Spacer(Modifier.width(8.dp))
            Button(onClick = { viewModel.send(input); input = "" }, enabled = !state.streaming && input.isNotBlank()) { Icon(Icons.Default.Send, "Send") }
        }
    }
}
