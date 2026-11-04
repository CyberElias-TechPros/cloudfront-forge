package com.creatorloop.app.ui.screens

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
import com.creatorloop.app.util.shareText

@Composable
fun CommunitiesScreen(onNavigate: (String) -> Unit, viewModel: CommunitiesViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    var showCreate by remember { mutableStateOf(false) }
    var showJoin by remember { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            ScreenHeader("Squads", "Small communities, real feedback.", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } })
            StaleBanner(state.savedAt, state.message); MessageBanner(action.message); MessageBanner(action.error, true)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { showCreate = true }, modifier = Modifier.weight(1f)) { Text("Create") }
                OutlinedButton(onClick = { showJoin = true }, modifier = Modifier.weight(1f)) { Text("Join by code") }
            }
        }
        when {
            state.loading && state.data == null -> item { LoadingState() }
            state.error != null && state.data == null -> item { ErrorState(state.error!!, viewModel::refresh) }
            state.data.orEmpty().isEmpty() -> item { EmptyState("No squads yet", "Create a squad or join with an invite code.", Icons.Default.Groups) }
            else -> items(state.data.orEmpty(), key = { it.id }) { community ->
                Surface(onClick = { onNavigate("community/${community.id}") }, shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface) {
                    Column(Modifier.padding(20.dp)) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Text(community.name, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                            if (community.myRole != null) StatusChip(community.myRole!!)
                        }
                        Text(community.description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("${community.memberCount} members · ${if (community.isPublic) "Public" else "Private"}", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
    if (showCreate) CreateCommunityDialog(onDismiss = { showCreate = false }, onCreate = { name, desc, public, max -> viewModel.create(name, desc, public, max); showCreate = false })
    if (showJoin) JoinDialog(onDismiss = { showJoin = false }, onJoin = { viewModel.join(it); showJoin = false })
}

@Composable private fun CreateCommunityDialog(onDismiss: () -> Unit, onCreate: (String, String, Boolean, Int) -> Unit) {
    var name by remember { mutableStateOf("") }; var desc by remember { mutableStateOf("") }
    var public by remember { mutableStateOf(false) }; var max by remember { mutableStateOf("50") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Create squad") }, text = {
        Column {
            OutlinedTextField(name, { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(desc, { desc = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(max, { max = it }, label = { Text("Max members") }, modifier = Modifier.fillMaxWidth())
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) { Switch(public, { public = it }); Text("Public squad") }
        }
    }, confirmButton = { TextButton(onClick = { onCreate(name, desc, public, max.toIntOrNull() ?: 50) }) { Text("Create") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } })
}
@Composable private fun JoinDialog(onDismiss: () -> Unit, onJoin: (String) -> Unit) {
    var code by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Join squad") }, text = { OutlinedTextField(code, { code = it }, label = { Text("Invite code") }) },
        confirmButton = { TextButton(onClick = { onJoin(code) }) { Text("Join") } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } })
}

@Composable
fun CommunityDetailScreen(onNavigate: (String) -> Unit, viewModel: CommunityDetailViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val requests by viewModel.requests.state.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var showSettings by remember { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeader("Squad", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } }); StaleBanner(state.savedAt, state.message); MessageBanner(action.message); MessageBanner(action.error, true) }
        when {
            state.loading && state.data == null -> item { LoadingState() }
            state.error != null && state.data == null -> item { ErrorState(state.error!!, viewModel::refresh) }
            else -> {
                val detail = state.data ?: return@LazyColumn
                val community = detail.community
                val canManage = community.myRole in setOf("owner", "admin")
                item {
                    LoopCard {
                        Text(community.name, style = MaterialTheme.typography.headlineSmall)
                        Text(community.description, style = MaterialTheme.typography.bodyMedium)
                        Text("${community.memberCount}/${community.maxMembers} members · ${if (community.isPublic) "Public" else "Private"}", style = MaterialTheme.typography.bodySmall)
                        if (community.rules.isNotBlank()) { Spacer(Modifier.height(8.dp)); Text(community.rules, style = MaterialTheme.typography.bodyMedium) }
                        Spacer(Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { onNavigate("queue") }, modifier = Modifier.weight(1f)) { Text("Watch queue") }
                            if (community.inviteCode != null) OutlinedButton(onClick = { context.shareText("Join my LoopSquad squad ${community.name} with code ${community.inviteCode}") }, modifier = Modifier.weight(1f)) { Text("Invite") }
                        }
                        if (canManage) {
                            Spacer(Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedButton(onClick = { showSettings = true }, modifier = Modifier.weight(1f)) { Text("Settings") }
                                OutlinedButton(onClick = { viewModel.regenerateInvite() }, modifier = Modifier.weight(1f)) { Text("New code") }
                            }
                        }
                    }
                }
                if (canManage && requests.data.orEmpty().isNotEmpty()) {
                    item { SectionTitle("Join requests") }
                    items(requests.data.orEmpty(), key = { it.id }) { request ->
                        LoopCard {
                            Text(request.name, style = MaterialTheme.typography.titleMedium)
                            if (request.message.isNotBlank()) Text(request.message, style = MaterialTheme.typography.bodyMedium)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(onClick = { viewModel.approve(request.id) }) { Text("Approve") }
                                OutlinedButton(onClick = { viewModel.reject(request.id) }) { Text("Reject") }
                            }
                        }
                    }
                }
                item { SectionTitle("Members") }
                items(detail.members, key = { it.id }) { member ->
                    Surface(onClick = { onNavigate("member/${member.id}") }, shape = MaterialTheme.shapes.medium, color = MaterialTheme.colorScheme.surface) {
                        Row(Modifier.padding(12.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Avatar(member.photoUrl, member.name)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) { Text(member.name, style = MaterialTheme.typography.titleMedium); Text(member.role, style = MaterialTheme.typography.bodySmall) }
                            if (canManage && member.role != "owner") {
                                var menu by remember { mutableStateOf(false) }
                                IconButton(onClick = { menu = true }) { Icon(Icons.Default.MoreVert, "Member actions") }
                                DropdownMenu(menu, { menu = false }) {
                                    DropdownMenuItem(text = { Text("Make admin") }, onClick = { viewModel.role(member.id, "admin"); menu = false })
                                    DropdownMenuItem(text = { Text("Make member") }, onClick = { viewModel.role(member.id, "member"); menu = false })
                                    DropdownMenuItem(text = { Text("Remove") }, onClick = { viewModel.remove(member.id); menu = false })
                                }
                            }
                        }
                    }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (!canManage) OutlinedButton(onClick = { viewModel.leave() }, modifier = Modifier.weight(1f)) { Text("Leave squad") }
                        if (community.myRole == "owner") OutlinedButton(onClick = { viewModel.archive() }, modifier = Modifier.weight(1f)) { Text("Archive") }
                    }
                }
            }
        }
    }
    if (showSettings) {
        val detail = state.data
        if (detail != null) SettingsDialog(detail, onDismiss = { showSettings = false }, onSave = { a, b, c -> viewModel.settings(a, b, c); showSettings = false })
    }
}

