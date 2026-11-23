/** FR25 — Vocabulaire d'une période : une épargne (événementielle) n'a ni « tour » ni jackpot. */
import { describe, it, expect } from 'vitest'
import { TontineType } from '@/types/tontine'
import { estJournaliere, nomPeriode } from './periodes'

const journaliere = { tontineType: TontineType.EVENEMENTIELLE, rythmeIntervalle: 1, rythmeUnite: 'JOUR' as const }

describe('FR25 nomPeriode', () => {
  it.each([
    ['rotative : inchangée', { tontineType: TontineType.ROTATIVE, rythmeIntervalle: 1, rythmeUnite: 'JOUR' as const }, '2026-11-23', 'Tour 3'],
    ['épargne journalière : « Jour du JJ/MM »', journaliere, '2026-11-23', 'Jour du 23/11'],
    ['épargne journalière, ancien code JOURNALIERE', { tontineType: TontineType.EVENEMENTIELLE, frequence: 'JOURNALIERE' }, '2026-12-01', 'Jour du 01/12'],
    ['épargne journalière sans date connue : « Période N »', journaliere, null, 'Période 3'],
    ['épargne tous les 3 jours : « Période N »', { tontineType: TontineType.EVENEMENTIELLE, rythmeIntervalle: 3, rythmeUnite: 'JOUR' as const }, '2026-11-23', 'Période 3'],
    ['épargne hebdomadaire : « Période N »', { tontineType: TontineType.EVENEMENTIELLE, rythmeIntervalle: 1, rythmeUnite: 'SEMAINE' as const }, '2026-11-23', 'Période 3'],
    ['événementielle au rythme inconnu : « Période N »', { tontineType: TontineType.EVENEMENTIELLE }, '2026-11-23', 'Période 3'],
    ['tontine pas encore chargée : « Tour N »', null, '2026-11-23', 'Tour 3'],
  ])('%s', (_cas, t, dateDebut, attendu) => {
    expect(nomPeriode(t, { numeroCycle: 3, dateDebut })).toBe(attendu)
  })
})

describe('FR25 estJournaliere', () => {
  it('vraie seulement pour une événementielle cotisée chaque jour', () => {
    expect(estJournaliere(journaliere)).toBe(true)
    expect(estJournaliere({ ...journaliere, tontineType: TontineType.ROTATIVE })).toBe(false)
    expect(estJournaliere({ ...journaliere, rythmeIntervalle: 2 })).toBe(false)
    expect(estJournaliere(null)).toBe(false)
  })
})
