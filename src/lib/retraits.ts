/**
 * Retraits anticipés d'une épargne (B42, lot 1) et répartition finale (B51) : règles et textes.
 *
 * Mêmes règles que le backend : solde = cotisations validées − retraits remis ; retrait partiel ≤ solde ;
 * retrait total = tout le solde, le membre devient « soldé » (`soldeLe`) ; date de remise jamais future,
 * jamais avant le début de la tontine (heure de Dakar). Les erreurs sont lues dans `code` (B02).
 */
import { donneesErreur, messageErreur, parseApiError, type ApiErrorCode } from '@/lib/apiError'
import { formatF } from '@/lib/format'
import { aujourdhuiDakar, jourMois } from '@/lib/periodes'
import type { NatureRetrait } from '@/types/retrait'

/** Membre soldé : a tout retiré, ne cotise plus (badge « Soldé », plus d'Encaisser ni de « à payer ») */
export function estSolde(x: { soldeLe?: string | null } | null | undefined): boolean {
  return !!x?.soldeLe
}

/** Moyens de remise proposés : Espèces par défaut ; Wave et Orange Money avec une référence */
export const MOYENS_REMISE = [
  { value: 'CASH', label: 'Espèces', phrase: 'en espèces', reference: false },
  { value: 'WAVE', label: 'Wave', phrase: 'par Wave', reference: true },
  { value: 'ORANGE_MONEY', label: 'Orange Money', phrase: 'par Orange Money', reference: true },
] as const

export function moyenRemise(value: string) {
  return MOYENS_REMISE.find((m) => m.value === value) ?? MOYENS_REMISE[0]
}

/** Montant remis : tout le solde pour un retrait total, la saisie sinon */
export function montantRetrait(nature: NatureRetrait, saisie: number, solde: number): number {
  return nature === 'TOTAL' ? solde : saisie
}

/**
 * Contrôles avant l'envoi (le backend refait les mêmes) ; null si tout va bien.
 * `jour` : date de remise choisie (AAAA-MM-JJ) ; `debut` : premier jour de la tontine.
 */
export function verifierRetrait(r: {
  nature: NatureRetrait
  montant: number
  solde: number
  jour: string
  debut?: string | null
  maintenant?: Date
}): string | null {
  if (r.solde <= 0) return 'Rien à retirer : le solde est de 0F.'
  if (r.nature === 'PARTIEL') {
    if (r.montant <= 0) return 'Saisissez le montant remis.'
    if (r.montant > r.solde) return `Le solde est de ${formatF(r.solde)} : le retrait ne peut pas le dépasser.`
  }
  if (!r.jour) return 'Indiquez la date de remise.'
  if (r.jour > aujourdhuiDakar(r.maintenant)) return 'La date de remise ne peut pas être dans le futur.'
  if (r.debut && r.jour < r.debut.slice(0, 10)) return `La date de remise ne peut pas précéder le début de la tontine (${jourMois(r.debut)}).`
  return null
}

/**
 * Date de remise envoyée au backend (date-heure locale de Dakar, sans fuseau) : rien pour aujourd'hui
 * (le backend prend l'heure exacte), midi pour un jour passé reporté du cahier.
 */
export function dateRemisePourEnvoi(jour: string, maintenant: Date = new Date()): string | undefined {
  return jour === aujourdhuiDakar(maintenant) ? undefined : `${jour}T12:00:00`
}

/**
 * Récapitulatif avant l'envoi :
 * « Remettre 10.000F en espèces à Awa. Il lui restera 34.000F. »
 * Retrait total : « … Awa sera soldé(e) : plus de cotisation, et rien à recevoir à la fin. »
 * (« soldé(e) » : le genre du membre n'est pas connu ; décision du 23/11/2026)
 */
