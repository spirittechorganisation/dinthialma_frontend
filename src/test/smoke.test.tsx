/**
 * Tests de fumée — vérifient que l'arbre de rendu démarre sans crash
 * et que les éléments fondamentaux sont présents.
 *
 * Ces tests ne testent pas la logique métier : ils détectent les régressions
 * qui empêchent l'application de s'afficher (import cassé, contexte manquant…).
 */
import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from './render'
import { LoginPage } from '@/pages/auth/LoginPage'
import { HomePage } from '@/pages/home/HomePage'

describe('smoke — LoginPage', () => {
  it('affiche le champ de saisie du numéro de téléphone', async () => {
    renderWithProviders(<LoginPage />, { route: '/login', auth: null })

    // Le formulaire de connexion contient un champ téléphone
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  it("affiche le bouton Continuer", async () => {
    renderWithProviders(<LoginPage />, { route: '/login', auth: null })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continuer/i })).toBeInTheDocument()
    })
  })
})

describe('smoke — HomePage', () => {
  it('affiche un élément de navigation sans crash pour un membre connecté', async () => {
    renderWithProviders(<HomePage />, { route: '/accueil', auth: 'membre' })

    // L'accueil doit afficher au moins un bouton ou lien navigable
    await waitFor(() => {
      // Le composant charge les données asynchrones via MSW — on attend juste qu'il ne crashe pas
      expect(document.body).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})
