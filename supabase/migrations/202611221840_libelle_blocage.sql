-- Libellé explicite pour la règle « date prévue dépassée »
create or replace view public.v_blocages with (security_invoker = true) as
  -- (a) date prévue dépassée sans changement de statut depuis
  select e.id as episode_id, 'date_depassee'::text as regle,
         'Date dépassée : ' || d.libelle as detail, d.echeance as depuis
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

