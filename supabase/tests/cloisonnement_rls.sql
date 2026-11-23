-- ============================================================================
-- US-14 (PRD) / US-15 (CSV) — Recette sécurité : cloisonnement des données par rôle
-- Rejouable à volonté : tout se passe dans une transaction annulée (ROLLBACK).
-- Exécution : SQL Editor Supabase (ou psql), coller le fichier entier.
-- Résultat : un tableau test / attendu / obtenu / ok. Toutes les lignes doivent être « ok = true ».
-- ============================================================================
begin;

create temp table resultats (n serial, acteur text, test text, attendu text, obtenu text) on commit drop;

-- Exécute `requete` en tant qu'utilisateur `uid` (ou anonyme si uid null) et note le résultat.
create function pg_temp.essai(acteur text, uid uuid, test text, requete text, attendu text) returns void
language plpgsql as $$
declare n int; res text;
begin
  perform set_config('request.jwt.claims',
    case when uid is null then '{"role":"anon"}' else json_build_object('sub', uid, 'role', 'authenticated')::text end, true);
  begin
    if uid is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
    execute requete;
    get diagnostics n = row_count;
    res := n || ' ligne(s)';
    execute 'reset role';
  exception when others then
    res := 'refus (' || sqlstate || ')';
  end;
  insert into resultats (acteur, test, attendu, obtenu) values (acteur, test, attendu, res);
end $$;

-- ---------- Jeu de données fictif ----------
insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'test.direction@rls.local',    'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'test.production@rls.local',   'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'test.realisation@rls.local',  'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'test.diffusion@rls.local',    'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'test.partenariats@rls.local', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'test.sansrole@rls.local',     'authenticated', 'authenticated');
update public.profils set role = 'direction'    where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.profils set role = 'production'   where id = 'aaaaaaaa-0000-0000-0000-000000000002';
update public.profils set role = 'realisation'  where id = 'aaaaaaaa-0000-0000-0000-000000000003';
update public.profils set role = 'diffusion'    where id = 'aaaaaaaa-0000-0000-0000-000000000004';
update public.profils set role = 'partenariats' where id = 'aaaaaaaa-0000-0000-0000-000000000005';

insert into public.emissions (id, titre, type, statut) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Émission test', 'originale', 'active');
insert into public.episodes (id, emission_id, titre, statut) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Ep idée',    'idee'),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Ep monté',   'monte'),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'Ep publié',  'publie'),
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', 'Ep monté 2', 'monte');
insert into public.invites (id, nom) values ('dddddddd-0000-0000-0000-000000000001', 'Invité test');
insert into public.invites_coordonnees (invite_id, email, telephone) values ('dddddddd-0000-0000-0000-000000000001', 'invite@test.local', '0600000000');
insert into public.enregistrements (episode_id) values ('cccccccc-0000-0000-0000-000000000001');
insert into public.campagnes_sponsors (id, annonceur, donnees_reservees) values ('eeeeeeee-0000-0000-0000-000000000001', 'Annonceur test', 'Montant confidentiel');
insert into public.episode_campagnes (episode_id, campagne_id) values ('cccccccc-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000001');

-- ---------- Anonyme / sans rôle ----------
select pg_temp.essai('anonyme', null, 'Lire les épisodes', 'select * from public.episodes', 'refus (42501)');
select pg_temp.essai('anonyme', null, 'Lire les coordonnées invités', 'select * from public.invites_coordonnees', 'refus (42501)');
select pg_temp.essai('sans rôle', 'aaaaaaaa-0000-0000-0000-000000000006', 'Lire les épisodes', 'select * from public.episodes', '0 ligne(s)');
select pg_temp.essai('sans rôle', 'aaaaaaaa-0000-0000-0000-000000000006', 'S''attribuer le rôle Direction', 'update public.profils set role = ''direction'' where id = ''aaaaaaaa-0000-0000-0000-000000000006''', '0 ligne(s)');

