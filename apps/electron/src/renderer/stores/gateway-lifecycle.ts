import { defineStore } from "pinia";
import { ref } from "vue";

export type ProcessState =
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "failed"
  | "attached";

export type GatewayStatus = {
  state: ProcessState;
  pid?: number;
  port?: number;
  error?: string;
  version?: string;
};

/**
 * Pinia store that bridges IPC calls to the main process for gateway lifecycle management.
 * All actions delegate to window.electronAPI.gateway (exposed via preload).
 */
export const useGatewayLifecycleStore = defineStore("gateway-lifecycle", () => {
  const processState = ref<ProcessState>("stopped");
  const pid = ref<number | null>(null);
  const port = ref<number | null>(null);
  const cliPath = ref<string | null>(null);
  const error = ref<string | null>(null);
  const version = ref<string | null>(null);

  function _applyStatus(status: GatewayStatus): void {
    processState.value = status.state;
    pid.value = status.pid ?? null;
    port.value = status.port ?? null;
    error.value = status.error ?? null;
    version.value = status.version ?? null;
  }

  async function getStatus(): Promise<void> {
    try {
      const api = window.electronAPI?.gateway;
      if (!api) {return;}
      const status = await api.getStatus();
      _applyStatus(status);
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function discover(): Promise<number | null> {
    try {
      const api = window.electronAPI?.gateway;
      if (!api) {return null;}
      const result = await api.discover();
      if (result) {
        processState.value = "attached";
        port.value = result.port ?? null;
        version.value = result.version ?? null;
        return result.port ?? null;
      }
      return null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      return null;
    }
  }

  async function spawn(opts?: { cliPath?: string; port?: number }): Promise<void> {
    try {
      processState.value = "starting";
      error.value = null;
      const api = window.electronAPI?.gateway;
      if (!api) {throw new Error("electronAPI not available");}
      const status = await api.spawn(opts);
      _applyStatus(status);
    } catch (err) {
      processState.value = "failed";
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function stop(): Promise<void> {
    try {
      processState.value = "stopping";
      const api = window.electronAPI?.gateway;
      if (!api) {return;}
      await api.stop();
      processState.value = "stopped";
      pid.value = null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function restart(): Promise<void> {
    await stop();
    await spawn();
  }

  return {
    processState,
    pid,
    port,
    cliPath,
    error,
    version,
    getStatus,
    discover,
    spawn,
    stop,
    restart,
  };
});
