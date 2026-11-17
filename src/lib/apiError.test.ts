/**
 * Tests unitaires de src/lib/apiError.ts
 *
 * Couvre : parseApiError (chaque type d'erreur), messageErreur (texte front, message serveur, repli).
 */
import { describe, it, expect } from 'vitest'
import { AxiosError } from 'axios'
import { parseApiError, messageErreur, type ApiErrorCode } from './apiError'

/** Fabrique une erreur Axios avec un body d'erreur backend */
function errAxios(status: number, code?: string, message?: string, data?: Record<string, unknown>): AxiosError {
  return new AxiosError(
    'Request failed',
    undefined,
    undefined,
    undefined,
    {
      status,
      data: { status: 'error', statusCode: status, code, message, data },
    } as never,
  )
}

describe('parseApiError', () => {
  it('extrait le code d\'une erreur Axios avec code connu (INVALID_CREDENTIALS)', () => {
    const err = errAxios(401, 'INVALID_CREDENTIALS', 'Mauvais identifiants')
    const r = parseApiError(err)
    expect(r.code).toBe('INVALID_CREDENTIALS')
    expect(r.status).toBe(401)
    expect(r.serverMessage).toBe('Mauvais identifiants')
  })

  it('renvoie UNKNOWN si le body n\'a pas de code', () => {
    const err = errAxios(500, undefined, 'Erreur interne')
    const r = parseApiError(err)
    expect(r.code).toBe('UNKNOWN')
    expect(r.serverMessage).toBe('Erreur interne')
  })

  it('renvoie NETWORK_ERROR si pas de réponse (erreur réseau)', () => {
    const err = new AxiosError('Network Error', undefined, undefined, undefined, undefined)
    const r = parseApiError(err)
    expect(r.code).toBe('NETWORK_ERROR')
    expect(r.status).toBeNull()
  })

  it('renvoie UNKNOWN pour une erreur non-Axios', () => {
    const r = parseApiError(new Error('pas axios'))
    expect(r.code).toBe('UNKNOWN')
    expect(r.status).toBeNull()
  })

  it('renvoie UNKNOWN pour undefined', () => {
    const r = parseApiError(undefined)
    expect(r.code).toBe('UNKNOWN')
  })

  it('extrait retryAfterSeconds de data (PIN_LOCKED)', () => {
    const err = errAxios(429, 'PIN_LOCKED', 'Trop de tentatives', { retryAfterSeconds: 1800 })
    const r = parseApiError(err)
    expect(r.code).toBe('PIN_LOCKED')
    expect(r.retryAfterSeconds).toBe(1800)
  })

  it('renvoie retryAfterSeconds null si absent', () => {
    const err = errAxios(400, 'VALIDATION_ERROR', 'Champ invalide')
    const r = parseApiError(err)
    expect(r.retryAfterSeconds).toBeNull()
  })

  it('renvoie retryAfterSeconds null si valeur négative ou zéro', () => {
    const err = errAxios(429, 'PIN_LOCKED', 'Locked', { retryAfterSeconds: 0 })
    expect(parseApiError(err).retryAfterSeconds).toBeNull()
  })
})

describe('messageErreur', () => {
  it('renvoie le texte front pour un code connu (INVALID_CREDENTIALS)', () => {
    const err = errAxios(401, 'INVALID_CREDENTIALS', 'Mauvais identifiants')
    expect(messageErreur(err)).toBe('Numéro ou mot de passe incorrect.')
  })

  it('renvoie le texte front pour NETWORK_ERROR', () => {
    const err = new AxiosError('Network Error')
    expect(messageErreur(err)).toBe('Pas de connexion. Vérifiez votre réseau et réessayez.')
  })

  it('renvoie le message du serveur si le code n\'a pas de texte front', () => {
    const err = errAxios(500, 'CODE_INCONNU_DU_FRONT', 'Message serveur personnalisé')
    expect(messageErreur(err)).toBe('Message serveur personnalisé')
  })

  it('renvoie le repli par défaut si ni texte front ni message serveur', () => {
    const err = errAxios(500, 'CODE_INCONNU', '')
    expect(messageErreur(err)).toBe('Une erreur est survenue. Réessayez.')
  })

  it('renvoie un repli personnalisé si fourni', () => {
    const err = errAxios(500, 'CODE_INCONNU', '')
    expect(messageErreur(err, 'Échec personnalisé')).toBe('Échec personnalisé')
  })

  it('renvoie le repli si le message serveur est vide et le code est UNKNOWN', () => {
    const err = errAxios(500, undefined, undefined)
    expect(messageErreur(err, 'Repli')).toBe('Repli')
  })
})
