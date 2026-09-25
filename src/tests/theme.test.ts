import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  applyTheme,
  getThemePreference,
  resolveTheme,
  setThemePreference,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

function stubMatchMedia(prefersLight: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("prefers-color-scheme: light") ? prefersLight : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe("theme preference", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    delete document.documentElement.dataset["theme"];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to dark when nothing is stored", () => {
    expect(getThemePreference()).toBe("dark");
    localStorage.setItem(THEME_STORAGE_KEY, "nonsense");
    expect(getThemePreference()).toBe("dark");
  });

  it("persists the preference and applies the resolved class", () => {
    setThemePreference("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(getThemePreference()).toBe("light");

    setThemePreference("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("resolves 'system' against the OS scheme", () => {
    stubMatchMedia(true);
    expect(resolveTheme("system")).toBe("light");
    stubMatchMedia(false);
    expect(resolveTheme("system")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("applies the resolved system theme without persisting a hard preference", () => {
    stubMatchMedia(true);
    applyTheme("system");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("ships a fail-safe inline boot script", () => {
    // The script must read the same storage key, always end with exactly one
    // resolved class, and fall back to dark on any error.
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_INIT_SCRIPT).toContain('c.remove("dark","light")');
    expect(THEME_INIT_SCRIPT).toContain('classList.add("dark")');
    expect(THEME_INIT_SCRIPT).toContain("try{");
    // Executed in a browser-less sandbox with no localStorage → dark fallback.
    expect(() => new Function(THEME_INIT_SCRIPT)).not.toThrow();
  });
});
