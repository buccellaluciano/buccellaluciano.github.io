// js/state.js
let player = null;
let currentOffer = null;

const SHOP_ITEMS = [
  { id: 'rest', icon: '🔋', name: 'Recuperación Rápida', desc: 'Restaura forma al 100%', price: 150000 },
  { id: 'shoes', icon: '👟', name: 'Botines Patrocinados', desc: '+1 Valoración Global', price: 750000 },
  { id: 'coach', icon: '🧠', name: 'Entrenador Personal', desc: '+2 Valoración Global', price: 1500000 }
];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function fmtMoney(v) { return "$" + v.toLocaleString("es-AR"); }
function calcSalary(rating) { return Math.round(rating * rating * 12); }
function pickDebutTeam(nationality) { return pickRandom(TEAMS_BY_COUNTRY[nationality]); }

function getTeamCountry(teamName) {
  const team = ALL_TEAMS.find(t => t.nombre === teamName);
  return team ? team.pais : "España"; 
}

function createPlayer(name, nationalityData, posCode, posName) {
  const club = pickDebutTeam(nationalityData.name);
  const startRating = 50; 
  return {
    name,
    nationality: nationalityData.name,
    flag: nationalityData.flag,
    position: posCode,
    positionName: posName,
    age: 18,
    rating: startRating,
    team: club.nombre,
    teamRating: club.rating,
    teamCountry: nationalityData.name,
    seasonsPlayed: 0,
    salary: calcSalary(startRating),
    balance: 0, 
    totalMatches: 0,
    totalGoals: 0,
    totalAssists: 0,
    fitness: 100,
    injured: false,
    retired: false,
    history: [],
    explotar: false
  };
}

function addHistory(type, tag, text) { player.history.push({ type, tag, text, isNew: true }); }
function addSeasonSummary(data) { player.history.push({ type: "season-summary", data, isNew: true }); }

function calcularEstadisticas(code, rating, partidosJugados) {
  const posData = PREFERRED.find(p => p.code === code);
  if (!posData) return null;

  // Factor base: rating 50 = ~0.4 | rating 90 = ~0.93
  const factorRating = Math.pow(rating / 100, 3);

  // Proporción para ajustar los límites a la cantidad real de partidos jugados
  const factorPartidos = partidosJugados / 38;

  // Límites máximos teóricos calculados dinámicamente según la temporada
  const limites = {
    "GOL": 45 * factorPartidos,
    "ASI": 25 * factorPartidos,
    "VIN": 22 * factorPartidos,
    "ATA": 130 * factorPartidos,
    "ENT": 95 * factorPartidos,
    "REC": 150 * factorPartidos,
    "INT": 85 * factorPartidos,
    "TAP": 110 * factorPartidos
  };

  function calcularValor(statCode, esPrimaria) {
    const limiteDinamico = limites[statCode] || (30 * factorPartidos);
    // La stat secundaria tiene un límite menor natural
    const limiteAjustado = esPrimaria ? limiteDinamico : limiteDinamico * 0.4;

    // RNG: de 0.6 a 1.1 base. Un jugador de 90+ tiene un empuje extra en el multiplicador
    const suerte = 0.6 + (Math.random() * 0.5) + (rating / 300);

    return Math.round(limiteAjustado * factorRating * suerte);
  }

  const pStat = posData.statPrimaria;
  const sStat = posData.statSecundaria;

  return [
    { stat: pStat, valor: calcularValor(pStat, true) },
    { stat: sStat, valor: calcularValor(sStat, false) }
  ];
}

