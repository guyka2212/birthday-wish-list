import { useEffect } from "react";
import { getTheme, type Theme } from "@bwl/shared";

/** Applies a guest-shop theme by swapping the CSS variables the Tailwind tokens read from. */
export function useTheme(themeId: string | undefined | null): Theme {
  const theme = getTheme(themeId);
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--t-primary", theme.primary);
    root.setProperty("--t-accent", theme.accent);
    root.setProperty("--t-bg", theme.bg);
    root.setProperty("--t-text", theme.text);
    root.setProperty("--t-on-primary", theme.onPrimary);
    root.setProperty("--t-on-accent", theme.onAccent);
    root.setProperty("--t-card", theme.dark ? "rgba(255,255,255,0.08)" : "#ffffff");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.primary);
  }, [theme]);
  return theme;
}
