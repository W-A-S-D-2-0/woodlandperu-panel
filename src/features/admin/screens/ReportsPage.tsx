import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { ReportExportResponse, ReportPayload, ReportStockRow, SalesChannel } from '../../../../shared/api/panel-contracts'
import { orderStatuses, quoteStatuses } from '../../../../shared/api/panel-schemas'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { channelLabels, formatDate, formatMoney, orderStatusLabels, plural, quoteStatusLabels } from '../panel-logic'
import {
  activePreset,
  barRows,
  formatPercent,
  presetRange,
  rangeFromParams,
  reportFileName,
  reportPresets,
  reportSheetRows,
  reportSheets,
  toCsv,
  type BarRow,
  type DateRange,
  type ReportPreset,
  type ReportSheet,
} from '../report-logic'
import { useAdminAction, useAdminQuery } from '../use-admin-api'
import { Badge, Field, GrowthRings, inputClass, listSurface, Notice, PageHeader, primaryButton, QueryView, secondaryButton, Segmented } from '../ui'

const channelOrder: SalesChannel[] = ['web', 'web_chat', 'whatsapp', 'admin']

/** Descarga un CSV. El BOM hace que tildes y "ñ" se lean bien al abrirlo o importarlo. */
function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

/** Barra horizontal de un solo color. La cifra va escrita al lado: la barra solo ayuda a comparar de un vistazo. */
function Bar({ share }: { share: number }) {
  return (
    <div aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-beige">
      <div className="h-full rounded-full bg-madera" style={{ width: `${Math.max(share * 100, 3)}%` }} />
    </div>
  )
}

function BarList({ rows, empty }: { rows: BarRow[]; empty: string }) {
  if (rows.length === 0) return <p className="text-lg text-carbon-600">{empty}</p>
  return (
    <ul className="grid gap-4">
      {rows.map((row) => (
        <li key={row.label} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-4 text-lg">
            <span className="min-w-0">{row.label}</span>
            <strong className="shrink-0 tabular-nums">{row.value}</strong>
          </div>
          <Bar share={row.share} />
        </li>
      ))}
    </ul>
  )
}

