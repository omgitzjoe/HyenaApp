package com.example.hyenaapp.data.remote

data class BusinessResponse(val items: List<BusinessDto>, val hasMore: Boolean)
data class BusinessDto(val id: String, val name: String, val address: String?, val city: String?, val timeZone: String, val distanceMiles: Double? = null, val state: String? = null)
data class VenueProposal(val latitude: Double?, val longitude: Double?, val name: String, val address: String?, val city: String?, val state: String? = null, val postalCode: String? = null)
data class SubmissionVenue(val businessId: String? = null, val proposal: VenueProposal? = null)
data class SubmissionSchedule(
 val startDate: String, val endDate: String?, val startTime: String?, val endTime: String?,
 val allDay: Boolean = false, val kind: String = "ONCE", val weekdays: List<Int> = emptyList()
)
data class SubmittedEvent(
 val title: String, val description: String?, val categoryIds: List<String>,
 val schedule: SubmissionSchedule, val priceAmount: String?, val type: String = "OTHER", val sourceUrl: String? = null
)
data class EventSubmissionRequest(val clientRequestId: String, val venue: SubmissionVenue, val event: SubmittedEvent)
data class SubmissionResponse(val item: SubmissionReceipt)
data class SubmissionReceipt(val id: String, val status: String, val createdAt: String)
