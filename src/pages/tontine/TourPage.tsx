/**
 * T7 — Tour : progression, retardataires, remise du jackpot, résultat et gagnant(s).
 *
 * Un tour peut compter plusieurs cotisations (échéances) : des pastilles 1, 2, 3… montrent où on en est,
 * et les listes « Pas encore payé / Payé » portent sur la cotisation choisie.
 * Gestionnaire : « Remettre le jackpot » (rotative en cours : aperçu chiffré et choix s'il manque de l'argent),
 * « Clôturer la période » (événement) ; « Désigner le gagnant » / « Tirage au sort »
 * (terminé, ordre « choisi par le gestionnaire », sans gagnant) ; « Encaisser » par retardataire, même après la remise.
 * Membre : ses paiements du tour, résultat.
 */
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { Trophy, Clock, CheckCircle2, AlertTriangle, XCircle, Shuffle, RotateCw, PartyPopper, Circle, Check } from 'lucide-react'
import { EcranDetail, BarreAction, useDansPanneau } from '@/components/layout/Panneau'
import { InitialsAvatar } from '@/components/ui/Section'
import { Modal } from '@/components/ui/Modal'
import { useTontineVue } from '@/hooks/useTontineVue'
import { useCycle, useCloturerCycle, useDesignerGagnants, useRemiseApercu } from '@/hooks/useCycles'
import { useRecapCycle, useCotisations } from '@/hooks/useCotisations'
import { useMembres } from '@/hooks/useMembres'
import { useOnline } from '@/hooks/useOnline'
import { formatF, formatDateCourte, formatEcheance } from '@/lib/format'
import { TOUR_STATUT } from '@/lib/tontineLabels'
import { messageErreur } from '@/lib/apiError'
import { AccountStatus, CotisationStatut, CycleStatut, MembreStatut } from '@/types/common'
import { TontineType, type ModeRemise } from '@/types/tontine'
import type { Cycle, OptionRemise } from '@/types/cycle'

const STATUT_PILL: Record<CotisationStatut, { label: string; cls: string; icon: JSX.Element }> = {
  EN_ATTENTE: { label: 'À valider', cls: 'bg-amber-50 text-amber-800', icon: <Clock size={13} /> },
  VALIDE: { label: 'Payé', cls: 'bg-primary-50 text-primary-800', icon: <CheckCircle2 size={13} /> },
  EN_RETARD: { label: 'En retard', cls: 'bg-red-50 text-red-700', icon: <AlertTriangle size={13} /> },
  REFUSE: { label: 'Refusé', cls: 'bg-red-50 text-red-700', icon: <XCircle size={13} /> },
}

