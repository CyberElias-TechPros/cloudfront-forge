package com.creatorloop.app.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.creatorloop.app.BuildConfig
import com.creatorloop.app.data.*
import com.creatorloop.app.ui.ActionRunner
import com.creatorloop.app.ui.ScreenLoader
import com.creatorloop.core.networkapi.generated.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.*
import kotlinx.serialization.decodeFromString
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject

data class SettingsData(val prefs: JsonObject, val permissions: JsonObject, val youtubeConnected: Boolean, val channelId: String?)

@HiltViewModel
class SettingsViewModel @Inject constructor(private val repository: LoopRepository) : ViewModel() {
    val loader = ScreenLoader(viewModelScope) {
        val prefs = repository.cached("settings:prefs") { getNotificationPreferences() }.data
        val permissions = runCatching { repository.call { getPermissions() } }.getOrDefault(JsonObject(emptyMap()))
        val youtube = runCatching { repository.call { getYouTubeStatus() } }.getOrNull()
        Resource(SettingsData(prefs, permissions, youtube?.connected ?: false, youtube?.channelId))
    }
    val state = loader.state
    val actions = ActionRunner(viewModelScope)
    private val _youtubeUrl = MutableStateFlow<String?>(null)
    val youtubeUrl = _youtubeUrl.asStateFlow()
    fun refresh() = loader.refresh()
    fun consumeYoutubeUrl() { _youtubeUrl.value = null }
    fun savePrefs(request: UpdateNotificationPreferencesRequest) = actions.run {
        repository.call { updateNotificationPreferences(request) }; repository.invalidate("settings:prefs"); loader.refresh(); "Notification preferences saved"
    }
    fun connectYouTube() = actions.run {
        if (!repository.config().youtubeEnabled) throw IllegalStateException("YouTube connection is not enabled in this environment")
        _youtubeUrl.value = repository.call { startYoutubeAuthorization("android") }.authUrl
        "Opening Google authorization…"
    }
    fun disconnectYouTube() = actions.run { repository.call { disconnectYouTube() }; loader.refresh(); "YouTube disconnected" }
    fun isAdmin(): Boolean = state.value.data?.permissions?.let { p ->
        p.str("platformRole") in setOf("admin", "moderator") || p.bool("isAdmin") || p.bool("isModerator")
    } ?: false
}

data class AdminData(val metrics: AdminMetrics, val analytics: AdminAnalytics,
                     val reports: List<ListReportsForModerationResponseItem>, val users: List<ListAdminUsersResponseItem>,
                     val support: List<ListSupportRequestsResponseItemsItem>, val appeals: List<ListAppealsResponseItemsItem>,
                     val topups: List<JsonObject>, val communities: List<ListAdminCommunitiesResponseItemsItem>)

@HiltViewModel
class AdminViewModel @Inject constructor(private val repository: LoopRepository) : ViewModel() {
    val loader = ScreenLoader(viewModelScope) {
        coroutineScope {
            val metrics = async { repository.call { getPlatformMetrics() } }
            val analytics = async { repository.call { getAnalytics(14) } }
            val reports = async { repository.call { listReportsForModeration("pending") } }
            val users = async { repository.call { listAdminUsers(null, 100, 0) } }
            val support = async { repository.call { listSupportRequests("open") } }
            val appeals = async { repository.call { listAppeals("pending") } }
            val topups = async { runCatching { repository.call { adminListTopups() } }.getOrDefault(JsonObject(emptyMap())) }
            val communities = async { runCatching { repository.call { listAdminCommunities(null, 100, 0) } }.getOrNull() }
            val m = metrics.await(); val a = analytics.await()
            Resource(AdminData(AdminMetrics(m.users.toInt(), m.communities.toInt(), m.videos.toInt(), m.reviews.toInt(), m.pendingReports.toInt()),
                AdminAnalytics(a.totals.submits.toInt(), a.totals.claims.toInt(), a.totals.reviews.toInt(), a.totals.claimRate.toInt(),
                    a.dailyTrend.map { it.day to it.count.toInt() }),
                reports.await(), users.await(), support.await().items, appeals.await().items,
                topups.await().objs("items", "topups"), communities.await()?.items.orEmpty()))
        }
    }
    val state = loader.state
    val actions = ActionRunner(viewModelScope)
    fun refresh() = loader.refresh()
    fun resolveReport(id: String, status: String, notes: String) = actions.run {
        repository.call { resolveReport(id, ResolveReportRequest(status, notes.ifBlank { null })) }; loader.refresh(); "Report $status"
    }
    fun suspend(userId: String, reason: String) = actions.run { repository.call { suspendMember(userId, SuspendMemberRequest(reason.ifBlank { null })) }; loader.refresh(); "Member suspended" }
    fun reinstate(userId: String) = actions.run { repository.call { reinstateMember(userId) }; loader.refresh(); "Member reinstated" }
    fun role(userId: String, role: String) = actions.run { repository.call { setPlatformRole(userId, SetPlatformRoleRequest(role)) }; loader.refresh(); "Role updated" }
    fun resolveSupport(id: String) = actions.run { repository.call { resolveSupportRequest(id) }; loader.refresh(); "Support request resolved" }
    fun reviewAppeal(id: String, status: String, note: String) = actions.run { repository.call { reviewAppeal(id, ReviewAppealRequest(status, note.ifBlank { null })) }; loader.refresh(); "Appeal $status" }
    fun approveTopup(id: String) = actions.run { repository.call { approveTopup(id) }; loader.refresh(); "Top-up approved" }
    fun rejectTopup(id: String, reason: String) = actions.run { repository.call { rejectTopup(id, RejectTopupRequest(reason.ifBlank { null })) }; loader.refresh(); "Top-up rejected" }
    fun restoreVideo(id: String) = actions.run { repository.call { restoreVideo(id) }; loader.refresh(); "Video restored" }
}

