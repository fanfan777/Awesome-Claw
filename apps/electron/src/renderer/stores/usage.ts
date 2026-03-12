import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";

export interface TokenBreakdown {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
  total: number;
}

export interface ModelUsageStats {
  provider?: string;
  tokens: TokenBreakdown;
  cost: number;
}

export interface SessionUsage {
  sessionKey: string;
  channel?: string;
  agentId?: string;
  messageCount: number;
  toolCount: number;
  errorCount: number;
  tokens: TokenBreakdown;
  cost: number;
  model?: string;
}

export interface UsageData {
  totalCost: number;
  currency?: string;
  period?: string;
  totalTokens: TokenBreakdown;
  byModel: Record<string, ModelUsageStats>;
  sessions?: SessionUsage[];
  /* legacy flat shape compat */
  tokens?: { input: number; output: number; total: number };
}

export interface UsageStatus {
  enabled?: boolean;
  provider?: string;
  limit?: number;
  used?: number;
}

export interface UsageFilter {
  startDate?: string;
  endDate?: string;
  channel?: string;
  agentId?: string;
  provider?: string;
  model?: string;
}

export const useUsageStore = defineStore("usage", () => {
  const usage = ref<UsageData | null>(null);
  const status = ref<UsageStatus | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const filter = ref<UsageFilter>({});
  const useUtc = ref(false);

  const totalTokens = computed<TokenBreakdown>(() => {
    if (usage.value?.totalTokens) {return usage.value.totalTokens;}
    if (usage.value?.tokens) {
      return {
        input: usage.value.tokens.input,
        output: usage.value.tokens.output,
        total: usage.value.tokens.total,
      };
    }
    return { input: 0, output: 0, total: 0 };
  });

  const totalCost = computed(() => usage.value?.totalCost ?? 0);

  const modelRows = computed(() => {
    const byModel = usage.value?.byModel ?? {};
    return Object.entries(byModel).map(([model, stats]) => {
      const tokens =
        typeof stats.tokens === "number"
          ? { input: 0, output: 0, total: stats.tokens as number }
          : (stats.tokens ?? { input: 0, output: 0, total: 0 });
      return {
        model,
        provider: stats.provider ?? "",
        tokens,
        cost: stats.cost ?? 0,
      };
    });
  });

  const sessionCount = computed(
    () => usage.value?.sessions?.length ?? 0,
  );

  const errorCount = computed(() =>
    (usage.value?.sessions ?? []).reduce(
      (sum, s) => sum + (s.errorCount ?? 0),
      0,
    ),
  );

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error("Gateway not connected");}
    return c;
  }

  async function fetchUsage(f?: UsageFilter) {
    loading.value = true;
    error.value = null;
    const params: Record<string, unknown> = {};
    const activeFilter = f ?? filter.value;
    if (activeFilter.startDate) {params.startDate = activeFilter.startDate;}
    if (activeFilter.endDate) {params.endDate = activeFilter.endDate;}
    if (activeFilter.channel) {params.channel = activeFilter.channel;}
    if (activeFilter.agentId) {params.agentId = activeFilter.agentId;}
    if (activeFilter.provider) {params.provider = activeFilter.provider;}
    if (activeFilter.model) {params.model = activeFilter.model;}
    try {
      const result = await getClient().request<UsageData>(
        "usage.cost",
        Object.keys(params).length > 0 ? params : undefined,
      );
      /* normalize legacy response: if byModel values have numeric tokens, convert */
      if (result.byModel) {
        for (const [, v] of Object.entries(result.byModel)) {
          if (typeof v.tokens === "number") {
            (v as Record<string, unknown>).tokens = {
              input: 0,
              output: 0,
              total: v.tokens,
            };
          }
        }
      }
      usage.value = result;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to fetch usage";
    } finally {
      loading.value = false;
    }
  }

  async function fetchStatus() {
    try {
      status.value =
        await getClient().request<UsageStatus>("usage.status");
    } catch {
      // non-critical
    }
  }

  function setFilter(f: UsageFilter) {
    filter.value = f;
  }

  function exportSessionsCsv(): string {
    const sessions = usage.value?.sessions ?? [];
    if (!sessions.length) {return "";}
    const header =
      "Session,Channel,Agent,Messages,Tools,Errors,Input Tokens,Output Tokens,Total Tokens,Cost";
    const rows = sessions.map((s) =>
      [
        s.sessionKey,
        s.channel ?? "",
        s.agentId ?? "",
        s.messageCount,
        s.toolCount,
        s.errorCount,
        s.tokens.input,
        s.tokens.output,
        s.tokens.total,
        s.cost.toFixed(6),
      ].join(","),
    );
    return [header, ...rows].join("\n");
  }

  function exportModelsCsv(): string {
    const rows = modelRows.value;
    if (!rows.length) {return "";}
    const header =
      "Model,Provider,Input Tokens,Output Tokens,Total Tokens,Cost";
    const lines = rows.map((r) =>
      [
        r.model,
        r.provider,
        r.tokens.input,
        r.tokens.output,
        r.tokens.total,
        r.cost.toFixed(6),
      ].join(","),
    );
    return [header, ...lines].join("\n");
  }

  return {
    usage,
    status,
    loading,
    error,
    filter,
    useUtc,
    totalTokens,
    totalCost,
    modelRows,
    sessionCount,
    errorCount,
    fetchUsage,
    fetchStatus,
    setFilter,
    exportSessionsCsv,
    exportModelsCsv,
  };
});
