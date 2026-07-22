import type {
  FieldSchema,
  FieldType,
  InputSchema,
  JsonObjectSchema,
  NormalizedField,
  Rules,
  SelectOption
} from './types'

const knownTypes = new Set<FieldType>([
  'string',
  'text',
  'number',
  'integer',
  'boolean',
  'date',
  'datetime',
  'select',
  'array'
])

const humanize = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase())

function normalizeType(field: FieldSchema): FieldType {
  if (field.enum || field.options) return field.type === 'array' ? 'array' : 'select'
  if (field.format === 'date') return 'date'
  if (field.format === 'date-time' || field.format === 'datetime') return 'datetime'
  return field.type && knownTypes.has(field.type) ? field.type : 'string'
}

function normalizeOptions(field: FieldSchema): SelectOption[] {
  if (field.options) return field.options
  return (field.enum ?? []).map((value) => ({ label: String(value), value }))
}

export function normalizeSchema(schema: InputSchema): NormalizedField[] {
  const isJsonSchema = 'properties' in schema
  const source = isJsonSchema ? (schema as JsonObjectSchema).properties : schema
  const required = new Set(isJsonSchema ? (schema as JsonObjectSchema).required ?? [] : [])

  return Object.entries(source).map(([key, value]) => {
    const field: FieldSchema = typeof value === 'string' ? { type: value as FieldType } : value
    return {
      ...field,
      key,
      type: normalizeType(field),
      label: field.label ?? field.title ?? humanize(key),
      required: field.required ?? required.has(key),
      options: normalizeOptions(field),
      min: field.min ?? field.minimum ?? field.minLength,
      max: field.max ?? field.maximum ?? field.maxLength
    }
  })
}

export function defaultValue(field: NormalizedField): unknown {
  if (field.default !== undefined) return field.default
  if (field.type === 'boolean') return false
  if (field.type === 'array') return []
  if (field.type === 'number' || field.type === 'integer') return undefined
  return ''
}

export function createModel(
  fields: NormalizedField[],
  initial: Record<string, unknown> = {}
): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      initial[field.key] !== undefined ? initial[field.key] : defaultValue(field)
    ])
  )
}

export function generateRules(fields: NormalizedField[]): Rules {
  return Object.fromEntries(
    fields.map((field) => {
      const rules: Rules[string] = []
      const trigger = ['select', 'array', 'boolean', 'date', 'datetime'].includes(field.type)
        ? 'change'
        : 'blur'

      if (field.required) {
        rules.push({ required: true, message: `请输入${field.label}`, trigger })
      }
      if (field.min !== undefined || field.max !== undefined) {
        rules.push({
          ...(field.min !== undefined ? { min: field.min } : {}),
          ...(field.max !== undefined ? { max: field.max } : {}),
          message: `${field.label}长度或数值范围不正确`,
          trigger
        })
      }
      if (field.pattern) {
        rules.push({ pattern: new RegExp(field.pattern), message: `${field.label}格式不正确`, trigger })
      }
      return [field.key, rules]
    })
  )
}
