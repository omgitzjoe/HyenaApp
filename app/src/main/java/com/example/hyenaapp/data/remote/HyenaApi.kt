package com.example.hyenaapp.data.remote

import retrofit2.http.GET

interface HyenaApi {
    @GET("api/v1/experiences")
    suspend fun getExperiences(): ExperienceResponse
}