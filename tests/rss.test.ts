// Tests du connecteur RSS (US-17 PRD) — exécution : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyserFlux, normaliserTitre, telechargerFlux, ErreurFlux } from '../api/rss-sync.ts';

const flux = (items: string) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>Émission</title>${items}</channel></rss>`;

const item = (titre: string, date = 'Sun, 14 Jun 2026 11:01:03 +0200') => `<item>
  <title>${titre}</title><pubDate>${date}</pubDate><link>https://exemple.fr/ep</link>
  <guid>abc-123</guid><itunes:duration>00:43:32</itunes:duration>
  <enclosure url="https://exemple.fr/ep.mp3" type="audio/mpeg" length="1"/>
</item>`;

test('flux valide : éléments extraits avec date ISO, lien, durée, audio', () => {
  const r = analyserFlux(flux(item('De Mélenchon à Glucksmann, la bataille des gauches est lancée')));
  assert.equal(r.elements.length, 1);
  assert.equal(r.rejetes.length, 0);
  assert.equal(r.elements[0].datePublication, '2026-06-14T09:01:03.000Z');
  assert.equal(r.elements[0].lien, 'https://exemple.fr/ep');
  assert.equal(r.elements[0].duree, '00:43:32');
  assert.equal(r.elements[0].audio, 'https://exemple.fr/ep.mp3');
});

test('un seul <item> (non tableau) est accepté', () => {
  assert.equal(analyserFlux(flux(item('Seul'))).elements.length, 1);
});

test('entités HTML et CDATA décodées', () => {
  const r = analyserFlux(flux(item('<![CDATA[Ça & là : l’été]]>')));
  assert.equal(r.elements[0].titre, 'Ça & là : l’été');
});

// ---- Cas d'erreur n°2 : réponse vide / absence de données ----
test('VIDE : flux valide sans aucun épisode', () => {
  const r = analyserFlux(flux(''));
  assert.equal(r.elements.length, 0);
  assert.equal(r.rejetes.length, 0);
});

test('INVALIDE : réponse vide', () => {
  assert.throws(() => analyserFlux(''), (e: unknown) => e instanceof ErreurFlux && e.code === 'INVALIDE');
});

// ---- Cas d'erreur n°3 : format invalide ou incomplet ----
test('INVALIDE : page HTML au lieu d’un flux', () => {
  assert.throws(() => analyserFlux('<!doctype html><html><body>Page</body></html>'), (e: unknown) => e instanceof ErreurFlux && e.code === 'INVALIDE');
});

test('INVALIDE : XML mal formé', () => {
  assert.throws(() => analyserFlux('<rss><channel><item><title>x</channel>'), (e: unknown) => e instanceof ErreurFlux && e.code === 'INVALIDE');
});

test('éléments incomplets rejetés un à un, les valides conservés', () => {
  const r = analyserFlux(flux(item('Valide') + '<item><pubDate>Sun, 14 Jun 2026 11:00:00 +0200</pubDate></item>' + item('Date pourrie', 'pas une date')));
  assert.equal(r.elements.length, 1);
  assert.deepEqual(r.rejetes.map(x => x.raison), ['Titre manquant', 'Date de publication manquante ou invalide']);
});

test('lien non http ignoré (pas d’injection javascript:)', () => {
  const r = analyserFlux(flux(item('X').replace('https://exemple.fr/ep</link>', 'javascript:alert(1)</link>')));
  assert.equal(r.elements[0].lien, null);
});

// ---- Cas d'erreur n°1 : service indisponible / délai dépassé ----
test('INDISPONIBLE : erreur réseau', async () => {
  const f = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
  await assert.rejects(telechargerFlux('https://x.invalid', f), (e: unknown) => e instanceof ErreurFlux && e.code === 'INDISPONIBLE');
});

test('INDISPONIBLE : HTTP 503', async () => {
  const f = (async () => new Response('down', { status: 503 })) as unknown as typeof fetch;
  await assert.rejects(telechargerFlux('https://x.invalid', f), (e: unknown) => e instanceof ErreurFlux && e.code === 'INDISPONIBLE' && /503/.test(e.message));
});

test('INDISPONIBLE : délai dépassé (abandon de la requête)', async () => {
  const f = ((_u: string, init: RequestInit) => new Promise((_r, rej) => {
    init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  })) as unknown as typeof fetch;
  const t0 = Date.now();
  await assert.rejects(telechargerFlux('https://x.invalid', f), (e: unknown) => e instanceof ErreurFlux && e.code === 'INDISPONIBLE' && /secondes/.test(e.message));
  assert.ok(Date.now() - t0 < 9500);
});

// ---- Règle de rapprochement par titre ----
test('rapprochement : casse, accents et ponctuation ignorés', () => {
  assert.equal(normaliserTitre('De Mélenchon à Glucksmann, la bataille des gauches est lancée !'),
               normaliserTitre('de melenchon a glucksmann la bataille des gauches est lancee'));
  assert.equal(normaliserTitre('L’Europe — « et après » ?'), normaliserTitre("l'europe et apres"));
  assert.notEqual(normaliserTitre('Épisode 1'), normaliserTitre('Épisode 2'));
});
