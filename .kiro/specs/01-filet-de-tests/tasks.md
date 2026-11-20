# Plan d'implémentation — Filet de tests du frontend

> Règles : lire `.kiro/steering/testing.md` avant chaque tâche. Ne modifier **aucun** fichier de `src/` hors `src/test/`
> et les fichiers `*.test.ts(x)`, sauf mention contraire. Si un test révèle un bug, **ne pas le corriger** :
> écrire le test sur le comportement actuel, ajouter `// BUG: …` et le signaler dans le résumé de la tâche.

- [x] 1. Mettre en place l'outillage de test
- [x] 1.1 Installer les dépendances de test
  - Ajouter en devDependencies : vitest, @vitest/coverage-v8, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, msw (versions compatibles Vite 5 et React 18).
  - Terminé quand : `npm ls vitest msw @testing-library/react` ne signale aucune erreur de dépendance.
  - _Exigences : 1.1_
- [x] 1.2 Configurer Vitest
  - Section `test` dans `vite.config.ts` (ou `vitest.config.ts` fusionné avec la config Vite) : `environment: 'jsdom'`, `setupFiles: ['src/test/setup.ts']`, `include: ['src/**/*.{test,spec}.{ts,tsx}']`, `css: false`.
  - `process.env.TZ = 'Africa/Dakar'` en tête de config ; `VITE_API_URL=http://api.test` pour les tests.
  - Couverture v8 : inclure `src/**`, exclure `src/test/**`, `src/types/**`, `src/main.tsx`, `src/vite-env.d.ts`, `**/*.d.ts`.
  - Scripts : `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`, `"typecheck": "tsc --noEmit"`.
  - _Exigences : 1.1, 1.2_
- [x] 1.3 Créer `src/test/setup.ts`
  - Importer `@testing-library/jest-dom/vitest`.
  - MSW : `beforeAll(server.listen({ onUnhandledRequest: 'error' }))`, `afterEach(server.resetHandlers, cleanup, localStorage.clear, sessionStorage.clear)`, `afterAll(server.close)`.
  - Simuler : `window.matchMedia`, `navigator.share`, `navigator.clipboard`, `IntersectionObserver` si utilisé, le module `virtual:pwa-register/react` (utilisé par `usePWA`).
  - _Exigences : 1.2, 1.3_
