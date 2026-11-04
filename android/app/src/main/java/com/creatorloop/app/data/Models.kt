package com.creatorloop.app.data

/** Screen-facing models. Money, permissions and reward decisions never originate here. */
data class Resource<T>(val data: T, val stale: Boolean = false, val savedAt: Long = System.currentTimeMillis(), val warning: String? = null) {
    fun <R> map(transform: (T) -> R): Resource<R> = copy(data = transform(data))
}
data class UiState<T>(val data: T? = null, val loading: Boolean = true, val error: String? = null,
                      val stale: Boolean = false, val savedAt: Long? = null, val busy: Boolean = false, val message: String? = null)
data class Member(val id: String = "", val firebaseUid: String = "", val name: String = "Creator", val email: String = "",
                  val photoUrl: String? = null, val level: Int = 1, val totalXp: Int = 0, val credits: Int = 0,
                  val streak: Int = 0, val rank: Int = 0, val publicProfile: Boolean = true, val bio: String = "",
                  val niche: String = "", val goals: String = "", val lookingFor: String = "feedback",
                  val country: String = "", val language: String = "", val experience: String = "beginner")
data class VideoItem(val id: String, val title: String, val creatorId: String = "", val creatorName: String = "Creator",
                     val creatorAvatar: String? = null, val youtubeVideoId: String = "", val youtubeUrl: String = "",
                     val thumbnailUrl: String? = null, val durationSec: Int = 0, val requiredSec: Int = 180,
                     val rewardXp: Int = 0, val status: String = "pending", val magicWord: String? = null,
                     val postedAgo: String = "", val watchers: Int = 0, val target: Int = 0, val comments: Int = 0)
data class CommunityItem(val id: String, val name: String, val description: String = "", val isPublic: Boolean = false,
                         val inviteCode: String? = null, val memberCount: Int = 0, val maxMembers: Int = 0,
                         val myRole: String? = null, val rules: String = "", val ownerId: String = "")
data class MemberBrief(val id: String, val name: String, val photoUrl: String? = null, val role: String = "member")
data class CommunityDetail(val community: CommunityItem, val members: List<MemberBrief>, val requireApproval: Boolean,
                           val allowPeerReview: Boolean, val allowCollaboration: Boolean)
data class JoinRequest(val id: String, val userId: String, val name: String, val message: String)
data class MissionItem(val id: String, val title: String, val description: String, val difficulty: String,
                       val xp: Int, val credits: Int, val minutes: Int, val status: String = "available",
                       val assignmentId: String? = null, val chainId: String? = null, val chainStep: Int? = null)
data class QuestItem(val id: String, val type: String, val progress: Int, val target: Int, val xp: Int, val credits: Int, val status: String) {
    val title: String get() = when (type) { "watch_videos" -> "Watch thoughtfully"; "give_reviews" -> "Give useful feedback"; "submit_video" -> "Share a video"; else -> type.replace('_', ' ') }
}
data class NotificationItem(val id: String, val type: String, val title: String, val message: String, val isRead: Boolean, val createdAt: String)
data class ReviewQuestion(val id: String, val prompt: String, val type: String)
data class ReviewItem(val id: String, val videoId: String, val videoTitle: String, val submitterId: String,
                      val submitterName: String, val status: String, val score: Int, val feedback: String,
                      val dueAt: String, val questions: List<ReviewQuestion> = emptyList())
data class LeaderEntry(val id: String, val name: String, val photoUrl: String?, val xp: Int, val credits: Int,
                       val reputation: Int, val score: Int, val rank: Int)
data class ShopItem(val id: String, val name: String, val description: String, val cost: Int)
data class CreditTx(val id: String, val amount: Int, val type: String, val description: String, val balanceAfter: Int?, val createdAt: String)
data class BadgeItem(val id: String, val name: String, val description: String, val earnedAt: String?)
data class CreditPack(val productId: String, val label: String, val credits: Int)
data class PurchaseRecord(val orderId: String, val productId: String, val credits: Int, val status: String, val createdAt: String)
data class SupportTicket(val id: String, val topic: String, val message: String, val status: String, val createdAt: String, val resolvedAt: String?)
data class ReportItem(val id: String, val reason: String, val resourceType: String, val resourceId: String,
                      val status: String, val notes: String, val appealed: Boolean, val name: String = "")
data class BlockItem(val id: String, val name: String, val createdAt: String)
data class CoachConversation(val id: String, val title: String, val updatedAt: String)
data class CoachMessage(val id: String, val role: String, val content: String)
data class SearchResult(val communities: List<CommunityItem>, val videos: List<VideoItem>)
data class Collaborator(val id: String, val name: String, val avatar: String?, val niche: String, val experience: String, val goals: String, val intent: String)
data class Insights(val videos: Int, val watches: Int, val comments: Int, val watchMinutes: Int, val averageScore: Double,
                    val trend: List<Pair<String, Int>>)
data class AdminMetrics(val users: Int, val communities: Int, val videos: Int, val reviews: Int, val pendingReports: Int)
data class AdminAnalytics(val submits: Int, val claims: Int, val reviews: Int, val claimRate: Int, val trend: List<Pair<String, Int>>)
data class HomeData(val member: Member, val totalXp: Int, val xpToNext: Int, val level: Int, val credits: Int,
                    val streak: Int, val quests: List<QuestItem>, val queue: List<VideoItem>, val activity: List<NotificationItem>,
                    val submissions: List<VideoItem>, val communityCount: Int)
data class RewardsData(val credits: Int, val totalEarned: Int, val totalSpent: Int, val transactions: List<CreditTx>,
                       val xp: Int, val level: Int, val xpToNext: Int, val streak: Int, val longestStreak: Int,
                       val reputation: Int, val badges: List<BadgeItem>, val shop: List<ShopItem>)
data class MobileConfig(val maintenance: Boolean = false, val minVersionCode: Int = 1, val watchSessionsEnabled: Boolean = false,
                        val billingEnabled: Boolean = false, val pushEnabled: Boolean = false, val coachEnabled: Boolean = false,
                        val youtubeEnabled: Boolean = false, val policyVersion: String = "2026-11-03")
