/**
 * Gyűjtő modul: a domain-réteg összes nyilvános függvénye egy helyről importálható.
 * A logika témánként külön fájlokban van (search, completeness, fair, compare, csv).
 * A domain-réteg nem tud a Reactról, ezért böngésző nélkül tesztelhető.
 */
export * from './types.ts'
export * from './format.ts'
export * from './matching.ts'
export * from './search.ts'
export * from './quickFilters.ts'
export * from './completeness.ts'
export * from './fair.ts'
export * from './compare.ts'
export * from './csv.ts'
