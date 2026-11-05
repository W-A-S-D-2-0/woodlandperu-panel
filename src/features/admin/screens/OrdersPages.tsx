import { useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import type { ListResponse, OrderDetail, OrderListItem } from '../../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useStaffSession } from '../../auth/auth-context'
import {
  channelLabels,
  formatDateTime,
  formatMoney,
  matchesOrderFilter,
  orderActions,
  orderFilters,
  orderNextStep,
  orderPaymentBadge,
  orderStatusLabels,
  orderSteps,
  orderTone,
  parseOrderFilter,
  whatsappLink,
  type OrderFilter,
} from '../panel-logic'
import { modelSlugForLine } from '../item-photo-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import {
  BackLink,
  Badge,
  Card,
  dangerButton,
  EmptyState,
  Field,
  inputClass,
  listRow,
  listSurface,
  ModelThumb,
  NextStep,
  Notice,
  PageHeader,
  primaryButtonLarge,
  QueryView,
  secondaryButton,
  secondaryButtonLarge,
  Segmented,
  StepLine,
} from '../ui'

const customerName = (order: Pick<OrderListItem, 'customer'>) => order.customer?.companyName ?? order.customer?.fullName ?? null

/** Columnas de la lista en pantallas anchas: cliente, estado, pago y total. */
const orderColumns = 'sm:grid-cols-[minmax(0,1fr)_11rem_9.5rem_8.5rem]'

function OrderRow({ order, showPayment }: { order: OrderListItem; showPayment: boolean }) {
  const pay = orderPaymentBadge(order)
  return (
    <li>
      <Link to={`/pedidos/${order.id}`} className={`${listRow} grid gap-3 px-5 py-4 sm:items-center sm:gap-5 sm:px-7 ${orderColumns}`}>
        <span className="grid min-w-0">
          <span className="truncate text-xl font-bold text-carbon">{customerName(order) ?? order.code}</span>
          <span className="flex flex-wrap gap-x-3 text-base text-carbon-600">
            {customerName(order) && <span>{order.code}</span>}
            <span>{formatDateTime(order.createdAt)}</span>
          </span>
        </span>
        <span className="flex flex-wrap gap-2 sm:contents">
          <span>
            <Badge tone={orderTone(order.status)}>{orderStatusLabels[order.status]}</Badge>
          </span>
          {showPayment ? (
            <span>
              <Badge tone={pay.tone}>{pay.label}</Badge>
            </span>
          ) : (
            <span className="hidden sm:block" />
          )}
        </span>
        <span className="text-xl font-extrabold text-carbon sm:text-right">{formatMoney(order.total)}</span>
      </Link>
    </li>
  )
}

function OrderList({ items, filter, isAdmin }: { items: OrderListItem[]; filter: OrderFilter; isAdmin: boolean }) {
  const [, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  // El taller no ve pagos: no tiene sentido ofrecerle «Por cobrar».
  const filters = isAdmin ? orderFilters : orderFilters.filter((f) => f.id !== 'cobrar')
  const active = filters.find((f) => f.id === filter) ?? filters[0]
  const term = search.trim().toLowerCase()
  const visible = items.filter(
    (o) => matchesOrderFilter(o, active?.id ?? 'todos') && (!term || `${o.code} ${customerName(o) ?? ''}`.toLowerCase().includes(term)),
  )

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Segmented
          label="Ver pedidos"
          options={filters.map((f) => ({ id: f.id, label: f.label, count: items.filter((o) => matchesOrderFilter(o, f.id)).length }))}
          value={active?.id ?? 'todos'}
          onChange={(id) => setParams(id === 'todos' ? {} : { ver: id })}
        />
        <label className="w-full sm:w-80">
          <span className="sr-only">Buscar pedido</span>
          <input type="search" className={inputClass} placeholder="Cliente o código" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
      <p className="text-lg text-carbon-600">{active?.hint}</p>

      {visible.length === 0 ? (
        <EmptyState>{term ? 'Ningún pedido coincide con la búsqueda.' : 'No hay pedidos aquí. ¡Todo al día!'}</EmptyState>
      ) : (
        <ul className={listSurface}>
          <li aria-hidden="true" className={`hidden gap-5 bg-marfil px-7 py-3 text-sm font-bold text-carbon-600 sm:grid ${orderColumns}`}>
            <span>Cliente</span>
            <span>Estado</span>
            <span>{isAdmin ? 'Pago' : ''}</span>
            <span className="text-right">Total</span>
          </li>
          {visible.map((o) => (
            <OrderRow key={o.id} order={o} showPayment={isAdmin} />
          ))}
        </ul>
      )}
    </div>
  )
}

