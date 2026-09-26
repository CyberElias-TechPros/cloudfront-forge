/**
 * Theme preference: system / dark / light.
 *
 * The app ships dark-first (the `:root` token set is the dark palette), so
 * "dark" is also the default preference. The resolved class (`dark` or
 * `light`) lives on `<html>` — `styles.css` defines `.light` token overrides —
 * and the preference string is persisted in localStorage so the next visit
 * starts on the right theme.
 *
 * `THEME_INIT_SCRIPT` runs inline in `<head>` before first paint, preventing
 * the flash of the default theme on reload.
 */

export type ThemePreference = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "loopsquad-theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "dark" || value === "light";
}

export function getThemePreference(): ThemePreference {
  if (typeof localStorage === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "dark";
  } catch {
    return "dark";
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(resolved);
    root.dataset["theme"] = preference;
  }
  return resolved;
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private browsing: the session still gets the theme, it just won't persist.
  }
  applyTheme(preference);
}

/**
 * Keep a `system` preference in sync when the OS flips its scheme mid-session.
 * Returns an unsubscribe function.
 */
export function watchSystemTheme(preference: ThemePreference): () => void {
  if (typeof window === "undefined" || !window.matchMedia || preference !== "system") {
    return () => {};
  }
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const onChange = () => applyTheme("system");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * Inline <head> script — keep it dependency-free and exception-safe. Any
 * failure falls back to the dark default rather than a half-classed document.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(p!=="light"&&p!=="dark"&&p!=="system"){p="dark";}
var r=p;
if(p==="system"){r=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark";}
var c=document.documentElement.classList;
c.remove("dark","light");c.add(r);
document.documentElement.setAttribute("data-theme",p);
}catch(e){document.documentElement.classList.add("dark");}})();`;
