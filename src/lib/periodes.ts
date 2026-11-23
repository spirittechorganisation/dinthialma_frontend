/**
 * Garde-fous de date d'une tontine (FR23) et textes des codes d'erreur associés.
 *
 * Mêmes règles que le backend, en heure de Dakar :
 * - B46 `DATE_DEBUT_PASSEE` : une date de début antérieure à aujourd'hui est refusée ;
 * - B45 `TOUR_NON_COMMENCE` : un tour ne se clôture pas avant son premier jour (sauf rotative où tout le monde a payé) ;
 * - B45 `CLOTURE_FINALE_PREMATUREE` : la dernière période d'une événementielle ne se clôture pas avant son dernier jour ;
 * - B47 `ECHEANCE_NON_OUVERTE` : une période événementielle ne se paie pas avant son premier jour ;
 * - B44 `MEMBRE_INACTIF` : aucun nouveau paiement pour un membre suspendu ou sorti.
 *
 * Les écrans testent le `code` de l'erreur (B02), jamais son texte ; le message du serveur reste le repli.
 */
import { messageErreur, parseApiError } from '@/lib/apiError'
import { TontineType } from '@/types/tontine'
import { rythmeDe } from '@/lib/tontineLabels'

export const FUSEAU_DAKAR = 'Africa/Dakar'

/** Date du jour à Dakar, au format du backend : « 2026-11-22 » */
export function aujourdhuiDakar(maintenant: Date = new Date()): string {
  // en-CA donne directement AAAA-MM-JJ
  return maintenant.toLocaleDateString('en-CA', { timeZone: FUSEAU_DAKAR })
}

/** « 2026-11-23 » → « 23/11 » (date courte des messages) */
export function jourMois(iso: string | null | undefined): string {
  if (!iso) return ''
  const [, mois, jour] = iso.slice(0, 10).split('-')
  return jour && mois ? `${jour}/${mois}` : ''
}

/** Date de début renseignée et antérieure à aujourd'hui (vide : rien à signaler ici) */
export function dateDebutPassee(dateDebut: string | null | undefined, maintenant: Date = new Date()): boolean {
  return !!dateDebut && dateDebut.slice(0, 10) < aujourdhuiDakar(maintenant)
}

/** Le premier jour du tour (ou de la période) n'est pas encore arrivé */
export function periodeNonCommencee(cycle: { dateDebut?: string | null }, maintenant: Date = new Date()): boolean {
  return !!cycle.dateDebut && cycle.dateDebut.slice(0, 10) > aujourdhuiDakar(maintenant)
}

/** B47 : une période événementielle pas encore commencée ne se paie pas ; une rotative se paie d'avance */
export function periodePayable(
  type: TontineType | string | null | undefined,
  cycle: { dateDebut?: string | null },
  maintenant: Date = new Date(),
): boolean {
  return type !== TontineType.EVENEMENTIELLE || !periodeNonCommencee(cycle, maintenant)
}

export type BlocageCloture =
  | { code: 'TOUR_NON_COMMENCE'; texte: string }
  | { code: 'CLOTURE_FINALE_PREMATUREE'; texte: string }

/**
 * Pourquoi le gestionnaire ne peut pas encore clôturer ce tour (null : la clôture est possible).
 * `dernier` : plus aucun tour en attente après celui-ci (le backend fait alors la distribution finale).
 */
export function blocageCloture(
  type: TontineType | string | null | undefined,
  cycle: { dateDebut?: string | null; dateFin?: string | null; tousPayes?: boolean },
  dernier: boolean,
  maintenant: Date = new Date(),
): BlocageCloture | null {
  const evenement = type === TontineType.EVENEMENTIELLE
  if (periodeNonCommencee(cycle, maintenant)) {
    // Rotative : la remise anticipée reste permise quand tout le monde a payé (B45)
    if (!evenement && cycle.tousPayes) return null
    return { code: 'TOUR_NON_COMMENCE', texte: texteNonCommence(evenement, cycle.dateDebut) }
  }
  if (evenement && dernier && !!cycle.dateFin && cycle.dateFin.slice(0, 10) > aujourdhuiDakar(maintenant)) {
    return { code: 'CLOTURE_FINALE_PREMATUREE', texte: texteClotureFinale(cycle.dateFin) }
  }
  return null
}

