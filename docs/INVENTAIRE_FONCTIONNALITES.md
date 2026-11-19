# Dinthialma — Inventaire des fonctionnalités (front)

> Mis à jour novembre 2026 — reflète l'état réel du code après le refactoring « brief v2 logique Wave »,
> l'intégration des nouvelles APIs (B01–B22, B25, B26–B33, QR, invitations, priorités jackpot, clôture tontine)
> et les améliorations PWA (mise à jour visible, installation multi-plateforme).
>
> **Légende statut**
> - ✅ Livré et fonctionnel
> - ⚠️ Partiel / contournement actif
> - 🚧 Démarré mais non terminé
> - ❌ Non démarré

---

## 0. Stack et architecture

**Stack** : React 18 + TypeScript 5, Vite, TanStack Query v5, React Router v6, Tailwind CSS, Axios,
Sonner (toasts), Recharts, vite-plugin-pwa (Workbox), React Hook Form + Zod, jsQR.

**Backend** : API REST Spring Boot `/api/v1/*`, authentification Keycloak (JWT + refresh + PIN à 6 chiffres).

**Architecture** :
- `src/pages/` — pages routées (lazy-loaded)
- `src/components/` — composants réutilisables (ui/, layout/, shared/, home/, gestion/, pay/, tontine/, desktop/)
- `src/hooks/` — hooks React Query par domaine
- `src/services/` — couche API Axios (un fichier par domaine)
- `src/types/` — types TypeScript miroir du backend
- `src/lib/` — utilitaires (format, tokenStorage, apiError, preferences, share, exportCsv…)

---

## 1. Routes et pages

| Chemin | Page / Composant | Protection | Statut |
|---|---|---|---|
| `/` | `StartRoute` (redirection intelligente) | Publique | ✅ |
| `/onboarding` | `OnboardingPage` | Publique | ✅ |
| `/login` | `LoginPage` | Publique | ✅ |
| `/register` | `RegisterPage` | Publique | ✅ |
| `/forgot-password` | `ForgotPasswordPage` | Publique | ✅ |
| `/pin` | `PinLoginPage` | Publique | ✅ |
| `/pin/setup` | `PinSetupPage` | ProtectedRoute | ✅ |
| `/pin/reset` | `PinResetPage` | Publique | ✅ |
| `/accueil` | `HomePage` | ProtectedRoute + DesktopShell | ✅ |
| `/jackpots` | `MesJackpotsPage` | ProtectedRoute | ✅ |
| `/payer` | `PayerPage` (sélection tontine) | ProtectedRoute | ✅ |
| `/payer/:tontineId` | `PayerPage` (déclaration directe) | ProtectedRoute | ✅ |
| `/recu/:tontineId/:cotisationId` | `RecuPage` | ProtectedRoute | ✅ |
| `/a-valider` | `AValiderPage` | ProtectedRoute | ✅ |
| `/a-valider?tontine=:id` | `AValiderPage` (filtrée) | ProtectedRoute | ✅ |
| `/encaisser` | `EncaisserPage` | ProtectedRoute | ✅ |
| `/encaisser/:tontineId` | `EncaisserPage` (tontine directe) | ProtectedRoute | ✅ |
| `/tontines` | `MesTontinesPage` | ProtectedRoute | ✅ |
| `/creer` | `CreerTontinePage` | ProtectedRoute | ✅ |
| `/tontine/:id` | `FicheTontinePage` | ProtectedRoute | ✅ |
| `/tontine/:id/reglages` | `ReglagesTontinePage` | ProtectedRoute | ✅ |
| `/tontine/:id/modifier` | `ModifierTontinePage` | ProtectedRoute | ✅ |
| `/tontine/:id/tours` | `ToursPage` | ProtectedRoute | ✅ |
| `/tontine/:id/tours/:cycleId` | `TourPage` (mobile) / `ToursPage+panneau` (desktop) | ProtectedRoute | ✅ |
| `/tontine/:id/membres` | `MembresTontinePage` | ProtectedRoute | ✅ |
| `/tontine/:id/membres/:membreId` | `MembreFichePage` (mobile) / panneau desktop | ProtectedRoute | ✅ |
| `/tontine/:id/priorites` | `PrioritesPage` (membre : demander / annuler) | ProtectedRoute | ✅ |
| `/scanner` | `ScannerPage` | ProtectedRoute | ✅ |
| `/partager` | `PartagerPage` | ProtectedRoute | ✅ |
| `/q/:token` | `MembreQrPage` (résolution QR scanné) | ProtectedRoute | ✅ |
| `/q/t/:code` | `InvitationPage` (aperçu public + rejoindre) | Publique | ✅ |
| `/notifications` | `NotificationsPage` | ProtectedRoute | ✅ |
| `/parametres` | `ParametresPage` | ProtectedRoute | ✅ |
| `/historique` | `HistoriquePage` | ProtectedRoute | ✅ |
| `/dashboard` | Redirige vers `/accueil` | ProtectedRoute | ✅ |
| `/superadmin/dashboard` | `SuperAdminDashboard` | SUPER_ADMIN | ✅ |
| `/superadmin/users` | `UsersPage` | SUPER_ADMIN | ✅ |
| `/superadmin/tontines` | `AllTontinesPage` | SUPER_ADMIN | ✅ |
| `/superadmin/cotisations` | `AllContributionsPage` | SUPER_ADMIN | ✅ |
| `/superadmin/code-list` | `CodeListPage` | SUPER_ADMIN | ✅ |

