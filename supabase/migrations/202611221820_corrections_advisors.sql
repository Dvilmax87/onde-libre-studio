-- Corrections suite aux advisors Supabase (sécurité + performance)

-- creer_profil n'est appelé que par le trigger sur auth.users : aucun appel via l'API
revoke execute on function public.creer_profil() from public, anon, authenticated;

-- role_courant reste exécutable par authenticated (nécessaire aux politiques RLS) :
-- elle ne renvoie que le rôle de l'appelant, aucune fuite de données.

-- emissions : une politique par action (évite le double SELECT)
drop policy emissions_ecriture on public.emissions;
create policy emissions_creation on public.emissions for insert to authenticated
  with check ((select public.role_courant()) = 'direction');
create policy emissions_maj on public.emissions for update to authenticated
  using ((select public.role_courant()) = 'direction')
  with check ((select public.role_courant()) = 'direction');
create policy emissions_suppression on public.emissions for delete to authenticated
  using ((select public.role_courant()) = 'direction');

-- episodes : fusion des 3 politiques UPDATE en une seule, logique inchangée
drop policy episodes_maj_complete    on public.episodes;
drop policy episodes_maj_realisation on public.episodes;
drop policy episodes_maj_diffusion   on public.episodes;
create policy episodes_maj on public.episodes for update to authenticated
  using (
       (select public.role_courant()) in ('direction','production')
    or ((select public.role_courant()) = 'realisation' and statut <> 'publie')
    or  (select public.role_courant()) = 'diffusion'
  )
  with check (
       (select public.role_courant()) in ('direction','production')
    or ((select public.role_courant()) = 'realisation' and statut <> 'publie')
    or ((select public.role_courant()) = 'diffusion'   and statut = 'publie')
  );
