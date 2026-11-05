import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { ListResponse, PanelProduct, PanelVariant } from '../../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import {
  addVariantLine,
  buildDirectOrder,
  emptySale,
  lineTotal,
  saleSummary,
  stepQuantity,
  suggestedPrice,
  type SaleLine,
  type SaleValues,
} from '../direct-sale-logic'
import { formatMoney } from '../panel-logic'
import { formatDimensions } from '../production-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { BackLink, Field, inputClass, listSurface, ModelThumb, Notice, PageHeader, QueryView, secondaryButton, Segmented } from '../ui'

const channelOptions = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'admin', label: 'En persona o por teléfono' },
  { id: 'web_chat', label: 'Chat web' },
] as const

const typeOptions = [
  { id: 'individual', label: 'Particular' },
  { id: 'business', label: 'Empresa' },
] as const

/** Un paso del formulario: número, título y su contenido. Los pasos sí son una secuencia. */
function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`paso-${n}`} className="grid gap-5 rounded-3xl border border-linea bg-white p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-nogal font-display text-xl text-marfil">
          {n}
        </span>
        <div className="grid gap-0.5">
          <h2 id={`paso-${n}`} className="text-2xl">
            {title}
          </h2>
          {hint && <p className="text-base text-carbon-600">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

const PlusIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

/** Un modelo con su foto; cada tamaño es un botón que lo suma a la venta. */
function ProductTile({ product, countOf, onAdd }: { product: PanelProduct; countOf: (variantId: string) => number; onAdd: (product: PanelProduct, variant: PanelVariant) => void }) {
  const variants = product.variants.filter((v) => v.isActive)
  return (
    <li className="grid content-start gap-3 rounded-2xl border border-linea p-3">
      <div className="flex items-center gap-3">
        <ModelThumb slug={product.slug} className="size-16" />
        <p className="font-display text-xl leading-tight text-nogal">{product.name}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {variants.map((v) => {
          const price = suggestedPrice(v, 1)
          const inSale = countOf(v.id)
          return (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onAdd(product, v)}
                aria-label={`Agregar ${product.name} ${v.name}${inSale ? `; ya hay ${inSale} en la venta` : ''}`}
                className={`grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                  inSale ? 'bg-beige ring-2 ring-nogal' : 'bg-marfil hover:bg-beige'
                }`}
              >
                <span className="grid min-w-0">
                  <span className="text-base font-bold text-carbon">{v.name}</span>
                  <span className="text-sm text-carbon-600">
                    {[formatDimensions(v.dimensionsLabel), price === null ? 'a cotizar' : formatMoney(price)].filter(Boolean).join(', ')}
                  </span>
                  {inSale > 0 && <span className="text-sm font-extrabold text-madera-700">{inSale} en la venta</span>}
                </span>
                <span className="flex size-9 items-center justify-center rounded-full bg-nogal text-marfil">
                  <PlusIcon />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </li>
  )
}

function SaleForm({ products }: { products: PanelProduct[] }) {
  const navigate = useNavigate()
  const { run, pending, error } = useAdminAction()
  const [values, setValues] = useState<SaleValues>(emptySale)
  const [errors, setErrors] = useState<string[]>([])

  const active = useMemo(() => products.filter((p) => p.isActive && p.variants.some((v) => v.isActive)), [products])
  const byId = useMemo(() => new Map(active.flatMap((p) => p.variants.map((v) => [v.id, v] as const))), [active])

  const setCustomer = <K extends keyof SaleValues['customer']>(key: K, value: SaleValues['customer'][K]) =>
    setValues((v) => ({ ...v, customer: { ...v.customer, [key]: value } }))
  const set = <K extends keyof SaleValues>(key: K, value: SaleValues[K]) => setValues((v) => ({ ...v, [key]: value }))
  const updateLine = (key: string, patch: Partial<SaleLine>) =>
    setValues((v) => ({ ...v, lines: v.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }))
  const replaceLine = (next: SaleLine) => setValues((v) => ({ ...v, lines: v.lines.map((l) => (l.key === next.key ? next : l)) }))
  const removeLine = (key: string) => setValues((v) => ({ ...v, lines: v.lines.filter((l) => l.key !== key) }))
  const addVariant = (product: PanelProduct, variant: PanelVariant) =>
    setValues((v) => ({ ...v, lines: addVariantLine(v.lines, variant.id, `${product.name} ${variant.name}`, () => crypto.randomUUID()) }))
  const addCustom = () =>
    setValues((v) => ({ ...v, lines: [...v.lines, { key: crypto.randomUUID(), label: '', quantity: '1', unitPrice: '', customization: '' }] }))
  const countOf = (variantId: string) => Number(values.lines.find((l) => l.variantId === variantId)?.quantity) || 0

  /** Precio que se usará si la fila no trae uno escrito: el del catálogo para esa cantidad. */
  const priceOf = (line: SaleLine) => {
    const variant = line.variantId ? byId.get(line.variantId) : undefined
    const qty = Number(line.quantity)
    return variant && Number.isFinite(qty) && qty > 0 ? suggestedPrice(variant, qty) : null
  }
  const summary = saleSummary(values.lines, values.discount, priceOf)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const result = buildDirectOrder(values)
    if (!result.ok) return setErrors(result.errors)
    setErrors([])
    const created = await run<{ orderId: string }>('POST', '/orders', result.body)
    if (created) void navigate(`/pedidos/${created.orderId}`)
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] [&>*]:min-w-0" noValidate>
      <div className="grid gap-6">
        <Step n={1} title="¿Quién compra?">
          <div className="grid gap-4">
            <Segmented wrap label="Tipo de cliente" options={typeOptions} value={values.customer.type} onChange={(id) => setCustomer('type', id)} />
            <div className="grid gap-4 sm:grid-cols-2">
              {values.customer.type === 'business' && (
                <Field label="Empresa">
                  <input className={inputClass} maxLength={200} value={values.customer.companyName} onChange={(e) => setCustomer('companyName', e.target.value)} />
                </Field>
              )}
              <Field label={values.customer.type === 'business' ? 'Nombre del contacto' : 'Nombre y apellido'}>
                <input className={inputClass} maxLength={160} autoComplete="off" value={values.customer.fullName} onChange={(e) => setCustomer('fullName', e.target.value)} />
              </Field>
              <Field label="Celular o WhatsApp">
                <input className={inputClass} type="tel" autoComplete="off" value={values.customer.phone} onChange={(e) => setCustomer('phone', e.target.value)} />
              </Field>
              <Field label="Correo (opcional)" hint="Si el cliente ya existe con este correo o celular, se usa el mismo.">
                <input className={inputClass} type="email" maxLength={254} autoComplete="off" value={values.customer.email} onChange={(e) => setCustomer('email', e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-2">
              <p className="text-base font-semibold">¿Por dónde compró?</p>
              <Segmented wrap label="Canal de la venta" options={channelOptions} value={values.channel} onChange={(id) => set('channel', id)} />
            </div>
          </div>
        </Step>

        <Step n={2} title="¿Qué tablas lleva?" hint="Toca un tamaño para sumarlo. Si lo tocas otra vez, sube la cantidad.">
          <ul className="grid gap-3">
            {active.map((p) => (
              <ProductTile key={p.id} product={p} countOf={countOf} onAdd={addVariant} />
            ))}
          </ul>
          <div>
            <button type="button" className={secondaryButton} onClick={addCustom}>
              <PlusIcon />
              Pieza a medida
            </button>
          </div>

          {values.lines.length > 0 && (
            <div className="grid gap-3">
              <h3 className="font-sans text-lg font-bold">En esta venta</h3>
              <ul className={listSurface}>
                {values.lines.map((line) => {
                  const suggested = priceOf(line)
                  const total = lineTotal(line, priceOf)
                  return (
                    <li key={line.key} className="grid gap-3 px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        {line.variantId ? (
                          <p className="text-lg font-bold">{line.label}</p>
                        ) : (
                          <div className="min-w-0 flex-1">
                            <Field label="Pieza a medida">
                              <input className={inputClass} maxLength={300} placeholder="Qué es y sus medidas" value={line.label} onChange={(e) => updateLine(line.key, { label: e.target.value })} />
                            </Field>
                          </div>
                        )}
                        <p className={`text-lg font-extrabold ${total === null ? 'text-aviso' : ''}`}>{total === null ? 'Falta precio' : formatMoney(total)}</p>
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="grid gap-2">
                          <span className="text-base font-semibold">Cantidad</span>
                          <div className="flex items-center gap-2">
                            <button type="button" aria-label="Una menos" className="flex size-12 items-center justify-center rounded-xl border-2 border-linea text-2xl font-bold text-nogal" onClick={() => replaceLine(stepQuantity(line, -1))}>
                              −
                            </button>
                            <span className="w-20">
                              <input
                                aria-label={`Cantidad de ${line.label || 'la pieza'}`}
                                className={`${inputClass} text-center text-lg font-bold`}
                                inputMode="numeric"
                                value={line.quantity}
                                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                              />
                            </span>
                            <button type="button" aria-label="Una más" className="flex size-12 items-center justify-center rounded-xl border-2 border-linea text-2xl font-bold text-nogal" onClick={() => replaceLine(stepQuantity(line, 1))}>
                              +
                            </button>
                          </div>
                        </div>
                        <div className="w-40">
                          <Field label="Precio c/u (S/)">
                            <input
                              className={inputClass}
                              inputMode="decimal"
                              placeholder={suggested === null ? 'Escríbelo' : String(suggested)}
                              value={line.unitPrice}
                              onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                            />
                          </Field>
                        </div>
                        <div className="min-w-48 flex-1">
                          <Field label="Grabado (opcional)">
                            <input className={inputClass} maxLength={1000} placeholder="Texto, logo o posición" value={line.customization} onChange={(e) => updateLine(line.key, { customization: e.target.value })} />
                          </Field>
                        </div>
                        <button type="button" className="min-h-12 px-2 text-base font-bold text-alerta underline underline-offset-4" onClick={() => removeLine(line.key)}>
                          Quitar
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </Step>

        <Step n={3} title="Entrega y confirmación">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Dirección de entrega">
                <input className={inputClass} maxLength={500} value={values.shippingAddress} onChange={(e) => set('shippingAddress', e.target.value)} />
              </Field>
            </div>
            <Field label="Descuento (S/)" hint="Opcional.">
              <input className={inputClass} inputMode="decimal" value={values.discount} onChange={(e) => set('discount', e.target.value)} />
            </Field>
            <Field label="Notas del equipo" hint="Solo las ve el equipo.">
              <input className={inputClass} maxLength={2000} value={values.internalNotes} onChange={(e) => set('internalNotes', e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3">
            <label className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border-2 px-4 ${values.customerConfirmed ? 'border-nogal bg-beige/50' : 'border-linea'}`}>
              <input
                type="checkbox"
                className="size-6 accent-nogal"
                checked={values.customerConfirmed}
                onChange={(e) => setValues((v) => ({ ...v, customerConfirmed: e.target.checked, confirm: e.target.checked && v.confirm }))}
              />
              <span className="text-lg font-semibold">El cliente ya confirmó el pedido</span>
            </label>
            <label
              className={`flex min-h-16 items-center gap-4 rounded-2xl border-2 px-4 ${
                values.customerConfirmed ? `cursor-pointer ${values.confirm ? 'border-nogal bg-beige/50' : 'border-linea'}` : 'border-linea opacity-60'
              }`}
            >
              <input type="checkbox" className="size-6 accent-nogal" checked={values.confirm} disabled={!values.customerConfirmed} onChange={(e) => set('confirm', e.target.checked)} />
              <span className="grid">
                <span className="text-lg font-semibold">Apartar las tablas ahora</span>
                <span className="text-base text-carbon-600">Se reservan del stock y se descuentan al despachar.</span>
              </span>
            </label>
          </div>
        </Step>
      </div>

      {/* Resumen siempre a la vista en laptop; en el celular queda al final. */}
      <aside aria-label="Resumen de la venta" className="grid gap-5 rounded-3xl bg-nogal p-6 text-beige lg:sticky lg:top-8">
        <h2 className="text-2xl text-marfil">Resumen</h2>
        {values.lines.length === 0 ? (
          <p className="text-lg text-arena">Todavía no hay tablas. Elígelas en el paso 2.</p>
        ) : (
          <ul className="grid gap-3">
            {values.lines.map((line) => {
              const total = lineTotal(line, priceOf)
              return (
                <li key={line.key} className="flex items-baseline justify-between gap-3 text-base">
                  <span className="min-w-0">
                    <span className="font-bold text-marfil">{Number(line.quantity) || 0} ×</span> {line.label || 'Pieza a medida'}
                  </span>
                  <span className={`shrink-0 font-bold ${total === null ? 'text-ambar' : 'text-marfil'}`}>{total === null ? 'Sin precio' : formatMoney(total)}</span>
                </li>
              )
            })}
          </ul>
        )}
        <dl className="grid gap-1 border-t border-beige/20 pt-4 text-base">
          {summary.discount > 0 && (
            <>
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatMoney(summary.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Descuento</dt>
                <dd>− {formatMoney(summary.discount)}</dd>
              </div>
            </>
          )}
          <div className="flex items-baseline justify-between">
            <dt className="text-lg">Total</dt>
            <dd className="font-display text-4xl text-marfil">{formatMoney(summary.total)}</dd>
          </div>
          {summary.missingPrices > 0 && (
            <dd className="text-base text-ambar">
              {summary.missingPrices === 1 ? 'Falta el precio de 1 pieza.' : `Falta el precio de ${summary.missingPrices} piezas.`}
            </dd>
          )}
        </dl>

        {(errors.length > 0 || error) && (
          <Notice>
            {errors.length > 0 ? (
              <ul className="grid gap-1">
                {errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : (
              error
            )}
          </Notice>
        )}

        <button type="submit" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-marfil px-7 text-lg font-extrabold text-nogal transition-colors hover:bg-beige disabled:cursor-not-allowed disabled:opacity-50" disabled={pending || values.lines.length === 0}>
          {pending ? 'Guardando…' : values.confirm ? 'Crear y apartar tablas' : 'Crear venta'}
        </button>
      </aside>
    </form>
  )
}

export function NewSalePage() {
  useDocumentTitle('Nueva venta')
  const { state, reload } = useAdminQuery<ListResponse<PanelProduct>>('/products')

  return (
    <div className="mx-auto max-w-6xl">
      <BackLink to="/pedidos">Volver a pedidos</BackLink>
      <PageHeader title="Nueva venta" intro="Para ventas por WhatsApp o en persona, sin cotización previa." />
      <QueryView state={state} onRetry={reload}>
        {({ items }) => <SaleForm products={items} />}
      </QueryView>
    </div>
  )
}
