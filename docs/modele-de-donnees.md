# Modèle de données — Onde Libre Studio (US-07)

Base : Supabase, projet `onde-libre-studio` (réf. `vldwqnjfaiimshkzeaun`, région eu-west-3 Paris).
Migrations : `supabase/migrations/` (appliquées le 22/11/2026).

## Schéma

```
emissions 1───N episodes N───N invites 1───1 invites_coordonnees
                 │   (episode_invites)
                 ├──1───N enregistrements
                 ├──1───N diffusions
                 └──N───N campagnes_sponsors (episode_campagnes)

auth.users 1───1 profils (rôle applicatif)
```

## Listes de valeurs (contraintes en base, type `enum`)

| Type | Valeurs (base → affichage) |
|---|---|
| `statut_episode` | `idee` Idée · `invite_confirme` Invité confirmé · `enregistre` Enregistré · `monte` Monté · `publie` Publié |
| `statut_emission` | `en_projet` En projet · `active` Active · `en_pause` En pause · `archivee` Archivée |
| `statut_prise_son` | `a_planifier` À planifier · `planifie` Planifié · `en_cours` En cours · `enregistre` Enregistré · `a_reenregistrer` À réenregistrer · `annule` Annulé |
| `type_emission` | `originale` Podcast original · `marque` Podcast de marque |
| `lieu_enregistrement` | `studio` Studio · `distance` À distance |
| `role_applicatif` | `direction` · `production` · `realisation` · `diffusion` · `partenariats` |

Toute valeur hors liste est refusée par la base (US-05).

## Tables

### `emissions`
| Colonne | Type | Règle |
|---|---|---|
| id | uuid | PK |
| titre | text | obligatoire, non vide |
| thematique | text | |
| type | type_emission | obligatoire |
| statut | statut_emission | défaut `en_projet` |
| rss_url | text | URL http(s) — source de l'intégration RSS |

### `episodes`
| Colonne | Type | Règle |
|---|---|---|
| id | uuid | PK |
| emission_id | uuid | FK → emissions, suppression d'émission bloquée si épisodes |
| titre | text | obligatoire, non vide |
| resume | text | |
| numero | integer | > 0, unique par émission |
| statut | statut_episode | défaut `idee` |
| date_preproduction | date | Date limite conducteur + recherches |
| date_enregistrement_prevue | timestamptz | Jour et heure de la session |
| date_enregistrement_reelle | timestamptz | Horodatage réel de la captation |
| date_montage_prevue | date | Échéance dérushage + montage |
| date_validation_mixage | date | Livraison version finale masterisée |
| date_publication_prevue | timestamptz | Mise en ligne programmée sur le flux RSS |
| date_publication_effective | timestamptz | Diffusion publique réelle |
| statut_modifie_le | timestamptz | Mis à jour automatiquement à chaque changement de statut |

### `invites` (fiche, visible par tous les rôles)
id · prenom · nom (obligatoire) · biographie · modalites_contact · notes

### `invites_coordonnees` (données protégées — Direction, Production)
invite_id (PK, FK → invites, cascade) · email · telephone

### `episode_invites` (historique des participations)
PK (episode_id, invite_id) · rattache_le. Suppression d'un invité bloquée s'il a participé à un épisode (historique préservé).

### `enregistrements`
id · episode_id (FK, cascade) · date_creneau · lieu · statut_prise_son (défaut `a_planifier`) · notes_montage

### `diffusions`
id · episode_id (FK, cascade) · plateforme (obligatoire) · date_publication · lien (URL) · indicateurs (jsonb) · source (`manuel` | `rss`) · synchronise_le. Unicité (episode_id, plateforme).

### `campagnes_sponsors` (Direction, Partenariats)
id · annonceur (obligatoire) · perimetre · date_debut · date_fin (≥ date_debut) · donnees_reservees

### `episode_campagnes`
PK (episode_id, campagne_id) · rattache_le

### `parametres_blocage` (seuils du Pilotage)
statut (PK, hors « Publié ») · jours (> 0, défaut 10). Lecture tous rôles, modification Direction.

### Vue `v_blocages` (security_invoker : respecte le RLS de l'appelant)
episode_id · regle (`date_depassee` | `a_reenregistrer` | `statut_fige`) · detail · depuis.
- `date_depassee` : une des 5 dates prévues est passée et le statut n'a pas changé depuis cette échéance.
- `a_reenregistrer` : un enregistrement de l'épisode est « À réenregistrer ».
- `statut_fige` : `episodes.statut_modifie_le` plus ancien que le seuil du statut.
Un épisode publié n'est jamais bloqué.

### `profils`
id (= auth.users.id) · nom · role (null = aucun accès). Créé automatiquement à la création du compte ; rôle attribué par la Direction.

Toutes les tables ont `cree_le` / `modifie_le` (mis à jour par trigger).

## Règles de sécurité (RLS)
- RLS actif sur les 10 tables ; aucun accès anonyme.
- `role_courant()` : renvoie le rôle de l'utilisateur connecté, utilisée par toutes les politiques.
- Matrice complète : `architecture.md` §3.
- Trigger `controle_maj_episode` (restriction par colonne) :
  - Réalisation : ne peut modifier que le statut, jamais vers ou depuis « Publié ».
  - Diffusion : ne peut modifier que le statut (uniquement vers « Publié ») et la date de publication effective.

## Vérifications du 22/11/2026 (transaction annulée)
| Test | Attendu | Obtenu |
|---|---|---|
| Diffusion lit coordonnées invités | 0 | 0 ✅ |
| Diffusion lit campagnes sponsors | 0 | 0 ✅ |
| Diffusion lit fiches invités | 1 | 1 ✅ |
| Diffusion lit profils | le sien seul | 1 ✅ |
| Diffusion modifie un titre | refus | erreur 42501 ✅ |
| Diffusion passe un épisode en Publié | OK | 1 ligne ✅ |
| Réalisation lit coordonnées | 0 | 0 ✅ |
| Réalisation modifie un épisode publié | 0 ligne | 0 ✅ |
| Direction lit coordonnées / campagnes / profils | tout | 1 / 1 / 3 ✅ |

La suite de tests complète et rejouable est livrée à l'Épic 4 (`supabase/tests/`).
