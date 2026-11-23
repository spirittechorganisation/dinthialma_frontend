import { TontineStatut, ModeCycle, CreateurInfo } from './common'

// ─── Type de tontine ──────────────────────────────────────────────────────────
export enum TontineType {
  ROTATIVE       = 'ROTATIVE',
  EVENEMENTIELLE = 'EVENEMENTIELLE',
}

// ─── Rythme, échéance et remise (B26, B32, B33) ───────────────────────────────
export type RythmeUnite = 'JOUR' | 'SEMAINE' | 'MOIS'
/** FIN_DU_TOUR : à la dernière échéance du tour ; TOUS_PAYES : dès que tout le monde a payé */
export type DeclenchementJackpot = 'FIN_DU_TOUR' | 'TOUS_PAYES'
/** Que faire quand il manque de l'argent au moment de remettre le jackpot */
export type ModeRemise = 'ATTENDRE' | 'DISPONIBLE' | 'AVANCE_COMMISSION' | 'AVANCE_GESTIONNAIRE' | 'CAISSE'

export interface RappelsEcheance {
  /** Rappel la veille à 18h00 */
  veille?: boolean
  /** Rappel N heures avant l'échéance (0 = aucun, 1 à 24) */
  heuresAvant?: number
}

/** Champs de rythme communs aux tontines, résumés et invitations */
export interface RythmeTontine {
  /** « Tous les N … » */
  rythmeIntervalle?: number | null
  rythmeUnite?: RythmeUnite | null
  /** SEMAINE : LUNDI…DIMANCHE ; MOIS : "1"…"31" ou "DERNIER" ; absent = aucun jour imposé */
  jourEcheance?: string | null
  /** HH:mm, heure de Dakar (défaut 23:59) */
  heureEcheance?: string | null
  /** Rotative : nombre de cotisations par tour (défaut 1) */
  cotisationsParTour?: number | null
  declenchementJackpot?: DeclenchementJackpot | null
}

// ─── Réponse tontine ──────────────────────────────────────────────────────────
export interface Tontine extends RythmeTontine {
  id: string
  tontineType: TontineType
  nom: string
  description?: string
  montant: number
  /** Code historique ; « PERSONNALISEE » quand le rythme n'a pas de code (voir rythmeIntervalle / rythmeUnite) */
  frequence: string
  rappels?: RappelsEcheance | null
  /** Rotative : option de remise par défaut */
  modeRemise?: ModeRemise | null
  /** Retraits avant la fin (B42) : LIBRE ou INTERDIT ; une rotative est toujours INTERDIT */
  regleRetrait?: 'LIBRE' | 'INTERDIT' | null
  /** null pour EVENEMENTIELLE */
  ordreBeneficiaire?: string | null
  /** null pour EVENEMENTIELLE */
  modeCycle?: ModeCycle | null
  dateDebut: string
  nombreMembres: number
  nombreMembresActuels: number
  /** Nombre de gagnants par cycle — 1 = comportement classique */
  nombreGagnants: number
  statut: TontineStatut
  // ── Champs EVENEMENTIELLE ───────────────────────────────────────────────────
  dateEcheance?: string | null
  nomEvenement?: string | null
  montantLibre?: boolean | null
  montantMinimum?: number | null
  creePar: CreateurInfo
  /** B01 — mon rôle dans cette tontine (fourni par le backend sur chaque TontineResponse) */
  monRole?: 'GESTIONNAIRE' | 'MEMBRE' | 'GESTIONNAIRE_ET_MEMBRE' | 'LECTURE'
  /** Absent si je ne cotise pas dans cette tontine */
  monMembreId?: string
  monStatutMembre?: 'ACTIF' | 'SUSPENDU' | 'SORTI'
  createdAt: string
  updatedAt: string
}

// ─── Requête création ─────────────────────────────────────────────────────────
export interface CreateTontineRequest {
  tontineType: TontineType
  nom: string
  description?: string
  /** Code historique, facultatif : rythmeIntervalle + rythmeUnite priment */
  frequence?: string
  rythmeIntervalle?: number
  rythmeUnite?: RythmeUnite
  jourEcheance?: string
  heureEcheance?: string
  rappels?: RappelsEcheance
  dateDebut: string
  // ROTATIVE uniquement
  montant?: number
  cotisationsParTour?: number
  declenchementJackpot?: DeclenchementJackpot
  modeRemise?: ModeRemise
  /** B30 : commissions enregistrées avec la tontine (tout ou rien) */
  commissions?: CreateCommissionRequest[]
  ordreBeneficiaire?: string
  modeCycle?: ModeCycle
  nombreMembres?: number
  nombreGagnants?: number
  // EVENEMENTIELLE uniquement
  dateEcheance?: string
  nomEvenement?: string
  montantLibre?: boolean
  montantMinimum?: number
}

