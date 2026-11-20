/**
 * Caractérisation de TourPage et de sa feuille RemiseSheet (spec 01, tâche 4.6) — un tour.
 *
 * Données : GET tontine (mon rôle), GET …/cycles/:cycleId, GET …/cotisations/recap/:cycleId (gestionnaire,
 * size=200, `echeanceId` si le tour compte plusieurs cotisations), GET …/membres (désignation),
 * GET …/cotisations?membreId (membre : ses paiements).
 * Gestionnaire, rotative en cours : « Remettre le jackpot » → aperçu GET …/remise/apercu, puis
 * PUT …/cloturer (corps { modeRemise } seulement s'il manque de l'argent).
 * Événement en cours : « Clôturer la période ». Tour terminé sans gagnant, ordre « Je choisis » :
 * « Désigner le gagnant » / « Tirage au sort » (PATCH …/beneficiaire { membreIds }).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor, act } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { http, HttpResponse } from 'msw'
import { API, ok, page, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { unCycle } from '@/test/factories/cycle'
import { uneTontine } from '@/test/factories/tontine'
import { unMembre } from '@/test/factories/membre'
import { uneCotisation } from '@/test/factories/cotisation'
import { AccountStatus, CotisationStatut, CycleStatut, MembreStatut } from '@/types/common'
import { TontineType, type Tontine } from '@/types/tontine'
import type { Cycle } from '@/types/cycle'
import type { CycleRecapLigne } from '@/types/cotisation'
import { TourPage } from './TourPage'

// ─── Données ─────────────────────────────────────────────────────────────────

function tontine(surcharge: Partial<Tontine> & { monRole?: string } = {}) {
  server.use(http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({
    id: 't1', nom: 'Famille', monRole: 'GESTIONNAIRE', montant: 5000, nombreGagnants: 1, ordreBeneficiaire: 'ROTATION',
    ...surcharge,
  } as never))))
}

function tour(surcharge: Partial<Cycle> = {}) {
  server.use(http.get(`${API}/v1/tontines/t1/cycles/c6`, () => ok(unCycle({
    id: 'c6', numeroCycle: 6, statut: CycleStatut.EN_COURS, dateDebut: '2026-11-01', dateFin: '2026-11-30',
    echeanceAt: '2026-11-30T20:00:00Z', ...surcharge,
  }))))
}

function uneLigne(prenom: string, surcharge: Partial<CycleRecapLigne> = {}): CycleRecapLigne {
  return {
    membreId: `m-${prenom.toLowerCase()}`, userId: `u-${prenom.toLowerCase()}`, firstName: prenom, lastName: 'Test',
    phone: '+221770000000', statutMembre: MembreStatut.ACTIF, ordreJackpot: null, cotisationId: null, montant: null,
    methodePaiement: null, statutCotisation: null, dateValidation: null, accountStatus: AccountStatus.ACTIVE, ...surcharge,
  }
}

/** Ligne par défaut : 1 payé et validé, 1 en attente, 2 pas payés (dont 1 sans compte), 1 sorti, 1 suspendu */
const RECAP = [
  uneLigne('Awa', { cotisationId: 'cot-a', montant: 5000, statutCotisation: CotisationStatut.VALIDE }),
  uneLigne('Bineta', { cotisationId: 'cot-b', montant: 5000, statutCotisation: CotisationStatut.EN_ATTENTE }),
  uneLigne('Cheikh', { accountStatus: AccountStatus.PRE_ENROLLED }),
  uneLigne('Dior'),
  uneLigne('Ely', { statutMembre: MembreStatut.SORTI }),
  uneLigne('Fatou', { statutMembre: MembreStatut.SUSPENDU }),
]

function recap(lignes: CycleRecapLigne[] = RECAP) {
  const requetes: URL[] = []
  server.use(http.get(`${API}/v1/tontines/t1/cotisations/recap/c6`, ({ request }) => {
    requetes.push(new URL(request.url))
    return page(lignes)
  }))
  return requetes
}

