import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import type { InventoryLevel, InventoryMovement, ListResponse } from '../../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useStaffSession } from '../../auth/auth-context'
import { formatDateTime, inCollection, movementLabels, newIdempotencyKey, parseWholeNumber, plural, uniqueCollections } from '../panel-logic'
import { formatDimensions, movementSign, sortByUrgency, stockStatus } from '../production-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { Badge, CollectionSwitch, EmptyState, Field, inputClass, listSurface, ModelThumb, Notice, PageHeader, primaryButton, primaryButtonLarge, QueryView, secondaryButton } from '../ui'

type Correction = 'adjustment_in' | 'adjustment_out' | 'return_in'

const corrections: { value: Correction; label: string; hint: string }[] = [
  { value: 'adjustment_in', label: 'Hay más de las que dice', hint: 'Por ejemplo, se contaron de nuevo y aparecieron más.' },
  { value: 'adjustment_out', label: 'Hay menos de las que dice', hint: 'Por ejemplo, una tabla se dañó o faltó en el conteo.' },
  { value: 'return_in', label: 'Un cliente devolvió tablas', hint: 'Vuelven al taller para venderse otra vez.' },
]

/** Corregir el conteo (solo administración). La producción nueva se anota en Producción. */
function CorrectionForm({ level, onDone }: { level: InventoryLevel; onDone: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [type, setType] = useState<Correction>('adjustment_in')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  // La clave solo cambia tras un registro exitoso: reintentar tras un fallo de red no duplica.
  const [key, setKey] = useState(newIdempotencyKey)
  const needsReason = type !== 'return_in'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setDone(null)
    const qty = parseWholeNumber(quantity)
    if (qty === null || Number.isNaN(qty) || qty < 1) return setFormError('Escribe cuántas tablas, con un número mayor que cero.')
    if (needsReason && !reason.trim()) return setFormError('Escribe el motivo de la corrección.')
    setFormError(null)
    const result = await run('POST', '/inventory/movements', { variantId: level.variantId, type, quantity: qty, reason: reason.trim() || undefined, idempotencyKey: key })
    if (result) {
      const n = plural(qty, 'tabla')
      setDone(type === 'adjustment_in' ? `Listo: se sumaron ${n}.` : type === 'adjustment_out' ? `Listo: se restaron ${n}.` : `Listo: volvieron ${n} al taller.`)
      setQuantity('')
      setReason('')
      setKey(newIdempotencyKey())
      onDone()
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-4" noValidate>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-lg font-semibold">¿Qué pasó?</legend>
        {corrections.map((c) => (
          <label key={c.value} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${type === c.value ? 'border-nogal bg-beige/40' : 'border-linea'}`}>
            <input type="radio" name={`tipo-${level.variantId}`} className="mt-1 size-5 accent-nogal" checked={type === c.value} onChange={() => setType(c.value)} />
            <span className="grid">
              <span className="text-lg font-bold">{c.label}</span>
              <span className="text-base text-carbon-600">{c.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field label="¿Cuántas?">
          <input className={`${inputClass} text-xl font-bold`} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label={needsReason ? 'Motivo' : 'Motivo (opcional)'}>
          <input className={inputClass} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      {(formError ?? error) && <Notice>{formError ?? error}</Notice>}
      {done && (
        <p role="status" className="rounded-xl bg-exito-claro px-4 py-3 text-lg font-bold text-exito">
          {done}
        </p>
      )}
      <div>
        <button type="submit" className={primaryButton} disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar corrección'}
        </button>
      </div>
    </form>
  )
}

function SettingsForm({ level, onDone }: { level: InventoryLevel; onDone: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [minStock, setMinStock] = useState(level.minStock?.toString() ?? '')
  const [custodian, setCustodian] = useState(level.custodian ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const min = parseWholeNumber(minStock)
    if (Number.isNaN(min)) return setFormError('El mínimo debe ser un número entero.')
    setFormError(null)
    if (await run('PUT', `/inventory/${level.variantId}/settings`, { minStock: min, custodian: custodian.trim() || null })) onDone()
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Avisar cuando queden" hint="Suena la alarma al llegar a este número. Vacío = sin aviso.">
        <input className={inputClass} inputMode="numeric" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
      </Field>
      <Field label="¿Quién las tiene?" hint="Por ejemplo: Taller, Mariel.">
        <input className={inputClass} value={custodian} maxLength={120} onChange={(e) => setCustodian(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:col-span-2">
        {(formError ?? error) && <Notice>{formError ?? error}</Notice>}
        <div>
          <button type="submit" className={secondaryButton} disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </form>
  )
}

function History({ level }: { level: InventoryLevel }) {
  const { state, reload } = useAdminQuery<ListResponse<InventoryMovement>>(`/inventory/${level.variantId}/movements`)
  return (
    <QueryView state={state} onRetry={reload}>
      {({ items }) =>
        items.length === 0 ? (
          <EmptyState>Todavía no hay movimientos.</EmptyState>
        ) : (
          <ul className="grid gap-2">
            {items.slice(0, 15).map((m) => {
              const sign = movementSign(m.movementType)
              return (
                <li key={m.id} className="grid gap-1 rounded-xl border border-linea p-3 sm:grid-cols-[5rem_1fr_auto] sm:items-center sm:gap-4">
                  <span className={`font-display text-2xl ${sign === '+' ? 'text-exito' : sign === '−' ? 'text-alerta' : 'text-carbon-600'}`}>
                    {sign}
                    {m.quantity}
                  </span>
                  <span className="grid">
                    <span className="text-lg font-semibold">{movementLabels[m.movementType]}</span>
                    {m.reason && <span className="text-base text-carbon-600">{m.reason}</span>}
                  </span>
                  <span className="text-base text-carbon-600 sm:text-right">
                    {formatDateTime(m.createdAt)}
                    <span className="block">quedaron {m.onHandAfter} en el taller</span>
                  </span>
                </li>
              )
            })}
          </ul>
        )
      }
    </QueryView>
  )
}

/** Detalle de una tabla, dentro de su tarjeta: historial y, para administración, corregir y configurar. */
function StockDetail({ level, isAdmin, onChanged }: { level: InventoryLevel; isAdmin: boolean; onChanged: () => void }) {
  const [version, setVersion] = useState(0)
  const changed = () => {
    onChanged()
    setVersion((v) => v + 1)
  }
  return (
    <div className="grid gap-8 border-t border-linea pt-6 sm:pl-[4.5rem]">
      {isAdmin && (
        <section className="grid gap-3">
          <h3 className="text-2xl">Corregir el conteo</h3>
          <p className="text-lg text-carbon-600">
            Las tablas nuevas se anotan en <Link to="/produccion" className="font-bold text-madera-700 underline">Producción</Link>. Los pedidos apartan y descuentan solos.
          </p>
          <CorrectionForm level={level} onDone={changed} />
        </section>
      )}
      <section className="grid gap-3">
        <h3 className="text-2xl">Últimos movimientos</h3>
        <History key={version} level={level} />
      </section>
      {isAdmin && (
        <section className="grid gap-3">
          <h3 className="text-2xl">Aviso y responsable</h3>
          <SettingsForm key={`${level.minStock}-${level.custodian}`} level={level} onDone={changed} />
        </section>
      )}
    </div>
  )
}

/** Columnas de la tabla de stock en laptop: tabla, en el taller, apartadas, libres y la flecha. */
const stockColumns = 'sm:grid-cols-[auto_minmax(0,1fr)_6.5rem_6.5rem_7rem_2rem]'

const freeTone = { ok: 'text-nogal', low: 'text-aviso', out: 'text-alerta' } as const

function Count({ label, value, className = '' }: { label: string; value: number; className?: string }) {
  return (
    <span className="grid rounded-xl bg-marfil px-3 py-2 sm:bg-transparent sm:p-0 sm:text-right">
      {/* En laptop la etiqueta ya está en el encabezado de la columna. */}
      <span className="text-sm whitespace-nowrap text-carbon-600 sm:sr-only">{label}</span>
      <span className={`text-2xl font-bold tabular-nums ${className}`}>{value}</span>
    </span>
  )
}

/** Una tabla del stock en una fila. Al tocarla se abren sus movimientos y, para administración, la corrección. */
function StockRow({ level, open, onToggle, isAdmin, onChanged }: { level: InventoryLevel; open: boolean; onToggle: () => void; isAdmin: boolean; onChanged: () => void }) {
  const status = stockStatus(level)
  const notes = [level.minStock !== null ? `Aviso en ${level.minStock}` : null, level.custodian ? `Las tiene: ${level.custodian}` : null].filter(Boolean)
  return (
    <li className={open ? 'bg-marfil/60' : ''}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-4 text-left transition-colors hover:bg-marfil sm:px-7 ${stockColumns}`}
      >
        <ModelThumb slug={level.productSlug} className="size-14" />
        <span className="grid min-w-0 justify-items-start gap-0.5">
          <span className="text-xl leading-snug font-bold text-carbon">
            {level.product} {level.variant}
          </span>
          <span className="text-base text-carbon-600">{[formatDimensions(level.dimensionsLabel), ...notes].filter(Boolean).join(' · ')}</span>
          {status.state !== 'ok' && (
            <span className="mt-1">
              <Badge tone={status.tone}>{status.label}</Badge>
            </span>
          )}
        </span>
        {/* En el celular, las tres cifras van en su propia fila debajo del nombre. */}
        <span className="col-span-3 grid grid-cols-3 gap-2 sm:contents">
          <Count label="En taller" value={level.onHand} />
          <Count label="Apartadas" value={level.reserved} />
          <Count label="Libres" value={level.available} className={freeTone[status.state]} />
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`col-start-3 row-start-1 size-6 justify-self-end text-carbon-600 transition-transform sm:col-start-auto sm:row-start-auto ${open ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-7 sm:px-7">
          <StockDetail level={level} isAdmin={isAdmin} onChanged={onChanged} />
        </div>
      )}
    </li>
  )
}

export function InventoryPage() {
  useDocumentTitle('Stock')
  const { staff } = useStaffSession()
  const { state, reload } = useAdminQuery<ListResponse<InventoryLevel>>('/inventory')
  const [openId, setOpenId] = useState<string | null>(null)
  const [collection, setCollection] = useState('')

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <PageHeader
        title="Stock"
        actions={
          <Link to="/produccion" className={primaryButtonLarge}>
            Anotar producción
          </Link>
        }
      />
      <QueryView state={state} onRetry={reload}>
        {({ items }) => {
          if (items.length === 0) return <EmptyState>No hay tablas en el stock todavía.</EmptyState>
          const visible = sortByUrgency(inCollection(items, collection, (l) => l.collection))
          const problems = items.filter((l) => stockStatus(l).state !== 'ok').length
          return (
            <>
              <p className={`rounded-2xl px-5 py-4 text-xl font-bold ${problems > 0 ? 'bg-aviso-claro text-aviso' : 'bg-exito-claro text-exito'}`}>
                {problems > 0 ? `${plural(problems, 'tabla necesita', 'tablas necesitan')} producción. Están primero en la lista.` : 'Todas las tablas están sobre el mínimo.'}
              </p>
              <CollectionSwitch collections={uniqueCollections(items.map((l) => l.collection))} value={collection} onChange={setCollection} />
              <ul className={listSurface}>
                <li aria-hidden="true" className={`hidden gap-x-4 bg-marfil px-7 py-3 text-sm font-bold text-carbon-600 sm:grid ${stockColumns}`}>
                  <span className="col-span-2">Tabla</span>
                  <span className="text-right">En el taller</span>
                  <span className="text-right">Apartadas</span>
                  <span className="text-right">Libres para vender</span>
                  <span />
                </li>
                {visible.map((l) => (
                  <StockRow
                    key={l.variantId}
                    level={l}
                    open={openId === l.variantId}
                    onToggle={() => setOpenId(openId === l.variantId ? null : l.variantId)}
                    isAdmin={staff.role === 'admin'}
                    onChanged={reload}
                  />
                ))}
              </ul>
            </>
          )
        }}
      </QueryView>
    </div>
  )
}
