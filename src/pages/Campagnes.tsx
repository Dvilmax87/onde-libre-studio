import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase, messageErreur } from '../lib/supabase';
import { useRole } from '../store/session';
import { LIB_STATUT_EPISODE, fmtDate, peut } from '../lib/domaine';
import type { Emission, Episode } from '../lib/domaine';

// PRD §3.2 / §2 — Campagnes sponsors : Direction + Partenariats (le RLS bloque tous les autres rôles).
// Champs V1 strictement ceux du PRD : annonceur, périmètre, période, données réservées, épisodes rattachés.

interface Campagne {
  id: string; annonceur: string; perimetre: string | null;
  date_debut: string | null; date_fin: string | null; donnees_reservees: string | null;
}
interface Lien { episode_id: string; campagne_id: string; }

export default function Campagnes() {
  const role = useRole();
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [liens, setLiens] = useState<Lien[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [emissions, setEmissions] = useState<Emission[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [edition, setEdition] = useState<Campagne | 'nouveau' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const [ca, li, ep, em] = await Promise.all([
      supabase.from('campagnes_sponsors').select('*').order('date_debut', { ascending: false, nullsFirst: false }),
      supabase.from('episode_campagnes').select('episode_id, campagne_id'),
      supabase.from('episodes').select('*').order('date_publication_prevue', { ascending: false, nullsFirst: false }),
      supabase.from('emissions').select('*').order('titre'),
    ]);
    const e = [ca, li, ep, em].find(r => r.error)?.error;
    if (e) setErreur(messageErreur(e));
    const liste = (ca.data as Campagne[]) ?? [];
    setCampagnes(liste);
    setLiens((li.data as Lien[]) ?? []);
    setEpisodes((ep.data as Episode[]) ?? []);
    setEmissions((em.data as Emission[]) ?? []);
    setSelId(id => id ?? liste[0]?.id ?? null);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const emById = useMemo(() => Object.fromEntries(emissions.map(e => [e.id, e.titre])), [emissions]);
  const epById = useMemo(() => Object.fromEntries(episodes.map(e => [e.id, e])), [episodes]);
  const sel = campagnes.find(c => c.id === selId) ?? null;
  const episodesDe = (id: string) => liens.filter(l => l.campagne_id === id).map(l => epById[l.episode_id]).filter(Boolean) as Episode[];
  const libEp = (e: Episode) => `${emById[e.emission_id] ?? ''}${e.numero ? ` · n° ${e.numero}` : ''} — ${e.titre}`;
  const periode = (c: Campagne) => c.date_debut || c.date_fin ? `${fmtDate(c.date_debut)} → ${fmtDate(c.date_fin)}` : 'Période non définie';

  // 1er verrou : écran Direction / Partenariats
  if (!peut.voirCampagnes(role)) return <Navigate to="/" replace />;

  return (
    <>
      <header className="entete">
        <div>
          <h1>Campagnes sponsors</h1>
          <p className="sous-titre">Annonceurs, périmètre sponsorisé et épisodes rattachés — données confidentielles</p>
        </div>
        <button className="btn btn-primaire" onClick={() => setEdition('nouveau')}>+ Nouvelle campagne</button>
      </header>
      {erreur && <div className="alerte" role="alert">{erreur}</div>}

      <div className="disposition">
        <section className="lateral carte panneau" aria-label="Liste des campagnes" style={{ order: -1 }}>
          {campagnes.length === 0 && <p className="muet" style={{ margin: 0 }}>Aucune campagne.</p>}
          {campagnes.map(c => {
            const n = episodesDe(c.id).length;
            return (
              <button key={c.id} onClick={() => setSelId(c.id)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minHeight: 44, padding: '10px 12px', borderRadius: 8, border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--texte)', background: c.id === selId ? 'var(--accent-pale)' : 'transparent' }}>
                <span style={{ fontWeight: 600 }}>{c.annonceur}</span>
                <span className="muet" style={{ fontSize: 12 }}>{periode(c)} · {n} épisode{n > 1 ? 's' : ''}</span>
              </button>
            );
          })}
        </section>

        <article className="principal carte panneau" aria-label="Fiche campagne">
          {!sel && <p className="muet" style={{ margin: 0 }}>Sélectionnez ou créez une campagne.</p>}
          {sel && (
            <>
              <div className="entete">
                <h2 style={{ fontSize: 22 }}>{sel.annonceur}</h2>
                <button className="btn" onClick={() => setEdition(sel)}>Modifier</button>
              </div>
              <div className="grille-2">
                <Bloc titre="Période">{periode(sel)}</Bloc>
                <Bloc titre="Périmètre de la campagne">{sel.perimetre || '—'}</Bloc>
              </div>
              <Bloc titre="Données réservées (confidentiel)">{sel.donnees_reservees || '—'}</Bloc>
              <h3>Épisodes rattachés</h3>
              <div className="table-boite">
                <table style={{ minWidth: 520 }}>
                  <thead><tr><th scope="col">Épisode</th><th scope="col">Statut</th><th scope="col">Publication</th></tr></thead>
                  <tbody>
                    {episodesDe(sel.id).map(e => (
                      <tr key={e.id}>
                        <td>{libEp(e)}</td>
                        <td><span className={`chip chip-${e.statut}`}>{LIB_STATUT_EPISODE[e.statut]}</span></td>
                        <td className="muet">{e.date_publication_effective ? fmtDate(e.date_publication_effective) : `${fmtDate(e.date_publication_prevue)} (prévue)`}</td>
                      </tr>
                    ))}
                    {episodesDe(sel.id).length === 0 && <tr><td colSpan={3} className="muet">Aucun épisode rattaché.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </article>
      </div>

      {edition && (
        <CampagneModal
          campagne={edition === 'nouveau' ? null : edition}
          lies={edition === 'nouveau' ? [] : liens.filter(l => l.campagne_id === edition.id).map(l => l.episode_id)}
          episodes={episodes} libEp={libEp}
          peutSupprimer={role === 'direction'}
          onFermer={() => setEdition(null)}
          onEnregistre={(id) => { setEdition(null); setSelId(id ?? null); charger(); }}
        />
      )}
    </>
  );
}

function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16, border: '1px solid var(--bordure)', borderRadius: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{titre}</span>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--texte-2)', whiteSpace: 'pre-line' }}>{children}</div>
    </div>
  );
}

function CampagneModal({ campagne, lies, episodes, libEp, peutSupprimer, onFermer, onEnregistre }: {
  campagne: Campagne | null; lies: string[]; episodes: Episode[]; libEp: (e: Episode) => string;
  peutSupprimer: boolean; onFermer: () => void; onEnregistre: (id?: string) => void;
}) {
  const [f, setF] = useState({
    annonceur: campagne?.annonceur ?? '', perimetre: campagne?.perimetre ?? '',
    date_debut: campagne?.date_debut ?? '', date_fin: campagne?.date_fin ?? '',
    donnees_reservees: campagne?.donnees_reservees ?? '',
  });
  const [choix, setChoix] = useState<string[]>(lies);
  const [filtre, setFiltre] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const vide = (s: string) => s.trim() || null;

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!f.annonceur.trim()) return setErreur('L’annonceur est obligatoire.');
    if (f.date_debut && f.date_fin && f.date_fin < f.date_debut) return setErreur('La date de fin doit être postérieure à la date de début.');
    setEnvoi(true);
    const ligne = { annonceur: f.annonceur.trim(), perimetre: vide(f.perimetre), date_debut: f.date_debut || null, date_fin: f.date_fin || null, donnees_reservees: vide(f.donnees_reservees) };
    const r = campagne
      ? await supabase.from('campagnes_sponsors').update(ligne).eq('id', campagne.id).select('id').single()
      : await supabase.from('campagnes_sponsors').insert(ligne).select('id').single();
    if (r.error) { setEnvoi(false); return setErreur(messageErreur(r.error)); }
    const id = r.data.id as string;
    const ajout = choix.filter(x => !lies.includes(x));
    const retrait = lies.filter(x => !choix.includes(x));
    if (ajout.length) {
      const a = await supabase.from('episode_campagnes').insert(ajout.map(episode_id => ({ episode_id, campagne_id: id })));
      if (a.error) { setEnvoi(false); return setErreur(messageErreur(a.error)); }
    }
    if (retrait.length) {
      const d = await supabase.from('episode_campagnes').delete().eq('campagne_id', id).in('episode_id', retrait);
      if (d.error) { setEnvoi(false); return setErreur(messageErreur(d.error)); }
    }
    setEnvoi(false);
    onEnregistre(id);
  }

  async function supprimer() {
    if (!campagne || !window.confirm(`Supprimer définitivement la campagne « ${campagne.annonceur} » ? Les rattachements aux épisodes seront aussi supprimés.`)) return;
    const r = await supabase.from('campagnes_sponsors').delete().eq('id', campagne.id);
    if (r.error) return setErreur(messageErreur(r.error));
    onEnregistre();
  }

  const t = filtre.trim().toLowerCase();
  const visibles = episodes.filter(e => !t || libEp(e).toLowerCase().includes(t));

  return (
    <div className="voile" role="dialog" aria-modal="true" aria-labelledby="t-camp">
      <form className="modale" onSubmit={soumettre}>
        <h2 id="t-camp">{campagne ? 'Modifier la campagne' : 'Nouvelle campagne'}</h2>
        <div className="champ"><label htmlFor="an">Annonceur *</label><input id="an" value={f.annonceur} onChange={e => setF({ ...f, annonceur: e.target.value })} /></div>
        <div className="champ"><label htmlFor="pe">Périmètre de la campagne</label><textarea id="pe" value={f.perimetre} onChange={e => setF({ ...f, perimetre: e.target.value })} /></div>
        <div className="grille-2">
          <div className="champ"><label htmlFor="dd">Début</label><input id="dd" type="date" value={f.date_debut} onChange={e => setF({ ...f, date_debut: e.target.value })} /></div>
          <div className="champ"><label htmlFor="df">Fin</label><input id="df" type="date" value={f.date_fin} onChange={e => setF({ ...f, date_fin: e.target.value })} /></div>
        </div>
        <div className="champ"><label htmlFor="dr">Données réservées (confidentiel)</label><textarea id="dr" value={f.donnees_reservees} onChange={e => setF({ ...f, donnees_reservees: e.target.value })} /></div>
        <fieldset style={{ border: '1px solid var(--bordure)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <legend style={{ fontWeight: 600, fontSize: 13, padding: '0 6px' }}>Épisodes rattachés ({choix.length})</legend>
          <div className="champ">
            <label htmlFor="fe">Filtrer les épisodes</label>
            <input id="fe" type="search" value={filtre} onChange={e => setFiltre(e.target.value)} placeholder="Émission, titre…" />
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {visibles.map(e => (
              <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 14 }}>
                <input type="checkbox" checked={choix.includes(e.id)} onChange={ev => setChoix(p => ev.target.checked ? [...p, e.id] : p.filter(x => x !== e.id))} />
                <span style={{ flex: 1 }}>{libEp(e)}</span>
                <span className={`chip chip-${e.statut}`}>{LIB_STATUT_EPISODE[e.statut]}</span>
              </label>
            ))}
            {visibles.length === 0 && <p className="muet" style={{ margin: 0 }}>Aucun épisode.</p>}
          </div>
        </fieldset>
        {erreur && <div className="alerte" role="alert">{erreur}</div>}
        <div className="actions">
          {campagne && peutSupprimer && <button type="button" className="btn" style={{ marginRight: 'auto', color: '#9A3A0A' }} onClick={supprimer}>Supprimer</button>}
          <button type="button" className="btn" onClick={onFermer}>Annuler</button>
          <button type="submit" className="btn btn-primaire" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </div>
  );
}
