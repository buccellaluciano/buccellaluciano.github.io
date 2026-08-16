
let player = null;
let currentOffers = [];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function fmtMoney(v) { return "$" + v.toLocaleString("es-AR"); }

function calcSalary(rating, age) {
  const MIN_SALARY = 100000;
  const MAX_SALARY = 40000000;

  const ratingFactor = clamp((rating - 50) / 49, 0, 1);
  const ratingGrowth = Math.pow(2, 10.8 * ratingFactor) - 1;
  const base = MIN_SALARY * (1 + ratingGrowth * youthFactorFor(age));
  return Math.round(clamp(base, MIN_SALARY, MAX_SALARY));
}

function calcMarketValue(rating, age) {
  const MIN_VALUE = 500000;
  const MAX_VALUE = 220000000;

  const ratingFactor = clamp((rating - 50) / 49, 0, 1);
  const ratingGrowth = Math.pow(2, 11.46 * ratingFactor) - 1;
  let value = MIN_VALUE * (1 + ratingGrowth * youthFactorFor(age));
  return Math.round(clamp(value, MIN_VALUE, MAX_VALUE));
}

function youthFactorFor(age) {
  if (age <= 18) return 0.3;
  if (age <= 20) return 0.6;
  if (age <= 25) return 1.2;
  if (age <= 30) return 1.1;
  if (age <= 34) return 0.9;
  return 0.85;
}

function pickDebutTeam() { return pickRandom(F2_TEAMS); }

/* --- Sistema de rating [RTG·EXP·RAC·AWA·PAC] --- */

function ratingOf(stats) {
  return Math.round(DRIVER_STAT_KEYS.reduce((a, k) => a + (stats[k] || 0), 0) / DRIVER_STAT_KEYS.length);
}

function applyDeltaToStats(p, delta) {
  DRIVER_STAT_KEYS.forEach(k => p.stats[k] = clamp(p.stats[k] + delta, 1, 99));
  p.rating = clamp(ratingOf(p.stats), 25, 99);
}

function styleStats(styleCode) {
  const boost = {
    CAL: { pac: 8, rac: 4, rtg: -4, exp: -4, awa: -4 },
    AGR: { rac: 8, pac: 4, rtg: -4, exp: -4, awa: -4 },
    GES: { awa: 8, rac: 4, rtg: -4, exp: -4, pac: -4 },
    LLV: { rac: 8, awa: 4, rtg: -4, exp: -4, pac: -4 }
  };
  const b = boost[styleCode] || {};
  const stats = {};
  DRIVER_STAT_KEYS.forEach(k => stats[k] = clamp(60 + (b[k] || 0) + randInt(-3, 3), 1, 99));
  return stats;
}

function genF2Name() { return pickRandom(F2_FIRST) + " " + pickRandom(F2_LAST); }

function createRivalGrid(category) {
  const source = category === "F1" ? F1_DRIVERS : F2_DRIVERS;
  return source.map(d => ({ name: d.name, team: d.team, age: d.age ?? 25, stats: { ...d.stats }, pot: d.pot, initialPot: d.pot, rating: ratingOf(d.stats) }));
}

/* Cantera: pilotos sin butaca que esperan un hueco en la parrilla. Los prospectos
   arrancan más débiles que el grid actual y con alto potencial, ordenados por rating desc. */
function generateProspects(count) {
  /* Dedupe global: no repetir nombres de ningún piloto activo (rivales, reservas,
     agentes libres). Evita que dos prospectos distintos compartan nombre. */
  const used = new Set();
  if (player) {
    ["F1", "F2"].forEach(cat => (player.rivals[cat] || []).forEach(d => used.add(d.name)));
    (player.reserves || []).forEach(d => used.add(d.name));
    ["F1", "F2"].forEach(cat => (player.waitingSeat[cat] || []).forEach(d => used.add(d.name)));
  }
  const list = [];
  for (let i = 0; i < count; i++) {
    const base = randInt(42, 68);
    const statVal = () => clamp(base + randInt(-5, 5), 30, 85);
    const stats = { rtg: statVal(), exp: statVal(), rac: statVal(), awa: statVal(), pac: statVal() };
    const pot = randInt(45, 95);
    let name;
    do { name = genF2Name(); } while (used.has(name));
    used.add(name);
    list.push({ name, team: null, age: randInt(17, 22), stats, pot, initialPot: pot, rating: ratingOf(stats), explotar: false });
  }
  return list.sort((a, b) => b.rating - a.rating);
}

/* El potencial se ajusta cada temporada: el tope es el `initialPot` y, con la edad,
   converge hacia el rating real (el margen de desarrollo se "estabiliza"). */
function updatePotential(pot, initialPot, rating, age) {
  const ageFactor = clamp((age - 17) / (40 - 17), 0, 1); // 0 a los 17, 1 a los 40
  const decay = Math.round((pot - rating) * ageFactor * 0.5);
  return clamp(pot - decay, Math.min(rating, initialPot), initialPot);
}

/* Regla de retiro compartida (jugador y rivales). */
function isRetiredDriver(d) {
  return d.age >= 50 || (d.age >= 38 && d.rating < 65) || d.rating <= 45;
}

/* Los rivales evolucionan con el MISMO código de progresión que el jugador:
   suman edad, su potencial puede "explotar" (dado grande) y su delta se calcula
   con seasonProgressionDelta. El potencial sigue siendo el tope de evolución. */
function evolveRivals(category) {
  const list = player.rivals && player.rivals[category];
  if (!list) return;
  list.forEach(r => {
    r.age = (r.age ?? 25) + 1;
    if (!r.explotar && r.age <= 27 && Math.random() < r.pot / 100) {
      r.explotar = true;
    }
    const delta = seasonProgressionDelta(r.rating, r.age, r.explotar, randInt(1, 100));
    if (delta !== 0) applyDeltaToStats(r, delta);
    r.pot = updatePotential(r.pot, r.initialPot ?? r.pot, r.rating, r.age);
  });

  /* Retiros con las mismas condiciones que el jugador (checkRetirement).
     El hueco queda VACANTE y lo llena resolveFreeAgents al final de la temporada
     (folding): así el mejor agente libre va a la mejor vacante, no el primero FIFO. */
  const kept = list.filter(r => !isRetiredDriver(r));
  list.length = 0;
  list.push(...kept);

  /* Reposición de cantera: el pool nunca debe quedarse vacío en una carrera larga. */
  if (player.waitingSeat.F2.length < 10) {
    player.waitingSeat.F2.push(...generateProspects(10 - player.waitingSeat.F2.length));
    player.waitingSeat.F2.sort((a, b) => b.rating - a.rating);
  }
}

