/* Will it frost tonight? The engine for /national-tools/frost/cover-plants-tonight/.
 *
 * Inputs, all read in the browser from the National Weather Service (api.weather.gov):
 *   the forecast grid for the place (hourly temperature, dew point, sky cover, wind speed), and
 *   active alerts for the point (Frost Advisory, Freeze Watch, Freeze Warning, Hard Freeze Warning).
 *
 * Thresholds follow NWS frost and freeze products, as stated by NWS Charleston, WV: a Frost Advisory when
 * minimums of 33 to 36°F are expected with good radiational cooling (light winds and clear skies); a
 * Freeze Warning for 29 to 32°F; a hard freeze at 28°F or below. Criteria vary by NWS office, so an
 * official alert for the point always outranks this page's own reading of the grid.
 * The site's own reading of "clear" and "light wind" (disclosed on the page): average sky cover of 30%
 * or less and wind of 5 mph or less in the coldest hours (those within 2°F of the low).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FrostTonight = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const CLEAR = 30, CALM = 5, NEAR = 2;
  const C2F = c => c * 9 / 5 + 32, KMH2MPH = k => k / 1.609344;
  const FROST_EVENTS = /^(Frost Advisory|Freeze Watch|Freeze Warning|Hard Freeze Watch|Hard Freeze Warning)$/;

  /** "PT3H", "P1DT6H" -> hours */
  function hoursOf(dur) { const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?)?/.exec(String(dur || '')); return m ? (Number(m[1] || 0) * 24 + Number(m[2] || 0)) || 1 : 1; }
  /** Expand one grid layer ({uom, values:[{validTime:"start/PTnH", value}]}) to hourly {ms -> value}. */
  function expand(layer, conv) {
    const out = new Map();
    for (const v of (layer && layer.values) || []) {
      if (v.value === null || v.value === undefined) continue;
      const [start, dur] = String(v.validTime).split('/'), t0 = Date.parse(start); if (!Number.isFinite(t0)) continue;
      for (let h = 0; h < hoursOf(dur); h++) out.set(t0 + h * 3600e3, conv(Number(v.value)));
    }
    return out;
  }
  const convFor = (layer, kind) => {
    const u = String(layer && layer.uom || '');
    if (kind === 'temp') return /degF/.test(u) ? x => x : C2F;
    if (kind === 'wind') return /km_h/.test(u) ? KMH2MPH : /m_s/.test(u) ? x => x * 2.236936 : x => x;
    return x => x;
  };
  /** NWS gridpoint JSON -> [{ms, iso, temp, dew, sky, wind}] sorted, hours that have a temperature. */
  function fromGrid(json) {
    const p = json && json.properties; if (!p) return [];
    const T = expand(p.temperature, convFor(p.temperature, 'temp')), D = expand(p.dewpoint, convFor(p.dewpoint, 'temp'));
    const S = expand(p.skyCover, x => x), W = expand(p.windSpeed, convFor(p.windSpeed, 'wind'));
    return [...T.keys()].sort((a, b) => a - b).map(ms => ({ ms, iso: new Date(ms).toISOString(), temp: T.get(ms), dew: D.has(ms) ? D.get(ms) : null, sky: S.has(ms) ? S.get(ms) : null, wind: W.has(ms) ? W.get(ms) : null }));
  }
  /** Active NWS alerts (GeoJSON) -> frost and freeze alerts only. */
  function frostAlerts(json) {
    return ((json && json.features) || []).map(f => f.properties || {}).filter(p => FROST_EVENTS.test(p.event || ''))
      .map(p => ({ event: p.event, headline: p.headline || p.event, onset: p.onset || null, ends: p.ends || p.expires || null, sender: p.senderName || null }));
  }

  // ---------- nights ----------
  function local(ms, tz) {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
    const z = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, Number(x.value)]));
    return { day: Math.floor(Date.UTC(z.year, z.month - 1, z.day) / 864e5), hour: z.hour, month: z.month, date: z.day };
  }
  /** Night k (0 = the coming or current night): 4 PM local to 10 AM the next morning. Before 10 AM, night 0
   * is the night now ending. Hours already past are dropped from night 0. */
  function nightHours(hours, nowMs, tz, k) {
    const here = local(nowMs, tz), startDay = (here.hour < 10 ? here.day - 1 : here.day) + k;
    return hours.filter(h => { const l = local(h.ms, tz), clock = l.day * 24 + l.hour; return clock >= startDay * 24 + 16 && clock < (startDay + 1) * 24 + 10 && (k > 0 || h.ms >= nowMs - 3600e3); });
  }
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  /** The answer for one night. */
  function assessNight(hrs) {
    if (!hrs.length) return { code: 'UNKNOWN', hours: [] };
    const low = Math.min(...hrs.map(h => h.temp)), lowHour = hrs.find(h => h.temp === low);
    const cold = hrs.filter(h => h.temp <= low + NEAR);
    const sky = avg(cold.filter(h => h.sky !== null).map(h => h.sky)), wind = avg(cold.filter(h => h.wind !== null).map(h => h.wind));
    const clear = sky !== null && sky <= CLEAR, calm = wind !== null && wind <= CALM;
    const first = t => (hrs.find(h => h.temp <= t) || null);
    const below32 = hrs.filter(h => h.temp <= 32).length, below28 = hrs.filter(h => h.temp <= 28).length;
    let code;
    if (low <= 28) code = 'HARD_FREEZE';
    else if (low <= 32) code = 'FREEZE';
    else if (low <= 36) code = clear && calm ? 'FROST_LIKELY' : clear || calm ? 'FROST_POSSIBLE' : 'FROST_UNLIKELY';
    else if (low <= 39 && clear && calm) code = 'LOW_SPOTS';
    else code = 'NO_FROST';
    return { code, low, lowAt: lowHour.iso, sky, wind, clear, calm, first36: first(36), first32: first(32), below32, below28, hours: hrs };
  }
  const RANK = { HARD_FREEZE: 6, FREEZE: 5, FROST_LIKELY: 4, FROST_POSSIBLE: 3, LOW_SPOTS: 2, FROST_UNLIKELY: 1, NO_FROST: 0, UNKNOWN: -1 };
  /** Tonight plus the next two nights, and the official alerts. */
  function assess(grid, alertsJson, nowMs, tz) {
    const hours = fromGrid(grid), updated = grid && grid.properties && Date.parse(grid.properties.updateTime);
    const stale = !Number.isFinite(updated) || nowMs - updated > 12 * 3600e3;
    const nights = [0, 1, 2].map(k => assessNight(nightHours(hours, nowMs, tz, k)));
    return { tonight: nights[0], nights, alerts: frostAlerts(alertsJson), stale, updated: Number.isFinite(updated) ? new Date(updated).toISOString() : null, hours };
  }
  /** Periods for the existing cover decision (GardenFrostCover.decide). */
  const asPeriods = hours => hours.map(h => ({ time: h.iso, temp_f: h.temp, unit: 'F' }));
  return { CLEAR, CALM, NEAR, RANK, hoursOf, expand, fromGrid, frostAlerts, local, nightHours, assessNight, assess, asPeriods };
});
