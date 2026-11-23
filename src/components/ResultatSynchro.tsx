import type { ResultatSync } from '../lib/rss';
import { TITRE_CODE, TONALITE } from '../lib/rss';
import { fmtDate } from '../lib/domaine';

const STYLES = {
  succes: { background: '#E8F3EC', color: '#1D5431', border: '1px solid #B9DCC5' },
  attention: { background: '#FFF6E0', color: '#6B4A00', border: '1px solid #F0D99A' },
  erreur: { background: 'var(--alerte-fond)', color: 'var(--alerte-texte)', border: '1px solid var(--alerte-bord)' },
};

export default function ResultatSynchro({ r, onFermer }: { r: ResultatSync; onFermer: () => void }) {
  const ton = TONALITE[r.code] ?? 'erreur';
  return (
    <div role={ton === 'erreur' ? 'alert' : 'status'} style={{ ...STYLES[ton], borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>{TITRE_CODE[r.code] ?? 'Erreur'}</strong>
        <button className="btn-lien" onClick={onFermer} style={{ color: 'inherit' }}>Fermer</button>
      </div>
      <span>{r.message}</span>
      {r.code === 'INDISPONIBLE' && <span>Les dernières données connues restent affichées ; l’application continue de fonctionner.</span>}
      {r.synchronise_le && <span>Synchronisé le {fmtDate(r.synchronise_le, true)} · {r.elements_flux ?? 0} épisode(s) lu(s) dans le flux.</span>}
      {!!r.rejetes?.length && (
        <details>
          <summary style={{ cursor: 'pointer' }}>{r.rejetes.length} élément(s) du flux ignoré(s) car incomplets</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{r.rejetes.slice(0, 20).map((x, i) => <li key={i}>{x.titre} — {x.raison}</li>)}</ul>
        </details>
      )}
      {!!r.non_rapproches?.length && (
        <details>
          <summary style={{ cursor: 'pointer' }}>{r.non_rapproches.length} épisode(s) du flux sans correspondance dans l’application</summary>
          <p style={{ margin: '6px 0' }}>Rapprochement par titre identique (majuscules, accents et ponctuation ignorés).</p>
          <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 180, overflowY: 'auto' }}>{r.non_rapproches.slice(0, 50).map((t, i) => <li key={i}>{t}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
