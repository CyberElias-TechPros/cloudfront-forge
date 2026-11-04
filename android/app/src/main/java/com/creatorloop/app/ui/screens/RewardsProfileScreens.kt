package com.creatorloop.app.ui.screens

import android.app.Activity
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.creatorloop.app.data.*
import com.creatorloop.app.ui.*

@Composable
fun RewardsScreen(onNavigate: (String) -> Unit, memberId: String?, viewModel: RewardsViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val purchases by viewModel.purchases.state.collectAsStateWithLifecycle()
    val submissions by viewModel.submissions.state.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    val billing by viewModel.billing.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var boostFor by remember { mutableStateOf<ShopItem?>(null) }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeader("Rewards", "Credits, XP, streaks and badges.", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } }); StaleBanner(state.savedAt, state.message); MessageBanner(action.message); MessageBanner(action.error, true); MessageBanner(billing.message) }
        when {
            state.loading && state.data == null -> item { LoadingState() }
            state.error != null && state.data == null -> item { ErrorState(state.error!!, viewModel::refresh) }
            else -> {
                val data = state.data ?: return@LazyColumn
                item {
                    LoopCard {
                        Text("${formatNumber(data.credits)} credits", style = MaterialTheme.typography.headlineLarge)
                        Text("Level ${data.level} · ${formatNumber(data.xp)} XP · ${data.streak}d streak", style = MaterialTheme.typography.bodyMedium)
                        Text("Reputation ${data.reputation}/100 · Longest streak ${data.longestStreak}d", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { onNavigate("leaderboard") }, modifier = Modifier.weight(1f)) { Text("Leaderboard") }
                            OutlinedButton(onClick = { viewModel.restore() }, enabled = !billing.busy, modifier = Modifier.weight(1f)) { Text("Restore purchases") }
                        }
                    }
                }
                item { SectionTitle("Spend credits") }
                items(data.shop, key = { it.id }) { item ->
                    LoopCard {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) { Text(item.name, style = MaterialTheme.typography.titleMedium); Text(item.description, style = MaterialTheme.typography.bodyMedium) }
                            Button(onClick = { if (item.id == "boost") boostFor = item else viewModel.buy(item, null) }, enabled = !action.busy && data.credits >= item.cost) { Text("${item.cost}") }
                        }
                    }
                }
                item { SectionTitle("Buy credits") }
                if (billing.products.isEmpty()) item { Text("Google Play credit packs are not available in this environment yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                items(billing.products, key = { it.productId }) { product ->
                    val pack = billing.packs.firstOrNull { it.productId == product.productId }
                    LoopCard {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) { Text(pack?.label ?: product.name, style = MaterialTheme.typography.titleMedium); Text("${pack?.credits ?: 0} credits", style = MaterialTheme.typography.bodySmall) }
                            Button(onClick = {
                                val activity = context as? Activity
                                if (activity != null && memberId != null) viewModel.billing.purchase(activity, product.productId, memberId)
                            }, enabled = !billing.busy && memberId != null) { Text(product.oneTimePurchaseOfferDetails?.formattedPrice ?: "Buy") }
                        }
                    }
                }
                item { SectionTitle("Badges") }
                if (data.badges.isEmpty()) item { EmptyState("No badges yet", "Keep participating to earn badges.", Icons.Default.EmojiEvents) }
                items(data.badges, key = { it.id }) { badge -> LoopCard { Text(badge.name, style = MaterialTheme.typography.titleMedium); Text(badge.description, style = MaterialTheme.typography.bodyMedium) } }
                item { SectionTitle("Credit history") }
                items(data.transactions.take(30), key = { it.id }) { tx ->
                    LoopCard {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) { Text(tx.description.ifBlank { tx.type }, style = MaterialTheme.typography.titleMedium); Text(relativeTime(tx.createdAt), style = MaterialTheme.typography.bodySmall) }
                            Text(if (tx.amount >= 0) "+${tx.amount}" else "${tx.amount}", style = MaterialTheme.typography.titleMedium, color = if (tx.amount >= 0) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error)
                        }
                    }
                }
                item { SectionTitle("Play purchases") }
                items(purchases.data.orEmpty(), key = { it.orderId }) { purchase -> LoopCard { Text(purchase.productId, style = MaterialTheme.typography.titleMedium); Text("${purchase.credits} credits · ${purchase.status}", style = MaterialTheme.typography.bodySmall) } }
            }
        }
    }
    if (boostFor != null) {
        AlertDialog(onDismissRequest = { boostFor = null }, title = { Text("Boost a video") }, text = {
            Column {
                if (submissions.data.orEmpty().isEmpty()) Text("You need an active submission to boost.")
                submissions.data.orEmpty().filter { it.status == "active" }.forEach { video ->
                    TextButton(onClick = { viewModel.buy(boostFor!!, video.id); boostFor = null }, modifier = Modifier.fillMaxWidth()) { Text(video.title, maxLines = 1) }
                }
            }
        }, confirmButton = {}, dismissButton = { TextButton(onClick = { boostFor = null }) { Text("Close") } })
    }
}

