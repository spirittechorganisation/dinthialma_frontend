# FR23 — Parcours « épargne journalière » du gestionnaire

> Branche `fix/fr23-epargne-journaliere` (depuis `develop` à jour, 22/11/2026). Backend `develop` local (B43 à B48, WhatsApp en mock).
> Parcours fait le 22/11/2026 en vue mobile 375 px (Chrome headless piloté par le protocole DevTools, sans nouvelle dépendance).
> Captures : [`docs/fr23-captures/`](fr23-captures/). Compte gestionnaire de test, membres fictifs `77 000 91 01` à `03`.

## 1. Partie 1 : le parcours avant correction

| # | Étape | Résultat | Constat |
|---|---|---|---|
| 1 | Créer l'épargne (événementielle, chaque jour, montant libre min. 2.000F, sans commission, fin 31/12) | ⚠️ | Création possible, mais : pas d'objectif « Épargne » (il faut passer par « Autre chose » → « Pour un événement ») ; les repères « 1 j · 1 sem · 1 mois » du curseur ne sont pas cliquables (seuls le curseur et les boutons −/+ marchent) ; récapitulatif **trompeur** : « La cagnotte est partagée entre tous à la fin » alors que chacun récupère sa mise ; double point « jusqu'au 31 déc.. » ; rappels réglables seulement après création (Réglages → « Aucun rappel » : ✅). [01d](fr23-captures/01d-etape2-journalier.png) [01e](fr23-captures/01e-recapitulatif.png) [01h](fr23-captures/01h-reglages.png) |
| 2 | Activer | ⚠️ | « Tontine lancée », mais la fiche reste sur « Aucun tour en cours » et « Encaisser » inactif **jusqu'au rechargement** (tours non rafraîchis). Fiche : « Montant libre » sans minimum ni rythme. [02b](fr23-captures/02b-lancee.png) [01g](fr23-captures/01g-fiche-brouillon.png) |
| 3 | Ajouter 3 membres par numéro | ✅ | 6 gestes par membre (Membre, numéro, Rechercher, prénom, nom, Ajouter). Champ « Position jackpot » inutile en événementielle ; le toast parle de SMS alors que l'invitation part par WhatsApp. [03b](fr23-captures/03b-numero-inconnu.png) |
| 4 | Report du cahier : 44.000F espèces + note | ⚠️ | Montant libre bien saisissable au-delà du minimum ✅, note saisissable (repliée sous « Référence et note ») et **enregistrée** par le backend ✅, mais **visible nulle part** (ni reçu, ni historique). [04c](fr23-captures/04c-montant-note.png) [04d](fr23-captures/04d-recu.png) |
| 5 | Saisir 40.000F et 2.000F | ✅ | Le minimum n'est affiché nulle part ; sous le minimum : « Montant inférieur au minimum. » sans le montant. [05a](fr23-captures/05a-sous-minimum.png) |
| 6 | Clôturer le jour 1, jour 2 non payable | ⚠️/❌ | Clôture ✅ mais textes **dangereux** : « Le jackpot sera calculé » puis « **Net à remettre : 86.000F** » (le gestionnaire croit devoir rendre l'argent chaque soir). Jour 2 : le backend refuse bien (`ECHEANCE_NON_OUVERTE`, `TOUR_NON_COMMENCE`) mais le front **propose « Encaisser » et « Clôturer »** ; erreurs génériques ou texte brut du serveur (« sous-cycle »). [06d](fr23-captures/06d-periode1-cloturee.png) [06f](fr23-captures/06f-encaisser-jour2.png) [06g](fr23-captures/06g-cloture-jour2-refusee.png) |
| 7 | Clôturer le dernier jour trop tôt | ⚠️ | Testé sur une 2ᵉ tontine (hebdomadaire 22/11 → 27/11, une seule période) : `CLOTURE_FINALE_PREMATUREE` affiché en toast brut, **aucun accès** à « Clôturer la tontine ». [07a](fr23-captures/07a-cloture-finale-prematuree.png) |
| 8 | Membre SORTI, saisie, récaps | ❌ | **Aucune action « Sorti » dans l'app** (Suspendre / Réactiver / Retirer ; « Retirer » = `DELETE`, membre exclu des récaps même avec `inclureSortis`) : SORTI posé par l'API. `MEMBRE_INACTIF` renvoyé ✅ (l'app ne propose de toute façon pas d'encaisser un inactif). Récaps : le front n'envoyait pas `inclureSortis` → période 1 « Ont payé 84.000F » pour une cagnotte de 86.000F, Coumba absente. Un SORTI ne pouvait pas être réactivé depuis sa fiche (le backend l'accepte). [08a](fr23-captures/08a-periode1-apres-sorti.png) |
| 9 | Clôturer la tontine (`forcer`) et lire la distribution | ❌ | Clôture ✅ (« Points en suspens · 39 tours non remis », vocabulaire de rotative), puis retour à l'accueil et **distribution par membre introuvable** : le backend ne la renvoie que dans la réponse de `PUT …/cycles/{id}/cloturer`, jamais en lecture, et `PUT …/tontines/{id}/cloturer` renvoie la tontine. [09b](fr23-captures/09b-points-en-suspens.png) [09d](fr23-captures/09d-distribution-finale.png) |
| 10 | 20 membres sur un jour | ⚠️ | Par membre : toucher le membre (1) + montant (2 à 3 touches) + « Encaisser » (1) + « Terminé » qui **renvoie à l'accueil** (1) + « Encaisser » (1, +1 si plusieurs tontines) ≈ **6 à 7 gestes et 4 écrans**, +2 avec une note. **20 membres ≈ 130 gestes et 80 changements d'écran**, plus la clôture du soir (3 gestes). Pénible : retour à l'accueil après chaque reçu, montant jamais prérempli (la plupart paient le minimum), pas de saisie groupée (B49). |