/** Capture les clôtures (PUT …/cloturer) et répond avec le tour clôturé */
function clotures(reponse: Partial<Cycle> | (() => Response) = {}) {
  const corps: unknown[] = []
  server.use(http.put(`${API}/v1/tontines/t1/cycles/c6/cloturer`, async ({ request }) => {
    const texte = await request.text()
    corps.push(texte ? JSON.parse(texte) : null)
    if (typeof reponse === 'function') return reponse()
    return ok(unCycle({ id: 'c6', numeroCycle: 6, statut: CycleStatut.TERMINE, ...reponse }))
  }))
  return corps
}

const GAGNANTE = { membreId: 'm-awa', userId: 'u-awa', firstName: 'Awa', lastName: 'Diop', phone: '', ordreJackpot: 6, montantRecu: 47500, dateJackpot: null }

function afficher(auth: 'gestionnaire' | 'membre' = 'gestionnaire') {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/tontine/:id/tours/:cycleId" element={<TourPage />} />
      </Routes>
      <Toaster />
    </>,
    { route: '/tontine/t1/tours/c6', auth },
  )
}

/** Titre d'une section (h2) → texte de la section entière */
const section = (titre: string | RegExp) => screen.getByRole('heading', { name: titre }).parentElement as HTMLElement
const nomsDe = (el: HTMLElement) => within(el).getAllByRole('listitem').map((li) => within(li).getAllByText(/Test$/)[0].textContent)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T10:00:00Z'))
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

afterEach(() => {
  act(() => { toast.dismiss() })
  vi.useRealTimers()
})

// ─── Progression (gestionnaire) ──────────────────────────────────────────────