data class CoachUiState(val messages: List<CoachMessage> = emptyList(), val streaming: Boolean = false,
                        val error: String? = null, val conversationId: String? = null)

@HiltViewModel
class CoachViewModel @Inject constructor(private val repository: LoopRepository, private val http: OkHttpClient,
                                         private val session: SessionManager, private val json: Json) : ViewModel() {
    val conversations = ScreenLoader(viewModelScope) { repository.conversations() }
    private val _state = MutableStateFlow(CoachUiState())
    val state = _state.asStateFlow()
    private var job: Job? = null
    private var httpCall: Call? = null
    fun refresh() = conversations.refresh()
    fun openConversation(id: String) = viewModelScope.launch {
        _state.value = CoachUiState(conversationId = id)
        runCatching { repository.messages(id).data }.onSuccess { messages -> _state.value = _state.value.copy(messages = messages) }
            .onFailure { _state.value = _state.value.copy(error = it.friendlyMessage()) }
    }
    fun newConversation() { job?.cancel(); httpCall?.cancel(); _state.value = CoachUiState() }
    fun deleteConversation(id: String) = viewModelScope.launch {
        runCatching { repository.call { deleteAiConversation(id) } }
        repository.invalidate("coach"); conversations.refresh()
        if (_state.value.conversationId == id) newConversation()
    }
    fun send(text: String) {
        val message = text.trim()
        if (message.isEmpty() || _state.value.streaming) return
        val userMessage = CoachMessage("local-user-${System.currentTimeMillis()}", "user", message)
        val assistant = CoachMessage("local-assistant", "assistant", "")
        _state.value = _state.value.copy(messages = _state.value.messages + userMessage + assistant, streaming = true, error = null)
        job = viewModelScope.launch(Dispatchers.IO) {
            try {
                val token = session.token() ?: throw ApiException("AUTH_REQUIRED", "Please sign in again", 401)
                val payload = json.encodeToString(StreamChatWithCoachRequest.serializer(), StreamChatWithCoachRequest(message, _state.value.conversationId))
                val request = Request.Builder().url(BuildConfig.API_BASE_URL.trimEnd('/') + "/api/v1/ai/chat/stream")
                    .header("Authorization", "Bearer $token").header("Accept", "text/event-stream")
                    .post(payload.toRequestBody("application/json".toMediaType())).build()
                val networkCall = http.newCall(request)
                httpCall = networkCall
                networkCall.execute().use { response ->
                    if (!response.isSuccessful) {
                        val raw = response.body?.string().orEmpty()
                        val error = runCatching { json.decodeFromString<ApiEnvelope<JsonElement>>(raw).error?.message }.getOrNull()
                        throw ApiException("AI_UNAVAILABLE", error ?: "Coach is unavailable (${response.code})", response.code)
                    }
                    val source = response.body?.source() ?: throw ApiException("AI_UNAVAILABLE", "Empty coach response")
                    while (true) {
                        val line = source.readUtf8Line() ?: break
                        if (!line.startsWith("data:")) continue
                        val data = line.removePrefix("data:").trim()
                        if (data == "[DONE]") break
                        val chunk = runCatching { json.parseToJsonElement(data).jsonObject["content"]?.jsonPrimitive?.contentOrNull }.getOrNull() ?: continue
                        withContext(Dispatchers.Main) {
                            val messages = _state.value.messages.toMutableList()
                            val index = messages.indexOfLast { it.id == "local-assistant" }
                            if (index >= 0) messages[index] = messages[index].copy(content = messages[index].content + chunk)
                            _state.value = _state.value.copy(messages = messages)
                        }
                    }
                }
                withContext(Dispatchers.Main) {
                    _state.value = _state.value.copy(streaming = false)
                    conversations.refresh()
                    if (_state.value.conversationId == null) {
                        runCatching { repository.conversations().data.firstOrNull() }.getOrNull()?.let { _state.value = _state.value.copy(conversationId = it.id) }
                    }
                    repository.invalidate("coach")
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    // Fall back to the non-streaming endpoint when SSE is interrupted by a proxy.
                    runCatching { repository.call { chatWithCoach(ChatWithCoachRequest(message, _state.value.conversationId)) } }
                        .onSuccess { result ->
                            val messages = _state.value.messages.dropLast(1) + CoachMessage("assistant-final", "assistant", result.reply)
                            _state.value = _state.value.copy(messages = messages, streaming = false, conversationId = result.conversation.id)
                            conversations.refresh()
                        }.onFailure {
                            _state.value = _state.value.copy(streaming = false, error = e.friendlyMessage(),
                                messages = _state.value.messages.dropLast(1))
                        }
                }
            }
        }
    }
    override fun onCleared() { job?.cancel(); httpCall?.cancel(); super.onCleared() }
}
