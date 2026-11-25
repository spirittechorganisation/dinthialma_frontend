import { Navigate, useLocation } from 'react-router-dom'
import { ReactNode, useEffect, useState } from 'react'
import { getAccessToken, getRefreshToken, isTokenExpired, sessionVerrouillee, appareilDeConfiance, oublierSessionPerdue } from '@/lib/tokenStorage'
import { memoriserRetour } from '@/lib/retour'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'

interface ProtectedRouteProps {
  children: ReactNode
}

type Etat = 'ok' | 'renouvellement' | 'perdue'
/** Écran de reconnexion : PIN pour un appareil de confiance (FR31), sinon connexion complète */
const ecranReconnexion = () => (appareilDeConfiance() ? '/pin' : '/login')

/**
 * Le jeton d'accès Keycloak dure 5 minutes. Expiré au chargement de la page (rechargement, reprise après
 * mise en veille, retour en ligne), il est renouvelé avec le refresh token avant d'afficher l'écran (FR26) ;
 * avant, la page partait sur /login alors que la session était encore valable.
 * Pas de renouvellement après une déconnexion douce : le code secret reste demandé.
 */
function etatInitial(): Etat {
  const token = getAccessToken()
  if (token && !isTokenExpired(token)) return 'ok'
  return getRefreshToken() && !sessionVerrouillee() ? 'renouvellement' : 'perdue'
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const { refreshSession } = useAuth()
  const [etat, setEtat] = useState<Etat>(etatInitial)
  const [ecran, setEcran] = useState<'/pin' | '/login'>(ecranReconnexion)

  useEffect(() => {
    if (etat !== 'renouvellement') return
    let actif = true
    refreshSession().then((ok) => {
      if (!actif) return
      // Refresh refusé : jetons inutilisables effacés ; appareil de confiance → écran PIN, sinon connexion complète
      if (!ok) setEcran(oublierSessionPerdue())
      setEtat(ok ? 'ok' : 'perdue')
    })
    return () => { actif = false }
  }, [etat, refreshSession])

  if (etat === 'renouvellement') {
    return (
      <div className="min-h-screen flex items-center justify-center" aria-busy="true" aria-label="Reprise de la session">
        <Spinner />
      </div>
    )
  }

  if (etat === 'perdue') {
    // Sauvegarde la page demandée pour y revenir après la connexion (même via le code secret)
    memoriserRetour(`${location.pathname}${location.search}`)
    return <Navigate to={ecran} state={{ from: location }} replace />
  }

  return <>{children}</>
}
