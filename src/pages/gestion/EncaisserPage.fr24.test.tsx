/**
 * FR24 — Saisie en série dans Encaisser (vue mobile) : ~20 paiements en espèces par jour.
 *
 * Après un encaissement : on reste sur « De qui ? » de la même période, toast « Reçu enregistré · Voir ».
 * Non payés en haut, payés en bas grisés avec leur montant, compteur « 1 / 2 payés aujourd’hui ».
 * Montant prérempli (minimum en montant libre, montant fixe sinon), première touche qui le remplace.
 * Moyen : le dernier utilisé, Espèces par défaut.
 *
 * Horloge : 22/11/2026 à 10h, heure de Dakar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { Toaster, toast } from 'sonner'
import { API, ok, page } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement, emplacement } from '@/test/router'
import { uneTontine } from '@/test/factories/tontine'
import { unCycle } from '@/test/factories/cycle'
import { uneCotisation } from '@/test/factories/cotisation'
import { AccountStatus, CotisationStatut, CycleStatut, MembreStatut } from '@/types/common'
import { TontineType } from '@/types/tontine'
import type { CycleRecapLigne } from '@/types/cotisation'
import { METHODE_ENCAISSEMENT_KEY } from '@/lib/encaissement'
import { EncaisserPage } from './EncaisserPage'

type Corps = Record<string, unknown>

const membre = (id: string, prenom: string, paye?: number): CycleRecapLigne => ({
  membreId: id, userId: `u-${id}`, firstName: prenom, lastName: 'Ndiaye', phone: '+221770009100',
  accountStatus: AccountStatus.PRE_ENROLLED, statutMembre: MembreStatut.ACTIF, ordreJackpot: null,
  cotisationId: paye ? `cot-${id}` : null, montant: paye ?? null, methodePaiement: paye ? 'CASH' : null,
  statutCotisation: paye ? CotisationStatut.VALIDE : null, dateValidation: null,
})

/** Épargne journalière (montant libre, minimum 2.000F) ou rotative à 5.000F ; Binta a déjà payé */
function tontine(type: 'epargne' | 'rotative' = 'epargne') {
  const epargne = type === 'epargne'
  const envois: Corps[] = []
  server.use(
    http.get(`${API}/v1/admin/my-dashboard`, () => ok({
      nombreTontinesGerees: 1, totalCollecteToursEnCours: 0, totalAttenduToursEnCours: null, totalCotisationsEnAttente: 0,
      tontines: {
        content: [{
          tontineId: 't1', nom: 'Épargne', tontineType: epargne ? 'EVENEMENTIELLE' : 'ROTATIVE', montant: epargne ? 2000 : 5000, montantLibre: epargne,
          cotisationsEnAttente: 0, cotisationsEnRetard: 0, demandesEnAttente: 0, prioritesEnAttente: 0, montantTotalValide: 0,
          gagnantsADesigner: false,
          cycleEnCours: {
            cycleId: 'c1', numeroCycle: 1, dateFin: '2026-11-22', nombreEcheances: 1, numeroEcheanceCourante: 1, tousPayes: false,
            montantCollecte: 5000, montantEnAttente: 0, montantAttendu: null, membresAyantPaye: 1, membresEnAttente: 0, membresActifs: 2,
          },
        }],
        page: { number: 0, size: 100, totalElements: 1, totalPages: 1 },
      },
    })),
    http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({
      id: 't1', nom: 'Épargne', monRole: 'GESTIONNAIRE', rythmeIntervalle: 1, rythmeUnite: 'JOUR',
      ...(epargne
        ? { tontineType: TontineType.EVENEMENTIELLE, montant: 2000, montantLibre: true, montantMinimum: 2000 }
        : { tontineType: TontineType.ROTATIVE, montant: 5000, montantLibre: false, montantMinimum: null }),
    }))),
    http.get(`${API}/v1/tontines/t1/cycles/c1`, () => ok(unCycle({ id: 'c1', statut: CycleStatut.EN_COURS, dateDebut: '2026-11-22', dateFin: '2026-11-22' }))),
    // Récapitulatif figé : seuls les encaissements de la séance font passer Awa en « payé »
    http.get(`${API}/v1/tontines/t1/cotisations/recap/c1`, () => page([membre('m-binta', 'Binta', 5000), membre('m-awa', 'Awa')])),
    http.post(`${API}/v1/tontines/t1/cotisations/admin`, async ({ request }) => {
      const corps = (await request.json()) as Corps
      envois.push(corps)
      return ok(uneCotisation({ id: 'cot-new', montant: corps.montant as number }))
    }),
  )
  return { envois }
}

