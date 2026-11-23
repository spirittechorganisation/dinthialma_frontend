/**
 * FR25 — Ajout d'un membre : pas de « Position jackpot » dans une épargne (événementielle) ;
 * l'invitation part par WhatsApp (backend : whatsappService.sendTontineInvite), jamais par SMS.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { http } from 'msw'
import { Toaster, toast } from 'sonner'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { uneTontine } from '@/test/factories/tontine'
import { unMembre } from '@/test/factories/membre'
import { AccountStatus } from '@/types/common'
import { TontineType } from '@/types/tontine'
import { AddMembreModal } from './AddMembreModal'

function afficher(tontineType: TontineType) {
  server.use(
    http.get(`${API}/v1/tontines/t1`, () => ok(uneTontine({ id: 't1', tontineType, monRole: 'GESTIONNAIRE' }))),
    http.get(`${API}/v1/users/search`, () => erreur(404, 'NOT_FOUND', 'Utilisateur introuvable')),
    http.post(`${API}/v1/tontines/t1/membres`, () => ok(unMembre({
      id: 'm-new', user: { id: 'u-new', firstName: 'Fatou', lastName: 'Sow', phone: '+221770009104', accountStatus: AccountStatus.PRE_ENROLLED } as never,
    }))),
  )
  return renderWithProviders(
    <>
      <AddMembreModal tontineId="t1" isOpen onClose={() => {}} initialPhone="+221770009104" />
      <Toaster />
    </>,
    { auth: 'gestionnaire' },
  )
}

afterEach(() => { toast.dismiss() })

describe('FR25 AddMembreModal', () => {
  it('épargne : pas de « Position jackpot », invitation annoncée par WhatsApp', async () => {
    const { user } = afficher(TontineType.EVENEMENTIELLE)

    await user.click(await screen.findByRole('button', { name: /Rechercher/ }))
    expect(await screen.findByText(/Une invitation lui sera envoyée par WhatsApp/)).toBeInTheDocument()
    expect(screen.queryByText('Position jackpot (optionnel)')).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Fatou'), 'Fatou')
    await user.type(screen.getByPlaceholderText('Sow'), 'Sow')
    await user.click(screen.getByRole('button', { name: 'Ajouter le membre' }))

    expect(await screen.findByText('Membre ajouté. Invitation envoyée par WhatsApp au +221770009104.')).toBeInTheDocument()
    expect(screen.queryByText(/SMS/)).not.toBeInTheDocument()
  })

  it('rotative : « Position jackpot » toujours proposée', async () => {
    const { user } = afficher(TontineType.ROTATIVE)

    await user.click(await screen.findByRole('button', { name: /Rechercher/ }))
    await screen.findByText(/Une invitation lui sera envoyée par WhatsApp/)
    expect(await screen.findByText('Position jackpot (optionnel)')).toBeInTheDocument()
  })
})
