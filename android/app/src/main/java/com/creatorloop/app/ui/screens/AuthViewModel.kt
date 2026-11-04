package com.creatorloop.app.ui.screens

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.creatorloop.app.data.AuthRepository
import com.creatorloop.app.data.friendlyMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(val busy: Boolean = false, val error: String? = null, val message: String? = null)

@HiltViewModel
class AuthViewModel @Inject constructor(private val auth: AuthRepository) : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState())
    val state = _state.asStateFlow()
    fun google(context: Context) = viewModelScope.launch {
        _state.value = AuthUiState(busy = true)
        try { auth.googleSignIn(); _state.value = AuthUiState() }
        catch (e: Exception) { _state.value = AuthUiState(error = e.friendlyMessage()) }
    }
    fun email(email: String, password: String, create: Boolean) = viewModelScope.launch {
        _state.value = AuthUiState(busy = true)
        try {
            if (email.isBlank() || password.length < 8) throw IllegalArgumentException("Enter a valid email and a password of at least 8 characters")
            auth.emailSignIn(email, password, create); _state.value = AuthUiState()
        } catch (e: Exception) { _state.value = AuthUiState(error = e.friendlyMessage()) }
    }
    fun reset(email: String) = viewModelScope.launch {
        _state.value = AuthUiState(busy = true)
        try { auth.resetPassword(email); _state.value = AuthUiState(message = "If that account exists, a reset email is on its way.") }
        catch (e: Exception) { _state.value = AuthUiState(error = e.friendlyMessage()) }
    }
}