**Total : 36 routes actives** (hors redirections legacy et catch-all).

---

## 2. Fonctionnalités par domaine

### A. Authentification et sécurité

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F01 | Onboarding PWA | 3 diapositives au 1er lancement mobile installé | ✅ |
| F02 | Démarrage intelligent | Redirige vers le bon écran selon la session mémorisée | ✅ |
| F03 | Inscription par SMS (3 étapes) | Téléphone → OTP → Prénom/Nom/Email/Mot de passe | ✅ |
| F04 | Activation compte pré-inscrit | Membre ajouté par gestionnaire → finalise l'inscription | ⚠️ Détection par texte d'erreur (B02 non encore livré) |
| F05 | Connexion par mot de passe | Téléphone + mot de passe → accueil selon rôle | ✅ |
| F06 | Déverrouillage PIN | Pavé 6 chiffres, soumission automatique, reconnexion rapide | ✅ |
| F07 | Création du PIN | Après 1ère connexion si `pin_configured=false` | ✅ |
| F08 | Réinitialisation du PIN (OTP) | 4 étapes : téléphone → SMS → nouveau PIN → confirmation | ✅ |
| F09 | Mot de passe oublié (OTP) | 3 étapes : téléphone → SMS → nouveau mot de passe | ✅ |
| F10 | Changer de compte | Efface tout → connexion complète | ✅ |
| F11 | Déconnexion douce | Efface le jeton, garde PIN → retour à l'écran PIN | ✅ |
| F12 | Refresh automatique JWT | Intercepteur Axios : 401 → refresh → rejoue les requêtes | ✅ |
| F13 | Changer de mot de passe | Depuis Paramètres (feuille dédiée avec l'ancien + le nouveau mot de passe) | ✅ |
| F14 | Appareils connectés | Liste des sessions actives, déconnexion à distance | ✅ |

---

### B. Accueil-hub (brief v2 « logique Wave »)

> Un seul accueil pour tous les rôles, avec bascule **Je cotise / Je gère**.

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F20 | Accueil « Je cotise » | Bandeau total cotisé, carte d'action urgente (tontine à payer la plus proche), grille de services, fil d'activité | ✅ |
| F21 | Accueil « Je gère » | Bandeau collecté ce tour, carte d'action (n paiements à valider), fil d'activité gestionnaire, carte QR d'invitation de la tontine sélectionnée | ✅ |
| F22 | Bascule Je cotise / Je gère | Mémorisée (préférence synchronisée serveur B22) | ✅ |
| F23 | Filtre tontine sur l'accueil | Picker tontine pour concentrer la vue sur une tontine | ✅ |
| F24 | Montants masquables | Bascule œil — préférence locale + synchronisée serveur | ✅ |
| F25 | Feuille « Mes montants » | Détail par tontine : total cotisé, jackpots reçus, cotisation due, gestionnaire | ✅ |
| F26 | Feuille « Collecte » (gestionnaire) | Par tontine gérée : collecté / attendu, membres ayant payé, retards | ✅ |
| F27 | Carte QR d'invitation (gestionnaire) | QR + code + bouton partager, depuis l'accueil et les réglages | ✅ |
| F28 | Grille de 8 services | Payer, Encaisser, Valider, À valider, Scanner, Partager, Mes jackpots, Historique | ✅ |
| F29 | Fil d'activité | Derniers mouvements (cotisations, jackpots) toutes tontines, mode COTISE ou GERE | ✅ |
| F30 | Accueil desktop | Panneau latéral avec résumés + graphique Recharts (activité réelle) | ✅ |

---

### C. Mes jackpots

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F35 | Mes jackpots reçus | Liste des jackpots et distributions finales reçus, total | ✅ |
| F36 | Jackpots à venir (estimation) | Position dans le tour, date estimée, montant estimé | ✅ |

---

### D. Paiements (membre)

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F40 | Déclarer un paiement | Tontine + tour déduits ; montant prérempli ; moyen mémorisé ; gère les retards régularisables (B33) et les tours multi-échéances (B32) | ✅ |
| F41 | Reçu / détail d'un paiement | Statut, montant, moyen, référence, date, lien vers le tour | ✅ |
| F42 | Partager un reçu | Texte de partage natif (`navigator.share`) | ✅ |
| F43 | Modifier son paiement | Montant, moyen, référence, note (si encore en attente) | ✅ |
| F44 | Historique personnel | Fil chronologique de tous les paiements, toutes tontines | ✅ |

---

### E. Paiements (gestionnaire — validation)

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F50 | File « À valider » | Paiements EN_ATTENTE de toutes les tontines gérées, groupés par tontine | ✅ |
| F51 | Valider un paiement | 1 tap + toast « Annuler » 5 s ; balayage mobile | ✅ |
| F52 | Validation groupée | « Tout valider » ou sélection desktop → POST bulk, bilan par paiement | ✅ |
| F53 | Refuser un paiement | Motif obligatoire → statut REFUSE, membre peut redéclarer | ✅ |
| F54 | Encaisser (gestionnaire) | Membres sans cotisation en tête, enregistrement direct validé d'office | ✅ |
| F55 | Demandes d'adhésion (section À valider) | Accepter / refuser les demandes EN_ATTENTE, avec ou sans position jackpot | ✅ |

---

### F. Tontines

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F60 | Mes tontines (liste unifiée) | Cartes avec statut, type, montant, progression membres, favoris | ✅ |
| F61 | Créer une tontine | Assistant 2 étapes, ROTATIVE ou EVENEMENTIELLE, avec simulation calendrier (B26/B32) et commissions embarquées (B30) | ✅ |
| F62 | Modifier une tontine (brouillon) | Mêmes champs que la création | ✅ |
| F63 | Fiche tontine unifiée | Montant en grand, 2–3 boutons pilule contextuels, rubriques, historique filtrable, export CSV | ✅ |
| F64 | Activer une tontine | BROUILLON → ACTIVE, génération automatique des cycles | ✅ |
| F65 | Suspendre / relancer | ACTIVE ↔ SUSPENDUE | ✅ |
| F66 | Clôturer une tontine | ACTIVE/SUSPENDUE → TERMINEE, irréversible ; flow à 2 passes : 1er appel → 409 avec détail des suspens → confirmation avec `forcer:true` | ✅ |
| F67 | Supprimer un brouillon | Soft delete (BROUILLON uniquement) | ✅ |
| F68 | Réglages tontine | Règles, paiement et rappels (modifiables en cours), option de remise jackpot (B33), commissions, QR d'invitation, actions sensibles | ✅ |
| F69 | Modifier échéance en cours | Jour, heure limite, rappels — appliqués aux tours suivants, membres notifiés (B26) | ✅ |
| F70 | Option de remise du jackpot | ATTENDRE / DISPONIBLE / AVANCE_COMMISSION / AVANCE_GESTIONNAIRE / CAISSE (B33) | ✅ |
| F71 | Favoris tontines | Épingler / désépingler, synchronisé serveur (B22) | ✅ |
| F72 | Simulation du calendrier | Aperçu des tours et échéances avant création/modification | ✅ |

---

### G. Membres

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F80 | Liste des membres | Ordre jackpot, statut, badge pré-inscrit, indicateur jackpot reçu | ✅ |
| F81 | Ajouter un membre | Recherche par téléphone → existant ou pré-inscription + SMS | ✅ |
| F82 | Fiche membre | Résumé cotisations, total versé, enregistrer paiement | ✅ |
| F83 | Suspendre / réactiver un membre | ACTIF ↔ SUSPENDU | ✅ |
| F84 | Retirer un membre | Soft delete | ✅ |

---

### H. Tours (cycles)

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F90 | Liste des tours | Statuts, jackpot brut/net, bénéficiaires, dépliable | ✅ |
| F91 | Détail d'un tour | Progression (pastilles d'échéances), payés / pas encore payés, retardataires | ✅ |
| F92 | Ouvrir un tour (mode manuel) | Date début, date fin (rotative MANUEL uniquement) | ✅ |
| F93 | Clôturer un tour / période | Calcul jackpot, commissions, EN_ATTENTE → EN_RETARD ; options de remise (B33) | ✅ |
| F94 | Remettre le jackpot (aperçu) | Aperçu chiffré avant clôture : jackpot brut, commission, net, options si incomplet | ✅ |
| F95 | Désigner les gagnants (manuel) | Sélection 1..N membres, POST /beneficiaire | ✅ |
| F96 | Tirage au sort | POST /beneficiaire avec liste vide | ✅ |
| F97 | Encaisser retardataire | Paiement direct validé d'office, même après la remise du jackpot | ✅ |

