/**
 * Saisie en série dans Encaisser (FR24) : le gestionnaire enregistre une vingtaine de paiements en espèces
 * à la suite, sans quitter la liste « De qui ? ».
 */
import { CotisationStatut } from '@/types/common'
import type { CycleRecapLigne } from '@/types/cotisation'
import { estSolde } from '@/lib/retraits'

/** Ligne de « De qui ? » : récapitulatif de la période + date du retrait total (FR29, membre soldé) */
export type LigneEncaisser = CycleRecapLigne & { soldeLe?: string | null }

/** Dernier moyen utilisé par le gestionnaire pour encaisser (distinct de celui du membre qui paie) */
export const METHODE_ENCAISSEMENT_KEY = 'dinthialma_derniere_methode_encaissement'

/** Le membre a payé cette cotisation (validé, ou en attente de validation) */
export function aPaye(l: Pick<CycleRecapLigne, 'statutCotisation'>): boolean {
  return l.statutCotisation === CotisationStatut.VALIDE || l.statutCotisation === CotisationStatut.EN_ATTENTE
}

/**
 * Montant proposé à l'ouverture du formulaire : le minimum en montant libre (0 s'il n'y en a pas),
 * le montant prévu sinon. En montant libre, le backend recopie le minimum dans `montant` : ne pas s'y fier.
 */
export function montantPrerempli(t: { montantLibre?: boolean | null; montant?: number | null; montantMinimum?: number | null }): number {
  if (t.montantLibre) return t.montantMinimum ?? 0
  return t.montant ?? 0
}

/** Encaissement enregistré pendant la séance, en attendant que le récapitulatif soit relu */
export interface EncaissementRecent {
  cotisationId: string
  montant: number
}

/**
 * Lignes du récapitulatif avec les encaissements de la séance : un membre qu'on vient d'encaisser passe
 * tout de suite dans « Déjà payé », même si le récapitulatif relu n'est pas encore arrivé
 * (évite de l'encaisser deux fois). Le récapitulatif relu fait foi dès qu'il indique un paiement.
 */
export function avecEncaissementsRecents(lignes: CycleRecapLigne[], recents: Record<string, EncaissementRecent>): CycleRecapLigne[] {
  return lignes.map((l) => {
    const r = recents[l.membreId]
    if (!r || aPaye(l)) return l
    return { ...l, statutCotisation: CotisationStatut.VALIDE, cotisationId: r.cotisationId, montant: r.montant }
  })
}

/**
 * Membres soldés (FR29) : le récapitulatif d'une période ne porte pas `soldeLe`, repris de la liste des membres.
 */
export function avecSoldes(lignes: CycleRecapLigne[], membres: { id: string; soldeLe?: string | null }[]): LigneEncaisser[] {
  const soldes = new Map(membres.filter(estSolde).map((m) => [m.id, m.soldeLe]))
  return lignes.map((l) => (soldes.has(l.membreId) ? { ...l, soldeLe: soldes.get(l.membreId) } : l))
}

/** Rien à encaisser pour ce membre : il a payé, ou il est soldé (rangé avec les « déjà payés », grisé) */
export function horsEncaissement(l: Pick<LigneEncaisser, 'statutCotisation' | 'soldeLe'>): boolean {
  return aPaye(l) || estSolde(l)
}

/** « 8 / 20 payés aujourd'hui » (journalier), « 8 / 20 payés » sinon ; un membre soldé ne compte pas */
export function textePayes(lignes: Pick<LigneEncaisser, 'statutCotisation' | 'soldeLe'>[], journalier: boolean): string {
  const attendus = lignes.filter((l) => !estSolde(l) || aPaye(l))
  const payes = attendus.filter(aPaye).length
  return `${payes} / ${attendus.length} payé${payes > 1 ? 's' : ''}${journalier ? ' aujourd’hui' : ''}`
}
