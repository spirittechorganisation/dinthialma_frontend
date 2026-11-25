/** FR31 — Identifiant stable de l'appareil (B53). */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { APPAREIL_KEY, FORMAT_APPAREIL, getAppareilId, nouvelIdentifiant, _oublierAppareilEnMemoire } from './appareil'
import { clearAll } from './tokenStorage'

beforeEach(() => {
  localStorage.removeItem(APPAREIL_KEY)
  _oublierAppareilEnMemoire()
})

afterEach(() => { vi.restoreAllMocks() })

describe('FR31 getAppareilId', () => {
  it('créé au premier appel, au format du backend, gardé dans le localStorage', () => {
    const id = getAppareilId()
    expect(id).toMatch(FORMAT_APPAREIL)
    expect(localStorage.getItem(APPAREIL_KEY)).toBe(id)
  })

  it('jamais régénéré tant que le stockage existe', () => {
    const id = getAppareilId()
    expect(getAppareilId()).toBe(id)
    expect(getAppareilId()).toBe(id)
  })

  it('survit à la déconnexion complète (clearAll)', () => {
    const id = getAppareilId()
    clearAll()
    expect(getAppareilId()).toBe(id)
  })

  it('stockage effacé : nouvel identifiant', () => {
    const id = getAppareilId()
    localStorage.removeItem(APPAREIL_KEY)
    _oublierAppareilEnMemoire()
    expect(getAppareilId()).not.toBe(id)
  })

  it('valeur stockée invalide : remplacée par un identifiant valide', () => {
    localStorage.setItem(APPAREIL_KEY, 'x y')
    const id = getAppareilId()
    expect(id).toMatch(FORMAT_APPAREIL)
    expect(localStorage.getItem(APPAREIL_KEY)).toBe(id)
  })

  it('stockage indisponible : repli en mémoire, même identifiant pendant la vie de la page', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('refusé') })
    const id = getAppareilId()
    expect(id).toMatch(FORMAT_APPAREIL)
    expect(getAppareilId()).toBe(id)
  })
})

describe('FR31 nouvelIdentifiant', () => {
  it('randomUUID quand il existe', () => {
    expect(nouvelIdentifiant({ randomUUID: () => 'abcdefgh-1234', getRandomValues: (a) => a })).toBe('abcdefgh-1234')
  })

  it('sans randomUUID : UUID v4 construit avec getRandomValues', () => {
    const id = nouvelIdentifiant({ getRandomValues: <T extends ArrayBufferView | null>(a: T) => { (a as unknown as Uint8Array).fill(255); return a } })
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(id).toMatch(FORMAT_APPAREIL)
  })

  it('sans crypto : repli sur Math.random, format valide', () => {
    expect(nouvelIdentifiant(undefined)).toMatch(FORMAT_APPAREIL)
  })
})
