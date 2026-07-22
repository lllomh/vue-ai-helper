import { describe, expect, it } from 'vitest'
import { createModel, generateRules, normalizeSchema } from '../src/schema'

describe('schema', () => {
  it('normalizes shorthand schema', () => {
    const fields = normalizeSchema({ name: 'string', age: 'number' })
    expect(fields.map(({ key, type, label }) => ({ key, type, label }))).toEqual([
      { key: 'name', type: 'string', label: 'Name' },
      { key: 'age', type: 'number', label: 'Age' }
    ])
  })

  it('supports JSON Schema required and formats', () => {
    const fields = normalizeSchema({
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', title: '姓名' },
        createdAt: { type: 'string', format: 'date-time' },
        role: { type: 'string', enum: ['admin', 'member'] }
      }
    })

    expect(fields[0]).toMatchObject({ key: 'name', label: '姓名', required: true })
    expect(fields[1].type).toBe('datetime')
    expect(fields[2]).toMatchObject({
      type: 'select',
      options: [
        { label: 'admin', value: 'admin' },
        { label: 'member', value: 'member' }
      ]
    })
  })

  it('creates defaults and validation rules', () => {
    const fields = normalizeSchema({
      name: { type: 'string', required: true, min: 2 },
      active: { type: 'boolean', default: true },
      tags: { type: 'array', enum: ['vue', 'ts'] }
    })
    expect(createModel(fields)).toEqual({ name: '', active: true, tags: [] })
    expect(generateRules(fields).name).toEqual([
      { required: true, message: '请输入Name', trigger: 'blur' },
      { min: 2, message: 'Name长度或数值范围不正确', trigger: 'blur' }
    ])
  })
})
