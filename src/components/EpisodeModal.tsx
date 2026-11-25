import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase, messageErreur } from '../lib/supabase';
import { DATES_EPISODE, LIB_STATUT_EPISODE, STATUTS_EPISODE, depuisInput, versInput } from '../lib/domaine';
import type { Emission, Episode, Invite, StatutEpisode } from '../lib/domaine';

interface Props {
  episode: Episode | null;           // null = création
  invitesLies: string[];
  emissions: Emission[];
  invites: Invite[];
  peutSupprimer: boolean;
  onFermer: () => void;
  onEnregistre: () => void;
}

type Form = Record<string, string>;

export default function EpisodeModal({ episode, invitesLies, emissions, invites, peutSupprimer, onFermer, onEnregistre }: Props) {
  const [f, setF] = useState<Form>(() => {
    const base: Form = {
      emission_id: episode?.emission_id ?? emissions[0]?.id ?? '',
      titre: episode?.titre ?? '',
      resume: episode?.resume ?? '',
      numero: episode?.numero?.toString() ?? '',
      statut: episode?.statut ?? 'idee',
    };
    for (const d of DATES_EPISODE) base[d.cle] = versInput((episode?.[d.cle] as string | null) ?? null, d.type);
    return base;
  });
  const [lies, setLies] = useState<string[]>(invitesLies);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!f.titre.trim()) return setErreur('Le titre est obligatoire.');
    if (!f.emission_id) return setErreur('Choisissez une émission.');
    const numero = f.numero ? Number(f.numero) : null;
    if (numero !== null && (!Number.isInteger(numero) || numero <= 0)) return setErreur('Le numéro doit être un entier positif.');
    setEnvoi(true);
    const ligne: Record<string, unknown> = {
      emission_id: f.emission_id, titre: f.titre.trim(), resume: f.resume.trim() || null,
      numero, statut: f.statut as StatutEpisode,
    };
    for (const d of DATES_EPISODE) ligne[d.cle] = depuisInput(f[d.cle], d.type);

    const res = episode
      ? await supabase.from('episodes').update(ligne).eq('id', episode.id).select('id').single()
      : await supabase.from('episodes').insert(ligne).select('id').single();
    if (res.error) { setEnvoi(false); return setErreur(messageErreur(res.error)); }
    const id = res.data.id as string;

    // Synchronisation de la liaison épisodes ↔ invités
    const aAjouter = lies.filter(x => !invitesLies.includes(x));
    const aRetirer = invitesLies.filter(x => !lies.includes(x));
    if (aAjouter.length) {
      const r = await supabase.from('episode_invites').insert(aAjouter.map(invite_id => ({ episode_id: id, invite_id })));
      if (r.error) { setEnvoi(false); return setErreur(messageErreur(r.error)); }
    }
    if (aRetirer.length) {
      const r = await supabase.from('episode_invites').delete().eq('episode_id', id).in('invite_id', aRetirer);
      if (r.error) { setEnvoi(false); return setErreur(messageErreur(r.error)); }
    }
    setEnvoi(false);
    onEnregistre();
  }

  async function supprimer() {
    if (!episode || !window.confirm(`Supprimer définitivement « ${episode.titre} » ?`)) return;
    const r = await supabase.from('episodes').delete().eq('id', episode.id);
    if (r.error) return setErreur(messageErreur(r.error));
    onEnregistre();
  }

  return (
    <div className="voile" role="dialog" aria-modal="true" aria-labelledby="titre-modale">
      <form className="modale" onSubmit={soumettre}>
        <h2 id="titre-modale">{episode ? 'Modifier l’épisode' : 'Nouvel épisode'}</h2>
        <div className="grille-2">
          <div className="champ">
            <label htmlFor="em">Émission *</label>
            <select id="em" value={f.emission_id} onChange={e => maj('emission_id', e.target.value)}>
              {emissions.map(x => <option key={x.id} value={x.id}>{x.titre}</option>)}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="num">Numéro</label>
            <input id="num" type="number" min={1} value={f.numero} onChange={e => maj('numero', e.target.value)} />
          </div>
        </div>
        <div className="champ">
          <label htmlFor="ti">Titre *</label>
          <input id="ti" value={f.titre} onChange={e => maj('titre', e.target.value)} />
        </div>
        <div className="champ">
          <label htmlFor="re">Résumé</label>
          <textarea id="re" value={f.resume} onChange={e => maj('resume', e.target.value)} />
        </div>
        <div className="champ">
          <label htmlFor="st">Statut</label>
          <select id="st" value={f.statut} onChange={e => maj('statut', e.target.value)}>
            {STATUTS_EPISODE.map(s => <option key={s} value={s}>{LIB_STATUT_EPISODE[s]}</option>)}
          </select>
        </div>
        <fieldset style={{ border: '1px solid var(--bordure)', borderRadius: 10, padding: 16 }}>
          <legend style={{ fontWeight: 600, fontSize: 13, padding: '0 6px' }}>Dates clés</legend>
          <div className="grille-2">
            {DATES_EPISODE.map(d => (
              <div className="champ" key={d.cle}>
                <label htmlFor={d.cle}>{d.libelle}</label>
                <input id={d.cle} type={d.type} value={f[d.cle]} onChange={e => maj(d.cle, e.target.value)} />
              </div>
            ))}
          </div>
        </fieldset>
        <fieldset style={{ border: '1px solid var(--bordure)', borderRadius: 10, padding: 16 }}>
          <legend style={{ fontWeight: 600, fontSize: 13, padding: '0 6px' }}>Invités</legend>
          {invites.length === 0 && <p className="muet" style={{ margin: 0 }}>Aucun invité dans l’annuaire.</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {invites.map(i => (
              <label key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, fontSize: 14 }}>
                <input type="checkbox" checked={lies.includes(i.id)}
                  onChange={e => setLies(p => e.target.checked ? [...p, i.id] : p.filter(x => x !== i.id))} />
                {[i.prenom, i.nom].filter(Boolean).join(' ')}
              </label>
            ))}
          </div>
        </fieldset>
        {erreur && <div className="alerte" role="alert">{erreur}</div>}
        <div className="actions">
          {episode && peutSupprimer && <button type="button" className="btn" onClick={supprimer} style={{ marginRight: 'auto', color: 'var(--danger)' }}>Supprimer</button>}
          <button type="button" className="btn" onClick={onFermer}>Annuler</button>
          <button type="submit" className="btn btn-primaire" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </div>
  );
}
