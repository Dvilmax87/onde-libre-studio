import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSession } from '../store/session';
import { Logo } from '../components/Layout';

export default function Connexion() {
  const connexion = useSession(s => s.connexion);
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(await connexion(email.trim(), mdp));
    setEnvoi(false);
  }

  return (
    <div className="page-connexion">
      <main className="boite-connexion">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <Logo taille={48} />
          <h1 style={{ fontSize: 22 }}>Onde Libre Studio</h1>
          <p className="muet" style={{ margin: 0, fontSize: 14 }}>Connectez-vous avec votre compte personnel</p>
        </div>
        <form onSubmit={soumettre} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="champ">
            <label htmlFor="email">Adresse email</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="champ">
            <label htmlFor="mdp">Mot de passe</label>
            <input id="mdp" type="password" autoComplete="current-password" required value={mdp} onChange={e => setMdp(e.target.value)} />
          </div>
          {erreur && <div className="alerte" role="alert">{erreur}</div>}
          <button className="btn btn-primaire" type="submit" disabled={envoi}>{envoi ? 'Connexion…' : 'Se connecter'}</button>
        </form>
        <p className="muet" style={{ margin: 0, paddingTop: 16, borderTop: '1px solid var(--bordure)', textAlign: 'center', fontSize: 12 }}>
          Pas de compte ? Les accès sont créés par la Direction. Les écrans et actions affichés dépendent de votre rôle.
        </p>
      </main>
    </div>
  );
}
