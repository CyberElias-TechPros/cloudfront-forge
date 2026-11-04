package com.creatorloop.app.data

import com.creatorloop.core.networkapi.generated.*
import kotlinx.serialization.json.JsonObject

fun GetCurrentAccountResponse.toMember() = Member(id = id, firebaseUid = firebaseUid.orEmpty(),
    name = displayName ?: name ?: "Creator", email = email.orEmpty(), photoUrl = photoUrl,
    level = level.toInt(), totalXp = totalXp.toInt(), credits = credits.toInt(), streak = streak?.toInt() ?: 0)

fun JsonObject.toMember() = Member(id = str("id"), firebaseUid = str("firebaseUid"),
    name = str("displayName", "name", default = "Creator"), email = str("email"),
    photoUrl = str("photoUrl").ifBlank { null }, level = int("level", default = 1), totalXp = int("totalXp"),
    credits = int("credits"), streak = int("streak"), rank = int("rank"), publicProfile = bool("publicProfile", default = true),
    bio = str("bio"), niche = str("niche"), goals = str("goals"),
    lookingFor = str("collaborationIntent", default = "feedback"), country = str("countryCode"),
    language = str("languageCode"), experience = str("experienceLevel", default = "beginner"))

fun GetWatchQueueResponseItemsItem.toVideo() = VideoItem(id = id, title = title ?: "Untitled video",
    creatorId = creatorId ?: userId.orEmpty(), creatorName = creatorName ?: displayName ?: owner ?: "Creator",
    creatorAvatar = avatar ?: photoUrl, youtubeVideoId = youtubeVideoId.orEmpty(), youtubeUrl = youtubeUrl.orEmpty(),
    thumbnailUrl = thumbnailUrl ?: youtubeVideoId?.let { "https://i.ytimg.com/vi/$it/hqdefault.jpg" },
    durationSec = (durationSec ?: durationSeconds ?: 0.0).toInt(), requiredSec = (requiredSec ?: 180.0).toInt(),
    rewardXp = (reward ?: rewardedXp ?: 0.0).toInt(), status = watchStatus ?: status ?: "pending",
    magicWord = magicWord, postedAgo = postedAgo ?: createdAt.orEmpty(),
    watchers = watchers?.toInt() ?: 0, target = target?.toInt() ?: 0, comments = comments?.toInt() ?: 0)

fun ListMySubmissionsResponseItemsItem.toVideo() = VideoItem(id = id, title = title ?: "Untitled video",
    youtubeVideoId = youtubeVideoId.orEmpty(), youtubeUrl = youtubeUrl.orEmpty(),
    thumbnailUrl = thumbnailUrl ?: youtubeVideoId?.let { "https://i.ytimg.com/vi/$it/hqdefault.jpg" },
    status = status ?: "active", postedAgo = postedAgo ?: createdAt.orEmpty(),
    watchers = (watchers ?: watcherCount ?: 0.0).toInt(), target = (target ?: watchTarget ?: 0.0).toInt(),
    comments = (comments ?: commentCount ?: 0.0).toInt())

fun ListMyCommunitiesResponseItemsItem.toCommunity() = CommunityItem(id = id, name = name,
    description = description.orEmpty(), isPublic = isPublic ?: false, inviteCode = inviteCode,
    memberCount = memberCount?.toInt() ?: 0, maxMembers = maxMembers?.toInt() ?: 0,
    myRole = myRole, ownerId = ownerId.orEmpty())

fun GetCommunityResponse.toDetail() = CommunityDetail(
    community = CommunityItem(id = community.id, name = community.name, description = community.description.orEmpty(),
        isPublic = community.isPublic ?: false, inviteCode = community.inviteCode, memberCount = memberCount?.toInt() ?: 0,
        maxMembers = community.maxMembers?.toInt() ?: 0, myRole = myRole ?: role ?: community.myRole, ownerId = community.ownerId.orEmpty(), rules = rules.orEmpty()),
    members = members.orEmpty().map { MemberBrief(it.userId ?: it.id, it.displayName ?: "Creator", it.photoUrl, it.role ?: "member") },
    requireApproval = settings?.bool("requireApproval") ?: false,
    allowPeerReview = settings?.bool("allowPeerReview", default = true) ?: true,
    allowCollaboration = settings?.bool("allowCollaboration", default = true) ?: true)

