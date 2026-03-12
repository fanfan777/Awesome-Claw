import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";

export interface CronJobSchedule {
  kind: "at" | "every" | "cron";
  at?: string;
  every?: { amount: number; unit: string };
  cron?: string;
  tz?: string;
  exact?: boolean;
  stagger?: { amount: number; unit: string };
}

export interface CronJobPayload {
  kind: "systemEvent" | "agentTurn";
  text?: string;
  model?: string;
  thinking?: string;
  timeout?: number;
}

export interface CronJobDelivery {
  mode: "announce" | "webhook" | "none";
  channel?: string;
  to?: string;
  webhookUrl?: string;
  bestEffort?: boolean;
}

export interface CronJobFailureAlert {
  threshold?: number;
  cooldown?: number;
}

export interface CronJob {
  id: string;
  name: string;
  description?: string;
  agentId?: string;
  enabled: boolean;
  schedule: CronJobSchedule;
  payload: CronJobPayload;
  session?: { target: "main" | "isolated" };
  wakeMode?: string;
  delivery?: CronJobDelivery;
  deleteAfterRun?: boolean;
  failureAlert?: CronJobFailureAlert;
  nextRunAtMs?: number;
  nextRunAt?: string;
  lastRun?: { status: string; at: string; error?: string };
  /* legacy flat fields kept for backward compat with simpler API responses */
  command?: string;
  lastRunAt?: string;
  status?: string;
}

export interface CronRun {
  id: string;
  jobId: string;
  jobName?: string;
  startedAt: string;
  completedAt?: string;
  status: "ok" | "error" | "skipped" | "running" | "success";
  duration?: number;
  error?: string;
  output?: string;
  summary?: string;
  delivery?: { status: string; channel?: string };
  sessionKey?: string;
}

export interface CronStatus {
  running: boolean;
  jobCount: number;
}

export interface CronJobParams {
  name?: string;
  description?: string;
  schedule?: string | CronJobSchedule;
  command?: string;
  agentId?: string;
  enabled?: boolean;
  payload?: CronJobPayload;
  session?: { target: "main" | "isolated" };
  wakeMode?: string;
  delivery?: CronJobDelivery;
  deleteAfterRun?: boolean;
  failureAlert?: CronJobFailureAlert;
}

export interface CronEventPayload {
  type: string;
  jobId?: string;
  runId?: string;
  status?: string;
}

export interface CronRunsFilter {
  jobId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export const useCronStore = defineStore("cron", () => {
  const jobs = ref<CronJob[]>([]);
  const runs = ref<CronRun[]>([]);
  const cronStatus = ref<CronStatus | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const runsLoading = ref(false);
  const error = ref<string | null>(null);
  const selectedJobId = ref<string | null>(null);
  const runsHasMore = ref(false);
  const runsOffset = ref(0);

  const selectedJob = computed(() =>
    selectedJobId.value
      ? jobs.value.find((j) => j.id === selectedJobId.value) ?? null
      : null,
  );

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error("Gateway not connected");}
    return c;
  }

  async function fetchJobs() {
    loading.value = true;
    error.value = null;
    try {
      const result = await getClient().request<{ jobs: CronJob[] }>(
        "cron.list",
      );
      jobs.value = result.jobs ?? [];
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to fetch cron jobs";
    } finally {
      loading.value = false;
    }
  }

  async function fetchStatus() {
    try {
      cronStatus.value =
        await getClient().request<CronStatus>("cron.status");
    } catch {
      // non-critical
    }
  }

  async function addJob(params: CronJobParams): Promise<CronJob | null> {
    saving.value = true;
    error.value = null;
    try {
      const job = await getClient().request<CronJob>("cron.add", params);
      jobs.value.push(job);
      return job;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to add cron job";
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function updateJob(
    id: string,
    params: Partial<CronJobParams>,
  ): Promise<boolean> {
    saving.value = true;
    error.value = null;
    try {
      // Schema: { id, patch: {...} }
      const job = await getClient().request<CronJob>("cron.update", {
        id,
        patch: params,
      });
      const idx = jobs.value.findIndex((j) => j.id === id);
      if (idx !== -1) {jobs.value[idx] = job;}
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update cron job";
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function removeJob(id: string): Promise<boolean> {
    error.value = null;
    try {
      await getClient().request("cron.remove", { id });
      jobs.value = jobs.value.filter((j) => j.id !== id);
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to remove cron job";
      return false;
    }
  }

  async function runJob(id: string): Promise<boolean> {
    error.value = null;
    try {
      await getClient().request("cron.run", { id });
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to run cron job";
      return false;
    }
  }

  async function cloneJob(id: string): Promise<CronJob | null> {
    const source = jobs.value.find((j) => j.id === id);
    if (!source) {return null;}
    const params: CronJobParams = {
      name: `${source.name} (copy)`,
      description: source.description,
      schedule: source.schedule,
      agentId: source.agentId,
      enabled: false,
      payload: source.payload,
      session: source.session,
      wakeMode: source.wakeMode,
      delivery: source.delivery,
      deleteAfterRun: source.deleteAfterRun,
      failureAlert: source.failureAlert,
    };
    return addJob(params);
  }

  async function fetchRuns(filter?: CronRunsFilter) {
    runsLoading.value = true;
    try {
      const params: Record<string, unknown> = {};
      if (filter?.jobId) {params.jobId = filter.jobId;}
      if (filter?.status) {params.status = filter.status;}
      if (filter?.limit) {params.limit = filter.limit;}
      if (filter?.offset) {params.offset = filter.offset;}

      const result = await getClient().request<{
        runs: CronRun[];
        hasMore?: boolean;
      }>("cron.runs", params);

      if (filter?.offset && filter.offset > 0) {
        runs.value = [...runs.value, ...(result.runs ?? [])];
      } else {
        runs.value = result.runs ?? [];
      }
      runsHasMore.value = result.hasMore ?? false;
      runsOffset.value = (filter?.offset ?? 0) + (result.runs?.length ?? 0);
    } catch {
      // non-critical
    } finally {
      runsLoading.value = false;
    }
  }

  async function loadMoreRuns(filter?: CronRunsFilter) {
    await fetchRuns({
      ...filter,
      offset: runsOffset.value,
      limit: filter?.limit ?? 20,
    });
  }

  function handleCronEvent(payload: CronEventPayload) {
    if (!payload || !payload.jobId) {return;}
    const job = jobs.value.find((j) => j.id === payload.jobId);
    if (job && payload.status) {
      job.status = payload.status;
      if (payload.type === "cron.run.start") {
        job.lastRun = { status: "running", at: new Date().toISOString() };
      }
      if (
        payload.type === "cron.run.complete" ||
        payload.type === "cron.run.error"
      ) {
        job.lastRun = {
          status: payload.status,
          at: new Date().toISOString(),
        };
      }
    }
  }

  return {
    jobs,
    runs,
    cronStatus,
    loading,
    saving,
    runsLoading,
    error,
    selectedJobId,
    selectedJob,
    runsHasMore,
    runsOffset,
    fetchJobs,
    fetchStatus,
    addJob,
    updateJob,
    removeJob,
    runJob,
    cloneJob,
    fetchRuns,
    loadMoreRuns,
    handleCronEvent,
  };
});
