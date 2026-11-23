/** FR24 — Saisie en série : montant prérempli, encaissements de la séance, compteur. */
import { describe, it, expect } from 'vitest'
import { AccountStatus, CotisationStatut, MembreStatut } from '@/types/common'
import type { CycleRecapLigne } from '@/types/cotisation'
import { aPaye, avecEncaissementsRecents, montantPrerempli, textePayes } from './encaissement'

const ligne = (membreId: string, statutCotisation: CotisationStatut | null = null, montant: number | null = null): CycleRecapLigne => ({
  membreId, userId: `u-${membreId}`, firstName: membreId, lastName: 'Test', phone: '+221770009100',
  accountStatus: AccountStatus.PRE_ENROLLED, statutMembre: MembreStatut.ACTIF, ordreJackpot: null,
  cotisationId: statutCotisation ? `cot-${membreId}` : null, montant, methodePaiement: null, statutCotisation, dateValidation: null,
})

describe('FR24 montantPrerempli', () => {
  it.each([
    ['montant libre avec minimum : le minimum', { montantLibre: true, montant: 2000, montantMinimum: 2000 }, 2000],
    ['montant libre sans minimum : rien (à saisir)', { montantLibre: true, montant: 0, montantMinimum: null }, 0],
    ['montant libre : ignore `montant` (recopie du minimum par le backend)', { montantLibre: true, montant: 9999, montantMinimum: 2000 }, 2000],
    ['montant fixe : le montant prévu', { montantLibre: false, montant: 5000, montantMinimum: null }, 5000],
    ['montant fixe inconnu : 0', { montantLibre: false, montant: null }, 0],
  ])('%s', (_cas, t, attendu) => {
    expect(montantPrerempli(t)).toBe(attendu)
  })
})

describe('FR24 aPaye', () => {
  it.each([
    [CotisationStatut.VALIDE, true],
    [CotisationStatut.EN_ATTENTE, true],
    [CotisationStatut.REFUSE, false],
    [null, false],
  ])('%s → %s', (statut, attendu) => {
    expect(aPaye({ statutCotisation: statut })).toBe(attendu)
  })
})

describe('FR24 avecEncaissementsRecents', () => {
  it('un membre encaissé pendant la séance passe tout de suite en payé, avec son montant', () => {
    const [awa, binta] = avecEncaissementsRecents([ligne('awa'), ligne('binta')], { awa: { cotisationId: 'cot-1', montant: 3000 } })

    expect(awa).toMatchObject({ statutCotisation: CotisationStatut.VALIDE, cotisationId: 'cot-1', montant: 3000 })
    expect(binta.statutCotisation).toBeNull()
  })

  it('le récapitulatif relu fait foi dès qu\'il indique un paiement', () => {
    const relu = ligne('awa', CotisationStatut.EN_ATTENTE, 2500)
    const [awa] = avecEncaissementsRecents([relu], { awa: { cotisationId: 'cot-1', montant: 3000 } })

    expect(awa).toBe(relu)
  })
})

describe('FR24 textePayes', () => {
  const lignes = [ligne('a', CotisationStatut.VALIDE), ligne('b', CotisationStatut.EN_ATTENTE), ligne('c'), ligne('d')]

  it('épargne journalière : « 2 / 4 payés aujourd’hui »', () => {
    expect(textePayes(lignes, true)).toBe('2 / 4 payés aujourd’hui')
  })

  it('autre rythme : « 2 / 4 payés »', () => {
    expect(textePayes(lignes, false)).toBe('2 / 4 payés')
  })

  it('singulier : « 1 / 2 payé »', () => {
    expect(textePayes([ligne('a', CotisationStatut.VALIDE), ligne('b')], false)).toBe('1 / 2 payé')
  })
})
