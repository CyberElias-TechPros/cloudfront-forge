@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.creatorloop.app.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.creatorloop.app.data.*
import com.creatorloop.app.ui.*
import com.creatorloop.app.util.openExternal
import com.creatorloop.core.networkapi.generated.UpdateNotificationPreferencesRequest

@Composable
fun SettingsScreen(appState: AppState, appViewModel: AppViewModel, onNavigate: (String) -> Unit, viewModel: SettingsViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    val youtubeUrl by viewModel.youtubeUrl.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val theme by appViewModel.theme.collectAsStateWithLifecycle()
    val dataSaver by appViewModel.dataSaver.collectAsStateWithLifecycle()
    var push by remember { mutableStateOf(true) }; var email by remember { mutableStateOf(true) }
    var missions by remember { mutableStateOf(true) }; var reviews by remember { mutableStateOf(true) }; var community by remember { mutableStateOf(true) }
    var quietStart by remember { mutableStateOf(22f) }; var quietEnd by remember { mutableStateOf(7f) }
    var loaded by remember { mutableStateOf(false) }
    LaunchedEffect(state.data) {
        state.data?.prefs?.let { p -> if (!loaded) { push = p.bool("pushEnabled", default = true); email = p.bool("emailEnabled", default = true); missions = p.bool("missionReminders", default = true); reviews = p.bool("reviewRequests", default = true); community = p.bool("communityUpdates", default = true); quietStart = p.num("quietHoursStart", default = 22.0).toFloat(); quietEnd = p.num("quietHoursEnd", default = 7.0).toFloat(); loaded = true } }
    }
    LaunchedEffect(youtubeUrl) { youtubeUrl?.let { context.openExternal(it); viewModel.consumeYoutubeUrl() } }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { viewModel.refresh() }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeader("Settings", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } }); MessageBanner(action.message); MessageBanner(action.error, true) }
        item {
            LoopCard {
                Text("Appearance", style = MaterialTheme.typography.titleMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ThemeMode.entries.forEach { mode -> FilterChip(selected = theme == mode, onClick = { appViewModel.setTheme(mode) }, label = { Text(mode.name.lowercase().replaceFirstChar { it.uppercase() }) }) }
                }
                Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) { Switch(dataSaver, { appViewModel.setDataSaver(it) }); Text("Data saver (lower image quality)") }
            }
        }
        item {
            LoopCard {
                Text("Notifications", style = MaterialTheme.typography.titleMedium)
                if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    OutlinedButton(onClick = { permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) }, modifier = Modifier.fillMaxWidth()) { Text("Enable system notifications") }
                }
                SettingSwitch("Push notifications", push) { push = it }
                SettingSwitch("Email notifications", email) { email = it }
                SettingSwitch("Mission reminders", missions) { missions = it }
                SettingSwitch("Review requests", reviews) { reviews = it }
                SettingSwitch("Community updates", community) { community = it }
                Text("Quiet hours: ${quietStart.toInt()}:00 – ${quietEnd.toInt()}:00", style = MaterialTheme.typography.bodyMedium)
                Slider(quietStart, { quietStart = it }, valueRange = 0f..23f, steps = 22)
                Slider(quietEnd, { quietEnd = it }, valueRange = 0f..23f, steps = 22)
                Button(onClick = { viewModel.savePrefs(UpdateNotificationPreferencesRequest(email, push, true, false, missions, reviews, community, quietStart.toDouble(), quietEnd.toDouble())) }, modifier = Modifier.fillMaxWidth()) { Text("Save notification preferences") }
            }
        }
        item {
            LoopCard {
                Text("YouTube", style = MaterialTheme.typography.titleMedium)
                Text(if (state.data?.youtubeConnected == true) "Connected${state.data?.channelId?.let { ": $it" } ?: ""}" else "Not connected", style = MaterialTheme.typography.bodyMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { viewModel.connectYouTube() }, modifier = Modifier.weight(1f)) { Text("Connect") }
                    OutlinedButton(onClick = { viewModel.disconnectYouTube() }, enabled = state.data?.youtubeConnected == true, modifier = Modifier.weight(1f)) { Text("Disconnect") }
                }
            }
        }
        item {
            LoopCard {
                Text("Safety & support", style = MaterialTheme.typography.titleMedium)
                OutlinedButton(onClick = { onNavigate("safety") }, modifier = Modifier.fillMaxWidth()) { Text("Blocks, reports and appeals") }
                OutlinedButton(onClick = { onNavigate("support") }, modifier = Modifier.fillMaxWidth()) { Text("Contact support") }
                OutlinedButton(onClick = { onNavigate("legal/rules") }, modifier = Modifier.fillMaxWidth()) { Text("Community rules") }
                OutlinedButton(onClick = { onNavigate("legal/terms") }, modifier = Modifier.fillMaxWidth()) { Text("Terms of Service") }
                OutlinedButton(onClick = { onNavigate("legal/privacy") }, modifier = Modifier.fillMaxWidth()) { Text("Privacy Policy") }
                if (viewModel.isAdmin()) OutlinedButton(onClick = { onNavigate("admin") }, modifier = Modifier.fillMaxWidth()) { Text("Administration") }
            }
        }
        item {
            LoopCard {
                Text("Account", style = MaterialTheme.typography.titleMedium)
                Text(appState.member?.email ?: "", style = MaterialTheme.typography.bodyMedium)
                Text("App version ${com.creatorloop.app.BuildConfig.VERSION_NAME} (${com.creatorloop.app.BuildConfig.VERSION_CODE})", style = MaterialTheme.typography.bodySmall)
                Button(onClick = { appViewModel.signOut() }, enabled = !appState.busy, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) { Text("Sign out") }
            }
        }
    }
}

