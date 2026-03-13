import { ipcMain, BrowserWindow, shell, app } from "electron";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { execFile, execSync } from "node:child_process";
import { gatewayProcess } from "./gateway-process.js";
import { discoverGateway } from "./gateway-discovery.js";
import { resolveCliPath } from "./cli-resolver.js";

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Gateway channels
  ipcMain.handle("gateway:spawn", async () => {
    try {
      const cli = resolveCliPath();
      if (!cli) {return { ok: false, error: "openclaw CLI not found (not in PATH and not in monorepo)" };}
      console.log(`[ipc] resolved CLI: ${cli.command} ${cli.args.join(" ")} (cwd: ${cli.cwd ?? "inherit"})`);
      await gatewayProcess.spawnGateway(cli);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  });

  ipcMain.handle("gateway:stop", async () => {
    await gatewayProcess.stopGateway();
  });

  ipcMain.handle("gateway:status", () => {
    return gatewayProcess.getStatus();
  });

  ipcMain.handle("gateway:discover", async (_event, port?: number) => {
    return discoverGateway(port);
  });

  // Read gateway auth token from ~/.openclaw/openclaw.json
  ipcMain.handle("gateway:read-token", () => {
    try {
      const configPath = join(homedir(), ".openclaw", "openclaw.json");
      const raw = readFileSync(configPath, "utf8");
      const config = JSON.parse(raw);
      return config?.gateway?.auth?.token ?? null;
    } catch {
      return null;
    }
  });

  // Config: direct file read/write (works without gateway)
  const configPath = join(homedir(), ".openclaw", "openclaw.json");

  ipcMain.handle("config:get-primary-model", () => {
    try {
      const raw = readFileSync(configPath, "utf8");
      const config = JSON.parse(raw);
      return config?.agents?.defaults?.model?.primary ?? "";
    } catch {
      return "";
    }
  });

  ipcMain.handle("config:set-primary-model", (_event, modelId: string) => {
    try {
      const raw = readFileSync(configPath, "utf8");
      const config = JSON.parse(raw);
      if (!config.agents) {config.agents = {};}
      if (!config.agents.defaults) {config.agents.defaults = {};}
      if (!config.agents.defaults.model) {config.agents.defaults.model = {};}
      config.agents.defaults.model.primary = modelId;
      const { writeFileSync } = require("node:fs") as typeof import("node:fs");
      writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
      console.log("[ipc] primary model set to:", modelId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // App info channels
  ipcMain.handle("app:get-platform", () => process.platform);

  ipcMain.handle("app:get-version", () => app.getVersion());

  // Window control channels (one-way, no reply needed)
  ipcMain.on("window:minimize", () => mainWindow.minimize());

  ipcMain.on("window:maximize", () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on("window:close", () => mainWindow.close());

  // Shell
  ipcMain.handle("shell:open-external", async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // MCP: manage mcporter config at ~/.openclaw/config/mcporter.json
  const mcporterConfigPath = join(homedir(), ".openclaw", "config", "mcporter.json");

  function readMcporterConfig(): Record<string, unknown> {
    try {
      return JSON.parse(readFileSync(mcporterConfigPath, "utf8"));
    } catch {
      return { mcpServers: {} };
    }
  }

  function writeMcporterConfig(config: Record<string, unknown>): void {
    const dir = dirname(mcporterConfigPath);
    if (!existsSync(dir)) {mkdirSync(dir, { recursive: true });}
    writeFileSync(mcporterConfigPath, JSON.stringify(config, null, 2), "utf8");
  }

  ipcMain.handle("mcp:list-servers", () => {
    const config = readMcporterConfig();
    const servers = (config.mcpServers ?? {}) as Record<string, unknown>;
    return Object.keys(servers);
  });

  ipcMain.handle("mcp:add-server", (_event, id: string, npmPackage: string, env?: Record<string, string>) => {
    try {
      const config = readMcporterConfig();
      if (!config.mcpServers) {config.mcpServers = {};}
      const servers = config.mcpServers as Record<string, unknown>;
      const entry: Record<string, unknown> = {
        command: "npx",
        args: ["-y", npmPackage],
      };
      if (env && Object.keys(env).length > 0) {entry.env = env;}
      servers[id] = entry;
      writeMcporterConfig(config);
      console.log("[ipc] mcp:add-server:", id, npmPackage);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("mcp:remove-server", (_event, id: string) => {
    try {
      const config = readMcporterConfig();
      const servers = (config.mcpServers ?? {}) as Record<string, unknown>;
      delete servers[id];
      writeMcporterConfig(config);
      console.log("[ipc] mcp:remove-server:", id);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Skills: run `clawhub install <slug>` to download from ClawHub registry
  ipcMain.handle("skills:add", async (_event, skillSlug: string) => {
    // Find clawhub CLI: try PATH first, then npx fallback
    let command = "clawhub";
    let args = ["install", skillSlug, "--no-input"];
    let hasClawhub = false;
    try {
      execSync(process.platform === "win32" ? "where clawhub" : "which clawhub", {
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 3000,
      });
      hasClawhub = true;
    } catch {
      // clawhub not in PATH
    }
    if (!hasClawhub) {
      command = "npx";
      args = ["-y", "clawhub", "install", skillSlug, "--no-input"];
    }
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      console.log(`[ipc] skills:add running: ${command} ${args.join(" ")}`);
      execFile(command, args, {
        timeout: 120_000,
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
      }, (err, stdout, stderr) => {
        if (err) {
          // "Already installed" is a success — skill exists
          if (stderr?.includes("Already installed") || err.message?.includes("Already installed")) {
            console.log("[ipc] skills:add already installed (ok):", skillSlug);
            resolve({ ok: true });
          } else {
            console.error("[ipc] skills:add error:", err.message, stderr);
            resolve({ ok: false, error: stderr || err.message });
          }
        } else {
          console.log("[ipc] skills:add success:", stdout.trim());
          resolve({ ok: true });
        }
      });
    });
  });
}

export function unregisterIpcHandlers(): void {
  const handleChannels = [
    "gateway:spawn",
    "gateway:stop",
    "gateway:status",
    "gateway:discover",
    "gateway:read-token",
    "app:get-platform",
    "app:get-version",
    "shell:open-external",
    "skills:add",
    "mcp:list-servers",
    "mcp:add-server",
    "mcp:remove-server",
    "config:get-primary-model",
    "config:set-primary-model",
  ];
  const onChannels = ["window:minimize", "window:maximize", "window:close"];

  for (const ch of handleChannels) {ipcMain.removeAllListeners(ch);}
  for (const ch of onChannels) {ipcMain.removeAllListeners(ch);}
}
