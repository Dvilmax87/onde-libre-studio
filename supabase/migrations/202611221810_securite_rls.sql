-- US-06 — Row Level Security par rôle (2e verrou du « double verrouillage », PRD §4.2)
-- Matrice : docs/architecture.md §3

-- ============ Rôle de l'utilisateur connecté ============
create function public.role_courant() returns public.role_applicatif
language sql stable security definer set search_path = '' as $$
  select role from public.profils where id = (select auth.uid())
$$;
revoke execute on function public.role_courant() from anon, public;
grant  execute on function public.role_courant() to authenticated, service_role;

-- ============ Activation RLS sur 100 % des tables ============
alter table public.profils             enable row level security;
alter table public.emissions           enable row level security;
alter table public.episodes            enable row level security;
alter table public.invites             enable row level security;
alter table public.invites_coordonnees enable row level security;
alter table public.episode_invites     enable row level security;
alter table public.enregistrements     enable row level security;
alter table public.diffusions          enable row level security;
alter table public.campagnes_sponsors  enable row level security;
alter table public.episode_campagnes   enable row level security;

-- Aucun accès anonyme
revoke all on all tables in schema public from anon;

-- ============ profils ============
create policy profils_lecture on public.profils for select to authenticated
  using (id = (select auth.uid()) or (select public.role_courant()) = 'direction');
create policy profils_maj_direction on public.profils for update to authenticated
  using ((select public.role_courant()) = 'direction')
  with check ((select public.role_courant()) = 'direction');

-- ============ emissions : lecture tous rôles, gestion Direction ============
create policy emissions_lecture on public.emissions for select to authenticated
  using ((select public.role_courant()) is not null);
create policy emissions_ecriture on public.emissions for all to authenticated
  using ((select public.role_courant()) = 'direction')
  with check ((select public.role_courant()) = 'direction');

-- ============ episodes ============
create policy episodes_lecture on public.episodes for select to authenticated
  using ((select public.role_courant()) is not null);
create policy episodes_creation on public.episodes for insert to authenticated
  with check ((select public.role_courant()) in ('direction','production'));
-- Direction / Production : tout le pipeline
create policy episodes_maj_complete on public.episodes for update to authenticated
  using ((select public.role_courant()) in ('direction','production'))
  with check ((select public.role_courant()) in ('direction','production'));
-- Réalisation : statut jusqu'à « Monté », jamais sur un épisode publié
create policy episodes_maj_realisation on public.episodes for update to authenticated
  using ((select public.role_courant()) = 'realisation' and statut <> 'publie')
  with check ((select public.role_courant()) = 'realisation' and statut <> 'publie');
-- Diffusion : passage au statut « Publié » (colonnes contrôlées par trigger)
create policy episodes_maj_diffusion on public.episodes for update to authenticated
  using ((select public.role_courant()) = 'diffusion')
  with check ((select public.role_courant()) = 'diffusion' and statut = 'publie');
create policy episodes_suppression on public.episodes for delete to authenticated
  using ((select public.role_courant()) = 'direction');

-- Restriction par colonne pour Réalisation et Diffusion (le RLS est par ligne)
create function public.controle_maj_episode() returns trigger
language plpgsql set search_path = '' as $$
declare r public.role_applicatif := public.role_courant();
begin
  if r = 'realisation' then
    if (to_jsonb(new) - 'statut' - 'modifie_le') <> (to_jsonb(old) - 'statut' - 'modifie_le') then
      raise exception 'Réalisation : seul le statut peut être modifié' using errcode = '42501';
    end if;
  elsif r = 'diffusion' then
    if (to_jsonb(new) - 'statut' - 'date_publication_effective' - 'modifie_le')
       <> (to_jsonb(old) - 'statut' - 'date_publication_effective' - 'modifie_le') then
      raise exception 'Diffusion : seuls le statut « Publié » et la date de publication effective peuvent être modifiés' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger t_controle_maj_episode before update on public.episodes
  for each row execute function public.controle_maj_episode();

