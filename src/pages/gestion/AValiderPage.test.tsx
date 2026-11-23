/**
 * Caractérisation de AValiderPage (spec 01, tâche 4.4) — file « À valider » du gestionnaire.
 *
 * Données : GET /v1/me/gestion/cotisations (statut=EN_ATTENTE, toutes pages) et
 * GET /v1/me/gestion/demandes (demandes d'adhésion, en tête de la file).
 * - Valider : la ligne disparaît, un toast propose « Annuler » pendant 5 s, puis PUT …/valider.
 *   En quittant l'écran, les validations encore annulables partent immédiatement.
 * - Tout valider / Valider la sélection (desktop) : confirmation puis POST /v1/me/gestion/cotisations/valider
 *   (bilan par paiement, lots de 100).
 * - Refuser : motif obligatoire, PUT …/refuser.
 *
 * jsdom n'applique pas le CSS : la liste mobile (éléments de liste) ET le tableau desktop (lignes)
 * sont rendus ensemble. Les tests ciblent explicitement l'une ou l'autre vue.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor, fireEvent, act } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { http, HttpResponse, delay } from 'msw'
import { API, ok, page, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement, emplacement } from '@/test/router'
import { uneCotisationAValider } from '@/test/factories/cotisation'
import type { CotisationAValider } from '@/types/me'
import { AValiderPage } from './AValiderPage'

// ─── Données ─────────────────────────────────────────────────────────────────

const AWA = uneCotisationAValider({
  id: 'av-awa', tontineId: 't1', tontineNom: 'Famille', montant: 5000, methodePaiement: 'CASH',
  referenceTransaction: 'TX-111', createdAt: '2026-11-18T09:15:00Z',
  membre: { membreId: 'm-awa', userId: 'u-awa', firstName: 'Awa', lastName: 'Diop', phone: '+221770000001' },
})
const BINETA = uneCotisationAValider({
  id: 'av-bineta', tontineId: 't1', tontineNom: 'Famille', montant: 10000, methodePaiement: 'CASH',
  createdAt: '2026-11-18T10:00:00Z',
  membre: { membreId: 'm-bineta', userId: 'u-bineta', firstName: 'Bineta', lastName: 'Fall', phone: '+221770000002' },
})
const CHEIKH = uneCotisationAValider({
  id: 'av-cheikh', tontineId: 't2', tontineNom: 'Bureau', montant: 2000, methodePaiement: 'WAVE',
  createdAt: '2026-11-19T08:00:00Z',
  membre: { membreId: 'm-cheikh', userId: 'u-cheikh', firstName: 'Cheikh', lastName: 'Ba', phone: '+221770000003' },
})

/** File « À valider » renvoyée par le serveur ; renvoie les URL des requêtes reçues */
function file(items: CotisationAValider[]) {
  const requetes: URL[] = []
  server.use(http.get(`${API}/v1/me/gestion/cotisations`, ({ request }) => {
    requetes.push(new URL(request.url))
    return page(items)
  }))
  return requetes
}

/** Capture les validations unitaires (PUT …/valider) */
function validationsUnitaires(reponse: () => Response = () => ok(null)) {
  const envois: string[] = []
  server.use(http.put(`${API}/v1/tontines/:tontineId/cotisations/:cotisationId/valider`, ({ params }) => {
    envois.push(`${params.tontineId}/${params.cotisationId}`)
    return reponse()
  }))
  return envois
}

/** Capture les validations groupées ; `resultat` décide du sort de chaque paiement */
function validationsGroupees(resultat: (id: string) => { succes: boolean; code?: string } = () => ({ succes: true })) {
  const envois: string[][] = []
  server.use(http.post(`${API}/v1/me/gestion/cotisations/valider`, async ({ request }) => {
    const { cotisationIds } = (await request.json()) as { cotisationIds: string[] }
    envois.push(cotisationIds)
    const resultats = cotisationIds.map((id) => {
      const r = resultat(id)
      return { cotisationId: id, succes: r.succes, statut: r.succes ? 'VALIDE' : null, code: r.code ?? null, message: null }
    })
    return ok({
      total: cotisationIds.length,
      validees: resultats.filter((r) => r.succes).length,
      echecs: resultats.filter((r) => !r.succes).length,
      resultats,
    })
  }))
  return envois
}

