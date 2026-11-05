import type { ReactNode } from 'react'
import { GrowthRings } from '../../components/ui/GrowthRings'
import { Wordmark } from '../../components/ui/Wordmark'

interface AuthNoticeProps {
  title: string
  children?: ReactNode
  actions?: ReactNode
}

/**
 * Marco del inicio de sesión y de los estados de acceso al panel: en la laptop, una franja de nogal con los anillos
 * de la teca a la izquierda y el contenido a la derecha; en el celular, la franja queda arriba y más baja.
 */
export function AuthNotice({ title, children, actions }: AuthNoticeProps) {
  return (
    <div className="min-h-dvh bg-marfil lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* En la laptop la franja ocupa siempre el alto de la pantalla; los anillos quedan en la esquina, lejos del texto. */}
      <aside className="relative overflow-hidden bg-nogal px-6 py-7 text-beige sm:px-10 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <GrowthRings className="absolute -top-24 -right-44 w-[30rem] text-madera lg:-top-64 lg:-right-80 lg:w-[56rem]" strength={0.8} />
        <div className="relative">
          <Wordmark to="/" tone="light" suffix="Panel" />
        </div>
        <div className="relative hidden max-w-sm gap-4 lg:grid">
          <span aria-hidden="true" className="h-1 w-12 rounded-full bg-madera" />
          <p className="font-display text-4xl leading-[1.15] text-marfil xl:text-[2.75rem]">Pedidos, cotizaciones, taller y stock en un solo lugar.</p>
          <p className="text-lg text-arena">Solo para el equipo de Woodland.</p>
        </div>
      </aside>

      <main className="flex justify-center px-5 py-10 sm:px-10 sm:py-14 lg:items-center lg:py-8">
        <section className="w-full max-w-[28rem]">
          <h1 className="text-4xl leading-tight">{title}</h1>
          {children && <div className="mt-4 text-lg leading-relaxed text-carbon-600">{children}</div>}
          {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
        </section>
      </main>
    </div>
  )
}

export const primaryButtonClass =
  'inline-flex min-h-12 items-center justify-center rounded-full bg-nogal px-7 text-base font-bold text-marfil transition-colors hover:bg-nogal-800 disabled:cursor-not-allowed disabled:opacity-60'

export const secondaryButtonClass =
  'inline-flex min-h-12 items-center justify-center rounded-full border-2 border-linea px-7 text-base font-bold text-nogal transition-colors hover:border-nogal'
