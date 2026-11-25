/**
 * Az adatmodell TypeScript-típusai.
 *
 * Az ECGDatabase pontosan a backend /datasets válaszának egy elemét írja le.
 * Ha egy érték nincs igazolva, `null` – a felület ilyenkor "Not recorded"-et ír,
 * és SOHA nem helyettesíti kitalált értékkel (pl. 0 rekord vagy 250 Hz).
 *
 * Fontos: `records` = rekordok (felvételek) száma, `subject_count` = személyek száma.
 */
export type ECGDatabase = {
  id: number
  name: string
  short_name: string | null
  records: number | null
  records_label: string | null
  subject_count: number | null
  frequency: number | null
  leads: number | null
  category: string
  duration: string | null
  annotations: string | null
  file_format: string | null
  version: string | null
  doi: string | null
  source_database_id: string | null
  source_url: string
  provenance_url: string | null
  license: string | null
  access_conditions: string | null
  lightwave_database_id: string | null
  last_verified: string | null
  description: string
}

/** Az admin űrlap és a POST/PUT kérés tartalma (az `id` nélkül). */
export type DatasetInput = Omit<ECGDatabase, 'id'>

export type ResearchCollection = {
  id: string
  name: string
  description: string
  createdAt: string
  datasetIds: number[]
  notes: Record<string, string>
}
