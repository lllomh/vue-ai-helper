import { describe, expect, it } from 'vitest'
import { createModel, normalizeSchema } from '../src/schema'
import { getField, listFields, registerField, unregisterField } from '../src/field-registry'

describe('field registry', () => {
  it('registers custom fields and applies their defaults', () => {
    registerField('user-select', {
      component: 'UserSelect',
      defaultValue: () => ({ id: 1 })
    })

    const fields = normalizeSchema({
      owner: { type: 'string', component: 'user-select' }
    })
    expect(createModel(fields)).toEqual({ owner: { id: 1 } })
    expect(getField('user-select')?.component).toBe('UserSelect')
    expect(listFields()).toContain('user-select')
    expect(unregisterField('user-select')).toBe(true)
  })

  it('rejects invalid definitions', () => {
    expect(() => registerField('empty', {})).toThrow('必须提供 component 或 render')
  })
})
