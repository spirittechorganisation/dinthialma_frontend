/**
 * Caractérisation de PayerPage (spec 01, tâche 4.3) — « Payer ma cotisation ».
 *
 * Le membre paie hors de l'app puis déclare son paiement : POST /v1/tontines/:id/cotisations.
 * Données d'entrée : GET /v1/me/summary (résumé « Je cotise »), et pour les retards du tour en cours
 * GET du tour + GET de mes paiements. Seul le moyen « Espèces » (CASH) est ouvert aujourd'hui.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http, HttpResponse, delay } from 'msw'
import { API, ok, page, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement, emplacement, etatNavigation } from '@/test/router'
import { uneCotisation } from '@/test/factories/cotisation'
import { unCycle } from '@/test/factories/cycle'
import { CotisationStatut } from '@/types/common'
import { LAST_METHOD_KEY } from '@/lib/paymentMethods'
import { PayerPage } from './PayerPage'

// ─── Données ─────────────────────────────────────────────────────────────────

type Brut = Record<string, unknown>

/** Ligne du résumé « Je cotise » au format renvoyé par GET /v1/me/summary */
function uneLigne(surcharge: Brut = {}, due: Brut | null = {}): Brut {
  const id = (surcharge.tontineId as string) ?? 't1'
  const cycleEnCours = { cycleId: `c-${id}`, numeroCycle: 6, dateDebut: '2026-11-01', dateFin: '2026-11-30' }
  return {
    tontineId: id, nom: 'Famille', tontineType: 'ROTATIVE', statut: 'ACTIVE',
    cotisationsParTour: 1, echeancesARegulariser: [],
    monMembreId: `m-${id}`, monStatutMembre: 'ACTIF', ordreJackpot: 3, aRecuJackpot: false,
    totalCotiseValide: 25000, totalEnAttente: 0, toursPayes: 5, toursTotal: 12,
    cycleEnCours,
    cotisationDue: due === null ? null : {
      montant: 5000, montantLibre: false, montantMinimum: null, dateLimite: '2026-11-30',
      statut: 'A_PAYER', cotisationId: null, echeancesEnRetard: 0, ...due,
    },
    gestionnaire: { firstName: 'Moussa', lastName: 'Diop', phone: '+221771234567' },
    ...surcharge,
  }
}

function resume(...tontines: Brut[]) {
  server.use(http.get(`${API}/v1/me/summary`, () => ok({ totalCotiseValide: 0, totalEnAttente: 0, tontines })))
}

/** Capture les déclarations envoyées et répond avec la cotisation créée */
function declarationsCapturees(reponse: () => Response | Promise<Response> = () => ok(uneCotisation({ id: 'cot-new', statut: CotisationStatut.EN_ATTENTE }))) {
  const envois: { tontineId: string; corps: Brut }[] = []
  server.use(
    http.post(`${API}/v1/tontines/:tontineId/cotisations`, async ({ request, params }) => {
      envois.push({ tontineId: String(params.tontineId), corps: (await request.json()) as Brut })
      return reponse()
    }),
  )
  return envois
}

function afficher(route: string) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/payer" element={<PayerPage />} />
        <Route path="/payer/:tontineId" element={<PayerPage />} />
        <Route path="/recu/:tontineId/:cotisationId" element={<p>Écran du reçu</p>} />
      </Routes>
      <Emplacement />
    </>,
    { route, auth: 'membre' },
  )
}

const boutonConfirmer = () => screen.findByRole('button', { name: /confirmer mon paiement|connexion requise|envoi/i })

