/**
 * Sécurité du compte : mot de passe (B21) et appareils connectés (B20, B53).
 * B53 : une session par appareil (`appareilId`) ; un appareil « de confiance » garde le PIN pendant des mois.
 */
import api from './api'
import type { CustomResponse } from '@/types/common'

export interface SessionAppareil {
  id: string
  clientType: 'WEB' | 'MOBILE'
  deviceInfo: string | null
  derniereActivite: string | null
  expireLe: string | null
  expiree: boolean
  /** true pour l'appareil utilisé en ce moment */
  courante: boolean
  /** B53 : appareil de confiance (le PIN suffit sans mot de passe pendant des mois) */
  confiance: boolean
  /** B53 : dernière utilisation (connexion, PIN ou renouvellement) */
  derniereUtilisation: string | null
  /** B53 : identifiant de l'appareil, absent pour une session d'avant B53 */
  appareilId: string | null
}

export const securiteService = {
  async changerMotDePasse(ancienMotDePasse: string, nouveauMotDePasse: string, deconnecterAutresAppareils: boolean): Promise<void> {
    await api.post('/v1/me/password', { ancienMotDePasse, nouveauMotDePasse, deconnecterAutresAppareils })
  },

  async listSessions(): Promise<SessionAppareil[]> {
    const { data } = await api.get<CustomResponse<Partial<SessionAppareil>[]>>('/v1/me/sessions')
    return (data.data ?? []).map((s) => ({
      id: s.id ?? '',
      clientType: s.clientType ?? 'WEB',
      deviceInfo: s.deviceInfo ?? null,
      derniereActivite: s.derniereActivite ?? null,
      expireLe: s.expireLe ?? null,
      expiree: !!s.expiree,
      courante: !!s.courante,
      confiance: !!s.confiance,
      derniereUtilisation: s.derniereUtilisation ?? null,
      appareilId: s.appareilId ?? null,
    }))
  },

  async revoquerSession(id: string): Promise<void> {
    await api.delete(`/v1/me/sessions/${id}`)
  },
}