---

### I. Priorités de jackpot

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F100 | Demander la priorité (membre) | Motif facultatif, page /tontine/:id/priorites | ✅ |
| F101 | Annuler sa demande (membre) | EN_ATTENTE → ANNULEE | ✅ |
| F102 | Historique des demandes (membre) | Toutes demandes avec statut et motif de refus | ✅ |
| F103 | Accorder une priorité (gestionnaire) | Section dans Réglages tontine, liste EN_ATTENTE | ✅ |
| F104 | Refuser une priorité (gestionnaire) | Motif facultatif, membre notifié | ✅ |
| F103 | Attribuer directement (gestionnaire) | Sans demande préalable, POST /priorites/attribuer | ✅ |

---

### J. QR, invitations et demandes d'adhésion

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F110 | Mon QR membre | Jeton opaque `/me/qr`, affichage plein écran + régénération | ✅ |
| F111 | Scanner un QR | BarcodeDetector (Android) + jsQR (iOS), ouvre l'encaissement ou l'invitation | ✅ |
| F112 | Partager mon QR | Texte + lien natif, ou QR affiché pour être scanné | ✅ |
| F113 | QR d'invitation tontine | Code stable, régénérable, révocable (gestionnaire) | ✅ |
| F114 | Aperçu public d'invitation | Page `/q/t/:code` sans JWT : règles, montant, places restantes | ✅ |
| F115 | Rejoindre via invitation | Bouton « Demander à rejoindre » (connecté) ou « Créer un compte » | ✅ |
| F116 | Demandes d'adhésion (gestionnaire) | Accepter (avec position jackpot optionnelle) / Refuser, dans À valider et Réglages | ✅ |
| F117 | Mes demandes d'adhésion (membre) | Liste des demandes envoyées | ✅ |

