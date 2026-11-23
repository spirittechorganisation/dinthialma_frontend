# FR29 — Retraits anticipés et répartition finale (épargne événementielle)

> Branche `feature/fr29-retraits-repartition`, depuis `develop` à jour (`4136e8e`, FR24-26 fusionné), 23/11/2026.
> Backend local : branche `feature/b53-session-appareil`, au même commit que `origin/develop` (`0022ae7`, fusion de B51 et B42 lot 1).
> Contrat lu : `docs/BESOINS_BACKEND.md` § 7 (B51, B42 lot 1) et `api-docs.json` (mis à jour le 23/11 avec `RETRAIT_COTISATIONS_EN_ATTENTE`).
> Captures à 375 px : [`docs/fr29-captures/`](fr29-captures/).

## 1. Ce qui a été fait

### Socle (types, service, logique pure)
- `src/types/retrait.ts` : `SaisirRetraitRequest`, `Retrait`, `SoldeEpargne`, `DistributionFinale`, `LigneDistribution`, `RegleRetrait`.
- Champs ajoutés : `Tontine.regleRetrait`, `Membre.soldeLe`, `MembreTotalCotisation.totalRetire / solde / soldeLe`, `CotisantTontineSummary.totalRetire / solde / soldeLe`, `NotificationType.RETRAIT_REMIS`.
- `src/services/retraitService.ts` : saisie (`POST …/retraits/admin`), liste, annulation (`DELETE` avec `{motif}`), solde, distribution, `PATCH …/reglages {regleRetrait}`.
- `src/hooks/useRetraits.ts` : `useRetraits`, `useSoldeMembre`, `useDistribution` (404 `DISTRIBUTION_NON_FAITE` → `null`, sans erreur ni nouvel essai), `useSaisirRetrait`, `useAnnulerRetrait`, `useModifierRegleRetrait`. Après un retrait ou une annulation : solde, retraits, membres, récapitulatifs, distribution et résumés `me` relus.
- `src/lib/retraits.ts` (logique pure, 100 % couverte) :
  - `estSolde`, `MOYENS_REMISE`, `montantRetrait`, `verifierRetrait` (mêmes règles que le backend : partiel ≤ solde, date jamais future ni avant le début, heure de Dakar) ;
  - `dateRemisePourEnvoi` : rien pour aujourd'hui (le backend prend l'heure exacte), `AAAA-MM-JJT12:00:00` pour un jour passé (date-heure locale sans fuseau, comme le `LocalDateTime` du backend) ;
  - `phraseRemise` : le récapitulatif avant l'envoi ;
  - `erreurRetrait` : textes par **code** (B02), avec `data.solde` et `data.cotisationsEnAttente` ; liens « Ouvrir À valider » et « Réglages » ;
  - `titreRetraitRemis` : titre de la notification.
- `src/lib/apiError.ts` : les 7 codes, et `donneesErreur(err)` pour lire `data` (sans changer `parseApiError`).
- `src/lib/encaissement.ts` : `avecSoldes`, `horsEncaissement`, `textePayes` sans les membres soldés.

### Écrans

