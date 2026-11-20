package com.example.hyenaapp.data.repository

import android.content.Context
import com.example.hyenaapp.data.remote.ApiClient
import com.example.hyenaapp.domain.model.Experience
import com.example.hyenaapp.reminders.EventReminders
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull

internal fun mergeSavedRefresh(current: List<Experience>, fresh: List<Experience>, unavailable: Set<String>): List<Experience> {
    val byId = fresh.associateBy { it.id }
    return current.filterNot { it.id in unavailable }.map { byId[it.id] ?: it }
}

object SavedEventSync {
    private val lock = Mutex()
    suspend fun refresh(context: Context): List<Experience> = lock.withLock {
        val store = SavedExperienceStore(context)
        val snapshot = store.load()
        val fresh = mutableListOf<Experience>()
        val unavailable = mutableSetOf<String>()
        for (batch in snapshot.filterNot { it.id.startsWith(DEVICE_CALENDAR_ID_PREFIX) }.chunked(100)) {
            try {
                val response = withTimeoutOrNull(8_000) { ApiClient.api.refreshSaved(batch.joinToString(",") { it.id }) } ?: continue
                val requested = batch.map { it.id }.toSet()
                require(response.items.map { it.id }.toSet().intersect(response.unavailableIds.toSet()).isEmpty())
                require(response.items.map { it.id }.toSet() + response.unavailableIds.toSet() == requested)
                fresh += response.items.map { ExperienceRepository.toExperience(it) }
                unavailable += response.unavailableIds
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) { /* Keep the offline snapshot on network or response failure. */ }
        }
        val result = store.update { mergeSavedRefresh(it, fresh, unavailable) }
        val reminders = EventReminders(context)
        val current = result.associateBy { it.id }
        snapshot.filter { old -> current[old.id]?.occurrenceStart != old.occurrenceStart || old.id !in current }.forEach { reminders.cancel(it.id) }
        reminders.updateSaved(result)
        result
    }
}
