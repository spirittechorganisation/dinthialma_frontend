import api from './api'
import {
  Tontine, CreateTontineRequest, UpdateTontineRequest, Commission, CreateCommissionRequest, UpdateCommissionRequest,
  ModifierEcheanceRequest, ModeRemise, SimulationParams, SimulationCalendrier,
} from '@/types/tontine'
import { PageResponse, CustomResponse, RawPage, toPage } from '@/types/common'

export const tontineService = {
  // ─── Lister les tontines (SUPER_ADMIN = toutes, autres = les siennes) ────────
  listTontines: async (
    page = 0,
    size = 20,
    sort = 'createdAt,desc',
    filtres: { role?: 'GERE' | 'COTISE'; statut?: string; q?: string } = {},
  ): Promise<PageResponse<Tontine>> => {
    const response = await api.get<CustomResponse<RawPage<Tontine>>>('/v1/tontines', {
      params: { page, size, sort, ...filtres },
    })
    return toPage(response.data.data)
  },

  // ─── Récupérer une tontine par ID ────────────────────────────────────────────
  getTontine: async (id: string): Promise<Tontine> => {
    const response = await api.get<CustomResponse<Tontine>>(`/v1/tontines/${id}`)
    return response.data.data
  },

  // ─── Créer une tontine ───────────────────────────────────────────────────────
  createTontine: async (request: CreateTontineRequest): Promise<Tontine> => {
    const response = await api.post<CustomResponse<Tontine>>('/v1/tontines', request)
    return response.data.data
  },

  // ─── Mettre à jour une tontine (BROUILLON uniquement) ────────────────────────
  updateTontine: async (id: string, request: UpdateTontineRequest): Promise<Tontine> => {
    const response = await api.put<CustomResponse<Tontine>>(`/v1/tontines/${id}`, request)
    return response.data.data
  },

  // ─── Supprimer une tontine (soft delete, BROUILLON uniquement) ───────────────
  deleteTontine: async (id: string): Promise<void> => {
    await api.delete(`/v1/tontines/${id}`)
  },

  // ─── Activer une tontine (BROUILLON ou SUSPENDUE → ACTIVE) ───────────────────
  activerTontine: async (id: string): Promise<Tontine> => {
    const response = await api.put<CustomResponse<Tontine>>(`/v1/tontines/${id}/activer`)
    return response.data.data
  },

  // ─── Suspendre une tontine (ACTIVE → SUSPENDUE) ──────────────────────────────
  suspendreTontine: async (id: string): Promise<Tontine> => {
    const response = await api.put<CustomResponse<Tontine>>(`/v1/tontines/${id}/suspendre`)
    return response.data.data
  },

  // ─── Échéance et rappels, modifiables en cours de tontine (B26) ─────────────
  // S'applique aux tours pas encore commencés ; les membres actifs sont prévenus.
  modifierEcheance: async (id: string, request: ModifierEcheanceRequest): Promise<Tontine> => {
    const response = await api.patch<CustomResponse<Tontine>>(`/v1/tontines/${id}/echeance`, request)
    return response.data.data
  },

  // ─── Option de remise du jackpot par défaut (B33, rotative) ─────────────────
  modifierReglages: async (id: string, request: { modeRemise?: ModeRemise }): Promise<Tontine> => {
    const response = await api.patch<CustomResponse<Tontine>>(`/v1/tontines/${id}/reglages`, request)
    return response.data.data
  },

  // ─── Calendrier simulé par le backend, sans effet en base (B26 / B32) ───────
  // Mêmes règles que l'activation : le front n'a pas à recalculer les dates.
  simuler: async (params: SimulationParams, signal?: AbortSignal): Promise<SimulationCalendrier> => {
    const response = await api.get<CustomResponse<SimulationCalendrier>>('/v1/tontines/simulation', { params, signal })
    const d = response.data.data
    return { ...d, echeances: d?.echeances ?? [], tours: d?.tours ?? [] }
  },

  // ─── Commissions ─────────────────────────────────────────────────────────────

  listCommissions: async (tontineId: string, page = 0, size = 20): Promise<PageResponse<Commission>> => {
    const response = await api.get<CustomResponse<RawPage<Commission>>>(
      `/v1/tontines/${tontineId}/commissions`,
      { params: { page, size } }
    )
    return toPage(response.data.data)
  },

  createCommission: async (tontineId: string, request: CreateCommissionRequest): Promise<Commission> => {
    const response = await api.post<CustomResponse<Commission>>(
      `/v1/tontines/${tontineId}/commissions`,
      request
    )
    return response.data.data
  },

  updateCommission: async (
    tontineId: string,
    commissionId: string,
    request: UpdateCommissionRequest
  ): Promise<Commission> => {
    const response = await api.put<CustomResponse<Commission>>(
      `/v1/tontines/${tontineId}/commissions/${commissionId}`,
      request
    )
    return response.data.data
  },

  deleteCommission: async (tontineId: string, commissionId: string): Promise<void> => {
    await api.delete(`/v1/tontines/${tontineId}/commissions/${commissionId}`)
  },
}
