/**
 * Auto-updater integration using electron-updater.
 * electron-updater must be listed in dependencies for this to activate.
 * In dev mode or when the package is absent the module is skipped gracefully.
 */
import { dialog, BrowserWindow } from "electron";

// Interval between periodic update checks (4 hours in ms)
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
// Delay before the first check after startup (10 seconds)
const STARTUP_DELAY_MS = 10_000;

/** Resolve the best available window for dialogs. */
function getWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

type AutoUpdaterLike = {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  checkForUpdates: () => Promise<unknown>;
  quitAndInstall: () => void;
};

function isAutoUpdaterLike(value: unknown): value is AutoUpdaterLike {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as {
    on?: unknown;
    checkForUpdates?: unknown;
    quitAndInstall?: unknown;
  };
  return typeof candidate.on === "function"
    && typeof candidate.checkForUpdates === "function"
    && typeof candidate.quitAndInstall === "function";
}

/**
 * Wire up electron-updater event listeners.
 * Returns the autoUpdater instance, or null when unavailable.
 */
function initAutoUpdater(): AutoUpdaterLike | null {
  let autoUpdater: AutoUpdaterLike;
  try {
    // Dynamic require keeps the build working even when electron-updater is absent.
    // Using require (not import()) because electron-updater is a CommonJS package
    // and mixing static imports with dynamic imports for the same specifier is disallowed.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("electron-updater") as { autoUpdater?: unknown };
    if (!isAutoUpdaterLike(mod.autoUpdater)) {
      throw new Error("auto-updater: invalid electron-updater export");
    }
    autoUpdater = mod.autoUpdater;
  } catch {
    // electron-updater not installed — silently skip (expected in dev/unpackaged builds)
    console.log("auto-updater: electron-updater not available, skipping");
    return null;
  }

  // Disable auto-download so we can control when the download happens
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("auto-updater: checking for update…");
  });

  autoUpdater.on("update-available", (info: { version: string }) => {
    console.log(`auto-updater: update available — v${info.version}`);
    const win = getWindow();
    if (win) {
      void dialog.showMessageBox(win, {
        type: "info",
        title: "Update Available",
        message: `A new version (${info.version}) is available and downloading in the background.`,
        buttons: ["OK"],
      });
    }
  });

  autoUpdater.on("update-not-available", (info: { version: string }) => {
    console.log(`auto-updater: up to date (v${info.version})`);
  });

  autoUpdater.on("download-progress", (progress: { percent: number; bytesPerSecond: number }) => {
    console.log(
      `auto-updater: downloading — ${progress.percent.toFixed(1)}% (${Math.round(progress.bytesPerSecond / 1024)} KB/s)`,
    );
  });

  autoUpdater.on("update-downloaded", (info: { version: string }) => {
    console.log(`auto-updater: update downloaded — v${info.version}`);
    const win = getWindow();
    const showDialog = win
      ? dialog.showMessageBox(win, {
          type: "question",
          title: "Update Ready",
          message: `Version ${info.version} has been downloaded. Restart now to install?`,
          buttons: ["Restart Now", "Later"],
          defaultId: 0,
          cancelId: 1,
        })
      : Promise.resolve({ response: 0 });

    void showDialog.then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on("error", (err: Error) => {
    // Log but never crash — update failures should be non-fatal
    console.error("auto-updater: error —", err?.message ?? err);
  });

  return autoUpdater;
}

/**
 * Set up automatic update checks.
 * Called once from the main process after the app is ready.
 * The mainWindow parameter is accepted for API compatibility but the
 * implementation resolves the window dynamically so callers may omit it.
 */
export function setupAutoUpdater(_mainWindow?: BrowserWindow): void {
  const autoUpdater = initAutoUpdater();
  if (!autoUpdater) {return;}

  // First check after a short startup delay to avoid slowing app launch
  const startupTimer = setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error("auto-updater: startup check failed —", err?.message ?? err);
    });
  }, STARTUP_DELAY_MS);
  // Allow Node to exit cleanly even if the timer is still pending
  startupTimer.unref?.();

  // Periodic check every 4 hours
  const interval = setInterval(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error("auto-updater: periodic check failed —", err?.message ?? err);
    });
  }, CHECK_INTERVAL_MS);
  interval.unref?.();
}

/**
 * Trigger an immediate update check.
 * Intended for menu items ("Check for Updates…").
 */
export function checkForUpdatesManually(): void {
  let autoUpdater: AutoUpdaterLike;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("electron-updater") as { autoUpdater?: unknown };
    if (!isAutoUpdaterLike(mod.autoUpdater)) {
      throw new Error("auto-updater: invalid electron-updater export");
    }
    autoUpdater = mod.autoUpdater;
  } catch {
    const win = getWindow();
    if (win) {
      void dialog.showMessageBox(win, {
        type: "info",
        title: "Update Check Unavailable",
        message: "Automatic updates are not configured in this build.",
        buttons: ["OK"],
      });
    }
    return;
  }

  autoUpdater.checkForUpdates().catch((err: Error) => {
    console.error("auto-updater: manual check failed —", err?.message ?? err);
  });
}
