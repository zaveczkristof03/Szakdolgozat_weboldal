/**
 * Az összes backend-hívás egy helyen.
 *
 * Az API csak olvasható: a teljes katalógus, és adatbázisonként egy valódi EKG-jelrészlet.
 * Ha változik az API címe, csak ezt a fájlt (vagy a VITE_API_BASE_URL változót)
 * kell módosítani. A komponensek nem írnak közvetlenül `fetch`-et.
 */
import type { EcgSample } from '../domain/ecgTrace.ts'
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
  /** A jelrészlet, vagy `null`, ha ehhez az adatbázishoz nincs letöltve (404). */
  getEcgSample: async (id: number, signal?: AbortSignal): Promise<EcgSample | null> => {
    try {
      return await request<EcgSample>(`/datasets/${id}/ecg-sample`, { signal })
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }
  },
}
