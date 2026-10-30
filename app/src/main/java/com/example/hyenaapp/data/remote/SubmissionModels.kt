package com.example.hyenaapp.data.remote

data class BusinessResponse(val items: List<BusinessDto>, val hasMore: Boolean)
data class BusinessDto(val id: String, val name: String, val address: String, val city: String, val timeZone: String)
data class VenueProposal(val areaId: String, val name: String, val address: String, val city: String, val region: String? = null, val postalCode: String? = null)
data class SubmissionVenue(val businessId: String? = null, val proposal: VenueProposal? = null)
data class SubmissionSchedule(
    val startDate: String, val endDate: String, val startTime: String, val endTime: String,
    val endsNextDay: Boolean, val timeZone: String,
    val kind: String = "ONCE", val weekdays: List<Int> = emptyList()
)
data class SubmittedEvent(
    val title: String, val description: String, val categoryIds: List<String>,
    val schedule: SubmissionSchedule, val priceAmount: String?, val currency: String?,
    val offer: String? = null, val requirements: String? = null, val type: String = "EVENT"
)
data class EventSubmissionRequest(val clientRequestId: String, val venue: SubmissionVenue, val event: SubmittedEvent)
data class SubmissionResponse(val item: SubmissionReceipt)
data class SubmissionReceipt(val id: String, val status: String, val createdAt: String)
