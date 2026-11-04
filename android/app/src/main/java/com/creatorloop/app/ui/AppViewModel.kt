package com.creatorloop.app.ui

import android.content.Context
import android.webkit.CookieManager
import android.webkit.WebStorage
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.creatorloop.app.BuildConfig
import com.creatorloop.app.data.*
import com.creatorloop.app.push.PushRegistrar
import com.creatorloop.core.networkapi.generated.RecordMobileConsentRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AppState(val auth: AuthState = AuthState.Loading, val member: Member? = null, val config: MobileConfig = MobileConfig(),
                    val consentRequired: Boolean = false, val loading: Boolean = false, val error: String? = null,
                    val online: Boolean = true, val busy: Boolean = false, val message: String? = null) {
    val forceUpdate: Boolean get() = BuildConfig.VERSION_CODE < config.minVersionCode
}

@HiltViewModel
class AppViewModel @Inject constructor(private val session: SessionManager, private val repository: LoopRepository,
                                       private val preferences: PreferencesStore, private val push: PushRegistrar,
                                       connectivity: ConnectivityObserver, @ApplicationContext private val context: Context) : ViewModel() {
    private val _state = MutableStateFlow(AppState())
    val state = _state.asStateFlow()
    val theme = preferences.theme.stateIn(viewModelScope, SharingStarted.Eagerly, ThemeMode.DARK)
    val dataSaver = preferences.dataSaver.stateIn(viewModelScope, SharingStarted.Eagerly, false)
    init {
        viewModelScope.launch { session.state.collect { auth ->
            _state.value = _state.value.copy(auth = auth, member = if (auth is AuthState.SignedIn) _state.value.member else null)
            if (auth is AuthState.SignedIn) refresh()
        } }
        viewModelScope.launch { connectivity.online.collect { online -> _state.value = _state.value.copy(online = online) } }
        viewModelScope.launch { refreshConfig() }
    }
    private suspend fun refreshConfig() {
        runCatching { repository.config() }.onSuccess { config ->
            val consent = preferences.consentVersion.first()
            _state.value = _state.value.copy(config = config, consentRequired = _state.value.auth is AuthState.SignedIn && consent != config.policyVersion)
        }
    }
    fun refresh() = viewModelScope.launch {
        if (_state.value.auth !is AuthState.SignedIn) { refreshConfig(); return@launch }
        _state.value = _state.value.copy(loading = true, error = null)
        try {
            val config = runCatching { repository.config() }.getOrDefault(_state.value.config)
            val member = repository.member().data
            val consent = preferences.consentVersion.first()
            _state.value = _state.value.copy(member = member, config = config, loading = false, consentRequired = consent != config.policyVersion)
            if (consent == config.policyVersion && config.pushEnabled) push.schedule()
        } catch (e: Exception) {
            _state.value = _state.value.copy(loading = false, error = e.friendlyMessage())
            if (e is ApiException && (e.requiresSignIn || e.accountBlocked)) session.signOut()
        }
    }
    fun acceptConsent(ageConfirmed: Boolean) = viewModelScope.launch {
        _state.value = _state.value.copy(busy = true, error = null)
        try {
            val version = _state.value.config.policyVersion
            repository.call { recordMobileConsent(RecordMobileConsentRequest(version, termsAccepted = true, privacyAccepted = true, ageConfirmed = ageConfirmed)) }
            preferences.setConsent(version)
            _state.value = _state.value.copy(busy = false, consentRequired = false)
            if (_state.value.config.pushEnabled) push.schedule()
        } catch (e: Exception) { _state.value = _state.value.copy(busy = false, error = e.friendlyMessage()) }
    }
    fun signOut() = viewModelScope.launch {
        _state.value = _state.value.copy(busy = true)
        runCatching { push.unregister() }
        runCatching { repository.clearLocal() }
        CookieManager.getInstance().removeAllCookies(null)
        WebStorage.getInstance().deleteAllData()
        session.signOut()
        _state.value = AppState(auth = AuthState.SignedOut(session.configurationError), config = _state.value.config)
    }
    fun setTheme(mode: ThemeMode) = viewModelScope.launch { preferences.setTheme(mode) }
    fun setDataSaver(value: Boolean) = viewModelScope.launch { preferences.setDataSaver(value) }
    fun clearMessage() { _state.value = _state.value.copy(message = null, error = null) }
}
