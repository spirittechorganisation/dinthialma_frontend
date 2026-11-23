/**
 * T8 — Réglages / Infos de la tontine (gabarit « Paramètres »).
 * Gestionnaire : règles, limite de paiement et rappels (modifiables en cours), option de remise du jackpot,
 * commissions (ajouter / modifier / supprimer), partager le QR d'invitation,
 * actions sensibles (suspendre / relancer, supprimer le brouillon).
 * Membre / lecture : règles, gestionnaire à contacter, commissions en consultation.
 */
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { RegleRetrait } from '@/components/epargne/RegleRetrait'
import { Phone, Plus, Pencil, Trash2, RotateCw, CheckCircle2, Circle, AlertTriangle, Star } from 'lucide-react'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Modal } from '@/components/ui/Modal'
import { QrCard } from '@/components/home/QrCard'
import { useTontineVue } from '@/hooks/useTontineVue'
import {
  useCommissions, useCreateCommission, useUpdateCommission, useDeleteCommission,
  useSuspendreTontine, useActiverTontine, useDeleteTontine, useModifierEcheance, useModifierReglages,
  useCloturerTontine,
} from '@/hooks/useTontines'
import { usePriorites, useAccepterPriorite, useRefuserPriorite } from '@/hooks/usePriorites'
import { EcheancePicker } from '@/components/tontine/EcheancePicker'
import { Stepper } from '@/components/ui/Stepper'
import { useOnline } from '@/hooks/useOnline'
import { formatDateCourte } from '@/lib/format'
import { formatPhoneLocal, toLocalPhone } from '@/lib/phone'
import {
  libelleMontant, rythmeDe, rythmePhraseDe, echeancePhrase, dureeTour, capital,
  HEURE_ECHEANCE_DEFAUT, DECLENCHEMENTS, MODES_REMISE,
} from '@/lib/tontineLabels'
import { useInvitationTontine, useRegenererInvitation, useRevoquerInvitation } from '@/hooks/useQr'
import { messageErreur } from '@/lib/apiError'
import { ModeCycle, TontineStatut } from '@/types/common'
import { TontineType, type Commission, type Tontine, type RappelsEcheance, type ModeRemise, type ClotureEnSuspensResponse } from '@/types/tontine'
import { TYPES_COMMISSION, valeurCommission } from '@/lib/commissions'
import type { PrioriteJackpot } from '@/types/priorite'
import { isAxiosError } from 'axios'

const ORDRE: Record<string, string> = {
  ROTATION: 'Chacun son tour (ordre fixe)',
  ALEATOIRE: 'Tirage au sort',
  MANUEL: 'Choisi par le gestionnaire',
}


type Sensible = 'suspendre' | 'relancer' | 'supprimer' | 'cloturer'

/** Rappels en clair ; valeurs par défaut du backend : la veille + 3 h avant */
function rappelsTexte(r: RappelsEcheance | null | undefined): string {
  const veille = r?.veille ?? true
  const heures = r?.heuresAvant ?? 3
  const morceaux = [veille ? 'la veille à 18h' : '', heures > 0 ? `${heures} h avant` : ''].filter(Boolean)
  return morceaux.length ? capital(morceaux.join(' et ')) : 'Aucun rappel'
}

