# Conception — Filet de tests du frontend

## État constaté (17/11/2026)
- 0 test, 0 outil de test ; `react-hook-form` et `zod` installés.
- Couches déjà séparées pour les données : `services/*Service.ts` (Axios) → `hooks/use*.ts` (React Query) → `pages/`.
- Écrans volumineux qui mélangent état, validation, calculs et JSX :
  `CreerTontinePage` (≈ 670 lignes, 25 `useState`), `TourPage` (≈ 680 lignes, sous-composant `RemiseSheet`),
  `ReglagesTontinePage`, `FicheTontinePage`, `HomePage`, `ParametresPage`, `AValiderPage`, `EncaisserPage` (20 à 34 Ko chacun).
- `services/api.ts` : intercepteurs (Bearer, refresh avec file d'attente) et redirection par `window.location.href`.
- `usePWA` dépend du module virtuel de vite-plugin-pwa : il faut le simuler en test.

## Outils
| Besoin | Outil | Pourquoi |
|---|---|---|
| Lanceur | Vitest (version compatible Vite 5) | même config que Vite, rapide, API proche de Jest |
| DOM | jsdom | standard avec Testing Library |
| Composants | @testing-library/react + user-event + jest-dom | teste ce que voit l'utilisateur |
| Réseau | MSW (Node) | simule le backend sans toucher au code Axios |
| Couverture | @vitest/coverage-v8 | rapide, seuils par dossier |
| Lint | ESLint 9 (config « flat ») + typescript-eslint + react-hooks + react-refresh | le script `lint` existe mais l'outil manque |

## Organisation
```
src/test/
  setup.ts                 jest-dom, MSW (listen/reset/close), cleanup, localStorage.clear(), mocks navigateur
  render.tsx               renderWithProviders(ui, { route, path, auth: 'membre' | 'gestionnaire' | 'superadmin' | null })
  auth.ts                  fabrique de JWT de test (non signés) + connexion simulée via tokenStorage
  factories/               uneTontine(), uneCotisation(), unCycle(), unResume()… (valeurs par défaut + surcharge partielle)
  msw/
    server.ts              setupServer(...handlers)
    api.ts                 const API = 'http://api.test/api' ; helpers ok(data), page(items), erreur(status, code, message)
    handlers/<domaine>.ts  handlers par défaut (réponses nominales) ; surchargés par test avec server.use(...)
```
- `VITE_API_URL=http://api.test` en test ; `process.env.TZ = 'Africa/Dakar'` en tête de la config.
- Module virtuel PWA : `vi.mock('virtual:pwa-register/react', …)` dans `setup.ts`.
- `window.location` : remplacé par un objet espion pour vérifier la redirection vers `/login`.

## Capturer ce qui part au backend
```ts
let corps: unknown
server.use(http.post(`${API}/v1/tontines`, async ({ request }) => {
  corps = await request.json()
  return HttpResponse.json(ok(uneTontine({ id: 't1' })))
}))
// … parcours utilisateur …
expect(corps).toMatchObject({ tontineType: 'ROTATIVE', montant: 5000, nombreMembres: 10 })
```

## Stratégie de couverture
| Dossier | Seuil lignes | Moment |
|---|---|---|
| `src/lib` | 90 % | fin de la tâche 2 |
| `src/services` | 80 % | fin de la tâche 3 |
| `src/hooks` | 70 % | fin de la tâche 3 |
| global | valeur mesurée, arrondie à l'inférieur | fin de la tâche 4, puis relevée à chaque lot |

## CI
- Nouveau workflow `.github/workflows/ci.yml` : sur `pull_request` (vers `main`/`develop`) et `push` hors `main`.
  Étapes : `npm ci` → `lint` → `typecheck` → `test:coverage` → rapport de couverture en artefact.
  `concurrency` avec `cancel-in-progress` (dépôts privés : minutes limitées).
- `docker-publish.yml` : ajouter un job `qualite` (mêmes étapes) dont dépend `build-push`.

## Risques
- Textes de l'interface changés pendant le refactoring → les tests cherchent par rôle et par libellé stable ;
  un changement de texte voulu se fait dans une tâche dédiée.
- Tests lents sur les gros écrans → MSW + `user-event` sans délais (`userEvent.setup({ delay: null })` avec faux timers).
