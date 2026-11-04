package com.creatorloop.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.creatorloop.app.data.ThemeMode

val Coral = Color(0xFFFF6B4A)
val Gold = Color(0xFFF6C453)
val Mint = Color(0xFF7BE0AD)
val Ink = Color(0xFF17141F)
val SurfaceDark = Color(0xFF221E2B)
private val DarkColors = darkColorScheme(primary = Coral, onPrimary = Color(0xFF2A0E06), secondary = Gold, onSecondary = Color(0xFF2A2006),
    tertiary = Mint, background = Ink, onBackground = Color(0xFFF5F1FA), surface = SurfaceDark, onSurface = Color(0xFFF5F1FA),
    surfaceVariant = Color(0xFF2E2839), onSurfaceVariant = Color(0xFFC9C1D6), outline = Color(0xFF554D63), error = Color(0xFFFFB4AB))
private val LightColors = lightColorScheme(primary = Color(0xFFD8432A), onPrimary = Color.White, secondary = Color(0xFF8A6D00),
    tertiary = Color(0xFF006C4C), background = Color(0xFFFFF8F6), surface = Color.White, surfaceVariant = Color(0xFFF3E9E6),
    onSurface = Color(0xFF221917), onSurfaceVariant = Color(0xFF5B4D49), outline = Color(0xFF8D7B76))

private val LoopTypography = Typography(
    headlineLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 32.sp, lineHeight = 38.sp),
    headlineMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 34.sp),
    titleLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 22.sp, lineHeight = 28.sp),
    titleMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
)

@Composable
fun LoopTheme(mode: ThemeMode = ThemeMode.DARK, content: @Composable () -> Unit) {
    val dark = when (mode) { ThemeMode.SYSTEM -> isSystemInDarkTheme(); ThemeMode.LIGHT -> false; ThemeMode.DARK -> true }
    MaterialTheme(colorScheme = if (dark) DarkColors else LightColors, typography = LoopTypography,
        shapes = Shapes(extraSmall = RoundedCornerShape(10.dp), small = RoundedCornerShape(14.dp), medium = RoundedCornerShape(20.dp), large = RoundedCornerShape(28.dp), extraLarge = RoundedCornerShape(32.dp)),
        content = content)
}
