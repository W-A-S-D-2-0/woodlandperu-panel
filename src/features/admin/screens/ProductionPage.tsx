import { useMemo, useRef, useState } from 'react'
import type { InventoryLevel, ListResponse } from '../../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { filterLevels, formatDimensions, groupByProduct, parseProductionQuantity, PRODUCTION_MAX, stockStatus } from '../production-logic'
import { newIdempotencyKey, plural } from '../panel-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { Badge, EmptyState, inputClass, listSurface, ModelThumb, Notice, PageHeader, QueryView } from '../ui'

const bigButton =
  'inline-flex min-h-14 items-center justify-center rounded-2xl px-6 text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

/** Anotar producción en dos toques (anotar y confirmar). Se abre dentro de la fila de la tabla. */
function ProductionForm({ level, onDone }: { level: InventoryLevel; onDone: () => void }) {
  const { run, pending, error, clearError } = useAdminAction()
  const [text, setText] = useState('1')
  const [armed, setArmed] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  // Misma clave en los reintentos: si la red falla a medias, no se duplica la producción.
  const key = useRef(newIdempotencyKey())

  const quantity = parseProductionQuantity(text)
  const valid = Number.isFinite(quantity)

  const change = (value: string) => {
    setText(value)
    setArmed(false)
    setDone(null)
    clearError()
  }
  const step = (delta: number) => change(String(Math.min(PRODUCTION_MAX, Math.max(1, (Number.isFinite(quantity) ? quantity : 1) + delta))))

  async function register() {
    if (!valid) return
    if (!armed) return setArmed(true)
    const result = await run('POST', '/inventory/movements', {
      variantId: level.variantId,
      type: 'production_in',
      quantity,
      idempotencyKey: key.current,
    })
    setArmed(false)
    if (result) {
      key.current = newIdempotencyKey()
      setDone(`Listo: se sumaron ${quantity}. Ahora hay ${level.onHand + quantity} en el taller.`)
      setText('1')
      onDone()
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-lg font-semibold text-carbon">¿Cuántas terminaste?</p>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <button type="button" aria-label="Una menos" className={`${bigButton} w-14 border-2 border-nogal/30 bg-white text-2xl text-nogal hover:border-nogal`} onClick={() => step(-1)}>
          −
        </button>
        <input
          aria-label={`Tablas terminadas de ${level.product} ${level.variant}`}
          className={`${inputClass} min-h-14 text-center text-2xl font-bold`}
          inputMode="numeric"
          value={text}
          onChange={(e) => change(e.target.value)}
        />
        <button type="button" aria-label="Una más" className={`${bigButton} w-14 border-2 border-nogal/30 bg-white text-2xl text-nogal hover:border-nogal`} onClick={() => step(1)}>
          +
        </button>
      </div>
      <div className="flex gap-2" role="group" aria-label="Cantidades rápidas">
        {[5, 10, 20].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={quantity === n}
            className={`min-h-12 flex-1 rounded-xl border-2 text-lg font-bold transition-colors ${
              quantity === n ? 'border-nogal bg-white text-nogal' : 'border-linea bg-white text-carbon-600 hover:border-nogal hover:text-nogal'
            }`}
            onClick={() => change(String(n))}
          >
            {n}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!valid || pending}
        onClick={() => void register()}
        className={`${bigButton} ${armed ? 'bg-exito text-marfil hover:bg-exito/90' : 'bg-nogal text-marfil hover:bg-nogal-800'}`}
      >
        {pending ? 'Guardando…' : armed ? `Sí, sumar ${quantity} al taller` : `Anotar ${valid ? plural(quantity, 'tabla') : ''}`}
      </button>

      {!valid && <p className="text-base font-semibold text-alerta">Escribe un número entero de 1 a {PRODUCTION_MAX}.</p>}
      {armed && (
        <button type="button" className="min-h-12 text-base font-bold text-carbon-600 underline underline-offset-4" onClick={() => setArmed(false)}>
          No, me equivoqué
        </button>
      )}
      {done && (
        <p role="status" className="rounded-xl bg-exito-claro px-4 py-3 text-lg font-bold text-exito">
          {done}
        </p>
      )}
      {error && <Notice>{error}</Notice>}
    </div>
  )
}

/** Un tamaño de un modelo: cuántas hay en el taller y el botón para anotar. El nombre del modelo ya está en el título del grupo. */
function VariantRow({ level, open, onToggle, onDone }: { level: InventoryLevel; open: boolean; onToggle: () => void; onDone: () => void }) {
  const status = stockStatus(level)
  return (
    <li>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_9rem] sm:px-6">
        <div className="grid min-w-0 justify-items-start gap-0.5">
          <p className="text-xl leading-snug font-bold text-carbon">{level.variant}</p>
          {level.dimensionsLabel && <p className="text-base text-carbon-600">{formatDimensions(level.dimensionsLabel)}</p>}
          {status.state !== 'ok' && (
            <span className="mt-1">
              <Badge tone={status.tone}>{status.label}</Badge>
            </span>
          )}
        </div>
        <p className="grid text-right">
          <span className="text-sm font-semibold text-carbon-600">En el taller</span>
          <span className="font-display text-4xl leading-tight text-nogal tabular-nums">{level.onHand}</span>
        </p>
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className={`col-span-2 inline-flex min-h-14 items-center justify-center rounded-2xl px-5 text-lg font-bold transition-colors sm:col-span-1 ${
            open ? 'border-2 border-linea text-carbon-600 hover:border-nogal' : 'bg-nogal text-marfil hover:bg-nogal-800'
          }`}
        >
          {open ? 'Cerrar' : 'Anotar'}
        </button>
      </div>
      {open && (
        <div className="border-t border-beige bg-marfil px-5 py-5 sm:px-6">
          <ProductionForm level={level} onDone={onDone} />
        </div>
      )}
    </li>
  )
}

