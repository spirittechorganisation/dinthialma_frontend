/**
 * FR29 — « Enregistrer un retrait » (gestionnaire, épargne) : argent déjà remis au membre (B42, lot 1).
 *
 * 1. Formulaire : Partiel / Tout retirer, montant (tout le solde, non modifiable, pour « Tout retirer »),
 *    moyen de remise (Espèces par défaut), date réelle (aujourd'hui par défaut, passée pour reporter le cahier), motif.
 * 2. Récapitulatif à confirmer : « Remettre 10.000F en espèces à Awa. Il lui restera 34.000F. »
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { useSaisirRetrait } from '@/hooks/useRetraits'
import { useOnline } from '@/hooks/useOnline'
import { formatF } from '@/lib/format'
import { aujourdhuiDakar } from '@/lib/periodes'
import {
  MOYENS_REMISE, dateRemisePourEnvoi, erreurRetrait, montantRetrait, moyenRemise, phraseRemise, verifierRetrait,
  type ErreurRetrait,
} from '@/lib/retraits'
import type { NatureRetrait } from '@/types/retrait'

interface RetraitModalProps {
  isOpen: boolean
  onClose: () => void
  tontineId: string
  membreId: string
  prenom: string
  solde: number
  /** Premier jour de la tontine : la date de remise ne peut pas le précéder */
  dateDebut?: string | null
}

/** 44000 → « 44.000 » (format de l'app, sans le F) */
const milliers = (n: number) => formatF(n).slice(0, -1)

const champ = 'w-full h-12 px-4 rounded-2xl bg-neutral-100 text-[16px] outline-none focus:ring-2 focus:ring-primary-600'

