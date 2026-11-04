package com.creatorloop.app.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.creatorloop.app.MainActivity
import com.creatorloop.app.R
import com.creatorloop.app.data.PreferencesStore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import javax.inject.Inject

@AndroidEntryPoint
class LoopMessagingService : FirebaseMessagingService() {
    @Inject lateinit var preferences: PreferencesStore
    @Inject lateinit var registrar: PushRegistrar
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    override fun onNewToken(token: String) {
        scope.launch { preferences.setPendingToken(token); registrar.schedule() }
    }
    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val title = data["title"] ?: "LoopSquad"
        val body = data["message"] ?: "You have a new update"
        val route = DeepLinks.route(data["url"]) ?: "notifications"
        val intent = Intent(this, MainActivity::class.java).putExtra("route", route).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pending = PendingIntent.getActivity(this, route.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, "loop_updates")
            .setSmallIcon(R.drawable.ic_notification).setContentTitle(title).setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body)).setContentIntent(pending).setAutoCancel(true)
            .setColor(getColor(R.color.notification_color)).build()
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.areNotificationsEnabled()) manager.notify(data["id"]?.hashCode() ?: System.currentTimeMillis().toInt(), notification)
    }
    override fun onDestroy() { scope.cancel(); super.onDestroy() }
}

object NotificationChannels {
    fun create(context: android.content.Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("loop_updates", "Community updates", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "Feedback, community activity and account updates"
        })
    }
}
