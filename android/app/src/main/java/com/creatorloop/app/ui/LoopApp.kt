package com.creatorloop.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavType
import androidx.navigation.compose.*
import androidx.navigation.navArgument
import com.creatorloop.app.data.AuthState
import com.creatorloop.app.ui.screens.*

private val mainRoutes = setOf("home", "queue", "communities", "missions", "profile")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoopApp(state: AppState, appViewModel: AppViewModel, pendingRoute: String?) {
    val navController = rememberNavController()
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route?.substringBefore('?') ?: "loading"
    var consumedRoute by remember { mutableStateOf<String?>(null) }
    var menu by remember { mutableStateOf(false) }

    LaunchedEffect(state.auth, state.consentRequired) {
        val target = when {
            state.auth is AuthState.Loading -> "loading"
            state.auth is AuthState.SignedOut -> "auth"
            state.consentRequired -> "consent"
            else -> "home"
        }
        if (currentRoute != target && (target in setOf("auth", "consent", "home") || currentRoute == "loading")) {
            navController.navigate(target) { popUpTo(navController.graph.id) { inclusive = true }; launchSingleTop = true }
        }
    }
    LaunchedEffect(pendingRoute, state.auth, state.consentRequired) {
        if (pendingRoute != null && pendingRoute != consumedRoute && state.auth is AuthState.SignedIn && !state.consentRequired) {
            consumedRoute = pendingRoute
            navController.navigate(pendingRoute) { launchSingleTop = true }
        }
    }

    if (state.forceUpdate) {
        Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            LoopCard { Text("Update required", style = MaterialTheme.typography.headlineMedium); Text("This version is no longer supported. Please update LoopSquad from Google Play.", style = MaterialTheme.typography.bodyLarge) }
        }
        return
    }

    val showBars = currentRoute !in setOf("auth", "consent", "loading")
    Scaffold(
        topBar = {
            if (showBars) TopAppBar(
                title = { Text(titleFor(currentRoute)) },
                navigationIcon = { if (navController.previousBackStackEntry != null && currentRoute !in mainRoutes) IconButton(onClick = { navController.popBackStack() }) { Icon(Icons.Default.ArrowBack, "Back") } },
                actions = {
                    IconButton(onClick = { navController.navigate("search") { launchSingleTop = true } }) { Icon(Icons.Default.Search, "Search") }
                    IconButton(onClick = { navController.navigate("notifications") { launchSingleTop = true } }) { Icon(Icons.Default.Notifications, "Notifications") }
                    Box {
                        IconButton(onClick = { menu = true }) { Icon(Icons.Default.MoreVert, "More") }
                        DropdownMenu(menu, { menu = false }) {
                            listOf("rewards" to "Rewards & shop", "reviews" to "Reviews", "coach" to "AI Coach", "insights" to "Insights", "leaderboard" to "Leaderboard", "safety" to "Safety", "support" to "Support", "settings" to "Settings").forEach { (route, label) ->
                                DropdownMenuItem(text = { Text(label) }, onClick = { menu = false; navController.navigate(route) { launchSingleTop = true } })
                            }
                        }
                    }
                })
        },
        bottomBar = {
            if (currentRoute in mainRoutes) NavigationBar {
                NavigationBarItem(selected = currentRoute == "home", onClick = { navController.navigate("home") { launchSingleTop = true; popUpTo("home") } }, icon = { Icon(Icons.Default.Home, null) }, label = { Text("Home") })
                NavigationBarItem(selected = currentRoute == "queue", onClick = { navController.navigate("queue") { launchSingleTop = true } }, icon = { Icon(Icons.Default.VideoLibrary, null) }, label = { Text("Queue") })
                NavigationBarItem(selected = currentRoute == "communities", onClick = { navController.navigate("communities") { launchSingleTop = true } }, icon = { Icon(Icons.Default.Groups, null) }, label = { Text("Squads") })
                NavigationBarItem(selected = currentRoute == "missions", onClick = { navController.navigate("missions") { launchSingleTop = true } }, icon = { Icon(Icons.Default.Flag, null) }, label = { Text("Missions") })
                NavigationBarItem(selected = currentRoute == "profile", onClick = { navController.navigate("profile") { launchSingleTop = true } }, icon = { Icon(Icons.Default.Person, null) }, label = { Text("Profile") })
            }
        },
        floatingActionButton = {
            if (currentRoute in setOf("home", "queue")) FloatingActionButton(onClick = { navController.navigate("submit") }) { Icon(Icons.Default.Upload, "Submit video") }
        }
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            if (!state.online) Surface(color = MaterialTheme.colorScheme.secondary.copy(alpha = .2f), modifier = Modifier.fillMaxWidth()) { Text("Offline — showing saved data where available", Modifier.padding(8.dp), style = MaterialTheme.typography.bodySmall) }
            if (state.config.maintenance) Surface(color = MaterialTheme.colorScheme.error.copy(alpha = .15f), modifier = Modifier.fillMaxWidth()) { Text("Service maintenance in progress. Some features may be unavailable.", Modifier.padding(8.dp), style = MaterialTheme.typography.bodySmall) }
            NavHost(navController, startDestination = "loading", modifier = Modifier.fillMaxSize()) {
                composable("loading") { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
                composable("auth") { AuthScreen() }
                composable("consent") { ConsentScreen(state, appViewModel::acceptConsent, appViewModel::signOut) { navController.navigate("legal/$it") } }
                composable("home") { HomeScreen(navController::navigate) }
                composable("queue") { QueueScreen(navController::navigate) }
                composable("submit?url={url}", arguments = listOf(navArgument("url") { type = NavType.StringType; nullable = true; defaultValue = null })) { entry -> SubmitScreen(entry.arguments?.getString("url"), navController::navigate) }
                composable("communities") { CommunitiesScreen(navController::navigate) }
                composable("community/{communityId}", arguments = listOf(navArgument("communityId") { type = NavType.StringType })) { CommunitiesDetailRoute(navController) }
                composable("missions") { MissionsScreen(navController::navigate) }
                composable("reviews") { ReviewsScreen(navController::navigate) }
                composable("review/{reviewId}", arguments = listOf(navArgument("reviewId") { type = NavType.StringType })) { ReviewDetailScreen(navController::navigate) }
                composable("rewards") { RewardsScreen(navController::navigate, state.member?.id) }
                composable("leaderboard") { LeaderboardScreen(navController::navigate) }
                composable("profile") { ProfileScreen(navController::navigate, appViewModel::signOut) }
                composable("member/{memberId}", arguments = listOf(navArgument("memberId") { type = NavType.StringType })) { MemberScreen(navController::navigate) }
                composable("notifications") { NotificationsScreen(navController::navigate) }
                composable("coach") { CoachScreen(navController::navigate) }
                composable("search") { SearchScreen(navController::navigate) }
                composable("insights") { InsightsScreen(navController::navigate) }
                composable("settings?youtube={result}", arguments = listOf(navArgument("result") { type = NavType.StringType; nullable = true; defaultValue = null })) { SettingsScreen(state, appViewModel, navController::navigate) }
                composable("safety") { SafetyScreen(navController::navigate) }
                composable("support") { SupportScreen(navController::navigate) }
                composable("admin") { AdminScreen(navController::navigate) }
                composable("legal/{page}", arguments = listOf(navArgument("page") { type = NavType.StringType })) { entry -> LegalScreen(entry.arguments?.getString("page") ?: "terms") }
                composable("player/{videoId}", arguments = listOf(navArgument("videoId") { type = NavType.StringType })) { PlayerScreen(navController::navigate) }
            }
        }
    }
}

@Composable private fun CommunitiesDetailRoute(navController: androidx.navigation.NavHostController) { CommunityDetailScreen(navController::navigate) }

private fun titleFor(route: String): String = when (route) {
    "home" -> "LoopSquad"; "queue" -> "Watch queue"; "submit" -> "Submit"; "communities" -> "Squads"; "community" -> "Squad"
    "missions" -> "Missions"; "reviews" -> "Reviews"; "review" -> "Review"; "rewards" -> "Rewards"; "leaderboard" -> "Leaderboard"
    "profile" -> "Profile"; "member" -> "Creator"; "notifications" -> "Notifications"; "coach" -> "AI Coach"; "search" -> "Discover"
    "insights" -> "Insights"; "settings" -> "Settings"; "safety" -> "Safety"; "support" -> "Support"; "admin" -> "Admin"; "legal" -> "Legal"; "player" -> "Watch"; else -> "LoopSquad"
}