/* Parrilla de la carrera: los rivales vienen de player.rivals (persistidos y evolutivos).
   El jugador ocupa el asiento del rival con su mismo nombre (modo piloto favorito); si no
   hay rival homónimo, ocupa el del primer asiento. No se recorta: los 11 equipos presentes. */
function buildGrid(isF1, playerTeam) {
  const cat = isF1 ? "F1" : "F2";
  const rivals = (player.rivals && player.rivals[cat]) || [];
  const byTeam = {};
  rivals.forEach(r => (byTeam[r.team] = byTeam[r.team] || []).push(r));
  const teams = isF1 ? F1_TEAMS : F2_TEAMS;
  const pool = [];
  teams.forEach(t => {
    const list = byTeam[t.nombre] || [];
    const tr = t.rating;
    if (t.nombre === playerTeam) {
      const teammate = list.find(r => r.name !== player.name) || list[1];
      pool.push({ name: player.name, team: playerTeam, isPlayer: true, stats: player.stats, teamRating: tr });
      if (teammate) pool.push({ name: teammate.name, team: t.nombre, isPlayer: false, stats: teammate.stats, teamRating: tr });
    } else {
      list.forEach(r => pool.push({ name: r.name, team: t.nombre, isPlayer: false, stats: r.stats, teamRating: tr }));
    }
  });
  return pool;
}

/* --- Motor de carrera (per-lap, calibrado a tiempos reales por GP) ---
   Cada carrera: clasificación (1 vuelta) que define la parrilla y la pole, y
   luego LAPS vueltas donde la posición se ordena por tiempo total acumulado.
   Los tiempos se anclan a la pole real de cada circuito (GP_RECORDS / _F2). */

const SIM_TUNING = {
  SPREAD: 0.04,       //% que separa al peor del mejor auto+piloto (quali real ~1.5-2.5%). Tope: más paridad = más caos.
  RACE_PENALTY: 0.012, //% más lento por vuelta en carrera vs quali (combustible + desgaste). Tope: la VR real ≈ pole + ~1s.
  JITTER: 0.55,       //variación base por vuelta en segundos. Tope: pilotos top reales ~0.3-0.5s/vuelta.
  FORM: 0.004,        //desvío fijo de ritmo por carrera (buen/mal finde). Evita el "yo-yo" de autos parejos repasándose sin parar.
  MECH_DNF: 0.001,    //hazard mecánico por vuelta (≈6% en 60 vueltas, ~1.2 retiros/carrera). Tope: 4-8% de DNF por carrera.
  LAP1_CRASH: 0.12,   //probabilidad de incidente en la vuelta 1 que saca 1-2 autos.
  CRASH: 0.01         //probabilidad de toque por vuelta (≈0.6/carrera, ~1 auto más fuera). Víctima uniforme.
};

function abilityOf(d) {
  const st = d.stats || {};
  const skill = ((st.rtg || 50) + (st.exp || 50) + (st.rac || 50) + (st.awa || 50) + (st.pac || 50)) / 5 / 100;
  const team = (d.teamRating != null ? d.teamRating : 75) / 100;
  return skill * 0.4 + team * 0.6;
}

function gpRecordFor(isF1, index) {
  const cal = isF1 ? GP_CALENDAR : GP_CALENDAR.slice(0, 14);
  const code = (cal[index] || {}).code;
  const recs = isF1 ? GP_RECORDS : GP_RECORDS_F2;
  return code ? (recs[code] || null) : null;
}

function lapBaseTime(d, pole, topAbility) {
  return pole * (1 + (topAbility - abilityOf(d)) * SIM_TUNING.SPREAD);
}

/* Clasificación: una vuelta con jitter chico por piloto. Define parrilla y pole. */
function qualifyRace(grid, record) {
  const top = Math.max(...grid.map(abilityOf));
  grid.forEach(d => {
    d.qTime = lapBaseTime(d, record.pole, top) + (Math.random() + Math.random() - 1) * SIM_TUNING.JITTER * 0.25;
  });
  grid.sort((a, b) => a.qTime - b.qTime);
  grid.forEach((d, i) => { d.gridPos = i + 1; });
  return grid[0];
}

/* Carrera vuelta a vuelta como generador: cada `yield` entrega un snapshot del
   estado (para la vista en vivo), y al agotarse aplica la clasificación final.
   El modo rápido solo drena el generador (simulateOneRace). */
function* raceLaps(grid, record) {
  const top = Math.max(...grid.map(abilityOf));
  const st = grid.map(d => ({
    d,
    base: lapBaseTime(d, record.pole, top),
    varMult: clamp(1.5 - ((d.stats.awa + d.stats.exp) / 2) / 100, 0.5, 1.5),
    total: 0, laps: 0, bestLap: Infinity, dnf: false
  }));
  st.forEach(s => { s.d.overtakes = 0; s.form = (Math.random() + Math.random() - 1) * SIM_TUNING.FORM; });

  const posOf = new Map(st.map(s => [s.d.name, s.gridPos]));
  let running = st.slice();
  let flSoFar = null;

  for (let lap = 1; lap <= record.laps && running.length; lap++) {
    for (const s of running) {
      const t = s.base * (1 + SIM_TUNING.RACE_PENALTY + s.form) + (Math.random() + Math.random() - 1) * SIM_TUNING.JITTER * s.varMult;
      s.total += t;
      s.laps += 1;
      if (lap > 1 && t < s.bestLap) {
        s.bestLap = t;
        if (!flSoFar || t < flSoFar.time) flSoFar = { name: s.d.name, time: t, lap };
      }
    }
    running.sort((a, b) => a.total - b.total);
    running.forEach((s, i) => {
      const now = i + 1;
      const prev = posOf.get(s.d.name);
      if (now < prev) s.d.overtakes += prev - now;
      posOf.set(s.d.name, now);
    });
    /* Incidentes: vuelta 1 con más probabilidad (salida), el resto con la base CRASH. */
    const crashP = lap === 1 ? SIM_TUNING.LAP1_CRASH : SIM_TUNING.CRASH;
    if (Math.random() < crashP) {
      const nv = Math.random() < 0.5 ? 1 : 2;
      for (let k = 0; k < nv && running.length; k++) {
        const idx = Math.floor(Math.random() * running.length);
        running[idx].dnf = true;
        running.splice(idx, 1);
      }
    }
    running = running.filter(s => !(Math.random() < SIM_TUNING.MECH_DNF && (s.dnf = true)));
    yield liveSnapshot(st, running, record, lap, flSoFar);
  }

  const classified = st.filter(s => !s.dnf).sort((a, b) => a.total - b.total);
  const retired = st.filter(s => s.dnf).sort((a, b) => b.laps - a.laps || a.total - b.total);
  [...classified, ...retired].forEach((s, i) => { s.d.pos = i + 1; s.d.total = s.total; s.d.dnf = s.dnf; });

  const flDriver = st.filter(s => s.bestLap !== Infinity).sort((a, b) => a.bestLap - b.bestLap)[0];
  if (flDriver) flDriver.d.fl = true;
}