| # | Demande | Fait |
|---|---|---|
| 1 | Fiche du membre (gestionnaire, épargne) | Bloc « Épargne » : solde en grand, Cotisé / Retiré / Solde (`GET …/membres/{mid}/solde`). « Enregistrer un retrait » → `RetraitModal` : Partiel / Tout retirer, montant (tout le solde, en lecture seule, pour « Tout retirer »), Espèces par défaut, Wave et Orange Money avec une référence, date de remise (aujourd'hui par défaut, passée possible, aide « pour reporter un retrait noté dans le cahier »), motif facultatif ; puis récapitulatif à confirmer. Historique des retraits (annulés barrés, avec leur motif) et « Annuler » : motif obligatoire, confirmation. Retraits interdits : lien « Les autoriser » vers les Réglages. Au passage (FR25) : plus de « Position » ni de « Tour N » sur la fiche d'un membre d'épargne. |
| 2 | Badge « Soldé » | Liste des membres, fiche du membre, Encaisser, épargne par membre, répartition finale, « Je cotise ». Encaisser : un membre soldé est rangé avec les « déjà payés », grisé, « Soldé », sans lien ni bouton, et ne compte plus dans « 8 / 20 payés » ; `?membre=` d'un soldé n'ouvre pas le formulaire. Plus d'« Encaisser » sur sa fiche. Le récapitulatif d'une période ne porte pas `soldeLe` : il est croisé avec la liste des membres (`MembreResponse.soldeLe`). |
| 3 | Récapitulatif total (épargne) | Fiche de l'épargne, gestionnaire, épargne en cours : tableau « Épargne par membre » (Membre, Cotisé, Retiré, Solde, total). |
| 4 | Répartition finale | Lue depuis `GET /distribution` (remplace le repli `recap-total` de FR23) : Cotisé, Retiré, Comm. (si commission), Net, totaux, date. Membre : sa ligne seulement, sans totaux. 404 : rien, sans message. |
| 5 | Réglages | Interrupteur « Retraits avant la fin autorisés » (`role="switch"`), avec la phrase qui explique la règle choisie ; épargne seulement, pas une fois terminée. |
| 6 | Je cotise | « Mes montants par tontine » : solde d'une épargne, « retiré X », badge « Soldé », sans « tours payés ». `meService` reprend `totalRetire`, `solde`, `soldeLe` et retire d'« à payer » une épargne soldée. Fiche de l'épargne (membre) : « Mon solde » après un retrait, « Soldé · retiré X », bouton « Soldé » inactif au lieu de « Payer », plus de « Mon tour » (FR25). |
| 7 | Notification `RETRAIT_REMIS` | Titre « Retrait de 10.000F enregistré » ; lien : fiche de l'épargne (membre), fiche du membre (gestionnaire). |

**Choix à valider**
- **Phrase du retrait total** (décision du 23/11/2026) : « Remettre 44.000F en espèces à Awa. Awa sera soldé(e) : plus de cotisation, et rien à recevoir à la fin. » Le genre du membre n'est pas connu, d'où « soldé(e) ».
- **Montant de la notification** : il n'existe que dans le corps envoyé par le serveur (« Retrait de 10000 FCFA remis… »). Le front le reformate quand il est reconnaissable, sinon le titre devient « Retrait enregistré ». Le plus propre serait un champ `montant` dans la notification, à demander au backend.
- **`RETRAIT_COTISATIONS_EN_ATTENTE`** bloque aussi les cotisations `EN_RETARD` (lot 0 fusionné, PR #61). Le texte dit donc « en attente ou en retard ».

### Tests (54 nouveaux)
- `src/lib/retraits.fr29.test.ts` (28), `src/lib/encaissement.fr29.test.ts` (4).
- `src/pages/tontine/MembreFichePage.fr29.test.tsx` (9) : bloc, report daté d'hier (corps envoyé), retrait total (sans montant, Orange Money + référence), contrôle du solde, `RETRAIT_COTISATIONS_EN_ATTENTE`, retraits interdits, annulation (motif obligatoire), `RETRAIT_NON_ANNULABLE`, membre soldé.
- `FicheTontinePage.fr29` (5), `EncaisserPage.fr29` (2), `ReglagesTontinePage.fr29` (2), `NotificationsPage.fr29` (2), `HomeSheets.fr29` (2).
- Un test FR23 adapté : la répartition finale de `FicheTontinePage.fr23.test.tsx` est servie par `/distribution` au lieu de `recap-total` (consigne 4). Ce n'est pas un test de caractérisation ; aucun test `[caractérisation]` n'a été modifié.

## 2. Parcours vérifié dans l'app (375 px)

Épargne locale « Tontine Tabaski » (deux membres, retraits interdits au départ).

| Étape | Résultat | Capture |
|---|---|---|
| Réglages : activer « Retraits avant la fin autorisés » | ✅ `regleRetrait` passe à `LIBRE`, la phrase change | [01](fr29-captures/fr29-01-reglages-avant.png) [02](fr29-captures/fr29-02-reglages-autorises.png) |
| Fiche de Babacar : bloc Épargne | ✅ Cotisé 4.002F, Retiré 0F, Solde 4.002F ; « Période 3 », sans position | [03](fr29-captures/fr29-03-fiche-membre.png) |
| Report d'un retrait partiel daté d'hier (1.000F, 22/11, « Report du cahier ») | ✅ Récapitulatif « Remettre 1.000F en espèces à Babacar. Il lui restera 3.002F. » et « Remis le 22/11/2026 (report du cahier) » ; enregistré par le backend `PARTIEL · 1000 · REMIS · 2026-11-22T12:00:00` ; solde 3.002F, toast « Retrait de 1.000F enregistré » | [04](fr29-captures/fr29-04-formulaire-partiel.png) [05](fr29-captures/fr29-05-recap-partiel.png) [06](fr29-captures/fr29-06-apres-partiel.png) |
| Annulation | ✅ Sans motif : « Indiquez le motif de l'annulation. » ; avec « Saisi en double » : solde revenu à 4.002F, retrait barré « annulé » avec son motif | [07](fr29-captures/fr29-07-annulation.png) [08](fr29-captures/fr29-08-apres-annulation.png) |

Suite sur une **épargne neuve** « FR29 retraits » (journalière, montant libre, du 23/11 au 25/11, Awa et Binta sans compte), pour ne pas clôturer « Tontine Tabaski ». Création, ajout des membres et lancement par l'API ; tout le reste dans l'app.

| Étape | Résultat |
|---|---|
| Encaisser Awa (5.000F) puis Binta (2.000F) en série | ✅ « Jour du 23/11 », « 2 / 2 payés aujourd'hui » |
| Retrait total de Binta | ✅ « Tout retirer » : montant 2.000F en lecture seule ; récapitulatif « Remettre 2.000F en espèces à Binta. Binta sera soldé(e) : plus de cotisation, et rien à recevoir à la fin. » ; fiche : badge « Soldé » (en-tête et bloc Épargne), solde 0F, « Binta a tout retiré le 23 nov. », plus de bouton de retrait ni d'Encaisser |
| Badge « Soldé » dans les listes | ✅ Liste des membres (Binta « Soldé », sans situation de paiement) ; fiche de l'épargne, « Épargne par membre » : Awa 5.000F / 0F / 5.000F, Binta « Soldé » 2.000F / 2.000F / 0F, total 7.000F / 2.000F / 5.000F ; pas de répartition avant la clôture, sans message |
| Refus `RETRAIT_COTISATIONS_EN_ATTENTE` | ⚠️ **non reproductible dans l'app** : il faut un membre avec un solde positif **et** une cotisation en attente ou en retard. Or une saisie du gestionnaire est validée tout de suite, les membres de test n'ont pas de compte pour déclarer, et une date de début passée est refusée (B46) : impossible de créer une cotisation d'un jour antérieur. Couvert par les tests front (texte, `data.cotisationsEnAttente`, « Ouvrir À valider ») et par les tests backend du lot 0. |
| Clôture de la tontine et répartition | ✅ Confirmation, puis « Points en suspens » : « 3 périodes à venir seront annulées, la répartition se fera sur ce qui a été encaissé » ; « Clôturer quand même » ramène sur la fiche ; « Répartition finale » lue depuis `/distribution` : « Faite le 23 nov. · 2 membres », Awa 5.000F / 0F / 5.000F, Binta « Soldé » 2.000F / 2.000F / 0F, total 7.000F / 2.000F / 5.000F |

Captures de cette suite prises mais non copiées dans `docs/` (à votre demande).

**Corrigé pendant le parcours** : la confirmation de clôture d'une épargne disait « chacun reçoit ce qu'il a cotisé », faux dès qu'il y a des retraits. Elle dit maintenant « chacun reçoit son solde (ce qu'il a cotisé, moins ses retraits) », dans les Réglages et sur la dernière période (`TourPage`). L'assertion du test FR23 des Réglages est mise à jour (pas un test de caractérisation).

**Observé une fois** : « Impossible de charger les membres » sur la liste des membres, environ 5 minutes après la connexion (expiration du jeton d'accès). Le backend répondait pourtant (200). Non reproduit : rechargement normal, puis rechargement avec un jeton d'accès forcé à « expiré », renouvelé sans erreur. À surveiller.

## 3. Test instable

**Recherche** : 16 passages complets de `test:coverage` (6, puis 10 avec un rapport JSON par passage), tous verts (553 / 553 sur les 10 derniers). L'échec isolé de FR24-26 ne s'est pas reproduit, donc le test n'est **pas identifié avec certitude**. Les seuls échecs vus étaient des tests FR29 en cours d'écriture, corrigés depuis.

**Suspect principal** : `src/pages/gestion/AValiderPage.test.tsx` › « plus de 100 paiements : envoi en lots de 100 » (test **`[caractérisation]`**).
- Durée sur les 10 passages : 10,5 s en moyenne, **16,2 s au maximum**, pour un délai maximal de 20 s (`testTimeout`, déjà relevé le 19/11 pour la même raison). Il rend 101 paiements (vue mobile et desktop), puis attend deux envois et le nouveau rendu.
- Ses `findBy…` échouent au bout de 5 s (`asyncUtilTimeout`) : l'attente de « 101 paiements validés » après deux envois peut dépasser 5 s sous forte charge.
- L'échec de FR24-26 est survenu pendant que Chrome headless et le backend tournaient sur la même machine. Plusieurs tests ont alors des pointes à 5 ou 6 s (moyenne inférieure à 1 s), par exemple `ProtectedRoute.fr26` (5,1 s au maximum), `HomeSheets.fr29` et `MembreFichePage.fr23`.

**Correctif appliqué** (accord du responsable produit, 23/11/2026) : dans `AValiderPage.test.tsx`, l'attente finale passe à 15 s, avec un commentaire : `findByText('101 paiements validés', {}, { timeout: 15_000 })`. Le comportement vérifié ne change pas (même texte attendu, mêmes lots de 100 puis 1) ; seule l'attente avant échec est plus longue. Les autres tests gardent l'attente de 5 s.

## 4. Ce qui reste, et contrôles

**Reste**
- Refus `RETRAIT_COTISATIONS_EN_ATTENTE` : à vérifier dans l'app sur une épargne réelle (membre qui a déjà cotisé et a un paiement déclaré à valider).
- Surveiller l'erreur « Impossible de charger les membres » observée une fois (section 2).
- Backend, suggestions :
  - un champ `montant` dans la notification `RETRAIT_REMIS` (évite de lire le corps) ;
  - `soldeLe` dans le récapitulatif d'une période (`recap/{cycleId}`), pour éviter un appel `membres` dans Encaisser.
- Hors périmètre : export CSV des retraits (`GET …/retraits/export`, prêt côté service backend), lot 2 de B42 (demande du membre).
- `docs/fr23-epargne-journaliere.md`, un temps écrasé dans la copie de travail, est restauré (identique à `develop`).

**Contrôles**

| Contrôle | Résultat |
|---|---|
| `npm run lint` | ✅ 0 avertissement |
| `npm run typecheck` | ✅ |
| `npm test` | ✅ 553 / 553 (50 fichiers, dont 54 nouveaux tests) |
| `npm run test:coverage` | ✅ 553 / 553 (12 passages verts sur 12 avec FR29, dont le dernier après les corrections). Seuil bloquant `src/lib/**` lignes ≥ 90 % : **98,91 %** (instructions 98,01 %, branches 93,44 %, fonctions 99,18 %). Global : lignes 50,31 %, instructions 47,89 %, branches 44,60 %, fonctions 39,68 % (lignes 46,85 % après FR24-26) |
| `npm run build` | ✅ |
| App réelle à 375 px | ✅ sauf le refus `RETRAIT_COTISATIONS_EN_ATTENTE`, non reproductible sur des données de test (section 2) |

## 5. Messages de commit proposés

`api-docs.json` et `docs/BESOINS_BACKEND.md` (mis à jour par vous : `RETRAIT_COTISATIONS_EN_ATTENTE` dans le contrat, adresse de contact) vont dans un commit à part, avant les autres :

```bash
git add api-docs.json docs/BESOINS_BACKEND.md
git commit -m "docs(contrat): RETRAIT_COTISATIONS_EN_ATTENTE (B42 lot 0) et contact de l'API" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**1. Socle des retraits**
```bash
git add src/types/retrait.ts src/types/tontine.ts src/types/membre.ts src/types/cotisation.ts src/types/me.ts src/types/notification.ts \
  src/services/retraitService.ts src/hooks/useRetraits.ts src/hooks/useMembres.ts src/lib/apiError.ts \
  src/lib/retraits.ts src/lib/retraits.fr29.test.ts
git commit -m "feat(epargne): socle des retraits anticipés et de la répartition finale (FR29)" -m "Types, service et hooks B42 lot 1 (saisie, liste, annulation, solde, règle de retrait) et B51 (distribution relue, 404 DISTRIBUTION_NON_FAITE sans erreur). Logique pure dans lib/retraits : contrôles comme le backend, date de remise en heure de Dakar, récapitulatif avant l'envoi, erreurs lues dans code avec data.solde et data.cotisationsEnAttente." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**2. Fiche du membre : épargne et retraits**
```bash
git add src/components/epargne/RetraitModal.tsx src/components/epargne/EpargneMembre.tsx \
  src/pages/tontine/MembreFichePage.tsx src/pages/tontine/MembreFichePage.fr29.test.tsx
git commit -m "feat(membre): bloc épargne, retraits datés et annulation (FR29)" -m "Cotisé, retiré, solde ; « Enregistrer un retrait » (partiel ou total, moyen de remise, date réelle pour reporter le cahier, motif) avec récapitulatif à confirmer ; historique avec annulation motivée. Membre soldé : badge, plus d'Encaisser. Ni position ni tour pour une épargne." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**3. Membres soldés dans les listes et Encaisser**
```bash
git add src/lib/encaissement.ts src/lib/encaissement.fr29.test.ts \
  src/pages/gestion/EncaisserPage.tsx src/pages/gestion/EncaisserDesktop.tsx src/pages/gestion/EncaisserPage.fr29.test.tsx \
  src/pages/tontine/MembresTontinePage.tsx
git commit -m "feat(encaisser): membre soldé rangé avec les déjà payés, badge Soldé (FR29)" -m "Un membre soldé n'a plus rien à encaisser : grisé avec les déjà payés, mention Soldé, hors du compteur ; badge dans la liste des membres." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**4. Fiche de l'épargne, Réglages, Je cotise, notification**
```bash
git add src/components/epargne/TableauxEpargne.tsx src/components/epargne/RegleRetrait.tsx \
  src/pages/tontine/FicheTontinePage.tsx src/pages/tontine/FicheTontinePage.fr29.test.tsx src/pages/tontine/FicheTontinePage.fr23.test.tsx \
  src/pages/tontine/ReglagesTontinePage.tsx src/pages/tontine/ReglagesTontinePage.fr29.test.tsx src/pages/tontine/ReglagesTontinePage.fr23.test.tsx \
  src/pages/tontine/TourPage.tsx \
  src/services/meService.ts src/components/home/HomeSheets.tsx src/components/home/HomeSheets.fr29.test.tsx \
  src/pages/NotificationsPage.tsx src/pages/NotificationsPage.fr29.test.tsx
git commit -m "feat(epargne): répartition depuis /distribution, solde par membre, règle de retrait (FR29)" -m "Fiche : épargne par membre (cotisé, retiré, solde) puis répartition finale lue depuis /distribution (net, commission, totaux, date ; un membre voit sa ligne ; rien avant la distribution). Réglages : retraits avant la fin autorisés. Je cotise : solde et retiré, plus rien à payer une fois soldé. Notification RETRAIT_REMIS : « Retrait de X F enregistré », lien vers la fiche. Clôture : chacun reçoit son solde (cotisé moins retraits)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**4 bis. Test instable**
```bash
git add src/pages/gestion/AValiderPage.test.tsx
git commit -m "test(a-valider): attente allongée pour la validation de 101 paiements (FR29)" -m "Test [caractérisation] modifié avec l'accord du responsable produit (23/11/2026) : l'attente de « 101 paiements validés » passe à 15 s ; sous couverture et machine chargée, deux envois puis le rendu de 101 lignes dépassaient parfois 5 s (échec isolé en FR24-26). Comportement vérifié inchangé." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**5. Livrable**
```bash
git add docs/fr29-retraits-repartition.md docs/fr29-captures/
git commit -m "docs(fr29): retraits anticipés et répartition finale" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
