/**
 * FR23 — Modifier une tontine en brouillon : la date de début (B46).
 *
 * Arrivée depuis un lancement refusé (?champ=dateDebut), date passée signalée avant d'envoyer,
 * refus DATE_DEBUT_PASSEE affiché sur le champ date.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { uneTontine } from '@/test/factories/tontine'
import { TontineStatut } from '@/types/common'
import { TontineType } from '@/types/tontine'
import { ModifierTontinePage } from './ModifierTontinePage'

function brouillon(reponse: () => Response = () => ok(uneTontine({ id: 't1' }))) {
  const envois: Record<string, unknown>[] = []
  server.use(
    http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({
      id: 't1', nom: 'Épargne', tontineType: TontineType.EVENEMENTIELLE, statut: TontineStatut.BROUILLON, montantLibre: true,
      montantMinimum: 2000, rythmeIntervalle: 1, rythmeUnite: 'JOUR', dateDebut: '2026-11-21', dateEcheance: '2026-12-31',
      monRole: 'GESTIONNAIRE',
    }))),
    http.put(`${API}/v1/tontines/t1`, async ({ request }) => {
      envois.push((await request.json()) as Record<string, unknown>)
      return reponse()
    }),
  )
  return { envois }
}

function afficher(route = '/tontine/t1/modifier') {
  return renderWithProviders(
    <Routes>
      <Route path="/tontine/:id/modifier" element={<ModifierTontinePage />} />
      <Route path="/tontine/:id/reglages" element={<p>Réglages</p>} />
    </Routes>,
    { route, auth: 'gestionnaire' },
  )
}

const debut = () => screen.getByLabelText('Début')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-22T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('FR23 ModifierTontinePage — date de début', () => {
  it('depuis un lancement refusé : message sur le champ date', async () => {
    brouillon()
    afficher('/tontine/t1/modifier?champ=dateDebut')

    expect(await screen.findByRole('alert')).toHaveTextContent('La date de début est passée : choisissez aujourd’hui ou une date future. Enregistrez, puis relancez la tontine.')
    expect(debut()).toHaveAttribute('aria-invalid', 'true')
  })

  it('date passée : prévient avant d\'envoyer ; une date valide part', async () => {
    const { envois } = brouillon()
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: /Enregistrer/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La date de début est passée')
    expect(envois).toHaveLength(0)

    fireEvent.change(debut(), { target: { value: '2026-11-22' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }))
    expect(await screen.findByText('Réglages')).toBeInTheDocument()
    expect(envois[0]).toMatchObject({ dateDebut: '2026-11-22' })
  })

  it('refus DATE_DEBUT_PASSEE du backend : message sur le champ date', async () => {
    brouillon(() => erreur(400, 'DATE_DEBUT_PASSEE', 'La date de début (22/11/2026) est passée'))
    const { user } = afficher()

    fireEvent.change(await screen.findByLabelText('Début'), { target: { value: '2026-11-22' } })
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La date de début est passée : choisissez aujourd’hui ou une date future.')
    expect(debut()).toHaveAttribute('aria-invalid', 'true')
  })
})