export function OrdersPage() {
  useDocumentTitle('Pedidos')
  const { staff } = useStaffSession()
  const [params] = useSearchParams()
  const filter = parseOrderFilter(params.get('ver'))
  const { state, reload } = useAdminQuery<ListResponse<OrderListItem>>('/orders')
  const isAdmin = staff.role === 'admin'

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <PageHeader
        title="Pedidos"
        actions={
          isAdmin ? (
            <Link to="/pedidos/nueva" className={primaryButtonLarge}>
              <span aria-hidden="true">+</span> Nueva venta
            </Link>
          ) : undefined
        }
      />
      <QueryView state={state} onRetry={reload}>
        {({ items }) => <OrderList items={items} filter={filter} isAdmin={isAdmin} />}
      </QueryView>
    </div>
  )
}

/** Línea de pasos del pedido y el botón para avanzar al siguiente. */
function OrderProgress({ order, reload, canAct }: { order: OrderDetail; reload: () => void; canAct: boolean }) {
  const { run, pending, error } = useAdminAction()
  const [confirmed, setConfirmed] = useState(order.customerConfirmedAt !== null)
  const steps = orderSteps(order.status)
  const next = orderNextStep(order.status)
  const actions = canAct ? orderActions(order.status).filter((a) => a.kind !== 'cancel') : []

  const exec = async (path: string, body: unknown) => {
    if (await run('POST', `/orders/${order.id}${path}`, body)) reload()
  }

  return (
    <section aria-label="Avance del pedido" className="grid gap-6 rounded-2xl border border-linea bg-white p-5 sm:p-7">
      <StepLine steps={steps} />

      <NextStep label={order.status === 'delivered' || order.status === 'cancelled' ? 'Estado' : 'Siguiente paso'} title={next.title} help={next.help}>
        {actions.length > 0 && (
          <div className="grid gap-3">
            {actions.some((a) => a.kind === 'confirm') && (
              <label className="flex min-h-12 items-center gap-3 text-lg">
                <input type="checkbox" className="size-6 accent-nogal" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                El cliente confirmó el pedido
              </label>
            )}
            <div className="flex flex-wrap gap-3">
              {actions.map((a, index) => {
                const big = index === 0 ? primaryButtonLarge : secondaryButtonLarge
                if (a.kind === 'confirm') {
                  return (
                    <button key="confirm" type="button" className={big} disabled={pending || !confirmed} onClick={() => void exec('/confirm', { customerConfirmed: confirmed })}>
                      Confirmar y apartar tablas
                    </button>
                  )
                }
                if (a.kind === 'status') {
                  return (
                    <button key={a.status} type="button" className={big} disabled={pending} onClick={() => void exec('/status', { status: a.status })}>
                      {a.status === 'in_production' ? 'Pasar al taller' : a.label}
                    </button>
                  )
                }
                if (a.kind === 'dispatch') {
                  return (
                    <button key={a.finalStatus} type="button" className={big} disabled={pending} onClick={() => void exec('/dispatch', { finalStatus: a.finalStatus })}>
                      {a.label}
                    </button>
                  )
                }
                return null
              })}
            </div>
          </div>
        )}
      </NextStep>
      {error && <Notice>{error}</Notice>}
    </section>
  )
}

