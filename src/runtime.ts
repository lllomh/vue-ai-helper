import {
  defineComponent,
  h,
  isRef,
  onMounted,
  reactive,
  ref,
  resolveComponent,
  toRaw,
  unref,
  type Component,
  type Ref
} from 'vue'
import { crudCode, formCode, tableCode } from './codegen'
import { generateApi } from './api'
import { createModel, generateRules, normalizeSchema } from './schema'
import type {
  ApiClient,
  CrudGenerateOptions,
  FormGenerateOptions,
  GeneratedView,
  NormalizedField,
  TableColumn,
  TableGenerateOptions
} from './types'

type Model = Record<string, unknown>

const clone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

const el = (name: string): Component => resolveComponent(name) as Component

function renderInput(field: NormalizedField, model: Model) {
  const common = {
    modelValue: model[field.key],
    'onUpdate:modelValue': (value: unknown) => (model[field.key] = value),
    placeholder: field.placeholder ?? `请输入${field.label}`,
    disabled: field.readonly,
    ...field.props
  }

  if (field.component) return h(el(field.component), common)
  if (field.type === 'boolean') return h(el('el-switch'), common)
  if (field.type === 'number' || field.type === 'integer') return h(el('el-input-number'), common)
  if (field.type === 'date' || field.type === 'datetime') {
    return h(el('el-date-picker'), {
      ...common,
      type: field.type === 'datetime' ? 'datetime' : 'date',
      valueFormat: field.type === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'
    })
  }
  if (field.type === 'select' || field.type === 'array') {
    return h(
      el('el-select'),
      { ...common, multiple: field.type === 'array' },
      () =>
        field.options.map((option) =>
          h(el('el-option'), { key: String(option.value), label: option.label, value: option.value })
        )
    )
  }
  return h(el('el-input'), { ...common, type: field.type === 'text' ? 'textarea' : undefined })
}

function renderFields(fields: NormalizedField[], model: Model) {
  return fields
    .filter((field) => !field.hidden && field.form !== false)
    .map((field) =>
      h(
        el('el-form-item'),
        { key: field.key, label: field.label, prop: field.key },
        () => renderInput(field, model)
      )
    )
}

export function generateForm<TModel extends Model = Model>(
  options: FormGenerateOptions<TModel>
): GeneratedView<TModel> {
  const fields = normalizeSchema(options.schema)
  const initial = createModel(fields, options.model as Model)
  const model = reactive(initial) as TModel
  const rules = generateRules(fields)

  const component = defineComponent({
    name: 'AiGeneratedForm',
    emits: ['submit', 'reset'],
    setup(_, { emit }) {
      const formRef = ref<{ validate?: () => Promise<boolean>; clearValidate?: () => void }>()
      const submitting = ref(false)

      const submit = async () => {
        await formRef.value?.validate?.()
        submitting.value = true
        try {
          const value = clone(toRaw(model)) as TModel
          await options.onSubmit?.(value)
          emit('submit', value)
        } finally {
          submitting.value = false
        }
      }
      const reset = () => {
        Object.assign(model, clone(initial))
        formRef.value?.clearValidate?.()
        emit('reset', clone(toRaw(model)))
      }

      return () =>
        h(
          el('el-form'),
          { ref: formRef, model, rules, labelWidth: options.labelWidth ?? '100px' },
          () => [
            ...renderFields(fields, model),
            h(el('el-form-item'), {}, () => [
              h(
                el('el-button'),
                { type: 'primary', loading: submitting.value, onClick: submit },
                () => options.submitText ?? '提交'
              ),
              ...(options.showReset === false
                ? []
                : [h(el('el-button'), { onClick: reset }, () => options.resetText ?? '重置')])
            ])
          ]
        )
    }
  })

  return {
    kind: 'form',
    component,
    code: formCode(fields, options.labelWidth),
    fields,
    model,
    rules
  }
}

function inferColumns(fields: NormalizedField[]): TableColumn[] {
  return fields
    .filter((field) => !field.hidden && field.table !== false)
    .map((field) => ({ prop: field.key, label: field.label }))
}

export function generateTable(options: TableGenerateOptions): GeneratedView {
  const fields = normalizeSchema(options.schema)
  const columns = options.columns ?? inferColumns(fields)
  const data = options.data ?? []
  const component = defineComponent({
    name: 'AiGeneratedTable',
    props: { data: { type: Array, default: undefined } },
    setup(props) {
      return () =>
        h(
          el('el-table'),
          {
            data: props.data ?? unref(data),
            stripe: options.stripe ?? true,
            border: options.border ?? true,
            emptyText: options.emptyText ?? '暂无数据'
          },
          () =>
            columns.map((column) =>
              h(el('el-table-column'), {
                key: column.prop,
                prop: column.prop,
                label: column.label,
                width: column.width,
                formatter: column.formatter
                  ? (row: Model) => column.formatter?.(row, row[column.prop])
                  : undefined
              })
            )
        )
    }
  })

  return { kind: 'table', component, code: tableCode(columns), fields }
}

