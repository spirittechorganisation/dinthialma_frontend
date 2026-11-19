/**
 * Caractérisation de RecuPage (spec 01, tâche 4.3) — reçu / détail d'un paiement.
 *
 * Données : GET cotisation, GET tontine (nom + mon rôle), GET du tour (numéro, statut).
 * Membre : consulte et partage. Gestionnaire : valide (PUT …/valider), refuse avec motif
 * (PUT …/refuser) et modifie un paiement encore modifiable (PATCH, champs changés seulement).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import { Routes, Route, Link } from 'react-router-dom'
import { Toaster } from 'sonner'
import { http, HttpResponse } from 'msw'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Depart, Emplacement, emplacement } from '@/test/router'
import { uneCotisation } from '@/test/factories/cotisation'
import { uneTontine } from '@/test/factories/tontine'
import { unCycle } from '@/test/factories/cycle'
import { CotisationStatut, CycleStatut } from '@/types/common'
import type { Cotisation } from '@/types/cotisation'
import { RecuPage } from './RecuPage'

// ─── Données ─────────────────────────────────────────────────────────────────

const RECU = '/recu/t1/cot1'

function cotisation(surcharge: Partial<Cotisation> = {}) {
  server.use(http.get(`${API}/v1/tontines/t1/cotisations/cot1`, () => ok(uneCotisation({
    id: 'cot1', cycleId: 'c1', referenceTransaction: 'TX-998877', ...surcharge,
  }))))
}

/** Tontine « Famille » ; `monRole` décide des actions de gestion */
function tontine(monRole: 'MEMBRE' | 'GESTIONNAIRE' | 'GESTIONNAIRE_ET_MEMBRE' = 'MEMBRE') {
  server.use(http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({ id: 't1', nom: 'Famille', monRole } as never))))
}

function tour(statut: CycleStatut = CycleStatut.EN_COURS) {
  server.use(http.get(`${API}/v1/tontines/t1/cycles/c1`, () => ok(unCycle({ id: 'c1', numeroCycle: 6, statut }))))
}

/** Lignes du détail sous forme { libellé: valeur } */
function details(): Record<string, string> {
  const termes = screen.getAllByRole('term')
  return Object.fromEntries(termes.map((dt) => [dt.textContent, dt.nextElementSibling?.textContent ?? '']))
}

/** Ouvre le reçu juste après une déclaration (état justCreated) */
function afficherApresDeclaration() {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/payer/t1" element={<Depart to={RECU} state={{ justCreated: true }} />} />
        <Route path="/recu/:tontineId/:cotisationId" element={<RecuPage />} />
        <Route path="/accueil" element={<p>Accueil</p>} />
      </Routes>
      <Emplacement />
      <Toaster />
    </>,
    { route: '/payer/t1', auth: 'membre' },
  )
}

