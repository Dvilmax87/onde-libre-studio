# Documentation technique — Onde Libre Studio (US-20)

Version 1.0 — 23/11/2026. Destinée à toute personne qui reprend la maintenance **sans connaissance préalable du projet**.

Documents liés : `architecture.md` (décisions et matrice des droits) · `modele-de-donnees.md` (tables, valeurs, règles) · `recette-securite.md` (preuves de cloisonnement) · `choix-integration.md` (flux RSS) · `guide-utilisateur.md` (usage) · `agent.md` (mémoire projet et journal des décisions).

---

## 1. Vue d'ensemble

| Élément | Où | Accès |
|---|---|---|
| Application en ligne | https://onde-libre-studio-7rhg.vercel.app | comptes individuels |
| Code source | GitHub `Dvilmax87/onde-libre-studio`, branche `main` | compte GitHub du studio |
| Hébergement | Vercel, projet `onde-libre-studio` (déploiement automatique à chaque push sur `main`) | compte Vercel du studio |
| Base de données + comptes | Supabase, projet `onde-libre-studio`, réf. `vldwqnjfaiimshkzeaun`, région Paris (eu-west-3) | compte Supabase du studio |

```
Navigateur ──► Vercel (fichiers React compilés)
    │
    ├── supabase-js (clé publique + session) ──► Supabase : Auth · Postgres · RLS
    │
    └── POST /api/rss-sync (jeton de session) ──► Vercel Function ──► flux RSS (Internet)
                                                        └──► Supabase (avec le jeton de l'utilisateur, RLS appliqué)
```

**Stack** : React 19 + Vite + TypeScript, Zustand (session), React Router, `@supabase/supabase-js`, `fast-xml-parser` (RSS).

## 2. Arborescence du code

```
agent.md                     Mémoire projet + journal des décisions (à lire en premier)
vercel.json                  Build Vite, routage SPA, en-têtes de sécurité
api/rss-sync.ts              Fonction serveur : synchronisation RSS (+ fonctions testées)
tests/rss.test.ts            13 tests du connecteur RSS (npm test)
supabase/migrations/*.sql    Historique du schéma, à appliquer dans l'ordre
supabase/tests/cloisonnement_rls.sql   46 tests de sécurité rejouables
src/
  main.tsx, App.tsx          Démarrage, garde d'authentification, routes
  styles.css                 Charte (couleurs, composants)
  lib/domaine.ts             Types, libellés, DROITS CÔTÉ INTERFACE (miroir du RLS)
  lib/supabase.ts            Client Supabase, traduction des erreurs en français
  lib/rss.ts                 Appel de la fonction RSS côté navigateur (ne lève jamais)
  store/session.ts           Session, profil, rôle (Zustand)
  components/                Layout (menu par rôle), EpisodeModal, Enregistrements, ResultatSynchro
  pages/                     Connexion, Pipeline, Invites, Emissions, Pilotage, Equipe
docs/                        Toute la documentation
```

## 3. Installation locale

Prérequis : Node.js 20+ et npm.

```bash
git clone https://github.com/Dvilmax87/onde-libre-studio.git
cd onde-libre-studio
npm install
cp .env.example .env.local   # puis renseigner les 2 valeurs VITE_ (Supabase › Project Settings › API)
npm run dev                  # http://localhost:5173
```

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Vérification TypeScript + build de production dans `dist/` |
| `npm test` | Tests du connecteur RSS |
| `npm run preview` | Sert le build localement |

La fonction `/api/rss-sync` ne tourne pas avec `npm run dev`. Pour la tester localement : `npx vercel dev`, ou tester directement en production.

## 4. Variables d'environnement

| Variable | Valeur | Où |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://vldwqnjfaiimshkzeaun.supabase.co` | Vercel (Production + Preview) et `.env.local` |
| `VITE_SUPABASE_ANON_KEY` | clé **publishable** Supabase (`sb_publishable_…`) | idem |

