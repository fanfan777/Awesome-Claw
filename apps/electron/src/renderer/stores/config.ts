import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";

export type ConfigValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | unknown[];

export interface ConfigSchema {
  type?: string;
  properties?: Record<string, ConfigSchema>;
  items?: ConfigSchema;
  description?: string;
  title?: string;
  default?: ConfigValue;
  enum?: ConfigValue[];
  uiHints?: {
    sensitive?: boolean;
    section?: string;
    tags?: string[];
    order?: number;
  };
  required?: string[];
  additionalProperties?: boolean | ConfigSchema;
}

/** Sections derived from the schema top-level properties */
export interface ConfigSection {
  key: string;
  title: string;
  icon: string;
  tags: string[];
}

/** All known config sections with display metadata */
const SECTION_META: Record<string, { icon: string; tags: string[] }> = {
  gateway: { icon: "server", tags: ["network"] },
  channels: { icon: "chatbubbles", tags: ["channels"] },
  agents: { icon: "people", tags: ["agents"] },
  models: { icon: "cube", tags: ["models"] },
  tools: { icon: "hammer", tags: ["tools"] },
  skills: { icon: "extension-puzzle", tags: ["tools"] },
  plugins: { icon: "apps", tags: ["tools"] },
  session: { icon: "document-text", tags: ["performance"] },
  messages: { icon: "mail", tags: ["channels"] },
  hooks: { icon: "git-branch", tags: ["tools"] },
  broadcast: { icon: "megaphone", tags: ["channels"] },
  memory: { icon: "hardware-chip", tags: ["performance"] },
  approvals: { icon: "checkmark-circle", tags: ["security", "access"] },
  sandbox: { icon: "lock-closed", tags: ["security"] },
  logging: { icon: "list", tags: ["diagnostics"] },
  diagnostics: { icon: "pulse", tags: ["diagnostics"] },
  env: { icon: "settings", tags: ["network"] },
  secrets: { icon: "key", tags: ["security", "auth"] },
  update: { icon: "cloud-download", tags: ["network"] },
  browser: { icon: "globe", tags: ["network"] },
  media: { icon: "image", tags: ["channels"] },
  cron: { icon: "time", tags: ["tools"] },
  talk: { icon: "mic", tags: ["channels"] },
  discovery: { icon: "search", tags: ["network"] },
  canvasHost: { icon: "easel", tags: ["tools"] },
  acp: { icon: "link", tags: ["network"] },
};

export const ALL_TAGS = [
  "security",
  "auth",
  "network",
  "access",
  "channels",
  "models",
  "tools",
  "performance",
  "diagnostics",
  "agents",
];

/** Category tags with display labels */
export const CATEGORY_TAGS: Array<{ value: string; label: string }> = [
  { value: "security", label: "Security" },
  { value: "auth", label: "Auth" },
  { value: "channels", label: "Channels" },
  { value: "models", label: "Models" },
  { value: "tools", label: "Tools" },
  { value: "performance", label: "Performance" },
  { value: "diagnostics", label: "Diagnostics" },
  { value: "agents", label: "Agents" },
  { value: "network", label: "Network" },
  { value: "access", label: "Access" },
];

/** Flat config entry for the table view */
export interface ConfigEntry {
  path: string;
  value: string;
  type: string;
  rawValue: ConfigValue;
}

/** Detect whether a key path is a sensitive field */
export function isSensitiveKey(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.includes("token") ||
    lower.includes("key") ||
    lower.includes("secret") ||
    lower.includes("password")
  );
}

/** Detect field type from schema or from a runtime value */
export function detectFieldType(
  schema: ConfigSchema | undefined,
  value: ConfigValue,
): string {
  if (schema?.enum && schema.enum.length > 0) {return "enum";}
  if (schema?.type) {return schema.type;}
  if (value === null) {return "null";}
  if (Array.isArray(value)) {return "array";}
  return typeof value;
}

