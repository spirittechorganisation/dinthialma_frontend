  import axios, { AxiosInstance, AxiosError } from 'axios'
import { getAccessToken, getRefreshToken, setTokens, clearAll, isTokenExpired } from '@/lib/tokenStorage'
import { avecVerrouOnglets, VERROU_RENOUVELLEMENT } from '@/lib/verrouOnglets'
import { ApiError } from '@/types/common'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081'

const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  // Multi-valeurs au format attendu par le backend : ?statut=A&statut=B (pas statut[]=A)
  paramsSerializer: { indexes: null },
})

// ─── Injection du Bearer token ────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// ─── Refresh automatique ──────────────────────────────────────────────────────
// FR26 (corrige B3 de la spec 01) : un seul renouvellement à la fois, partagé par l'intercepteur, le
// démarrage (ProtectedRoute) et useAuth.refreshSession ; plus d'état bloqué quand il n'y a pas de
// refresh token ; une seule redirection vers /login quand la session est perdue.
let renouvellement: Promise<string> | null = null
let redirectionLogin = false

/** Erreur levée quand aucun refresh token n'est enregistré (rien à renouveler) */
export class SansRefreshToken extends Error {
  constructor() { super('Aucun refresh token') }
}

/**
 * Renouvelle les jetons avec le refresh token et renvoie le nouveau jeton d'accès.
 *
 * Rotation des refresh tokens (FR31) : un jeton ne sert qu'une fois, le rejouer ferme la session.
 * - Dans un onglet : les appels simultanés partagent la même requête `/v1/auth/refresh`.
 * - Entre onglets : verrou `navigator.locks`. Dans le verrou, le jeton est relu ; si un autre onglet l'a
 *   renouvelé pendant l'attente, on reprend ses jetons sans rien renvoyer.
 * - Le nouveau couple est enregistré avant toute autre requête.
 */
export function renouvelerJetons(): Promise<string> {
  if (renouvellement) return renouvellement
  const avant = getRefreshToken()
  if (!avant) return Promise.reject(new SansRefreshToken())
  renouvellement = avecVerrouOnglets(VERROU_RENOUVELLEMENT, async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) throw new SansRefreshToken()
    const acces = getAccessToken()
    if (refreshToken !== avant && acces && !isTokenExpired(acces)) return acces
    // Endpoint public : appelé SANS en-tête Authorization (le jeton d'accès peut être expiré)
    const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, { refreshToken })
    const { access_token, refresh_token } = data.data
    setTokens(access_token, refresh_token)
    return access_token as string
  }).finally(() => { renouvellement = null })
  return renouvellement
}

/** Session perdue : efface tout et part sur /login, une seule fois même si plusieurs requêtes échouent */
function sessionPerdue() {
  clearAll()
  if (redirectionLogin) return
  redirectionLogin = true
  window.location.href = '/login'
}

// Rôle insuffisant = 403 (code FORBIDDEN) : jamais de déconnexion. Seul un 401 tente un refresh.
// Endpoints qui ne doivent pas déclencher un retry après refresh :
// - login / register : erreur 401 = mauvaises credentials (pas de session à rafraîchir)
// - refresh : éviter la récursion
// - logout : inutile de retenter
const SKIP_RETRY = ['/v1/auth/login', '/v1/auth/register', '/v1/auth/refresh', '/v1/auth/logout']

// 401 qui ne parlent pas du jeton (FR31) : mot de passe faux à la création du PIN (`pin/setup`), PIN désactivé
// ou session PIN expirée. Les renouveler serait inutile, et un échec du renouvellement déconnecterait à tort.
const CODES_401_METIER = ['INVALID_CREDENTIALS', 'CURRENT_PASSWORD_INVALID', 'PIN_DISABLED', 'PIN_SESSION_EXPIRED']

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean }
    const url = originalRequest?.url ?? ''

    if (SKIP_RETRY.some((u) => url.includes(u))) {
      return Promise.reject(error)
    }

    if (CODES_401_METIER.includes((error.response?.data as { code?: string } | undefined)?.code ?? '')) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const token = await renouvelerJetons()
        originalRequest.headers!.Authorization = `Bearer ${token}`
        return api(originalRequest)
      } catch (refreshError) {
        // Réseau coupé pendant le renouvellement (aucune réponse) : la session n'est pas perdue, on garde
        // les jetons et la requête échoue comme hors ligne. Le prochain essai repartira du jeton stocké.
        if (axios.isAxiosError(refreshError) && !refreshError.response) return Promise.reject(refreshError)
        sessionPerdue()
        // Sans refresh token : on rejette l'erreur d'origine (le 401 de la requête)
        return Promise.reject(refreshError instanceof SansRefreshToken ? error : refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
