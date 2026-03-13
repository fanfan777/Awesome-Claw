<template>
  <div class="wizard-wrap">
    <div class="wizard-container">
      <!-- Header -->
      <div class="wizard-header">
        <h1 class="wizard-title">OpenClaw</h1>
        <!-- exit link removed per user request -->
      </div>

      <!-- Page content -->
      <router-view v-slot="{ Component }">
        <transition name="slide-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const { t } = useI18n();
const router = useRouter();

function handleExit() {
  router.push("/overview");
}
</script>

<style scoped>
.wizard-wrap {
  height: 100vh;
  overflow-y: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(160deg, #e8f5e9 0%, #e3f2fd 40%, #f3e5f5 100%);
}

:root[data-theme="dark"] .wizard-wrap {
  background: linear-gradient(160deg, #1a2e1c 0%, #1a2636 40%, #2a1a2e 100%);
}

.wizard-container {
  width: 100%;
  max-width: 720px;
  padding-bottom: 48px;
}

.wizard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}

.wizard-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin: 0;
  background: linear-gradient(135deg, #18a058, #2080f0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.exit-link {
  font-size: 13px;
  color: var(--n-text-color-3, #909399);
  cursor: pointer;
  text-decoration: none;
  transition: color 0.15s;
}

.exit-link:hover {
  color: var(--n-text-color-2, #606266);
  text-decoration: underline;
}

/* Page transition */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(12px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
</style>
