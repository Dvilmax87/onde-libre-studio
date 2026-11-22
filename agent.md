# agent.md — Mémoire projet Onde Libre Studio

> Fichier lu en premier par l'agent (Claude Code) à chaque session. À tenir à jour à chaque décision.

## 1. Contexte
- **Client** : Onde Libre Studio (SAS, Nantes), studio de podcasts indépendant, 11 collaborateurs.
- **Commanditaire** : Camille Vasseur (fondatrice-productrice, rôle Direction).
- **Objet** : application web unique de pilotage remplaçant 4 outils déconnectés (planification, contacts invités, publication, campagnes sponsors).
- **Sources de vérité** : `docs/PRD.pdf` (référence) et `docs/backlog.csv`. En cas d'écart, **le PRD prime** (décision du 22/11/2026).

## 2. Règle d'or
**Ne rien inventer.** Toute information métier absente du PRD est notée dans `docs/architecture.md` § « Points à valider » et soumise au Product Builder avant implémentation.

## 3. Stack
| Couche | Outil |
|---|---|
| Front | React + Vite + TypeScript, état global Zustand |
| Base, Auth, sécurité | Supabase (Postgres + Auth + RLS), projet `onde-libre-studio`, région eu-west-3 |
| Fonctions serveur | Netlify Functions (lecture du flux RSS, côté serveur pour éviter CORS) |
| Intégration externe | Flux RSS Apple Podcasts (décision du 22/11/2026) |
| Maquettes | Claude Design |
| Versionnage / hébergement | GitHub + Netlify |

## 4. Arborescence
```
onde-libre-studio/
├── agent.md                 # ce fichier
├── README.md
├── docs/
│   ├── architecture.md      # US-02
│   ├── note-de-cadrage.md   # US-03
│   ├── modele-de-donnees.md # US-07
│   ├── choix-integration.md # US-15 (PRD)
│   ├── documentation-technique.md # US-20
│   └── guide-utilisateur.md # US-21
├── supabase/
│   ├── migrations/          # SQL versionné, 1 fichier par changement
│   └── tests/               # tests de cloisonnement RLS
├── netlify/functions/       # fonctions serveur (RSS)
└── src/                     # application React
```

## 5. Conventions
- **Langue** : interface, docs et commentaires en français. Identifiants SQL/TS en français sans accents, `snake_case` en SQL, `camelCase` en TS.
- **SQL** : toute modification de schéma passe par un fichier `supabase/migrations/AAAAMMJJHHMM_description.sql`. RLS activé sur **toutes** les tables.
- **Sécurité** : double verrouillage. Chaque restriction existe dans l'UI **et** en RLS. L'UI ne fait jamais foi seule.
- **Secrets** : jamais commités. `.env.local` ignoré par git ; seule la clé publique (anon/publishable) côté client.
- **Commits** : format `type(portée): message` — ex. `feat(episodes): changement de statut`. Référencer l'US : `[US-09]`.
- **Erreurs API** : toute intégration externe gère les 3 cas (indisponible/délai, vide, invalide) sans bloquer l'app.

## 6. Rôles applicatifs (décidés)
`direction`, `production`, `realisation`, `diffusion`, `partenariats` (évolutif).
`realisation` = droits Production **sans accès aux coordonnées des invités** (décision du 22/11/2026).

## 7. Journal des décisions
| Date | Décision |
|---|---|
| 22/11/2026 | PRD = référence en cas d'écart avec le CSV |
| 22/11/2026 | Source externe : flux RSS Apple Podcasts |
| 22/11/2026 | Rôle Réalisation distinct, sans coordonnées invités |
| 22/11/2026 | Nouveau projet Supabase `onde-libre-studio` |
| 22/11/2026 | Champs V1 invité/sponsor : strictement ceux du PRD |
| 22/11/2026 | « Publié » : production, diffusion, direction |
| 22/11/2026 | Réalisation : statut épisode jusqu'à « Monté » |
| 22/11/2026 | Partenariats actif dès la V1 |
| 22/11/2026 | Valeurs statuts émission / prise de son + 7 dates clés épisode fournies |
| 22/11/2026 | Jalon 1 validé |

## 8. Avancement
- [x] Jalon 1 — Cadrage validé (Épic 1) — 22/11/2026
- [x] Épic 2 — Base de données (projet Supabase `vldwqnjfaiimshkzeaun`)
- [ ] Jalon 2 — Écrans connectés (Épic 3)
- [ ] Jalon 3 — Recette sécurité (Épic 4)
- [ ] Épic 5 — Intégration RSS
- [ ] Épic 6 — Production + documentation
