package com.example.hyenaapp.data.sample

import com.example.hyenaapp.domain.model.Experience

object SampleExperiences {
    val items = listOf(
        Experience(
            id = "trivia-night",
            title = "Trivia Night",
            businessName = "Example Café",
            schedule = "Tonight · 7–9 PM",
            offer = "Free entry"
        ),
        Experience(
            id = "dinner-special",
            title = "Dinner Special",
            businessName = "Example Grill",
            schedule = "Tonight · 5–8 PM",
            offer = "\$8 meal deal"
        )
    )
}