@Composable private fun SettingsDialog(detail: CommunityDetail, onDismiss: () -> Unit, onSave: (Boolean, Boolean, Boolean) -> Unit) {
    var approval by remember { mutableStateOf(detail.requireApproval) }
    var review by remember { mutableStateOf(detail.allowPeerReview) }
    var collab by remember { mutableStateOf(detail.allowCollaboration) }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Squad settings") }, text = {
        Column {
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) { Switch(approval, { approval = it }); Text("Require join approval") }
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) { Switch(review, { review = it }); Text("Allow peer review") }
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) { Switch(collab, { collab = it }); Text("Allow collaboration") }
        }
    }, confirmButton = { TextButton(onClick = { onSave(approval, review, collab) }) { Text("Save") } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } })
}

@Composable
fun MissionsScreen(onNavigate: (String) -> Unit, viewModel: MissionsViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val quests by viewModel.quests.state.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    var proofFor by remember { mutableStateOf<String?>(null) }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeader("Missions", "Practice, feedback, growth.", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } }); StaleBanner(state.savedAt, state.message); MessageBanner(action.message); MessageBanner(action.error, true) }
        item { SectionTitle("Daily quests") }
        items(quests.data.orEmpty(), key = { it.id }) { quest ->
            LoopCard {
                Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) { Text(quest.title, style = MaterialTheme.typography.titleMedium); Text("${quest.progress}/${quest.target} · +${quest.xp} XP / +${quest.credits} credits", style = MaterialTheme.typography.bodySmall) }
                    StatusChip(quest.status)
                }
                LinearProgressIndicator(progress = { if (quest.target == 0) 0f else quest.progress.toFloat() / quest.target }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
            }
        }
        item { SectionTitle("Mission catalog") }
        when {
            state.loading && state.data == null -> item { LoadingState() }
            state.error != null && state.data == null -> item { ErrorState(state.error!!, viewModel::refresh) }
            else -> items(state.data.orEmpty(), key = { it.id }) { mission ->
                LoopCard {
                    Text(mission.title, style = MaterialTheme.typography.titleMedium)
                    Text(mission.description, style = MaterialTheme.typography.bodyMedium)
                    Text("${mission.difficulty} · ~${mission.minutes} min · +${mission.xp} XP / +${mission.credits} credits", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        when (mission.status) {
                            "available" -> Button(onClick = { viewModel.accept(mission.id) }) { Text("Accept") }
                            "assigned", "in_progress" -> {
                                Button(onClick = { proofFor = mission.assignmentId }) { Text("Complete") }
                                OutlinedButton(onClick = { mission.assignmentId?.let { viewModel.skip(it) } }) { Text("Skip") }
                            }
                            else -> StatusChip(mission.status)
                        }
                    }
                }
            }
        }
    }
    if (proofFor != null) ProofDialog(onDismiss = { proofFor = null }, onSubmit = { viewModel.complete(proofFor!!, it); proofFor = null })
}

