/** FR29 — Retraits d'une épargne : règles, textes, erreurs (lues dans `code`, B02). */
import { describe, it, expect } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import {
  dateRemisePourEnvoi, distributionNonFaite, erreurRetrait, estSolde, montantRetrait, moyenRemise, phraseRemise,
  titreRetraitRemis, verifierRetrait,
} from './retraits'

/** Erreur axios avec l'enveloppe du backend `{ code, message, data }` */
function erreurApi(status: number, code: string, data?: unknown, message = 'Message du serveur') {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError(message, 'ERR', config, null, {
    status, statusText: '', headers: {}, config, data: { status: 'error', statusCode: status, code, message, data },
  })
}

// 22/11/2026 à 10h, heure de Dakar (UTC)
const MAINTENANT = new Date('2026-11-22T10:00:00Z')

describe('FR29 estSolde', () => {
  it('vrai seulement quand soldeLe est renseigné', () => {
    expect(estSolde({ soldeLe: '2026-11-21T12:00:00' })).toBe(true)
    expect(estSolde({ soldeLe: null })).toBe(false)
    expect(estSolde({})).toBe(false)
    expect(estSolde(null)).toBe(false)
  })
})

describe('FR29 moyenRemise et montantRetrait', () => {
  it('Espèces par défaut pour un moyen inconnu ; Wave et Orange Money avec référence', () => {
    expect(moyenRemise('INCONNU').value).toBe('CASH')
    expect(moyenRemise('WAVE')).toMatchObject({ phrase: 'par Wave', reference: true })
    expect(moyenRemise('ORANGE_MONEY').reference).toBe(true)
    expect(moyenRemise('CASH').reference).toBe(false)
  })

  it('« Tout retirer » : tout le solde, quelle que soit la saisie', () => {
    expect(montantRetrait('TOTAL', 5000, 44000)).toBe(44000)
    expect(montantRetrait('PARTIEL', 5000, 44000)).toBe(5000)
  })
})

describe('FR29 verifierRetrait', () => {
  const ok = { nature: 'PARTIEL' as const, montant: 10000, solde: 44000, jour: '2026-11-21', debut: '2026-11-01', maintenant: MAINTENANT }

  it.each([
    ['retrait partiel daté d’hier : accepté', ok, null],
    ['aujourd’hui : accepté', { ...ok, jour: '2026-11-22' }, null],
    ['retrait total : le montant saisi est ignoré', { ...ok, nature: 'TOTAL' as const, montant: 0 }, null],
    ['solde nul', { ...ok, solde: 0 }, 'Rien à retirer : le solde est de 0F.'],
    ['montant vide', { ...ok, montant: 0 }, 'Saisissez le montant remis.'],
    ['au-delà du solde', { ...ok, montant: 50000 }, 'Le solde est de 44.000F : le retrait ne peut pas le dépasser.'],
    ['sans date', { ...ok, jour: '' }, 'Indiquez la date de remise.'],
    ['date future', { ...ok, jour: '2026-11-23' }, 'La date de remise ne peut pas être dans le futur.'],
    ['avant le début de la tontine', { ...ok, jour: '2026-10-31' }, 'La date de remise ne peut pas précéder le début de la tontine (01/11).'],
  ])('%s', (_cas, r, attendu) => {
    expect(verifierRetrait(r)).toBe(attendu)
  })
})

describe('FR29 dateRemisePourEnvoi', () => {
  it('aujourd’hui : rien (le backend prend l’heure exacte) ; jour passé : midi, heure locale sans fuseau', () => {
    expect(dateRemisePourEnvoi('2026-11-22', MAINTENANT)).toBeUndefined()
    expect(dateRemisePourEnvoi('2026-11-21', MAINTENANT)).toBe('2026-11-21T12:00:00')
  })
})

