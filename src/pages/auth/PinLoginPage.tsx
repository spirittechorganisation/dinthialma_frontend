import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LogOut, Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getUserPhone, clearAll, clearTokens, getRefreshToken, getClientType, setPinConfigured } from '@/lib/tokenStorage'
import { getAppareilId } from '@/lib/appareil'
import { actionPin, compteARebours, finAttente } from '@/lib/securite'
import { useCompteARebours } from '@/hooks/useCompteARebours'
import { PinScreen, PIN_LENGTH } from '@/components/auth/PinPad'
import { UserRole } from '@/types/common'
import { getHomePath } from '@/lib/homePath'
import { consommerRetour } from '@/lib/retour'
import api from '@/services/api'

export function PinLoginPage() {
  const navigate = useNavigate()
  const { loginWithPin, user } = useAuth()

  const phone = getUserPhone()
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [shake, setShake] = useState(false)
  // PIN_LOCKED (SE07) : clavier bloqué jusqu'à cette date, compte à rebours affiché
  const [verrouJusqua, setVerrouJusqua] = useState<number | null>(null)
  const attente = useCompteARebours(verrouJusqua)

  const redirectAfterLogin = (roles: UserRole[]) => {
    navigate(consommerRetour() ?? getHomePath(roles), { replace: true })
  }

  useEffect(() => {
    if (user) redirectAfterLogin(user.roles)
  }, [user])

  useEffect(() => {
    if (!phone) navigate('/login', { replace: true })
  }, [phone])

  const handleKey = async (key: string) => {
    if (isLoading || attente > 0) return
    if (key === 'del') { setPin((p) => p.slice(0, -1)); return }
    if (pin.length >= PIN_LENGTH) return

    const next = pin + key
    setPin(next)

    if (next.length === PIN_LENGTH) {
      setIsLoading(true)
      try {
        const authUser = await loginWithPin(phone!, next)
        if (authUser) redirectAfterLogin(authUser.roles)
      } catch (err) {
        setPin('')
        setShake(true)
        setTimeout(() => setShake(false), 500)

        // FR31 (B53, SE07) : action selon le code ; le numéro reste mémorisé pour la connexion par mot de passe
        const action = actionPin(err)
        switch (action.type) {
          case 'motDePasse':
            // Plus de session pour cet appareil (utilisateur d'avant B53, session révoquée) : une fois le mot
            // de passe, l'appareil devient de confiance et le PIN suffit ensuite
            clearTokens()
            navigate('/login', { replace: true, state: { raison: 'pin-session' } })
            break
          case 'desactive':
            clearTokens()
            setPinConfigured(false)
            toast.error(action.texte)
            navigate('/login', { replace: true, state: { raison: 'pin-desactive' } })
            break
          case 'creerPin':
            clearTokens()
            setPinConfigured(false)
            navigate('/login', { replace: true, state: { raison: 'pin-absent' } })
            break
          case 'reinitialiser':
            toast.error(action.texte)
            navigate('/pin/reset', { replace: true })
            break
          case 'verrouille':
            setVerrouJusqua(finAttente(action.retryAfterSeconds ?? 900))
            toast.error(action.texte)
            break
          default:
            toast.error(action.texte)
        }
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleForgotPIN = () => navigate('/pin/reset')

  const handleChangeAccount = async () => {
    const refreshToken = getRefreshToken()
    const clientType   = getClientType()
    try {
      // B53 : révoque la session de confiance de cet appareil ; l'appareilId est gardé
      if (refreshToken) await api.post('/v1/auth/logout', { refreshToken, clientType, appareilId: getAppareilId() })
    } catch { /* non bloquant */ } finally {
      clearAll()
      navigate('/login', { replace: true })
    }
  }

  const displayPhone = phone
    ? ('+' + phone).replace(/(\+\d{3})(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')
    : ''

  return (
    <PinScreen
      title={attente > 0 ? 'Code verrouillé' : 'Bon retour'}
      subtitle={attente > 0 ? <span role="status">Trop d’essais. Réessayez dans {compteARebours(attente)}</span> : displayPhone}
      badge={
        <span className="w-16 h-16 rounded-full bg-white/15 ring-2 ring-white/25 lg:bg-primary-50 lg:ring-primary-100 flex items-center justify-center text-white lg:text-primary-700">
          <Lock size={26} />
        </span>
      }
      value={pin}
      shake={shake}
      loading={isLoading}
      onKey={handleKey}
      topAction={
        <button onClick={handleChangeAccount} className="flex items-center gap-1.5 h-9 px-3 rounded-full text-white/80 text-xs font-medium hover:bg-white/10">
          <LogOut size={14} /> Changer de compte
        </button>
      }
      footer={
        <div className="flex items-center justify-center lg:justify-between gap-4">
          <button onClick={handleForgotPIN} className="h-11 px-4 rounded-full text-sm font-semibold text-white lg:text-primary-700 hover:bg-white/10 lg:hover:bg-primary-50">
            PIN oublié ?
          </button>
          <button onClick={handleChangeAccount} className="hidden lg:flex items-center gap-1.5 h-11 px-4 rounded-full text-sm text-neutral-500 hover:bg-neutral-100">
            <LogOut size={14} /> Changer de compte
          </button>
        </div>
      }
    />
  )
}
