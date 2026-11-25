/** FR31 — Codes de sécurité du PIN et des codes SMS (SE07, B53), lus dans `code`. */
import { describe, it, expect } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { actionPin, compteARebours, erreurOtp, finAttente, motDePasseRefuse, secondesRestantes, TEXTE_RECONNEXION } from './securite'

function erreurApi(status: number, code: string, data?: unknown, message = 'Message du serveur') {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError(message, 'ERR', config, null, {
    status, statusText: '', headers: {}, config, data: { status: 'error', statusCode: status, code, message, data },
  })
}

describe('FR31 compteARebours, secondesRestantes, finAttente', () => {
  it.each([[899, '14:59'], [900, '15:00'], [60, '1:00'], [59, '59 s'], [0.2, '1 s'], [-5, '0 s']])('%s s → %s', (s, attendu) => {
    expect(compteARebours(s)).toBe(attendu)
  })

  it('secondes restantes jamais négatives ; null → 0 ; fin = maintenant + délai', () => {
    expect(secondesRestantes(10_500, 1_000)).toBe(10)
    expect(secondesRestantes(1_000, 5_000)).toBe(0)
    expect(secondesRestantes(null)).toBe(0)
    expect(finAttente(900, 1_000)).toBe(901_000)
    expect(finAttente(-3, 1_000)).toBe(1_000)
  })
})

describe('FR31 actionPin', () => {
  it.each([
    ['PIN_SESSION_EXPIRED', 401, 'motDePasse'],
    ['SESSION_EXPIRED', 401, 'motDePasse'],
    ['NOT_FOUND', 404, 'motDePasse'],
    ['PIN_DISABLED', 401, 'desactive'],
    ['PIN_NOT_CONFIGURED', 400, 'creerPin'],
    ['PIN_EXPIRED', 400, 'reinitialiser'],
    ['PIN_INVALID', 401, 'rester'],
  ])('%s → %s', (code, status, type) => {
    expect(actionPin(erreurApi(status, code)).type).toBe(type)
  })

  it('PIN_SESSION_EXPIRED : « reconnectez-vous une fois avec votre mot de passe »', () => {
    expect(actionPin(erreurApi(401, 'PIN_SESSION_EXPIRED')).texte).toBe(TEXTE_RECONNEXION)
  })

  it('PIN_LOCKED : délai de data.retryAfterSeconds et « PIN oublié ? »', () => {
    const a = actionPin(erreurApi(429, 'PIN_LOCKED', { retryAfterSeconds: 900 }))
    expect(a).toMatchObject({ type: 'verrouille', retryAfterSeconds: 900 })
    expect(a.texte).toBe('Trop d’essais. Réessayez dans 15:00, ou touchez « PIN oublié ? ».')
    expect(actionPin(erreurApi(429, 'PIN_LOCKED')).texte).toMatch(/Réessayez plus tard/)
  })

  it('PIN_DISABLED : « votre code a été désactivé »', () => {
    expect(actionPin(erreurApi(401, 'PIN_DISABLED')).texte).toMatch(/^Trop d’essais : votre code a été désactivé/)
  })

  it('ne lit jamais le texte', () => {
    expect(actionPin(erreurApi(400, 'VALIDATION_ERROR', undefined, 'PIN_SESSION_EXPIRED')).type).toBe('rester')
  })
})

describe('FR31 erreurOtp', () => {
  it('OTP_RATE_LIMITED : attente et texte avec le délai', () => {
    const e = erreurOtp(erreurApi(429, 'OTP_RATE_LIMITED', { retryAfterSeconds: 1800 }))
    expect(e).toMatchObject({ attente: 1800, nouveauCode: false })
    expect(e.texte).toBe('Trop de codes demandés pour ce numéro. Vous pourrez en redemander un dans 30:00.')
    expect(erreurOtp(erreurApi(429, 'OTP_RATE_LIMITED')).texte).toMatch(/dans une heure/)
  })

  it('OTP_TOO_MANY_ATTEMPTS : « Demandez un nouveau code »', () => {
    expect(erreurOtp(erreurApi(400, 'OTP_TOO_MANY_ATTEMPTS'))).toMatchObject({ nouveauCode: true, attente: null, texte: 'Trop d’essais avec ce code. Demandez un nouveau code.' })
  })

  it('autre code : texte du front ou message du serveur', () => {
    expect(erreurOtp(erreurApi(400, 'OTP_INVALID')).texte).toBe('Code incorrect.')
    expect(erreurOtp(new Error('x'), 'Repli').texte).toBe('Repli')
  })
})

describe('FR31 motDePasseRefuse', () => {
  it('vrai seulement pour INVALID_CREDENTIALS', () => {
    expect(motDePasseRefuse(erreurApi(401, 'INVALID_CREDENTIALS'))).toBe(true)
    expect(motDePasseRefuse(erreurApi(400, 'PIN_TOO_SIMPLE'))).toBe(false)
  })
})