-- ---------- Diffusion (critère PRD : ne lit ni ne modifie les données Direction / sensibles) ----------
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'Lire les coordonnées invités', 'select * from public.invites_coordonnees', '0 ligne(s)');
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'Lire les campagnes sponsors', 'select * from public.campagnes_sponsors', '0 ligne(s)');
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'Lire les liens épisodes-campagnes', 'select * from public.episode_campagnes', '0 ligne(s)');
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'Lire les profils (seulement le sien)', 'select * from public.profils', '1 ligne(s)');
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'S''attribuer le rôle Direction', 'update public.profils set role = ''direction'' where id = ''aaaaaaaa-0000-0000-0000-000000000004''', '0 ligne(s)');
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'Modifier les coordonnées invités', 'update public.invites_coordonnees set email = ''pirate@x.fr''', '0 ligne(s)');
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'Créer une campagne sponsor', 'insert into public.campagnes_sponsors (annonceur) values (''X'')', 'refus (42501)');
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'Modifier une campagne sponsor', 'update public.campagnes_sponsors set donnees_reservees = ''x''', '0 ligne(s)');
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'Modifier les seuils de blocage', 'update public.parametres_blocage set jours = 99', '0 ligne(s)');
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'Créer une émission', 'insert into public.emissions (titre, type) values (''X'', ''originale'')', 'refus (42501)');
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'Modifier le titre d''un épisode', 'update public.episodes set titre = ''X'' where id = ''cccccccc-0000-0000-0000-000000000002''', 'refus (42501)');
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'Repasser un épisode à « Idée »', 'update public.episodes set statut = ''idee'' where id = ''cccccccc-0000-0000-0000-000000000002''', 'refus (42501)');
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'Supprimer un épisode', 'delete from public.episodes', '0 ligne(s)');
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'Lire la fiche invité (non sensible)', 'select * from public.invites', '1 ligne(s)');
select pg_temp.essai('diffusion', 'aaaaaaaa-0000-0000-0000-000000000004', 'Passer un épisode « Monté » à « Publié »', 'update public.episodes set statut = ''publie'' where id = ''cccccccc-0000-0000-0000-000000000002''', '1 ligne(s)');

-- ---------- Réalisation ----------
select pg_temp.essai('réalisation', 'aaaaaaaa-0000-0000-0000-000000000003', 'Lire les coordonnées invités', 'select * from public.invites_coordonnees', '0 ligne(s)');
select pg_temp.essai('réalisation', 'aaaaaaaa-0000-0000-0000-000000000003', 'Lire les campagnes sponsors', 'select * from public.campagnes_sponsors', '0 ligne(s)');
select pg_temp.essai('réalisation', 'aaaaaaaa-0000-0000-0000-000000000003', 'Passer un épisode à « Publié »', 'update public.episodes set statut = ''publie'' where id = ''cccccccc-0000-0000-0000-000000000001''', 'refus (42501)');
select pg_temp.essai('réalisation', 'aaaaaaaa-0000-0000-0000-000000000003', 'Modifier le résumé d''un épisode', 'update public.episodes set resume = ''X'' where id = ''cccccccc-0000-0000-0000-000000000001''', 'refus (42501)');
select pg_temp.essai('réalisation', 'aaaaaaaa-0000-0000-0000-000000000003', 'Modifier un épisode publié', 'update public.episodes set statut = ''monte'' where id = ''cccccccc-0000-0000-0000-000000000003''', '0 ligne(s)');
select pg_temp.essai('réalisation', 'aaaaaaaa-0000-0000-0000-000000000003', 'Passer un épisode « Idée » à « Monté »', 'update public.episodes set statut = ''monte'' where id = ''cccccccc-0000-0000-0000-000000000001''', '1 ligne(s)');
select pg_temp.essai('réalisation', 'aaaaaaaa-0000-0000-0000-000000000003', 'Mettre à jour un enregistrement', 'update public.enregistrements set statut_prise_son = ''planifie''', '1 ligne(s)');

-- ---------- Partenariats ----------
select pg_temp.essai('partenariats', 'aaaaaaaa-0000-0000-0000-000000000005', 'Lire les coordonnées invités', 'select * from public.invites_coordonnees', '0 ligne(s)');
select pg_temp.essai('partenariats', 'aaaaaaaa-0000-0000-0000-000000000005', 'Lire les enregistrements', 'select * from public.enregistrements', '0 ligne(s)');
select pg_temp.essai('partenariats', 'aaaaaaaa-0000-0000-0000-000000000005', 'Modifier le statut d''un épisode', 'update public.episodes set statut = ''monte'' where id = ''cccccccc-0000-0000-0000-000000000001''', '0 ligne(s)');
select pg_temp.essai('partenariats', 'aaaaaaaa-0000-0000-0000-000000000005', 'Lire les campagnes sponsors', 'select * from public.campagnes_sponsors', '1 ligne(s)');
select pg_temp.essai('partenariats', 'aaaaaaaa-0000-0000-0000-000000000005', 'Créer une campagne sponsor', 'insert into public.campagnes_sponsors (annonceur) values (''Nouvel annonceur'')', '1 ligne(s)');

