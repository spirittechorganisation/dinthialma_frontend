import type { Tontine } from '@/types/tontine'
import { TontineStatut, ModeCycle } from '@/types/common'
import { TontineType } from '@/types/tontine'

let seq = 0
const next = () => `t${++seq}`

export function uneTontine(surcharge: Partial<Tontine> = {}): Tontine {
  const id = surcharge.id ?? next()
  return {
    id,
    tontineType: TontineType.ROTATIVE,
    nom: `Tontine ${id}`,
    montant: 5000,
    frequence: 'MENSUEL',
    rythmeIntervalle: 1,
    rythmeUnite: 'MOIS',
    dateDebut: '2026-01-01',
    nombreMembres: 12,
    nombreMembresActuels: 10,
    nombreGagnants: 1,
    statut: TontineStatut.ACTIVE,
    ordreBeneficiaire: 'ROTATION',
    modeCycle: ModeCycle.AUTOMATIQUE,
    creePar: { id: 'u-createur', firstName: 'Moussa', lastName: 'Diop', phone: '+221771234567' },
    monRole: 'MEMBRE',
    monMembreId: 'm1',
    monStatutMembre: 'ACTIF',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...surcharge,
  }
}
