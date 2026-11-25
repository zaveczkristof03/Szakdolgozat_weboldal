/**
 * Az összes backend-hívás egy helyen.
 *
 * Az API csak olvasható: egyetlen hívásra van szükség, a teljes katalógusra.
 * Ha változik az API címe, csak ezt a fájlt (vagy a VITE_API_BASE_URL változót)
 * kell módosítani. A komponensek nem írnak közvetlenül `fetch`-et.
 */
import type { ECGDatabase } from '../domain/types.ts'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init)
  if (!response.ok) throw new ApiError(`Request failed (${response.status}).`, response.status)
  return (await response.json()) as T
}

export const api = {
  listDatasets: (signal?: AbortSignal) => request<ECGDatabase[]>('/datasets', { signal }),
}
