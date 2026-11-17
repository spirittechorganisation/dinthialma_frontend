import { http } from 'msw'
import { API, ok, page } from '../api'
import { unePriorite } from '../../factories/priorite'

export const prioritesHandlers = [
  http.get(`${API}/v1/tontines/:tontineId/priorites`, () => page([])),
  http.post(`${API}/v1/tontines/:tontineId/priorites`, () =>
    ok(unePriorite({ statut: 'EN_ATTENTE' })),
  ),
  http.post(`${API}/v1/tontines/:tontineId/priorites/attribuer`, () =>
    ok(unePriorite({ statut: 'ACCEPTEE', origine: 'GESTIONNAIRE' })),
  ),
  http.put(`${API}/v1/tontines/:tontineId/priorites/:prioriteId/accepter`, ({ params }) =>
    ok(unePriorite({ id: String(params.prioriteId), statut: 'ACCEPTEE' })),
  ),
  http.put(`${API}/v1/tontines/:tontineId/priorites/:prioriteId/refuser`, ({ params }) =>
    ok(unePriorite({ id: String(params.prioriteId), statut: 'REFUSEE' })),
  ),
  http.delete(`${API}/v1/tontines/:tontineId/priorites/:prioriteId`, () => ok(null, 'Annulée')),
]
