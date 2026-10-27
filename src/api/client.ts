import type { Envelope } from './types'

// Every backend response is HTTP 200 with a {status, code, message, data|errors}
// envelope — the real status lives in `code`, so we branch on the body, never
// on response.ok alone.

const API_BASE = `${(import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''}/api/v1`

export class ApiError extends Error {
  code: number
  type: string
  errors: Record<string, unknown> | null

  constructor(code: number, message: string, errors: unknown) {
    super(message)
    this.code = code
    this.errors = errors && typeof errors === 'object' ? (errors as Record<string, unknown>) : null
    this.type = typeof this.errors?.type === 'string' ? (this.errors.type as string) : 'UNKNOWN'
  }

  /** Human-readable detail lines: pydantic field errors and missing sections. */
  get details(): string[] {
    const out: string[] = []
    const fields = this.errors?.fields
    if (Array.isArray(fields)) {
      for (const f of fields as { loc?: unknown[]; msg?: string }[]) {
        const loc = (f.loc ?? []).filter((p) => p !== 'body').join('.')
        out.push(loc ? `${loc}: ${f.msg}` : String(f.msg))
      }
    }
    const missing = this.errors?.missing_sections
    if (Array.isArray(missing)) out.push(`Missing sections: ${missing.join(', ')}`)
    const vars = this.errors?.missing_variables
    if (Array.isArray(vars)) out.push(`Undeclared variables: ${vars.map((v) => `{{${v}}}`).join(', ')}`)
    return out
  }
}

// ---------- token storage ----------
// The users service returns tokens in the body (no httpOnly cookie option),
// so they're kept in localStorage. Access tokens are short-lived; the
// refresh token is revoked server-side on logout.

const ACCESS_KEY = 'bt.access'
const REFRESH_KEY = 'bt.refresh'

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

type Listener = () => void
const sessionExpiredListeners = new Set<Listener>()
export function onSessionExpired(fn: Listener) {
  sessionExpiredListeners.add(fn)
  return () => {
    sessionExpiredListeners.delete(fn)
  }
}

let refreshing: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokens.refresh
  if (!refresh) return false
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      })
      const body = (await res.json()) as Envelope<{ access_token: string }>
      if (body.status === 'success' && body.data?.access_token) {
        tokens.set(body.data.access_token)
        return true
      }
      return false
    } catch {
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

interface RequestOptions {
  method?: string
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  auth?: boolean
  signal?: AbortSignal
}

/**
 * Environment that agent edit calls (PATCH/PUT) write to. The backend's edit
 * routes target development unless told `?env=stage`; production is
 * promote-only. Set by the builder for the environment being viewed.
 */
let writeEnv: 'development' | 'stage' = 'development'
export function setWriteEnv(env: 'development' | 'stage') {
  writeEnv = env
}

export async function request<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const { method = 'GET', body, query, auth = true, signal } = opts
  const effectiveQuery =
    writeEnv === 'stage' && (method === 'PATCH' || method === 'PUT') && path.startsWith('/agents/')
      ? { ...query, env: 'stage' }
      : query
  const qs = effectiveQuery
    ? Object.entries(effectiveQuery)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : ''
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}${qs ? `?${qs}` : ''}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'Unable to reach the server. Check that the backend is running.', { type: 'NETWORK_ERROR' })
  }

  let env: Envelope<T>
  try {
    env = (await res.json()) as Envelope<T>
  } catch {
    throw new ApiError(res.status, `Unexpected response from server (HTTP ${res.status})`, { type: 'BAD_RESPONSE' })
  }

  if (env.status === 'success') return env.data as T

  if (env.code === 401 && auth && !retried) {
    if (await refreshAccessToken()) return request<T>(path, opts, true)
    tokens.clear()
    sessionExpiredListeners.forEach((fn) => fn())
  }
  throw new ApiError(env.code, env.message || 'Request failed', env.errors)
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