---

### K. Commissions

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F120 | Gérer les commissions | Lister, ajouter, modifier, supprimer (% jackpot, frais fixes, frais adhésion) | ✅ |
| F121 | Commissions à la création | Ajoutées en même temps que la tontine (B30) | ✅ |

---

### L. Notifications

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F130 | Centre de notifications in-app | Sections Nouvelles / Précédentes, navigation contextuelle par type | ✅ |
| F131 | Badge non lus | Sondage 60 s + actualisation au retour sur l'app | ✅ |
| F132 | Marquer lu / tout marquer lu | PATCH par notification ou bulk | ✅ |
| F133 | Navigation contextuelle | Clic → ouvre le reçu, le tour, la fiche membre ou la tontine selon le type | ✅ |

**Types de notification pris en charge :** PAIEMENT_RECU, COTISATION_SOUMISE, COTISATION_VALIDEE, COTISATION_REFUSEE, JACKPOT_DISTRIBUE, DISTRIBUTION_FINALE, PAIEMENT_EN_RETARD, RAPPEL_COTISATION, TOUR_PROCHE, CYCLE_BIENTOT_CLOTURE, CYCLE_OUVERT, INVITATION_TONTINE, STATUT_MEMBRE, DEMANDE_ADHESION, ADHESION_REFUSEE, COTISATIONS_MANQUANTES, REGLES_MODIFIEES, JACKPOT_PRET, COMPLEMENT_A_REMETTRE, GAGNANTS_A_DESIGNER, ORDRE_BENEFICIAIRE_MODIFIE, PRIORITE_JACKPOT_DEMANDEE, PRIORITE_JACKPOT_ACCORDEE, PRIORITE_JACKPOT_REFUSEE, TONTINE_PRETE_A_CLOTURER, TONTINE_CLOTUREE.

