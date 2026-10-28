package com.example.hyenaapp.data.remote

import retrofit2.http.GET
import retrofit2.http.Query

interface HyenaApi {
    @GET("api/v1/experiences")
    suspend fun getExperiences(
        @Query("q") query: String = "",
        @Query("window") window: String = "today",
        @Query("areaId") areaId: String? = null
    ): ExperienceResponse

    @GET("api/v1/areas")
    suspend fun getAreas(): AreaResponse
}
