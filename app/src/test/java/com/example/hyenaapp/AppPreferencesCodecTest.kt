package com.example.hyenaapp

import com.example.hyenaapp.data.repository.AppPreferences
import com.example.hyenaapp.data.repository.AppPreferencesCodec
import com.example.hyenaapp.data.repository.DiscoveryFilters
import com.example.hyenaapp.data.repository.parseDiscoveryRadiusMiles
import org.junit.Assert.*
import org.junit.Test

class AppPreferencesCodecTest {
    @Test
    fun firstLaunchAndMalformedDataUseLightThemeWithDefaultFilters() {
        assertEquals(AppPreferences(), AppPreferencesCodec.decode(null))
        assertEquals(AppPreferences(), AppPreferencesCodec.decode("broken"))
        assertEquals("light", AppPreferencesCodec.decode("{\"theme\":\"system\"}").theme)
    }

    @Test
    fun roundTripRestoresThemeRadiusAndEveryAppliedFilter() {
        val choices = AppPreferences("dark", 50, DiscoveryFilters(
            "Café music", listOf("00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"),
            "date", "2030-05-10", "max", "12.50"
        ))
        assertEquals(choices, AppPreferencesCodec.decode(AppPreferencesCodec.encode(choices)))
        assertFalse(AppPreferencesCodec.encode(choices).contains("latitude"))
    }

    @Test
    fun badDatesAndUnsupportedValuesCannotBreakTheNextSearch() {
        val restored = AppPreferencesCodec.decode("""{"theme":"dark","radiusMiles":101,"filters":{"window":"date","date":"2030-02-30","priceMode":"bad","maxPrice":"-5","categoryIds":["bad",{},"00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000001"]}}""")
        assertEquals("dark", restored.theme)
        assertEquals(10, restored.radiusMiles)
        assertEquals("today", restored.filters.window)
        assertNull(restored.filters.date)
        assertEquals("any", restored.filters.priceMode)
        assertEquals("25.00", restored.filters.maxPrice)
        assertEquals(1, restored.filters.categoryIds.size)
    }

    @Test
    fun customWholeMileRadiusSurvivesReload() {
        for (miles in listOf(1, 7, 25, 99, 100)) {
            val choices = AppPreferences(radiusMiles = miles)
            assertEquals(choices, AppPreferencesCodec.decode(AppPreferencesCodec.encode(choices)))
            assertEquals(miles, parseDiscoveryRadiusMiles(" $miles "))
        }
        assertEquals(7, AppPreferencesCodec.decode("""{"radiusMiles":7.0}""").radiusMiles)
    }

    @Test
    fun invalidCustomDistanceIsNotAppliedOrRestored() {
        for (value in listOf("", "0", "-1", "101", "7.5", "999999999999", "NaN", "abc")) {
            assertNull("Input $value should be rejected", parseDiscoveryRadiusMiles(value))
        }
        for (value in listOf("0", "-1", "101", "7.5", "true", "\"7\"", "null")) {
            assertEquals(10, AppPreferencesCodec.decode("""{"radiusMiles":$value}""").radiusMiles)
        }
    }
}
