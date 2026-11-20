/**
 * Tests de src/lib/exportCsv.ts
 *
 * Le CSV lui-même (séparateur « ; », échappement, BOM UTF-8) est produit par le BACKEND.
 * Côté front, `telechargerCsv` :
 *   - télécharge le fichier avec le jeton (GET + `format=csv` + paramètres, réponse en Blob) ;
 *   - lit le nom du fichier dans `Content-Disposition` (forme encodée UTF-8, entre guillemets,
 *     sans guillemets) ou prend le nom de repli ;
 *   - déclenche l'enregistrement via un lien temporaire, puis libère l'URL du Blob après 10 s.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { API, erreur } from '../test/msw/api'
import { server } from '../test/msw/server'
import { connecter } from '../test/auth'
import { telechargerCsv } from './exportCsv'

const URL_EXPORT = '/v1/tontines/t1/cotisations/export'
/** BOM UTF-8 ajouté par le backend en tête de fichier (ouverture directe dans Excel) */
const BOM = String.fromCharCode(0xfeff)
const CSV = BOM + 'Nom;Montant;Statut\r\n"Diop; Awa";5000;"VALIDEE"\r\n"Fall ""Le Grand""";10000;EN_ATTENTE\r\n'

/** Ce que le lien temporaire contenait au moment du clic */
interface Clic { href: string; download: string; dansLeDocument: boolean }

let clics: Clic[]
let blobs: Blob[]
let revoquees: string[]

/** Répond au GET d'export avec le CSV et l'en-tête Content-Disposition donné */
function repondreCsv(disposition?: string, capture?: (req: Request) => void) {
  server.use(
    http.get(`${API}${URL_EXPORT}`, ({ request }) => {
      capture?.(request)
      const headers: Record<string, string> = { 'Content-Type': 'text/csv;charset=UTF-8' }
      if (disposition) headers['Content-Disposition'] = disposition
      return new HttpResponse(CSV, { headers })
    }),
  )
}