describe('FR29 phraseRemise', () => {
  it('retrait partiel : montant, moyen, bénéficiaire et ce qui restera', () => {
    expect(phraseRemise({ prenom: 'Awa', montant: 10000, methode: 'CASH', nature: 'PARTIEL', solde: 44000 }))
      .toBe('Remettre 10.000F en espèces à Awa. Il lui restera 34.000F.')
  })

  it('retrait total : le membre sera soldé(e)', () => {
    expect(phraseRemise({ prenom: 'Awa', montant: 44000, methode: 'WAVE', nature: 'TOTAL', solde: 44000 }))
      .toBe('Remettre 44.000F par Wave à Awa. Awa sera soldé(e) : plus de cotisation, et rien à recevoir à la fin.')
  })
})

describe('FR29 erreurRetrait', () => {
  it('RETRAIT_SOLDE_INSUFFISANT : affiche data.solde', () => {
    expect(erreurRetrait(erreurApi(400, 'RETRAIT_SOLDE_INSUFFISANT', { solde: 12000 })).texte)
      .toBe('Solde insuffisant : il reste 12.000F sur cette épargne.')
    expect(erreurRetrait(erreurApi(400, 'RETRAIT_SOLDE_INSUFFISANT')).texte).toBe('Solde insuffisant pour ce retrait.')
  })

  it('RETRAIT_COTISATIONS_EN_ATTENTE : data.cotisationsEnAttente, propose « Ouvrir À valider »', () => {
    const e = erreurRetrait(erreurApi(400, 'RETRAIT_COTISATIONS_EN_ATTENTE', { cotisationsEnAttente: 2 }))
    expect(e).toMatchObject({ aValider: true, reglages: false })
    expect(e.texte).toBe('2 cotisations en attente ou en retard : validez-les ou refusez-les avant le retrait total.')
    expect(erreurRetrait(erreurApi(400, 'RETRAIT_COTISATIONS_EN_ATTENTE', { cotisationsEnAttente: 1 })).texte).toMatch(/^1 cotisation en attente/)
    expect(erreurRetrait(erreurApi(400, 'RETRAIT_COTISATIONS_EN_ATTENTE')).texte).toMatch(/^Des cotisations en attente/)
  })

  it('RETRAIT_INTERDIT : propose les Réglages', () => {
    expect(erreurRetrait(erreurApi(400, 'RETRAIT_INTERDIT'))).toMatchObject({ reglages: true, aValider: false })
  })

  it.each([
    ['MEMBRE_SOLDE', /déjà tout retiré/],
    ['RETRAIT_NON_ANNULABLE', /annulez d’abord le retrait total/],
    ['RETRAIT_NON_DISPONIBLE', /répartition est déjà faite/],
  ])('%s : texte du front', (code, texte) => {
    expect(erreurRetrait(erreurApi(400, code)).texte).toMatch(texte)
  })

  it('code inconnu : message du serveur ; sans réponse : texte réseau', () => {
    expect(erreurRetrait(erreurApi(400, 'AUTRE_CODE', undefined, 'Refus du serveur')).texte).toBe('Refus du serveur')
    expect(erreurRetrait(new Error('boom'), 'Repli').texte).toBe('Repli')
  })

  it('ne lit jamais le texte : un message qui ressemble à un code ne change rien', () => {
    expect(erreurRetrait(erreurApi(400, 'VALIDATION_ERROR', undefined, 'RETRAIT_INTERDIT')).reglages).toBe(false)
  })
})

describe('FR29 distributionNonFaite', () => {
  it('vrai seulement pour le code DISTRIBUTION_NON_FAITE', () => {
    expect(distributionNonFaite(erreurApi(404, 'DISTRIBUTION_NON_FAITE'))).toBe(true)
    expect(distributionNonFaite(erreurApi(404, 'NOT_FOUND'))).toBe(false)
  })
})

describe('FR29 titreRetraitRemis', () => {
  it.each([
    ['Retrait de 10000 FCFA remis sur votre épargne Tabaski. Solde restant : 34000 FCFA.', 'Retrait de 10.000F enregistré'],
    ['Retrait de 10000.00 FCFA remis sur votre épargne Tabaski.', 'Retrait de 10.000F enregistré'],
    ['Votre retrait a été remis.', 'Retrait enregistré'],
    [null, 'Retrait enregistré'],
  ])('%s → %s', (corps, attendu) => {
    expect(titreRetraitRemis(corps)).toBe(attendu)
  })
})
