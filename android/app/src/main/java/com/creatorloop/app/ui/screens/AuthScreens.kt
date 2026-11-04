package com.creatorloop.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Loop
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.creatorloop.app.ui.AppState
import com.creatorloop.app.ui.MessageBanner

@Composable
fun AuthScreen(viewModel: AuthViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var emailMode by remember { mutableStateOf(false) }
    var create by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Icon(Icons.Default.Loop, contentDescription = null, modifier = Modifier.size(72.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(16.dp))
        Text("LoopSquad", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text("Grow together with creators who actually watch.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(32.dp))
        MessageBanner(state.error, error = true)
        MessageBanner(state.message)
        Button(onClick = { viewModel.google(context) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth().height(52.dp)) {
            Text(if (state.busy) "Signing in…" else "Continue with Google")
        }
        Spacer(Modifier.height(12.dp))
        TextButton(onClick = { emailMode = !emailMode }) { Text(if (emailMode) "Hide email sign-in" else "Use email instead") }
        if (emailMode) {
            OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(password, { password = it }, label = { Text("Password") }, singleLine = true,
                visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(12.dp))
            Button(onClick = { viewModel.email(email, password, create) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) {
                Text(if (create) "Create account" else "Sign in")
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = { create = !create }) { Text(if (create) "Have an account?" else "Create account") }
                TextButton(onClick = { viewModel.reset(email) }, enabled = email.isNotBlank()) { Text("Reset password") }
            }
        }
        Spacer(Modifier.height(24.dp))
        Text("By continuing you agree to fair, genuine engagement. No fake views or subscribers.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun ConsentScreen(state: AppState, onAccept: (Boolean) -> Unit, onSignOut: () -> Unit, onLegal: (String) -> Unit) {
    var terms by remember { mutableStateOf(false) }
    var privacy by remember { mutableStateOf(false) }
    var age by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp)) {
        Text("Before you join", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text("LoopSquad rewards genuine feedback and verified attention. Please confirm the following.", style = MaterialTheme.typography.bodyLarge)
        Spacer(Modifier.height(24.dp))
        ConsentRow(terms, { terms = it }, "I accept the Terms of Service", { onLegal("terms") })
        ConsentRow(privacy, { privacy = it }, "I accept the Privacy Policy", { onLegal("privacy") })
        ConsentRow(age, { age = it }, "I am at least 13 years old (or the minimum age in my country)", null)
        Spacer(Modifier.height(16.dp))
        MessageBanner(state.error, error = true)
        Button(onClick = { onAccept(age) }, enabled = terms && privacy && age && !state.busy, modifier = Modifier.fillMaxWidth().height(52.dp)) {
            Text(if (state.busy) "Saving…" else "Accept and continue")
        }
        TextButton(onClick = onSignOut, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Sign out") }
    }
}

@Composable
private fun ConsentRow(checked: Boolean, onChange: (Boolean) -> Unit, label: String, onLink: (() -> Unit)?) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked, onChange)
        Column(Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.bodyLarge)
            if (onLink != null) TextButton(onClick = onLink, contentPadding = PaddingValues(0.dp)) { Text("Read") }
        }
    }
}

@Composable
fun LegalScreen(page: String) {
    val sections = when (page) {
        "privacy" -> listOf(
            "What we collect" to "We store your Google account basics, optional YouTube connection, and activity you create: submissions, watch sessions, reviews, points and community membership. Android device tokens are stored encrypted for push notifications.",
            "How we use it" to "To run the fair queue, verify attention, deliver feedback, maintain leaderboards, prevent abuse, and send notifications you allow.",
            "Third parties" to "Firebase (authentication), Cloudflare (API/database), Google/YouTube (OAuth and playback), and Google Play (billing). Each processes data under its own policy.",
            "Retention and deletion" to "You can delete your account from Profile. Some activity may be retained in anonymised form to keep reputation and leaderboards accurate.",
            "Contact" to "Privacy questions: info@techpros.com.ng"
        )
        "rules" -> listOf(
            "Fair engagement" to "Watch genuinely, leave specific feedback, and never use bots, paid engagement, or recycled comments.",
            "Verified attention" to "Rewards require server-verified watch time and attention checks. External playback is not verified.",
            "Respect" to "No harassment, spam, impersonation, or manipulation. Moderators may remove content and suspend accounts."
        )
        else -> listOf(
            "What LoopSquad is" to "A community where YouTube creators exchange genuine feedback and support. It is not a service for buying or artificially inflating views or subscribers.",
            "Acceptable use" to "Do not manipulate engagement on YouTube or any platform. Comply with YouTube Terms and Google program policies.",
            "Points and credits" to "XP and credits are in-platform only, have no cash value, and cannot be withdrawn. Play credit purchases are verified server-side.",
            "Your content" to "You are responsible for submissions and feedback. Harassment, spam and impersonation may result in suspension.",
            "No guarantees" to "Growth depends on your content and participation. The service is provided as-is.",
            "Contact" to "info@techpros.com.ng"
        )
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp)) {
        Text(when (page) { "privacy" -> "Privacy Policy"; "rules" -> "Community Rules"; else -> "Terms of Service" }, style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(16.dp))
        sections.forEach { (title, body) ->
            Text(title, style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(4.dp))
            Text(body, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(20.dp))
        }
        Text("Policy version 2026-11-03", style = MaterialTheme.typography.bodySmall)
    }
}
