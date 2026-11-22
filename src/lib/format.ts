/** 125000 → « 125 000 » */
export function formatMontant(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('fr-FR')
}

/** 125000 → « 125 000 FCFA » */
export function formatFCFA(value: number | null | undefined): string {
  return `${formatMontant(value)} FCFA`
}

/**
 * Format « Wave » pour l'interface : 85000 → « 85.000F ».
 * Les reçus utilisent formatFcfaRecu (« 85.000 FCFA »).
 */
export function formatF(value: number | null | undefined): string {
  const n = Math.round(value ?? 0)
  return `${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}F`
}

/** Format des reçus : 5000 → « 5.000 FCFA » */
export function formatFcfaRecu(value: number | null | undefined): string {
  return `${formatF(value).slice(0, -1)} FCFA`
}

/** ISO → « 12 nov. » (ou « 12 nov. 2025 » si autre année) */
export function formatDateCourte(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** « 31 déc. » → « 31 déc » : une date abrégée en fin de phrase ne donne pas « 31 déc.. » */
export function sansPointFinal(texte: string): string {
  return texte.replace(/\.$/, '')
}

/** ISO → « 12 nov. · 14:30 » */
export function formatDateHeure(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${formatDateCourte(iso)} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Limite de paiement : « dim. 22 nov. » ; l'heure n'est ajoutée que si ce n'est pas la fin de journée
 * (« dim. 22 nov. à 20h »). Heure de Dakar, comme le backend.
 */
export function formatEcheance(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const tz = 'Africa/Dakar'
  const sameYear = d.getFullYear() === new Date().getFullYear()
  const jour = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: tz })
  // Une date seule (yyyy-mm-dd) n'a pas d'heure à afficher
  if (iso.length <= 10) return jour
  const [h, m] = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).split(':')
  if (h === '23' && m === '59') return jour
  return `${jour} à ${Number(h)}h${m !== '00' ? m : ''}`
}

/** Lecture/écriture localStorage protégées (navigation privée, stockage bloqué). */
export function safeGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
export function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}
