import type { Cycle } from '@/types/cycle'
import { CycleStatut } from '@/types/common'

let seq = 0
const next = () => `c${++seq}`

export function unCycle(surcharge: Partial<Cycle> = {}): Cycle {
  const id = surcharge.id ?? next()
  return {
    id,
    tontineId: 't1',
    numeroCycle: 1,
    statut: CycleStatut.EN_COURS,
    dateDebut: '2026-11-01',
    dateFin: '2026-11-30',
    montantJackpot: undefined,
    montantCommission: undefined,
    montantNet: undefined,
    gagnants: [],
    distributionParMembre: null,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    ...surcharge,
  }
}
