import { http } from 'msw'
import { API, ok, page } from '../api'

const FREQUENCES = [
  { id: 'f1', type: 'FREQUENCE_TONTINE', value: 'MENSUEL', description: 'Mensuel', systemAssign: true },
  { id: 'f2', type: 'FREQUENCE_TONTINE', value: 'HEBDOMADAIRE', description: 'Hebdomadaire', systemAssign: true },
]
const METHODES = [
  { id: 'm1', type: 'METHODE_PAIEMENT', value: 'WAVE', description: 'Wave', systemAssign: true },
  { id: 'm2', type: 'METHODE_PAIEMENT', value: 'ORANGE_MONEY', description: 'Orange Money', systemAssign: true },
  { id: 'm3', type: 'METHODE_PAIEMENT', value: 'FREE_MONEY', description: 'Free Money', systemAssign: true },
  { id: 'm4', type: 'METHODE_PAIEMENT', value: 'PI_SPI', description: 'PI SPI', systemAssign: true },
  { id: 'm5', type: 'METHODE_PAIEMENT', value: 'CASH', description: 'Espèces', systemAssign: true },
]
const ORDRES = [
  { id: 'o1', type: 'ORDRE_BENEFICIAIRE', value: 'ROTATION', description: 'Chacun son tour', systemAssign: true },
  { id: 'o2', type: 'ORDRE_BENEFICIAIRE', value: 'ALEATOIRE', description: 'Tirage au sort', systemAssign: true },
  { id: 'o3', type: 'ORDRE_BENEFICIAIRE', value: 'MANUEL', description: 'Manuel', systemAssign: true },
]

export const codeListHandlers = [
  http.get(`${API}/v1/code-list/type/FREQUENCE_TONTINE`, () => ok(FREQUENCES)),
  http.get(`${API}/v1/code-list/type/METHODE_PAIEMENT`, () => ok(METHODES)),
  http.get(`${API}/v1/code-list/type/ORDRE_BENEFICIAIRE`, () => ok(ORDRES)),
  http.get(`${API}/v1/code-list/type/STATUT_COTISATION`, () =>
    ok([{ id: 's1', type: 'STATUT_COTISATION', value: 'EN_ATTENTE', description: 'En attente', systemAssign: true }]),
  ),
  http.get(`${API}/v1/code-list`, () => page([...FREQUENCES, ...METHODES, ...ORDRES])),
  http.post(`${API}/v1/code-list`, () => ok({ id: 'cl-new', type: 'METHODE_PAIEMENT', value: 'TEST', description: 'Test', systemAssign: false })),
  http.put(`${API}/v1/code-list/:id`, ({ params }) =>
    ok({ id: String(params.id), type: 'METHODE_PAIEMENT', value: 'TEST', description: 'Modifié', systemAssign: false }),
  ),
]
