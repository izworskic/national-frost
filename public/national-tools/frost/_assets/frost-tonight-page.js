/* Will it frost tonight? Reads the NWS forecast grid and active alerts for the chosen place directly in
 * the browser (api.weather.gov), answers for tonight and the next two nights, draws the hourly forecast,
 * and feeds the same hours to the existing cover decision (GardenFrostCover.decide). */
(function () {
  'use strict';
  const N = window.NationalTools, F = window.FrostTonight, E = window.GardenFrostCover;
  if (!N || !F || !E) return;
  const NWS = 'https://api.weather.gov';
  const $ = id => document.getElementById(id);
  const make = (tag, attrs, text) => { const e = document.createElement(tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; };
  const svg = (tag, attrs, text) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; };
  const json = r => { if (!r || !r.ok) throw new Error('HTTP ' + (r && r.status)); return r.json(); };
  let place = null, ctx = null, ask = 0;

  function nowMs() { const f = new URLSearchParams(location.search).get('now'); const t = f ? Date.parse(f) : NaN; return Number.isFinite(t) ? t : Date.now(); }
  const cacheGet = k => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && Date.now() - v.at < 30 * 60e3 ? v : null; } catch (_) { return null; } };
  const cacheSet = (k, v) => { try { v.at = Date.now(); localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode */ } };

  function onPlace(p) {
    place = p; const my = ++ask, lat = Number(p.latitude), lon = Number(p.longitude);
    $('ft-panel').hidden = false; $('controls').hidden = false; $('cover-hint').hidden = true;
    $('ft-badge').textContent = 'Checking'; $('ft-title').textContent = 'Reading tonight’s NWS forecast for ' + N.label(p) + '…'; $('ft-why').textContent = '';
    try { document.dispatchEvent(new CustomEvent('garden:place', { detail: p })); } catch (_) { /* old browser */ }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { ctx = { failed: true }; render(); return; }
    const key = 'frost1:' + lat.toFixed(2) + ',' + lon.toFixed(2), hit = cacheGet(key);
    const go = hit ? Promise.resolve(hit) : fetch(NWS + '/points/' + lat.toFixed(4) + ',' + lon.toFixed(4)).then(json).then(pt => {
      const pr = pt.properties || {};
      return Promise.all([fetch(pr.forecastGridData).then(json), fetch(NWS + '/alerts/active?point=' + lat.toFixed(4) + ',' + lon.toFixed(4)).then(json).catch(() => ({ features: [] }))])
        .then(([grid, alerts]) => { const v = { tz: pr.timeZone, state: pr.relativeLocation && pr.relativeLocation.properties && pr.relativeLocation.properties.state, city: pr.relativeLocation && pr.relativeLocation.properties && pr.relativeLocation.properties.city, grid: { properties: pick(grid.properties) }, alerts }; cacheSet(key, v); return v; });
    });
    go.then(v => { if (my !== ask) return; ctx = v; render(); }).catch(() => { if (my !== ask) return; ctx = { failed: true }; render(); });
  }
  // Keep only the layers used, so the cached copy stays small.
  const pick = p => p ? { updateTime: p.updateTime, temperature: p.temperature, dewpoint: p.dewpoint, skyCover: p.skyCover, windSpeed: p.windSpeed } : null;

  // ---------- words ----------
  const deg = v => Math.round(v) + '°F';
  function clock(iso, tz) { try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric' }).format(new Date(iso)).replace(':00', ''); } catch (_) { return iso.slice(11, 16); } }
  function nightName(k, n, tz) { if (k === 0) return 'Tonight'; const h = n.hours[0]; if (!h) return k === 1 ? 'Tomorrow night' : 'Next night'; return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(new Date(h.ms)) + ' night'; }
  const SHORT = { HARD_FREEZE: 'hard freeze', FREEZE: 'freeze', FROST_LIKELY: 'frost likely', FROST_POSSIBLE: 'frost possible', LOW_SPOTS: 'frost only in low spots', FROST_UNLIKELY: 'frost unlikely', NO_FROST: 'no frost', UNKNOWN: 'no forecast' };
  function conditions(n) {
    const sky = n.sky === null ? 'sky cover unknown' : n.clear ? 'mostly clear (about ' + Math.round(n.sky) + '% cloud)' : 'cloudy (about ' + Math.round(n.sky) + '% cloud)';
    const wind = n.wind === null ? 'wind unknown' : n.calm ? 'light wind (about ' + Math.round(n.wind) + ' mph)' : 'a breeze (about ' + Math.round(n.wind) + ' mph)';
    return sky + ' and ' + wind;
  }
  function words(r, tz) {
    const n = r.tonight, where = place.place || (place.displayName || '').split(',')[0] || 'your area';
    const alert = r.alerts[0];
    if (n.code === 'UNKNOWN') return { badge: 'No forecast', cls: 'info', title: 'Tonight’s forecast for ' + where + ' could not be read.', why: 'The National Weather Service hourly grid had no usable temperatures for tonight. No frost call is made without it.' };
    const low = deg(n.low) + ' around ' + clock(n.lowAt, tz), lowSentence = 'The forecast low is ' + low + ', with ' + conditions(n) + ' in the coldest hours.';
    let badge, cls, title, why;
    switch (n.code) {
      case 'HARD_FREEZE': badge = 'Hard freeze'; cls = 'no'; title = 'Yes: a hard freeze is forecast for ' + where + ' tonight.'; why = lowSentence + ' It reaches 28°F or colder for about ' + n.below28 + (n.below28 === 1 ? ' hour' : ' hours') + (n.first32 ? ', and stays at or below freezing from about ' + clock(n.first32.iso, tz) : '') + '. The NWS treats 28°F or lower as a hard freeze.'; break;
      case 'FREEZE': badge = 'Freeze'; cls = 'no'; title = 'Yes: freezing temperatures are forecast for ' + where + ' tonight.'; why = lowSentence + ' It is at or below 32°F for about ' + n.below32 + (n.below32 === 1 ? ' hour' : ' hours') + ' from ' + clock(n.first32.iso, tz) + '. The NWS issues Freeze Warnings for lows of 29 to 32°F.'; break;
      case 'FROST_LIKELY': badge = 'Frost likely'; cls = 'wait'; title = 'Frost is likely in ' + where + ' tonight.'; why = lowSentence + ' Those are the conditions for frost: the NWS issues Frost Advisories for lows of 33 to 36°F on clear nights with light wind, because the ground can be several degrees colder than the air 5 feet up, where temperature is measured.'; break;
      case 'FROST_POSSIBLE': badge = 'Frost possible'; cls = 'wait'; title = 'Frost is possible in ' + where + ' tonight.'; why = lowSentence + ' Frost forms best on clear nights with light wind, and only one of those is forecast, so expect it on exposed and low-lying spots rather than everywhere.'; break;
      case 'FROST_UNLIKELY': badge = 'Frost unlikely'; cls = 'info'; title = 'Frost is unlikely in ' + where + ' tonight, despite a low of ' + deg(n.low) + '.'; why = lowSentence + ' Clouds and wind keep the ground close to the air temperature, so frost is less likely than the number alone suggests.'; break;
      case 'LOW_SPOTS': badge = 'Low spots only'; cls = 'info'; title = 'No frost forecast for ' + where + ' tonight, except perhaps in low spots.'; why = lowSentence + ' On clear, calm nights cold air drains into valleys and low ground, which can run several degrees colder than the forecast.'; break;
      default: badge = 'No frost'; cls = 'ok'; title = 'No frost tonight in ' + where + '.'; why = 'The forecast low is ' + low + '. Frost needs the air to get within a few degrees of freezing.';
    }
    if (alert) { badge = 'NWS ' + alert.event; cls = /Freeze/.test(alert.event) ? 'no' : 'wait'; title = 'The National Weather Service has a ' + alert.event + ' for ' + where + (n.code === 'NO_FROST' ? '.' : ' tonight.'); why = alert.headline + '. ' + why; }
    if (r.stale) why += ' The NWS forecast is more than 12 hours old, so check again before relying on it.';
    return { badge, cls, title, why };
  }

  // ---------- chart ----------
  function chart(r, tz) {
    const el = $('ft-chart'), W = Math.max(300, Math.min(900, Math.round(el.getBoundingClientRect().width || 700))), narrow = W < 520, H = narrow ? 220 : 250;
    const now = nowMs(), hrs = r.hours.filter(h => h.ms >= now - 3600e3 && h.ms <= now + 42 * 3600e3);
    if (hrs.length < 2) { el.replaceChildren(); return; }
    const vals = hrs.map(h => h.temp).concat(hrs.map(h => h.dew).filter(v => v !== null), [32, 40]);
    const lo = Math.floor((Math.min(...vals) - 2) / 5) * 5, hi = Math.ceil((Math.max(...vals) + 2) / 5) * 5;
    const L = narrow ? 30 : 38, R = W - 10, T = 14, B = H - 28, t0 = hrs[0].ms, t1 = hrs[hrs.length - 1].ms;
    const X = ms => L + (ms - t0) / (t1 - t0) * (R - L), Y = v => B - (v - lo) / (hi - lo) * (B - T);
    el.setAttribute('viewBox', '0 0 ' + W + ' ' + H); el.replaceChildren();
    // Night shading (4 PM to 10 AM local).
    let start = null; hrs.forEach((h, i) => { const l = F.local(h.ms, tz), night = l.hour >= 16 || l.hour < 10; if (night && start === null) start = h.ms; if ((!night || i === hrs.length - 1) && start !== null) { el.append(svg('rect', { x: X(start), y: T, width: Math.max(0, X(h.ms) - X(start)), height: B - T, class: 'ft-night' })); start = null; } });
    el.append(svg('rect', { x: L, y: Y(36), width: R - L, height: Math.max(0, Y(Math.max(lo, 32)) - Y(36)), class: 'ft-frostband' }));
    for (let v = lo; v <= hi; v += 5) el.append(svg('line', { x1: L, y1: Y(v), x2: R, y2: Y(v), class: 'ft-grid' }), svg('text', { x: L - 5, y: Y(v) + 4, 'text-anchor': 'end', class: 'ft-axis' }, v + '°'));
    el.append(svg('line', { x1: L, y1: Y(32), x2: R, y2: Y(32), class: 'ft-freeze' }), svg('text', { x: R - 4, y: Y(32) - 4, 'text-anchor': 'end', class: 'ft-label' }, '32°F freeze'), svg('text', { x: R - 4, y: Y(36) - 4, 'text-anchor': 'end', class: 'ft-label' }, '33 to 36°F frost range'));
    hrs.forEach(h => { const l = F.local(h.ms, tz); if (l.hour % (narrow ? 6 : 3) === 0) el.append(svg('text', { x: X(h.ms), y: B + 18, 'text-anchor': 'middle', class: 'ft-axis' }, clock(h.iso, tz))); });
    const line = (key, cls) => { const pts = hrs.filter(h => h[key] !== null); if (pts.length > 1) el.append(svg('path', { d: pts.map((h, i) => (i ? 'L' : 'M') + X(h.ms).toFixed(1) + ' ' + Y(h[key]).toFixed(1)).join(' '), class: cls })); };
    line('dew', 'ft-dew'); line('temp', 'ft-temp');
    const n = r.tonight; if (n.code !== 'UNKNOWN') { const lh = n.hours.find(h => h.iso === n.lowAt); if (lh && lh.ms >= t0) el.append(svg('circle', { cx: X(lh.ms), cy: Y(lh.temp), r: 6, class: 'ft-low' }), svg('text', { x: X(lh.ms), y: Y(lh.temp) + 20, 'text-anchor': 'middle', class: 'ft-label' }, 'Low ' + deg(lh.temp))); }
  }

  // ---------- render ----------
  function render() {
    if (!place) return;
    const mi = ctx && !ctx.failed ? ctx.state === 'MI' : (place.stateCode || '').toUpperCase() === 'MI';
    $('ft-michigan').hidden = !mi;
    if (!ctx || ctx.failed) {
      if (ctx && ctx.failed) { $('ft-badge').textContent = 'No forecast'; $('ft-title').textContent = 'The National Weather Service forecast could not be loaded just now.'; $('ft-why').textContent = 'No frost call is made without it. Try again in a minute, or check weather.gov for your area.'; $('ft-card').className = 'ft-card info'; }
      return;
    }
    const tz = ctx.tz || place.timeZone || 'America/New_York', r = F.assess(ctx.grid, ctx.alerts, nowMs(), tz), w = words(r, tz);
    $('ft-card').className = 'ft-card ' + w.cls; $('ft-badge').textContent = w.badge; $('ft-title').textContent = w.title; $('ft-why').textContent = w.why;
    $('ft-nights').replaceChildren(...r.nights.map((n, k) => { const li = make('li', { class: 'ft-night-' + (n.code || '').toLowerCase() }); li.append(make('strong', {}, nightName(k, n, tz)), document.createTextNode(n.code === 'UNKNOWN' ? ': no forecast' : ': low ' + deg(n.low) + ', ' + SHORT[n.code])); return li; }));
    chart(r, tz);
    $('ft-chart-note').textContent = 'Solid line: hourly temperature. Dashed: dew point. Shaded columns: night, 4 PM to 10 AM. Band: the 33 to 36°F frost range. NWS forecast updated ' + (r.updated ? new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(r.updated)) : 'at an unknown time') + '.';
    $('ft-live').textContent = w.title;
    // The existing cover decision, now fed by the same hours.
    const feed = { location: { timeZone: tz }, current_forecast: { updated_at: r.updated, periods: F.asPeriods(r.hours) } };
    renderCover(feed);
    if (typeof window.gtag === 'function') window.gtag('event', 'frost_tonight_answer', { code: r.tonight.code, alert: r.alerts[0] ? r.alerts[0].event : 'none' });
  }
  function renderCover(feed) {
    const input = { crop: $('crop').value, stage: $('stage').value, setting: $('setting').value, protection: $('protection').value };
    const r = E.decide(input, feed, new Date(nowMs())), out = $('output');
    out.hidden = false; out.replaceChildren(make('span', { class: 'badge' }, r.code.replaceAll('_', ' ')), make('h2', {}, r.headline));
    out.append(make('p', { class: 'muted' }, r.window + ' · NWS forecast low: ' + (r.lowest === null ? 'unavailable' : Math.round(r.lowest) + '°F') + ' · ' + r.count + ' hourly forecasts · ' + r.confidence));
    const ul = make('ul'); r.details.forEach(s => ul.append(make('li', {}, s))); out.append(ul);
    out.append(make('p', { class: 'muted' }, 'Not a frost sensor: NWS grid temperatures represent broader air conditions. Your garden’s microclimate, cloud cover and wind can alter leaf temperatures.'));
  }
  $('controls').addEventListener('input', () => { if (ctx && !ctx.failed) render(); });
  N.bind($('loc'), onPlace);
  const q = new URLSearchParams(location.search).get('q'); if (q) { $('loc').querySelector('input').value = q; $('loc').requestSubmit(); }
})();
