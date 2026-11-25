/**
 * FR31 — Codes SMS (SE07) : OTP_RATE_LIMITED → « Renvoyer le code » inactif avec compte à rebours ;
 * OTP_TOO_MANY_ATTEMPTS → « Demandez un nouveau code ». Anti-énumération conservée pour le reste.
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { ForgotPasswordPage } from './ForgotPasswordPage'

function afficher() {
  return renderWithProviders(
    <Routes><Route path="/forgot-password" element={<ForgotPasswordPage />} /></Routes>,
    { route: '/forgot-password', auth: null },
  )
}

async function demanderCode(user: ReturnType<typeof afficher>['user']) {
  const champ = await screen.findByRole('textbox')
  await user.clear(champ)
  await user.type(champ, '+221770000001')
  await user.click(screen.getByRole('button', { name: /code/i }))
}

describe('FR31 ForgotPasswordPage — codes SMS', () => {
  it('OTP_RATE_LIMITED : message avec le délai, « Renvoyer le code » inactif avec compte à rebours', async () => {
    server.use(http.post(`${API}/v1/auth/forgot-password/send-otp`, () => erreur(429, 'OTP_RATE_LIMITED', 'Trop de demandes', { retryAfterSeconds: 1800 })))
    const { user } = afficher()

    await demanderCode(user)

    expect(await screen.findByText('Trop de codes demandés pour ce numéro. Vous pourrez en redemander un dans 30:00.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Renvoyer le code dans (30:00|29:59)/ })).toBeDisabled()
  })

  it('autre erreur d’envoi : rien n’est dit (anti-énumération), « Renvoyer le code » actif', async () => {
    server.use(http.post(`${API}/v1/auth/forgot-password/send-otp`, () => erreur(404, 'NOT_FOUND', 'Inconnu')))
    const { user } = afficher()

    await demanderCode(user)

    expect(await screen.findByRole('button', { name: 'Renvoyer le code' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('OTP_TOO_MANY_ATTEMPTS : « Demandez un nouveau code »', async () => {
    server.use(
      http.post(`${API}/v1/auth/forgot-password/send-otp`, () => ok(null)),
      http.post(`${API}/v1/auth/forgot-password/verify-otp`, () => erreur(400, 'OTP_TOO_MANY_ATTEMPTS', 'Trop d’essais')),
    )
    const { user } = afficher()

    await demanderCode(user)
    await user.type(await screen.findByPlaceholderText('123456'), '000000')
    await user.click(screen.getByRole('button', { name: 'Vérifier le code' }))

    expect(await screen.findByText('Trop d’essais avec ce code. Demandez un nouveau code.')).toBeInTheDocument()
  })
})