// ─── Requête mise à jour ──────────────────────────────────────────────────────
export interface UpdateTontineRequest {
  nom?: string
  description?: string
  montant?: number
  frequence?: string
  /** Rythme : modifiable en BROUILLON seulement */
  rythmeIntervalle?: number
  rythmeUnite?: RythmeUnite
  /** "" = aucun jour imposé */
  jourEcheance?: string
  heureEcheance?: string
  rappels?: RappelsEcheance
  cotisationsParTour?: number
  declenchementJackpot?: DeclenchementJackpot
  modeRemise?: ModeRemise
  ordreBeneficiaire?: string
  dateDebut?: string
  nombreMembres?: number
  nombreGagnants?: number
  // EVENEMENTIELLE (présents dans UpdateTontineRequest de api-docs.json)
  dateEcheance?: string
  nomEvenement?: string
  montantLibre?: boolean
  montantMinimum?: number
}

// ─── Commission ───────────────────────────────────────────────────────────────
export interface Commission {
  id: string
  tontineId: string
  type: 'POURCENTAGE_JACKPOT' | 'FRAIS_FIXES_PAR_CYCLE' | 'FRAIS_ADHESION'
  valeur: number
  description?: string
  createdAt: string
  updatedAt: string
}

export interface CreateCommissionRequest {
  type: 'POURCENTAGE_JACKPOT' | 'FRAIS_FIXES_PAR_CYCLE' | 'FRAIS_ADHESION'
  valeur: number
  description?: string
}

export interface UpdateCommissionRequest {
  valeur?: number
  description?: string
}

// ─── Échéance et rappels, modifiables en cours de tontine (PATCH /tontines/{id}/echeance) ─
export interface ModifierEcheanceRequest {
  /** "" = aucun jour imposé ; absent = inchangé */
  jourEcheance?: string
  heureEcheance?: string
  rappels?: RappelsEcheance
}

// ─── Simulation du calendrier (GET /tontines/simulation) ─────────────────────
export interface SimulationParams {
  rythmeIntervalle: number
  rythmeUnite: RythmeUnite
  jourEcheance?: string
  heureEcheance?: string
  dateDebut: string
  tontineType: TontineType
  nombreMembres?: number
  nombreGagnants?: number
  cotisationsParTour?: number
  montant?: number
  dateEcheance?: string
}

export interface TourSimule {
  numero: number
  dateDebut: string
  dateFin: string
  echeances: string[]
}

export interface SimulationCalendrier {
  nombreTours: number
  cotisationsParTour: number
  /** Brut, par gagnant ; absent sans montant */
  jackpotParTour?: number
  premiereEcheance?: string
  derniereEcheance?: string
  /** « tous les 3 jours, avant 23h59 » */
  rythme?: string
  echeances: string[]
  tours: TourSimule[]
}

// ─── Clôture de tontine (PUT /v1/tontines/{id}/cloturer) ─────────────────────

export interface CloturerTontineRequest {
  /** true = confirmer la clôture malgré les points en suspens (après 409 TONTINE_CLOTURE_A_CONFIRMER) */
  forcer?: boolean
}

/** Détail d'un tour en suspens lors d'une tentative de clôture */
export interface ClotureEnSuspensTour {
  cycleId: string
  numeroCycle: number
  beneficiairePrenom?: string
  beneficiaireNom?: string
  montantJackpot?: number
}

export interface ClotureEnSuspensRetard {
  membreId: string
  prenom: string
  nom: string
  montantDu: number
}

/** Réponse 409 TONTINE_CLOTURE_A_CONFIRMER */
export interface ClotureEnSuspensResponse {
  /** Tours dont le jackpot n'a pas encore été remis au bénéficiaire */
  toursNonRemis: ClotureEnSuspensTour[]
  /** Tours sans gagnant désigné (ROTATIVE MANUEL) */
  toursSansGagnant: ClotureEnSuspensTour[]
  /** Membres avec cotisations EN_RETARD */
  retards: ClotureEnSuspensRetard[]
  /** Montants partiels à remettre au bénéficiaire (cotisations reçues après la clôture du tour) */
  complements: ClotureEnSuspensTour[]
  /** Nombre de paiements encore EN_ATTENTE de validation */
  cotisationsAValider: number
}
