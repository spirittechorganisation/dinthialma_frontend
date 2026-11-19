/**
 * Tests unitaires de src/lib/tokenStorage.ts
 *
 * Couvre : normalizePhone, storeSession, getAccessToken/getRefreshToken,
 *           clearAccessToken/clearTokens/clearAll, getPinConfigured/setPinConfigured,
 *           parseJwt, isTokenExpired, getAuthUser, detectClientType, getClientType.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  normalizePhone, storeSession, getAccessToken, getRefreshToken, setTokens,
  clearAccessToken, clearTokens, clearAll,
  getUserPhone, setUserPhone, clearUserPhone,
  getPinConfigured, setPinConfigured,
  getClientType, detectClientType,
  parseJwt, isTokenExpired, getAuthUser,
} from './tokenStorage'
import { UserRole } from '@/types/common'

// Helper : crée un JWT non signé avec payload personnalisé
function creerJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

describe('normalizePhone', () => {
  it('retire le + en préfixe (+221783703310 → 221783703310)', () => {
    expect(normalizePhone('+221783703310')).toBe('221783703310')
  })
  it('retire les espaces', () => {
    expect(normalizePhone('+221 78 370 33 10')).toBe('221783703310')
  })
  it('retire les espaces et le + ensemble', () => {
    expect(normalizePhone('+ 221 78 370 33 10')).toBe('221783703310')
  })
  it('laisse un numéro sans + inchangé', () => {
    expect(normalizePhone('221783703310')).toBe('221783703310')
  })
})

describe('storeSession', () => {
  beforeEach(() => localStorage.clear())

  it('stocke access token, refresh token, téléphone normalisé et type de client', () => {
    storeSession('access-1', 'refresh-1', '+221 78 370 33 10')
    expect(getAccessToken()).toBe('access-1')
    expect(getRefreshToken()).toBe('refresh-1')
    expect(getUserPhone()).toBe('221783703310')
    expect(getClientType()).toMatch(/WEB|MOBILE/)
  })
})

describe('getAccessToken / getRefreshToken / setTokens', () => {
  beforeEach(() => localStorage.clear())

  it('renvoie null avant stockage', () => {
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })
  it('renvoie les jetons après setTokens', () => {
    setTokens('a', 'r')
    expect(getAccessToken()).toBe('a')
    expect(getRefreshToken()).toBe('r')
  })
})

describe('clearAccessToken', () => {
  beforeEach(() => localStorage.clear())

  it('efface le jeton d\'accès mais garde le refresh', () => {
    setTokens('a', 'r')
    clearAccessToken()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBe('r')
  })
})

describe('clearTokens', () => {
  beforeEach(() => localStorage.clear())

  it('efface les deux jetons', () => {
    setTokens('a', 'r')
    clearTokens()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })
})

describe('clearAll', () => {
  beforeEach(() => localStorage.clear())

  it('efface tout : jetons, téléphone, PIN, type client', () => {
    storeSession('a', 'r', '+221780000000')
    setPinConfigured(true)
    clearAll()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(getUserPhone()).toBeNull()
    expect(getPinConfigured()).toBeNull()
  })
})

describe('getPinConfigured / setPinConfigured', () => {
  beforeEach(() => localStorage.clear())

  it('renvoie null si la clé est absente', () => {
    expect(getPinConfigured()).toBeNull()
  })
  it('renvoie true après setPinConfigured(true)', () => {
    setPinConfigured(true)
    expect(getPinConfigured()).toBe(true)
  })
  it('renvoie false après setPinConfigured(false)', () => {
    setPinConfigured(false)
    expect(getPinConfigured()).toBe(false)
  })
})

describe('getUserPhone / setUserPhone / clearUserPhone', () => {
  beforeEach(() => localStorage.clear())

  it('renvoie null avant stockage', () => {
    expect(getUserPhone()).toBeNull()
  })
  it('stocke le numéro normalisé', () => {
    setUserPhone('+221780000000')
    expect(getUserPhone()).toBe('221780000000')
  })
  it('efface le numéro', () => {
    setUserPhone('+221780000000')
    clearUserPhone()
    expect(getUserPhone()).toBeNull()
  })
})

describe('parseJwt', () => {
  it('extrait le payload d\'un JWT valide', () => {
    const jwt = creerJwt({ sub: 'user-1', exp: 9999999999 })
    const p = parseJwt(jwt)
    expect(p?.sub).toBe('user-1')
    expect(p?.exp).toBe(9999999999)
  })
  it('renvoie null pour un jeton absent', () => {
    expect(parseJwt(undefined)).toBeNull()
  })
  it('renvoie null pour un jeton sans payload', () => {
    expect(parseJwt('invalide')).toBeNull()
  })
  it('renvoie null pour un jeton mal formé', () => {
    expect(parseJwt('a.b')).toBeNull()
  })
})

describe('isTokenExpired', () => {
  beforeEach(() => { vi.setSystemTime(new Date('2026-11-16T12:00:00Z')) })
  afterEach(() => { vi.useRealTimers() })

  it('renvoie false si exp est dans le futur', () => {
    const jwt = creerJwt({ exp: 1799999999 }) // ~2027
    expect(isTokenExpired(jwt)).toBe(false)
  })
  it('renvoie true si exp est dans le passé', () => {
    const jwt = creerJwt({ exp: 1700000000 }) // ~2023
    expect(isTokenExpired(jwt)).toBe(true)
  })
  it('renvoie true si pas de exp', () => {
    const jwt = creerJwt({ sub: 'u1' })
    expect(isTokenExpired(jwt)).toBe(true)
  })
  it('renvoie true pour un jeton absent', () => {
    expect(isTokenExpired(undefined)).toBe(true)
  })
})

describe('getAuthUser', () => {
  it('extrait l\'utilisateur avec ses rôles depuis le JWT', () => {
    const jwt = creerJwt({
      sub: 'user-1',
      email: 'test@test.com',
      given_name: 'Test',
      family_name: 'User',
      preferred_username: '221780000000',
      realm_access: { roles: ['DINTHIALMA_MEMBER', 'DINTHIALMA_ADMIN'] },
    })
    const u = getAuthUser(jwt)
    expect(u).not.toBeNull()
    expect(u?.sub).toBe('user-1')
    expect(u?.firstName).toBe('Test')
    expect(u?.lastName).toBe('User')
    expect(u?.phone).toBe('221780000000')
    expect(u?.roles).toContain(UserRole.MEMBER)
    expect(u?.roles).toContain(UserRole.ADMIN)
  })

  it('extrait les rôles aussi depuis le champ roles direct', () => {
    const jwt = creerJwt({ sub: 'u1', roles: ['DINTHIALMA_USER', 'MEMBER'] })
    const u = getAuthUser(jwt)
    expect(u?.roles).toContain(UserRole.USER)
    expect(u?.roles).toContain(UserRole.MEMBER)
  })

  it('déduplique les rôles identiques', () => {
    const jwt = creerJwt({
      sub: 'u1',
      realm_access: { roles: ['DINTHIALMA_MEMBER'] },
      roles: ['DINTHIALMA_MEMBER', 'MEMBER'],
    })
    const u = getAuthUser(jwt)
    expect(u?.roles.filter((r) => r === UserRole.MEMBER).length).toBe(1)
  })

  it('renvoie null si pas de sub', () => {
    const jwt = creerJwt({ exp: 999 })
    expect(getAuthUser(jwt)).toBeNull()
  })

  it('renvoie null pour undefined', () => {
    expect(getAuthUser(undefined)).toBeNull()
  })
})

describe('detectClientType', () => {
  it('renvoie WEB en jsdom (non standalone)', () => {
    expect(detectClientType()).toBe('WEB')
  })
})

describe('getClientType', () => {
  beforeEach(() => localStorage.clear())

  it('renvoie la valeur stockée si présente', () => {
    localStorage.setItem('dinthialma_client_type', 'MOBILE')
    expect(getClientType()).toBe('MOBILE')
  })
  it('replie sur detectClientType si absente', () => {
    expect(getClientType()).toBe('WEB')
  })
})
