package com.example.hyenaapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.core.view.WindowCompat
import com.example.hyenaapp.data.repository.AppPreferencesStore
import com.example.hyenaapp.ui.theme.HyenaAppTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val preferencesStore = AppPreferencesStore(this)
        setContent {
            var preferences by remember { mutableStateOf(preferencesStore.load()) }
            val dark = preferences.theme == "dark"
            HyenaAppTheme(darkTheme = dark) {
                SideEffect {
                    WindowCompat.getInsetsController(window, window.decorView).apply {
                        isAppearanceLightStatusBars = !dark
                        isAppearanceLightNavigationBars = !dark
                    }
                }
                HyenaApp(preferences = preferences, onPreferencesChange = {
                    preferences = it
                    preferencesStore.save(it)
                })
            }
        }
    }
}