Autres constats : session perdue une fois après ~5 min (retour à `/login` au rechargement, non reproduit, à surveiller) ; « Tous les périodes » ; libellé « Tour 1 » dans le reçu et Encaisser d'une épargne ; pastille « Jackpot prêt » sur une période d'épargne.

## 2. Corrections faites (partie 2)

Logique pure dans **`src/lib/periodes.ts`** (heure de Dakar, mêmes règles que le backend) : `aujourdhuiDakar`, `dateDebutPassee`, `periodePayable` (B47), `blocageCloture` (B45), `erreurTontine` (textes des 5 codes, lus dans `code` ; code absent → message du serveur, puis texte de repli). Codes ajoutés au type `ApiErrorCode`.

| Code / besoin | Correction | Fichiers |
|---|---|---|
| `DATE_DEBUT_PASSEE` | Création : retour à l'étape de date, message sur le champ + « Commencer aujourd'hui ». Modification : message sur le champ. Lancement : la confirmation explique et propose « Modifier la date » (ouvre `/modifier?champ=dateDebut`). | `CreerTontinePage`, `ModifierTontinePage`, `FicheTontinePage` |
| `TOUR_NON_COMMENCE` | « Clôturer la période » désactivé avant `dateDebut` avec « Cette période commence le JJ/MM… » (sauf rotative `tousPayes`) ; refus serveur traduit avec la date. | `TourPage` |
| `CLOTURE_FINALE_PREMATUREE` | Dernière période avant `dateFin` : bouton désactivé + explication + « Clôturer la tontine » ; refus serveur → fenêtre « Pas encore la fin » avec le même bouton. Réglages : `?action=cloturer` ouvre la confirmation ; après clôture d'une événementielle, retour à la fiche. | `TourPage`, `ReglagesTontinePage` |
| `MEMBRE_INACTIF` | Gestionnaire : message + « Réactiver le membre » ; fiche d'un SORTI : « Réactiver » proposé. Membre : écran « Participation suspendue / terminée », et message dédié en cas de refus. | `EncaisserPage`, `EncaisserDesktop`, `MembreFichePage`, `PayerPage` |
| `ECHEANCE_NON_OUVERTE` | Jour pas commencé : plus d'« Encaisser » dans la période, écran « Période pas encore ouverte · commence le JJ/MM » dans Encaisser et Payer ; refus serveur avec la date. | `TourPage`, `EncaisserPage`, `PayerPage` |
| Date par défaut périmée | « Aujourd'hui » (Dakar) recalculé à l'ouverture de l'étape et juste avant l'envoi tant que la date n'a pas été choisie ; date choisie passée signalée avant l'envoi ; `min` sur les champs. | `CreerTontinePage`, `ModifierTontinePage` |
| Montant libre | `libelleMontant()` : « Montant libre, minimum 2.000F / jour » (format Wave de l'app, comme « Montant libre · minimum 2.000F » de Payer). Le backend recopie le minimum dans `montant` : il n'est plus affiché seul (cause de « 2.000F / jour »). | `tontineLabels`, Fiche, Réglages (règles + texte de partage), Mes tontines, Accueil |
| Récaps `inclureSortis` | Envoyé par `useRecapCycle` et `useRecapTotal` ; membres sortis grisés avec badge « Sorti » ; collecté = distribution, « x/y payés » sur les actifs. Fiche d'une événementielle terminée : **Répartition finale** par membre (repli sur `recap-total`, sans commission). | `cotisationService`, `useCotisations`, `TourPage`, `FicheTontinePage` |
| Note et minimum à la saisie | Note visible sur le reçu (ligne « Note »), l'historique de la fiche (mobile et tableau) et la fiche membre ; minimum affiché sous le montant et vérifié avant l'envoi. | `RecuPage`, `FicheTontinePage`, `MembreFichePage`, `EncaisserPage`, `EncaisserDesktop` |
| Blocages simples de la partie 1 | Fiche à jour après le lancement (invalidation des tours et du résumé) ; textes de clôture d'une période intermédiaire (« l'argent reste dans l'épargne », « Période clôturée · 86.000F gardés jusqu'à la fin ») ; phrase du récapitulatif dynamique (« À la fin, chacun récupère ce qu'il a cotisé pour la cérémonie / pour la fête… ») ; « Toutes les périodes ». | `useTontines`, `TourPage`, `CreerTontinePage`, `ToursPage` |

Vérifié dans l'app réelle après correction : [répartition finale](fr23-captures/apres-01-fiche-repartition.png), [période avec membre sorti](fr23-captures/apres-02-periode1-sorti.png), [dernière période](fr23-captures/apres-03-derniere-periode.png), [note sur le reçu](fr23-captures/apres-04-recu-note.png), [minimum](fr23-captures/apres-05-encaisser-minimum.png), [récapitulatif](fr23-captures/apres-06-recap.png), [date passée](fr23-captures/apres-07-date-passee.png).

**Tests ajoutés (62)** — Vitest + Testing Library + MSW, nommés `*.fr23.test.tsx` pour ne pas croiser les fichiers de caractérisation à venir de la spec 01 (lots F à H) :
`lib/periodes.test.ts` (24), `lib/tontineLabels.test.ts` (+3), `lib/format.test.ts` (+2), `TourPage.fr23` (7), `EncaisserPage.fr23` (5), `CreerTontinePage.fr23` (5), `FicheTontinePage.fr23` (5), `PayerPage.fr23` (4), `ModifierTontinePage.fr23` (3), `ReglagesTontinePage.fr23` (2), `RecuPage.fr23` (1), `MembreFichePage.fr23` (1).

**Tests `[caractérisation]`** : deux assertions de `CreerTontinePage.test.tsx` mises à jour **avec l'accord du responsable produit (22/11/2026)**, chacune commentée dans le test :
- ligne 361 : la phrase du récapitulatif d'une événementielle (« À la fin, chacun récupère ce qu'il a cotisé pour la cérémonie. » au lieu de « La cagnotte est partagée entre tous à la fin. ») ;
- ligne 269 : l'aperçu du calendrier sans double point (« dim. 20 déc. » au lieu de « dim. 20 déc.. »), correction R7 dans `CalendrierApercu`.