@Composable private fun SettingSwitch(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
        Switch(checked, onChange)
    }
}

@Composable
fun SafetyScreen(onNavigate: (String) -> Unit, viewModel: SafetyViewModel = hiltViewModel()) {
    val blocks by viewModel.blocks.state.collectAsStateWithLifecycle()
    val reports by viewModel.reports.state.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    var appealFor by remember { mutableStateOf<String?>(null) }
    var tab by remember { mutableStateOf("blocks") }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeader("Safety", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } }); MessageBanner(action.message); MessageBanner(action.error, true)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { FilterChip(tab == "blocks", { tab = "blocks" }, label = { Text("Blocked") }); FilterChip(tab == "reports", { tab = "reports" }, label = { Text("Reports") }) } }
        if (tab == "blocks") {
            if (blocks.data.orEmpty().isEmpty()) item { EmptyState("No blocked members", "Blocking hides content both ways.", Icons.Default.Block) }
            items(blocks.data.orEmpty(), key = { it.id }) { block -> LoopCard { Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) { Text(block.name, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium); OutlinedButton(onClick = { viewModel.unblock(block.id) }) { Text("Unblock") } } } }
        } else {
            if (reports.data.orEmpty().isEmpty()) item { EmptyState("No reports", "Reports you file appear here.", Icons.Default.Flag) }
            items(reports.data.orEmpty(), key = { it.id }) { report ->
                LoopCard {
                    Text(report.reason.replace('_', ' '), style = MaterialTheme.typography.titleMedium)
                    Text("${report.resourceType} · ${report.resourceId}", style = MaterialTheme.typography.bodySmall)
                    StatusChip(report.status)
                    if (report.notes.isNotBlank()) Text(report.notes, style = MaterialTheme.typography.bodyMedium)
                    if (report.status == "resolved" && !report.appealed) { Spacer(Modifier.height(8.dp)); OutlinedButton(onClick = { appealFor = report.id }) { Text("Appeal") } }
                }
            }
        }
    }
    if (appealFor != null) {
        var reason by remember { mutableStateOf("") }
        AlertDialog(onDismissRequest = { appealFor = null }, title = { Text("Appeal decision") }, text = { OutlinedTextField(reason, { reason = it }, label = { Text("Why should this be reviewed?") }, modifier = Modifier.fillMaxWidth()) },
            confirmButton = { TextButton(onClick = { viewModel.appeal(appealFor!!, reason); appealFor = null }) { Text("Submit") } }, dismissButton = { TextButton(onClick = { appealFor = null }) { Text("Cancel") } })
    }
}

@Composable
fun SupportScreen(onNavigate: (String) -> Unit, viewModel: SupportViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    var topic by remember { mutableStateOf("account") }; var message by remember { mutableStateOf("") }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeader("Support", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } }); MessageBanner(action.message); MessageBanner(action.error, true) }
        item {
            LoopCard {
                Text("New request", style = MaterialTheme.typography.titleMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("account", "billing", "youtube", "abuse", "other").forEach { option -> FilterChip(topic == option, { topic = option }, label = { Text(option) }) }
                }
                OutlinedTextField(message, { message = it }, label = { Text("How can we help?") }, minLines = 3, modifier = Modifier.fillMaxWidth())
                Button(onClick = { viewModel.create(topic, message); message = "" }, enabled = !action.busy && message.trim().length >= 10, modifier = Modifier.fillMaxWidth()) { Text("Send request") }
            }
        }
        item { SectionTitle("Your requests") }
        if (state.data.orEmpty().isEmpty()) item { EmptyState("No requests", "Support replies appear here.", Icons.Default.SupportAgent) }
        items(state.data.orEmpty(), key = { it.id }) { ticket -> LoopCard { Text(ticket.topic, style = MaterialTheme.typography.titleMedium); Text(ticket.message, style = MaterialTheme.typography.bodyMedium); StatusChip(ticket.status); Text(relativeTime(ticket.createdAt), style = MaterialTheme.typography.bodySmall) } }
    }
}
