// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { generateCrud, generateForm, registerField, unregisterField } from '../src'
import type { SelectOption } from '../src'

const FormStub = defineComponent({
  setup(_, { slots }) {
    return () => h('form', slots.default?.())
  }
})

const FormItemStub = defineComponent({
  props: { label: String },
  setup(props, { slots }) {
    return () => h('div', [h('label', props.label), slots.default?.()])
  }
})

const EmptyStub = defineComponent({
  setup() {
    return () => h('div')
  }
})

const formComponents = {
  'el-form': FormStub,
  'el-form-item': FormItemStub,
  'el-input': EmptyStub,
  'el-button': EmptyStub
}

afterEach(() => unregisterField('async-select'))

describe('runtime components', () => {
  it('reacts to conditional visibility', async () => {
    const result = generateForm({
      schema: {
        accountType: { type: 'string', default: 'personal' },
        company: { type: 'string', visibleWhen: { accountType: 'business' } }
      }
    })
    const wrapper = mount(result.component as never, { global: { components: formComponents } })

    expect(wrapper.text()).not.toContain('Company')
    result.model!.accountType = 'business'
    await nextTick()
    expect(wrapper.text()).toContain('Company')
  })

  it('loads dependent options and passes them to custom fields', async () => {
    let latestOptions: SelectOption[] = []
    registerField('async-select', {
      render(context) {
        latestOptions = context.options
        return h('div', { class: 'async-options' }, context.options.map((option) => option.label).join(','))
      }
    })
    const result = generateForm({
      schema: {
        province: { type: 'string', default: 'NY' },
        city: {
          type: 'select',
          component: 'async-select',
          dependsOn: ['province'],
          loadOptions: async (model) => [{ label: model.province === 'NY' ? 'New York' : 'Los Angeles', value: 1 }]
        }
      }
    })
    const wrapper = mount(result.component as never, { global: { components: formComponents } })
    await flushPromises()

    expect(latestOptions[0].label).toBe('New York')
    expect(wrapper.find('.async-options').text()).toBe('New York')
    result.model!.province = 'CA'
    await nextTick()
    await flushPromises()
    expect(latestOptions[0].label).toBe('Los Angeles')
  })

  it('loads server-paginated CRUD data on mount', async () => {
    const listPage = vi.fn().mockResolvedValue({ items: [{ id: 1, name: 'Ada' }], total: 25 })
    const client = {
      list: vi.fn().mockResolvedValue([]),
      listPage,
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn()
    }
    const result = generateCrud({
      schema: { id: 'number', name: 'string' },
      api: client,
      pagination: 'server',
      pageSize: 20
    })
    mount(result.component as never, {
      global: {
        components: {
          'el-table': defineComponent({ setup: () => () => h('div', { class: 'table-stub' }) }),
          'el-skeleton': EmptyStub,
          'el-pagination': EmptyStub,
          'el-button': EmptyStub,
          'el-dialog': EmptyStub
        }
      }
    })
    await flushPromises()

    expect(listPage).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
  })
})
