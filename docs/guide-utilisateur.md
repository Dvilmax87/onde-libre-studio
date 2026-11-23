# Guide d'utilisation — Application de pilotage Onde Libre Studio (US-21)

Pour toute l'équipe du studio. Adresse : **https://onde-libre-studio-7rhg.vercel.app**

---

## 1. Se connecter
1. Ouvrez l'adresse ci-dessus.
2. Saisissez votre email professionnel et votre mot de passe.
3. Vous arrivez sur le **Pipeline des épisodes**.

- **Pas de compte ?** Demandez-le à la Direction. Il n'existe pas d'inscription libre.
- **« Accès en attente »** : votre compte existe, mais la Direction ne vous a pas encore attribué de rôle.
- **Mot de passe oublié** : demandez une réinitialisation à la Direction.
- Pensez à **vous déconnecter** (bouton en bas du menu) sur un poste partagé.

> Ce que vous voyez dépend de votre rôle. Si un menu ou un bouton n'apparaît pas, c'est normal : il ne concerne pas votre mission.

## 2. Ce que chaque profil peut faire

| | Direction | Production | Réalisation | Diffusion | Partenariats |
|---|---|---|---|---|---|
| Voir le pipeline des épisodes | ✓ | ✓ | ✓ | ✓ | ✓ |
| Créer / modifier un épisode | ✓ | ✓ | — | — | — |
| Faire avancer un épisode | tout | tout | jusqu'à « Monté » | « Monté » → « Publié » | — |
| Supprimer un épisode | ✓ | — | — | — | — |
| Voir les fiches invités | ✓ | ✓ | ✓ | ✓ | ✓ |
| Voir les **coordonnées** des invités | ✓ | ✓ | — | — | — |
| Créer / modifier une fiche invité | ✓ | ✓ | — | — | — |
| Planifier / suivre les enregistrements | ✓ | ✓ | ✓ | lecture | — |
| Créer / modifier une émission | ✓ | — | — | — | — |
| Synchroniser le flux RSS | ✓ | — | — | ✓ | — |
| Campagnes sponsors (voir, créer, modifier, rattacher) | ✓ | — | — | — | ✓ |
| Supprimer une campagne | ✓ | — | — | — | — |
| Pilotage du studio | ✓ | — | — | — | — |
| Gérer l'équipe (rôles) | ✓ | — | — | — | — |

---

## 3. Le pipeline des épisodes (tous)

Chaque épisode avance en 5 étapes : **Idée → Invité confirmé → Enregistré → Monté → Publié**.

- **Filtrer** : choisissez une émission et/ou cliquez sur un statut en haut de l'écran.
- **Voir le détail** : cliquez sur une carte. Le panneau de droite montre le résumé, les invités, les 7 dates clés, les diffusions et les sessions d'enregistrement.
- **Faire avancer** : bouton **« Passer à … »** sur la carte, ou liste **Statut** dans le détail. Seules les étapes autorisées pour votre rôle sont proposées.
- **Badge orange « Blocage »** : l'épisode demande votre attention (voir § 7).

### Créer un épisode (Production, Direction)
1. **+ Nouvel épisode**. Il faut qu'au moins une émission existe.
2. Renseignez l'émission et le titre (obligatoires), puis le numéro, le résumé et les dates clés :
   - Pré-production : date limite du conducteur et des recherches ;
   - Enregistrement prévu / réel ;
   - Dérushage / montage prévu ;
   - Validation / mixage : livraison de la version masterisée ;
   - Publication prévue / effective.
3. Cochez les **invités** de l'épisode. Leur historique se met à jour tout seul.
4. **Enregistrer**.

> **Astuce diffusion** : gardez exactement le même titre que celui publié sur la plateforme. C'est le titre qui permet de rapatrier automatiquement les données de diffusion.

## 4. Les enregistrements (Production, Réalisation, Direction)
Dans le détail d'un épisode, section **Enregistrements** :
1. **+ Planifier une session** : date et créneau, lieu (studio ou à distance).
2. Faites évoluer la **prise de son** : À planifier → Planifié → En cours → Enregistré. Les autres valeurs possibles sont « À réenregistrer » et « Annulé ».
3. Ajoutez des **notes de montage**. Elles s'enregistrent quand vous quittez le champ.