- Ces deux valeurs sont **publiques par conception** : sans compte connecté, elles ne donnent accès à aucune donnée (RLS).
- Elles sont **inscrites dans le code au moment du build** : après toute modification dans Vercel, il faut **relancer un déploiement**. Si elles manquent, l'application affiche « Configuration manquante ».
- La fonction RSS lit les mêmes variables. **Aucune clé secrète (`service_role`) n'est utilisée nulle part**. Ne jamais en ajouter côté navigateur.

## 5. Base de données

Détail complet : `modele-de-donnees.md`. Points essentiels :

- **9 tables** : `emissions`, `episodes`, `invites`, `invites_coordonnees` (données protégées, isolées), `episode_invites`, `enregistrements`, `diffusions`, `campagnes_sponsors`, `episode_campagnes`. S'y ajoutent `profils` (rôle de chaque compte) et `parametres_blocage` (seuils du Pilotage).
- **Valeurs contraintes** par types `enum` : statuts d'épisode, d'émission et de prise de son, rôles. Toute valeur hors liste est refusée.
- **Vue `v_blocages`** : calcule les 3 règles de blocage. Elle s'exécute avec les droits de l'appelant.
- **Triggers** :
  - `maj_horodatage` : date de modification ;
  - `maj_statut_modifie_le` : date du dernier changement de statut ;
  - `creer_profil` : profil créé à chaque nouveau compte ;
  - `controle_maj_episode` : colonnes modifiables par Réalisation et Diffusion ;
  - `controle_maj_profil` : garde-fous de l'écran Équipe.

### Modifier le schéma (procédure)
1. Créer `supabase/migrations/AAAAMMJJHHMM_description.sql`. Ne **jamais** modifier une migration déjà appliquée.
2. L'appliquer : Supabase › SQL Editor › coller › Run (ou `supabase db push` avec la CLI).
3. Supabase › Advisors › Security : aucune alerte nouvelle. Seule `role_courant` est attendue, voir § 6.
4. Rejouer `supabase/tests/cloisonnement_rls.sql` : toutes les lignes doivent avoir `ok = true`.
5. Si le schéma touche l'interface, mettre à jour `src/lib/domaine.ts`.
6. Committer la migration avec le code (`feat(base): … [US-xx]`).

## 6. Sécurité

**Double verrouillage** (PRD §4.2) :
1. **Interface** : `src/lib/domaine.ts` › objet `peut` et `statutsAutorises()` décident des menus, écrans et boutons visibles.
2. **Base** : RLS activé sur toutes les tables, accès anonyme révoqué. La fonction `role_courant()` lit le rôle de l'utilisateur connecté dans `profils`. Ce verrou est le seul qui compte vraiment : même un appel direct à l'API ne contourne pas le RLS.

Règle d'or : **toute évolution des droits se fait dans les deux couches, en commençant par la base**, puis on rejoue la suite de tests.

| Sujet | Règle |
|---|---|
| Comptes | Créés dans Supabase › Authentication › Users. Inscriptions publiques **désactivées**. |
| Rôles | Attribués par la Direction (écran Équipe). Sans rôle = aucun accès. La Direction ne peut pas se retirer son propre rôle. |
| Coordonnées invités | Table séparée, lisible uniquement par Direction et Production. |
| Campagnes sponsors | Lisibles uniquement par Direction et Partenariats. |
| Alerte advisor attendue | `role_courant()` exécutable par les connectés : voulu, elle ne renvoie que le rôle de l'appelant. |
| En-têtes HTTP | `vercel.json` : `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`. |
| Mots de passe | Politique renforcée le 23/11/2026 (Authentication › Email) : 12 caractères minimum, minuscules + majuscules + chiffres + symboles, changement de mot de passe sécurisé. « Prevent use of leaked passwords » nécessite l'offre Supabase Pro : l'advisor « Leaked Password Protection Disabled » reste affiché tant que le projet est en offre gratuite (risque accepté). |

