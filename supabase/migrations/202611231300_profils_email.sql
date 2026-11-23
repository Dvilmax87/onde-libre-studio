-- US-13 — Écran « Équipe » : la Direction attribue les rôles depuis l'interface.
-- L'email est copié dans profils pour identifier les comptes (lisible par la Direction et par soi-même, RLS inchangé).
alter table public.profils add column email text;
update public.profils p set email = u.email from auth.users u where u.id = p.id;

create or replace function public.creer_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profils (id, nom, email) values (new.id, coalesce(new.raw_user_meta_data->>'nom', ''), new.email);
  return new;
end $$;
revoke execute on function public.creer_profil() from public, anon, authenticated;

-- Garde-fou : la Direction ne peut pas retirer son propre rôle Direction (éviter de se verrouiller dehors)
create function public.controle_maj_profil() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.id = (select auth.uid()) and old.role = 'direction' and new.role is distinct from 'direction' then
    raise exception 'Vous ne pouvez pas retirer votre propre rôle Direction' using errcode = '42501';
  end if;
  if new.email is distinct from old.email and (select auth.uid()) is not null then
    raise exception 'L''email est géré par l''authentification' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger t_controle_maj_profil before update on public.profils
  for each row execute function public.controle_maj_profil();
