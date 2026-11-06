import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { ConversationListItem, DashboardResponse, ListResponse, OrderListItem } from '../../../shared/api/panel-contracts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useStaffSession } from '../auth/auth-context'
import { NavIcon } from './nav-icons'
import { formatMoney, needsPayment, plural } from './panel-logic'
import { firstName, greeting, pendingPhrase, todayLabel, todayTasks, type TodayTask } from './today-logic'
import { useAdminQuery } from './use-admin-api'
import { GrowthRings, listRow, listSurface, QueryView } from './ui'

const taskTone = {
  alert: 'bg-alerta-claro text-alerta',
  warn: 'bg-aviso-claro text-aviso',
} as const

/** Una tarea: toda la fila se toca y lleva a la pantalla donde se resuelve. */
function TaskRow({ task }: { task: TodayTask }) {
  return (
    <li>
      <Link to={task.to} className={`${listRow} grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-5 py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-5 sm:px-7`}>
        <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${taskTone[task.tone]}`}>
          <NavIcon slug={task.icon} className="size-6" />
        </span>
        <span className="grid min-w-0 gap-0.5">
          {task.tone === 'alert' && <span className="text-sm font-bold text-alerta">Urgente</span>}
          <span className="text-xl leading-snug font-bold text-carbon">{task.title}</span>
          <span className="text-base text-carbon-600">{task.detail}</span>
        </span>
        <span
          className={`col-span-2 inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-base font-bold whitespace-nowrap sm:col-span-1 ${
            task.tone === 'alert' ? 'bg-nogal text-marfil' : 'border-2 border-linea text-nogal'
          }`}
        >
          {task.action}
        </span>
      </Link>
    </li>
  )
}

const CheckIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.7 2.7L16 9.8" />
  </svg>
)

function Today({ data, header }: { data: DashboardResponse; header: (pending: string | null) => ReactNode }) {
  const count = <T,>(state: { status: string; data?: ListResponse<T> }, keep: (item: T) => boolean = () => true) =>
    state.status === 'ok' && state.data ? state.data.items.filter(keep).length : null
  const { state: waiting } = useAdminQuery<ListResponse<ConversationListItem>>('/conversations?status=needs_human')
  const { state: orders } = useAdminQuery<ListResponse<OrderListItem>>('/orders')

  const { tasks, calm } = todayTasks({
    lowStock: data.lowStock.length,
    quotesPending: data.quotesPending,
    ordersToConfirm: data.ordersByStatus.pending_confirmation ?? 0,
    ordersToCollect: count(orders, needsPayment),
    conversationsWaiting: count(waiting),
  })
  const inWorkshop = data.ordersByStatus.in_production ?? 0

  return (
    // min-w-0 en cada bloque: en el celular nada empuja el ancho de la página.
    <div className="grid gap-12 [&>*]:min-w-0">
      {header(pendingPhrase(tasks.length))}

      <section aria-labelledby="por-hacer" className="grid gap-4">
        <h2 id="por-hacer" className="text-3xl">
          Por hacer
        </h2>
        {tasks.length === 0 ? (
          <p className="flex items-center gap-3 rounded-3xl bg-exito-claro px-6 py-7 text-xl font-bold text-exito">
            <CheckIcon />
            Todo al día. No hay nada pendiente por ahora.
          </p>
        ) : (
          <ul className={listSurface}>
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}
      </section>

      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-8 [&>*]:min-w-0">
        <section aria-labelledby="mes" className="grid gap-4">
          <h2 id="mes" className="text-3xl">
            Cómo va el mes
          </h2>
          <div className="grid gap-5 rounded-3xl bg-beige px-6 py-6 sm:px-7">
            <div className="grid gap-0.5">
              <p className="text-lg text-carbon-600">Vendido en los últimos 30 días</p>
              <p className="font-display text-4xl leading-tight text-nogal sm:text-5xl">{formatMoney(data.confirmedSales30d.total)}</p>
              <p className="text-lg text-carbon-600">{plural(data.confirmedSales30d.count, 'pedido confirmado', 'pedidos confirmados')}</p>
            </div>
            <div className="h-px bg-arena" />
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-lg">Pedidos en el taller ahora</p>
              <p className="font-display text-4xl text-nogal">{inWorkshop}</p>
            </div>
            <Link to="/reportes" className="justify-self-start text-lg font-bold text-madera-700 underline underline-offset-4">
              Ver los reportes
            </Link>
          </div>
        </section>

        {calm.length > 0 && (
          <section aria-labelledby="en-orden" className="grid gap-4">
            <h2 id="en-orden" className="text-3xl">
              Todo en orden
            </h2>
            <ul className="grid gap-3.5">
              {calm.map((label) => (
                <li key={label} className="flex items-center gap-3 text-lg font-semibold text-exito">
                  <CheckIcon />
                  {label}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

export function AdminOverviewPage() {
  useDocumentTitle('Hoy · Panel')
  const { staff } = useStaffSession()
  const { state, reload } = useAdminQuery<DashboardResponse>('/dashboard')
  // La fecha se fija al abrir la pantalla: el saludo no cambia mientras se trabaja.
  const [now] = useState(() => new Date())
  const name = firstName(staff.fullName)

  /** La cabecera de nogal con los anillos de la teca: saludo, día y cuánto hay por hacer. */
  const header = (pending: string | null) => (
    <header className="relative overflow-hidden rounded-3xl bg-nogal px-6 py-8 text-beige sm:px-10 sm:py-10">
      <GrowthRings className="absolute -top-20 -right-48 w-[34rem] text-madera sm:-right-24" />
      <div className="relative grid max-w-2xl gap-5">
        <div className="grid gap-1">
          <h1 className="text-4xl leading-tight text-marfil sm:text-5xl">
            {greeting(now)}
            {name && `, ${name}`}
          </h1>
          <p className="text-lg text-arena">{todayLabel(now)}</p>
        </div>
        <p className="text-xl">
          {pending ? (
            <>
              Hoy hay <strong className="text-marfil">{pending}</strong>.
            </>
          ) : (
            'Hoy no hay nada pendiente.'
          )}
        </p>
        <div className="grid gap-3 sm:flex sm:flex-wrap">
          <Link to="/pedidos/nueva" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-marfil px-7 text-lg font-extrabold text-nogal transition-colors hover:bg-beige">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nueva venta
          </Link>
          <Link to="/produccion" className="inline-flex min-h-14 items-center justify-center rounded-full border-2 border-marfil/35 px-7 text-lg font-bold text-marfil transition-colors hover:border-marfil">
            Registrar producción
          </Link>
        </div>
      </div>
    </header>
  )

  return (
    <div className="mx-auto max-w-5xl">
      <QueryView state={state} onRetry={reload}>
        {(data) => <Today data={data} header={header} />}
      </QueryView>
    </div>
  )
}
