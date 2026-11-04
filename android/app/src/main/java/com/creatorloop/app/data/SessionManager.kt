package com.creatorloop.app.data

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.gms.tasks.Task
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.creatorloop.app.R
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit
import com.google.android.gms.tasks.Tasks
import javax.inject.Inject
import javax.inject.Singleton

sealed interface AuthState {
    data object Loading : AuthState
    data class SignedOut(val configurationError: String? = null) : AuthState
    data class SignedIn(val uid: String) : AuthState
}

@Singleton
class SessionManager @Inject constructor(@ApplicationContext private val context: Context) {
    private val firebase: FirebaseAuth? get() = if (FirebaseApp.getApps(context).isEmpty()) null else FirebaseAuth.getInstance()
    private val _state = MutableStateFlow<AuthState>(AuthState.Loading)
    val state: StateFlow<AuthState> = _state.asStateFlow()
    val uid: String? get() = firebase?.currentUser?.uid
    val configurationError: String? get() = when {
        FirebaseApp.getApps(context).isEmpty() -> "Firebase is not configured for this build. Add the public Firebase app values and register this app's signing certificates."
        context.getString(R.string.google_web_client_id).isBlank() -> "Google sign-in is not configured for this build. Add the OAuth web client ID."
        else -> null
    }
    init {
        val auth = firebase
        if (auth == null) _state.value = AuthState.SignedOut(configurationError)
        else auth.addAuthStateListener { _state.value = it.currentUser?.let { user -> AuthState.SignedIn(user.uid) } ?: AuthState.SignedOut(configurationError) }
    }
    fun token(forceRefresh: Boolean = false): String? {
        val user = firebase?.currentUser ?: return null
        return try { Tasks.await(user.getIdToken(forceRefresh), 15, TimeUnit.SECONDS).token } catch (_: Exception) { null }
    }
    fun signOut() { firebase?.signOut(); _state.value = AuthState.SignedOut(configurationError) }
    internal fun authOrNull(): FirebaseAuth? = firebase
}

suspend fun <T> Task<T>.awaitTask(): T = withContext(Dispatchers.IO) { Tasks.await(this@awaitTask, 30, TimeUnit.SECONDS) }

@Singleton
class AuthRepository @Inject constructor(private val session: SessionManager, @ApplicationContext private val context: Context) {
    suspend fun googleSignIn(): String {
        val auth = session.authOrNull() ?: throw IllegalStateException(session.configurationError ?: "Sign-in is unavailable")
        val clientId = context.getString(R.string.google_web_client_id)
        if (clientId.isBlank()) throw IllegalStateException("Google sign-in is not configured for this build")
        val option = GetGoogleIdOption.Builder().setFilterByAuthorizedAccounts(false).setServerClientId(clientId).setAutoSelectEnabled(false).build()
        val result = CredentialManager.create(context).getCredential(context, GetCredentialRequest.Builder().addCredentialOption(option).build())
        val google = GoogleIdTokenCredential.createFrom(result.credential.data)
        val user = auth.signInWithCredential(GoogleAuthProvider.getCredential(google.idToken, null)).awaitTask().user
            ?: throw IllegalStateException("Google sign-in did not return an account")
        return user.uid
    }
    suspend fun emailSignIn(email: String, password: String, createAccount: Boolean) {
        val auth = session.authOrNull() ?: throw IllegalStateException(session.configurationError ?: "Sign-in is unavailable")
        if (createAccount) auth.createUserWithEmailAndPassword(email.trim(), password).awaitTask()
        else auth.signInWithEmailAndPassword(email.trim(), password).awaitTask()
    }
    suspend fun resetPassword(email: String) {
        val auth = session.authOrNull() ?: throw IllegalStateException("Sign-in is unavailable")
        auth.sendPasswordResetEmail(email.trim()).awaitTask()
    }
}
