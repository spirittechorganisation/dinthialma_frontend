/**
 * Outils de routage pour les tests d'écran.
 *
 * - `<Emplacement />` affiche l'URL courante et l'état de navigation dans une région
 *   accessible « Emplacement » : on vérifie une redirection par ce que l'utilisateur
 *   obtiendrait (la page suivante), sans espionner `useNavigate`.
 * - `<Depart to state />` navigue dès son montage avec un état (`location.state`),
 *   pour ouvrir un écran comme le ferait l'écran précédent (ex. reçu juste après un paiement).
 */
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { screen } from '@testing-library/react'

export function Emplacement() {
  const location = useLocation()
  return (
    <output aria-label="Emplacement" data-state={JSON.stringify(location.state ?? null)}>
      {location.pathname}
    </output>
  )
}

/** URL courante affichée par `<Emplacement />` */
export function emplacement(): string {
  return screen.getByRole('status', { name: 'Emplacement' }).textContent ?? ''
}

/** État de navigation courant (`location.state`) affiché par `<Emplacement />` */
export function etatNavigation(): unknown {
  return JSON.parse(screen.getByRole('status', { name: 'Emplacement' }).getAttribute('data-state') ?? 'null')
}

export function Depart({ to, state }: { to: string; state?: unknown }) {
  const navigate = useNavigate()
  useEffect(() => {
    navigate(to, { replace: true, state })
  }, [navigate, to, state])
  return null
}
