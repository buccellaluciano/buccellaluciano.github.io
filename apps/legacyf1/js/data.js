const NATIONALITIES = [
  { name: "Argentina", flag: "🇦🇷" },
  { name: "Brasil", flag: "🇧🇷" },
  { name: "México", flag: "🇲🇽" },
  { name: "Colombia", flag: "🇨🇴" },
  { name: "Estados Unidos", flag: "🇺🇸" },
  { name: "Canadá", flag: "🇨🇦" },
  { name: "España", flag: "🇪🇸" },
  { name: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Francia", flag: "🇫🇷" },
  { name: "Alemania", flag: "🇩🇪" },
  { name: "Italia", flag: "🇮🇹" },
  { name: "Países Bajos", flag: "🇳🇱" },
  { name: "Bélgica", flag: "🇧🇪" },
  { name: "Suiza", flag: "🇨🇭" },
  { name: "Austria", flag: "🇦🇹" },
  { name: "Dinamarca", flag: "🇩🇰" },
  { name: "Finlandia", flag: "🇫🇮" },
  { name: "Suecia", flag: "🇸🇪" },
  { name: "Noruega", flag: "🇳🇴" },
  { name: "Irlanda", flag: "🇮🇪" },
  { name: "Australia", flag: "🇦🇺" },
  { name: "Nueva Zelanda", flag: "🇳🇿" },
  { name: "Japón", flag: "🇯🇵" },
  { name: "Tailandia", flag: "🇹🇭" },
  { name: "India", flag: "🇮🇳" },
  { name: "China", flag: "🇨🇳" },
  { name: "Mónaco", flag: "🇲🇨" },
  { name: "Paraguay", flag: "🇵🇾" }
];

const F1_TEAMS = [
  { nombre: "McLaren", rating: 97, color: "#FF8000", budget: 72000000, apiname: "McLaren Formula 1 Team" },
  { nombre: "Red Bull Racing", rating: 96, color: "#3671C6", budget: 80000000, apiname: "Oracle Red Bull Racing" },
  { nombre: "Ferrari", rating: 95, color: "#E8002D", budget: 76000000, apiname: "Scuderia Ferrari HP" },
  { nombre: "Mercedes", rating: 94, color: "#27F4D2", budget: 72000000, apiname: "Mercedes AMG Petronas" },
  { nombre: "Aston Martin", rating: 88, color: "#229971", budget: 50000000, apiname: "Aston Martin Aramco Formula One Team" },
  { nombre: "Williams", rating: 86, color: "#64C4FF", budget: 28000000, apiname: "Williams Racing" },
  { nombre: "Racing Bulls", rating: 85, color: "#6692FF", budget: 24000000, apiname: "Visa Cash App Racing Bulls Formula One Team" },
  { nombre: "Alpine", rating: 84, color: "#FF87BC", budget: 30000000, apiname: "BWT Alpine Formula One Team" },
  { nombre: "Audi", rating: 83, color: "#ef910c", budget: 26000000, apiname: "Stake F1 Team Kick Sauber" },
  { nombre: "Haas", rating: 82, color: "#85391b", budget: 20000000, apiname: "MoneyGram Haas F1 Team" },
  { nombre: "Cadillac", rating: 80, color: "#f6f4ef", budget: 30000000, apiname: "Cadillac Formula 1 Team" }
];

const F2_TEAMS = [
  { nombre: "Prema Racing", rating: 76, color: "#EF0101", budget: 600000, apiname: "Prema Racing" }, // Corregido: era #E30613, oficial es #EF0101
  { nombre: "Invicta Racing", rating: 75, color: "#e0e011", budget: 550000, apiname: "Invicta Racing" }, // Sin verificar, se mantiene
  { nombre: "Campos Racing", rating: 74, color: "#CB200F", budget: 500000, apiname: "Campos Racing" }, // Corregido: NO es verde (#00A550), colores oficiales son rojo/gris/dorado; se usó el rojo #CB200F como principal
  { nombre: "Hitech TGR", rating: 73, color: "#C72613", budget: 480000, apiname: "Hitech TGR" }, // Corregido: era #F5A623 (naranja), oficial es negro/rojo #C72613
  { nombre: "MP Motorsport", rating: 72, color: "#000000", budget: 450000, apiname: "MP Motorsport" }, // Corregido: NO es azul (#003DA5), colores oficiales son negro/blanco
  { nombre: "ART Grand Prix", rating: 72, color: "#ED1C24", budget: 450000, apiname: "ART Grand Prix" }, // Corregido: era #5C2D91 (morado), oficial es negro/rojo #ED1C24
  { nombre: "Rodin Motorsport", rating: 70, color: "#101820", budget: 380000, apiname: "Rodin Motorsport" }, // Sin verificar, se mantiene
  { nombre: "DAMS Lucas Oil", rating: 70, color: "#0055A4", budget: 380000, apiname: "DAMS Lucas Oil" }, // Sin verificar (fuentes indican negro/dorado como colores clásicos de DAMS, revisar)
  { nombre: "Van Amersfoort Racing", rating: 68, color: "#FF6600", budget: 300000, apiname: "Van Amersfoort Racing" }, // Sin verificar, se mantiene
  { nombre: "Trident Motorsport", rating: 67, color: "#004C93", budget: 280000, apiname: "Trident Motorsport" }, // Sin verificar, se mantiene
  { nombre: "AIX Racing", rating: 65, color: "#1de613", budget: 220000, apiname: "AIX Racing" } // Sin verificar, se mantiene
];

const ALL_TEAMS = [
  ...F1_TEAMS.map(t => ({ ...t, categoria: "F1" })),
  ...F2_TEAMS.map(t => ({ ...t, categoria: "F2" }))
];

/* =====================================================================
   Sistema de rating de pilotos
   Cada piloto tiene 5 stats (RTG · EXP · RAC · AWA · PAC); su valoración
   total es el promedio de las 5. `pot` (potencial) es oculta y gobierna
   cuánto puede evolucionar la valoración temporada a temporada.
   ===================================================================== */

const DRIVER_STAT_KEYS = ["rtg", "exp", "rac", "awa", "pac"];

/* Assets de la vitrina: mapea cada trofeo a su imagen. Agregá el archivo en
   assets/trophies/ y el trofeo se mostrará con esa imagen (fallback: emoji). */
const TROPHY_ASSETS = {
  "Campeonato Mundial de F1": "assets/trophies/f1-champ.png",
  "Campeonato de F2": "assets/trophies/f2-champ.png",
  "Campeonato de Constructores": "assets/trophies/constructors.png",
  "Rookie del Año": "assets/trophies/rookie.png",
  "Casco de Oro": "assets/trophies/golden-helmet.png",
  "Piloto del Año FIA": "assets/trophies/fia-award.png"
};

/* Trofeo propio de cada Gran Premio (mismo trato que Mónaco). Orden = calendario del juego.
   `asset` es la imagen del trofeo; si el archivo no existe, el render cae al emoji. */
const GP_TROPHIES = [
  { code: "AUS", name: "Australia", asset: "assets/trophies/australia.png" },
  { code: "CHN", name: "China", asset: "assets/trophies/china.png" },
  { code: "JPN", name: "Japón", asset: "assets/trophies/japon.png" },
  { code: "BHR", name: "Bahréin", asset: "assets/trophies/bahrein.png" },
  { code: "KSA", name: "Arabia Saudita", asset: "assets/trophies/arabia.png" },
  { code: "MIA", name: "Miami", asset: "assets/trophies/miami.png" },
  { code: "MAD", name: "Madrid", asset: "assets/trophies/madrid.png" },
  { code: "MCO", name: "Mónaco", asset: "assets/trophies/monaco.png" },
  { code: "CAN", name: "Canadá", asset: "assets/trophies/canada.png" },
  { code: "ESP", name: "España", asset: "assets/trophies/espana.png" },
  { code: "AUT", name: "Austria", asset: "assets/trophies/austria.png" },
  { code: "GBR", name: "Gran Bretaña", asset: "assets/trophies/gran-bretana.png" },
  { code: "BEL", name: "Bélgica", asset: "assets/trophies/belgica.png" },
  { code: "HUN", name: "Hungría", asset: "assets/trophies/hungria.png" },
  { code: "NED", name: "Países Bajos", asset: "assets/trophies/paises-bajos.png" },
  { code: "ITA", name: "Italia", asset: "assets/trophies/italia.png" },
  { code: "AZE", name: "Azerbaiyán", asset: "assets/trophies/azerbaiyan.png" },
  { code: "SIN", name: "Singapur", asset: "assets/trophies/singapur.png" },
  { code: "USA", name: "Austin", asset: "assets/trophies/austin.png" },
  { code: "MEX", name: "México", asset: "assets/trophies/mexico.png" },
  { code: "BRA", name: "Brasil", asset: "assets/trophies/brasil.png" },
  { code: "LVG", name: "Las Vegas", asset: "assets/trophies/las-vegas.png" },
  { code: "QAT", name: "Qatar", asset: "assets/trophies/qatar.png" },
  { code: "UAE", name: "Abu Dhabi", asset: "assets/trophies/abu-dhabi.png" }
];

/* Puntos por posición de carrera (reglamento real FIA): top 10 suma, el resto 0. */
const POINTS_F1 = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const POINTS_F2 = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const F1_DRIVERS = [
  { name: "Lando Norris", team: "McLaren", nat: "Inglaterra", dorsal: 4, age: 26, stats: { rtg: 91, exp: 84, rac: 90, awa: 90, pac: 94 }, pot: 68 },
  { name: "Oscar Piastri", team: "McLaren", nat: "Australia", dorsal: 81, age: 25, stats: { rtg: 90, exp: 80, rac: 89, awa: 88, pac: 95 }, pot: 92 },
  { name: "Max Verstappen", team: "Red Bull Racing", nat: "Países Bajos", dorsal: 1, age: 28, stats: { rtg: 96, exp: 92, rac: 97, awa: 94, pac: 96 }, pot: 55 },
  { name: "Isack Hadjar", team: "Red Bull Racing", nat: "Francia", dorsal: 6, age: 22, stats: { rtg: 79, exp: 76, rac: 80, awa: 79, pac: 82 }, pot: 85 },
  { name: "Charles Leclerc", team: "Ferrari", nat: "Mónaco", dorsal: 16, age: 28, stats: { rtg: 90, exp: 86, rac: 89, awa: 91, pac: 95 }, pot: 70 },
  { name: "Lewis Hamilton", team: "Ferrari", nat: "Inglaterra", dorsal: 44, age: 41, stats: { rtg: 90, exp: 95, rac: 87, awa: 93, pac: 88 }, pot: 12 },
  { name: "George Russell", team: "Mercedes", nat: "Inglaterra", dorsal: 63, age: 28, stats: { rtg: 88, exp: 86, rac: 88, awa: 87, pac: 90 }, pot: 72 },
  { name: "Kimi Antonelli", team: "Mercedes", nat: "Italia", dorsal: 12, age: 19, stats: { rtg: 85, exp: 74, rac: 86, awa: 84, pac: 93 }, pot: 95 },
  { name: "Fernando Alonso", team: "Aston Martin", nat: "España", dorsal: 14, age: 45, stats: { rtg: 88, exp: 96, rac: 86, awa: 91, pac: 80 }, pot: 5 },
  { name: "Lance Stroll", team: "Aston Martin", nat: "Canadá", dorsal: 18, age: 27, stats: { rtg: 76, exp: 82, rac: 74, awa: 75, pac: 77 }, pot: 40 },
  { name: "Alex Albon", team: "Williams", nat: "Tailandia", dorsal: 23, age: 30, stats: { rtg: 81, exp: 84, rac: 80, awa: 82, pac: 83 }, pot: 60 },
  { name: "Carlos Sainz", team: "Williams", nat: "España", dorsal: 55, age: 31, stats: { rtg: 85, exp: 88, rac: 84, awa: 85, pac: 82 }, pot: 30 },
  { name: "Liam Lawson", team: "Racing Bulls", nat: "Nueva Zelanda", dorsal: 30, age: 24, stats: { rtg: 80, exp: 82, rac: 80, awa: 81, pac: 81 }, pot: 75 },
  { name: "Arvid Lindblad", team: "Racing Bulls", nat: "Inglaterra", dorsal: 21, age: 19, stats: { rtg: 77, exp: 74, rac: 79, awa: 78, pac: 83 }, pot: 90 },
  { name: "Pierre Gasly", team: "Alpine", nat: "Francia", dorsal: 10, age: 30, stats: { rtg: 83, exp: 86, rac: 82, awa: 84, pac: 84 }, pot: 35 },
  { name: "Franco Colapinto", team: "Alpine", nat: "Argentina", dorsal: 43, age: 23, stats: { rtg: 82, exp: 78, rac: 83, awa: 82, pac: 87 }, pot: 93 },
  { name: "Nico Hulkenberg", team: "Audi", nat: "Alemania", dorsal: 27, age: 39, stats: { rtg: 82, exp: 92, rac: 79, awa: 81, pac: 77 }, pot: 8 },
  { name: "Gabriel Bortoleto", team: "Audi", nat: "Brasil", dorsal: 5, age: 21, stats: { rtg: 79, exp: 75, rac: 80, awa: 80, pac: 84 }, pot: 94 },
  { name: "Esteban Ocon", team: "Haas", nat: "Francia", dorsal: 31, age: 29, stats: { rtg: 82, exp: 85, rac: 80, awa: 82, pac: 80 }, pot: 28 },
  { name: "Oliver Bearman", team: "Haas", nat: "Inglaterra", dorsal: 87, age: 21, stats: { rtg: 78, exp: 73, rac: 79, awa: 78, pac: 84 }, pot: 92 },
  { name: "Sergio Pérez", team: "Cadillac", nat: "México", dorsal: 11, age: 36, stats: { rtg: 80, exp: 88, rac: 76, awa: 80, pac: 72 }, pot: 15 },
  { name: "Valtteri Bottas", team: "Cadillac", nat: "Finlandia", dorsal: 77, age: 37, stats: { rtg: 82, exp: 89, rac: 76, awa: 93, pac: 83 }, pot: 30 }
];

/* Parrilla real de F2 (dos pilotos por escudería), misma estructura que F1_DRIVERS.
   Las nacionalidades usan los nombres de NATIONALITIES; si una no existe, se aproxima. */
const F2_DRIVERS = [
  { name: "Joshua Dürksen", team: "Invicta Racing", nat: "Paraguay", dorsal: 14, age: 22, stats: { rtg: 68, exp: 70, rac: 67, awa: 68, pac: 69 }, pot: 65 },
  { name: "Rafael Câmara", team: "Invicta Racing", nat: "Brasil", dorsal: 15, age: 20, stats: { rtg: 65, exp: 63, rac: 66, awa: 64, pac: 68 }, pot: 85 },
  { name: "Nikola Tsolov", team: "Campos Racing", nat: "Bulgaria", dorsal: 21, age: 19, stats: { rtg: 66, exp: 64, rac: 67, awa: 65, pac: 70 }, pot: 88 },
  { name: "Noel León", team: "Campos Racing", nat: "México", dorsal: 12, age: 21, stats: { rtg: 64, exp: 62, rac: 65, awa: 63, pac: 68 }, pot: 75 },
  { name: "Oliver Goethe", team: "MP Motorsport", nat: "Alemania", dorsal: 6, age: 21, stats: { rtg: 68, exp: 66, rac: 70, awa: 67, pac: 76 }, pot: 88 },
  { name: "Gabriele Minì", team: "MP Motorsport", nat: "Italia", dorsal: 7, age: 21, stats: { rtg: 72, exp: 70, rac: 74, awa: 72, pac: 78 }, pot: 88 },
  { name: "Ritomo Miyata", team: "Hitech TGR", nat: "Japón", dorsal: 3, age: 27, stats: { rtg: 67, exp: 69, rac: 67, awa: 68, pac: 66 }, pot: 40 },
  { name: "Colton Herta", team: "Hitech TGR", nat: "Estados Unidos", dorsal: 26, age: 26, stats: { rtg: 70, exp: 72, rac: 69, awa: 71, pac: 68 }, pot: 60 },
  { name: "Sebastián Montoya", team: "Prema Racing", nat: "Colombia", dorsal: 9, age: 21, stats: { rtg: 71, exp: 69, rac: 72, awa: 70, pac: 76 }, pot: 90 },
  { name: "Mari Boya", team: "Prema Racing", nat: "España", dorsal: 22, age: 21, stats: { rtg: 68, exp: 66, rac: 69, awa: 67, pac: 72 }, pot: 85 },
  { name: "Dino Beganovic", team: "DAMS Lucas Oil", nat: "Suecia", dorsal: 10, age: 23, stats: { rtg: 68, exp: 67, rac: 69, awa: 69, pac: 74 }, pot: 80 },
  { name: "Roman Bilinski", team: "DAMS Lucas Oil", nat: "Polonia", dorsal: 28, age: 21, stats: { rtg: 64, exp: 62, rac: 65, awa: 63, pac: 66 }, pot: 70 },
  { name: "Kush Maini", team: "ART Grand Prix", nat: "India", dorsal: 16, age: 25, stats: { rtg: 71, exp: 72, rac: 70, awa: 71, pac: 69 }, pot: 60 },
  { name: "Tasanapol Inthraphuvasak", team: "ART Grand Prix", nat: "Tailandia", dorsal: 18, age: 20, stats: { rtg: 63, exp: 61, rac: 64, awa: 62, pac: 66 }, pot: 65 },
  { name: "Alex Dunne", team: "Rodin Motorsport", nat: "Irlanda", dorsal: 11, age: 20, stats: { rtg: 67, exp: 65, rac: 68, awa: 67, pac: 72 }, pot: 90 },
  { name: "Martinius Stenshorne", team: "Rodin Motorsport", nat: "Noruega", dorsal: 23, age: 20, stats: { rtg: 65, exp: 63, rac: 66, awa: 64, pac: 68 }, pot: 78 },
  { name: "Cian Shields", team: "AIX Racing", nat: "Inglaterra", dorsal: 19, age: 20, stats: { rtg: 60, exp: 61, rac: 59, awa: 60, pac: 61 }, pot: 40 },
  { name: "Emerson Fittipaldi Jr.", team: "AIX Racing", nat: "Estados Unidos", dorsal: 25, age: 19, stats: { rtg: 61, exp: 59, rac: 62, awa: 60, pac: 64 }, pot: 75 },
  { name: "Nicolás Varrone", team: "Van Amersfoort Racing", nat: "Argentina", dorsal: 24, age: 22, stats: { rtg: 63, exp: 64, rac: 62, awa: 63, pac: 65 }, pot: 55 },
  { name: "Rafael Villagómez", team: "Van Amersfoort Racing", nat: "México", dorsal: 22, age: 25, stats: { rtg: 64, exp: 66, rac: 63, awa: 64, pac: 65 }, pot: 35 },
  { name: "John Bennett", team: "Trident Motorsport", nat: "Inglaterra", dorsal: 20, age: 23, stats: { rtg: 62, exp: 63, rac: 61, awa: 62, pac: 63 }, pot: 45 },
  { name: "Laurens van Hoepen", team: "Trident Motorsport", nat: "Países Bajos", dorsal: 17, age: 20, stats: { rtg: 61, exp: 60, rac: 62, awa: 61, pac: 64 }, pot: 60 }
];

/* Nombres generados para la parrilla de F2 (los rivales de F2 se crean con stats aleatorias) */
const F2_FIRST = ["Luca", "Marco", "Alex", "Jonas", "Tomas", "Rafa", "Emil", "Kai", "Jules", "Diego", "Matteo", "Niko", "Sami", "Otto", "Bruno", "Dario", "Viktor", "Leon", "Ciro", "Enzo"];
const F2_LAST = ["Rossi", "Berg", "Novak", "Silva", "Ferrer", "Mendes", "Keller", "Tanaka", "Faure", "Vargas", "Bianchi", "Larsen", "Kowalski", "Reyes", "Moreau", "Zhao", "Lombardi", "Ostergaard", "Petrov", "Gomes"];

const DRIVING_STYLES = [
  { code: "CAL", nombre: "Especialista de Clasificación", icon: "🚀", img: "assets/icon/style-cal.png", statPrimaria: "POL", statSecundaria: "VIC", desc: "Suma entre 1 y 4 poles extra por temporada." },
  { code: "AGR", nombre: "Piloto Agresivo", icon: "⚔️", img: "assets/icon/style-agr.png", statPrimaria: "ADE", statSecundaria: "POL", desc: "Adelantamientos +40% por temporada." },
  { code: "GES", nombre: "Gestor de Carrera", icon: "🧊", img: "assets/icon/style-ges.png", statPrimaria: "POD", statSecundaria: "PTS", desc: "Regularidad: sus logros se miden en podios y puntos." },
  { code: "LLV", nombre: "Rey de la Lluvia", icon: "🌧️", img: "assets/icon/style-llv.png", statPrimaria: "VIC", statSecundaria: "VRA", desc: "Bonus de vueltas rápidas (+1 con 50% de probabilidad)." }
];

const GRANDS_PRIX = [
  "Mónaco", "Silverstone", "Monza", "Spa-Francorchamps", "Suzuka",
  "Interlagos", "Bahréin", "Singapur", "Las Vegas", "Austin",
  "Zandvoort", "Hungaroring", "Melbourne", "Jeddah", "Miami",
  "Imola", "Montreal", "Barcelona", "Bakú", "Abu Dhabi"
];

const SHOP_ITEMS = [
  { id: 'physio', icon: '💆', name: 'Fisioterapeuta Personal', desc: 'Restaura el estado físico al 100%', price: 150000, repeatable: true },
  { id: 'sim', icon: '🖥️', name: 'Simulador Profesional', desc: '+1 Valoración Global', price: 750000, repeatable: false, ratingBoost: 1 },
  { id: 'engineer', icon: '🧠', name: 'Ingeniero de Carrera Élite', desc: '+2 Valoración Global', price: 1500000, repeatable: false, ratingBoost: 2 },
  { id: 'academy', icon: '🏫', name: 'Academia de Pilotos', desc: '+1 Valoración Global', price: 900000, repeatable: false, ratingBoost: 1 },
  { id: 'extreme', icon: '🏋️', name: 'Entrenamiento Extremo', desc: '+4 Valoración Global, pero envejece 3 años', price: 3000000, repeatable: false, ratingBoost: 4, shortened: true, agePenalty: 3 },
  { id: 'reflex', icon: '⚡', name: 'Reflejos Biónicos', desc: '+6 Valoración Global, pero envejece 4 años', price: 5000000, repeatable: false, ratingBoost: 6, shortened: true, agePenalty: 4 }
];
