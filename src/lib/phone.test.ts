import { describe, it, expect } from 'vitest'
import { toLocalPhone, formatPhoneLocal } from './phone'

describe('toLocalPhone', () => {
  it('retire l\'indicatif 221 (221771234567 → 771234567)', () => {
    expect(toLocalPhone('221771234567')).toBe('771234567')
  })
  it('retire tous les caractères non numériques', () => {
    expect(toLocalPhone('+221 77 123 45 67')).toBe('771234567')
  })
  it('renvoie une chaîne vide pour null', () => {
    expect(toLocalPhone(null)).toBe('')
  })
  it('renvoie une chaîne vide pour undefined', () => {
    expect(toLocalPhone(undefined)).toBe('')
  })
  it('laisse un numéro local sans 221 inchangé', () => {
    expect(toLocalPhone('771234567')).toBe('771234567')
  })
})

describe('formatPhoneLocal', () => {
  it('formate un numéro de 9 chiffres (771234567 → « 77 123 45 67 »)', () => {
    expect(formatPhoneLocal('221771234567')).toBe('77 123 45 67')
  })
  it('ne formate pas un numéro qui ne fait pas 9 chiffres', () => {
    expect(formatPhoneLocal('123')).toBe('123')
  })
  it('renvoie une chaîne vide pour null', () => {
    expect(formatPhoneLocal(null)).toBe('')
  })
})
