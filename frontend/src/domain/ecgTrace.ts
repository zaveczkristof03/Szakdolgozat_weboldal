/**
 * EKG-jelrészlet kirajzolása a klinikai papírméret szerint.
 *
 * Az EKG-papír szabványos léptéke: vízszintesen 25 mm = 1 s, függőlegesen
 * 10 mm = 1 mV. Az SVG koordinátái milliméterben vannak, így a rács (1 mm-es
 * kis és 5 mm-es nagy négyzetek) és a jel ugyanabban a léptékben van.
 * Ha a jel túl magas lenne, a függőleges léptéket felezzük (5, majd 2,5 mm/mV),
 * és ezt a felirat jelzi – a jelalakot soha nem vágjuk le és nem simítjuk.
 */

export type EcgSample = {
  source_database_id: string
  record: string
  record_url: string
  signal_names: string[]
  signal: string
  units: string
  fs: number
  start_s: number
  duration_s: number
  values: (number | null)[]
}

export const PAPER_SPEED_MM_PER_S = 25
const GAINS_MM_PER_MV = [10, 5, 2.5]
const MAX_HEIGHT_MM = 40
const MARGIN_MM = 2.5

export type Trace = {
  path: string
  widthMm: number
  heightMm: number
  gainMmPerMv: number
}

const round = (value: number) => Math.round(value * 100) / 100

export function layoutTrace(values: (number | null)[], fs: number): Trace | null {
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value))
  if (present.length < 2 || !(fs > 0)) return null

  const min = Math.min(...present)
  const max = Math.max(...present)
  const gain = GAINS_MM_PER_MV.find((candidate) => (max - min) * candidate + 2 * MARGIN_MM <= MAX_HEIGHT_MM) ?? GAINS_MM_PER_MV[GAINS_MM_PER_MV.length - 1]
  // A magasságot 5 mm-es (nagy négyzet) egészre kerekítjük, hogy a rács szépen záródjon.
  const heightMm = Math.ceil(((max - min) * gain + 2 * MARGIN_MM) / 5) * 5
  const widthMm = round((values.length / fs) * PAPER_SPEED_MM_PER_S)
  // A jel függőlegesen középre kerül.
  const offset = (heightMm - (max - min) * gain) / 2

  let path = ''
  let penDown = false
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      penDown = false // hiányzó minta: a vonal megszakad, nem kötjük át
      return
    }
    const x = round((index / fs) * PAPER_SPEED_MM_PER_S)
    const y = round(offset + (max - value) * gain)
    path += `${penDown ? 'L' : 'M'}${x} ${y}`
    penDown = true
  })

  return { path, widthMm, heightMm, gainMmPerMv: gain }
}
