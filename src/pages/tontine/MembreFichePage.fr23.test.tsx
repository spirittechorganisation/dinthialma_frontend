/**
 * FR23 — Fiche membre : un membre SORTI peut être réactivé par le gestionnaire
 * (B44, décision 3 : réactiver, encaisser, puis le repasser SORTI). « Retirer » n'est plus proposé.
 */
import { describe, it, expect } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, page } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { uneTontine } from '@/test/factories/tontine'
import { unMembre } from '@/test/factories/membre'
import { MembreStatut } from '@/types/common'
import { MembreFichePage } from './MembreFichePage'

describe('FR23 MembreFichePage — membre sorti', () => {
  it('propose « Réactiver » et envoie le statut ACTIF', async () => {
    const corps: unknown[] = []
    server.use(
      http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({ id: 't1', monRole: 'GESTIONNAIRE' }))),
      http.get(`${API}/v1/tontines/t1/membres`, () => page([
        unMembre({ id: 'm-coumba', statut: MembreStatut.SORTI, user: { id: 'u-c', firstName: 'Coumba', lastName: 'Fall', phone: '+221770009103' } as never }),
      ])),
      http.get(`${API}/v1/tontines/t1/cycles`, () => page([])),
      http.patch(`${API}/v1/tontines/t1/membres/m-coumba/statut`, async ({ request }) => {
        corps.push(await request.json())
        return ok(unMembre({ id: 'm-coumba', statut: MembreStatut.ACTIF }))
      }),
    )
    const { user } = renderWithProviders(
      <Routes><Route path="/tontine/:id/membres/:membreId" element={<MembreFichePage />} /></Routes>,
      { route: '/tontine/t1/membres/m-coumba', auth: 'gestionnaire' },
    )

    expect(await screen.findByText('Sorti')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retirer de la tontine' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réactiver' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Réactiver Coumba ?' })).getByRole('button', { name: 'Réactiver' }))

    await waitFor(() => expect(corps).toEqual([{ statut: 'ACTIF' }]))
  })
})
