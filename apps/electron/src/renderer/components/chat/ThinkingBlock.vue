<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NCollapseTransition, NText } from 'naive-ui'
import MarkdownRenderer from '@renderer/components/common/MarkdownRenderer.vue'

const { t } = useI18n()

defineProps<{
  content: string
  visible: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <div class="thinking-block">
    <div class="thinking-block__header" @click="emit('toggle')">
      <NText depth="3" style="font-size: 12px; font-style: italic; user-select: none; cursor: pointer;">
        <span class="thinking-block__arrow" :class="{ 'thinking-block__arrow--open': visible }">&#9654;</span>
        {{ t('chat.thinking') }}
      </NText>
    </div>
    <NCollapseTransition :show="visible">
      <div class="thinking-block__content">
        <MarkdownRenderer :content="content" />
      </div>
    </NCollapseTransition>
  </div>
</template>

<style scoped>
.thinking-block {
  margin: 6px 0;
  border-radius: 6px;
  background: rgba(128, 128, 128, 0.06);
  border: 1px solid rgba(128, 128, 128, 0.12);
  overflow: hidden;
}
.thinking-block__header {
  padding: 6px 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.thinking-block__header:hover {
  background: rgba(128, 128, 128, 0.08);
}
.thinking-block__arrow {
  display: inline-block;
  font-size: 10px;
  transition: transform 0.2s ease;
  margin-right: 4px;
}
.thinking-block__arrow--open {
  transform: rotate(90deg);
}
.thinking-block__content {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--n-text-color-3);
  font-style: italic;
  border-top: 1px solid rgba(128, 128, 128, 0.1);
}
</style>
