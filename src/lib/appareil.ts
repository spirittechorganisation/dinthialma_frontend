/**
 * Identifiant stable de l'appareil (B53, FR31) : envoyé à `login`, `register/complete`, `pin/setup`,
 * `login-pin` et `logout`. Le backend y attache une session longue « de confiance » : après le mot de passe
 * une fois, le PIN suffit pendant des mois sur cet appareil.
 *
 * - Généré au premier lancement (UUID), gardé dans le localStorage, jamais régénéré tant que le stockage existe.
 * - Stockage indisponible (navigation privée stricte, quota) : repli en mémoire pour la durée de la page.
 * - Hors du `clearAll()` de la déconnexion complète : l'appareil reste le même après « Se déconnecter ».
 * - Format exigé par le backend : `[A-Za-z0-9._-]{8,100}`.
 */
export const APPAREIL_KEY = 'dinthialma_appareil_id'
export const FORMAT_APPAREIL = /^[A-Za-z0-9._-]{8,100}$/

let enMemoire: string | null = null

/** UUID v4 : `crypto.randomUUID` quand il existe, sinon octets aléatoires de `crypto.getRandomValues` */
export function nouvelIdentifiant(c: Pick<Crypto, 'getRandomValues'> & { randomUUID?: () => string } | undefined = globalThis.crypto): string {
  if (c?.randomUUID) return c.randomUUID()
  const o = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(o)
  else for (let i = 0; i < 16; i++) o[i] = Math.floor(Math.random() * 256)
  o[6] = (o[6] & 0x0f) | 0x40
  o[8] = (o[8] & 0x3f) | 0x80
  const h = [...o].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Identifiant de cet appareil, créé au premier appel */
export function getAppareilId(): string {
  try {
    const existant = localStorage.getItem(APPAREIL_KEY)
    if (existant && FORMAT_APPAREIL.test(existant)) return existant
    const id = enMemoire ?? nouvelIdentifiant()
    localStorage.setItem(APPAREIL_KEY, id)
    enMemoire = id
    return id
  } catch {
    // Stockage refusé : même identifiant pendant toute la vie de la page
    enMemoire ??= nouvelIdentifiant()
    return enMemoire
  }
}

/** Tests uniquement : oublie le repli en mémoire */
export function _oublierAppareilEnMemoire(): void {
  enMemoire = null
}
