import { defineStore } from "pinia";
import { ref } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";

export interface SecretInfo {
  ref: string;
  source?: string;
  resolved?: boolean;
}

export const useSecretsStore = defineStore("secrets", () => {
  const secrets = ref<SecretInfo[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error('Gateway not connected');}
    return c;
  }

  async function reload() {
    loading.value = true;
    error.value = null;
    try {
      const result = await getClient().request<{ secrets: SecretInfo[] }>("secrets.reload");
      secrets.value = result.secrets ?? [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to reload secrets";
    } finally {
      loading.value = false;
    }
  }

  async function resolve(refs: string[]): Promise<Record<string, string> | null> {
    error.value = null;
    try {
      const result = await getClient().request<{ values: Record<string, string> }>("secrets.resolve", { refs });
      return result.values ?? {};
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to resolve secrets";
      return null;
    }
  }

  return {
    secrets,
    loading,
    error,
    reload,
    resolve,
  };
});