fun ListMissionsResponseItemsItem.toMission() = MissionItem(id = id, title = title, description = description.orEmpty(),
    difficulty = difficulty ?: "medium", xp = xpReward?.toInt() ?: 0, credits = creditReward?.toInt() ?: 0,
    minutes = timeEstimateMinutes?.toInt() ?: 0, chainId = chainId, chainStep = chainStep?.toInt())

fun ListDailyQuestsResponseItemsItem.toQuest() = QuestItem(id = id, type = questType ?: title.orEmpty(),
    progress = progress?.toInt() ?: 0, target = (targetCount ?: target ?: 1.0).toInt(),
    xp = (rewardXp ?: xpReward ?: 0.0).toInt(), credits = (rewardCredits ?: creditReward ?: 0.0).toInt(),
    status = if (completed == true || status == "claimed") "claimed" else if (status == "complete" || (progress ?: 0.0) >= (targetCount ?: target ?: 1.0)) "complete" else "active")

fun ListNotificationsResponseItemsItem.toNotification() = NotificationItem(id, type, title.orEmpty(), message.orEmpty(), isRead ?: false, createdAt.orEmpty())
fun GetActivityResponseItemsItem.toActivity() = NotificationItem(id, type, title ?: what ?: "Activity", message.orEmpty(), true, createdAt ?: `when`.orEmpty())
fun ListShopItemsResponseItemsItem.toShopItem() = ShopItem(id, name, description.orEmpty(), cost.toInt())
fun GetCreditBalanceResponseTransactionsItem.toTx() = CreditTx(id, amount?.toInt() ?: 0, type.orEmpty(), description.orEmpty(), balanceAfter?.toInt(), createdAt.orEmpty())
fun ListBadgesResponseItem.toBadge() = BadgeItem(id, name.orEmpty(), description.orEmpty(), earnedAt)
fun ListMySupportRequestsResponseItemsItem.toTicket() = SupportTicket(id, topic.orEmpty(), message.orEmpty(), status.orEmpty(), createdAt.orEmpty(), resolvedAt)
fun ListMyReportsResponseItemsItem.toReport() = ReportItem(id, reason.orEmpty(), resourceType.orEmpty(), resourceId.orEmpty(), status.orEmpty(), resolutionNotes.orEmpty(), appealed ?: false)
fun ListBlockedMembersResponseItemsItem.toBlock() = BlockItem(id, displayName ?: "Creator", createdAt.orEmpty())
fun ListAiConversationsResponseConversationsItem.toConversation() = CoachConversation(id, title ?: "Coach conversation", updatedAt.orEmpty())
fun ListAiMessagesResponseMessagesItem.toMessage() = CoachMessage(id, role, content)
fun ListCreditProductsResponseProductsItem.toPack() = CreditPack(productId, label, credits.toInt())
fun ListPlayPurchasesResponseItemsItem.toPurchase() = PurchaseRecord(orderId, productId, credits.toInt(), status, createdAt)

fun SearchResponse.toResult() = SearchResult(
    communities = communities.map { CommunityItem(it.id, it.name, it.description.orEmpty(), it.isPublic ?: false, memberCount = it.memberCount?.toInt() ?: 0) },
    videos = videos.map { it.toVideo() })

fun JsonObject.toCollaborator() = Collaborator(str("id"), str("displayName", "name", default = "Creator"),
    str("photoUrl").ifBlank { null }, str("niche"), str("experienceLevel", default = "beginner"), str("goals"), str("collaborationIntent", default = "feedback"))

fun JsonObject.toReviewQuestions(): List<ReviewQuestion> = objs("questions").map { ReviewQuestion(it.str("id"), it.str("questionText", "prompt"), it.str("questionType", "type", default = "text")) }
fun JsonObject.toReviewItem(): ReviewItem {
    val review = if (containsKey("review")) obj("review") else this
    return ReviewItem(review.str("id"), review.str("videoId"), review.str("videoTitle", default = "Video review"),
        review.str("submitterId"), review.str("submitterName", default = "Creator"), review.str("status", default = "assigned"),
        review.int("score"), review.str("feedbackText", "feedback"), review.str("dueAt"), toReviewQuestions())
}
