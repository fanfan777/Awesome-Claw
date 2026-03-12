/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  const component: DefineComponent<{}, {}, unknown>;
  export default component;
}

/**
 * The electronAPI surface exposed by the preload script via contextBridge.
 * Must stay in sync with src/preload/index.ts.
 */
interface ElectronAPI {
  gateway: {
    spawn: () => Promise<{ ok: boolean; error?: string }>;
    stop: () => Promise<void>;
    status: () => Promise<{ state: string; pid?: number; port?: number }>;
    discover: (port?: number) => Promise<{ found: boolean; url: string; version?: string }>;
    readToken: () => Promise<string | null>;
  };
  app: {
    getPlatform: () => Promise<string>;
    getVersion: () => Promise<string>;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
}

interface Window {
  electronAPI: ElectronAPI;
}
