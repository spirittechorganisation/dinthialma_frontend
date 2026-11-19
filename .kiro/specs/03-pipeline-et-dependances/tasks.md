# Plan d'implémentation — Pipeline CI/CD et sécurité des dépendances du frontend

> Lire `.kiro/steering/security.md`. Ne jamais afficher, écrire ou commiter un secret.
> Les tâches 1 à 3 peuvent démarrer tout de suite ; la tâche 4 complète `ci.yml` créé par la spec 01 (tâche 5.2) ;
> la tâche 6 (mises à jour majeures) **attend la fin de la spec 01**.

- [ ] 1. Correctifs immédiats des dépendances (sans version majeure)
- [ ] 1.1 Appliquer les correctifs compatibles
  - `npm audit fix` (**sans** `--force`), puis `npm update axios react-router-dom postcss`.
  - Vérifier : `npm run build` passe ; lancer `npm run dev` et parcourir connexion, accueil, paiement, création de tontine.
  - Noter dans le résumé le résultat de `npm audit` avant / après.
  - _Exigences : 1.2_
- [ ] 1.2 Lister ce qui reste
  - Créer `docs/DEPENDANCES.md` avec le tableau des vulnérabilités restantes (paquet, gravité, exécuté dans le navigateur ou au build, correctif prévu → tâche 6.x).
  - _Exigences : 1.3, 6.2_

- [ ] 2. Mises à jour automatiques
- [ ] 2.1 Créer `.github/dependabot.yml`
  - Écosystèmes : `npm` (hebdomadaire), `github-actions` (hebdomadaire), `docker` (hebdomadaire, dossier racine pour le Dockerfile).
  - Groupes npm : `prod-mineures` (dépendances, minor + patch), `dev-mineures` (devDependencies, minor + patch) ; majeures non groupées.
  - `open-pull-requests-limit: 5` ; étiquettes `dependances`, `securite`.
  - Rappeler dans le résumé : activer « Dependabot alerts » et « security updates » dans les réglages du dépôt (action manuelle).
  - _Exigences : 2.1, 2.2_

- [ ] 3. Image et serveur web
- [ ] 3.1 Passer à Node 24
  - Dockerfile : `FROM node:24-alpine AS builder` ; ajouter `.nvmrc` (`24`) et `"engines": { "node": ">=24" }` dans `package.json`.
  - Terminé quand : `docker build` réussit et l'application fonctionne.
  - _Exigences : 5.1_
- [ ] 3.2 Durcir nginx
  - `server_tokens off;` ; créer `nginx/security-headers.conf` et l'inclure dans **chaque** `location` (voir `design.md`).
  - Cache : `/assets/` immuable 1 an ; `index.html`, `sw.js`, `registerSW.js`, `workbox-*.js`, `manifest.webmanifest` en `no-cache` ; retirer la règle qui rend tous les `.js` immuables.
  - CSP d'abord en `Content-Security-Policy-Report-Only` ; vérifier dans la console du navigateur qu'aucune ressource légitime n'est signalée (API, Google Fonts, QR, caméra), puis passer en mode bloquant dans une tâche séparée.
  - Copier `nginx/` dans l'image (Dockerfile).
  - _Exigences : 5.2, 5.3_
- [ ] 3.3 (Optionnel) Image non root
  - `nginxinc/nginx-unprivileged` (port 8080) ; **coordonner** avec `docker-compose.prod.yml` du dépôt backend (port du service `frontend`, étiquette Traefik) ; ne pas déployer tant que les deux ne sont pas prêts.
  - _Exigences : 5.4_

- [ ] 4. Pipeline d'intégration complet (`ci.yml`)
- [ ] 4.1 Factoriser les contrôles
  - Créer `.github/workflows/_qualite.yml` (`on: workflow_call`) contenant les jobs `qualite`, `securite`, `image` ; `ci.yml` et `docker-publish.yml` l'appellent.
  - `permissions: contents: read` en tête ; `timeout-minutes` (10 à 20) sur chaque job ; `actions/setup-node` avec `node-version-file: .nvmrc` et `cache: npm`.
  - _Exigences : 3.1, 3.2_
- [ ] 4.2 Job `qualite`
  - `npm ci` → `npm run lint` → `npm run typecheck` → `npm run test:coverage` → `npm run build` ; rapport de couverture en artefact (7 jours).
  - _Exigences : 3.1_