---

### M. Paramètres et profil

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F140 | Profil : consulter / modifier | Prénom, nom, email ; avatar initiales | ✅ |
| F141 | Changer de numéro (OTP 2 étapes) | Nouveau numéro → code SMS → reconnexion | ✅ |
| F142 | Changer de mot de passe | Ancien + nouveau mot de passe, depuis Paramètres | ✅ |
| F143 | Configurer / changer le PIN | Pavé numérique depuis auth ; feuille dédiée depuis Paramètres | ✅ |
| F144 | Appareils connectés | Liste, déconnexion à distance (B20) | ✅ |
| F145 | Masquer les montants | Bascule globale, synchronisée serveur | ✅ |
| F146 | Régénérer mon QR membre | Depuis Paramètres | ✅ |
| F147 | Installer l'application | `InstallSheet` : dialog natif (Android/Chrome/Edge), instructions pas-à-pas (iOS Safari), guide Chrome/Edge (Firefox/Safari desktop) | ✅ |
| F148 | Contacter l'assistance | WhatsApp et email depuis la config publique (B25) | ✅ |
| F149 | Comment ça marche | Modal 4 étapes | ✅ |

---

### N. Administration plateforme (SUPER_ADMIN)

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F160 | Dashboard plateforme | KPIs globaux, graphique statuts, 5 dernières tontines, activité 24 h | ✅ |
| F161 | Utilisateurs | Liste paginée, recherche, filtres rôle/statut | ✅ |
| F162 | Activer / désactiver un compte | Menu contextuel + confirmation | ✅ |
| F163 | Modifier les rôles | Modale cases à cocher | ✅ |
| F164 | Toutes les tontines | Tableau, filtre statut, clic → fiche | ✅ |
| F165 | Toutes les cotisations | Tableau, filtres statut + tontine | ✅ |
| F166 | Référentiels (code-list) | CRUD valeurs (fréquences, méthodes, statuts, ordres) — suppression non implémentée (B23) | ⚠️ |

---

### O. PWA et transverses

| # | Fonctionnalité | Description courte | Statut |
|---|---|---|---|
| F170 | Mise à jour visible | Bandeau « Nouvelle version disponible » + bouton « Mettre à jour » ; polling 60 s | ✅ |
| F171 | Installation multi-plateforme | Dialog natif Android/Chrome/Edge ; instructions iOS ; guide Firefox/Safari desktop | ✅ |
| F172 | Préférences synchronisées serveur | Mode (COTISE/GERE), masquerMontant, favoris, dernierMoyen, derniereTontineGeree (B22) | ✅ |
| F173 | Config publique | Liens support, version minimale / recommandée (B25) | ✅ |
| F174 | Détection hors ligne | Bandeau « Hors connexion », désactivation des actions réseau | ✅ |
| F175 | Refresh JWT automatique | File d'attente sur 401, un seul refresh en vol | ✅ |
| F176 | Correction encodage | Correcteur mojibake sur toutes les réponses (B03 en attente backend) | ⚠️ |
| F177 | Export CSV des cotisations | Depuis la fiche tontine (gestionnaire) | ✅ |
| F178 | Rechargement sur erreur de chunk | `ChunkErrorBoundary` recharge la page si un module lazy n'est plus disponible | ✅ |

---

## 3. Ce qui n'est PAS encore démarré ❌

Ces fonctionnalités sont documentées dans `BESOINS_BACKEND.md` ou le brief mais **n'ont pas de code frontend** à ce jour :

