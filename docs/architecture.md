# Architecture technique — Onde Libre Studio (US-02)

Version 0.1 — 22/11/2026 — **à valider au Jalon 1**
Source : PRD « Onde Libre Studio — Cadrage Produit », §1 à §7. Les éléments absents du PRD sont signalés **[À VALIDER]**.

---

## 1. Vue d'ensemble

```
 Navigateur (React + Vite + TS, Zustand)
   │  supabase-js (clé publique) ──────────► Supabase
   │                                          ├─ Auth (comptes individuels)
   │                                          ├─ Postgres (6 entités + liaisons)
   │                                          └─ RLS par rôle (2e verrou)
   │
   └─ fetch /.netlify/functions/rss-sync ──► Netlify Function
                                              ├─ lit le flux RSS de l'émission
                                              ├─ valide et normalise
                                              └─ écrit dans `diffusions` (clé service, côté serveur)
 Hébergement : Netlify (déploiement depuis GitHub)
```

Principe de **double verrouillage** (PRD §4.2) : l'UI masque les vues et actions interdites ; la base refuse de toute façon toute lecture ou écriture hors périmètre (RLS).

## 2. Entités (PRD §3.2)

| Table | Champs (PRD) | Relations |
|---|---|---|
| `emissions` | titre, thématique, type (originale / marque), statut, `rss_url` (technique, pour l'Épic 5) | 1 émission → N épisodes |
| `episodes` | titre, résumé, numéro, statut pipeline, dates clés de production et publication | N → 1 émission ; N ↔ N invités ; 1 → N enregistrements ; 1 → N diffusions ; N ↔ N campagnes |
| `invites` | identité, biographie, modalités de prise de contact, notes | N ↔ N épisodes via `episode_invites` |
| `invites_coordonnees` | coordonnées de contact (**données protégées**) | 1 ↔ 1 invité |
| `episode_invites` | liaison + date de rattachement (historique) | — |
| `enregistrements` | date/créneau, lieu (studio / distance), statut de prise de son, notes de montage | N → 1 épisode |
| `diffusions` | plateforme, date de publication, lien, indicateurs rapatriés, date de synchro | N → 1 épisode |
| `campagnes_sponsors` | annonceur, périmètre, période (début/fin), données réservées | N ↔ N épisodes via `episode_campagnes` |
| `profils` | nom, rôle applicatif | 1 ↔ 1 compte Supabase Auth |

**Choix technique** : les coordonnées des invités sont isolées dans `invites_coordonnees`. Le RLS travaille par ligne, pas par colonne : cette séparation est le moyen fiable de montrer la fiche invité à Réalisation / Diffusion / Partenariats sans exposer les coordonnées.

### Statuts du pipeline (PRD §3.1) — contraints en base (US-05)
`idee` → `invite_confirme` → `enregistre` → `monte` → `publie`

## 3. Rôles & matrice des droits (PRD §2 + décision Réalisation)

L = lire · E = créer/modifier · S = supprimer · — = aucun accès

| Table | direction | production | realisation | diffusion | partenariats |
|---|---|---|---|---|---|
| emissions | L E S | L | L | L | L |
| episodes | L E S | L E | L E [À VALIDER] | L + passage « Publié » | L |
| invites (fiche) | L E S | L E | L | L | L [À VALIDER] |
| invites_coordonnees | L E S | L E | — | — | — |
| episode_invites | L E S | L E | L | L | L |
| enregistrements | L E S | L E | L E | L | — [À VALIDER] |
| diffusions | L E S | L | L | L E | L |
| campagnes_sponsors | L E S | — | — | — | L E |
| episode_campagnes | L E S | — | — | — | L E |
| profils | L E | propre profil | propre profil | propre profil | propre profil |

Sources : Direction « accès complet » ; Production « pas d'accès aux données sponsors » ; Diffusion « pas d'accès aux contrats sponsors ni aux coordonnées privées » ; Partenariats « campagnes et épisodes associés, sans coordonnées privées » ; backlog US-15 (CSV) « campagnes sponsors non accessibles hors périmètre ».

Mise en œuvre : fonction SQL `role_courant()` lisant `profils.role` de `auth.uid()`, utilisée dans chaque politique RLS. L'attribution des rôles est réservée à la Direction.

## 4. Écrans (PRD §3.3)

| # | Écran | Rôles | US |
|---|---|---|---|
| 1 | Pipeline épisodes : création, édition, changement de statut, filtres émission + statut | tous (actions selon rôle) | US-09 |
| 2 | Annuaire invités + fiche (contact, canal, historique des épisodes) | tous ; coordonnées : direction, production | US-10 |
| 3 | Pilotage Direction : en cours, à venir, publiés, blocages | direction | US-11 |
| 4 | Connexion + navigation adaptée au rôle | tous | US-12/13 |
| — | Diffusions par épisode (données RSS) | tous en lecture | US-16 |
| — | Campagnes sponsors | direction, partenariats | — |

## 5. Intégration externe (PRD §4.1, décision : flux RSS Apple Podcasts)

- Netlify Function `rss-sync` : reçoit un `emission_id`, lit `emissions.rss_url`, télécharge le flux (délai max 8 s), parse les `<item>`, rapproche chaque item d'un épisode, met à jour `diffusions` (plateforme « Apple Podcasts », date, lien).
- **Ce que le RSS fournit** : données de diffusion (titre, date de publication, lien, durée). **Il ne fournit pas de chiffres d'audience.** Le PRD accepte « diffusion **ou** audience » ; l'audience resterait une évolution (Ausha/Spotify).
- Gestion des 3 cas d'erreur (US-17), jamais bloquante, message visible à l'utilisateur :
  1. Indisponible / délai dépassé → « Service de diffusion injoignable, dernières données connues affichées (synchro du JJ/MM) ».
  2. Réponse vide / épisode absent du flux → « Aucune donnée de diffusion pour cet épisode ».
  3. Format invalide / incomplet → items rejetés journalisés, items valides conservés, message « Données partiellement invalides ».

## 6. Sécurité
- Supabase Auth email + mot de passe, un compte par collaborateur ; aucune inscription publique (comptes créés par la Direction).
- RLS activé sur 100 % des tables, aucune politique « publique ».
- Clé `service_role` uniquement dans les variables d'environnement Netlify (fonction serveur), jamais dans le front.
- Tests de cloisonnement SQL (`supabase/tests/`) : un compte Diffusion ne peut ni lire ni modifier coordonnées invités, campagnes sponsors, profils d'autrui (US-14 PRD).

## 7. Déploiement
GitHub (branche `main` protégée) → Netlify (build `vite build`, fonctions `netlify/functions`). Variables : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement).

## 8. Points à valider (Jalon 1)
1. **Passage au statut « Publié »** : la matrice PRD §2 le confie à Diffusion, mais le critère US-09 dit « un utilisateur Production peut faire évoluer l'épisode sur **tout** le pipeline ». Qui peut publier ?
2. **Droits de Réalisation sur le statut** : peut-elle faire avancer un épisode (ex. « Enregistré », « Monté ») ?
3. **Valeurs du statut d'une émission** : le PRD cite « statut » sans valeurs (seulement « 7 existants + 3 à venir »).
4. **Valeurs du statut de prise de son** (enregistrements) : non précisées.
5. **« Dates clés de production »** d'un épisode : lesquelles ? (le PRD ne les liste pas)
6. **Rôle Partenariats en V1** : comptes actifs dès la V1, ou rôle seulement préparé ?
7. **Flux RSS** : URL d'au moins une émission réelle (ou de test) pour l'Épic 5.