Un enregistrement « À réenregistrer » signale automatiquement l'épisode comme bloqué.

## 5. Les invités (tous)
- **Rechercher** : tapez un nom dans l'annuaire.
- **Fiche** : biographie, modalités de prise de contact, notes, et historique de **tous** les épisodes de l'invité.
- **Coordonnées** (email, téléphone) : visibles par la Direction et la Production uniquement. Les autres profils voient « Données protégées ».
- **Créer / modifier** (Production, Direction) : **+ Nouvel invité** ou **Modifier la fiche**. Seul le nom est obligatoire.
- Un invité qui a participé à un épisode ne peut pas être supprimé : son historique est conservé.

## 6. Les émissions et la diffusion
- **Direction** : **+ Nouvelle émission** (titre, thématique, type original ou de marque, statut : En projet / Active / En pause / Archivée, **URL du flux RSS**).
- **Direction et Diffusion** : bouton **Synchroniser le flux**. L'application lit le flux et remplit la section **Diffusions** de chaque épisode dont le titre correspond : date de publication, durée, lien d'écoute.

| Message affiché | Ce qu'il faut faire |
|---|---|
| **Synchronisation réussie** | Rien. |
| **Synchronisation partielle** | Certains éléments du flux étaient incomplets et ont été ignorés (détail cliquable). |
| **Aucune donnée de diffusion** | Aucun titre du flux ne correspond à un épisode : comparez avec la liste affichée et corrigez le titre de l'épisode. |
| **Flux invalide** | L'URL ne pointe pas vers un flux RSS : demandez la bonne adresse à l'hébergeur. |
| **Service de diffusion indisponible** | Réessayez plus tard. Les données déjà connues restent affichées. |

L'application continue de fonctionner normalement dans tous les cas.

## 7. Campagnes sponsors (Direction, Partenariats)
Données confidentielles : les autres pôles ne voient ni le menu ni les données.
1. **+ Nouvelle campagne** : annonceur (obligatoire), périmètre, dates de début et de fin, données réservées.
2. **Épisodes rattachés** : cochez les épisodes concernés (filtre par émission ou titre). Le statut de chaque épisode est affiché.
3. La fiche de la campagne liste ses épisodes avec leur statut et leur date de publication.
4. Seule la Direction peut supprimer une campagne.

## 8. Pilotage du studio (Direction)
- **Compteurs** :
  - En cours : épisodes non publiés ;
  - À venir : épisodes dont la publication est prévue dans le futur ;
  - Publiés ;
  - Points de blocage.
- **Points de blocage** : un épisode est signalé si :
  1. une **date prévue est dépassée** sans changement de statut depuis ;
  2. un enregistrement est **« À réenregistrer »** ;
  3. il est resté **au même statut trop longtemps**. Le seuil est de 10 jours par défaut et se règle statut par statut dans « Règles et seuils de blocage ».
- **Par émission** et **Prochaines publications** : vue d'ensemble du calendrier.

## 9. Gérer l'équipe (Direction)
1. Créez le compte du collaborateur dans Supabase : Authentication › Users › **Add user** (email et mot de passe provisoire).
2. Dans l'application, écran **Équipe** : le compte apparaît avec « Aucun (accès bloqué) ».
3. Choisissez son **rôle**. L'effet est immédiat à sa prochaine connexion ou au rechargement de la page.
4. Pour couper un accès : remettez le rôle sur « Aucun ».

Vous ne pouvez pas modifier votre propre rôle, ce qui évite de perdre l'accès Direction par erreur.

---

## Questions fréquentes
- **Je ne vois pas un bouton qu'un collègue voit.** Vos rôles sont différents. Voir le tableau du § 2.
- **« Action non autorisée pour votre rôle »** : l'action dépasse votre périmètre. La base de données protège les données même si l'écran le permettait.
- **Un épisode publié a disparu de mes actions** : un épisode « Publié » ne peut plus être modifié par la Réalisation ni par la Diffusion.
