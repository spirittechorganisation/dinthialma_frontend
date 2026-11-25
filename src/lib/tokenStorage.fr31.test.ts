/** FR31 — Appareil de confiance : session perdue → écran PIN en gardant le numéro, sinon connexion complète. */
import { describe, it, expect, beforeEach } from 'vitest'
import { APPAREIL_KEY } from './appareil'
import {
  appareilDeConfiance, oublierSessionPerdue, getAccessToken, getRefreshToken, getUserPhone, getPinConfigured,
  setPinConfigured, setTokens, setUserPhone, verrouillerSession, sessionVerrouillee,
} from './tokenStorage'

function appareil(o: { id?: boolean; pin?: boolean | null; phone?: boolean } = {}) {
  localStorage.clear()
  setTokens('acces', 'refresh')
  if (o.id ?? true) localStorage.setItem(APPAREIL_KEY, 'appareil-12345678')
  const pin = 'pin' in o ? o.pin : true
  if (pin !== null && pin !== undefined) setPinConfigured(pin)
  if (o.phone ?? true) setUserPhone('221770000001')
}

beforeEach(() => { localStorage.clear() })

describe('FR31 appareilDeConfiance', () => {
  it.each([
    ['appareilId, PIN configuré, numéro connu', {}, true],
    ['sans appareilId (front d’avant B53)', { id: false }, false],
    ['PIN non configuré', { pin: false }, false],
    ['PIN inconnu', { pin: null }, false],
    ['numéro inconnu', { phone: false }, false],
  ])('%s → %s', (_cas, o, attendu) => {
    appareil(o)
    expect(appareilDeConfiance()).toBe(attendu)
  })

  it('ne crée jamais d’appareilId', () => {
    appareil({ id: false })
    appareilDeConfiance()
    expect(localStorage.getItem(APPAREIL_KEY)).toBeNull()
  })
})

describe('FR31 oublierSessionPerdue', () => {
  it('appareil de confiance : jetons effacés, numéro, PIN et appareilId gardés, verrou levé → /pin', () => {
    appareil()
    verrouillerSession()

    expect(oublierSessionPerdue()).toBe('/pin')
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(getUserPhone()).toBe('221770000001')
    expect(getPinConfigured()).toBe(true)
    expect(localStorage.getItem(APPAREIL_KEY)).toBe('appareil-12345678')
    expect(sessionVerrouillee()).toBe(false)
  })

  it('sinon : tout effacé sauf l’appareilId → /login', () => {
    appareil({ pin: false })

    expect(oublierSessionPerdue()).toBe('/login')
    expect(getRefreshToken()).toBeNull()
    expect(getUserPhone()).toBeNull()
    expect(getPinConfigured()).toBeNull()
    expect(localStorage.getItem(APPAREIL_KEY)).toBe('appareil-12345678')
  })
})
