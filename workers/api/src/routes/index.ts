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

export const routes = [
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
];
