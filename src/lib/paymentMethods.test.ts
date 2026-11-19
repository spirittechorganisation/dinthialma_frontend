import { describe, it, expect } from 'vitest'
import {
  paymentMethodLabel, estDisponible, isMobileMoney, ordreMethode,
  PAYMENT_METHODS, METHODES_DISPONIBLES, METHODE_PAR_DEFAUT, METHODES_RETIREES,
} from './paymentMethods'

describe('paymentMethodLabel', () => {
  it('renvoie « Wave » pour WAVE', () => {
    expect(paymentMethodLabel('WAVE')).toBe('Wave')
  })
  it('renvoie « Espèces » pour CASH', () => {
    expect(paymentMethodLabel('CASH')).toBe('Espèces')
  })
  it('renvoie « — » pour null', () => {
    expect(paymentMethodLabel(null)).toBe('—')
  })
  it('renvoie « — » pour undefined', () => {
    expect(paymentMethodLabel(undefined)).toBe('—')
  })
  it('renvoie la valeur brute pour un code inconnu', () => {
    expect(paymentMethodLabel('INCONNU')).toBe('INCONNU')
  })
})

describe('estDisponible', () => {
  it('renvoie true pour CASH (dans METHODES_DISPONIBLES)', () => {
    expect(estDisponible('CASH')).toBe(true)
  })
  it('renvoie false pour WAVE (pas encore disponible)', () => {
    expect(estDisponible('WAVE')).toBe(false)
  })
  it('renvoie false pour null', () => {
    expect(estDisponible(null)).toBe(false)
  })
})

describe('isMobileMoney', () => {
  it('renvoie true pour WAVE', () => {
    expect(isMobileMoney('WAVE')).toBe(true)
  })
  it('renvoie false pour CASH', () => {
    expect(isMobileMoney('CASH')).toBe(false)
  })
  it('renvoie false pour null', () => {
    expect(isMobileMoney(null)).toBe(false)
  })
})

describe('ordreMethode', () => {
  it('renvoie l\'index dans PAYMENT_METHODS pour une valeur connue', () => {
    expect(ordreMethode('WAVE')).toBe(0)
    expect(ordreMethode('CASH')).toBe(3)
  })
  it('renvoie la longueur de PAYMENT_METHODS pour une valeur inconnue', () => {
    expect(ordreMethode('INCONNU')).toBe(PAYMENT_METHODS.length)
  })
})

describe('constantes', () => {
  it('METHODE_PAR_DEFAUT est CASH', () => {
    expect(METHODE_PAR_DEFAUT).toBe('CASH')
  })
  it('METHODES_RETIREES contient FREE_MONEY', () => {
    expect(METHODES_RETIREES).toContain('FREE_MONEY')
  })
  it('METHODES_DISPONIBLES contient CASH', () => {
    expect(METHODES_DISPONIBLES).toContain('CASH')
  })
})
