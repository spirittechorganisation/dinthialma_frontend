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
