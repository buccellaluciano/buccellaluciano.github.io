# ⚽ BeALegend — Simulador de Carrera Futbolística

**BeALegend** es un juego web de simulación de una carrera futbolística como jugador profesional. Nacemos con 15 años, elegimos nacionalidad, posición y club de debut, y avanzamos temporada a temporada gestionando nuestra evolución, forma física, salario y títulos hasta convertirnos en leyenda del fútbol mundial (o retirarnos).

No usa frameworks ni requiere servidor: es HTML, CSS y JavaScript vanilla.

---

## 🚀 Cómo ejecutarlo

El proyecto es 100% estático. Es una de las apps del **portfolio-desktop** y se lanza desde el dock de la página principal:

1. Abrí el `index.html` de la **raíz** del repositorio (o el host de GitHub Pages).
2. Hacé clic en el ícono **⚽** del dock → se abre dentro del `<iframe>` del escritorio.
3. Tocalo de nuevo para volver al desktop, o presioná `Escape`.

También podés abrir directamente este `apps/legacy/index.html` en el navegador (`xdg-open`/`open`/doble clic) para verlo aislado. No hay build, dependencias ni instalación.

---

## 🎮 Cómo se juega

### 1. Pantalla de creación
- **Nombre** del jugador (se puede dejar al azar).
- **Nacionalidad**: se elige entre las disponibles en `data.js` (`NATIONALITIES`). Cada una tiene su bandera, liga, región y el rating de su selección nacional.
- **Posición**: se marca sobre un diagrama del campo (4-3-3). Según la posición elegida se asignan dos estadísticas principales (`PREFERRED`).
- Al crear, el jugador debuta automáticamente en un club aleatorio de su país.

### 2. Flujo principal
Una vez creado el jugador se muestra el **panel del jugador** (rating, edad, club, salario, balance, estadísticas totales) y la **tienda**. Con el botón **▶ Avanzar 1 temporada** (o **⏩ Avanzar 2 temporadas**) se simula una temporada completa:

1. Aumenta la edad y las temporadas jugadas.
2. Se recupera (o pierde) forma física.
3. Se calcula el rendimiento (`performance`) según la forma física.
4. Se evalúa la progresión de la media (con posible "explosión de potencial" 🔥).
5. Puede ocurrir una lesión 🚑.
6. Se simulan los partidos, posición en liga, títulos, estadísticas y premios individuales.
7. Se paga el salario y se recalcula el nuevo salario según media y edad.
8. Se comprueba si el jugador se retira.

### 3. Ofertas de fichaje
Al avanzar una temporada hay un 75% de probabilidad de recibir un lote de **3 ofertas** de otros clubes (si no hubo lesión). Cada oferta muestra el club, el salario propuesto y su presupuesto, con botones de **Aceptar** / **Rechazar**:

- **Aceptar**: fichás por ese club (cambian tu equipo, su rating y tu salario).
- **Rechazar**: descartás esa oferta y siguen disponibles las demás; si rechazás todas, seguís en tu club.
- El salario se calcula según el presupuesto del club oferente frente al tuyo: clubes con más presupuesto ofrecen más, y viceversa.

### 4. Tienda 🛒
Se abre como modal. Con el balance acumulado por salarios puedes comprar:

| Ítem | Precio | Efecto | Repetible |
|---|---|---|---|
| 💤 Descanso | $150.000 | Recupera la forma física al 100% | Sí |
| 👟 Botas nuevas | $750.000 | +1 al rating | No |
| 🎓 Mejor entrenador | $1.500.000 | +2 al rating | No |

### 5. Vitrina de trofeos 🏆
Un modal muestra todos los títulos conseguidos con sus iconos (liga, copa, internacionales, Mundial, premios individuales).

### 6. Resumen histórico
Cada temporada genera un resumen con rendimiento, progresión, títulos, estadísticas y eventos (lesiones, Mundial, ofertas). Las temporadas nuevas se renderizan con animación de máquina de escribir y auto-scroll.

### 7. Retiro
Un jugador se retira si:
- Tiene **40 años o más**, o
- Tiene **35+ años y media menor a 55**, o
- Su media baja de **28**.

Al retirarse se muestra el resumen final de su carrera.

