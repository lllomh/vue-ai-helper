import type { Component, Ref, VNodeChild } from 'vue'

export type DataModel = Record<string, unknown>

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

export type FieldCondition<TModel extends DataModel = DataModel> =
  | boolean
  | Partial<TModel>
  | ((model: TModel) => boolean)

export interface FieldRenderContext<TModel extends DataModel = DataModel> {
  field: NormalizedField
  model: TModel
  value: unknown
  options: SelectOption[]
  disabled: boolean
  update: (value: unknown) => void
}

export interface FieldComponentDefinition {
  component?: string | Component
  render?: (context: FieldRenderContext) => VNodeChild
  defaultValue?: unknown | (() => unknown)
  getProps?: (context: FieldRenderContext) => Record<string, unknown>
  optionsProp?: string
}

export interface FieldSchema {
  type?: FieldType
  label?: string
  title?: string
  description?: string
  required?: boolean
  default?: unknown
  placeholder?: string
  enum?: ReadonlyArray<string | number | boolean>
  options?: ReadonlyArray<SelectOption>
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
  component?: string | Component
  props?: Record<string, unknown>
  dependsOn?: readonly string[]
  visibleWhen?: FieldCondition
  disabledWhen?: FieldCondition
  clearOnHide?: boolean
  loadOptions?: (model: DataModel) => SelectOption[] | Promise<SelectOption[]>
  compute?: (model: DataModel) => unknown
  validate?: (value: unknown, model: DataModel) => string | void | Promise<string | void>
}

export type SchemaValue = FieldType | FieldSchema
export type ObjectSchema = Record<string, SchemaValue>

export interface JsonObjectSchema {
  type?: 'object'
  title?: string
  required?: readonly string[]
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
  validator?: (
    rule: unknown,
    value: unknown,
    callback: (error?: Error) => void
  ) => void | Promise<void>
}

export type Rules = Record<string, ValidationRule[]>

export interface GeneratedView<TModel extends Record<string, unknown> = Record<string, unknown>> {
  kind: 'form' | 'table' | 'crud'
  component: Component
  code: string
  fields: NormalizedField[]
  model?: TModel
  rules?: Rules
  warnings?: string[]
}

export interface FormGenerateOptions<TModel extends Record<string, unknown> = Record<string, unknown>> {
  schema: InputSchema
  model?: Partial<TModel>
  labelWidth?: string
  submitText?: string
  resetText?: string
  showReset?: boolean
  onSubmit?: (model: TModel) => void | Promise<void>
  onError?: (error: unknown) => void
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

export interface PaginatedResult<T> {
  items: T[]
  total: number
}

export interface ApiClient<T extends Record<string, unknown> = Record<string, unknown>> {
  list(params?: QueryParams): Promise<T[]>
  listPage?(params?: QueryParams): Promise<PaginatedResult<T>>
  get(id: string | number): Promise<T>
  create(data: Partial<T>): Promise<T>
  update(id: string | number, data: Partial<T>): Promise<T>
  remove(id: string | number): Promise<void>
  bulkRemove?(ids: Array<string | number>): Promise<void>
}

export interface ApiGenerateOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  baseURL?: string
  resource: string
  headers?: Record<string, string>
  fetcher?: typeof fetch
  transformList?: (payload: unknown) => T[]
  transformPage?: (payload: unknown) => PaginatedResult<T>
  timeout?: number
  retries?: number
  retryDelay?: number
  credentials?: RequestCredentials
  onRequest?: (url: string, init: RequestInit) => void | Promise<void>
  onResponse?: (response: Response) => void | Promise<void>
}

export interface GeneratedApi<T extends Record<string, unknown> = Record<string, unknown>> {
  client: ApiClient<T>
  code: string
}

export type CrudAction = 'create' | 'edit' | 'view' | 'remove' | 'batchRemove'
export type CrudPermission<T extends DataModel> = boolean | ((row?: T) => boolean)

export interface CrudGenerateOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  schema: InputSchema
  api: ApiClient<T> | ApiGenerateOptions<T>
  title?: string
  rowKey?: keyof T & string
  createText?: string
  pageSize?: number
  pageSizes?: number[]
  pagination?: 'client' | 'server'
  search?: boolean
  batchDelete?: boolean
  detail?: boolean
  permissions?: Partial<Record<CrudAction, CrudPermission<T>>>
  defaultSort?: { prop: string; order: 'ascending' | 'descending' }
  beforeSave?: (data: Partial<T>, mode: 'create' | 'edit') => Partial<T> | Promise<Partial<T>>
  confirmDelete?: (rows: T[]) => boolean | Promise<boolean>
  onSuccess?: (action: CrudAction, data?: unknown) => void
  onError?: (error: unknown, action: CrudAction | 'list') => void
}

export interface AiAdapter {
  generate(prompt: string, context?: Record<string, unknown>): Promise<string>
}

export interface AiConfig {
  adapter?: AiAdapter
  fields?: Record<string, FieldComponentDefinition>
}