- [ ] 4.3 Job `securite`
  - `npm audit --omit=dev --audit-level=high` (bloquant) ; `npm audit --json > audit.json || true` publié en artefact (non bloquant).
  - gitleaks sur le dépôt (historique complet : `fetch-depth: 0`). L'analyse OWASP Dependency-Check (tâche 8) remplace OSV-Scanner.
  - _Exigences : 1.1, 3.1_
- [ ] 4.4 Job `image`
  - `docker build` (sans push) ; Trivy sur l'image (`severity: HIGH,CRITICAL`, `ignore-unfixed: true`, échec si trouvé) ; lancer le conteneur, `curl -fsS http://localhost/health` et vérifier la présence des en-têtes de sécurité.
  - _Exigences : 3.1, 5.2_
- [ ] 4.5 Hygiène des actions
  - Actions tierces épinglées par SHA de commit avec la version en commentaire (`uses: appleboy/ssh-action@<sha> # v1.x`) : appleboy/ssh-action, docker/*, aquasecurity/trivy-action, gitleaks, google/osv-scanner-action.
  - Actions officielles (`actions/checkout`, `setup-node`, `upload-artifact`) sur leur dernière version majeure compatible Node 24.
  - Dependabot (tâche 2.1) tient ces SHA à jour.
  - _Exigences : 3.3_

- [ ] 5. Pipeline de déploiement (`docker-publish.yml`)
- [ ] 5.1 Conditionner le déploiement
  - Sur `push` vers `main` : appeler `_qualite.yml` ; `publier` dépend de `qualite`, `securite` et `image`.
  - _Exigences : 4.1_
- [ ] 5.2 Étiquettes immuables
  - Pousser `sha-<court>` et `latest` ; le déploiement utilise `FRONTEND_TAG=sha-<court>`.
  - **Coordination** : `docker-compose.prod.yml` (dépôt backend) doit lire `image: …/dinthialma-frontend:${FRONTEND_TAG:-latest}`.
  - _Exigences : 4.2_
- [ ] 5.3 Environnement et secrets
  - Créer l'environnement GitHub `production` ; y rattacher les secrets VPS et Docker Hub ; `job.deployer` utilise `environment: production`.
  - `VITE_API_URL` devient une **variable** (`vars.VITE_API_URL`) et non un secret.
  - Sur le VPS : connexion Docker Hub faite une fois avec un jeton **lecture seule** ; retirer du script le `docker login` qui fait transiter le jeton d'écriture (étape manuelle à décrire dans le résumé).
  - _Exigences : 4.4_
- [ ] 5.4 Retour arrière automatique
  - Avant le déploiement : lire l'étiquette en cours du conteneur `frontend`. Après : contrôle de santé (`/health` + page d'accueil HTTP 200). En cas d'échec : redéployer l'étiquette précédente et faire échouer le job.
  - _Exigences : 4.3_

- [ ] 6. Mises à jour majeures (après la spec 01 ; une PR par ligne ; tests, build et parcours manuel PWA à chaque fois)
- [ ] 6.1 zod 3 → 4, **avant** que la spec 02 écrive les schémas de formulaires ; vérifier les usages existants et adapter.
  - _Exigences : 1.1, 1.3_
- [ ] 6.2 Vite 5 → dernière version majeure, avec `@vitejs/plugin-react`, `vite-plugin-pwa` et `vitest` alignés (vérifier la compatibilité de chacun) ; contrôler l'enregistrement et la mise à jour du service worker.
  - _Exigences : 1.3_
- [ ] 6.3 React Router : dernière version 6.x d'abord ; la v7 seulement dans une tâche à part si elle apporte un intérêt.
  - _Exigences : 1.3_
- [ ] 6.4 TypeScript et typescript-eslint : dernières versions compatibles.
  - _Exigences : 1.3_
- [ ] 6.5 Mettre à jour `docs/DEPENDANCES.md` : objectif 0 vulnérabilité élevée ou critique dans `npm audit`.
  - _Exigences : 1.1, 6.2_

- [ ] 7. Gouvernance
- [ ] 7.1 `SECURITY.md` : adresse de signalement (`support@dinthialma.com`), délai de réponse, versions supportées.
  - _Exigences : 6.1_
- [ ] 7.2 `docs/DEPENDANCES.md` : politique — revue hebdomadaire des PR Dependabot ; délais de correction : critique 48 h, élevée 7 jours, modérée au lot suivant ; pas de nouvelle dépendance sans justification ; préférer les paquets maintenus.
  - _Exigences : 1.4, 6.2_
- [ ] 7.3 Décrire dans le résumé les réglages manuels du dépôt : branche `main` protégée (PR obligatoire, contrôles `qualite`, `securite`, `image` requis) — sur un dépôt privé, nécessite une offre GitHub payante (Pro ou Team).
  - _Exigences : 4.1_

- [ ] 8. Analyses OWASP Dependency-Check et SonarQube
  - **En attente** : à lancer seulement quand l'organisation GitHub existe et que les dépôts y sont transférés (suivi : Infra IN27), et après la spec 01 (couverture lcov). Les secrets seront créés une seule fois, au niveau de l'organisation.
  - Prérequis manuels (à faire par le développeur, rappeler dans le résumé s'ils manquent) : secrets `NVD_API_KEY`, `OSS_INDEX_USERNAME`, `OSS_INDEX_TOKEN` (facultatifs), `SONAR_TOKEN` ; variable `SONAR_ORGANIZATION` ; projet créé sur SonarQube Cloud avec l'analyse automatique **désactivée**.
- [ ] 8.1 Job « 🗄️ Mise à jour base NVD (OWASP) »
  - Restaurer le dossier de données de Dependency-Check depuis `actions/cache` (clé datée du jour, repli sur la plus récente) ; Java 21 via `actions/setup-java` ; CLI Dependency-Check (version récente épinglée) ; `--updateonly --nvdApiKey $NVD_API_KEY` ; sauvegarder le cache.
  - Ajouter `.github/workflows/nvd-cache.yml` (`schedule` quotidien + `workflow_dispatch`) qui fait la même mise à jour, pour que les PR trouvent un cache chaud.
  - Si `NVD_API_KEY` est absent : le job échoue avec un message clair (sans clé, la mise à jour est extrêmement lente).
  - _Exigences : 1.1, 3.1_
- [ ] 8.2 Job « 🔒 Analyse de sécurité OWASP » (dépend de 8.1)
  - `npm ci` puis Dependency-Check en `--noupdate` sur le dépôt ; analyseurs Node Audit, Node Package et RetireJS ; OSS Index seulement si ses identifiants existent, avec `--ossIndexUrl https://api.guide.sonatype.com` (OSS Index a migré vers Sonatype Guide ; jeton = PAT Guide, utilisateur = email du compte) ; exclure `dist/`, `coverage/`, `dev-dist/`.
  - `--failOnCVSS 7` ; fichier `dependency-check-suppressions.xml` à la racine (chaque suppression avec CVE, raison et date de revue) ; rapports HTML, JSON et SARIF en artefacts (14 jours).
  - _Exigences : 1.1, 3.1_
- [ ] 8.3 Configurer SonarQube Cloud
  - `sonar-project.properties` : `sonar.projectKey`, `sonar.organization`, `sonar.sources=src`, `sonar.tests=src`, `sonar.test.inclusions=**/*.test.ts,**/*.test.tsx`, `sonar.exclusions=**/*.test.*,src/test/**,src/types/**`, `sonar.javascript.lcov.reportPaths=coverage/lcov.info`, `sonar.qualitygate.wait=true`.
  - Vitest : ajouter le reporter de couverture `lcov` (dépend de la spec 01).
  - _Exigences : 3.1_
- [ ] 8.4 Job « 📊 Analyse SonarQube » (dépend du job `qualite`)
  - Télécharger l'artefact de couverture du job `qualite` ; `actions/checkout` avec `fetch-depth: 0` ; `SonarSource/sonarqube-scan-action` épinglée par SHA ; `SONAR_TOKEN` en secret.
  - La porte qualité (« Sonar way ») bloque la PR ; la règle de complexité cognitive (seuil 15) répond à la tâche TS23 du suivi.
  - Ne pas lancer le job si `SONAR_TOKEN` est absent (PR de Dependabot ou de forks : secrets indisponibles) : condition `if:` explicite.
  - _Exigences : 3.1_
