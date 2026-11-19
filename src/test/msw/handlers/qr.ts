import { http } from 'msw'
import { API, ok } from '../api'

export const qrHandlers = [
  http.get(`${API}/v1/qr/:token`, () =>
    ok({ type: 'MEMBRE', invitationCode: null, user: { id: 'u1', firstName: 'Test', lastName: 'User', accountStatus: 'ACTIVE' }, dansMesTontines: [] }),
  ),
  http.post(`${API}/v1/tontines/:tontineId/invitation`, () =>
    ok({ code: 'FAM-TEST', url: 'http://localhost/q/t/FAM-TEST', qrToken: 'inv-token' }),
  ),
  http.delete(`${API}/v1/tontines/:tontineId/invitation`, () => ok(null, 'Révoquée')),
  http.get(`${API}/v1/public/invitations/:code`, () =>
    ok({ code: 'FAM-TEST', nom: 'Famille', tontineType: 'ROTATIVE', montant: 5000, frequence: 'MENSUEL', montantLibre: false, placesRestantes: 2, gestionnairePrenom: 'Moussa', ouverte: true, dejaMembre: false, estGestionnaire: false, demandeEnAttente: false, tontineId: null }),
  ),
  http.post(`${API}/v1/invitations/:code/demandes`, () =>
    ok({ id: 'dem-1', tontineId: 't1', tontineNom: 'Famille', statut: 'EN_ATTENTE', userId: 'u1', firstName: 'Test', lastName: 'User', phone: null, message: null, motifRefus: null, membreId: null, createdAt: '2026-11-16T10:00:00Z', dateTraitement: null }),
  ),
  http.put(`${API}/v1/tontines/:tontineId/demandes/:demandeId/accepter`, () =>
    ok({ id: 'dem-1', statut: 'ACCEPTEE' }),
  ),
  http.put(`${API}/v1/tontines/:tontineId/demandes/:demandeId/refuser`, () =>
    ok({ id: 'dem-1', statut: 'REFUSEE' }),
  ),
]
