package com.example.hyenaapp

import com.example.hyenaapp.data.remote.*
import com.google.gson.Gson
import com.google.gson.JsonParser
import org.junit.Assert.*
import org.junit.Test

class SubmissionModelsTest {
    private fun request(venue: SubmissionVenue, amount: String? = null) = EventSubmissionRequest(
        "2824efb4-a0c1-4d87-9b9e-c8f6efab70f6", venue,
        SubmittedEvent("Art evening", "A local workshop", listOf("category-id"),
            SubmissionSchedule("2030-05-10", "2030-05-10", "23:00", "01:00", true, "America/Denver"),
            amount, amount?.let { "USD" })
    )

    @Test
    fun existingVenueDoesNotSerializeAConflictingProposal() {
        val json = JsonParser.parseString(Gson().toJson(request(SubmissionVenue(businessId = "venue-id")))).asJsonObject
        val venue = json.getAsJsonObject("venue")
        assertEquals("venue-id", venue.get("businessId").asString)
        assertFalse(venue.has("proposal"))
    }

    @Test
    fun proposedVenueDoesNotSerializeANullBusinessId() {
        val json = JsonParser.parseString(Gson().toJson(request(SubmissionVenue(proposal = VenueProposal("area-id", "Studio", "1 Main St", "Rexburg"))))).asJsonObject
        val venue = json.getAsJsonObject("venue")
        assertFalse(venue.has("businessId"))
        assertEquals("Studio", venue.getAsJsonObject("proposal").get("name").asString)
    }

    @Test
    fun freePriceAndOvernightVenueLocalSchedulePreserveTheApiContract() {
        val json = JsonParser.parseString(Gson().toJson(request(SubmissionVenue(businessId = "venue-id"), "0"))).asJsonObject
        val event = json.getAsJsonObject("event")
        assertEquals("0", event.get("priceAmount").asString)
        assertEquals("USD", event.get("currency").asString)
        val schedule = event.getAsJsonObject("schedule")
        assertEquals("ONCE", schedule.get("kind").asString)
        assertEquals(schedule.get("startDate"), schedule.get("endDate"))
        assertTrue(schedule.get("endsNextDay").asBoolean)
        assertEquals("America/Denver", schedule.get("timeZone").asString)
    }
}
