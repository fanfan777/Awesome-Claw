<template>
  <n-config-provider :theme="naiveTheme" :locale="naiveLocale" :date-locale="naiveDateLocale">
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <router-view />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import {
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
  NDialogProvider,
  zhCN,
  dateZhCN,
} from "naive-ui";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useTheme } from "./composables/useTheme";

const { locale } = useI18n();
const { naiveTheme } = useTheme();

// Map vue-i18n locale to naive-ui locale objects.
const naiveLocale = computed(() => (locale.value === "zh-CN" ? zhCN : null));
const naiveDateLocale = computed(() =>
  locale.value === "zh-CN" ? dateZhCN : null,
);
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#app {
  height: 100%;
  width: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
</style>
