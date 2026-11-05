import { modelPhotos } from '../../content/model-photos'

/** Foto de una línea de pedido o cotización. Sin React: se prueba sola. */

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es')

/**
 * Modelo (slug de la foto) de una línea. Las líneas no traen el slug, pero su descripción empieza con el
 * nombre del modelo («Moshaco · Large»). Solo las tablas del catálogo (con variante) llevan foto: una pieza
 * a medida puede mencionar un modelo sin serlo.
 */
export function modelSlugForLine(line: { variantId: string | null; description: string }): string | null {
  if (!line.variantId) return null
  const model = normalize(line.description.split('·')[0] ?? '')
  return Object.entries(modelPhotos).find(([, photo]) => normalize(photo.name) === model)?.[0] ?? null
}
