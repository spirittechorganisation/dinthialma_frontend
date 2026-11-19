# Plan d'implémentation — Refactoring de l'architecture du frontend

> **Prérequis bloquant : toutes les tâches de `01-filet-de-tests` sont cochées et la CI est verte.**
> Avant chaque tâche : lire `.kiro/steering/structure.md` et `.kiro/steering/testing.md`.
> Après chaque tâche : `npm run lint && npm run typecheck && npm run test:coverage` doivent passer.
> Interdit : modifier un test `[caractérisation]` pour le faire passer. S'il casse, corriger le code ; si le changement
> de comportement est voulu, s'arrêter et demander validation.
> Un commit par étape « déplacer », « extraire », « découper » : ne pas les mélanger.

- [ ] 1. Fondations
- [ ] 1.1 Créer la structure et les règles de dépendance
  - Créer `src/app/`, `src/shared/{api,lib,ui,hooks,config}/`, `src/features/`.
  - Configurer dans `eslint.config.js` les règles de dépendance décrites dans `design.md` (d'abord en `warn`, passées en `error` à la tâche 4.2).
  - _Exigences : 2.1, 2.2_
- [ ] 1.2 Déplacer le démarrage de l'application vers `src/app/`
  - `App.tsx`, `router/` (routes et gardes), `lib/queryClient.ts`, `components/app/AppBootstrap.tsx`, `components/shared/ChunkErrorBoundary.tsx`.
  - Déplacement pur, imports mis à jour.
  - _Exigences : 1.1, 2.1_
- [ ] 1.3 Créer `shared/config/env.ts`
  - Seule lecture de `import.meta.env` (ex. `VITE_API_URL`) ; remplacer les lectures directes ailleurs.
  - _Exigences : 5.2_
- [ ] 1.4 Client HTTP partagé
  - Déplacer `services/api.ts` vers `shared/api/httpClient.ts` et `lib/apiError.ts` vers `shared/api/apiError.ts`.
  - Remplacer `window.location.href = '/login'` par un rappel `surSessionExpiree()` enregistré par `app/` (redirection via le routeur) ; le test de redirection de la spec 01 doit rester vert.
  - _Exigences : 1.4, 5.1_
- [ ] 1.5 Découper `lib/tokenStorage.ts` et `lib/format.ts`
  - `shared/lib/storage.ts` (accès sûr à localStorage ; reprend `safeGet`/`safeSet` de `format.ts`), `shared/lib/jwt.ts` (`parseJwt`, `isTokenExpired`), `shared/lib/telephone.ts` (`normalizePhone`, fusionné avec `lib/phone.ts`), `shared/lib/appareil.ts` (`detectClientType`, `lib/device.ts`), `features/auth/model/session.ts` (jetons, téléphone, PIN configuré, `getAuthUser`).
  - `shared/lib/format.ts` : montants et dates uniquement.
  - Déplacer les tests unitaires avec leur fichier ; ajouter les tests manquants.
  - _Exigences : 5.2_
- [ ] 1.6 Découper `lib/tontineLabels.ts`
  - `features/tontine/model/rythme.ts` (Rythme, RYTHMES, `rythmeDe`, `rythmeLibre`, `jourEcheanceValide`, `dureeTour`…).
  - `shared/lib/dates.ts` (`aujourdhuiIso`, `joursAvant`, `compteARebours`, `heureLisible`).
  - `features/tontine/ui/libelles.ts` et `features/tour/ui/libelles.ts` (phrases et libellés d'affichage).
  - Couleurs de statut (`TOUR_STATUT.cls`) → variantes du composant `StatusBadge` (tâche 1.8).
  - _Exigences : 4.2, 5.2_
- [ ] 1.7 Déplacer les autres utilitaires
  - `exportCsv`, `share`, `preferences`, `homePath`, `retour`, `validation`, `commissions`, `paymentMethods` vers `shared/lib/` ou vers le `model/` du domaine qui les utilise seul.
  - Déplacer `useOnline`, `useMediaQuery`, `useLocalPreference`, `usePWA` vers `shared/hooks/`.
  - _Exigences : 2.1, 5.2_
- [ ] 1.8 Design system `shared/ui`
  - Déplacer `components/ui/*` et les composants génériques de `components/shared/` et `components/layout/` vers `shared/ui/`.
  - Ajouter des couleurs sémantiques dans `tailwind.config.ts` (succes, attention, danger, info, neutre) et des variantes nommées sur `Badge`, `StatusBadge`, `Button`.
  - Créer `shared/ui/Pastille.tsx` (variantes de ton : rose, ambre, ciel…) pour remplacer les classes stockées dans les données.
  - Aucun changement visuel : comparer avec des captures avant/après des écrans touchés.
  - _Exigences : 4.1, 4.2_
- [ ] 1.9 (Optionnel) Générer les types du backend
  - Ajouter `openapi-typescript` ; script `"api:types": "openapi-typescript api-docs.json -o src/shared/api/generated/schema.d.ts"`.
  - Lister les écarts avec `src/types/` dans `docs/ECARTS_TYPES.md` sans migrer ; la migration se fait domaine par domaine.
  - _Exigences : 5.3_

- [ ] 2. Domaine `tontine` — création (`CreerTontinePage`)
- [ ] 2.1 api : déplacer `tontineService` et `useTontines` vers `features/tontine/api/` ; créer `tontineKeys` (mêmes valeurs de clés qu'aujourd'hui)
  - _Exigences : 2.1, 2.3_
- [ ] 2.2 model : extraire `catalogueObjectifs.ts` (OBJECTIFS, RUBRIQUES avec `ton` au lieu de classes), `etapes.ts` (étapes selon le type), `schemasCreation.ts` (règles de `erreurEtape`, mêmes messages), `parametresSimulation.ts`, `construireRequeteCreation.ts` ; tests unitaires de chaque fonction
  - _Exigences : 3.1, 3.2, 3.5, 4.2_
- [ ] 2.3 état : créer `useCreationTontine()` qui remplace les 25 `useState` (react-hook-form + zodResolver, étape courante, simulation)
  - _Exigences : 3.2_
- [ ] 2.4 ui : découper en `EtapeObjectif`, `EtapeMontantRythme`, `EtapeMembres`, `EtapeRecapitulatif`, `CreationReussie`, `LigneRecap` ; page ≤ 150 lignes
  - Terminé quand : `[caractérisation] CreerTontinePage` passe sans modification.
  - _Exigences : 1.2, 3.3, 3.4_

- [ ] 3. Autres domaines (même recette que la tâche 2 : api → model + tests → état → ui → page fine)
- [ ] 3.1 `tour` : `ToursPage`, `TourPage` ; sortir `RemiseSheet`, `Pill`, `Anneau`, `OPTIONS_REMISE`, `STATUT_PILL` ; extraire le calcul de progression et des options de remise dans `model/`
  - _Exigences : 1.2, 3.1, 3.3, 3.4, 4.2_
- [ ] 3.2 `paiement` : `PayerPage` (sortir `ChoisirTontine`, `DeclarerPaiement`, `Message`, `PayerSkeleton`), `RecuPage`, `components/pay/*` ; extraire choix de l'échéance, montant prérempli et régularisation dans `model/`
  - _Exigences : 1.2, 3.1, 3.3, 3.4_
- [ ] 3.3 `validation` : `AValiderPage`, `EncaisserPage`, `EncaisserDesktop` ; **une seule logique** partagée par les versions mobile et bureau (hook `useEncaissement`) ; extraire tri et regroupement des paiements dans `model/`
  - _Exigences : 1.2, 3.1, 3.3, 3.4_
- [ ] 3.4 `tontine` (suite) : `FicheTontinePage`, `ReglagesTontinePage`, `ModifierTontinePage`, `MesTontinesPage`, `components/tontine/*` ; extraire les règles d'affichage selon le rôle et le flux de clôture (409 puis `forcer`) dans `model/`
  - _Exigences : 1.2, 3.1, 3.3, 3.4_
- [ ] 3.5 `membre` et `priorite` : `MembresTontinePage`, `MembreFichePage`, `AddMembreModal`, `PrioritesPage`, `DemandesAdhesion`
  - _Exigences : 1.2, 3.1, 3.3, 3.4_
- [ ] 3.6 `accueil` : `HomePage`, `HomeDesktop`, `HomeSheets`, `components/home/*`, `MesJackpotsPage`, `HistoriquePage` ; logique commune mobile/bureau dans un hook ; calculs des bandeaux et cartes d'action dans `model/`
  - _Exigences : 1.2, 3.1, 3.3, 3.4_
- [ ] 3.7 `auth` : écrans d'authentification, `components/auth/*` ; séparer `AuthProvider` (contexte React) de la logique de session (`features/auth/model/session.ts`) ; formulaires avec zod
  - _Exigences : 1.2, 3.1, 3.2, 3.3_
- [ ] 3.8 `qr` : `ScannerPage`, `PartagerPage`, `MembreQrPage`, `InvitationPage`, `QrCard`
  - _Exigences : 1.2, 3.3_
- [ ] 3.9 `notification` : `NotificationsPage` ; la table type de notification → route devient une fonction pure testée
  - _Exigences : 1.2, 3.1_
- [ ] 3.10 `parametres` : `ParametresPage` (découper par section : profil, sécurité, PIN, appareils, préférences, assistance, installation)
  - _Exigences : 1.2, 3.3, 3.4_
- [ ] 3.11 `admin` : `superadmin/*`
  - _Exigences : 1.2, 3.3, 3.4_

- [ ] 4. Finitions
- [ ] 4.1 Supprimer les anciens dossiers vides (`pages/`, `components/`, `hooks/`, `services/`, `lib/`) et les réexportations temporaires
  - _Exigences : 2.1_
- [ ] 4.2 Passer les règles de dépendance en `error` ; ajouter `max-lines` (300, avertissement) et `complexity` (15)
  - _Exigences : 2.2, 6.2_
- [ ] 4.3 Retirer les dépendances inutilisées (contrôle avec `npx depcheck`) ; vérifier `@headlessui/react`
  - _Exigences : 6.1_
- [ ] 4.4 Relever les seuils de couverture : `features/*/model` ≥ 90 %, global ≥ valeur atteinte
  - _Exigences : 1.3_
- [ ] 4.5 Documenter : `docs/ARCHITECTURE.md` (structure, règles, recette pour ajouter un domaine) ; mettre à jour `docs/INVENTAIRE_FONCTIONNALITES.md` (corriger aussi la section 3 qui liste B26/B32/B33 comme non démarrés, et le doublon F103)
  - _Exigences : 6.3_
