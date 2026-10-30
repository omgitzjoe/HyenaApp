package com.example.hyenaapp.data.repository

import android.content.Context
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.time.LocalDate

/** Device preferences only. Coordinates and event drafts are never persisted here. */
data class AppPreferences(
    val theme: String = "light",
    val radiusMiles: Int = 10,
    val filters: DiscoveryFilters = DiscoveryFilters()
)

class AppPreferencesStore(context: Context) {
    private val storage = context.applicationContext.getSharedPreferences("hyena_preferences", Context.MODE_PRIVATE)
    fun load(): AppPreferences = AppPreferencesCodec.decode(storage.getString("choices", null))
    fun save(value: AppPreferences) {
        // apply updates memory immediately and queues ordered disk writes without blocking typing.
        storage.edit().putString("choices", AppPreferencesCodec.encode(value)).apply()
    }
}

internal object AppPreferencesCodec {
    private val gson = Gson()
    private val uuid = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
    private fun text(root: JsonObject, name: String): String? = root.get(name)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isString }?.asString
    fun encode(value: AppPreferences): String = gson.toJson(value)
    fun decode(value: String?): AppPreferences {
        if (value == null) return AppPreferences()
        return try {
            val root = JsonParser.parseString(value).asJsonObject
            val f = root.get("filters")?.takeIf { it.isJsonObject }?.asJsonObject ?: JsonObject()
            val categoryIds = f.get("categoryIds")?.takeIf { it.isJsonArray }?.asJsonArray?.mapNotNull {
                it.takeIf { item -> item.isJsonPrimitive && item.asJsonPrimitive.isString }?.asString?.takeIf(uuid::matches)
            }?.distinct()?.take(20).orEmpty()
            val date = text(f, "date")?.takeIf { runCatching { LocalDate.parse(it) }.isSuccess }
            val window = text(f, "window")?.takeIf { it in listOf("today", "tonight", "now", "date", "all") } ?: "today"
            val radius = root.get("radiusMiles")?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asDouble
                ?.takeIf { it in listOf(5.0,10.0,25.0,100.0) }?.toInt() ?: 10
            AppPreferences(
                theme = if (text(root, "theme") == "dark") "dark" else "light",
                radiusMiles = radius,
                filters = DiscoveryFilters(
                    query = text(f, "query")?.take(100).orEmpty(), categoryIds = categoryIds,
                    window = if (window == "date" && date == null) "today" else window,
                    date = date.takeIf { window == "date" },
                    priceMode = text(f, "priceMode")?.takeIf { it in listOf("any", "free", "max") } ?: "any",
                    maxPrice = text(f, "maxPrice")?.takeIf { Regex("\\d{1,8}(?:\\.\\d{1,2})?").matches(it) } ?: "25.00"
                )
            )
        } catch (error: Exception) { AppPreferences() }
    }
}