/* Snapshot de la vista en vivo: corredores en orden actual + retirados al final. */
function liveSnapshot(st, running, record, lap, flSoFar) {
  const leader = running[0];
  const order = running.map((s, i) => ({
    name: s.d.name, team: s.d.team, isPlayer: !!s.d.isPlayer, pos: i + 1,
    gap: +(s.total - leader.total).toFixed(2),
    best: s.bestLap === Infinity ? null : +s.bestLap.toFixed(3),
    overtakes: s.d.overtakes, out: false
  })).concat(st.filter(s => s.dnf).sort((a, b) => b.laps - a.laps).map(s => ({
    name: s.d.name, team: s.d.team, isPlayer: !!s.d.isPlayer, pos: null,
    gap: null, best: null, overtakes: s.d.overtakes, out: true
  })));
  return { lap, totalLaps: record.laps, order, fl: flSoFar };
}

/* Fast path: drena el generador (equivale a la simulación síncrona de antes). */
function simulateOneRace(grid, record) {
  for (const _ of raceLaps(grid, record)) { /* drain */ }
  return grid;
}

/* Prepara la carrera (grilla + clasificación). La UI en vivo usa esto + raceLaps + finishRace. */
function prepareRace() {
  if (!player.seasonProgress) {
    player.seasonProgress = { baseRaces: player.category === "F1" ? 24 : 14, racesDone: 0, races: [] };
  }
  const p = player.seasonProgress;
  const isF1 = player.category === "F1";
  const record = gpRecordFor(isF1, p.racesDone);
  if (!record) throw new Error("Sin récord para GP " + p.racesDone + " (correr scripts del pipeline)");
  const grid = buildGrid(isF1, player.team);
  qualifyRace(grid, record);
  return { grid, record };
}

/* Guarda el resultado y cierra la temporada si corresponde. Devuelve el resultado de temporada o null. */
function finishRace(grid) {
  const p = player.seasonProgress;
  p.races.push(grid.map(d => ({
    name: d.name, team: d.team, isPlayer: d.isPlayer,
    pos: d.pos, gridPos: d.gridPos, overtakes: d.overtakes || 0, fl: !!d.fl, dnf: !!d.dnf,
    total: d.total != null ? Math.round(d.total * 100) / 100 : null
  })));
  p.racesDone += 1;
  if (p.racesDone >= p.baseRaces) {
    const raceStats = aggregateSeason(p);
    const racesGrid = p.races;
    player.year += 1;
    const r = simulateOneSeason(raceStats, racesGrid);
    player.seasonProgress = null;
    return r;
  }
  return null;
}

function simulateRace() {
  const { grid, record } = prepareRace();
  simulateOneRace(grid, record);
  return finishRace(grid);
}

function getTeamData(teamName) {  return ALL_TEAMS.find(t => t.nombre === teamName) || null;
}

function getTeamBudget(teamName) {
  const team = getTeamData(teamName);
  return team ? (team.budget ?? null) : null;
}

function calcEffectiveSalary(rating, age, teamName) {
  const worth = calcSalary(rating, age);
  const budget = getTeamBudget(teamName);
  return Math.round(budget == null ? worth : Math.min(worth, budget));
}

function getIdolatry(team) { return player.idolatria[team] || 0; }

function addIdolatry(team, amount) {
  if (!team) return;
  player.idolatria[team] = clamp(getIdolatry(team) + amount, 0, 100);
}

function buildTeamSummary() {
  const map = {};
  player.seasons.forEach(s => {
    const c = map[s.team] || (map[s.team] = {
      club: s.team,
      seasonsPlayed: 0,
      matches: 0,
      stat1: 0,
      stat2: 0,
      titles: {}
    });
    c.seasonsPlayed += 1;
    c.matches += s.matches || 0;
    c.stat1 += s.val1 || 0;
    c.stat2 += s.val2 || 0;
    (s.wonTitles || []).forEach(t => {
      if (!c.titles[t.name]) c.titles[t.name] = { type: t.type, count: 0 };
      c.titles[t.name].count += 1;
    });
  });

  return Object.values(map).map(c => {
    const titleList = Object.entries(c.titles).map(([name, v]) => ({
      name,
      type: v.type,
      count: v.count
    }));
    return {
      club: c.club,
      seasonsPlayed: c.seasonsPlayed,
      matches: c.matches,
      stat1: c.stat1,
      stat2: c.stat2,
      idolatria: getIdolatry(c.club),
      totalTitles: titleList.reduce((acc, t) => acc + t.count, 0),
      titles: titleList
    };
  });
}

const TITLE_IDOLATRY = { f1champ: 20, f2champ: 12, constructors: 10, gp: 8, individual: 5 };

function idolatryTeamFactor(teamRating) {
  return 1 - ((clamp(teamRating, 60, 99) - 60) / 39) * 0.7;
}

