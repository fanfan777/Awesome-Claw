import { defineStore } from "pinia";
import { ref } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";

export interface TtsStatus {
  enabled?: boolean;
  provider?: string;
  speaking?: boolean;
}

export interface TtsProvider {
  id: string;
  name?: string;
  configured?: boolean;
  voices?: string[];
}

export const useTtsStore = defineStore("tts", () => {
  const ttsStatus = ref<TtsStatus | null>(null);
  const providers = ref<TtsProvider[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error('Gateway not connected');}
    return c;
  }

  async function fetchStatus() {
    loading.value = true;
    error.value = null;
    try {
      ttsStatus.value = await getClient().request<TtsStatus>("tts.status");
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to fetch TTS status";
    } finally {
      loading.value = false;
    }
  }

  async function fetchProviders() {
    try {
      const result = await getClient().request<{ providers: TtsProvider[] }>("tts.providers");
      providers.value = result.providers ?? [];
    } catch {
      // non-critical
    }
  }

  async function enable(provider: string): Promise<boolean> {
    error.value = null;
    try {
      await getClient().request("tts.enable", { provider });
      if (ttsStatus.value) {
        ttsStatus.value.enabled = true;
        ttsStatus.value.provider = provider;
      }
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to enable TTS";
      return false;
    }
  }

  async function disable(): Promise<boolean> {
    error.value = null;
    try {
      await getClient().request("tts.disable");
      if (ttsStatus.value) {ttsStatus.value.enabled = false;}
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to disable TTS";
      return false;
    }
  }

  async function setProvider(provider: string, config?: Record<string, unknown>): Promise<boolean> {
    error.value = null;
    try {
      await getClient().request("tts.setProvider", { provider, config });
      if (ttsStatus.value) {ttsStatus.value.provider = provider;}
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to set TTS provider";
      return false;
    }
  }

  return {
    ttsStatus,
    providers,
    loading,
    error,
    fetchStatus,
    fetchProviders,
    enable,
    disable,
    setProvider,
  };
});