@Composable
fun ProfileScreen(onNavigate: (String) -> Unit, onAccountDeleted: () -> Unit, viewModel: ProfileViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val submissions by viewModel.submissions.state.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    var name by remember { mutableStateOf("") }; var bio by remember { mutableStateOf("") }
    var niche by remember { mutableStateOf("") }; var goals by remember { mutableStateOf("") }
    var country by remember { mutableStateOf("") }; var language by remember { mutableStateOf("") }
    var experience by remember { mutableStateOf("beginner") }; var lookingFor by remember { mutableStateOf("feedback") }
    var public by remember { mutableStateOf(true) }; var loaded by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    LaunchedEffect(state.data) {
        state.data?.let { m -> if (!loaded) { name = m.name; bio = m.bio; niche = m.niche; goals = m.goals; country = m.country; language = m.language; experience = m.experience; lookingFor = m.lookingFor; public = m.publicProfile; loaded = true } }
    }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeader("Profile", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } }); StaleBanner(state.savedAt, state.message); MessageBanner(action.message); MessageBanner(action.error, true) }
        when {
            state.loading && state.data == null -> item { LoadingState() }
            state.error != null && state.data == null -> item { ErrorState(state.error!!, viewModel::refresh) }
            else -> {
                val member = state.data ?: return@LazyColumn
                item {
                    LoopCard {
                        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) { Avatar(member.photoUrl, member.name, 64); Spacer(Modifier.width(16.dp)); Column { Text(member.name, style = MaterialTheme.typography.titleLarge); Text("Level ${member.level} · ${formatNumber(member.totalXp)} XP · ${member.credits} credits", style = MaterialTheme.typography.bodySmall) } }
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(name, { name = it }, label = { Text("Display name") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(bio, { bio = it }, label = { Text("Bio") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(niche, { niche = it }, label = { Text("Niche") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(goals, { goals = it }, label = { Text("Goals") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(country, { country = it }, label = { Text("Country code") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(language, { language = it }, label = { Text("Language code") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(experience, { experience = it }, label = { Text("Experience (beginner/intermediate/advanced)") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(lookingFor, { lookingFor = it }, label = { Text("Looking for (feedback/collab/accountability)") }, modifier = Modifier.fillMaxWidth())
                        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) { Switch(public, { public = it }); Text("Public profile") }
                        Button(onClick = { viewModel.save(member.copy(name = name, bio = bio, niche = niche, goals = goals, country = country, language = language, experience = experience, lookingFor = lookingFor, publicProfile = public)) }, enabled = !action.busy, modifier = Modifier.fillMaxWidth()) { Text("Save profile") }
                    }
                }
                item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { OutlinedButton(onClick = { onNavigate("insights") }, modifier = Modifier.weight(1f)) { Text("Insights") }; OutlinedButton(onClick = { onNavigate("settings") }, modifier = Modifier.weight(1f)) { Text("Settings") } } }
                item { SectionTitle("Your submissions") }
                if (submissions.data.orEmpty().isEmpty()) item { EmptyState("No submissions", "Submit a video to start receiving feedback.", Icons.Default.Upload) }
                items(submissions.data.orEmpty(), key = { it.id }) { video ->
                    VideoCard(video, onClick = { onNavigate("player/${video.id}") }, trailing = {
                        IconButton(onClick = { viewModel.archive(video.id) }) { Icon(Icons.Default.Archive, "Archive video") }
                    })
                }
                item { OutlinedButton(onClick = { confirmDelete = true }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)) { Text("Delete account") } }
            }
        }
    }
    if (confirmDelete) AlertDialog(onDismissRequest = { confirmDelete = false }, title = { Text("Delete account?") },
        text = { Text("This removes your profile and disconnects your account. Some community activity may remain anonymised. This cannot be undone.") },
        confirmButton = { TextButton(onClick = { viewModel.deleteAccount(onAccountDeleted); confirmDelete = false }) { Text("Delete", color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } })
}

@Composable
fun MemberScreen(onNavigate: (String) -> Unit, viewModel: MemberViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    var report by remember { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeader("Creator", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } }); MessageBanner(action.message); MessageBanner(action.error, true) }
        when {
            state.loading && state.data == null -> item { LoadingState() }
            state.error != null && state.data == null -> item { ErrorState(state.error!!, viewModel::refresh) }
            else -> {
                val member = state.data ?: return@LazyColumn
                item {
                    LoopCard {
                        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) { Avatar(member.photoUrl, member.name, 64); Spacer(Modifier.width(16.dp)); Column { Text(member.name, style = MaterialTheme.typography.titleLarge); Text("Level ${member.level} · ${member.niche}", style = MaterialTheme.typography.bodySmall) } }
                        if (member.bio.isNotBlank()) { Spacer(Modifier.height(8.dp)); Text(member.bio, style = MaterialTheme.typography.bodyMedium) }
                        if (member.goals.isNotBlank()) Text("Goals: ${member.goals}", style = MaterialTheme.typography.bodyMedium)
                        Spacer(Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { viewModel.block() }, modifier = Modifier.weight(1f)) { Text("Block") }
                            OutlinedButton(onClick = { report = true }, modifier = Modifier.weight(1f)) { Text("Report") }
                        }
                    }
                }
            }
        }
    }
    if (report) ReportDialog(onDismiss = { report = false }, onSubmit = { reason, desc -> viewModel.report(reason, desc); report = false })
}

@Composable fun ReportDialog(onDismiss: () -> Unit, onSubmit: (String, String) -> Unit) {
    var reason by remember { mutableStateOf("spam") }; var description by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Report") }, text = {
        Column {
            listOf("spam", "harassment", "fake_engagement", "impersonation", "other").forEach { option ->
                Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) { RadioButton(reason == option, { reason = option }); Text(option.replace('_', ' ')) }
            }
            OutlinedTextField(description, { description = it }, label = { Text("Details (optional)") }, modifier = Modifier.fillMaxWidth())
        }
    }, confirmButton = { TextButton(onClick = { onSubmit(reason, description) }) { Text("Send") } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } })
}

