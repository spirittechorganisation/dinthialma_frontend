/**
 * FR25 — Reçu d'une épargne : « Jour du JJ/MM » (rythme journalier) ou « Période N », jamais « Tour N ».
 * Rotative inchangée (« Tour 6 ») : couvert par les tests `[caractérisation]` de RecuPage.test.tsx.
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { API, ok } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { uneCotisation } from '@/test/factories/cotisation'
import { uneTontine } from '@/test/factories/tontine'
import { unCycle } from '@/test/factories/cycle'
import { CotisationStatut } from '@/types/common'
import { TontineType, type RythmeUnite } from '@/types/tontine'
import { RecuPage } from './RecuPage'

function afficher(rythmeUnite: RythmeUnite) {
  server.use(
    http.get(`${API}/v1/tontines/t1/cotisations/cot1`, () => ok(uneCotisation({
      id: 'cot1', tontineId: 't1', cycleId: 'c3', montant: 2000, methodePaiement: 'CASH', statut: CotisationStatut.VALIDE,
    }))),
    http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({
      id: 't1', nom: 'Épargne', tontineType: TontineType.EVENEMENTIELLE, rythmeIntervalle: 1, rythmeUnite,
    }))),
    http.get(`${API}/v1/tontines/t1/cycles/c3`, () => ok(unCycle({ id: 'c3', numeroCycle: 3, dateDebut: '2026-11-23', dateFin: '2026-11-23' }))),
  )
  renderWithProviders(
    <Routes><Route path="/recu/:tontineId/:cotisationId" element={<RecuPage />} /></Routes>,
    { route: '/recu/t1/cot1', auth: 'gestionnaire' },
  )
}

const ligneTontine = async () => (await screen.findByText('Tontine', { selector: 'dt' })).nextElementSibling

describe('FR25 RecuPage — nom de la période', () => {
  it('épargne journalière : « Épargne · Jour du 23/11 »', async () => {
    afficher('JOUR')

    await screen.findByText('Épargne · Jour du 23/11')
    expect(await ligneTontine()).toHaveTextContent('Épargne · Jour du 23/11')
    expect(screen.queryByText(/Tour 3/)).not.toBeInTheDocument()
  })

  it('épargne hebdomadaire : « Épargne · Période 3 »', async () => {
    afficher('SEMAINE')

    await screen.findByText('Épargne · Période 3')
    expect(await ligneTontine()).toHaveTextContent('Épargne · Période 3')
  })
})
