package com.creatorloop.app.ui.screens

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.creatorloop.app.data.*
import com.creatorloop.app.ui.ActionRunner
import com.creatorloop.app.ui.ScreenLoader
import com.creatorloop.core.networkapi.generated.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(private val repository: LoopRepository) : ViewModel() {
    val loader = ScreenLoader(viewModelScope) { repository.home() }
    val state = loader.state
    val actions = ActionRunner(viewModelScope)
    fun refresh() = loader.refresh()
    fun dailyBonus() = actions.run {
        val result = repository.call { claimDailyBonus() }
        repository.invalidate("member", "credits", "xp", "streak", "home", "rewards")
        loader.refresh(); "Daily bonus claimed: +${result.credits.toInt()} credits"
    }
}

@HiltViewModel
class QueueViewModel @Inject constructor(private val repository: LoopRepository) : ViewModel() {
    private val community = MutableStateFlow<String?>(null)
    val filter = community.asStateFlow()
    val loader = ScreenLoader(viewModelScope) { repository.queue(community.value) }
    val state = loader.state
    val communities = ScreenLoader(viewModelScope) { repository.communities() }
    fun refresh() { loader.refresh(); communities.refresh() }
    fun setCommunity(id: String?) { community.value = id; loader.refresh() }
}

@HiltViewModel
class SubmitViewModel @Inject constructor(private val repository: LoopRepository, private val savedState: SavedStateHandle) : ViewModel() {
    val url = savedState.getStateFlow("url", "")
    val title = savedState.getStateFlow("title", "")
    val niche = savedState.getStateFlow("niche", "")
    val magicWord = savedState.getStateFlow("magicWord", "")
    val communityId = savedState.getStateFlow("communityId", "")
    val communities = ScreenLoader(viewModelScope) { repository.communities() }
    val actions = ActionRunner(viewModelScope)
    init { savedState.get<String>("initialUrl")?.let { if (url.value.isBlank()) savedState["url"] = it } }
    fun setUrl(value: String) { savedState["url"] = value }
    fun setTitle(value: String) { savedState["title"] = value }
    fun setNiche(value: String) { savedState["niche"] = value }
    fun setMagicWord(value: String) { savedState["magicWord"] = value }
    fun setCommunity(value: String) { savedState["communityId"] = value }
    fun submit() = actions.run {
        val link = url.value.trim()
        if (!Regex("^(https?://)?(www\\.)?(youtube\\.com/(watch\\?v=|shorts/|live/)|youtu\\.be/)[A-Za-z0-9_-]{6,}").containsMatchIn(link))
            throw IllegalArgumentException("Paste a valid YouTube video link")
        repository.call { submitVideo(SubmitVideoRequest(link, communityId.value.ifBlank { null }, title.value.ifBlank { null }, magicWord.value.ifBlank { null }, niche.value.ifBlank { null })) }
        repository.invalidate("submissions", "queue", "missions", "quests", "member")
        setUrl(""); setTitle(""); setMagicWord(""); loaderRefresh(); "Video submitted to the fair queue"
    }
    private fun loaderRefresh() { communities.refresh() }
}

@HiltViewModel
class CommunitiesViewModel @Inject constructor(private val repository: LoopRepository) : ViewModel() {
    val loader = ScreenLoader(viewModelScope) { repository.communities() }
    val state = loader.state
    val actions = ActionRunner(viewModelScope)
    fun refresh() = loader.refresh()
    fun create(name: String, description: String, public: Boolean, maxMembers: Int) = actions.run {
        if (name.isBlank()) throw IllegalArgumentException("Give your squad a name")
        val result = repository.call { createCommunity(CreateCommunityRequest(name.trim(), description.trim(), public, maxMembers.toDouble())) }
        repository.invalidate("communities"); loader.refresh(); "Squad created. Invite code: ${result.inviteCode.orEmpty()}"
    }
    fun join(code: String) = actions.run {
        if (code.isBlank()) throw IllegalArgumentException("Enter an invite code")
        val result = repository.call { joinCommunityByCode(JoinCommunityByCodeRequest(code.trim())) }
        repository.invalidate("communities"); loader.refresh(); if (result.status == "pending") "Join request sent for approval" else "Joined the squad"
    }
}

