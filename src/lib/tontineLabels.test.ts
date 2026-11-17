/**
 * Tests unitaires de src/lib/tontineLabels.ts
 *
 * Couvre : rythmeCourt, rythmeDe, rythmeLibre, dureeRythme, rythmeCourtDe,
 *           rythmePhraseDe, parRythme, dureeTour,
 *           jourEcheanceValide, echeancePhrase, heureLisible,
 *           aujourdhuiIso, joursAvant, compteARebours,
 *           modeRemiseLabel, capital, cohérence des constantes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  rythmeCourt, rythmeDe, rythmeLibre, dureeRythme, rythmeCourtDe, rythmePhraseDe,
  parRythme, dureeTour, jourEcheanceValide, echeancePhrase, heureLisible,
  aujourdhuiIso, joursAvant, compteARebours, modeRemiseLabel, capital,
  RYTHMES, RYTHME_PAR_DEFAUT, DECLENCHEMENTS, MODES_REMISE, ORDRE_LABEL,
  JOURS_SEMAINE, HEURE_ECHEANCE_DEFAUT,
} from './tontineLabels'

// ─── rythmeCourt ──────────────────────────────────────────────────────────────

describe('rythmeCourt', () => {
  it('renvoie « mois » pour MENSUEL', () => {
    expect(rythmeCourt('MENSUEL')).toBe('mois')
  })
  it('renvoie « jour » pour JOURNALIERE', () => {
    expect(rythmeCourt('JOURNALIERE')).toBe('jour')
  })
  it('renvoie « semaine » pour HEBDOMADAIRE', () => {
    expect(rythmeCourt('HEBDOMADAIRE')).toBe('semaine')
  })
  it('renvoie la valeur en minuscules pour un code inconnu', () => {
    expect(rythmeCourt('INCONNU')).toBe('inconnu')
  })
  it('renvoie une chaîne vide pour null', () => {
    expect(rythmeCourt(null)).toBe('')
  })
})

// ─── rythmeDe ─────────────────────────────────────────────────────────────────

describe('rythmeDe', () => {
  it('utilise rythmeIntervalle + rythmeUnite quand présents', () => {
    const r = rythmeDe({ rythmeIntervalle: 1, rythmeUnite: 'SEMAINE', frequence: 'MENSUEL' })
    expect(r?.intervalle).toBe(1)
    expect(r?.unite).toBe('SEMAINE')
    expect(r?.code).toBe('HEBDOMADAIRE')
  })

  it('replie sur frequence si rythmeIntervalle/rythmeUnite absents', () => {
    const r = rythmeDe({ frequence: 'MENSUEL' })
    expect(r?.intervalle).toBe(1)
    expect(r?.unite).toBe('MOIS')
  })

  it('renvoie null si ni rythme ni frequence connus', () => {
    expect(rythmeDe({ frequence: 'INCONNU' })).toBeNull()
  })

  it('renvoie null pour null', () => {
    expect(rythmeDe(null)).toBeNull()
  })

  it('renvoie null pour undefined', () => {
    expect(rythmeDe(undefined)).toBeNull()
  })
})

// ─── rythmeLibre ──────────────────────────────────────────────────────────────

describe('rythmeLibre', () => {
  it('renvoie un rythme connu du cran (intervalle 1, SEMAINE)', () => {
    const r = rythmeLibre(1, 'SEMAINE')
    expect(r.label).toBe('Chaque semaine')
    expect(r.horsLimite).toBeUndefined()
  })

  it('crée un rythme hors cran (intervalle 4, JOUR)', () => {
    const r = rythmeLibre(4, 'JOUR')
    expect(r.label).toBe('Tous les 4 jours')
    expect(r.horsLimite).toBe(true)
  })

  it('crée un rythme hors cran (intervalle 3, MOIS)', () => {
    const r = rythmeLibre(3, 'MOIS')
    expect(r.label).toBe('Tous les 3 mois')
    expect(r.code).toBe('TRIMESTRIEL')
  })
})

// ─── dureeRythme ──────────────────────────────────────────────────────────────

describe('dureeRythme', () => {
  it('renvoie « 1 jour » pour intervalle 1, JOUR', () => {
    expect(dureeRythme(rythmeLibre(1, 'JOUR'))).toBe('1 jour')
  })
  it('renvoie « 3 jours » pour intervalle 3, JOUR', () => {
    expect(dureeRythme(rythmeLibre(3, 'JOUR'))).toBe('3 jours')
  })
  it('renvoie « 1 semaine » pour intervalle 1, SEMAINE', () => {
    expect(dureeRythme(rythmeLibre(1, 'SEMAINE'))).toBe('1 semaine')
  })
  it('renvoie « 2 mois » pour intervalle 2, MOIS', () => {
    expect(dureeRythme(rythmeLibre(2, 'MOIS'))).toBe('2 mois')
  })
})

// ─── rythmeCourtDe ─────────────────────────────────────────────────────────────

describe('rythmeCourtDe', () => {
  it('renvoie « semaine » pour une tontine hebdomadaire (intervalle 1)', () => {
    expect(rythmeCourtDe({ rythmeIntervalle: 1, rythmeUnite: 'SEMAINE' })).toBe('semaine')
  })
  it('renvoie « 3 jours » pour une tontine tous les 3 jours', () => {
    expect(rythmeCourtDe({ rythmeIntervalle: 3, rythmeUnite: 'JOUR' })).toBe('3 jours')
  })
  it('replie sur rythmeCourt(frequence) si pas de rythme B26', () => {
    expect(rythmeCourtDe({ frequence: 'MENSUEL' })).toBe('mois')
  })
})

// ─── rythmePhraseDe ────────────────────────────────────────────────────────────

describe('rythmePhraseDe', () => {
  it('minuscule en début : « chaque semaine »', () => {
    expect(rythmePhraseDe(rythmeLibre(1, 'SEMAINE'))).toBe('chaque semaine')
  })
  it('minuscule en début : « tous les 3 jours »', () => {
    expect(rythmePhraseDe(rythmeLibre(3, 'JOUR'))).toBe('tous les 3 jours')
  })
})

// ─── parRythme ─────────────────────────────────────────────────────────────────

describe('parRythme', () => {
  it('renvoie « par jour » pour intervalle 1, JOUR', () => {
    expect(parRythme(rythmeLibre(1, 'JOUR'))).toBe('par jour')
  })
  it('renvoie « par semaine » pour intervalle 1, SEMAINE', () => {
    expect(parRythme(rythmeLibre(1, 'SEMAINE'))).toBe('par semaine')
  })
  it('renvoie « tous les 3 jours » pour intervalle 3, JOUR', () => {
    expect(parRythme(rythmeLibre(3, 'JOUR'))).toBe('tous les 3 jours')
  })
  it('renvoie « toutes les 2 semaines » pour intervalle 2, SEMAINE', () => {
    expect(parRythme(rythmeLibre(2, 'SEMAINE'))).toBe('toutes les 2 semaines')
  })
})

// ─── dureeTour ──────────────────────────────────────────────────────────────────

describe('dureeTour', () => {
  it('renvoie « 3 mois » pour 3 cotisations mensuelles', () => {
    expect(dureeTour(rythmeLibre(1, 'MOIS'), 3)).toBe('3 mois')
  })
  it('renvoie « 6 jours » pour 3 cotisations tous les 2 jours', () => {
    expect(dureeTour(rythmeLibre(2, 'JOUR'), 3)).toBe('6 jours')
  })
  it('renvoie « 4 semaines (environ 1 mois) » pour 4 cotisations hebdomadaires', () => {
    expect(dureeTour(rythmeLibre(1, 'SEMAINE'), 4)).toBe('4 semaines (environ 1 mois)')
  })
  it('renvoie « 2 semaines » pour 2 cotisations hebdomadaires (< 4 semaines, pas de repère mois)', () => {
    expect(dureeTour(rythmeLibre(1, 'SEMAINE'), 2)).toBe('2 semaines')
  })
})

// ─── jourEcheanceValide ────────────────────────────────────────────────────────

describe('jourEcheanceValide', () => {
  it('accepte un jour de la semaine pour SEMAINE (LUNDI)', () => {
    expect(jourEcheanceValide('SEMAINE', 'LUNDI')).toBe(true)
  })
  it('accepte DIMANCHE pour SEMAINE', () => {
    expect(jourEcheanceValide('SEMAINE', 'DIMANCHE')).toBe(true)
  })
  it('rejette un jour invalide pour SEMAINE', () => {
    expect(jourEcheanceValide('SEMAINE', 'LUNDI_X')).toBe(false)
  })
  it('accepte un numéro de jour (1–31) pour MOIS', () => {
    expect(jourEcheanceValide('MOIS', '15')).toBe(true)
  })
  it('accepte « DERNIER » pour MOIS', () => {
    expect(jourEcheanceValide('MOIS', 'DERNIER')).toBe(true)
  })
  it('rejette 0 pour MOIS', () => {
    expect(jourEcheanceValide('MOIS', '0')).toBe(false)
  })
  it('rejette 32 pour MOIS', () => {
    expect(jourEcheanceValide('MOIS', '32')).toBe(false)
  })
  it('accepte null (aucun jour imposé)', () => {
    expect(jourEcheanceValide('JOUR', null)).toBe(true)
  })
  it('rejette un jour pour JOUR', () => {
    expect(jourEcheanceValide('JOUR', 'LUNDI')).toBe(false)
  })
})

// ─── echeancePhrase ────────────────────────────────────────────────────────────

describe('echeancePhrase', () => {
  it('renvoie « le dimanche » pour SEMAINE + DIMANCHE', () => {
    expect(echeancePhrase({ rythmeUnite: 'SEMAINE', jourEcheance: 'DIMANCHE' })).toBe('le dimanche')
  })
  it('renvoie « le 15 du mois » pour MOIS + 15', () => {
    expect(echeancePhrase({ rythmeUnite: 'MOIS', jourEcheance: '15' })).toBe('le 15 du mois')
  })
  it('renvoie « le dernier jour du mois » pour MOIS + DERNIER', () => {
    expect(echeancePhrase({ rythmeUnite: 'MOIS', jourEcheance: 'DERNIER' })).toBe('le dernier jour du mois')
  })
  it('ajoute l\'heure si ce n\'est pas 23:59', () => {
    expect(echeancePhrase({ rythmeUnite: 'SEMAINE', jourEcheance: 'DIMANCHE', heureEcheance: '20:00' })).toBe('le dimanche, avant 20h')
  })
  it('n\'ajoute pas l\'heure si 23:59', () => {
    expect(echeancePhrase({ rythmeUnite: 'SEMAINE', jourEcheance: 'DIMANCHE', heureEcheance: '23:59' })).toBe('le dimanche')
  })
  it('renvoie « » si aucun jour imposé', () => {
    expect(echeancePhrase({ rythmeUnite: 'JOUR', jourEcheance: null })).toBe('')
  })
  it('renvoie « » pour null', () => {
    expect(echeancePhrase(null)).toBe('')
  })
})

// ─── heureLisible ──────────────────────────────────────────────────────────────

describe('heureLisible', () => {
  it('renvoie « 20h » pour « 20:00 »', () => {
    expect(heureLisible('20:00')).toBe('20h')
  })
  it('renvoie « 23h59 » pour « 23:59 »', () => {
    expect(heureLisible('23:59')).toBe('23h59')
  })
  it('renvoie « 23h59 » pour null (défaut)', () => {
    expect(heureLisible(null)).toBe('23h59')
  })
})

// ─── aujourdhuiIso / joursAvant / compteARebours ───────────────────────────────

describe('aujourdhuiIso', () => {
  beforeEach(() => { vi.setSystemTime(new Date('2026-11-16T12:00:00Z')) })
  afterEach(() => { vi.useRealTimers() })

  it('renvoie la date du jour au format yyyy-mm-dd', () => {
    expect(aujourdhuiIso()).toBe('2026-11-16')
  })
})

describe('joursAvant', () => {
  beforeEach(() => { vi.setSystemTime(new Date('2026-11-16T12:00:00Z')) })
  afterEach(() => { vi.useRealTimers() })

  it('renvoie 5 pour une date dans 5 jours', () => {
    expect(joursAvant('2026-11-21')).toBe(5)
  })
  it('renvoie 0 pour aujourd\'hui (peut être -0 selon le moment de la journée)', () => {
    // Math.ceil d'une valeur très proche de 0 peut donner -0 — c'est le comportement de la fonction
    expect(Math.abs(joursAvant('2026-11-16') as number)).toBe(0)
  })
  it('renvoie un nombre négatif pour une date passée', () => {
    expect(joursAvant('2026-11-10')).toBe(-6)
  })
  it('renvoie null pour null', () => {
    expect(joursAvant(null)).toBeNull()
  })
})

describe('compteARebours', () => {
  beforeEach(() => { vi.setSystemTime(new Date('2026-11-16T12:00:00Z')) })
  afterEach(() => { vi.useRealTimers() })

  it('renvoie « J-5 » pour une date dans 5 jours', () => {
    expect(compteARebours('2026-11-21')).toBe('J-5')
  })
  it('renvoie « Aujourd\'hui » pour le jour même', () => {
    expect(compteARebours('2026-11-16')).toBe("Aujourd'hui")
  })
  it('renvoie « J+3 » pour une date passée de 3 jours', () => {
    expect(compteARebours('2026-11-13')).toBe('J+3')
  })
  it('renvoie null pour null', () => {
    expect(compteARebours(null)).toBeNull()
  })
})

// ─── modeRemiseLabel / capital ─────────────────────────────────────────────────

describe('modeRemiseLabel', () => {
  it('renvoie le libellé pour DISPONIBLE', () => {
    expect(modeRemiseLabel('DISPONIBLE')).toBe('Remettre ce qui est collecté')
  })
  it('renvoie le libellé pour ATTENDRE', () => {
    expect(modeRemiseLabel('ATTENDRE')).toBe('Attendre que tout soit payé')
  })
  it('renvoie le libellé par défaut pour null', () => {
    expect(modeRemiseLabel(null)).toBe('Remettre ce qui est collecté')
  })
})

describe('capital', () => {
  it('met la première lettre en majuscule', () => {
    expect(capital('bonjour')).toBe('Bonjour')
  })
  it('laisse une chaîne déjà capitalisée', () => {
    expect(capital('Bonjour')).toBe('Bonjour')
  })
  it('renvoie une chaîne vide inchangée', () => {
    expect(capital('')).toBe('')
  })
})

// ─── Cohérence des constantes ──────────────────────────────────────────────────

describe('constantes', () => {
  it('RYTHMES contient au moins 9 crans', () => {
    expect(RYTHMES.length).toBeGreaterThanOrEqual(9)
  })
  it('RYTHME_PAR_DEFAUT est le dernier cran (MENSUEL)', () => {
    expect(RYTHME_PAR_DEFAUT.unite).toBe('MOIS')
    expect(RYTHME_PAR_DEFAUT.intervalle).toBe(1)
  })
  it('DECLENCHEMENTS contient FIN_DU_TOUR et TOUS_PAYES', () => {
    expect(DECLENCHEMENTS.map((d) => d.value)).toEqual(['FIN_DU_TOUR', 'TOUS_PAYES'])
  })
  it('MODES_REMISE contient 4 options', () => {
    expect(MODES_REMISE.length).toBe(4)
  })
  it('ORDRE_LABEL contient ROTATION, ALEATOIRE, MANUEL', () => {
    expect(Object.keys(ORDRE_LABEL).sort()).toEqual(['ALEATOIRE', 'MANUEL', 'ROTATION'])
  })
  it('JOURS_SEMAINE contient 7 jours', () => {
    expect(JOURS_SEMAINE.length).toBe(7)
  })
  it('HEURE_ECHEANCE_DEFAUT est « 23:59 »', () => {
    expect(HEURE_ECHEANCE_DEFAUT).toBe('23:59')
  })
})