export function generateCrud<T extends Model = Model>(
  options: CrudGenerateOptions<T>
): GeneratedView {
  const fields = normalizeSchema(options.schema)
  const columns = inferColumns(fields)
  const rowKey = options.rowKey ?? ('id' as keyof T & string)
  const client: ApiClient<T> = 'list' in options.api ? options.api : generateApi(options.api).client
  const pageSize = options.pageSize ?? 10

  const component = defineComponent({
    name: 'AiGeneratedCrud',
    setup() {
      const rows = ref<T[]>([]) as Ref<T[]>
      const loading = ref(false)
      const saving = ref(false)
      const dialogVisible = ref(false)
      const editingId = ref<string | number>()
      const page = ref(1)
      const formRef = ref<{ validate?: () => Promise<boolean> }>()
      const form = reactive(createModel(fields))
      const rules = generateRules(fields)

      const load = async () => {
        loading.value = true
        try {
          rows.value = await client.list()
        } finally {
          loading.value = false
        }
      }
      const openCreate = () => {
        editingId.value = undefined
        Object.assign(form, createModel(fields))
        dialogVisible.value = true
      }
      const openEdit = (row: T) => {
        editingId.value = row[rowKey] as string | number
        Object.assign(form, createModel(fields), clone(toRaw(row)))
        dialogVisible.value = true
      }
      const save = async () => {
        await formRef.value?.validate?.()
        saving.value = true
        try {
          const payload = clone(toRaw(form)) as Partial<T>
          if (editingId.value === undefined) await client.create(payload)
          else await client.update(editingId.value, payload)
          dialogVisible.value = false
          await load()
        } finally {
          saving.value = false
        }
      }
      const remove = async (row: T) => {
        if (typeof window !== 'undefined' && !window.confirm('确定删除这条数据吗？')) return
        await client.remove(row[rowKey] as string | number)
        await load()
      }

      onMounted(load)

      return () => {
        const start = (page.value - 1) * pageSize
        const visibleRows = rows.value.slice(start, start + pageSize)
        return h('section', { class: 'vue-ai-helper-crud' }, [
          h('header', { style: 'display:flex;justify-content:space-between;margin-bottom:16px' }, [
            h('h2', { style: 'margin:0' }, options.title ?? '数据管理'),
            h(el('el-button'), { type: 'primary', onClick: openCreate }, () => options.createText ?? '新增')
          ]),
          h(
            el('el-table'),
            { data: visibleRows, border: true, stripe: true, loading: loading.value },
            () => [
              ...columns.map((column) =>
                h(el('el-table-column'), {
                  key: column.prop,
                  prop: column.prop,
                  label: column.label
                })
              ),
              h(el('el-table-column'), { label: '操作', fixed: 'right', width: 150 }, {
                default: ({ row }: { row: T }) => [
                  h(el('el-button'), { link: true, type: 'primary', onClick: () => openEdit(row) }, () => '编辑'),
                  h(el('el-button'), { link: true, type: 'danger', onClick: () => remove(row) }, () => '删除')
                ]
              })
            ]
          ),
          h(el('el-pagination'), {
            style: 'margin-top:16px;justify-content:flex-end',
            layout: 'total, prev, pager, next',
            total: rows.value.length,
            pageSize,
            currentPage: page.value,
            'onUpdate:currentPage': (value: number) => (page.value = value)
          }),
          h(
            el('el-dialog'),
            {
              modelValue: dialogVisible.value,
              'onUpdate:modelValue': (value: boolean) => (dialogVisible.value = value),
              title: editingId.value === undefined ? '新增' : '编辑',
              width: '600px'
            },
            {
              default: () =>
                h(el('el-form'), { ref: formRef, model: form, rules, labelWidth: '100px' }, () =>
                  renderFields(fields, form)
                ),
              footer: () => [
                h(el('el-button'), { onClick: () => (dialogVisible.value = false) }, () => '取消'),
                h(el('el-button'), { type: 'primary', loading: saving.value, onClick: save }, () => '保存')
              ]
            }
          )
        ])
      }
    }
  })

  const resource = 'resource' in options.api ? options.api.resource : '/resource'
  return { kind: 'crud', component, code: crudCode(fields, resource), fields }
}
