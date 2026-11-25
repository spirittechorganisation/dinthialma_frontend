/**
 * FR31 — Aucune écriture n'est renvoyée automatiquement : un POST qui échoue sur le réseau a pu arriver au
 * serveur, le renvoyer doublerait un encaissement ou un retrait. Test avec le QueryClient de l'application.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider, useMutation } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { API } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { connecter } from '@/test/auth'
import api from '@/services/api'
import { queryClient } from './queryClient'

const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>

afterEach(() => { queryClient.clear() })

describe('FR31 queryClient — mutations', () => {
  it('retry à 0 par défaut pour toutes les mutations', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(0)
  })

  it('un POST qui échoue sur le réseau n’est jamais renvoyé automatiquement', async () => {
    connecter()
    let envois = 0
    server.use(http.post(`${API}/v1/tontines/t1/retraits/admin`, () => { envois++; return HttpResponse.error() }))
    const { result } = renderHook(() => useMutation({
      mutationFn: () => api.post('/v1/tontines/t1/retraits/admin', { membreId: 'm1', nature: 'TOTAL', methodePaiement: 'CASH' }),
    }), { wrapper })

    result.current.mutate()

    await waitFor(() => expect(result.current.isError).toBe(true))
    // Laisse passer le délai d'un éventuel nouvel essai (1 s par défaut dans React Query)
    await new Promise((r) => setTimeout(r, 1500))
    expect(envois).toBe(1)
    expect(result.current.failureCount).toBe(1)
  })

  it('un POST qui reçoit une erreur serveur n’est pas renvoyé non plus', async () => {
    connecter()
    let envois = 0
    server.use(http.post(`${API}/v1/tontines/t1/cotisations/admin`, () => { envois++; return HttpResponse.json({ code: 'INTERNAL_ERROR' }, { status: 500 }) }))
    const { result } = renderHook(() => useMutation({ mutationFn: () => api.post('/v1/tontines/t1/cotisations/admin', {}) }), { wrapper })

    result.current.mutate()

    await waitFor(() => expect(result.current.isError).toBe(true))
    await new Promise((r) => setTimeout(r, 1500))
    expect(envois).toBe(1)
  })
})
