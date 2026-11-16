/**
 * Hooks React Query pour les priorités de jackpot.
 *
 * Invalidation : toute mutation invalide ['priorites', tontineId] + ['tontine', tontineId]
 * + ['me'] (le compteur `prioritesEnAttente` de l'accueil gestionnaire).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { prioriteService } from '@/services/prioriteService'
import type { StatutPriorite, DemanderPrioriteRequest, AttribuerPrioriteRequest } from '@/types/priorite'

function invalider(queryClient: ReturnType<typeof useQueryClient>, tontineId: string) {
  queryClient.invalidateQueries({ queryKey: ['priorites', tontineId] })
  queryClient.invalidateQueries({ queryKey: ['tontine', tontineId] })
  queryClient.invalidateQueries({ queryKey: ['me'] })
}

/** Liste des priorités d'une tontine (gestionnaire : toutes ; membre : les siennes). */
export function usePriorites(tontineId: string, statut?: StatutPriorite | StatutPriorite[]) {
  return useQuery({
    queryKey: ['priorites', tontineId, statut ?? 'toutes'],
    queryFn: () => prioriteService.list(tontineId, statut),
    enabled: !!tontineId,
  })
}

/** Membre : demande la priorité. */
export function useDemanderPriorite(tontineId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: DemanderPrioriteRequest) => prioriteService.demander(tontineId, request),
    onSuccess: () => invalider(queryClient, tontineId),
  })
}

/** Gestionnaire : attribue directement la priorité à un membre. */
export function useAttribuerPriorite(tontineId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: AttribuerPrioriteRequest) => prioriteService.attribuer(tontineId, request),
    onSuccess: () => invalider(queryClient, tontineId),
  })
}

/** Gestionnaire : accepte une demande. */
export function useAccepterPriorite(tontineId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (prioriteId: string) => prioriteService.accepter(tontineId, prioriteId),
    onSuccess: () => invalider(queryClient, tontineId),
  })
}

/** Gestionnaire : refuse une demande. */
export function useRefuserPriorite(tontineId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ prioriteId, motif }: { prioriteId: string; motif?: string }) =>
      prioriteService.refuser(tontineId, prioriteId, motif),
    onSuccess: () => invalider(queryClient, tontineId),
  })
}

/** Membre : annule sa propre demande. */
export function useAnnulerPriorite(tontineId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (prioriteId: string) => prioriteService.annuler(tontineId, prioriteId),
    onSuccess: () => invalider(queryClient, tontineId),
  })
}
