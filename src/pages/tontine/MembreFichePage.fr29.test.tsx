/**
 * FR29 — Fiche d'un membre d'une épargne (gestionnaire) : solde, « Enregistrer un retrait », historique et annulation.
 * Horloge : 22/11/2026 à 10h, heure de Dakar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { Toaster, toast } from 'sonner'
import { API, ok, page, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement } from '@/test/router'
import { uneTontine } from '@/test/factories/tontine'
import { unMembre } from '@/test/factories/membre'
import { unCycle } from '@/test/factories/cycle'
import { CycleStatut, TontineStatut } from '@/types/common'
import { TontineType } from '@/types/tontine'
import type { Retrait } from '@/types/retrait'
import { MembreFichePage } from './MembreFichePage'

type Corps = Record<string, unknown>

const retrait = (surcharge: Partial<Retrait> = {}): Retrait => ({
  id: 'r1', tontineId: 't1', membreId: 'm-awa', firstName: 'Awa', lastName: 'Ndiaye', nature: 'PARTIEL', montant: 10000, frais: 0,
  statut: 'REMIS', origine: 'GESTIONNAIRE', methodePaiement: 'CASH', dateRemise: '2026-11-21T12:00:00', createdAt: '2026-11-22T10:00:00',
  ...surcharge,
})

/** Épargne journalière : Awa a cotisé 44.000F ; retraits et solde configurables ; capture des envois */
function epargne(o: { soldeLe?: string | null; retraits?: Retrait[]; regleRetrait?: 'LIBRE' | 'INTERDIT'; totalRetire?: number } = {}) {
  const envois: Corps[] = []
  const annulations: Corps[] = []
  const totalRetire = o.totalRetire ?? 0
  server.use(
    http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({
      id: 't1', nom: 'Épargne', tontineType: TontineType.EVENEMENTIELLE, statut: TontineStatut.ACTIVE, monRole: 'GESTIONNAIRE',
      rythmeIntervalle: 1, rythmeUnite: 'JOUR', dateDebut: '2026-11-01', regleRetrait: o.regleRetrait ?? 'LIBRE',
    }))),
    http.get(`${API}/v1/tontines/t1/membres`, () => page([
      unMembre({ id: 'm-awa', soldeLe: o.soldeLe ?? null, user: { id: 'u-awa', firstName: 'Awa', lastName: 'Ndiaye', phone: '+221770009101' } as never }),
    ])),
    http.get(`${API}/v1/tontines/t1/cycles`, () => page([unCycle({ id: 'c22', numeroCycle: 22, statut: CycleStatut.EN_COURS, dateDebut: '2026-11-22', dateFin: '2026-11-22' })])),
    http.get(`${API}/v1/tontines/t1/membres/m-awa/solde`, () => ok({
      membreId: 'm-awa', totalCotiseValide: 44000, totalRetire, solde: 44000 - totalRetire, soldeLe: o.soldeLe ?? null,
    })),
    http.get(`${API}/v1/tontines/t1/retraits`, () => page(o.retraits ?? [])),
    http.post(`${API}/v1/tontines/t1/retraits/admin`, async ({ request }) => {
      const corps = (await request.json()) as Corps
      envois.push(corps)
      const montant = (corps.montant as number | undefined) ?? 44000
      return ok(retrait({ id: 'r-new', nature: corps.nature as Retrait['nature'], montant, soldeRestant: 44000 - montant }))
    }),
    http.delete(`${API}/v1/tontines/t1/retraits/:rid`, async ({ request }) => {
      annulations.push((await request.json()) as Corps)
      return ok(retrait({ statut: 'ANNULE', soldeRestant: 44000 }))
    }),
  )
  return { envois, annulations }
}

function afficher() {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/tontine/:id/membres/:membreId" element={<MembreFichePage />} />
        <Route path="/a-valider" element={<p>À valider</p>} />
      </Routes>
      <Emplacement />
      <Toaster />
    </>,
    { route: '/tontine/t1/membres/m-awa', auth: 'gestionnaire' },
  )
}

type User = ReturnType<typeof afficher>['user']