## 7. Intégration RSS

Détail et justification : `choix-integration.md`.

- **Déclenchement** : bouton « Synchroniser le flux » (écran Émissions), réservé à la Direction et à la Diffusion.
- **Fonction** : `api/rss-sync.ts`, `POST { emission_id }` avec l'en-tête `Authorization: Bearer <jeton>`.
- **Rapprochement** : titre de l'épisode du flux = titre de l'épisode dans l'app, après normalisation (minuscules, sans accents ni ponctuation) : `normaliserTitre()`.
- **Écriture** : `diffusions` (plateforme « Flux RSS (Apple Podcasts) »), en *upsert* sur (épisode, plateforme). Une resynchronisation met à jour, sans créer de doublon.
- **Codes renvoyés** : `OK`, `PARTIEL`, `VIDE`, `INVALIDE`, `INDISPONIBLE`, plus des erreurs d'accès (`INTERDIT`, `SANS_FLUX`…). L'interface les traduit dans `src/lib/rss.ts`.
- **Limites** : délai de 8 s, taille maximale de 5 Mo.

## 8. Déploiement

- **Automatique** : chaque `git push` sur `main` déclenche un build Vercel. En cas d'échec, l'ancienne version reste en ligne.
- **Retour arrière** : Vercel › Deployments › choisir un déploiement précédent › **Promote to Production**.
- **Après un changement d'URL ou de domaine** : mettre à jour Supabase › Authentication › URL Configuration › **Site URL**.
- **Conventions de commit** : `type(portée): message [US-xx]` (voir `agent.md`).

## 9. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Page « Configuration manquante » | Variables `VITE_` absentes au build | Les ajouter dans Vercel, puis **Redeploy** |
| Page blanche | Erreur JavaScript | F12 › Console ; vérifier le dernier build Vercel (Deployments › Logs) |
| « Identifiants incorrects » pour un collaborateur | Mauvais mot de passe ou compte inexistant | Supabase › Authentication › Users : vérifier le compte, envoyer un lien de réinitialisation |
| « Accès en attente » après connexion | Compte sans rôle | Direction › écran Équipe › attribuer un rôle |
| Un utilisateur ne voit pas des données attendues | Comportement RLS normal pour son rôle | Vérifier son rôle (Équipe) et la matrice dans `architecture.md` §3 |
| « Action non autorisée pour votre rôle » | Le RLS ou un trigger a refusé l'action | Normal si le rôle n'a pas ce droit. Sinon, comparer `domaine.ts` et les migrations |
| Synchro RSS « Service de diffusion indisponible » | Hébergeur du flux en panne, trop lent ou URL erronée | Ouvrir l'URL dans un navigateur ; réessayer plus tard ; corriger l'URL dans la fiche émission |
| Synchro RSS « Flux invalide » | L'URL pointe vers une page web, pas vers le flux XML | Récupérer l'URL RSS chez l'hébergeur (souvent `…/rss…xml`) |
| Synchro « Aucune donnée de diffusion » | Aucun titre d'épisode ne correspond au flux | Aligner le titre de l'épisode sur celui du flux (la liste des titres est affichée) |
| Pilotage : blocages inattendus | Dates prévues dépassées ou seuil trop court | Pilotage › « Règles et seuils de blocage » : ajuster les jours par statut |
| Projet Supabase en pause | Inactivité prolongée (offre gratuite) | Supabase › projet › **Restore** |

## 10. Vérifications de non-régression (avant chaque mise en production importante)
1. `npm run build` : aucune erreur.
2. `npm test` : 13/13.
3. `supabase/tests/cloisonnement_rls.sql` : 46/46 `ok = true`.
4. Supabase › Advisors › Security : aucune alerte nouvelle (2 attendues : `role_courant`, leaked passwords).
5. Connexion avec un compte de chaque rôle : grille § 2 de `recette-securite.md`.
