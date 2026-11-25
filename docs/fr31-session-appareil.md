# FR31 — Session longue par appareil (B53) et codes de sécurité (SE07)

> Branche `feature/fr31-session-appareil`, depuis `develop` à jour (`6be589f`, FR29 fusionné), 24-25/11/2026.
> Backend `develop` local (`63df402`), Keycloak local avec les réglages du § 3 du livrable backend (appliqués le 24/11, rotation active).
> Livrable backend lu : `Docs/diagnostic/2026-11-b53-session-appareil.md` (§ 2 et 5).
> Vérifications à 375 px (Chrome headless piloté par le protocole DevTools, comme en FR23). Captures prises, non copiées dans `docs/`.

## 1. Partie 0 : le front actuel (`develop`) est-il sûr avec la rotation ?

**Non, pas entièrement.** Dans un seul onglet, il est sûr ; avec deux onglets qui renouvellent en même temps, il casse la session. C'est reproduit contre le Keycloak local avec rotation.

**Ce qui est sûr dans `develop`**
- `/login`, `/login-pin` : `storeSession` enregistre le nouveau `refresh_token` aussitôt.
- `/refresh` : un seul renouvellement à la fois par onglet (FR26) ; le nouveau couple est enregistré avant de rejouer la requête.
- Le jeton est relu dans le stockage au moment de renouveler, jamais gardé en mémoire : deux onglets qui renouvellent **l'un après l'autre** partent toujours du dernier jeton.
- Service worker : il ne met en cache que des `GET` (`/v1/tontines`, `/v1/notifications`), sans rejeu en arrière-plan ; il ne touche pas à `/refresh`.
- Requêtes rejouées : les nouvelles tentatives de React Query relisent le jeton courant ; Axios ne réessaie jamais `/refresh`.

**Reproduction (API, Keycloak local avec rotation, aucun jeton affiché)**

| Essai | Résultat |
|---|---|
| Trois renouvellements de suite, chacun avec le dernier jeton reçu | 200, 200, 200 |
| Rejeu de l'ancien jeton, 1,5 s plus tard | **401 `SESSION_EXPIRED`**, et Keycloak ferme la session : le dernier jeton est refusé aussi |
| Deux renouvellements simultanés avec le même jeton (deux onglets) | 200 et **401** ; puis le jeton du « gagnant » est refusé : **session fermée** |

Le rejeu dans la même seconde passe encore, car Keycloak date ses jetons à la seconde.

**Reproduction dans l'app : deux onglets rechargés au même instant, jeton d'accès expiré, 3 tours**

| Front | Tour 1 | Tour 2 | Tour 3 | Appel protégé ensuite |
|---|---|---|---|---|
| Sans verrou entre onglets (comportement de `develop`) | un seul refresh, 200 | refresh simultanés : l'onglet B reçoit 401, **les deux onglets partent sur `/login`** | `/login` | 401 |
| Branche FR31 | un seul refresh pour les deux onglets | un seul refresh | un seul refresh | **200** |

**Autre cas qui casse la session, même en FR31** : la réponse de `/refresh` perdue (réseau coupé au retour). Keycloak a fait tourner le jeton, mais le front garde l'ancien. Aucun front ne peut l'éviter complètement. Option : *Refresh Token Max Reuse* à 1, qui tolère une réutilisation au prix d'une protection un peu moindre.

## 2. Ce qui a été fait

