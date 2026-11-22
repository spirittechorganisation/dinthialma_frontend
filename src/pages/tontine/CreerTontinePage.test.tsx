/**
 * Caractérisation de CreerTontinePage (spec 01, tâche 4.2) — créer une tontine.
 *
 * Rotative : 4 étapes (objectif → montant et rythme → membres → récapitulatif).
 * Événementielle : 3 étapes (objectif → montant et date → récapitulatif).
 * Le calendrier vient de GET /v1/tontines/simulation (temporisé de 350 ms) ; la création part en
 * POST /v1/tontines (commission comprise, tout ou rien), puis la session est renouvelée
 * (POST /v1/auth/refresh) pour obtenir les droits de gestionnaire.
 *
 * jsdom n'applique pas le CSS : le bouton principal et le message d'erreur existent en deux exemplaires
 * (barre du bas et panneau « grand écran »). Les tests utilisent le premier.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor, fireEvent } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { http, HttpResponse, delay } from 'msw'
import { API, ok, erreur } from '@/test/msw/api'
import { server } from '@/test/msw/server'
import { renderWithProviders } from '@/test/render'
import { Emplacement, emplacement } from '@/test/router'
import { creerJwt } from '@/test/auth'
import { uneTontine } from '@/test/factories/tontine'
import { UserRole } from '@/types/common'
import { CreerTontinePage } from './CreerTontinePage'

// ─── Réseau ──────────────────────────────────────────────────────────────────

type Corps = Record<string, unknown>

/** Simulation du calendrier : renvoie les paramètres reçus (un objet par appel) */
function simulation() {
  const appels: Record<string, string>[] = []
  server.use(http.get(`${API}/v1/tontines/simulation`, ({ request }) => {
    appels.push(Object.fromEntries(new URL(request.url).searchParams))
    return ok({
      premiereEcheance: '2026-12-20T23:59:00Z',
      derniereEcheance: '2027-09-20T23:59:00Z',
      nombreTours: 10,
      cotisationsParTour: 1,
      echeances: Array.from({ length: 7 }, (_, i) => ({ numero: i + 1 })),
      tours: [],
    })
  }))
  return appels
}

/** Dernier élément d'une liste (la cible TypeScript du projet n'a pas `Array.prototype.at`) */
const derniere = <T,>(liste: T[]): T | undefined => liste[liste.length - 1]

/** Capture la création et le renouvellement de session qui la suit */
function creation(reponse: () => Response | Promise<Response> = () => ok(uneTontine({ id: 't-new', nom: 'Créée' }))) {
  const envois: Corps[] = []
  const refreshs: unknown[] = []
  server.use(
    http.post(`${API}/v1/tontines`, async ({ request }) => {
      envois.push((await request.json()) as Corps)
      return reponse()
    }),
    http.post(`${API}/v1/auth/refresh`, async ({ request }) => {
      refreshs.push(await request.json())
      return ok({ access_token: creerJwt([UserRole.ADMIN, UserRole.MEMBER]), refresh_token: 'refresh-2' })
    }),
  )
  return { envois, refreshs }
}

// ─── Écran ───────────────────────────────────────────────────────────────────

function afficher() {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/accueil" element={<a href="/creer">Accueil</a>} />
        <Route path="/creer" element={<CreerTontinePage />} />
        <Route path="/tontine/:id/membres" element={<p>Membres de la tontine</p>} />
        <Route path="/tontine/:id" element={<p>Fiche de la tontine</p>} />
      </Routes>
      <Emplacement />
    </>,
    { route: '/creer', auth: 'membre' },
  )
}

type User = ReturnType<typeof afficher>['user']

