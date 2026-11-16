/**
 * T9 — Priorités de jackpot (vue membre).
 * Accessible depuis la fiche tontine (rotative active, utilisateur membre non encore gratifié).
 * Permet de demander la priorité, de voir ses demandes passées, et d'annuler une demande en attente.
 *
 * URL : /tontine/:id/priorites
 */
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Star, Clock, CheckCircle2, XCircle, RotateCw, AlertTriangle } from 'lucide-react'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Modal } from '@/components/ui/Modal'
import { usePriorites, useDemanderPriorite, useAnnulerPriorite } from '@/hooks/usePriorites'
import { useOnline } from '@/hooks/useOnline'
import { formatDateHeure } from '@/lib/format'
import { messageErreur } from '@/lib/apiError'
import type { PrioriteJackpot, StatutPriorite } from '@/types/priorite'

const STATUT_LABEL: Record<StatutPriorite, { label: string; className: string; icon: React.ReactNode }> = {
  EN_ATTENTE: { label: 'En attente', className: 'bg-amber-100 text-amber-800', icon: <Clock size={14} /> },
  ACCEPTEE:   { label: 'Accordée',   className: 'bg-primary-100 text-primary-800', icon: <CheckCircle2 size={14} /> },
  REFUSEE:    { label: 'Refusée',    className: 'bg-red-100 text-red-700',    icon: <XCircle size={14} /> },
  ANNULEE:    { label: 'Annulée',    className: 'bg-neutral-100 text-neutral-500', icon: <XCircle size={14} /> },
  SERVIE:     { label: 'Servie',     className: 'bg-green-100 text-green-800', icon: <Star size={14} /> },
}

export function PrioritesPage() {
  const { id: tontineId = '' } = useParams()
  const online = useOnline()
  const { data, isLoading, isError, refetch } = usePriorites(tontineId)
  const { mutate: demander, isPending: demandePending } = useDemanderPriorite(tontineId)
  const { mutate: annuler, isPending: annulPending } = useAnnulerPriorite(tontineId)

  const [motif, setMotif] = useState('')
  const [demanderOpen, setDemanderOpen] = useState(false)
  const [aAnnuler, setAAnnuler] = useState<PrioriteJackpot | null>(null)

  const priorites = data?.content ?? []
  const enAttente = priorites.find((p) => p.statut === 'EN_ATTENTE')

  const submitDemande = () => {
    demander(
      { motif: motif.trim() || undefined },
      {
        onSuccess: () => { toast.success('Demande envoyée au gestionnaire'); setDemanderOpen(false); setMotif('') },
        onError: (e) => toast.error(messageErreur(e, 'La demande a échoué. Réessayez.')),
      },
    )
  }

  const submitAnnuler = () => {
    if (!aAnnuler) return
    annuler(aAnnuler.id, {
      onSuccess: () => { toast.success('Demande annulée'); setAAnnuler(null) },
      onError: (e) => toast.error(messageErreur(e, "L'annulation a échoué.")),
    })
  }

  return (
    <div className="min-h-[100dvh] bg-[#f2f3f5]">
      <ScreenHeader title="Priorité de jackpot" />
      <main className="px-4 pb-8 max-w-lg mx-auto space-y-5">

        {/* Explication */}
        <section className="bg-white rounded-3xl shadow-sm p-5 flex items-start gap-3">
          <Star size={22} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-neutral-900">Qu'est-ce que la priorité ?</p>
            <p className="mt-1 text-sm text-neutral-500">
              Si vous avez besoin du jackpot avant votre tour habituel, vous pouvez en faire la demande au gestionnaire.
              S'il l'accorde, vous recevrez le prochain jackpot disponible.
            </p>
          </div>
        </section>

        {/* Bouton demander (seulement si pas de demande active) */}
        {!enAttente && (
          <button
            onClick={() => setDemanderOpen(true)}
            disabled={!online}
            className="w-full h-14 rounded-full bg-primary-700 text-white text-[17px] font-bold disabled:opacity-50"
          >
            Demander la priorité
          </button>
        )}

        {enAttente && (
          <section className="bg-amber-50 border border-amber-200 rounded-3xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-900">Demande en attente</p>
              <p className="text-sm text-amber-700">Votre demande a été transmise au gestionnaire.</p>
            </div>
            <button
              onClick={() => setAAnnuler(enAttente)}
              disabled={!online || annulPending}
              className="flex-shrink-0 h-9 px-3 rounded-full text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              Annuler
            </button>
          </section>
        )}

        {/* Historique des demandes */}
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1].map((i) => <div key={i} className="h-16 rounded-3xl bg-white animate-pulse" />)}
          </div>
        ) : isError ? (
          <section className="bg-white rounded-3xl shadow-sm p-6 text-center">
            <p className="text-sm text-neutral-600">Impossible de charger l'historique.</p>
            <button onClick={() => refetch()} className="mt-3 h-11 px-4 rounded-full bg-neutral-100 text-sm font-semibold inline-flex items-center gap-2">
              <RotateCw size={16} /> Réessayer
            </button>
          </section>
        ) : priorites.length > 0 ? (
          <section>
            <h2 className="px-1 mb-2 text-sm font-semibold text-neutral-500">Historique</h2>
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
              <ul className="divide-y divide-neutral-100">
                {priorites.map((p) => {
                  const s = STATUT_LABEL[p.statut]
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3 min-h-[64px]">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${s.className}`}>
                        {s.icon} {s.label}
                      </span>
                      <span className="min-w-0 flex-1">
                        {p.motif && <span className="block text-sm text-neutral-700 truncate">« {p.motif} »</span>}
                        {p.motifRefus && <span className="block text-xs text-red-600 truncate">Motif refus : {p.motifRefus}</span>}
                        <span className="block text-xs text-neutral-400">{formatDateHeure(p.createdAt)}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>
        ) : null}
      </main>

      {/* Modal demande */}
      <Modal isOpen={demanderOpen} onClose={() => setDemanderOpen(false)} title="Demander la priorité" size="sm">
        <p className="text-neutral-600 mb-4">Le gestionnaire recevra une notification. Expliquez brièvement pourquoi si vous le souhaitez.</p>
        <label className="block">
          <span className="text-sm font-semibold text-neutral-700">Motif (facultatif)</span>
          <input
            value={motif}
            onChange={(e) => setMotif(e.target.value.slice(0, 200))}
            placeholder="Mariage, fête, urgence…"
            className="mt-1 w-full h-12 px-4 rounded-2xl bg-neutral-100 text-[16px] outline-none focus:ring-2 focus:ring-primary-600"
          />
        </label>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setDemanderOpen(false)} className="h-12 rounded-full bg-neutral-100 font-semibold">Annuler</button>
          <button
            onClick={submitDemande}
            disabled={demandePending || !online}
            className="h-12 rounded-full bg-primary-700 text-white font-bold disabled:opacity-50"
          >
            {demandePending ? '…' : 'Envoyer'}
          </button>
        </div>
      </Modal>

      {/* Modal annulation */}
      <Modal isOpen={!!aAnnuler} onClose={() => setAAnnuler(null)} title="Annuler la demande ?" size="sm">
        <p className="text-neutral-600">Votre demande de priorité sera annulée.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setAAnnuler(null)} className="h-12 rounded-full bg-neutral-100 font-semibold">Garder</button>
          <button onClick={submitAnnuler} disabled={annulPending} className="h-12 rounded-full bg-red-600 text-white font-bold disabled:opacity-50">
            {annulPending ? '…' : 'Annuler la demande'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
