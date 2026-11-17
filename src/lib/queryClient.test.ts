/**
 * Tests de src/lib/queryClient.ts
 *
 * Vérifie que toute mutation réussie invalide les requêtes ['me', ...].
 */
import { describe, it, expect } from 'vitest'
import { QueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { queryClient as appQueryClient } from './queryClient'

// On crée un client avec le même MutationCache que l'app
function creerClient() {
  return new QueryClient({
    mutationCache: appQueryClient.getMutationCache(),
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

describe('queryClient — invalidation sur mutation', () => {
  it('une mutation réussie invalide les requêtes ["me"]', async () => {
    const qc = creerClient()
    let fetchCount = 0

    // Requête "me" qui compte ses exécutions
    const useMe = () => useQuery({
      queryKey: ['me', 'summary'],
      queryFn: async () => { fetchCount++; return { total: 0 } },
    })

    // Mutation qui ne fait rien mais déclenche l'invalidation
    const useMut = () => useMutation({ mutationFn: async () => 'ok' })

    const { result: meResult } = renderHook(() => useMe(), { wrapper: ({ children }) => <qc.Provider client={qc}>{children}</qc.Provider> } as never)
    await waitFor(() => expect(meResult.current.isSuccess).toBe(true))
    expect(fetchCount).toBe(1)

    const { result: mutResult } = renderHook(() => useMut(), { wrapper: ({ children }) => <qc.Provider client={qc}>{children}</qc.Provider> } as never)
    mutResult.current.mutate()
    await waitFor(() => expect(mutResult.current.isSuccess).toBe(true))

    // La requête "me" doit être re-fetchée (invalidée par le MutationCache)
    await waitFor(() => expect(fetchCount).toBe(2))
  })
})
