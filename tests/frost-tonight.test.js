// Will it frost tonight: NWS grid parsing, the night answer, alerts, and the page contract.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const F = require('../public/national-tools/frost/_assets/frost-tonight-engine.js');
const E = require('../public/national-tools/frost/_assets/frost-cover-engine.js');
const ROOT = path.join(__dirname, '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'public/national-tools/frost/cover-plants-tonight/index.html'), 'utf8');
const TZ = 'America/New_York', NOW = Date.parse('2026-10-25T21:00:00-04:00');
// A grid in NWS shape: hourly values from 6 PM tonight for 60 hours, built from functions of the local hour offset.
function grid({ temp, sky = () => 10, wind = () => 3, dew = h => temp(h) - 2, updated = '2026-10-25T19:00:00-04:00' }) {
  const t0 = Date.parse('2026-10-25T18:00:00-04:00'), layer = (f, uom) => ({ uom, values: Array.from({ length: 60 }, (_, h) => ({ validTime: new Date(t0 + h * 3600e3).toISOString().replace('.000Z', '+00:00') + '/PT1H', value: f(h) })) });
  const toC = f => h => (f(h) - 32) * 5 / 9;
  return { properties: { updateTime: updated, temperature: layer(toC(temp), 'wmoUnit:degC'), dewpoint: layer(toC(dew), 'wmoUnit:degC'), skyCover: layer(sky, 'wmoUnit:percent'), windSpeed: layer(h => wind(h) * 1.609344, 'wmoUnit:km_h-1') } };
}
// Cools to `low` at 6 AM (12 hours after 6 PM), warms after.
const night = low => h => low + Math.abs(h - 12) * 1.5;
const code = (g, a) => F.assess(g, a || { features: [] }, NOW, TZ).tonight.code;

test('reads the real NWS grid sample: units, expansion of multi-hour periods', () => {
  const g = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/nws-grid-sample.json'), 'utf8'));
  const hours = F.fromGrid(g);
  assert.ok(hours.length > 100);
  for (let i = 1; i < hours.length; i++) assert.equal(hours[i].ms - hours[i - 1].ms, 3600e3, 'hourly and gap-free');
  const h = hours[0]; assert.ok(h.temp > -40 && h.temp < 120 && h.sky >= 0 && h.sky <= 100 && h.wind >= 0 && h.wind < 80);
  assert.equal(F.hoursOf('PT6H'), 6); assert.equal(F.hoursOf('P1DT2H'), 26);
});

test('night answers follow the NWS frost and freeze ranges and the clear, calm rule', () => {
  assert.equal(code(grid({ temp: night(27) })), 'HARD_FREEZE');
  assert.equal(code(grid({ temp: night(30) })), 'FREEZE');
  assert.equal(code(grid({ temp: night(34) })), 'FROST_LIKELY');
  assert.equal(code(grid({ temp: night(34), sky: () => 80 })), 'FROST_POSSIBLE');
  assert.equal(code(grid({ temp: night(34), sky: () => 80, wind: () => 15 })), 'FROST_UNLIKELY');
  assert.equal(code(grid({ temp: night(38) })), 'LOW_SPOTS');
  assert.equal(code(grid({ temp: night(38), wind: () => 12 })), 'NO_FROST');
  assert.equal(code(grid({ temp: night(45) })), 'NO_FROST');
  const r = F.assess(grid({ temp: night(30) }), { features: [] }, NOW, TZ);
  assert.equal(Math.round(r.tonight.low), 30); assert.ok(r.tonight.below32 >= 1 && r.tonight.first32.temp <= 32);
  assert.equal(r.nights.length, 3); assert.notEqual(r.nights[1].code, 'UNKNOWN');
});

test('stale or missing forecasts never give a safe answer', () => {
  assert.equal(F.assess(grid({ temp: night(45), updated: '2026-10-24T01:00:00-04:00' }), null, NOW, TZ).stale, true);
  assert.equal(F.assess(null, null, NOW, TZ).tonight.code, 'UNKNOWN');
});

test('only frost and freeze alerts are kept, from the real alert sample', () => {
  const a = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/nws-alert-sample.json'), 'utf8'));
  const k = F.frostAlerts(a); assert.equal(k.length, 1); assert.match(k[0].event, /Frost Advisory/); assert.ok(k[0].headline);
  assert.deepEqual(F.frostAlerts({ features: [{ properties: { event: 'Wind Advisory' } }] }), []);
});

test('the cover decision runs on the same hours', () => {
  const r = F.assess(grid({ temp: night(34) }), null, NOW, TZ);
  const d = E.decide({ crop: 'tomato', stage: 'mature', setting: 'bed', protection: 'sheet' }, { location: { timeZone: TZ }, current_forecast: { updated_at: r.updated, periods: F.asPeriods(r.hours) } }, new Date(NOW));
  assert.equal(d.code, 'COVER'); assert.ok(Math.abs(d.lowest - r.tonight.low) < 1e-9);
});

test('page: frost-tonight answer first, cover decision kept, no server function, sources cited', () => {
  const title = PAGE.match(/<title>([^<]+)<\/title>/)[1], desc = PAGE.match(/<meta name="description" content="([^"]+)"/)[1];
  assert.match(title, /^Will It Frost Tonight\?/); assert.ok(title.length <= 60 && desc.length <= 158);
  assert.match(PAGE, /<h1>Will it frost tonight\?<\/h1>/);
  assert.ok(PAGE.indexOf('id="ft-panel"') < PAGE.indexOf('id="cover-panel"'), 'the frost answer comes before the cover decision');
  assert.match(PAGE, /<h2>Should I cover my plants tonight\?<\/h2>/);
  assert.match(PAGE, /id="ft-live" role="status"/); assert.match(PAGE, /<svg id="ft-chart" role="img" aria-labelledby=/);
  assert.match(PAGE, /frost-cover-engine\.js[\s\S]*frost-tonight-engine\.js[\s\S]*frost-tonight-page\.js/);
  assert.doesNotMatch(PAGE, /frost-cover-page\.js/);
  const js = fs.readFileSync(path.join(ROOT, 'public/national-tools/frost/_assets/frost-tonight-page.js'), 'utf8');
  assert.doesNotMatch(js, /\/api\//, 'reads NWS directly: no Vercel function call');
  assert.match(PAGE, /weather\.gov\/rlx\/frost-freeze-information/);
  for (const s of [title, desc, PAGE.match(/<p class="lede">([^<]+)<\/p>/)[1]]) assert.doesNotMatch(s, /Michigan/);
  assert.match(PAGE, /id="ft-michigan" hidden>In Michigan\? <a href="\/michigan-frost-dates\/">/);
  assert.doesNotMatch(PAGE, /—/);
});
