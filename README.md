# 🖥️ Portfolio — Desktop

Portafolio presentado como un **desktop de Ubuntu**: fondo tipo wallpaper + reloj central y un dock de tareas con las apps.

Es 100% estático (CSS/JS vanilla), pensado para GitHub Pages, sin build ni recarga de página entre apps.

---

## 🚀 Arquitectura (nuevo approach)

**Shell con iframes.** `index.html` es un único "escritorio" que emula el sistema operativo, y cada aplicación del portafolio se carga **dentro de su propio `<iframe>`** a pantalla completa. El shell nunca recarga: solo cambia el contenido del frame al abrir/cerrar una app.

```
┌─────────────────────────────────────────────┐
│  wallpaper + reloj central      (z:5)       │
│  ┌───────────────────────────────────────┐  │
│  │  app activa (#appFrame — iframe)      │  │
│  │                           (z:40)      │  │
│  └───────────────────────────────────────┘  │
│             dock (z:100)                     │
│             flecha (z:110)                   │
│  modales (z:200) · toast (z:300)            │
└─────────────────────────────────────────────┘
```

### El Desktop

- **Fondo (wallpaper)**: gradiente CSS con los tonos de Ubuntu (morados profundos + destello naranja), sin imágenes.
- **Reloj central**: hora (HH:MM) y fecha en `es-AR`, estilo *lockscreen* de GNOME; se actualiza solo con `setInterval` (sin frameworks).
- **Dock (taskbar Ubuntu)**: se **oculta** deslizándose hacia abajo y una **flecha** lo sube/baja. Contiene:
  - 3 botones de **apps** (`data-app`), ya sea reales o placeholders ("Próximamente").
  - 1 botón **Proyectos** (`data-panel="proyectos"`) → modal de información.
  - 1 botón **Contacto** (`data-panel="contacto"`) → modal de información.
- **Interacción del dock**: tocar la app activa la cierra y vuelve al escritorio; `Escape` también la cierra.

---

## 📁 Estructura

```
.
├── index.html        # Shell del escritorio: wallpaper, reloj, dock, iframe
├── README.md         # Este archivo
├── .gitignore
├── css/
│   └── main.css      # Estilos del desktop
└── js/
    └── main.js       # Dock, modales, iframe, reloj
└── apps/
    └── legacy/       # Aplicación: BeALegend (simulador de fútbol)
        ├── index.html
        ├── css/ js/ assets/
        └── README.md
```

## ➕ Cómo agregar una app nueva

1. Creá la carpeta `apps/<nombre>/` con su `index.html` (puede traer sus propios `css/ js/ assets/`).
2. Registrala en `js/main.js`:
   ```js
   var APP_URLS = { legacy: "apps/legacy/index.html", tuapp: "apps/<nombre>/index.html" };
   ```
3. Agregá su botón al dock con `data-app="tuapp"`, siguiendo el patrón `.dock-item` (con su `dock-dot`). Los botones con app corren en el iframe; los placeholders usan `.dock-placeholder`.

---

## ▶️ Ejecutar en local

Es estático y sin dependencias. Se recomienda servirlo (YouTube y el iframe funcionan mejor servido que en `file://`):

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```