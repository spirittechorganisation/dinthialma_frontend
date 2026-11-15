import { CycleStatut } from '@/types/common'
import type { RythmeUnite, DeclenchementJackpot, ModeRemise } from '@/types/tontine'

/** Rythme court pour « 5.000F / mois » */
const RYTHME: Record<string, string> = {
  JOURNALIERE: 'jour',
  HEBDOMADAIRE: 'semaine',
  BIMENSUEL: '2 semaines',
  MENSUEL: 'mois',
  TRIMESTRIEL: 'trimestre',
}

export function rythmeCourt(frequence: string | null | undefined): string {
  return (frequence && RYTHME[frequence]) || (frequence ?? '').toLowerCase()
}

/** Vocabulaire unique du brief : À venir / En cours / Terminé */
export const TOUR_STATUT: Record<CycleStatut, { label: string; cls: string }> = {
  EN_ATTENTE: { label: 'À venir', cls: 'bg-neutral-100 text-neutral-700' },
  EN_COURS: { label: 'En cours', cls: 'bg-primary-50 text-primary-800' },
  TERMINE: { label: 'Terminé', cls: 'bg-violet-50 text-violet-800' },
}

/** Date du jour au format yyyy-mm-dd (heure locale) */
export function aujourdhuiIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Nombre de jours avant une date (négatif si passée) */
export function joursAvant(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

export function compteARebours(iso: string | null | undefined): string | null {
  const j = joursAvant(iso)
  if (j === null) return null
  return j > 0 ? `J-${j}` : j === 0 ? "Aujourd'hui" : `J+${Math.abs(j)}`
}

/**
 * Crans du réglage de rythme, du plus court au plus long. Rythme limité à 1 mois maximum (décision 2026-11-12).
 * Le backend reçoit `rythmeIntervalle` + `rythmeUnite` (B26) ; `code` = ancien code FREQUENCE_TONTINE
 * équivalent, envoyé en plus quand il existe.
 */
export interface Rythme {
  intervalle: number
  unite: RythmeUnite
  code: string | null
  /** « Chaque semaine », « Tous les 3 jours » */
  label: string
  /** Libellé court sous la barre : « 1 sem » */
  court: string
  /** Libellé affiché sous la barre même quand il y a beaucoup de crans */
  repere?: boolean
  /** Au-delà d'un mois : plus proposé, affiché seulement pour une tontine qui l'utilise déjà */
  horsLimite?: boolean
}

export const RYTHMES: Rythme[] = [
  { intervalle: 1, unite: 'JOUR', code: 'JOURNALIERE', label: 'Chaque jour', court: '1 j', repere: true },
  { intervalle: 2, unite: 'JOUR', code: null, label: 'Tous les 2 jours', court: '2 j' },
  { intervalle: 3, unite: 'JOUR', code: null, label: 'Tous les 3 jours', court: '3 j' },
  { intervalle: 5, unite: 'JOUR', code: null, label: 'Tous les 5 jours', court: '5 j' },
  { intervalle: 1, unite: 'SEMAINE', code: 'HEBDOMADAIRE', label: 'Chaque semaine', court: '1 sem', repere: true },
  { intervalle: 10, unite: 'JOUR', code: null, label: 'Tous les 10 jours', court: '10 j' },
  { intervalle: 2, unite: 'SEMAINE', code: 'BIMENSUEL', label: 'Toutes les 2 semaines', court: '2 sem', repere: true },
  { intervalle: 3, unite: 'SEMAINE', code: null, label: 'Toutes les 3 semaines', court: '3 sem' },
  { intervalle: 1, unite: 'MOIS', code: 'MENSUEL', label: 'Chaque mois', court: '1 mois', repere: true },
]

export const RYTHME_PAR_DEFAUT: Rythme = RYTHMES[RYTHMES.length - 1]

const MOTS_UNITE: Record<RythmeUnite, [string, string]> = { JOUR: ['jour', 'jours'], SEMAINE: ['semaine', 'semaines'], MOIS: ['mois', 'mois'] }
const CODES_HISTORIQUES: Record<string, [number, RythmeUnite]> = {
  JOURNALIERE: [1, 'JOUR'], HEBDOMADAIRE: [1, 'SEMAINE'], BIMENSUEL: [2, 'SEMAINE'], MENSUEL: [1, 'MOIS'], TRIMESTRIEL: [3, 'MOIS'],
}

/** Rythme quelconque (y compris hors crans : « tous les 4 jours », « tous les 3 mois ») */
export function rythmeLibre(intervalle: number, unite: RythmeUnite): Rythme {
  const connu = RYTHMES.find((r) => r.intervalle === intervalle && r.unite === unite)
  if (connu) return connu
  const mots = MOTS_UNITE[unite]
  const label = intervalle === 1
    ? `Chaque ${mots[0]}`
    : `${unite === 'SEMAINE' ? 'Toutes' : 'Tous'} les ${intervalle} ${mots[1]}`
  const code = Object.entries(CODES_HISTORIQUES).find(([, v]) => v[0] === intervalle && v[1] === unite)?.[0] ?? null
  return { intervalle, unite, code, label, court: `${intervalle} ${unite === 'JOUR' ? 'j' : unite === 'SEMAINE' ? 'sem' : 'mois'}`, horsLimite: true }
}

/** Rythme d'une tontine : champs B26 d'abord, sinon ancien code `frequence` ; null si inconnu */
export function rythmeDe(t: { rythmeIntervalle?: number | null; rythmeUnite?: RythmeUnite | null; frequence?: string | null } | null | undefined): Rythme | null {
  if (!t) return null
  if (t.rythmeIntervalle && t.rythmeUnite) return rythmeLibre(t.rythmeIntervalle, t.rythmeUnite)
  const h = t.frequence ? CODES_HISTORIQUES[t.frequence] : undefined
  return h ? rythmeLibre(h[0], h[1]) : null
}

/** Durée d'un intervalle en toutes lettres : « 3 jours », « 1 semaine », « 2 mois » */
export function dureeRythme(r: Rythme): string {
  const mots = MOTS_UNITE[r.unite]
  return `${r.intervalle} ${r.intervalle > 1 ? mots[1] : mots[0]}`
}

/** Après un montant : « 5.000F / mois », « 5.000F / 3 jours » */
export function rythmeCourtDe(t: Parameters<typeof rythmeDe>[0]): string {
  const r = rythmeDe(t)
  if (!r) return rythmeCourt(t?.frequence)
  return r.intervalle === 1 ? MOTS_UNITE[r.unite][0] : dureeRythme(r)
}

/** Rythme en phrase : « chaque semaine », « tous les 3 jours » */
export function rythmePhraseDe(r: Rythme): string {
  return r.label.charAt(0).toLowerCase() + r.label.slice(1)
}

/** Rythme après « une cotisation » : « par semaine », « tous les 3 jours », « toutes les 2 semaines » */
export function parRythme(r: Rythme): string {
  if (r.intervalle === 1) return `par ${MOTS_UNITE[r.unite][0]}`
  return `${r.unite === 'SEMAINE' ? 'toutes' : 'tous'} les ${dureeRythme(r)}`
}

/** Durée d'un tour de N cotisations : « 4 semaines (environ 1 mois) », « 6 jours », « 3 mois » */
export function dureeTour(r: Rythme, n: number): string {
  if (r.unite === 'MOIS') return `${r.intervalle * n} mois`
  const jours = r.intervalle * n * (r.unite === 'SEMAINE' ? 7 : 1)
  if (jours % 7 !== 0) return `${jours} jour${jours > 1 ? 's' : ''}`
  const semaines = jours / 7
  const base = `${semaines} semaine${semaines > 1 ? 's' : ''}`
  // Repère en mois à partir de 4 semaines (arrondi : 4 sem ≈ 1 mois, 9 sem ≈ 2 mois)
  if (semaines < 4) return base
  return `${base} (environ ${Math.round(jours / 30)} mois)`
}

// ─── Jour et heure limites de paiement (B26) ─────────────────────────────────

export const JOURS_SEMAINE: { code: string; court: string; label: string }[] = [
  { code: 'LUNDI', court: 'L', label: 'lundi' },
  { code: 'MARDI', court: 'M', label: 'mardi' },
  { code: 'MERCREDI', court: 'M', label: 'mercredi' },
  { code: 'JEUDI', court: 'J', label: 'jeudi' },
  { code: 'VENDREDI', court: 'V', label: 'vendredi' },
  { code: 'SAMEDI', court: 'S', label: 'samedi' },
  { code: 'DIMANCHE', court: 'D', label: 'dimanche' },
]

export const HEURE_ECHEANCE_DEFAUT = '23:59'

/** « 20:00 » → « 20h », « 23:59 » → « 23h59 » */
export function heureLisible(hhmm: string | null | undefined): string {
  const [h, m] = (hhmm || HEURE_ECHEANCE_DEFAUT).split(':')
  return `${Number(h)}h${m && m !== '00' ? m : ''}`
}

/** Un jour limite n'a de sens que pour un rythme en semaines ou en mois */
export function jourEcheanceValide(unite: RythmeUnite, jour: string | null | undefined): boolean {
  if (!jour) return true
  if (unite === 'SEMAINE') return JOURS_SEMAINE.some((j) => j.code === jour)
  if (unite === 'MOIS') return jour === 'DERNIER' || (/^\d{1,2}$/.test(jour) && Number(jour) >= 1 && Number(jour) <= 31)
  return false
}

/**
 * Limite de paiement en clair : « le dimanche », « le 30 du mois », « le dernier jour du mois »,
 * suivie de l'heure si ce n'est pas la fin de journée (« avant 20h »). Chaîne vide si rien d'imposé.
 */
export function echeancePhrase(t: { rythmeUnite?: RythmeUnite | null; jourEcheance?: string | null; heureEcheance?: string | null } | null | undefined): string {
  if (!t) return ''
  const morceaux: string[] = []
  const j = t.jourEcheance
  if (j && t.rythmeUnite === 'SEMAINE') {
    const jour = JOURS_SEMAINE.find((x) => x.code === j)
    if (jour) morceaux.push(`le ${jour.label}`)
  } else if (j && t.rythmeUnite === 'MOIS') {
    morceaux.push(j === 'DERNIER' ? 'le dernier jour du mois' : `le ${j} du mois`)
  }
  if (t.heureEcheance && t.heureEcheance.slice(0, 5) !== HEURE_ECHEANCE_DEFAUT) morceaux.push(`avant ${heureLisible(t.heureEcheance)}`)
  return morceaux.join(', ')
}

// ─── Remise du jackpot (B32, B33) ────────────────────────────────────────────

export const DECLENCHEMENTS: { value: DeclenchementJackpot; label: string; detail: string }[] = [
  { value: 'FIN_DU_TOUR', label: 'À la fin du tour', detail: 'Le jackpot est remis à la date prévue.' },
  { value: 'TOUS_PAYES', label: 'Dès que tous ont payé', detail: 'Le jackpot est remis dès que tout le monde a cotisé, même avant la date.' },
]

/** Options proposées au gestionnaire quand il manque de l'argent à la remise (CAISSE : pas encore disponible) */
export const MODES_REMISE: { value: ModeRemise; label: string; detail: string }[] = [
  { value: 'DISPONIBLE', label: 'Remettre ce qui est collecté', detail: 'Le gagnant reçoit le reste quand les retards sont payés.' },
  { value: 'ATTENDRE', label: 'Attendre que tout soit payé', detail: 'Rien n’est remis tant qu’il manque une cotisation.' },
  { value: 'AVANCE_COMMISSION', label: 'Compléter avec ma commission', detail: 'Le gagnant reçoit tout ; vous récupérez votre commission quand les retards sont payés.' },
  { value: 'AVANCE_GESTIONNAIRE', label: 'Avancer de ma poche', detail: 'Le gagnant reçoit tout ; les retards vous remboursent ensuite.' },
]

export const modeRemiseLabel = (m: ModeRemise | null | undefined) =>
  MODES_REMISE.find((x) => x.value === m)?.label ?? 'Remettre ce qui est collecté'

/** Valeurs de repli si les listes de valeurs (référentiels) ne répondent pas */
export const FREQUENCES_DEFAUT = ['JOURNALIERE', 'HEBDOMADAIRE', 'BIMENSUEL', 'MENSUEL', 'TRIMESTRIEL']
export const ORDRES_DEFAUT = ['ROTATION', 'ALEATOIRE', 'MANUEL']
export const ORDRE_LABEL: Record<string, string> = { ROTATION: 'Ordre fixe', ALEATOIRE: 'Tirage au sort', MANUEL: 'Je choisis' }
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
