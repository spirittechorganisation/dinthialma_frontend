/**
 * FR31 — Appareils connectés (B53) : « Cet appareil » repéré par l'appareilId, badge « Appareil de confiance »,
 * dernière utilisation ; déconnecter un autre appareil demande une confirmation qui explique la coupure du PIN.
 */
import { describe, it, expect } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http } from 'msw'
import { Toaster } from 'sonner'
import { API, ok } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { getAppareilId } from '@/lib/appareil'
import { ParametresPage } from './ParametresPage'

function afficher() {
  const supprimees: string[] = []
  const moi = getAppareilId()
  server.use(
    http.get(`${API}/v1/me/sessions`, () => ok([
      { id: 's-moi', clientType: 'WEB', deviceInfo: 'Chrome – Android 14 – Pixel 7', courante: false, confiance: true, appareilId: moi, derniereUtilisation: '2026-11-24T09:00:00' },
      { id: 's-pc', clientType: 'WEB', deviceInfo: 'Edge – Windows', courante: false, confiance: true, appareilId: 'autre-appareil-123', derniereUtilisation: '2026-11-20T18:30:00' },
      { id: 's-ancien', clientType: 'MOBILE', deviceInfo: null, courante: false, confiance: false, derniereActivite: '2026-11-01T08:00:00' },
    ].filter((x) => !supprimees.includes(x.id)))),
    http.delete(`${API}/v1/me/sessions/:id`, ({ params }) => { supprimees.push(String(params.id)); return ok(null) }),
  )
  const r = renderWithProviders(
    <><Routes><Route path="/parametres" element={<ParametresPage />} /></Routes><Toaster /></>,
    { route: '/parametres', auth: 'membre' },
  )
  return { ...r, supprimees }
}

describe('FR31 ParametresPage — appareils connectés', () => {
  it('cet appareil, appareils de confiance, dernière utilisation', async () => {
    const { user } = afficher()

    await user.click(await screen.findByRole('button', { name: /Appareils connectés/ }))
    const feuille = await screen.findByRole('dialog', { name: 'Appareils connectés' })

    const moi = (await within(feuille).findByText('Chrome – Android 14 – Pixel 7')).closest('li')!
    expect(moi).toHaveTextContent('Cet appareil')
    expect(moi).toHaveTextContent('Appareil de confiance')
    expect(within(moi).getByRole('button', { name: 'Me déconnecter' })).toBeInTheDocument()

    const pc = within(feuille).getByText('Edge – Windows').closest('li')!
    expect(pc).not.toHaveTextContent('Cet appareil')
    expect(pc).toHaveTextContent('Appareil de confiance')
    expect(pc).toHaveTextContent(/Utilisé le/)

    const ancien = within(feuille).getByText('Application').closest('li')!
    expect(ancien).not.toHaveTextContent('Appareil de confiance')
  })

  it('déconnecter un autre appareil : confirmation qui explique la coupure du code secret', async () => {
    const { user, supprimees } = afficher()

    await user.click(await screen.findByRole('button', { name: /Appareils connectés/ }))
    const feuille = await screen.findByRole('dialog', { name: 'Appareils connectés' })
    const pc = (await within(feuille).findByText('Edge – Windows')).closest('li')!
    await user.click(within(pc).getByRole('button', { name: 'Déconnecter' }))

    const confirmation = await screen.findByRole('dialog', { name: 'Déconnecter cet appareil ?' })
    expect(confirmation).toHaveTextContent('ne sera plus un appareil de confiance')
    expect(confirmation).toHaveTextContent('le code secret n’y fonctionnera plus, il faudra se reconnecter avec le mot de passe')
    expect(supprimees).toHaveLength(0)

    await user.click(within(confirmation).getByRole('button', { name: 'Déconnecter' }))
    await waitFor(() => expect(supprimees).toEqual(['s-pc']))
    expect(await screen.findByText('Appareil déconnecté')).toBeInTheDocument()
    // La liste est relue : l'appareil déconnecté disparaît
    await waitFor(() => expect(within(feuille).queryByText('Edge – Windows')).not.toBeInTheDocument())
  })
})
