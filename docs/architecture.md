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
| `emissions` | titre, thématique, type (originale / marque), statut (en projet / active / en pause / archivée), `rss_url` (technique, pour l'Épic 5) | 1 émission → N épisodes |
| `episodes` | titre, résumé, numéro, statut pipeline, 7 dates clés (pré-production, enregistrement prévue/réelle, montage prévue, validation/mixage, publication prévue/effective) | N → 1 émission ; N ↔ N invités ; 1 → N enregistrements ; 1 → N diffusions ; N ↔ N campagnes |
| `invites` | identité, biographie, modalités de prise de contact, notes | N ↔ N épisodes via `episode_invites` |
| `invites_coordonnees` | coordonnées de contact (**données protégées**) | 1 ↔ 1 invité |
| `episode_invites` | liaison + date de rattachement (historique) | — |
| `enregistrements` | date/créneau, lieu (studio / distance), statut de prise de son (à planifier / planifié / en cours / enregistré / à réenregistrer / annulé), notes de montage | N → 1 épisode |
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
| episodes | L E S | L E (tout le pipeline, y c. « Publié ») | L + statut jusqu'à « Monté » | L + passage « Publié » | L |
| invites (fiche) | L E S | L E | L | L | L |
| invites_coordonnees | L E S | L E | — | — | — |
| episode_invites | L E S | L E | L | L | L |
| enregistrements | L E S | L E | L E | L | — |
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
Tranchés le 22/11/2026 :
- Passage « Publié » : Production, Diffusion, Direction.
- Réalisation : peut faire avancer un épisode jusqu'à « Monté ».
- Partenariats : actif dès la V1.

- Statuts émission, prise de son et dates clés : fournis le 22/11/2026 (voir `modele-de-donnees.md`).

En attente :
1. URL du flux RSS d'au moins une émission (Épic 5).
2. Valeur de N (jours au même statut) pour la règle de blocage.

Définitions Pilotage (22/11/2026) :
- **Point de blocage** = (a) une date prévue de l'épisode est dépassée sans changement de statut, ou (b) un enregistrement est « À réenregistrer », ou (c) l'épisode est au même statut depuis plus de N jours.
- **À venir** = épisodes dont la date de publication prévue est dans le futur.

Maquettes (US-08) : https://claude.ai/artifact/JhCLMyPpPjXyVNfNZo5uHK
