-- US-04 / US-05 — Schéma relationnel Onde Libre Studio
-- Source : PRD §3.1, §3.2 + valeurs fournies par le Product Builder le 22/11/2026

-- ============ Types énumérés (valeurs contraintes en base) ============
create type public.role_applicatif as enum ('direction','production','realisation','diffusion','partenariats');
create type public.type_emission   as enum ('originale','marque');
create type public.statut_emission as enum ('en_projet','active','en_pause','archivee');
create type public.statut_episode  as enum ('idee','invite_confirme','enregistre','monte','publie');
create type public.lieu_enregistrement as enum ('studio','distance');
create type public.statut_prise_son as enum ('a_planifier','planifie','en_cours','enregistre','a_reenregistrer','annule');

-- ============ Utilitaire : horodatage de mise à jour ============
create function public.maj_horodatage() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.modifie_le := now();
  return new;
end $$;

-- ============ Profils (1 par compte Supabase Auth) ============
create table public.profils (
  id         uuid primary key references auth.users(id) on delete cascade,
  nom        text not null default '',
  role       public.role_applicatif,          -- null = aucun accès tant que la Direction n'a pas attribué de rôle
  cree_le    timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

-- ============ Émissions ============
create table public.emissions (
  id         uuid primary key default gen_random_uuid(),
  titre      text not null check (length(trim(titre)) > 0),
  thematique text,
  type       public.type_emission not null,
  statut     public.statut_emission not null default 'en_projet',
  rss_url    text check (rss_url is null or rss_url ~* '^https?://'),
  cree_le    timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

-- ============ Épisodes ============
create table public.episodes (
  id          uuid primary key default gen_random_uuid(),
  emission_id uuid not null references public.emissions(id) on delete restrict,
  titre       text not null check (length(trim(titre)) > 0),
  resume      text,
  numero      integer check (numero is null or numero > 0),
  statut      public.statut_episode not null default 'idee',
  -- Dates clés de production et publication
  date_preproduction          date,
  date_enregistrement_prevue  timestamptz,
  date_enregistrement_reelle  timestamptz,
  date_montage_prevue         date,
  date_validation_mixage      date,
  date_publication_prevue     timestamptz,
  date_publication_effective  timestamptz,
  cree_le    timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  unique (emission_id, numero)
);
create index on public.episodes (emission_id);
create index on public.episodes (statut);

-- ============ Invités (fiche partagée) ============
create table public.invites (
  id                 uuid primary key default gen_random_uuid(),
  prenom             text,
  nom                text not null check (length(trim(nom)) > 0),
  biographie         text,
  modalites_contact  text,   -- canal et modalités de prise de contact
  notes              text,
  cree_le    timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

-- Coordonnées : données protégées, isolées pour un cloisonnement par RLS
create table public.invites_coordonnees (
  invite_id  uuid primary key references public.invites(id) on delete cascade,
  email      text,
  telephone  text,
  modifie_le timestamptz not null default now()
);

-- Liaison épisodes ↔ invités (historique des participations)
create table public.episode_invites (
  episode_id uuid not null references public.episodes(id) on delete cascade,
  invite_id  uuid not null references public.invites(id)  on delete restrict,
  rattache_le timestamptz not null default now(),
  primary key (episode_id, invite_id)
);
create index on public.episode_invites (invite_id);

-- ============ Enregistrements ============
create table public.enregistrements (
  id               uuid primary key default gen_random_uuid(),
  episode_id       uuid not null references public.episodes(id) on delete cascade,
  date_creneau     timestamptz,
  lieu             public.lieu_enregistrement,
  statut_prise_son public.statut_prise_son not null default 'a_planifier',
  notes_montage    text,
  cree_le    timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
create index on public.enregistrements (episode_id);

-- ============ Diffusions ============
create table public.diffusions (
  id               uuid primary key default gen_random_uuid(),
  episode_id       uuid not null references public.episodes(id) on delete cascade,
  plateforme       text not null check (length(trim(plateforme)) > 0),
  date_publication timestamptz,
  lien             text check (lien is null or lien ~* '^https?://'),
  indicateurs      jsonb not null default '{}'::jsonb,  -- données rapatriées (RSS : durée, guid…)
  source           text not null default 'manuel' check (source in ('manuel','rss')),
  synchronise_le   timestamptz,
  cree_le    timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  unique (episode_id, plateforme)
);
create index on public.diffusions (episode_id);

-- ============ Campagnes sponsors ============
create table public.campagnes_sponsors (
  id                uuid primary key default gen_random_uuid(),
  annonceur         text not null check (length(trim(annonceur)) > 0),
  perimetre         text,
  date_debut        date,
  date_fin          date,
  donnees_reservees text,
  cree_le    timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  check (date_fin is null or date_debut is null or date_fin >= date_debut)
);

create table public.episode_campagnes (
  episode_id  uuid not null references public.episodes(id) on delete cascade,
  campagne_id uuid not null references public.campagnes_sponsors(id) on delete cascade,
  rattache_le timestamptz not null default now(),
  primary key (episode_id, campagne_id)
);
create index on public.episode_campagnes (campagne_id);

-- ============ Triggers d'horodatage ============
create trigger t_maj before update on public.profils             for each row execute function public.maj_horodatage();
create trigger t_maj before update on public.emissions           for each row execute function public.maj_horodatage();
create trigger t_maj before update on public.episodes            for each row execute function public.maj_horodatage();
create trigger t_maj before update on public.invites             for each row execute function public.maj_horodatage();
create trigger t_maj before update on public.invites_coordonnees for each row execute function public.maj_horodatage();
create trigger t_maj before update on public.enregistrements     for each row execute function public.maj_horodatage();
create trigger t_maj before update on public.diffusions          for each row execute function public.maj_horodatage();
create trigger t_maj before update on public.campagnes_sponsors  for each row execute function public.maj_horodatage();

-- ============ Création automatique du profil à l'inscription ============
create function public.creer_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profils (id, nom) values (new.id, coalesce(new.raw_user_meta_data->>'nom', ''));
  return new;
end $$;
create trigger t_creer_profil after insert on auth.users for each row execute function public.creer_profil();
