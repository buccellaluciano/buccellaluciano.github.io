
// Configuración de Supabase — reemplazá con los valores de tu proyecto.
// No es secreta: la anon key es pública y puede ir en el cliente.
const SUPABASE_CONFIG = {
  url: "https://ellztukksdqrllprkryi.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsbHp0dWtrc2RxcmxscHJrcnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1ODk0MTcsImV4cCI6MjEwMjE2NTQxN30.hn11YuiuwMfdXo4SyxPiocaQKlxB7v-gApW7wp0QkXA"
};

function isSupabaseConfigured() {
  return !SUPABASE_CONFIG.url.includes("SU-PROYECTO") && SUPABASE_CONFIG.anonKey !== "TU-ANON-KEY";
}

async function supaFetch(path, options = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase no está configurado. Completá js/supabase.js");
  }
  const res = await fetch(SUPABASE_CONFIG.url + path, {
    ...options,
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      Authorization: "Bearer " + SUPABASE_CONFIG.anonKey,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    throw new Error("Error de Supabase (" + res.status + ")");
  }
  if (res.status === 204) return null;
  return res.json();
}

// Lunes de la semana actual en UTC (mismo criterio que date_trunc('week', now())).
function currentWeekStart() {
  const now = new Date();
  const diff = (now.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return monday.toISOString().slice(0, 10);
}

const RANKING_COLUMNS = {
  victorias: "total_wins",
  podios: "total_podiums",
  dinero: "total_money",
  campeonatos: "championships"
};

async function fetchRanking(tab) {
  const col = RANKING_COLUMNS[tab];
  if (!col) return [];
  const week = currentWeekStart();
  const params = new URLSearchParams({
    select: `player_name,team,style,${col}`,
    week_start: `eq.${week}`,
    order: `${col}.desc`,
    limit: "10"
  });
  return supaFetch(`/rest/v1/partidas?${params.toString()}`);
}

async function submitPartida() {
  const payload = {
    player_name: player.name,
    team: player.team,
    nationality: player.nationality,
    style: player.styleName,
    final_rating: player.rating,
    age: player.age,
    seasons: player.seasonsPlayed,
    total_wins: player.totalWins,
    total_podiums: player.totalPodiums,
    total_poles: player.totalPoles,
    total_money: player.totalEarned,
    championships: player.championships,
    driver_awards: player.driverAwards,
    golden_helmets: player.goldenHelmets
  };

  const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/submit`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      Authorization: "Bearer " + SUPABASE_CONFIG.anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error("Error al subir la partida (" + res.status + ")");
  }
  return res.json();
}
