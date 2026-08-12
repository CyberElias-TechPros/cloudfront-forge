import type { Env } from "../types";
import { z } from "zod";

export async function validationMiddleware(request: Request, env: Env): Promise<void> {
  // This middleware would inspect the request URL and method
  // and apply the appropriate Zod schema validation
}

export const paginationSchema = z.object({
  page: z.string().optional().default("1").transform(Number),
  limit: z.string().optional().default("20").transform(Number),
});

export const idSchema = z.object({
  id: z.string().uuid(),
});
