package com.creatorloop.app.push

import android.content.Context
import androidx.work.*
import com.creatorloop.app.data.LoopRepository
import com.creatorloop.app.data.PreferencesStore
import com.creatorloop.app.data.SessionManager
import com.creatorloop.app.data.awaitTask
import com.creatorloop.core.networkapi.generated.RegisterMobileDeviceRequest
import com.creatorloop.core.networkapi.generated.RemoveMobileDeviceRequest
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PushRegistrar @Inject constructor(private val repository: LoopRepository, private val preferences: PreferencesStore,
                                        private val session: SessionManager, @ApplicationContext private val context: Context) {
    fun schedule() {
        val request = OneTimeWorkRequestBuilder<PushRegistrationWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, java.util.concurrent.TimeUnit.SECONDS).build()
        WorkManager.getInstance(context).enqueueUniqueWork("push-registration", ExistingWorkPolicy.REPLACE, request)
    }
    suspend fun register() {
        if (FirebaseApp.getApps(context).isEmpty() || session.uid == null) return
        val token = preferences.pendingToken() ?: FirebaseMessaging.getInstance().token.awaitTask()
        repository.call { registerMobileDevice(RegisterMobileDeviceRequest(token, preferences.installationId())) }
        preferences.setPendingToken(null)
    }
    suspend fun unregister() {
        val installation = preferences.installationId()
        runCatching { repository.call { removeMobileDevice(RemoveMobileDeviceRequest(installation)) } }
        runCatching { if (FirebaseApp.getApps(context).isNotEmpty()) FirebaseMessaging.getInstance().deleteToken().awaitTask() }
        preferences.setPendingToken(null)
    }
}
