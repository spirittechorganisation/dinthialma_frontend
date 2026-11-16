/**
 * Feuille « Installer l'application » — couvre les 4 situations :
 *
 * 1. prompt  : Android / Chrome / Edge desktop → dialog natif en 1 clic
 * 2. ios     : iOS Safari → instructions pas-à-pas avec visuels emoji
 * 3. unsupported : Firefox desktop / Safari desktop → lien vers Chrome/Edge
 * 4. installed : déjà installée (cas défensif, ne devrait pas s'afficher)
 *
 * Utilisé depuis ParametresPage (ligne « Installer l'application »).
 */
import { Modal } from '@/components/ui/Modal'
import { Download, Share, PlusSquare, Chrome, CheckCircle2 } from 'lucide-react'
import { usePWA } from '@/hooks/usePWA'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function InstallSheet({ isOpen, onClose }: Props) {
  const { modeInstall, triggerInstall } = usePWA()

  const handleInstall = async () => {
    await triggerInstall()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Installer l'application" size="sm">
      {modeInstall === 'prompt' && (
        // ── Android / Chrome / Edge : dialog natif ──────────────────────────
        <div className="space-y-4">
          <p className="text-neutral-600">
            Ajoutez Dinthialma sur votre écran d'accueil pour l'ouvrir comme une application native,
            même sans connexion internet.
          </p>
          <ul className="space-y-2 text-sm text-neutral-700">
            <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-primary-600 flex-shrink-0" /> Accès en un tap depuis l'écran d'accueil</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-primary-600 flex-shrink-0" /> Fonctionne hors connexion</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-primary-600 flex-shrink-0" /> Pas de téléchargement sur le store</li>
          </ul>
          <button
            onClick={handleInstall}
            className="w-full h-14 rounded-full bg-primary-700 text-white text-[17px] font-bold flex items-center justify-center gap-2"
          >
            <Download size={20} />
            Installer maintenant
          </button>
        </div>
      )}

      {modeInstall === 'ios' && (
        // ── iOS Safari : pas d'API → instructions pas-à-pas ─────────────────
        <div className="space-y-5">
          <p className="text-neutral-600 text-sm">
            Sur iPhone et iPad, Safari ne permet pas l'installation automatique.
            Suivez ces 3 étapes rapides :
          </p>

          <ol className="space-y-4">
            <li className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-primary-700 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">1</span>
              <div>
                <p className="font-semibold text-neutral-900 flex items-center gap-1.5">
                  Appuyez sur <Share size={16} className="text-blue-500" /> <span className="text-blue-500">Partager</span>
                </p>
                <p className="text-sm text-neutral-500 mt-0.5">En bas de l'écran dans Safari (icône carré avec flèche).</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-primary-700 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">2</span>
              <div>
                <p className="font-semibold text-neutral-900 flex items-center gap-1.5">
                  Choisissez <PlusSquare size={16} className="text-neutral-700" /> <span>Sur l'écran d'accueil</span>
                </p>
                <p className="text-sm text-neutral-500 mt-0.5">Faites défiler le menu vers le bas si vous ne le voyez pas.</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-primary-700 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">3</span>
              <div>
                <p className="font-semibold text-neutral-900">Appuyez sur <span className="text-primary-700">Ajouter</span></p>
                <p className="text-sm text-neutral-500 mt-0.5">L'icône Dinthialma apparaîtra sur votre écran d'accueil.</p>
              </div>
            </li>
          </ol>

          <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
            ⚠️ Ces étapes fonctionnent uniquement dans <strong>Safari</strong>. Si vous utilisez Chrome ou Firefox sur iPhone, ouvrez cette page dans Safari.
          </div>

          <button onClick={onClose} className="w-full h-12 rounded-full bg-neutral-100 font-semibold text-neutral-800">
            Compris
          </button>
        </div>
      )}

      {modeInstall === 'unsupported' && (
        // ── Firefox / Safari desktop : pas de support → guider vers Chrome ou Edge ──
        <div className="space-y-4">
          <p className="text-neutral-600 text-sm">
            Votre navigateur actuel ne supporte pas l'installation d'applications web (PWA).
          </p>

          <p className="text-sm text-neutral-700 font-semibold">Pour installer Dinthialma sur votre ordinateur :</p>

          <ol className="space-y-3 text-sm text-neutral-700">
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary-700 flex-shrink-0">1.</span>
              <span>Ouvrez cette page dans <strong>Microsoft Edge</strong> ou <strong>Google Chrome</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary-700 flex-shrink-0">2.</span>
              <span>Cliquez sur l'icône <Chrome size={14} className="inline mb-0.5" /> d'installation dans la barre d'adresse (à droite).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary-700 flex-shrink-0">3.</span>
              <span>Cliquez sur <strong>Installer</strong>.</span>
            </li>
          </ol>

          <div className="flex gap-2">
            <button
              onClick={() => window.open('https://www.microsoft.com/edge', '_blank', 'noopener')}
              className="flex-1 h-12 rounded-full bg-neutral-100 text-neutral-800 font-semibold flex items-center justify-center gap-2 text-sm"
            >
              Télécharger Edge
            </button>
            <button
              onClick={() => window.open('https://www.google.com/chrome/', '_blank', 'noopener')}
              className="flex-1 h-12 rounded-full bg-neutral-100 text-neutral-800 font-semibold flex items-center justify-center gap-2 text-sm"
            >
              <Chrome size={16} /> Chrome
            </button>
          </div>

          <button onClick={onClose} className="w-full h-11 rounded-full border border-neutral-200 text-sm font-medium text-neutral-500">
            Fermer
          </button>
        </div>
      )}

      {modeInstall === 'installed' && (
        <div className="text-center py-4 space-y-3">
          <span className="mx-auto w-16 h-16 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center">
            <CheckCircle2 size={32} />
          </span>
          <p className="font-bold text-neutral-900">Application déjà installée</p>
          <p className="text-sm text-neutral-500">Dinthialma est disponible sur votre écran d'accueil.</p>
          <button onClick={onClose} className="w-full h-12 rounded-full bg-primary-700 text-white font-bold">
            OK
          </button>
        </div>
      )}
    </Modal>
  )
}
