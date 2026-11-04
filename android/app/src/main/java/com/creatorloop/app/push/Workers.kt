package com.creatorloop.app.push

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.creatorloop.app.data.ApiException
import com.creatorloop.app.data.CacheDao
import com.creatorloop.app.data.LoopRepository
import com.creatorloop.app.data.SessionManager
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class PushRegistrationWorker @AssistedInject constructor(@Assisted context: Context, @Assisted params: WorkerParameters,
                                                         private val registrar: PushRegistrar) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = try { registrar.register(); Result.success() }
    catch (e: ApiException) { if (e.status in 400..499) Result.failure() else Result.retry() }
    catch (_: Exception) { if (runAttemptCount >= 6) Result.failure() else Result.retry() }
}

@HiltWorker
class SyncWorker @AssistedInject constructor(@Assisted context: Context, @Assisted params: WorkerParameters,
                                             private val repository: LoopRepository, private val cache: CacheDao,
                                             private val session: SessionManager) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val owner = session.uid ?: return Result.success()
        var retry = false
        for (item in cache.pending(owner)) {
            try {
                when (item.kind) {
                    "notification_read" -> repository.call { markNotificationRead(item.resourceId) }
                    "notification_delete" -> repository.call { deleteNotification(item.resourceId) }
                }
                cache.remove(item.id)
            } catch (e: Exception) {
                val permanent = e is ApiException && e.status in 400..499
                if (permanent || item.attempts >= 5) cache.remove(item.id)
                else { cache.failed(item.id, e.message); retry = true }
            }
        }
        runCatching { repository.invalidate("notifications") }
        return if (retry) Result.retry() else Result.success()
    }
}

object SyncScheduler {
    fun schedule(context: Context) {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, java.util.concurrent.TimeUnit.SECONDS).build()
        WorkManager.getInstance(context).enqueueUniqueWork("loop-outbox", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }
}
