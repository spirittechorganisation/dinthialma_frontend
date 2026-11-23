/**
 * Retraits anticipés d'une épargne (B42, lot 1) et répartition finale (B51).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { retraitService } from '@/services/retraitService'
import { distributionNonFaite } from '@/lib/retraits'
import type { RegleRetrait, SaisirRetraitRequest } from '@/types/retrait'

export function useRetraits(tontineId: string, membreId?: string, enabled = true) {
  return useQuery({
    queryKey: ['retraits', tontineId, membreId ?? 'tous'],
    queryFn: () => retraitService.lister(tontineId, { membreId }),
    enabled: enabled && !!tontineId,
  })
}

export function useSoldeMembre(tontineId: string, membreId: string, enabled = true) {
  return useQuery({
    queryKey: ['solde', tontineId, membreId],
    queryFn: () => retraitService.solde(tontineId, membreId),
    enabled: enabled && !!tontineId && !!membreId,
  })
}

/**
 * Répartition finale. Pas encore faite (404 DISTRIBUTION_NON_FAITE) : `data` vaut null, sans erreur
 * ni nouvel essai, pour que l'écran n'affiche simplement rien.
 */
export function useDistribution(tontineId: string, enabled = true) {
  return useQuery({
    queryKey: ['distribution', tontineId],
    queryFn: async () => {
      try {
        return await retraitService.distribution(tontineId)
      } catch (err) {
        if (distributionNonFaite(err)) return null
        throw err
      }
    },
    enabled: enabled && !!tontineId,
  })
}

/** Après un retrait (saisi ou annulé) : solde, retraits, membres (soldeLe), récapitulatifs, résumés */
function invaliderRetraits(queryClient: ReturnType<typeof useQueryClient>, tontineId: string) {
  for (const key of ['retraits', 'solde', 'membres', 'recapTotal', 'recapCycle', 'distribution']) {
    queryClient.invalidateQueries({ queryKey: [key, tontineId] })
  }
  queryClient.invalidateQueries({ queryKey: ['me'] })
}

export function useSaisirRetrait() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tontineId, request }: { tontineId: string; request: SaisirRetraitRequest }) =>
      retraitService.saisir(tontineId, request),
    onSuccess: (_, { tontineId }) => invaliderRetraits(queryClient, tontineId),
  })
}

export function useAnnulerRetrait() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tontineId, retraitId, motif }: { tontineId: string; retraitId: string; motif: string }) =>
      retraitService.annuler(tontineId, retraitId, motif),
    onSuccess: (_, { tontineId }) => invaliderRetraits(queryClient, tontineId),
  })
}

export function useModifierRegleRetrait() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tontineId, regleRetrait }: { tontineId: string; regleRetrait: RegleRetrait }) =>
      retraitService.modifierRegle(tontineId, regleRetrait),
    onSuccess: (_, { tontineId }) => {
      queryClient.invalidateQueries({ queryKey: ['tontine', tontineId] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}
