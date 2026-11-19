---
inclusion: always
---
# Produit — Dinthialma (frontend)

Dinthialma est une PWA de **gestion de tontines** pour le Sénégal (logique « Wave » : une action principale par écran).
Elle est éditée par **Spirit Tech Revolution**.

## Utilisateurs
- **Membre (cotisant)** : déclare ses cotisations, suit ses jackpots, reçoit des rappels.
- **Gestionnaire** : crée et règle la tontine, valide ou encaisse les paiements, remet les jackpots, clôture.
- **Super-admin** : console plateforme (utilisateurs, tontines, référentiels).

## Principes produit (à respecter dans tout changement)
- Le gestionnaire décide, l'app accompagne (aperçus, rappels), elle ne décide jamais à sa place.
- **L'app ne détient aucun fonds** : le membre paie directement le gestionnaire, puis déclare ; le gestionnaire valide.
- Montants en **francs CFA entiers** ; fuseau **Africa/Dakar** pour toutes les dates.
- Interface **en français**, textes courts ; pensé pour **réseau faible** et petits écrans.
- Ajouter, jamais casser : une tontine existante ne change pas de comportement sans choix explicite.

## Références
- `docs/INVENTAIRE_FONCTIONNALITES.md` : fonctionnalités et routes (F01…F178).
- `docs/BESOINS_BACKEND.md` : contrat fonctionnel avec le backend (B01…B35).
- `api-docs.json` : contrat OpenAPI du backend.
