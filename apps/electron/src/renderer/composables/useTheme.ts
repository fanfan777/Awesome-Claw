import { ref, computed, watchEffect } from "vue";
import { darkTheme, type GlobalTheme } from "naive-ui";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "openclaw:theme";

function loadThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // ignore
  }
  return "system";
}

function getSystemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

// Module-level reactive state so theme is shared across all composable calls.
const mode = ref<ThemeMode>(loadThemeMode());
const systemDark = ref(getSystemPrefersDark());

// Watch system preference changes.
if (typeof window !== "undefined" && window.matchMedia) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", (e) => {
    systemDark.value = e.matches;
  });
}

/**
 * Composable for app-wide theme management.
 * Returns the naive-ui theme object and helpers for toggling mode.
 */
export function useTheme() {
  const isDark = computed(() => {
    if (mode.value === "dark") {return true;}
    if (mode.value === "light") {return false;}
    return systemDark.value;
  });

  // naive-ui theme: darkTheme or null (light)
  const naiveTheme = computed<GlobalTheme | null>(() =>
    isDark.value ? darkTheme : null,
  );

  function setMode(newMode: ThemeMode): void {
    mode.value = newMode;
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // ignore
    }
  }

  // Apply data-theme attribute to <html> so CSS can respond.
  watchEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute(
        "data-theme",
        isDark.value ? "dark" : "light",
      );
    }
  });

  return {
    mode,
    isDark,
    naiveTheme,
    setMode,
  };
}
