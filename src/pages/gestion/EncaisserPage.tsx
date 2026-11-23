/**
 * B3 — Encaisser un paiement (gestionnaire) : paiement reçu en main propre ou par transfert,
 * enregistré et validé immédiatement.
 *
 * /encaisser                       → « Pour quelle tontine ? » (sauté s'il n'y en a qu'une avec un tour en cours)
 * /encaisser/:tontineId            → « De qui ? » (membres pas encore payés en tête, compteur « 8 / 20 payés »)
 * /encaisser/:tontineId?membre=id  → « Combien ? » directement (fiche membre, scan d'un QR membre)
 * ?echeance=id (et ?tour=id pour un tour déjà remis) → encaisser un retard sur une cotisation passée
 *
 * Saisie en série (FR24) : après un encaissement, retour à « De qui ? » de la même tontine et de la même
 * période, toast « Reçu enregistré · Voir ». Montant prérempli (minimum en montant libre), dernier moyen gardé.
 *
 * Desktop (≥ 1024 px) : « De qui ? » à gauche et « Combien ? » à droite sur le même écran ;
 * le membre choisi reste dans l'URL (?membre=id), comme sur mobile.
 */
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { ChevronDown, ChevronRight, Search, PartyPopper, CalendarX, CalendarClock, RotateCw, Pencil } from 'lucide-react'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { EncaisserDesktop } from '@/pages/gestion/EncaisserDesktop'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { InitialsAvatar } from '@/components/ui/Section'
import { PaymentMethodTiles } from '@/components/pay/PaymentMethodTiles'
import { METHODE_PAR_DEFAUT, METHODES_DISPONIBLES } from '@/lib/paymentMethods'
import { AmountPad, BigAmount } from '@/components/pay/AmountPad'
import { useGestionSummary } from '@/hooks/useMe'
import { useTontine } from '@/hooks/useTontines'
import { useRecapCycle, useAdminRecordCotisation } from '@/hooks/useCotisations'
import { useCycle } from '@/hooks/useCycles'
import { useOnline } from '@/hooks/useOnline'
import { useLocalPreference } from '@/hooks/useLocalPreference'
import { formatF } from '@/lib/format'
import { erreurTontine, estJournaliere, nomPeriode, periodePayable, texteNonOuverte } from '@/lib/periodes'
import { METHODE_ENCAISSEMENT_KEY, aPaye, avecEncaissementsRecents, montantPrerempli, textePayes, type EncaissementRecent } from '@/lib/encaissement'
import { AccountStatus, CotisationStatut, MembreStatut } from '@/types/common'
import { TontineType } from '@/types/tontine'
import type { Cotisation, CycleRecapLigne } from '@/types/cotisation'

export function EncaisserPage() {
  const { tontineId } = useParams<{ tontineId: string }>()
  return tontineId ? <EncaisserTontine tontineId={tontineId} /> : <ChoisirTontine />
}

// ─── « Pour quelle tontine ? » ───────────────────────────────────────────────

