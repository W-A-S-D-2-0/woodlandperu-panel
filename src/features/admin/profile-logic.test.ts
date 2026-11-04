import { describe, expect, it } from 'vitest'
import { applyTextSize, initials, memberSince, parseTextSize, readTextSize, writeTextSize } from './profile-logic'

const memoryStore = () => {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
}

describe('initials', () => {
  it('toma la primera letra de las dos primeras palabras', () => {
    expect(initials('Brigitte Giraud Durazo')).toBe('BG')
    expect(initials('  álex ')).toBe('Á')
    expect(initials('')).toBe('?')
  })
})

describe('tamaño de letra', () => {
  it('recuerda la elección y cae en «normal» si no la conoce', () => {
    const store = memoryStore()
    expect(readTextSize(store)).toBe('normal')
    writeTextSize(store, 'muy-grande')
    expect(readTextSize(store)).toBe('muy-grande')
    expect(parseTextSize('gigante')).toBe('normal')
  })

  it('funciona sin almacenamiento o si el navegador lo bloquea', () => {
    expect(readTextSize(null)).toBe('normal')
    const broken = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    }
    expect(readTextSize(broken)).toBe('normal')
    expect(() => writeTextSize(broken, 'grande')).not.toThrow()
  })

  it('marca <html> solo cuando no es «normal»', () => {
    const root = { dataset: {} as DOMStringMap }
    applyTextSize(root, 'grande')
    expect(root.dataset.texto).toBe('grande')
    applyTextSize(root, 'normal')
    expect(root.dataset.texto).toBeUndefined()
  })
})

describe('memberSince', () => {
  it('dice el mes y el año en Lima', () => {
    expect(memberSince('2026-10-17T15:00:00Z')).toBe('octubre de 2026')
    expect(memberSince(null)).toBeNull()
    expect(memberSince('no es fecha')).toBeNull()
  })
})
