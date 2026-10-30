package com.example.hyenaapp

import com.example.hyenaapp.data.repository.SavedExperienceCodec
import com.example.hyenaapp.data.repository.displaySchedule
import com.example.hyenaapp.domain.model.Experience
import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SavedExperienceCodecTest {
    private val event = Experience(
        "experience-1", "Café Étoile ☕", "Example venue", "Original schedule", "Free entry",
        "2026-10-29T02:00:00Z", "2026-10-29T03:00:00Z"
    )

    @Test
    fun saveRoundTripPreservesOfflineSnapshotAndInstants() {
        val saved = SavedExperienceCodec.toggle(emptyList(), event)
        val restored = SavedExperienceCodec.decode(SavedExperienceCodec.encode(saved))
        assertEquals(listOf(event), restored)
        assertEquals("Wed, Oct 28 · 8:00 PM–9:00 PM", displaySchedule(restored.single(), "America/Denver"))
        assertEquals("Wed, Oct 28 · 10:00 PM–11:00 PM", displaySchedule(restored.single(), "America/New_York"))
    }

    @Test
    fun removeUsesIdentityAcrossDifferentOccurrenceSnapshots() {
        val updated = event.copy(schedule = "Another occurrence", occurrenceStart = "2026-11-01T02:00:00Z")
        val removed = SavedExperienceCodec.toggle(listOf(event), updated)
        assertTrue(SavedExperienceCodec.decode(SavedExperienceCodec.encode(removed)).isEmpty())
    }

    @Test
    fun duplicateIdsDoNotCreateDuplicateSavedCards() {
        assertEquals(1, SavedExperienceCodec.decode(SavedExperienceCodec.encode(listOf(event, event))).size)
    }

    @Test
    fun initialStorageIsEmpty() { assertTrue(SavedExperienceCodec.decode(null).isEmpty()) }

    @Test(expected = IOException::class)
    fun corruptStorageIsReportedRatherThanSilentlyErased() {
        SavedExperienceCodec.decode("not JSON")
    }

    @Test(expected = IOException::class)
    fun partialStorageIsReported() { SavedExperienceCodec.decode("[{\"id\":\"one\"}]") }
}