function OrderPayment({ order }: { order: OrderDetail }) {
  const paid = order.paymentStatus === 'paid'
  const pay = orderPaymentBadge(order)
  return (
    <section
      aria-labelledby="pago"
      className={`grid gap-3 rounded-2xl p-6 ${paid ? 'border border-exito/30 bg-exito-claro' : pay.tone === 'muted' ? 'border border-linea bg-white' : 'border-2 border-madera/40 bg-aviso-claro'}`}
    >
      <h2 id="pago" className="text-2xl">
        Pago
      </h2>
      <p className={`text-xl font-bold ${paid ? 'text-exito' : pay.tone === 'alert' ? 'text-alerta' : pay.tone === 'warn' ? 'text-aviso' : 'text-carbon-600'}`}>
        {paid ? `Pagado: ${formatMoney(order.total)}` : pay.tone === 'muted' ? pay.label : 'Falta confirmar el pago'}
      </p>
      {!paid && pay.tone !== 'muted' && (
        <p className="text-lg text-carbon-600">El cliente debe pagar {formatMoney(order.total)} por Yape. Revisa tu app antes de enviar el pedido.</p>
      )}
      {order.payments.map((p) => (
        <p key={p.id} className="text-base text-carbon">
          Yape de {formatMoney(p.amount)}, {formatDateTime(p.createdAt)}
          {p.proofUrl && (
            <>
              {' '}
              <a href={p.proofUrl} target="_blank" rel="noreferrer" className="font-bold text-madera-700 underline">
                Ver captura
              </a>
            </>
          )}
        </p>
      ))}
    </section>
  )
}

function OrderCustomer({ order }: { order: OrderDetail }) {
  const customer = order.customer
  const wa = whatsappLink(customer?.phone)
  return (
    <Card title="Cliente">
      {customer ? (
        <div className="grid gap-2 text-lg">
          <Link to={`/clientes/${customer.id}`} className="text-xl font-bold text-nogal hover:underline">
            {customer.companyName ?? customer.fullName}
          </Link>
          {customer.phone && <p className="text-carbon-600">Celular: {customer.phone}</p>}
          {customer.email && <p className="break-all text-carbon-600">{customer.email}</p>}
          {order.shippingAddress && <p className="text-carbon-600">Entregar en: {order.shippingAddress}</p>}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className={`${secondaryButton} mt-2`}>
              Escribir por WhatsApp
            </a>
          )}
        </div>
      ) : (
        <p className="text-lg text-carbon-600">Los datos del cliente solo los ve administración.</p>
      )}
    </Card>
  )
}

