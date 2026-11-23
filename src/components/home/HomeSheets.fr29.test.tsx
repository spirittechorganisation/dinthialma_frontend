/**
 * FR29 — « Je cotise » : par épargne, le solde et le total retiré ; membre soldé : badge « Soldé »
 * et plus rien « à payer » (filtré dans meService.getCotisantSummary).
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { http } from 'msw'
import { API, ok } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { meService } from '@/services/meService'
import { MontantsSheet } from './HomeSheets'

const ligne = (id: string, nom: string, extra: Record<string, unknown>) => ({
  tontineId: id, nom, tontineType: 'EVENEMENTIELLE', statut: 'ACTIVE', totalCotiseValide: 44000, totalEnAttente: 0,
  toursPayes: 22, toursTotal: 41, cycleEnCours: { cycleId: `c-${id}`, numeroCycle: 22, dateDebut: '2026-11-22', dateFin: '2026-11-22' },
  cotisationDue: { montant: 2000, montantLibre: true, dateLimite: '2026-11-22T23:59:00Z', statut: 'A_PAYER' },
  ...extra,
})

function resume() {
  server.use(http.get(`${API}/v1/me/summary`, () => ok({
    totalCotiseValide: 88000, totalEnAttente: 0, totalJackpotsRecus: 0, nombreCotisationsDues: 2, montantDu: 4000,
    tontines: [
      ligne('t1', 'Épargne Tabaski', { totalRetire: 10000, solde: 34000, soldeLe: null }),
      ligne('t2', 'Épargne école', { totalRetire: 44000, solde: 0, soldeLe: '2026-11-21T12:00:00' }),
    ],
  })))
}

describe('FR29 Je cotise', () => {
  it('meService : un membre soldé n’a plus rien à payer ; solde et retiré repris', async () => {
    resume()
    const r = await meService.getCotisantSummary()

    expect(r.aPayer.map((t) => t.tontineId)).toEqual(['t1'])
    expect(r.tontines[0]).toMatchObject({ totalRetire: 10000, solde: 34000, soldeLe: null })
    expect(r.tontines[1].soldeLe).toBe('2026-11-21T12:00:00')
  })

  it('« Mes montants par tontine » : solde, retiré, badge « Soldé », sans « tours »', async () => {
    resume()
    const cotisant = await meService.getCotisantSummary()
    renderWithProviders(<MontantsSheet isOpen onClose={() => {}} mode="COTISE" cotisant={cotisant} hidden={false} />)

    const tabaski = (await screen.findByText('Épargne Tabaski')).closest('a')!
    expect(tabaski).toHaveTextContent('34.000F')
    expect(tabaski).toHaveTextContent('Solde · retiré 10.000F')
    const ecole = screen.getByText('Épargne école').closest('a')!
    expect(ecole).toHaveTextContent('Soldé')
    expect(ecole).toHaveTextContent('0F')
    expect(screen.queryByText(/tours payés/)).not.toBeInTheDocument()
  })
})
