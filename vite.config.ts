// The frontend is deployed to Vercel as a static single-page app; all data lives
// behind the Cloudflare Workers API in `workers/api`. Building an SSR bundle
// would push the app onto a second runtime and duplicate the backend, so we
// build the client bundle (plus a prerendered landing page for SEO) only.
//
// @lovable.dev/vite-tanstack-config already provides — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss,
//     tsConfigPaths, VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // SPA mode: no Node/Worker server is emitted. `dist/client/_shell.html`
    // doubles as the prerendered landing page; `scripts/postbuild-spa.mjs`
    // publishes it as `index.html` so Vercel can serve the SPA fallback.
    spa: { enabled: true },
  },
  // No server output — Vercel serves the static build, Cloudflare Workers
  // serves the API. (`nitro: false` disables the Cloudflare-target build.)
  nitro: false,
  vite: {
    server: {
      // Allow the sandbox/preview proxy host so the app is reachable in hosted
      // previews.
      allowedHosts: true,
      // Dev-server proxy: the SPA calls same-origin /api/* and Vite forwards the
      // requests to the local Cloudflare Worker, so local development needs no
      // CORS configuration at all (VITE_API_URL still wins when set).
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
