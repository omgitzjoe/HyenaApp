package com.example.hyenaapp.ui.submit

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.data.remote.ApiClient
import com.example.hyenaapp.data.remote.AreaDto
import com.example.hyenaapp.data.remote.BusinessDto
import com.example.hyenaapp.data.remote.CategoryDto
import com.example.hyenaapp.data.remote.EventSubmissionRequest
import com.example.hyenaapp.data.remote.SubmissionSchedule
import com.example.hyenaapp.data.remote.SubmissionVenue
import com.example.hyenaapp.data.remote.SubmittedEvent
import com.example.hyenaapp.data.remote.VenueProposal
import com.google.gson.JsonParser
import java.time.Instant
import java.time.LocalTime
import java.time.ZonedDateTime
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import retrofit2.HttpException

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubmitEventScreen(initialAreaId: String? = null, onDone: () -> Unit) {
    val scope = rememberCoroutineScope()
    var title by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var areaId by rememberSaveable { mutableStateOf(initialAreaId.orEmpty()) }
    var categoryId by rememberSaveable { mutableStateOf("") }
    var proposed by rememberSaveable { mutableStateOf(false) }
    var businessId by rememberSaveable { mutableStateOf("") }
    var businessName by rememberSaveable { mutableStateOf("") }
    var venueQuery by rememberSaveable { mutableStateOf("") }
    var venueName by rememberSaveable { mutableStateOf("") }
    var address by rememberSaveable { mutableStateOf("") }
    var city by rememberSaveable { mutableStateOf("") }
    var unknownPrice by rememberSaveable { mutableStateOf(true) }
    var price by rememberSaveable { mutableStateOf("") }
    var offer by rememberSaveable { mutableStateOf("") }
    var requirements by rememberSaveable { mutableStateOf("") }
    var dateTouched by rememberSaveable { mutableStateOf(false) }
    var date by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var startTime by rememberSaveable { mutableStateOf("18:00") }
    var endTime by rememberSaveable { mutableStateOf("20:00") }
    var endsNextDay by rememberSaveable { mutableStateOf(false) }
    var zoneInitialized by rememberSaveable { mutableStateOf(false) }
    var timeZone by rememberSaveable { mutableStateOf(ZoneId.systemDefault().id) }
    var requestId by rememberSaveable { mutableStateOf(UUID.randomUUID().toString()) }
    var receiptId by rememberSaveable { mutableStateOf<String?>(null) }
    var receiptStatus by rememberSaveable { mutableStateOf("") }
    var areas by remember { mutableStateOf<List<AreaDto>>(emptyList()) }
    var categories by remember { mutableStateOf<List<CategoryDto>>(emptyList()) }
    var businesses by remember { mutableStateOf<List<BusinessDto>>(emptyList()) }
    var hasMoreBusinesses by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var venueLoading by remember { mutableStateOf(false) }
    var referenceError by remember { mutableStateOf<String?>(null) }
    var venueError by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var submitting by remember { mutableStateOf(false) }
    var reload by remember { mutableStateOf(0) }
    var showDate by remember { mutableStateOf(false) }
    fun edited() { requestId = UUID.randomUUID().toString(); message = null }
    fun venueZone(value: String) {
        timeZone = value
        zoneInitialized = true
        if (!dateTouched) {
            try {
                val local = ZonedDateTime.now(ZoneId.of(value))
                date = (if (local.toLocalTime() >= LocalTime.of(20, 0)) local.toLocalDate().plusDays(1) else local.toLocalDate()).toString()
            } catch (_: Exception) { /* Keep the user's date while a zone is being typed. */ }
        }
    }

    LaunchedEffect(reload) {
        loading = true
        referenceError = null
        try {
            areas = ApiClient.api.getAreas().items
            categories = ApiClient.api.getCategories().items
            if (areas.none { it.id == areaId }) {
                areaId = areas.firstOrNull()?.id.orEmpty()
                venueZone(areas.firstOrNull()?.timeZone ?: ZoneId.systemDefault().id)
                businessId = ""
                edited()
            }
            if (!zoneInitialized && areaId.isNotBlank()) {
                venueZone(areas.first { it.id == areaId }.timeZone)
            }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (error: Exception) { referenceError = "Couldn't load areas and categories. Check the API and retry." }
        finally { loading = false }
    }
    LaunchedEffect(areaId, venueQuery, reload) {
        if (areaId.isBlank()) return@LaunchedEffect
        venueLoading = true
        venueError = null
        try {
            if (venueQuery.isNotBlank()) delay(300)
            val response = ApiClient.api.getBusinesses(areaId, venueQuery.trim())
            businesses = response.items
            hasMoreBusinesses = response.hasMore
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (error: Exception) { venueError = "Couldn't load venues. Retry, or propose a new venue."; businesses = emptyList() }
        finally { venueLoading = false }
    }
    BackHandler {
        if (submitting) message = "Your submission is sending. Please wait for confirmation." else onDone()
    }

    fun submit() {
        if (submitting) return
        val problem = when {
            title.isBlank() -> "Enter an event title."
            description.isBlank() -> "Describe the event."
            categoryId.isBlank() -> "Choose a category."
            areaId.isBlank() -> "Choose a discovery area."
            !proposed && businessId.isBlank() -> "Choose an existing venue or propose a new one."
            proposed && (venueName.isBlank() || address.isBlank() || city.isBlank()) -> "Enter the proposed venue name, address, and city."
            !unknownPrice && !Regex("(0|[1-9]\\d{0,7})(\\.\\d{1,2})?").matches(price.trim()) -> "Enter a nonnegative USD price with up to two decimal places, or choose Price unknown."
            !Regex("([01]\\d|2[0-3]):[0-5]\\d").matches(startTime) || !Regex("([01]\\d|2[0-3]):[0-5]\\d").matches(endTime) -> "Use 24-hour times such as 18:00 and 20:00."
            (if (endsNextDay) endTime > startTime else endTime <= startTime) -> "Check the end time and Ends next day option."
            else -> null
        }
        if (problem != null) { message = problem; return }
        try { ZoneId.of(timeZone.trim()) } catch (_: Exception) { message = "Use a named time zone such as America/Denver."; return }
        val venue = if (proposed) SubmissionVenue(proposal = VenueProposal(areaId, venueName.trim(), address.trim(), city.trim())) else SubmissionVenue(businessId = businessId)
        val body = EventSubmissionRequest(requestId, venue, SubmittedEvent(
            title.trim(), description.trim(), listOf(categoryId),
            SubmissionSchedule(date, date, startTime, endTime, endsNextDay, timeZone.trim()),
            if (unknownPrice) null else price.trim(), if (unknownPrice) null else "USD",
            offer.trim().takeIf { it.isNotEmpty() }, requirements.trim().takeIf { it.isNotEmpty() }
        ))
        submitting = true
        message = null
        scope.launch {
            try {
                val receipt = ApiClient.api.submitEvent(body).item
                receiptId = receipt.id
                receiptStatus = receipt.status
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) { message = submissionError(error) }
            finally { submitting = false }
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item { TextButton(onClick = onDone, enabled = !submitting) { Text("Back") } }
        item { Text("Submit an event", style = MaterialTheme.typography.headlineLarge) }
        if (receiptId != null) {
            item { Text(when (receiptStatus) { "APPROVED" -> "Your event has been approved."; "REJECTED" -> "Your submission was reviewed and not approved."; else -> "Submission received. It will not appear publicly until an administrator approves it." }) }
            item { Text("Reference: $receiptId") }
            item { Button(onClick = onDone) { Text("Done") } }
            item { OutlinedButton(onClick = {
                receiptId = null; title = ""; description = ""; price = ""; unknownPrice = true
                offer = ""; requirements = ""; businessId = ""; businessName = ""; venueName = ""; address = ""; city = ""
                dateTouched = false; venueZone(timeZone); requestId = UUID.randomUUID().toString(); message = null
            }) { Text("Submit another event") } }
        } else {
            item { Text("One-time events are reviewed before publishing. Please check the venue, price, and schedule.") }
            if (loading) item { CircularProgressIndicator() }
            if (referenceError != null) item { Text(referenceError.orEmpty()); Button(onClick = { reload++ }) { Text("Retry reference data") } }
            item { Entry("Event title", title, 200, !submitting) { title = it; edited() } }
            item { Entry("Description", description, 10000, !submitting, multiline = true) { description = it; edited() } }
            item { Text("Category", style = MaterialTheme.typography.titleMedium) }
            item {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    categories.forEach { category -> FilterChip(selected = categoryId == category.id, onClick = { categoryId = category.id; edited() }, enabled = !submitting, label = { Text(category.name) }) }
                }
                if (!loading && categories.isEmpty()) Text("No categories available. Ask the administrator to add categories.")
            }
            item { Choice("Area", areas.firstOrNull { it.id == areaId }?.name ?: "Choose an area", areas.map { it.id to it.name }, !submitting && !loading) { id ->
                areaId = id; businessId = ""; businessName = ""; areas.firstOrNull { it.id == id }?.let { venueZone(it.timeZone) }; edited()
            } }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = !proposed, onClick = { proposed = false; edited() }, enabled = !submitting, label = { Text("Existing venue") })
                    FilterChip(selected = proposed, onClick = { proposed = true; edited() }, enabled = !submitting, label = { Text("New venue") })
                }
            }
            if (proposed) {
                item { Entry("Venue name", venueName, 200, !submitting) { venueName = it; edited() } }
                item { Entry("Street address", address, 300, !submitting) { address = it; edited() } }
                item { Entry("City", city, 100, !submitting) { city = it; edited() } }
                item { Text("The administrator will verify the proposed venue before publishing.") }
            } else {
                item { Entry("Search venues in this area", venueQuery, 100, !submitting) { venueQuery = it } }
                if (venueLoading) item { CircularProgressIndicator() }
                if (venueError != null) item { Text(venueError.orEmpty()); TextButton(onClick = { reload++ }) { Text("Retry venues") } }
                item { Choice("Venue", businessName.ifBlank { "Choose a venue" }, businesses.map { it.id to "${it.name} · ${it.address}" }, !submitting && !venueLoading) { id ->
                    businesses.firstOrNull { it.id == id }?.let { business -> businessId = id; businessName = business.name; venueZone(business.timeZone); edited() }
                } }
                if (!venueLoading && businesses.isEmpty()) item { Text("No matching venues. Change the search or propose a new venue.") }
                if (hasMoreBusinesses) item { Text("Showing the first 50 venues. Refine your venue search.") }
            }
            item { Text("Venue-local schedule", style = MaterialTheme.typography.titleMedium) }
            item { Text("Enter the date and times at the venue. Discovery converts them to each viewer's time zone.") }
            item { OutlinedButton(onClick = { showDate = true }, enabled = !submitting) { Text("Event date: $date") } }
            item { Entry("Start time (HH:mm, 24-hour)", startTime, 5, !submitting) { startTime = it; edited() } }
            item { Entry("End time (HH:mm, 24-hour)", endTime, 5, !submitting) { endTime = it; edited() } }
            item { Row { Checkbox(checked = endsNextDay, onCheckedChange = { endsNextDay = it; edited() }, enabled = !submitting); Text("Ends next day") } }
            item { Entry("Venue time zone", timeZone, 100, !submitting) { venueZone(it); edited() } }
            item { Row { Checkbox(checked = unknownPrice, onCheckedChange = { unknownPrice = it; edited() }, enabled = !submitting); Text("Price unknown") } }
            if (!unknownPrice) item { Entry("Price in USD (0 for free)", price, 11, !submitting) { price = it; edited() } }
            item { Entry("Offer or price details (optional)", offer, 2000, !submitting) { offer = it; edited() } }
            item { Entry("Requirements (optional)", requirements, 2000, !submitting) { requirements = it; edited() } }
            if (message != null) item { Text(message.orEmpty(), color = MaterialTheme.colorScheme.error) }
            item { Button(onClick = { submit() }, enabled = !submitting && !loading && referenceError == null) { Text(if (submitting) "Sending…" else "Submit for review") } }
        }
    }
    if (showDate) {
        val state = rememberDatePickerState(initialSelectedDateMillis = LocalDate.parse(date).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli())
        DatePickerDialog(onDismissRequest = { showDate = false }, confirmButton = {
            TextButton(enabled = state.selectedDateMillis != null, onClick = {
                state.selectedDateMillis?.let { date = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString(); dateTouched = true; edited() }
                showDate = false
            }) { Text("Choose date") }
        }, dismissButton = { TextButton(onClick = { showDate = false }) { Text("Cancel") } }) { DatePicker(state = state) }
    }
}

