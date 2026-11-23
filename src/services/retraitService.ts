/**
 * Retraits anticipés d'une épargne (B42, lot 1) et répartition finale (B51).
 */
import api from './api'
import { CustomResponse, PageResponse, RawPage, toPage } from '@/types/common'
import type { DistributionFinale, RegleRetrait, Retrait, SaisirRetraitRequest, SoldeEpargne, StatutRetrait } from '@/types/retrait'
import type { Tontine } from '@/types/tontine'

export const retraitService = {
  /** Retrait déjà remis au membre (créé REMIS), avec `soldeRestant` */
  saisir: async (tontineId: string, request: SaisirRetraitRequest): Promise<Retrait> => {
    const response = await api.post<CustomResponse<Retrait>>(`/v1/tontines/${tontineId}/retraits/admin`, request)
    return response.data.data
  },

  /** Retraits d'une tontine (le membre ne voit que les siens), du plus récent au plus ancien */
  lister: async (
    tontineId: string,
    filtre: { membreId?: string; statut?: StatutRetrait[] } = {},
    page = 0,
    size = 100,
  ): Promise<PageResponse<Retrait>> => {
    const response = await api.get<CustomResponse<RawPage<Retrait>>>(`/v1/tontines/${tontineId}/retraits`, {
      params: { membreId: filtre.membreId, statut: filtre.statut?.length ? filtre.statut : undefined, page, size },
    })
    return toPage(response.data.data)
  },

  /** Annule un retrait saisi par erreur (motif obligatoire), avec `soldeRestant` */
  annuler: async (tontineId: string, retraitId: string, motif: string): Promise<Retrait> => {
    const response = await api.delete<CustomResponse<Retrait>>(`/v1/tontines/${tontineId}/retraits/${retraitId}`, { data: { motif } })
    return response.data.data
  },

  solde: async (tontineId: string, membreId: string): Promise<SoldeEpargne> => {
    const response = await api.get<CustomResponse<SoldeEpargne>>(`/v1/tontines/${tontineId}/membres/${membreId}/solde`)
    return response.data.data
  },

  /** Répartition finale ; 404 DISTRIBUTION_NON_FAITE tant que rien n'est distribué */
  distribution: async (tontineId: string): Promise<DistributionFinale> => {
    const response = await api.get<CustomResponse<DistributionFinale>>(`/v1/tontines/${tontineId}/distribution`)
    return response.data.data
  },

  /** Retraits avant la fin autorisés ou non (événementielle) */
  modifierRegle: async (tontineId: string, regleRetrait: RegleRetrait): Promise<Tontine> => {
    const response = await api.patch<CustomResponse<Tontine>>(`/v1/tontines/${tontineId}/reglages`, { regleRetrait })
    return response.data.data
  },
}
