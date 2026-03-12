import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { registerIpcHandlers, unregisterIpcHandlers } from "./ipc-handlers.js";
import { createTray } from "./tray.js";
import { setupAppMenu, setupWindowContextMenu } from "./menu.js";
import { loadWindowState, setupWindowStateSave } from "./window-state.js";
import { setupAutoUpdater } from "./auto-updater.js";
import { gatewayProcess } from "./gateway-process.js";

// Enforce single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const state = loadWindowState();

  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (state.isMaximized) {win.maximize();}

  // Show when ready to avoid white flash
  win.on("ready-to-show", () => win.show());

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    void import("electron").then(({ shell }) => shell.openExternal(url));
    return { action: "deny" };
  });

  // Load renderer
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    void win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  setupWindowStateSave(win);
  setupWindowContextMenu(win);

  return win;
}

void app.whenReady().then(() => {
  // Set app user model id for Windows
  electronApp.setAppUserModelId("ai.openclaw.desktop");

  // Default open/close shortcuts
  app.on("browser-window-created", (_, win) => {
    optimizer.watchWindowShortcuts(win);
  });

  mainWindow = createWindow();

  registerIpcHandlers(mainWindow);
  setupAppMenu();
  createTray(mainWindow);
  setupAutoUpdater();
});

// On second instance, focus existing window
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {mainWindow.restore();}
    mainWindow.focus();
  }
});

// macOS: re-create window when dock icon is clicked and no windows are open
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
    if (mainWindow) {registerIpcHandlers(mainWindow);}
  } else {
    mainWindow?.show();
  }
});

// On non-macOS, quit when all windows are closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {app.quit();}
});

// Cleanup on quit
app.on("before-quit", () => {
  unregisterIpcHandlers();
  gatewayProcess.cleanup();
});
