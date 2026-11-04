package com.creatorloop.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.creatorloop.app.data.VideoItem
import java.text.SimpleDateFormat
import java.util.*

@Composable fun LoopCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier = modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp, shadowElevation = 0.dp) { Column(Modifier.padding(20.dp), content = content) }
}
@Composable fun ScreenHeader(title: String, subtitle: String? = null, action: @Composable (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(bottom = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.headlineMedium)
            if (!subtitle.isNullOrBlank()) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        action?.invoke()
    }
}
@Composable fun SectionTitle(text: String, action: String? = null, onAction: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
        if (action != null && onAction != null) TextButton(onClick = onAction) { Text(action) }
    }
}
@Composable fun StatCard(label: String, value: String, icon: androidx.compose.ui.graphics.vector.ImageVector, modifier: Modifier = Modifier, tint: Color = MaterialTheme.colorScheme.primary) {
    Surface(modifier = modifier, shape = MaterialTheme.shapes.medium, color = MaterialTheme.colorScheme.surfaceVariant) {
        Column(Modifier.padding(16.dp)) {
            Icon(icon, contentDescription = null, tint = tint)
            Spacer(Modifier.height(8.dp))
            Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
@Composable fun Avatar(url: String?, name: String, size: Int = 40) {
    if (url.isNullOrBlank()) Box(Modifier.size(size.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary.copy(alpha = .2f)), contentAlignment = Alignment.Center) {
        Text(name.take(1).uppercase(), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
    } else AsyncImage(model = url, contentDescription = "$name avatar", modifier = Modifier.size(size.dp).clip(CircleShape), contentScale = ContentScale.Crop)
}
@Composable fun LoadingState() { Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading" }) } }
@Composable fun ErrorState(message: String, onRetry: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Default.CloudOff, contentDescription = null, tint = MaterialTheme.colorScheme.error)
        Spacer(Modifier.height(8.dp)); Text(message, style = MaterialTheme.typography.bodyLarge)
        Spacer(Modifier.height(12.dp)); Button(onClick = onRetry) { Text("Try again") }
    }
}
@Composable fun EmptyState(title: String, message: String, icon: androidx.compose.ui.graphics.vector.ImageVector = Icons.Default.Inbox) {
    Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(48.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(12.dp)); Text(title, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(4.dp)); Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
@Composable fun StaleBanner(savedAt: Long?, warning: String?) {
    if (savedAt == null) return
    Surface(color = MaterialTheme.colorScheme.secondary.copy(alpha = .16f), shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.History, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
            Spacer(Modifier.width(8.dp))
            Text("Showing saved data from ${relativeTime(savedAt)}. ${warning ?: "Pull to refresh when you're back online."}", style = MaterialTheme.typography.bodySmall)
        }
    }
}
@Composable fun MessageBanner(message: String?, error: Boolean = false) {
    if (message.isNullOrBlank()) return
    Surface(color = (if (error) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.tertiary).copy(alpha = .15f),
        shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Text(message, Modifier.padding(12.dp), color = if (error) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.bodyMedium)
    }
}
@Composable fun VideoCard(video: VideoItem, onClick: () -> Unit, trailing: @Composable (() -> Unit)? = null) {
    Surface(onClick = onClick, shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            AsyncImage(model = video.thumbnailUrl ?: "https://i.ytimg.com/vi/${video.youtubeVideoId}/mqdefault.jpg", contentDescription = null,
                modifier = Modifier.width(112.dp).height(68.dp).clip(MaterialTheme.shapes.small), contentScale = ContentScale.Crop)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(video.title, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(video.creatorName.ifBlank { "Your submission" }, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (video.requiredSec > 0) Text("${video.requiredSec / 60} min verified · ${video.rewardXp} XP", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
            }
            trailing?.invoke()
        }
    }
}
@Composable fun StatusChip(status: String) {
    val (label, color) = when (status.lowercase()) {
        "completed", "claimed", "verified", "active", "resolved" -> "Done" to MaterialTheme.colorScheme.tertiary
        "pending", "assigned", "in_progress", "open" -> "In progress" to MaterialTheme.colorScheme.secondary
        "rejected", "failed", "voided", "expired" -> "Needs attention" to MaterialTheme.colorScheme.error
        else -> status.replace('_', ' ') to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Surface(color = color.copy(alpha = .16f), shape = CircleShape) { Text(label, Modifier.padding(horizontal = 10.dp, vertical = 4.dp), color = color, style = MaterialTheme.typography.labelSmall) }
}
fun relativeTime(epochMs: Long): String {
    val diff = (System.currentTimeMillis() - epochMs).coerceAtLeast(0)
    return when { diff < 60_000 -> "just now"; diff < 3_600_000 -> "${diff / 60_000}m ago"; diff < 86_400_000 -> "${diff / 3_600_000}h ago"; else -> "${diff / 86_400_000}d ago" }
}
fun relativeTime(iso: String): String = runCatching {
    val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    relativeTime(format.parse(iso.take(19))?.time ?: System.currentTimeMillis())
}.getOrDefault(iso)
fun formatNumber(value: Int): String = java.text.NumberFormat.getIntegerInstance().format(value)
