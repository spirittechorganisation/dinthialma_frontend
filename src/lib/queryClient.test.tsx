/**
 * Tests de src/lib/queryClient.ts
 *
 * Le MutationCache du client de l'application invalide les requêtes ['me', …]
 * après toute mutation réussie (et seulement réussie).
 */
import { afterEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClientProvider, useMutation } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { queryClient } from './queryClient'

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

/** Lance une mutation sur le client de l'app (sans nouvel essai, pour l'échec). */
async function lancerMutation(mutationFn: () => Promise<unknown>) {
  const { result } = renderHook(() => useMutation({ mutationFn, retry: false }), { wrapper })
  await act(async () => {
    await result.current.mutateAsync().catch(() => undefined)
  })
}

const invalidee = (queryKey: unknown[]) => queryClient.getQueryState(queryKey)?.isInvalidated

describe('queryClient — invalidation après mutation', () => {
  afterEach(() => queryClient.clear())

  it('invalide les requêtes ["me", …] après une mutation réussie', async () => {
    queryClient.setQueryData(['me', 'summary'], { total: 0 })
    queryClient.setQueryData(['me', 'activite'], [])

    await lancerMutation(async () => 'ok')

    expect(invalidee(['me', 'summary'])).toBe(true)
    expect(invalidee(['me', 'activite'])).toBe(true)
  })

  it("n'invalide pas les autres requêtes", async () => {
    queryClient.setQueryData(['tontines'], [])

    await lancerMutation(async () => 'ok')

    expect(invalidee(['tontines'])).toBe(false)
  })

  it("n'invalide rien quand la mutation échoue", async () => {
    queryClient.setQueryData(['me', 'summary'], { total: 0 })

    await lancerMutation(async () => { throw new Error('échec') })

    expect(invalidee(['me', 'summary'])).toBe(false)
  })
})
