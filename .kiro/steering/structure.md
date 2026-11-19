---
inclusion: always
---
# Structure du code

## Aujourd'hui (avant la spec 02)
```
src/
  pages/        écrans routés (certains font 400 à 700 lignes : état, validation, calculs et JSX mélangés)
  components/   ui/, layout/, shared/, home/, gestion/, pay/, tontine/, desktop/, auth/, app/
  hooks/        hooks React Query par domaine (+ useAuth)
  services/     appels API Axios (un fichier par domaine) + api.ts (client, intercepteurs)
  lib/          utilitaires (format, apiError, tokenStorage, tontineLabels…)
  types/        types TypeScript recopiés du backend
  router/       routes et gardes
```

## Cible (spec 02 « refactoring-architecture »)
```
src/
  app/                        démarrage : App, providers, router, queryClient, bootstrap
  shared/
    api/                      httpClient (Axios + intercepteurs), apiError, types générés (generated/)
    lib/                      fonctions pures sans React : format, dates, storage, jwt, phone, csv
    ui/                       design system : Button, Input, Modal, Badge, StatusBadge… (variantes, aucun appel API)
    hooks/                    hooks techniques génériques : useOnline, useMediaQuery, useLocalPreference
    config/                   lecture des variables d'environnement
  features/<domaine>/         auth, accueil, tontine, tour, paiement, validation, membre, priorite,
                              qr, notification, parametres, admin
    api/                      service (appels), queryKeys, hooks React Query du domaine
    model/                    règles métier PURES : schémas zod, calculs, construction des requêtes, mappers
    ui/                       composants de présentation du domaine (props en entrée, événements en sortie)
    pages/                    conteneurs routés : branchent les hooks sur l'ui (fins)
    index.ts                  API publique du domaine (seul point d'import depuis l'extérieur)
```

## Règles de dépendance
- `app` → `features` → `shared`. Jamais l'inverse.
- Une feature n'importe pas l'intérieur d'une autre feature : seulement son `index.ts`.
- **Axios uniquement dans `shared/api`** et dans `features/*/api`.
- **Aucun calcul métier dans le JSX** : il vit dans `model/` et il est testé unitairement.
- **Aucune classe CSS dans les données métier** (ex. `tone: 'bg-rose-100'`) : la donnée porte une variante,
  le composant `ui` traduit la variante en classes.
- `ui/` ne fait aucun appel réseau et n'utilise pas React Query.

## Tailles indicatives
- Composant d'interface ≤ 200 lignes ; page conteneur ≤ 150 lignes ; fichier `model` sans limite mais fonctions courtes.
- Un fichier = un composant exporté principal.
