import { describe, it, expect } from 'vitest'
import { getHomePath } from './homePath'
import { UserRole } from '@/types/common'

describe('getHomePath', () => {
  it('renvoie /superadmin/dashboard pour SUPER_ADMIN', () => {
    expect(getHomePath([UserRole.SUPER_ADMIN])).toBe('/superadmin/dashboard')
  })
  it('renvoie /accueil pour MEMBER', () => {
    expect(getHomePath([UserRole.MEMBER])).toBe('/accueil')
  })
  it('renvoie /accueil pour ADMIN', () => {
    expect(getHomePath([UserRole.ADMIN])).toBe('/accueil')
  })
  it('renvoie /accueil pour USER', () => {
    expect(getHomePath([UserRole.USER])).toBe('/accueil')
  })
  it('renvoie /accueil pour un tableau vide', () => {
    expect(getHomePath([])).toBe('/accueil')
  })
  it('renvoie /accueil pour undefined', () => {
    expect(getHomePath(undefined)).toBe('/accueil')
  })
  it('renvoie /accueil pour null', () => {
    expect(getHomePath(null)).toBe('/accueil')
  })
  it('priorise SUPER_ADMIN sur MEMBER', () => {
    expect(getHomePath([UserRole.MEMBER, UserRole.SUPER_ADMIN])).toBe('/superadmin/dashboard')
  })
})
