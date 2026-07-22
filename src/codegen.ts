import type { NormalizedField, TableColumn } from './types'

const js = (value: unknown) => JSON.stringify(value, null, 2)

function fieldTemplate(field: NormalizedField): string {
  const disabled = field.readonly ? ' :disabled="true"' : ''
  if (field.type === 'boolean') {
    return `      <el-switch v-model="form.${field.key}"${disabled} />`
  }
  if (field.type === 'number' || field.type === 'integer') {
    return `      <el-input-number v-model="form.${field.key}"${disabled} />`
  }
  if (field.type === 'date' || field.type === 'datetime') {
    const type = field.type === 'datetime' ? 'datetime' : 'date'
    return `      <el-date-picker v-model="form.${field.key}" type="${type}"${disabled} />`
  }
  if (field.type === 'select' || field.type === 'array') {
    const multiple = field.type === 'array' ? ' multiple' : ''
    return `      <el-select v-model="form.${field.key}"${multiple}${disabled}>\n${field.options
      .map((option) => `        <el-option label="${option.label}" :value='${js(option.value)}' />`)
      .join('\n')}\n      </el-select>`
  }
  const textarea = field.type === 'text' ? ' type="textarea"' : ''
  return `      <el-input v-model="form.${field.key}"${textarea}${disabled} />`
}

export function formCode(fields: NormalizedField[], labelWidth = '100px'): string {
  const schema = Object.fromEntries(
    fields.map(({ key, type, label, required, ...rest }) => [key, { type, label, required, ...rest }])
  )
  const items = fields
    .filter((field) => !field.hidden && field.form !== false)
    .map(
      (field) =>
        `    <el-form-item label="${field.label}" prop="${field.key}">\n${fieldTemplate(field)}\n    </el-form-item>`
    )
    .join('\n')

  return `<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { FormInstance } from 'element-plus'
import { ai } from '@lllomh/vue-ai-helper'

const emit = defineEmits<{ submit: [value: Record<string, unknown>] }>()
const schema = ${js(schema)}
const fields = ai.normalizeSchema(schema)
const form = reactive(ai.createModel(fields))
const rules = ai.generateRules(fields)
const formRef = ref<FormInstance>()

async function submit() {
  await formRef.value?.validate()
  emit('submit', { ...form })
}
</script>

<template>
  <el-form ref="formRef" :model="form" :rules="rules" label-width="${labelWidth}">
${items}
    <el-form-item>
      <el-button type="primary" @click="submit">提交</el-button>
    </el-form-item>
  </el-form>
</template>`
}

export function tableCode(columns: TableColumn[]): string {
  return `<script setup lang="ts">
defineProps<{ data: Record<string, unknown>[] }>()
</script>

<template>
  <el-table :data="data" stripe border>
${columns.map((column) => `    <el-table-column prop="${column.prop}" label="${column.label}" />`).join('\n')}
  </el-table>
</template>`
}

export function apiCode(baseURL: string, resource: string): string {
  return `const API_URL = ${js(`${baseURL}${resource}`)}

async function request(path = '', init?: RequestInit) {
  const response = await fetch(API_URL + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  })
  if (!response.ok) throw new Error(\`API error: \${response.status}\`)
  return response.status === 204 ? undefined : response.json()
}

export const api = {
  list: () => request(),
  get: (id: string | number) => request(\`/\${id}\`),
  create: (data: unknown) => request('', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string | number, data: unknown) =>
    request(\`/\${id}\`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string | number) => request(\`/\${id}\`, { method: 'DELETE' })
}`
}

export function crudCode(fields: NormalizedField[], resource: string): string {
  const columns = fields.filter((field) => !field.hidden && field.table !== false)
  return `<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ai } from '@lllomh/vue-ai-helper'

const rows = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const api = ai.generateApi({ resource: '${resource}' }).client

async function load() {
  loading.value = true
  try { rows.value = await api.list() } finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <el-button type="primary">新增</el-button>
  <el-table v-loading="loading" :data="rows">
${columns.map((field) => `    <el-table-column prop="${field.key}" label="${field.label}" />`).join('\n')}
    <el-table-column label="操作" fixed="right">
      <template #default="{ row }">
        <el-button link type="primary">编辑</el-button>
        <el-button link type="danger" @click="api.remove(row.id).then(load)">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>`
}
