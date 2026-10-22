import type { RouteDefinition } from "../types";
import { withIdempotency } from "../middleware/idempotency";
import { authRoutes } from "./auth";
import { userRoutes } from "./users";
import { accountRoutes } from "./account";
import { communityRoutes } from "./communities";
import { communityManagementRoutes } from "./community-management";
import { supportRoutes } from "./support";
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
/**
 * Writes where a lost response costs something real if it is retried blindly:
 * a duplicate submission, a duplicated payout, a second credit spend or a
 * second transfer claim. They accept `Idempotency-Key` and replay the first
 * successful outcome for 24 hours (PLAT-010). Requests without the header
 * behave exactly as before.
 */
const IDEMPOTENT_WRITES: Array<{ method: "POST"; path: string; scope: string }> = [
  { method: "POST", path: "/api/v1/videos", scope: "videos.submit" },
  { method: "POST", path: "/api/v1/watch", scope: "watch.claim" },
  { method: "POST", path: "/api/v1/shop/purchase", scope: "shop.purchase" },
  { method: "POST", path: "/api/v1/topups", scope: "topups.request" },
];

function idempotent(routeList: RouteDefinition[]): RouteDefinition[] {
  return routeList.map((route) => {
    const spec = IDEMPOTENT_WRITES.find(
      (candidate) => candidate.method === route.method && candidate.path === route.path,
    );
    return spec ? withIdempotency(route, spec.scope) : route;
  });
}

export const routes: RouteDefinition[] = [
  ...authRoutes,
  ...userRoutes,
  ...accountRoutes,
  ...communityRoutes,
  ...communityManagementRoutes,
  ...supportRoutes,
  ...idempotent(videoRoutes),
  ...reviewRoutes,
  ...missionRoutes,
  ...gamificationRoutes,
  ...adminRoutes,
  ...notificationRoutes,
  ...feedRoutes,
  ...idempotent(watchRoutes),
  ...aiRoutes,
  ...youtubeRoutes,
  ...searchRoutes,
  ...reportRoutes,
  ...idempotent(shopRoutes),
  ...idempotent(topupRoutes),
  ...discoverRoutes,
];