/** Bouton principal (le premier des deux exemplaires) */
const principal = (nom: string | RegExp) => screen.getAllByRole('button', { name: nom })[0]
const continuer = (user: User) => user.click(principal('Continuer'))
/** Message d'erreur affiché (le premier des deux exemplaires) */
const alerte = async () => (await screen.findAllByRole('alert'))[0]
const titre = () => screen.getByRole('heading', { level: 2, name: /\?|Récapitulatif/ }).textContent
/** Texte du récapitulatif de l'étape 4 (phrase + ligne de détails) */
const recapitulatif = () => screen.getByRole('heading', { name: 'Récapitulatif' }).nextElementSibling?.textContent ?? ''
/** Montant affiché en grand à l'étape 2 (sous « Montant par membre / par période », avant le pavé) */
const montantAffiche = () => {
  const zone = screen.getByText(/^Montant par (membre|période)$/).parentElement
  const pave = within(zone!).getByLabelText('Pavé numérique').textContent ?? ''
  return (zone?.textContent ?? '').replace(pave, '')
}
/** Carte « Jackpot » de l'étape 3 (le panneau grand écran a aussi une ligne « Jackpot ») */
const carteJackpot = () => screen.getAllByText(/^Jackpot( par gagnant)?$/)
  .map((el) => el.parentElement?.textContent ?? '')
  .find((t) => t.includes('remis')) ?? ''
/** Aperçu du calendrier (simulation) une fois reçu */
const apercuCalendrier = async () =>
  (await screen.findByText((_, el) => el?.tagName === 'P' && !!el.textContent?.startsWith('Première cotisation avant'))).parentElement

async function choisirObjectif(user: User, libelle: string) {
  await user.click(screen.getByRole('radio', { name: libelle }))
}

/** Remet le montant à zéro puis tape les touches du pavé */
async function saisirMontant(user: User, touches: string[]) {
  const pave = screen.getByLabelText('Pavé numérique')
  for (let i = 0; i < 8; i++) await user.click(within(pave).getByRole('button', { name: 'Effacer' }))
  for (const t of touches) await user.click(within(pave).getByRole('button', { name: t }))
}

/**
 * Compteurs − / + de l'étape 3, dans l'ordre du document :
 * 0 = membres, 1 = cotisations par tour, 2 = gagnants par tour (dans « Plus d'options »).
 */
const plus = (i: number) => screen.getAllByRole('button', { name: 'Plus' })[i]
const moins = (i: number) => screen.getAllByRole('button', { name: 'Moins' })[i]