export function RetraitModal({ isOpen, onClose, tontineId, membreId, prenom, solde, dateDebut }: RetraitModalProps) {
  const online = useOnline()
  const { mutate: saisir, isPending } = useSaisirRetrait()
  const [nature, setNature] = useState<NatureRetrait>('PARTIEL')
  const [saisie, setSaisie] = useState('')
  const [methode, setMethode] = useState<string>('CASH')
  const [reference, setReference] = useState('')
  const [jour, setJour] = useState(() => aujourdhuiDakar())
  const [motif, setMotif] = useState('')
  const [etape, setEtape] = useState<'formulaire' | 'recap'>('formulaire')
  const [controle, setControle] = useState<string | null>(null)
  const [erreur, setErreur] = useState<ErreurRetrait | null>(null)

  const montant = montantRetrait(nature, Number(saisie.replace(/\D/g, '')) || 0, solde)
  const affiche = saisie ? milliers(Number(saisie.replace(/\D/g, ''))) : ''
  const avecReference = moyenRemise(methode).reference

  const fermer = () => {
    setNature('PARTIEL'); setSaisie(''); setMethode('CASH'); setReference(''); setJour(aujourdhuiDakar()); setMotif('')
    setEtape('formulaire'); setControle(null); setErreur(null)
    onClose()
  }

  const continuer = () => {
    setErreur(null)
    const probleme = verifierRetrait({ nature, montant, solde, jour, debut: dateDebut })
    setControle(probleme)
    if (!probleme) setEtape('recap')
  }

  const confirmer = () => {
    setErreur(null)
    saisir(
      {
        tontineId,
        request: {
          membreId,
          nature,
          ...(nature === 'PARTIEL' ? { montant } : {}),
          methodePaiement: methode,
          referenceTransaction: avecReference && reference.trim() ? reference.trim() : undefined,
          motif: motif.trim() || undefined,
          dateRemise: dateRemisePourEnvoi(jour),
        },
      },
      {
        onSuccess: (r) => {
          toast.success(`Retrait de ${formatF(r.montant)} enregistré`, {
            description: r.soldeRestant != null ? `Solde de ${prenom} : ${formatF(r.soldeRestant)}` : undefined,
          })
          fermer()
        },
        onError: (err) => { setErreur(erreurRetrait(err)); setEtape('formulaire') },
      },
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={fermer} title={etape === 'recap' ? 'Confirmer le retrait' : 'Enregistrer un retrait'} size="sm">
      {etape === 'formulaire' ? (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">Solde de {prenom} : <strong className="tabular-nums">{formatF(solde)}</strong></p>

          <div role="radiogroup" aria-label="Type de retrait" className="grid grid-cols-2 rounded-full bg-neutral-100 p-1">
            {([['PARTIEL', 'Partiel'], ['TOTAL', 'Tout retirer']] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={nature === v}
                onClick={() => { setNature(v); setControle(null) }}
                className={clsx('h-10 rounded-full text-sm font-semibold', nature === v ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500')}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-neutral-700">Montant remis</span>
            <span className="mt-1.5 flex items-center gap-2 rounded-2xl bg-neutral-100 px-4 focus-within:ring-2 focus-within:ring-primary-600">
              <input
                value={nature === 'TOTAL' ? milliers(solde) : affiche}
                onChange={(e) => setSaisie(e.target.value.replace(/\D/g, '').slice(0, 9))}
                readOnly={nature === 'TOTAL'}
                inputMode="numeric"
                placeholder="0"
                aria-label="Montant remis en francs CFA"
                className="flex-1 min-w-0 h-14 bg-transparent text-2xl font-extrabold tabular-nums outline-none read-only:text-neutral-500"
              />
              <span className="text-xl font-bold text-neutral-400">F</span>
            </span>
            {nature === 'TOTAL' && <span className="mt-1 block text-xs text-neutral-500">Tout le solde est remis.</span>}
          </label>

          <fieldset>
            <legend className="text-sm font-semibold text-neutral-700">Moyen de remise</legend>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {MOYENS_REMISE.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={methode === m.value}
                  onClick={() => setMethode(m.value)}
                  className={clsx('h-11 rounded-2xl text-sm font-semibold', methode === m.value ? 'bg-primary-700 text-white' : 'bg-neutral-100 text-neutral-700')}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </fieldset>
          {avecReference && (
            <input value={reference} onChange={(e) => setReference(e.target.value.slice(0, 30))} placeholder="Référence de la transaction" aria-label="Référence de la transaction" className={champ} />
          )}

          <label className="block">
            <span className="text-sm font-semibold text-neutral-700">Date de remise</span>
            <input
              type="date"
              value={jour}
              max={aujourdhuiDakar()}
              min={dateDebut?.slice(0, 10) || undefined}
              onChange={(e) => setJour(e.target.value)}
              aria-label="Date de remise"
              aria-describedby="aide-date-remise"
              className={clsx(champ, 'mt-1.5')}
            />
            <span id="aide-date-remise" className="mt-1 block text-xs text-neutral-500">Aujourd’hui par défaut ; une date passée pour reporter un retrait noté dans le cahier.</span>
          </label>

          <input value={motif} onChange={(e) => setMotif(e.target.value.slice(0, 200))} placeholder="Motif (facultatif)" aria-label="Motif (facultatif)" className={champ} />

          {(controle || erreur) && <p role="alert" className="text-sm font-medium text-red-700">{controle ?? erreur?.texte}</p>}
          {erreur?.aValider && (
            <Link to={`/a-valider?tontine=${tontineId}`} className="flex h-11 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-primary-800">Ouvrir À valider</Link>
          )}
          {erreur?.reglages && (
            <Link to={`/tontine/${tontineId}/reglages`} className="flex h-11 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-primary-800">Autoriser les retraits dans les Réglages</Link>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button type="button" onClick={fermer} className="h-12 rounded-full bg-neutral-100 font-semibold">Annuler</button>
            <button type="button" onClick={continuer} disabled={!online || solde <= 0} className="h-12 rounded-full bg-primary-700 text-white font-bold disabled:opacity-50">Continuer</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[17px] leading-snug text-neutral-900">{phraseRemise({ prenom, montant, methode, nature, solde })}</p>
          {jour !== aujourdhuiDakar() && <p className="text-sm text-neutral-500">Remis le {jour.split('-').reverse().join('/')} (report du cahier).</p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setEtape('formulaire')} disabled={isPending} className="h-12 rounded-full bg-neutral-100 font-semibold">Modifier</button>
            <button
              type="button"
              onClick={confirmer}
              disabled={!online || isPending}
              className={clsx('h-12 rounded-full text-white font-bold disabled:opacity-50', nature === 'TOTAL' ? 'bg-red-600' : 'bg-primary-700')}
            >
              {isPending ? 'Enregistrement…' : 'Confirmer le retrait'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
