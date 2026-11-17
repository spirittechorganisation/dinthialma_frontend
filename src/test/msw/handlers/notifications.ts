import { http } from 'msw'
import { API, ok, page } from '../api'

export const notificationsHandlers = [
  http.get(`${API}/v1/notifications`, () => page([])),
  http.get(`${API}/v1/notifications/unread-count`, () => ok({ count: 0 })),
  http.patch(`${API}/v1/notifications/:id/read`, ({ params }) =>
    ok({ id: String(params.id), read: true }),
  ),
  http.patch(`${API}/v1/notifications/read-all`, () => ok(null, 'Tout marqué lu')),
]
