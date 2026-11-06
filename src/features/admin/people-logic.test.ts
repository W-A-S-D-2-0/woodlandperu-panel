import { describe, expect, it } from 'vitest'
import { customerSummary } from './people-logic'

describe('customerSummary', () => {
  it('suma lo comprado sin contar pedidos ni cotizaciones cancelados', () => {
    const summary = customerSummary({
      orders: [
        { id: '1', code: 'PED-1', status: 'confirmed', total: 100.1, createdAt: '' },
        { id: '2', code: 'PED-2', status: 'cancelled', total: 999, createdAt: '' },
        { id: '3', code: 'PED-3', status: 'delivered', total: 50.2, createdAt: '' },
      ],
      quotes: [{ id: 'q', code: 'COT-1', status: 'cancelled', total: 0, createdAt: '' }],
    })
    expect(summary).toEqual({ orders: 2, spent: 150.3, quotes: 0 })
  })
})
