/** FR31 — Verrou entre onglets pour le renouvellement des jetons. */
import { describe, it, expect } from 'vitest'
import { avecVerrouOnglets } from './verrouOnglets'

/** Verrou exclusif minimal, comme navigator.locks : les tâches d'un même nom passent l'une après l'autre */
function verrous() {
  let file = Promise.resolve() as Promise<unknown>
  const noms: string[] = []
  return {
    noms,
    request<T>(nom: string, tache: () => Promise<T>): Promise<T> {
      noms.push(nom)
      const p = file.then(tache)
      file = p.catch(() => undefined)
      return p
    },
  }
}

describe('FR31 avecVerrouOnglets', () => {
  it('avec navigator.locks : les tâches ne se chevauchent pas', async () => {
    const v = verrous()
    const ordre: string[] = []
    const tache = (n: string) => async () => { ordre.push(`début ${n}`); await new Promise((r) => setTimeout(r, 10)); ordre.push(`fin ${n}`); return n }

    const r = await Promise.all([avecVerrouOnglets('x', tache('A'), v), avecVerrouOnglets('x', tache('B'), v)])

    expect(r).toEqual(['A', 'B'])
    expect(ordre).toEqual(['début A', 'fin A', 'début B', 'fin B'])
    expect(v.noms).toEqual(['x', 'x'])
  })

  it('sans navigator.locks : la tâche s’exécute directement', async () => {
    await expect(avecVerrouOnglets('x', async () => 42, undefined)).resolves.toBe(42)
  })
})
