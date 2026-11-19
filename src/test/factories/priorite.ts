import type { PrioriteJackpot } from '@/types/priorite'

let seq = 0
const next = () => `p${++seq}`

export function unePriorite(surcharge: Partial<PrioriteJackpot> = {}): PrioriteJackpot {
  const id = surcharge.id ?? next()
  return {
    id,
    tontineId: 't1',
    membreId: 'm1',
    userId: 'u1',
    firstName: 'Test',
    lastName: 'User',
    statut: 'EN_ATTENTE',
    origine: 'DEMANDE_MEMBRE',
    motif: null,
    motifRefus: null,
    cycleId: null,
    createdAt: '2026-11-01T10:00:00Z',
    dateTraitement: null,
    ...surcharge,
  }
}
