import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase, messageErreur } from '../lib/supabase';
import { useRole } from '../store/session';
import { LIB_STATUT_EMISSION, LIB_TYPE_EMISSION, peut } from '../lib/domaine';
import type { Emission, StatutEmission, TypeEmission } from '../lib/domaine';

export default function Emissions() {
  const role = useRole();
  const gere = peut.gererEmissions(role);
  const [liste, setListe] = useState<Emission[]>([]);
  const [edition, setEdition] = useState<Emission | 'nouveau' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const r = await supabase.from('emissions').select('*').order('titre');
    if (r.error) setErreur(messageErreur(r.error));
    setListe((r.data as Emission[]) ?? []);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  return (
    <>
      <header className="entete">
        <div><h1>Émissions</h1><p className="sous-titre">Catalogue des podcasts originaux et de marque</p></div>
        {gere && <button className="btn btn-primaire" onClick={() => setEdition('nouveau')}>+ Nouvelle émission</button>}
      </header>
      {erreur && <div className="alerte" role="alert">{erreur}</div>}
      <div className="table-boite" style={{ background: '#fff' }}>
        <table style={{ minWidth: 640 }}>
          <thead><tr><th scope="col">Titre</th><th scope="col">Thématique</th><th scope="col">Type</th><th scope="col">Statut</th><th scope="col">Flux RSS</th>{gere && <th scope="col"><span className="sr">Actions</span></th>}</tr></thead>
          <tbody>
            {liste.map(e => (
              <tr key={e.id}>
                <td style={{ fontWeight: 600 }}>{e.titre}</td>
                <td>{e.thematique || '—'}</td>
                <td>{LIB_TYPE_EMISSION[e.type]}</td>
                <td>{LIB_STATUT_EMISSION[e.statut]}</td>
                <td className="muet">{e.rss_url ? 'Renseigné' : '—'}</td>
                {gere && <td><button className="btn-lien" onClick={() => setEdition(e)}>Modifier</button></td>}
              </tr>
            ))}
            {liste.length === 0 && <tr><td colSpan={6} className="muet">Aucune émission.</td></tr>}
          </tbody>
        </table>
      </div>
      {edition && <EmissionModal emission={edition === 'nouveau' ? null : edition} onFermer={() => setEdition(null)} onEnregistre={() => { setEdition(null); charger(); }} />}
    </>
  );
}

function EmissionModal({ emission, onFermer, onEnregistre }: { emission: Emission | null; onFermer: () => void; onEnregistre: () => void }) {
  const [f, setF] = useState({
    titre: emission?.titre ?? '', thematique: emission?.thematique ?? '',
    type: (emission?.type ?? 'originale') as TypeEmission, statut: (emission?.statut ?? 'en_projet') as StatutEmission,
    rss_url: emission?.rss_url ?? '',
  });
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!f.titre.trim()) return setErreur('Le titre est obligatoire.');
    if (f.rss_url && !/^https?:\/\//i.test(f.rss_url.trim())) return setErreur('L’URL du flux RSS doit commencer par http:// ou https://');
    const ligne = { titre: f.titre.trim(), thematique: f.thematique.trim() || null, type: f.type, statut: f.statut, rss_url: f.rss_url.trim() || null };
    const r = emission ? await supabase.from('emissions').update(ligne).eq('id', emission.id) : await supabase.from('emissions').insert(ligne);
    if (r.error) return setErreur(messageErreur(r.error));
    onEnregistre();
  }

  return (
    <div className="voile" role="dialog" aria-modal="true" aria-labelledby="t-em">
      <form className="modale" onSubmit={soumettre}>
        <h2 id="t-em">{emission ? 'Modifier l’émission' : 'Nouvelle émission'}</h2>
        <div className="champ"><label htmlFor="t">Titre *</label><input id="t" value={f.titre} onChange={e => setF({ ...f, titre: e.target.value })} /></div>
        <div className="champ"><label htmlFor="th">Thématique</label><input id="th" value={f.thematique} onChange={e => setF({ ...f, thematique: e.target.value })} /></div>
        <div className="grille-2">
          <div className="champ"><label htmlFor="ty">Type</label>
            <select id="ty" value={f.type} onChange={e => setF({ ...f, type: e.target.value as TypeEmission })}>
              {Object.entries(LIB_TYPE_EMISSION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="champ"><label htmlFor="st">Statut</label>
            <select id="st" value={f.statut} onChange={e => setF({ ...f, statut: e.target.value as StatutEmission })}>
              {Object.entries(LIB_STATUT_EMISSION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
        </div>
        <div className="champ"><label htmlFor="rss">URL du flux RSS</label><input id="rss" type="url" value={f.rss_url} onChange={e => setF({ ...f, rss_url: e.target.value })} /></div>
        {erreur && <div className="alerte" role="alert">{erreur}</div>}
        <div className="actions">
          <button type="button" className="btn" onClick={onFermer}>Annuler</button>
          <button type="submit" className="btn btn-primaire">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}
