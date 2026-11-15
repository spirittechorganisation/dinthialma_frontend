import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cycleService } from '@/services/cycleService'
import { OpenCycleRequest, DesignerGagnantsRequest } from '@/types/cycle'
import type { ModeRemise } from '@/types/tontine'

export function useCycles(tontineId: string, page = 0, size = 20) {
  return useQuery({
    queryKey: ['cycles', tontineId, page, size],
    queryFn: () => cycleService.listCycles(tontineId, page, size),
    enabled: !!tontineId,
  })
}

export function useCycle(tontineId: string, cycleId: string) {
  return useQuery({
    queryKey: ['cycle', tontineId, cycleId],
    queryFn: () => cycleService.getCycle(tontineId, cycleId),
    enabled: !!tontineId && !!cycleId,
  })
}

export function useBeneficiairesHistorique(tontineId: string, page = 0, size = 20) {
  return useQuery({
    queryKey: ['beneficiaires-historique', tontineId, page, size],
    queryFn: () => cycleService.getBeneficiairesHistorique(tontineId, page, size),
    enabled: !!tontineId,
  })
}

/** Aperçu de la remise du jackpot : chargé à l'ouverture de la feuille « Remettre le jackpot » */
export function useRemiseApercu(tontineId: string, cycleId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['remise-apercu', tontineId, cycleId],
    queryFn: () => cycleService.getRemiseApercu(tontineId, cycleId),
    enabled: enabled && !!tontineId && !!cycleId,
    staleTime: 0,
    retry: false,
  })
}

/** Dates proposées par le backend pour le prochain tour (mode manuel) */
export function usePropositionTour(tontineId: string, dateDebut: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['proposition-tour', tontineId, dateDebut ?? 'defaut'],
    queryFn: () => cycleService.getProposition(tontineId, dateDebut),
    enabled: enabled && !!tontineId,
    staleTime: 0,
    retry: false,
  })
}

export function useOpenCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tontineId, request }: { tontineId: string; request: OpenCycleRequest }) =>
      cycleService.openCycle(tontineId, request),
    onSuccess: (_, { tontineId }) => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['cycles', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cycle', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['recapCycle', tontineId] })
    },
  })
}

export function useCloturerCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tontineId, cycleId, modeRemise }: { tontineId: string; cycleId: string; modeRemise?: ModeRemise }) =>
      cycleService.cloturerCycle(tontineId, cycleId, modeRemise),
    onSuccess: (_, { tontineId }) => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['remise-apercu', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cycles', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cycle', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['recapCycle', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['tontine', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['beneficiaires-historique', tontineId] })
    },
  })
}

export function useDesignerGagnants() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      tontineId,
      cycleId,
      request,
    }: {
      tontineId: string
      cycleId: string
      request: DesignerGagnantsRequest
    }) => cycleService.designerGagnants(tontineId, cycleId, request),
    onSuccess: (_, { tontineId }) => {
      queryClient.invalidateQueries({ queryKey: ['cycles', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cycle', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['recapCycle', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['membres', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['beneficiaires-historique', tontineId] })
    },
  })
}
