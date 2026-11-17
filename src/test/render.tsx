/**
 * `renderWithProviders` — enrobe le composant testé avec tous les providers de l'app :
 * - QueryClient neuf avec `retry: false` (chaque test repart d'un état propre)
 * - MemoryRouter positionné sur `route` (défaut `/`)
 * - AuthProvider (lit les jetons depuis localStorage — appeler `connecter()` avant le rendu)
 *
 * Retourne aussi `user` (userEvent configuré) et `queryClient` pour les assertions de cache.
 */
import React, { type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import { UserRole } from '@/types/common'
import { connecter } from './auth'

/** Rôle prédéfini ou null (non connecté) */
export type AuthPreset = 'membre' | 'gestionnaire' | 'superadmin' | 'user' | null

const PRESET_ROLES: Record<Exclude<AuthPreset, null>, UserRole[]> = {
  membre:       [UserRole.MEMBER],
  gestionnaire: [UserRole.ADMIN, UserRole.MEMBER],
  superadmin:   [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MEMBER],
  user:         [UserRole.USER],
}

export interface RenderProviderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** URL initiale — défaut `/` */
  route?: string
  /** Pattern de route pour le composant (ex. `/tontine/:id`) — défaut même que `route` */
  path?: string
  /** Session simulée — null = non connecté */
  auth?: AuthPreset
}

function creerQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderProviderOptions = {},
) {
  const { route = '/', path, auth = 'membre', ...renderOptions } = options

  // Connecter l'utilisateur si un preset est fourni
  if (auth !== null) {
    connecter(PRESET_ROLES[auth])
  }

  const queryClient = creerQueryClient()
  const user = userEvent.setup()

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>
            {path ? (
              <Routes>
                <Route path={path} element={children} />
                <Route path="*" element={children} />
              </Routes>
            ) : (
              children
            )}
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions })

  return { ...result, user, queryClient }
}
