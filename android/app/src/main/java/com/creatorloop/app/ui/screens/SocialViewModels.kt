package com.creatorloop.app.ui.screens

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.creatorloop.app.billing.BillingManager
import com.creatorloop.app.data.*
import com.creatorloop.app.push.SyncScheduler
import com.creatorloop.app.ui.ActionRunner
import com.creatorloop.app.ui.ScreenLoader
import com.creatorloop.core.networkapi.generated.*
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.JsonObject
import javax.inject.Inject
import android.content.Context

@HiltViewModel
class RewardsViewModel @Inject constructor(private val repository: LoopRepository, val billing: BillingManager) : ViewModel() {
    val loader = ScreenLoader(viewModelScope) { repository.rewards() }
    val state = loader.state
    val purchases = ScreenLoader(viewModelScope) { repository.purchases() }
    val submissions = ScreenLoader(viewModelScope) { repository.submissions() }
    val actions = ActionRunner(viewModelScope)
    init { viewModelScope.launch { billing.refresh() } }
    fun refresh() { loader.refresh(); purchases.refresh(); submissions.refresh(); viewModelScope.launch { billing.refresh() } }
    fun buy(item: ShopItem, videoId: String?) = actions.run {
        if (item.id == "boost" && videoId.isNullOrBlank()) throw IllegalArgumentException("Choose one of your active videos to boost")
        repository.call { purchaseShopItem(PurchaseShopItemRequest(item.id, videoId)) }
        repository.invalidate("credits", "shop", "rewards", "submissions", "queue", "member"); refresh(); "Purchase complete"
    }
    fun restore() = actions.run { billing.restore(); purchases.refresh(); "Receipts checked. Pending purchases stay pending until Google confirms payment." }
}

@HiltViewModel
class LeaderboardViewModel @Inject constructor(private val repository: LoopRepository) : ViewModel() {
    private val timeframe = MutableStateFlow("all_time")
    private val cohort = MutableStateFlow<String?>(null)
    val selected = timeframe.asStateFlow()
    val loader = ScreenLoader(viewModelScope) { repository.leaderboard(timeframe.value, cohort.value) }
    val state = loader.state
    fun refresh() = loader.refresh()
    fun setTimeframe(value: String) { timeframe.value = value; loader.refresh() }
    fun setCohort(value: String?) { cohort.value = value; loader.refresh() }
}

@HiltViewModel
class ProfileViewModel @Inject constructor(private val repository: LoopRepository) : ViewModel() {
    val loader = ScreenLoader(viewModelScope) { repository.profile() }
    val state = loader.state
    val insights = ScreenLoader(viewModelScope) { repository.insights() }
    val submissions = ScreenLoader(viewModelScope) { repository.submissions() }
    val actions = ActionRunner(viewModelScope)
    fun refresh() { loader.refresh(); insights.refresh(); submissions.refresh() }
    fun save(member: Member) = actions.run {
        repository.call { updateMyProfile(UpdateMyProfileRequest(member.name, member.bio, member.country, member.language,
            member.experience, member.niche, null, member.goals, member.lookingFor, member.publicProfile)) }
        repository.invalidate("profile", "member"); loader.refresh(); "Profile saved"
    }
    fun archive(videoId: String) = actions.run { repository.call { archiveVideo(videoId) }; repository.invalidate("submissions", "queue"); submissions.refresh(); "Video archived" }
    fun deleteAccount(onDone: () -> Unit) = actions.run { repository.call { deleteMyAccount() }; repository.clearLocal(); onDone(); "Account deletion requested" }
}

