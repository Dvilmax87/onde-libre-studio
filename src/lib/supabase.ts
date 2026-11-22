import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  throw new Error('Configuration manquante : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (voir .env.example)');
}

export const supabase = createClient(url, key);

/** Message lisible à partir d'une erreur Supabase/Postgres. */
export function messageErreur(e: unknown): string {
  const err = e as { code?: string; message?: string } | null;
  if (!err) return 'Erreur inconnue';
  if (err.code === '42501') return err.message?.includes(':') ? err.message : 'Action non autorisée pour votre rôle.';
  if (err.code === '23505') return 'Cette valeur existe déjà (doublon).';
  if (err.code === '23503') return 'Impossible : cet élément est lié à d’autres données.';
  if (err.code === '23514') return 'Valeur refusée par les règles de la base.';
  if (err.code === '22P02') return 'Valeur invalide.';
  return err.message ?? 'Erreur inconnue';
}
