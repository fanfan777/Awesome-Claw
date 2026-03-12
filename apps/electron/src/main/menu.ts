import { app, Menu, shell, BrowserWindow } from "electron";

export function setupAppMenu(): void {
  const isMac = process.platform === "darwin";

  const macAppMenu: Electron.MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: "about" },
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "unhide" },
      { type: "separator" },
      { role: "quit" },
    ],
  };

  const editMenu: Electron.MenuItemConstructorOptions = {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      ...(isMac
        ? [
            { role: "pasteAndMatchStyle" as const },
            { role: "delete" as const },
            { role: "selectAll" as const },
          ]
        : [{ role: "delete" as const }, { type: "separator" as const }, { role: "selectAll" as const }]),
    ],
  };

  const viewMenu: Electron.MenuItemConstructorOptions = {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  };

  const windowMenu: Electron.MenuItemConstructorOptions = {
    label: "Window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      ...(isMac
        ? [{ type: "separator" as const }, { role: "front" as const }]
        : [{ role: "close" as const }]),
    ],
  };

  const helpMenu: Electron.MenuItemConstructorOptions = {
    label: "Help",
    submenu: [
      {
        label: "OpenClaw Docs",
        click: async () => {
          await shell.openExternal("https://docs.openclaw.ai");
        },
      },
      {
        label: "Report Issue",
        click: async () => {
          await shell.openExternal("https://github.com/openclaw/openclaw/issues");
        },
      },
    ],
  };

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [macAppMenu] : []),
    editMenu,
    viewMenu,
    windowMenu,
    helpMenu,
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

export function setupWindowContextMenu(win: BrowserWindow): void {
  // Right-click context menu is handled by the renderer via webContents
  win.webContents.on("context-menu", (_e, params) => {
    const menuItems: Electron.MenuItemConstructorOptions[] = [];

    if (params.isEditable) {
      menuItems.push({ role: "cut" }, { role: "copy" }, { role: "paste" });
    } else if (params.selectionText) {
      menuItems.push({ role: "copy" });
    }

    if (menuItems.length > 0) {
      Menu.buildFromTemplate(menuItems).popup({ window: win });
    }
  });
}