async function ouvrirRetrait(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Enregistrer un retrait' }))
  return screen.findByRole('dialog', { name: 'Enregistrer un retrait' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-22T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  toast.dismiss()
})

describe('FR29 MembreFichePage — bloc Épargne', () => {
  it('cotisé, retiré, solde ; pas de position de jackpot ni de « tour »', async () => {
    epargne({ totalRetire: 10000 })
    afficher()

    const bloc = (await screen.findByRole('heading', { name: 'Épargne' })).closest('section')!
    await waitFor(() => expect(bloc).toHaveTextContent('Cotisé44.000F'))
    expect(bloc).toHaveTextContent('Retiré10.000F')
    expect(bloc).toHaveTextContent('Solde34.000F')
    expect(screen.queryByText(/^Position/)).not.toBeInTheDocument()
    expect(screen.getByText(/^Jour du 22\/11 :/)).toBeInTheDocument()
  })
})

describe('FR29 MembreFichePage — Enregistrer un retrait', () => {
  it('report d’un retrait partiel daté d’hier : récapitulatif puis envoi avec la date réelle', async () => {
    const { envois } = epargne()
    const { user } = afficher()

    const dialogue = await ouvrirRetrait(user)
    await user.type(within(dialogue).getByLabelText('Montant remis en francs CFA'), '10000')
    expect(within(dialogue).getByText(/pour reporter un retrait noté dans le cahier/)).toBeInTheDocument()
    const date = within(dialogue).getByLabelText('Date de remise')
    expect(date).toHaveValue('2026-11-22')
    await user.clear(date)
    await user.type(date, '2026-11-21')
    await user.type(within(dialogue).getByLabelText('Motif (facultatif)'), 'Report du cahier')
    await user.click(within(dialogue).getByRole('button', { name: 'Continuer' }))

    const recap = await screen.findByRole('dialog', { name: 'Confirmer le retrait' })
    expect(recap).toHaveTextContent('Remettre 10.000F en espèces à Awa. Il lui restera 34.000F.')
    expect(recap).toHaveTextContent('Remis le 21/11/2026 (report du cahier).')
    await user.click(within(recap).getByRole('button', { name: 'Confirmer le retrait' }))

    expect(await screen.findByText('Retrait de 10.000F enregistré')).toBeInTheDocument()
    expect(envois).toEqual([{
      membreId: 'm-awa', nature: 'PARTIEL', montant: 10000, methodePaiement: 'CASH', motif: 'Report du cahier', dateRemise: '2026-11-21T12:00:00',
    }])
  })

  it('« Tout retirer » : montant = solde, non modifiable ; récapitulatif du retrait total ; envoyé sans montant', async () => {
    const { envois } = epargne()
    const { user } = afficher()

    const dialogue = await ouvrirRetrait(user)
    await user.click(within(dialogue).getByRole('radio', { name: 'Tout retirer' }))
    const montant = within(dialogue).getByLabelText('Montant remis en francs CFA')
    expect(montant).toHaveValue('44.000')
    expect(montant).toHaveAttribute('readonly')
    await user.click(within(dialogue).getByRole('button', { name: 'Orange Money' }))
    await user.type(within(dialogue).getByLabelText('Référence de la transaction'), 'OM-123')
    await user.click(within(dialogue).getByRole('button', { name: 'Continuer' }))

    const recap = await screen.findByRole('dialog', { name: 'Confirmer le retrait' })
    expect(recap).toHaveTextContent('Remettre 44.000F par Orange Money à Awa. Awa sera soldé(e) : plus de cotisation, et rien à recevoir à la fin.')
    await user.click(within(recap).getByRole('button', { name: 'Confirmer le retrait' }))

    await screen.findByText('Retrait de 44.000F enregistré')
    expect(envois).toEqual([{ membreId: 'm-awa', nature: 'TOTAL', methodePaiement: 'ORANGE_MONEY', referenceTransaction: 'OM-123' }])
  })

  it('au-delà du solde : prévient avant d’envoyer', async () => {
    const { envois } = epargne()
    const { user } = afficher()

    const dialogue = await ouvrirRetrait(user)
    await user.type(within(dialogue).getByLabelText('Montant remis en francs CFA'), '50000')
    await user.click(within(dialogue).getByRole('button', { name: 'Continuer' }))

    expect(within(dialogue).getByRole('alert')).toHaveTextContent('Le solde est de 44.000F : le retrait ne peut pas le dépasser.')
    expect(envois).toHaveLength(0)
  })

  it('RETRAIT_COTISATIONS_EN_ATTENTE : nombre de cotisations et « Ouvrir À valider »', async () => {
    epargne()
    server.use(http.post(`${API}/v1/tontines/t1/retraits/admin`, () => erreur(400, 'RETRAIT_COTISATIONS_EN_ATTENTE', 'Ce membre a 2 cotisation(s)…', { cotisationsEnAttente: 2 })))
    const { user } = afficher()

    const dialogue = await ouvrirRetrait(user)
    await user.click(within(dialogue).getByRole('radio', { name: 'Tout retirer' }))
    await user.click(within(dialogue).getByRole('button', { name: 'Continuer' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Confirmer le retrait' })).getByRole('button', { name: 'Confirmer le retrait' }))

    const formulaire = await screen.findByRole('dialog', { name: 'Enregistrer un retrait' })
    expect(within(formulaire).getByRole('alert')).toHaveTextContent('2 cotisations en attente ou en retard : validez-les ou refusez-les avant le retrait total.')
    expect(within(formulaire).getByRole('link', { name: 'Ouvrir À valider' })).toHaveAttribute('href', '/a-valider?tontine=t1')
  })

  it('retraits interdits : pas de bouton, lien vers les Réglages', async () => {
    epargne({ regleRetrait: 'INTERDIT' })
    afficher()

    expect(await screen.findByRole('link', { name: 'Les autoriser' })).toHaveAttribute('href', '/tontine/t1/reglages')
    expect(screen.queryByRole('button', { name: 'Enregistrer un retrait' })).not.toBeInTheDocument()
  })
})

describe('FR29 MembreFichePage — historique et annulation', () => {
  it('« Annuler » : motif obligatoire, confirmation, envoi du motif', async () => {
    const { annulations } = epargne({ totalRetire: 10000, retraits: [retrait()] })
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Annuler le retrait de 10.000F' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Annuler ce retrait ?' })
    await user.click(within(dialogue).getByRole('button', { name: 'Annuler le retrait' }))
    expect(within(dialogue).getByRole('alert')).toHaveTextContent('Indiquez le motif de l’annulation.')
    expect(annulations).toHaveLength(0)

    await user.type(within(dialogue).getByLabelText('Motif de l’annulation'), 'Saisi en double')
    await user.click(within(dialogue).getByRole('button', { name: 'Annuler le retrait' }))

    expect(await screen.findByText('Retrait annulé')).toBeInTheDocument()
    expect(annulations).toEqual([{ motif: 'Saisi en double' }])
  })

  it('RETRAIT_NON_ANNULABLE : « annulez d’abord le retrait total »', async () => {
    epargne({ totalRetire: 10000, retraits: [retrait()] })
    server.use(http.delete(`${API}/v1/tontines/t1/retraits/:rid`, () => erreur(400, 'RETRAIT_NON_ANNULABLE', 'Non annulable')))
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: 'Annuler le retrait de 10.000F' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Annuler ce retrait ?' })
    await user.type(within(dialogue).getByLabelText('Motif de l’annulation'), 'Erreur')
    await user.click(within(dialogue).getByRole('button', { name: 'Annuler le retrait' }))

    expect(await within(dialogue).findByRole('alert')).toHaveTextContent(/annulez d’abord le retrait total/)
  })
})

describe('FR29 MembreFichePage — membre soldé', () => {
  it('badge « Soldé », plus d’Encaisser ni de retrait ; retrait annulé barré', async () => {
    epargne({
      soldeLe: '2026-11-21T12:00:00', totalRetire: 44000,
      retraits: [retrait({ id: 'r2', nature: 'TOTAL', montant: 44000 }), retrait({ statut: 'ANNULE', motifAnnulation: 'Doublon' })],
    })
    afficher()

    expect((await screen.findAllByText('Soldé')).length).toBeGreaterThan(0)
    await screen.findByText(/a tout retiré le/)
    expect(screen.queryByRole('link', { name: 'Encaisser' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enregistrer un retrait' })).not.toBeInTheDocument()
    expect(screen.getByText('Doublon')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Annuler le retrait de 10.000F' })).not.toBeInTheDocument()
  })
})
