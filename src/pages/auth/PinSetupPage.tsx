/**
 * Création du code secret : 6 chiffres, confirmation, puis mot de passe (FR31, B53) pour que ce téléphone
 * devienne un appareil de confiance : le PIN suffira ensuite pendant des mois, comme Wave ou Orange Money.
 * Mot de passe faux (INVALID_CREDENTIALS) : on le redemande, le PIN n'est pas créé.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import { PinScreen, PIN_LENGTH } from '@/components/auth/PinPad'
import { AuthShell, AuthAlert } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/Button'
import { motDePasseRefuse } from '@/lib/securite'
import { messageErreur } from '@/lib/apiError'
import { useAuth } from '@/hooks/useAuth'
import { getHomePath } from '@/lib/homePath'
import { consommerRetour } from '@/lib/retour'

type SetupStep = 'create' | 'confirm' | 'password'

export function PinSetupPage() {
  const navigate = useNavigate()
  const { setupPin, user } = useAuth()

  const [step, setStep] = useState<SetupStep>('create')
  const [firstPin, setFirstPin] = useState('')
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(false)
  const [motDePasse, setMotDePasse] = useState('')
  const [voirMotDePasse, setVoirMotDePasse] = useState(false)
  const [erreurMotDePasse, setErreurMotDePasse] = useState<string | null>(null)

  const redirectAfterLogin = () => {
    if (!user) { navigate('/login', { replace: true }); return }
    navigate(consommerRetour() ?? getHomePath(user.roles), { replace: true })
  }

  const handleKey = async (key: string) => {
    if (isLoading) return
    if (key === 'del') { setPin((p) => p.slice(0, -1)); return }
    if (pin.length >= PIN_LENGTH) return

    const next = pin + key
    setPin(next)
    if (next.length < PIN_LENGTH) return

    if (step === 'create') {
      setFirstPin(next)
      setPin('')
      setStep('confirm')
      return
    }

    if (next !== firstPin) {
      setError(true)
      setTimeout(() => { setError(false); setPin(''); setStep('create'); setFirstPin('') }, 700)
      toast.error('Les codes ne correspondent pas. Recommencez.')
      return
    }

    // PIN confirmé : il reste le mot de passe, pour que cet appareil devienne de confiance
    setStep('password')
  }

  const recommencer = () => { setPin(''); setFirstPin(''); setMotDePasse(''); setErreurMotDePasse(null); setStep('create') }

  const enregistrer = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (isLoading || !motDePasse) return
    setErreurMotDePasse(null)
    setIsLoading(true)
    try {
      await setupPin(pin, pin, motDePasse)
      toast.success('Code secret créé : ce téléphone se souviendra de vous.')
      redirectAfterLogin()
    } catch (err) {
      if (motDePasseRefuse(err)) {
        setErreurMotDePasse('Mot de passe incorrect. Votre code secret n’a pas encore été créé.')
        setMotDePasse('')
      } else {
        toast.error(messageErreur(err, 'Erreur lors de la configuration. Réessayez.'))
        recommencer()
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkip = () => redirectAfterLogin()

  if (step === 'password') {
    return (
      <AuthShell title="Dernière étape" subtitle="Confirmez votre mot de passe pour que ce téléphone se souvienne de vous.">
        <form onSubmit={enregistrer} noValidate className="space-y-4">
          <AuthAlert tone="info">Ensuite, votre code secret suffira pour vous connecter sur ce téléphone, pendant des mois.</AuthAlert>
          <label htmlFor="pin-mdp" className="sr-only">Mot de passe</label>
          <div className={clsx(
            'flex items-center h-16 rounded-2xl border-2 transition-colors',
            erreurMotDePasse ? 'border-red-300 bg-red-50/40' : 'bg-neutral-100 border-transparent focus-within:border-primary-600 focus-within:bg-white',
          )}>
            <input
              id="pin-mdp"
              autoFocus
              type={voirMotDePasse ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Mot de passe"
              value={motDePasse}
              onChange={(e) => { setMotDePasse(e.target.value); if (erreurMotDePasse) setErreurMotDePasse(null) }}
              aria-invalid={!!erreurMotDePasse}
              aria-describedby={erreurMotDePasse ? 'pin-mdp-erreur' : undefined}
              className="flex-1 min-w-0 h-full bg-transparent pl-4 text-[18px] text-neutral-900 placeholder:text-neutral-400 outline-none"
            />
            <button
              type="button"
              onClick={() => setVoirMotDePasse((v) => !v)}
              className="w-12 h-12 mr-1 rounded-full flex items-center justify-center text-neutral-500 hover:bg-black/5"
              aria-label={voirMotDePasse ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {voirMotDePasse ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {erreurMotDePasse && <p id="pin-mdp-erreur" role="alert" className="text-sm font-medium text-red-700">{erreurMotDePasse}</p>}
          <Button type="submit" className="w-full" size="lg" loading={isLoading} disabled={!motDePasse}>
            Créer mon code secret
          </Button>
          <button type="button" onClick={recommencer} className="w-full h-11 rounded-full text-sm text-neutral-500 hover:bg-neutral-100">
            Choisir un autre code
          </button>
        </form>
      </AuthShell>
    )
  }

  return (
    <PinScreen
      title={step === 'create' ? 'Créez votre PIN' : 'Confirmez votre PIN'}
      subtitle={step === 'create'
        ? 'Choisissez 6 chiffres pour vous connecter rapidement, sans mot de passe.'
        : 'Saisissez à nouveau les mêmes 6 chiffres.'}
      steps={{ current: step === 'create' ? 1 : 2, total: 2 }}
      badge={
        <span className="w-16 h-16 rounded-full bg-white/15 ring-2 ring-white/25 lg:bg-primary-50 lg:ring-primary-100 flex items-center justify-center text-white lg:text-primary-700">
          {step === 'create' ? <KeyRound size={26} /> : <ShieldCheck size={26} />}
        </span>
      }
      value={pin}
      error={error}
      shake={error}
      loading={isLoading}
      loadingLabel="Configuration…"
      onKey={handleKey}
      topAction={
        <button onClick={handleSkip} className="flex items-center gap-1 h-9 px-3 rounded-full text-white/80 text-xs font-medium hover:bg-white/10">
          Plus tard <ArrowRight size={13} />
        </button>
      }
      footer={
        <button onClick={handleSkip} className="hidden lg:flex w-full items-center justify-center gap-1 h-11 rounded-full text-sm text-neutral-500 hover:bg-neutral-100">
          Configurer plus tard <ArrowRight size={14} />
        </button>
      }
    />
  )
}
