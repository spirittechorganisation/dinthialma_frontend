/**
 * Tests de src/lib/preferences.ts
 *
 * Couvre : chargerPreferences (GET /v1/me/preferences), synchroniserPreferences (PUT avec debounce 1,5 s),
 *           échec réseau, lecture/écriture du cache local.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { API, ok } from '../test/msw/api'
import { server } from '../test/msw/server'
import { connecter } from '../test/auth'
import {
  chargerPreferences, synchroniserPreferences, PREFERENCES_EVENT,
  PREF_KEYS, estPreferenceSynchronisee,
} from './preferences'

describe('chargerPreferences', () => {
  beforeEach(() => {
    localStorage.clear()
    connecter()
  })

  it('charge les préférences depuis le serveur et les écrit dans le cache local', async () => {
    server.use(
      http.get(`${API}/v1/me/preferences`, () =>
        ok({ tontinesFavorites: ['t1', 't2'], dernierMode: 'GERE', masquerMontant: true }),
      ),
    )

    await chargerPreferences()

    expect(localStorage.getItem(PREF_KEYS.favoris)).toBe(JSON.stringify(['t1', 't2']))
    expect(localStorage.getItem(PREF_KEYS.mode)).toBe('GERE')
    expect(localStorage.getItem(PREF_KEYS.masquer)).toBe('1')
  })

  it('émet l\'événement PREFERENCES_EVENT après chargement', async () => {
    server.use(http.get(`${API}/v1/me/preferences`, () => ok({ dernierMode: 'COTISE', masquerMontant: false })))
    let recu = false
    const handler = () => { recu = true }
    window.addEventListener(PREFERENCES_EVENT, handler)
    await chargerPreferences()
    expect(recu).toBe(true)
    window.removeEventListener(PREFERENCES_EVENT, handler)
  })

  it('ne plante pas si le serveur renvoie une erreur (repli sur cache local)', async () => {
    server.use(http.get(`${API}/v1/me/preferences`, () => HttpResponse.json({ status: 'error', statusCode: 401 }, { status: 401 })))
    await expect(chargerPreferences()).resolves.toBeUndefined()
  })
})

describe('synchroniserPreferences', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    connecter()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('envoie un PUT après 1,5 s de debounce', async () => {
    let corpsRecu: Record<string, unknown> | null = null
    server.use(
      http.put(`${API}/v1/me/preferences`, async ({ request }) => {
        corpsRecu = await request.json() as Record<string, unknown>
        return ok(null, 'Enregistré')
      }),
    )

    // Modifier une préférence locale puis synchroniser
    localStorage.setItem(PREF_KEYS.mode, 'GERE')
    synchroniserPreferences()

    // Avant le debounce, rien n'est envoyé
    expect(corpsRecu).toBeNull()

    // Avancer les timers de 1,5 s (avec flush des microtasks)
    await vi.advanceTimersByTimeAsync(1500)

    // Le PUT a été envoyé
    expect(corpsRecu).not.toBeNull()
    expect(corpsRecu).toMatchObject({ dernierMode: 'GERE' })
  })

  it('regroupe plusieurs changements en un seul PUT (debounce)', async () => {
    let compteur = 0
    server.use(
      http.put(`${API}/v1/me/preferences`, () => { compteur++; return ok(null) }),
    )

    localStorage.setItem(PREF_KEYS.mode, 'GERE')
    synchroniserPreferences()
    localStorage.setItem(PREF_KEYS.masquer, '1')
    synchroniserPreferences()

    await vi.advanceTimersByTimeAsync(1500)
    expect(compteur).toBe(1)
  })

  it('n\'émet pas d\'erreur si le PUT échoue (réessayé au prochain changement)', async () => {
    server.use(http.put(`${API}/v1/me/preferences`, () => HttpResponse.json({ status: 'error' }, { status: 500 })))
    localStorage.setItem(PREF_KEYS.mode, 'GERE')
    synchroniserPreferences()
    await vi.advanceTimersByTimeAsync(1500)
    // Pas d'exception — le catch interne absorbe l'erreur
  })
})

describe('estPreferenceSynchronisee', () => {
  it('renvoie true pour une clé connue', () => {
    expect(estPreferenceSynchronisee(PREF_KEYS.mode)).toBe(true)
  })
  it('renvoie false pour une clé inconnue', () => {
    expect(estPreferenceSynchronisee('cle_inconnue')).toBe(false)
  })
})
