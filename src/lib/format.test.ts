/**
 * Tests unitaires de src/lib/format.ts
 *
 * Couvre : formatMontant, formatFCFA, formatF, formatFcfaRecu,
 *           formatDateCourte, formatDateHeure, formatEcheance,
 *           safeGet, safeSet
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  formatMontant, formatFCFA, formatF, formatFcfaRecu,
  formatDateCourte, formatDateHeure, formatEcheance,
  safeGet, safeSet, sansPointFinal,
} from './format'

describe('formatMontant', () => {
  // toLocaleString('fr-FR') utilise U+202F (narrow no-break space) comme séparateur de milliers
  const NNBSP = '\u202f'

  it('formate un nombre avec séparateur de milliers en français', () => {
    expect(formatMontant(125000)).toBe(`125${NNBSP}000`)
  })

  it('renvoie 0 pour null', () => {
    expect(formatMontant(null)).toBe('0')
  })

  it('renvoie 0 pour undefined', () => {
    expect(formatMontant(undefined)).toBe('0')
  })

  it('formate 0', () => {
    expect(formatMontant(0)).toBe('0')
  })

  it('formate un grand nombre', () => {
    expect(formatMontant(1500000)).toBe(`1${NNBSP}500${NNBSP}000`)
  })
})

describe('formatFCFA', () => {
  const NNBSP = '\u202f'

  it('ajoute le suffixe FCFA', () => {
    expect(formatFCFA(125000)).toBe(`125${NNBSP}000 FCFA`)
  })

  it('renvoie « 0 FCFA » pour null', () => {
    expect(formatFCFA(null)).toBe('0 FCFA')
  })
})

describe('formatF', () => {
  it('formate avec des points comme séparateurs et un F suffixé (85000 → 85.000F)', () => {
    expect(formatF(85000)).toBe('85.000F')
  })

  it('renvoie « 0F » pour null', () => {
    expect(formatF(null)).toBe('0F')
  })

  it('renvoie « 0F » pour undefined', () => {
    expect(formatF(undefined)).toBe('0F')
  })

  it('arrondit au franc le plus proche (5000.4 → 5.000F)', () => {
    expect(formatF(5000.4)).toBe('5.000F')
  })

  it('arrondit au franc le plus proche (5000.6 → 5.001F)', () => {
    expect(formatF(5000.6)).toBe('5.001F')
  })

  it('formate un grand nombre (1500000 → 1.500.000F)', () => {
    expect(formatF(1500000)).toBe('1.500.000F')
  })

  it('affiche la valeur absolue sans signe négatif (-5000 → 5.000F)', () => {
    expect(formatF(-5000)).toBe('5.000F')
  })
})

describe('formatFcfaRecu', () => {
  it('formate pour un reçu (5000 → 5.000 FCFA)', () => {
    expect(formatFcfaRecu(5000)).toBe('5.000 FCFA')
  })

  it('renvoie « 0 FCFA » pour null', () => {
    expect(formatFcfaRecu(null)).toBe('0 FCFA')
  })
})

// ─── Dates ────────────────────────────────────────────────────────────────────
// Fuseau Africa/Dakar (UTC+0) — déjà configuré via process.env.TZ dans vitest.config.ts

describe('formatDateCourte', () => {
  beforeEach(() => { vi.setSystemTime(new Date('2026-11-16T12:00:00Z')) })
  afterEach(() => { vi.useRealTimers() })

  it('formate une date de l\'année courante sans l\'année (2026-11-12 → « 12 nov. »)', () => {
    expect(formatDateCourte('2026-11-12T10:00:00Z')).toBe('12 nov.')
  })

  it('ajoute l\'année si différente de l\'année courante (2025-11-12 → « 12 nov. 2025 »)', () => {
    expect(formatDateCourte('2025-11-12T10:00:00Z')).toBe('12 nov. 2025')
  })

  it('renvoie « — » pour null', () => {
    expect(formatDateCourte(null)).toBe('—')
  })

  it('renvoie « — » pour undefined', () => {
    expect(formatDateCourte(undefined)).toBe('—')
  })

  it('formate une date sans heure (2026-01-15)', () => {
    expect(formatDateCourte('2026-01-15')).toBe('15 janv.')
  })
})

describe('formatDateHeure', () => {
  beforeEach(() => { vi.setSystemTime(new Date('2026-11-16T12:00:00Z')) })
  afterEach(() => { vi.useRealTimers() })

  it('formate la date et l\'heure (2026-11-12T14:30:00Z → « 12 nov. · 14:30 »)', () => {
    expect(formatDateHeure('2026-11-12T14:30:00Z')).toBe('12 nov. · 14:30')
  })

  it('renvoie « — » pour null', () => {
    expect(formatDateHeure(null)).toBe('—')
  })
})

describe('formatEcheance', () => {
  beforeEach(() => { vi.setSystemTime(new Date('2026-11-16T12:00:00Z')) })
  afterEach(() => { vi.useRealTimers() })

  it('formate une date sans heure (yyyy-mm-dd) sans ajouter l\'heure', () => {
    expect(formatEcheance('2026-11-22')).toBe('dim. 22 nov.')
  })

  it('n\'ajoute pas l\'heure si minuit moins 1 (23:59)', () => {
    expect(formatEcheance('2026-11-22T23:59:00Z')).toBe('dim. 22 nov.')
  })

  it('ajoute l\'heure si ce n\'est pas la fin de journée', () => {
    const result = formatEcheance('2026-11-22T20:00:00Z')
    // En UTC+0 (Africa/Dakar), 20:00Z = 20:00 locale
    expect(result).toContain('à 20h')
  })

  it('renvoie « — » pour null', () => {
    expect(formatEcheance(null)).toBe('—')
  })

  it('renvoie « — » pour undefined', () => {
    expect(formatEcheance(undefined)).toBe('—')
  })

  it('ajoute l\'année si différente', () => {
    expect(formatEcheance('2025-11-22')).toContain('2025')
  })
})

// ─── safeGet / safeSet ───────────────────────────────────────────────────────

describe('safeGet', () => {
  it('lit une valeur du localStorage', () => {
    localStorage.setItem('test-key', 'valeur')
    expect(safeGet('test-key')).toBe('valeur')
  })

  it('renvoie null pour une clé inexistante', () => {
    expect(safeGet('cle-inexistante')).toBeNull()
  })

  it('renvoie null si localStorage lève une exception (navigation privée)', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => { throw new DOMException('Access denied') },
    })
    expect(safeGet('any-key')).toBeNull()
    if (original) Object.defineProperty(window, 'localStorage', original)
  })
})

describe('safeSet', () => {
  it('écrit une valeur dans le localStorage', () => {
    safeSet('test-key', 'valeur')
    expect(localStorage.getItem('test-key')).toBe('valeur')
  })

  it('n\'émet pas d\'erreur si localStorage lève une exception', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => { throw new DOMException('Access denied') },
    })
    expect(() => safeSet('any-key', 'value')).not.toThrow()
    if (original) Object.defineProperty(window, 'localStorage', original)
  })
})

// ─── sansPointFinal (FR23) ─────────────────────────────────────────────────────

describe('sansPointFinal', () => {
  it('retire le point d\'une date abrégée en fin de phrase (« 31 déc.. » → « 31 déc. »)', () => {
    expect(`jusqu'au ${sansPointFinal('31 déc.')}.`).toBe("jusqu'au 31 déc.")
  })
  it('laisse un texte sans point final intact', () => {
    expect(sansPointFinal('15 juin 2027')).toBe('15 juin 2027')
  })
})
