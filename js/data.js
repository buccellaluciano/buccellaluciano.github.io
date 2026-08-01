const NATIONALITIES = [
  { name: "Argentina", flag: "🇦🇷" },
  { name: "Francia", flag: "🇫🇷" },
  { name: "Brasil", flag: "🇧🇷" },
  { name: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Bélgica", flag: "🇧🇪" },
  { name: "Croacia", flag: "🇭🇷" },
  { name: "Países Bajos", flag: "🇳🇱" },
  { name: "Portugal", flag: "🇵🇹" },
  { name: "Italia", flag: "🇮🇹" },
  { name: "España", flag: "🇪🇸" }
];

const TEAMS_BY_COUNTRY = {
  "Argentina": [
    { nombre: "Boca Juniors", rating: 82 }, { nombre: "River Plate", rating: 83 },
    { nombre: "Racing Club", rating: 74 }, { nombre: "Independiente", rating: 71 },
    { nombre: "San Lorenzo", rating: 70 }, { nombre: "Estudiantes de LP", rating: 72 }
  ],
  "Francia": [
    { nombre: "PSG", rating: 88 }, { nombre: "Marsella", rating: 78 },
    { nombre: "Olympique Lyon", rating: 76 }, { nombre: "AS Mónaco", rating: 79 },
    { nombre: "Lille OSC", rating: 74 }, { nombre: "Stade Rennais", rating: 72 }
  ],
  "Brasil": [
    { nombre: "Flamengo", rating: 83 }, { nombre: "Palmeiras", rating: 84 },
    { nombre: "São Paulo", rating: 76 }, { nombre: "Corinthians", rating: 75 },
    { nombre: "Grêmio", rating: 74 }, { nombre: "Internacional", rating: 73 }
  ],
  "Inglaterra": [
    { nombre: "Manchester City", rating: 90 }, { nombre: "Liverpool", rating: 88 },
    { nombre: "Arsenal", rating: 86 }, { nombre: "Manchester United", rating: 82 },
    { nombre: "Chelsea", rating: 83 }, { nombre: "Tottenham", rating: 81 }
  ],
  "Bélgica": [
    { nombre: "Club Brugge", rating: 77 }, { nombre: "Anderlecht", rating: 73 },
    { nombre: "Genk", rating: 72 }, { nombre: "Gante", rating: 71 },
    { nombre: "Standard Lieja", rating: 68 }
  ],
  "Croacia": [
    { nombre: "Dinamo Zagreb", rating: 74 }, { nombre: "Hajduk Split", rating: 70 },
    { nombre: "Rijeka", rating: 67 }, { nombre: "Osijek", rating: 64 }
  ],
  "Países Bajos": [
    { nombre: "Ajax", rating: 80 }, { nombre: "PSV", rating: 81 },
    { nombre: "Feyenoord", rating: 79 }, { nombre: "AZ Alkmaar", rating: 73 }
  ],
  "Portugal": [
    { nombre: "Benfica", rating: 83 }, { nombre: "Porto", rating: 82 },
    { nombre: "Sporting CP", rating: 81 }, { nombre: "Braga", rating: 75 }
  ],
  "Italia": [
    { nombre: "Juventus", rating: 84 }, { nombre: "Inter de Milán", rating: 86 },
    { nombre: "AC Milan", rating: 83 }, { nombre: "Napoli", rating: 85 },
    { nombre: "AS Roma", rating: 79 }, { nombre: "Lazio", rating: 78 }
  ],
  "España": [
    { nombre: "Real Madrid", rating: 91 }, { nombre: "FC Barcelona", rating: 89 },
    { nombre: "Atlético Madrid", rating: 85 }, { nombre: "Sevilla FC", rating: 77 },
    { nombre: "Real Sociedad", rating: 76 }, { nombre: "Villarreal CF", rating: 75 }
  ]
};

const ALL_TEAMS = Object.keys(TEAMS_BY_COUNTRY).flatMap(pais =>
  TEAMS_BY_COUNTRY[pais].map(t => ({ ...t, pais }))
);

const FORMATION_433 = [
  { code: "POR", nombre: "Portero",               top: 90, left: 50 },
  { code: "LD",  nombre: "Lateral Derecho",       top: 73, left: 84 },
  { code: "DFC", nombre: "Defensa Central",       top: 76, left: 62 },
  { code: "DFC", nombre: "Defensa Central",       top: 76, left: 38 },
  { code: "LI",  nombre: "Lateral Izquierdo",     top: 73, left: 16 },
  { code: "MCD", nombre: "Mediocentro Defensivo", top: 54, left: 50 },
  { code: "MC",  nombre: "Mediocentro",           top: 44, left: 70 },
  { code: "MC",  nombre: "Mediocentro",           top: 44, left: 30 },
  { code: "ED",  nombre: "Extremo Derecho",       top: 18, left: 84 },
  { code: "DC",  nombre: "Delantero Centro",      top: 10, left: 50 },
  { code: "EI",  nombre: "Extremo Izquierdo",     top: 18, left: 16 }
];

const PREFERRED = [
  { code: "POR", statPrimaria: "VIN", statSecundaria: "ATA" },
  { code: "LD",  statPrimaria: "ASI", statSecundaria: "ENT" },
  { code: "DFC", statPrimaria: "ENT", statSecundaria: "VIN" },
  { code: "DFC", statPrimaria: "ENT", statSecundaria: "VIN" },
  { code: "LI",  statPrimaria: "ASI", statSecundaria: "ENT" },
  { code: "MCD", statPrimaria: "REC", statSecundaria: "INT" },
  { code: "MC",  statPrimaria: "ASI", statSecundaria: "GOL" },
  { code: "MC",  statPrimaria: "ASI", statSecundaria: "GOL" },
  { code: "ED",  statPrimaria: "GOL", statSecundaria: "ASI" },
  { code: "DC",  statPrimaria: "GOL", statSecundaria: "ASI" },
  { code: "EI",  statPrimaria: "GOL", statSecundaria: "ASI" }
];