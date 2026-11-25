import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { supabase, messageErreur } from '../lib/supabase';
import { useRole } from '../store/session';
import { LIB_STATUT_EPISODE, fmtDate, peut } from '../lib/domaine';
import type { Coordonnees, Invite, StatutEpisode } from '../lib/domaine';

interface Participation {
  invite_id: string;
  episodes: { id: string; titre: string; numero: number | null; statut: StatutEpisode; date_publication_prevue: string | null;
    date_publication_effective: string | null; emissions: { titre: string } | null } | null;
}

const nomComplet = (i: Invite) => [i.prenom, i.nom].filter(Boolean).join(' ');

export default function Invites() {
  const role = useRole();
  const voitCoord = peut.voirCoordonnees(role);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [coords, setCoords] = useState<Coordonnees[]>([]);
  const [parts, setParts] = useState<Participation[]>([]);
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const [edition, setEdition] = useState<Invite | 'nouveau' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setErreur(null);
    const [inv, pa, co] = await Promise.all([
      supabase.from('invites').select('*').order('nom'),
      supabase.from('episode_invites').select('invite_id, episodes(id, titre, numero, statut, date_publication_prevue, date_publication_effective, emissions(titre))'),
      // 1er verrou : la requête n'est même pas envoyée sans le droit (le RLS renverrait 0 ligne)
      voitCoord ? supabase.from('invites_coordonnees').select('*') : Promise.resolve({ data: [], error: null }),
    ]);
    const e = [inv, pa, co].find(r => r.error)?.error;
    if (e) setErreur(messageErreur(e));
    const liste = (inv.data as Invite[]) ?? [];
    setInvites(liste);
    setParts((pa.data as unknown as Participation[]) ?? []);
    setCoords((co.data as Coordonnees[]) ?? []);
    setSelId(id => id ?? liste[0]?.id ?? null);
  }, [voitCoord]);

  useEffect(() => { charger(); }, [charger]);

  const filtres = useMemo(() => {
    const t = q.trim().toLowerCase();
    return invites.filter(i => !t || nomComplet(i).toLowerCase().includes(t));
  }, [invites, q]);
  const sel = invites.find(i => i.id === selId) ?? null;
  const histo = (id: string) => parts.filter(p => p.invite_id === id && p.episodes).map(p => p.episodes!);
  const coordSel = sel ? coords.find(c => c.invite_id === sel.id) : undefined;

  return (
    <>
      <header className="entete">
        <div>
          <h1>Invités</h1>
          <p className="sous-titre">Annuaire partagé et historique des participations</p>
        </div>
        {peut.gererInvites(role) && <button className="btn btn-primaire" onClick={() => setEdition('nouveau')}>+ Nouvel invité</button>}
      </header>
      {erreur && <div className="alerte" role="alert">{erreur}</div>}

      <div className="disposition">
        <section className="lateral carte panneau" aria-label="Annuaire" style={{ order: -1 }}>
          <div className="champ">
            <label htmlFor="q">Rechercher un invité</label>
            <input id="q" type="search" placeholder="Nom, prénom…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtres.map(i => {
              const n = histo(i.id).length;
              return (
                <button key={i.id} onClick={() => setSelId(i.id)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minHeight: 44, padding: '10px 12px', borderRadius: 8, border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--texte)', background: i.id === selId ? 'var(--accent-pale)' : 'transparent' }}>
                  <span style={{ fontWeight: 600 }}>{nomComplet(i)}</span>
                  <span className="muet" style={{ fontSize: 12 }}>{n === 0 ? 'Aucun épisode' : `${n} épisode${n > 1 ? 's' : ''}`}</span>
                </button>
              );
            })}
            {filtres.length === 0 && <p className="muet">Aucun invité ne correspond.</p>}
          </div>
        </section>

        <article className="principal carte panneau" aria-label="Fiche invité">
          {!sel && <p className="muet" style={{ margin: 0 }}>Aucun invité sélectionné.</p>}
          {sel && (
            <>
              <div className="entete">
                <h2 style={{ fontSize: 22 }}>{nomComplet(sel)}</h2>
                {peut.gererInvites(role) && <button className="btn" onClick={() => setEdition(sel)}>Modifier la fiche</button>}
              </div>
              <div className="grille-2">
                <Bloc titre="Biographie">{sel.biographie || '—'}</Bloc>
                <Bloc titre="Modalités de prise de contact">{sel.modalites_contact || '—'}</Bloc>
                <Bloc titre="Coordonnées">
                  {voitCoord
                    ? <>Email : {coordSel?.email || '—'}<br />Téléphone : {coordSel?.telephone || '—'}</>
                    : <span className="info" style={{ display: 'block' }}>Données protégées — accès réservé à la Direction et à la Production.</span>}
                </Bloc>
                <Bloc titre="Notes">{sel.notes || '—'}</Bloc>
              </div>
              <h3>Historique des participations</h3>
              <div className="table-boite">
                <table style={{ minWidth: 520 }}>
                  <thead><tr><th scope="col">Émission</th><th scope="col">Épisode</th><th scope="col">Statut</th><th scope="col">Publication</th></tr></thead>
                  <tbody>
                    {histo(sel.id).map(ep => (
                      <tr key={ep.id}>
                        <td>{ep.emissions?.titre ?? '—'}</td>
                        <td>{ep.numero ? `n° ${ep.numero} · ` : ''}{ep.titre}</td>
                        <td><span className={`chip chip-${ep.statut}`}>{LIB_STATUT_EPISODE[ep.statut]}</span></td>
                        <td className="muet">{ep.date_publication_effective ? fmtDate(ep.date_publication_effective) : `${fmtDate(ep.date_publication_prevue)} (prévue)`}</td>
                      </tr>
                    ))}
                    {histo(sel.id).length === 0 && <tr><td colSpan={4} className="muet">Aucune participation.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </article>
      </div>

      {edition && (
        <InviteModal invite={edition === 'nouveau' ? null : edition}
          coord={edition !== 'nouveau' ? coords.find(c => c.invite_id === edition.id) : undefined}
          peutSupprimer={role === 'direction'}
          onFermer={() => setEdition(null)}
          onEnregistre={(id) => { setEdition(null); if (id) setSelId(id); charger(); }} />
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

function InviteModal({ invite, coord, peutSupprimer, onFermer, onEnregistre }: {
  invite: Invite | null; coord?: Coordonnees; peutSupprimer: boolean; onFermer: () => void; onEnregistre: (id?: string) => void;
}) {
  const [f, setF] = useState({
    prenom: invite?.prenom ?? '', nom: invite?.nom ?? '', biographie: invite?.biographie ?? '',
    modalites_contact: invite?.modalites_contact ?? '', notes: invite?.notes ?? '',
    email: coord?.email ?? '', telephone: coord?.telephone ?? '',
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));
  const vide = (s: string) => s.trim() || null;

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!f.nom.trim()) return setErreur('Le nom est obligatoire.');
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErreur('Adresse email invalide.');
    const ligne = { prenom: vide(f.prenom), nom: f.nom.trim(), biographie: vide(f.biographie), modalites_contact: vide(f.modalites_contact), notes: vide(f.notes) };
    const r = invite
      ? await supabase.from('invites').update(ligne).eq('id', invite.id).select('id').single()
      : await supabase.from('invites').insert(ligne).select('id').single();
    if (r.error) return setErreur(messageErreur(r.error));
    const id = r.data.id as string;
    const c = await supabase.from('invites_coordonnees').upsert({ invite_id: id, email: vide(f.email), telephone: vide(f.telephone) });
    if (c.error) return setErreur(messageErreur(c.error));
    onEnregistre(id);
  }

  async function supprimer() {
    if (!invite || !window.confirm(`Supprimer définitivement la fiche de ${nomComplet(invite)} ?`)) return;
    const r = await supabase.from('invites').delete().eq('id', invite.id);
    if (r.error) return setErreur(r.error.code === '23503' ? 'Impossible : cet invité a participé à des épisodes (historique conservé).' : messageErreur(r.error));
    onEnregistre();
  }

  const champs: [keyof typeof f, string][] = [
    ['prenom', 'Prénom'], ['nom', 'Nom *'], ['email', 'Email'], ['telephone', 'Téléphone'],
  ];
  return (
    <div className="voile" role="dialog" aria-modal="true" aria-labelledby="t-inv">
      <form className="modale" onSubmit={soumettre}>
        <h2 id="t-inv">{invite ? 'Modifier la fiche' : 'Nouvel invité'}</h2>
        <div className="grille-2">
          {champs.map(([k, l]) => (
            <div className="champ" key={k}><label htmlFor={k}>{l}</label>
              <input id={k} type={k === 'email' ? 'email' : k === 'telephone' ? 'tel' : 'text'} value={f[k]} onChange={e => maj(k, e.target.value)} /></div>
          ))}
        </div>
        <div className="champ"><label htmlFor="bio">Biographie</label><textarea id="bio" value={f.biographie} onChange={e => maj('biographie', e.target.value)} /></div>
        <div className="champ"><label htmlFor="mc">Modalités de prise de contact</label><textarea id="mc" value={f.modalites_contact} onChange={e => maj('modalites_contact', e.target.value)} /></div>
        <div className="champ"><label htmlFor="no">Notes</label><textarea id="no" value={f.notes} onChange={e => maj('notes', e.target.value)} /></div>
        {erreur && <div className="alerte" role="alert">{erreur}</div>}
        <div className="actions">
          {invite && peutSupprimer && <button type="button" className="btn" style={{ marginRight: 'auto', color: 'var(--danger)' }} onClick={supprimer}>Supprimer</button>}
          <button type="button" className="btn" onClick={onFermer}>Annuler</button>
          <button type="submit" className="btn btn-primaire">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}