| # | Fonctionnalité | Dépendance backend | Priorité |
|---|---|---|---|
| NF01 | Amendes de retard (B27) | Endpoints caisses (B29) + rythme (B26) + validation gestionnaire | P1 |
| NF02 | Caisses de la tontine (B29) | Journal de mouvements, cohérence comptable | P1 |
| NF03 | Prêts sur la cagnotte — tontines événementielles (B28) | Eligibilité, 8 statuts, remboursements | P1 |
| NF04 | Rythme libre (B26) | Modèle de rythme, `echeanceAt`, traitement planifié | P1 |
| NF05 | N cotisations par tour — rotatives (B32) | Dépend de B26 | P1 |
| NF06 | Cotisation séparée de la remise — retards régularisables (B33) | Dépend de B32 | P1 |
| NF07 | Tontine groupée (B34) | Dépend de B33 | P1 |
| NF08 | Plusieurs parts par membre (B35) | Dépend de B33 | P1 |
| NF09 | Notifications push Web (B19 P2) | Abonnement Web Push, service worker | P2 |
| NF10 | Suppression d'une valeur de liste (B23) | `DELETE /v1/code-list/{id}` | P2 |
| NF11 | Export CSV côté serveur (B24) | `GET .../cotisations/export?format=csv` | P2 |
| NF12 | Mode sombre | 0 classe `dark:` Tailwind — UI uniquement, aucune dépendance backend | — |
| NF13 | Internationalisation (i18n) | Tout en français codé en dur ; wolof non planifié | — |
| NF14 | Statistiques avancées (graphiques par membre, évolution jackpots…) | Endpoints B09/B10 existants mais pas d'écran dédié | — |

---

## 4. Fonctionnalités partielles ou à améliorer ⚠️

| # | Sujet | Détail | Priorité |
|---|---|---|---|
| P01 | Codes d'erreur stables (B02) | Détection du compte pré-inscrit encore par texte d'erreur | Sprint 1 backend |
| P02 | Encodage UTF-8 (B03) | Correcteur mojibake toujours actif côté front | Sprint 1 backend |
| P03 | Référentiels — suppression (B23) | Bouton absent dans `CodeListPage` | Après backend |
| P04 | Graphique accueil gestionnaire | Données Recharts branchées sur données réelles B05, mais le graphique détaillé desktop pourrait être enrichi | Cosmétique |
| P05 | Terminologie incohérente | « Cotisations » / « Paiements » ; « Cycle » / « Période » ; « Versé » / « Terminé » — à homogénéiser | Backlog |
| P06 | Rejoindre par code (ancien flux) | L'ancien bouton « Rejoindre une tontine » renvoie désormais vers `InvitationPage` via le scanner, mais un champ texte direct serait plus simple sur desktop | Backlog |

---

## 5. Services API couverts

| Service | Endpoints principaux |
|---|---|
| `authService` | login, login-pin, register (3 étapes), logout, refresh, pin setup/reset, forgot-password |
| `tontineService` | CRUD tontines, activer, suspendre, clôturer, modifier échéance, modifier réglages, simulation, commissions CRUD |
| `membreService` | list, add, updateStatut, retirer |
| `cycleService` | list, get, open, close (avec options remise B33), designers, aperçu remise |
| `cotisationService` | list (avec filtres statut + q), get, record, adminRecord, valider, update, recapCycle (avec echeanceId B32), recapTotal |
| `validationService` | valider (avec undo 5 s), validerPlusieurs (bulk B14), refuser (B18) |
| `meService` | listMesTontines (B01), getCotisantSummary (B04), getGestionSummary (B05), listCotisationsAValider (B06), listCotisationsParStatut (B07), listActivite (B09), getMesJackpots (B10) |
| `dashboardService` | getMyDashboard (B05), getPlatformDashboard |
| `notificationService` | list, unreadCount, markRead, markAllRead |
| `qrService` | getMonQr, regenererMonQr, resoudre, obtenirInvitation, revoquerInvitation, apercuInvitation, demanderAdhesion, listDemandesGestion, accepterDemande, refuserDemande, listMesDemandes |
| `prioriteService` | list, demander, attribuer, accepter, refuser, annuler |
| `userService` | getProfile, updateProfile, searchUser |
| `securiteService` | changePhone (OTP), changePassword, getSessions, deleteSession |
| `codeListService` | getByType, list, create, update |
| `lib/preferences` | chargerPreferences (GET B22), synchroniserPreferences (PUT B22, debounce 1,5 s) |
| `hooks/usePublicConfig` | GET /v1/public/config (B25) |

---

## 6. Hooks React Query

`useAuth`, `useMe` (useCotisantSummary, useGestionSummary, useActivite, useCotisationsAValider, useMaTontine, useMesRoles…), `useTontines`, `useCycles`, `useCotisations`, `useMembres`, `useNotifications`, `useQr`, `usePriorites`, `useDashboard`, `useCodeList`, `usePublicConfig`, `useLocalPreference`, `useFavoris`, `useTontineVue`, `useDemandeCiblee`, `useOnline`, `useMediaQuery`, `usePWA`.
