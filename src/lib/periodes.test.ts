/**
 * Tests unitaires de src/lib/periodes.ts (FR23)
 *
 * Couvre : aujourdhuiDakar, jourMois, dateDebutPassee, periodeNonCommencee, periodePayable,
 *          blocageCloture, texteNonOuverte, erreurTontine (5 codes, repli sur le message du serveur).
 */
import { describe, it, expect } from 'vitest'
import { AxiosError } from 'axios'
import {
  aujourdhuiDakar, jourMois, dateDebutPassee, periodeNonCommencee, periodePayable,
  blocageCloture, texteNonOuverte, erreurTontine,
} from './periodes'
import { TontineType } from '@/types/tontine'

/** Erreur Axios avec le corps d'erreur du backend */
function errAxios(status: number, code?: string, message?: string): AxiosError {
  return new AxiosError('Request failed', undefined, undefined, undefined, {
    status,
    data: { status: 'error', statusCode: status, code, message },
  } as never)
}

// 22/11/2026 à 10h, heure de Dakar (UTC+0)
const MAINTENANT = new Date('2026-11-22T10:00:00Z')
const EVT = TontineType.EVENEMENTIELLE
const ROT = TontineType.ROTATIVE

describe('aujourdhuiDakar', () => {
  it('donne la date du jour au format AAAA-MM-JJ', () => {
    expect(aujourdhuiDakar(MAINTENANT)).toBe('2026-11-22')
  })

  it('suit l\'heure de Dakar, pas celle du navigateur (23h30 UTC le 21 = encore le 21 à Dakar)', () => {
    expect(aujourdhuiDakar(new Date('2026-11-21T23:30:00Z'))).toBe('2026-11-21')
    expect(aujourdhuiDakar(new Date('2026-11-22T00:05:00Z'))).toBe('2026-11-22')
  })
})

describe('jourMois', () => {
  it.each([
    ['2026-11-23', '23/11'],
    ['2026-12-31T23:59:00Z', '31/12'],
    ['', ''],
    [null, ''],
  ])('%s → « %s »', (iso, attendu) => {
    expect(jourMois(iso)).toBe(attendu)
  })
})

describe('dateDebutPassee', () => {
  it('signale une date antérieure à aujourd\'hui', () => {
    expect(dateDebutPassee('2026-11-21', MAINTENANT)).toBe(true)
  })

  it('accepte aujourd\'hui et une date future', () => {
    expect(dateDebutPassee('2026-11-22', MAINTENANT)).toBe(false)
    expect(dateDebutPassee('2026-12-01', MAINTENANT)).toBe(false)
  })

  it('ne signale rien pour une date vide (la validation du formulaire s\'en charge)', () => {
    expect(dateDebutPassee('', MAINTENANT)).toBe(false)
    expect(dateDebutPassee(undefined, MAINTENANT)).toBe(false)
  })
})

describe('periodeNonCommencee / periodePayable', () => {
  it('une période qui commence demain n\'est pas commencée', () => {
    expect(periodeNonCommencee({ dateDebut: '2026-11-23' }, MAINTENANT)).toBe(true)
    expect(periodeNonCommencee({ dateDebut: '2026-11-22' }, MAINTENANT)).toBe(false)
  })

  it('événementielle : pas de paiement avant le premier jour de la période (B47)', () => {
    expect(periodePayable(EVT, { dateDebut: '2026-11-23' }, MAINTENANT)).toBe(false)
    expect(periodePayable(EVT, { dateDebut: '2026-11-22' }, MAINTENANT)).toBe(true)
  })

  it('rotative : le paiement d\'avance reste permis', () => {
    expect(periodePayable(ROT, { dateDebut: '2026-11-23' }, MAINTENANT)).toBe(true)
  })
})

