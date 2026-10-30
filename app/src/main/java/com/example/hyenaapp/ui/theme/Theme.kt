package com.example.hyenaapp.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

private val LightColors = lightColorScheme(
    primary = Color(0xFF285847), onPrimary = Color.White,
    primaryContainer = Color(0xFFDCEDE2), onPrimaryContainer = Color(0xFF163C2D),
    secondary = Color(0xFF735624), onSecondary = Color.White,
    secondaryContainer = Color(0xFFF8E7C6), onSecondaryContainer = Color(0xFF49340F),
    tertiary = Color(0xFF53665D), background = Color(0xFFF6F7F2),
    onBackground = Color(0xFF1D2D25), surface = Color.White,
    onSurface = Color(0xFF1D2D25), surfaceVariant = Color(0xFFECF0E9),
    onSurfaceVariant = Color(0xFF4E6256), outline = Color(0xFF738478),
    outlineVariant = Color(0xFFDCE4DA)
)
private val DarkColors = darkColorScheme(
    primary = Color(0xFFAAD1B8), onPrimary = Color(0xFF123828),
    primaryContainer = Color(0xFF244D39), onPrimaryContainer = Color(0xFFD7EEDD),
    secondary = Color(0xFFE6C586), onSecondary = Color(0xFF3F2D0B),
    secondaryContainer = Color(0xFF55421F), onSecondaryContainer = Color(0xFFFFE8BB),
    tertiary = Color(0xFFB7CBBE), background = Color(0xFF111B16),
    onBackground = Color(0xFFE0ECE2), surface = Color(0xFF1B2921),
    onSurface = Color(0xFFE0ECE2), surfaceVariant = Color(0xFF293B30),
    onSurfaceVariant = Color(0xFFBCCFC0), outline = Color(0xFF8DA592),
    outlineVariant = Color(0xFF3A5041)
)

@Composable
fun HyenaAppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colors = if (dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (darkTheme) dynamicDarkColorScheme(LocalContext.current) else dynamicLightColorScheme(LocalContext.current)
    } else if (darkTheme) DarkColors else LightColors
    MaterialTheme(
        colorScheme = colors, typography = Typography,
        shapes = Shapes(extraSmall = RoundedCornerShape(12.dp), small = RoundedCornerShape(12.dp), medium = RoundedCornerShape(18.dp), large = RoundedCornerShape(24.dp), extraLarge = RoundedCornerShape(28.dp)),
        content = content
    )
}
