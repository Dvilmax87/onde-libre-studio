import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase, messageErreur } from '../lib/supabase';
import { useRole, useSession } from '../store/session';
import { ROLES, peut } from '../lib/domaine';
import type { Role } from '../lib/domaine';

interface Membre { id: string; nom: string; email: string | null; role: Role | null; }

export default function Equipe() {
  const role = useRole();
  const moi = useSession(s => s.profil?.id);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const r = await supabase.from('profils').select('id, nom, email, role').order('email');
    if (r.error) setErreur(messageErreur(r.error));
    setMembres((r.data as Membre[]) ?? []);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function maj(m: Membre, champs: Partial<Membre>) {
    setErreur(null); setInfo(null);
    const r = await supabase.from('profils').update(champs).eq('id', m.id).select('id');
    if (r.error) return setErreur(messageErreur(r.error));
    if (!r.data?.length) return setErreur('Modification refusée.');
    setInfo(`Compte ${m.email ?? m.nom} mis à jour.`);
    charger();
  }

  // 1er verrou : écran Direction (le RLS n'autorise de toute façon la modification qu'à la Direction)
  if (!peut.gererEquipe(role)) return <Navigate to="/" replace />;

  return (
    <>
      <header>
        <h1>Équipe</h1>
        <p className="sous-titre">Comptes collaborateurs et rôles applicatifs</p>
      </header>
      <div className="info">
        Les comptes se créent dans Supabase (Authentication › Users › Add user). Ils apparaissent ici sans rôle, donc sans aucun accès, jusqu’à ce que vous leur en attribuiez un.
      </div>
      {erreur && <div className="alerte" role="alert">{erreur}</div>}
      {info && <div className="info" role="status">{info}</div>}
      <div className="table-boite" >
        <table style={{ minWidth: 640 }}>
          <thead><tr><th scope="col">Email</th><th scope="col">Nom affiché</th><th scope="col">Rôle</th></tr></thead>
          <tbody>
            {membres.map(m => (
              <tr key={m.id}>
                <td>{m.email ?? '—'}{m.id === moi && <span className="muet"> (vous)</span>}</td>
                <td>
                  <label className="sr" htmlFor={`nom-${m.id}`}>Nom affiché de {m.email}</label>
                  <input id={`nom-${m.id}`} defaultValue={m.nom}
                    onBlur={e => e.target.value.trim() !== m.nom && maj(m, { nom: e.target.value.trim() })}
                    style={{ minHeight: 40, padding: '0 10px', borderRadius: 8, border: '1px solid var(--bordure-forte)', width: '100%' }} />
                </td>
                <td>
                  <label className="sr" htmlFor={`role-${m.id}`}>Rôle de {m.email}</label>
                  <select id={`role-${m.id}`} value={m.role ?? ''} disabled={m.id === moi}
                    onChange={e => maj(m, { role: (e.target.value || null) as Role | null })}
                    style={{ minHeight: 40, padding: '0 10px', borderRadius: 8, border: '1px solid var(--bordure-forte)' }}>
                    <option value="">Aucun (accès bloqué)</option>
                    {(Object.keys(ROLES) as Role[]).map(r => <option key={r} value={r}>{ROLES[r]}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