export const useConfigStore = defineStore("config", () => {
  const config = ref<Record<string, ConfigValue>>({});
  const originalConfig = ref<Record<string, ConfigValue>>({});
  const baseHash = ref<string | undefined>(undefined);
  const schema = ref<ConfigSchema | null>(null);
  const schemaLoading = ref(false);
  const loading = ref(false);
  const saving = ref(false);
  const lastSaved = ref<number | null>(null);
  const error = ref<string | null>(null);
  const dirtyFields = ref<Set<string>>(new Set());

  const dirty = computed(() => {
    return JSON.stringify(config.value) !== JSON.stringify(originalConfig.value);
  });

  const sections = computed<ConfigSection[]>(() => {
    const keys = schema.value?.properties
      ? Object.keys(schema.value.properties)
      : Object.keys(config.value);
    return keys.map((key) => {
      const meta = SECTION_META[key] ?? {
        icon: "ellipsis-horizontal",
        tags: [],
      };
      const schemaProp = schema.value?.properties?.[key];
      return {
        key,
        title: schemaProp?.title ?? key.charAt(0).toUpperCase() + key.slice(1),
        icon: meta.icon,
        tags: meta.tags,
      };
    });
  });

  const allTags = computed(() => ALL_TAGS);

  /** Flatten config into key-value entries for table view */
  const flatEntries = computed<ConfigEntry[]>(() => {
    const result: ConfigEntry[] = [];
    function flatten(obj: Record<string, ConfigValue>, prefix = "") {
      for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
          flatten(v as Record<string, ConfigValue>, path);
        } else {
          result.push({
            path,
            value:
              v === null
                ? "null"
                : Array.isArray(v)
                  ? JSON.stringify(v)
                  : String(v),
            type:
              v === null ? "null" : Array.isArray(v) ? "array" : typeof v,
            rawValue: v,
          });
        }
      }
    }
    flatten(config.value);
    return result;
  });

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error("Gateway not connected");}
    return c;
  }

  async function fetchConfig() {
    loading.value = true;
    error.value = null;
    try {
      const result = await getClient().request<{
        config: Record<string, ConfigValue>;
        hash?: string;
      }>("config.get");
      config.value = result.config ?? {};
      baseHash.value = result.hash;
      originalConfig.value = JSON.parse(JSON.stringify(config.value));
      dirtyFields.value.clear();
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to fetch config";
    } finally {
      loading.value = false;
    }
  }

  async function fetchSchema() {
    schemaLoading.value = true;
    try {
      const result = await getClient().request<{ schema: ConfigSchema }>(
        "config.schema",
      );
      schema.value = result.schema ?? null;
    } catch {
      // non-critical
    } finally {
      schemaLoading.value = false;
    }
  }

  /** Build a nested JSON object from a dotted path and value, then stringify */
  function buildPatchRaw(path: string, value: ConfigValue): string {
    const parts = path.split(".");
    const obj: Record<string, unknown> = {};
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const nested: Record<string, unknown> = {};
      current[parts[i]] = nested;
      current = nested;
    }
    current[parts[parts.length - 1]] = value;
    return JSON.stringify(obj);
  }

  async function patchConfig(
    path: string,
    value: ConfigValue,
  ): Promise<boolean> {
    error.value = null;
    try {
      const params: Record<string, unknown> = { raw: buildPatchRaw(path, value) };
      if (baseHash.value) {
        params.baseHash = baseHash.value;
      }
      const result = await getClient().request<{ baseHash?: string }>("config.patch", params);
      // Update baseHash from response for subsequent patches
      if (result?.baseHash) {
        baseHash.value = result.baseHash;
      }
      lastSaved.value = Date.now();
      setValueByPath(path, value);
      originalConfig.value = JSON.parse(JSON.stringify(config.value));
      dirtyFields.value.delete(path);
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to patch config";
      return false;
    }
  }

  async function setConfig(
    newConfig: Record<string, ConfigValue>,
  ): Promise<boolean> {
    error.value = null;
    saving.value = true;
    try {
      const params: Record<string, unknown> = { raw: JSON.stringify(newConfig) };
      if (baseHash.value) { params.baseHash = baseHash.value; }
      const result = await getClient().request<{ baseHash?: string }>("config.set", params);
      if (result?.baseHash) { baseHash.value = result.baseHash; }
      config.value = newConfig;
      originalConfig.value = JSON.parse(JSON.stringify(newConfig));
      lastSaved.value = Date.now();
      dirtyFields.value.clear();
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to set config";
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function applyConfig(): Promise<boolean> {
    error.value = null;
    saving.value = true;
    try {
      // Schema: { raw: string, baseHash? }
      await getClient().request("config.apply", { raw: JSON.stringify(config.value) });
      lastSaved.value = Date.now();
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to apply config";
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function lookupSchema(path: string): Promise<ConfigSchema | null> {
    try {
      const result = await getClient().request<{ schema: ConfigSchema }>(
        "config.schema.lookup",
        { path },
      );
      return result.schema ?? null;
    } catch {
      return null;
    }
  }

  function getValueByPath(path: string): ConfigValue {
    const parts = path.split(".");
    let current: unknown = config.value;
    for (const part of parts) {
      if (current === null || current === undefined) {return null;}
      if (typeof current !== "object") {return null;}
      current = (current as Record<string, unknown>)[part];
    }
    return current as ConfigValue;
  }

  function setValueByPath(path: string, value: ConfigValue): void {
    const parts = path.split(".");
    let obj = config.value as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (typeof obj[part] !== "object" || obj[part] === null) {
        obj[part] = {};
      }
      obj = obj[part] as Record<string, unknown>;
    }
    const lastPart = parts[parts.length - 1];
    if (lastPart) {obj[lastPart] = value;}
  }

  /** Mark a field as locally modified (dirty) */
  function markDirty(path: string): void {
    dirtyFields.value.add(path);
  }

  /** Check if a field is dirty */
  function isFieldDirty(path: string): boolean {
    return dirtyFields.value.has(path);
  }

  function resetChanges(): void {
    config.value = JSON.parse(JSON.stringify(originalConfig.value));
    dirtyFields.value.clear();
  }

  /** Get schema for a specific section key */
  function getSectionSchema(sectionKey: string): ConfigSchema | undefined {
    return schema.value?.properties?.[sectionKey];
  }

  /** Export config as downloadable JSON */
  function exportConfig(): void {
    const blob = new Blob([JSON.stringify(config.value, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "openclaw-config.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Import config from a JSON file */
  async function importConfig(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, ConfigValue>;
      return await setConfig(parsed);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to import config";
      return false;
    }
  }

  return {
    config,
    originalConfig,
    schema,
    schemaLoading,
    loading,
    saving,
    lastSaved,
    error,
    dirty,
    dirtyFields,
    sections,
    allTags,
    flatEntries,
    fetchConfig,
    fetchSchema,
    patchConfig,
    setConfig,
    applyConfig,
    lookupSchema,
    getValueByPath,
    setValueByPath,
    markDirty,
    isFieldDirty,
    resetChanges,
    getSectionSchema,
    exportConfig,
    importConfig,
  };
});
