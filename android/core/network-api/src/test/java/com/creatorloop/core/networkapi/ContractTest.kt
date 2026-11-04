package com.creatorloop.core.networkapi

import com.creatorloop.core.networkapi.generated.ContractOperations
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test

class ContractTest {
    @Serializable data class Flag(@Serializable(with = FlexibleBooleanSerializer::class) val value: Boolean)
    private val json = Json { ignoreUnknownKeys = true }

    @Test fun `contract exposes every generated operation`() {
        assertEquals(124, ContractOperations.all.size)
        assertTrue(ContractOperations.all.any { it.id == "verifyPlayPurchase" && it.method == "POST" })
        assertTrue(ContractOperations.all.any { it.id == "registerMobileDevice" })
        assertTrue(ContractOperations.all.any { it.id == "recordMobileConsent" })
    }

    @Test fun `boolean serializer accepts sqlite integers and booleans`() {
        assertTrue(json.decodeFromString<Flag>("""{"value":1}""").value)
        assertFalse(json.decodeFromString<Flag>("""{"value":0}""").value)
        assertTrue(json.decodeFromString<Flag>("""{"value":true}""").value)
        assertFalse(json.decodeFromString<Flag>("""{"value":false}""").value)
    }
}
