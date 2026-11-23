/**
 * FR29 — Tableaux d'une épargne (événementielle) sur la fiche de la tontine.
 *
 * - `EpargneParMembre` (gestionnaire, épargne en cours) : récapitulatif total, colonnes Cotisé, Retiré, Solde ;
 *   badges « Soldé » et « Sorti ».
 * - `RepartitionFinale` : lue depuis `GET /distribution` (B51) ; colonnes Cotisé, Retiré, (Commission), Net,
 *   totaux et date. Un membre ne reçoit que sa ligne. Pas encore distribuée : rien n'est affiché.
 */
import { clsx } from 'clsx'
import { useRecapTotal } from '@/hooks/useCotisations'
import { useDistribution } from '@/hooks/useRetraits'
import { formatF, formatDateCourte } from '@/lib/format'
import { estSolde } from '@/lib/retraits'
import { MembreStatut } from '@/types/common'

const th = 'py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500'
const num = 'py-2.5 pl-2 text-right text-sm tabular-nums whitespace-nowrap'

function Badges({ solde, statut }: { solde: boolean; statut?: MembreStatut }) {
  return (
    <>
      {solde && <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">Soldé</span>}
      {statut === MembreStatut.SORTI && <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">Sorti</span>}
    </>
  )
}

export function EpargneParMembre({ tontineId }: { tontineId: string }) {
  const recap = useRecapTotal(tontineId, 0, 200)
  const lignes = recap.data?.content ?? []
  if (lignes.length === 0) return null
  const total = (k: 'totalCotise' | 'totalRetire' | 'solde') => lignes.reduce((s, l) => s + (l[k] ?? (k === 'solde' ? l.totalCotise : 0)), 0)

  return (
    <section className="bg-white rounded-3xl shadow-sm p-4" aria-labelledby="epargne-par-membre">
      <h2 id="epargne-par-membre" className="text-[17px] font-semibold text-neutral-900">Épargne par membre</h2>
      <table className="mt-2 w-full">
        <thead>
          <tr className="text-left">
            <th scope="col" className={th}>Membre</th>
            <th scope="col" className={clsx(th, 'text-right')}>Cotisé</th>
            <th scope="col" className={clsx(th, 'text-right')}>Retiré</th>
            <th scope="col" className={clsx(th, 'text-right')}>Solde</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {lignes.map((l) => {
            const solde = estSolde(l)
            return (
              <tr key={l.membreId} className={clsx((solde || l.statutMembre !== MembreStatut.ACTIF) && 'opacity-60')}>
                <td className="py-2.5 pr-1">
                  <span className="block text-sm font-medium text-neutral-900 truncate max-w-[9rem]">{l.firstName} {l.lastName}</span>
                  <span className="flex gap-1"><Badges solde={solde} statut={l.statutMembre} /></span>
                </td>
                <td className={num}>{formatF(l.totalCotise)}</td>
                <td className={num}>{formatF(l.totalRetire ?? 0)}</td>
                <td className={clsx(num, 'font-bold')}>{formatF(l.solde ?? l.totalCotise)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-200">
            <th scope="row" className="py-2.5 text-left text-sm font-semibold text-neutral-700">Total</th>
            <td className={clsx(num, 'font-semibold')}>{formatF(total('totalCotise'))}</td>
            <td className={clsx(num, 'font-semibold')}>{formatF(total('totalRetire'))}</td>
            <td className={clsx(num, 'font-bold')}>{formatF(total('solde'))}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  )
}

export function RepartitionFinale({ tontineId, gerant }: { tontineId: string; gerant: boolean }) {
  const { data: d } = useDistribution(tontineId)
  // Pas encore distribuée (null), en chargement ou en erreur : rien
  if (!d || d.lignes.length === 0) return null
  const commission = d.totalCommission > 0

  return (
    <section className="bg-white rounded-3xl shadow-sm p-4" aria-labelledby="repartition-finale">
      <h2 id="repartition-finale" className="text-[17px] font-semibold text-neutral-900">Répartition finale</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Faite le {formatDateCourte(d.dateDistribution)} · {gerant ? `${d.nombreMembres} membre${d.nombreMembres > 1 ? 's' : ''}` : 'votre part'}
      </p>
      <table className="mt-2 w-full">
        <thead>
          <tr className="text-left">
            <th scope="col" className={th}>Membre</th>
            <th scope="col" className={clsx(th, 'text-right')}>Cotisé</th>
            <th scope="col" className={clsx(th, 'text-right')}>Retiré</th>
            {commission && <th scope="col" className={clsx(th, 'text-right')}>Comm.</th>}
            <th scope="col" className={clsx(th, 'text-right')}>Net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {d.lignes.map((l) => (
            <tr key={l.membreId} className={clsx(l.statutMembre && l.statutMembre !== MembreStatut.ACTIF && 'opacity-60')}>
              <td className="py-2.5 pr-1">
                <span className="block text-sm font-medium text-neutral-900 truncate max-w-[9rem]">{l.firstName} {l.lastName}</span>
                <span className="flex gap-1"><Badges solde={l.montantNet === 0 && l.montantRetire > 0} statut={l.statutMembre} /></span>
              </td>
              <td className={num}>{formatF(l.montantCotise)}</td>
              <td className={num}>{formatF(l.montantRetire)}</td>
              {commission && <td className={num}>{formatF(l.montantCommission)}</td>}
              <td className={clsx(num, 'font-bold')}>{formatF(l.montantNet)}</td>
            </tr>
          ))}
        </tbody>
        {gerant && (
          <tfoot>
            <tr className="border-t border-neutral-200">
              <th scope="row" className="py-2.5 text-left text-sm font-semibold text-neutral-700">Total</th>
              <td className={clsx(num, 'font-semibold')}>{formatF(d.totalCotise)}</td>
              <td className={clsx(num, 'font-semibold')}>{formatF(d.totalRetire)}</td>
              {commission && <td className={clsx(num, 'font-semibold')}>{formatF(d.totalCommission)}</td>}
              <td className={clsx(num, 'font-bold')}>{formatF(d.totalNet)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </section>
  )
}