function afficher(route = '/encaisser/t1') {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/encaisser/:tontineId" element={<EncaisserPage />} />
        <Route path="/recu/:tontineId/:cotisationId" element={<p>Reçu</p>} />
      </Routes>
      <Emplacement />
      <Toaster />
    </>,
    { route, auth: 'gestionnaire' },
  )
}

type User = ReturnType<typeof afficher>['user']

async function taper(user: User, touches: string[]) {
  const pave = await screen.findByLabelText('Pavé numérique')
  for (const t of touches) await user.click(within(pave).getByRole('button', { name: t }))
}

const section = (titre: RegExp) => screen.getByRole('heading', { name: titre }).closest('section') as HTMLElement

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-22T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  toast.dismiss()
  localStorage.removeItem(METHODE_ENCAISSEMENT_KEY)
})

describe('FR24 EncaisserPage — liste « De qui ? »', () => {
  it('non payés en haut, payés en bas grisés avec leur montant, compteur du jour', async () => {
    tontine()
    afficher()

    expect(await screen.findByText('1 / 2 payé aujourd’hui')).toBeInTheDocument()
    expect(within(section(/Pas encore payé/)).getByText('Awa Ndiaye')).toBeInTheDocument()
    const binta = within(section(/Déjà payé/)).getByText('Binta Ndiaye').closest('a') as HTMLElement
    expect(binta).toHaveTextContent('5.000F')
    expect(binta).toHaveClass('opacity-60')
  })
})

describe('FR24 EncaisserPage — saisie en série', () => {
  it('2 gestes au minimum : membre puis « Encaisser 2.000F », retour à la liste avec le toast', async () => {
    const { envois } = tontine()
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: /Awa Ndiaye/ }))
    await user.click(await screen.findByRole('button', { name: 'Encaisser 2.000F' }))

    expect(await screen.findByText('Reçu enregistré')).toBeInTheDocument()
    expect(screen.getByText('Awa Ndiaye · 2.000F')).toBeInTheDocument()
    expect(emplacement()).toBe('/encaisser/t1')
    // Awa passe dans « Déjà payé » sans attendre le récapitulatif relu
    expect(await screen.findByText('2 / 2 payés aujourd’hui')).toBeInTheDocument()
    expect(within(section(/Déjà payé/)).getByText('Awa Ndiaye').closest('a')).toHaveAttribute('href', '/recu/t1/cot-new')
    expect(envois).toEqual([{ membreId: 'm-awa', cycleId: 'c1', montant: 2000, methodePaiement: 'CASH' }])
  })

  it('« Voir » du toast ouvre le reçu', async () => {
    tontine()
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: /Awa Ndiaye/ }))
    await user.click(await screen.findByRole('button', { name: 'Encaisser 2.000F' }))
    await user.click(await screen.findByRole('button', { name: 'Voir' }))

    expect(await screen.findByText('Reçu')).toBeInTheDocument()
    expect(emplacement()).toBe('/recu/t1/cot-new')
  })

  it('montant libre : la première touche remplace le minimum prérempli (5 puis 000 → 5.000F)', async () => {
    const { envois } = tontine()
    const { user } = afficher('/encaisser/t1?membre=m-awa')

    expect(await screen.findByRole('button', { name: 'Encaisser 2.000F' })).toBeInTheDocument()
    await taper(user, ['5', '000'])
    await user.click(screen.getByRole('button', { name: 'Encaisser 5.000F' }))

    await screen.findByText('Reçu enregistré')
    expect(envois[0].montant).toBe(5000)
  })

  it('montant fixe : prérempli, « Modifier le montant » puis la première touche le remplace', async () => {
    const { envois } = tontine('rotative')
    const { user } = afficher('/encaisser/t1?membre=m-awa')

    expect(await screen.findByRole('button', { name: 'Encaisser 5.000F' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Pavé numérique')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Modifier le montant/ }))
    await taper(user, ['6', '000'])
    await user.click(screen.getByRole('button', { name: 'Encaisser 6.000F' }))

    await screen.findByText('Reçu enregistré')
    expect(envois[0].montant).toBe(6000)
  })

  it('moyen : le dernier mémorisé s\'il est ouvert, sinon Espèces', async () => {
    localStorage.setItem(METHODE_ENCAISSEMENT_KEY, 'WAVE')
    const { envois } = tontine()
    const { user } = afficher('/encaisser/t1?membre=m-awa')

    await user.click(await screen.findByRole('button', { name: 'Encaisser 2.000F' }))

    await screen.findByText('Reçu enregistré')
    expect(envois[0].methodePaiement).toBe('CASH')
  })
})