function createDriver(name, nationalityData, styleCode, careerType = "normal", dorsal = null, favorite = null) {
  const isFavorite = !!favorite;
  const stats = isFavorite ? { ...favorite.stats } : styleStats(styleCode);
  const startRating = ratingOf(stats);
  const team = isFavorite ? getTeamData(favorite.team) : pickDebutTeam();
  const nat = isFavorite ? (NATIONALITIES.find(n => n.name === favorite.nat) || nationalityData) : nationalityData;
  const age = isFavorite ? favorite.age : 16;
  const initialPot = isFavorite ? favorite.pot : (careerType === "prodigio" ? 92 : 70);
  const styleData = DRIVING_STYLES.find(s => s.code === styleCode);

  const rivals = { F1: createRivalGrid("F1"), F2: createRivalGrid("F2") };
  const waitingSeat = { F1: [], F2: generateProspects(15) };

  /* El jugador ocupa un asiento: su equipo debe quedar con 1 solo rival (el compañero).
     En favorito, el favorito es el propio jugador y se elimina; en normal, el rival
     desplazado va a la cantera para no perder un piloto de la parrilla. */
  {
    const cat = isFavorite ? "F1" : "F2";
    const list = rivals[cat];
    const atTeam = list.filter(r => r.team === team.nombre);
    if (atTeam.length > 1) {
      const drop = isFavorite ? atTeam.find(r => r.name === favorite.name) : atTeam[0];
      if (drop) {
        list.splice(list.indexOf(drop), 1);
        if (!isFavorite) waitingSeat.F2.push(drop);
      }
    }
  }

  return {
    name: isFavorite ? favorite.name : name,
    dorsal: isFavorite ? favorite.dorsal : dorsal,
    careerType: careerType,
    nationality: nat.name,
    flag: nat.flag,
    style: styleCode,
    styleName: styleData.nombre,
    age,
    rating: startRating,
    stats,
    pot: initialPot,
    initialPot,
    teamRatingRef: startRating,
    category: isFavorite ? "F1" : "F2",
    team: team.nombre,
    teamRating: team.rating,
    seasonsPlayed: 0,
    seasonsInCategory: 0,
    f2Seasons: 0,
    salary: calcEffectiveSalary(startRating, age, team.nombre),
    balance: 0,
    totalEarned: 0,
    totalRaces: 0,
    totalWins: 0,
    totalPodiums: 0,
    totalPoles: 0,
    totalPoints: 0,
    year: 2026,

    stat1Code: styleData.statPrimaria,
    stat2Code: styleData.statSecundaria,
    totalStat1: 0,
    totalStat2: 0,
    goldenHelmets: 0,
    driverAwards: 0,
    championships: 0,

    fitness: 100,
    injured: false,
    retired: false,
    lastDelta: 0,
    explotar: careerType === "prodigio",
    campeon: false,
    chestPending: false,
    promotionPending: false,

    currentEvents: [],
    seasons: [],
    boughtItems: [],
    idolatria: { [team.nombre]: 5 },
    waitingSeat,
    rivals,
    reserves: []
  };
}

function addHistory(type, tag, text) {
  player.currentEvents.push({ type, tag, text });
}

function addSeasonSummary(data) {
  player.seasons.push({
    ...data,
    events: [...player.currentEvents],
    isNew: true
  });
  player.currentEvents = [];
}

function addHistoryToLastSeason(type, tag, text) {
  const lastSeason = player.seasons[player.seasons.length - 1];
  if (lastSeason) {
    lastSeason.events.push({ type, tag, text });
  } else {
    addHistory(type, tag, text);
  }
}

function titleChance(teamRating, driverRating, base, growth) {
  const threshold = 75;
  const avg = (teamRating + driverRating) / 2;
  if (avg < threshold) return base * 0.50;
  return clamp(base * Math.pow(growth, avg - threshold), 0, 0.96);
}

/* Las estadísticas vienen TODAS del agregado real de las carreras (aggregateSeason);
   nada se inventa acá. Solo se resuelven títulos, idolatría y los stats del estilo. */
function calcSeasonStats(performance, fitness, agg) {
  const isF1 = player.category === "F1";
  const champPos = clamp(agg.champPos, 1, 22);
  const races = agg.matches;
  const wins = agg.wins;
  const podiums = agg.podiums;
  const poles = agg.poles;
  const points = agg.points;
  const fastestLaps = agg.fl;
  const overtakes = agg.overtakes;

  let titles = 0;
  let wonTitles = [];
  player.campeon = false;

  if (champPos === 1) {
    titles++;
    player.campeon = true;
    player.championships++;
    const champName = isF1 ? "Campeonato Mundial de F1" : "Campeonato de F2";
    wonTitles.push({ name: champName, type: isF1 ? "f1champ" : "f2champ" });
    addHistory("season", "🏆 CAMPEÓN", `¡${player.name} es campeón de la ${champName} con ${player.team}!`);
  }

  if (isF1 && Math.random() < titleChance(player.teamRating, player.rating, 0.05, 1.16)) {
    titles++;
    wonTitles.push({ name: "Campeonato de Constructores", type: "constructors" });
    addHistory("season", "🛠️ Constructores", `¡${player.team} ganó el Campeonato de Constructores!`);
  }

  /* Trofeos de GP: uno por cada carrera realmente ganada. */
  if (agg.wonGps && agg.wonGps.length) {
    agg.wonGps.forEach(i => {
      const gp = GP_TROPHIES[i];
      if (!gp) return;
      titles++;
      wonTitles.push({ name: "GP de " + gp.name, type: "gp" });
      addHistory("season", "👑 " + gp.name, `¡Victoria! ${player.name} ganó el GP de ${gp.name}.`);
    });
  }

  if (player.seasonsInCategory === 1 && champPos <= 6 && Math.random() < 0.5) {
    titles++;
    wonTitles.push({ name: "Rookie del Año", type: "individual" });
    addHistory("season", "🌱 Rookie del Año", `${player.name} fue elegido Rookie del Año en su primera temporada de ${player.category}.`);
  }

  const helmetThreshold = isF1 ? 12 : 7;
  if (wins >= helmetThreshold && Math.random() < 0.33) {
    titles++;
    wonTitles.push({ name: "Casco de Oro", type: "individual" });
    player.goldenHelmets++;
    addHistory("season", "🪖 Casco de Oro", `¡Imparable! ${player.name} ganó el Casco de Oro con ${wins} victorias en la temporada.`);
  }

  if (player.rating >= 90) {
    const chanceAward = (player.rating - 89) * 0.08;
    if (Math.random() < chanceAward) {
      titles++;
      wonTitles.push({ name: "Piloto del Año FIA", type: "individual" });
      player.driverAwards++;
      addHistory("season", "🌟 Piloto del Año", `¡Histórico! ${player.name} fue galardonado como Piloto del Año por la FIA.`);
    }
  }

  const statMap = { POL: poles, VIC: wins, POD: podiums, PTS: points, ADE: overtakes, VRA: fastestLaps };
  const val1 = statMap[player.stat1Code] || 0;
  const val2 = statMap[player.stat2Code] || 0;

  if (titles > 0 && typeof sfx === "function") sfx("trophy");

  return { matches: races, wins, podiums, poles, points, overtakes, fastestLaps, champPos, val1, val2, titles, wonTitles };
}

function ageFactorFor(age) {
  if (age <= 21) return 3.0; if (age <= 26) return 2.0;
  if (age <= 30) return 1; if (age <= 33) return -1.0;
  if (age <= 37) return -2.0; return -3.0;
}

/* Núcleo de progresión compartido: mismo dado, factor de edad, rendimiento y
   bonus que usa el jugador en simulateOneSeason. Lo usan también los rivales. */
