import { apiCode } from './codegen'
import type {
  ApiClient,
  ApiGenerateOptions,
  GeneratedApi,
  PaginatedResult,
  QueryParams
} from './types'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly detail?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function joinURL(baseURL: string, resource: string): string {
  const base = baseURL.replace(/\/$/, '')
  const path = resource.startsWith('/') ? resource : `/${resource}`
  return `${base}${path}`
}

function queryString(params: QueryParams = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const value = search.toString()
  return value ? `?${value}` : ''
}

function inferPage<T>(payload: unknown): PaginatedResult<T> {
  if (Array.isArray(payload)) return { items: payload as T[], total: payload.length }
  if (!payload || typeof payload !== 'object') {
    throw new ApiError('列表接口返回值格式不正确；请配置 transformPage。')
  }

  const root = payload as Record<string, unknown>
  const nested = root.data && typeof root.data === 'object' && !Array.isArray(root.data)
    ? (root.data as Record<string, unknown>)
    : root
  const items = nested.items ?? nested.rows ?? nested.list ??
    (Array.isArray(root.data) ? root.data : undefined)

  if (!Array.isArray(items)) {
    throw new ApiError('列表接口中没有找到 data、items、rows 或 list 数组；请配置 transformPage。')
  }

  const rawTotal = nested.total ?? root.total ?? items.length
  const total = Number(rawTotal)
  return { items: items as T[], total: Number.isFinite(total) ? total : items.length }
}

export function generateApi<T extends Record<string, unknown>>(
  options: ApiGenerateOptions<T>
): GeneratedApi<T> {
  const baseURL = options.baseURL ?? ''
  const endpoint = joinURL(baseURL, options.resource)
  const fetcher = options.fetcher ?? globalThis.fetch
  const timeout = options.timeout ?? 15_000
  const retries = Math.max(0, options.retries ?? 0)

  if (!fetcher) {
    throw new Error('当前环境没有 fetch，请通过 generateApi({ fetcher }) 注入请求函数。')
  }

  async function request<R>(path = '', init: RequestInit = {}): Promise<R> {
    const url = `${endpoint}${path}`
    let lastError: unknown

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController()
      const abort = () => controller.abort(init.signal?.reason)
      init.signal?.addEventListener('abort', abort, { once: true })
      const timer = setTimeout(() => controller.abort(new Error(`请求超时（${timeout}ms）`)), timeout)
      const requestInit: RequestInit = {
        ...init,
        signal: controller.signal,
        credentials: options.credentials,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
          ...(init.headers as Record<string, string> | undefined)
        }
      }

      try {
        await options.onRequest?.(url, requestInit)
        const response = await fetcher(url, requestInit)
        await options.onResponse?.(response)

        if (!response.ok) {
          const detail = await response.text().catch(() => '')
          throw new ApiError(
            `API ${response.status}: ${detail || response.statusText}`,
            response.status,
            detail
          )
        }
        if (response.status === 204) return undefined as R
        return response.json() as Promise<R>
      } catch (error) {
        lastError = error
        const status = error instanceof ApiError ? error.status : undefined
        const retryable = status === undefined || status === 408 || status === 429 || status >= 500
        if (attempt >= retries || !retryable || init.signal?.aborted) throw error
        clearTimeout(timer)
        const delay = (options.retryDelay ?? 250) * 2 ** attempt
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 2_000)))
      } finally {
        clearTimeout(timer)
        init.signal?.removeEventListener('abort', abort)
      }
    }

    throw lastError
  }

  const fetchPage = async (params?: QueryParams): Promise<PaginatedResult<T>> => {
    const payload = await request<unknown>(queryString(params))
    if (options.transformPage) return options.transformPage(payload)
    if (options.transformList) {
      const items = options.transformList(payload)
      return { items, total: items.length }
    }
    return inferPage<T>(payload)
  }

  const client: ApiClient<T> = {
    async list(params) {
      return (await fetchPage(params)).items
    },
    listPage: fetchPage,
    get: (id) => request<T>(`/${encodeURIComponent(id)}`),
    create: (data) => request<T>('', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) =>
      request<T>(`/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  return { client, code: apiCode(baseURL, options.resource) }
}
