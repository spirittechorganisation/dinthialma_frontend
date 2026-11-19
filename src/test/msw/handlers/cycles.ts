import { http } from 'msw'
import { API, ok, page } from '../api'
import { unCycle } from '../../factories/cycle'
import { CycleStatut } from '@/types/common'

export const cyclesHandlers = [
  http.get(`${API}/v1/tontines/:tontineId/cycles`, () =>
    page([unCycle({ id: 'c1', numeroCycle: 1, statut: CycleStatut.EN_COURS })]),
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
  http.get(`${API}/v1/tontines/:tontineId/cycles/beneficiaires`, () => page([])),
  http.get(`${API}/v1/tontines/:tontineId/cycles/:cycleId/remise-apercu`, ({ params }) =>
    ok({ cycleId: String(params.cycleId), montantBrut: 50000, montantCommission: 2500, montantNet: 47500, complet: true }),
  ),
]