function seasonDie(explotar, age) {
  if (explotar === true && age <= 31) {
    const dado = randInt(1, 10);
    if (dado >= 8) return randInt(3, 5);
    if (dado >= 4) return randInt(1, 2);
    if (dado === 1) return -1;
    return 0;
  }
  const dado = randInt(1, 6);
  if (dado >= 5) return 1;
  if (dado <= 2) return -1;
  return 0;
}

function seasonProgressionDelta(rating, age, explotar, performance) {
  let delta = Math.round(seasonDie(explotar, age) + ageFactorFor(age) + ((performance - 30) / 50) * 1.33);
  if (rating < 88 && Math.random() < 0.15) {
    delta += randInt(1, 3);
  }
  return delta;
}

function checkRetirement() {
  if (isRetiredDriver(player)) {
    player.retired = true;
  }
}

function checkForcedTransfer() {
  return player.category === "F1" && player.rating < player.teamRatingRef * 0.95;
}

/* Ciclo de vida completo de una temporada. Si `raceAgg` viene (modo carrera a
   carrera), los totales se toman de las carreras simuladas en vez de la fórmula. */
function simulateOneSeason(raceAgg = null, racesGrid = null) {
  let injuryHappened = false;
  let lastPromotion = false;
  player.age += 1;
  player.seasonsPlayed += 1;
  player.seasonsInCategory += 1;
  player.promotionPending = false;

  if (!player.injured) player.fitness = clamp(player.fitness + randInt(5, 15), 0, 100);
  player.injured = false;

  const fitnessMod = (player.fitness - 100) / 6;
  const performance = clamp(randInt(1, 100) + fitnessMod, 1, 100);

  let perfLabel = "regular";
  if (performance >= 80) perfLabel = "excelente 🌟";
  else if (performance >= 60) perfLabel = "buena 👍";
  else if (performance < 30) perfLabel = "muy floja 📉";
  else if (performance < 45) perfLabel = "floja ⚠️";

  addHistory("season", "📅 Temporada " + player.seasonsPlayed, `${player.name} tuvo una temporada <strong>${perfLabel}</strong> en ${player.category} con ${player.team}.`);

  const probabilidadExplotar = 0.042 + (player.seasonsPlayed * 0.007);

  if (!player.explotar && Math.random() < probabilidadExplotar && player.age <= 27) {
    player.explotar = true;
    addHistory("season", "🔥 EXPLOSIÓN", `¡${player.name} ha explotado su potencial! A partir de ahora su progresión será mucho más rápida.`);
  }

  let delta = seasonProgressionDelta(player.rating, player.age, player.explotar, performance);
  if (Math.random() < 0.09) {
    injuryHappened = true;
    const severity = randInt(1, 3);
    const severityLabel = ["leve", "moderado", "grave"][severity - 1];
    const ratingHit = clamp(severity * randInt(1, 2), 1, 5);
    const fitnessHit = severity * randInt(10, 18);
    delta -= ratingHit;
    player.fitness = clamp(player.fitness - fitnessHit, 10, 100);
    player.injured = true;
    if (typeof sfx === "function") sfx("injury");
    addHistory("injury", "💥 Accidente", `Sufrió un accidente <strong>${severityLabel}</strong>. Impacto en progresión: -${ratingHit}. Estado físico baja a ${player.fitness}%.`);
  }

  const oldRating = player.rating;
  applyDeltaToStats(player, delta);
  player.lastDelta = player.rating - oldRating;
  player.pot = updatePotential(player.pot, player.initialPot ?? player.pot, player.rating, player.age);

  const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
  const icon = delta >= 0 ? "📈" : "📉";
  addHistory("season", `${icon} Progresión`, `Cambio en valoración: ${deltaStr}. Nueva valoración global: <strong>${player.rating}</strong>.`);

  const stats = calcSeasonStats(performance, player.fitness, raceAgg);

  let seasonIdolatry = Math.min(5, (stats.wins * 3 + stats.podiums) / 8);
  stats.wonTitles.forEach(t => {
    seasonIdolatry += TITLE_IDOLATRY[t.type] || 0;
  });
  addIdolatry(player.team, Math.round(seasonIdolatry * idolatryTeamFactor(player.teamRating)));

  player.totalRaces += stats.matches;
  player.totalWins += stats.wins;
  player.totalPodiums += stats.podiums;
  player.totalPoles += stats.poles;
  player.totalPoints += stats.points;
  player.totalStat1 += stats.val1;
  player.totalStat2 += stats.val2;

  cofre(player.chestPending);

  addSeasonSummary({
    season: player.seasonsPlayed,
    age: player.age,
    team: player.team,
    category: player.category,
    performance: performance,
    ...stats,
    grid: racesGrid
  });

  evolveRivals("F1");
  evolveRivals("F2");
  runRivalMarket();
  ageFreeAgents();
  ageReserves();
  promoteReserves();
  assignReserves();
  resolveFreeAgents();

  player.balance += player.salary;
  player.totalEarned += player.salary;

  if (player.category === "F2") {
    player.f2Seasons += 1;
    if (stats.champPos <= 4 || player.rating >= 72) {
      player.promotionPending = true;
      lastPromotion = true;
      addHistoryToLastSeason("transfer", "🎉 ¡Oportunidad de ascenso!", `Su rendimiento en F2 llamó la atención de equipos de Fórmula 1. ¡Hay contratos sobre la mesa!`);
    } else if (player.f2Seasons >= 4) {
      player.retired = true;
      addHistoryToLastSeason("season", "🚪 Sin butaca", `Tras ${player.f2Seasons} temporadas en F2 sin lograr el ascenso, ${player.name} se quedó sin butaca.`);
    }
  }

  player.salary = calcEffectiveSalary(player.rating, player.age, player.team);
  checkRetirement();

  return { injuryHappened, performance, promotionPending: lastPromotion };
}

/* --- Simulación carrera a carrera --- */

/* Agrega la temporada a partir de las carreras realmente corridas: puntos por
   posición, campeonato, poles (gridPos 1), victorias/podios, adelantamientos,
   vueltas rápidas y GP ganados. Nada se inventa. */
