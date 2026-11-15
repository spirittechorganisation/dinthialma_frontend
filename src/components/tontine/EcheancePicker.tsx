import { clsx } from 'clsx'
import { JOURS_SEMAINE, HEURE_ECHEANCE_DEFAUT, heureLisible } from '@/lib/tontineLabels'
import type { RythmeUnite } from '@/types/tontine'

interface EcheancePickerProps {
  unite: RythmeUnite
  /** '' = aucun jour imposé */
  jour: string
  onJour: (jour: string) => void
  /** HH:mm */
  heure: string
  onHeure: (heure: string) => void
}

/** Heures limites proposées en un tap ; « Autre » ouvre le sélecteur d'heure du téléphone */
const HEURES = ['12:00', '18:00', '20:00', HEURE_ECHEANCE_DEFAUT]

/**
 * « Avant quand payer ? » (B26) : jour limite selon le rythme (semaine : L M M J V S D ;
 * mois : 1 à 31 ou dernier jour) et heure limite. Tout est facultatif : sans choix,
 * la cotisation est due à la fin de chaque période, avant minuit.
 */
export function EcheancePicker({ unite, jour, onJour, heure, onHeure }: EcheancePickerProps) {
  const heureConnue = HEURES.includes(heure)

  return (
    <div className="space-y-4">
      {unite === 'SEMAINE' && (
        <div>
          <p className="text-sm font-semibold text-neutral-700">Jour limite de paiement</p>
          <div role="radiogroup" aria-label="Jour limite de paiement" className="mt-2 flex justify-between gap-1">
            {JOURS_SEMAINE.map((j) => {
              const actif = jour === j.code
              return (
                <button
                  key={j.code}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  aria-label={j.label}
                  onClick={() => onJour(actif ? '' : j.code)}
                  className={clsx(
                    'w-11 h-11 rounded-full text-[15px] font-bold transition',
                    actif ? 'bg-primary-700 text-white' : 'bg-neutral-100 text-neutral-700',
                  )}
                >
                  {j.court}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-sm text-neutral-500">
            {jour ? `Chacun paie au plus tard le ${JOURS_SEMAINE.find((j) => j.code === jour)?.label}.` : 'Facultatif : touchez un jour pour l’imposer.'}
          </p>
        </div>
      )}

      {unite === 'MOIS' && (
        <label className="block">
          <span className="text-sm font-semibold text-neutral-700">Jour limite de paiement</span>
          <select
            value={jour}
            onChange={(e) => onJour(e.target.value)}
            className="mt-2 w-full h-12 px-4 rounded-2xl bg-neutral-100 text-[16px] outline-none focus:ring-2 focus:ring-primary-600"
          >
            <option value="">Pas de jour fixe</option>
            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((n) => (
              <option key={n} value={n}>Le {n} du mois</option>
            ))}
            <option value="DERNIER">Le dernier jour du mois</option>
          </select>
          {Number(jour) >= 29 && (
            <span className="mt-1 block text-sm text-neutral-500">Les mois plus courts : le dernier jour du mois.</span>
          )}
        </label>
      )}

      <div>
        <p className="text-sm font-semibold text-neutral-700">Heure limite</p>
        <div role="radiogroup" aria-label="Heure limite de paiement" className="mt-2 flex flex-wrap items-center gap-2">
          {HEURES.map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={heure === h}
              onClick={() => onHeure(h)}
              className={clsx('h-11 px-4 rounded-full text-sm font-semibold', heure === h ? 'bg-primary-700 text-white' : 'bg-neutral-100 text-neutral-700')}
            >
              {h === HEURE_ECHEANCE_DEFAUT ? 'Minuit' : heureLisible(h)}
            </button>
          ))}
          <label className={clsx('h-11 pl-4 pr-2 rounded-full text-sm font-semibold inline-flex items-center gap-2', heureConnue ? 'bg-neutral-100 text-neutral-700' : 'bg-primary-700 text-white')}>
            Autre
            <input
              type="time"
              value={heure}
              onChange={(e) => e.target.value && onHeure(e.target.value)}
              aria-label="Autre heure limite"
              className="h-8 px-2 rounded-full bg-white text-neutral-900 text-sm tabular-nums outline-none"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
