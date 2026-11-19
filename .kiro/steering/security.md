---
inclusion: always
---
# Règles de sécurité (code, dépendances, CI/CD)

- **Aucun secret** dans le code, les tests, les workflows ou les messages de commit. Les secrets vivent dans GitHub (environnement `production`) ou sur le VPS.
- Les variables `VITE_*` sont **publiques** (compilées dans le bundle) : n'y mettre que des valeurs publiques.
- Nouvelle dépendance : justifier le besoin, vérifier qu'elle est maintenue, lancer `npm audit` ; préférer une solution existante.
- `npm ci` en CI (jamais `npm install`) ; le `package-lock.json` est toujours commité.
- Workflows GitHub : `permissions: contents: read` par défaut ; actions tierces épinglées par SHA ; `timeout-minutes` sur chaque job.
- Vulnérabilité élevée ou critique en production : bloque la PR. Délais : critique 48 h, élevée 7 jours.
- Ne jamais désactiver un contrôle de sécurité (audit, Trivy, gitleaks) pour faire passer une PR ; ajouter une exception documentée et datée si un faux positif est avéré.
- Front : ne jamais injecter de HTML non maîtrisé (`dangerouslySetInnerHTML` interdit sauf revue) ; valider toute URL de redirection (risque de redirection ouverte).
