package com.example.hyenaapp.data.repository

import android.content.Context
import com.example.hyenaapp.domain.model.Experience
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.IOException
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Local snapshots; independent of Explore filters and available offline. */
class SavedExperienceStore(context: Context) {
    private val retiredDemoIds: Set<String> = context.assets.open("retired_demo_events.json").bufferedReader().use {
        Gson().fromJson(it, Array<String>::class.java).toSet()
    }
    private val preferences = context.applicationContext.getSharedPreferences("saved_experiences", Context.MODE_PRIVATE)

    suspend fun load(): List<Experience> = withContext(Dispatchers.IO) {
        val previous = SavedExperienceCodec.decode(preferences.getString("items", null))
        val retained = previous.filterNot { it.id in retiredDemoIds || it.occurrenceEnd?.let { end -> !Instant.parse(end).isAfter(Instant.now()) } == true }
        if (retained.size != previous.size && !preferences.edit().putString("items", SavedExperienceCodec.encode(retained)).commit()) {
            throw IOException("Unable to clean retired demonstration saves")
        }
        retained
    }

    suspend fun save(items: List<Experience>) = withContext(Dispatchers.IO) {
        if (!preferences.edit().putString("items", SavedExperienceCodec.encode(items)).commit()) {
            throw IOException("Unable to persist saved experiences")
        }
    }
}

internal object SavedExperienceCodec {
    private val gson = Gson()
    private val type = object : TypeToken<List<Experience>>() {}.type

    fun encode(items: List<Experience>): String = gson.toJson(items.distinctBy { it.id }, type)

    fun decode(value: String?): List<Experience> {
        if (value == null) return emptyList()
        try {
            val items: List<Experience> = gson.fromJson(value, type) ?: throw IOException("Invalid saved data")
            items.forEach { item ->
                require(item.id.isNotBlank() && item.title.isNotBlank())
                require(item.businessName.isNotBlank() && item.schedule.isNotBlank())
                require((item.occurrenceStart == null) == (item.occurrenceEnd == null))
                item.occurrenceStart?.let { Instant.parse(it) }
                item.occurrenceEnd?.let { Instant.parse(it) }
            }
            return items.distinctBy { it.id }.map { it.copy(offer = it.offer.orEmpty().takeUnless { value -> value == "Price not listed" || value == "Price unknown" }.orEmpty(), categories = it.categories.orEmpty(), priceLabel = it.priceLabel?.takeUnless { value -> value == "Price unknown" } ?: "") }
        } catch (error: Exception) {
            throw IOException("Unable to read saved experiences", error)
        }
    }

    fun toggle(items: List<Experience>, experience: Experience): List<Experience> =
        if (items.any { it.id == experience.id }) items.filterNot { it.id == experience.id }
        else listOf(experience) + items
}
