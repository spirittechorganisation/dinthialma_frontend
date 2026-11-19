# Conception — Pipeline CI/CD et sécurité des dépendances du frontend

## Audit du 17/11/2026 (`npm audit --package-lock-only`)
| Paquet | Gravité | Direct | Exécuté où | Correctif |
|---|---|---|---|---|
| axios | élevée | oui | **navigateur** | mise à jour mineure |
| react-router-dom / react-router | modérée (redirection ouverte → XSS) | oui | **navigateur** | mise à jour mineure |
| zod | élevée | oui | navigateur (si utilisé) | **majeure** 3 → 4 |
| postcss | élevée | oui | build | mineure |
| vite / esbuild | élevée / modérée | oui | serveur de dev, build | **majeure** |
| vite-plugin-pwa, workbox-build, glob, minimatch, serialize-javascript, fast-uri | modérée à élevée | indirect | build | à revoir avec la montée de Vite |
| follow-redirects, form-data | élevée | indirect (axios) | Node uniquement, pas dans le bundle | via axios |
| brace-expansion, browserslist, nanoid, source-map-js, postcss-selector-parser, baseline-browser-mapping | modérée à élevée | indirect | build | `npm audit fix` |

**Priorité** : ce qui tourne dans le navigateur des utilisateurs (axios, react-router) d'abord, puis le reste.
Les failles du serveur de dev concernent le poste du développeur, pas la production, mais restent à corriger.

## Pipeline cible
```
PR / push hors main ── ci.yml
  qualite   : npm ci → lint → typecheck → test:coverage → build      (créé par la spec 01, tâche 5.2)
  securite  : npm audit --omit=dev --audit-level=high (bloquant)
              npm audit complet (rapport, non bloquant) · gitleaks
  nvd       : 🗄️ mise à jour de la base NVD (cache partagé, rafraîchi chaque nuit)
  owasp     : 🔒 Dependency-Check (--noupdate, échec si CVSS ≥ 7)
  sonar     : 📊 SonarQube Cloud (couverture lcov du job qualite, porte qualité bloquante)
  image     : docker build → Trivy (HIGH/CRITICAL corrigeables = échec) → conteneur lancé → curl /health + en-têtes

push main ── docker-publish.yml
  qualite + securite + image (mêmes jobs, réutilisés via workflow_call)
  publier   : push Docker Hub, étiquettes sha-<court> et latest
  deployer  : environnement production · FRONTEND_TAG=sha-<court> · docker compose up frontend
  sante     : /health + page d'accueil ; échec → retour à l'étiquette précédente
```
- Jobs communs dans `.github/workflows/_qualite.yml` (`on: workflow_call`) pour ne pas dupliquer.
- `permissions: contents: read` au niveau du workflow ; `concurrency` ; `timeout-minutes` sur chaque job.
- `actions/setup-node` avec `node-version-file: .nvmrc` (24) et `cache: npm`.

## Outils (gratuits)
| Usage | Outil | Remarque |
|---|---|---|
| Vulnérabilités npm | `npm audit` | intégré |
| Vulnérabilités (2e source, comme le backend plus tard) | OWASP Dependency-Check (NVD + npm audit + RetireJS + OSS Index) | clé NVD gratuite indispensable ; cache du dossier de données |
| Qualité et sécurité du code | SonarQube Cloud, offre gratuite | dépôts privés jusqu'à 50 000 lignes de code par organisation, analyse des PR, 5 utilisateurs |
| Secrets | gitleaks | historique complet au premier passage |
| Image Docker | Trivy | `--ignore-unfixed`, échec sur HIGH/CRITICAL |
| Mises à jour | Dependabot | gratuit, y compris sur dépôt privé |
| Revue des dépendances d'une PR | dependency-review-action | gratuit en public ; en privé, nécessite GitHub Advanced Security (payant) → OSV-Scanner à la place |

## nginx
- `server_tokens off;`
- En-têtes dans un fichier `security-headers.conf` inclus **dans chaque `location`** (un `add_header` dans une location annule ceux du niveau serveur) :
  `Content-Security-Policy` (default-src 'self' ; connect-src 'self' + URL de l'API ; img-src 'self' data: blob: ;
  style-src 'self' 'unsafe-inline' si nécessaire ; font-src 'self' + Google Fonts ; frame-ancestors 'none' ; worker-src 'self'),
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(self), geolocation=(), microphone=()` (la caméra sert au scanner de QR).
- Cache : `location /assets/` → `public, max-age=31536000, immutable` ; `index.html`, `sw.js`, `registerSW.js`,
  `workbox-*.js`, `manifest.webmanifest` → `no-cache`.
- CSP d'abord en `Content-Security-Policy-Report-Only` pendant une semaine, puis en mode bloquant.
- Image non root : `nginxinc/nginx-unprivileged` (port 8080) → **impact** : port du service `frontend` dans
  `docker-compose.prod.yml` (dépôt backend) et étiquette Traefik à mettre à jour en même temps.

## Déploiement avec retour arrière
- `docker-compose.prod.yml` lit `image: <org>/dinthialma-frontend:${FRONTEND_TAG:-latest}`.
- Le job de déploiement mémorise l'étiquette en cours, déploie la nouvelle, contrôle la santé ; en cas d'échec, redéploie l'ancienne et échoue.
- Le VPS garde une connexion Docker Hub avec un jeton **lecture seule**, créée une fois : le jeton d'écriture ne transite plus par le script SSH.

## Ordre
Correctifs immédiats → Dependabot → nginx et Node 24 → pipeline CI complet → pipeline CD → (après la spec 01) mises à jour majeures → gouvernance.
