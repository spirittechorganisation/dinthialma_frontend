/**
 * Helpers d'authentification pour les tests.
 *
 * `creerJwt(roles)` : produit un JWT non signé (header.payload.signature_vide)
 *   dont le payload contient les rôles Keycloak attendus par `tokenStorage.extractRoles`.
 *   Expire dans 1 heure par défaut.
 *
 * `connecter(roles)` : remplit localStorage comme `storeSession` le ferait après un vrai login.
 */
import { UserRole } from '@/types/common'
import { storeSession, setPinConfigured } from '@/lib/tokenStorage'

const ROLE_MAP: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'DINTHIALMA_SUPER_ADMIN',
  [UserRole.ADMIN]:       'DINTHIALMA_ADMIN',
  [UserRole.MEMBER]:      'DINTHIALMA_MEMBER',
  [UserRole.USER]:        'DINTHIALMA_USER',
}

/** Encode en base64url (sans padding) */
function b64url(obj: unknown): string {
  const json = JSON.stringify(obj)
  // btoa ne fonctionne qu'avec Latin-1 ; on encode en UTF-8 manuellement
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  bytes.forEach((b) => { bin += String.fromCharCode(b) })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Crée un JWT de test non signé.
 * Utilisé pour simuler un token valide sans Keycloak.
 */
export function creerJwt(
  roles: UserRole[] = [UserRole.MEMBER],
  opts: {
    sub?: string
    phone?: string
    firstName?: string
    lastName?: string
    email?: string
    /** Nombre de secondes avant expiration (défaut 3600) */
    expiresIn?: number
  } = {},
): string {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url({ alg: 'RS256', typ: 'JWT' })
  const payload = b64url({
    sub: opts.sub ?? 'user-test-id',
    email: opts.email ?? 'test@test.com',
    given_name: opts.firstName ?? 'Test',
    family_name: opts.lastName ?? 'User',
    preferred_username: opts.phone ?? '221700000001',
    realm_access: { roles: roles.map((r) => ROLE_MAP[r]) },
    iat: now,
    exp: now + (opts.expiresIn ?? 3600),
  })
  return `${header}.${payload}.signature-test`
}

/**
 * Connecte un utilisateur de test en remplissant localStorage.
 * Appeler dans les `beforeEach` des tests qui nécessitent une session ouverte.
 */
export function connecter(
  roles: UserRole[] = [UserRole.MEMBER],
  opts: Parameters<typeof creerJwt>[1] = {},
): string {
  const token = creerJwt(roles, opts)
  storeSession(token, 'refresh-test', opts.phone ?? '+221700000001')
  setPinConfigured(true)
  return token
}
