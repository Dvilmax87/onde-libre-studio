# Choix du service externe de diffusion (US-15 PRD / US-16 CSV)

Date : 23/11/2026 · Décision : **flux RSS des émissions** (le format lu par Apple Podcasts)

## 1. Besoin métier (PRD §1, §4.1)
Ne plus recopier à la main les informations de mise en ligne. Après publication, l'équipe doit voir sur chaque épisode **où, quand et à quelle adresse** il est diffusé, sans collecte manuelle.

## 2. Options étudiées (PRD §4.1)
| Critère | Flux RSS (Apple Podcasts) | API Ausha | API Spotify |
|---|---|---|---|
| Accès requis | Aucun : URL publique | Compte Ausha du studio + clé API | Application développeur Spotify + identifiants |
| Données obtenues | Titre, date de publication, lien, durée, fichier audio | Selon l'offre Ausha du studio | Métadonnées du podcast et des épisodes |
| Chiffres d'audience | **Non** | À vérifier selon l'offre du studio | À vérifier : les statistiques d'écoute ne sont pas exposées publiquement |
| Dépendance à un fournisseur | Aucune : standard ouvert, tous les hébergeurs publient un flux | Forte (hébergeur unique) | Forte (une plateforme) |
| Coût | Nul | Lié à l'abonnement Ausha | Nul |
| Délai de mise en œuvre | Immédiat | Obtenir les accès | Obtenir les accès |

## 3. Justification
- **Fonctionnelle** : couvre le besoin « données de diffusion » du PRD (« diffusion **ou** audience »). Chaque épisode affiche automatiquement sa date de publication réelle, son lien et sa durée.
- **Technique** : standard ouvert, sans clé ni secret à gérer. Aucun risque de fuite de jeton, et l'intégration ne casse pas si le studio change d'hébergeur : il suffit de remplacer l'URL du flux. C'est l'objectif du PRD de ne plus dépendre d'outils opaques dont les intégrations cassent.
- **Exploitation** : la Direction renseigne l'URL du flux dans la fiche émission. Direction et Diffusion lancent la synchronisation d'un clic.

## 4. Limite assumée
**Le RSS ne fournit pas de chiffres d'écoute.** La table `diffusions` comporte un champ `indicateurs` (JSON) prêt à accueillir des statistiques d'audience. Une évolution pourra brancher l'API Ausha ou Spotify, une fois les accès du studio disponibles, sans changer le modèle de données.

## 5. Fonctionnement
1. L'utilisateur clique « Synchroniser le flux » sur une émission (écran Émissions).
2. La fonction serveur Vercel `api/rss-sync.ts` télécharge le flux (8 s maximum) avec **le jeton de l'utilisateur** : le RLS s'applique et aucune clé secrète n'est utilisée.
3. Chaque épisode du flux est rapproché d'un épisode de l'émission **par titre identique**, en ignorant majuscules, accents et ponctuation. Règle validée le 23/11/2026.
4. Une diffusion « Flux RSS (Apple Podcasts) » est créée ou mise à jour pour chaque épisode rapproché : date, lien, durée, adresse audio, date de synchronisation.

## 6. Gestion des erreurs (US-17 PRD) — jamais bloquante
| Cas PRD | Détection | Ce que voit l'utilisateur |
|---|---|---|
| 1. Service indisponible / délai dépassé | Erreur réseau, HTTP ≠ 2xx, pas de réponse en 8 s, fonction injoignable | « Service de diffusion indisponible » + message précis ; les dernières données connues restent affichées |
| 2. Réponse vide / absence de données | Flux sans épisode, aucun épisode rapproché, épisode sans diffusion | « Aucune donnée de diffusion » ; liste des titres du flux sans correspondance ; sur l'épisode : « Aucune donnée de diffusion pour cet épisode » |
| 3. Format invalide ou incomplet | Contenu non XML, page HTML, pas de `<channel>`, élément sans titre ou date invalide, lien non http | « Flux invalide » ; ou « Synchronisation partielle » avec la liste des éléments ignorés et leur motif, les éléments valides étant conservés |

Preuve : `tests/rss.test.ts`, 13 tests automatisés (`npm test`) couvrant les 3 cas, la règle de rapprochement et le rejet des liens non http.

## 7. Flux de test
« L'Esprit public » (France Culture) : `https://radiofrance-podcast.net/podcast09/rss_16119.xml`.