function aggregateSeason(progress) {
  const isF1 = player.category === "F1";
  const ptsTable = isF1 ? POINTS_F1 : POINTS_F2;
  const totals = {};
  const poleCounts = {};
  let wins = 0, podiums = 0, points = 0, overtakes = 0, flCount = 0;
  const wonGps = [];
  progress.races.forEach((race, i) => {
    race.forEach(x => {
      if (typeof x.pos !== "number") return;
      totals[x.name] = (totals[x.name] || 0) + (ptsTable[x.pos - 1] || 0);
      if (x.gridPos === 1) poleCounts[x.name] = (poleCounts[x.name] || 0) + 1;
      if (x.isPlayer) {
        points += ptsTable[x.pos - 1] || 0;
        if (x.pos === 1) { wins++; wonGps.push(i); }
        if (x.pos <= 3) podiums++;
        overtakes += x.overtakes || 0;
        if (x.fl) flCount++;
      }
    });
  });
  const champPos = Object.values(totals).filter(v => v > (totals[player.name] || 0)).length + 1;
  return { champPos, wins, podiums, poles: poleCounts[player.name] || 0, points, overtakes, fl: flCount, matches: progress.races.length, wonGps };
}

/* Corre N carreras de a una; devuelve el resultado de la temporada si se completa.
   Al completarse una temporada se corta: no se pasa a la siguiente sin pedirlo. */
function runNRaces(n) {
  let last = null;
  for (let i = 0; i < n; i++) {
    const r = simulateRace();
    if (r) last = r;
    if (player.retired) break;
    if (r) break; // temporada completada
  }
  return last;
}

function seasonBase() {
  return player.seasonProgress ? player.seasonProgress.baseRaces : (player.category === "F1" ? 24 : 14);
}

/* Temporada completa = correr las carreras RESTANTES del calendario. */
function simulateSeason(times = 1) {
  let last = null;
  for (let s = 0; s < times; s++) {
    const base = seasonBase();
    const done = player.seasonProgress ? player.seasonProgress.racesDone : 0;
    last = runNRaces(Math.max(0, base - done));
    if (player.retired) break;
  }
  return last || { injuryHappened: false, performance: 50, promotionPending: false };
}

/* Media temporada = correr la mitad del calendario (o hasta completarla, lo que ocurra primero). */
function simulateMidSeason() {
  const base = seasonBase();
  const done = player.seasonProgress ? player.seasonProgress.racesDone : 0;
  return runNRaces(Math.max(0, Math.min(Math.ceil(base / 2), base - done)));
}

function cofre(pending) {
  if (Math.random() < 0.05) {
    player.chestPending = true;
  }
}

function generateOfferFor(driver, excludedTeams = [], forcedCategory = null) {
  const worth = calcSalary(driver.rating, driver.age ?? 25);
  const category = forcedCategory || driver.category;
  // la tolerancia de rating la modifica SOLO el potencial (que ya se estabiliza con la edad)
  const tolerance = Math.round((driver.pot ?? 50) / 5 * 0.75);
  let candidates = ALL_TEAMS.filter(t =>
    t.categoria === category &&
    t.nombre !== driver.team &&
    !excludedTeams.includes(t.nombre) &&
    (t.budget ?? worth) >= worth &&
    driver.rating >= t.rating - tolerance
  );

  if (candidates.length === 0) {
    candidates = ALL_TEAMS.filter(t =>
      t.categoria === category &&
      t.nombre !== driver.team &&
      !excludedTeams.includes(t.nombre)
    );
  }
  if (candidates.length === 0) return { club: null, salary: 0, budget: null };

  const club = pickRandom(candidates);
  const budget = getTeamBudget(club.nombre);
  const myBudget = getTeamBudget(driver.team);

  let salary = worth;
  if (driver.category !== "F2" && budget != null && myBudget != null && myBudget > 0) {
    const relDiff = (budget - myBudget) / myBudget;
    salary = Math.round(worth * (1 + relDiff * 0.5));
  }
  if (budget != null) salary = Math.min(salary, budget);

  return { club, salary, budget };
}

function generateOffer(excludedTeams = [], forcedCategory = null) {
  return generateOfferFor(player, excludedTeams, forcedCategory);
}

/* Mercado de traspasos: cada piloto rival (F1 y F2) tiene una chance baja de irse
   y, si se va, ficha por otro equipo con la misma lógica de ofertas. */
const RIVAL_LEAVE_CHANCE = 0.03;

function runRivalMarket() {
  ["F1", "F2"].forEach(cat => {
    const list = (player.rivals && player.rivals[cat]) || [];
    const movers = list.filter(() => Math.random() < RIVAL_LEAVE_CHANCE);
    for (const r of movers) {
      const offer = generateOfferFor(r, [], cat);
      if (!offer.club) continue;
      // cupo de 2 asientos: si el destino está lleno, un piloto del destino
      // ocupa el asiento libre del que se va (swap). El asiento del jugador cuenta.
      const isPlayerTeam = offer.club.nombre === player.team;
      const seats = list.filter(x => x.team === offer.club.nombre).length + (isPlayerTeam ? 1 : 0);
      if (seats >= 2) {
        const occupant = list.find(x => x.team === offer.club.nombre);
        if (occupant) occupant.team = r.team;
      }
      r.team = offer.club.nombre;
      addHistoryToLastSeason("transfer", "🔄 Traspaso", `${r.name} ficha por <strong>${offer.club.nombre}</strong>.`);
    }
  });
}

/* Envejece el pool de agentes libres (waitingSeat) y retira por EDAD a los que
   cumplen 50. Regla solo por edad: un prospecto joven con rating bajo y alto
   potencial no debe retirarse por rating (la regla completa lo mataría). */
function ageFreeAgents() {
  ["F1", "F2"].forEach(cat => {
    const pool = player.waitingSeat[cat];
    for (let i = pool.length - 1; i >= 0; i--) {
      pool[i].age = (pool[i].age ?? 22) + 1;
      if (pool[i].age >= 50) pool.splice(i, 1);
    }
  });
}

/* Reasignación de agentes libres (folding): llena TODAS las vacantes (retiros,
   movidas del jugador) y luego mejora equipos por rating. El jugador nunca se
   desplaza: en su equipo el único desplazable es el compañero (rival). */
