import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './store/session';
import Layout from './components/Layout';
import Connexion from './pages/Connexion';
import Pipeline from './pages/Pipeline';
import Invites from './pages/Invites';
import Emissions from './pages/Emissions';
import Pilotage from './pages/Pilotage';

export default function App() {
  const { pret, session, profil, init, deconnexion } = useSession();
  useEffect(() => { init(); }, [init]);

  if (!pret) return <p className="muet" style={{ padding: 32 }}>Chargement…</p>;
  if (!session) return <Connexion />;
  if (!profil?.role) {
    return (
      <div className="page-connexion">
        <div className="boite-connexion">
          <h1 style={{ fontSize: 20 }}>Accès en attente</h1>
          <p className="muet" style={{ margin: 0 }}>Votre compte existe, mais aucun rôle ne vous a encore été attribué. Contactez la Direction.</p>
          <button className="btn" onClick={deconnexion}>Se déconnecter</button>
        </div>
      </div>
    );
  }
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Pipeline />} />
          <Route path="/invites" element={<Invites />} />
          <Route path="/emissions" element={<Emissions />} />
          <Route path="/pilotage" element={<Pilotage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
