import type { Component, Ref } from 'vue'

export type FieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'array'

export interface SelectOption {
  label: string
  value: string | number | boolean
}

export interface FieldSchema {
  type?: FieldType
  label?: string
  title?: string
  description?: string
  required?: boolean
  default?: unknown
  placeholder?: string
  enum?: Array<string | number | boolean>
  options?: SelectOption[]
  hidden?: boolean
  readonly?: boolean
  table?: boolean
  form?: boolean
  searchable?: boolean
  min?: number
  max?: number
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: string
  component?: string
  props?: Record<string, unknown>
}

export type SchemaValue = FieldType | FieldSchema
export type ObjectSchema = Record<string, SchemaValue>

export interface JsonObjectSchema {
  type?: 'object'
  title?: string
  required?: string[]
  properties: Record<string, FieldSchema>
}

export type InputSchema = ObjectSchema | JsonObjectSchema

export interface NormalizedField extends FieldSchema {
  key: string
  type: FieldType
  label: string
  required: boolean
  options: SelectOption[]
}

export interface ValidationRule {
  required?: boolean
  message: string
  trigger?: 'blur' | 'change'
  min?: number
  max?: number
  pattern?: RegExp
  type?: 'number' | 'integer' | 'array'
}

export type Rules = Record<string, ValidationRule[]>

export interface GeneratedView<TModel extends Record<string, unknown> = Record<string, unknown>> {
  kind: 'form' | 'table' | 'crud'
  component: Component
  code: string
  fields: NormalizedField[]
  model?: TModel
  rules?: Rules
}

export interface FormGenerateOptions<TModel extends Record<string, unknown> = Record<string, unknown>> {
  schema: InputSchema
  model?: Partial<TModel>
  labelWidth?: string
  submitText?: string
  resetText?: string
  showReset?: boolean
  onSubmit?: (model: TModel) => void | Promise<void>
}

export interface TableColumn {
  prop: string
  label: string
  width?: string | number
  formatter?: (row: Record<string, unknown>, value: unknown) => unknown
}

export interface TableGenerateOptions {
  schema: InputSchema
  data?: Record<string, unknown>[] | Ref<Record<string, unknown>[]>
  columns?: TableColumn[]
  stripe?: boolean
  border?: boolean
  emptyText?: string
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>

export interface ApiClient<T extends Record<string, unknown> = Record<string, unknown>> {
  list(params?: QueryParams): Promise<T[]>
  get(id: string | number): Promise<T>
  create(data: Partial<T>): Promise<T>
  update(id: string | number, data: Partial<T>): Promise<T>
  remove(id: string | number): Promise<void>
}

export interface ApiGenerateOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  baseURL?: string
  resource: string
  headers?: Record<string, string>
  fetcher?: typeof fetch
  transformList?: (payload: unknown) => T[]
}

export interface GeneratedApi<T extends Record<string, unknown> = Record<string, unknown>> {
  client: ApiClient<T>
  code: string
}

export interface CrudGenerateOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  schema: InputSchema
  api: ApiClient<T> | ApiGenerateOptions<T>
  title?: string
  rowKey?: keyof T & string
  createText?: string
  pageSize?: number
}

export interface AiAdapter {
  generate(prompt: string, context?: Record<string, unknown>): Promise<string>
}

export interface AiConfig {
  adapter?: AiAdapter
}
