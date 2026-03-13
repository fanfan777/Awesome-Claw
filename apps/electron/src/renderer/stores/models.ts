import { defineStore } from "pinia";
import { ref } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";

export interface ModelInfo {
  id: string;
  name?: string;
  provider?: string;
  contextLength?: number;
  inputTypes?: string[];
}

export interface ProviderConfig {
  id: string;
  type: string;
  name?: string;
  apiKey?: string;
  baseUrl?: string;
  enabled?: boolean;
}

/** Shape returned by config.get for the full config snapshot */
interface ConfigSnapshot {
  config: Record<string, unknown>;
  hash?: string;
  exists?: boolean;
}

export const useModelsStore = defineStore("models", () => {
  const models = ref<ModelInfo[]>([]);
  const providers = ref<ProviderConfig[]>([]);
  const primaryModel = ref<string>("");
  const fallbacks = ref<string[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /** Last config hash from config.get — required for config.patch */
  const configHash = ref<string | null>(null);

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error("Gateway not connected");}
    return c;
  }

  /** Fetch a fresh config snapshot and cache the hash for subsequent patches */
  async function fetchConfigSnapshot(): Promise<ConfigSnapshot> {
    const result = await getClient().request<ConfigSnapshot>("config.get");
    configHash.value = result.hash ?? null;
    console.log("[models-store] fetchConfigSnapshot hash:", configHash.value?.slice(0, 12), "config keys:", Object.keys(result.config ?? {}));
    return result;
  }

  async function fetchModels() {
    loading.value = true;
    error.value = null;
    try {
      const result = await getClient().request<{ models: ModelInfo[] }>("models.list");
      models.value = result.models ?? [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to fetch models";
    } finally {
      loading.value = false;
    }
  }

  async function fetchProviders() {
    error.value = null;
    try {
      const snapshot = await fetchConfigSnapshot();
      const cfg = snapshot.config ?? {};
      // models.providers is Record<string, ModelProviderConfig> in the config
      const modelsSection = cfg.models as Record<string, unknown> | undefined;
      const providersObj = modelsSection?.providers as Record<string, Record<string, unknown>> | undefined;

      // Also read auth.profiles for provider names/types
      const authSection = cfg.auth as Record<string, unknown> | undefined;
      const authProfiles = authSection?.profiles as Record<string, Record<string, unknown>> | undefined;

      if (providersObj && typeof providersObj === "object") {
        providers.value = Object.entries(providersObj).map(([id, p]) => ({
          id,
          type: (p.api as string) ?? id,
          name: id,
          baseUrl: p.baseUrl as string | undefined,
          // Provider exists in config = was configured (gateway may hide sensitive fields)
          apiKey: "••••••",
          enabled: true,
        }));
      } else if (authProfiles && typeof authProfiles === "object") {
        // Fallback: show auth profiles as providers (wizard-created profiles without models.providers entry)
        providers.value = Object.entries(authProfiles).map(([profileId, p]) => ({
          id: profileId,
          type: (p.provider as string) ?? profileId.split(":")[0] ?? profileId,
          name: (p.provider as string) ?? profileId,
          // Profile exists = was configured
          apiKey: "••••••",
          enabled: true,
        }));
      } else {
        providers.value = [];
      }

      // Read primary model and fallbacks from agents.defaults.model
      const agentsSection = cfg.agents as Record<string, unknown> | undefined;
      const defaults = agentsSection?.defaults as Record<string, unknown> | undefined;
      const modelDefaults = defaults?.model as Record<string, unknown> | undefined;
      primaryModel.value = (modelDefaults?.primary as string) ?? "";
      fallbacks.value = Array.isArray(modelDefaults?.fallbacks)
        ? (modelDefaults.fallbacks as string[])
        : [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to fetch providers";
    }
  }

  async function addProvider(provider: ProviderConfig): Promise<boolean> {
    error.value = null;
    try {
      // Always fetch a fresh config snapshot (for hash + latest state)
      await fetchConfigSnapshot();

      // Build a ModelProviderConfig-compatible entry under models.providers
      const providerEntry: Record<string, unknown> = {
        baseUrl: provider.baseUrl || `https://api.${provider.type || "openai"}.com/v1`,
        models: [],
      };
      if (provider.apiKey && provider.apiKey !== "••••••") {
        providerEntry.apiKey = provider.apiKey;
      }
      if (provider.type === "anthropic") {
        providerEntry.api = "anthropic-messages";
      } else if (provider.type === "google") {
        providerEntry.api = "google-generative-ai";
      } else if (provider.type === "bedrock") {
        providerEntry.api = "bedrock";
      }
      // else defaults to openai-completions (gateway auto-detects)

      const patch = {
        models: {
          providers: {
            [provider.id]: providerEntry,
          },
        },
      };
      console.log("[models-store] addProvider patch:", JSON.stringify(patch));
      console.log("[models-store] baseHash:", configHash.value);
      const result = await getClient().request("config.patch", {
        raw: JSON.stringify(patch),
        baseHash: configHash.value,
      });
      console.log("[models-store] config.patch result:", result);
      // Refresh hash and providers after successful patch
      await fetchProviders();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add provider";
      console.error("[models-store] addProvider error:", msg, err);
      error.value = msg;
      return false;
    }
  }

  async function removeProvider(id: string): Promise<boolean> {
    error.value = null;
    try {
      if (!configHash.value) {
        await fetchConfigSnapshot();
      }
      const patch = {
        models: {
          providers: {
            [id]: null,
          },
        },
      };
      await getClient().request("config.patch", {
        raw: JSON.stringify(patch),
        baseHash: configHash.value,
      });
      providers.value = providers.value.filter((p) => p.id !== id);
      // Refresh hash after write
      configHash.value = null;
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to remove provider";
      return false;
    }
  }

  async function setPrimaryModel(modelId: string): Promise<boolean> {
    error.value = null;
    try {
      const conn = useConnectionStore();
      if (conn.isConnected && conn.client) {
        // Use gateway RPC when connected
        await fetchConfigSnapshot();
        const patch = {
          agents: {
            defaults: {
              model: {
                primary: modelId,
              },
            },
          },
        };
        await conn.client.request("config.patch", {
          raw: JSON.stringify(patch),
          baseHash: configHash.value,
        });
        configHash.value = null;
      } else {
        // Fallback: write directly to config file via IPC
        const api = (window as Record<string, unknown>).electronAPI as
          | { config?: { setPrimaryModel?: (id: string) => Promise<{ ok: boolean; error?: string }> } }
          | undefined;
        if (api?.config?.setPrimaryModel) {
          const result = await api.config.setPrimaryModel(modelId);
          if (!result.ok) {throw new Error(result.error || "Failed to write config");}
        } else {
          throw new Error("Gateway not connected and IPC not available");
        }
      }
      primaryModel.value = modelId;
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to set primary model";
      return false;
    }
  }

  async function setFallbacks(newFallbacks: string[]): Promise<boolean> {
    error.value = null;
    try {
      const conn = useConnectionStore();
      if (conn.isConnected && conn.client) {
        await fetchConfigSnapshot();
        const patch = {
          agents: {
            defaults: {
              model: {
                fallbacks: newFallbacks,
              },
            },
          },
        };
        await conn.client.request("config.patch", {
          raw: JSON.stringify(patch),
          baseHash: configHash.value,
        });
        configHash.value = null;
      } else {
        throw new Error("Gateway not connected");
      }
      fallbacks.value = newFallbacks;
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to set fallbacks";
      return false;
    }
  }

  /** Load primary model from config file (works without gateway) */
  async function loadPrimaryModelFromFile() {
    const api = (window as Record<string, unknown>).electronAPI as
      | { config?: { getPrimaryModel?: () => Promise<string> } }
      | undefined;
    if (api?.config?.getPrimaryModel) {
      primaryModel.value = await api.config.getPrimaryModel();
    }
  }

  return {
    models,
    providers,
    primaryModel,
    fallbacks,
    loading,
    error,
    configHash,
    fetchModels,
    fetchProviders,
    fetchConfigSnapshot,
    loadPrimaryModelFromFile,
    addProvider,
    removeProvider,
    setPrimaryModel,
    setFallbacks,
  };
});
