import { http } from 'msw'
import { API, ok, page } from '../api'
import { unMembre } from '../../factories/membre'

export const membresHandlers = [
  http.get(`${API}/v1/tontines/:tontineId/membres`, () =>
    page([unMembre({ id: 'm1' }), unMembre({ id: 'm2' })]),
  ),
  http.post(`${API}/v1/tontines/:tontineId/membres`, () => ok(unMembre({ id: 'm-new' }))),
  http.patch(`${API}/v1/tontines/:tontineId/membres/:membreId/statut`, ({ params }) =>
    ok(unMembre({ id: String(params.membreId) })),
  ),
  http.delete(`${API}/v1/tontines/:tontineId/membres/:membreId`, () => ok(null, 'Retiré')),
]
