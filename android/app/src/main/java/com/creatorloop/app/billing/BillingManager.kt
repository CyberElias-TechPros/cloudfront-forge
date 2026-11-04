package com.creatorloop.app.billing

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.*
import com.creatorloop.app.data.CreditPack
import com.creatorloop.app.data.LoopRepository
import com.creatorloop.app.data.friendlyMessage
import com.creatorloop.core.networkapi.generated.ConsumePurchaseRequest
import com.creatorloop.core.networkapi.generated.VerifyPlayPurchaseRequest
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

data class BillingUiState(val connecting: Boolean = false, val products: List<ProductDetails> = emptyList(),
                          val packs: List<CreditPack> = emptyList(), val busy: Boolean = false,
                          val message: String? = null, val lastGrantedCredits: Int? = null)

/** Play Billing owns the payment UI; the Worker owns verification, idempotent grants and consumption. */
@Singleton
class BillingManager @Inject constructor(@ApplicationContext private val context: Context, private val repository: LoopRepository) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val mutex = Mutex()
    private val _state = MutableStateFlow(BillingUiState())
    val state = _state.asStateFlow()
    private var accountId: String = ""
    private val client: BillingClient = BillingClient.newBuilder(context)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .setListener { result, purchases ->
            when (result.responseCode) {
                BillingClient.BillingResponseCode.OK -> purchases.orEmpty().forEach { purchase -> scope.launch { verify(purchase) } }
                BillingClient.BillingResponseCode.USER_CANCELED -> _state.value = _state.value.copy(message = "Purchase cancelled")
                BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> scope.launch { restore() }
                else -> _state.value = _state.value.copy(message = result.debugMessage.ifBlank { "Google Play could not complete the purchase" })
            }
        }.build()

    private suspend fun connected(): Boolean {
        if (client.isReady) return true
        return suspendCancellableCoroutine { continuation ->
            client.startConnection(object : BillingServiceConnectionListener {
                override fun onBillingSetupFinished(result: BillingResult) {
                    if (continuation.isActive) continuation.resume(result.responseCode == BillingClient.BillingResponseCode.OK)
                }
                override fun onBillingServiceDisconnected() { _state.value = _state.value.copy(connecting = false) }
            })
        }
    }

    suspend fun refresh() {
        _state.value = _state.value.copy(connecting = true, message = null)
        try {
            val packs = runCatching { repository.creditPacks() }.getOrDefault(emptyList())
            if (packs.isEmpty()) { _state.value = BillingUiState(message = "Credit purchases are not available in this environment yet."); return }
            if (!connected()) { _state.value = BillingUiState(packs = packs, message = "Google Play Billing is unavailable on this device."); return }
            val params = QueryProductDetailsParams.newBuilder().setProductList(packs.map {
                QueryProductDetailsParams.Product.newBuilder().setProductId(it.productId).setProductType(BillingClient.ProductType.INAPP).build()
            }).build()
            val result = client.queryProductDetails(params)
            _state.value = BillingUiState(products = result.productDetailsList.orEmpty(), packs = packs,
                message = if (result.billingResult.responseCode != BillingClient.BillingResponseCode.OK) result.billingResult.debugMessage else null)
        } catch (e: Exception) { _state.value = BillingUiState(message = e.friendlyMessage()) }
    }

    fun purchase(activity: Activity, productId: String, internalAccountId: String) {
        val product = _state.value.products.firstOrNull { it.productId == productId } ?: run {
            _state.value = _state.value.copy(message = "This product is not available in Google Play yet."); return
        }
        accountId = internalAccountId
        val params = BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(
            BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).build()
        )).setObfuscatedAccountId(internalAccountId).build()
        val result = client.launchBillingFlow(activity, params)
        if (result.responseCode != BillingClient.BillingResponseCode.OK) _state.value = _state.value.copy(message = result.debugMessage.ifBlank { "Could not open Google Play" })
    }

    suspend fun restore() {
        if (!connected()) return
        val result = client.queryPurchases(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build())
        result.purchasesList.forEach { verify(it) }
    }

    private suspend fun verify(purchase: Purchase) = mutex.withLock {
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) {
            _state.value = _state.value.copy(message = "This purchase is pending. Credits arrive only after Google confirms payment."); return@withLock
        }
        _state.value = _state.value.copy(busy = true, message = null)
        try {
            val product = purchase.products.firstOrNull() ?: return@withLock
            val granted = repository.call { verifyPlayPurchase(VerifyPlayPurchaseRequest(product, purchase.purchaseToken)) }
            if (!granted.consumed) {
                repository.call { consumePlayPurchase(ConsumePurchaseRequest(purchase.purchaseToken)) }
            }
            repository.invalidate("credits", "member", "purchases", "rewards")
            _state.value = _state.value.copy(busy = false, lastGrantedCredits = granted.credits.toInt(),
                message = if (granted.alreadyGranted) "This purchase was already credited. Your balance is unchanged." else "${granted.credits.toInt()} credits added.")
        } catch (e: Exception) {
            _state.value = _state.value.copy(busy = false, message = e.friendlyMessage() + " Your receipt is safe; use Restore purchases to retry verification.")
        }
    }
}
