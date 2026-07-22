import {
  defineComponent,
  h,
  onMounted,
  reactive,
  ref,
  resolveComponent,
  toRaw,
  unref,
  watch,
  type Component,
  type Ref
} from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { codegenWarnings, crudCode, formCode, tableCode } from './codegen'
import { generateApi } from './api'
import { getField } from './field-registry'
import {
  createModel,
  defaultValue,
  generateRules,
  isFieldDisabled,
  isFieldVisible,
  normalizeSchema
} from './schema'
import type {
  ApiClient,
  CrudAction,
  CrudGenerateOptions,
  DataModel,
  FormGenerateOptions,
  GeneratedView,
  NormalizedField,
  SelectOption,
  TableColumn,
  TableGenerateOptions
} from './types'

type Model = DataModel
type DialogMode = 'create' | 'edit' | 'view'

const clone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

const el = (name: string): Component => resolveComponent(name) as Component

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function setupFieldEffects(
  fields: NormalizedField[],
  model: Model,
  dynamicOptions: Record<string, SelectOption[]>,
  onError?: (error: unknown) => void
) {
  const versions = new Map<string, number>()

  for (const field of fields) {
    dynamicOptions[field.key] = field.options
    if (!field.loadOptions && !field.compute && !field.clearOnHide) continue

    const dependencies = field.dependsOn ?? fields
      .map((candidate) => candidate.key)
      .filter((key) => key !== field.key)

    watch(
      () => dependencies.map((key) => model[key]),
      async () => {
        try {
          if (field.compute) model[field.key] = await field.compute(model)
          if (field.clearOnHide && !isFieldVisible(field, model)) {
            model[field.key] = defaultValue(field)
          }
          if (field.loadOptions) {
            const version = (versions.get(field.key) ?? 0) + 1
            versions.set(field.key, version)
            const loaded = await field.loadOptions(model)
            if (versions.get(field.key) === version) dynamicOptions[field.key] = loaded
          }
        } catch (error) {
          onError?.(error)
        }
      },
      { immediate: true }
    )
  }
}

function renderInput(
  field: NormalizedField,
  model: Model,
  dynamicOptions: Record<string, SelectOption[]>
) {
  const options = dynamicOptions[field.key] ?? field.options
  const disabled = isFieldDisabled(field, model)
  const update = (value: unknown) => (model[field.key] = value)
  const common = {
    ...field.props,
    modelValue: model[field.key],
    'onUpdate:modelValue': update,
    placeholder: field.placeholder ?? `请输入${field.label}`,
    disabled
  }
  const registered = typeof field.component === 'string' ? getField(field.component) : undefined
  const context = { field, model, value: model[field.key], options, disabled, update }

  if (registered?.render) return registered.render(context)
  if (field.component) {
    const component = typeof field.component === 'string'
      ? registered?.component ?? el(field.component)
      : field.component
    if (component) {
      return h(component, {
        ...(registered?.getProps?.(context) ?? {}),
        ...common,
        [registered?.optionsProp ?? 'options']: options
      })
    }
  }
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
      { ...common, multiple: field.type === 'array', clearable: true },
      () =>
        options.map((option) =>
          h(el('el-option'), { key: String(option.value), label: option.label, value: option.value })
        )
    )
  }
  return h(el('el-input'), {
    ...common,
    clearable: true,
    type: field.type === 'text' ? 'textarea' : undefined
  })
}

function renderFields(
  fields: NormalizedField[],
  model: Model,
  dynamicOptions: Record<string, SelectOption[]>
) {
  return fields
    .filter((field) => field.form !== false && isFieldVisible(field, model))
    .map((field) =>
      h(
        el('el-form-item'),
        { key: field.key, label: field.label, prop: field.key },
        () => renderInput(field, model, dynamicOptions)
      )
    )
}

