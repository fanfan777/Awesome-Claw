import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";

export interface ClientInstance {
  id: string;
  platform?: string;
  mode?: string;
  lastSeen?: string;
  ip?: string;
  version?: string;
}

export const useInstancesStore = defineStore("instances", () => {
  const instances = ref<ClientInstance[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const totalCount = computed(() => instances.value.length);

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error("Gateway not connected");}
    return c;
  }

  async function fetchInstances() {
    loading.value = true;
    error.value = null;
    try {
      const result = await getClient().request<{
        clients?: ClientInstance[];
        instances?: ClientInstance[];
      }>("system-presence");
      instances.value = result.clients ?? result.instances ?? [];
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to fetch instances";
    } finally {
      loading.value = false;
    }
  }

  function handlePresenceEvent(payload: unknown): void {
    if (!payload || typeof payload !== "object") {return;}
    const data = payload as Record<string, unknown>;

    // Handle full list update
    if (Array.isArray(data.clients)) {
      instances.value = data.clients as ClientInstance[];
      return;
    }

    // Handle single client join/leave
    if (data.action === "join" && data.client) {
      const client = data.client as ClientInstance;
      const existing = instances.value.findIndex((i) => i.id === client.id);
      if (existing >= 0) {
        instances.value[existing] = client;
      } else {
        instances.value.push(client);
      }
    } else if (data.action === "leave" && data.clientId) {
      instances.value = instances.value.filter(
        (i) => i.id !== (data.clientId as string),
      );
    }
  }

  return {
    instances,
    loading,
    error,
    totalCount,
    fetchInstances,
    handlePresenceEvent,
  };
});
