import { CycleStatut } from './common'
import type { ModeRemise } from './tontine'

// ─── Gagnant jackpot (multi-gagnants) ────────────────────────────────────────
export interface GagnantInfo {
  membreId: string
  userId: string
  firstName: string
  lastName: string
  phone: string
  /** null en mode MANUEL sans ordre défini */
  ordreJackpot: number | null
  /** montantNet / nombreGagnants — null si non encore calculé */
  montantRecu: number | null
  /** null si cycle clôturé avant la feature */
  dateJackpot: string | null
}

// ─── Distribution individuelle à la clôture finale EVENEMENTIELLE ────────────
export interface MembreDistributionInfo {
  membreId: string
  userId: string
  firstName: string
  lastName: string
  phone: string
  montantCotise: number
  montantCommission: number
  montantNet: number
}

// ─── Échéance de cotisation d'un tour (B32) ──────────────────────────────────
export interface Echeance {
  id: string
  /** Rang dans le tour (1 à N) */
  numero: number
  dateDebut: string
  /** Limite de paiement, avec fuseau */
  echeanceAt: string
  statut: 'A_VENIR' | 'EN_COURS' | 'ECHUE'
}

// ─── Réponse cycle ────────────────────────────────────────────────────────────
export interface Cycle {
  id: string
  tontineId: string
  numeroCycle: number
  dateDebut: string
  dateFin: string
  /** Limite de paiement du tour (fin + heure d'échéance) */
  echeanceAt?: string
  nombreEcheances?: number
  echeances?: Echeance[]
  /** Échéance ouverte en ce moment (absente si aucune) */
  echeanceEnCours?: Echeance
  /** Jackpot brut prévu, tous gagnants confondus ; absent si montant libre sans plancher */
  montantJackpotPrevu?: number
  /** Tour en cours dont chaque membre actif a payé chaque échéance : le jackpot peut être remis */
  tousPayes?: boolean
  /** Option de remise retenue à la clôture */
  modeRemise?: ModeRemise
  /** Complément encore dû aux gagnants quand les retards seront payés (suivi) */
  resteARecevoir?: number
  /** Avance de poche du gestionnaire encore à récupérer (suivi) */
  montantAvance?: number
  montantJackpot?: number
  montantCommission?: number
  montantNet?: number
  statut: CycleStatut
  dateRemise?: string
  /** Remplace l'ancien champ beneficiaire — liste des gagnants */
  gagnants?: GagnantInfo[]
  /** Distribution individuelle — EVENEMENTIELLE clôture finale uniquement, null sinon */
  distributionParMembre?: MembreDistributionInfo[] | null
  createdAt: string
  updatedAt: string
}

// ─── Requête ouverture manuelle ───────────────────────────────────────────────
// beneficiaireId supprimé (point 6 du prompt)
export interface OpenCycleRequest {
  dateDebut: string
  /** Facultative : absente, elle est calculée selon le rythme de la tontine */
  dateFin?: string
}

// ─── Proposition du prochain tour, mode manuel (GET …/cycles/proposition) ────
export interface PropositionTour {
  dateDebut: string
  dateFin: string
  echeances?: string[]
}

// ─── Remise du jackpot (B33) ─────────────────────────────────────────────────
export interface OptionRemise {
  modeRemise: ModeRemise
  /** false : option inapplicable à ce tour */
  possible: boolean
  /** Total remis aux gagnants du tour */
  montantNet?: number
  /** Part d'un gagnant */
  montantBeneficiaire?: number
  commission?: number
  /** Avance de poche du gestionnaire, au-delà de sa commission */
  avanceGestionnaire?: number
  /** Complément dû aux gagnants quand les retards seront payés */
  resteARecevoir?: number
  /** Ce que les régularisations rendront au gestionnaire */
  montantARecuperer?: number
}

export interface Retardataire {
  membreId: string
  firstName: string
  lastName: string
  echeancesManquees: number
  montant: number
}

export interface RemiseApercu {
  cycleId: string
  numeroCycle: number
  jackpotPrevu: number
  collecte: number
  manquant: number
  modeRemiseParDefaut: ModeRemise
  retardataires: Retardataire[]
  options: OptionRemise[]
}

// ─── Requête désignation gagnants (MANUEL uniquement) ────────────────────────
export interface DesignerGagnantsRequest {
  /** null/[] = sélection aléatoire par le backend */
  membreIds?: string[]
}
