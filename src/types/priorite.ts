/**
 * Priorités de jackpot (api-docs.json §Priorités de jackpot).
 *
 * Un membre peut demander à recevoir le prochain jackpot avant son tour habituel.
 * Le gestionnaire peut accepter, refuser ou attribuer directement.
 * Une fois servie (cycle clôturé avec ce membre en bénéficiaire), le statut passe à SERVIE.
 */

export type StatutPriorite = 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE' | 'ANNULEE' | 'SERVIE'
export type OriginePriorite = 'DEMANDE_MEMBRE' | 'GESTIONNAIRE'

export interface PrioriteJackpot {
  id: string
  tontineId: string
  membreId: string
  userId: string
  firstName: string
  lastName: string
  statut: StatutPriorite
  origine: OriginePriorite
  motif: string | null
  motifRefus: string | null
  /** Cycle pour lequel la priorité a été accordée / servie */
  cycleId: string | null
  createdAt: string
  dateTraitement: string | null
}

export interface DemanderPrioriteRequest {
  motif?: string
}

export interface AttribuerPrioriteRequest {
  membreId: string
  motif?: string
}
