import { useState } from 'react';
import { supabase, messageErreur } from '../lib/supabase';
import { LIB_LIEU, LIB_PRISE_SON, depuisInput, fmtDate } from '../lib/domaine';
import type { Enregistrement, Lieu, StatutPriseSon } from '../lib/domaine';

interface Props { episodeId: string; liste: Enregistrement[]; peutGerer: boolean; onChange: () => void; }

export default function Enregistrements({ episodeId, liste, peutGerer, onChange }: Props) {
  const [ajout, setAjout] = useState(false);
  const [date, setDate] = useState('');
  const [lieu, setLieu] = useState<Lieu | ''>('');
  const [erreur, setErreur] = useState<string | null>(null);

  async function ajouter() {
    setErreur(null);
    const r = await supabase.from('enregistrements').insert({
      episode_id: episodeId, date_creneau: depuisInput(date, 'datetime-local'), lieu: lieu || null,
    });
    if (r.error) return setErreur(messageErreur(r.error));
    setAjout(false); setDate(''); setLieu(''); onChange();
  }

  async function majStatut(id: string, statut: StatutPriseSon) {
    setErreur(null);
    const r = await supabase.from('enregistrements').update({ statut_prise_son: statut }).eq('id', id);
    if (r.error) return setErreur(messageErreur(r.error));
    onChange();
  }

  async function majNotes(id: string, notes: string) {
    const r = await supabase.from('enregistrements').update({ notes_montage: notes || null }).eq('id', id);
    if (r.error) return setErreur(messageErreur(r.error));
    onChange();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3>Enregistrements</h3>
      {liste.length === 0 && <p className="muet" style={{ margin: 0 }}>Aucune session.</p>}
      {liste.map((r, i) => (
        <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, border: '1px solid var(--bordure)', borderRadius: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            Session {i + 1} · {r.lieu ? LIB_LIEU[r.lieu] : 'Lieu non précisé'} · {fmtDate(r.date_creneau, true)}
          </span>
          {peutGerer ? (
            <>
              <label className="muet" htmlFor={`ps-${r.id}`}>Prise de son</label>
              <select id={`ps-${r.id}`} value={r.statut_prise_son} onChange={e => majStatut(r.id, e.target.value as StatutPriseSon)}
                style={{ minHeight: 40, borderRadius: 8, border: '1px solid var(--bordure-forte)', padding: '0 8px' }}>
                {Object.entries(LIB_PRISE_SON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <label className="muet" htmlFor={`nm-${r.id}`}>Notes de montage</label>
              <textarea id={`nm-${r.id}`} defaultValue={r.notes_montage ?? ''} onBlur={e => e.target.value !== (r.notes_montage ?? '') && majNotes(r.id, e.target.value)}
                style={{ minHeight: 60, borderRadius: 8, border: '1px solid var(--bordure-forte)', padding: 8 }} />
            </>
          ) : (
            <>
              <span className="muet">Prise de son : {LIB_PRISE_SON[r.statut_prise_son]}</span>
              {r.notes_montage && <span className="muet">Notes : {r.notes_montage}</span>}
            </>
          )}
        </div>
      ))}
      {peutGerer && !ajout && <button className="btn" onClick={() => setAjout(true)}>+ Planifier une session</button>}
      {ajout && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, border: '1px solid var(--bordure)', borderRadius: 8 }}>
          <div className="champ"><label htmlFor="cr">Date / créneau</label><input id="cr" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="champ">
            <label htmlFor="li">Lieu</label>
            <select id="li" value={lieu} onChange={e => setLieu(e.target.value as Lieu | '')}>
              <option value="">—</option>
              <option value="studio">Studio</option>
              <option value="distance">À distance</option>
            </select>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => setAjout(false)}>Annuler</button>
            <button className="btn btn-primaire" onClick={ajouter}>Ajouter</button>
          </div>
        </div>
      )}
      {erreur && <div className="alerte" role="alert">{erreur}</div>}
    </div>
  );
}
