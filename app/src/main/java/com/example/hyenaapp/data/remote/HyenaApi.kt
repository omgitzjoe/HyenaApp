package com.example.hyenaapp.data.remote

import retrofit2.http.GET
import retrofit2.http.Query

interface HyenaApi {
    @GET("api/v1/experiences")
    suspend fun getExperiences(
        @Query("q") query: String = ""
    ): ExperienceResponse
}