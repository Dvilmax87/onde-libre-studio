# Recette sécurité — Jalon 3 (US-12, US-13, US-14 du PRD)

Date : 23/11/2026 · Base : projet Supabase `onde-libre-studio` · Application : https://onde-libre-studio-7rhg.vercel.app

Principe vérifié : **double verrouillage** (PRD §4.2).
1. **Interface** : menus, écrans et boutons masqués selon le rôle (`src/lib/domaine.ts` › `peut`, `statutsAutorises`).
2. **Base de données** : RLS sur 100 % des tables + triggers de contrôle par colonne. Ce verrou tient même si l'interface est contournée (appel direct à l'API avec la clé publique).

---

## 1. Tests automatisés de la base — `supabase/tests/cloisonnement_rls.sql`

Rejouables à volonté : la suite crée 6 comptes fictifs (un par rôle + un sans rôle) et un jeu de données, exécute chaque requête **en tant que** cet utilisateur, puis annule tout (`ROLLBACK`).

**Résultat du 23/11/2026 : 46 / 46 réussis.**

| # | Acteur | Test | Attendu | Obtenu |
|---|---|---|---|---|
| 1 | anonyme | Lire les épisodes | refus | refus ✅ |
| 2 | anonyme | Lire les coordonnées invités | refus | refus ✅ |
| 3 | sans rôle | Lire les épisodes | 0 ligne | 0 ✅ |
| 4 | sans rôle | S'attribuer le rôle Direction | 0 ligne | 0 ✅ |
| 5 | **diffusion** | Lire les coordonnées invités | 0 ligne | 0 ✅ |
| 6 | **diffusion** | Lire les campagnes sponsors | 0 ligne | 0 ✅ |
| 7 | **diffusion** | Lire les liens épisodes-campagnes | 0 ligne | 0 ✅ |
| 8 | **diffusion** | Lire les profils (seulement le sien) | 1 ligne | 1 ✅ |
| 9 | **diffusion** | S'attribuer le rôle Direction | 0 ligne | 0 ✅ |
| 10 | **diffusion** | Modifier les coordonnées invités | 0 ligne | 0 ✅ |
| 11 | **diffusion** | Créer une campagne sponsor | refus | refus ✅ |
| 12 | **diffusion** | Modifier une campagne sponsor | 0 ligne | 0 ✅ |
| 13 | **diffusion** | Modifier les seuils de blocage | 0 ligne | 0 ✅ |
| 14 | **diffusion** | Créer une émission | refus | refus ✅ |
| 15 | **diffusion** | Modifier le titre d'un épisode | refus | refus ✅ |
| 16 | **diffusion** | Repasser un épisode à « Idée » | refus | refus ✅ |
| 17 | **diffusion** | Supprimer un épisode | 0 ligne | 0 ✅ |
| 18 | diffusion | Lire la fiche invité (non sensible) | 1 ligne | 1 ✅ |
| 19 | diffusion | Passer un épisode « Monté » à « Publié » | 1 ligne | 1 ✅ |
| 20 | réalisation | Lire les coordonnées invités | 0 ligne | 0 ✅ |
| 21 | réalisation | Lire les campagnes sponsors | 0 ligne | 0 ✅ |
| 22 | réalisation | Passer un épisode à « Publié » | refus | refus ✅ |
| 23 | réalisation | Modifier le résumé d'un épisode | refus | refus ✅ |
| 24 | réalisation | Modifier un épisode publié | 0 ligne | 0 ✅ |
| 25 | réalisation | Passer un épisode « Idée » à « Monté » | 1 ligne | 1 ✅ |
| 26 | réalisation | Mettre à jour un enregistrement | 1 ligne | 1 ✅ |
| 27 | partenariats | Lire les coordonnées invités | 0 ligne | 0 ✅ |
| 28 | partenariats | Lire les enregistrements | 0 ligne | 0 ✅ |
| 29 | partenariats | Modifier le statut d'un épisode | 0 ligne | 0 ✅ |
| 30 | partenariats | Lire les campagnes sponsors | 1 ligne | 1 ✅ |
| 31 | partenariats | Créer une campagne sponsor | 1 ligne | 1 ✅ |
| 32 | production | Lire les campagnes sponsors | 0 ligne | 0 ✅ |
| 33 | production | Créer une émission | refus | refus ✅ |
| 34 | production | Supprimer un épisode | 0 ligne | 0 ✅ |
| 35 | production | Lire les coordonnées invités | 1 ligne | 1 ✅ |
| 36 | production | Créer un épisode | 1 ligne | 1 ✅ |
| 37 | production | Passer un épisode à « Publié » | 1 ligne | 1 ✅ |
| 38 | direction | Lire les coordonnées invités | 1 ligne | 1 ✅ |
| 39 | direction | Lire les campagnes sponsors | 1 ligne | 1 ✅ |
| 40 | direction | Attribuer un rôle | 1 ligne | 1 ✅ |
| 41 | direction | Modifier un seuil de blocage | 1 ligne | 1 ✅ |
| 42 | direction | Supprimer un épisode | 1 ligne | 1 ✅ |
| 43 | direction | Retirer son propre rôle Direction | refus | refus ✅ |
| 44 | direction | Modifier l'email d'un compte | refus | refus ✅ |
| 45 | direction | Renommer un collaborateur | 1 ligne | 1 ✅ |
| 46 | direction | Lire tous les profils de l'équipe | 6 lignes | 6 ✅ |

