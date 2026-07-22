<script setup lang="ts">
import { ai } from '../src'

const schema = {
  id: { type: 'number', label: 'ID', form: false },
  name: { type: 'string', label: '姓名', required: true, min: 2 },
  age: { type: 'number', label: '年龄', min: 1, max: 120 },
  role: { type: 'select', label: '角色', enum: ['admin', 'member'] },
  enabled: { type: 'boolean', label: '启用', default: true },
  birthday: { type: 'date', label: '生日' },
  bio: { type: 'text', label: '简介', table: false }
} as const

const form = ai.generateForm({
  schema,
  onSubmit: async (value) => console.log(value)
})
</script>

<template>
  <main style="max-width: 760px; margin: 40px auto">
    <h1>vue-ai-helper</h1>
    <component :is="form.component" />
  </main>
</template>
