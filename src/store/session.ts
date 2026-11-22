import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Role } from '../lib/domaine';

interface Profil { id: string; nom: string; role: Role | null; }

interface EtatSession {
  pret: boolean;
  session: Session | null;
  profil: Profil | null;
  init: () => Promise<void>;
  connexion: (email: string, mdp: string) => Promise<string | null>;
  deconnexion: () => Promise<void>;
}

async function chargerProfil(id: string): Promise<Profil | null> {
  const { data } = await supabase.from('profils').select('id, nom, role').eq('id', id).maybeSingle();
  return (data as Profil | null) ?? null;
}

export const useSession = create<EtatSession>((set) => ({
  pret: false,
  session: null,
  profil: null,
  init: async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    set({ session, profil: session ? await chargerProfil(session.user.id) : null, pret: true });
    supabase.auth.onAuthStateChange((_evt, s) => {
      // différé : ne jamais appeler Supabase directement dans ce callback
      setTimeout(async () => {
        set({ session: s, profil: s ? await chargerProfil(s.user.id) : null });
      }, 0);
    });
  },
  connexion: async (email, mdp) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: mdp });
    if (error) return 'Identifiants incorrects. Vérifiez votre email et votre mot de passe.';
    return null;
  },
  deconnexion: async () => {
    await supabase.auth.signOut();
    set({ session: null, profil: null });
  },
}));

export const useRole = () => useSession((s) => s.profil?.role ?? null);
