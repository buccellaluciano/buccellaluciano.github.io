
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
  const used = new Set();
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
     El hueco lo ocupa el primer piloto del waiting seat: F1 sin butaca primero, luego F2. */
  const isRetired = r => r.age >= 50 || (r.age >= 38 && r.rating < 65) || r.rating <= 45;
  const kept = [];
  for (const r of list) {
    if (!isRetired(r)) {
      kept.push(r);
      continue;
    }
    const replacement = player.waitingSeat.F1.shift() || player.waitingSeat.F2.shift();
    if (replacement) {
      replacement.team = r.team;
      kept.push(replacement);
    }
  }
  list.length = 0;
  list.push(...kept);

  /* Reposición de cantera: el pool nunca debe quedarse vacío en una carrera larga. */
  if (player.waitingSeat.F2.length < 10) {
    player.waitingSeat.F2.push(...generateProspects(3));
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

/* Score de carrera: stats del piloto + rating del equipo + factor random, menor = mejor.
   Empate exacto de score se desempata con dado (random en el sort). */
function raceScoreOf(d) {
  const st = d.stats || {};
  const skill = ((st.rtg || 50) + (st.exp || 50) + (st.rac || 50) + (st.awa || 50) + (st.pac || 50)) / 5 / 100;
  const teamFactor = (d.teamRating != null ? d.teamRating : 75) / 100;
  const ability = skill * 0.4 + teamFactor * 0.6;
  const jitter = Math.random() * 0.12 - 0.06;
  return clamp(1 - ability + jitter, 0, 1);
}

/* Simula una carrera sobre la grilla: ~4% de DNF, ordena por score (menor a mayor),
   posiciones únicas, y devuelve los clasificados ordenados. */
function fillRace(grid, playerRow, rivals, r) {
  const dnf = new Set();
  rivals.forEach(d => { if (Math.random() < 0.04) dnf.add(d); });
  const finishers = [playerRow, ...rivals].filter(d => !dnf.has(d));
  finishers.sort((a, b) => raceScoreOf(a) - raceScoreOf(b) || Math.random() - 0.5);
  finishers.forEach((d, i) => { d.cells[r] = i + 1; });
  dnf.forEach(d => { d.cells[r] = "DNF"; });
  return finishers;
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
    rivals
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

function calcSeasonStats(performance, fitness, raceAgg = null) {
  const isF1 = player.category === "F1";
  const baseRaces = isF1 ? 24 : 14;
  const maxDrivers = 22;

  let champPos, races, wins, podiums, poles, points;
  if (raceAgg) {
    champPos = clamp(raceAgg.champPos, 1, maxDrivers);
    races = raceAgg.matches;
    wins = raceAgg.wins;
    podiums = raceAgg.podiums;
    poles = raceAgg.poles;
    points = raceAgg.points;
  } else {
    champPos = clamp(Math.round(22 - (player.teamRating / 5.5) - (performance / 18) + randInt(-3, 3)), 1, maxDrivers);

    const availability = fitness / 100;
    races = clamp(Math.round(baseRaces * availability), 2, baseRaces);
    const availFactor = races / baseRaces;

    if (champPos === 1) wins = randInt(Math.round(baseRaces * 0.35), Math.round(baseRaces * 0.65));
    else if (champPos === 2) wins = randInt(Math.round(baseRaces * 0.15), Math.round(baseRaces * 0.35));
    else if (champPos === 3) wins = randInt(Math.round(baseRaces * 0.08), Math.round(baseRaces * 0.25));
    else if (champPos <= 6) wins = randInt(0, Math.max(1, Math.round(baseRaces * 0.12)));
    else wins = Math.random() < 0.25 ? randInt(1, 2) : 0;
    wins = Math.round(wins * availFactor);

    podiums = clamp(wins + Math.round(randInt(0, Math.round(baseRaces * 0.3)) * availFactor), wins, races);
    poles = clamp(Math.round((wins + randInt(-2, 4) + (player.style === "CAL" ? randInt(1, 4) : 0)) * availFactor), 0, races);
    const pointsTable = isF1 ? POINTS_F1 : POINTS_F2;
    points = pointsTable[champPos - 1] || 0;
  }

  const fastestLaps = randInt(0, Math.max(1, Math.round(wins / 2))) + (player.style === "LLV" && Math.random() < 0.5 ? 1 : 0);
  const overtakes = Math.round((player.rating / 99) * randInt(baseRaces, baseRaces * 3) * (player.style === "AGR" ? 1.4 : 1) * (races / baseRaces));
  const pointsTable = isF1 ? POINTS_F1 : POINTS_F2;

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

  /* Trofeos de GP: en modo carrera a carrera se entregan por los GP realmente ganados;
     en modo temporada (sin detalle de GP) uno aleatorio, igual que el viejo "GP de Mónaco". */
  if (raceAgg && raceAgg.wonGps && raceAgg.wonGps.length) {
    raceAgg.wonGps.forEach(i => {
      const gp = GP_TROPHIES[i];
      if (!gp) return;
      titles++;
      wonTitles.push({ name: "GP de " + gp.name, type: "gp" });
      addHistory("season", "👑 " + gp.name, `¡Victoria! ${player.name} ganó el GP de ${gp.name}.`);
    });
  } else if (wins > 0 && Math.random() < 0.18) {
    const gp = pickRandom(GP_TROPHIES);
    titles++;
    wonTitles.push({ name: "GP de " + gp.name, type: "gp" });
    addHistory("season", "👑 " + gp.name, `¡Victoria de leyenda! ${player.name} ganó el GP de ${gp.name}.`);
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
  if (player.age >= 50 || (player.age >= 38 && player.rating < 65) || player.rating <= 45) {
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

function raceAggFromProgress(progress) {
  const isF1 = player.category === "F1";
  const ptsTable = isF1 ? POINTS_F1 : POINTS_F2;
  const totals = {};
  let wins = 0, podiums = 0, points = 0;
  const wonGps = [];
  progress.races.forEach((race, i) => {
    race.forEach(x => {
      if (typeof x.pos === "number") {
        const p = ptsTable[x.pos - 1] || 0;
        totals[x.name] = (totals[x.name] || 0) + p;
        if (x.isPlayer) {
          if (x.pos === 1) { wins++; wonGps.push(i); }
          if (x.pos <= 3) podiums++;
          points += p;
        }
      }
    });
  });
  const champPos = Object.values(totals).filter(v => v > (totals[player.name] || 0)).length + 1;
  const poles = clamp(wins + randInt(-2, 4) + (player.style === "CAL" ? randInt(1, 4) : 0), 0, progress.races.length);
  return { champPos, wins, podiums, poles, points, matches: progress.races.length, wonGps };
}

function simulateRace() {
  if (!player.seasonProgress) {
    player.seasonProgress = { baseRaces: player.category === "F1" ? 24 : 14, racesDone: 0, races: [] };
  }
  const p = player.seasonProgress;
  const isF1 = player.category === "F1";
  const grid = buildGrid(isF1, player.team);
  const playerRow = grid.find(d => d.isPlayer);
  const rivals = grid.filter(d => !d.isPlayer);
  grid.forEach(d => { d.cells = []; });
  fillRace(grid, playerRow, rivals, 0);
  p.races.push(grid.map(d => ({ name: d.name, team: d.team, isPlayer: d.isPlayer, pos: d.cells[0] })));
  p.racesDone += 1;
  if (p.racesDone >= p.baseRaces) {
    const raceStats = raceAggFromProgress(p);
    const racesGrid = p.races;
    player.year += 1;
    const r = simulateOneSeason(raceStats, racesGrid);
    player.seasonProgress = null;
    return r;
  }
  return null;
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
      // ocupa el asiento libre del que se va (swap)
      const seats = list.filter(x => x.team === offer.club.nombre).length;
      if (seats >= 2) {
        const occupant = list.find(x => x.team === offer.club.nombre);
        if (occupant) occupant.team = r.team;
      }
      r.team = offer.club.nombre;
      addHistoryToLastSeason("transfer", "🔄 Traspaso", `${r.name} ficha por <strong>${offer.club.nombre}</strong>.`);
    }
  });
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

  /* Swap de butaca: el piloto desplazado del equipo nuevo pasa al equipo viejo,
     para que la parrilla no pierda un piloto. Si es cambio de categoría, se mueve
     entre listas (el desplazado de F1 baja a F2). */
  if (newTeam !== prevTeam) {
    const dest = player.rivals[newCategory];
    if (dest) {
      const displaced = dest.find(r => r.team === newTeam);
      if (displaced) {
        if (newCategory === prevCat) {
          displaced.team = prevTeam;
        } else {
          dest.splice(dest.indexOf(displaced), 1);
          displaced.team = prevTeam;
          player.rivals[prevCat].push(displaced);
        }
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
