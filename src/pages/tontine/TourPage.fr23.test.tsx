/**
 * FR23 — Période d'une épargne journalière (événementielle) côté gestionnaire.
 *
 * Garde-fous de date (B45, B47), membres SORTI dans le récap (B48) et textes de clôture
 * d'une période intermédiaire. Ce ne sont pas des tests de caractérisation : ils décrivent
 * le comportement voulu par FR23 (la caractérisation de TourPage reste à faire, spec 01 lot F).
 *
 * Horloge : 22/11/2026 à 10h, heure de Dakar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { Toaster, toast } from 'sonner'
import { API, ok, page, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement, emplacement } from '@/test/router'
import { uneTontine } from '@/test/factories/tontine'
import { unCycle } from '@/test/factories/cycle'
import { AccountStatus, CotisationStatut, CycleStatut, MembreStatut } from '@/types/common'
import { TontineType } from '@/types/tontine'
import type { Cycle } from '@/types/cycle'
import type { CycleRecapLigne } from '@/types/cotisation'
import { TourPage } from './TourPage'

// ─── Données ─────────────────────────────────────────────────────────────────

function ligne(prenom: string, statutMembre: MembreStatut, montant: number | null, ordre: number): CycleRecapLigne {
  return {
    membreId: `m-${prenom}`, userId: `u-${prenom}`, firstName: prenom, lastName: 'Test', phone: '+221770000000',
    accountStatus: AccountStatus.PRE_ENROLLED, statutMembre, ordreJackpot: ordre,
    cotisationId: montant != null ? `cot-${prenom}` : null, montant, methodePaiement: montant != null ? 'CASH' : null,
    statutCotisation: montant != null ? CotisationStatut.VALIDE : null, dateValidation: null,
  }
}

/**
 * Épargne journalière gérée par l'utilisateur : la période `cycle` est ouverte,
 * `suivantes` = des périodes encore en attente (sinon c'est la dernière).
 */
function epargne(cycle: Partial<Cycle>, { suivantes = true, lignes = [] as CycleRecapLigne[] } = {}) {
  const courant = unCycle({ id: 'c2', tontineId: 't1', numeroCycle: 2, statut: CycleStatut.EN_COURS, ...cycle })
  const recaps: URL[] = []
  server.use(
    http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({
      id: 't1', nom: 'Épargne', tontineType: TontineType.EVENEMENTIELLE, montantLibre: true, montantMinimum: 2000,
      rythmeIntervalle: 1, rythmeUnite: 'JOUR', monRole: 'GESTIONNAIRE',
    }))),
    http.get(`${API}/v1/tontines/t1/cycles/c2`, () => ok(courant)),
    http.get(`${API}/v1/tontines/t1/cycles`, () => page([
      unCycle({ id: 'c1', numeroCycle: 1, statut: CycleStatut.TERMINE }),
      courant,
      ...(suivantes ? [unCycle({ id: 'c3', numeroCycle: 3, statut: CycleStatut.EN_ATTENTE })] : []),
    ])),
    http.get(`${API}/v1/tontines/t1/cotisations/recap/c2`, ({ request }) => {
      recaps.push(new URL(request.url))
      return page(lignes)
    }),
  )
  return { recaps }
}

function afficher() {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/tontine/:id/tours/:cycleId" element={<TourPage />} />
        <Route path="/tontine/:id/reglages" element={<p>Réglages</p>} />
        <Route path="/encaisser/:tontineId" element={<p>Encaisser</p>} />
      </Routes>
      <Emplacement />
      <Toaster />
    </>,
    { route: '/tontine/t1/tours/c2', auth: 'gestionnaire' },
  )
}

const boutonCloturer = () => screen.getByRole('button', { name: 'Clôturer la période' })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-22T10:00:00Z'))
})

afterEach(() => {
  toast.dismiss()
  vi.useRealTimers()
})

// ─── Garde-fous de date ──────────────────────────────────────────────────────

