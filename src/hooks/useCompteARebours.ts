import { useEffect, useState } from 'react'
import { secondesRestantes } from '@/lib/securite'

/** Secondes restantes avant `fin` (horodatage en ms), mises à jour chaque seconde ; 0 quand c'est fini */
export function useCompteARebours(fin: number | null): number {
  const [reste, setReste] = useState(() => secondesRestantes(fin))
  useEffect(() => {
    setReste(secondesRestantes(fin))
    if (!fin) return
    const t = setInterval(() => {
      const r = secondesRestantes(fin)
      setReste(r)
      if (r <= 0) clearInterval(t)
    }, 1000)
    return () => clearInterval(t)
  }, [fin])
  return reste
}
