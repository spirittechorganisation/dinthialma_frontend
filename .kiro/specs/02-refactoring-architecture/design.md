# Conception — Refactoring de l'architecture du frontend

## Principe : « déplacer, extraire, découper », jamais réécrire
Chaque tâche est un changement **mécanique et petit**, vérifié par les tests de la spec 01 :
1. **Déplacer** un fichier vers sa place cible (imports mis à jour, aucun changement de code).
2. **Extraire** une logique en fonction pure dans `model/`, puis ajouter ses tests unitaires.
3. **Découper** un gros composant en composants d'interface plus petits.
Un lot = une PR = CI verte. On ne mélange pas déplacement et changement de logique dans le même commit.

## Structure cible
Voir `.kiro/steering/structure.md`. Correspondance des domaines :

| Domaine (`features/`) | Écrans actuels | Services / hooks actuels |
|---|---|---|
| `auth` | Login, PinLogin, PinSetup, PinReset, Register, ForgotPassword, Onboarding | authService, useAuth, tokenStorage (partie session) |
| `accueil` | HomePage, HomeDesktop, HomeSheets, MesJackpots, Historique | meService, useMe, dashboardService, useDashboard |
| `tontine` | CreerTontine, FicheTontine, ModifierTontine, ReglagesTontine, MesTontines | tontineService, useTontines, useTontineVue, useFavoris |
| `tour` | ToursPage, TourPage (+ RemiseSheet) | cycleService, useCycles |
| `paiement` | PayerPage, RecuPage | cotisationService, useCotisations |
| `validation` | AValiderPage, EncaisserPage, EncaisserDesktop | validationService |
| `membre` | MembresTontine, MembreFiche, AddMembreModal | membreService, useMembres |
| `priorite` | PrioritesPage | prioriteService, usePriorites |
| `qr` | Scanner, Partager, MembreQr, Invitation | qrService, useQr |
| `notification` | NotificationsPage | notificationService, useNotifications |
| `parametres` | ParametresPage | securiteService, userService, preferences |
| `admin` | superadmin/* | dashboardService (plateforme), userService, codeListService |

## Règles de dépendance (ESLint)
- `no-restricted-imports` (ou eslint-plugin-boundaries si la règle native ne suffit pas) :
  - `shared/**` ne peut pas importer `features/**` ni `app/**`.
  - `features/A/**` ne peut importer `features/B/**` que via `@/features/B` (son `index.ts`).
  - `features/*/ui/**` ne peut pas importer `axios`, `@tanstack/react-query`, `*/api/**`.
  - `axios` interdit hors `shared/api/**` et `features/*/api/**`.

## Recette appliquée à chaque domaine
1. **api/** : déplacer le service et les hooks ; créer `queryKeys.ts` (fabrique de clés : `tontineKeys.detail(id)`…) et remplacer les clés écrites à la main **sans changer leur valeur** (les tests de la spec 01 vérifient les invalidations).
2. **model/** : extraire de la page tout ce qui n'est pas du rendu :
   - validation → schéma zod par étape, **mêmes messages qu'aujourd'hui** ;
   - construction des requêtes → `construireRequeteX(valeurs): XRequest` ;
   - calculs (montants, progression, jackpot prévu) → fonctions pures ;
   - catalogues (ex. `OBJECTIFS`) → `model/catalogue.ts` avec une **variante** au lieu de classes (`ton: 'rose'`).
   Chaque fonction extraite reçoit des tests unitaires (≥ 90 % de couverture de `model/`).
3. **état d'écran** : remplacer les `useState` en cascade par un hook `useXxxFormulaire()` (react-hook-form + zodResolver, ou `useReducer` quand ce n'est pas un formulaire).
4. **ui/** : découper le JSX en composants de présentation (`EtapeObjectif`, `EtapeMontant`…) ; les sous-composants définis dans le fichier de la page (ex. `RemiseSheet`, `Pill`, `Anneau`) deviennent des fichiers `ui/`.
5. **pages/** : la page ne fait plus que relier hooks et composants.
6. Les tests de caractérisation de l'écran passent sans modification ; supprimer l'ancien emplacement.

## Exemple : `CreerTontinePage` (avant → après)
```
features/tontine/
  model/catalogueObjectifs.ts       OBJECTIFS, RUBRIQUES (ton: 'rose' | 'ambre' … au lieu de classes)
  model/schemasCreation.ts          schémas zod des étapes 1 à 4 (messages actuels)
  model/construireRequeteCreation.ts valeurs du formulaire → CreateTontineRequest (commission incluse)
  model/parametresSimulation.ts     valeurs → SimulationParams | null
  model/etapes.ts                   étapes selon le type (événementielle : 1, 2, 4)
  model/*.test.ts
  api/useCreerTontine.ts            mutation + renouvellement de session après création
  ui/EtapeObjectif.tsx  ui/EtapeMontantRythme.tsx  ui/EtapeMembres.tsx  ui/EtapeRecapitulatif.tsx  ui/CreationReussie.tsx
  pages/CreerTontinePage.tsx        ≤ 150 lignes
```

## Couche partagée
- `shared/api/httpClient.ts` (ex `services/api.ts`) : l'expiration de session appelle `surSessionExpiree()` enregistré par `app/` qui fait la redirection ; comportement visible inchangé (redirection vers `/login`).
- `tokenStorage.ts` découpé en `shared/lib/storage.ts` (accès sûr à localStorage, reprend `safeGet`/`safeSet` de `format.ts`), `shared/lib/jwt.ts`, `shared/lib/telephone.ts`, `shared/lib/appareil.ts`, et `features/auth/model/session.ts`.
- `tontineLabels.ts` découpé : règles de rythme et d'échéance → `features/tontine/model/rythme.ts` ; dates → `shared/lib/dates.ts` ; libellés → `features/*/ui/libelles.ts` ; couleurs de statut → variantes de `shared/ui/StatusBadge`.
- Types générés : `openapi-typescript` sur `api-docs.json` → `shared/api/generated/schema.d.ts` ; script `npm run api:types` ; migration progressive des types manuels (tâche optionnelle).

## Ordre des lots (risque × valeur)
Fondations (app, shared) → tontine/création → tour/remise → paiement → validation/encaissement → fiche et réglages →
membres et priorités → accueil → auth → qr → notifications → paramètres → admin → finitions.
