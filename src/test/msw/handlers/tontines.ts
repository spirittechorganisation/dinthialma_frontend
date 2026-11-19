import { http } from 'msw'
import { API, ok, page } from '../api'
import { uneTontine } from '../../factories/tontine'
import { uneCommission } from '../../factories/commission'
import { TontineStatut } from '@/types/common'

const T1 = uneTontine({ id: 't1', nom: 'Famille' })
const T2 = uneTontine({ id: 't2', nom: 'Amis', statut: TontineStatut.BROUILLON })

export const tontinesHandlers = [
  http.get(`${API}/v1/tontines`, () => page([T1, T2])),
  http.post(`${API}/v1/tontines`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return ok(uneTontine({ id: 't-new', nom: String(body.nom ?? 'Nouvelle') }))
  }),
  // Avant `/v1/tontines/:id` : MSW prend la première route qui correspond, et « simulation »
  // serait sinon lu comme un identifiant de tontine.
  http.get(`${API}/v1/tontines/simulation`, () =>
    ok({ nombreTours: 12, cotisationsParTour: 1, echeances: [], tours: [] }),
  ),
  http.get(`${API}/v1/tontines/:id`, ({ params }) =>
    ok(uneTontine({ id: String(params.id), nom: 'Famille' })),
  ),
  http.put(`${API}/v1/tontines/:id`, ({ params }) =>
    ok(uneTontine({ id: String(params.id) })),
  ),
  http.delete(`${API}/v1/tontines/:id`, () => ok(null, 'Supprimée')),
  http.put(`${API}/v1/tontines/:id/activer`, ({ params }) =>
    ok(uneTontine({ id: String(params.id), statut: TontineStatut.ACTIVE })),
  ),
  http.put(`${API}/v1/tontines/:id/suspendre`, ({ params }) =>
    ok(uneTontine({ id: String(params.id), statut: TontineStatut.SUSPENDUE })),
  ),
  http.put(`${API}/v1/tontines/:id/cloturer`, ({ params }) =>
    ok(uneTontine({ id: String(params.id), statut: TontineStatut.TERMINEE })),
  ),
  http.patch(`${API}/v1/tontines/:id/echeance`, ({ params }) =>
    ok(uneTontine({ id: String(params.id) })),
  ),
  http.patch(`${API}/v1/tontines/:id/reglages`, ({ params }) =>
    ok(uneTontine({ id: String(params.id) })),
  ),
  // Commissions
  http.get(`${API}/v1/tontines/:tontineId/commissions`, () => page([uneCommission()])),
  http.post(`${API}/v1/tontines/:tontineId/commissions`, () => ok(uneCommission())),
  http.put(`${API}/v1/tontines/:tontineId/commissions/:id`, () => ok(uneCommission())),
  http.delete(`${API}/v1/tontines/:tontineId/commissions/:id`, () => ok(null, 'Supprimée')),
]
