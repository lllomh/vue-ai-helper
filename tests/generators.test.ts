import { describe, expect, it, vi } from 'vitest'
import { generateApi, generateCrud, generateForm, generateTable } from '../src'

describe('generators', () => {
  it('generates an Element Plus form component and SFC source', () => {
    const result = generateForm({
      schema: { name: { type: 'string', required: true }, age: 'number' }
    })
    expect(result.kind).toBe('form')
    expect(result.component).toBeTruthy()
    expect(result.code).toContain('<el-form')
    expect(result.code).toContain("v-model='form[&quot;name&quot;]'")
    expect(result.code).toContain("<el-input-number v-model='form[&quot;age&quot;]'")
  })

  it('escapes schema content and supports non-identifier field keys', () => {
    const result = generateForm({
      schema: {
        'first-name': { type: 'string', label: '姓名\"><img src=x>' }
      }
    })

    expect(result.code).toContain("form[&quot;first-name&quot;]")
    expect(result.code).toContain('姓名&quot;&gt;&lt;img src=x&gt;')
    expect(result.code).toContain('\\u003cimg src=x>')
  })

  it('reports codegen warnings for function-based fields', () => {
    const result = generateForm({
      schema: {
        city: {
          type: 'select',
          dependsOn: ['province'],
          loadOptions: async () => []
        }
      }
    })
    expect(result.warnings).toEqual([
      'city: 函数型联动或校验无法序列化，请在生成的 SFC 中手动补回。'
    ])
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

  it('supports server pagination payloads and retry', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('temporary', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { rows: [{ id: 1 }], total: 42 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }))
    const client = generateApi<{ id: number }>({
      resource: '/users',
      fetcher,
      retries: 1,
      retryDelay: 0
    }).client

    await expect(client.listPage?.({ page: 2, keyword: '' })).resolves.toEqual({
      items: [{ id: 1 }],
      total: 42
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[0][0]).toBe('/users?page=2')
  })

  it('generates production CRUD configuration', () => {
    const client = {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn()
    }
    const result = generateCrud({
      schema: {
        id: { type: 'number', form: false },
        name: { type: 'string', searchable: true }
      },
      api: client,
      pagination: 'server'
    })
    expect(result.kind).toBe('crud')
    expect(result.code).toContain("pagination: 'server'")
    expect(result.code).toContain('<component :is="crud.component" />')
  })
})
