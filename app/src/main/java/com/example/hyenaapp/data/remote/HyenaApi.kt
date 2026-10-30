package com.example.hyenaapp.data.remote

import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.GET
import retrofit2.http.Query

interface HyenaApi {
    @GET("api/v1/experiences")
    suspend fun getExperiences(
        @Query("q") query: String = "",
        @Query("window") window: String = "today",
        @Query("timeZone") timeZone: String = java.time.ZoneId.systemDefault().id,
        @Query("latitude") latitude: Double? = null,
        @Query("longitude") longitude: Double? = null,
        @Query("radiusMiles") radiusMiles: Int? = null,
        @Query("categoryIds") categoryIds: String? = null,
        @Query("price") price: String = "any",
        @Query("maxPrice") maxPrice: String? = null,
        @Query("currency") currency: String? = null,
        @Query("date") date: String? = null,
        @Query("limit") limit: Int = 20
    ): ExperienceResponse

    @GET("api/v1/businesses")
    suspend fun getBusinesses(
        @Query("q") query: String = "",
        @Query("latitude") latitude: Double? = null,
        @Query("longitude") longitude: Double? = null,
        @Query("radiusMiles") radiusMiles: Int? = null,
        @Query("searchAll") searchAll: Boolean = false
    ): BusinessResponse

    @POST("api/v1/submissions")
    suspend fun submitEvent(@Body body: EventSubmissionRequest): SubmissionResponse

    @GET("api/v1/categories")
    suspend fun getCategories(): CategoryResponse

}