/** Pantalla del taller: anotar tablas terminadas con botones grandes, pensada para el celular. */
export function ProductionPage() {
  useDocumentTitle('Producción')
  const { state, reload } = useAdminQuery<ListResponse<InventoryLevel>>('/inventory')
  const [query, setQuery] = useState('')

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title="Producción" intro="Toca «Anotar» en la tabla que terminaste. Se suma al stock al instante." />
      <label className="grid gap-2 text-base">
        <span className="font-semibold">Buscar una tabla</span>
        <input className={`${inputClass} min-h-14 text-lg`} type="search" placeholder="Por ejemplo: Moshaco" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      <QueryView state={state} onRetry={reload}>
        {({ items }) => <Results items={items} query={query} onDone={reload} />}
      </QueryView>
    </div>
  )
}

function Results({ items, query, onDone }: { items: InventoryLevel[]; query: string; onDone: () => void }) {
  const groups = useMemo(() => groupByProduct(filterLevels(items, query)), [items, query])
  // Una sola tabla abierta a la vez: en el celular no se pierde de vista lo que se está anotando.
  const [openId, setOpenId] = useState<string | null>(null)

  if (items.length === 0) return <EmptyState>Aún no hay tablas en el stock.</EmptyState>
  if (groups.length === 0) return <EmptyState>No hay resultados para esa búsqueda.</EmptyState>

  return (
    <div className="grid gap-10">
      {groups.map((group) => (
        <section key={group.product} aria-label={group.product} className="grid gap-3">
          <div className="flex items-center gap-4">
            <ModelThumb slug={group.levels[0]?.productSlug ?? ''} className="size-14" />
            <div className="grid">
              <h2 className="text-3xl leading-tight">{group.product}</h2>
              <p className="text-base text-carbon-600">{plural(group.levels.length, 'tamaño', 'tamaños')}</p>
            </div>
          </div>
          <ul className={listSurface}>
            {group.levels.map((level) => (
              <VariantRow
                key={level.variantId}
                level={level}
                open={openId === level.variantId}
                onToggle={() => setOpenId(openId === level.variantId ? null : level.variantId)}
                onDone={onDone}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
