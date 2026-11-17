---
inclusion: always
---
# Règles de test — les tests sont la source de vérité

Le refactoring du front (spec 02) s'appuie sur les tests écrits dans la spec 01.
**Un test vert avant un changement doit rester vert après**, sans modification, sauf changement de comportement voulu et documenté.

## Règles
1. **Tester le comportement, pas l'implémentation.** Requêtes Testing Library par rôle, libellé ou texte visible
   (`getByRole`, `getByLabelText`, `findByText`). Pas de sélecteur CSS, pas de `data-testid` sauf dernier recours,
   pas d'accès à l'état interne d'un composant, pas de mock des hooks internes.
2. **Le réseau est simulé avec MSW**, jamais en mockant `axios` ou les services. Les handlers vivent dans
   `src/test/msw/handlers/<domaine>.ts`. Une requête non prévue fait échouer le test (`onUnhandledRequest: 'error'`).
3. **Vérifier ce qui part au backend** : pour toute action qui écrit (POST/PUT/PATCH/DELETE), le test capture le corps
   de la requête dans le handler MSW et vérifie les champs envoyés.
4. **Temps maîtrisé** : `vi.useFakeTimers()` + `vi.setSystemTime()` pour tout ce qui dépend de la date ; fuseau `Africa/Dakar`.
5. **Un QueryClient neuf par test** (`retry: false`), `localStorage` vidé entre les tests.
6. **Pas de gros snapshots de DOM.** Un snapshot n'est accepté que pour un objet de données (ex. corps de requête).
7. **Tests de caractérisation** : leur `describe` commence par `[caractérisation]`. Ils figent le comportement actuel.
   Pendant le refactoring, **interdiction de les modifier** pour les faire passer : si l'un d'eux casse, on corrige le code.
   Si un changement de comportement est réellement voulu, s'arrêter et demander validation avant de toucher au test.
8. Nommer les tests en français, au présent : `it('affiche le montant en francs CFA sans décimale')`.
9. Fichiers de test à côté du code : `format.ts` → `format.test.ts` ; écrans : `XxxPage.test.tsx`.

## Outils de test partagés
- `src/test/setup.ts` : matchers jest-dom, cycle de vie MSW, nettoyage, mocks navigateur (matchMedia, share, PWA).
- `src/test/render.tsx` : `renderWithProviders(ui, { route, auth })` (QueryClient + MemoryRouter + AuthProvider).
- `src/test/factories/` : constructeurs de données de test typés (`uneTontine()`, `uneCotisation()`…).
- `src/test/msw/` : `server.ts` + handlers par domaine.