- [x] 1.4 Créer les outils partagés de test
  - `src/test/msw/api.ts` : constante `API`, helpers `ok(data)` (enveloppe `CustomResponse`), `page(items, { page, size, total })` (format Spring brut attendu par `toPage`), `erreur(status, code, message)` (format d'erreur lu par `lib/apiError`).
  - `src/test/msw/server.ts` et `src/test/msw/handlers/` (un fichier par domaine : auth, me, tontines, cycles, cotisations, membres, validation, qr, priorites, notifications, codeList, users, dashboard, publicConfig) avec des réponses nominales.
  - `src/test/factories/` : un constructeur typé par type principal de `src/types/` avec surcharge partielle.
  - `src/test/auth.ts` : création de JWT de test non signés (rôles, téléphone, expiration) et `connecter(role)` qui remplit `tokenStorage`.
  - `src/test/render.tsx` : `renderWithProviders(ui, { route = '/', path, auth })` → QueryClient neuf (`retry: false`), `MemoryRouter`, `AuthProvider` ; retourne aussi `user = userEvent.setup()` et le `queryClient`.
  - _Exigences : 1.3, 1.4_
- [x] 1.5 Installer et configurer ESLint
  - Ajouter eslint (v9), @eslint/js, typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals ; créer `eslint.config.js` (format « flat »).
  - Le script actuel utilise `--ext` (ancien format, refusé par ESLint 9) : le remplacer par `"lint": "eslint . --max-warnings 0"`.
  - Ignorer `dist/`, `dev-dist/`, `node_modules/`, `coverage/`.
  - Corriger les erreurs **sans changer le comportement** ; si une règle demande une réécriture risquée, la désactiver localement avec un commentaire `// eslint-disable-next-line <règle> -- raison`.
  - Terminé quand : `npm run lint` passe à 0 erreur et 0 avertissement.
  - _Exigences : 1.5_
- [x] 1.6 Écrire un test de fumée
  - `src/test/smoke.test.tsx` : rendre l'application sur `/login` (non connecté) et vérifier que le formulaire de connexion s'affiche ; rendre `/accueil` connecté en membre avec les handlers par défaut et vérifier un élément de l'accueil.
  - Terminé quand : `npm test` passe et `npm run test:coverage` produit un rapport.
  - _Exigences : 1.1, 1.3, 1.4_

- [x] 2. Tests unitaires des fonctions pures (`src/lib`)
- [x] 2.1 `format.ts`
  - Montants : `formatMontant`, `formatFCFA`, `formatF`, `formatFcfaRecu` avec 0, null, undefined, négatif, grand nombre (vérifier l'espace de séparation exact produit aujourd'hui).
  - Dates : `formatDateCourte`, `formatDateHeure`, `formatEcheance` avec date système fixée et dates ISO avec ou sans heure.
  - `safeGet` / `safeSet` quand `localStorage` lève une exception.
  - _Exigences : 2.1, 2.3_
- [x] 2.2 `apiError.ts`
  - `parseApiError` : erreur Axios avec `code` (chaque code de `ApiErrorCode`), sans `code` (repli sur le texte), erreur réseau, timeout, erreur non Axios, `undefined`.
  - `messageErreur` : message du backend, message de repli par défaut et personnalisé.
  - _Exigences : 2.1_
- [x] 2.3 `tontineLabels.ts`
  - `rythmeDe` (anciens champs `frequence` et nouveaux `rythmeIntervalle`/`rythmeUnite`), `rythmeLibre`, `dureeRythme`, `rythmeCourtDe`, `rythmePhraseDe`, `parRythme`, `dureeTour`.
  - `jourEcheanceValide` (JOUR, SEMAINE, MOIS, valeurs invalides), `echeancePhrase`, `heureLisible`.
  - `aujourdhuiIso`, `joursAvant`, `compteARebours` avec date système fixée (avant, jour même, après, null).
  - `modeRemiseLabel`, `capital`, cohérence des constantes (`RYTHMES`, `DECLENCHEMENTS`, `MODES_REMISE`, `ORDRE_LABEL`).
  - _Exigences : 2.1, 2.3_
- [x] 2.4 `tokenStorage.ts`
  - `normalizePhone` (+221, 221, espaces, tirets, numéro local), `storeSession` / `clearTokens` / `clearAll` (ce qui est gardé et ce qui est effacé), PIN configuré.
  - `parseJwt` (jeton valide, invalide, absent), `isTokenExpired` avec date fixée, `getAuthUser` (rôles extraits), `detectClientType` / `getClientType` (user-agent mobile et bureau).
  - _Exigences : 2.1, 2.3_
- [x] 2.5 Autres utilitaires
  - `phone.ts`, `validation.ts`, `commissions.ts`, `paymentMethods.ts`, `homePath.ts`, `retour.ts`, `device.ts`.
  - `exportCsv.ts` : échappement des guillemets, virgules et retours ligne, en-têtes, encodage.
    _Précision (19/11/2026) : le CSV est produit par le backend ; le front le télécharge tel quel. Le test vérifie donc
    la requête (jeton, `format=csv`, paramètres), le nom du fichier (`Content-Disposition` encodé UTF-8, entre guillemets,
    sans guillemets, repli), le contenu transmis sans modification, la libération de l'URL après 10 s et les erreurs._
  - `share.ts` : avec et sans `navigator.share`, refus de l'utilisateur.
  - `preferences.ts` : chargement (GET), synchronisation (PUT) avec temporisation de 1,5 s (faux timers + MSW), échec réseau.
  - `queryClient.ts` : une mutation réussie invalide les requêtes `['me', …]`.
  - Terminé quand : couverture des lignes de `src/lib` ≥ 90 % ; seuil ajouté dans la config.
    _Fait : 98,87 % des lignes de `src/lib` (19/11/2026) ; seuil `'src/lib/**': { lines: 90 }` dans `vitest.config.ts`._
  - _Exigences : 2.1, 2.2, 2.3_

- [ ] 3. Tests d'intégration de la couche API (MSW)
- [x] 3.1 Client HTTP `services/api.ts`
  - Ajoute `Authorization: Bearer <jeton>` quand un jeton existe, rien sinon.
  - 401 → un seul appel à `/v1/auth/refresh`, puis la requête est rejouée avec le nouveau jeton.
  - Trois requêtes en 401 simultanées → un seul refresh, les trois sont rejouées.
  - Refresh en échec ou absent → `clearAll()` et redirection vers `/login`.
  - Routes `/v1/auth/login`, `register`, `refresh`, `logout` : pas de refresh sur 401.
  - 403 → erreur remontée, aucune déconnexion.
  - Paramètres tableaux sérialisés en `statut=A&statut=B`.
  - _Fait (19/11/2026) : `src/services/api.test.ts`, 26 tests. BUG documenté : sans refresh token, `isRefreshing`
    reste à true (sortie avant le `finally`) et les 401 suivants restent bloqués jusqu'au rechargement de la page._
  - _Exigences : 3.1_
- [ ] 3.2 Services (tests en tableau : appel → requête attendue → valeur retournée)
  - `authService`, `meService`, `tontineService`, `cycleService`, `cotisationService`, `membreService`, `validationService` (y compris `validerPlusieurs` et `refuser` avec motif), `qrService`, `prioriteService`, `notificationService`, `securiteService`, `userService`, `codeListService`, `dashboardService`.
  - Pour chaque fonction : méthode, URL, paramètres de requête, corps, extraction de `data.data`, conversion de page avec `toPage`, propagation des erreurs.
  - _Exigences : 3.2_
- [ ] 3.3 Hooks React Query
  - Pour chaque hook de mutation de `src/hooks/` : clés invalidées après succès (ex. `useActiverTontine` invalide `['tontines']` et `['tontine', id]`).
  - `useSimulation` : pas d'appel tant que les paramètres sont `null`, annulation de la requête précédente si elle existe.
  - `useAuth` : connexion (session stockée), déconnexion douce (PIN gardé) et complète, `refreshSession`, rôles exposés.
  - `useOnline`, `useLocalPreference`, `useFavoris`, `usePublicConfig`.
  - Terminé quand : couverture des lignes ≥ 80 % sur `src/services` et ≥ 70 % sur `src/hooks` ; seuils ajoutés.
  - _Exigences : 3.3, 3.4_

- [ ] 4. Tests de caractérisation des écrans critiques
  - Chaque fichier : `describe('[caractérisation] <Écran>')`, au moins 1 test nominal + 2 tests d'erreur, corps des écritures vérifié.
- [ ] 4.1 Authentification (`LoginPage`, `PinLoginPage`, `PinSetupPage`, `RegisterPage`, `ForgotPasswordPage`, `PinResetPage`)
  - Connexion réussie → redirection selon le rôle ; mauvais identifiants ; compte pré-inscrit (403) → parcours d'activation (F04).
  - PIN : soumission automatique à 6 chiffres, PIN faux, PIN verrouillé.
  - Inscription en 3 étapes (téléphone → OTP → identité) avec corps envoyés à chaque étape.
  - _Exigences : 4.1, 4.2, 4.4_
- [x] 4.2 Création de tontine (`CreerTontinePage`)
  - Rotative en 4 étapes → corps POST `/v1/tontines` complet (type, nom, montant, rythme, jour et heure limites, membres, gagnants, cotisations par tour, déclenchement, commission).
  - Événementielle en 3 étapes (date d'événement, montant libre, minimum).
  - Chaque message d'erreur de validation des étapes 1 à 4 (objectif manquant, montant nul, membres hors 2–100, gagnants ≥ membres, nom trop court ou trop long, commission invalide, frais ≥ jackpot).
  - Calendrier issu de la simulation affiché ; hors connexion → création impossible ; écran de succès ; erreur backend affichée.
  - _Fait (19/11/2026) : `CreerTontinePage.test.tsx` (31 tests), y compris paramètres de la simulation et renouvellement
    de session. Trois messages sont inatteignables (bouton inactif ou saisie bornée) : objectif manquant, membres hors
    2–100, nom de plus de 150 caractères ; le test fige le garde-fou à la place. Handlers MSW : `simulation` déclaré
    avant `/v1/tontines/:id`._
  - _Exigences : 4.1, 4.2, 4.4_
- [x] 4.3 Paiement (`PayerPage`, `RecuPage`)
  - Choix de la tontine ; montant prérempli ; tour à plusieurs échéances (B32) ; régularisation d'une échéance passée (B33) ; moyen de paiement mémorisé.
  - Erreurs : cotisation déjà déclarée (409), hors connexion, erreur serveur.
  - Reçu : affichage, partage, modification si encore en attente.
  - _Fait (19/11/2026) : `PayerPage.test.tsx` (26 tests) et `RecuPage.test.tsx` (19 tests), y compris retards du tour
    en cours, montant libre, validation / refus / modification par le gestionnaire. Outil partagé ajouté :
    `src/test/router.tsx` (`<Emplacement />`, `<Depart />`)._
  - _Exigences : 4.1, 4.2, 4.4_
- [x] 4.4 Validation (`AValiderPage`)
  - Liste groupée par tontine ; valider avec annulation possible pendant 5 s (faux timers) ; « Tout valider » avec échec partiel ; refuser avec motif obligatoire ; demandes d'adhésion acceptées et refusées.
  - _Fait (19/11/2026) : `AValiderPage.test.tsx` (32 tests), y compris envoi immédiat en quittant l'écran, balayage,
    sélection desktop, lots de 100 et hors connexion. `setup.ts` : capture du pointeur simulée (toasts sonner)._
  - _Exigences : 4.1, 4.2, 4.4_
- [x] 4.5 Encaissement (`EncaisserPage`, `EncaisserDesktop`)
  - Membres non payés en tête ; encaissement direct (corps vérifié) ; encaissement d'un retardataire après la remise.
  - _Fait (20/11/2026) : `pages/gestion/EncaisserPage.test.tsx` (32 tests) : choix de la tontine, « De qui ? »
    (recherche nom / numéro), « Combien ? » (montant prévu, libre, référence et note), retard `?tour&echeance`,
    erreurs, hors connexion ; version desktop (onglets, clavier ↓ / Entrée, montant au clavier)._
  - _Exigences : 4.1, 4.2, 4.4_
- [x] 4.6 Tour et remise du jackpot (`ToursPage`, `TourPage` et sa feuille `RemiseSheet`)
  - Progression et pastilles d'échéances ; aperçu de remise et options (ATTENDRE refusée 409, DISPONIBLE, AVANCE_COMMISSION, AVANCE_GESTIONNAIRE) ; désignation des gagnants ; tirage au sort ; ouverture d'un tour en mode manuel.
  - _Fait (20/11/2026) : `ToursPage.test.tsx` (19 tests : liste, panneau desktop, démarrer un tour avec proposition)
    et `TourPage.test.tsx` (26 tests : progression, pastilles B32, remise complète / incomplète / attendre / aperçu
    indisponible, clôture d'une période, désignation et tirage, vue membre). « ATTENDRE refusée 409 » = remise simple
    (aperçu indisponible) refusée par le backend avec `REMISE_JACKPOT_INCOMPLETE`._
  - _Exigences : 4.1, 4.2, 4.4_
- [ ] 4.7 Fiche et clôture (`FicheTontinePage`)
  - Boutons selon le rôle (gestionnaire, membre) ; clôture : 1er appel → 409 `TONTINE_CLOTURE_A_CONFIRMER` avec la liste des points, confirmation → 2e appel avec `forcer: true` ; export CSV.
  - _Exigences : 4.1, 4.2, 4.4_
- [ ] 4.8 Réglages (`ReglagesTontinePage`, `ModifierTontinePage`)
  - Modifier échéance et rappels (PATCH) ; option de remise par défaut ; commissions (ajout, modification, suppression) ; QR d'invitation régénéré et révoqué ; priorités accordées et refusées.
  - _Exigences : 4.1, 4.2, 4.4_
- [ ] 4.9 Accueil (`HomePage`)
  - Bascule Je cotise / Je gère mémorisée ; montants masqués ; carte d'action urgente ; fil d'activité ; filtre par tontine.
  - _Exigences : 4.1, 4.4_
- [ ] 4.10 Navigation, gardes et PWA
  - `ProtectedRoute` (redirection non connecté), `RoleRoute` (SUPER_ADMIN), redirection intelligente de `/` ; bandeau « Nouvelle version disponible » (module PWA simulé) ; bandeau hors connexion.
  - _Exigences : 4.1, 4.4_
- [ ] 4.11 Notifications (`NotificationsPage`)
  - Navigation contextuelle : test en tableau sur les types de notification → route ouverte ; marquer lu, tout marquer lu.
  - _Exigences : 4.1, 4.4_

- [ ] 5. Verrouiller en CI et documenter
- [ ] 5.1 Seuils de couverture définitifs
  - Mesurer la couverture globale, fixer le seuil global à cette valeur arrondie à l'inférieur, garder les seuils par dossier (lib 90, services 80, hooks 70).
  - _Exigences : 5.3_
- [ ] 5.2 Workflow de CI
  - Créer `.github/workflows/ci.yml` : `pull_request` vers `main`/`develop` et `push` hors `main` ; Node 24 (`node-version-file: .nvmrc`) avec cache npm ; `npm ci` → `npm run lint` → `npm run typecheck` → `npm run test:coverage` ; rapport de couverture en artefact ; `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`.
  - Dans `docker-publish.yml`, ajouter un job `qualite` identique et `needs: qualite` sur `build-push`.
  - La spec `03-pipeline-et-dependances` (tâche 4) complète ensuite ce workflow (audit, secrets, image Docker) et le factorise.
  - _Avancement (19/11/2026) : en grande partie fait par les PR #60 et #71 (`ci.yml` sur les PR vers develop et main,
    Node via `.nvmrc`, `npm ci` → typecheck → lint → `test:coverage` → build, rapport de couverture en artefact 7 jours,
    `concurrency`). Reste : déclencheur `push` hors `main` ; job `qualite` + `needs: qualite` dans `docker-publish.yml`._
  - _Exigences : 5.1, 5.2_
- [ ] 5.3 Documentation
  - Section « Tests » du `README.md` : commandes, organisation de `src/test/`, comment écrire un test d'écran avec MSW, règle des tests `[caractérisation]`.
  - Mettre à jour `.kiro/steering/testing.md` si des conventions ont évolué pendant la spec.
  - _Exigences : 5.4_

---

## Suivi d'avancement (mis à jour le 19/11/2026)

| Lot | Tâche | Fichier(s) de test | Tests | Couverture des lignes | Commit / PR |
|---|---|---|---|---|---|
| — | 1, 2.1 à 2.4 | outillage + `src/lib` | 234 | lib ≈ 97 % | PR #70 |
| A | 2.5 | `lib/exportCsv.test.ts` | +19 | lib 98,87 % (seuil 90 %) | `1ce2398` · PR #76 |
| B | 3.1 | `services/api.test.ts` | +26 | `api.ts` 97,77 % | `a7861aa` · PR #76 |
| C | 4.3 | `pages/pay/PayerPage.test.tsx`, `RecuPage.test.tsx` | +45 | pages/pay 95,68 % | `574aed5` · PR #76 |
| D | 4.4 | `pages/gestion/AValiderPage.test.tsx` | +32 | `AValiderPage.tsx` 93,91 % | `cbefd09` |
| E | 4.2 | `pages/tontine/CreerTontinePage.test.tsx` | +31 | `CreerTontinePage.tsx` 98,65 % | `ae4dff2` |
| F | 4.6, 4.5 | `pages/tontine/ToursPage.test.tsx`, `TourPage.test.tsx`, `pages/gestion/EncaisserPage.test.tsx` | +77 | `ToursPage` 95,12 %, `TourPage` 91,66 %, `EncaisserPage` 100 %, `EncaisserDesktop` 96,77 % | à commiter |

**Total : 464 tests, couverture globale 39,13 %** (lib 98,87 %, services 57,51 %, hooks 47,9 %).

Reste, dans l'ordre prévu : lot G (4.1 authentification) → H (4.7, 4.10, 4.8, 4.9, 4.11) →
I (3.2 services, 3.3 hooks) → J (5.1 seuils, 5.2 reste, 5.3 documentation).

### Évolutions de l'outillage pendant la spec (à reporter dans `testing.md` et le README, tâche 5.3)
- `src/test/router.tsx` : `<Emplacement />` + `emplacement()` / `etatNavigation()` pour vérifier une redirection par la
  page obtenue ; `<Depart to state />` pour ouvrir un écran avec un état de navigation.
- `src/test/setup.ts` : `ResizeObserver` / `IntersectionObserver` simulés par une **classe** (Vitest 4 refuse `new` sur
  un `vi.fn` fléché, les modales Headless UI plantaient) ; `setPointerCapture` simulé (clic dans un toast sonner) ;
  `scrollIntoView` simulé (encaissement desktop, demande ciblée) ;
  délai des `findBy` / `waitFor` porté à 5 s.
- `vitest.config.ts` : délai par test porté à 20 s (échecs aléatoires sous charge en suite complète).
- `eslint.config.js` : règle `react-refresh/only-export-components` désactivée pour les fichiers de test.
- Handlers MSW : les routes précises (ex. `/v1/tontines/simulation`, `/cycles/proposition`, `/cycles/beneficiaires`)
  doivent être déclarées **avant** les routes à paramètre (`/v1/tontines/:id`, `/cycles/:cycleId`), MSW prenant la
  première qui correspond. Le handler de l'aperçu de remise visait `…/remise-apercu` alors que le service appelle
  `…/remise/apercu` : corrigé (lot F).
- Version desktop d'un écran : simuler un écran large en remplaçant `window.matchMedia` (réponse `matches: true` pour
  `min-width: 1024px`) et le restaurer en `afterEach`.
- Conventions constatées :
  - jsdom n'applique pas le CSS : vue mobile et vue desktop sont rendues ensemble, cibler explicitement l'une ou
    l'autre (élément de liste, ligne de tableau, premier des deux boutons) ;
  - les toasts sonner vivent dans un stockage global : les fermer en `afterEach` (`toast.dismiss()`) quand un fichier
    en affiche beaucoup ;
  - quand une feuille modale est ouverte, le reste de la page est masqué aux technologies d'assistance :
    `queryAllByRole(…, { hidden: true })` pour vérifier ce qui reste derrière ;
  - horloge : `vi.useFakeTimers({ toFake: ['Date'] })` suffit pour les dates ; pour un délai (annulation 5 s),
    `shouldAdvanceTime: true` + `advanceTimersByTimeAsync`, et laisser le temps à une requête d'arriver avant de
    conclure qu'elle n'est pas partie ;
  - la simulation XHR de MSW retire le BOM d'une réponse lue en Blob (conservé en `arraybuffer`).

---

## Points à trancher (décision du responsable produit)

Aucun de ces points n'a été corrigé : les tests figent le comportement actuel. Pour chaque point, décider s'il devient une
tâche (spec 02 ou correctif dédié) ou s'il est accepté tel quel. Un test `[caractérisation]` concerné ne se modifie
qu'avec cette décision.

### Bugs documentés dans les tests (`// BUG:`)

| # | Lot | Fichier concerné | Constaté | Attendu | Gravité | Décision |
|---|---|---|---|---|---|---|
| B1 | A | `lib/exportCsv.ts` | `filename="Tontine A;B.csv"` donne « Tontine A » (sans extension) | Nom complet : « ; » est autorisé entre guillemets (RFC 6266) | Faible (noms produits par le backend) | ☐ |
| B2 | A | `lib/exportCsv.ts` | Un `filename*` mal encodé fait échouer l'export (`URIError`) alors que le fichier est reçu | Prendre le nom de repli | Faible | ☐ |
| B3 | B | `services/api.ts` | Sans refresh token, `isRefreshing` reste à `true` (sortie avant le `finally`) : les 401 suivants restent bloqués | Remettre `isRefreshing` à `false` (ou tester le refresh token avant) | Latente : masquée par le rechargement de page de la redirection `/login` | ☐ |
| B4 | D | `pages/gestion/AValiderPage.tsx` | Bilan groupé : « 1 n'ont pas pu être validés. Ils restent dans la liste. » | « 1 n'a pas pu être validé. Il reste dans la liste. » | Faible (texte) | ☐ |
| B5 | E | `pages/tontine/CreerTontinePage.tsx` | Événementielle : date de début vidée → la validation passe, POST envoyé avec `dateDebut: ''` | « Indiquez la date de début. » à l'étape 2 | Moyenne (refus backend attendu, message peu clair) | ☐ |
| B6 | F | `pages/tontine/ToursPage.tsx` | Événement : titre de section « Tous les périodes » | « Toutes les périodes » | Faible (texte) | ☐ |
| B7 | F | `pages/tontine/ToursPage.tsx` | Événement sans période : « Aucun période pour l'instant » | « Aucune période pour l'instant » | Faible (texte) | ☐ |
| B8 | F | `pages/tontine/ToursPage.tsx` (`DemarrerTourSheet`) | Le bouton « Reprendre la date proposée » est dans le `<label>` « Fin » : dès qu'il apparaît, le libellé passe au bouton et le champ de date n'a plus de libellé | Bouton hors du `<label>` | Moyenne (accessibilité) | ☐ |

### Comportements à confirmer (pas de `// BUG:`, choix produit ou dette)

| # | Lot | Écran / fichier | Constaté | Question | Décision |
|---|---|---|---|---|---|
| Q1 | C | `PayerPage` (B33) | Retard d'un tour remis libellé « Tour 4 · cotisation 1 » même si ce tour n'avait qu'une cotisation (`nombreEcheances` inconnu) | Le backend doit-il renvoyer `nombreEcheances` dans `echeancesARegulariser` ? | ☐ |
| Q2 | C | `PayerPage` | Référence du transfert : limite de 30 caractères appliquée avant le `trim` (30 saisis → 28 envoyés si espaces) | Accepté ? | ☐ |
| Q3 | C | `PayerPage` | Le message « Montant minimum : … » ne s'affiche jamais (bouton déjà inactif sous le minimum) | Code mort à retirer, ou message à afficher près du pavé ? | ☐ |
| Q4 | C | `components/ui/Input.tsx` | `<label>` non relié au champ (pas de `htmlFor` / `id`) : libellé non annoncé par les lecteurs d'écran | Correction d'accessibilité dans la spec 02 ? | ☐ |
| Q5 | C | `PayerPage` | Bloc « Envoyez … / Copier » (moyens mobiles) inatteignable : seules les Espèces sont ouvertes | À tester à l'ouverture de Wave / Orange Money | ☐ |
| Q6 | D | `AValiderPage` | Une validation envoyée en quittant l'écran échoue en silence (`.catch(() => {})`) : le gestionnaire croit avoir validé | Toast global, nouvel essai, ou accepté ? | ☐ |
| Q7 | D | `AValiderPage` | Pendant « Tout valider », la file paraît vide (« Rien à valider ✓ ») le temps de la réponse | Afficher un état « Validation en cours » ? | ☐ |
| Q8 | E | `CreerTontinePage` | Trois messages inatteignables : « Choisissez un objectif », « Entre 2 et 100 membres », « 150 caractères maximum » | Garder par sécurité ou retirer (spec 02) ? | ☐ |
| Q9 | E | `CreerTontinePage` | Le compteur de gagnants ne suit pas une baisse du nombre de membres (erreur seulement au clic sur « Continuer ») | Ramener automatiquement les gagnants au maximum autorisé ? | ☐ |
| Q10 | E | `CreerTontinePage` | Frais en francs décimaux : 2,5 affiché « 3F » (arrondi de `formatF`), 2,5 envoyé | Interdire les décimales pour les frais en F, ou afficher la valeur exacte ? | ☐ |
| Q11 | E | `CreerTontinePage` | Nom par défaut « Tabaski AAAA » calculé une seule fois au chargement du module | Accepté (non testé : dépend de la date réelle) ? | ☐ |
| Q12 | A | `lib/exportCsv.ts` / spec | La tâche 2.5 demandait de tester l'échappement CSV, mais le CSV est produit par le backend | Ajouter ce test côté backend ? | ☐ |
| Q13 | F | `EncaisserPage` (choix de la tontine) | En cas d'erreur, le message dit « Impossible de charger les membres. » alors que ce sont les tontines qui n'ont pas pu être chargées | Texte à adapter ? | ☐ |
| Q14 | F | `EncaisserPage` (mobile) | « Saisissez un montant. » ne s'affiche jamais sur mobile (bouton inactif à 0) ; sur desktop, il apparaît si on valide avec Entrée | Accepté ? | ☐ |
| Q15 | F | `TourPage` (désignation) | Avec 1 gagnant, toucher un autre membre remplace le choix ; avec plusieurs, il faut décocher avant d'en choisir un autre | Comportement voulu ? | ☐ |