function resolveFreeAgents() {
  const teamsOf = cat => cat === "F1" ? F1_TEAMS : F2_TEAMS;
  const rivalsOf = cat => player.rivals[cat] || [];

  /* Slot de una escudería: rivales, si es la del jugador, count y peor rival. */
  const slot = (cat, t) => {
    const tRivals = rivalsOf(cat).filter(r => r.team === t.nombre);
    const isPlayerTeam = player.category === cat && player.team === t.nombre;
    return {
      t, tRivals, isPlayerTeam,
      count: tRivals.length + (isPlayerTeam ? 1 : 0),
      worst: tRivals.length ? tRivals.reduce((m, r) => (r.rating < m.rating ? r : m), tRivals[0]) : null
    };
  };

  /* Mejor libre disponible: misma categoría primero, luego la otra. */
  const bestFreeAgent = preferCat => {
    for (const cat of [preferCat, preferCat === "F1" ? "F2" : "F1"]) {
      const pool = player.waitingSeat[cat];
      const best = pool.slice().sort((a, b) => b.rating - a.rating)[0];
      if (best) return { fa: best, cat };
    }
    return null;
  };

  /* Fase A: llenar TODAS las vacantes (invariante: 2 pilotos por escudería).
     La vacante de mayor team.rating se cubre con el mejor libre disponible. */
  for (;;) {
    const vacants = [];
    ["F1", "F2"].forEach(cat => teamsOf(cat).forEach(t => {
      const s = slot(cat, t);
      if (s.count < 2) vacants.push({ cat, s });
    }));
    vacants.sort((a, b) => b.s.t.rating - a.s.t.rating);
    if (!vacants.length) break;
    const res = bestFreeAgent(vacants[0].cat);
    if (!res) break;
    res.fa.team = vacants[0].s.t.nombre;
    player.waitingSeat[res.cat].splice(player.waitingSeat[res.cat].indexOf(res.fa), 1);
    rivalsOf(vacants[0].cat).push(res.fa); // la categoría del DESTINO, no la del pool
  }

  /* Fase B: upgrades opcionales. Un libre con rating R reemplaza al peor rival
     de un equipo lleno cuya peor media < R; el desplazado queda libre (cascada
     estrictamente decreciente, termina). */
  ["F1", "F2"].forEach(cat => {
    const pool = player.waitingSeat[cat];
    const rivals = rivalsOf(cat);
    let changed = true;
    while (changed) {
      changed = false;
      for (const fa of pool.slice().sort((a, b) => b.rating - a.rating)) {
        const best = teamsOf(cat)
          .map(t => slot(cat, t))
          .filter(s => s.count >= 2 && s.worst && fa.rating > s.worst.rating)
          .sort((a, b) => b.t.rating - a.t.rating)[0];
        if (!best) continue;
        fa.team = best.t.nombre;
        pool.splice(pool.indexOf(fa), 1);
        rivals.push(fa);
        const worst = best.worst;
        rivals.splice(rivals.indexOf(worst), 1);
        worst.team = null;
        pool.push(worst);
        changed = true;
        break;
      }
    }
  });
}

/* --- Pilotos de reserva (solo rivales) ---
   Un reserva NO corre en F2: se guarda en su equipo F1 (player.reserves) y sube
   cuando ese equipo queda sin un piloto. Se draftea por mérito (mejor F2 → mejor
   F1, umbral rating >= 72). A los 30 deja de ser reserva y libera la butaca. */

const RESERVE_MIN_RATING = 72;

function ageReserves() {
  for (let i = player.reserves.length - 1; i >= 0; i--) {
    const r = player.reserves[i];
    r.age = (r.age ?? 25) + 1;
    if (r.age >= 30) {
      // A los 30 deja de ser reserva: vuelve al mercado (agente libre F1) y
      // libera la butaca de reserva del equipo.
      player.reserves.splice(i, 1);
      delete r.reserveTeam;
      r.team = null;
      player.waitingSeat.F1.push(r);
    }
  }
}

/* Ascender reservas: cada equipo F1 con vacante y con reserva lo promueve a F1. */
function promoteReserves() {
  F1_TEAMS.forEach(t => {
    const tRivals = player.rivals.F1.filter(r => r.team === t.nombre);
    const isPlayerTeam = player.category === "F1" && player.team === t.nombre;
    if (tRivals.length + (isPlayerTeam ? 1 : 0) >= 2) return; // sin vacante
    const idx = player.reserves.findIndex(r => r.reserveTeam === t.nombre);
    if (idx < 0) return; // sin reserva
    const res = player.reserves[idx];
    player.reserves.splice(idx, 1);
    delete res.reserveTeam;
    res.team = t.nombre;
    player.rivals.F1.push(res);
    addHistoryToLastSeason("transfer", "⬆️ Reserva asciende", `${res.name} sube a la F1 como titular de <strong>${t.nombre}</strong>.`);
  });
}

/* Draft de reservas: los mejores F2 (rating >= 72) se vuelven reservas de las
   mejores F1 que tengan butaca de reserva libre (1 por equipo). Salen de F2. */
function assignReserves() {
  const teams = F1_TEAMS
    .filter(t => !player.reserves.some(r => r.reserveTeam === t.nombre))
    .sort((a, b) => b.rating - a.rating);
  const candidates = player.rivals.F2
    .filter(r => r.rating >= RESERVE_MIN_RATING)
    .sort((a, b) => b.rating - a.rating);
  for (const t of teams) {
    if (!candidates.length) break;
    const c = candidates.shift();
    const f2 = player.rivals.F2;
    f2.splice(f2.indexOf(c), 1);
    delete c.team;
    c.reserveTeam = t.nombre;
    player.reserves.push(c);
    addHistoryToLastSeason("transfer", "🔖 Reserva", `${c.name} ficha como piloto de reserva de <strong>${t.nombre}</strong>.`);
  }
}

function generateOffers(count = 3, forcedCategory = null) {
  const seen = [];
  currentOffers = [];
  for (let i = 0; i < count; i++) {
    const offer = generateOffer(seen, forcedCategory);
    if (offer.club) {
      currentOffers.push(offer);
      seen.push(offer.club.nombre);
    }
  }
  return currentOffers;
}

function acceptOffer(index) {
  const offer = currentOffers[index];
  if (!offer) return;
  const prevTeam = player.team;
  const prevCat = player.category;
  const newCategory = offer.club.categoria;
  const newTeam = offer.club.nombre;
  addHistoryToLastSeason("transfer", "🤝 Contrato", `${player.name} firma con <strong>${offer.club.nombre}</strong> (${newCategory}). Nuevo salario: ${fmtMoney(offer.salary)}.`);
  if (prevCat === "F2" && newCategory === "F1") {
    addHistoryToLastSeason("transfer", "🏎️ ¡ASCENSO A LA F1!", `${player.name} llega a la Fórmula 1 de la mano de <strong>${offer.club.nombre}</strong>. ¡Comienza la verdadera aventura!`);
  }

  /* El piloto desplazado del equipo nuevo NO se "swap" a la escudería vieja:
     queda como agente libre (sin butaca) y resolveFreeAgents lo recoloca por
     rating en un equipo que lo valore (vacante o con un piloto de menor media). */
  if (newTeam !== prevTeam) {
    const dest = player.rivals[newCategory];
    if (dest) {
      const displaced = dest.find(r => r.team === newTeam);
      if (displaced) {
        dest.splice(dest.indexOf(displaced), 1);
        displaced.team = null;
        player.waitingSeat[newCategory].push(displaced);
      }
    }
  }

  player.team = newTeam;
  player.teamRating = offer.club.rating;
  if (newCategory !== player.category) {
    player.category = newCategory;
    player.seasonsInCategory = 0;
  }
  player.salary = offer.salary;
  player.teamRatingRef = player.rating;
  player.idolatria[offer.club.nombre] = Math.max(getIdolatry(offer.club.nombre), 5);
  if (typeof sfx === "function") sfx("transfer");
  currentOffers = [];
  promoteReserves();   // si el jugador dejó un equipo F1, su vacante la cubre la reserva
  resolveFreeAgents(); // recoloca al desplazado y llena la vacante restante de la escudería previa
}

