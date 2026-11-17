import { http } from 'msw'
import { API, ok, page } from '../api'

export const dashboardHandlers = [
  http.get(`${API}/v1/admin/my-dashboard`, () =>
    ok({
      nombreTontinesGerees: 1,
      totalCollecteToursEnCours: 40000,
      totalAttenduToursEnCours: 60000,
      totalCotisationsEnAttente: 2,
      totalCotisationsEnRetard: 1,
      totalDemandesEnAttente: 0,
      tontines: {
        content: [{
          tontineId: 't1', nom: 'Famille', tontineType: 'ROTATIVE', montant: 5000, montantLibre: false,
          cotisationsEnAttente: 2, cotisationsEnRetard: 1, demandesEnAttente: 0, prioritesEnAttente: 0,
          montantTotalValide: 40000, gagnantsADesigner: false,
          cycleEnCours: { cycleId: 'c1', numeroCycle: 6, dateFin: '2026-11-30', nombreEcheances: 1, numeroEcheanceCourante: 1, tousPayes: false, montantCollecte: 40000, montantEnAttente: 10000, montantAttendu: 60000, membresAyantPaye: 8, membresEnAttente: 2, membresActifs: 12 },
        }],
        page: { number: 0, size: 100, totalElements: 1, totalPages: 1 },
      },
    }),
  ),
  http.get(`${API}/v1/admin/dashboard`, () =>
    ok({ totalTontines: 5, totalUsers: 42, cotisationsEnAttente: 3, cotisationsEnRetard: 1 }),
  ),
  http.get(`${API}/v1/admin/dashboard/tontines`, () => page([])),
  http.get(`${API}/v1/admin/dashboard/users`, () => page([])),
  http.get(`${API}/v1/admin/dashboard/contributions`, () => page([])),
  http.post(`${API}/v1/admin/dashboard/users/:id/enable`, ({ params }) =>
    ok({ id: String(params.id), active: true }),
  ),
  http.post(`${API}/v1/admin/dashboard/users/:id/disable`, ({ params }) =>
    ok({ id: String(params.id), active: false }),
  ),
  http.put(`${API}/v1/admin/dashboard/users/:id/roles`, ({ params }) =>
    ok({ id: String(params.id), roles: ['MEMBER'] }),
  ),
]
