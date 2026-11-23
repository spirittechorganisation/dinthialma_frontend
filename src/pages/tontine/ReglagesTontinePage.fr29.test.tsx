/** FR29 — Réglages d'une épargne : « Retraits avant la fin autorisés » (regleRetrait, B42). */
import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, page } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { uneTontine } from '@/test/factories/tontine'
import { TontineStatut } from '@/types/common'
import { TontineType } from '@/types/tontine'
import { ReglagesTontinePage } from './ReglagesTontinePage'

function afficher(tontineType: TontineType, regleRetrait: 'LIBRE' | 'INTERDIT' = 'INTERDIT') {
  const envois: unknown[] = []
  let regle = regleRetrait
  server.use(
    http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({ id: 't1', nom: 'Épargne', tontineType, statut: TontineStatut.ACTIVE, monRole: 'GESTIONNAIRE', regleRetrait: regle }))),
    http.get(`${API}/v1/tontines/t1/commissions`, () => page([])),
    http.patch(`${API}/v1/tontines/t1/reglages`, async ({ request }) => {
      const corps = (await request.json()) as { regleRetrait: 'LIBRE' | 'INTERDIT' }
      envois.push(corps)
      regle = corps.regleRetrait
      return ok(uneTontine({ id: 't1', tontineType, regleRetrait: regle }))
    }),
  )
  const r = renderWithProviders(
    <Routes><Route path="/tontine/:id/reglages" element={<ReglagesTontinePage />} /></Routes>,
    { route: '/tontine/t1/reglages', auth: 'gestionnaire' },
  )
  return { ...r, envois }
}

describe('FR29 ReglagesTontinePage — retraits avant la fin', () => {
  it('épargne : l’interrupteur envoie regleRetrait et explique la règle', async () => {
    const { user, envois } = afficher(TontineType.EVENEMENTIELLE, 'INTERDIT')

    const interrupteur = await screen.findByRole('switch', { name: 'Retraits avant la fin autorisés' })
    expect(interrupteur).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/chacun récupère tout ce qu’il a cotisé à la répartition finale/)).toBeInTheDocument()

    await user.click(interrupteur)

    await waitFor(() => expect(envois).toEqual([{ regleRetrait: 'LIBRE' }]))
    await waitFor(() => expect(interrupteur).toHaveAttribute('aria-checked', 'true'))
    expect(screen.getByText(/La répartition finale se fait sur ce qui reste/)).toBeInTheDocument()
  })

  it('rotative : pas d’interrupteur', async () => {
    afficher(TontineType.ROTATIVE)

    await screen.findByText('Montant', { selector: 'dt' })
    expect(screen.queryByRole('switch', { name: 'Retraits avant la fin autorisés' })).not.toBeInTheDocument()
  })
})
