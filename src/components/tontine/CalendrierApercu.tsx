import { CalendarCheck2 } from 'lucide-react'
import { formatEcheance } from '@/lib/format'
import type { SimulationCalendrier } from '@/types/tontine'

/**
 * « Ce que ça donne » : les dates clés calculées par le backend (mêmes règles qu'à l'activation),
 * dites en une ou deux phrases. Rien ne s'affiche tant que le calcul n'a pas répondu
 * (hors connexion, l'écran reste utilisable sans ces dates).
 */
export function CalendrierApercu({ simulation, isEvent, chargement }: {
  simulation: SimulationCalendrier | undefined
  isEvent: boolean
  chargement?: boolean
}) {
  if (!simulation || !simulation.premiereEcheance) {
    return chargement ? <div className="h-16 rounded-2xl bg-primary-50/60 animate-pulse" aria-busy="true" /> : null
  }
  const n = simulation.echeances.length
  const tours = simulation.nombreTours

  return (
    <div className="rounded-2xl bg-primary-50 px-4 py-3 flex gap-2.5" aria-live="polite">
      <CalendarCheck2 size={18} className="text-primary-700 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-neutral-800 space-y-0.5">
        <p>Première cotisation avant <b>{formatEcheance(simulation.premiereEcheance)}</b>.</p>
        {isEvent ? (
          n > 0 && <p><b>{n} cotisation{n > 1 ? 's' : ''}</b> jusqu'au {formatEcheance(simulation.derniereEcheance)}.</p>
        ) : (
          tours > 0 && <p><b>{tours} tours</b>, dernière cotisation le {formatEcheance(simulation.derniereEcheance)}.</p>
        )}
      </div>
    </div>
  )
}
