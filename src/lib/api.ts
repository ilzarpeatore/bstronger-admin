const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

type RequestOptions = {
  method?: string
  body?: any
  headers?: Record<string, string>
}

function getToken(): string | null {
  return localStorage.getItem('admin_token')
}

export function setToken(token: string) {
  localStorage.setItem('admin_token', token)
}

export function removeToken() {
  localStorage.removeItem('admin_token')
}

export class ApiError extends Error {
  status: number
  data: any

  constructor(status: number, data: any) {
    super(data?.message || data?.error || `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export async function apiFetch<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken()

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers,
  }

  if (options.body) {
    fetchOptions.body = options.body instanceof FormData ? options.body : JSON.stringify(options.body)
  }

  const response = await fetch(`${API_URL}${endpoint}`, fetchOptions)

  if (response.status === 401) {
    removeToken()
    throw new ApiError(401, { message: 'Unauthorized' })
  }

  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(response.status, data)
  }

  return data
}

export const api = {
  get: <T = any>(endpoint: string) => apiFetch<T>(endpoint),

  post: <T = any>(endpoint: string, body: any) => apiFetch<T>(endpoint, { method: 'POST', body }),

  put: <T = any>(endpoint: string, body: any) => apiFetch<T>(endpoint, { method: 'PUT', body }),

  patch: <T = any>(endpoint: string, body: any) => apiFetch<T>(endpoint, { method: 'PATCH', body }),

  delete: <T = any>(endpoint: string) => apiFetch<T>(endpoint, { method: 'DELETE' }),

  /** Descarga un fichero (p. ej. CSV) autenticado y lo guarda con `filename`. */
  download: async (endpoint: string, filename: string) => {
    const token = getToken()
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!response.ok) {
      throw new ApiError(response.status, await response.json().catch(() => null))
    }
    const url = URL.createObjectURL(await response.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },

  upload: <T = any>(endpoint: string, formData: FormData, method: 'POST' | 'PUT' = 'POST') => {
    if (method === 'PUT') {
      formData.append('_method', 'PUT')
    }
    return apiFetch<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers: {},
    })
  },
}
