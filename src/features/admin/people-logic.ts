import type { CustomerDetail } from '../../../shared/api/panel-contracts'

/** Clientes: textos y agrupaciones para el panel. Sin React: se prueban solos. */

/** Resumen del cliente: cuántos pedidos hizo y cuánto compró (sin contar cancelados). */
export function customerSummary(customer: Pick<CustomerDetail, 'orders' | 'quotes'>): { orders: number; spent: number; quotes: number } {
  const active = customer.orders.filter((o) => o.status !== 'cancelled')
  return {
    orders: active.length,
    spent: Math.round(active.reduce((sum, o) => sum + o.total, 0) * 100) / 100,
    quotes: customer.quotes.filter((q) => q.status !== 'cancelled').length,
  }
}

export const customerTypeLabels = { individual: 'Particular', business: 'Empresa' } as const
