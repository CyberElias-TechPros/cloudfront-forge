import { createFileRoute } from "@tanstack/react-router";

// Internal SPA mask route. It is never linked to users; TanStack Start uses it
// while generating the static fallback shell for Vercel deep links.
export const Route = createFileRoute("/shell")({
  component: () => null,
});
