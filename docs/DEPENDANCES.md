# Dépendances — sécurité et politique de mise à jour

> Mis à jour le 2026-11-16. Source : `npm audit` après la tâche 1.1 de la spec 03.

---

## 1. Vulnérabilités restantes après `npm audit fix`

Les 9 vulnérabilités ci-dessous **nécessitent un changement de version majeure** et sont
réservées aux tâches 6.x de la spec 03 (après la fin de la spec 01 — filet de tests).

| Paquet | Gravité | Direct ? | Exécuté où | CVE / Advisory | Correctif prévu | Tâche |
|---|---|---|---|---|---|---|
| `zod` | **élevée** | oui | navigateur | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) — épuisement mémoire sur collections surdimensionnées | `zod@4` | 6.1 |
| `react-router` | modérée | non (via react-router-dom) | navigateur | [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) — open redirect ; [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg) — injection constructeur SSR | `react-router@7` | 6.3 |
| `react-router-dom` | modérée | oui | navigateur | idem ci-dessus | `react-router-dom@7` | 6.3 |
| `vite` | modérée | oui | serveur de dev + build | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) — toute origine peut lire le serveur de dev | `vite@6+` | 6.2 |
| `esbuild` | modérée | non (via vite) | serveur de dev + build | idem | via `vite@6+` | 6.2 |
| `vite-plugin-pwa` | modérée | oui | build | dépend de `workbox-build` vulnérable | via `vite@6+` | 6.2 |
| `workbox-build` | modérée | non | build | dépend de `glob` vulnérable | via `vite-plugin-pwa` | 6.2 |
| `glob` | modérée | non | build | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) — AbortSignal bypass | via `vite-plugin-pwa` | 6.2 |
| `minimatch` | modérée | non | build | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) — DoS via globparts | via `vite-plugin-pwa` | 6.2 |

**Impact en production :** `vite`/`esbuild` concernent le serveur de développement (poste développeur),
pas le bundle servi aux utilisateurs. `zod` et `react-router` s'exécutent dans le navigateur de l'utilisateur
et sont à traiter en priorité.

---

## 2. Politique de délai de correction

| Gravité | Délai |
|---|---|
| Critique | 48 h (bloque toute PR en production) |
| Élevée | 7 jours (bloque toute PR en production) |
| Modérée | Au prochain lot de mises à jour hebdomadaire |
| Faible | Prochaine montée de version planifiée |

---

## 3. Règles pour les nouvelles dépendances

1. **Justifier le besoin** dans la description de la PR (fonctionnalité impossible sans ce paquet).
2. **Vérifier la maintenance** : dernier commit < 6 mois, issues ouvertes raisonnables, licence compatible.
3. **Lancer `npm audit`** après l'ajout et corriger avant de soumettre la PR.
4. **Préférer ce qui existe** : fonctionnalité couvrable par une dépendance déjà présente → pas de nouveau paquet.
5. **Pas de `npm audit fix --force`** sauf validation explicite de l'équipe.

---

## 4. Mises à jour automatiques — Dependabot

Configuré via `.github/dependabot.yml` (tâche 2.1 de la spec 03) :

- Fréquence : **hebdomadaire** (npm, GitHub Actions, Docker).
- Groupes : mises à jour mineures et correctives regroupées ; majeures en PR séparées.
- Revue : chaque PR Dependabot est examinée dans les **5 jours ouvrés**.

---

## 5. Historique des mises à jour de sécurité

| Date | Action | Résultat |
|---|---|---|
| 2026-11-16 | `npm audit fix` + `npm update axios react-router-dom postcss` | 21 → 9 vulnérabilités ; axios 1.6→1.21.1, postcss 8.4→8.5.33, react-router-dom 6.20→6.30.6 |
