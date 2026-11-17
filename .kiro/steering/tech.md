---
inclusion: always
---
# Stack technique et commandes

## Stack
- Node 24 LTS (`.nvmrc`), React 18 + TypeScript 5 (strict), Vite 5 (montée de version prévue, spec 03), vite-plugin-pwa (Workbox)
- TanStack Query v5 (données serveur), React Router v6, Axios
- Tailwind CSS 3, lucide-react, sonner (toasts), clsx + tailwind-merge
- react-hook-form + zod (installés ; passer à zod 4 avant d'écrire les schémas de formulaires — spec 03, tâche 6.1)
- Tests (spec 01) : Vitest, @vitest/coverage-v8, jsdom, Testing Library (react, user-event, jest-dom), MSW

## Commandes
| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de dev (port 4200) |
| `npm run build` | `tsc` puis build Vite |
| `npm run lint` | ESLint (0 avertissement toléré) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest une fois |
| `npm run test:watch` | Vitest en continu |
| `npm run test:coverage` | Vitest + couverture (seuils bloquants) |

## Conventions API backend
- Base : `${VITE_API_URL}/api`, endpoints `/v1/...`.
- Réponses enveloppées : `CustomResponse<T>` → la donnée utile est dans `response.data.data`.
- Pagination Spring : convertir avec `toPage()` (`@/types/common`).
- Paramètres multi-valeurs au format `?statut=A&statut=B` (`paramsSerializer: { indexes: null }`).
- Erreurs : toujours passer par `parseApiError` / `messageErreur` (`lib/apiError`), jamais lire le texte du message à la main.
- Auth : JWT Keycloak + refresh automatique sur 401 (`services/api.ts`) ; un 403 ne déconnecte jamais.

## Règles générales
- Pas de nouvelle dépendance sans justification écrite dans la tâche.
- Aucun secret dans le code ; seules les variables `VITE_*` publiques.
- Code, noms et commentaires métier en français (comme l'existant).
