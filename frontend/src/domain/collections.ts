/**
 * My Research gyűjtemények mentése a böngésző localStorage-ába.
 *
 * Nincs felhasználói fiók és nincs szerveroldali mentés: a gyűjtemény ezen a
 * gépen, ebben a böngészőben marad. Beolvasáskor minden hibás vagy ismétlődő
 * adatot kiszűrünk, így egy sérült mentés nem tudja összeomlasztani az oldalt.
 */
import type { ResearchCollection } from './types.ts'

export const COLLECTIONS_STORAGE_KEY = 'ekg-explorer:research-collections'

export function createCollectionId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `collection-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function parseCollections(raw: string | null): ResearchCollection[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is ResearchCollection => Boolean(
        item && typeof item === 'object' && typeof item.id === 'string' &&
        typeof item.name === 'string' && item.name.trim().length > 0 && Array.isArray(item.datasetIds),
      ))
      .map((item) => ({
        id: item.id,
        name: item.name.trim(),
        description: typeof item.description === 'string' ? item.description : '',
        createdAt: typeof item.createdAt === 'string' && !Number.isNaN(Date.parse(item.createdAt)) ? item.createdAt : new Date().toISOString(),
        datasetIds: [...new Set((item.datasetIds as unknown[]).filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0))],
        notes: item.notes && typeof item.notes === 'object'
          ? Object.fromEntries(Object.entries(item.notes).filter((entry): entry is [string, string] => /^\d+$/.test(entry[0]) && typeof entry[1] === 'string'))
          : {},
      }))
  } catch {
    return []
  }
}

export function readResearchCollections(): ResearchCollection[] {
  try {
    return parseCollections(localStorage.getItem(COLLECTIONS_STORAGE_KEY))
  } catch {
    return []
  }
}

/** true, ha sikerült menteni (a tárhely lehet tele vagy letiltva). */
export function writeResearchCollections(collections: ResearchCollection[]): boolean {
  try {
    localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(collections))
    return true
  } catch {
    return false
  }
}

/** Hozzáad egy adatbázist egy gyűjteményhez; ha nincs gyűjtemény, létrehoz egyet. */
export function addDatasetToCollection(
  collections: ResearchCollection[],
  targetId: string,
  datasetId: number,
): { collections: ResearchCollection[]; targetId: string; targetName: string; alreadyPresent: boolean } {
  if (!collections.length) {
    const created: ResearchCollection = {
      id: createCollectionId(), name: 'Saved datasets', description: 'Datasets saved for later research.',
      createdAt: new Date().toISOString(), datasetIds: [datasetId], notes: {},
    }
    return { collections: [created], targetId: created.id, targetName: created.name, alreadyPresent: false }
  }
  const target = collections.find((collection) => collection.id === targetId) ?? collections[0]
  if (target.datasetIds.includes(datasetId)) return { collections, targetId: target.id, targetName: target.name, alreadyPresent: true }
  return {
    collections: collections.map((collection) => collection.id === target.id ? { ...collection, datasetIds: [...collection.datasetIds, datasetId] } : collection),
    targetId: target.id,
    targetName: target.name,
    alreadyPresent: false,
  }
}
