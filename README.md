# Onde Libre Studio — Application de pilotage

Application web unique de gestion éditoriale, des invités, des enregistrements, des diffusions et des campagnes sponsors du studio.

**En ligne** : https://onde-libre-studio-7rhg.vercel.app

## Documentation
| Pour… | Lire |
|---|---|
| Utiliser l'application | [`docs/guide-utilisateur.md`](docs/guide-utilisateur.md) |
| Maintenir / faire évoluer | [`docs/documentation-technique.md`](docs/documentation-technique.md) |
| Comprendre les choix | [`docs/architecture.md`](docs/architecture.md), [`docs/choix-integration.md`](docs/choix-integration.md) |
| La base de données | [`docs/modele-de-donnees.md`](docs/modele-de-donnees.md) |
| Les preuves de sécurité | [`docs/recette-securite.md`](docs/recette-securite.md) |
| Le cadrage (direction) | [`docs/note-de-cadrage.md`](docs/note-de-cadrage.md) |
| Reprendre avec un agent IA | [`agent.md`](agent.md) |

## Démarrage rapide
```bash
npm install
cp .env.example .env.local   # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev                  # développement
npm test                     # tests du connecteur RSS
npm run build                # build de production
```

Stack : React + Vite + TypeScript · Supabase (Postgres, Auth, RLS) · Vercel (+ Functions) · GitHub.

## Couverture du backlog (numérotation PRD)
| US | Livrable |
|---|---|
| 01 | `agent.md`, arborescence, conventions |
| 02 | `docs/architecture.md` |
| 03 | `docs/note-de-cadrage.md` |
| 04–05 | `supabase/migrations/*schema_initial*` (tables, clés, statuts contraints) |
| 06 | `supabase/migrations/*securite_rls*` (RLS sur 100 % des tables) |
| 07 | `docs/modele-de-donnees.md` |
| 08 | Maquettes Claude Design (lien dans `architecture.md`) |
| 09 | Écran Pipeline des épisodes |
| 10 | Écran Invités (annuaire, fiche, historique) |
| 11 | Écran Pilotage Direction (+ règles de blocage) |
| 12 | Connexion individuelle Supabase Auth |
| 13 | Rôles, écran Équipe, interface adaptée au rôle |
| 14 | `supabase/tests/cloisonnement_rls.sql` (46/46) + `docs/recette-securite.md` |
| 15 | `docs/choix-integration.md` |
| 16 | `api/rss-sync.ts` + section Diffusions |
| 17 | Gestion des 3 cas d'erreur, `tests/rss.test.ts` (13/13) |
| 18 | Dépôt GitHub `Dvilmax87/onde-libre-studio` |
| 19 | Déploiement Vercel |
| 20 | `docs/documentation-technique.md` |
| 21 | `docs/guide-utilisateur.md` |