function ChoisirTontine() {
  const { data, isLoading, isError, refetch } = useGestionSummary()
  const avecTour = (data?.tontines ?? []).filter((t) => t.cycleEnCours)
    .sort((a, b) => {
      const ma = a.cycleEnCours!.membresActifs - a.cycleEnCours!.membresAyantPaye - a.cycleEnCours!.membresEnAttente
      const mb = b.cycleEnCours!.membresActifs - b.cycleEnCours!.membresAyantPaye - b.cycleEnCours!.membresEnAttente
      return mb - ma
    })

  if (isLoading) return <Shell><Skeleton /></Shell>
  if (isError) return <Shell><Erreur onRetry={() => refetch()} /></Shell>
  if (avecTour.length === 1) return <Navigate to={`/encaisser/${avecTour[0].tontineId}`} replace />

  return (
    <Shell>
      {avecTour.length === 0 ? (
        <Message icon={<CalendarX size={28} />} title="Aucun tour en cours" text="Démarrez un tour dans une de vos tontines pour encaisser." />
      ) : (
        <>
          <p className="px-1 text-sm font-semibold text-neutral-500">Pour quelle tontine ?</p>
          <ul className="mt-2 bg-white rounded-3xl shadow-sm divide-y divide-neutral-100">
            {avecTour.map((t) => {
              const c = t.cycleEnCours!
              const manquants = c.membresActifs - c.membresAyantPaye - c.membresEnAttente
              return (
                <li key={t.tontineId}>
                  <Link to={`/encaisser/${t.tontineId}`} className="flex items-center gap-3 px-4 py-3 min-h-[64px]">
                    <InitialsAvatar name={t.nom} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-neutral-900 truncate">{t.nom}</span>
                      <span className="block text-sm text-neutral-500">
                        {nomPeriode({ tontineType: t.tontineType }, { numeroCycle: c.numeroCycle })}{c.nombreEcheances > 1 && c.numeroEcheanceCourante ? ` · cotisation ${c.numeroEcheanceCourante}/${c.nombreEcheances}` : ''} · {manquants > 0 ? `${manquants} n'ont pas payé` : 'tout le monde a payé'}
                      </span>
                    </span>
                    <ChevronRight size={18} className="text-neutral-300" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Shell>
  )
}

// ─── Tontine choisie ─────────────────────────────────────────────────────────

function EncaisserTontine({ tontineId }: { tontineId: string }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const membreId = params.get('membre')
  const gestion = useGestionSummary()
  const { data: tontine, isLoading: tontineChargement } = useTontine(tontineId)
  // FR24 : membres encaissés pendant la séance (affichés « payés » sans attendre le récapitulatif relu)
  const [recents, setRecents] = useState<Record<string, EncaissementRecent>>({})
  const stats = gestion.data?.tontines.find((t) => t.tontineId === tontineId)
  // Retard à encaisser : tour précisé (déjà remis) et / ou cotisation passée du tour
  const tourParam = params.get('tour')
  const echeanceId = params.get('echeance') ?? undefined
  const cycleId = tourParam ?? stats?.cycleEnCours?.cycleId ?? ''
  // Tour visé : numéro d'un tour déjà remis, et premier jour d'une période (B47)
  const tour = useCycle(tontineId, cycleId)
  const recap = useRecapCycle(tontineId, cycleId, 0, 200, !!cycleId, echeanceId)
  const desktop = useIsDesktop()
  // Garde le tour et la cotisation visés quand on choisit ou change de membre
  const avecMembre = (id?: string) => {
    const n = new URLSearchParams()
    if (tourParam) n.set('tour', tourParam)
    if (echeanceId) n.set('echeance', echeanceId)
    if (id) n.set('membre', id)
    return n
  }

  // La tontine donne le minimum du montant libre et le rythme : attendue pour préremplir le montant
  if (gestion.isLoading || tontineChargement || (cycleId && (recap.isLoading || tour.isLoading))) return <Shell title={tontine?.nom}><Skeleton /></Shell>
  if (gestion.isError || recap.isError) return <Shell><Erreur onRetry={() => { gestion.refetch(); recap.refetch() }} /></Shell>
  if (!stats) {
    return <Shell><Message icon={<CalendarX size={28} />} title="Tontine introuvable" text="Vous ne gérez pas cette tontine." /></Shell>
  }
  const numeroCycle = tourParam ? tour.data?.numeroCycle : stats.cycleEnCours?.numeroCycle
  if (!cycleId || numeroCycle == null) {
    return (
      <Shell title={stats.nom}>
        <Message icon={<CalendarX size={28} />} title="Aucun tour en cours" text="Démarrez un tour pour pouvoir encaisser.">
          <Link to={`/tontine/${tontineId}/tours`} className="h-12 px-5 rounded-full bg-primary-700 text-white font-bold inline-flex items-center">Voir les tours</Link>
        </Message>
      </Shell>
    )
  }

  // B47 : une période événementielle ne s'encaisse pas avant son premier jour (le gestionnaire clôture
  // la veille, la période suivante est « en cours » mais pas encore ouverte)
  if (tour.data && !periodePayable(stats.tontineType, tour.data)) {
    return (
      <Shell title={stats.nom}>
        <Message icon={<CalendarClock size={28} />} title="Période pas encore ouverte" text={texteNonOuverte(tour.data.dateDebut)}>
          <Link to={`/tontine/${tontineId}/tours`} className="h-12 px-5 rounded-full bg-neutral-100 font-bold inline-flex items-center">Voir les périodes</Link>
        </Message>
      </Shell>
    )
  }

  const lignes = avecEncaissementsRecents((recap.data?.content ?? []).filter((l) => l.statutMembre === MembreStatut.ACTIF), recents)
  const membre = membreId ? lignes.find((l) => l.membreId === membreId) : undefined
  // « · cotisation 2/4 » quand le tour en compte plusieurs ; « · retard » pour une cotisation passée
  const ref = lignes[0]
  const suffixeTour = `${ref?.nombreEcheances && ref.nombreEcheances > 1 && ref.numeroEcheance ? ` · cotisation ${ref.numeroEcheance}/${ref.nombreEcheances}` : ''}${echeanceId || tourParam ? ' · retard' : ''}`

  const membreAEncaisser = membreId && membre && !aPaye(membre) ? membre : undefined
  // FR25 : « Tour 3 », « Jour du 23/11 » (épargne journalière) ou « Période 3 »
  const periode = nomPeriode(tontine ?? { tontineType: stats.tontineType }, { numeroCycle, dateDebut: tour.data?.dateDebut })
  const retard = !!(echeanceId || tourParam)
  // FR24 : encaissement réussi → retour à « De qui ? » de la même période, reçu accessible depuis le toast
  const apresEncaissement = (m: CycleRecapLigne, cot: Cotisation) => {
    setRecents((r) => ({ ...r, [m.membreId]: { cotisationId: cot.id, montant: cot.montant } }))
    setParams(avecMembre(), { replace: true })
    toast.success('Reçu enregistré', {
      description: `${`${m.firstName} ${m.lastName}`.trim()} · ${formatF(cot.montant)}`,
      action: { label: 'Voir', onClick: () => navigate(`/recu/${tontineId}/${cot.id}`) },
    })
  }
  const montantProps = {
    tontineId,
    tontineNom: stats.nom,
    cycleId,
    echeanceId,
    periode,
    suffixeTour,
    // Montant libre : prérempli au minimum (le backend recopie le minimum dans `montant`)
    montantDefaut: montantPrerempli({ montantLibre: stats.montantLibre, montant: stats.montant ?? tontine?.montant, montantMinimum: tontine?.montantMinimum }),
    // Montant libre : plancher affiché et vérifié avant l'envoi
    montantMinimum: stats.montantLibre ? tontine?.montantMinimum ?? null : null,
    evenement: stats.tontineType === TontineType.EVENEMENTIELLE,
    dateDebutPeriode: tour.data?.dateDebut ?? null,
    onChangeMembre: () => setParams(avecMembre(), { replace: true }),
    onEncaisse: apresEncaissement,
  }
  const deQuiProps = {
    tontineId,
    periode,
    suffixeTour,
    lignes,
    compteur: textePayes(lignes, !retard && estJournaliere(tontine)),
    evenement: stats.tontineType === TontineType.EVENEMENTIELLE,
    // Pas de clavier qui s'ouvre à chaque retour sur la liste pendant la saisie en série
    autoFocus: Object.keys(recents).length === 0,
    // Desktop : changer de membre remplace la sélection (pas d'empilement dans l'historique)
    onChoisir: (id: string) => setParams(avecMembre(id)),
  }

  // Desktop : un seul écran, liste à défilement interne à gauche, formulaire compact à droite
  if (desktop) {
    return (
      <EncaisserDesktop
        tontineId={tontineId}
        tontineNom={stats.nom}
        cycleId={cycleId}
        echeanceId={echeanceId}
        periode={periode}
        suffixeTour={suffixeTour}
        montantDefaut={montantProps.montantDefaut}
        montantMinimum={montantProps.montantMinimum}
        evenement={montantProps.evenement}
        dateDebutPeriode={montantProps.dateDebutPeriode}
        lignes={lignes}
        membreId={membreAEncaisser?.membreId ?? null}
        onChoisir={(id) => setParams(avecMembre(id), { replace: true })}
        onFermer={montantProps.onChangeMembre}
        onEncaisse={apresEncaissement}
      />
    )
  }

  // Mobile / PWA : deux temps plein écran
  if (membreAEncaisser) {
    return (
      <Shell title={`Encaisser · ${stats.nom}`}>
        <MontantForm {...montantProps} membre={membreAEncaisser} />
      </Shell>
    )
  }
  return (
    <Shell title={`Encaisser · ${stats.nom}`}>
      <DeQuiContenu {...deQuiProps} />
    </Shell>
  )
}

// ─── « De qui ? » ────────────────────────────────────────────────────────────

function DeQuiContenu({ tontineId, periode, suffixeTour = '', lignes, compteur, evenement = false, autoFocus = true, onChoisir, selectedId }: {
  tontineId: string
  /** « Tour 3 », « Jour du 23/11 » */
  periode: string
  suffixeTour?: string
  lignes: CycleRecapLigne[]
  /** « 8 / 20 payés aujourd'hui » */
  compteur: string
  /** Épargne : « cette période », pas « ce tour » (FR25) */
  evenement?: boolean
  autoFocus?: boolean
  onChoisir: (membreId: string) => void
  /** Desktop : membre dont le formulaire est ouvert à droite */
  selectedId?: string
}) {
  const [q, setQ] = useState('')
  const filtre = (l: CycleRecapLigne) => {
    const s = q.trim().toLowerCase()
    return !s || `${l.firstName} ${l.lastName}`.toLowerCase().includes(s) || (l.phone ?? '').includes(s.replace(/\s/g, ''))
  }
  const nonPayes = lignes.filter((l) => !aPaye(l) && filtre(l))
  const payes = lignes.filter((l) => aPaye(l) && filtre(l))
  const toutPaye = lignes.length > 0 && lignes.every(aPaye)

  return (
    <>
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="De qui ? Nom ou numéro"
          className="w-full h-14 pl-11 pr-4 rounded-2xl bg-white shadow-sm text-[16px] outline-none focus:ring-2 focus:ring-primary-600"
          aria-label="Chercher un membre"
        />
      </div>
      <p className="mt-2 px-1 flex items-center justify-between gap-3 text-xs text-neutral-500">
        <span>{periode}{suffixeTour}</span>
        <span className="font-semibold text-neutral-700 tabular-nums" aria-live="polite">{compteur}</span>
      </p>

      {toutPaye && !q && (
        <div className="mt-3 lg:hidden">
          <Message icon={<PartyPopper size={28} />} title={suffixeTour ? 'Tout le monde a payé cette cotisation ✓' : evenement ? 'Tout le monde a payé cette période ✓' : 'Tout le monde a payé ce tour ✓'} text="Il n'y a rien à encaisser." />
        </div>
      )}

      {nonPayes.length > 0 && (
        <section className="mt-3">
          <h2 className="px-1 text-sm font-semibold text-neutral-600">Pas encore payé ({nonPayes.length})</h2>
          <ul className="mt-2 bg-white rounded-3xl shadow-sm divide-y divide-neutral-100">
            {nonPayes.map((l) => (
              <li key={l.membreId}>
                <button
                  onClick={() => onChoisir(l.membreId)}
                  aria-current={l.membreId === selectedId ? 'true' : undefined}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 min-h-[64px] text-left first:rounded-t-3xl last:rounded-b-3xl',
                    l.membreId === selectedId ? 'bg-primary-50' : 'hover:bg-neutral-50',
                  )}
                >
                  <InitialsAvatar name={`${l.firstName} ${l.lastName}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-neutral-900 truncate">{l.firstName} {l.lastName}</span>
                    <span className="block text-sm text-neutral-500">
                      {l.ordreJackpot ? `N° ${l.ordreJackpot}` : ''}
                      {l.accountStatus === AccountStatus.PRE_ENROLLED ? `${l.ordreJackpot ? ' · ' : ''}Sans compte` : ''}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-neutral-300" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {payes.length > 0 && (
        <section className="mt-4">
          <h2 className="px-1 text-sm font-semibold text-neutral-600">Déjà payé ({payes.length})</h2>
          <ul className="mt-2 bg-white rounded-3xl shadow-sm divide-y divide-neutral-100">
            {payes.map((l) => {
              const enAttente = l.statutCotisation === CotisationStatut.EN_ATTENTE
              return (
                <li key={l.membreId}>
                  <Link to={`/recu/${tontineId}/${l.cotisationId}`} className="flex items-center gap-3 px-4 py-3 min-h-[64px] opacity-60">
                    <InitialsAvatar name={`${l.firstName} ${l.lastName}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-neutral-900 truncate">{l.firstName} {l.lastName}</span>
                      <span className="block text-sm text-neutral-500">{l.montant != null ? formatF(l.montant) : ''}</span>
                    </span>
                    <span className={enAttente ? 'rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800' : 'rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-800'}>
                      {enAttente ? 'À valider' : 'Payé ✓'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {q && nonPayes.length === 0 && payes.length === 0 && (
        <p className="mt-6 text-center text-sm text-neutral-500">Aucun membre ne correspond.</p>
      )}
    </>
  )
}

// ─── « Combien ? » ───────────────────────────────────────────────────────────

function MontantForm({
  tontineId, cycleId, echeanceId, periode, suffixeTour = '', montantDefaut, montantMinimum = null, evenement = false,
  dateDebutPeriode = null, membre, onChangeMembre, onEncaisse, inline = false,
}: {
  tontineId: string
  tontineNom: string
  cycleId: string
  /** Cotisation passée à régulariser ; absente = cotisation en cours */
  echeanceId?: string
  periode: string
  suffixeTour?: string
  montantDefaut: number
  /** Montant libre : minimum par cotisation (null = aucun) */
  montantMinimum?: number | null
  evenement?: boolean
  /** Premier jour de la période (texte de ECHEANCE_NON_OUVERTE) */
  dateDebutPeriode?: string | null
  membre: CycleRecapLigne
  onChangeMembre: () => void
  /** Encaissement enregistré (FR24 : retour à la liste) */
  onEncaisse: (membre: CycleRecapLigne, cot: Cotisation) => void
  /** Desktop : formulaire dans le panneau de droite, bouton dans le flux (pas de barre fixe) */
  inline?: boolean
}) {
  const online = useOnline()
  const { mutate: encaisser, isPending } = useAdminRecordCotisation()
  const [montant, setMontant] = useState(montantDefaut)
  // Montant libre : pavé ouvert d'emblée sur le minimum ; la première touche le remplace (FR24)
  const [editMontant, setEditMontant] = useState(montantDefaut === 0 || montantMinimum != null)
  const [remplacer, setRemplacer] = useState(montantDefaut > 0)
  // Dernier moyen utilisé pour encaisser sur cet appareil ; Espèces par défaut
  const [methode, setMethode] = useLocalPreference<string>(METHODE_ENCAISSEMENT_KEY, METHODE_PAR_DEFAUT, METHODES_DISPONIBLES)
  const [plusOpen, setPlusOpen] = useState(false)
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  // MEMBRE_INACTIF : le membre a été suspendu ou sorti entre-temps, on propose de le réactiver
  const [inactif, setInactif] = useState(false)
  const nom = useMemo(() => `${membre.firstName} ${membre.lastName}`.trim(), [membre])

  const confirmer = () => {
    setError(null)
    setInactif(false)
    if (montant <= 0) { setError('Saisissez un montant.'); return }
    if (montantMinimum && montant < montantMinimum) { setError(`Montant minimum : ${formatF(montantMinimum)}.`); return }
    encaisser(
      {
        tontineId,
        request: {
          membreId: membre.membreId,
          cycleId,
          ...(echeanceId ? { echeanceId } : {}),
          montant,
          methodePaiement: methode,
          referenceTransaction: reference.trim() || undefined,
          note: note.trim() || undefined,
        },
      },
      {
        onSuccess: (cot) => onEncaisse(membre, cot),
        onError: (err) => {
          const e = erreurTontine(err, { role: 'gestionnaire', evenement, dateDebut: dateDebutPeriode }, "L'encaissement n'a pas pu être enregistré. Réessayez.")
          setError(e.texte)
          setInactif(e.code === 'MEMBRE_INACTIF')
        },
      },
    )
  }

  const bouton = (
    <button
      onClick={confirmer}
      disabled={!online || isPending || montant <= 0}
      className="w-full h-14 rounded-full bg-primary-700 text-white text-[17px] font-bold hover:bg-primary-800 active:scale-[0.98] transition disabled:opacity-50"
    >
      {isPending ? 'Enregistrement…' : !online ? 'Connexion requise' : `Encaisser ${montant ? formatF(montant) : ''}`}
    </button>
  )

  return (
    <>
      <div className={inline ? 'space-y-4' : 'space-y-4 pb-32'}>
        <section className="bg-white rounded-3xl shadow-sm p-5">
          <div className="flex items-center gap-3">
            <InitialsAvatar name={nom} size={48} />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-neutral-900 truncate">{nom}</p>
              <p className="text-sm text-neutral-500">{periode}{suffixeTour}{membre.accountStatus === AccountStatus.PRE_ENROLLED ? ' · Sans compte' : ''}</p>
            </div>
            <button onClick={onChangeMembre} className="h-11 px-3 rounded-full bg-neutral-100 text-sm font-semibold">Changer</button>
          </div>

          <div className="mt-5">
            <BigAmount value={montant} />
            {montantMinimum ? <p className="mt-1 text-center text-sm text-neutral-500">Montant libre · minimum {formatF(montantMinimum)}</p> : null}
            {!editMontant ? (
              <div className="mt-2 flex justify-center">
                <button onClick={() => { setEditMontant(true); setRemplacer(true) }} className="h-11 px-3 rounded-full text-sm font-semibold text-primary-800 inline-flex items-center gap-1.5">
                  <Pencil size={15} /> Modifier le montant
                </button>
              </div>
            ) : (
              <div className="mt-4"><AmountPad value={montant} remplacer={remplacer} onChange={(v) => { setMontant(v); setRemplacer(false) }} /></div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-sm p-4">
          <PaymentMethodTiles value={methode} onChange={setMethode} />
        </section>

        <section className="bg-white rounded-3xl shadow-sm">
          <button
            type="button"
            onClick={() => setPlusOpen((v) => !v)}
            aria-expanded={plusOpen}
            className="w-full h-14 px-4 flex items-center justify-between text-left text-[15px] font-medium text-neutral-800"
          >
            Référence et note
            <ChevronDown size={18} className={plusOpen ? 'rotate-180 transition' : 'transition'} />
          </button>
          {plusOpen && (
            <div className="px-4 pb-4 space-y-3">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value.slice(0, 30))}
                placeholder="Référence (facultatif)"
                className="w-full h-12 px-4 rounded-2xl bg-neutral-100 text-[16px] outline-none focus:ring-2 focus:ring-primary-600"
                aria-label="Référence (facultatif)"
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                placeholder="Note (facultatif)"
                rows={2}
                className="w-full px-4 py-3 rounded-2xl bg-neutral-100 text-[16px] outline-none focus:ring-2 focus:ring-primary-600 resize-none"
                aria-label="Note (facultatif)"
              />
            </div>
          )}
        </section>

        <p className="px-1 text-sm text-neutral-500">Le paiement sera validé et {membre.firstName} sera prévenu.</p>
        {error && <p role="alert" className="px-1 text-sm font-medium text-red-700">{error}</p>}
        {inactif && (
          <Link to={`/tontine/${tontineId}/membres/${membre.membreId}`} className="flex h-12 items-center justify-center rounded-full bg-white shadow-sm font-semibold text-primary-800">
            Réactiver le membre
          </Link>
        )}
        {inline && bouton}
      </div>

      {!inline && (
        <div className="fixed inset-x-0 bottom-0 lg:left-64 z-20 bg-[#f2f3f5]/95 backdrop-blur px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto">{bouton}</div>
        </div>
      )}
    </>
  )
}

// ─── Mise en page ────────────────────────────────────────────────────────────

function Shell({ children, title = 'Encaisser', wide = false }: { children: React.ReactNode; title?: string; wide?: boolean }) {
  return (
    <div className="min-h-[100dvh] bg-[#f2f3f5]">
      <ScreenHeader title={title} />
      <main className={wide ? 'px-8 pb-6 max-w-[1200px] mx-auto' : 'px-4 pb-6 max-w-lg mx-auto'}>{children}</main>
    </div>
  )
}

function Message({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl shadow-sm p-6 text-center">
      <span className="mx-auto w-14 h-14 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center">{icon}</span>
      <p className="mt-3 text-lg font-bold text-neutral-900">{title}</p>
      <p className="mt-1 text-sm text-neutral-500">{text}</p>
      {children && <div className="mt-5 flex justify-center">{children}</div>}
    </section>
  )
}

function Erreur({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="bg-white rounded-3xl shadow-sm p-6 text-center">
      <p className="text-sm text-neutral-600">Impossible de charger les membres.</p>
      <button onClick={onRetry} className="mt-3 h-11 px-4 rounded-full bg-neutral-100 text-sm font-semibold inline-flex items-center gap-2">
        <RotateCw size={16} /> Réessayer
      </button>
    </section>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="h-14 rounded-2xl bg-white animate-pulse" />
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-white animate-pulse" />)}
    </div>
  )
}
