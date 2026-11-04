/** Perfil del personal: iniciales, tamaño de letra y textos. Sin React: se prueba solo. */

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** «Brigitte Giraud Durazo» → «BG». Sin nombre, un signo para que el círculo no quede vacío. */
export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  const letters = words.slice(0, 2).map((w) => w.charAt(0).toLocaleUpperCase('es'))
  return letters.join('') || '?'
}

/** Tamaño de letra del panel. Se guarda en cada equipo: Alex y Brigitte pueden elegir distinto. */
export const textSizes = [
  { id: 'normal', label: 'Normal' },
  { id: 'grande', label: 'Grande' },
  { id: 'muy-grande', label: 'Muy grande' },
] as const

export type TextSize = (typeof textSizes)[number]['id']

const TEXT_SIZE_KEY = 'woodland-panel-text-size'

export function parseTextSize(value: string | null | undefined): TextSize {
  return textSizes.find((t) => t.id === value)?.id ?? 'normal'
}

export function readTextSize(store: Store | null): TextSize {
  try {
    return parseTextSize(store?.getItem(TEXT_SIZE_KEY))
  } catch {
    return 'normal'
  }
}

export function writeTextSize(store: Store | null, size: TextSize): void {
  try {
    store?.setItem(TEXT_SIZE_KEY, size)
  } catch {
    // Sin almacenamiento: vale solo para esta visita.
  }
}

/** Aplica el tamaño en <html data-texto="…"> (los estilos están en src/styles/index.css). «Normal» no deja marca. */
export function applyTextSize(root: { dataset: DOMStringMap }, size: TextSize): void {
  if (size === 'normal') delete root.dataset.texto
  else root.dataset.texto = size
}

const monthYear = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'America/Lima' })

/** «noviembre de 2026». */
export function memberSince(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : monthYear.format(date)
}