describe('[caractérisation] TourPage — progression et listes (gestionnaire)', () => {
  it('affiche les dates, la limite, l\'anneau, le collecté et le prévu', async () => {
    tontine()
    tour()
    const requetes = recap()
    afficher()

    expect(await screen.findByRole('heading', { name: 'Tour 6 · Famille' })).toBeInTheDocument()
    expect(screen.getByText('1 nov. → 30 nov.')).toBeInTheDocument()
    expect(screen.getByText('En cours')).toBeInTheDocument()
    expect(screen.getByText('À payer avant lun. 30 nov. à 20h')).toBeInTheDocument()
    // 4 membres actifs (le sorti et le suspendu ne comptent pas), 1 paiement validé
    expect(await screen.findByRole('img', { name: '1/4 ont payé' })).toBeInTheDocument()
    expect(screen.getByText('Ont payé').parentElement).toHaveTextContent('Ont payé5.000Fsur 20.000F prévus+ 1 en attente de validation')
    expect(Object.fromEntries(requetes[0].searchParams)).toEqual({ page: '0', size: '200' })
  })

  it('« Pas encore payé » (membres actifs seulement, « Sans compte ») et « Payé » (validés et en attente)', async () => {
    tontine()
    tour()
    recap()
    afficher()

    await screen.findByRole('heading', { name: 'Pas encore payé (2)' })
    const nonPayes = section('Pas encore payé (2)')
    expect(nomsDe(nonPayes)).toEqual(['Cheikh Test', 'Dior Test'])
    expect(within(nonPayes).getAllByRole('listitem')[0]).toHaveTextContent('Sans compte')
    expect(within(nonPayes).getAllByRole('link', { name: 'Encaisser' }).map((a) => a.getAttribute('href'))).toEqual([
      '/encaisser/t1?membre=m-cheikh', '/encaisser/t1?membre=m-dior',
    ])

    const payes = section('Payé (2)')
    expect(within(payes).getAllByRole('link').map((a) => [a.getAttribute('href'), a.textContent])).toEqual([
      ['/recu/t1/cot-a', 'ATAwa Test5.000F Payé'],
      ['/recu/t1/cot-b', 'BTBineta Test5.000F À valider'],
    ])
  })

  it('« Tout le monde a payé » quand le tour est complet', async () => {
    tontine()
    tour({ tousPayes: true })
    recap([uneLigne('Awa', { cotisationId: 'cot-a', montant: 5000, statutCotisation: CotisationStatut.VALIDE })])
    afficher()

    expect(await screen.findByText('Tout le monde a payé : le jackpot peut être remis.')).toBeInTheDocument()
  })

  it('personne n\'a encore payé', async () => {
    tontine()
    tour()
    recap([uneLigne('Awa'), uneLigne('Bineta')])
    afficher()

    expect(await screen.findByText('Personne n\'a encore payé.')).toBeInTheDocument()
  })

  it('tour à plusieurs cotisations (B32) : pastilles, cotisation en cours par défaut, autre cotisation au choix', async () => {
    tontine()
    tour({
      montantJackpotPrevu: 60000,
      echeances: [
        { id: 'e1', numero: 1, dateDebut: '2026-11-01', echeanceAt: '2026-11-10T23:59:00Z', statut: 'ECHUE' },
        { id: 'e2', numero: 2, dateDebut: '2026-11-11', echeanceAt: '2026-11-20T23:59:00Z', statut: 'EN_COURS' },
        { id: 'e3', numero: 3, dateDebut: '2026-11-21', echeanceAt: '2026-11-30T23:59:00Z', statut: 'A_VENIR' },
      ],
      echeanceEnCours: { id: 'e2', numero: 2, dateDebut: '2026-11-11', echeanceAt: '2026-11-20T23:59:00Z', statut: 'EN_COURS' },
    })
    const requetes = recap([
      uneLigne('Awa', { cotisationId: 'cot-a', montant: 5000, statutCotisation: CotisationStatut.VALIDE }),
      uneLigne('Dior', { echeancesDues: 2, echeancesPayees: 1 }),
    ])
    const { user } = afficher()

    const pastilles = await screen.findByRole('tablist', { name: 'Cotisations du tour' })
    expect(within(pastilles).getAllByRole('tab').map((t) => [t.getAttribute('aria-label'), (t as HTMLButtonElement).disabled])).toEqual([
      ['Cotisation 1, passée', false], ['Cotisation 2, en cours', false], ['Cotisation 3, à venir', true],
    ])
    expect(within(pastilles).getByRole('tab', { name: 'Cotisation 2, en cours' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/^Cotisation 2 sur 3/)).toHaveTextContent('Cotisation 2 sur 3 · avant ven. 20 nov.')
    expect(screen.getByText('Ont payé cette cotisation')).toBeInTheDocument()
    expect(screen.getByText('Jackpot du tour :').parentElement).toHaveTextContent('Jackpot du tour : 60.000F')
    await waitFor(() => expect(requetes[0]?.searchParams.get('echeanceId')).toBe('e2'))
    expect(await screen.findByText('1/2 cotisations payées')).toBeInTheDocument()
    // Cotisation en cours : lien d'encaissement sans précision d'échéance
    expect(screen.getByRole('link', { name: 'Encaisser' })).toHaveAttribute('href', '/encaisser/t1?membre=m-dior')

    await user.click(within(pastilles).getByRole('tab', { name: 'Cotisation 1, passée' }))

    expect(screen.getByText(/^Cotisation 1 sur 3/)).toHaveTextContent('Cotisation 1 sur 3 · échue le mar. 10 nov.')
    await waitFor(() => expect(requetes.map((r) => r.searchParams.get('echeanceId'))).toContain('e1'))
    // Cotisation passée : le lien précise l'échéance à encaisser
    expect(await screen.findByRole('link', { name: 'Encaisser' })).toHaveAttribute('href', '/encaisser/t1?membre=m-dior&echeance=e1')
  })
})

// ─── Remise du jackpot (rotative en cours) ───────────────────────────────────

describe('[caractérisation] TourPage — remise du jackpot (RemiseSheet)', () => {
  function apercu(a: Record<string, unknown> | (() => Response)) {
    server.use(http.get(`${API}/v1/tontines/t1/cycles/c6/remise/apercu`, () => (typeof a === 'function' ? a() : ok({ cycleId: 'c6', numeroCycle: 6, ...a }))))
  }

  const INCOMPLET = {
    jackpotPrevu: 50000, collecte: 40000, manquant: 10000, modeRemiseParDefaut: 'AVANCE_GESTIONNAIRE',
    retardataires: [
      { membreId: 'm-dior', firstName: 'Dior', lastName: 'Sarr', echeancesManquees: 2, montant: 10000 },
    ],
    options: [
      { modeRemise: 'DISPONIBLE', possible: true, montantNet: 38000, montantBeneficiaire: 38000, commission: 2000, resteARecevoir: 9500 },
      { modeRemise: 'AVANCE_COMMISSION', possible: false, montantNet: 40000, montantBeneficiaire: 40000, commission: 0 },
      { modeRemise: 'AVANCE_GESTIONNAIRE', possible: true, montantNet: 47500, montantBeneficiaire: 47500, commission: 2500, avanceGestionnaire: 7500 },
      { modeRemise: 'ATTENDRE', possible: false },
    ],
  }

  it('jackpot complet : montants seulement, remise sans option (pas de corps), puis résultat', async () => {
    tontine()
    tour({ tousPayes: true })
    recap([uneLigne('Awa', { cotisationId: 'cot-a', montant: 5000, statutCotisation: CotisationStatut.VALIDE })])
    apercu({
      jackpotPrevu: 50000, collecte: 50000, manquant: 0, modeRemiseParDefaut: 'DISPONIBLE', retardataires: [],
      options: [{ modeRemise: 'DISPONIBLE', possible: true, montantNet: 47500, montantBeneficiaire: 47500, commission: 2500 }],
    })
    const corps = clotures({ montantNet: 47500, gagnants: [GAGNANTE] })
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Remettre le jackpot' }))
    const feuille = await screen.findByRole('dialog', { name: 'Remettre le jackpot · Tour 6' })
    expect(await within(feuille).findByText('Tout est collecté')).toBeInTheDocument()
    expect(within(feuille).getByText('50.000F')).toBeInTheDocument()
    expect(within(feuille).queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(within(feuille).getByText('Le gagnant reçoit').nextElementSibling).toHaveTextContent('47.500F')
    expect(within(feuille).getByText('Votre commission').nextElementSibling).toHaveTextContent('2.500F')

    await user.click(within(feuille).getByRole('button', { name: 'Remettre 47.500F' }))

    const resultat = await screen.findByRole('dialog', { name: 'Jackpot remis' })
    expect(within(resultat).getByText('Jackpot de 47.500F pour Awa')).toBeInTheDocument()
    expect(corps).toEqual([null])
  })

  it('jackpot incomplet : retardataires, options possibles (attendre toujours proposée), option par défaut', async () => {
    tontine()
    tour()
    recap()
    apercu(INCOMPLET)
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Remettre le jackpot' }))
    const feuille = await screen.findByRole('dialog', { name: 'Remettre le jackpot · Tour 6' })
    expect(await within(feuille).findByText('Il manque 10.000F')).toBeInTheDocument()
    expect(within(feuille).getByText('40.000F collectés sur 50.000F prévus.')).toBeInTheDocument()
    expect(within(feuille).getByText(/Dior Sarr/).parentElement).toHaveTextContent('Dior Sarr · 2 cotisations− 10.000F')

    const options = within(within(feuille).getByRole('radiogroup', { name: 'Que voulez-vous faire ?' })).getAllByRole('radio')
    // « Compléter avec ma commission » est impossible ici : non proposée ; « Attendre » reste proposée
    expect(options.map((o) => o.textContent)).toEqual([
      'Remettre ce qui est collectéPuis 9.500F de plus quand les retards seront payés.38.000Fau gagnant',
      'Avancer de ma pocheVous avancez 7.500F, remboursés quand les retards seront payés.47.500Fau gagnant',
      'Attendre les retardatairesRien n’est remis pour l’instant.',
    ])
    expect(options[1]).toHaveAttribute('aria-checked', 'true') // modeRemiseParDefaut
    expect(within(feuille).getByRole('button', { name: 'Remettre 47.500F' })).toBeEnabled()
  })

  it('choisit « Remettre ce qui est collecté » : PUT avec { modeRemise: DISPONIBLE }, reste à remettre affiché', async () => {
    tontine()
    tour()
    recap()
    apercu(INCOMPLET)
    const corps = clotures({ montantNet: 38000, resteARecevoir: 9500, gagnants: [GAGNANTE] })
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Remettre le jackpot' }))
    const feuille = await screen.findByRole('dialog', { name: 'Remettre le jackpot · Tour 6' })
    await user.click(await within(feuille).findByRole('radio', { name: /Remettre ce qui est collecté/ }))
    expect(within(feuille).getByText('Le gagnant reçoit').nextElementSibling).toHaveTextContent('38.000F')
    await user.click(within(feuille).getByRole('button', { name: 'Remettre 38.000F' }))

    const resultat = await screen.findByRole('dialog', { name: 'Jackpot remis' })
    expect(within(resultat).getByText('Encore 9.500F à remettre quand les retards seront payés.')).toBeInTheDocument()
    expect(corps).toEqual([{ modeRemise: 'DISPONIBLE' }])
  })

  it('« Attendre les retardataires » : ferme la feuille sans rien envoyer', async () => {
    tontine()
    tour()
    recap()
    apercu(INCOMPLET)
    const corps = clotures()
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Remettre le jackpot' }))
    const feuille = await screen.findByRole('dialog', { name: 'Remettre le jackpot · Tour 6' })
    await user.click(await within(feuille).findByRole('radio', { name: /Attendre les retardataires/ }))
    expect(within(feuille).queryByText('Le gagnant reçoit')).not.toBeInTheDocument()
    await user.click(within(feuille).getByRole('button', { name: 'Attendre' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(corps).toEqual([])
  })

  it('aperçu indisponible : remise simple refusée (tontine réglée sur « attendre ») → message traduit', async () => {
    tontine()
    tour()
    recap()
    apercu(() => erreur(500, 'INTERNAL_ERROR', 'Panne'))
    const corps = clotures(() => erreur(409, 'REMISE_JACKPOT_INCOMPLETE', 'Incomplet'))
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Remettre le jackpot' }))
    const feuille = await screen.findByRole('dialog', { name: 'Remettre le jackpot · Tour 6' })
    expect(await within(feuille).findByText(/Le jackpot sera calculé sur les paiements validés/)).toBeInTheDocument()
    await user.click(within(feuille).getByRole('button', { name: 'Remettre le jackpot' }))

    expect(await screen.findByText('Le jackpot n’est pas complet : attendez les retardataires ou choisissez une autre option.')).toBeInTheDocument()
    expect(corps).toEqual([null])
    expect(screen.getByRole('dialog', { name: 'Remettre le jackpot · Tour 6' })).toBeInTheDocument()
  })

  it('option refusée par le backend : message traduit', async () => {
    tontine()
    tour()
    recap()
    apercu(INCOMPLET)
    clotures(() => erreur(409, 'MODE_REMISE_INDISPONIBLE', 'Indisponible'))
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Remettre le jackpot' }))
    const feuille = await screen.findByRole('dialog', { name: 'Remettre le jackpot · Tour 6' })
    await user.click(await within(feuille).findByRole('button', { name: 'Remettre 47.500F' }))

    expect(await screen.findByText('Cette option de remise n’est pas possible pour ce tour.')).toBeInTheDocument()
  })
})

// ─── Événement : clôture de la période ───────────────────────────────────────

describe('[caractérisation] TourPage — clôture d\'une période (événement)', () => {
  it('confirmation avec les membres qui n\'ont pas payé, puis PUT sans corps et résultat', async () => {
    tontine({ nom: 'Mariage', tontineType: TontineType.EVENEMENTIELLE })
    tour({ numeroCycle: 2 } as never)
    server.use(http.get(`${API}/v1/tontines/t1/cycles/c6`, () => ok(unCycle({ id: 'c6', numeroCycle: 2, statut: CycleStatut.EN_COURS }))))
    recap()
    const corps = clotures({
      numeroCycle: 2, montantNet: 95000,
      distributionParMembre: [{ membreId: 'm-awa', userId: 'u-awa', firstName: 'Awa', lastName: 'Diop', phone: '', montantCotise: 50000, montantCommission: 2500, montantNet: 47500 }] as never,
    })
    const { user } = afficher()

    expect(await screen.findByRole('heading', { name: 'Période 2 · Mariage' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clôturer la période' }))
    const confirmation = await screen.findByRole('dialog', { name: 'Clôturer la période 2 ?' })
    expect(await within(confirmation).findByText('2 membres n\'ont pas encore payé.')).toBeInTheDocument()
    await user.click(within(confirmation).getByRole('button', { name: 'Clôturer' }))

    const resultat = await screen.findByRole('dialog', { name: 'Période clôturée' })
    expect(within(resultat).getByText('Net à remettre : 95.000F')).toBeInTheDocument()
    expect(within(resultat).getByText('La cagnotte est répartie entre tous les membres.')).toBeInTheDocument()
    expect(corps).toEqual([null])
  })

  it('clôture en échec : message d\'erreur', async () => {
    tontine({ tontineType: TontineType.EVENEMENTIELLE })
    tour()
    recap()
    clotures(() => erreur(409, 'NO_CYCLE_IN_PROGRESS', 'Pas en cours'))
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Clôturer la période' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clôturer' }))

    expect(await screen.findByText('Le tour n\'est pas en cours.')).toBeInTheDocument()
  })
})

// ─── Tour terminé : résultat et désignation ──────────────────────────────────

describe('[caractérisation] TourPage — tour terminé', () => {
  it('résultat : jackpot, commission, net, gagnant, reste à remettre et avance du gestionnaire', async () => {
    tontine()
    tour({
      statut: CycleStatut.TERMINE, montantJackpot: 50000, montantCommission: 2500, montantNet: 47500,
      resteARecevoir: 5000, montantAvance: 7500, gagnants: [GAGNANTE],
    })
    recap()
    afficher()

    const resultat = await screen.findByRole('heading', { name: 'Résultat' })
    const bloc = resultat.parentElement as HTMLElement
    expect(within(bloc).getAllByRole('term').map((dt) => `${dt.textContent}=${dt.nextElementSibling?.textContent}`)).toEqual([
      'Jackpot=50.000F', 'Commission=− 2.500F', 'Net=47.500F',
    ])
    expect(bloc).toHaveTextContent('5.000F restent à remettre au gagnant quand les retards seront payés.')
    expect(bloc).toHaveTextContent('Vous avez avancé 7.500F : les retards payés vous remboursent d\'abord.')
    expect(within(bloc).getByText('Awa Diop').parentElement).toHaveTextContent('Awa Diop+47.500F')
    // Plus d'action principale sur un tour terminé avec gagnant
    expect(screen.queryByRole('button', { name: /Remettre|Désigner|Tirage/ })).not.toBeInTheDocument()
  })

  it('retardataire après la remise : « Encaisser » précise le tour (et l\'échéance)', async () => {
    tontine()
    tour({
      statut: CycleStatut.TERMINE, gagnants: [GAGNANTE],
      echeances: [{ id: 'e1', numero: 1, dateDebut: '2026-11-01', echeanceAt: '2026-11-30T23:59:00Z', statut: 'ECHUE' }],
    })
    recap()
    afficher()

    const liens = await within(await screen.findByRole('heading', { name: 'Pas encore payé (2)' }).then((h) => h.parentElement as HTMLElement)).findAllByRole('link', { name: 'Encaisser' })
    expect(liens[0]).toHaveAttribute('href', '/encaisser/t1?membre=m-cheikh&tour=c6&echeance=e1')
  })

  it('ordre « Je choisis », sans gagnant : désigner le gagnant parmi les éligibles (PATCH { membreIds })', async () => {
    tontine({ ordreBeneficiaire: 'MANUEL' })
    tour({ statut: CycleStatut.TERMINE, montantNet: 47500, gagnants: [] })
    recap()
    server.use(http.get(`${API}/v1/tontines/t1/membres`, () => page([
      unMembre({ id: 'm-awa', ordreJackpot: 6, user: { id: 'u-awa', firstName: 'Awa', lastName: 'Diop', phone: '', accountStatus: AccountStatus.ACTIVE } as never }),
      unMembre({ id: 'm-bineta', ordreJackpot: null as never, user: { id: 'u-b', firstName: 'Bineta', lastName: 'Fall', phone: '', accountStatus: AccountStatus.ACTIVE } as never }),
      unMembre({ id: 'm-recu', aRecuJackpot: true, user: { id: 'u-r', firstName: 'Déjà', lastName: 'Servi', phone: '', accountStatus: AccountStatus.ACTIVE } as never }),
      unMembre({ id: 'm-sorti', statut: MembreStatut.SORTI, user: { id: 'u-s', firstName: 'Parti', lastName: 'Sorti', phone: '', accountStatus: AccountStatus.ACTIVE } as never }),
    ])))
    const corps: unknown[] = []
    server.use(http.patch(`${API}/v1/tontines/t1/cycles/c6/beneficiaire`, async ({ request }) => {
      corps.push(await request.json())
      return ok(unCycle({ id: 'c6', statut: CycleStatut.TERMINE, montantNet: 47500, gagnants: [GAGNANTE] }))
    }))
    const { user } = afficher()

    expect(await screen.findByText('Gagnant pas encore désigné.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Désigner le gagnant' }))
    const fenetre = await screen.findByRole('dialog', { name: 'Choisir le gagnant' })
    const choix = within(fenetre).getAllByRole('button', { pressed: false })
    expect(choix.map((b) => b.textContent)).toEqual(['ADAwa DiopN° 6', 'BFBineta Fall'])
    expect(within(fenetre).getByRole('button', { name: 'Confirmer' })).toBeDisabled()

    await user.click(within(fenetre).getByRole('button', { name: /Bineta Fall/ }))
    await user.click(within(fenetre).getByRole('button', { name: /Awa Diop/ })) // 1 gagnant : le choix remplace
    expect(within(fenetre).getByRole('button', { name: /Awa Diop/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(fenetre).getByRole('button', { name: /Bineta Fall/ })).toHaveAttribute('aria-pressed', 'false')
    await user.click(within(fenetre).getByRole('button', { name: 'Confirmer' }))

    expect(await screen.findByText('Jackpot de 47.500F pour Awa')).toBeInTheDocument()
    expect(corps).toEqual([{ membreIds: ['m-awa'] }])
  })

  it('deux gagnants : « Choisir 2 gagnants », un troisième choix est bloqué', async () => {
    tontine({ ordreBeneficiaire: 'MANUEL', nombreGagnants: 2 })
    tour({ statut: CycleStatut.TERMINE, gagnants: [] })
    recap()
    server.use(http.get(`${API}/v1/tontines/t1/membres`, () => page(['Awa', 'Bineta', 'Coumba'].map((p) =>
      unMembre({ id: `m-${p}`, user: { id: `u-${p}`, firstName: p, lastName: 'Ndiaye', phone: '', accountStatus: AccountStatus.ACTIVE } as never })))))
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Désigner les gagnants' }))
    const fenetre = await screen.findByRole('dialog', { name: 'Choisir 2 gagnants' })
    await user.click(within(fenetre).getByRole('button', { name: /Awa Ndiaye/ }))
    await user.click(within(fenetre).getByRole('button', { name: /Bineta Ndiaye/ }))

    expect(within(fenetre).getByRole('button', { name: /Coumba Ndiaye/ })).toBeDisabled()
    expect(within(fenetre).getByRole('button', { name: 'Confirmer' })).toBeEnabled()
  })

  it('tirage au sort : confirmation puis PATCH avec une liste vide', async () => {
    tontine({ ordreBeneficiaire: 'MANUEL' })
    tour({ statut: CycleStatut.TERMINE, gagnants: [] })
    recap()
    const corps: unknown[] = []
    server.use(http.patch(`${API}/v1/tontines/t1/cycles/c6/beneficiaire`, async ({ request }) => {
      corps.push(await request.json())
      return ok(unCycle({ id: 'c6', statut: CycleStatut.TERMINE, montantNet: 47500, gagnants: [GAGNANTE] }))
    }))
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Tirage au sort' }))
    const fenetre = await screen.findByRole('dialog', { name: 'Tirage au sort ?' })
    expect(within(fenetre).getByText('Le gagnant sera tiré au sort parmi les membres qui n\'ont pas encore reçu le jackpot.')).toBeInTheDocument()
    await user.click(within(fenetre).getByRole('button', { name: 'Tirer au sort' }))

    expect(await screen.findByText('Jackpot de 47.500F pour Awa')).toBeInTheDocument()
    expect(corps).toEqual([{ membreIds: [] }])
  })

  it('désignation en échec : message d\'erreur', async () => {
    tontine({ ordreBeneficiaire: 'MANUEL' })
    tour({ statut: CycleStatut.TERMINE, gagnants: [] })
    recap()
    server.use(http.patch(`${API}/v1/tontines/t1/cycles/c6/beneficiaire`, () => erreur(500, 'INTERNAL_ERROR', 'Panne')))
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Tirage au sort' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Tirer au sort' }))

    expect(await screen.findByText('Service momentanément indisponible, réessayez.')).toBeInTheDocument()
  })

  it('ordre fixe, sans gagnant : « Gagnant en cours de désignation », pas d\'action', async () => {
    tontine({ ordreBeneficiaire: 'ROTATION' })
    tour({ statut: CycleStatut.TERMINE, gagnants: [] })
    recap()
    afficher()

    expect(await screen.findByText('Gagnant en cours de désignation.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Désigner|Tirage/ })).not.toBeInTheDocument()
  })
})

// ─── Membre ──────────────────────────────────────────────────────────────────

describe('[caractérisation] TourPage — membre', () => {
  it('voit ses paiements du tour (lien vers le reçu), pas les listes ni les actions de gestion', async () => {
    tontine({ monRole: 'MEMBRE', monMembreId: 'm-moi' } as never)
    tour()
    let requete: URL | undefined
    server.use(http.get(`${API}/v1/tontines/t1/cotisations`, ({ request }) => {
      requete = new URL(request.url)
      return page([uneCotisation({ id: 'cot-moi', montant: 5000, statut: CotisationStatut.EN_ATTENTE })])
    }))
    afficher('membre')

    const paiement = await screen.findByRole('link', { name: /Mon paiement/ })
    expect(paiement).toHaveAttribute('href', '/recu/t1/cot-moi')
    expect(paiement).toHaveTextContent('Mon paiement · 5.000F À valider')
    expect(Object.fromEntries(requete!.searchParams)).toMatchObject({ cycleId: 'c6', membreId: 'm-moi', size: '50' })
    expect(screen.queryByRole('heading', { name: /Pas encore payé|Payé \(/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remettre le jackpot' })).not.toBeInTheDocument()
  })

  it('sans paiement sur le tour en cours : bouton « Payer ma cotisation »', async () => {
    tontine({ monRole: 'MEMBRE', monMembreId: 'm-moi' } as never)
    tour()
    server.use(http.get(`${API}/v1/tontines/t1/cotisations`, () => page([])))
    afficher('membre')

    expect(await screen.findByRole('link', { name: 'Payer ma cotisation' })).toHaveAttribute('href', '/payer/t1')
  })

  it('tour terminé sans paiement : « Aucun paiement de votre part sur ce tour. »', async () => {
    tontine({ monRole: 'MEMBRE', monMembreId: 'm-moi' } as never)
    tour({ statut: CycleStatut.TERMINE, gagnants: [GAGNANTE] })
    server.use(http.get(`${API}/v1/tontines/t1/cotisations`, () => page([])))
    afficher('membre')

    expect(await screen.findByText('Aucun paiement de votre part sur ce tour.')).toBeInTheDocument()
  })
})

// ─── Erreurs ─────────────────────────────────────────────────────────────────

describe('[caractérisation] TourPage — erreurs', () => {
  it('tour introuvable : message et Réessayer qui relance la requête', async () => {
    tontine()
    recap()
    let appels = 0
    server.use(http.get(`${API}/v1/tontines/t1/cycles/c6`, () => {
      appels++
      return appels === 1 ? erreur(404, 'NOT_FOUND', 'Introuvable') : ok(unCycle({ id: 'c6', numeroCycle: 6 }))
    }))
    const { user } = afficher()

    expect(await screen.findByText('Tour introuvable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByRole('heading', { name: 'Tour 6 · Famille' })).toBeInTheDocument()
    expect(appels).toBe(2)
  })

  it('paiements du tour indisponibles : message et Réessayer', async () => {
    tontine()
    tour()
    server.use(http.get(`${API}/v1/tontines/t1/cotisations/recap/c6`, () => HttpResponse.error()))
    afficher()

    expect(await screen.findByText('Impossible de charger les paiements du tour.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it('hors connexion : action principale « Connexion requise » inactive', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    tontine()
    tour()
    recap()
    afficher()

    expect(await screen.findByRole('button', { name: 'Connexion requise' })).toBeDisabled()
  })
})
