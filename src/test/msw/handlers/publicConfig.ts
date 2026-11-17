import { http } from 'msw'
import { API, ok } from '../api'

export const publicConfigHandlers = [
  http.get(`${API}/v1/public/config`, () =>
    ok({ supportWhatsapp: '+221779671285', supportEmail: 'support@dinthialma.com', versionMinimaleApp: null, versionRecommandeeApp: null }),
  ),
]
