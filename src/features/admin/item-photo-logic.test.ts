import { describe, expect, it } from 'vitest'
import { modelSlugForLine } from './item-photo-logic'

describe('foto de una línea', () => {
  it('reconoce el modelo por el inicio de la descripción, sin importar tildes', () => {
    expect(modelSlugForLine({ variantId: 'v1', description: 'Moshaco · Large' })).toBe('moshaco')
    expect(modelSlugForLine({ variantId: 'v2', description: 'Ñañito · Estándar' })).toBe('nanito')
    expect(modelSlugForLine({ variantId: 'v3', description: 'Bosques Amazonicos · Estándar' })).toBe('bosques-amazonicos')
  })

  it('las piezas a medida y los modelos sin foto no llevan foto', () => {
    expect(modelSlugForLine({ variantId: null, description: 'Moshaco con grabado especial' })).toBeNull()
    expect(modelSlugForLine({ variantId: 'v4', description: 'Modelo nuevo · Grande' })).toBeNull()
  })
})