« 0 ligne » = la base filtre silencieusement (la donnée est invisible / non modifiable). « refus » = la base rejette l'opération (erreur 42501).

**Critère PRD US-14 : « un compte Diffusion ne peut accéder aux données Direction » — démontré par les tests 5 à 17.**

### Rejouer la suite
Supabase › SQL Editor › coller `supabase/tests/cloisonnement_rls.sql` › Run. Toutes les lignes doivent afficher `ok = true`. À rejouer après toute modification des migrations.

---

## 2. Recette manuelle de l'interface (premier verrou)

Méthode : une **fenêtre de navigation privée par compte**. Pour chaque ligne, remplacer ☐ par ✅ (conforme) ou ❌ (écart, décrire dans « Remarque »).

| # | Compte | Vérification | Résultat | Remarque |
|---|---|---|---|---|
| 1 | (aucun) | Sans connexion : seule la page de connexion s'affiche | ☐ | |
| 2 | (aucun) | Mauvais mot de passe : message « Identifiants incorrects », pas d'accès | ☐ | |
| 3 | Direction · maxime.darracq@orange.fr | Menus : Pipeline, Invités, Émissions, Campagnes sponsors, Pilotage, Équipe | ☐ | |
| 4 | Direction | Équipe : la liste des 5 comptes s'affiche ; mon propre rôle est grisé | ☐ | |
| 5 | Direction | Campagnes : créer une campagne et lui rattacher un épisode | ☐ | |
| 6 | Production · maximedarracq@gmail.com | Menus : Pipeline, Invités, Émissions seulement (ni Campagnes, ni Pilotage, ni Équipe) | ☐ | |
| 7 | Production | Bouton « + Nouvel épisode » visible ; coordonnées (email, téléphone) visibles sur une fiche invité | ☐ | |
| 8 | Réalisation · maxime@lamarque-energies.fr | Pas de « + Nouvel épisode » ; fiche invité : « Données protégées » | ☐ | |
| 9 | Réalisation | Statut d'un épisode : « Publié » n'est jamais proposé ; sessions d'enregistrement modifiables | ☐ | |
| 10 | Diffusion · maxime@savelite.fr | Sur un épisode « Monté » : seul « Passer à Publié » ; fiche invité : « Données protégées » | ☐ | |
| 11 | Diffusion | Émissions : bouton « Synchroniser le flux » visible, « Modifier » absent | ☐ | |
| 12 | Partenariats · darracq@savelite.fr | Menus : Pipeline, Invités, Émissions, Campagnes sponsors ; voit la campagne créée au test 5 | ☐ | |
| 13 | Partenariats | Aucun bouton d'action sur les épisodes ; pas de section Enregistrements dans le détail | ☐ | |
| 14 | Production, Réalisation, Diffusion | Taper `/campagnes`, `/pilotage` puis `/equipe` à la fin de l'URL : retour au Pipeline | ☐ | |

Validé par : ______________________ · Date : ____ / ____ / ________

## 3. Configuration Supabase Auth
- Inscriptions publiques désactivées (fait par le Product Builder le 23/11/2026).
- Comptes créés dans Authentication › Users ; un nouveau compte n'a **aucun accès** tant que la Direction ne lui attribue pas un rôle (écran Équipe).
- Politique de mot de passe renforcée le 23/11/2026 : 12 caractères min., majuscules, minuscules, chiffres et symboles, changement sécurisé. Protection contre les mots de passe compromis indisponible en offre gratuite (avertissement accepté).
- Advisors sécurité : avertissement `role_courant()` exécutable par les utilisateurs connectés — voulu (nécessaire aux politiques, ne renvoie que le rôle de l'appelant).
