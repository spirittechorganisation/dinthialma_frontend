/**
 * Tests de src/lib/share.ts
 *
 * Couvre : cheminQrDinthialma, shareLink (avec/sans navigator.share, refus),
 *           whatsappUrl, appUrl.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cheminQrDinthialma, shareLink, whatsappUrl, appUrl } from './share'

// ─── cheminQrDinthialma ─────────────────────────────────────────────────────

describe('cheminQrDinthialma', () => {
  it('reconnaît un token membre brut (m_8fK2…)', () => {
    expect(cheminQrDinthialma('m_8fK2abc123')).toBe('/q/m_8fK2abc123')
  })
  it('reconnaît un code d\'invitation (FAM7Q2K0)', () => {
    expect(cheminQrDinthialma('FAM7Q2K0')).toBe('/q/t/FAM7Q2K0')
  })
  it('reconnaît une URL complète avec /q/{token}', () => {
    expect(cheminQrDinthialma('https://dinthialma.com/q/m_8fK2abc')).toBe('/q/m_8fK2abc')
  })
  it('reconnaît une URL complète avec /q/t/{code}', () => {
    expect(cheminQrDinthialma('https://dinthialma.com/q/t/FAM7Q2K')).toBe('/q/t/FAM7Q2K')
  })
  it('renvoie null pour un texte qui n\'est pas un QR Dinthialma', () => {
    expect(cheminQrDinthialma('bonjour')).toBeNull()
  })
  it('renvoie null pour une URL non Dinthialma', () => {
    expect(cheminQrDinthialma('https://google.com')).toBeNull()
  })
  it('renvoie null pour une chaîne vide', () => {
    expect(cheminQrDinthialma('')).toBeNull()
  })
})

// ─── whatsappUrl / appUrl ──────────────────────────────────────────────────

describe('whatsappUrl', () => {
  it('construit une URL wa.me avec le texte encodé', () => {
    expect(whatsappUrl('Rejoins ma tontine')).toBe('https://wa.me/?text=Rejoins%20ma%20tontine')
  })
})

describe('appUrl', () => {
  it('renvoie window.location.origin', () => {
    expect(appUrl()).toBe(window.location.origin)
  })
})

// ─── shareLink ──────────────────────────────────────────────────────────────

describe('shareLink', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('utilise navigator.share quand disponible et renvoie true', async () => {
    vi.spyOn(navigator, 'share').mockResolvedValue(undefined)
    const result = await shareLink({ title: 'Test', text: 'Mon texte', url: 'https://test.com' })
    expect(navigator.share).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('renvoie true si l\' utilisateur annule le partage (AbortError)', async () => {
    vi.spyOn(navigator, 'share').mockRejectedValue(new DOMException('Annulé', 'AbortError'))
    const result = await shareLink({ title: 'Test', text: 'Mon texte', url: 'https://test.com' })
    expect(result).toBe(true)
  })

  it('replie sur le presse-papiers si navigator.share n\'est pas disponible', async () => {
    // navigator.share est déjà mocké dans setup.ts, on le supprime temporairement
    vi.spyOn(navigator, 'share').mockReturnValue(undefined as never)
    // @ts-expect-error — on simule l'absence de share
    delete navigator.share
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { writable: true, configurable: true, value: { writeText } })
    const result = await shareLink({ title: 'Test', text: 'Mon texte', url: 'https://test.com' })
    expect(writeText).toHaveBeenCalledWith('Mon texte https://test.com')
    expect(result).toBe(true)
    // Restaurer pour les autres tests
    Object.defineProperty(navigator, 'share', { writable: true, configurable: true, value: vi.fn().mockResolvedValue(undefined) })
  })
})
