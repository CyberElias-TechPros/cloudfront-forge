package com.creatorloop.app.player

import android.os.SystemClock
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.creatorloop.app.data.*
import com.creatorloop.core.networkapi.generated.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import javax.inject.Inject

data class AttentionChallenge(val id: String, val question: String, val ttlSec: Int)
data class WatchUiState(val video: VideoItem? = null, val loading: Boolean = true, val error: String? = null,
                        val sessionToken: String? = null, val sessionsEnabled: Boolean = false,
                        val verifiedSeconds: Int = 0, val requiredSeconds: Int = 180, val position: Double = 0.0,
                        val playing: Boolean = false, val ready: Boolean = false, val playerFailed: Boolean = false,
                        val claiming: Boolean = false, val claim: ClaimWatchResponse? = null,
                        val challenge: AttentionChallenge? = null, val challengeBusy: Boolean = false, val voided: Boolean = false,
                        val commented: Boolean = false, val warning: String? = null)

@HiltViewModel
class WatchViewModel @Inject constructor(private val repository: LoopRepository, savedState: SavedStateHandle) : ViewModel() {
    private val videoId: String = savedState["videoId"] ?: ""
    private val _state = MutableStateFlow(WatchUiState())
    val state = _state.asStateFlow()
    private var lastHeartbeat = 0L
    private var challengeIssued = false
    private var foreground = true
    init { load() }

    private fun load() = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true, error = null)
        try {
            val config = runCatching { repository.config() }.getOrDefault(MobileConfig())
            val raw = repository.call { getVideo(videoId) }
            val video = VideoItem(id = raw.str("id", default = videoId), title = raw.str("title", default = "Video"),
                creatorName = raw.str("creatorName", "displayName", default = "Creator"), youtubeVideoId = raw.str("youtubeVideoId"),
                youtubeUrl = raw.str("youtubeUrl"), thumbnailUrl = raw.str("thumbnailUrl").ifBlank { null },
                durationSec = raw.int("durationSec", "durationSeconds"), requiredSec = raw.int("requiredSec", default = 180),
                magicWord = raw.str("magicWord").ifBlank { null })
            _state.value = _state.value.copy(video = video, loading = false, requiredSeconds = video.requiredSec, sessionsEnabled = config.watchSessionsEnabled)
            if (config.watchSessionsEnabled) {
                runCatching { repository.call { startWatchSession(StartWatchSessionRequest(videoId)) } }
                    .onSuccess { _state.value = _state.value.copy(sessionToken = it.sessionToken, sessionsEnabled = it.enabled) }
                    .onFailure { _state.value = _state.value.copy(warning = "Verified rewards could not start: ${it.friendlyMessage()}") }
            } else _state.value = _state.value.copy(warning = "Verified watch rewards are not enabled in this environment.")
        } catch (e: Exception) { _state.value = _state.value.copy(loading = false, error = e.friendlyMessage()) }
    }

    fun onForeground(value: Boolean) { foreground = value }
    fun onPlayerEvent(event: PlayerEvent) {
        when (event.type) {
            "ready" -> _state.value = _state.value.copy(ready = true, playerFailed = false)
            "state" -> _state.value = _state.value.copy(playing = event.state == 1, position = event.time)
            "tick" -> {
                _state.value = _state.value.copy(position = event.time, playing = event.state == 1)
                maybeHeartbeat(event)
                maybeChallenge()
            }
            "error", "timeout" -> _state.value = _state.value.copy(playerFailed = true, playing = false,
                warning = "This video can't play here. You can still open it in YouTube, but external playback is not verified for rewards.")
        }
    }
    private fun maybeHeartbeat(event: PlayerEvent) {
        val token = _state.value.sessionToken ?: return
        val now = SystemClock.elapsedRealtime()
        if (!foreground || !_state.value.playing || now - lastHeartbeat < 5000) return
        lastHeartbeat = now
        viewModelScope.launch {
            runCatching { repository.call { recordWatchHeartbeat(RecordWatchHeartbeatRequest(token, event.time, videoId)) } }
                .onSuccess { _state.value = _state.value.copy(verifiedSeconds = it.int("verifiedSeconds", default = _state.value.verifiedSeconds)) }
                .onFailure { _state.value = _state.value.copy(warning = it.friendlyMessage()) }
        }
    }
    private fun maybeChallenge() {
        if (challengeIssued || _state.value.verifiedSeconds < 60 || _state.value.challenge != null) return
        challengeIssued = true
        viewModelScope.launch {
            runCatching { repository.call { createAttentionChallenge(buildJsonObject { put("videoId", videoId) }) } }
                .onSuccess { _state.value = _state.value.copy(challenge = AttentionChallenge(it.str("challengeId"), it.str("question"), it.int("ttlSec", default = 120))) }
                .onFailure { challengeIssued = false }
        }
    }
    fun answerChallenge(answer: String) = viewModelScope.launch {
        val challenge = _state.value.challenge ?: return@launch
        _state.value = _state.value.copy(challengeBusy = true)
        runCatching { repository.call { answerAttentionChallenge(challenge.id, AnswerAttentionChallengeRequest(JsonPrimitive(answer.trim()))) } }
            .onSuccess {
                val passed = it.bool("passed"); val voided = it.bool("voided")
                _state.value = _state.value.copy(challenge = null, challengeBusy = false, voided = voided,
                    warning = if (passed) "Attention check passed." else if (voided) "Attention check failed. This session can no longer earn watch rewards." else "Not quite — try again.")
            }.onFailure { _state.value = _state.value.copy(challengeBusy = false, warning = it.friendlyMessage()) }
    }
    fun setCommented(value: Boolean) { _state.value = _state.value.copy(commented = value) }
    fun claim() = viewModelScope.launch {
        val s = _state.value
        if (s.claiming || s.voided) return@launch
        _state.value = s.copy(claiming = true, warning = null)
        runCatching { repository.call { claimWatch(ClaimWatchRequest(videoId, s.position, subscribed = false, commented = s.commented, sessionToken = s.sessionToken)) } }
            .onSuccess {
                repository.invalidate("queue", "member", "credits", "xp", "missions", "quests", "notifications", "activity", "rewards")
                _state.value = _state.value.copy(claiming = false, claim = it,
                    warning = if (it.attentionBlocked) "This session was blocked by the attention check." else it.evidence?.reason)
            }.onFailure { _state.value = _state.value.copy(claiming = false, warning = it.friendlyMessage()) }
    }
    fun retry() = load()
}
