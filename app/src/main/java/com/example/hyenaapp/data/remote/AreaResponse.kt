package com.example.hyenaapp.data.remote

data class AreaResponse(val items: List<AreaDto>, val count: Int)

data class AreaDto(val id: String, val name: String, val timeZone: String)
