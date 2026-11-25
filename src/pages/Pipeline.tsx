import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, messageErreur } from '../lib/supabase';
import { useRole } from '../store/session';
import {
  DATES_EPISODE, LIB_STATUT_EPISODE, STATUTS_EPISODE, fmtDate, peut, statutSuivant, statutsAutorises,
} from '../lib/domaine';
import type { Blocage, Diffusion, Emission, Enregistrement, Episode, Invite, StatutEpisode } from '../lib/domaine';
import EpisodeModal from '../components/EpisodeModal';
import Enregistrements from '../components/Enregistrements';

interface Liaison { episode_id: string; invite_id: string; }

// Forme d'onde décorative, stable pour un même épisode
function Onde({ graine }: { graine: string }) {
  const g = [...graine].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <div className="onde" aria-hidden="true">
      {Array.from({ length: 40 }, (_, i) => {
        const v = Math.abs(Math.sin(i * 0.55 + g) * Math.cos(i * 0.21 + g * 2)) * 0.85 + 0.15;
        return <span key={i} style={{ height: Math.round(v * 26), opacity: 0.45 + v * 0.55 }} />;
      })}
    </div>
  );
}

export default function Pipeline() {
  const role = useRole();
  const [emissions, setEmissions] = useState<Emission[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [liaisons, setLiaisons] = useState<Liaison[]>([]);
  const [enregs, setEnregs] = useState<Enregistrement[]>([]);
  const [blocages, setBlocages] = useState<Blocage[]>([]);
  const [diffusions, setDiffusions] = useState<Diffusion[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fEmission, setFEmission] = useState('tous');
  const [fStatut, setFStatut] = useState<'tous' | StatutEpisode>('tous');
  const [selId, setSelId] = useState<string | null>(null);
  const [modale, setModale] = useState<'creer' | 'editer' | null>(null);

  const charger = useCallback(async () => {
    setErreur(null);
    const [em, ep, inv, li, en, bl, di] = await Promise.all([
      supabase.from('emissions').select('*').order('titre'),
      supabase.from('episodes').select('*').order('date_publication_prevue', { ascending: true, nullsFirst: false }),
      supabase.from('invites').select('*').order('nom'),
      supabase.from('episode_invites').select('episode_id, invite_id'),
      peut.voirEnregistrements(role) ? supabase.from('enregistrements').select('*').order('date_creneau') : Promise.resolve({ data: [], error: null }),
      supabase.from('v_blocages').select('*'),
      supabase.from('diffusions').select('*').order('date_publication', { ascending: false }),
    ]);
    const e = [em, ep, inv, li, en, bl, di].find(r => r.error)?.error;
    if (e) setErreur(messageErreur(e));
    setEmissions((em.data as Emission[]) ?? []);
    setEpisodes((ep.data as Episode[]) ?? []);
    setInvites((inv.data as Invite[]) ?? []);
    setLiaisons((li.data as Liaison[]) ?? []);
    setEnregs((en.data as Enregistrement[]) ?? []);
    setBlocages((bl.data as Blocage[]) ?? []);
    setDiffusions((di.data as Diffusion[]) ?? []);
    setChargement(false);
  }, [role]);

  useEffect(() => { charger(); }, [charger]);

  const nomEmission = useMemo(() => Object.fromEntries(emissions.map(e => [e.id, e.titre])), [emissions]);
  const nomInvite = useMemo(() => Object.fromEntries(invites.map(i => [i.id, [i.prenom, i.nom].filter(Boolean).join(' ')])), [invites]);
  const invitesDe = (id: string) => liaisons.filter(l => l.episode_id === id).map(l => l.invite_id);
  const blocagesDe = (id: string) => blocages.filter(b => b.episode_id === id);

  const filtres = episodes.filter(e => fEmission === 'tous' || e.emission_id === fEmission);
  const colonnes = STATUTS_EPISODE.filter(s => fStatut === 'tous' || s === fStatut);
  const sel = episodes.find(e => e.id === selId) ?? null;

  async function changerStatut(ep: Episode, statut: StatutEpisode) {
    setErreur(null);
    const r = await supabase.from('episodes').update({ statut }).eq('id', ep.id).select('id');
    if (r.error) return setErreur(messageErreur(r.error));
    if (!r.data?.length) return setErreur('Modification refusée : vous n’avez pas les droits sur cet épisode.');
    charger();
  }

  return (
    <>
      <header className="entete">
        <div>
          <h1>Pipeline des épisodes</h1>
          <p className="sous-titre">De l’idée à la publication</p>
        </div>
        {peut.creerEpisode(role) && (
          <button className="btn btn-primaire" disabled={emissions.length === 0}
            title={emissions.length === 0 ? 'Créez d’abord une émission' : undefined}
            onClick={() => setModale('creer')}>+ Nouvel épisode</button>
        )}
      </header>

      <div className="barre-filtres">
        <label htmlFor="f-em" style={{ fontSize: 13, fontWeight: 600 }}>Émission</label>
        <select id="f-em" value={fEmission} onChange={e => setFEmission(e.target.value)}
>
          <option value="tous">Toutes les émissions</option>
          {emissions.map(e => <option key={e.id} value={e.id}>{e.titre}</option>)}
        </select>
        <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 8 }}>Statut</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(['tous', ...STATUTS_EPISODE] as const).map(s => (
            <button key={s} className="pastille" aria-pressed={fStatut === s} onClick={() => setFStatut(s)}>
              {s === 'tous' ? 'Tous' : LIB_STATUT_EPISODE[s]}
            </button>
          ))}
        </div>
      </div>

      {erreur && <div className="alerte" role="alert">{erreur}</div>}
      {chargement && <p className="muet">Chargement…</p>}
      {!chargement && emissions.length === 0 && (
        <div className="info">Aucune émission pour l’instant. {peut.gererEmissions(role) ? 'Créez-en une depuis l’écran Émissions.' : 'La Direction doit en créer une.'}</div>
      )}

      <div className="disposition">
        <div className="principal kanban-boite">
          <div className="kanban">
            {colonnes.map(s => {
              const cartes = filtres.filter(e => e.statut === s);
              return (
                <section key={s} className="colonne" aria-label={LIB_STATUT_EPISODE[s]}>
                  <div className="colonne-tete">
                    <div className={`vumetre ${s === 'publie' ? 'fini' : ''}`} aria-hidden="true">
                      {STATUTS_EPISODE.map((x, i) => <span key={x} className={i <= STATUTS_EPISODE.indexOf(s) ? 'on' : ''} />)}
                    </div>
                    <strong>{LIB_STATUT_EPISODE[s]}</strong>
                    <span className="muet" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{cartes.length} épisode{cartes.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="piste">
                  {cartes.map(ep => {
                    const nxt = statutSuivant(role, ep.statut);
                    const bl = blocagesDe(ep.id);
                    const nbInv = invitesDe(ep.id).length;
                    return (
                      <article key={ep.id} className={`carte-ep ${ep.id === selId ? 'selection' : ''}`}>
                        <button className="carte-ep-corps" onClick={() => setSelId(ep.id)}>
                          <span className="carte-ep-meta">
                            {nomEmission[ep.emission_id]}{ep.numero ? ` · n° ${ep.numero}` : ''}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{ep.titre}</span>
                          <Onde graine={ep.id} />
                          <span className="muet" style={{ fontSize: 12 }}>{nbInv === 0 ? 'Aucun invité' : `${nbInv} invité${nbInv > 1 ? 's' : ''}`}</span>
                          <span className="muet" style={{ fontSize: 12 }}>Publication prévue : {fmtDate(ep.date_publication_prevue)}</span>
                        </button>
                        {bl.length > 0 && <span className="chip chip-blocage" style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>Blocage · {bl[0].detail}{bl.length > 1 ? ` (+${bl.length - 1})` : ''}</span>}
                        {nxt && <button className="btn btn-doux" onClick={() => changerStatut(ep, nxt)}>Passer à « {LIB_STATUT_EPISODE[nxt]} » →</button>}
                      </article>
                    );
                  })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <aside className="lateral carte panneau" aria-label="Détail de l’épisode">
          {!sel && <p className="muet" style={{ margin: 0 }}>Sélectionnez un épisode pour voir son détail.</p>}
          {sel && (
            <>
              <span className="muet" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {nomEmission[sel.emission_id]}{sel.numero ? ` · n° ${sel.numero}` : ''}
              </span>
              <h2>{sel.titre}</h2>
              {statutsAutorises(role, sel.statut).length > 0 ? (
                <div className="champ">
                  <label htmlFor="chg-st">Statut</label>
                  <select id="chg-st" value={sel.statut} onChange={e => changerStatut(sel, e.target.value as StatutEpisode)}>
                    <option value={sel.statut}>{LIB_STATUT_EPISODE[sel.statut]}</option>
                    {statutsAutorises(role, sel.statut).map(s => <option key={s} value={s}>{LIB_STATUT_EPISODE[s]}</option>)}
                  </select>
                </div>
              ) : <span className={`chip chip-${sel.statut}`} style={{ alignSelf: 'flex-start' }}>{LIB_STATUT_EPISODE[sel.statut]}</span>}
              {blocagesDe(sel.id).map((b, i) => <div key={i} className="alerte">Blocage · {b.detail}</div>)}
              {sel.resume && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{sel.resume}</p>}
              <div>
                <h3 style={{ marginBottom: 4 }}>Invités</h3>
                <span className="muet">{invitesDe(sel.id).map(id => nomInvite[id]).join(', ') || 'Aucun'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid var(--bordure)' }}>
                <h3>Dates clés</h3>
                {DATES_EPISODE.map(d => (
                  <div className="ligne-date" key={d.cle}>
                    <span className="muet">{d.libelle}</span>
                    <strong style={{ fontWeight: 500 }}>{fmtDate(sel[d.cle] as string | null, d.type === 'datetime-local')}</strong>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid var(--bordure)' }}>
                <h3>Diffusions</h3>
                {diffusions.filter(d => d.episode_id === sel.id).length === 0 && (
                  <p className="muet" style={{ margin: 0 }}>Aucune donnée de diffusion pour cet épisode.</p>
                )}
                {diffusions.filter(d => d.episode_id === sel.id).map(d => (
                  <div key={d.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 10, border: '1px solid var(--bordure)', borderRadius: 8, fontSize: 13 }}>
                    <strong>{d.plateforme}</strong>
                    <span className="muet">Publié le {fmtDate(d.date_publication, true)}{d.indicateurs?.duree ? ` · durée ${d.indicateurs.duree}` : ''}</span>
                    {d.lien && <a href={d.lien} target="_blank" rel="noopener noreferrer">Écouter / voir la publication</a>}
                    {d.synchronise_le && <span className="muet" style={{ fontSize: 12 }}>Données RSS synchronisées le {fmtDate(d.synchronise_le, true)}</span>}
                  </div>
                ))}
              </div>
              {peut.voirEnregistrements(role) && (
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--bordure)' }}>
                  <Enregistrements episodeId={sel.id} liste={enregs.filter(r => r.episode_id === sel.id)}
                    peutGerer={peut.gererEnregistrements(role)} onChange={charger} />
                </div>
              )}
              {peut.editerEpisode(role) && <button className="btn" onClick={() => setModale('editer')}>Modifier l’épisode</button>}
            </>
          )}
        </aside>
      </div>

      {modale && (
        <EpisodeModal
          episode={modale === 'editer' ? sel : null}
          invitesLies={modale === 'editer' && sel ? invitesDe(sel.id) : []}
          emissions={emissions} invites={invites}
          peutSupprimer={peut.supprimerEpisode(role)}
          onFermer={() => setModale(null)}
          onEnregistre={() => { setModale(null); charger(); }}
        />
      )}
    </>
  );
}
