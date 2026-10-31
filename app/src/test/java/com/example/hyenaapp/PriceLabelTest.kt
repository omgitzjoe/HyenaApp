package com.example.hyenaapp

import com.example.hyenaapp.data.repository.priceLabel
import org.junit.Assert.assertEquals
import org.junit.Test

class PriceLabelTest {
    @Test fun pricesSeparateFreeFromUnknownAndPreserveCurrency() {
        assertEquals("Free",priceLabel("0.00","USD"))
        assertEquals("Price unknown",priceLabel(null,null))
        assertEquals("$10",priceLabel("10.00","USD"))
        assertEquals("$4.99",priceLabel("4.99","USD"))
        assertEquals("10 CAD",priceLabel("10.00","CAD"))
    }
}
