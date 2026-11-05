import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { PUBLIC_SITE_URL } from '../../lib/public-site'
import { AuthNotice, primaryButtonClass } from './AuthNotice'
import { MIN_PASSWORD_LENGTH, safeNextPath, useAuth, validateNewPassword } from './auth-context'

const inputClass =
  'block min-h-14 w-full rounded-2xl border-2 border-linea bg-white px-4 text-lg text-carbon transition-colors placeholder:text-carbon-600/60 focus:border-nogal focus:outline-none'

const linkClass = 'font-semibold text-madera-700 underline underline-offset-4 hover:text-nogal'

/** Botón grande del formulario: ocupa todo el ancho para que se toque fácil en el celular. */
const submitClass = `${primaryButtonClass} min-h-14 w-full text-lg`

type View = 'login' | 'forgot'

function Field({
  label,
  name,
  type = 'text',
  autoComplete,
  hint,
  extra,
}: {
  label: string
  name: string
  type?: string
  autoComplete?: string
  hint?: string
  /** Enlace en la misma línea que la etiqueta (por ejemplo, «¿La olvidaste?»). */
  extra?: ReactNode
}) {
  const id = useId()
  const isPassword = type === 'password'
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-base font-bold text-carbon">
          {label}
        </label>
        {extra}
      </div>
      <div className="relative mt-2">
        <input
          id={id}
          name={name}
          type={isPassword && visible ? 'text' : type}
          autoComplete={autoComplete}
          required
          className={`${inputClass} ${isPassword ? 'pr-28' : ''}`}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        {isPassword && (
          // Mostrarla evita errores al escribir: se dice con palabras, no con un ícono de ojo.
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            className="absolute top-1/2 right-2 inline-flex min-h-11 -translate-y-1/2 items-center rounded-xl px-3 text-base font-bold text-nogal hover:bg-beige"
          >
            {visible ? 'Ocultar' : 'Mostrar'}
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-base text-carbon-600">
          {hint}
        </p>
      )}
    </div>
  )
}

const Message = ({ tone, children }: { tone: 'error' | 'ok'; children: string }) => (
  <p
    role={tone === 'error' ? 'alert' : 'status'}
    className={`rounded-2xl px-5 py-4 text-base font-semibold ${tone === 'error' ? 'bg-alerta-claro text-alerta' : 'bg-exito-claro text-exito'}`}
  >
    {children}
  </p>
)

const read = (form: HTMLFormElement) => {
  const data = new FormData(form)
  return (name: string) => String(data.get(name) ?? '')
}

/**
 * Inicio de sesión del personal y restablecer contraseña. Aquí no se crean cuentas: las crea administración
 * (correo en staff_invites y cuenta en Supabase), así nadie de afuera entra al panel.
 */
export function LoginPage() {
  useDocumentTitle('Ingresar')
  const { status, recovering, signIn, requestPasswordReset, updatePassword } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNextPath(params.get('next'))
  const [view, setView] = useState<View>('login')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const go = (to: View) => {
    setView(to)
    setError(null)
    setDone(null)
  }

  // Quien llegó por el enlace del correo elige aquí su contraseña nueva, aunque ya tenga sesión.
  if (status === 'signed_in' && !recovering) return <Navigate to={next} replace />

  if (status === 'unconfigured') {
    return (
      <AuthNotice title="Acceso no disponible">
        La autenticación del panel no está configurada en este ambiente. Define <code>VITE_SUPABASE_URL</code> y{' '}
        <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> en <code>.env.local</code>.
      </AuthNotice>
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>, run: (get: (name: string) => string) => Promise<void>) {
    event.preventDefault()
    const get = read(event.currentTarget)
    setSubmitting(true)
    setError(null)
    await run(get)
    setSubmitting(false)
  }

  const onLogin = (event: FormEvent<HTMLFormElement>) =>
    submit(event, async (get) => {
      const email = get('email').trim()
      const password = get('password')
      if (!email || !password) return setError('Ingresa tu correo y tu contraseña.')
      const message = await signIn(email, password)
      if (message) setError(message)
      else navigate(next, { replace: true })
    })

  const onForgot = (event: FormEvent<HTMLFormElement>) =>
    submit(event, async (get) => {
      const email = get('email').trim()
      if (!email) return setError('Ingresa tu correo.')
      const message = await requestPasswordReset(email)
      if (message) setError(message)
      else setDone('Si el correo tiene una cuenta, te enviamos un enlace para elegir una contraseña nueva. Revisa también el spam.')
    })

  const onRecover = (event: FormEvent<HTMLFormElement>) =>
    submit(event, async (get) => {
      const problem = validateNewPassword(get('password'), get('repeat'))
      if (problem) return setError(problem)
      const message = await updatePassword(get('password'))
      if (message) setError(message)
      else navigate(next, { replace: true })
    })

  const feedback = (
    <>
      {error && <Message tone="error">{error}</Message>}
      {done && <Message tone="ok">{done}</Message>}
    </>
  )
  const submitLabel = (idle: string, busy: string) => (submitting ? busy : idle)
  const passwordHint = `Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`

  if (recovering) {
    return (
      <AuthNotice title="Nueva contraseña">
        <p>Elige la contraseña con la que vas a ingresar al panel.</p>
        <form className="mt-8 grid gap-5" onSubmit={onRecover} noValidate>
          <Field label="Contraseña nueva" name="password" type="password" autoComplete="new-password" hint={passwordHint} />
          <Field label="Repite la contraseña" name="repeat" type="password" autoComplete="new-password" />
          {feedback}
          <button type="submit" className={submitClass} disabled={submitting}>
            {submitLabel('Guardar contraseña', 'Guardando…')}
          </button>
        </form>
      </AuthNotice>
    )
  }

  return (
    <AuthNotice title={view === 'forgot' ? 'Restablecer contraseña' : 'Ingresar al panel'}>
      {view === 'login' && (
        <>
          <p>Usa el correo y la contraseña de tu cuenta de Woodland.</p>
          <form className="mt-7 grid gap-5" onSubmit={onLogin} noValidate>
            <Field label="Correo" name="email" type="email" autoComplete="username" />
            <Field
              label="Contraseña"
              name="password"
              type="password"
              autoComplete="current-password"
              extra={
                <button type="button" className={`${linkClass} text-base`} onClick={() => go('forgot')}>
                  ¿La olvidaste?
                </button>
              }
            />
            {feedback}
            <button type="submit" className={`${submitClass} mt-2`} disabled={submitting || status === 'loading'}>
              {submitLabel('Ingresar', 'Ingresando…')}
            </button>
          </form>
        </>
      )}

      {view === 'forgot' && (
        <form className="mt-6 grid gap-6" onSubmit={onForgot} noValidate>
          <p>Escribe tu correo y te enviamos un enlace para elegir una contraseña nueva.</p>
          <Field label="Correo" name="email" type="email" autoComplete="username" />
          {feedback}
          <button type="submit" className={submitClass} disabled={submitting}>
            {submitLabel('Enviar enlace', 'Enviando…')}
          </button>
          <button type="button" className={`${linkClass} justify-self-start text-base`} onClick={() => go('login')}>
            Volver a iniciar sesión
          </button>
        </form>
      )}

      <div className="mt-8 grid gap-2 border-t border-linea pt-6 text-base">
        {view === 'login' && <p>¿Aún no tienes cuenta? Pídela a administración de Woodland.</p>}
        <a href={PUBLIC_SITE_URL} className={`${linkClass} justify-self-start`}>
          Ir a la web pública
        </a>
      </div>
    </AuthNotice>
  )
}
