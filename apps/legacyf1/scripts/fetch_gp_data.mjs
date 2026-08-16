/* Genera js/gp_records.js con los récords reales de OpenF1 (temporada 2025):
   vueltas por circuito, tiempo de pole y vuelta rápida (con sectores) y números
   de piloto. Se corre una vez y el resultado se commitea (asset estático,
   sin request en runtime). Uso: node scripts/fetch_gp_data.mjs */
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://api.openf1.org/v1";
const SEASON = 2025;
const SLEEP_MS = 2200; // rate limit: 30 req/min → espaciamos a ~27/min

const sleep = ms => new Promise(r => setTimeout(r, ms));

const CODE_BY_CIRCUIT = {
  "Melbourne": "AUS", "Shanghai": "CHN", "Suzuka": "JPN", "Sakhir": "BHR",
  "Jeddah": "KSA", "Miami": "MIA", "Monte Carlo": "MCO", "Catalunya": "ESP",
  "Montreal": "CAN", "Spielberg": "AUT", "Silverstone": "GBR",
  "Spa-Francorchamps": "BEL", "Hungaroring": "HUN", "Zandvoort": "NED",
  "Monza": "ITA", "Baku": "AZE", "Singapore": "SIN", "Austin": "USA",
  "Mexico City": "MEX", "Interlagos": "BRA", "Las Vegas": "LVG",
  "Lusail": "QAT", "Yas Marina Circuit": "UAE"
};

/* Calendario del juego (GP_CALENDAR de js/data.js). */
const GAME_CODES = ["AUS", "CHN", "JPN", "BHR", "KSA", "MIA", "MAD", "MCO", "CAN",
  "ESP", "AUT", "GBR", "BEL", "HUN", "NED", "ITA", "AZE", "SIN", "USA", "MEX",
  "BRA", "LVG", "QAT", "UAE"];
/* GP sin datos en 2025 (Madrid debutó en 2026): se clona el del circuito hermano. */
const FALLBACK = { MAD: "ESP" };

async function get(path, allow404 = false) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(BASE + path);
      if (res.status === 404 && allow404) return null;
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(3000);
    }
  }
}

/* Vuelta más rápida de una lista de laps, sin contar out/in laps de pits. */
function bestLapInfo(laps) {
  const fast = laps
    .filter(l => !l.is_pit_out_lap && typeof l.lap_duration === "number" && l.lap_duration > 0)
    .sort((a, b) => a.lap_duration - b.lap_duration)[0];
  if (!fast) return null;
  return {
    time: fast.lap_duration,
    driver: fast.driver_number,
    sectors: [fast.duration_sector_1, fast.duration_sector_2, fast.duration_sector_3]
  };
}

/* Uso: node scripts/fetch_gp_data.mjs [CODE1,CODE2...] — sin args regenera todo. */
const ONLY = process.argv[2] ? new Set(process.argv[2].split(",")) : null;
const meetings = await get(`/meetings?year=${SEASON}`);
const records = {};
const processed = new Set();
const missing = [];

/* Regeneración parcial: merge con los récords ya commiteados para no pisarlos. */
if (ONLY) {
  try {
    const prev = readFileSync("js/gp_records.js", "utf8");
    Object.assign(records, JSON.parse(prev.slice(prev.indexOf("{"), prev.lastIndexOf("}") + 1)));
    console.log("Merge:", Object.keys(records).length, "GP previos");
  } catch (e) {
    console.log("(no había archivo previo para merge)");
  }
}

for (const m of meetings) {
  const code = CODE_BY_CIRCUIT[m.circuit_short_name];
  if (!code) { console.log("skip:", m.circuit_short_name, "(fuera del calendario del juego)"); continue; }
  if (processed.has(code)) continue; // Bahrain aparece duplicado en la API (1253 es testing)
  if (ONLY && !ONLY.has(code)) continue;
  try {
    await sleep(SLEEP_MS);
    const sessions = await get(`/sessions?meeting_key=${m.meeting_key}`);
    const race = sessions.find(s => s.session_name === "Race");
    const quali = sessions.find(s => s.session_name === "Qualifying" && s.session_type === "Qualifying");
    if (!race || !quali) { console.log("skip:", m.circuit_short_name, "(sin Race/Qualifying)"); continue; }

    await sleep(SLEEP_MS);
    const raceLaps = (await get(`/laps?session_key=${race.session_key}`, true)) || [];
    const laps = raceLaps.reduce((mx, l) => Math.max(mx, l.lap_number || 0), 0);
    const fl = bestLapInfo(raceLaps);
    if (!fl) throw new Error("sin vuelta rápida en carrera");

    /* Pole: quali laps si existen; si la API no los expone (404, p. ej. Baku),
       se toma de la grilla de salida (posición 1) y, si falta, del resultado
       oficial de clasificación (duration = [Q1, Q2, Q3]). */
    await sleep(SLEEP_MS);
    const qualiLaps = (await get(`/laps?session_key=${quali.session_key}`, true)) || [];
    let pole = bestLapInfo(qualiLaps);
    if (!pole) {
      await sleep(SLEEP_MS);
      const grid = await get(`/starting_grid?session_key=${race.session_key}`, true);
      const p1 = grid && grid.find(g => g.position === 1);
      if (p1 && typeof p1.lap_duration === "number") {
        pole = { time: p1.lap_duration, driver: p1.driver_number, sectors: null };
        console.log(`  ${code}: pole desde starting_grid (sin quali laps)`);
      }
    }
    if (!pole) {
      await sleep(SLEEP_MS);
      const qres = await get(`/session_result?session_key=${quali.session_key}`, true) || [];
      const best = qres
        .map(r => ({ driver: r.driver_number, time: Array.isArray(r.duration) ? r.duration[r.duration.length - 1] : r.duration }))
        .filter(r => typeof r.time === "number")
        .sort((a, b) => a.time - b.time)[0];
      if (best) {
        pole = { time: best.time, driver: best.driver, sectors: null };
        console.log(`  ${code}: pole desde session_result (sin quali laps ni grilla)`);
      }
    }
    if (!pole) throw new Error("sin pole (ni quali laps, ni starting_grid, ni session_result)");

    records[code] = {
      laps,
      pole: Math.round(pole.time * 1000) / 1000,
      poleSectors: pole.sectors,
      poleDriver: pole.driver,
      fl: Math.round(fl.time * 1000) / 1000,
      flSectors: fl.sectors,
      flDriver: fl.driver
    };
    processed.add(code);
    console.log(`${code}  laps=${laps}  pole=${pole.time.toFixed(3)}  fl=${fl.time.toFixed(3)}`);
  } catch (e) {
    console.error("ERROR:", m.circuit_short_name, "-", e.message);
  }
}

for (const code of GAME_CODES) {
  if (records[code]) continue;
  const fb = FALLBACK[code];
  if (fb && records[fb]) { records[code] = { ...records[fb] }; console.log(`${code}  fallback ← ${fb}`); }
  else missing.push(code);
}

const out = `// AUTO-GENERADO por scripts/fetch_gp_data.mjs desde OpenF1 (temporada ${SEASON}). No editar a mano.
// Regenerar: node scripts/fetch_gp_data.mjs
const GP_RECORDS = ${JSON.stringify(records, null, 2)};\n`;
writeFileSync("js/gp_records.js", out);
console.log(`\nEscribí js/gp_records.js con ${Object.keys(records).length} GP. Faltantes: ${missing.length ? missing.join(", ") : "ninguno"}`);
if (missing.length) process.exitCode = 1;
