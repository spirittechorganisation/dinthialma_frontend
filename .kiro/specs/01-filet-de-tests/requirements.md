# Exigences — Filet de tests du frontend

## Introduction
Le frontend Dinthialma n'a aujourd'hui **aucun test et aucun outil de test** (ni Vitest, ni Testing Library dans
`package.json`). Le script `lint` existe mais ESLint n'est pas installé. La CI construit et déploie à chaque push sur
`main` sans aucune vérification. Avant de refactorer (spec 02), il faut un filet de tests qui fige le comportement actuel
et devient la **source de vérité** en cas de régression.

## Exigence 1 — Outillage de test
**En tant que** développeur, **je veux** lancer des tests unitaires et d'intégration en une commande, **afin de** vérifier le front localement et en CI.
1.1 LE projet DOIT fournir les scripts `test`, `test:watch`, `test:coverage` et `typecheck`.
1.2 LES tests DOIVENT s'exécuter dans un DOM simulé (jsdom) avec le fuseau `Africa/Dakar`.
1.3 LE réseau DOIT être simulé par MSW ; QUAND une requête n'a pas de handler ALORS le test DOIT échouer.
1.4 LE projet DOIT fournir un utilitaire de rendu avec QueryClient, routeur et authentification configurables.
1.5 `npm run lint` DOIT fonctionner (ESLint installé et configuré) et passer.

## Exigence 2 — Tests unitaires des fonctions pures
**En tant que** développeur, **je veux** que chaque utilitaire de `src/lib` soit testé, **afin de** pouvoir le déplacer ou le découper sans risque.
2.1 CHAQUE fichier de `src/lib` DOIT avoir un fichier de test couvrant les cas nominaux, les valeurs nulles et les cas limites.
2.2 LA couverture des lignes de `src/lib` DOIT atteindre au moins 90 %.
2.3 LES fonctions qui dépendent de la date DOIVENT être testées avec une date système fixée.

## Exigence 3 — Tests d'intégration de la couche API
**En tant que** développeur, **je veux** vérifier ce que chaque service envoie et reçoit, **afin de** garantir le contrat avec le backend pendant le refactoring.
3.1 LE client HTTP DOIT être testé : jeton Bearer, refresh unique sur 401 avec file d'attente, redirection vers `/login` si le refresh échoue, aucun refresh sur les routes d'authentification, aucune déconnexion sur 403.
3.2 CHAQUE service DOIT être testé : méthode HTTP, URL, paramètres, corps, et extraction de `data` / pagination.
3.3 LES hooks de mutation DOIVENT être testés sur les clés de cache qu'ils invalident.
3.4 LA couverture des lignes de `src/services` DOIT atteindre au moins 80 %, celle de `src/hooks` au moins 70 %.

## Exigence 4 — Tests de caractérisation des écrans critiques
**En tant que** gestionnaire ou membre, **je veux** que les parcours qui touchent à l'argent ne changent pas de comportement, **afin de** garder confiance dans l'app.
4.1 CHAQUE écran critique DOIT avoir au moins un test nominal et deux tests d'erreur.
4.2 QUAND un écran envoie une écriture au backend ALORS le test DOIT vérifier le corps de la requête.
4.3 CES tests DOIVENT être marqués `[caractérisation]` et ne vérifier que le comportement visible.
4.4 Écrans critiques : connexion et PIN, création de tontine, paiement, À valider, encaisser, tour et remise du jackpot, fiche et clôture de tontine, réglages, accueil, gardes de navigation, notifications.

## Exigence 5 — Verrouillage en CI
5.1 UNE PR NE DOIT PAS pouvoir être fusionnée si le lint, le typecheck ou un test échoue.
5.2 LE déploiement sur `main` NE DOIT PAS partir si ces contrôles échouent.
5.3 LES seuils de couverture DOIVENT être bloquants.
5.4 LA documentation DOIT expliquer comment lancer et écrire les tests.