@HiltViewModel
class MemberViewModel @Inject constructor(private val repository: LoopRepository, savedState: SavedStateHandle) : ViewModel() {
    private val id: String = savedState["memberId"] ?: ""
    val loader = ScreenLoader(viewModelScope) { repository.cached("member:$id") { getMemberById(id) }.map { it.toMember() } }
    val state = loader.state
    val actions = ActionRunner(viewModelScope)
    fun refresh() = loader.refresh()
    fun block() = actions.run { repository.call { blockMember(BlockMemberRequest(id)) }; repository.invalidate("blocks", "queue", "search", "collaborators", "communities"); "Member blocked" }
    fun report(reason: String, description: String) = actions.run {
        repository.call { createReport(CreateReportRequest("user", id, reason, id, description.ifBlank { null })) }
        repository.invalidate("reports"); "Report sent to moderators"
    }
}

@HiltViewModel
class NotificationsViewModel @Inject constructor(private val repository: LoopRepository, @ApplicationContext private val context: Context) : ViewModel() {
    val loader = ScreenLoader(viewModelScope) { repository.notifications() }
    val state = loader.state
    val actions = ActionRunner(viewModelScope)
    fun refresh() = loader.refresh()
    fun read(id: String) = actions.run { repository.queueNotificationRead(id); SyncScheduler.schedule(context); loader.refresh(); null }
    fun delete(id: String) = actions.run { repository.queueNotificationDelete(id); SyncScheduler.schedule(context); loader.refresh(); null }
    fun readAll() = actions.run { repository.call { markAllNotificationsRead() }; repository.invalidate("notifications"); loader.refresh(); "All notifications marked read" }
}

@HiltViewModel
class SearchViewModel @Inject constructor(private val repository: LoopRepository) : ViewModel() {
    private val query = MutableStateFlow("")
    val text = query.asStateFlow()
    val loader = ScreenLoader(viewModelScope) { if (query.value.isBlank()) Resource(SearchResult(emptyList(), emptyList())) else repository.search(query.value) }
    val state = loader.state
    val collaborators = ScreenLoader(viewModelScope) { repository.collaborators() }
    private var job: kotlinx.coroutines.Job? = null
    fun setQuery(value: String) {
        query.value = value; job?.cancel()
        job = viewModelScope.launch { kotlinx.coroutines.delay(350); loader.refresh() }
    }
    fun refresh() { loader.refresh(); collaborators.refresh() }
}

@HiltViewModel
class InsightsViewModel @Inject constructor(private val repository: LoopRepository) : ViewModel() {
    val loader = ScreenLoader(viewModelScope) { repository.insights() }
    val state = loader.state
    fun refresh() = loader.refresh()
}

@HiltViewModel
class SafetyViewModel @Inject constructor(private val repository: LoopRepository) : ViewModel() {
    val blocks = ScreenLoader(viewModelScope) { repository.blocks() }
    val reports = ScreenLoader(viewModelScope) { repository.reports() }
    val actions = ActionRunner(viewModelScope)
    fun refresh() { blocks.refresh(); reports.refresh() }
    fun unblock(id: String) = actions.run { repository.call { unblockMember(id) }; repository.invalidate("blocks", "queue", "search", "collaborators"); refresh(); "Member unblocked" }
    fun appeal(reportId: String, reason: String) = actions.run {
        if (reason.isBlank()) throw IllegalArgumentException("Explain why you are appealing")
        repository.call { appealReport(reportId, AppealReportRequest(reason.trim())) }; repository.invalidate("reports"); refresh(); "Appeal submitted"
    }
}

@HiltViewModel
class SupportViewModel @Inject constructor(private val repository: LoopRepository) : ViewModel() {
    val loader = ScreenLoader(viewModelScope) { repository.supportTickets() }
    val state = loader.state
    val actions = ActionRunner(viewModelScope)
    fun refresh() = loader.refresh()
    fun create(topic: String, message: String) = actions.run {
        if (message.trim().length < 10) throw IllegalArgumentException("Please describe the issue in at least 10 characters")
        repository.call { createSupportRequest(CreateSupportRequestRequest(topic, message.trim())) }
        repository.invalidate("support"); loader.refresh(); "Support request sent"
    }
}