/** Bloque blanco con título, para las listas de barras y de stock. */
function Panel({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="grid content-start gap-5 rounded-3xl border border-linea bg-white p-6 sm:p-7">
      <div className="grid gap-1">
        <h3 className="text-2xl">{title}</h3>
        {intro && <p className="text-base text-carbon-600">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

function StockList({ rows, empty, tone, badge }: { rows: ReportStockRow[]; empty: string; tone: 'alert' | 'warn'; badge: string }) {
  if (rows.length === 0) return <p className="text-lg text-carbon-600">{empty}</p>
  return (
    <ul className="grid gap-3">
      {rows.map((row) => (
        <li key={row.sku} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span className="min-w-0 text-lg">
            {row.product} {row.variant}
          </span>
          <span className="flex items-center gap-2">
            <Badge tone={tone}>{badge}</Badge>
            <span className="text-base text-carbon-600 tabular-nums">
              {plural(row.available, 'libre', 'libres')}
              {row.minStock !== null && ` · mínimo ${row.minStock}`}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

const Chevron = ({ className = 'size-5' }: { className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 6 6 6-6 6" />
  </svg>
)

/**
 * Una cifra del embudo de ventas: toda la casilla lleva a la pantalla con el detalle.
 * En el celular es una fila (texto a la izquierda, número a la derecha); desde tablet, una columna.
 */
function Figure({ label, value, hint, to }: { label: string; value: number; hint: string; to: string }) {
  return (
    <Link
      to={to}
      className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-5 py-4 transition-colors hover:bg-marfil sm:grid-cols-1 sm:content-start sm:items-start sm:gap-1 sm:px-7 sm:py-6"
    >
      {/* sm:contents: desde tablet, etiqueta y nota pasan a ser filas de la columna, ordenadas con el número en medio. */}
      <span className="grid min-w-0 gap-0.5 sm:contents">
        <span className="text-base font-semibold text-carbon-600">{label}</span>
        <span className="text-base text-carbon-600 sm:order-1">{hint}</span>
      </span>
      <span className="font-display text-4xl leading-tight text-nogal tabular-nums sm:text-5xl">{value}</span>
      <span className="inline-flex items-center gap-1 text-base font-bold text-madera-700 group-hover:underline sm:order-2 sm:mt-2">
        <span className="hidden sm:inline">Ver detalle</span>
        <Chevron className="size-5 sm:size-4" />
      </span>
    </Link>
  )
}

function ExportCard({ report }: { report: ReportPayload }) {
  const download = (sheet: ReportSheet) => downloadCsv(reportFileName(report, sheet), toCsv(reportSheetRows(report, sheet)))
  const { run, pending, error, clearError } = useAdminAction()
  const [sent, setSent] = useState<ReportExportResponse | null>(null)

  async function sendToSheets() {
    clearError()
    setSent(null)
    const result = await run<ReportExportResponse>('POST', `/reports/export?from=${report.range.from}&to=${report.range.to}`)
    if (result) setSent(result)
  }

  return (
    <section aria-labelledby="exportar" className="grid gap-4 rounded-3xl bg-beige px-6 py-7 sm:px-8">
      <h2 id="exportar" className="text-3xl">
        Llevar a Excel o Google Sheets
      </h2>
      <p className="max-w-3xl text-lg text-carbon-600">
        {report.canExport ? (
          <>
            «Enviar a Google Sheets» vacía y reescribe las hojas Resumen, Cotizaciones y Pedidos de la hoja de cálculo de Woodland con este
            rango. También puedes descargar cada hoja en CSV.
          </>
        ) : (
          <>
            Descarga cada hoja en CSV y súbela en Google Sheets con <strong className="text-carbon">Archivo › Importar › Subir</strong>. Para
            tenerlas juntas, impórtalas en el mismo archivo con «Insertar hojas nuevas».
          </>
        )}{' '}
        La exportación es de una sola vía: lo que cambies en Sheets no vuelve al panel.
      </p>
      {error && <Notice>{error}</Notice>}
      {sent && (
        <Notice kind="info">
          Reporte enviado.{' '}
          <a className="font-semibold underline" href={sent.spreadsheetUrl} target="_blank" rel="noreferrer">
            Abrir la hoja de cálculo
          </a>
        </Notice>
      )}
      <div className="flex flex-wrap gap-3">
        {report.canExport && (
          <button type="button" className={primaryButton} disabled={pending} onClick={() => void sendToSheets()}>
            {pending ? 'Enviando…' : 'Enviar a Google Sheets'}
          </button>
        )}
        {reportSheets.map((sheet) => (
          <button key={sheet.key} type="button" className={`${secondaryButton} bg-white`} onClick={() => download(sheet.key)}>
            Descargar {sheet.label.toLowerCase()}
          </button>
        ))}
      </div>
    </section>
  )
}

function Report({ report }: { report: ReportPayload }) {
  const { inquiries, quotes, orders, sales } = report
  const topMax = Math.max(0, ...report.topProducts.map((p) => p.total))

  return (
    // min-w-0 en cada bloque: en el celular nada empuja el ancho de la página.
    <div className="grid gap-12 [&>*]:min-w-0">
      {report.truncated && (
        <Notice>El rango tiene demasiados registros y las cifras pueden quedar cortas. Elige un rango más corto.</Notice>
      )}

      <section aria-label="Lo vendido" className="relative overflow-hidden rounded-3xl bg-nogal px-6 py-8 text-beige sm:px-10 sm:py-10">
        <GrowthRings className="absolute -top-20 -right-48 w-[34rem] text-madera sm:-right-24" />
        <div className="relative grid gap-7">
          <div className="grid gap-1">
            <p className="text-lg text-arena">
              Vendido del {formatDate(report.range.from)} al {formatDate(report.range.to)}
            </p>
            <p className="font-display text-4xl leading-tight break-words text-marfil tabular-nums min-[25rem]:text-5xl sm:text-6xl">{formatMoney(sales.total)}</p>
          </div>
          <dl className="grid gap-5 sm:flex sm:gap-12">
            <div className="grid gap-0.5">
              <dt className="text-base text-arena">Pedidos confirmados</dt>
              <dd className="font-display text-3xl text-marfil tabular-nums">{sales.count}</dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-base text-arena">Venta promedio</dt>
              <dd className="font-display text-3xl text-marfil tabular-nums">{formatMoney(sales.averageTicket)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="de-la-consulta" className="grid gap-4">
        <h2 id="de-la-consulta" className="text-3xl">
          De la consulta a la venta
        </h2>
        <div className={`${listSurface} grid sm:grid-cols-3 sm:divide-x sm:divide-y-0`}>
          <Figure
            label="Personas que escribieron"
            value={inquiries.conversations}
            hint={`${inquiries.handedOff} necesitaron al equipo`}
            to="/conversaciones?estado=todas"
          />
          <Figure
            label="Cotizaciones"
            value={quotes.total}
            hint={`${plural(quotes.converted, 'se volvió pedido', 'se volvieron pedido')} (${formatPercent(quotes.conversionRate)})`}
            to="/cotizaciones?ver=todas"
          />
          <Figure label="Pedidos" value={orders.total} hint={plural(sales.count, 'confirmado', 'confirmados')} to="/pedidos" />
        </div>
      </section>

      <section aria-labelledby="mas-vendido" className="grid gap-4">
        <h2 id="mas-vendido" className="text-3xl">
          Lo más vendido
        </h2>
        {report.topProducts.length === 0 ? (
          <p className="rounded-3xl bg-beige px-6 py-6 text-lg text-carbon-600">Aún no hay ventas confirmadas en estos días.</p>
        ) : (
          <ol className={listSurface}>
            {report.topProducts.map((p, i) => (
              <li key={p.description} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-5 py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:gap-y-3 sm:px-7">
                <span className="font-display text-3xl text-madera-700">{i + 1}</span>
                <span className="grid min-w-0">
                  <span className="text-xl leading-snug font-bold">{p.description}</span>
                  <span className="text-base text-carbon-600">{plural(p.quantity, 'tabla')}</span>
                </span>
                <span className="col-start-2 text-xl font-bold tabular-nums sm:col-start-auto">{formatMoney(p.total)}</span>
                <span className="col-start-2 sm:col-end-4">
                  <Bar share={topMax > 0 ? p.total / topMax : 0} />
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="por-canal" className="grid gap-4">
        <h2 id="por-canal" className="text-3xl">
          Por dónde llegan
        </h2>
        <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
          <Panel title="Pedidos">
            <BarList rows={barRows(channelOrder.map((c) => [channelLabels[c] ?? c, orders.byChannel[c] ?? 0]), true)} empty="Sin pedidos en estos días." />
          </Panel>
          <Panel title="Cotizaciones">
            <BarList rows={barRows(channelOrder.map((c) => [channelLabels[c] ?? c, quotes.byChannel[c] ?? 0]), true)} empty="Sin cotizaciones en estos días." />
          </Panel>
        </div>
      </section>

      <details className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border-2 border-linea bg-white px-6 text-xl font-bold text-nogal transition-colors hover:border-nogal [&::-webkit-details-marker]:hidden">
          Ver más detalles: estados y stock
          <Chevron className="size-6 transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-5 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
          <Panel title="Pedidos por estado">
            <BarList rows={barRows(orderStatuses.map((s) => [orderStatusLabels[s], orders.byStatus[s] ?? 0]))} empty="Sin pedidos en estos días." />
          </Panel>
          <Panel title="Cotizaciones por estado">
            <BarList rows={barRows(quoteStatuses.map((s) => [quoteStatusLabels[s], quotes.byStatus[s] ?? 0]))} empty="Sin cotizaciones en estos días." />
          </Panel>
          <Panel title="Sin stock" intro="Cómo está hoy, sin importar las fechas elegidas.">
            <StockList rows={report.outOfStock} tone="alert" badge="Sin stock" empty="Todas las tablas tienen unidades libres." />
          </Panel>
          <Panel title="Bajo el mínimo" intro="Cómo está hoy, sin importar las fechas elegidas.">
            <StockList rows={report.lowStock} tone="warn" badge="Bajo el mínimo" empty="Ninguna tabla está en su mínimo." />
          </Panel>
        </div>
      </details>

      <ExportCard report={report} />
    </div>
  )
}

type RangeChoice = ReportPreset | 'otras'

function RangePicker({ range, onChange }: { range: DateRange; onChange: (range: DateRange) => void }) {
  const preset = activePreset(range)
  const [custom, setCustom] = useState(preset === null)
  const value: RangeChoice = custom || preset === null ? 'otras' : preset
  const options = [...reportPresets.map((p) => ({ id: p.key as RangeChoice, label: p.label })), { id: 'otras' as RangeChoice, label: 'Otras fechas' }]

  return (
    <div className="grid gap-4">
      <Segmented
        label="Días del reporte"
        wrap
        options={options}
        value={value}
        onChange={(id) => {
          if (id === 'otras') return setCustom(true)
          setCustom(false)
          onChange(presetRange(id))
        }}
      />
      {value === 'otras' && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <Field label="Desde">
              <input
                type="date"
                className={inputClass}
                value={range.from}
                max={range.to}
                onChange={(e) => e.target.value && onChange({ from: e.target.value, to: range.to })}
              />
            </Field>
          </div>
          <div className="w-48">
            <Field label="Hasta">
              <input
                type="date"
                className={inputClass}
                value={range.to}
                min={range.from}
                onChange={(e) => e.target.value && onChange({ from: range.from, to: e.target.value })}
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  )
}

export function ReportsPage() {
  useDocumentTitle('Reportes')
  const [params, setParams] = useSearchParams()
  const range = rangeFromParams(params)
  const { state, reload } = useAdminQuery<ReportPayload>(`/reports?from=${range.from}&to=${range.to}`)

  return (
    <div className="mx-auto grid max-w-5xl gap-8 [&>*]:min-w-0">
      <PageHeader title="Reportes" intro="Cómo van las ventas en los días que elijas." />
      <RangePicker range={range} onChange={(next) => setParams({ desde: next.from, hasta: next.to }, { replace: true })} />
      <QueryView state={state} onRetry={reload}>
        {(report) => <Report report={report} />}
      </QueryView>
    </div>
  )
}
