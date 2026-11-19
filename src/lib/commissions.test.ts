import { describe, it, expect } from 'vitest'
import { TYPES_COMMISSION, valeurCommission } from './commissions'

describe('TYPES_COMMISSION', () => {
  it('contient 3 types', () => {
    expect(TYPES_COMMISSION.length).toBe(3)
  })
  it('contient POURCENTAGE_JACKPOT avec unité %', () => {
    const t = TYPES_COMMISSION.find((x) => x.value === 'POURCENTAGE_JACKPOT')
    expect(t?.unite).toBe('%')
  })
})

describe('valeurCommission', () => {
  it('affiche « 5 % » pour POURCENTAGE_JACKPOT valeur 5', () => {
    expect(valeurCommission({ type: 'POURCENTAGE_JACKPOT', valeur: 5 })).toBe('5 %')
  })
  it('affiche « 500F » pour FRAIS_FIXES_PAR_CYCLE valeur 500', () => {
    expect(valeurCommission({ type: 'FRAIS_FIXES_PAR_CYCLE', valeur: 500 })).toBe('500F')
  })
  it('affiche « 1.000F » pour FRAIS_ADHESION valeur 1000', () => {
    expect(valeurCommission({ type: 'FRAIS_ADHESION', valeur: 1000 })).toBe('1.000F')
  })
})
