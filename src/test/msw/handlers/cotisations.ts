import { http } from 'msw'
import { API, ok, page } from '../api'
import { uneCotisation } from '../../factories/cotisation'
import { CotisationStatut } from '@/types/common'

export const cotisationsHandlers = [
  http.get(`${API}/v1/tontines/:tontineId/cotisations`, () =>
    page([uneCotisation({ id: 'cot1' })]),
  ),
  http.get(`${API}/v1/tontines/:tontineId/cotisations/:cotisationId`, ({ params }) =>
    ok(uneCotisation({ id: String(params.cotisationId) })),
  ),
  http.post(`${API}/v1/tontines/:tontineId/cotisations`, () =>
    ok(uneCotisation({ id: 'cot-new', statut: CotisationStatut.EN_ATTENTE })),
  ),
  http.post(`${API}/v1/tontines/:tontineId/cotisations/admin`, () =>
    ok(uneCotisation({ id: 'cot-admin', statut: CotisationStatut.VALIDE })),
  ),
  http.put(`${API}/v1/tontines/:tontineId/cotisations/:cotisationId/valider`, ({ params }) =>
    ok(uneCotisation({ id: String(params.cotisationId), statut: CotisationStatut.VALIDE })),
  ),
  http.put(`${API}/v1/tontines/:tontineId/cotisations/:cotisationId/refuser`, ({ params }) =>
    ok(uneCotisation({ id: String(params.cotisationId), statut: CotisationStatut.REFUSE })),
  ),
  http.patch(`${API}/v1/tontines/:tontineId/cotisations/:cotisationId`, ({ params }) =>
    ok(uneCotisation({ id: String(params.cotisationId) })),
  ),
  http.get(`${API}/v1/tontines/:tontineId/cotisations/recap/:cycleId`, () => page([])),
  http.get(`${API}/v1/tontines/:tontineId/cotisations/recap-total`, () => page([])),
]
