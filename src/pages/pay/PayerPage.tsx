/**
 * B2 — Payer ma cotisation.
 *
 * Le membre paie hors de l'app (Wave, Orange Money, Free Money, espèces) puis le déclare ici.
 * Tontine et tour sont déduits ; montant prérempli (pavé numérique si montant libre) ;
 * moyen mémorisé. Parcours type : carte d'action « Payer » → « Confirmer » → reçu.
 * Un tour peut compter plusieurs cotisations : on paie celle en cours (« cotisation 2 sur 4 »).
 * Les cotisations en retard restent payables, même après la remise du jackpot : elles sont
 * proposées en premier dans « Que payez-vous ? » (un paiement par cotisation).
 *
 * /payer            → choix de la tontine (sauté s'il n'y a qu'une cotisation à payer)
 * /payer/:tontineId → déclaration
 */
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { Copy, ChevronDown, ChevronRight, Clock, CheckCircle2, CalendarX, CalendarClock, WifiOff, Circle, UserX } from 'lucide-react'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { InitialsAvatar } from '@/components/ui/Section'
import { PaymentMethodTiles } from '@/components/pay/PaymentMethodTiles'
import { AmountPad, BigAmount } from '@/components/pay/AmountPad'
import { useCotisantSummary, useMesRoles } from '@/hooks/useMe'
import { useRecordCotisation, useCotisations } from '@/hooks/useCotisations'
import { useCycle } from '@/hooks/useCycles'
import { useOnline } from '@/hooks/useOnline'
import { formatF, formatEcheance, safeGet, safeSet } from '@/lib/format'
import { formatPhoneLocal } from '@/lib/phone'
import { isMobileMoney, LAST_METHOD_KEY, METHODE_PAR_DEFAUT, estDisponible } from '@/lib/paymentMethods'
import { synchroniserPreferences } from '@/lib/preferences'
import { erreurTontine, periodePayable, texteNonOuverte } from '@/lib/periodes'
import { CotisationStatut, MembreStatut } from '@/types/common'
import { TontineType } from '@/types/tontine'
import type { CotisantTontineSummary } from '@/types/me'

/** Cotisations en retard d'une tontine : tours déjà remis + cotisations passées du tour en cours */
const nbRetards = (l: CotisantTontineSummary) => l.echeancesARegulariser.length + (l.cotisationDue?.echeancesEnRetard ?? 0)
const limiteDe = (l: CotisantTontineSummary) => l.cotisationDue?.echeanceAt ?? l.cotisationDue?.dateLimite ?? null

export function PayerPage() {
  const { tontineId } = useParams<{ tontineId: string }>()
  const roles = useMesRoles()
  const summary = useCotisantSummary(roles.cotise || roles.isLoading)
  const loading = roles.isLoading || summary.isLoading

  if (loading) return <PayerSkeleton />
  if (summary.isError) {
    return (
      <Shell>
        <Message icon={<WifiOff size={28} />} title="Impossible de charger vos cotisations" text="Vérifiez votre connexion puis réessayez.">
          <button onClick={() => summary.refetch()} className="h-12 px-5 rounded-full bg-primary-700 text-white font-bold">Réessayer</button>
        </Message>
      </Shell>
    )
  }

  const lignes = summary.data?.tontines ?? []
  if (!tontineId) return <ChoisirTontine lignes={lignes} />

  const ligne = lignes.find((l) => l.tontineId === tontineId)
  if (!ligne) {
    return (
      <Shell>
        <Message icon={<CalendarX size={28} />} title="Vous ne cotisez pas dans cette tontine" text="Seuls les membres peuvent déclarer un paiement." />
      </Shell>
    )
  }
  return <DeclarerPaiement key={ligne.tontineId} ligne={ligne} />
}

// ─── Choix de la tontine (« Pour quelle tontine ? ») ─────────────────────────

