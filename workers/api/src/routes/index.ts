import type { RouteDefinition } from "../types";
import { authRoutes } from "./auth";
import { userRoutes } from "./users";
import { communityRoutes } from "./communities";
import { videoRoutes, reviewRoutes } from "./videos";
import { missionRoutes } from "./missions";
import { gamificationRoutes } from "./gamification";
import { adminRoutes } from "./admin";
import { notificationRoutes } from "./notifications";
import { feedRoutes } from "./feed";
import { watchRoutes } from "./watch";
import { aiRoutes } from "./ai";
import { youtubeRoutes } from "./youtube";
import { searchRoutes } from "./search";
import { reportRoutes } from "./reports";
import { shopRoutes } from "./shop";
import { topupRoutes } from "./topups";
import { discoverRoutes } from "./discover";

/**
 * Every route in the API.
 *
 * This is the single source of truth: the worker entry point routes through
 * this list and the routing tests assert every entry is reachable, so a route
 * can never be declared but unroutable again.
 */
export const routes: RouteDefinition[] = [
  ...authRoutes,
  ...userRoutes,
  ...communityRoutes,
  ...videoRoutes,
  ...reviewRoutes,
  ...missionRoutes,
  ...gamificationRoutes,
  ...adminRoutes,
  ...notificationRoutes,
  ...feedRoutes,
  ...watchRoutes,
  ...aiRoutes,
  ...youtubeRoutes,
  ...searchRoutes,
  ...reportRoutes,
  ...shopRoutes,
  ...topupRoutes,
  ...discoverRoutes,
];
