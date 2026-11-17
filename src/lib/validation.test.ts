import { describe, it, expect } from 'vitest'
import { PHONE_REGEX, zPhone, zNom } from './validation'

describe('PHONE_REGEX', () => {
  it('accepte +221770000000', () => {
    expect(PHONE_REGEX.test('+221770000000')).toBe(true)
  })
  it('rejette un numéro sans +', () => {
    expect(PHONE_REGEX.test('221770000000')).toBe(false)
  })
  it('rejette une chaîne vide', () => {
    expect(PHONE_REGEX.test('')).toBe(false)
  })
})

describe('zPhone', () => {
  it('valide +221770000000', () => {
    expect(zPhone.safeParse('+221770000000').success).toBe(true)
  })
  it('rejette 77000000 (trop court, pas de +)', () => {
    expect(zPhone.safeParse('77000000').success).toBe(false)
  })
  it('rejette une chaîne vide', () => {
    expect(zPhone.safeParse('').success).toBe(false)
  })
})

describe('zNom', () => {
  it('valide un nom de 2 à 50 caractères', () => {
    expect(zNom(50).safeParse('Moussa').success).toBe(true)
  })
  it('rejette moins de 2 caractères', () => {
    expect(zNom(50).safeParse('M').success).toBe(false)
  })
  it('rejette plus de max caractères', () => {
    expect(zNom(5).safeParse('Moussa').success).toBe(false)
  })
  it('trim les espaces avant validation', () => {
    expect(zNom(50).safeParse('  Moussa  ').success).toBe(true)
  })
})
