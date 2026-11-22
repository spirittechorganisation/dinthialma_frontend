import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cotisationService } from '@/services/cotisationService'
import { RecordCotisationRequest, AdminRecordCotisationRequest, UpdateCotisationRequest } from '@/types/cotisation'

export function useCotisations(
  tontineId: string,
  cycleId?: string,
  page = 0,
  size = 20,
  membreId?: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['cotisations', tontineId, cycleId, page, size, membreId],
    queryFn: () => cotisationService.listCotisations(tontineId, cycleId, page, size, membreId),
    enabled: !!tontineId && enabled,
  })
}

/**
 * Récap d'un tour. Les membres SORTI qui ont cotisé sont inclus (B48) : leurs paiements comptent
 * dans le collecté et la distribution ; les écrans les grisent (`statutMembre`).
 */
export function useRecapCycle(tontineId: string, cycleId: string, page = 0, size = 20, enabled = true, echeanceId?: string) {
  return useQuery({
    queryKey: ['recapCycle', tontineId, cycleId, page, size, echeanceId ?? 'courante'],
    queryFn: () => cotisationService.getRecapCycle(tontineId, cycleId, page, size, echeanceId, true),
    enabled: enabled && !!tontineId && !!cycleId,
    placeholderData: (prev) => prev,
  })
}

/** Total par membre, membres SORTI qui ont cotisé compris (B48), comme la distribution finale */
export function useRecapTotal(tontineId: string, page = 0, size = 20, enabled = true) {
  return useQuery({
    queryKey: ['recapTotal', tontineId, page, size],
    queryFn: () => cotisationService.getRecapTotal(tontineId, page, size, true),
    enabled: enabled && !!tontineId,
    placeholderData: (prev) => prev,
  })
}

export function useCotisation(tontineId: string, cotisationId: string) {
  return useQuery({
    queryKey: ['cotisation', tontineId, cotisationId],
    queryFn: () => cotisationService.getCotisation(tontineId, cotisationId),
    enabled: !!tontineId && !!cotisationId,
  })
}

export function useRecordCotisation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tontineId, request }: { tontineId: string; request: RecordCotisationRequest }) =>
      cotisationService.recordCotisation(tontineId, request),
    onSuccess: (_, { tontineId }) => {
      queryClient.invalidateQueries({ queryKey: ['cotisations', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cotisation', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['recapCycle', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['recapTotal', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cycle', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cycles', tontineId] })
    },
  })
}

export function useValiderCotisation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tontineId, cotisationId }: { tontineId: string; cotisationId: string }) =>
      cotisationService.validerCotisation(tontineId, cotisationId),
    onSuccess: (_, { tontineId }) => {
      queryClient.invalidateQueries({ queryKey: ['cotisations', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cotisation', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['recapCycle', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['recapTotal', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cycle', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cycles', tontineId] })
    },
  })
}

export function useAdminRecordCotisation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tontineId, request }: { tontineId: string; request: AdminRecordCotisationRequest }) =>
      cotisationService.adminRecordCotisation(tontineId, request),
    onSuccess: (_, { tontineId }) => {
      queryClient.invalidateQueries({ queryKey: ['cotisations', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cotisation', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['recapCycle', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['recapTotal', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cycle', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cycles', tontineId] })
    },
  })
}

export function useUpdateCotisation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      tontineId,
      cotisationId,
      request,
    }: {
      tontineId: string
      cotisationId: string
      request: UpdateCotisationRequest
    }) => cotisationService.updateCotisation(tontineId, cotisationId, request),
    onSuccess: (_, { tontineId }) => {
      queryClient.invalidateQueries({ queryKey: ['cotisations', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cotisation', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['recapCycle', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['recapTotal', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cycle', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['cycles', tontineId] })
    },
  })
}