export function ReglagesTontinePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const online = useOnline()
  const v = useTontineVue(id)
  const t = v.tontine
  const gerant = v.vue === 'GERE'
  const { data: commissionsData, isLoading: comLoading } = useCommissions(id, 0, 50)
  const commissions = commissionsData?.content ?? []

  const [edition, setEdition] = useState<Commission | 'nouvelle' | null>(null)
  // ?action=cloturer (depuis une période, CLOTURE_FINALE_PREMATUREE) : la confirmation s'ouvre directement
  const [params] = useSearchParams()
  const [sensible, setSensible] = useState<Sensible | null>(() => (params.get('action') === 'cloturer' ? 'cloturer' : null))
  const [echeanceOpen, setEcheanceOpen] = useState(false)
  const [clotureEnSuspens, setClotureEnSuspens] = useState<ClotureEnSuspensResponse | null>(null)
  const { mutate: changerRemise, isPending: remisePending, variables: remiseEnvoyee } = useModifierReglages()
  const { mutate: suspendre, isPending: suspending } = useSuspendreTontine()
  const { mutate: activer, isPending: activating } = useActiverTontine()
  const { mutate: supprimer, isPending: deleting } = useDeleteTontine()
  const { mutate: cloturer, isPending: cloturing } = useCloturerTontine()
  const { mutate: supprimerCommission } = useDeleteCommission()
  const invitationActive = gerant && t?.statut === TontineStatut.ACTIVE
  const invitation = useInvitationTontine(invitationActive ? id : null)
  const { mutate: regenerer, isPending: regenerating } = useRegenererInvitation(id)
  const { mutate: revoquer, isPending: revoking } = useRevoquerInvitation(id)

  if (v.isLoading) {
    return <Shell title="Réglages"><div className="space-y-4" aria-busy="true"><div className="h-64 rounded-3xl bg-white animate-pulse" /><div className="h-32 rounded-3xl bg-white animate-pulse" /></div></Shell>
  }
  if (v.isError || !t) {
    return (
      <Shell title="Réglages">
        <section className="bg-white rounded-3xl shadow-sm p-6 text-center">
          <p className="text-lg font-bold text-neutral-900">Tontine introuvable</p>
          <button onClick={() => v.refetch()} className="mt-4 h-11 px-4 rounded-full bg-neutral-100 text-sm font-semibold inline-flex items-center gap-2"><RotateCw size={16} /> Réessayer</button>
        </section>
      </Shell>
    )
  }

  const isEvent = t.tontineType === TontineType.EVENEMENTIELLE
  const brouillon = t.statut === TontineStatut.BROUILLON
  const terminee = t.statut === TontineStatut.TERMINEE
  const rythme = rythmeDe(t)
  // « Chaque semaine, le dimanche, avant 20h » ; sans jour ni heure imposés : fin de chaque période
  const limite = echeancePhrase(t)
  const paiementTexte = `${rythme ? capital(rythmePhraseDe(rythme)) : 'À chaque période'}${limite ? `, ${limite}` : ''}`
  const modeRemise: ModeRemise = (remisePending && remiseEnvoyee?.modeRemise) || t.modeRemise || 'DISPONIBLE'
  const regles: [string, string][] = [
    ['Type', isEvent ? 'Pour un événement' : 'Chacun son tour'],
    ['Montant', libelleMontant(t)],
    ...(isEvent
      ? [
          ...(t.nomEvenement ? [['Événement', t.nomEvenement] as [string, string]] : []),
          ['Date de l\'événement', formatDateCourte(t.dateEcheance)] as [string, string],
        ]
      : [
          ['Membres', `${t.nombreMembresActuels} / ${t.nombreMembres}`] as [string, string],
          ['Gagnants par tour', String(t.nombreGagnants || 1)] as [string, string],
          ['Ordre des gagnants', ORDRE[t.ordreBeneficiaire ?? ''] ?? t.ordreBeneficiaire ?? '—'] as [string, string],
          ['Tours', t.modeCycle === ModeCycle.MANUEL ? 'Démarrés par le gestionnaire' : 'Automatiques'] as [string, string],
          ['Jackpot', (t.cotisationsParTour ?? 1) > 1
            ? `Toutes les ${t.cotisationsParTour} cotisations${rythme ? ` · ${dureeTour(rythme, t.cotisationsParTour ?? 1)}` : ''}`
            : 'À chaque cotisation'] as [string, string],
          ['Remise du jackpot', DECLENCHEMENTS.find((d) => d.value === t.declenchementJackpot)?.label ?? 'À la fin du tour'] as [string, string],
        ]),
    ['Début', formatDateCourte(t.dateDebut)],
    ['Créée le', formatDateCourte(t.createdAt)],
  ]

  const tel = toLocalPhone(t.creePar?.phone)
  const gestionnaire = [t.creePar?.firstName, t.creePar?.lastName].filter(Boolean).join(' ')

  // Événementielle : la fiche montre la répartition finale par membre
  const apresCloture = isEvent ? `/tontine/${id}` : '/accueil'

  const executerSensible = () => {
    if (!sensible) return
    const ok = (msg: string) => () => { toast.success(msg); setSensible(null) }
    const ko = (err: unknown) => toast.error(messageErreur(err, "L'action a échoué. Réessayez."))
    if (sensible === 'suspendre') suspendre(id, { onSuccess: ok('Tontine suspendue'), onError: ko })
    else if (sensible === 'relancer') activer(id, { onSuccess: ok('Tontine relancée'), onError: ko })
    else if (sensible === 'cloturer') {
      cloturer({ id }, {
        onSuccess: () => { toast.success('Tontine clôturée'); setSensible(null); navigate(apresCloture) },
        onError: (err) => {
          if (isAxiosError(err) && err.response?.status === 409) {
            const suspens = (err.response.data as { data?: ClotureEnSuspensResponse })?.data
            if (suspens) { setClotureEnSuspens(suspens); setSensible(null); return }
          }
          ko(err)
        },
      })
    }
    else supprimer(id, { onSuccess: () => { toast.success('Brouillon supprimé'); navigate('/accueil', { replace: true }) }, onError: ko })
  }

  const confirmerClotureForce = () => {
    setClotureEnSuspens(null)
    cloturer({ id, forcer: true }, {
      onSuccess: () => { toast.success('Tontine clôturée'); navigate(apresCloture) },
      onError: (err) => toast.error(messageErreur(err, "La clôture a échoué. Réessayez.")),
    })
  }

  const textesSensibles: Record<Sensible, { titre: string; texte: string; bouton: string; danger: boolean }> = {
    suspendre: { titre: 'Suspendre la tontine ?', texte: 'Les membres ne pourront plus cotiser tant qu\'elle est suspendue.', bouton: 'Suspendre', danger: true },
    relancer: { titre: 'Relancer la tontine ?', texte: 'Les membres pourront de nouveau cotiser.', bouton: 'Relancer', danger: false },
    supprimer: { titre: 'Supprimer le brouillon ?', texte: 'La tontine et ses réglages seront supprimés.', bouton: 'Supprimer', danger: true },
    cloturer: {
      titre: 'Clôturer la tontine ?',
      texte: isEvent
        ? 'L’épargne est partagée maintenant : chacun reçoit son solde (ce qu’il a cotisé, moins ses retraits). Aucune nouvelle période ne s’ouvrira. Cette action est irréversible.'
        : 'La tontine sera définitivement terminée. Aucun nouveau tour ne pourra être ouvert. Cette action est irréversible.',
      bouton: 'Clôturer',
      danger: true,
    },
  }

  return (
    <Shell title={gerant ? `Réglages · ${t.nom}` : `Infos · ${t.nom}`}>
      <div className="space-y-5">
        <Section
          titre="Règles"
          action={gerant && brouillon ? (
            <button onClick={() => navigate(`/tontine/${id}/modifier`)} disabled={!online} className="h-9 px-3 rounded-full bg-primary-50 text-sm font-semibold text-primary-800 inline-flex items-center gap-1 disabled:opacity-50">
              <Pencil size={15} /> Modifier
            </button>
          ) : undefined}
        >
          <dl className="divide-y divide-neutral-100">
            {regles.map(([k, val]) => (
              <div key={k} className="flex items-start justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-neutral-500">{k}</dt>
                <dd className="text-sm font-semibold text-neutral-900 text-right">{val}</dd>
              </div>
            ))}
          </dl>
          {t.description && <p className="px-4 pb-4 text-sm text-neutral-600">{t.description}</p>}
        </Section>

        <Section
          titre="Paiement et rappels"
          action={gerant && !terminee ? (
            <button onClick={() => setEcheanceOpen(true)} disabled={!online} className="h-9 px-3 rounded-full bg-primary-50 text-sm font-semibold text-primary-800 inline-flex items-center gap-1 disabled:opacity-50">
              <Pencil size={15} /> Modifier
            </button>
          ) : undefined}
        >
          <dl className="divide-y divide-neutral-100">
            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-neutral-500">À payer</dt>
              <dd className="text-sm font-semibold text-neutral-900 text-right">{paiementTexte}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-neutral-500">Rappels</dt>
              <dd className="text-sm font-semibold text-neutral-900 text-right">{rappelsTexte(t.rappels)}</dd>
            </div>
          </dl>
        </Section>

        {/* Rotative : que faire quand il manque des cotisations au moment de remettre le jackpot */}
        {gerant && !isEvent && !terminee && (
          <Section titre="S'il manque de l'argent à la remise">
            <div role="radiogroup" aria-label="Option de remise par défaut" className="divide-y divide-neutral-100">
              {MODES_REMISE.map((m) => {
                const choisi = modeRemise === m.value
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={choisi}
                    disabled={!online || remisePending}
                    onClick={() => !choisi && changerRemise({ id, modeRemise: m.value }, {
                      onSuccess: () => toast.success('Option de remise enregistrée'),
                      onError: (e) => toast.error(messageErreur(e, "L'enregistrement a échoué. Réessayez.")),
                    })}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left disabled:opacity-60"
                  >
                    {choisi ? <CheckCircle2 size={22} className="mt-0.5 text-primary-700 flex-shrink-0" /> : <Circle size={22} className="mt-0.5 text-neutral-300 flex-shrink-0" />}
                    <span className="min-w-0">
                      <span className="block font-semibold text-neutral-900">{m.label}</span>
                      <span className="block text-sm text-neutral-500">{m.detail}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="px-4 pb-4 pt-1 text-xs text-neutral-500">Vous pourrez choisir autrement à chaque remise.</p>
          </Section>
        )}

        {!gerant && (
          <Section titre="Gestionnaire">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1">
                <span className="block font-semibold text-neutral-900">{gestionnaire || '—'}</span>
                <span className="block text-sm text-neutral-500">{formatPhoneLocal(t.creePar?.phone)}</span>
              </span>
              {tel && (
                <a href={`tel:+221${tel}`} className="h-11 px-4 rounded-full bg-neutral-100 text-sm font-semibold inline-flex items-center gap-1.5"><Phone size={16} /> Appeler</a>
              )}
            </div>
          </Section>
        )}

        <Section
          titre="Commissions"
          action={gerant ? (
            <button onClick={() => setEdition('nouvelle')} disabled={!online} className="h-9 px-3 rounded-full bg-primary-50 text-sm font-semibold text-primary-800 inline-flex items-center gap-1 disabled:opacity-50">
              <Plus size={15} /> Ajouter
            </button>
          ) : undefined}
        >
          {comLoading ? (
            <div className="p-4"><div className="h-12 rounded-2xl bg-neutral-100 animate-pulse" /></div>
          ) : commissions.length === 0 ? (
            <p className="px-4 py-4 text-sm text-neutral-500">Aucune commission</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {commissions.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3 min-h-[56px]">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-neutral-900">{TYPES_COMMISSION.find((x) => x.value === c.type)?.label ?? c.type}</span>
                    {c.description && <span className="block text-sm text-neutral-500 truncate">{c.description}</span>}
                  </span>
                  <span className="font-bold tabular-nums">{valeurCommission(c)}</span>
                  {gerant && (
                    <>
                      <button onClick={() => setEdition(c)} disabled={!online} className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-600 hover:bg-neutral-100" aria-label="Modifier la commission"><Pencil size={17} /></button>
                      <button
                        onClick={() => supprimerCommission({ tontineId: id, commissionId: c.id }, {
                          onSuccess: () => toast.success('Commission supprimée'),
                          onError: () => toast.error('Suppression impossible'),
                        })}
                        disabled={!online}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-red-600 hover:bg-red-50"
                        aria-label="Supprimer la commission"
                      >
                        <Trash2 size={17} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {invitationActive && (
          <section className="space-y-2">
            <QrCard
              title={`Inviter dans ${t.nom}`}
              subtitle={invitation.data ? `Code ${invitation.data.code}` : invitation.isError ? 'Lien d’invitation désactivé' : 'Préparation du lien…'}
              url={invitation.data?.url ?? null}
              onShare={() => navigate(`/partager?tontine=${t.id}`)}
              shareText={`Rejoins notre tontine ${t.nom} (${libelleMontant(t)}) :`}
            />
            <div className="flex flex-wrap gap-2 px-1">
              <button
                onClick={() => regenerer(undefined, { onSuccess: () => toast.success('Nouveau code créé : l’ancien lien ne fonctionne plus'), onError: (e) => toast.error(messageErreur(e)) })}
                disabled={!online || regenerating}
                className="h-10 px-4 rounded-full bg-white shadow-sm text-sm font-semibold text-neutral-700 disabled:opacity-50"
              >
                Nouveau code
              </button>
              {invitation.data && (
                <button
                  onClick={() => revoquer(undefined, { onSuccess: () => toast.success('Lien d’invitation désactivé'), onError: (e) => toast.error(messageErreur(e)) })}
                  disabled={!online || revoking}
                  className="h-10 px-4 rounded-full bg-white shadow-sm text-sm font-semibold text-red-700 disabled:opacity-50"
                >
                  Désactiver le lien
                </button>
              )}
            </div>
          </section>
        )}

        {/* FR29 : retraits anticipés d'une épargne (B42) */}
        {gerant && isEvent && !terminee && <RegleRetrait tontineId={id} regle={t.regleRetrait} online={online} />}

        {gerant && !isEvent && t.statut === TontineStatut.ACTIVE && (
          <SectionPriorites tontineId={id} online={online} />
        )}

        {gerant && (
          <Section titre="Actions sensibles">
            <div className="divide-y divide-neutral-100">
              {t.statut === TontineStatut.ACTIVE && (
                <button onClick={() => setSensible('suspendre')} disabled={!online} className="w-full h-14 px-4 text-left font-medium text-amber-800 disabled:opacity-50">Suspendre la tontine</button>
              )}
              {t.statut === TontineStatut.SUSPENDUE && (
                <button onClick={() => setSensible('relancer')} disabled={!online} className="w-full h-14 px-4 text-left font-medium text-primary-800 disabled:opacity-50">Relancer la tontine</button>
              )}
              {(t.statut === TontineStatut.ACTIVE || t.statut === TontineStatut.SUSPENDUE) && (
                <button onClick={() => setSensible('cloturer')} disabled={!online || cloturing} className="w-full h-14 px-4 text-left font-medium text-red-700 disabled:opacity-50">Clôturer la tontine</button>
              )}
              {brouillon && (
                <button onClick={() => setSensible('supprimer')} disabled={!online} className="w-full h-14 px-4 text-left font-medium text-red-700 disabled:opacity-50">Supprimer le brouillon</button>
              )}
              {t.statut === TontineStatut.TERMINEE && <p className="px-4 py-4 text-sm text-neutral-500">Tontine terminée.</p>}
            </div>
          </Section>
        )}
      </div>

      {echeanceOpen && <EcheanceSheet tontine={t} onClose={() => setEcheanceOpen(false)} />}

      {edition && (
        <CommissionSheet
          tontineId={id}
          commission={edition === 'nouvelle' ? null : edition}
          onClose={() => setEdition(null)}
        />
      )}

      <Modal isOpen={!!sensible} onClose={() => setSensible(null)} title={sensible ? textesSensibles[sensible].titre : ''} size="sm">
        {sensible && (
          <>
            <p className="text-neutral-600">{textesSensibles[sensible].texte}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setSensible(null)} className="h-12 rounded-full bg-neutral-100 font-semibold">Annuler</button>
              <button
                onClick={executerSensible}
                disabled={suspending || activating || deleting || cloturing}
                className={clsx('h-12 rounded-full text-white font-bold disabled:opacity-50', textesSensibles[sensible].danger ? 'bg-red-600' : 'bg-primary-700')}
              >
                {suspending || activating || deleting || cloturing ? '…' : textesSensibles[sensible].bouton}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Modal de confirmation clôture avec points en suspens */}
      <Modal isOpen={!!clotureEnSuspens} onClose={() => setClotureEnSuspens(null)} title="Points en suspens" size="sm">
        {clotureEnSuspens && (
          <>
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 mb-4 flex items-start gap-2">
              <AlertTriangle size={18} className="text-amber-700 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">
                {isEvent
                  ? 'La clôture est possible mais des éléments restent ouverts. La répartition se fera sur ce qui a été encaissé.'
                  : 'La clôture est possible mais des éléments restent ouverts. Les tours déjà commencés peuvent encore être remis ; aucun nouveau tour ne s’ouvrira.'}
              </p>
            </div>
            <ul className="space-y-2 text-sm text-neutral-700">
              {/* FR25 : une épargne n'a pas de tour à remettre ; ses périodes restantes sont annulées */}
              {clotureEnSuspens.toursNonRemis.length > 0 && (isEvent ? (
                <li>• <strong>{clotureEnSuspens.toursNonRemis.length}</strong> période{clotureEnSuspens.toursNonRemis.length > 1 ? 's' : ''} à venir {clotureEnSuspens.toursNonRemis.length > 1 ? 'seront annulées' : 'sera annulée'}, la répartition se fera sur ce qui a été encaissé</li>
              ) : (
                <li>• <strong>{clotureEnSuspens.toursNonRemis.length}</strong> tour{clotureEnSuspens.toursNonRemis.length > 1 ? 's' : ''} non remis</li>
              ))}
              {!isEvent && clotureEnSuspens.toursSansGagnant.length > 0 && (
                <li>• <strong>{clotureEnSuspens.toursSansGagnant.length}</strong> tour{clotureEnSuspens.toursSansGagnant.length > 1 ? 's' : ''} sans gagnant désigné</li>
              )}
              {clotureEnSuspens.retards.length > 0 && (
                <li>• <strong>{clotureEnSuspens.retards.length}</strong> membre{clotureEnSuspens.retards.length > 1 ? 's' : ''} en retard</li>
              )}
              {clotureEnSuspens.complements.length > 0 && (
                <li>• <strong>{clotureEnSuspens.complements.length}</strong> complément{clotureEnSuspens.complements.length > 1 ? 's' : ''} à remettre</li>
              )}
              {clotureEnSuspens.cotisationsAValider > 0 && (
                <li>• <strong>{clotureEnSuspens.cotisationsAValider}</strong> paiement{clotureEnSuspens.cotisationsAValider > 1 ? 's' : ''} à valider</li>
              )}
            </ul>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setClotureEnSuspens(null)} className="h-12 rounded-full bg-neutral-100 font-semibold">Annuler</button>
              <button
                onClick={confirmerClotureForce}
                disabled={cloturing}
                className="h-12 rounded-full bg-red-600 text-white font-bold disabled:opacity-50"
              >
                {cloturing ? '…' : 'Clôturer quand même'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </Shell>
  )
}

/** Feuille « Paiement et rappels » : jour et heure limites, rappels avant l'échéance (modifiable en cours) */
function EcheanceSheet({ tontine: t, onClose }: { tontine: Tontine; onClose: () => void }) {
  const unite = rythmeDe(t)?.unite ?? 'MOIS'
  const [jour, setJour] = useState(t.jourEcheance ?? '')
  const [heure, setHeure] = useState((t.heureEcheance ?? HEURE_ECHEANCE_DEFAUT).slice(0, 5))
  const [veille, setVeille] = useState(t.rappels?.veille ?? true)
  const [heuresAvant, setHeuresAvant] = useState(t.rappels?.heuresAvant ?? 3)
  const { mutate: enregistrer, isPending } = useModifierEcheance()
  const enCours = t.statut === TontineStatut.ACTIVE || t.statut === TontineStatut.SUSPENDUE

  const valider = () => enregistrer(
    // jourEcheance "" retire le jour imposé
    { id: t.id, request: { jourEcheance: jour, heureEcheance: heure, rappels: { veille, heuresAvant } } },
    {
      onSuccess: () => { toast.success(enCours ? 'Enregistré : les membres sont prévenus' : 'Enregistré'); onClose() },
      onError: (e) => toast.error(messageErreur(e, "L'enregistrement a échoué. Réessayez.")),
    },
  )

  return (
    <Modal isOpen onClose={onClose} title="Paiement et rappels" size="sm">
      <div className="space-y-5">
        <EcheancePicker unite={unite} jour={jour} onJour={setJour} heure={heure} onHeure={setHeure} />

        <div>
          <p className="text-sm font-semibold text-neutral-700">Rappels aux membres qui n'ont pas payé</p>
          <label className="mt-2 flex items-center justify-between h-12 px-4 rounded-2xl bg-neutral-100">
            <span className="font-medium text-neutral-800">La veille à 18h</span>
            <input type="checkbox" checked={veille} onChange={(e) => setVeille(e.target.checked)} className="w-6 h-6 accent-primary-700" />
          </label>
          <div className="mt-3">
            <Stepper value={heuresAvant} min={0} max={24} onChange={setHeuresAvant} label={heuresAvant === 0 ? 'pas de rappel le jour même' : `heure${heuresAvant > 1 ? 's' : ''} avant la limite`} small />
          </div>
        </div>

        {enCours && (
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Le tour en cours ne change pas. La nouvelle limite s'applique aux prochains tours et les membres sont prévenus.
          </p>
        )}

        <button onClick={valider} disabled={isPending} className="w-full h-14 rounded-full bg-primary-700 text-white text-[17px] font-bold disabled:opacity-50">
          {isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </Modal>
  )
}

/** Feuille Commission : type (création seulement), valeur, description */
function CommissionSheet({ tontineId, commission, onClose }: { tontineId: string; commission: Commission | null; onClose: () => void }) {
  const [type, setType] = useState<Commission['type']>(commission?.type ?? 'POURCENTAGE_JACKPOT')
  const [valeur, setValeur] = useState(commission ? String(commission.valeur) : '')
  const [description, setDescription] = useState(commission?.description ?? '')
  const { mutate: creer, isPending: creating } = useCreateCommission()
  const { mutate: modifier, isPending: updating } = useUpdateCommission()
  const unite = TYPES_COMMISSION.find((x) => x.value === type)?.unite ?? 'F'
  const n = Number(valeur.replace(',', '.'))
  const invalide = !valeur || !Number.isFinite(n) || n <= 0 || (unite === '%' && n > 100)

  const enregistrer = () => {
    const done = { onSuccess: () => { toast.success(commission ? 'Commission modifiée' : 'Commission ajoutée'); onClose() }, onError: () => toast.error('Enregistrement impossible') }
    if (commission) modifier({ tontineId, commissionId: commission.id, request: { valeur: n, description: description.trim() || undefined } }, done)
    else creer({ tontineId, request: { type, valeur: n, description: description.trim() || undefined } }, done)
  }

  return (
    <Modal isOpen onClose={onClose} title={commission ? 'Modifier la commission' : 'Ajouter une commission'} size="sm">
      <div className="space-y-4">
        {!commission && (
          <div role="radiogroup" aria-label="Type de commission" className="space-y-2">
            {TYPES_COMMISSION.map((x) => (
              <button
                key={x.value}
                type="button"
                role="radio"
                aria-checked={type === x.value}
                onClick={() => setType(x.value)}
                className={clsx('w-full h-12 px-4 rounded-2xl border-2 text-left font-semibold', type === x.value ? 'border-primary-700 bg-primary-50' : 'border-neutral-200')}
              >
                {x.label}
              </button>
            ))}
          </div>
        )}
        <label className="block">
          <span className="text-sm font-semibold text-neutral-700">Valeur ({unite === '%' ? '%' : 'FCFA'})</span>
          <input
            value={valeur}
            onChange={(e) => setValeur(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            placeholder={unite === '%' ? '4' : '500'}
            className="mt-1 w-full h-12 px-4 rounded-2xl bg-neutral-100 text-[16px] outline-none focus:ring-2 focus:ring-primary-600"
          />
        </label>
        {unite === '%' && n > 100 && <p className="text-sm text-red-700">100 % maximum.</p>}
        <label className="block">
          <span className="text-sm font-semibold text-neutral-700">Description (facultatif)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 120))}
            placeholder="Frais de gestion…"
            className="mt-1 w-full h-12 px-4 rounded-2xl bg-neutral-100 text-[16px] outline-none focus:ring-2 focus:ring-primary-600"
          />
        </label>
        <button onClick={enregistrer} disabled={invalide || creating || updating} className="w-full h-14 rounded-full bg-primary-700 text-white text-[17px] font-bold disabled:opacity-50">
          {creating || updating ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </Modal>
  )
}

/**
 * Section Priorités de jackpot (gestionnaire d'une tontine rotative active).
 * Liste les demandes EN_ATTENTE avec boutons Accepter / Refuser.
 * Bouton « Attribuer » permet d'assigner directement sans demande préalable.
 */
function SectionPriorites({ tontineId, online }: { tontineId: string; online: boolean }) {
  const { data, isLoading } = usePriorites(tontineId, 'EN_ATTENTE')
  const { mutate: accepter, isPending: accepting } = useAccepterPriorite(tontineId)
  const { mutate: refuser, isPending: refusing } = useRefuserPriorite(tontineId)
  const [aRefuser, setARefuser] = useState<PrioriteJackpot | null>(null)
  const [motifRefus, setMotifRefus] = useState('')
  const priorites = data?.content ?? []

  const handleAccepter = (p: PrioriteJackpot) =>
    accepter(p.id, {
      onSuccess: () => toast.success(`Priorité de ${p.firstName} accordée`),
      onError: (e) => toast.error(messageErreur(e, "L'action a échoué.")),
    })

  const handleRefuser = () => {
    if (!aRefuser) return
    refuser({ prioriteId: aRefuser.id, motif: motifRefus.trim() || undefined }, {
      onSuccess: () => { toast.success(`Priorité de ${aRefuser.firstName} refusée`); setARefuser(null); setMotifRefus('') },
      onError: (e) => toast.error(messageErreur(e, "Le refus a échoué.")),
    })
  }

  if (isLoading || priorites.length === 0) return null

  return (
    <>
      <Section
        titre="Priorités de jackpot"
        action={<span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">{priorites.length}</span>}
      >
        <ul className="divide-y divide-neutral-100">
          {priorites.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3 min-h-[72px]">
              <Star size={18} className="text-amber-500 flex-shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-neutral-900">{p.firstName} {p.lastName}</span>
                {p.motif && <span className="block text-sm text-neutral-500 truncate">« {p.motif} »</span>}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => { setARefuser(p); setMotifRefus('') }}
                  disabled={!online || accepting || refusing}
                  className="h-9 px-3 rounded-full text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                >
                  Refuser
                </button>
                <button
                  onClick={() => handleAccepter(p)}
                  disabled={!online || accepting || refusing}
                  className="h-9 px-4 rounded-full bg-primary-700 text-white text-xs font-bold hover:bg-primary-800 disabled:opacity-40"
                >
                  Accorder
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Modal isOpen={!!aRefuser} onClose={() => setARefuser(null)} title="Refuser la priorité ?" size="sm">
        {aRefuser && (
          <>
            <p className="text-neutral-600 mb-3">La demande de <strong>{aRefuser.firstName}</strong> sera refusée et il sera notifié.</p>
            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Motif (facultatif)</span>
              <input
                value={motifRefus}
                onChange={(e) => setMotifRefus(e.target.value.slice(0, 200))}
                placeholder="Explication pour le membre…"
                className="mt-1 w-full h-12 px-4 rounded-2xl bg-neutral-100 text-[16px] outline-none focus:ring-2 focus:ring-primary-600"
              />
            </label>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setARefuser(null)} className="h-12 rounded-full bg-neutral-100 font-semibold">Annuler</button>
              <button onClick={handleRefuser} disabled={refusing} className="h-12 rounded-full bg-red-600 text-white font-bold disabled:opacity-50">
                {refusing ? '…' : 'Refuser'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

function Section({ titre, action, children }: { titre: string; action?: React.ReactNode; children: React.ReactNode }) {  return (
    <section>
      <div className="px-1 mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-500">{titre}</h2>
        {action}
      </div>
      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">{children}</div>
    </section>
  )
}

function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="min-h-[100dvh] bg-[#f2f3f5]">
      <ScreenHeader title={title} />
      <main className="px-4 pb-8 max-w-lg mx-auto">{children}</main>
    </div>
  )
}
