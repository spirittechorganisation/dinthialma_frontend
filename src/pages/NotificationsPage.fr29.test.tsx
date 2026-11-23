/**
 * FR29 — Notification RETRAIT_REMIS : « Retrait de X F enregistré », lien vers la fiche (membre : sa fiche
 * de l'épargne, avec son solde ; gestionnaire : la fiche du membre).
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, page } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement, emplacement } from '@/test/router'
import { uneTontine } from '@/test/factories/tontine'
import { NotificationType, type NotificationItem } from '@/types/notification'
import { NotificationsPage } from './NotificationsPage'

const notif: NotificationItem = {
  id: 'n1', type: NotificationType.RETRAIT_REMIS, title: 'Retrait remis', read: false,
  body: 'Retrait de 10000 FCFA remis sur votre épargne Tabaski. Solde restant : 34000 FCFA.',
  tontineId: 't1', membreId: 'm-awa', createdAt: '2026-11-22T10:00:00Z',
}

function afficher(monRole: 'MEMBRE' | 'GESTIONNAIRE') {
  server.use(
    http.get(`${API}/v1/notifications`, () => page([notif])),
    http.get(`${API}/v1/tontines`, () => page([uneTontine({ id: 't1', nom: 'Tabaski', monRole })])),
    http.patch(`${API}/v1/notifications/n1/read`, () => ok(null)),
  )
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/tontine/:id" element={<p>Fiche</p>} />
        <Route path="/tontine/:id/membres/:membreId" element={<p>Fiche membre</p>} />
      </Routes>
      <Emplacement />
    </>,
    { route: '/notifications', auth: monRole === 'GESTIONNAIRE' ? 'gestionnaire' : 'membre' },
  )
}

describe('FR29 NotificationsPage — RETRAIT_REMIS', () => {
  it('membre : « Retrait de 10.000F enregistré », ouvre la fiche de l’épargne', async () => {
    const { user } = afficher('MEMBRE')

    await user.click(await screen.findByText('Retrait de 10.000F enregistré'))

    expect(await screen.findByText('Fiche')).toBeInTheDocument()
    expect(emplacement()).toBe('/tontine/t1')
  })

  it('gestionnaire : ouvre la fiche du membre', async () => {
    const { user } = afficher('GESTIONNAIRE')

    await user.click(await screen.findByText('Retrait de 10.000F enregistré'))

    expect(await screen.findByText('Fiche membre')).toBeInTheDocument()
    expect(emplacement()).toBe('/tontine/t1/membres/m-awa')
  })
})