beforeEach(() => {
  // Seule l'horloge est simulée : les délais réels restent actifs pour MSW et userEvent
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T10:00:00Z'))
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── Choix de la tontine ─────────────────────────────────────────────────────

describe('[caractérisation] PayerPage — choix de la tontine (/payer)', () => {
  it('va directement à la déclaration quand une seule cotisation est à payer', async () => {
    resume(uneLigne())
    afficher('/payer')

    expect(await screen.findByRole('button', { name: 'Confirmer mon paiement de 5.000F' })).toBeInTheDocument()
    expect(emplacement()).toBe('/payer/t1')
  })

  it('liste les tontines : retards d\'abord, puis la date limite la plus proche, puis les autres', async () => {
    resume(
      uneLigne({ tontineId: 'tA', nom: 'Bureau' }, { dateLimite: '2026-11-28' }),
      uneLigne({ tontineId: 'tB', nom: 'Quartier' }, { dateLimite: '2026-11-22' }),
      uneLigne({ tontineId: 'tC', nom: 'Famille', echeancesARegulariser: [
        { cycleId: 'c0', numeroCycle: 4, echeanceId: 'e4', numeroEcheance: 1, echeanceAt: '2026-10-31T23:59:00Z', montant: 5000 },
        { cycleId: 'c00', numeroCycle: 5, echeanceId: 'e5', numeroEcheance: 1, echeanceAt: '2026-11-15T23:59:00Z', montant: 5000 },
      ] }, { statut: 'VALIDE', cotisationId: 'cot9' }),
      uneLigne({ tontineId: 'tD', nom: 'Amis' }, { statut: 'EN_ATTENTE', cotisationId: 'cot8' }),
    )
    afficher('/payer')

    expect(await screen.findByText('Pour quelle tontine ?')).toBeInTheDocument()
    const liens = screen.getAllByRole('link')
    expect(liens.map((l) => l.getAttribute('href'))).toEqual(['/payer/tC', '/payer/tB', '/payer/tA', '/payer/tD'])
    expect(liens[0]).toHaveTextContent('Famille2 cotisations en retard')
    expect(liens[1]).toHaveTextContent('Quartier5.000F · avant dim. 22 nov.')
    expect(liens[3]).toHaveTextContent('AmisDéclarée · en attente de validation')
  })

  it('affiche « Montant libre » pour une cotisation sans montant fixe', async () => {
    resume(
      uneLigne({ tontineId: 'tA', nom: 'Bureau' }, { montant: null, montantLibre: true }),
      uneLigne({ tontineId: 'tB', nom: 'Quartier' }),
    )
    afficher('/payer')

    expect(await screen.findByRole('link', { name: /Bureau/ })).toHaveTextContent('Montant libre · avant lun. 30 nov.')
  })

  it('indique qu\'il n\'y a rien à payer quand aucune tontine n\'a de cotisation', async () => {
    resume(uneLigne({}, null))
    afficher('/payer')

    expect(await screen.findByText('Rien à payer pour l\'instant')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('erreur de chargement du résumé : message et bouton Réessayer qui relance la requête', async () => {
    let appels = 0
    server.use(http.get(`${API}/v1/me/summary`, () => {
      appels++
      return appels === 1 ? erreur(500, 'INTERNAL_ERROR', 'Panne') : ok({ tontines: [uneLigne({}, null)] })
    }))
    const { user } = afficher('/payer')

    expect(await screen.findByText('Impossible de charger vos cotisations')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Rien à payer pour l\'instant')).toBeInTheDocument()
    expect(appels).toBe(2)
  })
})

// ─── Déclaration : cas nominaux ──────────────────────────────────────────────

describe('[caractérisation] PayerPage — déclaration (/payer/:tontineId)', () => {
  it('préremplit le montant et déclare le paiement en espèces, puis ouvre le reçu', async () => {
    resume(uneLigne())
    const envois = declarationsCapturees()
    const { user } = afficher('/payer/t1')

    expect(await screen.findByText('Famille · Tour 6')).toBeInTheDocument()
    expect(screen.getByText('5.000F')).toBeInTheDocument()
    expect(screen.getByText('À payer avant lun. 30 nov.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Espèces/ })).toHaveAttribute('aria-checked', 'true')

    await user.click(await boutonConfirmer())

    await waitFor(() => expect(emplacement()).toBe('/recu/t1/cot-new'))
    expect(envois).toEqual([{ tontineId: 't1', corps: { cycleId: 'c-t1', montant: 5000, methodePaiement: 'CASH' } }])
    expect(etatNavigation()).toEqual({ justCreated: true })
    expect(screen.getByText('Écran du reçu')).toBeInTheDocument()
  })

  it('mémorise le moyen de paiement utilisé après une déclaration réussie', async () => {
    resume(uneLigne())
    declarationsCapturees()
    const { user } = afficher('/payer/t1')

    await user.click(await boutonConfirmer())

    await waitFor(() => expect(localStorage.getItem(LAST_METHOD_KEY)).toBe('CASH'))
  })

  it.each([
    ['un moyen pas encore ouvert (Wave)', 'WAVE'],
    ['un moyen inconnu', 'CHEQUE'],
  ])('présélectionne Espèces quand le moyen mémorisé est %s', async (_cas, memorise) => {
    localStorage.setItem(LAST_METHOD_KEY, memorise)
    resume(uneLigne())
    afficher('/payer/t1')

    expect(await screen.findByRole('radio', { name: /Espèces/ })).toHaveAttribute('aria-checked', 'true')
    // Les moyens mobiles sont affichés mais grisés
    expect(screen.getByRole('radio', { name: /Wave/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Orange Money/ })).toBeDisabled()
    expect(screen.queryByRole('radio', { name: /Free Money/ })).not.toBeInTheDocument()
    // Espèces n'est pas un moyen mobile : pas de numéro du gestionnaire à copier
    expect(screen.queryByRole('button', { name: /Copier/ })).not.toBeInTheDocument()
  })

  it('envoie la référence du transfert : saisie limitée à 30 caractères, espaces retirés à l\'envoi', async () => {
    resume(uneLigne())
    const envois = declarationsCapturees()
    const { user } = afficher('/payer/t1')

    await user.click(await screen.findByRole('button', { name: 'Ajouter la référence du transfert' }))
    await user.type(screen.getByRole('textbox', { name: 'Référence du transfert (facultatif)' }), '  REF-1234567890-ABCDEFGHIJKLMNOPQRST')
    await user.click(await boutonConfirmer())

    await waitFor(() => expect(envois).toHaveLength(1))
    // La limite s'applique à la saisie brute (les 2 espaces de tête comptent), le trim vient ensuite :
    // 30 caractères saisis → 28 envoyés
    expect(envois[0].corps.referenceTransaction).toBe('REF-1234567890-ABCDEFGHIJKLM')
  })

  it('tour à plusieurs cotisations (B32) : affiche « cotisation 2 sur 4 » et envoie l\'échéance en cours', async () => {
    resume(uneLigne({ cotisationsParTour: 4 }, { echeanceId: 'e2', numeroEcheance: 2, nombreEcheances: 4, echeanceAt: '2026-11-22T20:00:00Z' }))
    const envois = declarationsCapturees()
    const { user } = afficher('/payer/t1')

    expect(await screen.findByText('Famille · Tour 6 · cotisation 2 sur 4')).toBeInTheDocument()
    expect(screen.getByText('À payer avant dim. 22 nov. à 20h')).toBeInTheDocument()
    await user.click(await boutonConfirmer())

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0].corps).toEqual({ cycleId: 'c-t1', echeanceId: 'e2', montant: 5000, methodePaiement: 'CASH' })
  })

  it('montant libre : pavé numérique, minimum respecté, montant saisi envoyé', async () => {
    resume(uneLigne({}, { montant: null, montantLibre: true, montantMinimum: 2000 }))
    const envois = declarationsCapturees()
    const { user } = afficher('/payer/t1')

    expect(await screen.findByText('Montant libre · minimum 2.000F')).toBeInTheDocument()
    const confirmer = await boutonConfirmer()
    expect(confirmer).toBeDisabled()

    const pave = screen.getByLabelText('Pavé numérique')
    await user.click(within(pave).getByRole('button', { name: '1' }))
    await user.click(within(pave).getByRole('button', { name: '5' }))
    await user.click(within(pave).getByRole('button', { name: '000' }))
    // 15 000 saisi puis corrigé à 1 500 : sous le minimum, le bouton reste inactif
    await user.click(within(pave).getByRole('button', { name: 'Effacer' }))
    expect(screen.getByRole('button', { name: 'Confirmer mon paiement de 1.500F' })).toBeDisabled()

    await user.click(within(pave).getByRole('button', { name: '0' }))
    const actif = screen.getByRole('button', { name: 'Confirmer mon paiement de 15.000F' })
    expect(actif).toBeEnabled()
    await user.click(actif)

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0].corps).toEqual({ cycleId: 'c-t1', montant: 15000, methodePaiement: 'CASH' })
  })

  it('régularisation (B33) : propose le retard d\'un tour remis, payable à la place de la cotisation en cours', async () => {
    resume(uneLigne({ echeancesARegulariser: [
      { cycleId: 'c-ancien', numeroCycle: 4, echeanceId: 'e-ancienne', numeroEcheance: 1, echeanceAt: '2026-10-31T23:59:00Z', montant: 5000 },
    ] }))
    const envois = declarationsCapturees()
    const { user } = afficher('/payer/t1')

    const choix = await screen.findByRole('radiogroup', { name: 'Cotisation à payer' })
    const options = within(choix).getAllByRole('radio')
    // Le nombre de cotisations d'un tour remis n'est pas connu (null) : le libellé affiche
    // « cotisation 1 » même si ce tour n'en comptait qu'une
    expect(options.map((o) => o.textContent)).toEqual([
      'Tour 4 · cotisation 1En retard · échue le sam. 31 oct.5.000F',
      'Tour 6Avant lun. 30 nov.5.000F',
    ])
    // Par défaut : la cotisation en cours
    expect(options[1]).toHaveAttribute('aria-checked', 'true')

    await user.click(options[0])
    expect(screen.getByText('Famille · Tour 4 · cotisation 1')).toBeInTheDocument()
    await user.click(await boutonConfirmer())

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0].corps).toEqual({ cycleId: 'c-ancien', echeanceId: 'e-ancienne', montant: 5000, methodePaiement: 'CASH' })
  })

  it('retard du tour en cours : interroge le tour et mes paiements, ne propose que les échéances échues non couvertes', async () => {
    resume(uneLigne({ cotisationsParTour: 3 }, {
      echeanceId: 'e3', numeroEcheance: 3, nombreEcheances: 3, echeanceAt: '2026-11-25T23:59:00Z', echeancesEnRetard: 2,
    }))
    let requetePaiements: URL | undefined
    server.use(
      http.get(`${API}/v1/tontines/t1/cycles/c-t1`, () => ok(unCycle({
        id: 'c-t1', numeroCycle: 6,
        echeances: [
          { id: 'e1', numero: 1, statut: 'ECHUE', echeanceAt: '2026-11-05T23:59:00Z' },
          { id: 'e2', numero: 2, statut: 'ECHUE', echeanceAt: '2026-11-15T23:59:00Z' },
          { id: 'e3', numero: 3, statut: 'EN_COURS', echeanceAt: '2026-11-25T23:59:00Z' },
        ],
      } as never))),
      http.get(`${API}/v1/tontines/t1/cotisations`, ({ request }) => {
        requetePaiements = new URL(request.url)
        // e2 déjà déclarée par moi : elle ne doit plus être proposée
        return page([uneCotisation({ id: 'cot-e2', echeanceId: 'e2', statut: CotisationStatut.EN_ATTENTE } as never)])
      }),
    )
    const envois = declarationsCapturees()
    const { user } = afficher('/payer/t1')

    const choix = await screen.findByRole('radiogroup', { name: 'Cotisation à payer' })
    const options = within(choix).getAllByRole('radio')
    expect(options.map((o) => o.textContent)).toEqual([
      'Tour 6 · cotisation 1 sur 3En retard · échue le jeu. 5 nov.5.000F',
      'Tour 6 · cotisation 3 sur 3Avant mer. 25 nov.5.000F',
    ])
    expect(Object.fromEntries(requetePaiements!.searchParams)).toEqual({
      page: '0', size: '50', sort: 'createdAt,desc', cycleId: 'c-t1', membreId: 'm-t1',
    })

    await user.click(options[0])
    await user.click(await boutonConfirmer())
    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0].corps).toEqual({ cycleId: 'c-t1', echeanceId: 'e1', montant: 5000, methodePaiement: 'CASH' })
  })

  it('affiche le motif du dernier refus et permet de déclarer à nouveau', async () => {
    resume(uneLigne({}, { motifDernierRefus: 'Transfert non reçu' }))
    afficher('/payer/t1')

    const bandeau = await screen.findByText((_, el) => el?.tagName === 'P' && !!el.textContent?.startsWith('Votre paiement a été refusé'))
    expect(bandeau).toHaveTextContent('Votre paiement a été refusé : Transfert non reçu. Vous pouvez le déclarer à nouveau.')
    expect(await boutonConfirmer()).toBeEnabled()
  })
})