@Composable private fun ProofDialog(onDismiss: () -> Unit, onSubmit: (String) -> Unit) {
    var proof by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Complete mission") }, text = {
        Column { Text("Describe what you did or paste a link. Rewards are verified server-side."); Spacer(Modifier.height(8.dp)); OutlinedTextField(proof, { proof = it }, label = { Text("Proof / notes") }, modifier = Modifier.fillMaxWidth()) }
    }, confirmButton = { TextButton(onClick = { onSubmit(proof) }) { Text("Submit") } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } })
}

@Composable
fun ReviewsScreen(onNavigate: (String) -> Unit, viewModel: ReviewsViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            ScreenHeader("Reviews", "Specific, kind, useful feedback.", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } })
            StaleBanner(state.savedAt, state.message); MessageBanner(action.message); MessageBanner(action.error, true)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(null to "All", "assigned" to "Assigned", "in_progress" to "In progress", "completed" to "Done").forEach { (value, label) ->
                    FilterChip(selected = filter == value, onClick = { viewModel.setStatus(value) }, label = { Text(label) })
                }
            }
        }
        when {
            state.loading && state.data == null -> item { LoadingState() }
            state.error != null && state.data == null -> item { ErrorState(state.error!!, viewModel::refresh) }
            state.data.orEmpty().isEmpty() -> item { EmptyState("No reviews", "Watch queue videos to receive review assignments.", Icons.Default.RateReview) }
            else -> items(state.data.orEmpty(), key = { it.id }) { review ->
                Surface(onClick = { onNavigate("review/${review.id}") }, shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface) {
                    Column(Modifier.padding(16.dp)) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Text(review.videoTitle, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                            StatusChip(review.status)
                        }
                        Text("For ${review.submitterName}", style = MaterialTheme.typography.bodySmall)
                        if (review.dueAt.isNotBlank()) Text("Due ${relativeTime(review.dueAt)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
                        if (review.status == "assigned") { Spacer(Modifier.height(8.dp)); Button(onClick = { viewModel.start(review.id) { onNavigate("review/${review.id}") } }) { Text("Start review") } }
                    }
                }
            }
        }
    }
}

@Composable
fun ReviewDetailScreen(onNavigate: (String) -> Unit, viewModel: ReviewDetailViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    var score by remember { mutableStateOf(7f) }
    var feedback by remember { mutableStateOf("") }
    val answers = remember { mutableStateMapOf<String, String>() }
    LaunchedEffect(state.data) { state.data?.let { if (feedback.isBlank()) feedback = it.feedback } }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeader("Review", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } }); MessageBanner(action.message); MessageBanner(action.error, true) }
        when {
            state.loading && state.data == null -> item { LoadingState() }
            state.error != null && state.data == null -> item { ErrorState(state.error!!, viewModel::refresh) }
            else -> {
                val review = state.data ?: return@LazyColumn
                item { LoopCard { Text(review.videoTitle, style = MaterialTheme.typography.titleLarge); Text("For ${review.submitterName}", style = MaterialTheme.typography.bodyMedium); StatusChip(review.status) } }
                item {
                    LoopCard {
                        Text("Overall score: ${score.toInt()}/10", style = MaterialTheme.typography.titleMedium)
                        Slider(value = score, onValueChange = { score = it }, valueRange = 1f..10f, steps = 8)
                        OutlinedTextField(feedback, { feedback = it }, label = { Text("Constructive feedback") }, minLines = 4, modifier = Modifier.fillMaxWidth(),
                            supportingText = { Text("At least 20 characters. Be specific: hook, pacing, audio, thumbnail, call to action.") })
                    }
                }
                items(review.questions, key = { it.id }) { question ->
                    LoopCard {
                        Text(question.prompt, style = MaterialTheme.typography.titleMedium)
                        if (question.type == "rating") {
                            val value = answers[question.id]?.toFloatOrNull() ?: 5f
                            Slider(value = value, onValueChange = { answers[question.id] = it.toInt().toString() }, valueRange = 1f..10f, steps = 8)
                            Text("${value.toInt()}/10")
                        } else OutlinedTextField(answers[question.id] ?: "", { answers[question.id] = it }, label = { Text("Your answer") }, modifier = Modifier.fillMaxWidth())
                    }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = {
                            viewModel.save(answers.map { (id, value) -> com.creatorloop.core.networkapi.generated.SaveReviewAnswersRequestAnswersItem(id, textAnswer = value) })
                        }, modifier = Modifier.weight(1f)) { Text("Save draft") }
                        Button(onClick = {
                            viewModel.complete(score.toInt(), feedback, answers.map { (id, value) ->
                                com.creatorloop.core.networkapi.generated.CompleteReviewRequestAnswersItem(id, textAnswer = value)
                            }) { onNavigate("reviews") }
                        }, enabled = !action.busy && feedback.trim().length >= 20, modifier = Modifier.weight(1f)) { Text("Submit") }
                    }
                }
            }
        }
    }
}