@Composable
fun NotificationsScreen(onNavigate: (String) -> Unit, viewModel: NotificationsViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            ScreenHeader("Notifications", action = { Row { TextButton(onClick = { viewModel.readAll() }) { Text("Read all") }; IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } } })
            StaleBanner(state.savedAt, state.message); MessageBanner(action.error, true)
        }
        when {
            state.loading && state.data == null -> item { LoadingState() }
            state.error != null && state.data == null -> item { ErrorState(state.error!!, viewModel::refresh) }
            state.data.orEmpty().isEmpty() -> item { EmptyState("All quiet", "You'll see feedback, squad and reward updates here.", Icons.Default.Notifications) }
            else -> items(state.data.orEmpty(), key = { it.id }) { notification ->
                Surface(onClick = {
                    viewModel.read(notification.id)
                    val route = when { notification.type.contains("review") -> "reviews"; notification.type.contains("community") -> "communities"; notification.type.contains("mission") -> "missions"; notification.type.contains("reward") || notification.type.contains("credit") -> "rewards"; else -> null }
                    if (route != null) onNavigate(route)
                }, shape = MaterialTheme.shapes.large, color = if (notification.isRead) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.surfaceVariant) {
                    Row(Modifier.padding(16.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) { Text(notification.title, style = MaterialTheme.typography.titleMedium); Text(notification.message, style = MaterialTheme.typography.bodyMedium); Text(relativeTime(notification.createdAt), style = MaterialTheme.typography.bodySmall) }
                        IconButton(onClick = { viewModel.delete(notification.id) }) { Icon(Icons.Default.Delete, "Delete notification") }
                    }
                }
            }
        }
    }
}
