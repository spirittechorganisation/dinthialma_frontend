import { useEffect, useRef } from 'react'
import { Delete } from 'lucide-react'
import { formatF } from '@/lib/format'

interface AmountPadProps {
  value: number
  onChange: (value: number) => void
  /** Montant maximum accepté (garde-fou de saisie) */
  max?: number
  /**
   * Montant prérempli (FR24) : la première touche le remplace au lieu de s'y ajouter
   * (5 sur 2.000 donne 5, pas 20.005). Au parent de repasser à false après le premier changement.
   */
  remplacer?: boolean
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'] as const

/**
 * Pavé numérique pour saisir un montant en FCFA (touches 64 px, séparateur de milliers à l'affichage).
 * Desktop : le clavier physique fonctionne aussi (chiffres, Retour arrière), sauf si un champ de saisie a le focus.
 */
export function AmountPad({ value, onChange, max = 100_000_000, remplacer = false }: AmountPadProps) {
  const press = (k: (typeof KEYS)[number]) => {
    const base = remplacer ? 0 : value
    if (k === 'del') {
      onChange(Math.floor(base / 10))
      return
    }
    const next = Number(`${base || ''}${k}`)
    if (Number.isFinite(next) && next <= max) onChange(next)
  }

  // Référence à jour pour l'écouteur clavier (évite de le réabonner à chaque frappe)
  const pressRef = useRef(press)
  // eslint-disable-next-line react-hooks/refs -- pattern stable-ref intentionnel
  pressRef.current = press
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); pressRef.current(e.key as (typeof KEYS)[number]) }
      else if (e.key === 'Backspace') { e.preventDefault(); pressRef.current('del') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="grid grid-cols-3 gap-2" aria-label="Pavé numérique">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          aria-label={k === 'del' ? 'Effacer' : k}
          className="h-16 rounded-2xl bg-neutral-100 text-2xl font-semibold text-neutral-900 active:bg-neutral-200 active:scale-[0.97] transition flex items-center justify-center"
        >
          {k === 'del' ? <Delete size={24} /> : k}
        </button>
      ))}
    </div>
  )
}

/** Montant affiché en très grand au-dessus du pavé */
export function BigAmount({ value, placeholder = '0F' }: { value: number | null; placeholder?: string }) {
  return (
    <p className="text-center text-[48px] leading-none font-extrabold tabular-nums text-neutral-900" aria-live="polite">
      {value ? formatF(value) : <span className="text-neutral-300">{placeholder}</span>}
    </p>
  )
}
