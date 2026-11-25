import { MutationCache, QueryClient } from '@tanstack/react-query'

/**
 * Toute mutation réussie (paiement, validation, clôture, ajout de membre…) rend obsolètes
 * les résumés de la couche « moi » (clés ['me', …]) : accueil, À valider, activité, jackpots.
 */
const mutationCache = new MutationCache({
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['me'] })
  },
})

export const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // FR31 : jamais de renvoi automatique d'une écriture. Un POST qui échoue sur le réseau a pu arriver au
      // serveur : le renvoyer doublerait un encaissement ou un retrait (pas de protection contre les doublons).
      // L'utilisateur voit l'erreur et décide lui-même de recommencer.
      retry: 0,
    },
  },
})
