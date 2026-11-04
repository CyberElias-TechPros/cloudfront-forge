package com.creatorloop.app

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class LoopApplication : Application(), Configuration.Provider {
    @Inject lateinit var workerFactory: HiltWorkerFactory
    override val workManagerConfiguration: Configuration get() = Configuration.Builder().setWorkerFactory(workerFactory).build()
    override fun onCreate() {
        super.onCreate()
        // Firebase config is public app configuration injected at build time. CI can compile
        // without it; sign-in then stays disabled with an explicit setup message.
        if (FirebaseApp.getApps(this).isEmpty()) {
            val apiKey = getString(R.string.firebase_api_key)
            val appId = getString(R.string.firebase_app_id)
            if (apiKey.isNotBlank() && appId.isNotBlank()) {
                FirebaseApp.initializeApp(this, FirebaseOptions.Builder()
                    .setApiKey(apiKey).setApplicationId(appId)
                    .setProjectId(getString(R.string.firebase_project_id))
                    .setGcmSenderId(getString(R.string.firebase_sender_id)).build())
            }
        }
    }
}
