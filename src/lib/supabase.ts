import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase del navegador. Solo se usa para la sesión del personal
 * (iniciar y cerrar sesión, renovar el token). Los datos se piden a nuestra API (/api).
 *
 * Usa la URL y la clave PUBLICABLE (públicas por diseño y protegidas por RLS).
 * Devuelve null si el ambiente no tiene Supabase configurado.
 */
let client: SupabaseClient | null | undefined
let invited = false

/** El enlace del correo de invitación de Supabase vuelve con `type=invite` en el fragmento de la URL. */
export function isInviteLink(hash: string): boolean {
  return new URLSearchParams(hash.replace(/^#/, '')).get('type') === 'invite'
}

/**
 * La persona abrió el enlace de su invitación y todavía no eligió contraseña. Se lee antes de crear el
 * cliente, porque Supabase borra el fragmento de la URL al tomar la sesión.
 */
export function openedFromInvite(): boolean {
  return invited
}

export function inviteHandled(): void {
  invited = false
}

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client

  invited = typeof window !== 'undefined' && isInviteLink(window.location.hash)
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null
  return client
}
