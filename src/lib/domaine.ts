// Types et règles métier — miroir côté interface des règles appliquées en base (RLS + triggers).
// Toute modification ici doit être reflétée dans supabase/migrations (double verrouillage).

export type Role = 'direction' | 'production' | 'realisation' | 'diffusion' | 'partenariats';
export type StatutEpisode = 'idee' | 'invite_confirme' | 'enregistre' | 'monte' | 'publie';
export type StatutEmission = 'en_projet' | 'active' | 'en_pause' | 'archivee';
export type TypeEmission = 'originale' | 'marque';
export type StatutPriseSon = 'a_planifier' | 'planifie' | 'en_cours' | 'enregistre' | 'a_reenregistrer' | 'annule';
export type Lieu = 'studio' | 'distance';

export const ROLES: Record<Role, string> = {
  direction: 'Direction', production: 'Production', realisation: 'Réalisation',
  diffusion: 'Diffusion', partenariats: 'Partenariats',
};

export const STATUTS_EPISODE: StatutEpisode[] = ['idee', 'invite_confirme', 'enregistre', 'monte', 'publie'];
export const LIB_STATUT_EPISODE: Record<StatutEpisode, string> = {
  idee: 'Idée', invite_confirme: 'Invité confirmé', enregistre: 'Enregistré', monte: 'Monté', publie: 'Publié',
};
export const LIB_STATUT_EMISSION: Record<StatutEmission, string> = {
  en_projet: 'En projet', active: 'Active', en_pause: 'En pause', archivee: 'Archivée',
};
export const LIB_TYPE_EMISSION: Record<TypeEmission, string> = { originale: 'Podcast original', marque: 'Podcast de marque' };
export const LIB_PRISE_SON: Record<StatutPriseSon, string> = {
  a_planifier: 'À planifier', planifie: 'Planifié', en_cours: 'En cours', enregistre: 'Enregistré',
  a_reenregistrer: 'À réenregistrer', annule: 'Annulé',
};
export const LIB_LIEU: Record<Lieu, string> = { studio: 'Studio', distance: 'À distance' };

export interface Emission {
  id: string; titre: string; thematique: string | null; type: TypeEmission;
  statut: StatutEmission; rss_url: string | null;
}
export interface Episode {
  id: string; emission_id: string; titre: string; resume: string | null; numero: number | null;
  statut: StatutEpisode; statut_modifie_le: string;
  date_preproduction: string | null; date_enregistrement_prevue: string | null;
  date_enregistrement_reelle: string | null; date_montage_prevue: string | null;
  date_validation_mixage: string | null; date_publication_prevue: string | null;
  date_publication_effective: string | null;
}
export interface Invite {
  id: string; prenom: string | null; nom: string; biographie: string | null;
  modalites_contact: string | null; notes: string | null;
}
export interface Coordonnees { invite_id: string; email: string | null; telephone: string | null; }
export interface Enregistrement {
  id: string; episode_id: string; date_creneau: string | null; lieu: Lieu | null;
  statut_prise_son: StatutPriseSon; notes_montage: string | null;
}
export interface Diffusion {
  id: string; episode_id: string; plateforme: string; date_publication: string | null; lien: string | null;
  indicateurs: { duree?: string | null; guid?: string | null; audio?: string | null } | null;
  source: 'manuel' | 'rss'; synchronise_le: string | null;
}
export interface Blocage { episode_id: string; regle: string; detail: string; depuis: string; }

export const DATES_EPISODE: { cle: keyof Episode; libelle: string; type: 'date' | 'datetime-local' }[] = [
  { cle: 'date_preproduction', libelle: 'Pré-production', type: 'date' },
  { cle: 'date_enregistrement_prevue', libelle: 'Enregistrement prévu', type: 'datetime-local' },
  { cle: 'date_enregistrement_reelle', libelle: 'Enregistrement réel', type: 'datetime-local' },
  { cle: 'date_montage_prevue', libelle: 'Dérushage / montage prévu', type: 'date' },
  { cle: 'date_validation_mixage', libelle: 'Validation / mixage', type: 'date' },
  { cle: 'date_publication_prevue', libelle: 'Publication prévue', type: 'datetime-local' },
  { cle: 'date_publication_effective', libelle: 'Publication effective', type: 'datetime-local' },
];

// ---------- Droits (architecture.md §3) ----------
export const peut = {
  gererEmissions: (r: Role | null) => r === 'direction',
  creerEpisode: (r: Role | null) => r === 'direction' || r === 'production',
  editerEpisode: (r: Role | null) => r === 'direction' || r === 'production',
  supprimerEpisode: (r: Role | null) => r === 'direction',
  gererInvites: (r: Role | null) => r === 'direction' || r === 'production',
  voirCoordonnees: (r: Role | null) => r === 'direction' || r === 'production',
  voirEnregistrements: (r: Role | null) => r !== null && r !== 'partenariats',
  gererEnregistrements: (r: Role | null) => r === 'direction' || r === 'production' || r === 'realisation',
  voirPilotage: (r: Role | null) => r === 'direction',
  gererEquipe: (r: Role | null) => r === 'direction',
  synchroniserRss: (r: Role | null) => r === 'direction' || r === 'diffusion',
  voirCampagnes: (r: Role | null) => r === 'direction' || r === 'partenariats',
};

/** Statuts qu'un rôle peut donner à un épisode actuellement au statut `actuel`. */
export function statutsAutorises(role: Role | null, actuel: StatutEpisode): StatutEpisode[] {
  if (role === 'direction' || role === 'production') return STATUTS_EPISODE.filter(s => s !== actuel);
  if (role === 'realisation') return actuel === 'publie' ? [] : STATUTS_EPISODE.filter(s => s !== actuel && s !== 'publie');
  if (role === 'diffusion') return actuel === 'publie' ? [] : ['publie'];
  return [];
}

export function statutSuivant(role: Role | null, actuel: StatutEpisode): StatutEpisode | null {
  const i = STATUTS_EPISODE.indexOf(actuel);
  const next = STATUTS_EPISODE[i + 1];
  if (!next) return null;
  if (role === 'diffusion') return actuel === 'monte' ? 'publie' : null;
  return statutsAutorises(role, actuel).includes(next) ? next : null;
}

// ---------- Formatage ----------
export function fmtDate(v: string | null, avecHeure = false): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', avecHeure
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Valeur d'un champ <input type=date|datetime-local> depuis une valeur base. */
export function versInput(v: string | null, type: 'date' | 'datetime-local'): string {
  if (!v) return '';
  if (type === 'date') return v.slice(0, 10);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Valeur base depuis un champ <input>. */
export function depuisInput(v: string, type: 'date' | 'datetime-local'): string | null {
  if (!v) return null;
  return type === 'date' ? v : new Date(v).toISOString();
}
