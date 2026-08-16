/* Genera js/gp_records_f2.js desde js/gp_records.js: la F2 es ~14s/vuelta más
   lenta que la F1, con esa diferencia distribuida proporcionalmente entre los
   tres sectores de la vuelta. Misma cantidad de vueltas. Uso: node scripts/build_f2_records.mjs */
import { readFileSync, writeFileSync } from "node:fs";

const DELTA = 14;
const src = readFileSync("js/gp_records.js", "utf8");
const f1 = JSON.parse(src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1));

const round3 = n => Math.round(n * 1000) / 1000;
const shift = t => round3(t + DELTA);
const scaleSectors = (sectors, total, delta) => sectors == null ? null : sectors.map(s => round3(s * (total + delta) / total));

const f2 = {};
for (const [code, r] of Object.entries(f1)) {
  f2[code] = {
    laps: r.laps,
    pole: shift(r.pole),
    poleSectors: scaleSectors(r.poleSectors, r.pole, DELTA),
    poleDriver: null,
    fl: shift(r.fl),
    flSectors: scaleSectors(r.flSectors, r.fl, DELTA),
    flDriver: null
  };
}

const out = `// AUTO-GENERADO por scripts/build_f2_records.mjs (F1 + ${DELTA}s/vuelta distribuidos en los 3 sectores). No editar a mano.
// Regenerar: node scripts/build_f2_records.mjs
const GP_RECORDS_F2 = ${JSON.stringify(f2, null, 2)};\n`;
writeFileSync("js/gp_records_f2.js", out);
console.log(`Escribí js/gp_records_f2.js con ${Object.keys(f2).length} GP.`);
