/**
 * Caractérisation de EncaisserPage et EncaisserDesktop (spec 01, tâche 4.5) — encaisser un paiement.
 *
 * Données : GET /v1/admin/my-dashboard (résumé « Je gère » : tontines et tour en cours),
 * GET /v1/tontines/:id, GET …/cotisations/recap/:cycleId (size=200, `echeanceId` pour un retard),
 * GET …/cycles/:tour (retard sur un tour déjà remis).
 * Écriture : POST …/cotisations/admin (paiement enregistré et validé tout de suite), puis reçu.
 * Mobile : « Pour quelle tontine ? » → « De qui ? » → « Combien ? ». Desktop : liste et formulaire côte à côte.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor, fireEvent } from '@testing-library/react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { http, HttpResponse, delay } from 'msw'
import { API, ok, page, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement, emplacement, etatNavigation } from '@/test/router'
import { unCycle } from '@/test/factories/cycle'
import { uneCotisation } from '@/test/factories/cotisation'
import { AccountStatus, CotisationStatut, MembreStatut } from '@/types/common'
import type { CycleRecapLigne } from '@/types/cotisation'
import { EncaisserPage } from './EncaisserPage'

// ─── Données ─────────────────────────────────────────────────────────────────

type Brut = Record<string, unknown>

/** Tontine du tableau de bord « Je gère » (format brut de GET /v1/admin/my-dashboard) */
function uneTontineGeree(surcharge: Brut = {}, tour: Brut | null = {}): Brut {
  return {
    tontineId: 't1', nom: 'Famille', tontineType: 'ROTATIVE', montant: 5000, montantLibre: false,
    cycleEnCours: tour === null ? null : {
      cycleId: 'c6', numeroCycle: 6, dateFin: '2026-11-30', nombreEcheances: 1, numeroEcheanceCourante: 1,
      membresAyantPaye: 1, membresEnAttente: 1, membresActifs: 4, ...tour,
    },
    ...surcharge,
  }
}

function tableauDeBord(...tontines: Brut[]) {
  server.use(http.get(`${API}/v1/admin/my-dashboard`, () => ok({
    nombreTontinesGerees: tontines.length,
    tontines: { content: tontines, page: { number: 0, size: 100, totalElements: tontines.length, totalPages: 1 } },
  })))
}

function uneLigne(prenom: string, surcharge: Partial<CycleRecapLigne> = {}): CycleRecapLigne {
  const id = prenom.toLowerCase()
  return {
    membreId: `m-${id}`, userId: `u-${id}`, firstName: prenom, lastName: 'Sarr', phone: `+2217700000${prenom.length}`,
    statutMembre: MembreStatut.ACTIF, ordreJackpot: null, cotisationId: null, montant: null, methodePaiement: null,
    statutCotisation: null, dateValidation: null, accountStatus: AccountStatus.ACTIVE, ...surcharge,
  }
}

/** 2 à encaisser (Cheikh n° 3 sans compte, Dior), 2 déjà payés (Awa validée, Bineta en attente), 1 sorti */
const MEMBRES = [
  uneLigne('Awa', { cotisationId: 'cot-a', montant: 5000, statutCotisation: CotisationStatut.VALIDE }),
  uneLigne('Bineta', { cotisationId: 'cot-b', montant: 5000, statutCotisation: CotisationStatut.EN_ATTENTE }),
  uneLigne('Cheikh', { ordreJackpot: 3, accountStatus: AccountStatus.PRE_ENROLLED }),
  uneLigne('Dior'),
  uneLigne('Ely', { statutMembre: MembreStatut.SORTI }),
]

function recap(lignes: CycleRecapLigne[] = MEMBRES, cycleId = 'c6') {
  const requetes: URL[] = []
  server.use(http.get(`${API}/v1/tontines/t1/cotisations/recap/${cycleId}`, ({ request }) => {
    requetes.push(new URL(request.url))
    return page(lignes)
  }))
  return requetes
}

/** Capture les encaissements (POST …/cotisations/admin) */
function encaissements(reponse: () => Response | Promise<Response> = () => ok(uneCotisation({ id: 'cot-admin', statut: CotisationStatut.VALIDE }))) {
  const corps: Brut[] = []
  server.use(http.post(`${API}/v1/tontines/t1/cotisations/admin`, async ({ request }) => {
    corps.push((await request.json()) as Brut)
    return reponse()
  }))
  return corps
}