export function phraseRemise(r: { prenom: string; montant: number; methode: string; nature: NatureRetrait; solde: number }): string {
  const remettre = `Remettre ${formatF(r.montant)} ${moyenRemise(r.methode).phrase} à ${r.prenom}.`
  if (r.nature === 'TOTAL') {
    return `${remettre} ${r.prenom} sera soldé(e) : plus de cotisation, et rien à recevoir à la fin.`
  }
  return `${remettre} Il lui restera ${formatF(Math.max(0, r.solde - r.montant))}.`
}

export interface ErreurRetrait {
  code: ApiErrorCode
  texte: string
  /** RETRAIT_COTISATIONS_EN_ATTENTE : proposer « Ouvrir À valider » */
  aValider: boolean
  /** RETRAIT_INTERDIT : proposer d'activer les retraits dans les Réglages */
  reglages: boolean
}

function nombre(v: unknown): number | null {
  const n = Number(v)
  return v != null && Number.isFinite(n) ? n : null
}

/** Texte d'une erreur de retrait (saisie ou annulation), avec les détails du backend */
export function erreurRetrait(err: unknown, repli = 'Le retrait n’a pas pu être enregistré. Réessayez.'): ErreurRetrait {
  const { code } = parseApiError(err)
  const data = donneesErreur(err)
  const base = { code, aValider: false, reglages: false }
  switch (code) {
    case 'RETRAIT_SOLDE_INSUFFISANT': {
      const solde = nombre(data?.solde)
      return { ...base, texte: solde != null ? `Solde insuffisant : il reste ${formatF(solde)} sur cette épargne.` : 'Solde insuffisant pour ce retrait.' }
    }
    case 'RETRAIT_COTISATIONS_EN_ATTENTE': {
      // Bloque aussi les cotisations EN_RETARD, encore validables (B33)
      const n = nombre(data?.cotisationsEnAttente)
      const qui = n != null ? `${n} cotisation${n > 1 ? 's' : ''}` : 'Des cotisations'
      return {
        ...base,
        aValider: true,
        texte: `${qui} en attente ou en retard : validez-les ou refusez-les avant le retrait total.`,
      }
    }
    case 'RETRAIT_INTERDIT':
      return { ...base, reglages: true, texte: 'Les retraits avant la fin ne sont pas autorisés dans cette épargne.' }
    case 'MEMBRE_SOLDE':
      return { ...base, texte: 'Ce membre a déjà tout retiré : il n’a plus d’épargne.' }
    case 'RETRAIT_NON_ANNULABLE':
      return { ...base, texte: 'Ce retrait ne peut pas être annulé : annulez d’abord le retrait total (ou la répartition est déjà faite).' }
    case 'RETRAIT_NON_DISPONIBLE':
      return { ...base, texte: 'Retrait impossible : l’épargne n’est pas en cours ou la répartition est déjà faite.' }
    default:
      return { ...base, texte: messageErreur(err, repli) }
  }
}

/** Répartition pas encore faite (404 DISTRIBUTION_NON_FAITE) : rien à afficher, sans message d'erreur */
export function distributionNonFaite(err: unknown): boolean {
  return parseApiError(err).code === 'DISTRIBUTION_NON_FAITE'
}

/**
 * Titre de la notification RETRAIT_REMIS : « Retrait de 10.000F enregistré ».
 * Le montant n'existe que dans le corps envoyé par le serveur (« Retrait de 10000 FCFA remis… ») :
 * lu s'il est reconnaissable, sinon titre sans montant.
 */
export function titreRetraitRemis(corps: string | null | undefined): string {
  // « 10000 FCFA » ou « 10000.00 FCFA » (BigDecimal.toPlainString du backend)
  const m = /Retrait de (\d[\d\s]*?)(?:[.,]\d{1,2})?\s*F/i.exec(corps ?? '')
  const montant = m ? Number(m[1].replace(/\s/g, '')) : NaN
  return Number.isFinite(montant) && montant > 0 ? `Retrait de ${formatF(montant)} enregistré` : 'Retrait enregistré'
}
