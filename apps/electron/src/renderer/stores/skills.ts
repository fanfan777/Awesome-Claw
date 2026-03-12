import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useConnectionStore } from "@renderer/gateway/connection";
import { SKILL_CATALOG, SKILL_CATEGORIES, type SkillCategoryDef } from "@renderer/data/skills-catalog";

/** Raw skill entry from gateway `skills.status` RPC */
export interface GatewaySkillEntry {
  name: string;
  skillKey: string;
  description?: string;
  source?: string;
  emoji?: string;
  bundled?: boolean;
  disabled?: boolean;
  eligible?: boolean;
  always?: boolean;
  blockedByAllowlist?: boolean;
  primaryEnv?: string;
  homepage?: string;
  requirements?: { bins?: string[]; os?: string[] };
  missing?: { bins?: string[]; os?: string[] };
  install?: Array<{ method: string }>;
}

/** Normalized skill for the UI */
export interface SkillStatus {
  id: string;
  name?: string;
  emoji?: string;
  version?: string;
  enabled?: boolean;
  installed?: boolean;
  description?: string;
  bin?: string;
  source?: string;
  os?: string[];
  deps?: string[];
  missingDeps?: string[];
  incompatible?: boolean;
  apiKeyRequired?: boolean;
  apiKeySet?: boolean;
}

export interface SkillBin {
  name: string;
  path: string;
}

export interface InstallOptions {
  version?: string;
  force?: boolean;
  packageManager?: string;
}

