/**
 * « Renvoyer le code » (FR31, SE07) : inactif avec un compte à rebours tant que le backend refuse un nouvel
 * envoi (OTP_RATE_LIMITED, `data.retryAfterSeconds`).
 */
import { useCompteARebours } from '@/hooks/useCompteARebours'
import { compteARebours } from '@/lib/securite'

export function RenvoyerCode({ jusqua, onClick }: { jusqua: number | null; onClick: () => void }) {
  const reste = useCompteARebours(jusqua)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={reste > 0}
      className="w-full h-11 text-sm text-primary-700 font-semibold text-center hover:underline disabled:text-neutral-400 disabled:no-underline"
    >
      {reste > 0 ? `Renvoyer le code dans ${compteARebours(reste)}` : 'Renvoyer le code'}
    </button>
  )
}