async function cliquerN(user: User, bouton: () => HTMLElement, n: number) {
  for (let i = 0; i < n; i++) await user.click(bouton())
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T10:00:00Z'))
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── Rotative ────────────────────────────────────────────────────────────────

describe('[caractérisation] CreerTontinePage — tontine rotative', () => {
  it('étape 1 : « Continuer » inactif tant qu\'aucun objectif n\'est choisi, puis description de l\'objectif', async () => {
    const { user } = afficher()

    expect(screen.getByRole('heading', { name: 'Pour quoi cotisez-vous ?' })).toBeInTheDocument()
    expect(screen.getByLabelText('Étape 1 sur 4')).toBeInTheDocument()
    expect(principal('Continuer')).toBeDisabled()

    await choisirObjectif(user, 'Marché')

    expect(screen.getByRole('radio', { name: 'Marché' })).toHaveAttribute('aria-checked', 'true')
    // Barre du bas : « libellé · description »
    expect(screen.getAllByText(/Entre commerçants, des cotisations chaque jour/).map((el) => el.textContent)).toContain(
      'Marché · Entre commerçants, des cotisations chaque jour pour garder le fonds de roulement.',
    )
    expect(principal('Continuer')).toBeEnabled()
  })

  it('valeurs par défaut : crée une tontine classique en 4 étapes avec le corps complet', async () => {
    simulation()
    const { envois, refreshs } = creation()
    const { user } = afficher()

    await choisirObjectif(user, 'Tontine classique')
    await continuer(user)
    expect(titre()).toBe('Combien et à quel rythme ?')
    expect(montantAffiche()).toBe('Montant par membre5.000F')
    expect(screen.getByRole('slider', { name: 'Rythme des cotisations' })).toHaveAttribute('aria-valuetext', 'Chaque mois')

    await continuer(user)
    expect(titre()).toBe('Combien de membres ?')
    expect(carteJackpot()).toMatch(/^Jackpot50\.000Fremis chaque mois1cotisation par tour/) // 5 000 × 10 membres

    await continuer(user)
    expect(titre()).toBe('Récapitulatif')
    await waitFor(() => expect(recapitulatif()).toContain('10 tours'))
    expect(recapitulatif()).toBe(
      '10 membres cotisent 5.000F chaque mois. Chaque mois, 1 membre reçoit 50.000F.'
      + 'Début le 20 nov. · 1ʳᵉ cotisation avant dim. 20 déc. · 10 tours · Ordre fixe · tours automatiques · sans commission',
    )
    expect(screen.getByRole('textbox', { name: 'Nom de la tontine' })).toHaveValue('Ma tontine')

    await user.click(principal('Créer la tontine'))

    expect(await screen.findByText('Tontine créée ✓')).toBeInTheDocument()
    expect(envois).toEqual([{
      tontineType: 'ROTATIVE', nom: 'Ma tontine', rythmeIntervalle: 1, rythmeUnite: 'MOIS', frequence: 'MENSUEL',
      heureEcheance: '23:59', dateDebut: '2026-11-20', montant: 5000, nombreMembres: 10, nombreGagnants: 1,
      ordreBeneficiaire: 'ROTATION', modeCycle: 'AUTOMATIQUE', cotisationsParTour: 1, declenchementJackpot: 'FIN_DU_TOUR',
    }])
    // Session renouvelée après la création (droits de gestionnaire sans reconnexion)
    expect(refreshs).toEqual([{ refreshToken: 'refresh-test' }])
  })

  it('parcours complet personnalisé : montant, rythme, jour et heure limites, membres, options, commission, nom', async () => {
    const simulations = simulation()
    const { envois } = creation()
    const { user } = afficher()

    await choisirObjectif(user, 'Tontine classique')
    await continuer(user)

    // Étape 2 : 10 000 F, chaque semaine, le dimanche avant 20h
    await saisirMontant(user, ['1', '0', '000'])
    expect(montantAffiche()).toBe('Montant par membre10.000F')
    await cliquerN(user, () => screen.getByRole('button', { name: 'Rythme plus court' }), 4)
    expect(screen.getByRole('slider', { name: 'Rythme des cotisations' })).toHaveAttribute('aria-valuetext', 'Chaque semaine')
    await user.click(screen.getByRole('radio', { name: 'dimanche' }))
    expect(screen.getByText('Chacun paie au plus tard le dimanche.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '20h' }))
    await continuer(user)

    // Étape 3 : 12 membres, 2 cotisations par tour, 2 gagnants, tirage, tours manuels, remise dès que tous ont payé
    await cliquerN(user, () => plus(0), 2)
    await user.click(plus(1))
    expect(screen.getByText('remis toutes les 2 cotisations · un tour dure 2 semaines')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Plus d\'options' }))
    await user.click(plus(2))
    // 10 000 × 12 membres × 2 cotisations ÷ 2 gagnants
    expect(carteJackpot()).toMatch(/^Jackpot par gagnant120\.000Fremis toutes les 2 cotisations · un tour dure 2 semaines2cotisations par tour/)
    await user.click(screen.getByRole('button', { name: 'Tirage au sort' }))
    await user.click(screen.getByRole('button', { name: 'Je les démarre' }))
    await user.click(screen.getByRole('button', { name: 'Dès que tous ont payé' }))
    expect(screen.getByText('Le jackpot est remis dès que tout le monde a cotisé, même avant la date.')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Description (facultatif)' }), '  Entre amis du lycée  ')
    await apercuCalendrier()
    await continuer(user)

    // Étape 4 : commission 5 % et nom
    await user.click(screen.getByRole('radio', { name: '% du jackpot' }))
    await user.type(screen.getByRole('textbox', { name: 'Valeur de la commission' }), '5')
    expect(screen.getByText('Vous prenez 5 % du jackpot, soit 12.000F par tour.')).toBeInTheDocument()
    const nom = screen.getByRole('textbox', { name: 'Nom de la tontine' })
    await user.clear(nom)
    await user.type(nom, '  Tontine des amis ')
    expect(recapitulatif()).toContain(
      '12 membres cotisent 10.000F chaque semaine, le dimanche, avant 20h. Toutes les 2 cotisations, 2 membres reçoivent 120.000F chacun.',
    )
    expect(recapitulatif()).toContain('Tirage au sort · tours démarrés par vous · commission 5 %')

    await user.click(principal('Créer la tontine'))

    await screen.findByText('Tontine créée ✓')
    expect(screen.getByText('Tontine des amis')).toBeInTheDocument()
    expect(envois).toEqual([{
      tontineType: 'ROTATIVE', nom: 'Tontine des amis', description: 'Entre amis du lycée',
      rythmeIntervalle: 1, rythmeUnite: 'SEMAINE', frequence: 'HEBDOMADAIRE', jourEcheance: 'DIMANCHE', heureEcheance: '20:00',
      dateDebut: '2026-11-20', commissions: [{ type: 'POURCENTAGE_JACKPOT', valeur: 5 }],
      montant: 10000, nombreMembres: 12, nombreGagnants: 2, ordreBeneficiaire: 'ALEATOIRE', modeCycle: 'MANUEL',
      cotisationsParTour: 2, declenchementJackpot: 'TOUS_PAYES',
    }])
    // Dernière simulation : mêmes paramètres que la tontine créée
    await waitFor(() => expect(derniere(simulations)).toMatchObject({ nombreMembres: '12' }))
    expect(derniere(simulations)).toEqual({
      rythmeIntervalle: '1', rythmeUnite: 'SEMAINE', jourEcheance: 'DIMANCHE', heureEcheance: '20:00', dateDebut: '2026-11-20',
      tontineType: 'ROTATIVE', nombreMembres: '12', nombreGagnants: '2', cotisationsParTour: '2', montant: '10000',
    })
  })

  it('affiche le calendrier issu de la simulation (première et dernière cotisation, nombre de tours)', async () => {
    simulation()
    const { user } = afficher()

    await choisirObjectif(user, 'Tontine classique')
    await continuer(user)
    await continuer(user)

    // Changement voulu (FR23, R7, validé le 22/11/2026) : plus de double point après une date abrégée
    // (avant : « dim. 20 déc.. »)
    expect(await apercuCalendrier()).toHaveTextContent('Première cotisation avant dim. 20 déc.10 tours, dernière cotisation le lun. 20 sept. 2027.')
  })

  it('un jour limite incompatible avec le nouveau rythme est effacé', async () => {
    simulation()
    const { envois } = creation()
    const { user } = afficher()

    await choisirObjectif(user, 'Business') // préréglé chaque semaine
    await continuer(user)
    await user.click(screen.getByRole('radio', { name: 'vendredi' }))
    // Passage au mois : « vendredi » n'a plus de sens
    await cliquerN(user, () => screen.getByRole('button', { name: 'Rythme plus long' }), 4)
    expect(screen.getByRole('combobox', { name: /Jour limite de paiement/ })).toHaveValue('')
    await continuer(user)
    await continuer(user)
    await user.click(principal('Créer la tontine'))

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({ nom: 'Tontine Business', rythmeUnite: 'MOIS', frequence: 'MENSUEL' })
    expect(envois[0]).not.toHaveProperty('jourEcheance')
  })

  it('écran de succès : « Ajouter des membres » et « Voir la tontine » ouvrent la tontine créée', async () => {
    simulation()
    creation()
    const { user } = afficher()

    await choisirObjectif(user, 'Famille')
    await continuer(user)
    await continuer(user)
    await continuer(user)
    await user.click(principal('Créer la tontine'))

    expect(await screen.findByText('C\'est un brouillon : ajoutez vos membres, puis lancez-la depuis sa fiche.')).toBeInTheDocument()
    expect(screen.getByText('Tontine Famille')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ajouter des membres' }))
    expect(emplacement()).toBe('/tontine/t-new/membres')
  })

  it('« Voir la tontine » après la création ouvre sa fiche', async () => {
    simulation()
    creation()
    const { user } = afficher()

    await choisirObjectif(user, 'Quartier')
    await continuer(user)
    await continuer(user)
    await continuer(user)
    await user.click(principal('Créer la tontine'))
    await user.click(await screen.findByRole('button', { name: 'Voir la tontine' }))

    expect(emplacement()).toBe('/tontine/t-new')
  })

  it('« Retour » revient à l\'étape précédente en gardant les réponses', async () => {
    const { user } = afficher()

    await choisirObjectif(user, 'Travail')
    await continuer(user)
    await user.click(screen.getByRole('button', { name: 'Retour' }))

    expect(titre()).toBe('Pour quoi cotisez-vous ?')
    expect(screen.getByRole('radio', { name: 'Travail' })).toHaveAttribute('aria-checked', 'true')
  })
})

// ─── Événementielle ──────────────────────────────────────────────────────────

describe('[caractérisation] CreerTontinePage — tontine événementielle', () => {
  async function allerALaDate(user: User, objectif = 'Mariage') {
    await choisirObjectif(user, objectif)
    await continuer(user)
    expect(titre()).toBe('Combien et jusqu\'à quand ?')
  }
  const dateEvenement = () => screen.getByLabelText('Événement')

  it('3 étapes, montant libre avec minimum : corps de création complet', async () => {
    const simulations = simulation()
    const { envois } = creation()
    const { user } = afficher()

    await allerALaDate(user)
    expect(screen.getByLabelText('Étape 2 sur 3')).toBeInTheDocument()
    fireEvent.change(dateEvenement(), { target: { value: '2027-06-15' } })
    await user.click(screen.getByRole('checkbox', { name: 'Montant libre' }))
    expect(screen.queryByLabelText('Pavé numérique')).not.toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Minimum par cotisation (facultatif)' }), '2 000 F')
    await continuer(user)

    expect(titre()).toBe('Récapitulatif')
    expect(screen.getByLabelText('Étape 3 sur 3')).toBeInTheDocument()
    // Changement voulu (FR23, validé par le responsable produit le 22/11/2026) : en événementielle, chacun
    // récupère ce qu'il a cotisé ; la fin de phrase dépend de l'objectif. Avant : « La cagnotte est partagée entre tous à la fin. »
    expect(recapitulatif()).toContain('Chacun cotise librement (minimum 2.000F) chaque mois, jusqu\'au 15 juin 2027. À la fin, chacun récupère ce qu\'il a cotisé pour la cérémonie.')
    await user.click(principal('Créer la tontine'))

    await screen.findByText('Tontine créée ✓')
    expect(envois).toEqual([{
      tontineType: 'EVENEMENTIELLE', nom: 'Mariage', rythmeIntervalle: 1, rythmeUnite: 'MOIS', frequence: 'MENSUEL',
      heureEcheance: '23:59', dateDebut: '2026-11-20', dateEcheance: '2027-06-15', nomEvenement: 'Mariage',
      montantLibre: true, montantMinimum: 2000,
    }])
    // Simulation d'un événement : date de l'événement, pas de membres, pas de montant (montant libre)
    await waitFor(() => expect(simulations.length).toBeGreaterThan(0))
    expect(derniere(simulations)).toEqual({
      rythmeIntervalle: '1', rythmeUnite: 'MOIS', heureEcheance: '23:59', dateDebut: '2026-11-20',
      tontineType: 'EVENEMENTIELLE', dateEcheance: '2027-06-15',
    })
  })

  it('montant fixe : le montant est envoyé, sans minimum', async () => {
    simulation()
    const { envois } = creation()
    const { user } = afficher()

    await allerALaDate(user, 'Baptême')
    fireEvent.change(dateEvenement(), { target: { value: '2027-03-01' } })
    await continuer(user)
    await user.click(principal('Créer la tontine'))

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({ tontineType: 'EVENEMENTIELLE', nom: 'Baptême', montantLibre: false, montant: 5000 })
    expect(envois[0]).not.toHaveProperty('montantMinimum')
  })

  it('affiche le nombre de cotisations jusqu\'à l\'événement (simulation)', async () => {
    simulation()
    const { user } = afficher()

    await allerALaDate(user)
    fireEvent.change(dateEvenement(), { target: { value: '2027-06-15' } })

    expect(await screen.findByText('7 cotisations')).toBeInTheDocument()
  })

  it('« Autre » : choix du type à l\'étape 2, le nombre d\'étapes suit', async () => {
    const { user } = afficher()

    await user.click(screen.getByRole('radio', { name: /^Autre chose/ }))
    await continuer(user)
    const types = screen.getByRole('radiogroup', { name: 'Type' })
    expect(within(types).getByRole('radio', { name: 'Chacun son tour' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Étape 2 sur 4')).toBeInTheDocument()

    await user.click(within(types).getByRole('radio', { name: 'Pour un événement' }))

    expect(screen.getByLabelText('Étape 2 sur 3')).toBeInTheDocument()
    expect(titre()).toBe('Combien et jusqu\'à quand ?')
  })

  it('date de début vidée : la création part quand même, avec dateDebut vide', async () => {
    // BUG: l'étape 2 d'une tontine événementielle ne vérifie pas la date de début (seule la
    // rotative le fait, à l'étape 3) : `dateEvenement <= ''` est faux, la validation passe et le
    // POST part avec `dateDebut: ''` (refus attendu du backend). Attendu : « Indiquez la date de début. »
    simulation()
    const { envois } = creation()
    const { user } = afficher()

    await allerALaDate(user)
    fireEvent.change(screen.getByLabelText('Début'), { target: { value: '' } })
    fireEvent.change(dateEvenement(), { target: { value: '2027-06-15' } })
    await continuer(user)
    await user.click(principal('Créer la tontine'))

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({ dateDebut: '', dateEcheance: '2027-06-15' })
  })
})

// ─── Messages de validation ──────────────────────────────────────────────────

describe('[caractérisation] CreerTontinePage — messages de validation', () => {
  it('étape 2 (rotative) : montant nul', async () => {
    const { user } = afficher()
    await choisirObjectif(user, 'Tontine classique')
    await continuer(user)

    await saisirMontant(user, [])
    await continuer(user)

    expect(await alerte()).toHaveTextContent('Indiquez le montant.')
    expect(titre()).toBe('Combien et à quel rythme ?')
  })

  it('étape 2 (événement) : date manquante, date pas après le début, montant nul', async () => {
    const { user } = afficher()
    await choisirObjectif(user, 'Voyage')
    await continuer(user)

    await continuer(user)
    expect(await alerte()).toHaveTextContent('Indiquez la date de l\'événement.')

    fireEvent.change(screen.getByLabelText('Événement'), { target: { value: '2026-11-20' } })
    await continuer(user)
    expect(await alerte()).toHaveTextContent('La date de l\'événement doit être après le début.')

    fireEvent.change(screen.getByLabelText('Événement'), { target: { value: '2027-01-10' } })
    await saisirMontant(user, [])
    await continuer(user)
    expect(await alerte()).toHaveTextContent('Indiquez le montant.')
  })

  it('étape 3 : le compteur borne les membres (minimum 2) : « Entre 2 et 100 membres » ne peut pas apparaître', async () => {
    // Le compteur est borné à [2, 100] : le message de validation correspondant est inatteignable.
    // Seule la borne basse est parcourue ici (98 clics pour la borne haute rendraient le test trop lent).
    const { user } = afficher()
    await choisirObjectif(user, 'Tontine classique')
    await continuer(user)
    await continuer(user)

    await cliquerN(user, () => moins(0), 8)
    expect(screen.getByText('membres').parentElement).toHaveTextContent('2membres')
    expect(moins(0)).toBeDisabled()
  })

  it('étape 3 : gagnants ≥ membres après avoir réduit les membres', async () => {
    const { user } = afficher()
    await choisirObjectif(user, 'Tontine classique')
    await continuer(user)
    await continuer(user)

    await user.click(screen.getByRole('button', { name: 'Plus d\'options' }))
    await cliquerN(user, () => plus(2), 8) // 9 gagnants (maximum pour 10 membres)
    await cliquerN(user, () => moins(0), 5) // 5 membres : le compteur de gagnants ne suit pas
    await continuer(user)

    expect(await alerte()).toHaveTextContent('Le nombre de gagnants doit être inférieur au nombre de membres.')
  })

  it('étape 3 : date de début manquante', async () => {
    const { user } = afficher()
    await choisirObjectif(user, 'Tontine classique')
    await continuer(user)
    await continuer(user)

    fireEvent.change(screen.getByLabelText('Date de début'), { target: { value: '' } })
    await continuer(user)

    expect(await alerte()).toHaveTextContent('Indiquez la date de début.')
  })

  async function allerAuRecapitulatif(user: User) {
    await choisirObjectif(user, 'Tontine classique')
    await continuer(user)
    await continuer(user)
    await continuer(user)
  }

  it('étape 4 : nom trop court', async () => {
    const { envois } = creation()
    const { user } = afficher()
    await allerAuRecapitulatif(user)

    await user.clear(screen.getByRole('textbox', { name: 'Nom de la tontine' }))
    await user.type(screen.getByRole('textbox', { name: 'Nom de la tontine' }), ' A ')
    await user.click(principal('Créer la tontine'))

    expect(await alerte()).toHaveTextContent('Le nom doit faire au moins 2 caractères.')
    expect(envois).toHaveLength(0)
  })

  it('étape 4 : nom limité à 150 caractères à la saisie (le message « 150 maximum » ne peut pas apparaître)', async () => {
    simulation()
    const { envois } = creation()
    const { user } = afficher()
    await allerAuRecapitulatif(user)

    const nom = screen.getByRole('textbox', { name: 'Nom de la tontine' })
    await user.clear(nom)
    fireEvent.change(nom, { target: { value: 'x'.repeat(160) } })
    expect(nom).toHaveValue('x'.repeat(150))
    await user.click(principal('Créer la tontine'))

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0].nom).toBe('x'.repeat(150))
  })

  it.each([
    ['type choisi sans valeur', '% du jackpot', '', 'Indiquez la commission, ou choisissez « Aucune ».'],
    ['pourcentage supérieur à 100', '% du jackpot', '150', 'La commission ne peut pas dépasser 100 %.'],
    ['frais fixes égaux au jackpot', 'Frais fixes par tour', '50000', 'Les frais par tour doivent être inférieurs au jackpot.'],
  ])('étape 4 : commission invalide (%s)', async (_cas, type, valeur, message) => {
    const { envois } = creation()
    const { user } = afficher()
    await allerAuRecapitulatif(user)

    await user.click(screen.getByRole('radio', { name: type }))
    if (valeur) await user.type(screen.getByRole('textbox', { name: 'Valeur de la commission' }), valeur)
    await user.click(principal('Créer la tontine'))

    expect(await alerte()).toHaveTextContent(message)
    expect(envois).toHaveLength(0)
  })

  it('étape 4 : commission décimale avec virgule, frais d\'adhésion, puis retour à « Aucune »', async () => {
    simulation()
    const { envois } = creation()
    const { user } = afficher()
    await allerAuRecapitulatif(user)

    await user.click(screen.getByRole('radio', { name: 'Frais d\'adhésion' }))
    await user.type(screen.getByRole('textbox', { name: 'Valeur de la commission' }), '2,5')
    // Affichage arrondi par formatF (2,5 → « 3F ») alors que 2,5 serait envoyé
    expect(screen.getByText('Chaque membre paie 3F de frais d\'adhésion en rejoignant la tontine.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '% du jackpot' }))
    expect(screen.getByText('Vous prenez 2.5 % du jackpot, soit 1.250F par tour.')).toBeInTheDocument()
    await user.click(principal('Créer la tontine'))

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0].commissions).toEqual([{ type: 'POURCENTAGE_JACKPOT', valeur: 2.5 }])
  })

  it('« Aucune » efface la valeur saisie : pas de commission envoyée', async () => {
    simulation()
    const { envois } = creation()
    const { user } = afficher()
    await allerAuRecapitulatif(user)

    await user.click(screen.getByRole('radio', { name: 'Frais fixes par tour' }))
    await user.type(screen.getByRole('textbox', { name: 'Valeur de la commission' }), '1000')
    await user.click(screen.getByRole('radio', { name: 'Aucune' }))
    expect(screen.getByText('Vous ne prenez aucune commission. Vous pourrez en ajouter une dans les Réglages.')).toBeInTheDocument()
    await user.click(principal('Créer la tontine'))

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).not.toHaveProperty('commissions')
  })
})

// ─── Erreurs de création ─────────────────────────────────────────────────────

describe('[caractérisation] CreerTontinePage — erreurs de création', () => {
  async function allerAuRecapitulatif(user: User) {
    await choisirObjectif(user, 'Tontine classique')
    await continuer(user)
    await continuer(user)
    await continuer(user)
  }

  it('refus du backend : message du serveur affiché, on reste sur le récapitulatif', async () => {
    simulation()
    const { refreshs } = creation(() => erreur(400, 'COMMISSION_INVALIDE', 'La commission dépasse le plafond autorisé.'))
    const { user } = afficher()
    await allerAuRecapitulatif(user)

    await user.click(principal('Créer la tontine'))

    expect(await alerte()).toHaveTextContent('La commission dépasse le plafond autorisé.')
    expect(titre()).toBe('Récapitulatif')
    expect(refreshs).toHaveLength(0)
  })

  it('erreur serveur : message générique traduit', async () => {
    simulation()
    creation(() => erreur(500, 'INTERNAL_ERROR', 'Panne'))
    const { user } = afficher()
    await allerAuRecapitulatif(user)

    await user.click(principal('Créer la tontine'))

    expect(await alerte()).toHaveTextContent('Service momentanément indisponible, réessayez.')
  })

  it('erreur réseau : message de connexion', async () => {
    simulation()
    creation(() => HttpResponse.error())
    const { user } = afficher()
    await allerAuRecapitulatif(user)

    await user.click(principal('Créer la tontine'))

    expect(await alerte()).toHaveTextContent('Pas de connexion. Vérifiez votre réseau et réessayez.')
  })

  it('pendant l\'envoi : « Création… » inactif, une seule création envoyée', async () => {
    simulation()
    const { envois } = creation(async () => { await delay(150); return ok(uneTontine({ id: 't-new' })) })
    const { user } = afficher()
    await allerAuRecapitulatif(user)

    await user.click(principal('Créer la tontine'))
    expect(principal('Création…')).toBeDisabled()
    await user.click(principal('Création…'))

    await screen.findByText('Tontine créée ✓')
    expect(envois).toHaveLength(1)
  })

  it('hors connexion : « Connexion requise » inactif, rien n\'est envoyé', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const { envois } = creation()
    const { user } = afficher()
    await allerAuRecapitulatif(user)

    expect(principal('Connexion requise')).toBeDisabled()
    await user.click(principal('Connexion requise'))
    expect(envois).toHaveLength(0)
  })

  it('simulation en échec : le parcours reste possible, sans calendrier', async () => {
    server.use(http.get(`${API}/v1/tontines/simulation`, () => erreur(500, 'INTERNAL_ERROR', 'Panne')))
    const { envois } = creation()
    const { user } = afficher()
    await allerAuRecapitulatif(user)

    expect(recapitulatif()).not.toContain('1ʳᵉ cotisation')
    expect(recapitulatif()).not.toContain('tours ·')
    await user.click(principal('Créer la tontine'))

    await screen.findByText('Tontine créée ✓')
    expect(envois).toHaveLength(1)
  })
})
