/**
 * FR29 — Fiche d'un membre d'une épargne (gestionnaire) : cotisé, retiré, solde ; « Enregistrer un retrait » ;
 * historique des retraits avec « Annuler » (motif obligatoire, confirmation).
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { RetraitModal } from '@/components/epargne/RetraitModal'
import { useAnnulerRetrait, useRetraits, useSoldeMembre } from '@/hooks/useRetraits'
import { useOnline } from '@/hooks/useOnline'
import { formatF, formatDateCourte } from '@/lib/format'
import { erreurRetrait, estSolde, moyenRemise } from '@/lib/retraits'
import { TontineStatut } from '@/types/common'
import type { Retrait } from '@/types/retrait'
import type { Tontine } from '@/types/tontine'

interface EpargneMembreProps {
  tontine: Pick<Tontine, 'id' | 'statut' | 'dateDebut' | 'regleRetrait'>
  membreId: string
  prenom: string
}

export function EpargneMembre({ tontine, membreId, prenom }: EpargneMembreProps) {
  const online = useOnline()
  const solde = useSoldeMembre(tontine.id, membreId)
  const retraits = useRetraits(tontine.id, membreId)
  const { mutate: annuler, isPending: annulation } = useAnnulerRetrait()
  const [saisieOuverte, setSaisieOuverte] = useState(false)
  const [aAnnuler, setAAnnuler] = useState<Retrait | null>(null)
  const [motif, setMotif] = useState('')
  const [erreurAnnulation, setErreurAnnulation] = useState<string | null>(null)

  const s = solde.data
  const soldeDispo = s?.solde ?? 0
  const membreSolde = estSolde(s)
  const enCours = tontine.statut === TontineStatut.ACTIVE || tontine.statut === TontineStatut.SUSPENDUE
  const autorise = tontine.regleRetrait !== 'INTERDIT'
  const liste = retraits.data?.content ?? []

  const fermerAnnulation = () => { setAAnnuler(null); setMotif(''); setErreurAnnulation(null) }
  const confirmerAnnulation = () => {
    if (!aAnnuler) return
    if (!motif.trim()) { setErreurAnnulation('Indiquez le motif de l’annulation.'); return }
    annuler(
      { tontineId: tontine.id, retraitId: aAnnuler.id, motif: motif.trim() },
      {
        onSuccess: (r) => {
          toast.success('Retrait annulé', { description: r.soldeRestant != null ? `Solde de ${prenom} : ${formatF(r.soldeRestant)}` : undefined })
          fermerAnnulation()
        },
        onError: (err) => setErreurAnnulation(erreurRetrait(err, 'L’annulation a échoué. Réessayez.').texte),
      },
    )
  }

  return (
    <>
      <section className="bg-white rounded-3xl shadow-sm p-5" aria-labelledby="epargne-membre">
        <div className="flex items-center justify-between gap-2">
          <h2 id="epargne-membre" className="text-xs font-semibold tracking-[0.14em] text-neutral-500 uppercase">Épargne</h2>
          {membreSolde && <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">Soldé</span>}
        </div>
        {solde.isLoading ? (
          <div className="mt-3 h-20 rounded-2xl bg-neutral-100 animate-pulse" aria-busy="true" />
        ) : solde.isError ? (
          <p className="mt-3 text-sm text-neutral-500">Solde indisponible pour le moment.</p>
        ) : (
          <>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-neutral-900" aria-label={`Solde ${formatF(soldeDispo)}`}>{formatF(soldeDispo)}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {([['Cotisé', s?.totalCotiseValide], ['Retiré', s?.totalRetire], ['Solde', s?.solde]] as const).map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-neutral-50 py-3">
                  <dt className="text-xs text-neutral-500">{k}</dt>
                  <dd className="text-base font-bold tabular-nums text-neutral-900">{formatF(v)}</dd>
                </div>
              ))}
            </dl>
            {membreSolde && s?.soldeLe && (
              <p className="mt-3 text-sm text-neutral-600">{prenom} a tout retiré le {formatDateCourte(s.soldeLe)} : plus de cotisation, rien à recevoir à la fin.</p>
            )}
            {enCours && !membreSolde && (autorise ? (
              <button
                onClick={() => setSaisieOuverte(true)}
                disabled={!online || soldeDispo <= 0}
                className="mt-4 w-full h-12 rounded-full bg-neutral-900 text-white font-bold disabled:opacity-50"
              >
                Enregistrer un retrait
              </button>
            ) : (
              <p className="mt-4 text-sm text-neutral-600">
                Les retraits avant la fin ne sont pas autorisés.{' '}
                <Link to={`/tontine/${tontine.id}/reglages`} className="font-semibold text-primary-800 underline">Les autoriser</Link>
              </p>
            ))}
          </>
        )}
      </section>

      {liste.length > 0 && (
        <section className="bg-white rounded-3xl shadow-sm" aria-labelledby="retraits-membre">
          <h2 id="retraits-membre" className="px-4 pt-4 text-[17px] font-semibold text-neutral-900">Retraits</h2>
          <ul className="divide-y divide-neutral-100">
            {liste.map((r) => {
              const annule = r.statut === 'ANNULE'
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3 min-h-[64px]">
                  <span className={clsx('min-w-0 flex-1', annule && 'opacity-60')}>
                    <span className="block font-semibold text-neutral-900">
                      {r.nature === 'TOTAL' ? 'Retrait total' : 'Retrait'} · <span className={clsx('tabular-nums', annule && 'line-through')}>{formatF(r.montant)}</span>
                    </span>
                    <span className="block text-sm text-neutral-500 truncate">
                      {moyenRemise(r.methodePaiement).label} · remis le {formatDateCourte(r.dateRemise)}{annule ? ' · annulé' : ''}
                    </span>
                    {(annule ? r.motifAnnulation : r.motif)?.trim() && (
                      <span className="block text-sm italic text-neutral-600 truncate">{annule ? r.motifAnnulation : r.motif}</span>
                    )}
                  </span>
                  {!annule && r.statut === 'REMIS' && enCours && (
                    <button
                      onClick={() => setAAnnuler(r)}
                      disabled={!online}
                      aria-label={`Annuler le retrait de ${formatF(r.montant)}`}
                      className="h-10 px-3 rounded-full bg-neutral-100 text-sm font-semibold text-red-700 disabled:opacity-50"
                    >
                      Annuler
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {saisieOuverte && s && (
        <RetraitModal
          isOpen
          onClose={() => setSaisieOuverte(false)}
          tontineId={tontine.id}
          membreId={membreId}
          prenom={prenom}
          solde={soldeDispo}
          dateDebut={tontine.dateDebut}
        />
      )}

      <Modal isOpen={!!aAnnuler} onClose={fermerAnnulation} title="Annuler ce retrait ?" size="sm">
        {aAnnuler && (
          <div className="space-y-4">
            <p className="text-neutral-600">
              Le retrait de {formatF(aAnnuler.montant)} du {formatDateCourte(aAnnuler.dateRemise)} sera annulé : la somme revient sur le solde de {prenom}.
              {aAnnuler.nature === 'TOTAL' ? ` ${prenom} pourra de nouveau cotiser.` : ''}
            </p>
            <input
              value={motif}
              onChange={(e) => setMotif(e.target.value.slice(0, 200))}
              placeholder="Motif (obligatoire)"
              aria-label="Motif de l’annulation"
              className="w-full h-12 px-4 rounded-2xl bg-neutral-100 text-[16px] outline-none focus:ring-2 focus:ring-primary-600"
            />
            {erreurAnnulation && <p role="alert" className="text-sm font-medium text-red-700">{erreurAnnulation}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={fermerAnnulation} className="h-12 rounded-full bg-neutral-100 font-semibold">Retour</button>
              <button onClick={confirmerAnnulation} disabled={annulation || !online} className="h-12 rounded-full bg-red-600 text-white font-bold disabled:opacity-50">
                {annulation ? '…' : 'Annuler le retrait'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
