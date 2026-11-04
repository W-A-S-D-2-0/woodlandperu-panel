import { useState, type FormEvent } from 'react'
import type { StaffMeResponse } from '../../../../shared/api/contracts'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { MIN_PASSWORD_LENGTH, roleLabels, useAuth, useStaffSession, validateNewPassword } from '../../auth/auth-context'
import { SignOutButton } from '../../auth/SignOutButton'
import { applyTextSize, initials, memberSince, readTextSize, textSizes, writeTextSize, type TextSize } from '../profile-logic'
import { useAdminAction } from '../use-admin-api'
import { Card, Field, inputClass, Notice, primaryButton, secondaryButton } from '../ui'

const storage = () => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const Done = ({ children }: { children: string }) => (
  <p role="status" className="rounded-xl bg-exito-claro px-4 py-3 text-lg font-bold text-exito">
    {children}
  </p>
)

function NameForm() {
  const { staff, updateStaff } = useStaffSession()
  const { run, pending, error } = useAdminAction()
  const [name, setName] = useState(staff.fullName)
  const [done, setDone] = useState(false)
  const unchanged = name.trim() === staff.fullName

  async function save(event: FormEvent) {
    event.preventDefault()
    setDone(false)
    const result = await run<StaffMeResponse>('PATCH', '/me', { fullName: name.trim() })
    if (result) {
      updateStaff(result)
      setName(result.fullName)
      setDone(true)
    }
  }

  return (
    <Card title="Tu nombre">
      <form onSubmit={(e) => void save(e)} className="grid gap-4" noValidate>
        <Field label="Nombre y apellido" hint="Así te saluda el panel y así te ve el resto del equipo.">
          <input
            className={`${inputClass} text-lg`}
            value={name}
            maxLength={120}
            autoComplete="name"
            onChange={(e) => {
              setName(e.target.value)
              setDone(false)
            }}
          />
        </Field>
        {error && <Notice>{error}</Notice>}
        {done && <Done>Listo, tu nombre quedó guardado.</Done>}
        <div>
          <button type="submit" className={primaryButton} disabled={pending || unchanged || name.trim().length < 2}>
            {pending ? 'Guardando…' : 'Guardar nombre'}
          </button>
        </div>
      </form>
    </Card>
  )
}

function PasswordForm() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    setDone(false)
    const problem = validateNewPassword(password, repeat)
    if (problem) return setError(problem)
    setError(null)
    setPending(true)
    const message = await updatePassword(password)
    setPending(false)
    if (message) return setError(message)
    setPassword('')
    setRepeat('')
    setDone(true)
  }

  return (
    <Card title="Tu contraseña">
      <form onSubmit={(e) => void save(e)} className="grid gap-4" noValidate>
        <Field label="Contraseña nueva" hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}>
          <input className={inputClass} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Repite la contraseña">
          <input className={inputClass} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </Field>
        {error && <Notice>{error}</Notice>}
        {done && <Done>Listo, tu contraseña cambió. Úsala la próxima vez que ingreses.</Done>}
        <div>
          <button type="submit" className={secondaryButton} disabled={pending || !password || !repeat}>
            {pending ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </Card>
  )
}

const samples: Record<TextSize, string> = { normal: 'text-2xl', grande: 'text-3xl', 'muy-grande': 'text-4xl' }

/** El cambio se ve al instante en todo el panel y queda guardado en este equipo. */
function TextSizePicker() {
  const [size, setSize] = useState<TextSize>(() => readTextSize(storage()))

  const pick = (next: TextSize) => {
    setSize(next)
    writeTextSize(storage(), next)
    applyTextSize(document.documentElement, next)
  }

  return (
    <Card title="Tamaño de letra">
      <p className="text-lg text-carbon-600">Elige cómo prefieres leer el panel. Se guarda en este equipo.</p>
      <div role="radiogroup" aria-label="Tamaño de letra" className="mt-4 grid gap-3 sm:grid-cols-3">
        {textSizes.map((t) => {
          const on = t.id === size
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(t.id)}
              className={`grid min-h-28 place-items-center gap-1 rounded-2xl border-2 p-4 transition-colors ${
                on ? 'border-nogal bg-nogal text-marfil' : 'border-linea bg-white text-nogal hover:border-nogal'
              }`}
            >
              <span aria-hidden="true" className={`font-display leading-none ${samples[t.id]}`}>
                Aa
              </span>
              <span className="text-base font-bold">{t.label}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/** Mi perfil: datos de la cuenta, nombre, contraseña, tamaño de letra y cerrar sesión. */
export function ProfilePage() {
  useDocumentTitle('Mi perfil')
  const { staff, signOut } = useStaffSession()
  const { session } = useAuth()
  const email = session?.user.email ?? null
  const since = memberSince(session?.user.created_at)

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <section aria-label="Tu cuenta" className="flex flex-wrap items-center gap-5 rounded-2xl bg-nogal p-6 text-beige sm:p-8">
        <span aria-hidden="true" className="flex size-24 shrink-0 items-center justify-center rounded-full bg-madera font-display text-4xl text-marfil ring-4 ring-marfil/20">
          {initials(staff.fullName)}
        </span>
        <div className="grid min-w-0 gap-1">
          <h1 className="text-4xl break-words text-marfil">{staff.fullName}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-lg">
            <span className="rounded-full bg-marfil/15 px-3 py-0.5 font-bold text-marfil">{roleLabels[staff.role]}</span>
            {email && <span className="break-all text-arena">{email}</span>}
          </p>
          {since && <p className="text-base text-arena">En el equipo desde {since}</p>}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <NameForm />
        <PasswordForm />
      </div>

      <TextSizePicker />

      <section aria-labelledby="salir" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-linea bg-white p-6">
        <div>
          <h2 id="salir" className="font-sans text-xl font-bold text-carbon">
            ¿Terminaste por hoy?
          </h2>
          <p className="text-lg text-carbon-600">Cierra sesión si usas un equipo compartido.</p>
        </div>
        <SignOutButton onConfirm={signOut} className={secondaryButton} />
      </section>
    </div>
  )
}