describe('FR23 TourPage — période pas encore commencée (B45, B47)', () => {
  it('ne propose pas « Encaisser » et désactive « Clôturer » avant le premier jour, avec la date', async () => {
    epargne({ dateDebut: '2026-11-23', dateFin: '2026-11-23' }, { lignes: [ligne('Awa', MembreStatut.ACTIF, null, 1)] })
    afficher()

    expect(await screen.findByText('Cette période commence le 23/11 : les paiements s\'enregistrent à partir de ce jour-là.')).toBeInTheDocument()
    expect(await screen.findByText('Awa Test')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Encaisser' })).not.toBeInTheDocument()
    expect(screen.getByText('Cette période commence le 23/11 : vous pourrez la clôturer à partir de ce jour-là.')).toBeInTheDocument()
    expect(boutonCloturer()).toBeDisabled()
  })

  it('le jour même, « Encaisser » et « Clôturer » sont disponibles', async () => {
    epargne({ dateDebut: '2026-11-22', dateFin: '2026-11-22' }, { lignes: [ligne('Awa', MembreStatut.ACTIF, null, 1)] })
    afficher()

    expect(await screen.findByRole('link', { name: 'Encaisser' })).toHaveAttribute('href', '/encaisser/t1?membre=m-Awa')
    expect(boutonCloturer()).toBeEnabled()
  })
})

describe('FR23 TourPage — dernière période (CLOTURE_FINALE_PREMATUREE)', () => {
  it('avant son dernier jour : clôture désactivée, « Clôturer la tontine » mène aux réglages', async () => {
    epargne({ dateDebut: '2026-11-22', dateFin: '2026-12-31' }, { suivantes: false })
    const { user } = afficher()

    expect(await screen.findByText(/C'est la dernière période : sa clôture partage l'épargne entre les membres, à partir du 31\/12/)).toBeInTheDocument()
    expect(boutonCloturer()).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Clôturer la tontine' }))
    expect(emplacement()).toBe('/tontine/t1/reglages')
  })

  it('refus du backend : explication et accès à « Clôturer la tontine »', async () => {
    // Le front ne voit pas que c'est la dernière période (liste des tours incomplète) : le backend tranche
    epargne({ dateDebut: '2026-11-22', dateFin: '2026-11-27' })
    server.use(http.put(`${API}/v1/tontines/t1/cycles/c2/cloturer`, () =>
      erreur(400, 'CLOTURE_FINALE_PREMATUREE', 'C\'est le dernier sous-cycle : …')))
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Clôturer la période' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Clôturer la période 2 ?' })).getByRole('button', { name: 'Clôturer' }))

    const dialogue = await screen.findByRole('dialog', { name: 'Pas encore la fin' })
    expect(dialogue).toHaveTextContent('à partir du 27/11. Pour arrêter plus tôt, clôturez la tontine.')
    await user.click(within(dialogue).getByRole('button', { name: 'Clôturer la tontine' }))
    expect(emplacement()).toBe('/tontine/t1/reglages')
  })

  it('refus TOUR_NON_COMMENCE : message avec la date de la période, pas le texte du serveur', async () => {
    // Horloge du téléphone en avance sur le serveur : le front croit la période commencée
    epargne({ dateDebut: '2026-11-22', dateFin: '2026-11-22' })
    server.use(http.put(`${API}/v1/tontines/t1/cycles/c2/cloturer`, () =>
      erreur(400, 'TOUR_NON_COMMENCE', 'Ce sous-cycle commence le 22/11/2026')))
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Clôturer la période' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clôturer' }))

    expect(await screen.findByText('Cette période commence le 22/11 : vous pourrez la clôturer à partir de ce jour-là.')).toBeInTheDocument()
  })
})

// ─── Clôture d'une période intermédiaire ─────────────────────────────────────

describe('FR23 TourPage — clôture du jour', () => {
  it('explique que l\'argent reste dans l\'épargne, sans « jackpot » ni « net à remettre »', async () => {
    epargne({ dateDebut: '2026-11-22', dateFin: '2026-11-22' })
    server.use(http.put(`${API}/v1/tontines/t1/cycles/c2/cloturer`, () =>
      ok(unCycle({ id: 'c2', numeroCycle: 2, statut: CycleStatut.TERMINE, montantNet: 86000 }))))
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Clôturer la période' }))
    const confirmation = await screen.findByRole('dialog', { name: 'Clôturer la période 2 ?' })
    expect(confirmation).toHaveTextContent('L’argent reste dans l’épargne jusqu’à la fin : rien n’est remis aux membres maintenant.')
    expect(confirmation).not.toHaveTextContent('jackpot')
    await user.click(within(confirmation).getByRole('button', { name: 'Clôturer' }))

    expect(await screen.findByText('Période clôturée · 86.000F gardés jusqu’à la fin')).toBeInTheDocument()
    expect(screen.queryByText(/Net à remettre/)).not.toBeInTheDocument()
  })
})

// ─── Membres sortis (B48) ────────────────────────────────────────────────────

describe('FR23 TourPage — membres sortis dans le récap (B48)', () => {
  it('demande inclureSortis, grise le membre sorti et garde son paiement dans le collecté', async () => {
    const { recaps } = epargne({ dateDebut: '2026-11-22', dateFin: '2026-11-22' }, {
      lignes: [
        ligne('Awa', MembreStatut.ACTIF, 44000, 1),
        ligne('Moussa', MembreStatut.ACTIF, 40000, 2),
        ligne('Coumba', MembreStatut.SORTI, 2000, 3),
      ],
    })
    afficher()

    expect(await screen.findByRole('heading', { name: 'Payé (3)' })).toBeInTheDocument()
    expect(recaps[0].searchParams.get('inclureSortis')).toBe('true')
    const coumba = screen.getByRole('link', { name: /Coumba Test/ })
    expect(within(coumba).getByText('Sorti')).toBeInTheDocument()
    // Collecté = distribution finale (86.000F) ; « ont payé » ne compte que les membres actifs
    expect(screen.getByText('86.000F')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '2/2 ont payé' })).toBeInTheDocument()
  })
})
