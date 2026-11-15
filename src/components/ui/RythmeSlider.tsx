import { Minus, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import { RYTHMES, type Rythme } from '@/lib/tontineLabels'

interface RythmeSliderProps {
  value: Rythme
  onChange: (rythme: Rythme) => void
}

const enJours = (r: Rythme) => r.intervalle * (r.unite === 'JOUR' ? 1 : r.unite === 'SEMAINE' ? 7 : 30)
const memeRythme = (a: Rythme, b: Rythme) => a.intervalle === b.intervalle && a.unite === b.unite

/**
 * Réglage du rythme « comme le volume d'une télé » : une barre à crans, du plus court au plus long,
 * le rythme écrit en gros au-dessus. Tous les rythmes jusqu'à 1 mois (B26) ; un rythme plus long
 * n'apparaît que s'il est déjà celui de la tontine.
 */
export function RythmeSlider({ value, onChange }: RythmeSliderProps) {
  const crans = RYTHMES.some((r) => memeRythme(r, value))
    ? RYTHMES
    : [...RYTHMES, value].sort((a, b) => enJours(a) - enJours(b))
  const index = Math.max(0, crans.findIndex((r) => memeRythme(r, value)))
  const choisi = crans[index]
  const max = crans.length - 1
  const pct = max ? (index / max) * 100 : 0
  const aller = (i: number) => {
    const r = crans[Math.min(max, Math.max(0, i))]
    if (!memeRythme(r, value)) onChange(r)
  }

  return (
    <div>
      <p className="text-sm font-semibold text-neutral-700">Rythme des cotisations</p>
      <p className="mt-3 text-center text-[24px] font-extrabold text-neutral-900" aria-hidden>{choisi.label}</p>

      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => aller(index - 1)} disabled={index === 0} aria-label="Rythme plus court"
          className="w-11 h-11 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center flex-shrink-0 disabled:opacity-40">
          <Minus size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={max}
            step={1}
            value={index}
            onChange={(e) => aller(Number(e.target.value))}
            aria-label="Rythme des cotisations"
            aria-valuetext={choisi.label}
            className="rythme-range w-full"
            style={{ ['--pct' as string]: `${pct}%` }}
          />
          {/* Crans et repères, alignés sur le centre du curseur (marge = demi-largeur du curseur) */}
          <div className="relative h-8 mx-[14px]" aria-hidden>
            {crans.map((r, i) => {
              const left = max ? (i / max) * 100 : 0
              return (
                <span key={r.label} className="absolute top-0 -translate-x-1/2 flex flex-col items-center" style={{ left: `${left}%` }}>
                  <span className={clsx('w-px h-1.5', i <= index ? 'bg-primary-600' : 'bg-neutral-300')} />
                  {(r.repere || i === index) && (
                    <span className={clsx('mt-1 text-[11px] whitespace-nowrap', i === index ? 'font-bold text-primary-800' : 'text-neutral-500', !r.repere && 'bg-white px-1 relative z-10')}>{r.court}</span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
        <button type="button" onClick={() => aller(index + 1)} disabled={index === max} aria-label="Rythme plus long"
          className="w-11 h-11 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center flex-shrink-0 disabled:opacity-40">
          <Plus size={20} />
        </button>
      </div>
    </div>
  )
}