function ChoisirTontine({ lignes }: { lignes: CotisantTontineSummary[] }) {
  // Les retards d'abord, puis la date limite la plus proche
  const aPayer = lignes
    .filter((l) => l.cotisationDue?.statut === 'A_PAYER' || nbRetards(l) > 0)
    .sort((a, b) => (nbRetards(b) > 0 ? 1 : 0) - (nbRetards(a) > 0 ? 1 : 0) || +new Date(limiteDe(a) ?? 0) - +new Date(limiteDe(b) ?? 0))
  const autres = lignes.filter((l) => l.cotisationDue && !aPayer.includes(l))

  if (aPayer.length === 1 && autres.length === 0) return <Navigate to={`/payer/${aPayer[0].tontineId}`} replace />

  return (
    <Shell>
      {aPayer.length === 0 && autres.length === 0 ? (
        <Message icon={<CheckCircle2 size={28} />} title="Rien à payer pour l'instant" text="Vous serez prévenu à l'ouverture du prochain tour." />
      ) : (
        <>
          <p className="px-1 text-sm font-semibold text-neutral-500">Pour quelle tontine ?</p>
          <ul className="mt-2 bg-white rounded-3xl shadow-sm divide-y divide-neutral-100">
            {[...aPayer, ...autres].map((l) => {
              const due = l.cotisationDue
              const retards = nbRetards(l)
              const statut = retards > 0
                ? `${retards} cotisation${retards > 1 ? 's' : ''} en retard`
                : due?.statut === 'A_PAYER'
                  ? `${due.montant != null ? formatF(due.montant) : 'Montant libre'} · avant ${formatEcheance(limiteDe(l))}`
                  : due?.statut === 'EN_ATTENTE' ? 'Déclarée · en attente de validation' : 'Payée ✓'
              return (
                <li key={l.tontineId}>
                  <Link to={`/payer/${l.tontineId}`} className="flex items-center gap-3 px-4 py-3 min-h-[64px]">
                    <InitialsAvatar name={l.nom} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-neutral-900 truncate">{l.nom}</span>
                      <span className={clsx('block text-sm truncate', retards > 0 ? 'font-medium text-red-700' : 'text-neutral-500')}>{statut}</span>
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

// ─── Déclaration ─────────────────────────────────────────────────────────────

/** Ce que le membre paie : la cotisation en cours, ou une cotisation en retard */
interface Cible {
  cle: string
  cycleId: string
  /** Absent : le backend prend la cotisation en cours */
  echeanceId?: string
  numeroCycle: number
  numeroEcheance: number | null
  nombreEcheances: number | null
  /** null = montant libre à saisir */
  montant: number | null
  limite: string | null
  enRetard: boolean
}

function DeclarerPaiement({ ligne }: { ligne: CotisantTontineSummary }) {
  const navigate = useNavigate()
  const online = useOnline()
  const due = ligne.cotisationDue
  const { mutate: record, isPending } = useRecordCotisation()

  // Retards sur le tour en cours : le résumé donne leur nombre, le tour et mes paiements disent lesquels
  const retardsDuTour = (due?.echeancesEnRetard ?? 0) > 0
  const tour = useCycle(ligne.tontineId, retardsDuTour && due ? due.cycleId : '')
  const mesPaiements = useCotisations(ligne.tontineId, due?.cycleId, 0, 50, ligne.monMembreId ?? undefined, retardsDuTour)

  const cibles = useMemo<Cible[]>(() => {
    // 1. Retards sur des tours déjà remis (les plus anciens d'abord)
    const liste: Cible[] = ligne.echeancesARegulariser.map((e) => ({
      cle: e.echeanceId, cycleId: e.cycleId, echeanceId: e.echeanceId, numeroCycle: e.numeroCycle,
      numeroEcheance: e.numeroEcheance, nombreEcheances: null, montant: e.montant, limite: e.echeanceAt, enRetard: true,
    }))
    // 2. Cotisations passées du tour en cours, sans paiement déclaré ou validé de ma part
    if (due && retardsDuTour && tour.data && mesPaiements.data) {
      const couvertes = new Set(
        mesPaiements.data.content
          .filter((c) => c.statut === CotisationStatut.EN_ATTENTE || c.statut === CotisationStatut.VALIDE)
          .map((c) => c.echeanceId),
      )
      for (const e of tour.data.echeances ?? []) {
        if (e.statut !== 'ECHUE' || couvertes.has(e.id)) continue
        liste.push({
          cle: e.id, cycleId: due.cycleId, echeanceId: e.id, numeroCycle: due.numeroCycle,
          numeroEcheance: e.numero, nombreEcheances: due.nombreEcheances, montant: due.montant, limite: e.echeanceAt, enRetard: true,
        })
      }
    }
    // 3. La cotisation en cours, sauf une période événementielle pas encore commencée (B47)
    if (due?.statut === 'A_PAYER' && (!ligne.cycleEnCours || periodePayable(ligne.tontineType, ligne.cycleEnCours))) {
      liste.push({
        cle: 'courante', cycleId: due.cycleId, echeanceId: due.echeanceId ?? undefined, numeroCycle: due.numeroCycle,
        numeroEcheance: due.numeroEcheance, nombreEcheances: due.nombreEcheances,
        montant: due.montantLibre ? null : due.montant, limite: due.echeanceAt ?? due.dateLimite, enRetard: false,
      })
    }
    return liste
  }, [ligne.echeancesARegulariser, ligne.cycleEnCours, ligne.tontineType, due, retardsDuTour, tour.data, mesPaiements.data])

  // Dernier moyen utilisé s'il est disponible, sinon Espèces (seul moyen ouvert pour l'instant)
  const [methode, setMethode] = useState(() => {
    const dernier = safeGet(LAST_METHOD_KEY) ?? ''
    return estDisponible(dernier) ? dernier : METHODE_PAR_DEFAUT
  })
  const [choix, setChoix] = useState<string | null>(null)
  const [montantLibre, setMontantLibre] = useState(0)
  const [refOpen, setRefOpen] = useState(false)
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Par défaut : la cotisation en cours ; sinon le retard le plus ancien
  const cible = cibles.find((c) => c.cle === choix) ?? cibles.find((c) => !c.enRetard) ?? cibles[0]

  if (!cible && retardsDuTour && (tour.isLoading || mesPaiements.isLoading)) return <PayerSkeleton />

  // Participation suspendue ou terminée (B44) : plus de nouvelle cotisation
  if (!cible && (ligne.monStatutMembre === MembreStatut.SUSPENDU || ligne.monStatutMembre === MembreStatut.SORTI)) {
    return (
      <Shell>
        <Message
          icon={<UserX size={28} />}
          title={ligne.monStatutMembre === MembreStatut.SUSPENDU ? 'Participation suspendue' : 'Participation terminée'}
          text={`Vous ne pouvez plus cotiser dans ${ligne.nom}. Contactez votre gestionnaire.`}
        />
      </Shell>
    )
  }

  // Période événementielle pas encore commencée (B47) : on ne paie pas d'avance
  if (!cible && due?.statut === 'A_PAYER' && ligne.tontineType === TontineType.EVENEMENTIELLE && ligne.cycleEnCours) {
    return (
      <Shell>
        <Message icon={<CalendarClock size={28} />} title="Pas encore ouverte" text={texteNonOuverte(ligne.cycleEnCours.dateDebut)} />
      </Shell>
    )
  }

  if (!cible && !due) {
    return (
      <Shell>
        <Message
          icon={<CalendarX size={28} />}
          title="Aucun tour ouvert"
          text={`Il n'y a pas de tour en cours pour ${ligne.nom}. Vous serez prévenu à son ouverture.`}
        />
      </Shell>
    )
  }

  if (!cible && due) {
    const valide = due.statut === 'VALIDE'
    return (
      <Shell>
        <Message
          icon={valide ? <CheckCircle2 size={28} /> : <Clock size={28} />}
          title={valide ? 'Cotisation déjà payée' : 'Cotisation déjà déclarée'}
          text={`${ligne.nom} · Tour ${due.numeroCycle}${valide ? '' : ' · en attente de validation par le gestionnaire'}`}
        >
          {due.cotisationId && (
            <Link to={`/recu/${ligne.tontineId}/${due.cotisationId}`} className="h-12 px-5 rounded-full bg-primary-700 text-white font-bold inline-flex items-center">
              Voir le reçu
            </Link>
          )}
        </Message>
      </Shell>
    )
  }
  if (!cible) return null

  const libre = cible.montant == null
  const montant = libre ? montantLibre : cible.montant ?? 0
  const minimum = libre ? due?.montantMinimum ?? 0 : 0
  const montantValide = montant > 0 && (!libre || montant >= minimum)
  const peutConfirmer = online && !!methode && montantValide && !isPending
  const libelleCible = (c: Cible) =>
    `Tour ${c.numeroCycle}${c.numeroEcheance && (c.nombreEcheances ?? 2) > 1 ? ` · cotisation ${c.numeroEcheance}${c.nombreEcheances ? ` sur ${c.nombreEcheances}` : ''}` : ''}`

  const copierNumero = async () => {
    try {
      await navigator.clipboard.writeText(formatPhoneLocal(ligne.gestionnaire.phone).replace(/\s/g, ''))
      toast.success('Numéro copié')
    } catch {
      toast.error('Copie impossible')
    }
  }

  const confirmer = () => {
    setError(null)
    if (!methode) { setError('Choisissez un moyen de paiement.'); return }
    if (!montantValide) { setError(minimum ? `Montant minimum : ${formatF(minimum)}.` : 'Saisissez un montant.'); return }
    record(
      {
        tontineId: ligne.tontineId,
        request: {
          cycleId: cible.cycleId,
          ...(cible.echeanceId ? { echeanceId: cible.echeanceId } : {}),
          montant,
          methodePaiement: methode,
          referenceTransaction: reference.trim() || undefined,
        },
      },
      {
        onSuccess: (cotisation) => {
          safeSet(LAST_METHOD_KEY, methode)
          synchroniserPreferences()
          navigate(`/recu/${ligne.tontineId}/${cotisation.id}`, { replace: true, state: { justCreated: true } })
        },
        onError: (err) => {
          setError(erreurTontine(err, {
            role: 'membre',
            evenement: ligne.tontineType === TontineType.EVENEMENTIELLE,
            dateDebut: ligne.cycleEnCours?.dateDebut,
          }, "Le paiement n'a pas pu être enregistré. Réessayez.").texte)
        },
      },
    )
  }

  const gestionnaire = [ligne.gestionnaire.firstName, ligne.gestionnaire.lastName].filter(Boolean).join(' ')

  return (
    <Shell>
      <div className="space-y-4 pb-28 lg:pb-0">
        {due?.motifDernierRefus && !cible.enRetard && (
          <p role="status" className="rounded-3xl bg-red-50 px-4 py-3 text-sm text-red-800">
            <b>Votre paiement a été refusé :</b> {due.motifDernierRefus}. Vous pouvez le déclarer à nouveau.
          </p>
        )}

        {/* Plusieurs cotisations à régler, ou un retard : on choisit laquelle on paie (une par paiement) */}
        {(cibles.length > 1 || cible.enRetard) && (
          <section className="bg-white rounded-3xl shadow-sm">
            <p className="px-4 pt-4 text-sm font-semibold text-neutral-500">Que payez-vous ?</p>
            <ul role="radiogroup" aria-label="Cotisation à payer" className="mt-1 divide-y divide-neutral-100">
              {cibles.map((c) => {
                const actif = c.cle === cible.cle
                return (
                  <li key={c.cle}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={actif}
                      onClick={() => { setChoix(c.cle); setError(null) }}
                      className="w-full flex items-center gap-3 px-4 py-3 min-h-[60px] text-left"
                    >
                      {actif ? <CheckCircle2 size={22} className="text-primary-700 flex-shrink-0" /> : <Circle size={22} className="text-neutral-300 flex-shrink-0" />}
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-neutral-900">{libelleCible(c)}</span>
                        <span className={clsx('block text-sm', c.enRetard ? 'font-medium text-red-700' : 'text-neutral-500')}>
                          {c.enRetard ? `En retard · échue le ${formatEcheance(c.limite)}` : `Avant ${formatEcheance(c.limite)}`}
                        </span>
                      </span>
                      <span className="font-bold tabular-nums text-neutral-900">{c.montant != null ? formatF(c.montant) : 'Libre'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section className="bg-white rounded-3xl shadow-sm p-5 text-center">
          <p className="text-sm font-medium text-neutral-500">{ligne.nom} · {libelleCible(cible)}</p>
          <div className="mt-3">
            <BigAmount value={montant} />
          </div>
          <p className={clsx('mt-2 text-sm', cible.enRetard ? 'font-medium text-red-700' : 'text-neutral-500')}>
            {cible.enRetard
              ? `En retard · échue le ${formatEcheance(cible.limite)}`
              : libre
                ? minimum ? `Montant libre · minimum ${formatF(minimum)}` : 'Montant libre'
                : `À payer avant ${formatEcheance(cible.limite)}`}
          </p>
          {libre && (
            <div className="mt-4">
              <AmountPad value={montantLibre} onChange={setMontantLibre} />
            </div>
          )}
        </section>

        <section className="bg-white rounded-3xl shadow-sm p-4">
          <PaymentMethodTiles value={methode} onChange={(v) => { setMethode(v); setError(null) }} />
        </section>

        {isMobileMoney(methode) && ligne.gestionnaire.phone && (
          <section className="rounded-3xl bg-primary-50 p-4">
            <p className="text-sm text-primary-900">
              Envoyez <b>{montant ? formatF(montant) : 'le montant'}</b> à <b>{gestionnaire || 'votre gestionnaire'}</b>
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xl font-bold tabular-nums text-neutral-900">{formatPhoneLocal(ligne.gestionnaire.phone)}</span>
              <button onClick={copierNumero} className="h-11 px-4 rounded-full bg-white text-sm font-semibold text-primary-800 inline-flex items-center gap-1.5">
                <Copy size={16} /> Copier
              </button>
            </div>
          </section>
        )}

        <section className="bg-white rounded-3xl shadow-sm">
          <button
            type="button"
            onClick={() => setRefOpen((v) => !v)}
            aria-expanded={refOpen}
            className="w-full h-14 px-4 flex items-center justify-between text-left text-[15px] font-medium text-neutral-800"
          >
            Ajouter la référence du transfert
            <ChevronDown size={18} className={refOpen ? 'rotate-180 transition' : 'transition'} />
          </button>
          {refOpen && (
            <div className="px-4 pb-4">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value.slice(0, 30))}
                placeholder="Ex : 123456789"
                autoComplete="off"
                className="w-full h-12 px-4 rounded-2xl bg-neutral-100 text-[16px] outline-none focus:ring-2 focus:ring-primary-600"
                aria-label="Référence du transfert (facultatif)"
              />
            </div>
          )}
        </section>

        {error && <p role="alert" className="px-1 text-sm font-medium text-red-700">{error}</p>}
      </div>

      {/* Mobile : bouton principal collé en bas (zone du pouce). Desktop : sous le formulaire, dans la fenêtre. */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-[#f2f3f5]/95 backdrop-blur px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:z-auto lg:bg-transparent lg:backdrop-blur-none lg:px-0 lg:pt-5 lg:pb-0">
        <div className="max-w-lg mx-auto">
          <button
            onClick={confirmer}
            disabled={!peutConfirmer}
            className="w-full h-14 rounded-full bg-primary-700 text-white text-[17px] font-bold hover:bg-primary-800 active:scale-[0.98] transition disabled:opacity-50"
          >
            {isPending ? 'Envoi…' : !online ? 'Connexion requise' : `Confirmer mon paiement${montant ? ` de ${formatF(montant)}` : ''}`}
          </button>
          <p className="mt-2 text-center text-xs text-neutral-500">Le gestionnaire validera votre paiement.</p>
        </div>
      </div>
    </Shell>
  )
}

// ─── Mise en page ────────────────────────────────────────────────────────────

/** Mobile : plein écran. Desktop : fenêtre centrée de 480 px (brief B2). */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#f2f3f5]">
      <ScreenHeader title="Payer ma cotisation" />
      <main className="px-4 pb-6 max-w-lg mx-auto lg:max-w-[480px] lg:px-0 lg:pt-2 lg:pb-12">{children}</main>
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

function PayerSkeleton() {
  return (
    <Shell>
      <div className="space-y-4" aria-busy="true">
        <div className="h-36 rounded-3xl bg-white animate-pulse" />
        <div className="h-48 rounded-3xl bg-white animate-pulse" />
      </div>
    </Shell>
  )
}
