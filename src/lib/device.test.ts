import { describe, it, expect } from 'vitest'
import { describeDevice } from './device'

describe('describeDevice', () => {
  it('détecte Chrome sur Android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    const result = describeDevice(ua)
    expect(result).toContain('Chrome')
    expect(result).toContain('Android 14')
    expect(result).toContain('Pixel 7')
  })

  it('détecte Safari sur iOS avec iPhone', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    const result = describeDevice(ua)
    expect(result).toContain('Safari')
    expect(result).toContain('iOS 17')
    expect(result).toContain('iPhone')
  })

  it('détecte Edge sur Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    const result = describeDevice(ua)
    expect(result).toContain('Edge')
    expect(result).toContain('Windows')
  })

  it('détecte Firefox sur Linux', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0'
    const result = describeDevice(ua)
    expect(result).toContain('Firefox')
    expect(result).toContain('Linux')
  })

  it('renvoie « Navigateur » pour un user-agent inconnu', () => {
    expect(describeDevice('')).toContain('Navigateur')
  })
})