### 8. Temas
- 🎨 **Color contextual**: al activarlo, la interfaz se tiñe con el color principal del club actual del jugador (recuperable desde `TEAMS_BY_COUNTRY`). Persiste en `localStorage`. La transición de colores es animada (0.6s).
- 🌙 **Tema claro/oscuro**: alterna entre tema por defecto y el tema oscuro verdoso.

---

## 🧠 Lógica interna del juego

Todo el motor vive en `js/state.js`. Los datos de configuración (equipos, nacionalidades, tienda, copas) viven en `js/data.js`.

### 📈 Progresión de la media (`simulateSeason`)

Cada temporada la media cambia según:

```
delta = modificadorDado + ageFactor + perfFactor × 1.33 [+ bonus extra]
```

- **Dado** (`modificadorDado`): depende de si el jugador "explotó" su potencial y de su edad:
  - Si `explotar === true` y edad ≤ 31: dado de 1–10 (≥8 → +3..+5, ≥4 → +1..+2, 1 → −1).
  - Si no: dado de 1–6 (≥5 → +1, ≤2 → −1).
- **Factor de edad** (`ageFactorFor`):

  | Edad | Factor |
  |---|---|
  | ≤ 21 | +2 |
  | 22–26 | +1 |
  | 27–29 | 0 |
  | 30–32 | −1 |
  | 33–35 | −2 |
  | ≥ 36 | −3 |

- **Factor de rendimiento**: `(performance − 30) / 50`.
- **Bonus**: si la media es < 85, hay un 15% de añadir entre +1 y +3.

La media se mantiene entre 25 y 99.

### 🔥 Explosión de potencial

Cada temporada hay una probabilidad de `0.02 + temporadasJugadas × 0.005` de que el jugador "explote" su potencial. A partir de ese momento su progresión es mucho más rápida (dado mejorado, ver arriba) mientras sea joven.

### 🚑 Lesiones y forma física

- Cada temporada hay un **9%** de sufrir lesión.
- La gravedad se elige entre **leve / moderada / grave**:
  - Impacto en progresión: `−severidad × (1–2)`, limitado a máx. −5.
  - Golpe a la forma física: `−severidad × (10–18)` (mín. 10%).
- Si hay lesión, **no llega oferta** esa temporada y el jugador empieza la siguiente con la forma reducida.
- Sin lesión, la forma se recupera `+5..+15` por temporada.

### 📊 Rendimiento (`performance`)

`performance = clamp(randInt(1,100) + fitnessMod, 1, 100)` con `fitnessMod = (fitness − 100)/6`. La forma física alta favorece buenas temporadas. Se etiqueta como *excelente 🌟*, *buena 👍*, *regular*, *floja ⚠️* o *muy floja 📉*.

### 🏟️ Partidos y posición en liga (`calcSeasonStats`)

- **Liga**: 30 partidos. La posición se calcula con `round(22 − teamRating/5.5 − performance/18 ± 3)`, limitada entre 1 y 20.
- **Copa nacional**: 1–6 partidos; se gana con probabilidad `titleChance(teamRating, player.rating, 0.05, 1.16)`.
- **Competición internacional** (solo si el equipo queda entre los 4 primeros → torneo élite, o 5º–7º → torneo secundario):
  - Élite (Champions o equivalente por región): `titleChance(..., 0.02, 1.2)`, 15 partidos si se gana (8–14 si no).
  - Secundaria (Europa League o equivalente): `titleChance(..., 0.03, 1.18)`, 10 partidos si se gana (6–9 si no).
- **Mundial 🌍**: cada 4 temporadas (`seasonsPlayed % 4 === 0`) si el rating del jugador ≥ rating de su selección. Ganar la Copa del Mundo usa `titleChance(ratingSelección, player.rating, 0.02, 1.2)` (+8 partidos).
- **Total de partidos**: `(liga + copa + internacionales + mundial) × (fitness/100)`, entre 3 y el máximo.

### 🏆 Probabilidad de ganar títulos (`titleChance`)

Es una función exponencial: a partir de una **media (equipo + jugador) / 2 de 75**, la probabilidad sube exponencialmente.

