# Exigences — Pipeline CI/CD et sécurité des dépendances du frontend

## Introduction
État constaté le 17/11/2026 :
- Le workflow `docker-publish.yml` construit et **déploie à chaque push sur `main` sans aucun contrôle** (ni lint, ni test, ni audit).
- `npm audit` sur `package-lock.json` : **21 vulnérabilités** (11 élevées, 9 modérées, 1 faible, 0 critique),
  dont des dépendances directes exécutées dans le navigateur (`axios`, `react-router-dom`, `zod`).
- Le Dockerfile construit avec **Node 20, en fin de vie depuis le 30/04/2026** (plus de correctifs de sécurité).
- `nginx.conf` : aucun en-tête de sécurité ; la règle de cache « 1 an, immuable » s'applique à **tous** les `.js`,
  y compris les scripts du service worker (`sw.js`, `registerSW.js`, `workbox-*.js`), ce qui peut bloquer les mises à jour de la PWA.
- Aucun Dependabot, aucune analyse d'image Docker, aucune recherche de secrets.
- Actions GitHub tierces référencées par étiquette mobile (`@v1.2.0`, `@v3`) et non par empreinte (SHA).

## Exigence 1 — Vulnérabilités connues
1.1 QUAND une vulnérabilité **élevée ou critique** touche une dépendance de production ALORS la PR DOIT être bloquée.
1.2 LES vulnérabilités corrigibles sans changement de version majeure DOIVENT être corrigées immédiatement.
1.3 LES mises à jour majeures DOIVENT se faire une par une, **après** la spec 01 (filet de tests), chacune dans sa PR.
1.4 LE projet DOIT documenter une politique de délai de correction (critique, élevée, modérée).

## Exigence 2 — Mises à jour automatiques
2.1 Dependabot DOIT proposer chaque semaine les mises à jour npm, GitHub Actions et Docker.
2.2 LES mises à jour mineures et correctives DOIVENT être groupées ; les majeures, séparées.

## Exigence 3 — Pipeline d'intégration (chaque PR)
3.1 LA PR DOIT passer : lint, typecheck, tests avec couverture, build de production, audit des dépendances, recherche de secrets, construction et analyse de l'image Docker.
3.2 LES workflows DOIVENT avoir des permissions minimales, un délai maximal par job et annuler les exécutions obsolètes.
3.3 LES actions tierces DOIVENT être épinglées par SHA ; les actions officielles, sur une version compatible Node 24.

## Exigence 4 — Pipeline de déploiement
4.1 LE déploiement NE DOIT partir QUE si tous les contrôles de la PR passent aussi sur `main`.
4.2 L'image DOIT être construite une fois, étiquetée par SHA de commit, et déployée par cette étiquette.
4.3 QUAND le contrôle de santé échoue après déploiement ALORS la version précédente DOIT être remise automatiquement.
4.4 LES valeurs publiques (ex. `VITE_API_URL`) DOIVENT être des variables, pas des secrets ; les secrets DOIVENT être rattachés à l'environnement `production`.

## Exigence 5 — Image et serveur web
5.1 L'image DOIT être construite avec une version LTS supportée de Node (24).
5.2 nginx DOIT envoyer les en-têtes de sécurité (CSP, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors) et masquer sa version.
5.3 `index.html`, le manifeste et les scripts du service worker NE DOIVENT PAS être mis en cache longtemps ; seuls les fichiers à empreinte de `/assets/` le DOIVENT.
5.4 L'image NE DEVRAIT PAS tourner en root.

## Exigence 6 — Gouvernance
6.1 UN fichier `SECURITY.md` DOIT expliquer comment signaler une faille.
6.2 LA politique de dépendances DOIT être documentée (`docs/DEPENDANCES.md`).
