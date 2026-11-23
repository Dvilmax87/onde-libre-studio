// US-16 / US-17 (PRD) — Synchronisation des diffusions depuis le flux RSS d'une émission.
// Vercel Function : POST /api/rss-sync  { emission_id }  + en-tête Authorization: Bearer <jeton de session>
//
// Sécurité : aucune clé secrète. La fonction agit AVEC LE JETON DE L'UTILISATEUR,
// donc le RLS s'applique : seuls Direction et Diffusion peuvent écrire dans `diffusions`.
//
// Gestion explicite des 3 cas d'erreur exigés (PRD §4.1), sans jamais bloquer l'application :
//   1. INDISPONIBLE : service injoignable, délai dépassé, réponse HTTP en erreur
//   2. VIDE         : flux valide mais sans aucun épisode (ou aucun épisode rapproché)
//   3. INVALIDE     : contenu non XML / pas un flux RSS ; éléments incomplets rejetés un à un

import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';

export const PLATEFORME_RSS = 'Flux RSS (Apple Podcasts)';
const DELAI_MS = 8000;
const TAILLE_MAX = 5 * 1024 * 1024; // 5 Mo

export interface ElementFlux {
  titre: string;
  datePublication: string; // ISO
  lien: string | null;
  guid: string | null;
  duree: string | null;
  audio: string | null;
}
export interface ResultatAnalyse {
  elements: ElementFlux[];
  rejetes: { titre: string; raison: string }[];
}
export class ErreurFlux extends Error {
  code: 'INDISPONIBLE' | 'INVALIDE' | 'VIDE';
  constructor(code: 'INDISPONIBLE' | 'INVALIDE' | 'VIDE', message: string) { super(message); this.code = code; }
}