function OrderItems({ order }: { order: OrderDetail }) {
  return (
    <Card title="Qué pidió">
      <ul className="grid gap-4">
        {order.items.map((item) => (
          <li key={item.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 border-b border-linea pb-4 last:border-0 last:pb-0">
            {/* La foto ayuda a reconocer la tabla de un vistazo, sobre todo en el taller. */}
            <ModelThumb slug={modelSlugForLine(item) ?? ''} className="size-16 sm:size-20" />
            <div className="grid min-w-0 gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-xl leading-snug font-bold">
                  {item.quantity} × {item.description}
                </p>
                <p className="text-lg font-bold tabular-nums">{formatMoney(item.lineTotal)}</p>
              </div>
              <p className="text-base text-carbon-600">
                {formatMoney(item.unitPrice)} cada una{item.fulfillmentType === 'made_to_order' ? ', se fabrica a pedido' : ''}
                {item.customDimensions ? `. Medidas: ${item.customDimensions}` : ''}
              </p>
              {item.customization && (
                <p className="mt-1 justify-self-start rounded-xl bg-aviso-claro px-3 py-1.5 text-base font-semibold text-aviso">Grabado: {item.customization}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <dl className="mt-5 grid gap-1 border-t border-linea pt-4 text-lg">
        {(order.discountTotal > 0 || order.shippingTotal > 0) && (
          <div className="flex justify-between text-carbon-600">
            <dt>Subtotal</dt>
            <dd>{formatMoney(order.subtotal)}</dd>
          </div>
        )}
        {order.discountTotal > 0 && (
          <div className="flex justify-between text-carbon-600">
            <dt>Descuento</dt>
            <dd>− {formatMoney(order.discountTotal)}</dd>
          </div>
        )}
        {order.shippingTotal > 0 && (
          <div className="flex justify-between text-carbon-600">
            <dt>Envío</dt>
            <dd>{formatMoney(order.shippingTotal)}</dd>
          </div>
        )}
        <div className="flex justify-between text-xl font-bold">
          <dt>Total</dt>
          <dd>{formatMoney(order.total)}</dd>
        </div>
      </dl>
    </Card>
  )
}

function OrderNotes({ order, reload }: { order: OrderDetail; reload: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [notes, setNotes] = useState(order.internalNotes ?? '')
  const [address, setAddress] = useState(order.shippingAddress ?? '')

  async function save(event: FormEvent) {
    event.preventDefault()
    const result = await run('PATCH', `/orders/${order.id}`, { internalNotes: notes.trim(), shippingAddress: address.trim() })
    if (result) reload()
  }

  return (
    <Card title="Entrega y notas del equipo">
      <form onSubmit={(e) => void save(e)} className="grid gap-4">
        <Field label="Dirección de entrega">
          <input className={inputClass} maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Notas del equipo" hint="Solo las ve el equipo, nunca el cliente.">
          <textarea className={`${inputClass} py-3`} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <Notice>{error}</Notice>}
        <div>
          <button type="submit" className={secondaryButton} disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Card>
  )
}

/** Cancelar va aparte y abajo, con motivo obligatorio: no se toca por error junto a las acciones normales. */
function CancelOrder({ order, reload }: { order: OrderDetail; reload: () => void }) {
  const { run, pending, error } = useAdminAction()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (!orderActions(order.status).some((a) => a.kind === 'cancel')) return null

  async function cancel(event: FormEvent) {
    event.preventDefault()
    if (!reason.trim()) return setFormError('Escribe por qué se cancela el pedido.')
    setFormError(null)
    if (await run('POST', `/orders/${order.id}/cancel`, { reason: reason.trim() })) reload()
  }

  return (
    <section aria-labelledby="cancelar" className="grid gap-4 rounded-2xl border-2 border-dashed border-alerta/30 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="cancelar" className="font-sans text-xl font-bold text-alerta">
            ¿El cliente ya no lo quiere?
          </h2>
          <p className="text-lg text-carbon-600">Cancelar devuelve al stock las tablas apartadas.</p>
        </div>
        <button type="button" className={dangerButton} onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'No cancelar' : 'Cancelar pedido'}
        </button>
      </div>
      {open && (
        <form onSubmit={(e) => void cancel(e)} className="grid gap-3" noValidate>
          <Field label="Motivo de la cancelación">
            <input className={inputClass} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div>
            <button type="submit" className={dangerButton} disabled={pending}>
              Sí, cancelar el pedido
            </button>
          </div>
        </form>
      )}
      {(formError ?? error) && <Notice>{formError ?? error}</Notice>}
    </section>
  )
}

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const { staff } = useStaffSession()
  const { state, reload } = useAdminQuery<OrderDetail>(`/orders/${id}`)
  useDocumentTitle(state.status === 'ok' ? state.data.code : 'Pedido')
  const isAdmin = staff.role === 'admin'

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink to="/pedidos">Volver a pedidos</BackLink>
      <QueryView state={state} onRetry={reload}>
        {(order) => (
          <div className="mt-2 grid gap-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div className="grid gap-1">
                <h1 className="text-4xl">{customerName(order) ?? order.code}</h1>
                <p className="text-lg text-carbon-600">
                  {customerName(order) ? `Pedido ${order.code}, ` : ''}
                  {(channelLabels[order.channel] ?? order.channel).toLowerCase()}, {formatDateTime(order.createdAt)}
                </p>
              </div>
              <p className="font-display text-4xl text-nogal">{formatMoney(order.total)}</p>
            </header>

            {order.status === 'cancelled' ? (
              <Notice kind="info">
                Este pedido está cancelado.{order.cancelReason ? ` Motivo: ${order.cancelReason}` : ''}
              </Notice>
            ) : (
              <OrderProgress order={order} reload={reload} canAct={isAdmin} />
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
              <OrderItems order={order} />
              <div className="grid gap-6">
                {isAdmin && <OrderPayment order={order} />}
                <OrderCustomer order={order} />
                {order.deliveryEstimateNote && (
                  <Card title="Plazo estimado">
                    <p className="text-lg">{order.deliveryEstimateNote}</p>
                  </Card>
                )}
                {order.quoteId && isAdmin && (
                  <Link to={`/cotizaciones/${order.quoteId}`} className="text-lg font-bold text-madera-700 hover:underline">
                    Ver la cotización de este pedido
                  </Link>
                )}
              </div>
            </div>

            {isAdmin && (
              <>
                <OrderNotes key={`${order.internalNotes}-${order.shippingAddress}`} order={order} reload={reload} />
                <CancelOrder order={order} reload={reload} />
              </>
            )}
          </div>
        )}
      </QueryView>
    </div>
  )
}
