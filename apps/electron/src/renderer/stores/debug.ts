import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";

export interface DebugEvent {
  timestamp: string;
  eventName: string;
  payload: unknown;
}

export interface RpcCall {
  method: string;
  params: unknown;
  result: unknown;
  error: string | null;
  duration: number;
  timestamp: string;
}

const MAX_EVENTS = 250;
const MAX_CALL_HISTORY = 50;

export const useDebugStore = defineStore("debug", () => {
  // Snapshots
  const statusSnapshot = ref<unknown>(null);
  const healthSnapshot = ref<unknown>(null);
  const lastHeartbeat = ref<unknown>(null);

  // Event log
  const events = ref<DebugEvent[]>([]);
  const eventSearch = ref("");

  // RPC caller
  const lastRpcResult = ref<unknown>(null);
  const lastRpcError = ref<string | null>(null);
  const rpcLoading = ref(false);
  const callHistory = ref<RpcCall[]>([]);

  // Snapshot loading states
  const statusLoading = ref(false);
  const healthLoading = ref(false);
  const heartbeatLoading = ref(false);

  const filteredEvents = computed(() => {
    if (!eventSearch.value) {return events.value;}
    const q = eventSearch.value.toLowerCase();
    return events.value.filter(
      (e) =>
        e.eventName.toLowerCase().includes(q) ||
        JSON.stringify(e.payload).toLowerCase().includes(q),
    );
  });

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error("Gateway not connected");}
    return c;
  }

  async function fetchStatus() {
    statusLoading.value = true;
    try {
      const result = await getClient().request("status");
      statusSnapshot.value = result;
    } catch (err) {
      statusSnapshot.value = {
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      statusLoading.value = false;
    }
  }

  async function fetchHealth() {
    healthLoading.value = true;
    try {
      const result = await getClient().request("health");
      healthSnapshot.value = result;
    } catch (err) {
      healthSnapshot.value = {
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      healthLoading.value = false;
    }
  }

  async function fetchHeartbeat() {
    heartbeatLoading.value = true;
    try {
      const result = await getClient().request("last-heartbeat");
      lastHeartbeat.value = result;
    } catch (err) {
      lastHeartbeat.value = {
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      heartbeatLoading.value = false;
    }
  }

  async function callRpc(method: string, params: unknown): Promise<void> {
    rpcLoading.value = true;
    lastRpcError.value = null;
    lastRpcResult.value = null;

    const start = performance.now();
    const timestamp = new Date().toISOString();

    try {
      const result = await getClient().request(method, params);
      const duration = Math.round(performance.now() - start);
      lastRpcResult.value = result;

      callHistory.value.unshift({
        method,
        params,
        result,
        error: null,
        duration,
        timestamp,
      });
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      const errorMsg =
        err instanceof Error ? err.message : String(err);
      lastRpcError.value = errorMsg;

      callHistory.value.unshift({
        method,
        params,
        result: null,
        error: errorMsg,
        duration,
        timestamp,
      });
    } finally {
      rpcLoading.value = false;
      // Cap call history
      if (callHistory.value.length > MAX_CALL_HISTORY) {
        callHistory.value = callHistory.value.slice(0, MAX_CALL_HISTORY);
      }
    }
  }

  function recordEvent(event: { event: string; payload?: unknown }): void {
    events.value.unshift({
      timestamp: new Date().toISOString(),
      eventName: event.event,
      payload: event.payload,
    });
    // Cap event log
    if (events.value.length > MAX_EVENTS) {
      events.value = events.value.slice(0, MAX_EVENTS);
    }
  }

  function clearEvents(): void {
    events.value = [];
  }

  function clearCallHistory(): void {
    callHistory.value = [];
  }

  return {
    statusSnapshot,
    healthSnapshot,
    lastHeartbeat,
    events,
    eventSearch,
    lastRpcResult,
    lastRpcError,
    rpcLoading,
    callHistory,
    statusLoading,
    healthLoading,
    heartbeatLoading,
    filteredEvents,
    fetchStatus,
    fetchHealth,
    fetchHeartbeat,
    callRpc,
    recordEvent,
    clearEvents,
    clearCallHistory,
  };
});
