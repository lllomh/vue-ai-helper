import { describe, expect, it, vi } from 'vitest'
import { generateApi, generateForm, generateTable } from '../src'

describe('generators', () => {
  it('generates an Element Plus form component and SFC source', () => {
    const result = generateForm({
      schema: { name: { type: 'string', required: true }, age: 'number' }
    })
    expect(result.kind).toBe('form')
    expect(result.component).toBeTruthy()
    expect(result.code).toContain('<el-form')
    expect(result.code).toContain('v-model="form.name"')
    expect(result.code).toContain('<el-input-number v-model="form.age"')
  })

  it('generates table source', () => {
    const result = generateTable({ schema: { name: 'string', age: 'number' } })
    expect(result.code).toContain('<el-table')
    expect(result.code).toContain('prop="name"')
    expect(result.code).toContain('label="Age"')
  })

  it('creates a working REST client', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 1, name: 'Ada' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const result = generateApi<{ id: number; name: string }>({
      baseURL: 'https://example.test/api/',
      resource: '/users',
      fetcher
    })

    await expect(result.client.list({ page: 2 })).resolves.toEqual([{ id: 1, name: 'Ada' }])
    expect(fetcher).toHaveBeenCalledWith(
      'https://example.test/api/users?page=2',
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) })
    )
    expect(result.code).toContain("remove: (id: string | number)")
  })
})