/** Normalisation pour le rapprochement par titre (règle validée le 23/11/2026). */
export function normaliserTitre(t: string): string {
  return t
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`"«»“”.,;:!?()[\]{}\-–—_/\\…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const texte = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim() || null;
  if (typeof v === 'object' && '#text' in (v as Record<string, unknown>)) return texte((v as Record<string, unknown>)['#text']);
  return null;
};

/** Analyse le XML d'un flux RSS. Lève ErreurFlux('INVALIDE') si ce n'est pas un flux RSS exploitable. */
export function analyserFlux(xml: string): ResultatAnalyse {
  if (!xml || !xml.trim()) throw new ErreurFlux('INVALIDE', 'Réponse vide : le flux ne contient aucune donnée.');
  let doc: Record<string, unknown>;
  try {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', processEntities: true, htmlEntities: true });
    doc = parser.parse(xml, true) as Record<string, unknown>;
  } catch {
    throw new ErreurFlux('INVALIDE', 'Le contenu reçu n’est pas un XML valide.');
  }
  const rss = doc.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (!channel) throw new ErreurFlux('INVALIDE', 'Le contenu reçu n’est pas un flux RSS (balise <channel> absente).');

  const brut = channel.item;
  const items = (Array.isArray(brut) ? brut : brut ? [brut] : []) as Record<string, unknown>[];
  const elements: ElementFlux[] = [];
  const rejetes: ResultatAnalyse['rejetes'] = [];

  for (const it of items) {
    const titre = texte(it.title);
    const pub = texte(it.pubDate);
    if (!titre) { rejetes.push({ titre: '(sans titre)', raison: 'Titre manquant' }); continue; }
    const date = pub ? new Date(pub) : null;
    if (!date || Number.isNaN(date.getTime())) { rejetes.push({ titre, raison: 'Date de publication manquante ou invalide' }); continue; }
    const enclosure = it.enclosure as Record<string, unknown> | undefined;
    const audio = enclosure ? texte(enclosure['@_url']) : null;
    const lienBrut = texte(it.link) ?? audio;
    const lien = lienBrut && /^https?:\/\//i.test(lienBrut) ? lienBrut : null;
    elements.push({
      titre,
      datePublication: date.toISOString(),
      lien,
      guid: texte(it.guid),
      duree: texte(it['itunes:duration']),
      audio: audio && /^https?:\/\//i.test(audio) ? audio : null,
    });
  }
  return { elements, rejetes };
}

/** Télécharge le flux avec délai maximal. Lève ErreurFlux('INDISPONIBLE') en cas d'échec réseau/HTTP. */
export async function telechargerFlux(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), DELAI_MS);
  try {
    const r = await fetchImpl(url, { signal: ctrl.signal, headers: { Accept: 'application/rss+xml, application/xml, text/xml' }, redirect: 'follow' });
    if (!r.ok) throw new ErreurFlux('INDISPONIBLE', `Le service de diffusion a répondu en erreur (HTTP ${r.status}).`);
    const corps = await r.text();
    if (corps.length > TAILLE_MAX) throw new ErreurFlux('INVALIDE', 'Le flux est anormalement volumineux (> 5 Mo).');
    return corps;
  } catch (e) {
    if (e instanceof ErreurFlux) throw e;
    if ((e as Error).name === 'AbortError') throw new ErreurFlux('INDISPONIBLE', `Le service de diffusion n’a pas répondu en ${DELAI_MS / 1000} secondes.`);
    throw new ErreurFlux('INDISPONIBLE', 'Le service de diffusion est injoignable.');
  } finally {
    clearTimeout(minuteur);
  }
}

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function POST(request: Request): Promise<Response> {
  const url = process.env.VITE_SUPABASE_URL;
  const cle = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !cle) return json({ code: 'CONFIG', message: 'Configuration serveur manquante.' }, 500);

  const jeton = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!jeton) return json({ code: 'NON_AUTHENTIFIE', message: 'Connexion requise.' }, 401);

  let emissionId: string | undefined;
  try { emissionId = ((await request.json()) as { emission_id?: string }).emission_id; } catch { /* corps invalide */ }
  if (!emissionId) return json({ code: 'REQUETE', message: 'emission_id manquant.' }, 400);

  // Client Supabase au nom de l'utilisateur : le RLS s'applique à toutes les opérations
  const sb = createClient(url, cle, { global: { headers: { Authorization: `Bearer ${jeton}` } }, auth: { persistSession: false } });

  const { data: role } = await sb.rpc('role_courant');
  if (role !== 'direction' && role !== 'diffusion') {
    return json({ code: 'INTERDIT', message: 'La synchronisation est réservée à la Direction et à la Diffusion.' }, 403);
  }

  const { data: emission, error: eErr } = await sb.from('emissions').select('id, titre, rss_url').eq('id', emissionId).maybeSingle();
  if (eErr || !emission) return json({ code: 'INTROUVABLE', message: 'Émission introuvable.' }, 404);
  if (!emission.rss_url) return json({ code: 'SANS_FLUX', message: 'Aucune URL de flux RSS renseignée pour cette émission.' }, 400);

  let analyse: ResultatAnalyse;
  try {
    analyse = analyserFlux(await telechargerFlux(emission.rss_url));
  } catch (e) {
    const err = e instanceof ErreurFlux ? e : new ErreurFlux('INDISPONIBLE', 'Erreur inattendue lors de la lecture du flux.');
    // 200 : l'erreur est un résultat métier affiché à l'utilisateur, pas une panne de l'application
    return json({ code: err.code, message: err.message });
  }

  if (analyse.elements.length === 0) {
    return json({
      code: analyse.rejetes.length ? 'INVALIDE' : 'VIDE',
      message: analyse.rejetes.length ? 'Tous les épisodes du flux sont incomplets ou invalides.' : 'Le flux ne contient aucun épisode.',
      rejetes: analyse.rejetes,
    });
  }

  const { data: episodes, error: epErr } = await sb.from('episodes').select('id, titre').eq('emission_id', emissionId);
  if (epErr) return json({ code: 'BASE', message: 'Lecture des épisodes impossible.' }, 500);
  const parTitre = new Map((episodes ?? []).map(e => [normaliserTitre(e.titre), e.id as string]));

  const maintenant = new Date().toISOString();
  const lignes: Record<string, unknown>[] = [];
  const nonRapproches: string[] = [];
  for (const el of analyse.elements) {
    const episodeId = parTitre.get(normaliserTitre(el.titre));
    if (!episodeId) { nonRapproches.push(el.titre); continue; }
    lignes.push({
      episode_id: episodeId, plateforme: PLATEFORME_RSS, date_publication: el.datePublication, lien: el.lien,
      indicateurs: { guid: el.guid, duree: el.duree, audio: el.audio }, source: 'rss', synchronise_le: maintenant,
    });
  }

  if (lignes.length) {
    const { error } = await sb.from('diffusions').upsert(lignes, { onConflict: 'episode_id,plateforme' });
    if (error) return json({ code: 'BASE', message: 'Enregistrement des diffusions refusé : ' + error.message }, 500);
  }

  return json({
    code: lignes.length === 0 ? 'VIDE' : analyse.rejetes.length ? 'PARTIEL' : 'OK',
    message: lignes.length === 0
      ? 'Flux lu, mais aucun épisode du flux ne correspond par son titre à un épisode de l’émission.'
      : `${lignes.length} épisode(s) synchronisé(s).`,
    synchronises: lignes.length,
    non_rapproches: nonRapproches,
    rejetes: analyse.rejetes,
    elements_flux: analyse.elements.length,
    synchronise_le: maintenant,
  });
}
