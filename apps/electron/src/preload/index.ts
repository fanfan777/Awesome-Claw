import { contextBridge, ipcRenderer } from "electron";

const api = {
  gateway: {
    spawn: () => ipcRenderer.invoke("gateway:spawn"),
    stop: () => ipcRenderer.invoke("gateway:stop"),
    status: () => ipcRenderer.invoke("gateway:status"),
    discover: (port?: number) => ipcRenderer.invoke("gateway:discover", port),
    readToken: () => ipcRenderer.invoke("gateway:read-token") as Promise<string | null>,
  },
  app: {
    getPlatform: () => ipcRenderer.invoke("app:get-platform"),
    getVersion: () => ipcRenderer.invoke("app:get-version"),
  },
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke("shell:open-external", url),
  },
  skills: {
    add: (skillName: string) => ipcRenderer.invoke("skills:add", skillName) as Promise<{ ok: boolean; error?: string }>,
  },
  mcp: {
    listServers: () => ipcRenderer.invoke("mcp:list-servers") as Promise<string[]>,
    addServer: (id: string, npmPackage: string, env?: Record<string, string>) =>
      ipcRenderer.invoke("mcp:add-server", id, npmPackage, env) as Promise<{ ok: boolean; error?: string }>,
    removeServer: (id: string) =>
      ipcRenderer.invoke("mcp:remove-server", id) as Promise<{ ok: boolean; error?: string }>,
  },
  config: {
    getPrimaryModel: () => ipcRenderer.invoke("config:get-primary-model") as Promise<string>,
    setPrimaryModel: (modelId: string) => ipcRenderer.invoke("config:set-primary-model", modelId) as Promise<{ ok: boolean; error?: string }>,
  },
};

try {
  contextBridge.exposeInMainWorld("electronAPI", api);
} catch (err) {
  console.error("preload: contextBridge error", err);
}