export function TourPage() {
  const { id = '', cycleId = '' } = useParams()
  const online = useOnline()
  const v = useTontineVue(id)
  const t = v.tontine
  const gerant = v.vue === 'GERE'
  const { data: cycle, isLoading, isError, refetch } = useCycle(id, cycleId)
  // Cotisations (échéances) du tour : celle en cours par défaut, une autre au choix
  const [echeanceVue, setEcheanceVue] = useState<string | null>(null)
  const echeances = cycle?.echeances ?? []
  const plusieurs = echeances.length > 1
  const echeanceCourante = cycle?.echeanceEnCours ?? [...echeances].reverse().find((e) => e.statut !== 'A_VENIR') ?? echeances[0]
  const echeanceSel = echeances.find((e) => e.id === echeanceVue) ?? echeanceCourante
  const recap = useRecapCycle(id, cycleId, 0, 200, gerant, plusieurs ? echeanceSel?.id : undefined)
  const mesCot = useCotisations(id, cycleId, 0, 50, v.ma?.monMembreId ?? undefined, v.vue === 'COTISE')
  const { data: membresData } = useMembres(id, 0, 200)
  const { mutate: cloturer, isPending: closing } = useCloturerCycle()
  const { mutate: designer, isPending: designating } = useDesignerGagnants()

  const [confirmCloture, setConfirmCloture] = useState(false)
  const [remiseOpen, setRemiseOpen] = useState(false)
  const [resultat, setResultat] = useState<Cycle | null>(null)
  const [designerOpen, setDesignerOpen] = useState(false)
  const [tirageOpen, setTirageOpen] = useState(false)
  const [choix, setChoix] = useState<string[]>([])
  const dansPanneau = useDansPanneau()

  const isEvent = t?.tontineType === TontineType.EVENEMENTIELLE
  const mot = isEvent ? 'Période' : 'Tour'
  const lignes = (recap.data?.content ?? []).filter((l) => l.statutMembre !== MembreStatut.SORTI)
  const actif = (l: (typeof lignes)[number]) => (l.statutCotisation === CotisationStatut.EN_ATTENTE || l.statutCotisation === CotisationStatut.VALIDE)
  const nonPayes = lignes.filter((l) => !actif(l) && l.statutMembre === MembreStatut.ACTIF)
  const payes = lignes.filter(actif)
  const enAttente = lignes.filter((l) => l.statutCotisation === CotisationStatut.EN_ATTENTE).length
  const valides = lignes.filter((l) => l.statutCotisation === CotisationStatut.VALIDE)
  const collecte = valides.reduce((s, l) => s + (l.montant ?? 0), 0)
  const actifs = lignes.filter((l) => l.statutMembre === MembreStatut.ACTIF).length
  const attendu = t?.montant && !t.montantLibre ? t.montant * actifs : null
  const pct = actifs ? Math.round((valides.length / actifs) * 100) : 0

  const nbGagnants = Math.max(1, t?.nombreGagnants || 1)
  const eligibles = useMemo(
    () => (membresData?.content ?? []).filter((m) => m.statut === MembreStatut.ACTIF && !m.aRecuJackpot),
    [membresData],
  )
  const sansGagnant = cycle?.statut === CycleStatut.TERMINE && !(cycle.gagnants?.length)
  const peutDesigner = gerant && !isEvent && sansGagnant && t?.ordreBeneficiaire === 'MANUEL'

  // Mes paiements du tour, dans l'ordre des cotisations
  const mesPaiements = [...(mesCot.data?.content ?? [])]
    .filter((c) => c.statut !== CotisationStatut.REFUSE)
    .sort((a, b) => (a.numeroEcheance ?? 0) - (b.numeroEcheance ?? 0))

  if (isLoading || v.isLoading) {
    return (
      <Shell title={mot}>
        <div className="space-y-4" aria-busy="true">
          <div className="h-40 rounded-3xl bg-white animate-pulse" />
          <div className="h-48 rounded-3xl bg-white animate-pulse" />
        </div>
      </Shell>
    )
  }
  if (isError || !cycle) {
    return (
      <Shell title={mot}>
        <section className="bg-white rounded-3xl shadow-sm p-6 text-center">
          <p className="text-lg font-bold text-neutral-900">{mot} introuvable</p>
          <button onClick={() => refetch()} className="mt-4 h-11 px-4 rounded-full bg-neutral-100 text-sm font-semibold inline-flex items-center gap-2">
            <RotateCw size={16} /> Réessayer
          </button>
        </section>
      </Shell>
    )
  }

  const st = TOUR_STATUT[cycle.statut]

  const onCloturer = () => cloturer(
    { tontineId: id, cycleId },
    {
      onSuccess: (c) => { setConfirmCloture(false); setResultat(c) },
      onError: (err) => toast.error(messageErreur(err, 'La clôture a échoué. Réessayez.')),
    },
  )
  const onDesigner = (membreIds: string[]) => designer(
    { tontineId: id, cycleId, request: { membreIds } },
    {
      onSuccess: (c) => { setDesignerOpen(false); setTirageOpen(false); setChoix([]); setResultat(c) },
      onError: (err) => toast.error(messageErreur(err, 'La désignation a échoué.')),
    },
  )

  // Action principale selon l'état
  let action: { label: string; onClick: () => void } | null = null
  if (gerant && cycle.statut === CycleStatut.EN_COURS) {
    action = isEvent
      ? { label: 'Clôturer la période', onClick: () => setConfirmCloture(true) }
      : { label: 'Remettre le jackpot', onClick: () => setRemiseOpen(true) }
  } else if (peutDesigner) {
    action = { label: nbGagnants > 1 ? 'Désigner les gagnants' : 'Désigner le gagnant', onClick: () => setDesignerOpen(true) }
  }

  const enCours = cycle.statut === CycleStatut.EN_COURS
  // Encaisser une cotisation passée, ou sur un tour déjà remis : on précise le tour et la cotisation
  const lienEncaisser = (membreId: string) => {
    const q = new URLSearchParams({ membre: membreId })
    if (!enCours) q.set('tour', cycleId)
    if (echeanceSel && (plusieurs || !enCours) && echeanceSel.id !== cycle.echeanceEnCours?.id) q.set('echeance', echeanceSel.id)
    return `/encaisser/${id}?${q.toString()}`
  }
  // Un retard reste payable après la remise du jackpot (rotative)
  const peutEncaisser = enCours || (!isEvent && cycle.statut === CycleStatut.TERMINE)

  return (
    <Shell title={`${mot} ${cycle.numeroCycle}${t ? ` · ${t.nom}` : ''}`}>
      <div className={clsx('space-y-4', action && !dansPanneau && 'pb-28')}>
        {/* Progression */}
        <section className="bg-white rounded-3xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">{formatDateCourte(cycle.dateDebut)} → {formatDateCourte(cycle.dateFin)}</p>
            <span className={clsx('rounded-full px-2.5 py-1 text-xs font-semibold', st.cls)}>{st.label}</span>
          </div>

          {/* Les cotisations du tour : faite ✓, en cours (pleine), à venir (grisée) */}
          {plusieurs && (
            <div className="mt-4">
              <div role="tablist" aria-label="Cotisations du tour" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {echeances.map((e) => {
                  const choisie = e.id === echeanceSel?.id
                  const aVenir = e.statut === 'A_VENIR'
                  return (
                    <button
                      key={e.id}
                      type="button"
                      role="tab"
                      aria-selected={choisie}
                      aria-label={`Cotisation ${e.numero}${aVenir ? ', à venir' : e.statut === 'EN_COURS' ? ', en cours' : ', passée'}`}
                      disabled={aVenir || !gerant}
                      onClick={() => setEcheanceVue(e.id)}
                      className={clsx(
                        'w-11 h-11 rounded-full flex items-center justify-center text-[15px] font-bold flex-shrink-0 transition',
                        choisie && gerant ? 'bg-primary-700 text-white ring-4 ring-primary-100'
                          : e.statut === 'EN_COURS' ? 'bg-primary-700 text-white'
                            : aVenir ? 'bg-neutral-100 text-neutral-400'
                              : 'bg-primary-50 text-primary-800',
                      )}
                    >
                      {e.statut === 'ECHUE' && !(choisie && gerant) ? <Check size={18} /> : e.numero}
                    </button>
                  )
                })}
              </div>
              {echeanceSel && (
                <p className="mt-2 text-sm font-medium text-neutral-700">
                  Cotisation {echeanceSel.numero} sur {echeances.length}
                  <span className="font-normal text-neutral-500">
                    {echeanceSel.statut === 'ECHUE' ? ` · échue le ${formatEcheance(echeanceSel.echeanceAt)}` : ` · avant ${formatEcheance(echeanceSel.echeanceAt)}`}
                  </span>
                </p>
              )}
            </div>
          )}
          {!plusieurs && enCours && cycle.echeanceAt && (
            <p className="mt-1 text-sm text-neutral-500">À payer avant {formatEcheance(cycle.echeanceAt)}</p>
          )}

          {enCours && !isEvent && cycle.tousPayes && (
            <p className="mt-4 flex items-center gap-2 rounded-2xl bg-yellow-50 px-3 py-2.5 text-sm font-semibold text-yellow-900">
              <Trophy size={18} className="text-yellow-700 flex-shrink-0" /> Tout le monde a payé : le jackpot peut être remis.
            </p>
          )}

          {gerant ? (
            <div className="mt-4 flex items-center gap-5">
              <Anneau pct={pct} label={`${valides.length}/${actifs}`} />
              <div>
                <p className="text-sm text-neutral-500">{plusieurs ? 'Ont payé cette cotisation' : 'Ont payé'}</p>
                <p className="text-2xl font-extrabold tabular-nums text-neutral-900">{formatF(collecte)}</p>
                {attendu ? <p className="text-sm text-neutral-500">sur {formatF(attendu)} prévus</p> : null}
                {enAttente > 0 && <p className="text-sm font-medium text-amber-800">+ {enAttente} en attente de validation</p>}
                {plusieurs && !isEvent && cycle.montantJackpotPrevu ? (
                  <p className="mt-1 text-sm text-neutral-500">Jackpot du tour : <b className="text-neutral-800">{formatF(cycle.montantJackpotPrevu)}</b></p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-4">
              {mesPaiements.length > 0 && (
                <ul className="space-y-2">
                  {mesPaiements.map((c) => (
                    <li key={c.id}>
                      <Link to={`/recu/${id}/${c.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-4 py-3">
                        <span className="font-semibold text-neutral-900">
                          {plusieurs && c.numeroEcheance ? `Cotisation ${c.numeroEcheance}` : 'Mon paiement'} · {formatF(c.montant)}
                        </span>
                        <Pill statut={c.statut} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {/* Reste-t-il une cotisation ouverte sans paiement de ma part ? */}
              {v.vue === 'COTISE' && enCours && !mesPaiements.some((c) => !plusieurs || c.echeanceId === cycle.echeanceEnCours?.id) ? (
                <Link to={`/payer/${id}`} className={clsx('flex h-14 items-center justify-center rounded-full bg-primary-700 text-white font-bold', mesPaiements.length > 0 && 'mt-3')}>
                  Payer ma cotisation
                </Link>
              ) : mesPaiements.length === 0 ? (
                <p className="text-sm text-neutral-500">Aucun paiement de votre part sur ce {mot.toLowerCase()}.</p>
              ) : null}
            </div>
          )}
        </section>

        {/* Résultat */}
        {cycle.statut === CycleStatut.TERMINE && (
          <section className="bg-white rounded-3xl shadow-sm p-5">
            <h2 className="text-[17px] font-semibold text-neutral-900">Résultat</h2>
            {/* Couleurs de l'app : jaune = jackpot/cagnotte, rose = ce qui est retiré, vert = ce qui est reçu */}
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {([
                { label: isEvent ? 'Cagnotte' : 'Jackpot', val: cycle.montantJackpot, signe: '', cls: 'bg-yellow-50', dt: 'text-yellow-800', dd: 'text-yellow-900' },
                { label: 'Commission', val: cycle.montantCommission, signe: cycle.montantCommission ? '− ' : '', cls: 'bg-rose-50', dt: 'text-rose-700', dd: 'text-rose-800' },
                { label: 'Net', val: cycle.montantNet, signe: '', cls: 'bg-primary-50', dt: 'text-primary-700', dd: 'text-primary-800' },
              ] as const).map((x) => (
                <div key={x.label} className={`rounded-2xl px-2 py-3 ${x.cls}`}>
                  <dt className={`text-xs font-medium ${x.dt}`}>{x.label}</dt>
                  <dd className={`mt-1 font-bold tabular-nums ${x.dd}`}>{x.val != null ? `${x.signe}${formatF(x.val)}` : '—'}</dd>
                </div>
              ))}
            </dl>

            {(cycle.resteARecevoir ?? 0) > 0 && (
              <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                <b>{formatF(cycle.resteARecevoir)}</b> restent à remettre {nbGagnants > 1 ? 'aux gagnants' : 'au gagnant'} quand les retards seront payés.
              </p>
            )}
            {gerant && (cycle.montantAvance ?? 0) > 0 && (
              <p className="mt-3 rounded-2xl bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
                Vous avez avancé <b>{formatF(cycle.montantAvance)}</b> : les retards payés vous remboursent d'abord.
              </p>
            )}

            {(cycle.gagnants?.length ?? 0) > 0 ? (
              <ul className="mt-4 space-y-2">
                {cycle.gagnants!.map((g) => (
                  <li key={g.membreId} className="flex items-center gap-3 rounded-2xl bg-yellow-50 px-3 py-3">
                    <Trophy size={20} className="text-yellow-700" />
                    <span className="flex-1 font-semibold text-neutral-900">{g.firstName} {g.lastName}</span>
                    <span className="font-bold text-primary-700 tabular-nums">{g.montantRecu != null ? `+${formatF(g.montantRecu)}` : '—'}</span>
                  </li>
                ))}
              </ul>
            ) : !isEvent ? (
              <p className="mt-4 text-sm text-neutral-500">
                {peutDesigner ? 'Gagnant pas encore désigné.' : 'Gagnant en cours de désignation.'}
              </p>
            ) : null}

            {cycle.distributionParMembre && cycle.distributionParMembre.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-neutral-600">Répartition finale</h3>
                <ul className="mt-2 divide-y divide-neutral-100">
                  {cycle.distributionParMembre.map((d) => (
                    <li key={d.membreId} className="flex items-center justify-between py-2">
                      <span className="text-sm text-neutral-800">{d.firstName} {d.lastName}</span>
                      <span className="text-sm font-bold tabular-nums">{formatF(d.montantNet)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Listes (gestionnaire) */}
        {gerant && recap.isLoading && <div className="h-40 rounded-3xl bg-white animate-pulse" aria-busy="true" />}
        {gerant && recap.isError && (
          <section className="bg-white rounded-3xl shadow-sm p-5 text-center">
            <p className="text-sm text-neutral-600">Impossible de charger les paiements du tour.</p>
            <button onClick={() => recap.refetch()} className="mt-3 h-11 px-4 rounded-full bg-neutral-100 text-sm font-semibold">Réessayer</button>
          </section>
        )}
        {gerant && !recap.isLoading && nonPayes.length > 0 && (
          <section className="bg-white rounded-3xl shadow-sm">
            <h2 className="px-4 pt-4 text-[17px] font-semibold text-neutral-900">Pas encore payé ({nonPayes.length})</h2>
            <ul className="divide-y divide-neutral-100">
              {nonPayes.map((l) => (
                <li key={l.membreId} className="flex items-center gap-3 px-4 py-3 min-h-[64px]">
                  <InitialsAvatar name={`${l.firstName} ${l.lastName}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-neutral-900 truncate">{l.firstName} {l.lastName}</span>
                    <span className="block text-sm text-neutral-500">
                      {[
                        plusieurs && l.echeancesDues ? `${l.echeancesPayees ?? 0}/${l.echeancesDues} cotisations payées` : '',
                        l.accountStatus === AccountStatus.PRE_ENROLLED ? 'Sans compte' : '',
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {peutEncaisser && (
                    <Link
                      to={lienEncaisser(l.membreId)}
                      className="h-10 px-4 rounded-full bg-primary-700 text-white text-sm font-bold inline-flex items-center"
                    >
                      Encaisser
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {gerant && !recap.isLoading && payes.length > 0 && (
          <section className="bg-white rounded-3xl shadow-sm">
            <h2 className="px-4 pt-4 text-[17px] font-semibold text-neutral-900">Payé ({payes.length})</h2>
            <ul className="divide-y divide-neutral-100">
              {payes.map((l) => (
                <li key={l.membreId}>
                  <Link to={`/recu/${id}/${l.cotisationId}`} className="flex items-center gap-3 px-4 py-3 min-h-[64px]">
                    <InitialsAvatar name={`${l.firstName} ${l.lastName}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-neutral-900 truncate">{l.firstName} {l.lastName}</span>
                      <span className="block text-sm text-neutral-500">{l.montant != null ? formatF(l.montant) : ''}</span>
                    </span>
                    {l.statutCotisation && <Pill statut={l.statutCotisation} />}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {gerant && !recap.isLoading && lignes.length > 0 && payes.length === 0 && cycle.statut === CycleStatut.EN_COURS && (
          <p className="text-center text-sm text-neutral-500">Personne n'a encore payé{plusieurs ? ' cette cotisation' : ''}.</p>
        )}
      </div>

      {/* Action principale */}
      {action && (
        <BarreAction>
          <div className="space-y-2">
            <button onClick={action.onClick} disabled={!online} className="w-full h-14 rounded-full bg-primary-700 text-white text-[17px] font-bold disabled:opacity-50">
              {online ? action.label : 'Connexion requise'}
            </button>
            {peutDesigner && (
              <button onClick={() => setTirageOpen(true)} disabled={!online} className="w-full h-12 rounded-full bg-white shadow-sm font-semibold text-neutral-800 inline-flex items-center justify-center gap-2 disabled:opacity-50">
                <Shuffle size={18} /> Tirage au sort
              </button>
            )}
          </div>
        </BarreAction>
      )}

      {/* Remise du jackpot (rotative) : aperçu chiffré, choix s'il manque de l'argent */}
      {remiseOpen && (
        <RemiseSheet
          tontineId={id}
          cycleId={cycleId}
          numeroCycle={cycle.numeroCycle}
          nbGagnants={nbGagnants}
          onClose={() => setRemiseOpen(false)}
          onDone={(c) => { setRemiseOpen(false); setResultat(c) }}
        />
      )}

      {/* Confirmation de clôture */}
      <Modal isOpen={confirmCloture} onClose={() => setConfirmCloture(false)} title={`Clôturer ${isEvent ? 'la période' : 'le tour'} ${cycle.numeroCycle} ?`} size="sm">
        <p className="text-neutral-600">Le jackpot sera calculé et les paiements non validés passeront en retard.</p>
        {nonPayes.length > 0 && (
          <p className="mt-2 text-sm font-medium text-amber-800">{nonPayes.length} membre{nonPayes.length > 1 ? 's' : ''} n'{nonPayes.length > 1 ? 'ont' : 'a'} pas encore payé.</p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setConfirmCloture(false)} className="h-12 rounded-full bg-neutral-100 font-semibold">Annuler</button>
          <button onClick={onCloturer} disabled={closing} className="h-12 rounded-full bg-primary-700 text-white font-bold disabled:opacity-50">
            {closing ? 'Clôture…' : 'Clôturer'}
          </button>
        </div>
      </Modal>

      {/* Désignation manuelle */}
      <Modal isOpen={designerOpen} onClose={() => { setDesignerOpen(false); setChoix([]) }} title={nbGagnants > 1 ? `Choisir ${nbGagnants} gagnants` : 'Choisir le gagnant'} size="sm">
        {eligibles.length === 0 ? (
          <p className="text-sm text-neutral-500">Aucun membre éligible (tous ont déjà reçu le jackpot).</p>
        ) : (
          <ul className="-mx-2 max-h-[50vh] overflow-y-auto">
            {eligibles.map((m) => {
              const selected = choix.includes(m.id)
              const plein = !selected && choix.length >= nbGagnants
              return (
                <li key={m.id}>
                  <button
                    onClick={() => setChoix((c) => (selected ? c.filter((x) => x !== m.id) : nbGagnants === 1 ? [m.id] : [...c, m.id]))}
                    disabled={plein && nbGagnants > 1}
                    aria-pressed={selected}
                    className={clsx('w-full flex items-center gap-3 px-2 py-3 rounded-2xl text-left', selected ? 'bg-primary-50' : 'hover:bg-neutral-50', plein && nbGagnants > 1 && 'opacity-40')}
                  >
                    <InitialsAvatar name={`${m.user.firstName} ${m.user.lastName}`} />
                    <span className="flex-1 font-semibold text-neutral-900">{m.user.firstName} {m.user.lastName}</span>
                    {m.ordreJackpot ? <span className="text-sm text-neutral-500">N° {m.ordreJackpot}</span> : null}
                    {selected && <CheckCircle2 size={20} className="text-primary-700" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <button
          onClick={() => onDesigner(choix)}
          disabled={choix.length !== Math.min(nbGagnants, eligibles.length) || designating}
          className="mt-4 w-full h-14 rounded-full bg-primary-700 text-white text-[17px] font-bold disabled:opacity-50"
        >
          {designating ? 'Enregistrement…' : 'Confirmer'}
        </button>
      </Modal>

      {/* Tirage au sort */}
      <Modal isOpen={tirageOpen} onClose={() => setTirageOpen(false)} title="Tirage au sort ?" size="sm">
        <p className="text-neutral-600">
          {nbGagnants > 1 ? `${nbGagnants} gagnants seront tirés` : 'Le gagnant sera tiré'} au sort parmi les membres qui n'ont pas encore reçu le jackpot.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => setTirageOpen(false)} className="h-12 rounded-full bg-neutral-100 font-semibold">Annuler</button>
          <button onClick={() => onDesigner([])} disabled={designating} className="h-12 rounded-full bg-primary-700 text-white font-bold disabled:opacity-50">
            {designating ? 'Tirage…' : 'Tirer au sort'}
          </button>
        </div>
      </Modal>

      {/* Écran de résultat après clôture / désignation */}
      <Modal isOpen={!!resultat} onClose={() => setResultat(null)} title={isEvent ? 'Période clôturée' : 'Jackpot remis'} size="sm">
        {resultat && (
          <div className="text-center py-2">
            <span className="mx-auto w-20 h-20 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center animate-pop">
              {(resultat.gagnants?.length ?? 0) > 0 ? <Trophy size={40} /> : <PartyPopper size={40} />}
            </span>
            {(resultat.gagnants?.length ?? 0) > 0 ? (
              <p className="mt-4 text-lg font-bold text-neutral-900">
                Jackpot de {formatF(resultat.montantNet)} pour {resultat.gagnants!.map((g) => g.firstName).join(', ')}
              </p>
            ) : (
              <p className="mt-4 text-lg font-bold text-neutral-900">
                {resultat.montantNet != null ? `Net à remettre : ${formatF(resultat.montantNet)}` : 'Clôture enregistrée'}
              </p>
            )}
            {resultat.distributionParMembre && resultat.distributionParMembre.length > 0 && (
              <p className="mt-1 text-sm text-neutral-500">La cagnotte est répartie entre tous les membres.</p>
            )}
            {(resultat.resteARecevoir ?? 0) > 0 && (
              <p className="mt-1 text-sm text-neutral-500">Encore {formatF(resultat.resteARecevoir)} à remettre quand les retards seront payés.</p>
            )}
            <button onClick={() => setResultat(null)} className="mt-6 w-full h-14 rounded-full bg-primary-700 text-white text-[17px] font-bold">Terminé</button>
          </div>
        )}
      </Modal>
    </Shell>
  )
}

// ─── Remise du jackpot ───────────────────────────────────────────────────────

/** Ordre d'affichage : la plus simple d'abord, « attendre » en dernier. CAISSE n'est pas encore disponible. */
const OPTIONS_REMISE: { mode: ModeRemise; titre: string; detail: (o: OptionRemise) => string }[] = [
  {
    mode: 'DISPONIBLE',
    titre: 'Remettre ce qui est collecté',
    detail: (o) => (o.resteARecevoir ?? 0) > 0 ? `Puis ${formatF(o.resteARecevoir)} de plus quand les retards seront payés.` : 'Le gagnant reçoit tout de suite.',
  },
  {
    mode: 'AVANCE_COMMISSION',
    titre: 'Compléter avec ma commission',
    detail: (o) => `Vous gardez ${formatF(o.commission)} de commission${(o.montantARecuperer ?? 0) > 0 ? ` ; ${formatF(o.montantARecuperer)} vous reviennent quand les retards seront payés` : ''}.`,
  },
  {
    mode: 'AVANCE_GESTIONNAIRE',
    titre: 'Avancer de ma poche',
    detail: (o) => `Vous avancez ${formatF(o.avanceGestionnaire)}, remboursés quand les retards seront payés.`,
  },
  { mode: 'ATTENDRE', titre: 'Attendre les retardataires', detail: () => 'Rien n’est remis pour l’instant.' },
]

function RemiseSheet({ tontineId, cycleId, numeroCycle, nbGagnants, onClose, onDone }: {
  tontineId: string
  cycleId: string
  numeroCycle: number
  nbGagnants: number
  onClose: () => void
  onDone: (cycle: Cycle) => void
}) {
  const apercu = useRemiseApercu(tontineId, cycleId, true)
  const { mutate: cloturer, isPending } = useCloturerCycle()
  const [choix, setChoix] = useState<ModeRemise | null>(null)
  const a = apercu.data
  const complet = !!a && a.manquant <= 0

  // Options applicables à ce tour ; « attendre » reste proposée tant qu'il manque de l'argent
  const options = !a ? [] : OPTIONS_REMISE
    .map((def) => ({ def, o: a.options.find((x) => x.modeRemise === def.mode) }))
    .filter((x): x is { def: (typeof OPTIONS_REMISE)[number]; o: OptionRemise } => !!x.o && (x.o.possible || x.def.mode === 'ATTENDRE'))
  const parDefaut = options.find((x) => x.def.mode === a?.modeRemiseParDefaut) ?? options[0]
  const choisie = options.find((x) => x.def.mode === choix) ?? parDefaut
  // Jackpot complet : toutes les options donnent le même résultat, on montre seulement les montants
  const reference = complet ? a?.options.find((x) => x.possible && x.modeRemise !== 'ATTENDRE') ?? a?.options[0] : choisie?.o
  const attendre = !complet && choisie?.def.mode === 'ATTENDRE'

  const remettre = () => {
    if (attendre) { onClose(); return }
    cloturer(
      { tontineId, cycleId, modeRemise: complet ? undefined : choisie?.def.mode },
      {
        onSuccess: onDone,
        onError: (err) => toast.error(messageErreur(err, 'La remise a échoué. Réessayez.')),
      },
    )
  }

  return (
    <Modal isOpen onClose={onClose} title={`Remettre le jackpot · Tour ${numeroCycle}`} size="md">
      {apercu.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <div className="h-24 rounded-2xl bg-neutral-100 animate-pulse" />
          <div className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />
        </div>
      ) : !a ? (
        // Aperçu indisponible : remise simple, selon le réglage de la tontine
        <>
          <p className="text-neutral-600">Le jackpot sera calculé sur les paiements validés. Les paiements non validés passeront en retard.</p>
          <button onClick={remettre} disabled={isPending} className="mt-5 w-full h-14 rounded-full bg-primary-700 text-white text-[17px] font-bold disabled:opacity-50">
            {isPending ? 'Remise…' : 'Remettre le jackpot'}
          </button>
        </>
      ) : (
        <div className="space-y-4">
          {/* Où on en est */}
          {complet ? (
            <div className="rounded-2xl bg-primary-50 px-4 py-4 text-center">
              <p className="text-sm font-semibold text-primary-800 inline-flex items-center gap-1.5"><CheckCircle2 size={16} /> Tout est collecté</p>
              <p className="mt-1 text-[30px] leading-tight font-extrabold tabular-nums text-neutral-900">{formatF(a.collecte)}</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50 px-4 py-4">
              <p className="text-sm font-semibold text-amber-900 inline-flex items-center gap-1.5"><AlertTriangle size={16} /> Il manque {formatF(a.manquant)}</p>
              <p className="mt-1 text-sm text-amber-900">{formatF(a.collecte)} collectés sur {formatF(a.jackpotPrevu)} prévus.</p>
              {a.retardataires.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {a.retardataires.slice(0, 5).map((r) => (
                    <li key={r.membreId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-neutral-900 truncate">
                        {r.firstName} {r.lastName}
                        {r.echeancesManquees > 1 && <span className="font-normal text-neutral-600"> · {r.echeancesManquees} cotisations</span>}
                      </span>
                      <span className="font-bold tabular-nums text-red-700 flex-shrink-0">− {formatF(r.montant)}</span>
                    </li>
                  ))}
                  {a.retardataires.length > 5 && <li className="text-sm text-neutral-600">+ {a.retardataires.length - 5} autres</li>}
                </ul>
              )}
            </div>
          )}

          {/* Que faire ? (seulement s'il manque de l'argent) */}
          {!complet && (
            <div role="radiogroup" aria-label="Que voulez-vous faire ?" className="space-y-2">
              <p className="text-sm font-semibold text-neutral-700">Que voulez-vous faire ?</p>
              {options.map(({ def, o }) => {
                const actif = choisie?.def.mode === def.mode
                return (
                  <button
                    key={def.mode}
                    type="button"
                    role="radio"
                    aria-checked={actif}
                    onClick={() => setChoix(def.mode)}
                    className={clsx('w-full flex items-start gap-3 rounded-2xl border-2 px-3 py-3 text-left transition', actif ? 'border-primary-700 bg-primary-50' : 'border-neutral-200')}
                  >
                    {actif ? <CheckCircle2 size={22} className="mt-0.5 text-primary-700 flex-shrink-0" /> : <Circle size={22} className="mt-0.5 text-neutral-300 flex-shrink-0" />}
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-neutral-900">{def.titre}</span>
                      <span className="block text-sm text-neutral-600">{def.detail(o)}</span>
                    </span>
                    {def.mode !== 'ATTENDRE' && (
                      <span className="text-right flex-shrink-0">
                        <span className="block font-extrabold tabular-nums text-primary-800">{formatF(o.montantBeneficiaire)}</span>
                        <span className="block text-[11px] text-neutral-500">{nbGagnants > 1 ? 'par gagnant' : 'au gagnant'}</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Ce que ça donne */}
          {reference && !attendre && (
            <dl className="rounded-2xl bg-neutral-50 px-4 py-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-600">{nbGagnants > 1 ? 'Chaque gagnant reçoit' : 'Le gagnant reçoit'}</dt>
                <dd className="font-extrabold tabular-nums text-primary-800">{formatF(reference.montantBeneficiaire)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-600">Votre commission</dt>
                <dd className="font-bold tabular-nums text-neutral-900">{formatF(reference.commission)}</dd>
              </div>
            </dl>
          )}

          <button onClick={remettre} disabled={isPending || (!attendre && !reference)} className={clsx('w-full h-14 rounded-full text-[17px] font-bold disabled:opacity-50', attendre ? 'bg-neutral-100 text-neutral-900' : 'bg-primary-700 text-white')}>
            {isPending ? 'Remise…' : attendre ? 'Attendre' : `Remettre ${formatF(reference?.montantNet)}`}
          </button>
          <p className="text-center text-xs text-neutral-500">
            L'argent est remis en dehors de l'application : Dinthialma enregistre votre décision et en garde la trace.
          </p>
        </div>
      )}
    </Modal>
  )
}

function Pill({ statut }: { statut: CotisationStatut }) {
  const p = STATUT_PILL[statut]
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold flex-shrink-0', p.cls)}>{p.icon} {p.label}</span>
}

/** Anneau de progression avec la valeur en texte (« 8/12 ») */
function Anneau({ pct, label }: { pct: number; label: string }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`${label} ont payé`} className="flex-shrink-0">
      <circle cx="44" cy="44" r={r} fill="none" stroke="#f3f4f6" strokeWidth="9" />
      <circle
        cx="44" cy="44" r={r} fill="none" stroke="#15803d" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, pct) / 100)} transform="rotate(-90 44 44)"
      />
      <text x="44" y="49" textAnchor="middle" fontSize="16" fontWeight="800" fill="#111827">{label}</text>
    </svg>
  )
}

/** Plein écran (mobile) ou panneau à droite de la liste des tours (desktop) */
const Shell = EcranDetail
