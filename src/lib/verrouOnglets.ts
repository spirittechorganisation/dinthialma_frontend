/**
 * Verrou partagé entre les onglets d'une même origine (FR31) : un seul renouvellement de jetons à la fois,
 * même avec plusieurs onglets ouverts. Avec la rotation Keycloak, deux onglets qui envoient le même
 * `refresh_token` au même moment font un rejeu, et Keycloak ferme la session de l'appareil.
 *
 * `navigator.locks` (Web Locks API) quand il existe (tous les navigateurs récents, iOS 15.4 et plus) ;
 * sinon la tâche s'exécute directement. Elle relit alors le stockage juste avant d'envoyer, ce qui couvre
 * les renouvellements qui ne se chevauchent pas.
 */
type Verrous = { request: <T>(nom: string, tache: () => Promise<T>) => Promise<T> }

export const VERROU_RENOUVELLEMENT = 'dinthialma-renouvellement-jetons'

export function avecVerrouOnglets<T>(
  nom: string,
  tache: () => Promise<T>,
  verrous: Verrous | undefined = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: Verrous }).locks : undefined,
): Promise<T> {
  return verrous?.request ? verrous.request(nom, tache) : tache()
}
