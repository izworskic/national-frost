const { finite, sourceMeta } = require("@izworskic/national-outdoor-core");

const NCEI = "https://www.ncei.noaa.gov/access/services/data/v1";
const NCEI_SEARCH = "https://www.ncei.noaa.gov/access/services/search/v1/data";
const USDA_ZONE = "https://services1.arcgis.com/SyUSN23vOoYdfLC8/arcgis/rest/services/PHZM_2023_Zip_Code_Table/FeatureServer/296/query";
const USDA_MAP = "https://phzm-prod.ars.usda.gov/";
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
const UA = "ChrisIzworskiNationalFrostPlanner/3.0 (+https://chrisizworski.com/national-tools/frost/)";
const TYPES = [
  "ANN-TMIN-PRBLST-T32FP10",
  "ANN-TMIN-PRBLST-T32FP20",
  "ANN-TMIN-PRBLST-T32FP50",
  "ANN-TMIN-PRBFST-T32FP10",
  "ANN-TMIN-PRBFST-T32FP20",
  "ANN-TMIN-PRBFST-T32FP50",
  "ANN-TMIN-PRBGSL-T32FP50",
];

function haversine(a, b, c, d) {
  const r = 3958.7613, toRad = (x) => x * Math.PI / 180;
  const dLat = toRad(c - a), dLon = toRad(d - b);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(q));
}
function roundCoord(value) {
  return Math.round(Number(value) * 1e6) / 1e6;
}
async function json(url, timeoutMs = 5000) {
  const r = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`${new URL(url).hostname} returned ${r.status}`);
  return r.json();
}
function normalizeDate(v) {
  if (v == null || v === "" || Number(v) === -9999) return null;
  const raw = String(v).trim();
  const m = raw.match(/^(\d{1,2})[-\/]?(\d{2})$/);
  let month, day;
  if (m) {
    month = Number(m[1]);
    day = Number(m[2]);
  } else {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 4) {
      month = Number(digits.slice(0, 2));
      day = Number(digits.slice(2));
    } else if (/^\d{1,3}$/.test(digits)) {
      const doy = Number(digits);
      if (doy >= 1 && doy <= 366) {
        const d = new Date(Date.UTC(2024, 0, doy));
        return {
          month: d.getUTCMonth() + 1,
          day: d.getUTCDate(),
          mmdd: `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
        };
      }
    }
  }
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
  return { month, day, mmdd: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}
function rowValue(row, key) {
  return row?.[key] ?? row?.[key.toLowerCase()] ?? null;
}
function station(row, lat, lon) {
  const slat = finite(row.LATITUDE ?? row.latitude, -90, 90);
  const slon = finite(row.LONGITUDE ?? row.longitude, -180, 180);
  const dates = {
    spring_10: normalizeDate(rowValue(row, TYPES[0])),
    spring_20: normalizeDate(rowValue(row, TYPES[1])),
    spring_50: normalizeDate(rowValue(row, TYPES[2])),
    fall_10: normalizeDate(rowValue(row, TYPES[3])),
    fall_20: normalizeDate(rowValue(row, TYPES[4])),
    fall_50: normalizeDate(rowValue(row, TYPES[5])),
  };
  const distance = slat != null && slon != null ? haversine(lat, lon, slat, slon) : null;
  return {
    id: row.STATION ?? row.station ?? null,
    name: row.NAME ?? row.name ?? "NOAA climate station",
    latitude: slat,
    longitude: slon,
    distance_miles: distance,
    station_fit: distance == null ? "unknown" : distance <= 15 ? "close" : distance <= 40 ? "regional" : "distant",
    confidence: distance == null ? "low" : distance <= 15 ? "high" : distance <= 40 ? "medium" : "low",
    growing_season_days_50: finite(rowValue(row, TYPES[6]), 0, 366),
    dates,
  };
}
function parseSearchStationIds(payload) {
  return [...new Set((payload?.stations?.buckets || [])
    .map((bucket) => String(bucket?.key || "").replace(/\.csv$/i, "").trim())
    .filter((id) => /^[A-Z0-9:_-]{5,32}$/.test(id)))];
}
async function searchStations(lat, lon, span) {
  const u = new URL(NCEI_SEARCH);
  u.searchParams.set("dataset", "normals-annualseasonal-1991-2020");
  u.searchParams.set("bbox", [
    roundCoord(Math.min(90, lat + span)),
    roundCoord(Math.max(-180, lon - span)),
    roundCoord(Math.max(-90, lat - span)),
    roundCoord(Math.min(180, lon + span)),
  ].join(","));
  u.searchParams.set("dataTypes", "ANN-TMIN-PRBLST-T32FP50,ANN-TMIN-PRBFST-T32FP50");
  u.searchParams.set("limit", "100");
  u.searchParams.set("offset", "0");
  return parseSearchStationIds(await json(u, 3000));
}
async function stationNormals(ids, lat, lon) {
  if (!ids.length) return [];
  const u = new URL(NCEI);
  u.searchParams.set("dataset", "normals-annualseasonal-1991-2020");
  u.searchParams.set("stations", ids.slice(0, 50).join(","));
  u.searchParams.set("format", "json");
  u.searchParams.set("includeStationName", "1");
  u.searchParams.set("includeStationLocation", "1");
  u.searchParams.set("dataTypes", TYPES.join(","));
  const rows = await json(u, 3000);
  return (Array.isArray(rows) ? rows : [])
    .map((row) => station(row, lat, lon))
    .filter((item) => item.dates.spring_50 || item.dates.spring_10 || item.dates.fall_50)
    .sort((a, b) => (a.distance_miles ?? 9999) - (b.distance_miles ?? 9999));
}
async function normals(lat, lon) {
  for (const span of [0.35, 0.8, 1.8]) {
    try {
      const ids = await searchStations(lat, lon, span);
      if (!ids.length) continue;
      const stations = await stationNormals(ids, lat, lon);
      if (stations.length) return stations[0];
    } catch (_) {
      // Expand the search window if a discovery/data request fails.
    }
  }
  return null;
}
async function nws(lat, lon) {
  const p = await json(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, 5000);
  const u = p?.properties?.forecastHourly;
  if (!u) return null;
  const h = await json(u, 5000);
  const periods = (h?.properties?.periods || []).slice(0, 168).map((x) => ({
    time: x.startTime,
    temp_f: finite(x.temperature),
    unit: x.temperatureUnit,
    is_daytime: x.isDaytime,
    forecast: x.shortForecast,
  }));
  const fahrenheit = periods.map((x) => x.unit === "C" && x.temp_f != null ? { ...x, temp_f: x.temp_f * 9 / 5 + 32 } : x);
  const vals = fahrenheit.filter((x) => x.temp_f != null);
  const minPeriod = vals.reduce((best, x) => !best || x.temp_f < best.temp_f ? x : best, null);
  return {
    updated_at: h?.properties?.updateTime || null,
    timeZone: p?.properties?.timeZone || null,
    min_7d_f: minPeriod == null ? null : Math.round(minPeriod.temp_f),
    min_7d_at: minPeriod?.time || null,
    freeze_hours: fahrenheit.filter((x) => x.temp_f != null && x.temp_f <= 32).slice(0, 24),
    hard_freeze_hours: fahrenheit.filter((x) => x.temp_f != null && x.temp_f <= 28).slice(0, 24),
    periods: fahrenheit,
  };
}
function normalizeZip(value) {
  const match = String(value || "").match(/(?:^|\D)(\d{5})(?:-\d{4})?(?:\D|$)/);
  return match ? match[1] : null;
}
async function reversePostcode(lat, lon) {
  const u = new URL(NOMINATIM_REVERSE);
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lon", String(lon));
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("addressdetails", "1");
  u.searchParams.set("zoom", "18");
  const data = await json(u, 2500);
  return normalizeZip(data?.address?.postcode);
}
function normalizeZone(attributes, zip, postcodeSource) {
  const classLabel = String(attributes?.Class || "").trim();
  const zone = (classLabel.match(/^([0-9]{1,2}[ab])/i) || [])[1] || null;
  if (!zone) return null;
  const fahrenheit = (classLabel.match(/\(([-+]?\d+(?:\.\d+)?)\s+to\s+([-+]?\d+(?:\.\d+)?)\s*°F/i) || []);
  return {
    zip,
    zone: zone.toLowerCase(),
    class_label: classLabel,
    min_extreme_f: finite(fahrenheit[1]),
    max_extreme_f: finite(fahrenheit[2]),
    edition: 2023,
    basis: "ZIP-area majority zone",
    postcode_source: postcodeSource,
  };
}
async function hardinessByZip(zip, postcodeSource = "search location") {
  if (!zip) return null;
  const u = new URL(USDA_ZONE);
  u.searchParams.set("where", `ZIP_CODE='${zip}'`);
  u.searchParams.set("outFields", "ZIP_CODE,ZONE_CODE,MAJORITY,Class,Class_Code");
  u.searchParams.set("returnGeometry", "false");
  u.searchParams.set("f", "json");
  const data = await json(u, 2500);
  const attrs = data?.features?.[0]?.attributes;
  return attrs ? normalizeZone(attrs, zip, postcodeSource) : null;
}
async function hardiness(lat, lon, suppliedZip) {
  const direct = normalizeZip(suppliedZip);
  if (direct) return hardinessByZip(direct, "search location");
  try {
    const zip = await reversePostcode(lat, lon);
    if (!zip) return null;
    return hardinessByZip(zip, "OpenStreetMap reverse postcode");
  } catch (_) {
    return null;
  }
}
function freezeVerdict(weather) {
  if (!weather) return { level: "unknown", label: "Current freeze forecast unavailable", confidence: "low" };
  if (weather.hard_freeze_hours.length) return {
    level: "hard-freeze",
    label: "Hard freeze appears in the 7-day forecast",
    confidence: "high",
  };
  if (weather.freeze_hours.length) return {
    level: "freeze",
    label: "A 32°F-or-colder period appears in the 7-day forecast",
    confidence: "high",
  };
  return {
    level: "none",
    label: "No 32°F-or-colder hour appears in the current 7-day forecast",
    confidence: "medium-high",
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const lat = finite(req.query?.lat, -90, 90), lon = finite(req.query?.lon, -180, 180);
  if (lat == null || lon == null) return res.status(400).json({ error: "Valid latitude and longitude are required" });

  const [norm, forecast, zoneResult] = await Promise.allSettled([
    normals(lat, lon),
    nws(lat, lon),
    hardiness(lat, lon, req.query?.zip),
  ]);
  const climate = norm.status === "fulfilled" ? norm.value : null;
  const weather = forecast.status === "fulfilled" ? forecast.value : null;
  const zone = zoneResult.status === "fulfilled" ? zoneResult.value : null;
  if (!climate && !weather) return res.status(502).json({ error: "Frost data are temporarily unavailable" });

  return res.status(200).json({
    retrieved_at: new Date().toISOString(),
    degraded: !climate || !weather,
    location: {
      latitude: lat,
      longitude: lon,
      timeZone: weather?.timeZone || null,
      postcode: zone?.zip || normalizeZip(req.query?.zip),
    },
    climate_normals: climate,
    hardiness_zone: zone,
    current_forecast: weather,
    freeze_verdict: freezeVerdict(weather),
    interpretation: {
      spring_10: "NOAA's 10% last-freeze date means only 10% of historical years had a 32°F freeze on this date or later. It is not a guarantee.",
      spring_50: "NOAA's 50% last-freeze date is the median historical threshold, not a safe planting date for frost-tender crops.",
      fall_10: "NOAA's 10% first-freeze date is an early-risk threshold: only 10% of historical years reached 32°F on this date or earlier.",
      fall_50: "NOAA's 50% first-freeze date is the historical median first 32°F freeze.",
      hardiness: "USDA Plant Hardiness Zones summarize average annual extreme winter minimum temperature for perennial survival. The zone does not determine the last spring freeze, first fall freeze, or a safe planting date.",
      hardiness_precision: "The displayed USDA zone is the majority zone for the resolved ZIP area. A ZIP can cross zone boundaries, and terrain, elevation, water and urban effects can create local differences.",
      station_distance: climate?.distance_miles > 40
        ? "The nearest usable NOAA normals station is distant. Treat the climatology as regional context and give extra weight to local terrain and the live forecast."
        : "The station distance is incorporated into the displayed confidence.",
    },
    sources: [
      sourceMeta({
        name: "NOAA NCEI U.S. Climate Normals 1991–2020",
        url: "https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals",
        available: Boolean(climate),
        status: "historical freeze climatology",
      }),
      sourceMeta({
        name: "2023 USDA Plant Hardiness Zone Map",
        url: USDA_MAP,
        available: Boolean(zone),
        status: "ZIP-area majority hardiness zone",
      }),
      sourceMeta({
        name: "National Weather Service hourly forecast",
        url: "https://www.weather.gov/documentation/services-web-API",
        updatedAt: weather?.updated_at || null,
        staleAfterMinutes: 360,
        available: Boolean(weather),
        status: "current cold-risk forecast",
      }),
    ],
  });
};

module.exports._test = {
  freezeVerdict,
  haversine,
  normalizeDate,
  normalizeZip,
  normalizeZone,
  parseSearchStationIds,
  roundCoord,
  station,
};