export function generateForm<TModel extends Model = Model>(
  options: FormGenerateOptions<TModel>
): GeneratedView<TModel> {
  const fields = normalizeSchema(options.schema)
  const initial = createModel(fields, options.model as Model)
  const model = reactive(initial) as TModel
  const rules = generateRules(fields, model)

  const component = defineComponent({
    name: 'AiGeneratedForm',
    emits: ['submit', 'reset', 'error'],
    setup(_, { emit }) {
      const formRef = ref<{ validate?: () => Promise<boolean>; clearValidate?: () => void }>()
      const submitting = ref(false)
      const dynamicOptions = reactive<Record<string, SelectOption[]>>({})
      const report = (error: unknown) => {
        options.onError?.(error)
        emit('error', error)
      }
      setupFieldEffects(fields, model, dynamicOptions, report)

      const submit = async () => {
        try {
          await formRef.value?.validate?.()
          submitting.value = true
          const value = clone(toRaw(model)) as TModel
          await options.onSubmit?.(value)
          emit('submit', value)
        } catch (error) {
          report(error)
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
            ...renderFields(fields, model, dynamicOptions),
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
    rules,
    warnings: codegenWarnings(fields)
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

  return { kind: 'table', component, code: tableCode(columns), fields, warnings: codegenWarnings(fields) }
}

function permission<T extends Model>(
  options: CrudGenerateOptions<T>,
  action: CrudAction,
  row?: T
): boolean {
  const rule = options.permissions?.[action]
  return typeof rule === 'function' ? rule(row) : rule !== false
}

function createSearchModel(fields: NormalizedField[]): Model {
  return Object.fromEntries(fields.map((field) => [field.key, undefined]))
}

export function generateCrud<T extends Model = Model>(
  options: CrudGenerateOptions<T>
): GeneratedView {
  const fields = normalizeSchema(options.schema)
  const columns = inferColumns(fields)
  const searchFields = options.search === false ? [] : fields.filter((field) => field.searchable)
  const rowKey = options.rowKey ?? ('id' as keyof T & string)
  const client: ApiClient<T> = 'list' in options.api ? options.api : generateApi(options.api).client
  const initialPageSize = options.pageSize ?? 10
  const paginationMode = options.pagination ?? 'client'

  const component = defineComponent({
    name: 'AiGeneratedCrud',
    setup() {
      const rows = ref<T[]>([]) as Ref<T[]>
      const selected = ref<T[]>([]) as Ref<T[]>
      const total = ref(0)
      const loading = ref(false)
      const saving = ref(false)
      const dialogVisible = ref(false)
      const dialogMode = ref<DialogMode>('create')
      const editingId = ref<string | number>()
      const page = ref(1)
      const pageSize = ref(initialPageSize)
      const sort = reactive({
        prop: options.defaultSort?.prop ?? '',
        order: options.defaultSort?.order ?? ('' as '' | 'ascending' | 'descending')
      })
      const formRef = ref<{ validate?: () => Promise<boolean>; clearValidate?: () => void }>()
      const form = reactive(createModel(fields))
      const searchModel = reactive(createSearchModel(searchFields))
      const dynamicOptions = reactive<Record<string, SelectOption[]>>({})
      const searchOptions = reactive<Record<string, SelectOption[]>>({})
      const rules = generateRules(fields, form)

      const reportError = (error: unknown, action: CrudAction | 'list') => {
        options.onError?.(error, action)
        if (!options.onError) ElMessage.error(errorMessage(error))
      }
      const reportSuccess = (action: CrudAction, message: string, data?: unknown) => {
        options.onSuccess?.(action, data)
        ElMessage.success(message)
      }

      setupFieldEffects(fields, form, dynamicOptions, (error) => reportError(error, dialogMode.value))
      setupFieldEffects(searchFields, searchModel, searchOptions, (error) => reportError(error, 'list'))

      const params = () => ({
        ...Object.fromEntries(
          Object.entries(toRaw(searchModel)).filter(([, value]) =>
            value !== '' && value !== undefined && value !== null &&
            (!Array.isArray(value) || value.length > 0)
          )
        ),
        ...(paginationMode === 'server' ? { page: page.value, pageSize: pageSize.value } : {}),
        ...(sort.prop ? { sortBy: sort.prop, sortOrder: sort.order } : {})
      })

      const load = async () => {
        loading.value = true
        try {
          if (paginationMode === 'server' && client.listPage) {
            const result = await client.listPage(params())
            rows.value = result.items
            total.value = result.total
          } else {
            rows.value = await client.list(params())
            total.value = rows.value.length
          }
          selected.value = []
        } catch (error) {
          reportError(error, 'list')
        } finally {
          loading.value = false
        }
      }

      const search = () => {
        page.value = 1
        return load()
      }
      const resetSearch = () => {
        Object.assign(searchModel, createSearchModel(searchFields))
        return search()
      }
      const openCreate = () => {
        dialogMode.value = 'create'
        editingId.value = undefined
        Object.assign(form, createModel(fields))
        formRef.value?.clearValidate?.()
        dialogVisible.value = true
      }
      const openEdit = (row: T) => {
        dialogMode.value = 'edit'
        editingId.value = row[rowKey] as string | number
        Object.assign(form, createModel(fields), clone(toRaw(row)))
        formRef.value?.clearValidate?.()
        dialogVisible.value = true
      }
      const openView = (row: T) => {
        dialogMode.value = 'view'
        editingId.value = row[rowKey] as string | number
        Object.assign(form, createModel(fields), clone(toRaw(row)))
        dialogVisible.value = true
      }
      const save = async () => {
        const action: CrudAction = dialogMode.value === 'create' ? 'create' : 'edit'
        try {
          await formRef.value?.validate?.()
          saving.value = true
          let payload = clone(toRaw(form)) as Partial<T>
          payload = await options.beforeSave?.(payload, action) ?? payload
          const result = action === 'create'
            ? await client.create(payload)
            : await client.update(editingId.value as string | number, payload)
          dialogVisible.value = false
          reportSuccess(action, action === 'create' ? '新增成功' : '保存成功', result)
          await load()
        } catch (error) {
          reportError(error, action)
        } finally {
          saving.value = false
        }
      }
      const confirmRows = async (targetRows: T[]): Promise<boolean> => {
        if (options.confirmDelete) return options.confirmDelete(targetRows)
        try {
          await ElMessageBox.confirm(
            targetRows.length > 1 ? `确定删除选中的 ${targetRows.length} 条数据吗？` : '确定删除这条数据吗？',
            '删除确认',
            { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
          )
          return true
        } catch {
          return false
        }
      }
      const removeRows = async (targetRows: T[]) => {
        const action: CrudAction = targetRows.length > 1 ? 'batchRemove' : 'remove'
        try {
          if (!targetRows.length || !(await confirmRows(targetRows))) return
          const ids = targetRows.map((row) => row[rowKey] as string | number)
          if (ids.some((id) => id === undefined || id === null)) {
            throw new Error(`删除失败：缺少行主键 ${rowKey}`)
          }
          if (targetRows.length > 1 && client.bulkRemove) await client.bulkRemove(ids)
          else await Promise.all(ids.map((id) => client.remove(id)))
          reportSuccess(action, targetRows.length > 1 ? '批量删除成功' : '删除成功', targetRows)
          await load()
        } catch (error) {
          reportError(error, action)
        }
      }

      const updateSort = ({ prop, order }: { prop: string; order: '' | 'ascending' | 'descending' }) => {
        sort.prop = prop ?? ''
        sort.order = order ?? ''
        if (paginationMode === 'server') void search()
      }
      const updatePage = (value: number) => {
        page.value = value
        if (paginationMode === 'server') void load()
      }
      const updatePageSize = (value: number) => {
        pageSize.value = value
        page.value = 1
        if (paginationMode === 'server') void load()
      }

      onMounted(load)

      return () => {
        let displayRows = rows.value
        let paginationTotal = total.value
        if (paginationMode === 'client') {
          displayRows = displayRows.filter((row) =>
            searchFields.every((field) => {
              const expected = searchModel[field.key]
              if (expected === '' || expected === undefined || expected === null) return true
              return String(row[field.key] ?? '').toLowerCase().includes(String(expected).toLowerCase())
            })
          )
          if (sort.prop && sort.order) {
            const direction = sort.order === 'ascending' ? 1 : -1
            displayRows = [...displayRows].sort((a, b) =>
              String(a[sort.prop] ?? '').localeCompare(String(b[sort.prop] ?? ''), undefined, { numeric: true }) * direction
            )
          }
          paginationTotal = displayRows.length
          const start = (page.value - 1) * pageSize.value
          displayRows = displayRows.slice(start, start + pageSize.value)
        }

        const actionButtons = (row: T) => [
          ...(options.detail !== false && permission(options, 'view', row)
            ? [h(el('el-button'), { link: true, onClick: () => openView(row) }, () => '详情')]
            : []),
          ...(permission(options, 'edit', row)
            ? [h(el('el-button'), { link: true, type: 'primary', onClick: () => openEdit(row) }, () => '编辑')]
            : []),
          ...(permission(options, 'remove', row)
            ? [h(el('el-button'), { link: true, type: 'danger', onClick: () => removeRows([row]) }, () => '删除')]
            : [])
        ]

        const table = h(
          el('el-table'),
          {
            data: displayRows,
            border: true,
            stripe: true,
            onSortChange: updateSort,
            onSelectionChange: (value: T[]) => (selected.value = value)
          },
          () => [
            ...(options.batchDelete !== false && permission(options, 'batchRemove')
              ? [h(el('el-table-column'), { type: 'selection', width: 48 })]
              : []),
            ...columns.map((column) =>
              h(el('el-table-column'), {
                key: column.prop,
                prop: column.prop,
                label: column.label,
                sortable: 'custom'
              })
            ),
            h(el('el-table-column'), { label: '操作', fixed: 'right', width: 190 }, {
              default: ({ row }: { row: T }) => actionButtons(row)
            })
          ]
        )

        return h('section', { class: 'vue-ai-helper-crud' }, [
          h('header', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px' }, [
            h('h2', { style: 'margin:0' }, options.title ?? '数据管理'),
            h('div', {}, [
              ...(options.batchDelete !== false && permission(options, 'batchRemove')
                ? [h(
                    el('el-button'),
                    { disabled: selected.value.length === 0, onClick: () => removeRows(selected.value) },
                    () => `批量删除${selected.value.length ? ` (${selected.value.length})` : ''}`
                  )]
                : []),
              ...(permission(options, 'create')
                ? [h(el('el-button'), { type: 'primary', onClick: openCreate }, () => options.createText ?? '新增')]
                : [])
            ])
          ]),
          ...(searchFields.length
            ? [h(el('el-form'), { inline: true, model: searchModel }, () => [
                ...searchFields
                  .filter((field) => isFieldVisible(field, searchModel))
                  .map((field) => h(el('el-form-item'), { key: field.key, label: field.label }, () =>
                    renderInput(field, searchModel, searchOptions)
                  )),
                h(el('el-form-item'), {}, () => [
                  h(el('el-button'), { type: 'primary', onClick: search }, () => '搜索'),
                  h(el('el-button'), { onClick: resetSearch }, () => '重置')
                ])
              ])]
            : []),
          loading.value ? h(el('el-skeleton'), { rows: 6, animated: true }) : table,
          h(el('el-pagination'), {
            style: 'margin-top:16px;justify-content:flex-end',
            layout: 'total, sizes, prev, pager, next',
            total: paginationTotal,
            pageSizes: options.pageSizes ?? [10, 20, 50, 100],
            pageSize: pageSize.value,
            currentPage: page.value,
            'onUpdate:currentPage': updatePage,
            'onUpdate:pageSize': updatePageSize
          }),
          h(
            el('el-dialog'),
            {
              modelValue: dialogVisible.value,
              'onUpdate:modelValue': (value: boolean) => (dialogVisible.value = value),
              title: dialogMode.value === 'create' ? '新增' : dialogMode.value === 'edit' ? '编辑' : '详情',
              width: '600px',
              destroyOnClose: true
            },
            {
              default: () => dialogMode.value === 'view'
                ? h(el('el-descriptions'), { column: 1, border: true }, () =>
                    fields
                      .filter((field) => !field.hidden)
                      .map((field) => h(el('el-descriptions-item'), { key: field.key, label: field.label }, () =>
                        String(form[field.key] ?? '-')
                      ))
                  )
                : h(el('el-form'), { ref: formRef, model: form, rules, labelWidth: '100px' }, () =>
                    renderFields(fields, form, dynamicOptions)
                  ),
              footer: () => [
                h(el('el-button'), { onClick: () => (dialogVisible.value = false) }, () =>
                  dialogMode.value === 'view' ? '关闭' : '取消'
                ),
                ...(dialogMode.value === 'view'
                  ? []
                  : [h(el('el-button'), { type: 'primary', loading: saving.value, onClick: save }, () => '保存')])
              ]
            }
          )
        ])
      }
    }
  })

  const resource = 'resource' in options.api ? options.api.resource : '/resource'
  return {
    kind: 'crud',
    component,
    code: crudCode(fields, resource),
    fields,
    warnings: codegenWarnings(fields)
  }
}
