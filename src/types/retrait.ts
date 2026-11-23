/**
 * Retraits anticipés d'une épargne (B42, lot 1) et répartition finale relisible (B51).
 * Contrat : api-docs.json (`Saisir`, `RetraitEpargneResponse`, `SoldeEpargneResponse`, `DistributionFinaleResponse`).
 */
import type { MembreStatut } from '@/types/common'

export type NatureRetrait = 'PARTIEL' | 'TOTAL'
export type StatutRetrait = 'DEMANDE' | 'ACCEPTE' | 'REMIS' | 'REFUSE' | 'ANNULE'
/** Règle de retrait d'une épargne (événementielle) ; une rotative est toujours INTERDIT */
export type RegleRetrait = 'LIBRE' | 'INTERDIT'

/** POST /v1/tontines/{id}/retraits/admin : retrait déjà remis, saisi par le gestionnaire */
export interface SaisirRetraitRequest {
  membreId: string
  nature: NatureRetrait
  /** Obligatoire en PARTIEL (≤ solde) ; en TOTAL, absent ou égal au solde */
  montant?: number
  methodePaiement: string
  referenceTransaction?: string
  motif?: string
  /** Date-heure locale de Dakar, sans fuseau (« 2026-11-22T12:00:00 ») ; absente = maintenant */
  dateRemise?: string
}

export interface Retrait {
  id: string
  tontineId: string
  membreId: string
  userId?: string
  firstName: string
  lastName: string
  nature: NatureRetrait
  montant: number
  frais: number
  statut: StatutRetrait
  origine: 'MEMBRE' | 'GESTIONNAIRE'
  methodePaiement: string
  referenceTransaction?: string | null
  motif?: string | null
  dateRemise: string
  motifAnnulation?: string | null
  dateAnnulation?: string | null
  /** Solde du membre après la création ou l'annulation ; absent dans les listes */
  soldeRestant?: number | null
  createdAt: string
}

/** GET /v1/tontines/{id}/membres/{mid}/solde */
export interface SoldeEpargne {
  membreId: string
  totalCotiseValide: number
  totalRetire: number
  solde: number
  /** Date du retrait total : membre soldé ; null sinon */
  soldeLe: string | null
}

/** Ligne de la répartition finale (B51) */
export interface LigneDistribution {
  membreId: string
  userId?: string
  firstName: string
  lastName: string
  phone?: string
  statutMembre?: MembreStatut
  montantCotise: number
  montantCommission: number
  montantRetire: number
  montantNet: number
}

/** GET /v1/tontines/{id}/distribution : le gestionnaire voit toutes les lignes, un membre la sienne */
export interface DistributionFinale {
  tontineId: string
  cycleId: string
  dateDistribution: string
  nombreMembres: number
  totalCotise: number
  totalCommission: number
  totalRetire: number
  totalNet: number
  lignes: LigneDistribution[]
}