Aucun autre test de caractérisation n'a été touché.

## 3. Ce qui reste (proposé, non fait)

| # | Proposition | Côté | Effort |
|---|---|---|---|
| R1 | **Distribution finale en lecture** : renvoyer `distributionParMembre` dans `GET …/cycles/{id}` (dernière période) ou un `GET …/tontines/{id}/distribution`, et dans la réponse de `PUT …/tontines/{id}/cloturer`. Le front affiche aujourd'hui `recap-total`, juste sans commission seulement. | Backend | 0,5 j |
| R2 | **Saisie en série** : après « Encaisser », revenir à la liste « De qui ? » avec un toast « Reçu » (au lieu de l'accueil) ; préremplir le minimum ; puis B49 (saisie groupée : une ligne par membre, un envoi). Divise par deux les gestes, puis par cinq avec B49. | Front puis backend | 2 h, puis B49 |
| R3 | Action « Marquer sorti » (avec motif) distincte de « Retirer » (`DELETE`, qui fait disparaître le membre des récaps) ; texte d'avertissement. | Front | 2 h |
| R4 | Vocabulaire épargne : « Jour » / « Période » au lieu de « Tour » (reçu, Encaisser, fiche), pas de « Jackpot prêt » ni de « tours non remis » dans « Points en suspens », pas de « Position jackpot » à l'ajout d'un membre. | Front | 0,5 j |
| R5 | Objectif « Épargne » à la création (événementielle, montant libre, chaque jour) ; repères du curseur de rythme cliquables ; rappels réglables à la création. | Front | 0,5 j |
| R6 | Note dans le flux d'activité (`ActiviteItem.note`) pour la voir dans l'Historique. | Backend + front | 2 h |
| R8 | Reprise du cahier propre (B41, soldes d'ouverture) et retraits anticipés (B42), à la place du report en un seul paiement et des retraits notés dans le cahier. | Backend + front | B41/B42 |
| R9 | Session perdue au rechargement après ~5 min (vu une fois) : vérifier le renouvellement du jeton au démarrage (lien possible avec le point B3 de la spec 01). | Front | à investiguer |

## 4. Guide du gestionnaire (épargne journalière)

1. **Créer** : Créer → « Autre chose » → « Pour un événement », cochez « Montant libre », minimum 2 000, rythme « Chaque jour », fin le 31/12, aucune commission.
2. **Ajouter** chaque membre par son numéro (prénom et nom s'il n'a pas l'application), puis **Lancer la tontine**.
3. **Reporter le cahier** le premier jour : Encaisser → le membre → total du cahier + jour même (ex. 44 000) → Espèces → note « Report du cahier du 01/11 au 21/11 ».
4. **Chaque jour**, Encaisser → chaque membre qui a payé → montant → Espèces. Le reçu s'affiche, vérifiez-le.
5. **Chaque soir** (ou le lendemain matin), ouvrez la période du jour et **Clôturez-la** : l'argent reste dans l'épargne. Le jour suivant s'encaisse à partir de son jour.
6. Ne passez **jamais** un membre en « Sorti » ou « Retiré » sans raison : ses paiements restent à lui, mais il ne peut plus cotiser.
7. **Retraits** demandés avant la fin : notez-les dans le cahier pour l'instant (pas encore dans l'application).
8. **Fin de l'épargne** : le 31/12, clôturez la dernière période. Pour arrêter avant, Réglages → « Clôturer la tontine ».
9. La fiche montre alors la **répartition finale** : ce que chacun a cotisé, à lui remettre.

## 5. Contrôles et commits proposés

| Commande | Résultat |
|---|---|
| `npm run lint` | ✅ 0 erreur, 0 avertissement |
| `npm run typecheck` | ✅ |
| `npm test` | ✅ 449 / 449 (31 fichiers) |
| `npm run build` | ✅ |
| `npm run test:coverage` | ✅ seuil bloquant `src/lib/**` lignes ≥ 90 % : **98,67 %** (`periodes.ts` 96,77 %, `tontineLabels.ts` 100 %, `format.ts` 100 %). Global (sans seuil) : lignes 43,78 %, instructions 41,38 %, branches 37,33 %, fonctions 32,97 % |

`api-docs.json` et `docs/BESOINS_BACKEND.md` portent des modifications antérieures à cette branche (contrat B41 à B48) : à commiter à part.

```text
fix(epargne): codes d'erreur des garde-fous de date et parcours épargne journalière (FR23)

- lib/periodes : date du jour à Dakar, période payable (B47), blocage de clôture (B45),
  textes de DATE_DEBUT_PASSEE, TOUR_NON_COMMENCE, CLOTURE_FINALE_PREMATUREE,
  MEMBRE_INACTIF et ECHEANCE_NON_OUVERTE lus dans `code`
- Tour : Encaisser et Clôturer selon la date, accès à « Clôturer la tontine »,
  textes de clôture d'une période d'épargne
- Encaisser / Payer : période pas encore ouverte, minimum affiché et vérifié,
  réactiver un membre inactif
- Création / modification / lancement : date de début recalculée, date passée signalée
- Récaps avec inclureSortis (B48), répartition finale sur la fiche, note visible,
  libellé « Montant libre, minimum 2.000F / jour », fiche à jour après le lancement
- Tests *.fr23.test.tsx et lib (62)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

```text
test(création): récapitulatif d'une événementielle et aperçu du calendrier (FR23, décision du 22/11/2026)

Caractérisation de CreerTontinePage mise à jour avec l'accord du responsable produit :
phrase « chacun récupère ce qu'il a cotisé » (ligne 361) et date sans double point (ligne 269, R7).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

```text
docs(fr23): parcours épargne journalière, corrections et guide du gestionnaire

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

## FR24 à FR26 : avant le démarrage du gestionnaire (24-25/11)

Branche `fix/fr24-26-saisie-serie`, depuis `develop` (FR23 fusionné, `be143e7`). Vérifié dans l'app à 375 px (Chrome headless, même méthode que FR23) contre le backend local. **Attention** : le dépôt backend local était sur `feature/b51-b42-retraits`, pas sur `develop`. Captures : `docs/fr24-26-captures/`.

### FR24 : saisie en série dans Encaisser

**Ce qui change**
- Après un encaissement réussi, on **reste sur « De qui ? »** de la même tontine et de la même période (et du même retard, `?tour=` / `?echeance=`), avec le toast « Reçu enregistré », le nom et le montant, et un bouton « Voir » qui ouvre le reçu. Plus de passage par le reçu ni de retour à l'accueil. Même chose sur desktop : le panneau se referme et la recherche reprend le focus.
- Le membre encaissé passe **tout de suite** dans « Déjà payé », sans attendre le récapitulatif relu : on ne peut pas l'encaisser deux fois par erreur.
- Liste : pas encore payés en haut ; payés en bas, **grisés, avec leur montant** ; compteur « 8 / 20 payés aujourd’hui » (épargne journalière), « 8 / 20 payés » sinon.
- **Montant prérempli** : le minimum en montant libre (pavé ouvert, la première touche remplace le minimum : 5 puis 000 donne 5.000F) ; le montant fixe sinon (« Modifier le montant », puis la première touche le remplace).
- **Moyen** : le dernier utilisé pour encaisser sur l'appareil (`dinthialma_derniere_methode_encaissement`, distinct de celui du membre) ; Espèces par défaut, et si le moyen mémorisé n'est pas ouvert.
- Pas de clavier qui s'ouvre à chaque retour sur la liste (recherche sans focus automatique après le premier encaissement).

**Gestes pour 20 membres** (épargne journalière, une seule tontine en cours)

| | Par membre | 20 membres |
|---|---|---|
| Avant (FR23) | membre (1) + montant (2 à 3) + Encaisser (1) + Terminé, retour à l'accueil (1) + Encaisser (1) ≈ 6 à 7 | ≈ 130 gestes, 80 écrans |
| Après, au minimum | membre (1) + « Encaisser 2.000F » (1) = **2** | 40 gestes, 40 écrans |
| Après, autre montant (5.000F) | membre (1) + 5 (1) + 000 (1) + Encaisser (1) = **4** | — |
| Après, mélange réaliste (15 au minimum, 5 autres montants) | ≈ **2,5** | ≈ 50 gestes |

Objectif « environ 3 gestes par membre » atteint. Une note ajoute toujours 2 gestes (« Référence et note », saisie). B49 (saisie groupée) reste la suite logique.

Vérifié dans l'app ([fr24-01](fr24-26-captures/fr24-01-de-qui.png), [fr24-02](fr24-26-captures/fr24-02-combien.png), [fr24-03](fr24-26-captures/fr24-03-toast-liste.png)) : « Tontine Tabaski », Babacar Ba, montant prérempli 1.000F (minimum), 2 gestes, toast « Reçu enregistré · Babacar Ba · 1.000F · Voir », retour sur la liste, compteur 2 / 2.

**Fichiers** : `src/lib/encaissement.ts` (nouveau : `montantPrerempli`, `avecEncaissementsRecents`, `textePayes`, `aPaye`), `src/components/pay/AmountPad.tsx` (prop facultative `remplacer`, sans effet sur PayerPage), `src/pages/gestion/EncaisserPage.tsx`, `src/pages/gestion/EncaisserDesktop.tsx`.
**Tests** : `src/lib/encaissement.fr24.test.ts` (14), `src/pages/gestion/EncaisserPage.fr24.test.tsx` (6). Deux assertions du test FR23 `EncaisserPage.fr23.test.tsx` adaptées (retour à la liste au lieu du reçu ; ce n'est pas un test de caractérisation).

### FR25 : termes trompeurs dans une épargne

| Terme | Avant | Après (événementielle) | Où |
|---|---|---|---|
| « Tour N » | Tour 3 | « Jour du 23/11 » (rythme d'un jour), sinon « Période 3 » | Reçu, Encaisser (liste, formulaire, choix de la tontine), fiche (montant collecté, ligne d'état, rubrique, historique, tableau desktop) |
| « Jackpot prêt » | pastille quand tout le monde a payé | absente | Liste des périodes |
| Points en suspens | « 2 tours non remis », « tour sans gagnant », « Les tours déjà commencés peuvent encore être remis » | « 2 périodes à venir seront annulées, la répartition se fera sur ce qui a été encaissé » ; pas de ligne « sans gagnant » | Clôture de la tontine (Réglages) |
| « Position jackpot » | champ à l'ajout d'un membre | masqué | Ajout d'un membre |
| SMS | « Un SMS d'invitation a été envoyé » | « Invitation envoyée par WhatsApp » | Ajout d'un membre (toast et encadré « numéro inconnu ») |
| « ce tour » | « Tout le monde a payé ce tour ✓ » | « … cette période ✓ » | Encaisser (vu pendant la vérification, même famille de termes) |

Rotatives inchangées, **sauf SMS → WhatsApp** : le backend envoie l'invitation par WhatsApp pour tous les types (`MembreServiceImpl.createPreEnrolledUser` → `whatsappService.sendTontineInvite`). Laisser « SMS » aux rotatives serait faux. À annuler si vous préférez s'en tenir à la consigne.

Le choix de la tontine dans Encaisser ne connaît pas le rythme (tableau de bord gestionnaire) : il affiche « Période N » pour une épargne.

**Fichiers** : `src/lib/periodes.ts` (`nomPeriode`, `estJournaliere`), `src/pages/pay/RecuPage.tsx`, `src/pages/tontine/FicheTontinePage.tsx`, `src/pages/tontine/ToursPage.tsx`, `src/pages/tontine/ReglagesTontinePage.tsx`, `src/components/shared/AddMembreModal.tsx`, `src/pages/gestion/EncaisserPage.tsx` / `EncaisserDesktop.tsx`.
**Tests** : `src/lib/periodes.fr25.test.ts` (9), `RecuPage.fr25`, `EncaisserPage.fr25`, `FicheTontinePage.fr25`, `ToursPage.fr25`, `ReglagesTontinePage.fr25`, `AddMembreModal.fr25` (11 au total). Assertion « Collecté · Tour 1 » du test FR23 de la fiche devenue « Collecté · Jour du 01/11 ». Les tests `[caractérisation]` du reçu (rotative, « Famille · Tour 6 ») passent sans modification.

Vérifié dans l'app ([fr25-01](fr24-26-captures/fr25-01-recu.png)) : reçu « Tontine Tabaski · Période 3 » ; liste Encaisser « Période 3 » et « Tout le monde a payé cette période ✓ ».

### FR26 : session perdue au rechargement

**Mesures (Keycloak local, realm `dinthialma`)**
- Jeton d'accès : **300 s** (`exp − iat` lu dans le jeton).
- Refresh token : **1 800 s** (30 min sans activité : « SSO Session Idle »). Le realm de test du backend indique aussi `ssoSessionMaxLifespan` = 36 000 s (10 h).

**Cause trouvée (front)** : au chargement d'une page protégée, `ProtectedRoute` envoyait sur `/login` dès que le jeton d'accès était expiré, **sans essayer le refresh token**, pourtant valable 30 minutes. D'où le retour à `/login` au rechargement « après environ 5 minutes ». Même effet en ouvrant une autre page après 5 minutes sans appel au serveur (aucun 401 n'avait déclenché le renouvellement de l'intercepteur).

| Cas | Avant | Après |
|---|---|---|
| Rechargement, jeton d'accès expiré, refresh token valable | `/login` | session renouvelée, page affichée |
| Reprise après mise en veille (< 30 min) | `/login` à la page suivante | renouvellement au premier appel ou à la page suivante |
| Hors ligne puis en ligne | erreur réseau sans déconnexion (pas de 401) | inchangé ; renouvellement au premier 401 après le retour en ligne |
| Inactif plus de 30 min (refresh token expiré) | `/login` | `/login`, une seule fois, page demandée mémorisée |
| Après une déconnexion douce (écran PIN) | `/login` | `/login` : pas de renouvellement silencieux (voir le verrou ci-dessous) |

**Lien avec B3 (spec 01)** : B3 n'est pas la cause (il ne bloquait que les 401 arrivant avant le rechargement de `/login`), mais il est corrigé au passage. Le renouvellement est désormais **une seule promesse partagée** par l'intercepteur, le démarrage (`ProtectedRoute`) et `useAuth.refreshSession` (création d'une tontine, B12) : un seul appel `/v1/auth/refresh` à la fois, aucun état bloqué sans refresh token, une seule redirection vers `/login`.

**Verrou de la déconnexion douce** : `logout()` garde le refresh token pour l'écran PIN. Sans précaution, le renouvellement au démarrage aurait rouvert la session sans le PIN en ouvrant une URL protégée. `logout()` pose donc `dinthialma_session_verrouillee` ; une connexion (mot de passe, PIN, inscription) le lève via `storeSession`, et `clearAll` l'efface.

Vérifié dans l'app ([fr26-01](fr24-26-captures/fr26-01-rechargement.png)) : jeton d'accès forcé à « expiré », rechargement de `/encaisser/…` : la page reste affichée, nouveau jeton (expire dans 296 s), aucun passage par `/login`.

**Réglage Keycloak, non modifié (lié à SE15)** : un gestionnaire qui laisse son téléphone plus de 30 minutes entre deux paiements devra se reconnecter avec son mot de passe : le PIN ne suffit pas, car `login-pin` rejoue le refresh token enregistré côté serveur, expiré lui aussi. Si ce n'est pas voulu :
- où : console Keycloak → realm `dinthialma` → *Realm settings* → onglet *Sessions* ;
- quoi : **SSO Session Idle** (aujourd'hui 30 min ; à mettre au moins à **12 h** pour couvrir une journée de saisie) et **SSO Session Max** (aujourd'hui 10 h ; au moins **12 h**, ou plus si l'on veut garder la session plusieurs jours derrière le PIN) ;
- à vérifier aussi sur le serveur de production, dont je n'ai pas pu lire les valeurs.

**Fichiers** : `src/services/api.ts` (`renouvelerJetons`, `SansRefreshToken`, redirection unique), `src/router/ProtectedRoute.tsx`, `src/hooks/useAuth.tsx`, `src/lib/tokenStorage.ts` (`verrouillerSession`, `sessionVerrouillee`).
**Tests** : `src/router/ProtectedRoute.fr26.test.tsx` (5 : renouvellement au démarrage, refus → `/login` une fois avec la page mémorisée, verrou, jeton valable, démarrage + 401 simultané = un seul refresh), `src/services/api.fr26.test.ts` (5 : deux 401 simultanés, refresh partagé, une seule redirection, B3 corrigé, pas d'appel sans refresh token).

**Test B3 de la spec 01** : avec l'accord du responsable produit (23/11/2026), l'attente du test de `src/services/api.test.ts` est inversée (« sans refresh token : un 401 suivant n'est plus bloqué (B3 corrigé, FR26) ») et B3 est coché dans `.kiro/specs/01-filet-de-tests/tasks.md`.

### Contrôles

| Contrôle | Résultat |
|---|---|
| `npm run lint` | ✅ 0 avertissement |
| `npm run typecheck` | ✅ |
| `npm test` | ✅ 499 / 499 (42 fichiers, dont 50 nouveaux tests FR24 à FR26) |
| `npm run test:coverage` | ✅ 499 / 499 ; seuil bloquant `src/lib/**` lignes ≥ 90 % : **98,76 %** (instructions 97,73 %, branches 91,96 %, fonctions 99,04 %). Global : lignes 46,85 %, instructions 44,30 %, branches 40,54 %, fonctions 35,77 % (lignes 43,78 % après FR23). Un échec isolé sur le premier de quatre passages, non reproduit ensuite (test non identifié) |
| `npm run build` | ✅ |
| App réelle à 375 px | ✅ FR24, FR25, FR26 (captures ci-dessus) |

Hors de cette branche : `api-docs.json` et `docs/BESOINS_BACKEND.md` sont modifiés dans la copie de travail, mais pas par ce travail. Ils ne figurent pas dans les commits proposés.

### Messages de commit proposés

`EncaisserPage.tsx` et `EncaisserDesktop.tsx` portent FR24 et FR25 : ils vont dans le commit FR24 (le nom de la période en fait partie).

```text
feat(encaisser): saisie en série, montant prérempli et dernier moyen gardé (FR24)

Après un encaissement, retour à « De qui ? » de la même période avec le toast
« Reçu enregistré · Voir » ; membre encaissé aussitôt dans « Déjà payé » ;
payés grisés avec leur montant, compteur « 8 / 20 payés aujourd'hui » ;
montant prérempli (minimum en montant libre), première touche qui le remplace ;
dernier moyen d'encaissement gardé, Espèces par défaut.
Environ 2,5 gestes par membre au lieu de 6 à 7.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

```text
fix(epargne): vocabulaire d'une épargne, sans tour ni jackpot (FR25)

« Jour du JJ/MM » ou « Période N » au lieu de « Tour N » (reçu, fiche) ;
pas de « Jackpot prêt » ; clôture : « N périodes à venir seront annulées » ;
« Position jackpot » masquée à l'ajout d'un membre ; invitation annoncée
par WhatsApp (canal réel du backend, tous types). Rotatives inchangées.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

```text
fix(session): renouvellement des jetons au rechargement (FR26, corrige B3)

ProtectedRoute ne renouvelait jamais la session : jeton d'accès de 5 min expiré
= retour à /login malgré un refresh token valable. Renouvellement partagé
(intercepteur, démarrage, refreshSession), une seule redirection vers /login,
plus d'état bloqué sans refresh token (B3). Déconnexion douce : session
verrouillée, le code secret reste demandé.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

```text
docs(fr24-26): saisie en série, vocabulaire d'une épargne et session

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
