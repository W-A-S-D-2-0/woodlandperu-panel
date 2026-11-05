import { describe, expect, it } from 'vitest'
import { isInviteLink } from './supabase'

describe('isInviteLink', () => {
  it('reconoce el enlace del correo de invitación', () => {
    expect(isInviteLink('#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=invite')).toBe(true)
    expect(isInviteLink('type=invite')).toBe(true)
  })

  it('no confunde otros enlaces ni una URL sin fragmento', () => {
    expect(isInviteLink('#access_token=abc&type=recovery')).toBe(false)
    expect(isInviteLink('#access_token=abc&type=signup')).toBe(false)
    expect(isInviteLink('#error=access_denied&error_code=otp_expired')).toBe(false)
    expect(isInviteLink('')).toBe(false)
  })
})
