#!/usr/bin/env node
/**
 * Post-build step for the Vercel (static SPA) build.
 *
 * `vite build` in TanStack Start SPA mode writes `dist/client/_shell.html`,
 * which is both the app shell and the prerendered landing page. Vercel needs a
 * conventional `index.html` for the directory root and for the SPA fallback
 * rewrite, so we publish the shell as `index.html` and emit supporting SEO
 * files. The script also fails the build if a secret-shaped string ever makes
 * it into the public bundle.
 */
import { copyFile, readdir, readFile, writeFile, stat, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "dist", "client");
const shellPath = path.join(outDir, "_shell.html");
const indexPath = path.join(outDir, "index.html");
const siteUrl = (process.env.SITE_URL ?? process.env.VITE_SITE_URL ?? "").replace(/\/+$/, "");

// Public, crawlable routes. Everything behind auth is intentionally absent and
// is blocked for crawlers by robots.txt.
const PUBLIC_ROUTES = ["/", "/rules", "/resources", "/privacy", "/terms"];

function fail(message) {
  console.error(`\n[postbuild] ${message}`);
  process.exit(1);
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

if (!existsSync(shellPath)) {
  fail(`expected SPA shell at ${shellPath}. Did "vite build" run in SPA mode?`);
}

await copyFile(shellPath, indexPath);

let html = await readFile(indexPath, "utf8");

// Static, JS-independent metadata for crawlers and link previews. The router
// keeps these updated client-side; these are the no-JS fallback values.
if (siteUrl) {
  const canonical = `<link rel="canonical" href="${siteUrl}/"/>`;
  if (!html.includes('rel="canonical"')) {
    html = html.replace("</head>", `  ${canonical}\n  </head>`);
  }
}

await writeFile(indexPath, html);

if (siteUrl) {
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PUBLIC_ROUTES.map(
  (route) => `  <url><loc>${siteUrl}${route}</loc><lastmod>${today}</lastmod></url>`,
).join("\n")}
</urlset>
`;
  await writeFile(path.join(outDir, "sitemap.xml"), sitemap);

  const robots = `User-agent: *
Allow: /$
Allow: /rules$
Allow: /resources$
Allow: /privacy$
Allow: /terms$
Disallow: /dashboard
Disallow: /queue
Disallow: /admin
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml
`;
  await writeFile(path.join(outDir, "robots.txt"), robots);
}

// Leak guard: nothing secret-shaped may ship to the browser.
const SECRET_PATTERNS = [
  { name: "PEM private key", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  {
    name: "Google service-account client_id",
    re: /\d{12}-[a-z0-9]{32}\.apps\.googleusercontent\.com/,
  },
  { name: "OAuth client_secret", re: /"client_secret"\s*:\s*"[^"]{8,}"/ },
  { name: "VAPID private key", re: /VAPID_PRIVATE_KEY\s*[:=]\s*["'][^"']{20,}["']/ },
  { name: "OpenAI-style API key", re: /sk-[A-Za-z0-9]{32,}/ },
];

const bundleFiles = (await walk(outDir)).filter((file) =>
  /\.(js|mjs|css|html|json|map)$/.test(file),
);
const leaks = [];
for (const file of bundleFiles) {
  const content = await readFile(file, "utf8");
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(content)) leaks.push(`${path.relative(outDir, file)}: ${name}`);
  }
}
if (leaks.length > 0) {
  fail(`possible secret in public bundle:\n  - ${leaks.join("\n  - ")}`);
}

// TanStack Start still writes an SSR bundle next to the client build even in
// SPA mode. Nothing deploys it (Vercel publishes `dist/client` only), but
// leaving it behind invites someone to deploy a second runtime — and it would
// silently re-introduce the two-backend architecture this project moved away
// from.
const serverDir = path.join(root, "dist", "server");
if (existsSync(serverDir)) {
  await rm(serverDir, { recursive: true, force: true });
  console.log("[postbuild] removed dist/server (static SPA deployment)");
}

const size = async (file) => (await stat(file)).size;
const assets = (await walk(path.join(outDir, "assets"))).filter((f) => f.endsWith(".js"));
let total = 0;
for (const asset of assets) total += await size(asset);

console.log(
  `[postbuild] index.html published, ${bundleFiles.length} files scanned, ` +
    `${assets.length} JS chunks totalling ${(total / 1024).toFixed(1)} kB` +
    (siteUrl ? `, sitemap.xml + robots.txt written for ${siteUrl}` : " (set SITE_URL for sitemap)"),
);
