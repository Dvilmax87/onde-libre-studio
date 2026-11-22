import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase, messageErreur } from '../lib/supabase';
import { useRole } from '../store/session';
import { LIB_STATUT_EMISSION, LIB_STATUT_EPISODE, STATUTS_EPISODE, fmtDate, peut } from '../lib/domaine';
import type { Blocage, Emission, Episode, StatutEpisode } from '../lib/domaine';

interface Seuil { statut: StatutEpisode; jours: number; }

export default function Pilotage() {
  const role = useRole();
  const [emissions, setEmissions] = useState<Emission[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [blocages, setBlocages] = useState<Blocage[]>([]);
  const [seuils, setSeuils] = useState<Seuil[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const [em, ep, bl, se] = await Promise.all([
      supabase.from('emissions').select('*').order('titre'),
      supabase.from('episodes').select('*'),
      supabase.from('v_blocages').select('*').order('depuis'),
      supabase.from('parametres_blocage').select('statut, jours'),
    ]);
    const e = [em, ep, bl, se].find(r => r.error)?.error;
    if (e) setErreur(messageErreur(e));
    setEmissions((em.data as Emission[]) ?? []);
    setEpisodes((ep.data as Episode[]) ?? []);
    setBlocages((bl.data as Blocage[]) ?? []);
    setSeuils(((se.data as Seuil[]) ?? []).sort((a, b) => STATUTS_EPISODE.indexOf(a.statut) - STATUTS_EPISODE.indexOf(b.statut)));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const maintenant = Date.now();
  const enCours = episodes.filter(e => e.statut !== 'publie');
  const aVenir = useMemo(() => episodes
    .filter(e => e.date_publication_prevue && new Date(e.date_publication_prevue).getTime() > maintenant)
    .sort((a, b) => a.date_publication_prevue!.localeCompare(b.date_publication_prevue!)), [episodes, maintenant]);
  const publies = episodes.filter(e => e.statut === 'publie');
  const epBloques = new Set(blocages.map(b => b.episode_id));
  const epById = Object.fromEntries(episodes.map(e => [e.id, e]));
  const emById = Object.fromEntries(emissions.map(e => [e.id, e]));
  const libEp = (e?: Episode) => e ? `${emById[e.emission_id]?.titre ?? ''}${e.numero ? ` · n° ${e.numero}` : ''} — ${e.titre}` : '—';

  async function majSeuil(statut: StatutEpisode, jours: number) {
    if (!Number.isInteger(jours) || jours <= 0) return setErreur('Le seuil doit être un nombre entier de jours supérieur à 0.');
    const r = await supabase.from('parametres_blocage').update({ jours }).eq('statut', statut);
    if (r.error) return setErreur(messageErreur(r.error));
    setErreur(null);
    charger();
  }

  // 1er verrou : écran réservé à la Direction (le RLS protège les données sensibles)
  if (!peut.voirPilotage(role)) return <Navigate to="/" replace />;

  return (
    <>
      <header>
        <h1>Pilotage du studio</h1>
        <p className="sous-titre">Vue d’ensemble de l’activité</p>
      </header>
      {erreur && <div className="alerte" role="alert">{erreur}</div>}

      <div className="grille-4">
        <Tuile titre="En cours" valeur={enCours.length} aide="Épisodes non encore publiés" />
        <Tuile titre="À venir" valeur={aVenir.length} aide="Publication prévue dans le futur" />
        <Tuile titre="Publiés" valeur={publies.length} aide="Statut « Publié »" />
        <Tuile titre="Points de blocage" valeur={epBloques.size} aide="Épisodes à traiter" alerte />
      </div>

      <div className="disposition">
        <section className="principal carte panneau" aria-labelledby="t-bl">
          <h2 id="t-bl">Points de blocage</h2>
          <div className="table-boite">
            <table style={{ minWidth: 560 }}>
              <thead><tr><th scope="col">Épisode</th><th scope="col">Statut</th><th scope="col">Motif</th><th scope="col">Depuis</th></tr></thead>
              <tbody>
                {blocages.map((b, i) => {
                  const ep = epById[b.episode_id];
                  return (
                    <tr key={i}>
                      <td>{libEp(ep)}</td>
                      <td>{ep && <span className={`chip chip-${ep.statut}`}>{LIB_STATUT_EPISODE[ep.statut]}</span>}</td>
                      <td>{b.detail}</td>
                      <td className="muet">{fmtDate(b.depuis)}</td>
                    </tr>
                  );
                })}
                {blocages.length === 0 && <tr><td colSpan={4} className="muet">Aucun blocage.</td></tr>}
              </tbody>
            </table>
          </div>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, minHeight: 44, display: 'flex', alignItems: 'center' }}>Règles et seuils de blocage</summary>
            <p className="muet">Un épisode est bloqué si : une date prévue est dépassée sans changement de statut depuis · un enregistrement est « À réenregistrer » · il reste au même statut au-delà du seuil ci-dessous.</p>
            <div className="grille-4">
              {seuils.map(s => (
                <div className="champ" key={s.statut}>
                  <label htmlFor={`s-${s.statut}`}>{LIB_STATUT_EPISODE[s.statut]} (jours)</label>
                  <input id={`s-${s.statut}`} type="number" min={1} defaultValue={s.jours}
                    onBlur={e => Number(e.target.value) !== s.jours && majSeuil(s.statut, Number(e.target.value))} />
                </div>
              ))}
            </div>
          </details>
        </section>

        <section className="lateral carte panneau" aria-labelledby="t-em">
          <h2 id="t-em">Par émission</h2>
          <div className="table-boite">
            <table>
              <thead><tr><th scope="col">Émission</th><th scope="col">Statut</th><th scope="col" style={{ textAlign: 'right' }}>En cours</th><th scope="col" style={{ textAlign: 'right' }}>Publiés</th></tr></thead>
              <tbody>
                {emissions.map(em => (
                  <tr key={em.id}>
                    <td>{em.titre}</td><td>{LIB_STATUT_EMISSION[em.statut]}</td>
                    <td style={{ textAlign: 'right' }}>{enCours.filter(e => e.emission_id === em.id).length}</td>
                    <td style={{ textAlign: 'right' }}>{publies.filter(e => e.emission_id === em.id).length}</td>
                  </tr>
                ))}
                {emissions.length === 0 && <tr><td colSpan={4} className="muet">Aucune émission.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="carte panneau" aria-labelledby="t-av">
        <h2 id="t-av">Prochaines publications</h2>
        {aVenir.length === 0 && <p className="muet" style={{ margin: 0 }}>Aucune publication programmée.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {aVenir.slice(0, 10).map(e => (
            <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 12, border: '1px solid var(--bordure)', borderRadius: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{fmtDate(e.date_publication_prevue, true)}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{libEp(e)}</span>
              <span className="muet" style={{ fontSize: 12 }}>{LIB_STATUT_EPISODE[e.statut]}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Tuile({ titre, valeur, aide, alerte }: { titre: string; valeur: number; aide: string; alerte?: boolean }) {
  return (
    <div className={`carte ${alerte ? 'tuile-alerte' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{titre}</span>
      <span className="chiffre">{valeur}</span>
      <span style={{ fontSize: 12 }} className={alerte ? '' : 'muet'}>{aide}</span>
    </div>
  );
}