function calcSeasonStats(posCode, performance, fitness, teamRating, teamCountry) {
  const isConmebol = ["Argentina", "Brasil"].includes(teamCountry);
  const regionTopTier = isConmebol ? "Copa Libertadores" : "Champions League";
  const regionMidTier = isConmebol ? "Copa Sudamericana" : "Europa League";

  // Determinar la posición en liga del equipo este año
  let leaguePos = Math.round(22 - (teamRating / 4.5) - (performance / 15) + randInt(-3, 3));
  leaguePos = clamp(leaguePos, 1, 20);

  // Determinar campeonatos para el cálculo de partidos
  let wonCup = Math.random() < (teamRating + player.rating / 133) * 0.3;
  let wonIntl = false;
  let qualification = "Ninguna";

  // --- CÁLCULO DINÁMICO DE PARTIDOS POSIBLES ---
  const leagueMatches = 30; // Liga máximo 30 partidos
  const cupMatches = wonCup ? 6 : randInt(1, 5); // Copa Nacional máximo 6
  let intlMatches = 0;

  if (leaguePos >= 1 && leaguePos <= 4) {
    qualification = regionTopTier;
    wonIntl = (teamRating > 80 && Math.random() < 0.15);
    // Champions: Fase de liga (8) + Eliminatorias (7) = 15 máx
    intlMatches = wonIntl ? 15 : randInt(8, 14);
  } else if (leaguePos >= 5 && leaguePos <= 7) {
    qualification = regionMidTier;
    wonIntl = (teamRating > 75 && Math.random() < 0.20);
    // Europa League / Sudamericana: Fase de grupos (6) + Eliminatorias (4) = 10 máx
    intlMatches = wonIntl ? 10 : randInt(6, 9);
  }

  // Partidos bases sumando todas las competiciones jugadas
  const baseMatches = leagueMatches + cupMatches + intlMatches;

  // Ajuste por la forma física del jugador
  const availability = fitness / 100;
  const matches = clamp(Math.round(baseMatches * availability), 3, baseMatches);
  
  // // Factor de escala (usamos 38 como divisor base para mantener el balance estadístico original)
  // const matchFactor = matches / 38;

  let perfMult = clamp(performance / 100, 0.5, 1.5);
  let goals = 0, assists = 0;
  let statsGeneradas = calcularEstadisticas(player.position, player.rating, matches);
  goals = statsGeneradas[0].valor; 
  goals *= perfMult;
  assists = statsGeneradas[1].valor;
  assists *= perfMult;
  goals = Math.round(goals);
  assists = Math.round(assists);
  let titles = 0;
  let wonTitles = [];

  if (leaguePos === 1) {
    titles++;
    wonTitles.push("Liga Local");
    addHistory("season", "🏆 Campeón", `¡Ganaste la Liga Local con ${player.team}!`);
  }

  if (wonCup) {
    titles++;
    wonTitles.push("Copa Nacional");
    addHistory("season", "🏆 Campeón", `¡Conquistaste la Copa Nacional con ${player.team}!`);
  }

  if (wonIntl) {
    titles++;
    wonTitles.push(qualification);
    addHistory("season", "🌟 Éxito Internacional", `¡Increíble! Ganaste la ${qualification} con ${player.team}!`);
  }

  return { matches, goals, assists, titles, wonTitles, leaguePos, qualification };
}

function ageFactorFor(age) {
  if (age <= 21) return 2.0; if (age <= 26) return 1.0;
  if (age <= 29) return 0; if (age <= 32) return -1.0;
  if (age <= 35) return -2.0; return -3.0;
}

function checkRetirement() {
  if (player.age >= 40 || (player.age >= 35 && player.rating < 55) || player.rating <= 28) {
    player.retired = true;
  }
}