beforeEach(() => {
  clics = []
  blobs = []
  revoquees = []
  // jsdom n'implémente ni createObjectURL / revokeObjectURL, ni la navigation d'un lien
  URL.createObjectURL = vi.fn((b: Blob) => {
    blobs.push(b)
    return `blob:http://localhost/${blobs.length}`
  })
  URL.revokeObjectURL = vi.fn((u: string) => { revoquees.push(u) })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clics.push({ href: this.href, download: this.download, dansLeDocument: document.body.contains(this) })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('telechargerCsv – requête envoyée', () => {
  it('envoie un GET avec le jeton, format=csv et les paramètres donnés', async () => {
    const token = connecter()
    let requete: Request | undefined
    repondreCsv('attachment; filename="paiements.csv"', (r) => { requete = r })

    await telechargerCsv(URL_EXPORT, { statut: 'VALIDEE', tourId: 'c1' }, 'repli.csv')

    expect(requete?.method).toBe('GET')
    expect(requete?.headers.get('Authorization')).toBe(`Bearer ${token}`)
    const params = new URL(requete!.url).searchParams
    expect(params.get('format')).toBe('csv')
    expect(params.get('statut')).toBe('VALIDEE')
    expect(params.get('tourId')).toBe('c1')
  })

  it('sérialise un paramètre tableau en valeurs répétées (statut=A&statut=B)', async () => {
    connecter()
    let requete: Request | undefined
    repondreCsv(undefined, (r) => { requete = r })

    await telechargerCsv(URL_EXPORT, { statut: ['VALIDEE', 'EN_ATTENTE'] }, 'repli.csv')

    expect(new URL(requete!.url).searchParams.getAll('statut')).toEqual(['VALIDEE', 'EN_ATTENTE'])
  })

  it('laisse un paramètre « format » fourni par l\'appelant remplacer « csv »', async () => {
    connecter()
    let requete: Request | undefined
    repondreCsv(undefined, (r) => { requete = r })

    await telechargerCsv(URL_EXPORT, { format: 'xlsx' }, 'repli.csv')

    expect(new URL(requete!.url).searchParams.get('format')).toBe('xlsx')
  })
})

describe('telechargerCsv – nom du fichier', () => {
  beforeEach(() => { connecter() })

  it.each([
    ['forme encodée UTF-8 (accents)', "attachment; filename*=UTF-8''paiements-tontine%20%C3%A9t%C3%A9.csv", 'paiements-tontine été.csv'],
    ['forme encodée prioritaire sur la forme simple', "attachment; filename=\"simple.csv\"; filename*=UTF-8''encod%C3%A9.csv", 'encodé.csv'],
    ['forme entre guillemets', 'attachment; filename="activite-2026-11.csv"', 'activite-2026-11.csv'],
    ['forme sans guillemets', 'attachment; filename=activite.csv', 'activite.csv'],
    ['casse de l\'en-tête ignorée', 'attachment; FILENAME="Export.CSV"', 'Export.CSV'],
  ])('lit le nom du fichier : %s', async (_cas, disposition, attendu) => {
    repondreCsv(disposition)

    await telechargerCsv(URL_EXPORT, {}, 'repli.csv')

    expect(clics).toHaveLength(1)
    expect(clics[0].download).toBe(attendu)
  })

  it('prend le nom de repli quand Content-Disposition est absent', async () => {
    repondreCsv(undefined)

    await telechargerCsv(URL_EXPORT, {}, 'paiements-Tontine du quartier.csv')

    expect(clics[0].download).toBe('paiements-Tontine du quartier.csv')
  })

  it('prend le nom de repli quand Content-Disposition ne contient pas de nom', async () => {
    repondreCsv('attachment')

    await telechargerCsv(URL_EXPORT, {}, 'repli.csv')

    expect(clics[0].download).toBe('repli.csv')
  })

  it('coupe un nom entre guillemets au premier point-virgule', async () => {
    // BUG: un nom légal entre guillemets contenant « ; » (RFC 6266) est tronqué :
    // `filename="Tontine A;B.csv"` donne « Tontine A » (sans extension) au lieu de « Tontine A;B.csv ».
    repondreCsv('attachment; filename="Tontine A;B.csv"')

    await telechargerCsv(URL_EXPORT, {}, 'repli.csv')

    expect(clics[0].download).toBe('Tontine A')
  })

  it('échoue si la forme encodée est mal formée, après le téléchargement', async () => {
    // BUG: un `filename*` mal encodé (« % » isolé) fait lever `decodeURIComponent` (URIError) :
    // l'export échoue alors que le fichier a été reçu, au lieu de prendre le nom de repli.
    repondreCsv("attachment; filename*=UTF-8''paiements%E9.csv")

    await expect(telechargerCsv(URL_EXPORT, {}, 'repli.csv')).rejects.toThrow(URIError)
    expect(clics).toHaveLength(0)
  })
})

describe('telechargerCsv – enregistrement du fichier', () => {
  beforeEach(() => { connecter() })

  it('déclenche l\'enregistrement avec le contenu reçu, sans le modifier (échappements compris)', async () => {
    repondreCsv('attachment; filename="paiements.csv"')

    await telechargerCsv(URL_EXPORT, {}, 'repli.csv')

    expect(blobs).toHaveLength(1)
    // Texte intact : « ; » dans un champ entre guillemets, guillemets doublés, fins de ligne CRLF.
    // Le BOM UTF-8 n'est pas vérifié ici : la simulation XHR de MSW le retire en construisant
    // un Blob (il est conservé en `arraybuffer`), alors qu'un navigateur garde les octets tels quels.
    // Le front ne touche pas au contenu : le BOM produit par le backend arrive donc dans le fichier.
    const texte = new TextDecoder().decode(await blobs[0].arrayBuffer())
    expect(texte).toBe(CSV.slice(BOM.length))
    expect(clics).toEqual([{ href: 'blob:http://localhost/1', download: 'paiements.csv', dansLeDocument: true }])
  })

  it('retire le lien temporaire du document après le clic', async () => {
    repondreCsv('attachment; filename="paiements.csv"')

    await telechargerCsv(URL_EXPORT, {}, 'repli.csv')

    expect(clics[0].dansLeDocument).toBe(true)
    expect(document.querySelectorAll('a[download]')).toHaveLength(0)
  })

  it('libère l\'URL du Blob 10 secondes après le téléchargement, pas avant', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    repondreCsv('attachment; filename="paiements.csv"')

    await telechargerCsv(URL_EXPORT, {}, 'repli.csv')

    vi.advanceTimersByTime(9_999)
    expect(revoquees).toEqual([])
    vi.advanceTimersByTime(1)
    expect(revoquees).toEqual(['blob:http://localhost/1'])
  })
})

describe('telechargerCsv – erreurs', () => {
  beforeEach(() => { connecter() })

  it.each([
    [403, 'FORBIDDEN'],
    [404, 'TONTINE_INTROUVABLE'],
    [500, 'ERREUR_INTERNE'],
  ])('rejette la promesse sur une erreur %i sans déclencher d\'enregistrement', async (status, code) => {
    server.use(http.get(`${API}${URL_EXPORT}`, () => erreur(status, code, 'Export impossible')))

    await expect(telechargerCsv(URL_EXPORT, {}, 'repli.csv')).rejects.toMatchObject({ response: { status } })
    expect(clics).toHaveLength(0)
    expect(blobs).toHaveLength(0)
  })

  it('rejette la promesse sur une erreur réseau sans déclencher d\'enregistrement', async () => {
    server.use(http.get(`${API}${URL_EXPORT}`, () => HttpResponse.error()))

    await expect(telechargerCsv(URL_EXPORT, {}, 'repli.csv')).rejects.toMatchObject({ code: 'ERR_NETWORK' })
    expect(clics).toHaveLength(0)
  })
})
