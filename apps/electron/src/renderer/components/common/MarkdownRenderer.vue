<script setup lang="ts">
import { computed, onMounted, onUpdated, ref } from 'vue'
import MarkdownIt from 'markdown-it'

const props = defineProps<{
  content: string
}>()

const md = new MarkdownIt({
  breaks: true,
  linkify: true,
  html: false,
})

// Make all links open in external browser
const defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, _env, self) {
  return self.renderToken(tokens, idx, options)
}
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  tokens[idx]!.attrSet('target', '_blank')
  tokens[idx]!.attrSet('rel', 'noopener noreferrer')
  return defaultRender(tokens, idx, options, env, self)
}

const rendered = computed(() => md.render(props.content ?? ''))

// Intercept link clicks to open in system browser
const container = ref<HTMLElement>()
function handleLinkClicks(el: HTMLElement) {
  el.querySelectorAll('a[href]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault()
      const href = (a as HTMLAnchorElement).href
      if (href && window.electronAPI?.shell) {
        window.electronAPI.shell.openExternal(href)
      } else if (href) {
        window.open(href, '_blank')
      }
    })
  })
}
onMounted(() => { if (container.value) handleLinkClicks(container.value) })
onUpdated(() => { if (container.value) handleLinkClicks(container.value) })
</script>

<template>
  <!-- eslint-disable vue/no-v-html -->
  <div ref="container" class="markdown-body" v-html="rendered" />
</template>

<style scoped>
.markdown-body {
  line-height: 1.6;
  word-break: break-word;
}
.markdown-body :deep(a) {
  color: #2080f0;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: all 0.15s;
}
.markdown-body :deep(a:hover) {
  color: #1060c0;
  border-bottom-color: #1060c0;
}
:root[data-theme="dark"] .markdown-body :deep(a) {
  color: #63b3ed;
}
:root[data-theme="dark"] .markdown-body :deep(a:hover) {
  color: #90cdf4;
  border-bottom-color: #90cdf4;
}
.markdown-body :deep(pre) {
  background: var(--n-color);
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
  font-size: 13px;
}
.markdown-body :deep(code) {
  font-family: monospace;
  font-size: 13px;
  background: rgba(128,128,128,0.12);
  padding: 2px 4px;
  border-radius: 3px;
}
.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
}
.markdown-body :deep(p) { margin: 4px 0; }
.markdown-body :deep(ul),
.markdown-body :deep(ol) { padding-left: 20px; margin: 4px 0; }
.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--n-border-color);
  margin: 8px 0;
  padding: 4px 12px;
  color: var(--n-text-color-3);
}
</style>
