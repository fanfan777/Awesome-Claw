import { createRouter, createWebHashHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const WIZARD_DONE_KEY = "openclaw:wizard-done";

function isWizardCompleted(): boolean {
  return localStorage.getItem(WIZARD_DONE_KEY) === "1";
}

export function markWizardCompleted(): void {
  localStorage.setItem(WIZARD_DONE_KEY, "1");
}

export function resetWizardCompleted(): void {
  localStorage.removeItem(WIZARD_DONE_KEY);
}

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: () => (isWizardCompleted() ? "/overview" : "/wizard"),
  },
  {
    path: "/wizard",
    component: () => import("../layouts/WizardLayout.vue"),
    children: [
      {
        path: "",
        name: "wizard",
        component: () => import("../views/WizardView.vue"),
      },
    ],
  },
  {
    path: "/connection",
    name: "connection",
    component: () => import("../views/ConnectionView.vue"),
  },
  {
    path: "/",
    component: () => import("../layouts/MainLayout.vue"),
    children: [
      {
        path: "overview",
        name: "overview",
        component: () => import("../views/OverviewView.vue"),
      },
      {
        path: "chat",
        name: "chat",
        component: () => import("../views/ChatView.vue"),
      },
      {
        path: "agents",
        name: "agents",
        component: () => import("../views/AgentsView.vue"),
      },
      {
        path: "models",
        name: "models",
        component: () => import("../views/ModelsView.vue"),
      },
      {
        path: "channels",
        name: "channels",
        component: () => import("../views/ChannelsView.vue"),
      },
      {
        path: "skills",
        name: "skills",
        component: () => import("../views/SkillsView.vue"),
      },
      {
        path: "plugins",
        name: "plugins",
        component: () => import("../views/PluginsView.vue"),
      },
      {
        path: "cron",
        name: "cron",
        component: () => import("../views/CronView.vue"),
      },
      {
        path: "sessions",
        name: "sessions",
        component: () => import("../views/SessionsView.vue"),
      },
      {
        path: "nodes",
        name: "nodes",
        component: () => import("../views/NodesView.vue"),
      },
      {
        path: "instances",
        name: "instances",
        component: () => import("../views/InstancesView.vue"),
      },
      {
        path: "config",
        name: "config",
        component: () => import("../views/ConfigView.vue"),
      },
      {
        path: "usage",
        name: "usage",
        component: () => import("../views/UsageView.vue"),
      },
      {
        path: "logs",
        name: "logs",
        component: () => import("../views/LogsView.vue"),
      },
      {
        path: "debug",
        name: "debug",
        component: () => import("../views/DebugView.vue"),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// Navigation guard: redirect to wizard if setup not completed
router.beforeEach((to) => {
  const wizardDone = isWizardCompleted();
  const isWizardRoute = to.path === "/wizard" || to.path.startsWith("/wizard");
  const isConnectionRoute = to.path === "/connection";

  // Not completed → force wizard (except wizard/connection pages themselves)
  if (!wizardDone && !isWizardRoute && !isConnectionRoute) {
    return { path: "/wizard" };
  }

  return true;
});

export default router;
