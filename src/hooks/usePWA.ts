import { useState, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Navigateurs / OS sur lesquels l'API beforeinstallprompt n'est pas disponible */
function detecterPlateforme(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

/** true si l'app tourne déjà en mode standalone (PWA installée) */
function detecterInstalle(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(detecterInstalle)
  const plateforme = detecterPlateforme()
  const isIOS = plateforme === 'ios'

  // ─── Bannière iOS : ne montrer qu'une fois ────────────────────────────────
  const [showIOSBanner, setShowIOSBanner] = useState(() => {
    if (!isIOS || detecterInstalle()) return false
    return !localStorage.getItem('dinthialma-ios-banner-dismissed')
  })

  // ─── Mise à jour disponible (vite-plugin-pwa) ─────────────────────────────
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      // Polling toutes les 60 s : sur mobile l'app reste ouverte des jours entiers
      if (r) {
        setInterval(() => {
          if (!r.installing && navigator.onLine) r.update().catch(() => {})
        }, 60_000)
      }
    },
  })

  useEffect(() => {
    // Android / Chrome / Edge desktop — capturer l'événement beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  /** Déclenche le dialog natif d'installation (Android / desktop Chrome-Edge) */
  const triggerInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setInstallPrompt(null)
  }

  const dismissIOSBanner = () => {
    setShowIOSBanner(false)
    localStorage.setItem('dinthialma-ios-banner-dismissed', '1')
  }

  /** Active le nouveau SW et recharge toutes les pages ouvertes */
  const appliquerMiseAJour = () => updateServiceWorker(true)

  /**
   * Mécanisme d'installation selon la plateforme :
   * - 'prompt'    : API native disponible → appeler triggerInstall()
   * - 'ios'       : iOS Safari → afficher les instructions manuelles
   * - 'installed' : déjà installée
   * - 'unsupported' : navigateur sans support (Firefox, Safari desktop…)
   */
  const modeInstall: 'prompt' | 'ios' | 'installed' | 'unsupported' =
    isInstalled
      ? 'installed'
      : installPrompt
        ? 'prompt'
        : isIOS
          ? 'ios'
          : 'unsupported'

  return {
    // Installation
    modeInstall,
    canInstall: modeInstall === 'prompt',
    isInstalled,
    isIOS,
    showIOSBanner,
    triggerInstall,
    dismissIOSBanner,
    // Mise à jour
    miseAJourDisponible: needRefresh,
    appliquerMiseAJour,
  }
}
