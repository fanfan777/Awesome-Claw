<script setup lang="ts">
import { NModal, NSpace, NButton } from 'naive-ui'

defineProps<{
  show: boolean
  title: string
  content: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <NModal
    :show="show"
    preset="dialog"
    type="warning"
    :title="title"
    :content="content"
    :positive-text="confirmText ?? 'Confirm'"
    :negative-text="cancelText ?? 'Cancel'"
    :loading="loading"
    @positive-click="emit('confirm')"
    @negative-click="emit('cancel')"
    @close="emit('cancel')"
  />
</template>
