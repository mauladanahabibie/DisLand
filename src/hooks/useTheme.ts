import { useEffect } from "react";
import type { AccentColor } from "@/types";
import { ACCENT_HUES } from "@/types";

/** Apply the theme class and accent hue CSS variable to the document root. */
export function useThemeApplier(theme: "dark" | "light", accent: AccentColor) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
    }
    root.style.setProperty("--accent-h", String(ACCENT_HUES[accent]));
  }, [theme, accent]);
}