// ─── Déclaration : rien à payer ─────────────────────────────────────────────

describe('[caractérisation] PayerPage — rien à déclarer', () => {
  it('cotisation déjà déclarée : message et lien vers le reçu', async () => {
    resume(uneLigne({}, { statut: 'EN_ATTENTE', cotisationId: 'cot-7' }))
    afficher('/payer/t1')

    expect(await screen.findByText('Cotisation déjà déclarée')).toBeInTheDocument()
    expect(screen.getByText('Famille · Tour 6 · en attente de validation par le gestionnaire')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir le reçu' })).toHaveAttribute('href', '/recu/t1/cot-7')
    expect(screen.queryByRole('button', { name: /confirmer/i })).not.toBeInTheDocument()
  })

  it('cotisation déjà validée : « Cotisation déjà payée »', async () => {
    resume(uneLigne({}, { statut: 'VALIDE', cotisationId: 'cot-8' }))
    afficher('/payer/t1')

    expect(await screen.findByText('Cotisation déjà payée')).toBeInTheDocument()
    expect(screen.getByText('Famille · Tour 6')).toBeInTheDocument()
  })

  it('aucun tour ouvert', async () => {
    resume(uneLigne({}, null))
    afficher('/payer/t1')

    expect(await screen.findByText('Aucun tour ouvert')).toBeInTheDocument()
    expect(screen.getByText('Il n\'y a pas de tour en cours pour Famille. Vous serez prévenu à son ouverture.')).toBeInTheDocument()
  })

  it('tontine où je ne cotise pas', async () => {
    resume(uneLigne())
    afficher('/payer/autre-tontine')

    expect(await screen.findByText('Vous ne cotisez pas dans cette tontine')).toBeInTheDocument()
  })
})

// ─── Déclaration : erreurs ───────────────────────────────────────────────────

describe('[caractérisation] PayerPage — erreurs de déclaration', () => {
  it('cotisation déjà déclarée (409) : message affiché, on reste sur l\'écran', async () => {
    resume(uneLigne())
    declarationsCapturees(() => erreur(409, 'COTISATION_ALREADY_EXISTS', 'Doublon'))
    const { user } = afficher('/payer/t1')

    await user.click(await boutonConfirmer())

    expect(await screen.findByRole('alert')).toHaveTextContent('Un paiement existe déjà pour cette cotisation.')
    expect(emplacement()).toBe('/payer/t1')
    expect(localStorage.getItem(LAST_METHOD_KEY)).toBeNull()
  })

  it('erreur serveur : message générique du service, bouton de nouveau actif', async () => {
    resume(uneLigne())
    declarationsCapturees(() => erreur(500, 'INTERNAL_ERROR', 'NullPointerException'))
    const { user } = afficher('/payer/t1')

    await user.click(await boutonConfirmer())

    expect(await screen.findByRole('alert')).toHaveTextContent('Service momentanément indisponible, réessayez.')
    expect(screen.getByRole('button', { name: 'Confirmer mon paiement de 5.000F' })).toBeEnabled()
  })

  it('erreur sans code connu : message du backend affiché', async () => {
    resume(uneLigne())
    declarationsCapturees(() => erreur(400, 'AUTRE_CODE', 'Le tour est clôturé.'))
    const { user } = afficher('/payer/t1')

    await user.click(await boutonConfirmer())

    expect(await screen.findByRole('alert')).toHaveTextContent('Le tour est clôturé.')
  })

  it('erreur réseau : message de connexion', async () => {
    resume(uneLigne())
    declarationsCapturees(() => HttpResponse.error())
    const { user } = afficher('/payer/t1')

    await user.click(await boutonConfirmer())

    expect(await screen.findByRole('alert')).toHaveTextContent('Pas de connexion. Vérifiez votre réseau et réessayez.')
  })

  it('pendant l\'envoi : bouton « Envoi… » inactif, une seule déclaration envoyée', async () => {
    resume(uneLigne())
    const envois = declarationsCapturees(async () => { await delay(150); return ok(uneCotisation({ id: 'cot-new' })) })
    const { user } = afficher('/payer/t1')

    const bouton = await boutonConfirmer()
    await user.click(bouton)
    expect(await screen.findByRole('button', { name: 'Envoi…' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Envoi…' }))

    await waitFor(() => expect(emplacement()).toBe('/recu/t1/cot-new'))
    expect(envois).toHaveLength(1)
  })

  it('hors connexion : bouton « Connexion requise » inactif, rien n\'est envoyé', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    resume(uneLigne())
    const envois = declarationsCapturees()
    const { user } = afficher('/payer/t1')

    const bouton = await screen.findByRole('button', { name: 'Connexion requise' })
    expect(bouton).toBeDisabled()
    await user.click(bouton)

    expect(envois).toHaveLength(0)
  })

  it('perte de connexion pendant la saisie : le bouton passe à « Connexion requise »', async () => {
    resume(uneLigne())
    afficher('/payer/t1')

    expect(await boutonConfirmer()).toBeEnabled()
    window.dispatchEvent(new Event('offline'))

    expect(await screen.findByRole('button', { name: 'Connexion requise' })).toBeDisabled()
  })
})
