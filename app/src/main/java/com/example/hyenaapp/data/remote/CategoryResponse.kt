package com.example.hyenaapp.data.remote

data class CategoryResponse(val items: List<CategoryDto>, val count: Int)
data class CategoryDto(val id: String, val name: String)