### Partie 1 : appareilId
- `src/lib/appareil.ts` : UUID créé au premier appel (`crypto.randomUUID`, sinon `getRandomValues`, sinon `Math.random`). Format `[A-Za-z0-9._-]{8,100}`, gardé dans `localStorage` (`dinthialma_appareil_id`), repli en mémoire si le stockage est refusé. Jamais régénéré tant que le stockage existe ; hors de `clearAll()`.
- Envoyé dans `login`, `register/complete`, `pin/setup`, `login-pin`, `logout` (deux endroits : `useAuth.logoutComplet` et « Changer de compte » de l'écran PIN). `clientType` inchangé (`WEB` pour la PWA).

### Partie 2 : appareil de confiance
- `PinSetupPage` : PIN, confirmation, puis **troisième étape « mot de passe »** (« Confirmez votre mot de passe pour que ce téléphone se souvienne de vous »). Requête `pin/setup {pin, confirmPin, motDePasse, appareilId, clientType, deviceInfo}`.
- Mot de passe faux (`INVALID_CREDENTIALS`) : « Mot de passe incorrect. Votre code secret n'a pas encore été créé. », champ vidé, on reste sur l'étape.
- **Défaut trouvé et corrigé** : `pin/setup` avec mot de passe ouvre une nouvelle session hors ligne et **révoque celle du jeton reçu à la connexion**, sans renvoyer de jetons.
  - Vérifié sur l'API : après `pin/setup`, `/refresh` avec le jeton du login → 401.
  - Sans correction, l'utilisateur était déconnecté vers `/login` (numéro effacé) dans les 5 minutes suivant la création de son PIN, donc juste après l'inscription.
  - Correction : après la création, le front se reconnecte aussitôt avec ce PIN (`login-pin` et `appareilId`) et enregistre les nouveaux jetons. Si `pin/setup` renvoie un jour des jetons, ils sont pris directement.
  - **À demander au backend** : renvoyer les jetons de la nouvelle session dans la réponse de `pin/setup`.
- Connexion par mot de passe avec un PIN existant : rien à faire de plus. Vérifié : jeton `Offline` reçu.

### Partie 3 : connexion par PIN et erreurs
- `src/lib/securite.ts` : `actionPin` (code → action), `erreurOtp`, `compteARebours`, `secondesRestantes`, `finAttente`, `motDePasseRefuse`.

| Code | Comportement |
|---|---|
| `PIN_SESSION_EXPIRED` (aussi `SESSION_EXPIRED`, `NOT_FOUND`) | jetons effacés, **numéro et PIN gardés**, `/login` avec « Pour votre sécurité, reconnectez-vous une fois avec votre mot de passe. » |
| `PIN_LOCKED` | clavier bloqué, titre « Code verrouillé », « Trop d'essais. Réessayez dans 14:59 » mis à jour chaque seconde (`useCompteARebours`), « PIN oublié ? » toujours proposé |
| `PIN_DISABLED` | « Trop d'essais : votre code a été désactivé… », PIN marqué absent, `/login` avec le message ; après le mot de passe, création d'un nouveau PIN |
| `PIN_NOT_CONFIGURED` | `/login` (« Connectez-vous avec votre mot de passe pour créer votre code secret »), puis création du PIN (déjà géré par la connexion) |
| `PIN_EXPIRED` | inchangé : réinitialisation |
| `OTP_RATE_LIMITED` | inscription, mot de passe oublié, PIN oublié, changement de numéro : texte avec le délai, « Renvoyer le code dans 29:59 » inactif (`RenvoyerCode`). Mot de passe et PIN oubliés : seule la limite d'envoi est montrée (anti-énumération conservée, la limite vaut pour tout numéro) |
| `OTP_TOO_MANY_ATTEMPTS` | « Trop d'essais avec ce code. Demandez un nouveau code. » |

### Partie 4 : jetons et déconnexion (`src/services/api.ts`, `src/lib/verrouOnglets.ts`)
- **Un seul renouvellement à la fois entre les onglets** : verrou `navigator.locks`. Dans le verrou, le refresh token est relu ; si un autre onglet l'a renouvelé pendant l'attente, ses jetons sont repris, sans rien renvoyer. Sans `navigator.locks` (vieux navigateurs), la relecture juste avant l'envoi couvre les renouvellements qui ne se chevauchent pas.
- Le nouveau couple est toujours enregistré avant de rejouer la requête.
- **Réseau coupé pendant le renouvellement** (aucune réponse) : plus de déconnexion. Les jetons sont gardés et la requête échoue comme hors ligne. Avant, une coupure envoyait sur `/login` en effaçant tout.
- **Défaut trouvé et corrigé** : un 401 « métier » déclenchait un renouvellement, puis une déconnexion si celui-ci échouait. Cas concernés : `INVALID_CREDENTIALS` de `pin/setup`, `CURRENT_PASSWORD_INVALID`, `PIN_DISABLED`, `PIN_SESSION_EXPIRED`. Ces codes sont maintenant rejetés tels quels.
- **Déconnexion douce** inchangée (verrou FR26, pas de `/logout`).
- **Déconnexion complète** (« Se déconnecter de cet appareil », ex-« Oublier cet appareil ») : `POST /logout {refreshToken, clientType, appareilId}`, puis `clearAll()`, qui garde l'`appareilId`.

### Partie 5 : appareils connectés (Paramètres)
- `securiteService` : `confiance`, `derniereUtilisation`, `appareilId`.
- Feuille : « Cet appareil » repéré par `appareilId` (ou `courante`), badge « Appareil de confiance », « Utilisé le … ».
- Déconnecter un **autre** appareil : confirmation « … sera déconnecté et ne sera plus un appareil de confiance : le code secret n'y fonctionnera plus, il faudra se reconnecter avec le mot de passe. »

### Fichiers
`src/lib/appareil.ts`, `src/lib/securite.ts`, `src/lib/verrouOnglets.ts`, `src/lib/apiError.ts` (`PIN_DISABLED`, `OTP_TOO_MANY_ATTEMPTS`), `src/services/api.ts`, `src/services/securiteService.ts`, `src/hooks/useAuth.tsx`, `src/hooks/useCompteARebours.ts`, `src/types/user.ts`, `src/components/auth/RenvoyerCode.tsx`, `src/pages/auth/{LoginPage,PinLoginPage,PinSetupPage,RegisterPage,ForgotPasswordPage,PinResetPage}.tsx`, `src/pages/parametres/ParametresPage.tsx`.

### Tests (57 nouveaux, aucun test `[caractérisation]` modifié)
- Logique pure : `src/lib/appareil.fr31.test.ts` (9), `src/lib/securite.fr31.test.ts` (19), `src/lib/verrouOnglets.fr31.test.ts` (2).
- `src/services/api.fr31.test.ts` (6) :
  - nouveau jeton enregistré avant le rejeu ;
  - autre onglet qui a renouvelé pendant l'attente du verrou (aucun refresh) ;
  - deux renouvellements à la suite, partis du dernier jeton ;
  - réseau coupé sans déconnexion ;
  - 401 métier sans renouvellement ;
  - une seule redirection.
- `PinLoginPage.fr31` (6), `PinSetupPage.fr31` (5, dont la reconnexion par PIN après la création), `LoginPage.fr31` (2), `ForgotPasswordPage.fr31` (3), `ParametresPage.fr31` (2, dont la liste relue après une révocation).

## 3. Parcours vérifié dans l'app (375 px)

PIN du compte de test local changé en `482913` (accord du 24/11).

| Étape | Résultat |
|---|---|
| Connexion par mot de passe (compte avec PIN) | ✅ `appareilId` envoyé, jeton `Offline` : appareil de confiance |
| Création du PIN avec mot de passe (Paramètres → « Modifier mon code secret ») | ✅ trois étapes, « Code secret créé : ce téléphone se souviendra de vous. » ; reconnexion par PIN ajoutée ensuite (voir 2) |
| Déconnexion douce, puis **PIN seul** | ✅ `/pin`, PIN → `/accueil`, nouveau jeton `Offline`, verrou levé |
| Utilisateur d'avant B53 (appareil sans session côté serveur, simulé par un nouvel `appareilId`) | ✅ PIN → `PIN_SESSION_EXPIRED` → `/login` avec le message, numéro gardé → mot de passe → jeton `Offline` → ensuite le PIN seul suffit |
| Deux onglets | ✅ un seul renouvellement par tour, session gardée (section 1) |
| Déconnexion à distance | ✅ un second appareil (API) devient de confiance, son PIN marche ; dans l'app, « Appareils connectés » (badges, « Cet appareil ») → « Déconnecter » → confirmation → `DELETE` 200, liste relue ; son PIN répond ensuite **`PIN_SESSION_EXPIRED`** |
| 5 PIN faux | ✅ « Code verrouillé », « Trop d'essais. Réessayez dans 14:58 », clavier bloqué, « PIN oublié ? » proposé (compte de test verrouillé 15 min) |
| Inscription puis PIN avec mot de passe | ⚠️ non faite : il faut un vrai code SMS. L'étape « PIN avec mot de passe » est la même écran que ci-dessus ; l'envoi de l'`appareilId` à `register/complete` est dans le code, sans test d'écran dédié |
| PIN seul après suppression de la session SSO dans la console Keycloak | ⚠️ non faite : la lecture de l'API d'administration Keycloak m'a été refusée. Couvert par l'IT backend `SessionAppareilIT` n° 1. À faire de votre côté : *Sessions* du realm → supprimer la session normale de l'utilisateur → le PIN doit marcher |

**Incidents pendant le parcours**
- Un de mes scripts a **affiché dans la sortie deux refresh tokens** de l'appareil de test « B » (Keycloak local, compte de test). Cet appareil a été révoqué aussitôt après : ces jetons ne servent plus.
- Des essais de révocation ont d'abord semblé bloquer (bouton « … », pas de toast). Cause : le navigateur avait perdu sa session au test des deux onglets « sans verrou ». Une connexion neuve donne un parcours normal (trace réseau : `DELETE` 200 en 88 ms, liste relue).

## 4. iOS : PWA de l'écran d'accueil

Sur iPhone, la PWA ajoutée à l'écran d'accueil a **un stockage séparé de Safari** : nouvel `appareilId`, aucun jeton.
- **Ce que l'utilisateur voit** :
  1. Il installe l'app depuis Safari, où il était connecté. Au premier lancement, l'app ne connaît ni son numéro ni sa session : écran de connexion complet, numéro puis mot de passe, **une fois**.
  2. S'il a déjà un PIN, cette connexion rend la PWA appareil de confiance : ensuite le PIN suffit, pendant des mois.
  3. Sans PIN, l'app propose de le créer, avec le mot de passe.
- **Dans « Appareils connectés »**, Safari et la PWA apparaissent comme **deux appareils** (même modèle « Safari – iOS 17 – iPhone »). Il peut déconnecter celui qu'il n'utilise plus.
- **Navigation privée, ou données du site effacées** (y compris le nettoyage automatique de Safari après plusieurs semaines sans ouvrir la PWA) : nouvel identifiant, mot de passe une fois.
- `navigator.locks` existe depuis iOS 15.4. Avant cette version, le renouvellement repose sur la relecture du stockage ; une PWA iOS ouvre de toute façon un seul onglet.

## 5. Partie 6 : « Impossible de charger les membres » (FR29)

**Pas de lien établi avec le renouvellement des jetons.**
- Une requête partie avec un jeton d'accès expiré reçoit un 401 et attend le renouvellement en cours (ou en lance un) ; elle est ensuite rejouée avec le nouveau jeton. React Query fait en plus un nouvel essai (`retry: 1`). Couvert par les tests FR26 et FR31.
- Le jour de FR29, la rotation n'était pas active localement : le scénario des deux onglets ne pouvait pas se produire.
- **Explication la plus probable** : le backend local a été arrêté et relancé plusieurs fois ce jour-là. L'erreur demande deux échecs consécutifs (requête, puis le nouvel essai de React Query), ce qui colle à une indisponibilité passagère, pas à un jeton.
- **Mécanisme voisin, observé en FR31** : quand Keycloak ferme la session (rejeu), les requêtes en cours finissent sur `/login` et une action en cours peut sembler bloquée. Avec FR31, ce cas ne se produit plus entre onglets.

**Point annexe** : les mutations ont aussi `retry: 1`. Un `POST` qui échoue sur le réseau est renvoyé une fois, ce qui peut doubler un encaissement si la première requête était arrivée. Hors périmètre ; à trancher (`retry: 0` pour les mutations).

## 6. Ce qui reste, et contrôles

**Reste**
- Backend : renvoyer les jetons dans la réponse de `pin/setup` (le front s'en sert déjà s'ils sont présents).
- À décider : quand le renouvellement échoue sur un appareil de confiance, aller sur l'écran PIN plutôt que sur `/login`.
  - Pourquoi : `login-pin` rejoue la session gardée par le serveur, indépendante du jeton du front. Le PIN suffirait donc, comme sur Wave.
  - Aujourd'hui : `clearAll()` efface le numéro et impose le mot de passe.
  - Coût : modifier les tests de la spec 01 qui figent ce comportement (`api.test.ts`), donc votre accord.
- Les deux vérifications de la section 3 non faites (inscription, suppression de la session SSO).

**Contrôles**

| Contrôle | Résultat |
|---|---|
| `npm run lint` | ✅ 0 avertissement |
| `npm run typecheck` | ✅ |
| `npm test` | ✅ 610 / 610 (59 fichiers, dont 57 nouveaux tests) |
| `npm run test:coverage` | ✅ 610 / 610. Seuil bloquant `src/lib/**` lignes ≥ 90 % : **98,78 %** (instructions 97,61 %, branches 93,77 %, fonctions 99,24 %). Global : lignes 55,98 % (50,31 % après FR29) |
| `npm run build` | ✅ |
| App réelle à 375 px | ✅ sauf les deux points marqués ⚠️ (section 3) |

## 7. Messages de commit proposés

Ordre : chaque commit compile seul.

**1. Rotation des jetons et identifiant d'appareil**
```bash
git add src/lib/appareil.ts src/lib/appareil.fr31.test.ts src/lib/verrouOnglets.ts src/lib/verrouOnglets.fr31.test.ts \
  src/services/api.ts src/services/api.fr31.test.ts src/types/user.ts
git commit -m "fix(session): un seul renouvellement entre onglets et identifiant d'appareil (FR31)" -m "Rotation Keycloak : deux onglets qui renouvelaient en même temps rejouaient le même refresh token et fermaient la session. Verrou navigator.locks, jeton relu dans le verrou, jetons d'un autre onglet repris ; réseau coupé pendant le renouvellement sans déconnexion ; 401 métier (INVALID_CREDENTIALS, PIN_DISABLED…) sans renouvellement. appareilId stable (B53), gardé après la déconnexion." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**2. Appareil de confiance, PIN et codes de sécurité**
```bash
git add src/lib/securite.ts src/lib/securite.fr31.test.ts src/lib/apiError.ts src/hooks/useAuth.tsx src/hooks/useCompteARebours.ts \
  src/components/auth/RenvoyerCode.tsx \
  src/pages/auth/LoginPage.tsx src/pages/auth/LoginPage.fr31.test.tsx \
  src/pages/auth/PinLoginPage.tsx src/pages/auth/PinLoginPage.fr31.test.tsx \
  src/pages/auth/PinSetupPage.tsx src/pages/auth/PinSetupPage.fr31.test.tsx \
  src/pages/auth/RegisterPage.tsx src/pages/auth/ForgotPasswordPage.tsx src/pages/auth/ForgotPasswordPage.fr31.test.tsx \
  src/pages/auth/PinResetPage.tsx
git commit -m "feat(auth): appareil de confiance, PIN avec mot de passe et codes SE07 (FR31)" -m "appareilId envoyé à login, register/complete, pin/setup, login-pin et logout. Création du PIN avec le mot de passe, puis reconnexion par le PIN (pin/setup révoque la session du login sans renvoyer de jetons). PIN_SESSION_EXPIRED : mot de passe une fois, numéro gardé ; PIN_LOCKED : compte à rebours ; PIN_DISABLED : nouveau PIN ; OTP_RATE_LIMITED et OTP_TOO_MANY_ATTEMPTS : renvoi du code avec délai." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**3. Appareils connectés**
```bash
git add src/services/securiteService.ts src/pages/parametres/ParametresPage.tsx src/pages/parametres/ParametresPage.fr31.test.tsx
git commit -m "feat(parametres): appareils de confiance et déconnexion à distance (FR31)" -m "Badge Appareil de confiance, dernière utilisation, Cet appareil repéré par appareilId ; déconnecter un autre appareil demande une confirmation qui explique la coupure du code secret. Se déconnecter de cet appareil : logout avec appareilId. Changement de numéro : codes SE07." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**4. Livrable**
```bash
git add docs/fr31-session-appareil.md
git commit -m "docs(fr31): session longue par appareil, rotation des jetons et codes de sécurité" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
