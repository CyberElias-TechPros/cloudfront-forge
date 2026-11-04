package com.creatorloop.app.data

import kotlinx.serialization.json.*

fun JsonObject.str(vararg keys: String, default: String = ""): String {
    for (key in keys) { val value = this[key]; if (value is JsonPrimitive && value.isString) return value.content }
    return default
}
fun JsonObject.num(vararg keys: String, default: Double = 0.0): Double {
    for (key in keys) { val value = this[key] as? JsonPrimitive ?: continue; value.doubleOrNull?.let { return it } }
    return default
}
fun JsonObject.int(vararg keys: String, default: Int = 0): Int = num(*keys, default = default.toDouble()).toInt()
fun JsonObject.bool(vararg keys: String, default: Boolean = false): Boolean {
    for (key in keys) { val value = this[key] as? JsonPrimitive ?: continue; value.booleanOrNull?.let { return it }; value.intOrNull?.let { return it != 0 } }
    return default
}
fun JsonObject.obj(vararg keys: String): JsonObject = keys.firstNotNullOfOrNull { this[it] as? JsonObject } ?: JsonObject(emptyMap())
fun JsonObject.arr(vararg keys: String): List<JsonElement> = keys.firstNotNullOfOrNull { this[it] as? JsonArray } ?: emptyList()
fun JsonObject.objs(vararg keys: String): List<JsonObject> = arr(*keys).mapNotNull { it as? JsonObject }
fun JsonElement.asObject(): JsonObject = this as? JsonObject ?: JsonObject(emptyMap())
