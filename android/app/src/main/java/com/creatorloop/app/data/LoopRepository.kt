package com.creatorloop.app.data

import com.creatorloop.core.networkapi.generated.*
import kotlinx.coroutines.*
import kotlinx.serialization.KSerializer
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.serializer
import kotlinx.serialization.json.*
import retrofit2.Response
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Single source of truth for reads/writes. Reads fall back to UID-scoped Room snapshots.
 * Only notification read/delete mutations are queued offline; rewards, purchases, submissions,
 * moderation and community membership are never blind-replayed.
 */
@Singleton
class LoopRepository @Inject constructor(
    @PublishedApi internal val api: LoopApi,
    @PublishedApi internal val cache: CacheDao,
    @PublishedApi internal val session: SessionManager,
    @PublishedApi internal val json: Json,
) {
    fun owner(): String = session.uid ?: throw ApiException("AUTH_REQUIRED", "Please sign in again", 401)

    suspend inline fun <reified T> call(crossinline block: suspend LoopApi.() -> Response<ApiEnvelope<T>>): T {
        val response = api.block()
        if (!response.isSuccessful) {
            val raw = runCatching { response.errorBody()?.string() }.getOrNull().orEmpty()
            val envelope = runCatching { json.decodeFromString<ApiEnvelope<JsonElement>>(raw) }.getOrNull()
            throw ApiException(envelope?.error?.code ?: "HTTP_${response.code()}",
                envelope?.error?.message ?: "Request failed (${response.code()})", response.code(),
                envelope?.meta?.requestId, response.headers()["Retry-After"]?.toIntOrNull())
        }
        val body = response.body() ?: throw ApiException("EMPTY_RESPONSE", "The service returned an empty response", response.code())
        if (!body.success) throw ApiException(body.error?.code ?: "UNKNOWN", body.error?.message ?: "Request failed", response.code(), body.meta?.requestId)
        return body.data ?: throw ApiException("EMPTY_RESPONSE", "The service returned no data", response.code())
    }

    suspend fun <T> readCache(key: String, serializer: KSerializer<T>): Pair<T, Long>? {
        val row = cache.snapshot(owner(), key) ?: return null
        return runCatching { json.decodeFromString(serializer, row.payload) to row.savedAt }.getOrNull()
    }
    suspend fun <T> writeCache(key: String, serializer: KSerializer<T>, value: T) {
        cache.putSnapshot(SnapshotEntity(owner(), key, json.encodeToString(serializer, value), System.currentTimeMillis()))
    }
    suspend inline fun <reified T> cached(key: String, crossinline block: suspend LoopApi.() -> Response<ApiEnvelope<T>>): Resource<T> {
        val serializer = json.serializersModule.serializer<T>()
        val previous = readCache(key, serializer)
        return try {
            val fresh = call(block)
            writeCache(key, serializer, fresh)
            Resource(fresh)
        } catch (error: Exception) {
            if (error is ApiException && (error.requiresSignIn || error.accountBlocked)) throw error
            if (previous != null) Resource(previous.first, true, previous.second, error.friendlyMessage()) else throw error
        }
    }
    suspend fun invalidate(vararg prefixes: String) { prefixes.forEach { cache.invalidate(owner(), it) } }
    suspend fun clearLocal() { cache.clearOwner(owner()); cache.clearOutbox(owner()) }
    fun pendingCount() = cache.pendingCount(owner())

    suspend fun config(): MobileConfig = call { getMobileConfig() }.let {
        MobileConfig(it.maintenance, it.minAndroidVersionCode.toInt(), it.watchSessionsEnabled, it.billingEnabled,
            it.pushEnabled, it.coachEnabled, it.youtubeEnabled, it.policyVersion)
    }
    suspend fun member(): Resource<Member> = cached("member") { getCurrentAccount() }.map { it.toMember() }
    suspend fun profile(): Resource<Member> = cached("profile") { getMyProfile() }.map { it.toMember() }
    suspend fun queue(communityId: String? = null, limit: Int = 50, offset: Int = 0): Resource<List<VideoItem>> =
        cached("queue:${communityId.orEmpty()}:$limit:$offset") { getWatchQueue(communityId, limit, offset) }.map { it.items.map { item -> item.toVideo() } }
    suspend fun submissions(): Resource<List<VideoItem>> = cached("submissions") { listMySubmissions() }.map { it.items.map { item -> item.toVideo() } }
    suspend fun communities(): Resource<List<CommunityItem>> = cached("communities") { listMyCommunities(100, 0) }.map { it.items.map { item -> item.toCommunity() } }
    suspend fun community(id: String): Resource<CommunityDetail> = cached("community:$id") { getCommunity(id) }.map { it.toDetail() }
    suspend fun joinRequests(id: String): Resource<List<JoinRequest>> = cached("joinRequests:$id") { listJoinRequests(id) }.map {
        it.items.map { r -> JoinRequest(r.id, r.userId ?: r.id, r.displayName ?: "Creator", r.message.orEmpty()) }
    }
    suspend fun missions(): Resource<List<MissionItem>> {
        val catalog = cached("missions") { listMissions(page = 1, pageSize = 100) }
        val assignments = runCatching { cached("assignments") { listMissionAssignments() } }.getOrNull()
        val assigned = assignments?.data?.objs("items", "assignments").orEmpty().associateBy { it.str("missionId") }
        return catalog.map { list -> list.items.map { m ->
            val a = assigned[m.id]
            m.toMission().copy(status = a?.str("status") ?: "available", assignmentId = a?.str("id"))
        } }
    }
    suspend fun quests(): Resource<List<QuestItem>> = cached("quests") { listDailyQuests() }.map { it.items.map { item -> item.toQuest() } }
    suspend fun notifications(): Resource<List<NotificationItem>> = cached("notifications") { listNotifications(100, null) }.map { it.items.map { item -> item.toNotification() } }
    suspend fun reviews(status: String? = null): Resource<List<ReviewItem>> = cached("reviews:${status.orEmpty()}") { listReviews(status, null, 100, 0) }
        .map { it.objs("items", "reviews").map { item -> item.toReviewItem() } }
    suspend fun review(id: String): Resource<ReviewItem> = cached("review:$id") { getReview(id) }.map { it.toReviewItem() }
    suspend fun leaderboard(timeframe: String = "all_time", cohort: String? = null): Resource<List<LeaderEntry>> =
        cached("leaderboard:$timeframe:${cohort.orEmpty()}") { getLeaderboard(timeframe, cohort, 100, 0) }.map {
            it.items.mapIndexed { index, e -> LeaderEntry(e.id, e.displayName ?: "Creator", e.photoUrl, (e.totalXp ?: 0.0).toInt(),
                (e.credits ?: 0.0).toInt(), (e.reputation ?: 0.0).toInt(), (e.weightedScore ?: 0.0).toInt(), (e.rank ?: (index + 1).toDouble()).toInt()) }
        }
    suspend fun search(query: String): Resource<SearchResult> = cached("search:$query") { search(query) }.map { it.toResult() }
    suspend fun collaborators(intent: String? = null): Resource<List<Collaborator>> = cached("collaborators:${intent.orEmpty()}") { listCollaborators(intent, 50) }
        .map { it.items.mapNotNull { item -> (item as? JsonObject)?.toCollaborator() } }
    suspend fun insights(): Resource<Insights> = cached("insights") { getMyInsights() }.map { json ->
        val totals = json.obj("totals")
        val trend = json.objs("dailyTrend", "trend").map { it.str("date", "day") to it.int("watches", "count", "value") }
        Insights(totals.int("videos"), totals.int("watches", "totalWatches"), totals.int("comments", "totalComments"),
            totals.int("watchMinutes", "totalWatchMinutes"), totals.num("averageScore", "avgScore"), trend)
    }
    suspend fun supportTickets(): Resource<List<SupportTicket>> = cached("support") { listMySupportRequests() }.map { it.items.map { item -> item.toTicket() } }
    suspend fun reports(): Resource<List<ReportItem>> = cached("reports") { listMyReports() }.map { it.items.map { item -> item.toReport() } }
    suspend fun blocks(): Resource<List<BlockItem>> = cached("blocks") { listBlockedMembers() }.map { it.items.map { item -> item.toBlock() } }
    suspend fun conversations(): Resource<List<CoachConversation>> = cached("coach") { listAiConversations() }.map { it.conversations.map { item -> item.toConversation() } }
    suspend fun messages(id: String): Resource<List<CoachMessage>> = cached("coach:$id") { listAiMessages(id) }.map { it.messages.map { item -> item.toMessage() } }
    suspend fun creditPacks(): List<CreditPack> = call { listCreditProducts() }.products.map { it.toPack() }
    suspend fun purchases(): Resource<List<PurchaseRecord>> = cached("purchases") { listPlayPurchases() }.map { it.items.map { item -> item.toPurchase() } }

    suspend fun rewards(): Resource<RewardsData> = coroutineScope {
        val credits = async { cached("credits") { getCreditBalance() } }
        val xp = async { cached("xp") { getXpProgress() } }
        val streak = async { cached("streak") { getStreaks() } }
        val reputation = async { cached("reputation") { getReputation() } }
        val badges = async { cached("badges") { listBadges() } }
        val shop = async { cached("shop") { listShopItems() } }
        val c = credits.await(); val x = xp.await(); val s = streak.await(); val r = reputation.await(); val b = badges.await(); val sh = shop.await()
        val all = listOf(c, x, s, r, b, sh)
        Resource(RewardsData(c.data.balance.toInt(), (c.data.totalEarned ?: 0.0).toInt(), (c.data.totalSpent ?: 0.0).toInt(),
            c.data.transactions.map { it.toTx() }, x.data.totalXp.toInt(), x.data.currentLevel.toInt(), x.data.xpToNextLevel.toInt(),
            s.data.currentStreak.toInt(), s.data.longestStreak.toInt(), r.data.score.toInt(), b.data.map { it.toBadge() },
            sh.data.items.map { it.toShopItem() }), all.any { it.stale }, all.minOf { it.savedAt }, all.firstNotNullOfOrNull { it.warning })
    }
    suspend fun home(): Resource<HomeData> = coroutineScope {
        val member = async { member() }
        val xp = async { runCatching { cached("xp") { getXpProgress() } }.getOrNull() }
        val quests = async { runCatching { quests() }.getOrNull() }
        val queue = async { runCatching { queue(limit = 5) }.getOrNull() }
        val activity = async { runCatching { cached("activity") { getActivity(10, 0) } }.getOrNull() }
        val submissions = async { runCatching { submissions() }.getOrNull() }
        val communities = async { runCatching { communities() }.getOrNull() }
        val m = member.await(); val x = xp.await(); val q = quests.await(); val qu = queue.await(); val a = activity.await(); val su = submissions.await(); val co = communities.await()
        val resources = listOfNotNull(x, q, qu, a, su, co)
        Resource(HomeData(m.data, x?.data?.totalXp?.toInt() ?: m.data.totalXp, x?.data?.xpToNextLevel?.toInt() ?: 0,
            x?.data?.currentLevel?.toInt() ?: m.data.level, m.data.credits, m.data.streak,
            q?.data.orEmpty(), qu?.data.orEmpty(), a?.data?.items?.map { it.toActivity() }.orEmpty(),
            su?.data.orEmpty(), co?.data?.size ?: 0), m.stale || resources.any { it.stale },
            minOf(m.savedAt, resources.minOfOrNull { it.savedAt } ?: m.savedAt),
            resources.firstNotNullOfOrNull { it.warning })
    }

    /** Safe idempotent notification mutations only. */
    suspend fun queueNotificationRead(id: String) {
        try { call { markNotificationRead(id) }; invalidate("notifications") }
        catch (e: Exception) { if (e is ApiException && e.status in 400..499) throw e
            cache.enqueue(OutboxEntity(UUID.randomUUID().toString(), owner(), "notification_read", id, System.currentTimeMillis())) }
    }
    suspend fun queueNotificationDelete(id: String) {
        try { call { deleteNotification(id) }; invalidate("notifications") }
        catch (e: Exception) { if (e is ApiException && e.status in 400..499) throw e
            cache.enqueue(OutboxEntity(UUID.randomUUID().toString(), owner(), "notification_delete", id, System.currentTimeMillis())) }
    }
}
