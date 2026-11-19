import { http, HttpResponse } from 'msw'
import { API, ok, erreur } from '../api'
import { creerJwt } from '../../auth'
import { UserRole } from '@/types/common'

export const authHandlers = [
  http.post(`${API}/v1/auth/login`, () =>
    HttpResponse.json({
      status: 'success', statusCode: 200, message: 'Connecté',
      data: {
        access_token: creerJwt([UserRole.MEMBER]),
        refresh_token: 'refresh-token-test',
        expires_in: 3600,
        pin_configured: true,
      },
    }),
  ),
  http.post(`${API}/v1/auth/login-pin`, () =>
    HttpResponse.json({
      status: 'success', statusCode: 200, message: 'Connecté',
      data: {
        access_token: creerJwt([UserRole.MEMBER]),
        refresh_token: 'refresh-token-test',
        expires_in: 3600,
        pin_configured: true,
      },
    }),
  ),
  http.post(`${API}/v1/auth/refresh`, () =>
    HttpResponse.json({
      status: 'success', statusCode: 200, message: 'Rafraîchi',
      data: {
        access_token: creerJwt([UserRole.MEMBER]),
        refresh_token: 'refresh-token-new',
        expires_in: 3600,
      },
    }),
  ),
  http.post(`${API}/v1/auth/logout`, () => ok(null, 'Déconnecté')),
  http.post(`${API}/v1/auth/pin/setup`, () => ok(null, 'PIN créé')),
  http.post(`${API}/v1/auth/pin/reset`, () => ok(null, 'PIN réinitialisé')),
  http.post(`${API}/v1/auth/pin/reset/send-otp`, () => ok(null, 'OTP envoyé')),
  http.post(`${API}/v1/auth/pin/reset/verify-otp`, () => ok({ verified: true })),
  http.post(`${API}/v1/auth/register/send-otp`, () => ok(null, 'OTP envoyé')),
  http.post(`${API}/v1/auth/register/verify-otp`, () => ok({ verified: true })),
  http.post(`${API}/v1/auth/register/complete`, () =>
    ok({ keycloakId: 'kc-1', phone: '+221700000001', firstName: 'Test', lastName: 'User', role: 'MEMBER' }),
  ),
  http.post(`${API}/v1/auth/forgot-password/send-otp`, () => ok(null, 'OTP envoyé')),
  http.post(`${API}/v1/auth/forgot-password/verify-otp`, () => ok({ verified: true })),
  http.post(`${API}/v1/auth/forgot-password/reset`, () => ok(null, 'Mot de passe réinitialisé')),

  // 403 compte pré-inscrit (simulé par un handler de remplacement dans les tests concernés)
  http.post(`${API}/v1/auth/login-pre-enrolled`, () =>
    erreur(403, 'ACCOUNT_PRE_ENROLLED', 'Compte non activé'),
  ),
]
