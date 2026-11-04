package com.creatorloop.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.creatorloop.app.data.Resource
import com.creatorloop.app.data.UiState
import com.creatorloop.app.data.friendlyMessage
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class ScreenLoader<T>(private val scope: CoroutineScope, private val loader: suspend () -> Resource<T>) {
    private val _state = MutableStateFlow(UiState<T>())
    val state = _state.asStateFlow()
    private var job: Job? = null
    init { refresh() }
    fun refresh() {
        job?.cancel()
        job = scope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                val result = loader()
                _state.value = _state.value.copy(data = result.data, loading = false, stale = result.stale, savedAt = result.savedAt, message = result.warning, error = null)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { _state.value = _state.value.copy(loading = false, error = e.friendlyMessage()) }
        }
    }
    fun update(transform: (UiState<T>) -> UiState<T>) { _state.value = transform(_state.value) }
}

data class ActionState(val busy: Boolean = false, val message: String? = null, val error: String? = null)
class ActionRunner(private val scope: CoroutineScope) {
    private val _state = MutableStateFlow(ActionState())
    val state = _state.asStateFlow()
    fun run(block: suspend () -> String?) {
        if (_state.value.busy) return
        scope.launch {
            _state.value = ActionState(busy = true)
            try { _state.value = ActionState(message = block()) }
            catch (e: CancellationException) { throw e }
            catch (e: Exception) { _state.value = ActionState(error = e.friendlyMessage()) }
        }
    }
    fun clear() { _state.value = ActionState() }
}
