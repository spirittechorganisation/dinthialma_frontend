/**
 * FR29 — Réglages d'une épargne : « Retraits avant la fin autorisés » (`regleRetrait` LIBRE / INTERDIT, B42).
 */
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { useModifierRegleRetrait } from '@/hooks/useRetraits'
import { erreurRetrait } from '@/lib/retraits'

export function RegleRetrait({ tontineId, regle, online }: { tontineId: string; regle: 'LIBRE' | 'INTERDIT' | null | undefined; online: boolean }) {
  const { mutate, isPending, variables } = useModifierRegleRetrait()
  // Affiche tout de suite le choix envoyé, le temps que la tontine soit relue
  const autorise = (isPending ? variables?.regleRetrait : regle ?? 'INTERDIT') === 'LIBRE'

  const basculer = () => mutate(
    { tontineId, regleRetrait: autorise ? 'INTERDIT' : 'LIBRE' },
    {
      onSuccess: (t) => toast.success(t.regleRetrait === 'LIBRE' ? 'Retraits avant la fin autorisés' : 'Retraits avant la fin désactivés'),
      onError: (err) => toast.error(erreurRetrait(err, 'Le réglage n’a pas pu être enregistré. Réessayez.').texte),
    },
  )

  return (
    <section className="bg-white rounded-3xl shadow-sm p-4" aria-labelledby="regle-retrait">
      <div className="flex items-center gap-3">
        <h2 id="regle-retrait" className="flex-1 text-[15px] font-semibold text-neutral-900">Retraits avant la fin autorisés</h2>
        <button
          type="button"
          role="switch"
          aria-checked={autorise}
          aria-labelledby="regle-retrait"
          onClick={basculer}
          disabled={!online || isPending}
          className={clsx('relative h-8 w-14 flex-shrink-0 rounded-full transition disabled:opacity-50', autorise ? 'bg-primary-700' : 'bg-neutral-300')}
        >
          <span className={clsx('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', autorise ? 'left-7' : 'left-1')} />
        </button>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        {autorise
          ? 'Vous pouvez remettre à un membre une partie ou la totalité de son épargne avant la fin, puis l’enregistrer sur sa fiche. La répartition finale se fait sur ce qui reste.'
          : 'Personne ne peut retirer avant la fin : chacun récupère tout ce qu’il a cotisé à la répartition finale.'}
      </p>
    </section>
  )
}
