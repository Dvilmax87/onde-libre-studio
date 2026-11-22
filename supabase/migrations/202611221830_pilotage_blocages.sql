-- US-11 — Pilotage Direction : règles de blocage (définies le 22/11/2026)
-- (a) une date prévue dépassée sans changement de statut depuis
-- (b) un enregistrement « À réenregistrer »
-- (c) même statut depuis plus de N jours (N par statut, défaut 10)

-- Date du dernier changement de statut
alter table public.episodes add column statut_modifie_le timestamptz not null default now();

create function public.maj_statut_modifie_le() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.statut is distinct from old.statut then
    new.statut_modifie_le := now();
  end if;
  return new;
end $$;
create trigger t_statut_modifie_le before update of statut on public.episodes
  for each row execute function public.maj_statut_modifie_le();

-- Le trigger de contrôle Réalisation/Diffusion doit ignorer cette colonne technique
create or replace function public.controle_maj_episode() returns trigger
language plpgsql set search_path = '' as $$
declare r public.role_applicatif := public.role_courant();
begin
  if r = 'realisation' then
    if (to_jsonb(new) - 'statut' - 'modifie_le' - 'statut_modifie_le')
       <> (to_jsonb(old) - 'statut' - 'modifie_le' - 'statut_modifie_le') then
      raise exception 'Réalisation : seul le statut peut être modifié' using errcode = '42501';
    end if;
  elsif r = 'diffusion' then
    if (to_jsonb(new) - 'statut' - 'date_publication_effective' - 'modifie_le' - 'statut_modifie_le')
       <> (to_jsonb(old) - 'statut' - 'date_publication_effective' - 'modifie_le' - 'statut_modifie_le') then
      raise exception 'Diffusion : seuls le statut « Publié » et la date de publication effective peuvent être modifiés' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Seuil N par statut (Publié exclu : un épisode publié n'est jamais bloqué)
create table public.parametres_blocage (
  statut public.statut_episode primary key check (statut <> 'publie'),
  jours  integer not null default 10 check (jours > 0),
  modifie_le timestamptz not null default now()
);
insert into public.parametres_blocage (statut) values ('idee'),('invite_confirme'),('enregistre'),('monte');
create trigger t_maj before update on public.parametres_blocage for each row execute function public.maj_horodatage();

alter table public.parametres_blocage enable row level security;
create policy pb_lecture on public.parametres_blocage for select to authenticated
  using ((select public.role_courant()) is not null);
create policy pb_maj on public.parametres_blocage for update to authenticated
  using ((select public.role_courant()) = 'direction')
  with check ((select public.role_courant()) = 'direction');

-- Vue des blocages : s'exécute avec les droits de l'appelant (RLS respecté)
create view public.v_blocages with (security_invoker = true) as
  -- (a) date prévue dépassée sans changement de statut depuis
  select e.id as episode_id, 'date_depassee'::text as regle,
         d.libelle as detail, d.echeance as depuis
  from public.episodes e
  cross join lateral (values
    ('Pré-production',            e.date_preproduction::timestamptz),
    ('Enregistrement prévu',      e.date_enregistrement_prevue),
    ('Dérushage / montage prévu', e.date_montage_prevue::timestamptz),
    ('Validation / mixage',       e.date_validation_mixage::timestamptz),
    ('Publication prévue',        e.date_publication_prevue)
  ) as d(libelle, echeance)
  where e.statut <> 'publie'
    and d.echeance is not null
    and d.echeance < now()
    and e.statut_modifie_le < d.echeance
union all
  -- (b) enregistrement à réenregistrer
  select r.episode_id, 'a_reenregistrer', 'Enregistrement « À réenregistrer »', r.modifie_le
  from public.enregistrements r
  join public.episodes e on e.id = r.episode_id
  where r.statut_prise_son = 'a_reenregistrer' and e.statut <> 'publie'
union all
  -- (c) même statut depuis plus de N jours
  select e.id, 'statut_fige', 'Même statut depuis plus de ' || p.jours || ' jours', e.statut_modifie_le
  from public.episodes e
  join public.parametres_blocage p on p.statut = e.statut
  where e.statut_modifie_le < now() - make_interval(days => p.jours);

grant select on public.v_blocages to authenticated;
revoke all on public.v_blocages from anon;
