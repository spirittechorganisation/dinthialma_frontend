import type { Membre } from '@/types/membre'
import { MembreStatut, AccountStatus } from '@/types/common'

let seq = 0
const next = () => `m${++seq}`

export function unMembre(surcharge: Partial<Membre> = {}): Membre {
  const id = surcharge.id ?? next()
  return {
    id,
    tontineId: 't1',
    user: { id: `u-${id}`, firstName: 'Test', lastName: 'User', phone: '+221700000001', accountStatus: AccountStatus.ACTIVE },
    ordreJackpot: 1,
    statut: MembreStatut.ACTIF,
    dateAdhesion: '2026-01-01T00:00:00Z',
    aRecuJackpot: false,
    dateJackpot: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...surcharge,
  }
}
