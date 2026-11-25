import type { AuthUser } from '@/types/user'
import { APPAREIL_KEY } from '@/lib/appareil'
import { UserRole } from '@/types/common'

const ACCESS_TOKEN_KEY   = 'dinthialma_access_token'
const REFRESH_TOKEN_KEY  = 'dinthialma_refresh_token'
const USER_PHONE_KEY     = 'dinthialma_user_phone'
const PIN_CONFIGURED_KEY = 'dinthialma_pin_configured'
const CLIENT_TYPE_KEY    = 'dinthialma_client_type'
/** Déconnexion douce : le refresh token est gardé pour l'écran PIN, mais il ne doit pas rouvrir la session seul */
const VERROU_KEY         = 'dinthialma_session_verrouillee'

// ─── Détection du type de client ──────────────────────────────────────────────
export function detectClientType(): 'WEB' | 'MOBILE' {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return isStandalone ? 'MOBILE' : 'WEB'
}

// ─── Normalisation du téléphone ───────────────────────────────────────────────
// Le backend attend le numéro sans le + (ex: 221783703310)
export function normalizePhone(phone: string): string {
  return phone.replace(/\s/g, '').replace(/^\+/, '')
}

// ─── Structure du JWT Keycloak ────────────────────────────────────────────────
interface JwtPayload {
  exp?: number
  sub?: string
  email?: string
  given_name?: string
  family_name?: string
  preferred_username?: string
  realm_access?: { roles: string[] }
  roles?: string[]
}

const base64UrlDecode = (value: string): string => {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, '=')
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  // atob() retourne une chaîne binaire (Latin-1) — les octets UTF-8 doivent être
  // réinterprétés via TextDecoder pour afficher correctement les caractères accentués
  const binary = atob(base64)
  const bytes = new Uint8Array([...binary].map((c) => c.charCodeAt(0)))
  return new TextDecoder('utf-8').decode(bytes)
}

// ─── Tokens ───────────────────────────────────────────────────────────────────
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}
export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}
export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// ─── Client type ──────────────────────────────────────────────────────────────
export function getClientType(): 'WEB' | 'MOBILE' {
  return (localStorage.getItem(CLIENT_TYPE_KEY) as 'WEB' | 'MOBILE') ?? detectClientType()
}

// ─── Session complète (stockage après login réussi) ───────────────────────────
export function storeSession(
  accessToken: string,
  refreshToken: string,
  phone: string,
): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  localStorage.setItem(USER_PHONE_KEY, normalizePhone(phone))
  localStorage.setItem(CLIENT_TYPE_KEY, detectClientType())
  localStorage.removeItem(VERROU_KEY)
}

// ─── Verrou de la déconnexion douce (FR26) ────────────────────────────────────
// Posé par logout() ; levé par une connexion (mot de passe, PIN, inscription) via storeSession.
// Tant qu'il est posé, une page protégée ne renouvelle pas la session avec le refresh token.
export function verrouillerSession(): void {
  localStorage.setItem(VERROU_KEY, 'true')
}
export function sessionVerrouillee(): boolean {
  return localStorage.getItem(VERROU_KEY) === 'true'
}

// ─── Phone ────────────────────────────────────────────────────────────────────
export function getUserPhone(): string | null {
  return localStorage.getItem(USER_PHONE_KEY)
}
export function setUserPhone(phone: string): void {
  localStorage.setItem(USER_PHONE_KEY, normalizePhone(phone))
}
export function clearUserPhone(): void {
  localStorage.removeItem(USER_PHONE_KEY)
}

// ─── PIN configuré ────────────────────────────────────────────────────────────
// null  = clé absente (inconnu — 1ère connexion sur cet appareil)
// false = backend a confirmé PIN non configuré
// true  = PIN configuré
export function getPinConfigured(): boolean | null {
  const val = localStorage.getItem(PIN_CONFIGURED_KEY)
  if (val === 'true') return true
  if (val === 'false') return false
  return null
}
export function setPinConfigured(value: boolean): void {
  localStorage.setItem(PIN_CONFIGURED_KEY, value ? 'true' : 'false')
}

// ─── Appareil de confiance (FR31) ─────────────────────────────────────────────
// appareilId présent, PIN configuré et numéro connu : la session du serveur (B53) permet de revenir par le PIN,
// sans mot de passe, même si les jetons de l'app sont perdus. Ne crée jamais d'appareilId.
export function appareilDeConfiance(): boolean {
  try {
    return !!localStorage.getItem(APPAREIL_KEY) && getPinConfigured() === true && !!getUserPhone()
  } catch {
    return false
  }
}

/**
 * Renouvellement impossible : jetons inutilisables effacés.
 * Appareil de confiance : numéro et PIN gardés, retour à l'écran PIN (`/pin`) ; sinon tout est effacé
 * (l'appareilId reste) et la connexion complète est demandée (`/login`). Renvoie l'écran où aller.
 */
export function oublierSessionPerdue(): '/pin' | '/login' {
  if (appareilDeConfiance()) {
    clearTokens()
    localStorage.removeItem(VERROU_KEY)
    return '/pin'
  }
  clearAll()
  return '/login'
}

// ─── Effacement complet (logout) ──────────────────────────────────────────────
export function clearAll(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_PHONE_KEY)
  localStorage.removeItem(PIN_CONFIGURED_KEY)
  localStorage.removeItem(CLIENT_TYPE_KEY)
  localStorage.removeItem(VERROU_KEY)
}

// ─── Parsing JWT ──────────────────────────────────────────────────────────────
export function parseJwt<T = JwtPayload>(token?: string): T | null {
  if (!token) return null
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    return JSON.parse(base64UrlDecode(payload)) as T
  } catch {
    return null
  }
}

export function isTokenExpired(token?: string): boolean {
  const payload = parseJwt(token)
  if (!payload?.exp) return true
  return Date.now() / 1000 >= payload.exp
}

function extractRoles(payload: JwtPayload): UserRole[] {
  const rawRoles: string[] = [
    ...(payload.realm_access?.roles ?? []),
    ...(payload.roles ?? []),
  ]
  const roleMap: Record<string, UserRole> = {
    DINTHIALMA_SUPER_ADMIN: UserRole.SUPER_ADMIN,
    DINTHIALMA_ADMIN:       UserRole.ADMIN,
    DINTHIALMA_MEMBER:      UserRole.MEMBER,
    DINTHIALMA_USER:        UserRole.USER,
    SUPER_ADMIN:            UserRole.SUPER_ADMIN,
    ADMIN:                  UserRole.ADMIN,
    MEMBER:                 UserRole.MEMBER,
    USER:                   UserRole.USER,
  }
  const roles = rawRoles.map((r) => roleMap[r]).filter((r): r is UserRole => r !== undefined)
  return [...new Set(roles)]
}

export function getAuthUser(token?: string): AuthUser | null {
  const payload = parseJwt<JwtPayload>(token)
  if (!payload?.sub) return null
  return {
    sub:       payload.sub,
    email:     payload.email ?? '',
    firstName: payload.given_name ?? payload.preferred_username ?? '',
    lastName:  payload.family_name ?? '',
    phone:     payload.preferred_username ?? '',
    roles:     extractRoles(payload),
  }
}
