@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

import androidx.compose.foundation.background
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

@Composable
fun AdminScreen(onNavigate: (String) -> Unit, viewModel: AdminViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val action by viewModel.actions.state.collectAsStateWithLifecycle()
    var tab by remember { mutableStateOf(0) }
    val tabs = listOf("Overview", "Reports", "Users", "Support", "Appeals", "Top-ups")
    var resolveReport by remember { mutableStateOf<String?>(null) }
    var rejectTopup by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize()) {
        ScreenHeader("Administration", action = { IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") } })
        MessageBanner(action.message); MessageBanner(action.error, true)
        ScrollableTabRow(selectedTabIndex = tab, edgePadding = 8.dp) {
            tabs.forEachIndexed { index, label -> Tab(selected = tab == index, onClick = { tab = index }, text = { Text(label) }) }
        }
        LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            when {
                state.loading && state.data == null -> item { LoadingState() }
                state.error != null && state.data == null -> item { ErrorState(state.error!!, viewModel::refresh) }
                else -> {
                    val data = state.data ?: return@LazyColumn
                    when (tab) {
                        0 -> {
                            item {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    StatCard("Users", "${data.metrics.users}", Icons.Default.People, Modifier.weight(1f))
                                    StatCard("Squads", "${data.metrics.communities}", Icons.Default.Groups, Modifier.weight(1f))
                                    StatCard("Videos", "${data.metrics.videos}", Icons.Default.VideoLibrary, Modifier.weight(1f))
                                }
                            }
                            item {
                                LoopCard {
                                    Text("Pending reports: ${data.metrics.pendingReports}", style = MaterialTheme.typography.titleMedium)
                                    Text("14d: ${data.analytics.submits} submits · ${data.analytics.claims} claims · ${data.analytics.reviews} reviews · ${data.analytics.claimRate}% claim rate", style = MaterialTheme.typography.bodyMedium)
                                    val max = (data.analytics.trend.maxOfOrNull { it.second } ?: 1).coerceAtLeast(1)
                                    Row(Modifier.fillMaxWidth().height(100.dp), verticalAlignment = androidx.compose.ui.Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        data.analytics.trend.forEach { (_, value) -> Box(Modifier.weight(1f).fillMaxHeight(value.toFloat() / max).background(MaterialTheme.colorScheme.primary, MaterialTheme.shapes.small)) }
                                    }
                                }
                            }
                            item { SectionTitle("Communities") }
                            items(data.communities, key = { it.id }) { community -> LoopCard { Text(community.name, style = MaterialTheme.typography.titleMedium); Text("${community.memberCount?.toInt() ?: 0} members · ${community.status ?: "active"}", style = MaterialTheme.typography.bodySmall) } }
                        }
                        1 -> {
                            if (data.reports.isEmpty()) item { EmptyState("No pending reports", "The queue is clear.", Icons.Default.Flag) }
                            items(data.reports, key = { it.id }) { report ->
                                LoopCard {
                                    Text(report.reason ?: "Report", style = MaterialTheme.typography.titleMedium)
                                    Text("${report.resourceType ?: "resource"} · ${report.resourceId ?: ""}", style = MaterialTheme.typography.bodySmall)
                                    Text("Reporter: ${report.reporterName ?: "unknown"} · Reported: ${report.reportedUserName ?: report.reportedName ?: "unknown"}", style = MaterialTheme.typography.bodySmall)
                                    if (!report.description.isNullOrBlank()) Text(report.description!!, style = MaterialTheme.typography.bodyMedium)
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Button(onClick = { resolveReport = report.id }) { Text("Resolve") }
                                        OutlinedButton(onClick = { viewModel.resolveReport(report.id, "dismissed", "") }) { Text("Dismiss") }
                                    }
                                }
                            }
                        }
                        2 -> items(data.users, key = { it.id }) { user ->
                            LoopCard {
                                Text(user.displayName ?: user.email ?: user.id, style = MaterialTheme.typography.titleMedium)
                                Text("${user.status ?: "active"} · ${user.platformRole ?: "member"} · trust ${user.trustScore?.toInt() ?: 0}", style = MaterialTheme.typography.bodySmall)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    if (user.status == "suspended") OutlinedButton(onClick = { viewModel.reinstate(user.id) }) { Text("Reinstate") }
                                    else OutlinedButton(onClick = { viewModel.suspend(user.id, "Moderator action") }) { Text("Suspend") }
                                    OutlinedButton(onClick = { viewModel.role(user.id, if (user.platformRole == "moderator") "member" else "moderator") }) { Text(if (user.platformRole == "moderator") "Remove mod" else "Make mod") }
                                }
                            }
                        }
                        3 -> {
                            if (data.support.isEmpty()) item { EmptyState("No open support", "All caught up.", Icons.Default.SupportAgent) }
                            items(data.support, key = { it.id }) { ticket -> LoopCard { Text(ticket.topic ?: "Support", style = MaterialTheme.typography.titleMedium); Text(ticket.message ?: "", style = MaterialTheme.typography.bodyMedium); Text(ticket.displayName ?: ticket.email ?: "", style = MaterialTheme.typography.bodySmall); Button(onClick = { viewModel.resolveSupport(ticket.id) }) { Text("Resolve") } } }
                        }
                        4 -> {
                            if (data.appeals.isEmpty()) item { EmptyState("No appeals", "Nothing to review.", Icons.Default.Gavel) }
                            items(data.appeals, key = { it.id }) { appeal -> LoopCard { Text(appeal.reason ?: "Appeal", style = MaterialTheme.typography.titleMedium); Text("Report ${appeal.reportId ?: ""}", style = MaterialTheme.typography.bodySmall); Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Button(onClick = { viewModel.reviewAppeal(appeal.id, "approved", "") }) { Text("Approve") }; OutlinedButton(onClick = { viewModel.reviewAppeal(appeal.id, "rejected", "") }) { Text("Reject") } } } }
                        }
                        else -> {
                            if (data.topups.isEmpty()) item { EmptyState("No top-ups", "Manual top-ups appear here.", Icons.Default.Receipt) }
                            items(data.topups, key = { it.str("id") }) { topup ->
                                LoopCard {
                                    Text(topup.str("displayName", "email", default = "Top-up"), style = MaterialTheme.typography.titleMedium)
                                    Text("${topup.int("amount", "credits")} credits · ${topup.str("status")}", style = MaterialTheme.typography.bodySmall)
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Button(onClick = { viewModel.approveTopup(topup.str("id")) }) { Text("Approve") }
                                        OutlinedButton(onClick = { rejectTopup = topup.str("id") }) { Text("Reject") }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    if (resolveReport != null) {
        var notes by remember { mutableStateOf("") }
        AlertDialog(onDismissRequest = { resolveReport = null }, title = { Text("Resolve report") }, text = { OutlinedTextField(notes, { notes = it }, label = { Text("Resolution notes") }, modifier = Modifier.fillMaxWidth()) },
            confirmButton = { TextButton(onClick = { viewModel.resolveReport(resolveReport!!, "resolved", notes); resolveReport = null }) { Text("Resolve") } }, dismissButton = { TextButton(onClick = { resolveReport = null }) { Text("Cancel") } })
    }
    if (rejectTopup != null) {
        var reason by remember { mutableStateOf("") }
        AlertDialog(onDismissRequest = { rejectTopup = null }, title = { Text("Reject top-up") }, text = { OutlinedTextField(reason, { reason = it }, label = { Text("Reason") }, modifier = Modifier.fillMaxWidth()) },
            confirmButton = { TextButton(onClick = { viewModel.rejectTopup(rejectTopup!!, reason); rejectTopup = null }) { Text("Reject") } }, dismissButton = { TextButton(onClick = { rejectTopup = null }) { Text("Cancel") } })
    }
}
