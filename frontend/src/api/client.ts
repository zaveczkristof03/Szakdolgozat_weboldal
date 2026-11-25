/**
 * Az összes backend-hívás egy helyen.
 *
 * Miért kell? Ha változik az API címe vagy egy végpont, csak ezt a fájlt kell
 * módosítani. A komponensek nem írnak közvetlenül `fetch`-et.
 */
import type { DatasetInput, ECGDatabase } from '../domain/types.ts'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** A FastAPI hibaválaszából (detail) olvasható üzenetet készít. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((item: { msg?: string; loc?: unknown[] }) => {
          const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : null
          const message = (item.msg ?? '').replace(/^Value error, /, '')
          return field && field !== 'body' ? `${String(field)}: ${message}` : message
        })
        .filter(Boolean)
        .join(' ')
    }
  } catch {
    // Nem JSON válasz: az általános üzenet marad.
  }
  return `Request failed (${response.status}).`
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('X-Admin-Token', token)
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (!response.ok) throw new ApiError(await errorMessage(response), response.status)
  return (response.status === 204 ? undefined : await response.json()) as T
}

export const api = {
  listDatasets: (signal?: AbortSignal) => request<ECGDatabase[]>('/datasets', { signal }),
  createDataset: (payload: DatasetInput, token: string) =>
    request<ECGDatabase>('/datasets', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateDataset: (id: number, payload: DatasetInput, token: string) =>
    request<ECGDatabase>(`/datasets/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token),
  deleteDataset: (id: number, token: string) => request<void>(`/datasets/${id}`, { method: 'DELETE' }, token),
  login: (password: string) =>
    request<{ token: string; expires_in: number }>('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: (token: string) => request<void>('/admin/logout', { method: 'POST' }, token),
}
