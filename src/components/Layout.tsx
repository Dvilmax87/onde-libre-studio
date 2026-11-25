import { NavLink, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useSession } from '../store/session';
import { peut, ROLES } from '../lib/domaine';

export function Logo({ taille = 40 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="8" cy="32" r="3.5" fill="var(--accent)" stroke="none" />
      <path d="M8 22a10 10 0 0 1 10 10" />
      <path d="M8 13a19 19 0 0 1 19 19" opacity=".7" />
      <path d="M8 4a28 28 0 0 1 28 28" opacity=".4" />
    </svg>
  );
}

const icone = (d: ReactNode) => (
  <span className="nav-icone" aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
  </span>
);

export default function Layout() {
  const { profil, session, deconnexion } = useSession();
  const role = profil?.role ?? null;
  // 1er verrou : seuls les écrans autorisés apparaissent (le 2e verrou est le RLS en base)
  const liens = [
    { to: '/', label: 'Pipeline', visible: true, d: <path d="M3 12h1.5M7 8v8M11 4v16M15 7v10M19 10v4" /> },
    { to: '/invites', label: 'Invités', visible: true, d: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="11" r="2.4" /><path d="M5.6 16.5c.8-1.5 2-2.3 3.4-2.3s2.6.8 3.4 2.3M15 10h4M15 13.5h3" /></> },
    { to: '/emissions', label: 'Émissions', visible: true, d: <><rect x="3" y="8" width="18" height="12" rx="2.5" /><path d="M7 8l9-5" /><circle cx="15.5" cy="14" r="3" /><path d="M6.5 12.5h3M6.5 15.5h3" /></> },
    { to: '/campagnes', label: 'Campagnes', visible: peut.voirCampagnes(role), d: <path d="M3.5 10v4h3l7.5 4.5v-13L6.5 10h-3zM17 9a3.5 3.5 0 0 1 0 6M7.5 14.5l1 5h3" /> },
    { to: '/pilotage', label: 'Pilotage', visible: peut.voirPilotage(role), d: <><path d="M4 17a8 8 0 1 1 16 0M12 17l4.2-5" /><circle cx="12" cy="17" r="1.6" /></> },
    { to: '/equipe', label: 'Équipe', visible: peut.gererEquipe(role), d: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 20c0-3.3 2.5-5.8 5.5-5.8s5.5 2.5 5.5 5.8" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16 14.4c2.7.3 4.6 2.6 4.6 5.6" /></> },
  ].filter(l => l.visible);

  return (
    <div className="app">
      <nav className="nav" aria-label="Navigation principale">
        <div className="nav-marque"><Logo /><div><strong>ONDE LIBRE</strong><small>STUDIO</small></div></div>
        <div className="nav-liens">
          {liens.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => (isActive ? 'actif' : '')}>{icone(l.d)}{l.label}</NavLink>
          ))}
        </div>
        <div className="nav-pied">
          <strong style={{ fontSize: 14 }}>{profil?.nom || session?.user.email}</strong>
          <span className="muet" style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>{role ? ROLES[role] : '—'}</span>
          <button className="btn" style={{ marginTop: 8, alignSelf: 'flex-start' }} onClick={deconnexion}>Se déconnecter</button>
        </div>
      </nav>
      <main className="contenu"><Outlet /></main>
    </div>
  );
}