describe('blocageCloture', () => {
  it('événementielle : période pas commencée → TOUR_NON_COMMENCE avec la date', () => {
    expect(blocageCloture(EVT, { dateDebut: '2026-11-23', dateFin: '2026-11-23' }, false, MAINTENANT)).toEqual({
      code: 'TOUR_NON_COMMENCE',
      texte: 'Cette période commence le 23/11 : vous pourrez la clôturer à partir de ce jour-là.',
    })
  })

  it('rotative pas commencée : bloquée, sauf si tout le monde a déjà payé (remise anticipée)', () => {
    expect(blocageCloture(ROT, { dateDebut: '2026-11-23' }, false, MAINTENANT)?.code).toBe('TOUR_NON_COMMENCE')
    expect(blocageCloture(ROT, { dateDebut: '2026-11-23', tousPayes: true }, false, MAINTENANT)).toBeNull()
  })

  it('événementielle : dernière période avant son dernier jour → CLOTURE_FINALE_PREMATUREE', () => {
    const b = blocageCloture(EVT, { dateDebut: '2026-11-22', dateFin: '2026-12-31' }, true, MAINTENANT)
    expect(b?.code).toBe('CLOTURE_FINALE_PREMATUREE')
    expect(b?.texte).toContain('à partir du 31/12')
    expect(b?.texte).toContain('clôturez la tontine')
  })

  it('dernière période à son dernier jour, ou période intermédiaire : clôture possible', () => {
    expect(blocageCloture(EVT, { dateDebut: '2026-11-22', dateFin: '2026-11-22' }, true, MAINTENANT)).toBeNull()
    expect(blocageCloture(EVT, { dateDebut: '2026-11-22', dateFin: '2026-11-28' }, false, MAINTENANT)).toBeNull()
  })

  it('rotative commencée : jamais bloquée (remise avant l\'échéance permise)', () => {
    expect(blocageCloture(ROT, { dateDebut: '2026-11-20', dateFin: '2026-12-31' }, true, MAINTENANT)).toBeNull()
  })
})

describe('texteNonOuverte', () => {
  it('donne la date de la période quand elle est connue', () => {
    expect(texteNonOuverte('2026-11-23')).toBe('Cette période commence le 23/11 : les paiements s\'enregistrent à partir de ce jour-là.')
    expect(texteNonOuverte(undefined)).toBe('Cette période n’est pas encore ouverte au paiement.')
  })
})

describe('erreurTontine', () => {
  it('DATE_DEBUT_PASSEE : texte front, quel que soit le message du serveur', () => {
    expect(erreurTontine(errAxios(400, 'DATE_DEBUT_PASSEE', 'La date de début (21/11/2026) est passée'))).toEqual({
      code: 'DATE_DEBUT_PASSEE',
      texte: 'La date de début est passée : choisissez aujourd’hui ou une date future.',
    })
  })

  it('TOUR_NON_COMMENCE : date de l\'écran ; sans elle, message du serveur', () => {
    const err = errAxios(400, 'TOUR_NON_COMMENCE', 'Ce sous-cycle commence le 23/11/2026')
    expect(erreurTontine(err, { evenement: true, dateDebut: '2026-11-23' }).texte).toBe('Cette période commence le 23/11 : vous pourrez la clôturer à partir de ce jour-là.')
    expect(erreurTontine(err).texte).toBe('Ce sous-cycle commence le 23/11/2026')
  })

  it('CLOTURE_FINALE_PREMATUREE : renvoie vers la clôture de la tontine', () => {
    const r = erreurTontine(errAxios(400, 'CLOTURE_FINALE_PREMATUREE', 'x'), { evenement: true, dateFin: '2026-12-31' })
    expect(r.code).toBe('CLOTURE_FINALE_PREMATUREE')
    expect(r.texte).toContain('clôturez la tontine')
  })

  it('ECHEANCE_NON_OUVERTE : date de la période en événementielle, texte générique sinon', () => {
    const err = errAxios(400, 'ECHEANCE_NON_OUVERTE', 'Cette période commence le 23/11/2026')
    expect(erreurTontine(err, { evenement: true, dateDebut: '2026-11-23' }).texte).toBe(texteNonOuverte('2026-11-23'))
    expect(erreurTontine(err, { evenement: false }).texte).toBe('Cette cotisation n’est pas encore ouverte au paiement.')
  })

  it('MEMBRE_INACTIF : texte différent pour le membre et pour le gestionnaire', () => {
    const err = errAxios(400, 'MEMBRE_INACTIF', 'x')
    expect(erreurTontine(err, { role: 'membre' }).texte).toContain('Votre participation à cette tontine est suspendue ou terminée')
    expect(erreurTontine(err, { role: 'gestionnaire' }).texte).toContain('réactivez-le')
  })

  it('code absent : message du serveur, sinon texte de repli', () => {
    expect(erreurTontine(errAxios(400, undefined, 'Refus du serveur')).texte).toBe('Refus du serveur')
    expect(erreurTontine(errAxios(400), {}, 'Repli').texte).toBe('Repli')
  })
})
