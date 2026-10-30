package com.example.hyenaapp.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private fun text(size: Int, height: Int, weight: FontWeight = FontWeight.Normal) = TextStyle(
    fontFamily = FontFamily.SansSerif, fontSize = size.sp, lineHeight = height.sp,
    fontWeight = weight, letterSpacing = 0.sp
)
val Typography = Typography(
    headlineLarge = text(32, 38, FontWeight.Bold),
    headlineMedium = text(28, 34, FontWeight.Bold),
    titleLarge = text(21, 28, FontWeight.SemiBold),
    titleMedium = text(17, 24, FontWeight.SemiBold),
    titleSmall = text(15, 21, FontWeight.SemiBold),
    bodyLarge = text(16, 25), bodyMedium = text(14, 22), bodySmall = text(12, 18),
    labelLarge = text(14, 20, FontWeight.SemiBold),
    labelMedium = text(12, 18, FontWeight.SemiBold),
    labelSmall = text(11, 16, FontWeight.SemiBold)
)
