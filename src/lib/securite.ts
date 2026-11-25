/**
 * Codes de sécurité du PIN et des codes SMS (SE07, B53, FR31) : que faire de chaque code, avec quel texte.
 * Les écrans testent le `code` de l'erreur (B02), jamais son texte.
 */
import { messageErreur, parseApiError, type ApiErrorCode } from '@/lib/apiError'

/** « 14:59 » au-delà d'une minute, « 45 s » en dessous */
export function compteARebours(secondes: number): string {
  const s = Math.max(0, Math.ceil(secondes))
  if (s < 60) return `${s} s`
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Horodatage (ms) de fin d'une attente de `secondes` à partir de maintenant */
export function finAttente(secondes: number, maintenant: number = Date.now()): number {
  return maintenant + Math.max(0, secondes) * 1000
}

/** Secondes restantes avant `fin` (horodatage en ms), jamais négatif */
export function secondesRestantes(fin: number | null, maintenant: number = Date.now()): number {
  return fin ? Math.max(0, Math.ceil((fin - maintenant) / 1000)) : 0
}

export type ActionPin =
  /** Plus de session sur cet appareil : une connexion par mot de passe, puis le PIN suffit */
  | { type: 'motDePasse'; texte: string }
  /** 5 PIN faux : attendre `retryAfterSeconds`, ou « PIN oublié ? » */
  | { type: 'verrouille'; texte: string; retryAfterSeconds: number | null }
  /** 10 PIN faux cumulés : PIN effacé ; mot de passe puis nouveau PIN (ou PIN oublié) */
  | { type: 'desactive'; texte: string }
  /** Aucun PIN sur ce compte : mot de passe, puis création du PIN */
  | { type: 'creerPin'; texte: string }
  /** PIN expiré : réinitialisation par code SMS */
  | { type: 'reinitialiser'; texte: string }
  /** PIN faux (ou autre erreur) : on reste sur l'écran */
  | { type: 'rester'; texte: string }

export const TEXTE_RECONNEXION = 'Pour votre sécurité, reconnectez-vous une fois avec votre mot de passe.'

/** Erreur de `login-pin` → action de l'écran PIN */
export function actionPin(err: unknown): ActionPin {
  const { code, retryAfterSeconds } = parseApiError(err)
  switch (code) {
    case 'PIN_SESSION_EXPIRED':
    case 'SESSION_EXPIRED':
    case 'NOT_FOUND':
      return { type: 'motDePasse', texte: TEXTE_RECONNEXION }
    case 'PIN_LOCKED':
      return {
        type: 'verrouille',
        retryAfterSeconds,
        texte: retryAfterSeconds
          ? `Trop d’essais. Réessayez dans ${compteARebours(retryAfterSeconds)}, ou touchez « PIN oublié ? ».`
          : 'Trop d’essais. Réessayez plus tard, ou touchez « PIN oublié ? ».',
      }
    case 'PIN_DISABLED':
      return { type: 'desactive', texte: 'Trop d’essais : votre code a été désactivé. Reconnectez-vous avec votre mot de passe pour en créer un nouveau.' }
    case 'PIN_NOT_CONFIGURED':
      return { type: 'creerPin', texte: 'Aucun code secret sur ce compte. Connectez-vous avec votre mot de passe pour en créer un.' }
    case 'PIN_EXPIRED':
      return { type: 'reinitialiser', texte: messageErreur(err) }
    default:
      return { type: 'rester', texte: messageErreur(err, 'Code secret incorrect.') }
  }
}

export interface ErreurOtp {
  code: ApiErrorCode
  texte: string
  /** OTP_RATE_LIMITED : secondes avant de pouvoir redemander un code */
  attente: number | null
  /** OTP_TOO_MANY_ATTEMPTS : ce code ne marche plus, il faut en demander un nouveau */
  nouveauCode: boolean
}

/** Erreur d'envoi ou de vérification d'un code SMS */
export function erreurOtp(err: unknown, repli = 'Une erreur est survenue. Réessayez.'): ErreurOtp {
  const { code, retryAfterSeconds } = parseApiError(err)
  if (code === 'OTP_RATE_LIMITED') {
    return {
      code, nouveauCode: false, attente: retryAfterSeconds,
      texte: retryAfterSeconds
        ? `Trop de codes demandés pour ce numéro. Vous pourrez en redemander un dans ${compteARebours(retryAfterSeconds)}.`
        : 'Trop de codes demandés pour ce numéro. Réessayez dans une heure.',
    }
  }
  if (code === 'OTP_TOO_MANY_ATTEMPTS') {
    return { code, nouveauCode: true, attente: null, texte: 'Trop d’essais avec ce code. Demandez un nouveau code.' }
  }
  return { code, nouveauCode: false, attente: null, texte: messageErreur(err, repli) }
}

/** Création du PIN avec le mot de passe : mot de passe faux → on le redemande, le PIN n'est pas créé */
export function motDePasseRefuse(err: unknown): boolean {
  return parseApiError(err).code === 'INVALID_CREDENTIALS'
}