@HiltViewModel
class CommunityDetailViewModel @Inject constructor(private val repository: LoopRepository, savedState: SavedStateHandle) : ViewModel() {
    private val id: String = savedState["communityId"] ?: ""
    val loader = ScreenLoader(viewModelScope) { repository.community(id) }
    val state = loader.state
    val requests = ScreenLoader(viewModelScope) { repository.joinRequests(id) }
    val actions = ActionRunner(viewModelScope)
    fun refresh() { loader.refresh(); requests.refresh() }
    fun leave() = actions.run { repository.call { leaveCommunity(id) }; repository.invalidate("communities", "community:$id"); "Left the squad" }
    fun requestJoin(message: String) = actions.run { repository.call { requestToJoinCommunity(id, RequestToJoinCommunityRequest(message.ifBlank { null })) }; repository.invalidate("community:$id"); loader.refresh(); "Join request sent" }
    fun approve(requestId: String) = actions.run { repository.call { approveJoinRequest(id, requestId) }; repository.invalidate("community:$id", "joinRequests:$id"); refresh(); "Member approved" }
    fun reject(requestId: String) = actions.run { repository.call { rejectJoinRequest(id, requestId) }; refresh(); "Request rejected" }
    fun role(userId: String, role: String) = actions.run { repository.call { setMemberRole(id, userId, SetMemberRoleRequest(role)) }; refresh(); "Role updated" }
    fun remove(userId: String) = actions.run { repository.call { removeMember(id, userId) }; refresh(); "Member removed" }
    fun regenerateInvite() = actions.run { repository.call { regenerateInviteCode(id) }; refresh(); "Invite code regenerated" }
    fun settings(requireApproval: Boolean, peerReview: Boolean, collaboration: Boolean) = actions.run {
        repository.call { updateCommunitySettings(id, UpdateCommunitySettingsRequest(peerReview, collaboration, requireApproval)) }
        repository.invalidate("community:$id"); refresh(); "Squad settings saved"
    }
    fun archive() = actions.run { repository.call { archiveCommunity(id) }; repository.invalidate("communities"); "Squad archived" }
}

@HiltViewModel
class MissionsViewModel @Inject constructor(private val repository: LoopRepository) : ViewModel() {
    val loader = ScreenLoader(viewModelScope) { repository.missions() }
    val state = loader.state
    val quests = ScreenLoader(viewModelScope) { repository.quests() }
    val actions = ActionRunner(viewModelScope)
    fun refresh() { loader.refresh(); quests.refresh() }
    fun accept(missionId: String) = actions.run { repository.call { assignMission(missionId) }; repository.invalidate("missions", "assignments"); refresh(); "Mission accepted" }
    fun complete(assignmentId: String, proof: String) = actions.run {
        repository.call { completeMissionAssignment(assignmentId, CompleteMissionAssignmentRequest(proof.ifBlank { null })) }
        repository.invalidate("missions", "assignments", "credits", "xp", "member", "quests"); refresh(); "Mission completed — rewards are verified server-side"
    }
    fun skip(assignmentId: String) = actions.run { repository.call { skipMissionAssignment(assignmentId) }; repository.invalidate("missions", "assignments"); refresh(); "Mission skipped" }

}

@HiltViewModel
class ReviewsViewModel @Inject constructor(private val repository: LoopRepository) : ViewModel() {
    private val status = MutableStateFlow<String?>(null)
    val filter = status.asStateFlow()
    val loader = ScreenLoader(viewModelScope) { repository.reviews(status.value) }
    val state = loader.state
    val actions = ActionRunner(viewModelScope)
    fun refresh() = loader.refresh()
    fun setStatus(value: String?) { status.value = value; loader.refresh() }
    fun start(reviewId: String, onStarted: () -> Unit) = actions.run { repository.call { startReview(reviewId) }; repository.invalidate("reviews", "review:$reviewId"); onStarted(); "Review started" }
}

@HiltViewModel
class ReviewDetailViewModel @Inject constructor(private val repository: LoopRepository, savedState: SavedStateHandle) : ViewModel() {
    private val id: String = savedState["reviewId"] ?: ""
    val loader = ScreenLoader(viewModelScope) { repository.review(id) }
    val state = loader.state
    val actions = ActionRunner(viewModelScope)
    fun refresh() = loader.refresh()
    fun save(answers: List<SaveReviewAnswersRequestAnswersItem>) = actions.run {
        repository.call { saveReviewAnswers(id, SaveReviewAnswersRequest(answers)) }; repository.invalidate("review:$id", "reviews"); "Draft saved"
    }
    fun complete(score: Int, feedback: String, answers: List<CompleteReviewRequestAnswersItem>, onDone: () -> Unit) = actions.run {
        if (feedback.trim().length < 20) throw IllegalArgumentException("Write at least 20 characters of specific, constructive feedback")
        repository.call { completeReview(id, CompleteReviewRequest(score.toDouble(), feedback.trim(), answers)) }
        repository.invalidate("reviews", "review:$id", "credits", "xp", "member", "quests", "missions"); onDone(); "Review submitted. Thank you for thoughtful feedback."
    }
}