function simulateSeason() {
  player.age += 1;
  player.seasonsPlayed += 1;

  if (!player.injured) player.fitness = clamp(player.fitness + randInt(5, 15), 0, 100);
  player.injured = false;

  const fitnessMod = (player.fitness - 100) / 6;
  const performance = clamp(randInt(1, 100) + fitnessMod, 1, 100);
  
  let perfLabel = "regular";
  if (performance >= 80) perfLabel = "excelente 🌟";
  else if (performance >= 60) perfLabel = "buena 👍";
  else if (performance < 30) perfLabel = "muy floja 📉";
  else if (performance < 45) perfLabel = "floja ⚠️";

  addHistory("season", "📅 Temporada " + player.seasonsPlayed, `${player.name} tuvo una temporada <strong>${perfLabel}</strong> con ${player.team}.`);

  // --- SISTEMA DE RNG "EXPLOTAR" ---
  // Probabilidad base levemente creciente con cada temporada jugada
  const probabilidadExplotar = 0.02 + (player.seasonsPlayed * 0.005); 
  
  // Si no ha explotado aún, tiramos los dados para ver si despierta su potencial este año
  if (!player.explotar && Math.random() < probabilidadExplotar) {
    player.explotar = true;
    addHistory("season", "🔥 EXPLOSIÓN", `¡${player.name} ha explotado su potencial! A partir de ahora su progresión será mucho más rápida.`);
  }

  let modificadorDado = 0;
  if (player.explotar === true && player.age <= 31) {
    // ESTADO EXPLOTÓ (True y en edad óptima): Más probable que suba rápido y con saltos más grandes
    const dado = randInt(1, 10);
    if (dado >= 8) modificadorDado = randInt(3, 5); // Salto de calidad enorme
    else if (dado >= 4) modificadorDado = randInt(1, 2); // Subida constante
    else if (dado === 1) modificadorDado = -1; // Raro que baje
    else modificadorDado = 0;
  } else {
    // ESTADO NORMAL (False o mayor a 31 años): Varía muy poco, crecimiento lento y estable
    const dado = randInt(1, 6);
    if (dado >= 5) modificadorDado = 1;
    else if (dado <= 2) modificadorDado = -1;
    else modificadorDado = 0;
  }
  // ---------------------------------

  const ageFactor = ageFactorFor(player.age);
  const perfFactor = (performance - 30) / 50; 
  let delta = Math.round(modificadorDado + ageFactor + perfFactor);

  if (player.rating < 85 && Math.random() < 0.25) {
    delta += randInt(0, 2);
  }
  let injuryHappened = false;
  if (Math.random() < 0.09) {
    injuryHappened = true;
    const severity = randInt(1, 3);
    const severityLabel = ["leve", "moderada", "grave"][severity - 1];
    const ratingHit = clamp(severity * randInt(1, 2), 1, 5); 
    const fitnessHit = severity * randInt(10, 18);
    delta -= ratingHit;
    player.fitness = clamp(player.fitness - fitnessHit, 10, 100);
    player.injured = true;
    addHistory("injury", "🚑 Lesión", `Sufrió una lesión <strong>${severityLabel}</strong>. Impacto en progresión: -${ratingHit}. Forma física baja a ${player.fitness}%.`);
  }

  player.rating = clamp(player.rating + delta, 25, 99);
  const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
  const icon = delta >= 0 ? "📈" : "📉";
  addHistory("season", `${icon} Progresión`, `Cambio en media: ${deltaStr}. Nueva valoración global: <strong>${player.rating}</strong>.`);

  const stats = calcSeasonStats(player.position, performance, player.fitness, player.teamRating, player.teamCountry);
  player.totalMatches += stats.matches;
  player.totalGoals += stats.goals;
  player.totalAssists += stats.assists;

  addSeasonSummary({ 
    season: player.seasonsPlayed, 
    age: player.age, 
    team: player.team, 
    performance: performance,
    ...stats 
  });

  player.balance += player.salary;
  player.salary = calcSalary(player.rating);
  checkRetirement();

  return { injuryHappened, performance };
}

function generateOffer(performance = 50) {
  let maxRating = player.rating + 4;
  let minRating = player.rating - 8;

  if (player.rating < 79) {
    maxRating = player.rating; 
  } else if (performance >= 80) {
    maxRating += 5; 
  }

  let candidates = ALL_TEAMS.filter(t => t.nombre !== player.team && t.rating >= minRating && t.rating <= maxRating);
  
  if (Math.random() < 0.15 || candidates.length === 0) {
    candidates = ALL_TEAMS.filter(t => t.nombre !== player.team && t.rating <= maxRating + 2);
  }
  
  if (candidates.length === 0) candidates = ALL_TEAMS.filter(t => t.nombre !== player.team);

  const club = pickRandom(candidates);
  const baseSalary = calcSalary(clamp(player.rating, club.rating - 10, club.rating + 10));
  const bonus = 1 + (club.rating - player.teamRating) * 0.01 + Math.random() * 0.15;
  currentOffer = { club, salary: Math.round(baseSalary * Math.max(0.7, bonus)) };
  return currentOffer;
}

function acceptOffer() {
  if (!currentOffer) return;
  addHistory("transfer", "🤝 Fichaje", `${player.name} ficha por <strong>${currentOffer.club.nombre}</strong>. Nuevo salario: ${fmtMoney(currentOffer.salary)}.`);
  player.team = currentOffer.club.nombre;
  player.teamRating = currentOffer.club.rating;
  player.teamCountry = getTeamCountry(player.team);
  player.salary = currentOffer.salary;
  currentOffer = null;
}

function rejectOffer() {
  if (!currentOffer) return;
  addHistory("offer", "❌ Oferta rechazada", `Se rechazó la oferta de <strong>${currentOffer.club.nombre}</strong>.`);
  currentOffer = null;
}

function buyItem(id) {
  const item = SHOP_ITEMS.find(i => i.id === id);
  if (item && player.balance >= item.price) {
    player.balance -= item.price;
    if (id === 'rest') player.fitness = 100;
    if (id === 'shoes') player.rating = clamp(player.rating + 1, 25, 99);
    if (id === 'coach') player.rating = clamp(player.rating + 2, 25, 99);
    addHistory("transfer", "🛒 Tienda", `Compraste ${item.name} por ${fmtMoney(item.price)}.`);
    return true;
  }
  return false;
}