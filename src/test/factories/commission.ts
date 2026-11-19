import type { Commission } from '@/types/tontine'

let seq = 0
const next = () => `com${++seq}`

export function uneCommission(surcharge: Partial<Commission> = {}): Commission {
  const id = surcharge.id ?? next()
  return {
    id,
    tontineId: 't1',
    type: 'POURCENTAGE_JACKPOT',
    valeur: 5,
    description: 'Frais de gestion',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...surcharge,
  }
}