/** Ouvre le reçu depuis l'historique (lien), comme le ferait le fil d'activité */
async function afficherDepuisHistorique(auth: 'membre' | 'gestionnaire' = 'membre') {
  const rendu = renderWithProviders(
    <>
      <Routes>
        <Route path="/historique" element={<Link to={RECU}>Ouvrir le reçu</Link>} />
        <Route path="/recu/:tontineId/:cotisationId" element={<RecuPage />} />
      </Routes>
      <Emplacement />
      <Toaster />
    </>,
    { route: '/historique', auth },
  )
  await rendu.user.click(screen.getByRole('link', { name: 'Ouvrir le reçu' }))
  return rendu
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T10:00:00Z'))
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  tontine()
  tour()
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── Membre ──────────────────────────────────────────────────────────────────

describe('[caractérisation] RecuPage — membre', () => {
  it('juste après la déclaration : statut, montant, détail complet et « Terminé » vers l\'accueil', async () => {
    cotisation({ methodePaiement: 'CASH' })
    const { user } = afficherApresDeclaration()

    expect(await screen.findByText('En attente de validation')).toBeInTheDocument()
    expect(screen.getByText('5.000 FCFA')).toBeInTheDocument()
    expect(screen.getByText('Le gestionnaire va vérifier et valider votre paiement.')).toBeInTheDocument()
    await waitFor(() => expect(details().Tontine).toBe('Famille · Tour 6'))
    expect(details()).toEqual({
      Tontine: 'Famille · Tour 6',
      Membre: 'Test User',
      Moyen: 'Espèces',
      Référence: 'TX-998877',
      Date: '1 nov. · 10:00',
      Origine: 'Déclaré par le membre',
    })
    // Membre : pas d'action de gestion
    expect(screen.queryByRole('button', { name: /Valider ce paiement|Modifier/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir la tontine' })).toHaveAttribute('href', '/tontine/t1')

    await user.click(screen.getByRole('button', { name: 'Terminé' }))
    expect(emplacement()).toBe('/accueil')
  })

  it('ouvert depuis l\'historique : pas de message d\'attente, « Terminé » revient à l\'écran précédent', async () => {
    cotisation()
    const { user } = await afficherDepuisHistorique()

    expect(await screen.findByText('En attente de validation')).toBeInTheDocument()
    expect(screen.queryByText('Le gestionnaire va vérifier et valider votre paiement.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Terminé' }))
    expect(emplacement()).toBe('/historique')
  })

  it('paiement validé : date de validation affichée', async () => {
    cotisation({ statut: CotisationStatut.VALIDE, dateValidation: '2026-11-02T18:30:00Z' })
    afficherApresDeclaration()

    expect(await screen.findByText('Validé')).toBeInTheDocument()
    expect(details()['Validé le']).toBe('2 nov. · 18:30')
    // Validé : plus de message d'attente même juste après la déclaration
    expect(screen.queryByText('Le gestionnaire va vérifier et valider votre paiement.')).not.toBeInTheDocument()
  })

  it('paiement refusé : motif et date du refus affichés', async () => {
    cotisation({ statut: CotisationStatut.REFUSE, motifRefus: 'Transfert non reçu', dateRefus: '2026-11-03T08:05:00Z' })
    afficherApresDeclaration()

    expect(await screen.findByText('Refusé')).toBeInTheDocument()
    expect(details()['Motif du refus']).toBe('Transfert non reçu')
    expect(details()['Refusé le']).toBe('3 nov. · 08:05')
  })

  it('paiement encaissé par le gestionnaire : origine « Encaissé par … »', async () => {
    cotisation({ enregistrePar: { id: 'u-gest', firstName: 'Moussa', lastName: 'Diop' } as never })
    afficherApresDeclaration()

    await screen.findByText('En attente de validation')
    expect(details().Origine).toBe('Encaissé par Moussa Diop')
  })

  it('partage le reçu avec un texte récapitulatif', async () => {
    cotisation({ methodePaiement: 'CASH' })
    const { user } = afficherApresDeclaration()
    await waitFor(() => expect(screen.getByText('5.000 FCFA')).toBeInTheDocument())
    await waitFor(() => expect(details().Tontine).toBe('Famille · Tour 6'))

    await user.click(screen.getByRole('button', { name: 'Partager' }))

    expect(navigator.share).toHaveBeenCalledWith({
      title: 'Reçu Dinthialma',
      text: 'Reçu Dinthialma — 5.000 FCFA · Famille · Tour 6 · Test User · En attente de validation · 1 nov. · 10:00',
      url: 'http://localhost/',
    })
  })
})

// ─── Gestionnaire ────────────────────────────────────────────────────────────

describe('[caractérisation] RecuPage — gestionnaire', () => {
  beforeEach(() => { tontine('GESTIONNAIRE') })

  it('valide un paiement en attente (PUT …/valider) et le confirme', async () => {
    cotisation()
    const validations: string[] = []
    server.use(http.put(`${API}/v1/tontines/:tontineId/cotisations/:cotisationId/valider`, ({ request, params }) => {
      validations.push(`${request.method} ${params.tontineId}/${params.cotisationId}`)
      return ok(uneCotisation({ id: 'cot1', statut: CotisationStatut.VALIDE }))
    }))
    const { user } = await afficherDepuisHistorique('gestionnaire')

    await user.click(await screen.findByRole('button', { name: 'Valider ce paiement' }))

    expect(await screen.findByText('Paiement de Test validé')).toBeInTheDocument()
    expect(validations).toEqual(['PUT t1/cot1'])
  })

  it('refuse avec un motif obligatoire (PUT …/refuser, corps { motif })', async () => {
    cotisation()
    const corps: unknown[] = []
    server.use(http.put(`${API}/v1/tontines/t1/cotisations/cot1/refuser`, async ({ request }) => {
      corps.push(await request.json())
      return ok(uneCotisation({ id: 'cot1', statut: CotisationStatut.REFUSE }))
    }))
    const { user } = await afficherDepuisHistorique('gestionnaire')

    await user.click(await screen.findByRole('button', { name: 'Refuser ce paiement' }))
    const feuille = await screen.findByRole('dialog', { name: 'Refuser le paiement de Test ?' })
    expect(within(feuille).getByText('5.000 FCFA · le membre verra le motif et pourra déclarer à nouveau.')).toBeInTheDocument()
    // Sans motif : refus impossible
    expect(within(feuille).getByRole('button', { name: 'Refuser' })).toBeDisabled()

    await user.click(within(feuille).getByRole('button', { name: 'Montant incorrect' }))
    await user.type(within(feuille).getByRole('textbox'), ' (3 000 reçus)')
    await user.click(within(feuille).getByRole('button', { name: 'Refuser' }))

    expect(await screen.findByText('Paiement refusé')).toBeInTheDocument()
    expect(corps).toEqual([{ motif: 'Montant incorrect (3 000 reçus)' }])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('modifie un paiement en attente : n\'envoie que les champs changés (PATCH)', async () => {
    cotisation({ methodePaiement: 'CASH', note: 'Remis en main propre' })
    const corps: unknown[] = []
    server.use(http.patch(`${API}/v1/tontines/t1/cotisations/cot1`, async ({ request }) => {
      corps.push(await request.json())
      return ok(uneCotisation({ id: 'cot1', montant: 6000 }))
    }))
    const { user } = await afficherDepuisHistorique('gestionnaire')

    await user.click(await screen.findByRole('button', { name: 'Modifier' }))
    const modale = await screen.findByRole('dialog', { name: 'Modifier la cotisation — Test User' })
    const montant = within(modale).getByRole('spinbutton')
    expect(montant).toHaveValue(5000)
    await user.clear(montant)
    await user.type(montant, '6000')
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    expect(await screen.findByText('Cotisation mise à jour avec succès')).toBeInTheDocument()
    expect(corps).toEqual([{ montant: 6000 }])
  })

  it('modification sans changement : rien n\'est envoyé, la fenêtre se ferme', async () => {
    cotisation()
    let patchs = 0
    server.use(http.patch(`${API}/v1/tontines/t1/cotisations/cot1`, () => { patchs++; return ok(uneCotisation({ id: 'cot1' })) }))
    const { user } = await afficherDepuisHistorique('gestionnaire')

    await user.click(await screen.findByRole('button', { name: 'Modifier' }))
    await screen.findByRole('dialog', { name: /Modifier la cotisation/ })
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(patchs).toBe(0)
  })

  it.each([
    ['validé sur un tour en cours : modifiable, plus validable', CotisationStatut.VALIDE, CycleStatut.EN_COURS, true],
    ['validé sur un tour terminé : ni modifiable ni validable', CotisationStatut.VALIDE, CycleStatut.TERMINE, false],
    ['refusé : ni modifiable ni validable', CotisationStatut.REFUSE, CycleStatut.EN_COURS, false],
  ])('paiement %s', async (_cas, statut, statutTour, modifiable) => {
    tour(statutTour)
    cotisation({ statut })
    await afficherDepuisHistorique('gestionnaire')

    await screen.findByText('5.000 FCFA')
    await waitFor(() => expect(details().Tontine).toBe('Famille · Tour 6'))
    expect(screen.queryByRole('button', { name: 'Valider ce paiement' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refuser ce paiement' })).not.toBeInTheDocument()
    expect(!!screen.queryByRole('button', { name: 'Modifier' })).toBe(modifiable)
    expect(!!screen.queryByRole('link', { name: 'Voir la tontine' })).toBe(!modifiable)
    expect(screen.getByRole('button', { name: 'Terminé' })).toBeInTheDocument()
  })
})

// ─── Erreurs ─────────────────────────────────────────────────────────────────

describe('[caractérisation] RecuPage — erreurs', () => {
  it('paiement introuvable : message et Réessayer qui relance la requête', async () => {
    let appels = 0
    server.use(http.get(`${API}/v1/tontines/t1/cotisations/cot1`, () => {
      appels++
      return appels === 1 ? erreur(404, 'NOT_FOUND', 'Introuvable') : ok(uneCotisation({ id: 'cot1' }))
    }))
    const { user } = afficherApresDeclaration()

    expect(await screen.findByText('Paiement introuvable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('5.000 FCFA')).toBeInTheDocument()
    expect(appels).toBe(2)
  })

  it('validation en échec : message d\'erreur, le paiement reste à valider', async () => {
    tontine('GESTIONNAIRE')
    cotisation()
    server.use(http.put(`${API}/v1/tontines/t1/cotisations/cot1/valider`, () => erreur(500, 'INTERNAL_ERROR', 'Panne')))
    const { user } = await afficherDepuisHistorique('gestionnaire')

    await user.click(await screen.findByRole('button', { name: 'Valider ce paiement' }))

    expect(await screen.findByText('La validation a échoué. Réessayez.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Valider ce paiement' })).toBeEnabled()
  })

  it('refus en échec (déjà traité) : message traduit, la feuille reste ouverte', async () => {
    tontine('GESTIONNAIRE')
    cotisation()
    server.use(http.put(`${API}/v1/tontines/t1/cotisations/cot1/refuser`, () => erreur(409, 'COTISATION_NOT_PENDING', 'Déjà traité')))
    const { user } = await afficherDepuisHistorique('gestionnaire')

    await user.click(await screen.findByRole('button', { name: 'Refuser ce paiement' }))
    const feuille = await screen.findByRole('dialog', { name: /Refuser le paiement/ })
    await user.click(within(feuille).getByRole('button', { name: 'Doublon' }))
    await user.click(within(feuille).getByRole('button', { name: 'Refuser' }))

    expect(await screen.findByText('Ce paiement a déjà été traité.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /Refuser le paiement/ })).toBeInTheDocument()
    expect(within(feuille).getByRole('button', { name: 'Refuser' })).toBeEnabled()
  })

  it('modification en échec : message du backend affiché', async () => {
    tontine('GESTIONNAIRE')
    cotisation()
    server.use(http.patch(`${API}/v1/tontines/t1/cotisations/cot1`, () => erreur(409, 'COTISATION_NOT_EDITABLE', 'Ce paiement est verrouillé.')))
    const { user } = await afficherDepuisHistorique('gestionnaire')

    await user.click(await screen.findByRole('button', { name: 'Modifier' }))
    const modale = await screen.findByRole('dialog', { name: /Modifier la cotisation/ })
    const montant = within(modale).getByRole('spinbutton')
    await user.clear(montant)
    await user.type(montant, '7000')
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    // La modale lit `message` du backend, pas la traduction par code
    expect(await screen.findByText('Ce paiement est verrouillé.')).toBeInTheDocument()
  })

  it('erreur réseau au partage sans navigator.share : repli sur le presse-papiers', async () => {
    cotisation()
    const partageNatif = navigator.share
    Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: undefined })
    try {
      const { user } = afficherApresDeclaration()
      await screen.findByText('5.000 FCFA')

      await user.click(screen.getByRole('button', { name: 'Partager' }))

      expect(await screen.findByText('Lien copié')).toBeInTheDocument()
      expect(await navigator.clipboard.readText()).toMatch(/^Reçu Dinthialma — 5\.000 FCFA · Famille/)
    } finally {
      Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: partageNatif })
    }
  })

  it('hors connexion (gestionnaire) : valider, refuser et modifier sont inactifs', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    tontine('GESTIONNAIRE')
    cotisation()
    let ecritures = 0
    server.use(http.put(`${API}/v1/tontines/t1/cotisations/cot1/valider`, () => { ecritures++; return HttpResponse.json({}) }))
    const { user } = await afficherDepuisHistorique('gestionnaire')

    const valider = await screen.findByRole('button', { name: 'Connexion requise' })
    expect(valider).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Refuser ce paiement' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeDisabled()
    await user.click(valider)
    expect(ecritures).toBe(0)
  })
})
