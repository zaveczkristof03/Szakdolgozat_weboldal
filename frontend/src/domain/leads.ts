/**
 * Elvezetéstérkép: a felvett jelnevekből megmutatja, mely elektródák vesznek részt.
 *
 * Csak a forrás fejlécében szereplő jelneveket használjuk. Egy név csak akkor
 * kerül a térképre, ha egyértelműen egy szabványos elvezetés (pl. „II”, „MLII”,
 * „V5”). Az olyan általános nevek, mint „ECG1”, nem mondják meg, hová került az
 * elektróda: ezeket „nem azonosítható” listában mutatjuk, és nem találgatunk.
 */

export type Electrode = 'RA' | 'LA' | 'LL' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6'

export const ELECTRODES: Electrode[] = ['RA', 'LA', 'LL', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']

// Végtagi elvezetések: melyik két (vagy három) elektróda adja a jelet.
const LIMB: Record<string, Electrode[]> = {
  I: ['RA', 'LA'],
  II: ['RA', 'LL'],
  III: ['LA', 'LL'],
  AVR: ['RA', 'LA', 'LL'],
  AVL: ['RA', 'LA', 'LL'],
  AVF: ['RA', 'LA', 'LL'],
}

// Azonos jelentésű nevek: módosított (Holter) és európai jelölések.
const ALIASES: Record<string, string> = {
  MLI: 'I', MLII: 'II', ML2: 'II', MLIII: 'III', ML3: 'III',
  D1: 'I', D2: 'II', D3: 'III', DI: 'I', DII: 'II', DIII: 'III',
}

export type LeadMap = {
  active: Set<Electrode>
  /** A felismert elvezetések szabványos nevei (pl. „MLII” → „II”). */
  leads: Set<string>
  mapped: string[]
  unmapped: string[]
}

export function canonicalLead(name: string): string | null {
  const key = name.trim().toUpperCase().replace(/[\s_-]/g, '')
  const base = ALIASES[key] ?? key
  if (base in LIMB) return base
  // Mellkasi elvezetés (V1–V6) és módosított változata (MV1–MV6).
  const chest = /^M?V([1-6])$/.exec(base)
  return chest ? `V${chest[1]}` : null
}

export function mapLeads(signalNames: string[]): LeadMap {
  const active = new Set<Electrode>()
  const leads = new Set<string>()
  const mapped: string[] = []
  const unmapped: string[] = []
  for (const name of signalNames) {
    const lead = canonicalLead(name)
    if (!lead) {
      unmapped.push(name)
      continue
    }
    mapped.push(name)
    leads.add(lead)
    for (const electrode of LIMB[lead] ?? [lead as Electrode]) active.add(electrode)
  }
  return { active, leads, mapped, unmapped }
}