function afficher(route = '/a-valider') {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/a-valider" element={<AValiderPage />} />
        <Route path="/accueil" element={<p>Accueil</p>} />
        <Route path="/recu/:tontineId/:cotisationId" element={<p>Reçu</p>} />
      </Routes>
      <Emplacement />
      <Toaster />
    </>,
    { route, auth: 'gestionnaire' },
  )
}

/** Ligne de la liste mobile d'un membre */
const ligneMobile = (nom: string) => {
  const li = screen.getAllByRole('listitem').find((el) => within(el).queryByText(nom))
  if (!li) throw new Error(`Ligne mobile introuvable : ${nom}`)
  return li
}
/** Ligne du tableau desktop d'un membre */
const ligneTableau = (nom: string) => within(screen.getByRole('table')).getByRole('row', { name: new RegExp(nom) })
/**
 * Membres présents dans la liste mobile. `hidden: true` : quand une feuille modale est ouverte,
 * Headless UI masque le reste de la page aux technologies d'assistance ; la liste reste affichée derrière.
 */
const membresVisibles = () => ['Awa Diop', 'Bineta Fall', 'Cheikh Ba'].filter((n) =>
  screen.queryAllByRole('listitem', { hidden: true }).some((el) => within(el).queryByText(n)))

beforeEach(() => {
  // Horloge et minuteries simulées (annulation sur 5 s) ; le temps réel continue d'avancer
  // pour que MSW, React Query et userEvent fonctionnent normalement.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-11-20T10:00:00Z'))
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

afterEach(() => {
  // Les toasts de sonner vivent dans un stockage global au module : on les ferme (et on laisse
  // passer leur animation de sortie) pour qu'ils ne réapparaissent pas dans le test suivant.
  act(() => { toast.dismiss() })
  act(() => { vi.advanceTimersByTime(1_000) })
  vi.useRealTimers()
})

// ─── Affichage ───────────────────────────────────────────────────────────────

describe('[caractérisation] AValiderPage — affichage de la file', () => {
  it('demande les paiements en attente, du plus ancien au plus récent', async () => {
    const requetes = file([AWA])
    afficher()

    await screen.findAllByText('Awa Diop')
    expect(Object.fromEntries(requetes[0].searchParams)).toEqual({ statut: 'EN_ATTENTE', page: '0', size: '100', sort: 'createdAt,asc' })
  })

  it('filtre sur une tontine avec ?tontine=', async () => {
    const requetes = file([AWA])
    afficher('/a-valider?tontine=t1')

    await screen.findAllByText('Awa Diop')
    expect(requetes[0].searchParams.get('tontineId')).toBe('t1')
  })

  it('liste mobile groupée par tontine avec total, montant, moyen, référence et date', async () => {
    file([AWA, BINETA, CHEIKH])
    afficher()

    // Résumé au-dessus de la liste mobile (celui du tableau desktop découpe le montant dans un <span>)
    expect(await screen.findByText('3 paiements · 17.000F')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Famille' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bureau' })).toBeInTheDocument()
    expect(ligneMobile('Awa Diop')).toHaveTextContent('5.000F · Espèces · TX-111')
    expect(ligneMobile('Awa Diop')).toHaveTextContent('18 nov. · 09:15')
    expect(ligneMobile('Cheikh Ba')).toHaveTextContent('2.000F · Wave')
  })

  it('une seule tontine : pas de titre de groupe ; un seul paiement : pas de « Tout valider »', async () => {
    file([AWA])
    afficher()

    await screen.findByText('1 paiement · 5.000F')
    expect(screen.queryByRole('heading', { name: 'Famille' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Tout valider/ })).not.toBeInTheDocument()
  })

  it('tableau desktop : colonne Tontine si plusieurs tontines, référence ou tiret', async () => {
    file([AWA, CHEIKH])
    afficher()

    await screen.findAllByText('Awa Diop')
    const tableau = screen.getByRole('table')
    expect(within(tableau).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(
      ['', 'Membre', 'Tontine', 'Montant', 'Moyen', 'Référence', 'Déclaré le', 'Actions'],
    )
    expect(within(ligneTableau('Awa Diop')).getAllByRole('cell').map((td) => td.textContent).slice(1, 7)).toEqual(
      ['ADAwa Diop', 'Famille', '5.000F', 'Espèces', 'TX-111', '18 nov. · 09:15'],
    )
    expect(within(ligneTableau('Cheikh Ba')).getAllByRole('cell')[5]).toHaveTextContent('—')
  })

  it('ouvre le reçu en touchant une ligne', async () => {
    file([AWA])
    const { user } = afficher()

    await screen.findAllByText('Awa Diop')
    await user.click(within(ligneMobile('Awa Diop')).getByRole('button', { name: /Awa Diop/ }))

    expect(emplacement()).toBe('/recu/t1/av-awa')
  })

  it('file vide : « Rien à valider ✓ »', async () => {
    file([])
    afficher()

    expect(await screen.findByText('Rien à valider ✓')).toBeInTheDocument()
    expect(screen.getByText('Tous les paiements déclarés sont traités.')).toBeInTheDocument()
  })

  it('erreur de chargement : message et Réessayer qui relance la requête', async () => {
    let appels = 0
    server.use(http.get(`${API}/v1/me/gestion/cotisations`, () => {
      appels++
      return appels === 1 ? erreur(500, 'INTERNAL_ERROR', 'Panne') : page([AWA])
    }))
    const { user } = afficher()

    expect(await screen.findByText('Impossible de charger les paiements.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findAllByText('Awa Diop')).not.toHaveLength(0)
    expect(appels).toBe(2)
  })
})

// ─── Valider un paiement (avec annulation) ───────────────────────────────────

describe('[caractérisation] AValiderPage — valider avec annulation possible pendant 5 s', () => {
  it('masque la ligne tout de suite et n\'envoie la validation qu\'après 5 s', async () => {
    file([AWA, BINETA])
    const envois = validationsUnitaires()
    const { user } = afficher()

    await screen.findAllByText('Awa Diop')
    await user.click(within(ligneMobile('Awa Diop')).getByRole('button', { name: 'Valider' }))

    expect(await screen.findByText('Paiement de Awa validé')).toBeInTheDocument()
    expect(membresVisibles()).toEqual(['Bineta Fall'])
    // À 4 s : toujours rien. On laisse 200 ms réels à une éventuelle requête pour arriver
    // jusqu'à MSW (l'envoi est asynchrone) avant de conclure qu'elle n'est pas partie.
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000) })
    await act(async () => { await new Promise((r) => setTimeout(r, 200)) })
    expect(envois).toEqual([])

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    await waitFor(() => expect(envois).toEqual(['t1/av-awa']))
    expect(membresVisibles()).toEqual(['Bineta Fall'])
  })

  it('« Annuler » dans le toast : la ligne revient et rien n\'est envoyé', async () => {
    file([AWA, BINETA])
    const envois = validationsUnitaires()
    const { user } = afficher()

    await screen.findAllByText('Awa Diop')
    await user.click(within(ligneMobile('Awa Diop')).getByRole('button', { name: 'Valider' }))
    await user.click(await screen.findByRole('button', { name: 'Annuler' }))

    expect(membresVisibles()).toEqual(['Awa Diop', 'Bineta Fall'])
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000) })
    await act(async () => { await new Promise((r) => setTimeout(r, 200)) })
    expect(envois).toEqual([])
  })

  it('validation en échec après 5 s : la ligne revient avec un message', async () => {
    file([AWA])
    validationsUnitaires(() => erreur(409, 'COTISATION_NOT_PENDING', 'Déjà traité'))
    const { user } = afficher()

    await screen.findAllByText('Awa Diop')
    await user.click(within(ligneMobile('Awa Diop')).getByRole('button', { name: 'Valider' }))
    expect(await screen.findByText('Rien à valider ✓')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(5_000) })

    expect(await screen.findByText('La validation du paiement de Awa a échoué.')).toBeInTheDocument()
    expect(membresVisibles()).toEqual(['Awa Diop'])
  })

  it('en quittant l\'écran, une validation encore annulable part immédiatement', async () => {
    file([AWA])
    const envois = validationsUnitaires()
    const { user, unmount } = afficher()

    await screen.findAllByText('Awa Diop')
    await user.click(within(ligneMobile('Awa Diop')).getByRole('button', { name: 'Valider' }))
    expect(envois).toEqual([])

    unmount()

    await waitFor(() => expect(envois).toEqual(['t1/av-awa']))
  })

  it('balayer une ligne vers la droite de plus de 96 px valide ; un geste plus court ne fait rien', async () => {
    file([AWA, BINETA])
    afficher()
    await screen.findAllByText('Awa Diop')

    const glisser = (li: HTMLElement, distance: number) => {
      fireEvent.touchStart(li, { touches: [{ clientX: 10 }] })
      fireEvent.touchMove(li, { touches: [{ clientX: 10 + distance }] })
      fireEvent.touchEnd(li)
    }

    glisser(ligneMobile('Bineta Fall'), 90)
    expect(membresVisibles()).toEqual(['Awa Diop', 'Bineta Fall'])

    glisser(ligneMobile('Awa Diop'), 120)
    expect(await screen.findByText('Paiement de Awa validé')).toBeInTheDocument()
    expect(membresVisibles()).toEqual(['Bineta Fall'])
  })
})