```
if (avg < 75) → base × 0.50
si no        → clamp(base × growth^(avg − 75), 0, 0.96)
```

- Copa nacional: `base=0.05, growth=1.16`.
- Internacional élite / Mundial: `base=0.02, growth=1.2`.
- Internacional secundaria: `base=0.03, growth=1.18`.

### 🥇 Premios individuales

- **Bota de Oro 🥇**: si el jugador marca > 30 goles en la temporada (y su posición genera goles), 33% de probabilidad.
- **Balón de Oro 🌕**: si la media ≥ 85, probabilidad `(rating − 84) × 0.06`.

### 📋 Estadísticas por posición (`calcularEstadisticas`)

Cada posición tiene una estadística **primaria** y una **secundaria** (definidas en `PREFERRED`):

| Posición | Primaria | Secundaria |
|---|---|---|
| Delantero | GOL | ASI |
| Interior | VIN | ASI |
| Extremo | ASI | VIN |
| Mediocentro | ATA | INT |
| Mediapunta | ASI | GOL |
| Defensa central | REC | INT |
| Lateral | ATA | REC |
| Portero | TAP | REC |

El valor de cada estadística se calcula como:

```
valor = límiteDinámico × factorRating × suerte × perfMult
```

- `factorRating = (rating/91)³` — crece mucho con la media.
- `factorPartidos = partidos/38` — escala con los partidos jugados.
- `límiteDinámico` depende de la estadística (p.ej. GOL: `45 × factorPartidos`, TAP: `110 × factorPartidos`).
- La secundaria vale el 40% del límite de la primaria.
- `suerte = 0.6 + rand(0..0.5) + rating/300`.
- `perfMult = clamp(performance/100, 0.5, 1.5)`.

### 💰 Salarios (`calcSalary`)

El salario base se calcula con la media y la edad, con un mínimo de **$15.000** y máximo de **$40.000.000**:

```
ratingFactor = (rating − 50) / 49        (entre 0 y 1)
ratingGrowth = 2^(10.8 × ratingFactor) − 1
salario      = 15000 × (1 + ratingGrowth × factorJuvenil)
```

Factor juvenil (`youthFactorFor`):

| Edad | Factor |
|---|---|
| ≤ 20 | 1.5 |
| 21–25 | 1.35 |
| 26–30 | 1.15 |
| 31–34 | 1.0 |
| ≥ 35 | 0.85 |

### 💰 Presupuesto por club (`budget`)

Cada club de `TEAMS_BY_COUNTRY` tiene un atributo **`budget`** individual (entre $15.000 y $40M) que determina cuánto puede pagar de salario. Reemplazó al antiguo "poder adquisitivo regional": ahora el dinero depende de **cada club**, no del país. `ALL_TEAMS` propaga el `budget` automáticamente, y el salario efectivo se calcula como `min(salarioBase, budget)`.

### 💎 Valor de mercado (`calcMarketValue`)

Usa la misma lógica exponencial que el salario, pero con rango **$10.000–$220.000.000** (exponente 13.84). Es **informativo**: se muestra en el panel del jugador como referencia y no afecta ofertas ni salarios.

### 🤝 Ofertas de fichaje (`generateOffer` / `generateOffers`)

- Un 75% de probabilidad al avanzar temporada (si no hubo lesión), se generan **3 ofertas distintas** a la vez.
- Candidatos: clubes cuyo `budget` cubre el salario del jugador (`budget >= calcSalary(rating, edad)`) y de nivel cercano (`player.rating >= club.rating − 15`). Si no hay candidatos, se cae a cualquier club (menos el actual).
- El salario de la oferta se calcula por la diferencia de **presupuesto** entre el club oferente y el del jugador: `worth × (1 + (budgetOferente − budgetActual) / budgetActual × 0.5)`, topeado al presupuesto del oferente.
- Podés **aceptar** una oferta (fichás por ese club) o **rechazar** las que quieras; si rechazás todas, seguís en tu club.

### 🛒 Tienda (`buyItem`)

- Bloquea la compra si no hay balance suficiente.
- Los ítems **no repetibles** (botas, entrenador) solo pueden comprarse una vez (`boughtItems`).
- `Descanso` fija la forma física en 100; `Botas`/`Entrenador` suman `ratingBoost` a la media (25–99).