const texteNonCommence = (evenement: boolean, dateDebut?: string | null) =>
  evenement
    ? `Cette période commence le ${jourMois(dateDebut)} : vous pourrez la clôturer à partir de ce jour-là.`
    : `Ce tour commence le ${jourMois(dateDebut)} : il ne peut pas être clôturé avant.`

const texteClotureFinale = (dateFin?: string | null) =>
  `C'est la dernière période : sa clôture partage l'épargne entre les membres, à partir du ${jourMois(dateFin)}. Pour arrêter plus tôt, clôturez la tontine.`

/** Texte d'une période pas encore ouverte au paiement (B47) */
export function texteNonOuverte(dateDebut?: string | null): string {
  return dateDebut
    ? `Cette période commence le ${jourMois(dateDebut)} : les paiements s'enregistrent à partir de ce jour-là.`
    : 'Cette période n’est pas encore ouverte au paiement.'
}

export interface ErreurTontine {
  code: string
  texte: string
}

/**
 * Texte d'une erreur du backend, avec la date quand l'écran la connaît.
 * Codes non concernés : `messageErreur` (texte front, sinon message du serveur, sinon `repli`).
 */
export function erreurTontine(
  err: unknown,
  contexte: { role?: 'gestionnaire' | 'membre'; evenement?: boolean; dateDebut?: string | null; dateFin?: string | null } = {},
  repli?: string,
): ErreurTontine {
  const { code } = parseApiError(err)
  switch (code) {
    case 'DATE_DEBUT_PASSEE':
      return { code, texte: 'La date de début est passée : choisissez aujourd’hui ou une date future.' }
    case 'TOUR_NON_COMMENCE':
      if (contexte.dateDebut) return { code, texte: texteNonCommence(!!contexte.evenement, contexte.dateDebut) }
      break
    case 'CLOTURE_FINALE_PREMATUREE':
      if (contexte.dateFin) return { code, texte: texteClotureFinale(contexte.dateFin) }
      break
    case 'ECHEANCE_NON_OUVERTE':
      if (contexte.evenement && contexte.dateDebut) return { code, texte: texteNonOuverte(contexte.dateDebut) }
      break
    case 'MEMBRE_INACTIF':
      return {
        code,
        texte: contexte.role === 'membre'
          ? 'Votre participation à cette tontine est suspendue ou terminée : vous ne pouvez plus cotiser. Contactez votre gestionnaire.'
          : 'La participation de ce membre est suspendue ou terminée : réactivez-le pour enregistrer un paiement.',
      }
  }
  return { code, texte: messageErreur(err, repli) }
}

// ─── Vocabulaire d'une période (FR25) ────────────────────────────────────────

type TontinePeriode = Parameters<typeof rythmeDe>[0] & { tontineType?: TontineType | string | null }

/** Épargne (événementielle) cotisée chaque jour : une période = un jour */
export function estJournaliere(t: TontinePeriode | null | undefined): boolean {
  const r = rythmeDe(t)
  return t?.tontineType === TontineType.EVENEMENTIELLE && !!r && r.unite === 'JOUR' && r.intervalle === 1
}

/**
 * Nom d'un tour selon la tontine : « Tour 3 » (rotative), « Jour du 23/11 » (épargne journalière),
 * « Période 3 » (autre événementielle, ou date inconnue). Une épargne n'a ni tour ni jackpot.
 */
export function nomPeriode(
  t: TontinePeriode | null | undefined,
  cycle: { numeroCycle: number; dateDebut?: string | null },
): string {
  if (t?.tontineType !== TontineType.EVENEMENTIELLE) return `Tour ${cycle.numeroCycle}`
  if (estJournaliere(t) && cycle.dateDebut) return `Jour du ${jourMois(cycle.dateDebut)}`
  return `Période ${cycle.numeroCycle}`
}
