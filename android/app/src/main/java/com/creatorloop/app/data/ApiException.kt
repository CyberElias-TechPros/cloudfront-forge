package com.creatorloop.app.data

class ApiException(val code: String, override val message: String, val status: Int = 0,
                   val requestId: String? = null, val retryAfterSeconds: Int? = null) : Exception(message) {
    val requiresSignIn: Boolean get() = status == 401 || code == "AUTH_REQUIRED" || code == "AUTH_ERROR"
    val accountBlocked: Boolean get() = code in setOf("ACCOUNT_DELETED", "ACCOUNT_SUSPENDED", "ACCOUNT_BANNED")
}

fun Throwable.friendlyMessage(): String = when (this) {
    is ApiException -> when (code) {
        "RATE_LIMITED", "DAILY_LIMIT", "QUOTA_EXCEEDED" -> "You've reached a limit. Please wait before trying again."
        "INSUFFICIENT_CREDITS" -> "You don't have enough credits for this yet."
        "SUBMISSION_COOLDOWN" -> "Your last submission is still cooling down. Try again later."
        "RATIO_GATE" -> "Watch and review a few more community videos before submitting again."
        "CHANNEL_CONFLICT" -> "This channel is linked to another account. Contact support if this is yours."
        "AI_NOT_CONFIGURED", "AI_UNAVAILABLE" -> "The coach is unavailable right now. Your other features still work."
        "SERVICE_UNAVAILABLE", "NOT_READY", "SCHEMA_OUT_OF_DATE" -> "The service is being updated. Please try again shortly."
        "VALIDATION_ERROR", "BAD_REQUEST" -> message
        "CONFLICT" -> message
        "FORBIDDEN" -> "You don't have permission to do that."
        "AUTH_REQUIRED", "AUTH_ERROR" -> "Please sign in again to continue."
        else -> message.ifBlank { "Something went wrong. Please try again." }
    }
    is java.io.IOException -> "Couldn't reach the service. Check your connection; saved data is still available."
    is IllegalArgumentException -> message ?: "Please check the form and try again."
  is IllegalStateException -> message ?: "This feature is not configured for this build."
    else -> "Something went wrong. Please try again."
}
