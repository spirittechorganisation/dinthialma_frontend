/**
 * Caractérisation de ToursPage (spec 01, tâche 4.6) — liste des tours d'une tontine.
 *
 * Données : GET /v1/tontines/:id (tontine + mon rôle), GET …/cycles (size=200).
 * Tour en cours épinglé, puis les autres du plus récent au plus ancien.
 * Gestionnaire, tontine active en mode manuel, sans tour en cours : « Démarrer le tour suivant »
 * (proposition GET …/cycles/proposition, puis POST …/cycles).
 * Desktop : le détail du tour s'ouvre dans un panneau à droite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor, fireEvent, act } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { http } from 'msw'
import { API, ok, page, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { unCycle } from '@/test/factories/cycle'
import { uneTontine } from '@/test/factories/tontine'
import { CycleStatut, ModeCycle, TontineStatut } from '@/types/common'
import { TontineType, type Tontine } from '@/types/tontine'
import type { Cycle } from '@/types/cycle'
import { ToursPage } from './ToursPage'

// ─── Données ─────────────────────────────────────────────────────────────────

function tontine(surcharge: Partial<Tontine> & { monRole?: string } = {}) {
  server.use(http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({
    id: 't1', nom: 'Famille', monRole: 'GESTIONNAIRE', statut: TontineStatut.ACTIVE, modeCycle: ModeCycle.MANUEL,
    ...surcharge,
  } as never))))
}

function tours(liste: Cycle[]) {
  const requetes: URL[] = []
  server.use(http.get(`${API}/v1/tontines/t1/cycles`, ({ request }) => {
    requetes.push(new URL(request.url))
    return page(liste)
  }))
  return requetes
}

const T4 = unCycle({
  id: 'c4', numeroCycle: 4, statut: CycleStatut.TERMINE, dateDebut: '2026-08-01', dateFin: '2026-08-31', montantNet: 47500,
  gagnants: [{ membreId: 'm-awa', userId: 'u-awa', firstName: 'Awa', lastName: 'Diop', phone: '', ordreJackpot: 4, montantRecu: 47500, dateJackpot: null }],
})
const T5 = unCycle({ id: 'c5', numeroCycle: 5, statut: CycleStatut.TERMINE, dateDebut: '2026-09-01', dateFin: '2026-09-30', montantNet: 50000 })
const T6 = unCycle({ id: 'c6', numeroCycle: 6, statut: CycleStatut.EN_COURS, dateDebut: '2026-11-01', dateFin: '2026-11-30', nombreEcheances: 3, tousPayes: true })

function afficher(route = '/tontine/t1/tours') {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/tontine/:id/tours" element={<ToursPage />} />
        <Route path="/tontine/:id/tours/:cycleId" element={<ToursPage />} />
      </Routes>
      <Toaster />
    </>,
    { route, auth: 'gestionnaire' },
  )
}

const lien = (nom: RegExp) => screen.getByRole('link', { name: nom })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T10:00:00Z'))
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

afterEach(() => {
  act(() => { toast.dismiss() })
  vi.useRealTimers()
})

// ─── Liste ───────────────────────────────────────────────────────────────────

describe('[caractérisation] ToursPage — liste des tours', () => {
  it('épingle le tour en cours puis liste les autres du plus récent au plus ancien', async () => {
    tontine({ modeCycle: ModeCycle.AUTOMATIQUE })
    const requetes = tours([T4, T6, T5])
    afficher()

    expect(await screen.findByRole('heading', { name: 'Tours · Famille' })).toBeInTheDocument()
    const enCours = screen.getByRole('heading', { name: 'En cours' }).nextElementSibling as HTMLElement
    expect(within(enCours).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/tontine/t1/tours/c6'])
    const autres = screen.getByRole('heading', { name: 'Tous les tours' }).nextElementSibling as HTMLElement
    expect(within(autres).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/tontine/t1/tours/c5', '/tontine/t1/tours/c4'])
    expect(Object.fromEntries(requetes[0].searchParams)).toEqual({ page: '0', size: '200', sort: 'numeroCycle,asc' })
  })

  it('détail de chaque ligne : statut, dates, nombre de cotisations, gagnant, montant net, « Jackpot prêt »', async () => {
    tontine({ modeCycle: ModeCycle.AUTOMATIQUE })
    tours([T4, T6])
    afficher()

    await screen.findByRole('heading', { name: 'En cours' })
    expect(lien(/Tour 6/)).toHaveTextContent('6Tour 6En cours1 nov. → 30 nov. · 3 cotisationsJackpot prêt')
    expect(lien(/Tour 4/)).toHaveTextContent('4Tour 4Terminé1 août → 31 août · Awa47.500F')
  })

  it('tontine événementielle : « Périodes » et « Période N »', async () => {
    tontine({ nom: 'Mariage', tontineType: TontineType.EVENEMENTIELLE, modeCycle: ModeCycle.AUTOMATIQUE })
    tours([unCycle({ id: 'p1', numeroCycle: 1, statut: CycleStatut.TERMINE }), unCycle({ id: 'p2', numeroCycle: 2, statut: CycleStatut.EN_COURS })])
    afficher()

    expect(await screen.findByRole('heading', { name: 'Périodes · Mariage' })).toBeInTheDocument()
    expect(lien(/Période 2/)).toBeInTheDocument()
    // BUG: accord manquant : « Tous les périodes » au lieu de « Toutes les périodes ».
    expect(screen.getByRole('heading', { name: 'Tous les périodes' })).toBeInTheDocument()
  })

  it('aucun tour (membre) : le premier tour sera ouvert par le gestionnaire', async () => {
    tontine({ monRole: 'MEMBRE' })
    tours([])
    afficher()

    expect(await screen.findByText('Aucun tour pour l\'instant')).toBeInTheDocument()
    expect(screen.getByText('Le premier tour sera ouvert par le gestionnaire.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Démarrer/ })).not.toBeInTheDocument()
  })

  it('aucune période (événement) : texte au masculin', async () => {
    tontine({ monRole: 'MEMBRE', tontineType: TontineType.EVENEMENTIELLE })
    tours([])
    afficher()

    // BUG: accord manquant : « Aucun période pour l'instant » au lieu de « Aucune période pour l'instant ».
    expect(await screen.findByText('Aucun période pour l\'instant')).toBeInTheDocument()
  })

  it('erreur de chargement : message et Réessayer qui relance la requête', async () => {
    tontine()
    let appels = 0
    server.use(http.get(`${API}/v1/tontines/t1/cycles`, () => {
      appels++
      return appels === 1 ? erreur(500, 'INTERNAL_ERROR', 'Panne') : page([T6])
    }))
    const { user } = afficher()

    expect(await screen.findByText('Impossible de charger les tours.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByRole('heading', { name: 'En cours' })).toBeInTheDocument()
    expect(appels).toBe(2)
  })

  it('desktop : le tour choisi s\'ouvre dans un panneau à droite', async () => {
    const matchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width: 1024px'), media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
    try {
      tontine({ modeCycle: ModeCycle.AUTOMATIQUE })
      tours([T6])
      server.use(
        http.get(`${API}/v1/tontines/t1/cycles/c6`, () => ok(T6)),
        http.get(`${API}/v1/tontines/t1/cotisations/recap/c6`, () => page([])),
      )
      afficher('/tontine/t1/tours/c6')

      const panneau = await screen.findByRole('complementary', { name: 'Détail du tour' })
      expect(await within(panneau).findByRole('heading', { name: 'Tour 6 · Famille' })).toBeInTheDocument()
      expect(lien(/Tour 6/)).toHaveAttribute('aria-current', 'true')
    } finally {
      window.matchMedia = matchMedia
    }
  })
})

// ─── Démarrer un tour (mode manuel) ──────────────────────────────────────────

describe('[caractérisation] ToursPage — démarrer un tour (mode manuel)', () => {
  /** Proposition du backend : renvoie les dates de début demandées */
  function proposition(dateFin = '2026-12-19', echeances = ['2026-11-27T23:59:00Z', '2026-12-04T23:59:00Z', '2026-12-11T23:59:00Z', '2026-12-19T23:59:00Z']) {
    const debuts: (string | null)[] = []
    server.use(http.get(`${API}/v1/tontines/t1/cycles/proposition`, ({ request }) => {
      const debut = new URL(request.url).searchParams.get('dateDebut')
      debuts.push(debut)
      return ok({ dateDebut: debut, dateFin, echeances })
    }))
    return debuts
  }

  function ouvertures(reponse: () => Response = () => ok(unCycle({ id: 'c7', numeroCycle: 7, statut: CycleStatut.EN_COURS }))) {
    const corps: unknown[] = []
    server.use(http.post(`${API}/v1/tontines/t1/cycles`, async ({ request }) => {
      corps.push(await request.json())
      return reponse()
    }))
    return corps
  }

  it('aucun tour : « Démarrer le premier tour »', async () => {
    tontine()
    tours([])
    afficher()

    expect(await screen.findByText('Démarrez le premier tour pour commencer à collecter.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Démarrer le premier tour' })).toBeEnabled()
  })

  it('garde la date proposée : POST avec la date de début seule', async () => {
    tontine()
    tours([T5, T4])
    const debuts = proposition()
    const corps = ouvertures()
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Démarrer le tour suivant' }))
    const feuille = await screen.findByRole('dialog', { name: 'Démarrer un tour' })
    expect(within(feuille).getByLabelText('Début')).toHaveValue('2026-11-20')
    await waitFor(() => expect(within(feuille).getByLabelText(/^Fin/)).toHaveValue('2026-12-19'))
    expect(within(feuille).getByText('Date proposée selon le rythme de la tontine : 4 cotisations, la dernière avant sam. 19 déc..')).toBeInTheDocument()
    expect(debuts).toEqual(['2026-11-20'])

    await user.click(within(feuille).getByRole('button', { name: 'Démarrer' }))

    expect(await screen.findByText('Tour démarré')).toBeInTheDocument()
    expect(corps).toEqual([{ dateDebut: '2026-11-20' }])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('choisit une autre date de fin : envoyée, et « Reprendre la date proposée » la rétablit', async () => {
    tontine()
    tours([T5])
    proposition()
    const corps = ouvertures()
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Démarrer le tour suivant' }))
    const feuille = await screen.findByRole('dialog', { name: 'Démarrer un tour' })
    const fin = within(feuille).getByLabelText(/^Fin/)
    await waitFor(() => expect(fin).toHaveValue('2026-12-19'))

    fireEvent.change(fin, { target: { value: '2026-12-31' } })
    expect(within(feuille).queryByText(/Date proposée selon le rythme/)).not.toBeInTheDocument()
    // BUG: le bouton « Reprendre la date proposée » est placé DANS le <label> « Fin » : un label se rattache
    // au premier élément interactif qu'il contient, donc dès que ce bouton apparaît, le libellé « Fin » passe
    // au bouton et le champ de date n'a plus de libellé (lecteurs d'écran). Attendu : bouton hors du <label>.
    expect(within(feuille).getByLabelText(/^Fin/).tagName).toBe('BUTTON')
    await user.click(within(feuille).getByText('Reprendre la date proposée'))
    expect(fin).toHaveValue('2026-12-19')

    fireEvent.change(fin, { target: { value: '2026-12-31' } })
    await user.click(within(feuille).getByRole('button', { name: 'Démarrer' }))

    await screen.findByText('Tour démarré')
    expect(corps).toEqual([{ dateDebut: '2026-11-20', dateFin: '2026-12-31' }])
  })

  it('changer le début redemande la proposition et repart de la date proposée', async () => {
    tontine()
    tours([T5])
    const debuts = proposition()
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Démarrer le tour suivant' }))
    const feuille = await screen.findByRole('dialog', { name: 'Démarrer un tour' })
    await waitFor(() => expect(debuts).toEqual(['2026-11-20']))
    fireEvent.change(within(feuille).getByLabelText(/^Fin/), { target: { value: '2026-12-31' } })

    fireEvent.change(within(feuille).getByLabelText('Début'), { target: { value: '2026-11-25' } })

    await waitFor(() => expect(debuts).toEqual(['2026-11-20', '2026-11-25']))
    expect(within(feuille).getByRole('button', { name: 'Démarrer' })).toBeEnabled()
    expect(within(feuille).queryByRole('button', { name: 'Reprendre la date proposée' })).not.toBeInTheDocument()
  })

  it('fin avant le début : message et « Démarrer » inactif', async () => {
    tontine()
    tours([T5])
    proposition()
    const corps = ouvertures()
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Démarrer le tour suivant' }))
    const feuille = await screen.findByRole('dialog', { name: 'Démarrer un tour' })
    fireEvent.change(within(feuille).getByLabelText(/^Fin/), { target: { value: '2026-11-10' } })

    expect(within(feuille).getByText('La fin doit être après le début.')).toBeInTheDocument()
    expect(within(feuille).getByRole('button', { name: 'Démarrer' })).toBeDisabled()
    expect(corps).toEqual([])
  })

  it('ouverture refusée (tour déjà en cours) : message traduit, la feuille reste ouverte', async () => {
    tontine()
    tours([T5])
    proposition()
    ouvertures(() => erreur(409, 'CYCLE_ALREADY_IN_PROGRESS', 'Déjà en cours'))
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Démarrer le tour suivant' }))
    const feuille = await screen.findByRole('dialog', { name: 'Démarrer un tour' })
    await user.click(within(feuille).getByRole('button', { name: 'Démarrer' }))

    expect(await screen.findByText('Un tour est déjà en cours : clôturez-le d\'abord.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Démarrer un tour' })).toBeInTheDocument()
  })

  it('proposition indisponible : fin vide, démarrage possible avec la date de début seule', async () => {
    tontine()
    tours([T5])
    server.use(http.get(`${API}/v1/tontines/t1/cycles/proposition`, () => erreur(500, 'INTERNAL_ERROR', 'Panne')))
    const corps = ouvertures()
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Démarrer le tour suivant' }))
    const feuille = await screen.findByRole('dialog', { name: 'Démarrer un tour' })
    expect(within(feuille).getByLabelText(/^Fin/)).toHaveValue('')
    await user.click(within(feuille).getByRole('button', { name: 'Démarrer' }))

    await screen.findByText('Tour démarré')
    expect(corps).toEqual([{ dateDebut: '2026-11-20' }])
  })

  it.each([
    ['un tour est en cours', { modeCycle: ModeCycle.MANUEL }, [T6, T5]],
    ['les tours sont automatiques', { modeCycle: ModeCycle.AUTOMATIQUE }, [T5]],
    ['la tontine n\'est pas active', { statut: TontineStatut.SUSPENDUE }, [T5]],
    ['je suis membre', { monRole: 'MEMBRE' }, [T5]],
  ])('pas de bouton « Démarrer » quand %s', async (_cas, surcharge, liste) => {
    tontine(surcharge as never)
    tours(liste as Cycle[])
    afficher()

    await screen.findAllByRole('heading', { name: /Tous les tours|En cours/ })
    expect(screen.queryByRole('button', { name: /Démarrer/ })).not.toBeInTheDocument()
  })

  it('hors connexion : bouton « Démarrer le tour suivant » inactif', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    tontine()
    tours([T5])
    afficher()

    expect(await screen.findByRole('button', { name: 'Démarrer le tour suivant' })).toBeDisabled()
  })
})
