/** FR29 — Encaisser : un membre soldé est rangé avec les « déjà payés » et ne compte plus dans le compteur. */
import { describe, it, expect } from 'vitest'
import { AccountStatus, CotisationStatut, MembreStatut } from '@/types/common'
import type { CycleRecapLigne } from '@/types/cotisation'
import { avecSoldes, horsEncaissement, textePayes } from './encaissement'

const ligne = (membreId: string, statutCotisation: CotisationStatut | null = null): CycleRecapLigne => ({
  membreId, userId: `u-${membreId}`, firstName: membreId, lastName: 'Test', phone: '+221770009100',
  accountStatus: AccountStatus.PRE_ENROLLED, statutMembre: MembreStatut.ACTIF, ordreJackpot: null,
  cotisationId: statutCotisation ? `cot-${membreId}` : null, montant: null, methodePaiement: null, statutCotisation, dateValidation: null,
})

describe('FR29 avecSoldes', () => {
  it('reprend soldeLe de la liste des membres, sans toucher aux autres lignes', () => {
    const awa = ligne('awa')
    const [a, b] = avecSoldes([awa, ligne('binta')], [{ id: 'binta', soldeLe: '2026-11-21T12:00:00' }, { id: 'awa', soldeLe: null }])

    expect(a).toBe(awa)
    expect(b.soldeLe).toBe('2026-11-21T12:00:00')
  })
})

describe('FR29 horsEncaissement', () => {
  it('payé ou soldé : rien à encaisser', () => {
    expect(horsEncaissement({ statutCotisation: CotisationStatut.VALIDE })).toBe(true)
    expect(horsEncaissement({ statutCotisation: null, soldeLe: '2026-11-21T12:00:00' })).toBe(true)
    expect(horsEncaissement({ statutCotisation: null, soldeLe: null })).toBe(false)
  })
})

describe('FR29 textePayes avec un membre soldé', () => {
  it('un soldé sans paiement sur la période ne compte ni au numérateur ni au total', () => {
    const lignes = [ligne('a', CotisationStatut.VALIDE), ligne('b'), { ...ligne('c'), soldeLe: '2026-11-21T12:00:00' }]
    expect(textePayes(lignes, true)).toBe('1 / 2 payé aujourd’hui')
  })

  it('un soldé qui avait déjà payé la période reste compté', () => {
    const lignes = [{ ...ligne('a', CotisationStatut.VALIDE), soldeLe: '2026-11-22T12:00:00' }, ligne('b')]
    expect(textePayes(lignes, false)).toBe('1 / 2 payé')
  })
})
