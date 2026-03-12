import { Tray, Menu, BrowserWindow, app, nativeImage } from "electron";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { GatewayState } from "./gateway-process.js";
import { gatewayProcess } from "./gateway-process.js";
import { resolveCliPath } from "./cli-resolver.js";

let tray: Tray | null = null;

function getIcon(): Electron.NativeImage {
  const iconPath = join(__dirname, "..", "..", "resources", "tray-icon.png");
  if (existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath);
  }
  // Fallback: empty image; tray label "OC" will be set below
  return nativeImage.createEmpty();
}

function buildContextMenu(mainWindow: BrowserWindow): Electron.Menu {
  const status = gatewayProcess.getStatus();
  const isRunning = status.state === "running" || status.state === "attachedExisting";

  return Menu.buildFromTemplate([
    {
      label: "Show Window",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: "separator" },
    {
      label: `Gateway Status: ${status.state}`,
      enabled: false,
    },
    {
      label: "Gateway",
      submenu: [
        {
          label: "Start",
          enabled: !isRunning,
          click: async () => {
            const cliPath = resolveCliPath();
            if (cliPath) {await gatewayProcess.spawnGateway(cliPath);}
          },
        },
        {
          label: "Stop",
          enabled: isRunning,
          click: async () => {
            await gatewayProcess.stopGateway();
          },
        },
        {
          label: "Restart",
          click: async () => {
            await gatewayProcess.stopGateway();
            const cliPath = resolveCliPath();
            if (cliPath) {await gatewayProcess.spawnGateway(cliPath);}
          },
        },
      ],
    },
    { type: "separator" },
    {
      label: "Quit OpenClaw",
      click: () => app.quit(),
    },
  ]);
}

export function createTray(mainWindow: BrowserWindow): Tray {
  const icon = getIcon();
  tray = new Tray(icon);

  if (icon.isEmpty()) {
    tray.setTitle("OC");
  }

  tray.setToolTip("OpenClaw Desktop");
  tray.setContextMenu(buildContextMenu(mainWindow));

  tray.on("click", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Rebuild menu when gateway state changes
  gatewayProcess.on("stateChange", () => {
    updateTrayStatus(gatewayProcess.getStatus().state);
    tray?.setContextMenu(buildContextMenu(mainWindow));
  });

  return tray;
}

export function updateTrayStatus(state: GatewayState): void {
  if (!tray) {return;}
  const labels: Record<GatewayState, string> = {
    stopped: "OpenClaw Desktop — Gateway stopped",
    starting: "OpenClaw Desktop — Gateway starting…",
    running: "OpenClaw Desktop — Gateway running",
    failed: "OpenClaw Desktop — Gateway failed",
    attachedExisting: "OpenClaw Desktop — Gateway attached",
  };
  tray.setToolTip(labels[state] ?? "OpenClaw Desktop");
}
