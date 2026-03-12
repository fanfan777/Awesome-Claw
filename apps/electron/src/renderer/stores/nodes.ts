import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";

export interface Node {
  id: string;
  name?: string;
  type?: string;
  platform?: string;
  ip?: string;
  connected?: boolean;
  lastSeen?: string;
  uptime?: number;
  capabilities?: string[];
  commands?: string[];
}

export interface PairRequest {
  id: string;
  nodeId?: string;
  name?: string;
  displayName?: string;
  ip?: string;
  requestedAt?: string;
}

export interface DevicePair {
  id: string;
  name?: string;
  displayName?: string;
  platform?: string;
  role?: string;
  pairedAt?: string;
  lastSeen?: string;
  token?: string;
}

export interface ExecApprovalRule {
  enabled: boolean;
  mode?: string;
  allowPatterns?: string[];
  denyPatterns?: string[];
}

export interface ExecApprovalRequest {
  id: string;
  tool: string;
  args?: Record<string, unknown>;
  agentId?: string;
  nodeId?: string;
  requestedAt: string;
}

export interface NodeBinding {
  nodeId: string;
  agentId?: string;
  isDefault?: boolean;
}

export const useNodesStore = defineStore("nodes", () => {
  const nodes = ref<Node[]>([]);
  const pairRequests = ref<PairRequest[]>([]);
  const devicePairRequests = ref<DevicePair[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const execRules = ref<Record<string, ExecApprovalRule>>({});
  const execQueue = ref<ExecApprovalRequest[]>([]);
  const bindings = ref<NodeBinding[]>([]);

  const onlineNodes = computed(() =>
    nodes.value.filter((n) => n.connected),
  );
  const offlineNodes = computed(() =>
    nodes.value.filter((n) => !n.connected),
  );

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error("Gateway not connected");}
    return c;
  }

  async function fetchNodes() {
    loading.value = true;
    error.value = null;
    try {
      const result = await getClient().request<{ nodes: Node[] }>(
        "node.list",
      );
      nodes.value = result.nodes ?? [];
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to fetch nodes";
    } finally {
      loading.value = false;
    }
  }

  async function fetchPairRequests() {
    try {
      const result = await getClient().request<{
        requests: PairRequest[];
      }>("node.pair.list");
      pairRequests.value = result.requests ?? [];
    } catch {
      // non-critical
    }
  }

  async function approvePair(id: string): Promise<boolean> {
    error.value = null;
    try {
      // Schema: { requestId }
      await getClient().request("node.pair.approve", { requestId: id });
      pairRequests.value = pairRequests.value.filter((r) => r.id !== id);
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to approve pair";
      return false;
    }
  }

  async function rejectPair(id: string): Promise<boolean> {
    error.value = null;
    try {
      // Schema: { requestId }
      await getClient().request("node.pair.reject", { requestId: id });
      pairRequests.value = pairRequests.value.filter((r) => r.id !== id);
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to reject pair";
      return false;
    }
  }

  async function fetchDevicePairs() {
    try {
      const result = await getClient().request<{
        pairs: DevicePair[];
      }>("device.pair.list");
      devicePairRequests.value = result.pairs ?? [];
    } catch {
      // non-critical
    }
  }

  async function approveDevice(id: string): Promise<boolean> {
    error.value = null;
    try {
      // Schema: { requestId }
      await getClient().request("device.pair.approve", { requestId: id });
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to approve device";
      return false;
    }
  }

  async function rejectDevice(id: string): Promise<boolean> {
    error.value = null;
    try {
      // Schema: { requestId }
      await getClient().request("device.pair.reject", { requestId: id });
      devicePairRequests.value = devicePairRequests.value.filter(
        (d) => d.id !== id,
      );
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to reject device";
      return false;
    }
  }

  async function removeDevice(id: string): Promise<boolean> {
    error.value = null;
    try {
      // Schema: { deviceId }
      await getClient().request("device.pair.remove", { deviceId: id });
      devicePairRequests.value = devicePairRequests.value.filter(
        (d) => d.id !== id,
      );
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to remove device";
      return false;
    }
  }

  async function rotateToken(id: string, role = "default"): Promise<string | null> {
    error.value = null;
    try {
      // Schema: { deviceId, role, scopes? }
      const result = await getClient().request<{ token: string }>(
        "device.token.rotate",
        { deviceId: id, role },
      );
      return result.token;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to rotate token";
      return null;
    }
  }

  async function revokeToken(id: string, role = "default"): Promise<boolean> {
    error.value = null;
    try {
      // Schema: { deviceId, role }
      await getClient().request("device.token.revoke", { deviceId: id, role });
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to revoke token";
      return false;
    }
  }

  async function renameNode(id: string, name: string): Promise<boolean> {
    error.value = null;
    try {
      // Schema: { nodeId, displayName }
      await getClient().request("node.rename", { nodeId: id, displayName: name });
      const node = nodes.value.find((n) => n.id === id);
      if (node) {node.name = name;}
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to rename node";
      return false;
    }
  }

  async function fetchExecRules() {
    try {
      // Schema: {} (no params)
      const result = await getClient().request<{
        rules: Record<string, ExecApprovalRule>;
      }>("exec.approvals.get");
      execRules.value = result.rules ?? {};
    } catch {
      // non-critical
    }
  }

  async function setExecRule(
    target: string,
    rule: ExecApprovalRule,
  ): Promise<boolean> {
    error.value = null;
    try {
      // Schema: { file, baseHash? } — file is a complex approvals file object
      await getClient().request("exec.approvals.set", {
        file: { [target]: rule },
      });
      execRules.value[target] = rule;
      return true;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to set exec approval rule";
      return false;
    }
  }

  async function approveExec(id: string): Promise<boolean> {
    error.value = null;
    try {
      // Schema: { id, decision }
      await getClient().request("exec.approval.approve", { id, decision: "approve" });
      execQueue.value = execQueue.value.filter((r) => r.id !== id);
      return true;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to approve exec request";
      return false;
    }
  }

  async function denyExec(id: string): Promise<boolean> {
    error.value = null;
    try {
      // Schema: { id, decision }
      await getClient().request("exec.approval.deny", { id, decision: "deny" });
      execQueue.value = execQueue.value.filter((r) => r.id !== id);
      return true;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to deny exec request";
      return false;
    }
  }

  function handleExecApprovalEvent(req: ExecApprovalRequest) {
    if (req && req.id) {
      const existing = execQueue.value.find((r) => r.id === req.id);
      if (!existing) {execQueue.value.push(req);}
    }
  }

  async function fetchBindings() {
    try {
      const result = await getClient().request<{
        bindings: NodeBinding[];
      }>("node.bindings");
      bindings.value = result.bindings ?? [];
    } catch {
      // non-critical
    }
  }

  async function setBinding(binding: NodeBinding): Promise<boolean> {
    error.value = null;
    try {
      await getClient().request("node.bind", binding);
      await fetchBindings();
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to set binding";
      return false;
    }
  }

  return {
    nodes,
    pairRequests,
    devicePairRequests,
    loading,
    error,
    execRules,
    execQueue,
    bindings,
    onlineNodes,
    offlineNodes,
    fetchNodes,
    fetchPairRequests,
    approvePair,
    rejectPair,
    fetchDevicePairs,
    approveDevice,
    rejectDevice,
    removeDevice,
    rotateToken,
    revokeToken,
    renameNode,
    fetchExecRules,
    setExecRule,
    approveExec,
    denyExec,
    handleExecApprovalEvent,
    fetchBindings,
    setBinding,
  };
});
