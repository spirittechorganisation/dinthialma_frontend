import api from './api'
import { Cotisation, RecordCotisationRequest, AdminRecordCotisationRequest, UpdateCotisationRequest, CycleRecapLigne, MembreTotalCotisation } from '@/types/cotisation'
import { PageResponse, CustomResponse, RawPage, toPage } from '@/types/common'

export const cotisationService = {
  // ─── Lister les cotisations d'une tontine ────────────────────────────────────
  // SUPER_ADMIN et créateur voient tout, MEMBER voit les siennes uniquement
  listCotisations: async (
    tontineId: string,
    cycleId?: string,
    page = 0,
    size = 20,
    membreId?: string,
    filtres: { statut?: string[]; q?: string } = {}
  ): Promise<PageResponse<Cotisation>> => {
    const response = await api.get<CustomResponse<RawPage<Cotisation>>>(
      `/v1/tontines/${tontineId}/cotisations`,
      {
        params: {
          page, size, sort: 'createdAt,desc',
          ...(cycleId ? { cycleId } : {}),
          ...(membreId ? { membreId } : {}),
          ...(filtres.statut?.length ? { statut: filtres.statut } : {}),
          ...(filtres.q ? { q: filtres.q } : {}),
        },
      }
    )
    return toPage(response.data.data)
  },

  // ─── Récap d'un cycle (paginé) ────────────────────────────────────────────────
  // Accès : créateur de la tontine + SUPER_ADMIN. Tri backend : ordreJackpot ASC, createdAt ASC
  // echeanceId (B32) : échéance de référence des champs de cotisation ; absente = échéance en cours
  // inclureSortis (B48) : ajoute les membres SORTI qui ont une cotisation sur ce cycle (ligne `statutMembre`)
  getRecapCycle: async (
    tontineId: string, cycleId: string, page = 0, size = 20, echeanceId?: string, inclureSortis = false,
  ): Promise<PageResponse<CycleRecapLigne>> => {
    const response = await api.get<CustomResponse<RawPage<CycleRecapLigne>>>(
      `/v1/tontines/${tontineId}/cotisations/recap/${cycleId}`,
      { params: { page, size, ...(echeanceId ? { echeanceId } : {}), ...(inclureSortis ? { inclureSortis: true } : {}) } }
    )
    return toPage(response.data.data)
  },

  // ─── Total cotisé par membre (paginé) ─────────────────────────────────────────
  // inclureSortis (B48) : ajoute les membres SORTI qui ont au moins une cotisation validée,
  // comme la distribution finale (B43)
  getRecapTotal: async (tontineId: string, page = 0, size = 20, inclureSortis = false): Promise<PageResponse<MembreTotalCotisation>> => {
    const response = await api.get<CustomResponse<RawPage<MembreTotalCotisation>>>(
      `/v1/tontines/${tontineId}/cotisations/recap-total`,
      { params: { page, size, ...(inclureSortis ? { inclureSortis: true } : {}) } }
    )
    return toPage(response.data.data)
  },

  // ─── Récupérer une cotisation ─────────────────────────────────────────────────
  getCotisation: async (tontineId: string, cotisationId: string): Promise<Cotisation> => {
    const response = await api.get<CustomResponse<Cotisation>>(
      `/v1/tontines/${tontineId}/cotisations/${cotisationId}`
    )
    return response.data.data
  },

  // ─── Enregistrer une cotisation (par le membre) ───────────────────────────────
  recordCotisation: async (tontineId: string, request: RecordCotisationRequest): Promise<Cotisation> => {
    const response = await api.post<CustomResponse<Cotisation>>(
      `/v1/tontines/${tontineId}/cotisations`,
      request
    )
    return response.data.data
  },

  // ─── Valider une cotisation (par l'admin) ─────────────────────────────────────
  validerCotisation: async (tontineId: string, cotisationId: string): Promise<Cotisation> => {
    const response = await api.put<CustomResponse<Cotisation>>(
      `/v1/tontines/${tontineId}/cotisations/${cotisationId}/valider`
    )
    return response.data.data
  },

  // ─── Enregistrement admin d'une cotisation (directement VALIDÉE) ──────────────
  adminRecordCotisation: async (tontineId: string, request: AdminRecordCotisationRequest): Promise<Cotisation> => {
    const response = await api.post<CustomResponse<Cotisation>>(
      `/v1/tontines/${tontineId}/cotisations/admin`,
      request
    )
    return response.data.data
  },

  // ─── Modifier une cotisation (PATCH — seuls les champs fournis sont mis à jour) ──
  updateCotisation: async (
    tontineId: string,
    cotisationId: string,
    request: UpdateCotisationRequest
  ): Promise<Cotisation> => {
    const response = await api.patch<CustomResponse<Cotisation>>(
      `/v1/tontines/${tontineId}/cotisations/${cotisationId}`,
      request
    )
    return response.data.data
  },

}