-- ---------- Production ----------
select pg_temp.essai('production', 'aaaaaaaa-0000-0000-0000-000000000002', 'Lire les campagnes sponsors', 'select * from public.campagnes_sponsors', '0 ligne(s)');
select pg_temp.essai('production', 'aaaaaaaa-0000-0000-0000-000000000002', 'Créer une émission', 'insert into public.emissions (titre, type) values (''X'', ''originale'')', 'refus (42501)');
select pg_temp.essai('production', 'aaaaaaaa-0000-0000-0000-000000000002', 'Supprimer un épisode', 'delete from public.episodes', '0 ligne(s)');
select pg_temp.essai('production', 'aaaaaaaa-0000-0000-0000-000000000002', 'Lire les coordonnées invités', 'select * from public.invites_coordonnees', '1 ligne(s)');
select pg_temp.essai('production', 'aaaaaaaa-0000-0000-0000-000000000002', 'Créer un épisode', 'insert into public.episodes (emission_id, titre) values (''bbbbbbbb-0000-0000-0000-000000000001'', ''Nouveau'')', '1 ligne(s)');
select pg_temp.essai('production', 'aaaaaaaa-0000-0000-0000-000000000002', 'Passer un épisode à « Publié »', 'update public.episodes set statut = ''publie'' where id = ''cccccccc-0000-0000-0000-000000000004''', '1 ligne(s)');

-- ---------- Direction ----------
select pg_temp.essai('direction', 'aaaaaaaa-0000-0000-0000-000000000001', 'Lire les coordonnées invités', 'select * from public.invites_coordonnees', '1 ligne(s)');
select pg_temp.essai('direction', 'aaaaaaaa-0000-0000-0000-000000000001', 'Lire les campagnes sponsors', 'select * from public.campagnes_sponsors where id = ''eeeeeeee-0000-0000-0000-000000000001''', '1 ligne(s)');
select pg_temp.essai('direction', 'aaaaaaaa-0000-0000-0000-000000000001', 'Attribuer un rôle', 'update public.profils set role = ''production'' where id = ''aaaaaaaa-0000-0000-0000-000000000006''', '1 ligne(s)');
select pg_temp.essai('direction', 'aaaaaaaa-0000-0000-0000-000000000001', 'Modifier un seuil de blocage', 'update public.parametres_blocage set jours = 15 where statut = ''idee''', '1 ligne(s)');
select pg_temp.essai('direction', 'aaaaaaaa-0000-0000-0000-000000000001', 'Supprimer un épisode', 'delete from public.episodes where id = ''cccccccc-0000-0000-0000-000000000004''', '1 ligne(s)');

select pg_temp.essai('direction', 'aaaaaaaa-0000-0000-0000-000000000001', 'Retirer son propre rôle Direction', 'update public.profils set role = ''production'' where id = ''aaaaaaaa-0000-0000-0000-000000000001''', 'refus (42501)');
select pg_temp.essai('direction', 'aaaaaaaa-0000-0000-0000-000000000001', 'Modifier l''email d''un compte', 'update public.profils set email = ''x@x.fr'' where id = ''aaaaaaaa-0000-0000-0000-000000000004''', 'refus (42501)');
select pg_temp.essai('direction', 'aaaaaaaa-0000-0000-0000-000000000001', 'Renommer un collaborateur', 'update public.profils set nom = ''Nouveau nom'' where id = ''aaaaaaaa-0000-0000-0000-000000000004''', '1 ligne(s)');
select pg_temp.essai('direction', 'aaaaaaaa-0000-0000-0000-000000000001', 'Lire tous les profils de l''équipe', 'select * from public.profils where email like ''%@rls.local''', '6 ligne(s)');

select n, acteur, test, attendu, obtenu, attendu = obtenu as ok from resultats order by n;

rollback;
