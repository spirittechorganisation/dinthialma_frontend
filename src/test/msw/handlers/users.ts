import { http } from 'msw'
import { API, ok } from '../api'

export const usersHandlers = [
  http.get(`${API}/v1/profile`, () =>
    ok({ id: 'u1', firstName: 'Test', lastName: 'User', phone: '+221700000001', email: 'test@test.com', active: true, pinConfigured: true, roles: ['MEMBER'], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }),
  ),
  http.put(`${API}/v1/profile`, () =>
    ok({ id: 'u1', firstName: 'Test', lastName: 'Modifié', phone: '+221700000001', email: 'test@test.com', active: true, pinConfigured: true, roles: ['MEMBER'], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-11-16T00:00:00Z' }),
  ),
  http.get(`${API}/v1/users/search`, ({ request }) => {
    const url = new URL(request.url)
    const phone = url.searchParams.get('phone')
    if (!phone) return ok(null)
    return ok({ id: 'u2', firstName: 'Trouvé', lastName: 'User', phone, accountStatus: 'ACTIVE' })
  }),
  http.post(`${API}/v1/profile/phone/request-change`, () => ok(null, 'OTP envoyé')),
  http.post(`${API}/v1/profile/phone/verify`, () => ok(null, 'Numéro changé')),
  http.get(`${API}/v1/me/sessions`, () => ok([])),
  http.delete(`${API}/v1/me/sessions/:id`, () => ok(null, 'Session supprimée')),
]
