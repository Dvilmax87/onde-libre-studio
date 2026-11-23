import { supabase } from './supabase';

export type CodeSync = 'OK' | 'PARTIEL' | 'VIDE' | 'INVALIDE' | 'INDISPONIBLE' | 'SANS_FLUX' | 'INTERDIT' | 'NON_AUTHENTIFIE' | 'INTROUVABLE' | 'BASE' | 'CONFIG' | 'REQUETE';

export interface ResultatSync {
  code: CodeSync;
  message: string;
  synchronises?: number;
  non_rapproches?: string[];
  rejetes?: { titre: string; raison: string }[];
  elements_flux?: number;
  synchronise_le?: string;
}

/** Appelle la fonction serveur. Ne lève jamais : toute panne devient un résultat affichable. */
export async function synchroniserEmission(emissionId: string): Promise<ResultatSync> {
  const { data } = await supabase.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) return { code: 'NON_AUTHENTIFIE', message: 'Session expirée : reconnectez-vous.' };
  try {
    const r = await fetch('/api/rss-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ emission_id: emissionId }),
    });
    const corps = (await r.json().catch(() => null)) as ResultatSync | null;
    if (!corps?.code) return { code: 'INDISPONIBLE', message: `Le service de synchronisation a répondu de façon inattendue (HTTP ${r.status}).` };
    return corps;
  } catch {
    return { code: 'INDISPONIBLE', message: 'Le service de synchronisation est injoignable. Réessayez plus tard.' };
  }
}

export const TONALITE: Record<CodeSync, 'succes' | 'attention' | 'erreur'> = {
  OK: 'succes', PARTIEL: 'attention', VIDE: 'attention', INVALIDE: 'erreur', INDISPONIBLE: 'erreur',
  SANS_FLUX: 'attention', INTERDIT: 'erreur', NON_AUTHENTIFIE: 'erreur', INTROUVABLE: 'erreur', BASE: 'erreur', CONFIG: 'erreur', REQUETE: 'erreur',
};

export const TITRE_CODE: Record<CodeSync, string> = {
  OK: 'Synchronisation réussie', PARTIEL: 'Synchronisation partielle — données incomplètes ignorées',
  VIDE: 'Aucune donnée de diffusion', INVALIDE: 'Flux invalide', INDISPONIBLE: 'Service de diffusion indisponible',
  SANS_FLUX: 'Flux non renseigné', INTERDIT: 'Action non autorisée', NON_AUTHENTIFIE: 'Non connecté',
  INTROUVABLE: 'Émission introuvable', BASE: 'Erreur d’enregistrement', CONFIG: 'Configuration serveur', REQUETE: 'Requête invalide',
};