@Composable
private fun Entry(label: String, value: String, max: Int, enabled: Boolean, multiline: Boolean = false, change: (String) -> Unit) {
    OutlinedTextField(value = value, onValueChange = { change(it.take(max)) }, label = { Text(label) }, enabled = enabled,
        modifier = Modifier.fillMaxWidth(), singleLine = !multiline, minLines = if (multiline) 3 else 1)
}

@Composable
private fun Choice(label: String, selected: String, options: List<Pair<String, String>>, enabled: Boolean, select: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick = { expanded = true }, enabled = enabled) { Text("$label: $selected") }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (id, name) -> DropdownMenuItem(text = { Text(name) }, onClick = { select(id); expanded = false }) }
        }
    }
}

private fun submissionError(error: Exception): String {
    if (error is HttpException) {
        if (error.code() == 404) return "The submission service is not deployed yet. Check the feature setup guide."
        try {
            val detail = JsonParser.parseString(error.response()?.errorBody()?.string().orEmpty()).asJsonObject.getAsJsonObject("error")
            val issues = detail.getAsJsonArray("details")?.map { it.asJsonObject.get("message").asString }?.take(4)?.joinToString("\n")
            return issues ?: detail.get("message").asString
        } catch (_: Exception) { return "Submission failed (HTTP ${error.code()}). Please retry." }
    }
    return "Couldn't confirm the submission. Check your connection and retry without editing to avoid a duplicate."
}