function rejectOffer(index) {
  const offer = currentOffers[index];
  if (!offer) return;
  addHistoryToLastSeason("offer", "❌ Oferta rechazada", `Se rechazó la oferta de <strong>${offer.club.nombre}</strong>.`);
  if (offer.salary > player.salary) addIdolatry(player.team, 5);
  currentOffers.splice(index, 1);
  return currentOffers;
}

function buyItem(id) {
  const item = SHOP_ITEMS.find(i => i.id === id);
  if (!item) return false;
  if (!item.repeatable && player.boughtItems.includes(id)) return false;
  if (player.balance < item.price) return false;

  player.balance -= item.price;

  if (item.id === 'physio') {
    player.fitness = 100;
  }
  if (item.ratingBoost) {
    const oldR = player.rating;
    applyDeltaToStats(player, item.ratingBoost);
    player.lastDelta = player.rating - oldR;
  }
  if (item.shortened) {
    player.age += item.agePenalty;
    checkRetirement();
  }
  if (!item.repeatable) player.boughtItems.push(id);

  const shortNote = item.shortened ? ` ¡Pero el desgaste te hizo envejecer ${item.agePenalty} años!` : "";
  addHistory("transfer", "🛒 Tienda", `Compraste ${item.name} por ${fmtMoney(item.price)}.${shortNote}`);
  return true;
}

/* Invariante de asientos: cada escudería debe tener exactamente 2 pilotos
   (el jugador cuenta 1 en su equipo) y ningún rival debe quedar con team null.
   También valida reservas coherentes. */
function seatBalanceFailures() {
  const fails = [];
  ["F1", "F2"].forEach(cat => {
    const teams = cat === "F1" ? F1_TEAMS : F2_TEAMS;
    const rivals = player.rivals[cat] || [];
    const inCat = player.category === cat;
    teams.forEach(t => {
      const count = rivals.filter(r => r.team === t.nombre).length + (inCat && player.team === t.nombre ? 1 : 0);
      if (count !== 2) fails.push(`${cat} ${t.nombre}: ${count} pilotos`);
    });
    const free = rivals.filter(r => !r.team);
    if (free.length) fails.push(`${cat}: rival sin equipo: ${free.map(r => r.name).join(", ")}`);
  });

  /* Reservas: reserveTeam válido (F1), no duplicada en rivals, ≤1 por equipo. */
  const reserveTeams = new Set();
  player.reserves.forEach(r => {
    if (!r.reserveTeam || !F1_TEAMS.some(t => t.nombre === r.reserveTeam)) {
      fails.push(`reserva inválida: ${r.name} (${r.reserveTeam})`);
    } else if (reserveTeams.has(r.reserveTeam)) {
      fails.push(`reserva duplicada en ${r.reserveTeam}: ${r.name}`);
    }
    reserveTeams.add(r.reserveTeam);
    if (r.team != null) fails.push(`reserva con team set: ${r.name} (${r.team})`);
    const dupRivals = player.rivals.F1.some(x => x.name === r.name);
    if (dupRivals) fails.push(`reserva duplicada en rivals: ${r.name}`);
  });
  return fails;
}

/* Auto-test del motor: corre temporadas completas y valida invariantes del
   simulador de carrera (posiciones únicas en rango, poles/victorias coherentes,
   campeonato en rango) y del mercado de fichajes (2 pilotos por escudería, sin
   swaps ilógicos ni vacantes). Invocable desde consola: selfTestEngine() */
function selfTestEngine() {
  const FAIL = [];
  const ok = (cond, msg) => { if (!cond) FAIL.push(msg); };
  for (let trial = 0; trial < 6; trial++) {
    player = createDriver("Test", NATIONALITIES[0], "GES", "normal", 99);
    for (let s = 0; s < 12 && !player.retired; s++) {
      const r = simulateSeason(1);
      if (r && r.promotionPending) {
        const offers = generateOffers(3, "F1");
        if (offers.length) acceptOffer(0);
      } else if (Math.random() < 0.4) {
        const offers = generateOffers(2, player.category);
        if (offers.length) acceptOffer(0);
      }
      const fails = seatBalanceFailures();
      if (fails.length) ok(false, "trial " + trial + " S" + (s + 1) + ": " + fails.join("; "));
    }
    const last = player.seasons[player.seasons.length - 1];
    ok(!!last, "la temporada se cerró");
    ok(player.seasonProgress === null, "progreso reseteado");
    const baseRaces = last && last.grid ? last.grid.length : 0;
    ok(baseRaces > 0, "carreras registradas");
    if (baseRaces) {
      last.grid.forEach((race, i) => {
        const pos = race.map(x => x.pos).filter(n => typeof n === "number");
        ok(new Set(pos).size === pos.length, "posiciones únicas carrera " + i);
        ok(pos.every(n => n >= 1 && n <= 22), "posiciones en rango carrera " + i);
      });
    }
    const grid = last && last.grid ? last.grid : [];
    const poles = grid.filter(r => r.some(x => x.gridPos === 1 && x.isPlayer)).length;
    const wins = grid.filter(r => r.some(x => x.pos === 1 && x.isPlayer)).length;
    ok(last.wins === wins, "victorias coherentes");
    ok(last.poles === poles, "poles coherentes");
    ok(Number.isInteger(last.champPos) && last.champPos >= 1 && last.champPos <= 22, "champPos en rango");
  }
  if (FAIL.length) {
    console.error("SELFTEST FAIL:\n - " + FAIL.slice(0, 15).join("\n - "));
    return false;
  }
  console.log("SELFTEST OK: temporadas simuladas con traspasos y asientos balanceados");
  return true;
}
