import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";

export interface Session {
  sessionKey: string;
  title?: string;
  channel?: string;
  agentId?: string;
  model?: string;
  messageCount?: number;
  tokenCount?: number;
  costTotal?: number;
  errorCount?: number;
  createdAt?: string;
  updatedAt?: string;
  pinned?: boolean;
  tags?: string[];
  // Overrides
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
}

export interface SessionPreview {
  sessionKey: string;
  messages: Array<{ role: string; content: string; timestamp?: string }>;
}

/** Params accepted by sessions.list RPC (additionalProperties: false) */
export interface SessionFilters {
  agentId?: string;
  search?: string;
  limit?: number;
  includeGlobal?: boolean;
  activeMinutes?: number;
  includeUnknown?: boolean;
  includeDerivedTitles?: boolean;
  includeLastMessage?: boolean;
  label?: string;
  spawnedBy?: string;
}

export type SortField =
  | "recent"
  | "tokens"
  | "messages"
  | "sessionKey"
  | "channel";

export const useSessionsStore = defineStore("sessions", () => {
  const sessions = ref<Session[]>([]);
  const loading = ref(false);
  const total = ref(0);
  const error = ref<string | null>(null);

  // Filter state (local sorting — gateway does not support sort/offset)
  const search = ref("");
  const sortBy = ref<SortField>("recent");
  const sortDir = ref<"asc" | "desc">("desc");
  const pageSize = ref(50);
  const page = ref(1);
  const includeGlobal = ref(false);

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(total.value / pageSize.value)),
  );

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error("Gateway not connected");}
    return c;
  }

  async function fetchSessions(newFilters?: SessionFilters) {
    loading.value = true;
    error.value = null;
    // Only send params the gateway schema accepts (no offset/sort/sortDir)
    const filters: SessionFilters = newFilters ?? {
      search: search.value || undefined,
      limit: pageSize.value,
      includeGlobal: includeGlobal.value || undefined,
    };
    try {
      const result = await getClient().request<{
        sessions: Array<Record<string, unknown>>;
        count?: number;
        total?: number;
      }>("sessions.list", filters);
      // Gateway returns "key" (not "sessionKey"), "totalTokens" (not "tokenCount"),
      // "displayName"/"derivedTitle"/"label" (not "title"), "updatedAt" as ms number
      sessions.value = (result.sessions ?? []).map((s) => ({
        sessionKey: (s.key as string) ?? (s.sessionKey as string) ?? "",
        title: (s.derivedTitle as string) ?? (s.displayName as string) ?? (s.label as string),
        channel: s.channel as string | undefined,
        agentId: s.agentId as string | undefined,
        model: s.model as string | undefined,
        tokenCount: (s.totalTokens as number) ?? (s.tokenCount as number),
        costTotal: s.costTotal as number | undefined,
        errorCount: s.errorCount as number | undefined,
        createdAt: s.createdAt as string | undefined,
        updatedAt: typeof s.updatedAt === "number" ? new Date(s.updatedAt).toISOString() : (s.updatedAt as string | undefined),
        pinned: s.pinned as boolean | undefined,
        thinkingLevel: s.thinkingLevel as string | undefined,
        verboseLevel: s.verboseLevel as string | undefined,
        reasoningLevel: s.reasoningLevel as string | undefined,
      })) as Session[];
      total.value = result.count ?? result.total ?? sessions.value.length;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to fetch sessions";
    } finally {
      loading.value = false;
    }
  }

  async function preview(
    sessionKey: string,
  ): Promise<SessionPreview | null> {
    try {
      // Schema: { keys: string[] } not { sessionKey }
      const result = await getClient().request<{
        previews?: SessionPreview[];
      }>("sessions.preview", {
        keys: [sessionKey],
      });
      return result.previews?.[0] ?? null;
    } catch {
      return null;
    }
  }

  async function patch(
    sessionKey: string,
    updates: Record<string, unknown>,
  ): Promise<boolean> {
    error.value = null;
    try {
      // Schema uses "key" not "sessionKey"
      await getClient().request("sessions.patch", {
        key: sessionKey,
        ...updates,
      });
      const idx = sessions.value.findIndex(
        (s) => s.sessionKey === sessionKey,
      );
      if (idx !== -1) {
        sessions.value[idx] = { ...sessions.value[idx], ...updates } as Session;
      }
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to patch session";
      return false;
    }
  }

  async function reset(sessionKey: string): Promise<boolean> {
    error.value = null;
    try {
      await getClient().request("sessions.reset", { key: sessionKey });
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to reset session";
      return false;
    }
  }

  async function deleteSession(sessionKey: string): Promise<boolean> {
    error.value = null;
    try {
      await getClient().request("sessions.delete", { key: sessionKey });
      sessions.value = sessions.value.filter(
        (s) => s.sessionKey !== sessionKey,
      );
      total.value = Math.max(0, total.value - 1);
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to delete session";
      return false;
    }
  }

  async function compact(sessionKey: string): Promise<boolean> {
    error.value = null;
    try {
      await getClient().request("sessions.compact", { key: sessionKey });
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to compact session";
      return false;
    }
  }

  function setSort(field: SortField) {
    if (sortBy.value === field) {
      sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
    } else {
      sortBy.value = field;
      sortDir.value = "desc";
    }
    page.value = 1;
  }

  function setPage(p: number) {
    page.value = p;
  }

  function setPageSize(size: number) {
    pageSize.value = size;
    page.value = 1;
  }

  return {
    sessions,
    loading,
    total,
    error,
    search,
    sortBy,
    sortDir,
    pageSize,
    page,
    totalPages,
    includeGlobal,
    fetchSessions,
    preview,
    patch,
    reset,
    deleteSession,
    compact,
    setSort,
    setPage,
    setPageSize,
  };
});
