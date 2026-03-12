import { app, BrowserWindow } from "electron";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const STATE_PATH = join(app.getPath("home"), ".openclaw", "electron-window-state.json");
const DEFAULT_STATE: WindowState = { width: 1200, height: 800, isMaximized: false };

export function loadWindowState(): WindowState {
  try {
    const raw = readFileSync(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<WindowState>;
    return {
      x: typeof parsed.x === "number" ? parsed.x : undefined,
      y: typeof parsed.y === "number" ? parsed.y : undefined,
      width: typeof parsed.width === "number" && parsed.width >= 900 ? parsed.width : DEFAULT_STATE.width,
      height: typeof parsed.height === "number" && parsed.height >= 600 ? parsed.height : DEFAULT_STATE.height,
      isMaximized: parsed.isMaximized === true,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const bounds = win.getBounds();
    const state: WindowState = {
      ...bounds,
      isMaximized: win.isMaximized(),
    };
    mkdirSync(dirname(STATE_PATH), { recursive: true });
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Non-fatal: ignore save errors
  }
}

export function setupWindowStateSave(win: BrowserWindow): void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const debouncedSave = (): void => {
    if (debounceTimer) {clearTimeout(debounceTimer);}
    debounceTimer = setTimeout(() => saveWindowState(win), 500);
  };

  win.on("resize", debouncedSave);
  win.on("move", debouncedSave);
  win.on("close", () => {
    if (debounceTimer) {clearTimeout(debounceTimer);}
    saveWindowState(win);
  });
}
