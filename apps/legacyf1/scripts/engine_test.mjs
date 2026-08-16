/* Harness: carga data + récords + motor sin DOM y corre selfTestEngine().
   Uso: node scripts/engine_test.mjs */
import { readFileSync } from "node:fs";

const files = ["js/data.js", "js/gp_records.js", "js/gp_records_f2.js", "js/state.js"];
const src = files.map(f => readFileSync(f, "utf8")).join("\n") + "\nselfTestEngine();\n";
eval(src);