// ─── Validation groupée ──────────────────────────────────────────────────────

describe('[caractérisation] AValiderPage — Tout valider et sélection', () => {
  it('« Tout valider » : confirmation avec le montant, puis un seul POST avec tous les paiements', async () => {
    file([AWA, BINETA, CHEIKH])
    const envois = validationsGroupees()
    const { user } = afficher()

    const boutons = await screen.findAllByRole('button', { name: 'Tout valider (3)' })
    expect(boutons).toHaveLength(2) // barre desktop + bouton mobile
    await user.click(boutons[1])
    const confirmation = await screen.findByRole('dialog', { name: 'Valider 3 paiements ?' })
    expect(within(confirmation).getByText('17.000F seront marqués comme reçus et les membres seront prévenus.')).toBeInTheDocument()
    await user.click(within(confirmation).getByRole('button', { name: 'Valider' }))

    expect(await screen.findByText('3 paiements validés')).toBeInTheDocument()
    expect(envois).toEqual([['av-awa', 'av-bineta', 'av-cheikh']])

    await user.click(screen.getByRole('button', { name: 'Terminé' }))
    expect(emplacement()).toBe('/accueil')
  })

  it('« Annuler » dans la confirmation : rien n\'est envoyé', async () => {
    file([AWA, BINETA])
    const envois = validationsGroupees()
    const { user } = afficher()

    await user.click((await screen.findAllByRole('button', { name: 'Tout valider (2)' }))[1])
    const confirmation = await screen.findByRole('dialog', { name: 'Valider 2 paiements ?' })
    await user.click(within(confirmation).getByRole('button', { name: 'Annuler' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(envois).toEqual([])
    expect(membresVisibles()).toEqual(['Awa Diop', 'Bineta Fall'])
  })

  it('échec partiel : bilan, les paiements en échec restent dans la liste, les « déjà traités » en sortent', async () => {
    file([AWA, BINETA, CHEIKH])
    validationsGroupees((id) => (
      id === 'av-bineta' ? { succes: false, code: 'AMOUNT_MISMATCH' }
        : id === 'av-cheikh' ? { succes: false, code: 'COTISATION_NOT_PENDING' }
          : { succes: true }
    ))
    const { user } = afficher()

    await user.click((await screen.findAllByRole('button', { name: 'Tout valider (3)' }))[1])
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Valider' }))

    expect(await screen.findByText('1 paiement validé')).toBeInTheDocument()
    expect(screen.getByText('1 déjà traité entre-temps.')).toBeInTheDocument()
    // BUG: accord au singulier manquant : « 1 n'ont pas pu être validés. Ils restent dans la liste. »
    // Attendu : « 1 n'a pas pu être validé. Il reste dans la liste. » (les deux messages voisins accordent bien).
    expect(screen.getByText('1 n\'ont pas pu être validés. Ils restent dans la liste.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Revoir la liste' }))
    expect(membresVisibles()).toEqual(['Bineta Fall'])
  })

  it('erreur de la validation groupée : toutes les lignes reviennent avec un message', async () => {
    file([AWA, BINETA])
    server.use(http.post(`${API}/v1/me/gestion/cotisations/valider`, () => erreur(500, 'INTERNAL_ERROR', 'Panne')))
    const { user } = afficher()

    await user.click((await screen.findAllByRole('button', { name: 'Tout valider (2)' }))[1])
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Valider' }))

    expect(await screen.findByText('Service momentanément indisponible, réessayez.')).toBeInTheDocument()
    expect(membresVisibles()).toEqual(['Awa Diop', 'Bineta Fall'])
  })

  it('pendant l\'envoi de « Tout valider » : « Rien à valider ✓ » s\'affiche brièvement avant le bilan', async () => {
    // Comportement actuel : toutes les lignes sont masquées dès l'envoi, la file paraît vide
    // le temps de la réponse, puis l'écran de bilan s'affiche.
    file([AWA, BINETA])
    server.use(http.post(`${API}/v1/me/gestion/cotisations/valider`, async () => {
      await delay(200)
      return ok({ total: 2, validees: 2, echecs: 0, resultats: [] })
    }))
    const { user } = afficher()

    await user.click((await screen.findAllByRole('button', { name: 'Tout valider (2)' }))[1])
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Valider' }))

    expect(await screen.findByText('Rien à valider ✓')).toBeInTheDocument()
    expect(await screen.findByText('2 paiements validés')).toBeInTheDocument()
  })

  it('pendant l\'envoi d\'une sélection partielle : « Validation… » et actions inactives', async () => {
    file([AWA, BINETA])
    server.use(http.post(`${API}/v1/me/gestion/cotisations/valider`, async () => {
      await delay(300)
      return ok({ total: 1, validees: 1, echecs: 0, resultats: [{ cotisationId: 'av-awa', succes: true, statut: 'VALIDE' }] })
    }))
    const { user } = afficher()

    await screen.findAllByText('Awa Diop')
    await user.click(screen.getByRole('checkbox', { name: 'Sélectionner le paiement de Awa Diop' }))
    await user.click(screen.getByRole('button', { name: 'Valider la sélection (1)' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Valider 1 paiement ?' })).getByRole('button', { name: 'Valider' }))

    expect(await screen.findByRole('button', { name: 'Validation…' })).toBeDisabled()
    expect(within(ligneMobile('Bineta Fall')).getByRole('button', { name: 'Valider' })).toBeDisabled()
    expect(within(ligneMobile('Bineta Fall')).getByRole('button', { name: 'Refuser' })).toBeDisabled()
    expect(await screen.findByText('1 paiement validé')).toBeInTheDocument()
  })

  it('plus de 100 paiements : envoi en lots de 100', async () => {
    const beaucoup = Array.from({ length: 101 }, (_, i) => uneCotisationAValider({
      id: `av-${i}`, tontineId: 't1', tontineNom: 'Famille', montant: 1000,
      membre: { membreId: `m-${i}`, userId: `u-${i}`, firstName: `Membre${i}`, lastName: 'Test', phone: null as never },
    }))
    file(beaucoup)
    const envois = validationsGroupees()
    const { user } = afficher()

    await user.click((await screen.findAllByRole('button', { name: 'Tout valider (101)' }))[1])
    await user.click(within(await screen.findByRole('dialog', { name: 'Valider 101 paiements ?' })).getByRole('button', { name: 'Valider' }))

    // Attente allongée (FR29, accord du responsable produit le 23/11/2026) : deux envois puis le nouveau rendu
    // de 101 lignes dépassent parfois 5 s sous couverture quand la machine est chargée (échec isolé en FR24-26)
    expect(await screen.findByText('101 paiements validés', {}, { timeout: 15_000 })).toBeInTheDocument()
    expect(envois.map((lot) => lot.length)).toEqual([100, 1])
  })

  it('desktop : cocher des lignes puis « Valider la sélection » n\'envoie que la sélection', async () => {
    file([AWA, BINETA, CHEIKH])
    const envois = validationsGroupees()
    const { user } = afficher()

    await screen.findAllByText('Awa Diop')
    const selection = screen.getByRole('button', { name: 'Valider la sélection' })
    expect(selection).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: 'Sélectionner le paiement de Awa Diop' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sélectionner le paiement de Cheikh Ba' }))
    await user.click(screen.getByRole('button', { name: 'Valider la sélection (2)' }))
    const confirmation = await screen.findByRole('dialog', { name: 'Valider 2 paiements ?' })
    expect(within(confirmation).getByText(/^7\.000F seront marqués/)).toBeInTheDocument()
    await user.click(within(confirmation).getByRole('button', { name: 'Valider' }))

    expect(await screen.findByText('2 paiements validés')).toBeInTheDocument()
    expect(envois).toEqual([['av-awa', 'av-cheikh']])
  })

  it('desktop : « Tout sélectionner » coche puis décoche toutes les lignes', async () => {
    file([AWA, BINETA])
    const { user } = afficher()

    await screen.findAllByText('Awa Diop')
    const tout = screen.getByRole('checkbox', { name: 'Tout sélectionner' })
    await user.click(tout)
    expect(screen.getByRole('button', { name: 'Valider la sélection (2)' })).toBeEnabled()
    expect(tout).toBeChecked()

    await user.click(tout)
    expect(screen.getByRole('button', { name: 'Valider la sélection' })).toBeDisabled()
  })
})

// ─── Refuser ─────────────────────────────────────────────────────────────────

describe('[caractérisation] AValiderPage — refuser', () => {
  it('refuse avec un motif obligatoire (PUT …/refuser) et retire la ligne', async () => {
    file([AWA, BINETA])
    const corps: unknown[] = []
    server.use(http.put(`${API}/v1/tontines/t1/cotisations/av-awa/refuser`, async ({ request }) => {
      corps.push(await request.json())
      return ok(null)
    }))
    const { user } = afficher()

    await screen.findAllByText('Awa Diop')
    await user.click(within(ligneMobile('Awa Diop')).getByRole('button', { name: 'Refuser' }))
    const feuille = await screen.findByRole('dialog', { name: 'Refuser le paiement de Awa ?' })
    expect(within(feuille).getByText('5.000F · le membre verra le motif et pourra déclarer à nouveau.')).toBeInTheDocument()
    expect(within(feuille).getByRole('button', { name: 'Refuser' })).toBeDisabled()

    await user.type(within(feuille).getByRole('textbox'), '  Aucun dépôt reçu  ')
    await user.click(within(feuille).getByRole('button', { name: 'Refuser' }))

    expect(await screen.findByText('Paiement de Awa refusé')).toBeInTheDocument()
    expect(corps).toEqual([{ motif: 'Aucun dépôt reçu' }])
    expect(membresVisibles()).toEqual(['Bineta Fall'])
  })

  it('refus en échec : message traduit, la ligne et la feuille restent', async () => {
    file([AWA])
    server.use(http.put(`${API}/v1/tontines/t1/cotisations/av-awa/refuser`, () => erreur(409, 'COTISATION_NOT_PENDING', 'Déjà traité')))
    const { user } = afficher()

    await screen.findAllByText('Awa Diop')
    await user.click(within(ligneMobile('Awa Diop')).getByRole('button', { name: 'Refuser' }))
    const feuille = await screen.findByRole('dialog', { name: 'Refuser le paiement de Awa ?' })
    await user.click(within(feuille).getByRole('button', { name: 'Doublon' }))
    await user.click(within(feuille).getByRole('button', { name: 'Refuser' }))

    expect(await screen.findByText('Ce paiement a déjà été traité.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Refuser le paiement de Awa ?' })).toBeInTheDocument()
    expect(membresVisibles()).toEqual(['Awa Diop'])
  })
})

// ─── Hors connexion ──────────────────────────────────────────────────────────

describe('[caractérisation] AValiderPage — hors connexion', () => {
  it('bandeau « Hors connexion » et toutes les actions inactives', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    file([AWA, BINETA])
    afficher()

    expect(await screen.findByText('Hors connexion · validation impossible')).toBeInTheDocument()
    for (const bouton of within(ligneMobile('Awa Diop')).getAllByRole('button', { name: /^(Valider|Refuser)$/ })) {
      expect(bouton).toBeDisabled()
    }
    for (const bouton of screen.getAllByRole('button', { name: 'Tout valider (2)' })) expect(bouton).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Tout sélectionner' })).toBeDisabled()
  })
})

// ─── Demandes d'adhésion ─────────────────────────────────────────────────────

describe('[caractérisation] AValiderPage — demandes d\'adhésion', () => {
  const DEMANDE = {
    id: 'd1', tontineId: 't1', tontineNom: 'Famille', statut: 'EN_ATTENTE', userId: 'u-fatou',
    firstName: 'Fatou', lastName: 'Sow', phone: '+221771112233', message: 'Je suis la cousine d\'Awa',
    motifRefus: null, membreId: null, createdAt: '2026-11-19T17:45:00Z', dateTraitement: null,
  }

  function demandes(requetes: URL[] = []) {
    server.use(http.get(`${API}/v1/me/gestion/demandes`, ({ request }) => {
      requetes.push(new URL(request.url))
      return page([DEMANDE])
    }))
    return requetes
  }

  it('affiche les demandes en attente en tête de la file', async () => {
    const requetes = demandes()
    file([])
    afficher()

    expect(await screen.findByRole('heading', { name: 'Demandes d\'adhésion (1)' })).toBeInTheDocument()
    const demande = ligneMobile('Fatou Sow')
    expect(demande).toHaveTextContent('Famille · 77 111 22 33')
    expect(demande).toHaveTextContent('« Je suis la cousine d\'Awa »')
    expect(Object.fromEntries(requetes[0].searchParams)).toEqual({ page: '0', size: '100', statut: 'EN_ATTENTE' })
  })

  it('accepte une demande (PUT …/accepter, corps vide) et le confirme', async () => {
    demandes()
    file([])
    const envois: { url: string; corps: unknown }[] = []
    server.use(http.put(`${API}/v1/tontines/:tontineId/demandes/:demandeId/accepter`, async ({ request }) => {
      envois.push({ url: new URL(request.url).pathname, corps: await request.json() })
      return ok({ ...DEMANDE, statut: 'ACCEPTEE' })
    }))
    const { user } = afficher()

    await screen.findByRole('heading', { name: 'Demandes d\'adhésion (1)' })
    await user.click(within(ligneMobile('Fatou Sow')).getByRole('button', { name: 'Accepter' }))

    expect(await screen.findByText('Fatou a rejoint Famille')).toBeInTheDocument()
    expect(envois).toEqual([{ url: '/api/v1/tontines/t1/demandes/d1/accepter', corps: {} }])
  })

  it.each([
    ['avec un motif', '  Tontine complète ', { motif: 'Tontine complète' }],
    ['sans motif (facultatif)', '', {}],
  ])('refuse une demande %s (PUT …/refuser)', async (_cas, saisie, attendu) => {
    demandes()
    file([])
    const corps: unknown[] = []
    server.use(http.put(`${API}/v1/tontines/t1/demandes/d1/refuser`, async ({ request }) => {
      corps.push(await request.json())
      return ok({ ...DEMANDE, statut: 'REFUSEE' })
    }))
    const { user } = afficher()

    await screen.findByRole('heading', { name: 'Demandes d\'adhésion (1)' })
    await user.click(within(ligneMobile('Fatou Sow')).getByRole('button', { name: 'Refuser' }))
    const fenetre = await screen.findByRole('dialog', { name: 'Refuser la demande de Fatou ?' })
    if (saisie) await user.type(within(fenetre).getByRole('textbox'), saisie)
    await user.click(within(fenetre).getByRole('button', { name: 'Refuser' }))

    expect(await screen.findByText('Demande de Fatou refusée')).toBeInTheDocument()
    expect(corps).toEqual([attendu])
  })

  it('acceptation en échec : message traduit', async () => {
    demandes()
    file([])
    server.use(http.put(`${API}/v1/tontines/t1/demandes/d1/accepter`, () => erreur(409, 'TONTINE_FULL', 'Complet')))
    const { user } = afficher()

    await screen.findByRole('heading', { name: 'Demandes d\'adhésion (1)' })
    await user.click(within(ligneMobile('Fatou Sow')).getByRole('button', { name: 'Accepter' }))

    expect(await screen.findByText('La tontine est complète.')).toBeInTheDocument()
  })

  it('hors connexion : Accepter et Refuser inactifs', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    demandes()
    file([])
    afficher()

    await screen.findByRole('heading', { name: 'Demandes d\'adhésion (1)' })
    expect(within(ligneMobile('Fatou Sow')).getByRole('button', { name: 'Accepter' })).toBeDisabled()
    expect(within(ligneMobile('Fatou Sow')).getByRole('button', { name: 'Refuser' })).toBeDisabled()
  })

  it('erreur réseau sur la liste des demandes : la file des paiements s\'affiche quand même', async () => {
    server.use(http.get(`${API}/v1/me/gestion/demandes`, () => HttpResponse.error()))
    file([AWA])
    afficher()

    expect(await screen.findByText('1 paiement · 5.000F')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Demandes d'adhésion/ })).not.toBeInTheDocument()
  })
})
