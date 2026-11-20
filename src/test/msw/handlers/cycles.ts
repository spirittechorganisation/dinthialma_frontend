import { http } from 'msw'
import { API, ok, page } from '../api'
import { unCycle } from '../../factories/cycle'
import { CycleStatut } from '@/types/common'

// Les routes précises (`beneficiaires`, `proposition`) sont déclarées AVANT `/cycles/:cycleId` :
// MSW prend la première route qui correspond, et les lirait sinon comme un identifiant de tour.
export const cyclesHandlers = [
  http.get(`${API}/v1/tontines/:tontineId/cycles`, () =>
    page([unCycle({ id: 'c1', numeroCycle: 1, statut: CycleStatut.EN_COURS })]),
  ),
  http.get(`${API}/v1/tontines/:tontineId/cycles/beneficiaires`, () => page([])),
  http.get(`${API}/v1/tontines/:tontineId/cycles/proposition`, () =>
    ok({ dateDebut: '2026-11-20', dateFin: '2026-12-19', echeances: [] }),
  ),
  http.get(`${API}/v1/tontines/:tontineId/cycles/:cycleId`, ({ params }) =>
    ok(unCycle({ id: String(params.cycleId) })),
  ),
  http.post(`${API}/v1/tontines/:tontineId/cycles`, () => ok(unCycle({ statut: CycleStatut.EN_COURS }))),
  http.put(`${API}/v1/tontines/:tontineId/cycles/:cycleId/cloturer`, ({ params }) =>
    ok(unCycle({ id: String(params.cycleId), statut: CycleStatut.TERMINE })),
  ),
  http.patch(`${API}/v1/tontines/:tontineId/cycles/:cycleId/beneficiaire`, ({ params }) =>
    ok(unCycle({ id: String(params.cycleId) })),
  ),
  // URL appelée par cycleService.getRemiseApercu (l'ancien handler visait …/remise-apercu, jamais appelé)
  http.get(`${API}/v1/tontines/:tontineId/cycles/:cycleId/remise/apercu`, ({ params }) =>
    ok({
      cycleId: String(params.cycleId), numeroCycle: 1, jackpotPrevu: 50000, collecte: 50000, manquant: 0,
      modeRemiseParDefaut: 'DISPONIBLE', retardataires: [],
      options: [{ modeRemise: 'DISPONIBLE', possible: true, montantNet: 47500, montantBeneficiaire: 47500, commission: 2500 }],
    }),
  ),
]
