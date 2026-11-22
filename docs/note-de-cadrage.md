# Note de cadrage — Application de pilotage Onde Libre Studio (US-03)

À l'attention de Camille Vasseur et des pôles Production, Réalisation, Diffusion et Partenariats.
22/11/2026 — version à valider.

## Pourquoi
Aujourd'hui, quatre outils séparés (planning des enregistrements, contacts invités, publication, suivi sponsors) ne se parlent pas. L'équipe recopie les informations à la main, et des erreurs apparaissent : un invité confirmé dans l'agenda mais absent du suivi de production, une fiche d'épisode introuvable après publication, une campagne sponsor perdue entre deux outils. Avec trois nouveaux podcasts à la rentrée, ce fonctionnement ne tient plus.

## Ce que l'on construit
**Une seule application web**, accessible avec un compte personnel, où chaque information n'est saisie qu'une fois.

On y retrouve :
- **les émissions** et leurs **épisodes**, chacun suivi sur 5 étapes : *Idée → Invité confirmé → Enregistré → Monté → Publié* ;
- **l'annuaire des invités**, avec l'historique automatique de leurs participations ;
- **les enregistrements** (date, studio ou à distance, prise de son, notes de montage) ;
- **les diffusions**, remontées automatiquement depuis le flux RSS des émissions (Apple Podcasts) ;
- **les campagnes sponsors**, rattachées aux épisodes ;
- **un tableau de pilotage** pour la direction : épisodes en cours, à venir, publiés, et points de blocage.

## Qui voit quoi
| Profil | Peut faire | Ne voit pas |
|---|---|---|
| Direction | Tout | — |
| Production éditoriale | Créer et suivre les épisodes, gérer les invités, planifier les enregistrements | Données sponsors |
| Réalisation son/montage | Suivre les épisodes et les enregistrements | Coordonnées des invités, données sponsors |
| Diffusion & audience | Gérer les publications, passer un épisode en « Publié », consulter les diffusions | Coordonnées des invités, données sponsors |
| Partenariats | Gérer les campagnes sponsors et leurs épisodes | Coordonnées des invités |

Ces règles sont appliquées **deux fois** : l'écran n'affiche pas ce qui est interdit, et la base de données refuse de toute façon de le donner. Des tests le prouveront avant la mise en service.

## À noter
Le flux RSS donne les informations de **publication** (date, lien, titre). Il **ne donne pas les chiffres d'écoute**. Ceux-ci pourront venir plus tard d'Ausha ou de Spotify.

## Calendrier par jalons
1. **Jalon 1 — Cadrage validé** : vous validez ce document et l'architecture. ← *nous sommes ici*
2. **Jalon 2 — Démonstration** : les écrans principaux fonctionnent avec de vraies données, et un épisode peut passer de « Idée » à « Publié ».
3. **Jalon 3 — Recette sécurité** : on vérifie que chaque profil ne voit que ce qui le concerne.
4. **Livraison finale** : diffusions RSS, mise en ligne, documentation technique et guide d'utilisation par pôle.

## Décisions attendues de votre part
Voir la liste dans `architecture.md` § 8. Point principal : qui a le droit de passer un épisode en « Publié » ?
