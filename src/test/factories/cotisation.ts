import type { Cotisation } from '@/types/cotisation'
import type { CotisationAValider } from '@/types/me'
import { CotisationStatut } from '@/types/common'

let seq = 0
const next = () => `cot${++seq}`

export function uneCotisation(surcharge: Partial<Cotisation> = {}): Cotisation {
  const id = surcharge.id ?? next()
  return {
    id,
    tontineId: 't1',
    cycleId: 'c1',
    numeroCycle: 1,
    membre: { membreId: 'm1', userId: 'u1', firstName: 'Test', lastName: 'User', phone: '+221700000001' },
    montant: 5000,
    methodePaiement: 'WAVE',
    statut: CotisationStatut.EN_ATTENTE,
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    ...surcharge,
  }
}

export function uneCotisationAValider(surcharge: Partial<CotisationAValider> = {}): CotisationAValider {
  return {
    ...uneCotisation(surcharge),
    tontineNom: surcharge.tontineNom ?? 'Famille',
  }
}
