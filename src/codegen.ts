import type { FieldSchema, NormalizedField, TableColumn } from './types'

function js(value: unknown, pretty = true): string {
  const serialized = JSON.stringify(value, (_key, item) => {
    if (typeof item === 'function' || typeof item === 'symbol') return undefined
    return item
  }, pretty ? 2 : 0)
  return (serialized ?? 'undefined')
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function attr(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function modelExpression(key: string): string {
  return `form[${js(key, false)}]`
}

function serializableSchema(fields: NormalizedField[]): Record<string, FieldSchema> {
  return Object.fromEntries(fields.map((field) => {
    const component = typeof field.component === 'string' ? field.component : undefined
    return [field.key, {
      type: field.type,
      label: field.label,
      description: field.description,
      required: field.required,
      default: field.default,
      placeholder: field.placeholder,
      enum: field.enum,
      options: field.options,
      hidden: field.hidden,
      readonly: field.readonly,
      table: field.table,
      form: field.form,
      searchable: field.searchable,
      min: field.min,
      max: field.max,
      pattern: field.pattern,
      format: field.format,
      component,
      props: field.props,
      dependsOn: field.dependsOn,
      visibleWhen: typeof field.visibleWhen === 'function' ? undefined : field.visibleWhen,
      disabledWhen: typeof field.disabledWhen === 'function' ? undefined : field.disabledWhen,
      clearOnHide: field.clearOnHide
    }]
  }))
}

export function codegenWarnings(fields: NormalizedField[]): string[] {
  const warnings: string[] = []
  for (const field of fields) {
    if (field.loadOptions || field.compute || field.validate || typeof field.visibleWhen === 'function' ||
      typeof field.disabledWhen === 'function') {
      warnings.push(`${field.key}: 函数型联动或校验无法序列化，请在生成的 SFC 中手动补回。`)
    }
    if (field.component && typeof field.component !== 'string') {
      warnings.push(`${field.key}: Vue 组件对象无法序列化，请改用已注册的组件名称。`)
    }
  }
  return warnings
}

function fieldTemplate(field: NormalizedField): string {
  const model = modelExpression(field.key)
  const disabled = field.readonly ? ' :disabled="true"' : ''
  if (field.component && typeof field.component === 'string') {
    return `      <component is="${attr(field.component)}" v-model='${attr(model)}'${disabled} />`
  }
  if (field.type === 'boolean') {
    return `      <el-switch v-model='${attr(model)}'${disabled} />`
  }
  if (field.type === 'number' || field.type === 'integer') {
    return `      <el-input-number v-model='${attr(model)}'${disabled} />`
  }
  if (field.type === 'date' || field.type === 'datetime') {
    const type = field.type === 'datetime' ? 'datetime' : 'date'
    return `      <el-date-picker v-model='${attr(model)}' type="${type}"${disabled} />`
  }
  if (field.type === 'select' || field.type === 'array') {
    const multiple = field.type === 'array' ? ' multiple' : ''
    return `      <el-select v-model='${attr(model)}'${multiple}${disabled}>\n${field.options
      .map((option) => `        <el-option label="${attr(option.label)}" :value='${attr(js(option.value, false))}' />`)
      .join('\n')}\n      </el-select>`
  }
  const textarea = field.type === 'text' ? ' type="textarea"' : ''
  return `      <el-input v-model='${attr(model)}'${textarea}${disabled} />`
}

export function formCode(fields: NormalizedField[], labelWidth = '100px'): string {
  const items = fields
    .filter((field) => !field.hidden && field.form !== false)
    .map(
      (field) =>
        `    <el-form-item label="${attr(field.label)}" prop="${attr(field.key)}">\n${fieldTemplate(field)}\n    </el-form-item>`
    )
    .join('\n')

  return `<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { FormInstance } from 'element-plus'
import { ai } from '@lllomh/vue-ai-helper'

const emit = defineEmits<{ submit: [value: Record<string, unknown>] }>()
const schema = ${js(serializableSchema(fields))}
const fields = ai.normalizeSchema(schema)
const form = reactive(ai.createModel(fields))
const rules = ai.generateRules(fields, form)
const formRef = ref<FormInstance>()

async function submit() {
  await formRef.value?.validate()
  emit('submit', { ...form })
}
</script>

<template>
  <el-form ref="formRef" :model="form" :rules="rules" label-width="${attr(labelWidth)}">
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
${columns.map((column) => `    <el-table-column prop="${attr(column.prop)}" label="${attr(column.label)}" />`).join('\n')}
  </el-table>
</template>`
}

export function apiCode(baseURL: string, resource: string): string {
  return `const API_URL = ${js(`${baseURL}${resource}`)}

async function request(path = '', init?: RequestInit) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(API_URL + path, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers }
    })
    if (!response.ok) throw new Error(\`API error: \${response.status}\`)
    return response.status === 204 ? undefined : response.json()
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  list: (query = '') => request(query),
  get: (id: string | number) => request(\`/\${encodeURIComponent(id)}\`),
  create: (data: unknown) => request('', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string | number, data: unknown) =>
    request(\`/\${encodeURIComponent(id)}\`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string | number) => request(\`/\${encodeURIComponent(id)}\`, { method: 'DELETE' })
}`
}

export function crudCode(fields: NormalizedField[], resource: string): string {
  const columns = fields.filter((field) => !field.hidden && field.table !== false)
  const searchFields = fields.filter((field) => field.searchable)
  const schema = serializableSchema(fields)
  return `<script setup lang="ts">
import { ai } from '@lllomh/vue-ai-helper'

const crud = ai.generateCrud({
  title: '数据管理',
  rowKey: 'id',
  pagination: 'server',
  schema: ${js(schema)},
  api: { resource: ${js(resource)} }
})
</script>

<template>
  <!-- 已生成 ${searchFields.length} 个搜索字段和 ${columns.length} 个表格字段 -->
  <component :is="crud.component" />
</template>`
}
