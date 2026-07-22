import { apiCode } from './codegen'
import type { ApiClient, ApiGenerateOptions, GeneratedApi, QueryParams } from './types'

function joinURL(baseURL: string, resource: string): string {
  const base = baseURL.replace(/\/$/, '')
  const path = resource.startsWith('/') ? resource : `/${resource}`
  return `${base}${path}`
}

function queryString(params: QueryParams = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, String(value))
  }
  const value = search.toString()
  return value ? `?${value}` : ''
}

export function generateApi<T extends Record<string, unknown>>(
  options: ApiGenerateOptions<T>
): GeneratedApi<T> {
  const baseURL = options.baseURL ?? ''
  const endpoint = joinURL(baseURL, options.resource)
  const fetcher = options.fetcher ?? globalThis.fetch

  if (!fetcher) {
    throw new Error('当前环境没有 fetch，请通过 generateApi({ fetcher }) 注入请求函数。')
  }

  async function request<R>(path = '', init: RequestInit = {}): Promise<R> {
    const response = await fetcher(`${endpoint}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        ...(init.headers as Record<string, string> | undefined)
      }
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`API ${response.status}: ${detail || response.statusText}`)
    }
    if (response.status === 204) return undefined as R
    return response.json() as Promise<R>
  }

  const client: ApiClient<T> = {
    async list(params) {
      const payload = await request<unknown>(queryString(params))
      if (options.transformList) return options.transformList(payload)
      if (Array.isArray(payload)) return payload as T[]
      if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>
        const list = record.data ?? record.items ?? record.list
        if (Array.isArray(list)) return list as T[]
      }
      throw new Error('列表接口返回值不是数组；请配置 transformList。')
    },
    get: (id) => request<T>(`/${encodeURIComponent(id)}`),
    create: (data) => request<T>('', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) =>
      request<T>(`/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  return { client, code: apiCode(baseURL, options.resource) }
}
