import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { tontineService } from '@/services/tontineService'
import {
  CreateTontineRequest, UpdateTontineRequest, CreateCommissionRequest, UpdateCommissionRequest,
  ModifierEcheanceRequest, ModeRemise, SimulationParams,
} from '@/types/tontine'

// ─── Tontines ─────────────────────────────────────────────────────────────────

export function useTontines(page = 0, size = 20) {
  return useQuery({
    queryKey: ['tontines', page, size],
    queryFn: () => tontineService.listTontines(page, size),
  })
}

export function useTontine(id: string) {
  return useQuery({
    queryKey: ['tontine', id],
    queryFn: () => tontineService.getTontine(id),
    enabled: !!id,
  })
}

export function useCreateTontine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: CreateTontineRequest) => tontineService.createTontine(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tontines'] })
    },
  })
}

export function useUpdateTontine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: UpdateTontineRequest }) =>
      tontineService.updateTontine(id, request),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tontines'] })
      queryClient.invalidateQueries({ queryKey: ['tontine', id] })
    },
  })
}

export function useDeleteTontine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tontineService.deleteTontine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tontines'] })
    },
  })
}

export function useActiverTontine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tontineService.activerTontine(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tontines'] })
      queryClient.invalidateQueries({ queryKey: ['tontine', id] })
    },
  })
}

export function useSuspendreTontine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tontineService.suspendreTontine(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tontines'] })
      queryClient.invalidateQueries({ queryKey: ['tontine', id] })
    },
  })
}

/** Après un changement de règles : la fiche, mes listes et les tours à venir (replanifiés) */
function invaliderTontine(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['tontines'] })
  queryClient.invalidateQueries({ queryKey: ['tontine', id] })
  queryClient.invalidateQueries({ queryKey: ['me'] })
  queryClient.invalidateQueries({ queryKey: ['cycles', id] })
  queryClient.invalidateQueries({ queryKey: ['cycle', id] })
}

/** Jour / heure limite et rappels, y compris tontine en cours (B26) */
export function useModifierEcheance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: ModifierEcheanceRequest }) =>
      tontineService.modifierEcheance(id, request),
    onSuccess: (_, { id }) => invaliderTontine(queryClient, id),
  })
}

/** Option de remise du jackpot par défaut (B33) */
export function useModifierReglages() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, modeRemise }: { id: string; modeRemise: ModeRemise }) =>
      tontineService.modifierReglages(id, { modeRemise }),
    onSuccess: (_, { id }) => invaliderTontine(queryClient, id),
  })
}

/**
 * Calendrier simulé par le backend pour les écrans Créer / Modifier.
 * Les paramètres sont temporisés (saisie du montant au pavé) et le dernier résultat reste affiché
 * pendant le rechargement, pour que le résumé ne clignote pas.
 */
export function useSimulation(params: SimulationParams | null) {
  const cle = params ? JSON.stringify(params) : ''
  const [stable, setStable] = useState(cle)
  useEffect(() => {
    const id = setTimeout(() => setStable(cle), 350)
    return () => clearTimeout(id)
  }, [cle])
  return useQuery({
    queryKey: ['simulation', stable],
    queryFn: ({ signal }) => tontineService.simuler(JSON.parse(stable) as SimulationParams, signal),
    enabled: !!stable,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

// ─── Commissions ──────────────────────────────────────────────────────────────

export function useCommissions(tontineId: string, page = 0, size = 20) {
  return useQuery({
    queryKey: ['commissions', tontineId, page, size],
    queryFn: () => tontineService.listCommissions(tontineId, page, size),
    enabled: !!tontineId,
  })
}

export function useCreateCommission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tontineId, request }: { tontineId: string; request: CreateCommissionRequest }) =>
      tontineService.createCommission(tontineId, request),
    onSuccess: (_, { tontineId }) => {
      queryClient.invalidateQueries({ queryKey: ['commissions', tontineId] })
    },
  })
}

export function useUpdateCommission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      tontineId,
      commissionId,
      request,
    }: {
      tontineId: string
      commissionId: string
      request: UpdateCommissionRequest
    }) => tontineService.updateCommission(tontineId, commissionId, request),
    onSuccess: (_, { tontineId }) => {
      queryClient.invalidateQueries({ queryKey: ['commissions', tontineId] })
    },
  })
}

export function useDeleteCommission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tontineId, commissionId }: { tontineId: string; commissionId: string }) =>
      tontineService.deleteCommission(tontineId, commissionId),
    onSuccess: (_, { tontineId }) => {
      queryClient.invalidateQueries({ queryKey: ['commissions', tontineId] })
    },
  })
}
