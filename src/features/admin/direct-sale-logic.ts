import type { PanelVariant } from '../../../shared/api/panel-contracts'
import { directOrderBody, type DirectOrderInput } from '../../../shared/api/panel-schemas'
import { resolveUnitPrice } from '../catalog/pricing'
import { parseDecimal } from './panel-logic'

/** Lógica del formulario de venta directa. Sin React: se prueba sola. */

export interface SaleLine {
  /** Identificador local de la línea. */
  key: string
  variantId?: string
  /** Nombre para mostrar ("Producto · Variante") o la descripción de la pieza a medida. */
  label: string
  quantity: string
  /** Texto del precio; vacío = usar el de la regla de siempre (solo para variantes del catálogo). */
  unitPrice: string
  customization: string
}

export interface SaleCustomerValues {
  type: 'individual' | 'business'
  fullName: string
  companyName: string
  email: string
  phone: string
}

export interface SaleValues {
  channel: 'admin' | 'whatsapp' | 'web_chat'
  customer: SaleCustomerValues
  lines: SaleLine[]
  discount: string
  shippingAddress: string
  internalNotes: string
  customerConfirmed: boolean
  confirm: boolean
}

export const emptySale = (): SaleValues => ({
  channel: 'whatsapp',
  customer: { type: 'individual', fullName: '', companyName: '', email: '', phone: '' },
  lines: [],
  discount: '',
  shippingAddress: '',
  internalNotes: '',
  customerConfirmed: false,
  confirm: false,
})

const blank = (value: string) => (value.trim() === '' ? undefined : value.trim())

/** Precio que sugiere el catálogo para una variante y una cantidad; null si aún no tiene precio publicado. */
export function suggestedPrice(variant: Pick<PanelVariant, 'catalogPrice' | 'priceTiers'>, quantity: number): number | null {
  return resolveUnitPrice({ price: variant.catalogPrice, priceTiers: variant.priceTiers }, quantity)
}

/** Total de la venta con lo que se conoce hoy: líneas con precio escrito o sugerido. */
export function saleSubtotal(lines: readonly SaleLine[], priceOf: (line: SaleLine) => number | null): number {
  return lines.reduce((sum, line) => {
    const qty = Number(line.quantity)
    const price = parseDecimal(line.unitPrice) ?? priceOf(line)
    return Number.isFinite(qty) && qty > 0 && price !== null && !Number.isNaN(price) ? sum + Math.round(price * qty * 100) / 100 : sum
  }, 0)
}

/** Valida con el mismo esquema que el servidor y arma el cuerpo de POST /api/admin/orders. */
export function buildDirectOrder(values: SaleValues): { ok: true; body: DirectOrderInput } | { ok: false; errors: string[] } {
  const discount = parseDecimal(values.discount)
  if (Number.isNaN(discount)) return { ok: false, errors: ['El descuento no es válido (máximo 2 decimales).'] }

  const items: Record<string, unknown>[] = []
  for (const [index, line] of values.lines.entries()) {
    const price = parseDecimal(line.unitPrice)
    if (Number.isNaN(price)) return { ok: false, errors: [`El precio del producto ${index + 1} no es válido (máximo 2 decimales).`] }
    items.push({
      variantId: line.variantId,
      description: line.variantId ? undefined : blank(line.label),
      quantity: Number(line.quantity),
      unitPrice: price ?? undefined,
      customization: blank(line.customization),
    })
  }

  const c = values.customer
  const candidate = {
    channel: values.channel,
    customer: {
      type: c.type,
      fullName: c.fullName,
      companyName: c.type === 'business' ? blank(c.companyName) : undefined,
      email: blank(c.email),
      phone: blank(c.phone),
    },
    items,
    discountTotal: discount ?? 0,
    shippingAddress: blank(values.shippingAddress),
    internalNotes: blank(values.internalNotes),
    customerConfirmed: values.customerConfirmed,
    confirm: values.confirm,
  }

  const parsed = directOrderBody.safeParse(candidate)
  if (parsed.success) return { ok: true, body: parsed.data }
  const messages = [...new Set(parsed.error.issues.map((i) => i.message))]
  return { ok: false, errors: messages }
}

/** Suma una tabla del catálogo: si ya está en la venta, sube su cantidad en 1 (no repite la fila). */
export function addVariantLine(lines: readonly SaleLine[], variantId: string, label: string, newKey: () => string): SaleLine[] {
  const existing = lines.find((l) => l.variantId === variantId)
  if (existing) {
    const qty = Number(existing.quantity)
    return lines.map((l) => (l === existing ? { ...l, quantity: String(Number.isFinite(qty) && qty > 0 ? qty + 1 : 1) } : l))
  }
  return [...lines, { key: newKey(), variantId, label, quantity: '1', unitPrice: '', customization: '' }]
}

/** Cambia la cantidad de una fila en `delta`, sin bajar de 1. */
export function stepQuantity(line: SaleLine, delta: number): SaleLine {
  const qty = Number(line.quantity)
  return { ...line, quantity: String(Math.max(1, (Number.isFinite(qty) && qty > 0 ? qty : 1) + delta)) }
}

/** Importe de una fila (precio escrito o sugerido por cantidad); null si aún no tiene precio. */
export function lineTotal(line: SaleLine, priceOf: (line: SaleLine) => number | null): number | null {
  const qty = Number(line.quantity)
  const price = parseDecimal(line.unitPrice) ?? priceOf(line)
  if (!Number.isFinite(qty) || qty <= 0 || price === null || Number.isNaN(price)) return null
  return Math.round(price * qty * 100) / 100
}

/** Resumen de la venta: total a cobrar (sin bajar de 0) y cuántas filas aún no tienen precio. */
export function saleSummary(lines: readonly SaleLine[], discountText: string, priceOf: (line: SaleLine) => number | null) {
  const subtotal = saleSubtotal(lines, priceOf)
  const discount = parseDecimal(discountText)
  const validDiscount = discount !== null && !Number.isNaN(discount) ? discount : 0
  return {
    subtotal,
    discount: validDiscount,
    total: Math.max(0, Math.round((subtotal - validDiscount) * 100) / 100),
    missingPrices: lines.filter((l) => lineTotal(l, priceOf) === null).length,
  }
}
