# Exigences — Refactoring de l'architecture du frontend

## Introduction
Les données serveur sont déjà séparées (services → hooks React Query → pages), mais les **écrans** mélangent état,
règles métier, validation, construction des requêtes, données de configuration, classes de style et JSX
(ex. `CreerTontinePage` ≈ 670 lignes et 25 `useState`). Les utilitaires de `lib/` mélangent aussi plusieurs
responsabilités (`tokenStorage` : JWT + téléphone + appareil + stockage ; `tontineLabels` : règles + libellés + couleurs + dates).
Objectif : un code **facile à lire, organisé par domaine et exploitable**, sans changer le comportement.

**Prérequis : la spec `01-filet-de-tests` est terminée et la CI est verte.**

## Exigence 1 — Aucune régression
1.1 APRÈS chaque tâche, lint, typecheck et tous les tests DOIVENT passer.
1.2 LES tests marqués `[caractérisation]` NE DOIVENT PAS être modifiés pour passer (règle de `testing.md`).
1.3 LA couverture globale NE DOIT PAS baisser.
1.4 LES routes, textes visibles et requêtes envoyées au backend DOIVENT rester identiques, sauf tâche dédiée et validée.

## Exigence 2 — Architecture par domaine et en couches
2.1 LE code DOIT suivre la structure cible de `.kiro/steering/structure.md` (`app/`, `shared/`, `features/<domaine>/{api,model,ui,pages}`).
2.2 LES règles de dépendance DOIVENT être vérifiées automatiquement par ESLint.
2.3 CHAQUE domaine DOIT exposer une API publique (`index.ts`) ; aucun import profond entre domaines.

## Exigence 3 — Séparation des responsabilités dans les écrans
3.1 LES règles métier (validation, calculs, construction des requêtes, transformations) DOIVENT vivre dans `features/*/model` sous forme de fonctions pures testées unitairement.
3.2 LES formulaires DOIVENT déclarer leurs règles de validation dans un schéma (zod) partagé avec les messages d'erreur actuels.
3.3 LES composants d'interface NE DOIVENT PAS appeler le réseau ni React Query ; ils reçoivent des props et émettent des événements.
3.4 UNE page conteneur NE DOIT PAS dépasser 150 lignes ; un composant d'interface 200 lignes.
3.5 LES données de configuration (catalogues d'objectifs, options) DOIVENT sortir des composants.

## Exigence 4 — Styles
4.1 LES couleurs et variantes DOIVENT passer par des composants du design system (`shared/ui`) et des jetons Tailwind sémantiques.
4.2 LES données métier NE DOIVENT PAS contenir de classes CSS.

## Exigence 5 — Couche technique partagée
5.1 LE client HTTP NE DOIT PAS naviguer lui-même (`window.location.href`) : il signale l'expiration de session, l'application redirige.
5.2 LES utilitaires DOIVENT avoir une seule responsabilité par fichier (stockage, JWT, téléphone, dates, format).
5.3 LES types des réponses du backend DEVRAIENT être générés depuis `api-docs.json`.

## Exigence 6 — Qualité durable
6.1 LES dépendances inutilisées DOIVENT être retirées.
6.2 DES règles ESLint DOIVENT limiter la taille des fichiers et la complexité.
6.3 L'architecture DOIT être documentée (`docs/ARCHITECTURE.md`).
