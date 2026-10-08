package com.example.hyenaapp.ui.saved

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun SavedScreen(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize().padding(24.dp)
    ) {
        Text(
            text = "Saved",
            style = MaterialTheme.typography.headlineLarge
        )
        Text(text = "Your saved experiences will appear here.")
    }
}