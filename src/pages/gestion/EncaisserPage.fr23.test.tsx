/**
 * FR23 — Encaisser dans une épargne journalière (montant libre, minimum 2.000F, membres sans smartphone).
 *
 * Report du cahier (44.000F + note), minimum affiché et vérifié, période pas encore ouverte (B47),
 * membre devenu inactif (B44). Vue mobile (matchMedia simulé à false).
 * Ce ne sont pas des tests de caractérisation (EncaisserPage : spec 01 lot F).
 *
 * Horloge : 22/11/2026 à 10h, heure de Dakar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, page, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement, emplacement } from '@/test/router'
import { uneTontine } from '@/test/factories/tontine'
import { unCycle } from '@/test/factories/cycle'
import { uneCotisation } from '@/test/factories/cotisation'
import { AccountStatus, CycleStatut, MembreStatut } from '@/types/common'
import { TontineType } from '@/types/tontine'
import type { CycleRecapLigne } from '@/types/cotisation'
import { EncaisserPage } from './EncaisserPage'

type Corps = Record<string, unknown>

const awa: CycleRecapLigne = {
  membreId: 'm-awa', userId: 'u-awa', firstName: 'Awa', lastName: 'Ndiaye', phone: '+221770009101',
  accountStatus: AccountStatus.PRE_ENROLLED, statutMembre: MembreStatut.ACTIF, ordreJackpot: 1,
  cotisationId: null, montant: null, methodePaiement: null, statutCotisation: null, dateValidation: null,
}

/** Épargne journalière, période c1 du `dateDebut` donné ; capture les encaissements */
function epargne(dateDebut = '2026-11-22', reponse: () => Response = () => ok(uneCotisation({ id: 'cot-new' }))) {
  const envois: Corps[] = []
  server.use(
    http.get(`${API}/v1/admin/my-dashboard`, () => ok({
      nombreTontinesGerees: 1, totalCollecteToursEnCours: 0, totalAttenduToursEnCours: null, totalCotisationsEnAttente: 0,
      tontines: {
        content: [{
          tontineId: 't1', nom: 'Épargne', tontineType: 'EVENEMENTIELLE', montant: 2000, montantLibre: true,
          cotisationsEnAttente: 0, cotisationsEnRetard: 0, demandesEnAttente: 0, prioritesEnAttente: 0, montantTotalValide: 0,
          gagnantsADesigner: false,
          cycleEnCours: {
            cycleId: 'c1', numeroCycle: 1, dateFin: dateDebut, nombreEcheances: 1, numeroEcheanceCourante: 1, tousPayes: false,
            montantCollecte: 0, montantEnAttente: 0, montantAttendu: null, membresAyantPaye: 0, membresEnAttente: 0, membresActifs: 1,
          },
        }],
        page: { number: 0, size: 100, totalElements: 1, totalPages: 1 },
      },
    })),
    http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({
      id: 't1', nom: 'Épargne', tontineType: TontineType.EVENEMENTIELLE, montant: 2000, montantLibre: true, montantMinimum: 2000,
      monRole: 'GESTIONNAIRE',
    }))),
    http.get(`${API}/v1/tontines/t1/cycles/c1`, () => ok(unCycle({ id: 'c1', statut: CycleStatut.EN_COURS, dateDebut, dateFin: dateDebut }))),
    http.get(`${API}/v1/tontines/t1/cotisations/recap/c1`, () => page([awa])),
    http.post(`${API}/v1/tontines/t1/cotisations/admin`, async ({ request }) => {
      envois.push((await request.json()) as Corps)
      return reponse()
    }),
  )
  return { envois }
}

function afficher(route = '/encaisser/t1?membre=m-awa') {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/encaisser/:tontineId" element={<EncaisserPage />} />
        <Route path="/recu/:tontineId/:cotisationId" element={<p>Reçu</p>} />
        <Route path="/tontine/:id/membres/:membreId" element={<p>Fiche membre</p>} />
        <Route path="/tontine/:id/tours" element={<p>Périodes</p>} />
      </Routes>
      <Emplacement />
    </>,
    { route, auth: 'gestionnaire' },
  )
}

type User = ReturnType<typeof afficher>['user']

async function taper(user: User, touches: string[]) {
  const pave = await screen.findByLabelText('Pavé numérique')
  for (const t of touches) await user.click(within(pave).getByRole('button', { name: t }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-22T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('FR23 EncaisserPage — report du cahier', () => {
  it('accepte plus que le minimum et envoie la note : 44.000F en espèces', async () => {
    const { envois } = epargne()
    const { user } = afficher()

    expect(await screen.findByText('Montant libre · minimum 2.000F')).toBeInTheDocument()
    await taper(user, ['4', '4', '000'])
    await user.click(screen.getByRole('button', { name: 'Référence et note' }))
    await user.type(screen.getByRole('textbox', { name: 'Note (facultatif)' }), 'Report du cahier du 01/11 au 21/11')
    await user.click(screen.getByRole('button', { name: 'Encaisser 44.000F' }))

    await screen.findByText('Reçu')
    expect(emplacement()).toBe('/recu/t1/cot-new')
    expect(envois).toEqual([{
      membreId: 'm-awa', cycleId: 'c1', montant: 44000, methodePaiement: 'CASH', note: 'Report du cahier du 01/11 au 21/11',
    }])
  })

  it('sous le minimum : prévient avant d\'envoyer', async () => {
    const { envois } = epargne()
    const { user } = afficher()

    await taper(user, ['1', '000'])
    await user.click(screen.getByRole('button', { name: 'Encaisser 1.000F' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Montant minimum : 2.000F.')
    expect(envois).toHaveLength(0)
  })
})

describe('FR23 EncaisserPage — période pas encore ouverte (B47)', () => {
  it('le jour J+1 avant son début : pas de liste à encaisser, la date est donnée', async () => {
    epargne('2026-11-23')
    afficher('/encaisser/t1')

    expect(await screen.findByText('Période pas encore ouverte')).toBeInTheDocument()
    expect(screen.getByText('Cette période commence le 23/11 : les paiements s\'enregistrent à partir de ce jour-là.')).toBeInTheDocument()
    expect(screen.queryByText('Awa Ndiaye')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir les périodes' })).toHaveAttribute('href', '/tontine/t1/tours')
  })

  it('refus ECHEANCE_NON_OUVERTE du backend : message avec la date (code lu, pas le texte)', async () => {
    epargne('2026-11-22', () => erreur(400, 'ECHEANCE_NON_OUVERTE', 'Cette période commence le 22/11/2026 : elle ne peut pas encore être payée'))
    const { user } = afficher()

    await taper(user, ['2', '000'])
    await user.click(screen.getByRole('button', { name: 'Encaisser 2.000F' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Cette période commence le 22/11 : les paiements s\'enregistrent à partir de ce jour-là.')
  })
})

describe('FR23 EncaisserPage — membre devenu inactif (B44)', () => {
  it('MEMBRE_INACTIF : explique et propose « Réactiver le membre »', async () => {
    epargne('2026-11-22', () => erreur(400, 'MEMBRE_INACTIF', 'La participation de ce membre est terminée'))
    const { user } = afficher()

    await taper(user, ['2', '000'])
    await user.click(screen.getByRole('button', { name: 'Encaisser 2.000F' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La participation de ce membre est suspendue ou terminée : réactivez-le pour enregistrer un paiement.')
    await user.click(screen.getByRole('link', { name: 'Réactiver le membre' }))
    expect(emplacement()).toBe('/tontine/t1/membres/m-awa')
  })
})
