import { http } from 'msw'
import { API, ok, page } from '../api'
import { uneCotisationAValider } from '../../factories/cotisation'

export const validationHandlers = [
  http.get(`${API}/v1/me/gestion/cotisations`, () =>
    page([uneCotisationAValider({ id: 'av1', tontineNom: 'Famille' })]),
  ),
  http.post(`${API}/v1/me/gestion/cotisations/valider`, async ({ request }) => {
    const body = await request.json() as { cotisationIds: string[] }
    return ok({
      total: body.cotisationIds.length,
      validees: body.cotisationIds.length,
      echecs: 0,
      resultats: body.cotisationIds.map((id) => ({ cotisationId: id, succes: true, statut: 'VALIDE', code: null, message: null })),
    })
  }),
]
