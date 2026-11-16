/**
 * Priorités de jackpot (api-docs.json §Priorités de jackpot).
 *
 * Endpoints :
 *   GET    /v1/tontines/{id}/priorites?statut=&page=&size=
 *   POST   /v1/tontines/{id}/priorites               ← membre demande
 *   POST   /v1/tontines/{id}/priorites/attribuer     ← gestionnaire attribue directement
 *   PUT    /v1/tontines/{id}/priorites/{pid}/accepter ← gestionnaire accepte la demande
 *   PUT    /v1/tontines/{id}/priorites/{pid}/refuser  ← gestionnaire refuse la demande
 *   DELETE /v1/tontines/{id}/priorites/{pid}          ← membre annule sa propre demande
 */
import api from './api'
import { toPage, type CustomResponse, type PageResponse, type RawPage } from '@/types/common'
import type {
  PrioriteJackpot, StatutPriorite, DemanderPrioriteRequest, AttribuerPrioriteRequest,
} from '@/types/priorite'

export const prioriteService = {
  /** Liste des priorités d'une tontine (gestionnaire : toutes ; membre : les siennes). */
  async list(
    tontineId: string,
    statut?: StatutPriorite | StatutPriorite[],
    page = 0,
    size = 50,
  ): Promise<PageResponse<PrioriteJackpot>> {
    const { data } = await api.get<CustomResponse<RawPage<PrioriteJackpot>>>(
      `/v1/tontines/${tontineId}/priorites`,
      { params: { page, size, ...(statut ? { statut } : {}) } },
    )
    return toPage(data.data)
  },

  /** Membre : demande la priorité sur le prochain jackpot. */
  async demander(tontineId: string, request: DemanderPrioriteRequest = {}): Promise<PrioriteJackpot> {
    const { data } = await api.post<CustomResponse<PrioriteJackpot>>(
      `/v1/tontines/${tontineId}/priorites`,
      request,
    )
    return data.data
  },

  /** Gestionnaire : attribue directement la priorité à un membre (sans demande préalable). */
  async attribuer(tontineId: string, request: AttribuerPrioriteRequest): Promise<PrioriteJackpot> {
    const { data } = await api.post<CustomResponse<PrioriteJackpot>>(
      `/v1/tontines/${tontineId}/priorites/attribuer`,
      request,
    )
    return data.data
  },

  /** Gestionnaire : accepte une demande EN_ATTENTE → ACCEPTEE. */
  async accepter(tontineId: string, prioriteId: string): Promise<PrioriteJackpot> {
    const { data } = await api.put<CustomResponse<PrioriteJackpot>>(
      `/v1/tontines/${tontineId}/priorites/${prioriteId}/accepter`,
    )
    return data.data
  },

  /** Gestionnaire : refuse une demande EN_ATTENTE → REFUSEE, motif optionnel. */
  async refuser(tontineId: string, prioriteId: string, motif?: string): Promise<PrioriteJackpot> {
    const { data } = await api.put<CustomResponse<PrioriteJackpot>>(
      `/v1/tontines/${tontineId}/priorites/${prioriteId}/refuser`,
      motif ? { motif } : {},
    )
    return data.data
  },

  /** Membre : annule sa propre demande EN_ATTENTE → ANNULEE. */
  async annuler(tontineId: string, prioriteId: string): Promise<void> {
    await api.delete(`/v1/tontines/${tontineId}/priorites/${prioriteId}`)
  },
}
