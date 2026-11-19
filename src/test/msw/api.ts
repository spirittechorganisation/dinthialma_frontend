/**
 * Helpers MSW partagés entre tous les handlers.
 *
 * - `API`      : racine des URLs simulées (correspondant à VITE_API_URL en test)
 * - `ok(data)` : enveloppe `CustomResponse` avec status 200
 * - `page()`   : format Spring Data paginé attendu par `toPage()`
 * - `erreur()` : corps d'erreur lu par `parseApiError` / `messageErreur`
 */
import { HttpResponse } from 'msw'

/** Base URL = VITE_API_URL + context-path `/api` */
export const API = 'http://api.test/api'

/** Enveloppe `CustomResponse<T>` — format de toutes les réponses nominales */
export function ok<T>(data: T, message = 'Opération réussie') {
  return HttpResponse.json({ status: 'success', statusCode: 200, message, data })
}

/**
 * Page Spring Data au format DTO (PageSerializationMode.VIA_DTO).
 * Compatible avec `toPage()` de `@/types/common`.
 */
export function page<T>(
  items: T[],
  opts: { page?: number; size?: number; total?: number } = {},
) {
  const number = opts.page ?? 0
  const size = opts.size ?? items.length
  const totalElements = opts.total ?? items.length
  const totalPages = Math.max(1, Math.ceil(totalElements / (size || 1)))
  return ok({
    content: items,
    page: { number, size, totalElements, totalPages },
  })
}

/** Corps d'erreur lu par `parseApiError` */
export function erreur(
  status: number,
  code: string,
  message = 'Erreur',
  data?: Record<string, unknown>,
) {
  return HttpResponse.json({ status: 'error', statusCode: status, code, message, data }, { status })
}
