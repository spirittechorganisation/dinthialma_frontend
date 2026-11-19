import { describe, it, expect, beforeEach } from 'vitest'
import { memoriserRetour, consommerRetour } from './retour'

describe('memoriserRetour / consommerRetour', () => {
  beforeEach(() => sessionStorage.clear())

  it('mémorise puis consomme un chemin valide', () => {
    memoriserRetour('/tontine/t1')
    expect(consommerRetour()).toBe('/tontine/t1')
  })

  it('consommerRetour vide la valeur (consommation unique)', () => {
    memoriserRetour('/tontine/t1')
    consommerRetour()
    expect(consommerRetour()).toBeNull()
  })

  it('refuse un chemin ne commençant pas par /', () => {
    memoriserRetour('http://evil.com')
    expect(consommerRetour()).toBeNull()
  })

  it('refuse un chemin commençant par // (protection open redirect)', () => {
    memoriserRetour('//evil.com')
    expect(consommerRetour()).toBeNull()
  })

  it('renvoie null si rien n\'a été mémorisé', () => {
    expect(consommerRetour()).toBeNull()
  })
})
