package com.creatorloop.app.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

enum class ThemeMode { SYSTEM, LIGHT, DARK }

@Singleton
class PreferencesStore @Inject constructor(private val store: DataStore<Preferences>) {
    private object Keys {
        val theme = stringPreferencesKey("theme")
        val dataSaver = booleanPreferencesKey("data_saver")
        val consent = stringPreferencesKey("consent_version")
        val installation = stringPreferencesKey("installation_id")
        val pendingToken = stringPreferencesKey("pending_fcm_token")
        val notificationsAsked = booleanPreferencesKey("notifications_asked")
    }
    val theme: Flow<ThemeMode> = store.data.map { runCatching { ThemeMode.valueOf(it[Keys.theme] ?: "DARK") }.getOrDefault(ThemeMode.DARK) }
    val dataSaver: Flow<Boolean> = store.data.map { it[Keys.dataSaver] ?: false }
    val consentVersion: Flow<String> = store.data.map { it[Keys.consent] ?: "" }
    val notificationsAsked: Flow<Boolean> = store.data.map { it[Keys.notificationsAsked] ?: false }
    suspend fun setTheme(mode: ThemeMode) { store.edit { it[Keys.theme] = mode.name } }
    suspend fun setDataSaver(value: Boolean) { store.edit { it[Keys.dataSaver] = value } }
    suspend fun setConsent(version: String) { store.edit { it[Keys.consent] = version } }
    suspend fun setNotificationsAsked(value: Boolean) { store.edit { it[Keys.notificationsAsked] = value } }
    suspend fun installationId(): String {
        val current = store.data.first()[Keys.installation]
        if (current != null) return current
        val id = UUID.randomUUID().toString()
        store.edit { it[Keys.installation] = id }
        return id
    }
    suspend fun setPendingToken(token: String?) { store.edit { if (token == null) it.remove(Keys.pendingToken) else it[Keys.pendingToken] = token } }
    suspend fun pendingToken(): String? = store.data.first()[Keys.pendingToken]
}
