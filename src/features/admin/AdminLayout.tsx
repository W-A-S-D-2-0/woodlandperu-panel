import { useSyncExternalStore } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { Wordmark } from '../../components/ui/Wordmark'
import { PUBLIC_SITE_URL } from '../../lib/public-site'
import { roleLabels, useStaffSession } from '../auth/auth-context'
import { SignOutButton } from '../auth/SignOutButton'
import { LowStockAlarm } from './LowStockAlarm'
import { sectionForPath, sectionsFor, type AdminSection } from './modules'
import { NavIcon } from './nav-icons'
import { initials } from './profile-logic'
import { GrowthRings } from './ui'

/** El mismo corte que `lg:` de Tailwind: en laptop hay barra lateral; en el celular, barra arriba y menú abajo. */
const DESKTOP = '(min-width: 64rem)'

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(DESKTOP)
      query.addEventListener('change', notify)
      return () => query.removeEventListener('change', notify)
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  )
}

/** Pestañas de una sección con varios módulos (Ventas: Pedidos y Cotizaciones). */
function SectionTabs({ section, pathname }: { section: AdminSection; pathname: string }) {
  const first = pathname.split('/').filter(Boolean)[0]
  return (
    <nav aria-label={section.label} className="mx-auto mb-8 max-w-6xl overflow-x-auto overflow-y-hidden">
      <ul className="flex min-w-max gap-2 border-b-2 border-linea">
        {section.modules.map((m) => {
          const active = m.slug === first
          return (
            <li key={m.slug}>
              <Link
                to={`/${m.slug}`}
                aria-current={active ? 'page' : undefined}
                className={`-mb-0.5 flex min-h-13 items-center gap-2 border-b-4 px-4 text-lg transition-colors ${
                  active ? 'border-nogal font-bold text-nogal' : 'border-transparent font-semibold text-carbon-600 hover:text-nogal'
                }`}
              >
                <NavIcon slug={m.slug} className="size-5" />
                {m.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function AdminLayout() {
  const { staff, signOut } = useStaffSession()
  const { pathname } = useLocation()
  const sections = sectionsFor(staff.role)
  const current = sectionForPath(pathname, staff.role)
  // Una sola alarma (vigila el stock y suena): en laptop vive junto al perfil; en el celular, arriba.
  const desktop = useIsDesktop()

  return (
    <div className="min-h-dvh bg-marfil lg:grid lg:grid-cols-[18.5rem_1fr]">
      <aside className="relative hidden overflow-hidden bg-nogal px-4 py-6 text-beige lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        {/* Los anillos de la teca, tenues al pie del menú. */}
        <GrowthRings className="absolute -bottom-28 -left-36 w-[26rem] text-madera" strength={0.5} />
        <div className="relative px-3 pb-8">
          <Wordmark to="/" tone="light" suffix="Panel" />
        </div>
        <nav aria-label="Menú del panel" className="relative">
          <ul className="grid gap-1.5">
            {sections.map((section) => {
              const active = current?.slug === section.slug
              return (
                <li key={section.slug}>
                  <Link
                    to={section.to}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-13 items-center gap-3.5 rounded-xl px-4 text-lg whitespace-nowrap transition-colors ${
                      active ? 'bg-marfil font-bold text-nogal' : 'font-semibold text-marfil hover:bg-marfil/10'
                    }`}
                  >
                    <NavIcon slug={section.slug} />
                    {section.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="relative mt-auto grid gap-2 border-t border-beige/20 pt-4">
          <div className="flex items-center gap-1">
            {/* Tocar el nombre lleva a «Mi perfil»: datos, contraseña y tamaño de letra. */}
            <Link
              to="/perfil"
              aria-current={pathname === '/perfil' ? 'page' : undefined}
              className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 transition-colors ${pathname === '/perfil' ? 'bg-marfil/15' : 'hover:bg-marfil/10'}`}
            >
              <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-madera font-display text-xl text-marfil">
                {initials(staff.fullName)}
              </span>
              <span className="grid min-w-0">
                <span className="truncate text-lg font-bold text-marfil">{staff.fullName}</span>
                <span className="text-sm text-arena">{roleLabels[staff.role]}</span>
              </span>
            </Link>
            {desktop && <LowStockAlarm inventoryPath="/inventario" tone="light" />}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 px-2">
            <SignOutButton onConfirm={signOut} className="inline-flex min-h-11 items-center text-sm font-semibold text-arena underline-offset-4 hover:text-marfil hover:underline" />
            <a href={PUBLIC_SITE_URL} className="inline-flex min-h-11 items-center text-sm text-arena underline-offset-4 hover:text-marfil hover:underline">
              Ir a la web pública
            </a>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Barra de arriba solo en el celular: en laptop la alarma y el perfil están en el menú lateral. */}
        <header className="flex min-h-16 items-center gap-3 border-b border-linea px-4 sm:px-8 lg:hidden">
          <div className="min-w-0">
            {/* Sin el sufijo: en el celular no entra junto a la alarma y el perfil. */}
            <Wordmark to="/" suffix="" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!desktop && <LowStockAlarm inventoryPath="/inventario" />}
            {/* En el celular el perfil (y desde ahí, cerrar sesión) está en el círculo con las iniciales. */}
            <Link
              to="/perfil"
              aria-label={`Mi perfil: ${staff.fullName}`}
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-madera font-display text-lg text-marfil"
            >
              {initials(staff.fullName)}
            </Link>
          </div>
        </header>
        <main className="flex-1 px-4 pt-6 pb-32 sm:px-8 lg:px-12 lg:pt-12 lg:pb-16">
          {current && current.modules.length > 1 && <SectionTabs section={current} pathname={pathname} />}
          <Outlet />
        </main>
      </div>

      {/* En el celular el menú vive abajo, al alcance del pulgar. */}
      <nav aria-label="Menú del panel" className="fixed inset-x-0 bottom-0 z-40 border-t border-linea bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="grid auto-cols-fr grid-flow-col">
          {sections.map((section) => {
            const active = current?.slug === section.slug
            return (
              <li key={section.slug}>
                <Link
                  to={section.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-18 flex-col items-center justify-center gap-1 text-sm ${active ? 'font-bold text-nogal' : 'font-semibold text-carbon-600'}`}
                >
                  <span className={`flex h-8 w-14 items-center justify-center rounded-full ${active ? 'bg-beige' : ''}`}>
                    <NavIcon slug={section.slug} />
                  </span>
                  {section.shortLabel}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