export const useSkillsStore = defineStore("skills", () => {
  const skills = ref<SkillStatus[]>([]);
  const bins = ref<SkillBin[]>([]);
  const loading = ref(false);
  const installing = ref<string | null>(null);
  const error = ref<string | null>(null);
  const searchQuery = ref("");

  // Build catalog lookup map with multiple key variants for robust matching
  const skillCatalogMap = computed(() => {
    const map: Record<string, typeof SKILL_CATALOG[number]> = {};
    for (const item of SKILL_CATALOG) {
      // Index by exact catalog ID (e.g., "coding-agent")
      map[item.id] = item;
      // Index by English display name (e.g., "Coding Agent") for name-based fallback
      map[item.name.en] = item;
      // Index by lowercase English name (e.g., "coding agent")
      map[item.name.en.toLowerCase()] = item;
      // Index by Chinese display name (e.g., "编码 Agent")
      map[item.name.zh] = item;
    }
    return map;
  });

  // Group by source (legacy)
  const groupedSkills = computed(() => {
    const groups: Record<string, SkillStatus[]> = {
      "built-in": [],
      managed: [],
      workspace: [],
    };
    for (const skill of filteredSkills.value) {
      const source = skill.source ?? "built-in";
      if (!groups[source]) {groups[source] = [];}
      groups[source].push(skill);
    }
    return groups;
  });

  // Group by functional category (using static catalog)
  const categoryDefs = computed(() => SKILL_CATEGORIES);

  const groupedByCategory = computed(() => {
    const catalog = skillCatalogMap.value;
    const groups: Record<string, SkillStatus[]> = {};
    const uncategorized: SkillStatus[] = [];

    for (const skill of filteredSkills.value) {
      // Try multiple lookup keys: exact id, then name-based fallback
      const catItem = catalog[skill.id]
        ?? catalog[(skill.name ?? "")]
        ?? catalog[(skill.name ?? "").toLowerCase()];
      const cats = catItem?.categories;
      if (cats && cats.length > 0) {
        const primaryCat = cats[0];
        if (!groups[primaryCat]) {groups[primaryCat] = [];}
        groups[primaryCat].push(skill);
      } else {
        uncategorized.push(skill);
      }
    }

    // Return ordered by SKILL_CATEGORIES order
    const ordered: { category: SkillCategoryDef; skills: SkillStatus[] }[] = [];
    for (const cat of SKILL_CATEGORIES) {
      const items = groups[cat.id];
      if (items && items.length > 0) {
        ordered.push({ category: cat, skills: items });
      }
    }
    if (uncategorized.length > 0) {
      ordered.push({
        category: { id: "other", icon: "📦", label: { zh: "其他", en: "Other" }, type: "general" },
        skills: uncategorized,
      });
    }
    return ordered;
  });

  const filteredSkills = computed(() => {
    const q = searchQuery.value.toLowerCase().trim();
    if (!q) {return skills.value;}
    return skills.value.filter(
      (s) =>
        (s.name ?? s.id).toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  });

  const enabledCount = computed(
    () => skills.value.filter((s) => s.enabled).length,
  );

  const incompatibleCount = computed(
    () => skills.value.filter((s) => s.incompatible).length,
  );

  function getClient() {
    const c = useConnectionStore().client;
    if (!c) {throw new Error("Gateway not connected");}
    return c;
  }

  async function fetchStatus() {
    loading.value = true;
    error.value = null;
    try {
      const result = await getClient().request<{
        skills: GatewaySkillEntry[];
      }>("skills.status");

      // Normalize gateway entries to SkillStatus
      const gatewaySkills = (result.skills ?? []).map((s): SkillStatus => ({
        id: s.skillKey || s.name,
        name: s.name,
        emoji: s.emoji,
        description: s.description,
        source: s.source,
        enabled: !s.disabled && s.eligible,
        installed: true,
        incompatible: s.missing?.os ? s.missing.os.length > 0 : false,
        deps: s.requirements?.bins,
        missingDeps: s.missing?.bins,
        apiKeyRequired: !!s.primaryEnv,
        apiKeySet: s.eligible && !!s.primaryEnv,
      }));

      // Merge catalog entries that are NOT in the gateway response
      // so users can see all available skills (not just registered ones)
      const gatewayIds = new Set(gatewaySkills.map((s) => s.id));
      for (const catItem of SKILL_CATALOG) {
        if (!gatewayIds.has(catItem.id)) {
          gatewaySkills.push({
            id: catItem.id,
            name: catItem.name.en,
            emoji: undefined,
            description: catItem.description.en,
            source: catItem.source === "builtin" ? "built-in" : "managed",
            enabled: false,
            installed: false,
            incompatible: false,
          });
        }
      }

      skills.value = gatewaySkills;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to fetch skills";
    } finally {
      loading.value = false;
    }
  }

  /** Load static catalog as fallback when gateway is not connected */
  function loadCatalogFallback() {
    if (skills.value.length > 0) {return;} // already loaded
    skills.value = SKILL_CATALOG.map((catItem) => ({
      id: catItem.id,
      name: catItem.name.en,
      description: catItem.description.en,
      source: catItem.source === "builtin" ? "built-in" : "managed",
      enabled: false,
      installed: false,
      incompatible: false,
    }));
  }

  async function fetchBins() {
    try {
      const result = await getClient().request<{ bins: SkillBin[] }>(
        "skills.bins",
      );
      bins.value = result.bins ?? [];
    } catch {
      // non-critical
    }
  }

  async function install(
    skillId: string,
    _options?: InstallOptions,
  ): Promise<boolean> {
    installing.value = skillId;
    error.value = null;
    try {
      const client = getClient();
      // Determine skill source from catalog
      const catItem = SKILL_CATALOG.find((s) => s.id === skillId);
      const isBuiltin = catItem?.source === "builtin";
      const isClawHub = skillId.startsWith("clawhub:") || catItem?.source === "clawhub";

      if (isBuiltin) {
        // Built-in skills: enable via skills.update
        await client.request("skills.update", {
          skillKey: skillId,
          enabled: true,
        });
      } else if (isClawHub) {
        // ClawHub skills: add via CLI (`openclaw add <slug>`)
        const slug = skillId.replace(/^clawhub:/, "");
        const api = (window as Record<string, unknown>).electronAPI as
          | { skills?: { add?: (name: string) => Promise<{ ok: boolean; error?: string }> } }
          | undefined;
        if (api?.skills?.add) {
          const result = await api.skills.add(slug);
          if (!result.ok) {
            throw new Error(result.error || `Failed to add skill: ${slug}`);
          }
          // fetchStatus will run below, then we patch optimistically after
          await fetchStatus();
          // Gateway may not see new ClawHub skill yet — optimistically mark installed
          const skill = skills.value.find((s) => s.id === skillId);
          if (skill) {
            skill.installed = true;
            skill.enabled = true;
          }
          installing.value = null;
          return true;
        } else {
          // Fallback: try gateway RPC (works if skill already in workspace)
          try {
            await client.request("skills.install", {
              name: slug,
              installId: `install-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            });
          } catch {
            throw new Error(
              `请先通过命令行安装此技能: clawhub install ${slug}\n` +
              `Please install this skill via CLI first: clawhub install ${slug}`,
            );
          }
        }
      } else {
        // Unknown source: try skills.install with raw id
        await client.request("skills.install", {
          name: skillId,
          installId: `install-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
      }
      await fetchStatus();
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to install skill";
      console.error("[skills-store] install error:", skillId, err);
      return false;
    } finally {
      installing.value = null;
    }
  }

  async function update(skillId: string): Promise<boolean> {
    error.value = null;
    try {
      // Schema: { skillKey, enabled?, apiKey?, env? }
      await getClient().request("skills.update", { skillKey: skillId });
      await fetchStatus();
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to update skill";
      return false;
    }
  }

  async function toggleSkill(
    skillId: string,
    enabled: boolean,
  ): Promise<boolean> {
    error.value = null;
    try {
      // Schema: skills.update { skillKey, enabled?, apiKey?, env? }
      await getClient().request("skills.update", {
        skillKey: skillId,
        enabled,
      });
      const skill = skills.value.find((s) => s.id === skillId);
      if (skill) {skill.enabled = enabled;}
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to toggle skill";
      return false;
    }
  }

  async function setApiKey(
    skillId: string,
    key: string,
  ): Promise<boolean> {
    error.value = null;
    try {
      // Schema: skills.update { skillKey, apiKey }
      await getClient().request("skills.update", {
        skillKey: skillId,
        apiKey: key,
      });
      const skill = skills.value.find((s) => s.id === skillId);
      if (skill) {skill.apiKeySet = !!key;}
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to set API key";
      return false;
    }
  }

  async function clearApiKey(skillId: string): Promise<boolean> {
    return setApiKey(skillId, "");
  }

  return {
    skills,
    bins,
    loading,
    installing,
    error,
    searchQuery,
    groupedSkills,
    groupedByCategory,
    categoryDefs,
    skillCatalogMap,
    filteredSkills,
    enabledCount,
    incompatibleCount,
    fetchStatus,
    fetchBins,
    loadCatalogFallback,
    install,
    update,
    toggleSkill,
    setApiKey,
    clearApiKey,
  };
});
