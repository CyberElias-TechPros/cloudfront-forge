// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Dev-server proxy: the frontend calls same-origin /api/* and Vite forwards the
    // requests to the local Cloudflare Worker. This removes CORS from local development
    // entirely (VITE_API_URL can still override for a remote API).
    server: {
      // Allow the sandbox/preview proxy host so the app is reachable in hosted previews.
      allowedHosts: true,
      proxy: {
        "/api": {
          target: process.env["API_PROXY_TARGET"] ?? "http://localhost:8787",
          changeOrigin: true,
        },
        "/health": {
          target: process.env["API_PROXY_TARGET"] ?? "http://localhost:8787",
          changeOrigin: true,
        },
      },
    },
  },
});