/** Affiche aussi la chaîne de recherche (?membre=…) */
function Requete() {
  const { search } = useLocation()
  return <output aria-label="Paramètres">{search}</output>
}
const parametres = () => screen.getByRole('status', { name: 'Paramètres' }).textContent

function afficher(route: string) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/encaisser" element={<EncaisserPage />} />
        <Route path="/encaisser/:tontineId" element={<EncaisserPage />} />
        <Route path="/recu/:tontineId/:cotisationId" element={<p>Reçu</p>} />
        <Route path="/tontine/:id/tours" element={<p>Tours</p>} />
      </Routes>
      <Emplacement />
      <Requete />
    </>,
    { route, auth: 'gestionnaire' },
  )
}

/** Simule un écran large (≥ 1024 px) pour la version desktop */
function ecranLarge() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('min-width: 1024px'), media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

const matchMediaOrigine = window.matchMedia
const section = (titre: string) => screen.getByRole('heading', { name: titre }).parentElement as HTMLElement

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T10:00:00Z'))
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

afterEach(() => {
  window.matchMedia = matchMediaOrigine
  vi.useRealTimers()
})

// ─── « Pour quelle tontine ? » ───────────────────────────────────────────────

describe('[caractérisation] EncaisserPage — choix de la tontine (/encaisser)', () => {
  it('une seule tontine avec un tour en cours : va directement à « De qui ? »', async () => {
    tableauDeBord(uneTontineGeree(), uneTontineGeree({ tontineId: 't2', nom: 'Sans tour' }, null))
    recap()
    afficher('/encaisser')

    expect(await screen.findByRole('heading', { name: 'Encaisser · Famille' })).toBeInTheDocument()
    expect(emplacement()).toBe('/encaisser/t1')
  })

  it('plusieurs tontines : celles où il manque le plus de paiements d\'abord', async () => {
    tableauDeBord(
      uneTontineGeree({ tontineId: 'tA', nom: 'Bureau' }, { membresActifs: 10, membresAyantPaye: 10, membresEnAttente: 0 }),
      uneTontineGeree({ tontineId: 'tB', nom: 'Quartier' }, { numeroCycle: 2, nombreEcheances: 3, numeroEcheanceCourante: 2, membresActifs: 8, membresAyantPaye: 2, membresEnAttente: 2 }),
    )
    afficher('/encaisser')

    expect(await screen.findByText('Pour quelle tontine ?')).toBeInTheDocument()
    expect(screen.getAllByRole('link').map((a) => [a.getAttribute('href'), a.textContent])).toEqual([
      ['/encaisser/tB', 'QQuartierTour 2 · cotisation 2/3 · 4 n\'ont pas payé'],
      ['/encaisser/tA', 'BBureauTour 6 · tout le monde a payé'],
    ])
  })

  it('aucun tour en cours', async () => {
    tableauDeBord(uneTontineGeree({}, null))
    afficher('/encaisser')

    expect(await screen.findByText('Aucun tour en cours')).toBeInTheDocument()
    expect(screen.getByText('Démarrez un tour dans une de vos tontines pour encaisser.')).toBeInTheDocument()
  })

  it('erreur de chargement : message et Réessayer', async () => {
    let appels = 0
    server.use(http.get(`${API}/v1/admin/my-dashboard`, () => {
      appels++
      return erreur(500, 'INTERNAL_ERROR', 'Panne')
    }))
    const { user } = afficher('/encaisser')

    expect(await screen.findByText('Impossible de charger les membres.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(appels).toBe(2))
  })
})

// ─── « De qui ? » (mobile) ───────────────────────────────────────────────────

describe('[caractérisation] EncaisserPage — « De qui ? » (mobile)', () => {
  it('membres pas encore payés en tête, puis déjà payés (lien vers le reçu) ; membres sortis exclus', async () => {
    tableauDeBord(uneTontineGeree())
    const requetes = recap()
    afficher('/encaisser/t1')

    await screen.findByRole('heading', { name: 'Pas encore payé (2)' })
    expect(screen.getByText('Tour 6')).toBeInTheDocument()
    expect(within(section('Pas encore payé (2)')).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'CSCheikh SarrN° 3 · Sans compte', 'DSDior Sarr',
    ])
    expect(within(section('Déjà payé (2)')).getAllByRole('link').map((a) => [a.getAttribute('href'), a.textContent])).toEqual([
      ['/recu/t1/cot-a', 'ASAwa Sarr5.000FPayé ✓'],
      ['/recu/t1/cot-b', 'BSBineta Sarr5.000FÀ valider'],
    ])
    expect(screen.queryByText(/Ely/)).not.toBeInTheDocument()
    expect(Object.fromEntries(requetes[0].searchParams)).toEqual({ page: '0', size: '200' })
  })

  it('recherche par nom ou par numéro ; aucun résultat', async () => {
    tableauDeBord(uneTontineGeree())
    recap()
    const { user } = afficher('/encaisser/t1')

    const recherche = await screen.findByRole('textbox', { name: 'Chercher un membre' })
    await user.type(recherche, 'dior')
    expect(screen.getByRole('heading', { name: 'Pas encore payé (1)' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Déjà payé/ })).not.toBeInTheDocument()

    await user.clear(recherche)
    await user.type(recherche, '77 00 00 03') // Awa : +221770000003
    expect(screen.getByRole('heading', { name: 'Déjà payé (1)' })).toBeInTheDocument()
    expect(within(section('Déjà payé (1)')).getByRole('link')).toHaveTextContent('Awa Sarr')

    await user.clear(recherche)
    await user.type(recherche, 'zzz')
    expect(screen.getByText('Aucun membre ne correspond.')).toBeInTheDocument()
  })

  it('tout le monde a payé', async () => {
    tableauDeBord(uneTontineGeree())
    recap([MEMBRES[0], MEMBRES[1]])
    afficher('/encaisser/t1')

    expect(await screen.findByText('Tout le monde a payé ce tour ✓')).toBeInTheDocument()
    expect(screen.getByText('Il n\'y a rien à encaisser.')).toBeInTheDocument()
  })

  it('tour à plusieurs cotisations : « Tour 6 · cotisation 2/3 »', async () => {
    tableauDeBord(uneTontineGeree())
    recap([uneLigne('Dior', { nombreEcheances: 3, numeroEcheance: 2 })])
    afficher('/encaisser/t1')

    expect(await screen.findByText('Tour 6 · cotisation 2/3')).toBeInTheDocument()
  })

  it('tontine absente du tableau de bord : « Tontine introuvable »', async () => {
    tableauDeBord(uneTontineGeree({ tontineId: 'autre' }))
    afficher('/encaisser/t1')

    expect(await screen.findByText('Tontine introuvable')).toBeInTheDocument()
    expect(screen.getByText('Vous ne gérez pas cette tontine.')).toBeInTheDocument()
  })

  it('pas de tour en cours : message et lien vers les tours', async () => {
    tableauDeBord(uneTontineGeree({}, null))
    afficher('/encaisser/t1')

    expect(await screen.findByText('Démarrez un tour pour pouvoir encaisser.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir les tours' })).toHaveAttribute('href', '/tontine/t1/tours')
  })

  it('liste des membres indisponible : message et Réessayer', async () => {
    tableauDeBord(uneTontineGeree())
    server.use(http.get(`${API}/v1/tontines/t1/cotisations/recap/c6`, () => HttpResponse.error()))
    afficher('/encaisser/t1')

    expect(await screen.findByText('Impossible de charger les membres.')).toBeInTheDocument()
  })
})