-- ============ invites (fiche) : lecture tous rôles, gestion Direction/Production ============
create policy invites_lecture on public.invites for select to authenticated
  using ((select public.role_courant()) is not null);
create policy invites_creation on public.invites for insert to authenticated
  with check ((select public.role_courant()) in ('direction','production'));
create policy invites_maj on public.invites for update to authenticated
  using ((select public.role_courant()) in ('direction','production'))
  with check ((select public.role_courant()) in ('direction','production'));
create policy invites_suppression on public.invites for delete to authenticated
  using ((select public.role_courant()) = 'direction');

-- ============ invites_coordonnees : Direction + Production uniquement ============
create policy coordonnees_lecture on public.invites_coordonnees for select to authenticated
  using ((select public.role_courant()) in ('direction','production'));
create policy coordonnees_creation on public.invites_coordonnees for insert to authenticated
  with check ((select public.role_courant()) in ('direction','production'));
create policy coordonnees_maj on public.invites_coordonnees for update to authenticated
  using ((select public.role_courant()) in ('direction','production'))
  with check ((select public.role_courant()) in ('direction','production'));
create policy coordonnees_suppression on public.invites_coordonnees for delete to authenticated
  using ((select public.role_courant()) = 'direction');

-- ============ episode_invites ============
create policy ep_inv_lecture on public.episode_invites for select to authenticated
  using ((select public.role_courant()) is not null);
create policy ep_inv_creation on public.episode_invites for insert to authenticated
  with check ((select public.role_courant()) in ('direction','production'));
create policy ep_inv_suppression on public.episode_invites for delete to authenticated
  using ((select public.role_courant()) in ('direction','production'));

-- ============ enregistrements : pas d'accès Partenariats ============
create policy enr_lecture on public.enregistrements for select to authenticated
  using ((select public.role_courant()) in ('direction','production','realisation','diffusion'));
create policy enr_creation on public.enregistrements for insert to authenticated
  with check ((select public.role_courant()) in ('direction','production','realisation'));
create policy enr_maj on public.enregistrements for update to authenticated
  using ((select public.role_courant()) in ('direction','production','realisation'))
  with check ((select public.role_courant()) in ('direction','production','realisation'));
create policy enr_suppression on public.enregistrements for delete to authenticated
  using ((select public.role_courant()) = 'direction');

-- ============ diffusions : lecture tous, gestion Direction/Diffusion ============
create policy diff_lecture on public.diffusions for select to authenticated
  using ((select public.role_courant()) is not null);
create policy diff_creation on public.diffusions for insert to authenticated
  with check ((select public.role_courant()) in ('direction','diffusion'));
create policy diff_maj on public.diffusions for update to authenticated
  using ((select public.role_courant()) in ('direction','diffusion'))
  with check ((select public.role_courant()) in ('direction','diffusion'));
create policy diff_suppression on public.diffusions for delete to authenticated
  using ((select public.role_courant()) = 'direction');

-- ============ campagnes_sponsors : Direction + Partenariats uniquement ============
create policy camp_lecture on public.campagnes_sponsors for select to authenticated
  using ((select public.role_courant()) in ('direction','partenariats'));
create policy camp_creation on public.campagnes_sponsors for insert to authenticated
  with check ((select public.role_courant()) in ('direction','partenariats'));
create policy camp_maj on public.campagnes_sponsors for update to authenticated
  using ((select public.role_courant()) in ('direction','partenariats'))
  with check ((select public.role_courant()) in ('direction','partenariats'));
create policy camp_suppression on public.campagnes_sponsors for delete to authenticated
  using ((select public.role_courant()) = 'direction');

-- ============ episode_campagnes ============
create policy ep_camp_lecture on public.episode_campagnes for select to authenticated
  using ((select public.role_courant()) in ('direction','partenariats'));
create policy ep_camp_creation on public.episode_campagnes for insert to authenticated
  with check ((select public.role_courant()) in ('direction','partenariats'));
create policy ep_camp_suppression on public.episode_campagnes for delete to authenticated
  using ((select public.role_courant()) in ('direction','partenariats'));