### 🏆 Títulos y trofeos

Los títulos se registran con tipo (`league`, `cup`, `intl`, `sintl`, `worldcup`, `individual`) para su renderizado en la vitrina. Los nombres de ligas y copas salen de `data.js` (ej. una liga se llama según la nacionalidad del país del club; la copa nacional según `NATIONAL_CUPS`).

---

## 📁 Estructura del proyecto

```
bealegend/
├── index.html          # Estructura del DOM, modales y botones
├── README.md           # Este archivo
├── assets/
│   └── trophies/       # PNGs de trofeos (si falta uno, se usa un emoji de respaldo)
├── css/
│   └── main.css        # Tema (claro/oscuro verdoso), layout y animaciones
└── js/
    ├── data.js         # Datos de configuración (ver abajo)
    ├── state.js        # Motor del juego: creación, simulación, salarios, ofertas, tienda
    └── app.js          # UI: renderizado, botones, modales, temas, color contextual
```

---

## 🗄️ Datos de configuración (`js/data.js`)

- **`NATIONALITIES`**: nacionalidades jugables con bandera, liga, región y rating de selección.
- **`TEAMS_BY_COUNTRY`**: clubes por país (381 clubes) con `rating`, `color`, `budget` y opcionalmente `apiname`.
- **`ALL_TEAMS`**: lista plana de todos los clubes.
- **`FORMATION_433`**: layout de la alineación 4-3-3 usada en la pantalla de creación.
- **`PREFERRED`**: estadísticas primaria/secundaria por posición.
- **`NATIONAL_CUPS`**: nombre de la copa nacional por país (con icono).
- **`SHOP_ITEMS`**: ítems de la tienda (`price`, `ratingBoost`, `repeatable`).
- **`topRegionTrophies` / `secRegionTrophies`**: nombre del torneo internacional élite/secundario por región.

### Escala de ratings de clubes

Los clubes tienen ratings entre **65 y 99** (ej. Riestra 65, Boca 93, River 95, Flamengo/Real Madrid/Man City/Inter 99). Esto determina posiciones en liga, probabilidades de copa y atractivo de las ofertas.

### 🛡️ Escudos de clubes (híbrido con API)

Los escudos se cargan de forma dinámica desde **TheSportsDB** (gratis, sin API key, CORS habilitado) con cache en `localStorage` y fallback a un placeholder si no hay conexión o no se encuentra el club:

- Cada equipo puede tener un atributo **`apiname`** con el nombre exacto que usa la API (ej. si el nombre local no coincide con el de la db). Si falta, se usa el `nombre` normal.
- Solo se consultan los clubes que se muestran (tu equipo + las 3 ofertas + los de tu historial), y solo la primera vez; después se lee del cache.
- Si falla la red o no hay coincidencia, el escudo simplemente no se muestra (la interfaz sigue de pie gracias al fallback).
- Para depurar o forzar recarga de un escudo, borrá la clave `badge:<nombre>` del `localStorage`.

---

## 🧩 Cómo modificar el balance

- **Salarios**: ajusta `MIN_SALARY`, `MAX_SALARY`, `youthFactorFor` o el exponente `10.8` en `calcSalary`.
- **Valor de mercado**: ajusta `MIN_VALUE`, `MAX_VALUE` o el exponente `13.84` en `calcMarketValue`.
- **Títulos**: cambia las bases/crecimiento de `titleChance` en `calcSeasonStats`, o el umbral 75 en `titleChance`.
- **Progresión**: ajusta `ageFactorFor`, la probabilidad de explosión o los dados en `simulateSeason`.
- **Lesiones**: cambia el `0.09` de probabilidad o las penalizaciones.
- **Presupuestos de clubes**: edita el atributo `budget` de cada club en `TEAMS_BY_COUNTRY` (entre $15.000 y $40M).
- **Ofertas**: el coeficiente de sensibilidad al presupuesto es el `0.5` en `generateOffer`; la cantidad de ofertas es el argumento de `generateOffers` (por defecto 3).
- **Tienda**: agrega/edita ítems en `SHOP_ITEMS` de `data.js`.
