package com.example.hyenaapp.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.example.hyenaapp.domain.model.EventCategory
import java.util.Locale

private fun kind(category: EventCategory): String {
    val name = "${category.name} ${category.slug}".lowercase(Locale.ROOT)
    return when {
        "game" in name -> "games"
        listOf("movie", "cinema", "film").any { it in name } -> "movies"
        listOf("season", "holiday", "festival").any { it in name } -> "seasonal"
        "family" in name -> "family"
        listOf("food", "dining", "drink", "restaurant").any { it in name } -> "food"
        listOf("music", "concert").any { it in name } -> "music"
        listOf("outdoor", "nature", "hike").any { it in name } -> "outdoors"
        listOf("art", "craft", "theater", "culture").any { it in name } -> "arts"
        listOf("sport", "fitness", "recreation").any { it in name } -> "sports"
        listOf("learn", "education", "workshop").any { it in name } -> "learning"
        listOf("shop", "market").any { it in name } -> "market"
        else -> "community"
    }
}
internal fun categoryColor(category: EventCategory): Color = when (kind(category)) {
    "games" -> Color(0xFF6755B5)
    "movies" -> Color(0xFF905231)
    "seasonal" -> Color(0xFF9E541B)
    "family" -> Color(0xFF9B456C)
    "food" -> Color(0xFFB95813)
    "music" -> Color(0xFF7953AA)
    "outdoors" -> Color(0xFF28754A)
    "arts" -> Color(0xFFAC4273)
    "sports" -> Color(0xFF256DA0)
    "learning" -> Color(0xFF756213)
    "market" -> Color(0xFF237A7A)
    else -> Color(0xFF57677D)
}
@Composable
internal fun CategoryChip(category: EventCategory) {
    val accent = categoryColor(category)
    Surface(color = accent.copy(alpha = 0.12f), shape = MaterialTheme.shapes.small) {
        Row(Modifier.padding(horizontal = 9.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            val ink = MaterialTheme.colorScheme.onSurface
            Canvas(Modifier.size(18.dp)) {
                val u = size.width / 24f
                fun line(x: Float, y: Float, x2: Float, y2: Float) = drawLine(ink, Offset(x*u,y*u),Offset(x2*u,y2*u),2*u)
                fun circle(x: Float,y: Float,r: Float) = drawCircle(ink,r*u,Offset(x*u,y*u),style=Stroke(1.8f*u))
                when(kind(category)) {
                    "games" -> { line(4f,4f,20f,4f);line(20f,4f,20f,20f);line(20f,20f,4f,20f);line(4f,20f,4f,4f);circle(8f,8f,1f);circle(16f,16f,1f);circle(12f,12f,1f) }
                    "movies" -> { line(3f,5f,21f,5f);line(21f,5f,21f,20f);line(21f,20f,3f,20f);line(3f,20f,3f,5f);line(3f,10f,21f,10f);line(7f,5f,11f,10f);line(14f,5f,18f,10f) }
                    "seasonal" -> { circle(12f,12f,5f);line(12f,1f,12f,4f);line(12f,20f,12f,23f);line(1f,12f,4f,12f);line(20f,12f,23f,12f);line(4f,4f,6f,6f);line(18f,18f,20f,20f) }
                    "food" -> { line(6f,3f,6f,21f); line(3f,3f,3f,9f); line(9f,3f,9f,9f);line(3f,9f,9f,9f);line(18f,3f,18f,21f);line(15f,3f,15f,12f);line(15f,12f,18f,12f) }
                    "music" -> { circle(6f,18f,3f);circle(17f,16f,3f);line(9f,18f,9f,5f);line(20f,16f,20f,3f);line(9f,5f,20f,3f) }
                    "outdoors" -> { line(12f,2f,3f,17f);line(3f,17f,21f,17f);line(21f,17f,12f,2f);line(12f,17f,12f,22f) }
                    "sports" -> { circle(12f,12f,9f);line(3f,12f,21f,12f);line(12f,3f,12f,21f) }
                    "arts" -> { circle(12f,12f,9f);circle(8f,8f,1f);circle(15f,7f,1f);circle(7f,14f,1f);circle(16f,15f,2f) }
                    "learning" -> { line(12f,5f,3f,3f);line(3f,3f,3f,18f);line(3f,18f,12f,21f);line(12f,21f,21f,18f);line(21f,18f,21f,3f);line(21f,3f,12f,5f);line(12f,5f,12f,21f) }
                    "market" -> { line(4f,8f,20f,8f);line(20f,8f,20f,21f);line(20f,21f,4f,21f);line(4f,21f,4f,8f);circle(12f,7f,4f) }
                    else -> { circle(8f,7f,3f);circle(17f,8f,2f);line(3f,21f,3f,16f);line(3f,16f,13f,16f);line(13f,16f,13f,21f);line(16f,15f,21f,15f);line(21f,15f,21f,21f) }
                }
            }
            Text(category.name, style = MaterialTheme.typography.labelMedium)
        }
    }
}
