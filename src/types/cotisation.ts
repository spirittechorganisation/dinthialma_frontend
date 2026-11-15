import { CotisationStatut, MembreInfo, ValideurInfo, AccountStatus, MembreStatut } from './common'

// ─── Qui a enregistré la cotisation ──────────────────────────────────────────
export interface EnregistreParInfo {
  id: string
  firstName: string
  lastName: string
  phone: string
}

/** Payée avant l'échéance ou non — distincte du statut (EN_RETARD = non validée à la clôture) */
export type Ponctualite = 'A_TEMPS' | 'EN_RETARD' | 'NON_DECLAREE'

// ─── Réponse cotisation ───────────────────────────────────────────────────────
export interface Cotisation {
  id: string
  tontineId: string
  tontineNom?: string
  cycleId: string
  numeroCycle?: number
  /** Échéance du tour couverte par ce paiement (B32) */
  echeanceId?: string
  numeroEcheance?: number
  echeanceAt?: string
  ponctualite?: Ponctualite
  membre: MembreInfo
  montant: number
  methodePaiement: string
  referenceTransaction?: string
  statut: CotisationStatut
  note?: string
  dateValidation?: string
  validePar?: ValideurInfo
  enregistrePar?: EnregistreParInfo
  /** Statut REFUSE : motif, auteur et date du refus */
  motifRefus?: string
  refusePar?: ValideurInfo
  dateRefus?: string
  createdAt: string
  updatedAt: string
}

// ─── Requête enregistrement cotisation (par le membre) ────────────────────────
export interface RecordCotisationRequest {
  cycleId: string
  /** Facultatif : par défaut l'échéance en cours ; à renseigner pour régulariser une échéance passée */
  echeanceId?: string
  montant: number
  methodePaiement?: string
  referenceTransaction?: string
  note?: string
}

// ─── Requête enregistrement admin d'une cotisation ───────────────────────────
export interface AdminRecordCotisationRequest {
  membreId: string
  cycleId: string
  /** Facultatif : par défaut l'échéance en cours ; à renseigner pour régulariser une échéance passée */
  echeanceId?: string
  montant: number
  methodePaiement?: string
  referenceTransaction?: string
  note?: string
}

// ─── Détail d'une échéance dans le récap d'un tour ───────────────────────────
export interface EcheanceRecap {
  echeanceId: string
  numero: number
  echeanceAt: string
  /** Ouverte au paiement (due à ce jour) */
  ouverte: boolean
  cotisationId?: string | null
  statutCotisation?: CotisationStatut | null
  montant?: number | null
  ponctualite?: Ponctualite
}

// ─── Requête modification cotisation (PATCH — seuls les champs envoyés sont mis à jour) ──
export interface UpdateCotisationRequest {
  montant?: number
  methodePaiement?: string
  referenceTransaction?: string
  note?: string
}

// ─── Récap d'un cycle : une ligne par membre (GET .../cotisations/recap/{cycleId}) ─
export interface CycleRecapLigne {
  membreId: string
  userId: string
  firstName: string
  lastName: string
  phone: string
  accountStatus?: AccountStatus
  statutMembre: MembreStatut
  ordreJackpot: number | null
  /** null = le membre n'a rien soumis pour ce cycle */
  cotisationId: string | null
  montant: number | null
  methodePaiement: string | null
  referenceTransaction?: string | null
  note?: string | null
  statutCotisation: CotisationStatut | null
  dateValidation: string | null
  cotisationCreatedAt?: string | null
  enregistrePar?: EnregistreParInfo | null
  ponctualite?: Ponctualite
  /** Échéance de référence des champs de cotisation ci-dessus (B32) */
  echeanceId?: string
  numeroEcheance?: number
  echeanceAt?: string
  nombreEcheances?: number
  /** Échéances déjà ouvertes au paiement (en cours comprise) */
  echeancesDues?: number
  /** Échéances couvertes par un paiement validé */
  echeancesPayees?: number
  echeances?: EcheanceRecap[]
}

// ─── Total cotisé par membre (GET .../cotisations/recap-total) ─────────────────
export interface MembreTotalCotisation {
  membreId: string
  userId?: string
  firstName: string
  lastName: string
  phone: string
  accountStatus?: AccountStatus
  statutMembre: MembreStatut
  ordreJackpot: number | null
  totalCotise: number
  nombreCotisationsValidees: number
}