// ─── « Combien ? » (mobile) ──────────────────────────────────────────────────

describe('[caractérisation] EncaisserPage — « Combien ? » et encaissement (mobile)', () => {
  it('choisir un membre ouvre le formulaire ; encaissement direct : corps vérifié puis reçu', async () => {
    tableauDeBord(uneTontineGeree())
    recap()
    const corps = encaissements()
    const { user } = afficher('/encaisser/t1')

    await user.click(await screen.findByRole('button', { name: /Dior Sarr/ }))

    expect(parametres()).toBe('?membre=m-dior')
    expect(screen.getByText('Dior Sarr').parentElement).toHaveTextContent('Dior SarrTour 6')
    expect(screen.getByText('5.000F')).toBeInTheDocument()
    expect(screen.queryByLabelText('Pavé numérique')).not.toBeInTheDocument()
    expect(screen.getByText('Le paiement sera validé et Dior sera prévenu.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Encaisser 5.000F' }))

    await waitFor(() => expect(emplacement()).toBe('/recu/t1/cot-admin'))
    expect(corps).toEqual([{ membreId: 'm-dior', cycleId: 'c6', montant: 5000, methodePaiement: 'CASH' }])
    expect(etatNavigation()).toEqual({ justCreated: true })
  })

  it('montant modifié, référence et note envoyées (sans espaces autour)', async () => {
    tableauDeBord(uneTontineGeree())
    recap()
    const corps = encaissements()
    const { user } = afficher('/encaisser/t1?membre=m-cheikh')

    expect(await screen.findByText('Cheikh Sarr').then((el) => el.parentElement)).toHaveTextContent('Tour 6 · Sans compte')
    await user.click(screen.getByRole('button', { name: 'Modifier le montant' }))
    const pave = screen.getByLabelText('Pavé numérique')
    await user.click(within(pave).getByRole('button', { name: 'Effacer' }))
    await user.click(within(pave).getByRole('button', { name: '0' }))
    await user.click(screen.getByRole('button', { name: 'Référence et note' }))
    await user.type(screen.getByRole('textbox', { name: 'Référence (facultatif)' }), ' REC-12 ')
    await user.type(screen.getByRole('textbox', { name: 'Note (facultatif)' }), '  Payé au marché  ')
    await user.click(screen.getByRole('button', { name: 'Encaisser 5.000F' }))

    await waitFor(() => expect(corps).toHaveLength(1))
    expect(corps[0]).toEqual({
      membreId: 'm-cheikh', cycleId: 'c6', montant: 5000, methodePaiement: 'CASH',
      referenceTransaction: 'REC-12', note: 'Payé au marché',
    })
  })

  it('montant libre : pavé ouvert, bouton inactif tant qu\'aucun montant n\'est saisi', async () => {
    tableauDeBord(uneTontineGeree({ montantLibre: true, montant: null }))
    recap()
    const corps = encaissements()
    const { user } = afficher('/encaisser/t1?membre=m-dior')

    const pave = await screen.findByLabelText('Pavé numérique')
    expect(screen.getByRole('button', { name: /^Encaisser/ })).toBeDisabled()
    await user.click(within(pave).getByRole('button', { name: '2' }))
    await user.click(within(pave).getByRole('button', { name: '000' }))
    await user.click(screen.getByRole('button', { name: 'Encaisser 2.000F' }))

    await waitFor(() => expect(corps).toHaveLength(1))
    expect(corps[0].montant).toBe(2000)
  })

  it('« Changer » revient à « De qui ? »', async () => {
    tableauDeBord(uneTontineGeree())
    recap()
    const { user } = afficher('/encaisser/t1?membre=m-dior')

    await user.click(await screen.findByRole('button', { name: 'Changer' }))

    expect(parametres()).toBe('')
    expect(screen.getByRole('heading', { name: 'Pas encore payé (2)' })).toBeInTheDocument()
  })

  it('membre déjà payé dans l\'URL : on reste sur « De qui ? »', async () => {
    tableauDeBord(uneTontineGeree())
    recap()
    afficher('/encaisser/t1?membre=m-awa')

    expect(await screen.findByRole('heading', { name: 'Pas encore payé (2)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Encaisser/ })).not.toBeInTheDocument()
  })

  it('retardataire après la remise (?tour & ?echeance) : tour remis, « retard », échéance envoyée, gardés en changeant de membre', async () => {
    tableauDeBord(uneTontineGeree())
    server.use(http.get(`${API}/v1/tontines/t1/cycles/c4`, () => ok(unCycle({ id: 'c4', numeroCycle: 4 }))))
    const requetes = recap(MEMBRES, 'c4')
    const corps = encaissements()
    const { user } = afficher('/encaisser/t1?membre=m-dior&tour=c4&echeance=e1')

    expect(await screen.findByText('Dior Sarr').then((el) => el.parentElement)).toHaveTextContent('Tour 4 · retard')
    expect(requetes[0].searchParams.get('echeanceId')).toBe('e1')
    await user.click(screen.getByRole('button', { name: 'Encaisser 5.000F' }))

    await waitFor(() => expect(corps).toHaveLength(1))
    expect(corps[0]).toEqual({ membreId: 'm-dior', cycleId: 'c4', echeanceId: 'e1', montant: 5000, methodePaiement: 'CASH' })
  })

  it('« Changer » sur un retard garde le tour et l\'échéance', async () => {
    tableauDeBord(uneTontineGeree())
    server.use(http.get(`${API}/v1/tontines/t1/cycles/c4`, () => ok(unCycle({ id: 'c4', numeroCycle: 4 }))))
    recap(MEMBRES, 'c4')
    const { user } = afficher('/encaisser/t1?membre=m-dior&tour=c4&echeance=e1')

    await user.click(await screen.findByRole('button', { name: 'Changer' }))
    expect(parametres()).toBe('?tour=c4&echeance=e1')
    await user.click(screen.getByRole('button', { name: /Cheikh Sarr/ }))
    expect(parametres()).toBe('?tour=c4&echeance=e1&membre=m-cheikh')
  })

  it.each([
    ['paiement déjà enregistré (409)', () => erreur(409, 'COTISATION_ALREADY_EXISTS', 'Doublon'), 'Un paiement existe déjà pour cette cotisation.'],
    ['erreur serveur', () => erreur(500, 'INTERNAL_ERROR', 'Panne'), 'Service momentanément indisponible, réessayez.'],
    ['erreur réseau', () => HttpResponse.error(), 'Pas de connexion. Vérifiez votre réseau et réessayez.'],
  ])('%s : message affiché, on reste sur le formulaire', async (_cas, reponse, message) => {
    tableauDeBord(uneTontineGeree())
    recap()
    encaissements(reponse)
    const { user } = afficher('/encaisser/t1?membre=m-dior')

    await user.click(await screen.findByRole('button', { name: 'Encaisser 5.000F' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(emplacement()).toBe('/encaisser/t1')
  })

  it('pendant l\'envoi : « Enregistrement… » inactif, un seul encaissement', async () => {
    tableauDeBord(uneTontineGeree())
    recap()
    const corps = encaissements(async () => { await delay(150); return ok(uneCotisation({ id: 'cot-admin' })) })
    const { user } = afficher('/encaisser/t1?membre=m-dior')

    await user.click(await screen.findByRole('button', { name: 'Encaisser 5.000F' }))
    expect(screen.getByRole('button', { name: 'Enregistrement…' })).toBeDisabled()

    await waitFor(() => expect(emplacement()).toBe('/recu/t1/cot-admin'))
    expect(corps).toHaveLength(1)
  })

  it('hors connexion : « Connexion requise » inactif', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    tableauDeBord(uneTontineGeree())
    recap()
    afficher('/encaisser/t1?membre=m-dior')

    expect(await screen.findByRole('button', { name: 'Connexion requise' })).toBeDisabled()
  })
})

// ─── Desktop ─────────────────────────────────────────────────────────────────

describe('[caractérisation] EncaisserDesktop — liste et formulaire côte à côte', () => {
  beforeEach(() => { ecranLarge() })

  it('en-tête, progression, onglets ; « Choisissez un membre » tant qu\'aucun n\'est choisi', async () => {
    tableauDeBord(uneTontineGeree())
    recap()
    afficher('/encaisser/t1')

    // (le squelette de chargement a aussi un titre « Encaisser » : on attend le sous-titre de la vue desktop)
    expect(await screen.findByText('Famille · Tour 6')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Encaisser' })).toBeInTheDocument()
    expect(screen.getByText('Ont payé').parentElement).toHaveTextContent('Ont payé2 / 4')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(screen.getByRole('tab', { name: 'À encaisser (2)' })).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('list', { name: 'Membres' })).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'CSCheikh SarrN° 3 · Sans compte', 'DSDior Sarr',
    ])
    expect(screen.getByText('Choisissez un membre')).toBeInTheDocument()
  })

  it('onglet « Déjà payé » : liens vers les reçus', async () => {
    tableauDeBord(uneTontineGeree())
    recap()
    const { user } = afficher('/encaisser/t1')

    await user.click(await screen.findByRole('tab', { name: 'Déjà payé (2)' }))

    expect(within(screen.getByRole('list', { name: 'Membres' })).getAllByRole('link').map((a) => [a.getAttribute('href'), a.textContent])).toEqual([
      ['/recu/t1/cot-a', 'ASAwa Sarr5.000FPayé ✓'],
      ['/recu/t1/cot-b', 'BSBineta Sarr5.000FÀ valider'],
    ])
  })

  it('choisir un membre, corriger le montant, référence et note : corps vérifié', async () => {
    tableauDeBord(uneTontineGeree())
    recap()
    const corps = encaissements()
    const { user } = afficher('/encaisser/t1')

    await user.click(await screen.findByRole('button', { name: /Dior Sarr/ }))
    expect(parametres()).toBe('?membre=m-dior')
    const montant = screen.getByRole('textbox', { name: 'Montant encaissé en francs CFA' })
    expect(montant).toHaveValue('5 000')

    await user.clear(montant)
    await user.type(montant, '7500')
    expect(montant).toHaveValue('7 500')
    expect(screen.getByRole('button', { name: 'Remettre le montant prévu (5.000F)' })).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Référence (facultatif)' }), 'TX-9')
    await user.type(screen.getByRole('textbox', { name: 'Note (facultatif)' }), 'Avance du mois')
    await user.click(screen.getByRole('button', { name: 'Encaisser 7.500F' }))

    await waitFor(() => expect(corps).toHaveLength(1))
    expect(corps[0]).toEqual({
      membreId: 'm-dior', cycleId: 'c6', montant: 7500, methodePaiement: 'CASH', referenceTransaction: 'TX-9', note: 'Avance du mois',
    })
    await waitFor(() => expect(emplacement()).toBe('/recu/t1/cot-admin'))
  })

  it('« Remettre le montant prévu » rétablit le montant de la tontine', async () => {
    tableauDeBord(uneTontineGeree())
    recap()
    const { user } = afficher('/encaisser/t1?membre=m-dior')

    const montant = await screen.findByRole('textbox', { name: 'Montant encaissé en francs CFA' })
    await user.clear(montant)
    await user.type(montant, '100')
    await user.click(screen.getByRole('button', { name: 'Remettre le montant prévu (5.000F)' }))

    expect(montant).toHaveValue('5 000')
    expect(screen.queryByRole('button', { name: /Remettre le montant prévu/ })).not.toBeInTheDocument()
  })

  it('clavier : la recherche filtre, ↓ puis Entrée choisit le membre', async () => {
    tableauDeBord(uneTontineGeree())
    recap()
    const { user } = afficher('/encaisser/t1')

    const recherche = await screen.findByRole('textbox', { name: /Chercher un membre/ })
    await user.click(recherche)
    await user.keyboard('{ArrowDown}{Enter}')

    expect(parametres()).toBe('?membre=m-dior')
    expect(screen.getByRole('button', { name: /Dior Sarr/ })).toHaveAttribute('aria-current', 'true')
  })

  it('montant vidé puis Entrée : « Saisissez un montant. », rien n\'est envoyé', async () => {
    tableauDeBord(uneTontineGeree())
    recap()
    const corps = encaissements()
    const { user } = afficher('/encaisser/t1?membre=m-dior')

    const montant = await screen.findByRole('textbox', { name: 'Montant encaissé en francs CFA' })
    await user.clear(montant)
    expect(screen.getByRole('button', { name: 'Encaisser' })).toBeDisabled()
    fireEvent.submit(montant.closest('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent('Saisissez un montant.')
    expect(corps).toEqual([])
  })

  it('erreur d\'encaissement : message à la place du rappel, en bas du formulaire', async () => {
    tableauDeBord(uneTontineGeree())
    recap()
    encaissements(() => erreur(409, 'COTISATION_ALREADY_EXISTS', 'Doublon'))
    const { user } = afficher('/encaisser/t1?membre=m-dior')

    await user.click(await screen.findByRole('button', { name: 'Encaisser 5.000F' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Un paiement existe déjà pour cette cotisation.')
    expect(screen.queryByText('Le paiement sera validé et Dior sera prévenu.')).not.toBeInTheDocument()
  })

  it('« Changer » ferme le formulaire', async () => {
    tableauDeBord(uneTontineGeree())
    recap()
    const { user } = afficher('/encaisser/t1?membre=m-dior')

    await user.click(await screen.findByRole('button', { name: 'Changer' }))

    expect(parametres()).toBe('')
    expect(screen.getByText('Choisissez un membre')).toBeInTheDocument()
  })

  it('tout le monde a payé : rien à encaisser', async () => {
    tableauDeBord(uneTontineGeree())
    recap([MEMBRES[0], MEMBRES[1]])
    afficher('/encaisser/t1')

    expect(await screen.findAllByText('Tout le monde a payé ce tour ✓')).toHaveLength(2) // liste vide + panneau de droite
    expect(screen.getByText('Il n\'y a rien à encaisser.')).toBeInTheDocument()
  })
})
