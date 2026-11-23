import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../store/session';
import { peut, ROLES } from '../lib/domaine';

export function Logo({ taille = 28 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="13" fill="none" stroke="#2952CC" strokeWidth="2" />
      <path d="M6 14c2-5 4-5 6 0s4 5 6 0 4-5 4 0" fill="none" stroke="#2952CC" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Layout() {
  const { profil, session, deconnexion } = useSession();
  const role = profil?.role ?? null;
  // 1er verrou : seuls les écrans autorisés apparaissent (le 2e verrou est le RLS en base)
  const liens = [
    { to: '/', label: 'Pipeline des épisodes', visible: true },
    { to: '/invites', label: 'Invités', visible: true },
    { to: '/emissions', label: 'Émissions', visible: true },
    { to: '/campagnes', label: 'Campagnes sponsors', visible: peut.voirCampagnes(role) },
    { to: '/pilotage', label: 'Pilotage Direction', visible: peut.voirPilotage(role) },
    { to: '/equipe', label: 'Équipe', visible: peut.gererEquipe(role) },
  ].filter(l => l.visible);

  return (
    <div className="app">
      <nav className="nav" aria-label="Navigation principale">
        <div className="nav-marque"><Logo /> Onde Libre Studio</div>
        <div className="nav-liens">
          {liens.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => (isActive ? 'actif' : '')}>{l.label}</NavLink>
          ))}
        </div>
        <div className="nav-pied">
          <strong style={{ fontSize: 14 }}>{profil?.nom || session?.user.email}</strong>
          <span className="muet">Rôle : {role ? ROLES[role] : '—'}</span>
          <button className="btn" style={{ marginTop: 8, alignSelf: 'flex-start' }} onClick={deconnexion}>Se déconnecter</button>
        </div>
      </nav>
      <main className="contenu"><Outlet /></main>
    </div>
  );
}
