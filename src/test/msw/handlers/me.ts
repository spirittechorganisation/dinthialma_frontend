import { http } from 'msw'
import { API, ok, page } from '../api'

export const meHandlers = [
  http.get(`${API}/v1/me/summary`, () =>
    ok({
      totalCotiseValide: 25000,
      totalEnAttente: 5000,
      totalJackpotsRecus: 0,
      nombreCotisationsDues: 1,
      montantDu: 5000,
      tontines: [{
        tontineId: 't1', nom: 'Famille', tontineType: 'ROTATIVE', statut: 'ACTIVE',
        monMembreId: 'm1', monStatutMembre: 'ACTIF', ordreJackpot: 1,
        aRecuJackpot: false, totalCotiseValide: 25000, totalEnAttente: 5000,
        toursPayes: 5, toursTotal: 12, totalJackpotsRecus: 0, nombreJackpotsRecus: 0,
        cycleEnCours: { cycleId: 'c1', numeroCycle: 6, dateDebut: '2026-11-01', dateFin: '2026-11-30' },
        cotisationDue: { montant: 5000, montantLibre: false, montantMinimum: null, dateLimite: '2026-11-30', statut: 'A_PAYER', cotisationId: null, echeancesEnRetard: 0 },
        gestionnaire: { firstName: 'Moussa', lastName: 'Diop', phone: '+221771234567' },
      }],
    }),
  ),
  http.get(`${API}/v1/me/activite`, () => page([])),
  http.get(`${API}/v1/me/jackpots`, () => ok({ totalRecu: 0, recus: [], aVenir: [] })),
  http.get(`${API}/v1/me/qr`, () => ok({ qrToken: 'qr-token-test', url: 'http://localhost/q/qr-token-test' })),
  http.post(`${API}/v1/me/qr/regenerer`, () => ok({ qrToken: 'qr-token-new', url: 'http://localhost/q/qr-token-new' })),
  http.get(`${API}/v1/me/preferences`, () =>
    ok({ tontinesFavorites: [], dernierMode: 'COTISE', masquerMontant: false, derniereTontineGeree: null }),
  ),
  http.put(`${API}/v1/me/preferences`, () => ok(null, 'Préférences enregistrées')),
  http.get(`${API}/v1/me/demandes`, () => page([])),
  http.get(`${API}/v1/me/gestion/demandes`, () => page([])),
]
