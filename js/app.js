// js/app.js
(function () {
  const el = id => document.getElementById(id);
  let selectedPosition = null;

  let contextualOn = localStorage.getItem("contextual") === "on";

  function shadeHex(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent);
    r = Math.round((t - r) * p + r);
    g = Math.round((t - g) * p + g);
    b = Math.round((t - b) * p + b);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function hexToRgba(hex, a) {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function ensureReadable(hex) {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (lum <= 0.55) return hex;
    const f = 0.5 / lum;
    const nr = Math.round(r * f), ng = Math.round(g * f), nb = Math.round(b * f);
    return "#" + ((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1);
  }

  function mixBlack(hex, t) {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.round(((num >> 16) & 255) * (1 - t));
    const g = Math.round(((num >> 8) & 255) * (1 - t));
    const b = Math.round((num & 255) * (1 - t));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  const CONTEXTUAL_VARS = ['--primary-color', '--primary-hover', '--primary-ring', '--badge-color', '--offer-bg', '--offer-border', '--offer-text', '--bg-color', '--app-bg', '--panel-bg', '--panel-border', '--input-bg', '--blob-1', '--blob-2'];

  function resetContextualColor() {
    const root = document.documentElement.style;
    CONTEXTUAL_VARS.forEach(v => root.removeProperty(v));
  }

  function applyContextualColor() {
    const root = document.documentElement.style;
    if (!contextualOn || !player) return;
    const team = ALL_TEAMS.find(t => t.nombre === player.team);
    const raw = team && team.color ? team.color : null;
    if (!raw) return;
    const color = ensureReadable(raw);
    root.setProperty('--primary-color', color);
    root.setProperty('--primary-hover', shadeHex(color, 0.2));
    root.setProperty('--primary-ring', hexToRgba(color, 0.3));
    root.setProperty('--badge-color', color);
    root.setProperty('--offer-bg', hexToRgba(color, 0.14));
    root.setProperty('--offer-border', hexToRgba(color, 0.4));
    root.setProperty('--offer-text', shadeHex(color, 0.55));
    root.setProperty('--bg-color', mixBlack(color, 0.88));
    root.setProperty('--app-bg', `linear-gradient(160deg, ${mixBlack(color, 0.95)} 0%, ${mixBlack(color, 0.90)} 45%, ${mixBlack(color, 0.85)} 100%)`);
    root.setProperty('--panel-bg', hexToRgba(mixBlack(color, 0.85), 0.45));
    root.setProperty('--panel-border', hexToRgba(color, 0.18));
    root.setProperty('--input-bg', hexToRgba(mixBlack(color, 0.82), 0.35));
    root.setProperty('--blob-1', `radial-gradient(circle, ${shadeHex(color, 0.35)} 0%, transparent 70%)`);
    root.setProperty('--blob-2', `radial-gradient(circle, ${hexToRgba(color, 0.55)} 0%, transparent 70%)`);
  }

  const STAT_LABELS = {
    "GOL": { name: "Goles", icon: "⚽" },
    "ASI": { name: "Asistencias", icon: "👟" },
    "VIN": { name: "Vallas Invictas", icon: "🧤" },
    "ATA": { name: "Atajadas", icon: "✋" },
    "ENT": { name: "Entradas", icon: "🛑" },
    "REC": { name: "Recuperaciones", icon: "🔄" },
    "INT": { name: "Intercepciones", icon: "👁️" },
    "TAP": { name: "Tiros a Puerta", icon: "🎯" }
  };

  function populateNationalities() {
    const sel = el("input-nationality");
    NATIONALITIES.forEach((n, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = `${n.flag} ${n.name}`;
      sel.appendChild(opt);
    });
  }

  function buildPitch() {
    const pitch = el("pitch");
    FORMATION_433.forEach((pos, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pos-btn";
      btn.style.top = pos.top + "%";
      btn.style.left = pos.left + "%";
      btn.textContent = pos.code;
      btn.dataset.idx = idx;
      btn.addEventListener("click", () => selectPosition(idx, btn));
      pitch.appendChild(btn);
    });
  }

  function selectPosition(idx, btn) {
    document.querySelectorAll(".pos-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    const pos = FORMATION_433[idx];
    selectedPosition = { code: pos.code, nombre: pos.nombre };
    el("selected-position-label").textContent = `✔️ Seleccionado: ${pos.nombre}`;
    el("btn-create").disabled = false;
  }

  function typeWriterHTML(element, htmlContent, onDone) {
    element.innerHTML = "";
    let i = 0;
    let textBuffer = "";
    const htmlArray = Array.from(htmlContent);
    
    function type() {
      let charsProcessed = 0;
      while (i < htmlArray.length && charsProcessed < 3) {
        textBuffer += htmlArray[i];
        if (htmlArray[i] === '<') {
          while (i < htmlArray.length && htmlArray[i] !== '>') {
            i++;
            textBuffer += htmlArray[i];
          }
        }
        i++;
        charsProcessed++;
      }
      element.innerHTML = textBuffer;
      if (i < htmlArray.length) {
        requestAnimationFrame(type);
      } else if (onDone) {
        onDone();
      }
    }
    requestAnimationFrame(type);
  }

  function renderShop() {
    const container = el("shop-items");
    container.innerHTML = "";
    SHOP_ITEMS.forEach(item => {
      const div = document.createElement("div");
      div.className = "shop-item";
      
      const canAfford = player.balance >= item.price;
      const isMaxFitness = (item.id === 'rest' && player.fitness >= 100);
      const isBought = player.boughtItems.includes(item.id);
      const isDisabled = (!canAfford || isMaxFitness || isBought);
      
      div.innerHTML = `
        <div class="shop-item-header">
          <span>${item.icon} ${item.name}</span>
          <span style="color: ${canAfford && !isBought ? 'var(--text-main)' : '#ff3b30'}">${fmtMoney(item.price)}</span>
        </div>
        <div class="shop-item-desc">${item.desc}</div>
        <button class="shop-btn" data-id="${item.id}" ${isDisabled ? 'disabled' : ''}>${isBought ? '✅ Comprado' : 'Comprar'}</button>
      `;
      
      container.appendChild(div);
    });
  }

  function renderPlayer() {
    el("p-name").textContent = player.name;
    
    let arrowHTML = "";
    if (player.lastDelta > 0) {
      arrowHTML = '<span style="color: #10b981; font-size: 22px; text-shadow: 0 0 10px rgba(16,185,129,0.5);">▲</span>';
    } else if (player.lastDelta < 0) {
      arrowHTML = '<span style="color: #f43f5e; font-size: 22px; text-shadow: 0 0 10px rgba(244,63,94,0.5);">▼</span>';
    }
    el("rating-badge").innerHTML = `${player.rating} ${arrowHTML}`;
    el("p-dorsal").textContent = player.dorsal != null ? `#${player.dorsal}` : "-";

    el("p-earnings").textContent = fmtMoney(player.balance);
    el("p-value").textContent = fmtMoney(calcMarketValue(player.rating, player.age));
    el("p-nationality").textContent = `${player.flag} ${player.nationality}`;
    el("p-position").textContent = `${player.positionName} (${player.position})`;
    el("p-team").textContent = `🛡️ ${player.team}`;
    el("p-age").textContent = `${player.age} años`;
    el("p-seasons").textContent = player.seasonsPlayed;
    
    el("p-matches").textContent = player.totalMatches;
    
    const s1Info = STAT_LABELS[player.stat1Code];
    const s2Info = STAT_LABELS[player.stat2Code];

    el("lbl-stat1").textContent = `${s1Info.icon} ${s1Info.name} (Total)`;
    el("p-stat1").textContent = player.totalStat1;

    el("lbl-stat2").textContent = `${s2Info.icon} ${s2Info.name} (Total)`;
    el("p-stat2").textContent = player.totalStat2;

    el("p-salary").textContent = fmtMoney(player.salary) + " / temp.";
    el("p-fitness").textContent = player.fitness + "%";
    el("injury-tag").classList.toggle("hidden", !player.injured);
    el("distinto-tag").classList.toggle("hidden", !player.explotar);
    el("convocado-tag").classList.toggle("hidden", !player.convocado);
    el("btn-chest").classList.toggle("hidden", !player.chestPending); 
    
    if (el("row-balon")) {
      el("row-balon").classList.toggle("hidden", player.ballonsDor === 0);
      el("p-balon").textContent = player.ballonsDor;
    }
    if (el("row-bota")) {
      el("row-bota").classList.toggle("hidden", player.goldenBoots === 0);
      el("p-bota").textContent = player.goldenBoots;
    }

    applyContextualColor();
  }

  function renderSummaries() {
    const sumEl = el("simplified-summaries");
    const newSeasons = player.seasons.filter(s => s.isNew);
    if (newSeasons.length === 0) return;

    let pending = newSeasons.length;
    const scrollToBottom = () => {
      sumEl.scrollTo({ top: sumEl.scrollHeight, behavior: 'smooth' });
      if (window.innerWidth <= 900) {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
    };

    for (const d of newSeasons) {
      const wrapper = document.createElement("div");
      wrapper.className = "season-wrapper";
      
      const row = document.createElement("div");
      row.className = "simple-season-row";
      row.style.cursor = "pointer";
      row.title = "Clic para ver los eventos de esta temporada";
      
      let wonHtml = d.wonTitles && d.wonTitles.length ? `<span class="season-won-trophies" title="${d.wonTitles.map(t => t.name).join(', ')}"> ${d.wonTitles.map(t => trophyIconHTML(t.name, t.type)).join(' ')}</span>` : '';
      const s1Info = STAT_LABELS[player.stat1Code];
      const s2Info = STAT_LABELS[player.stat2Code];

      const contentHTML = `
        <div class="simple-season-info">
          <span>T${d.season} · Edad ${d.age}</span>
          <span class="simple-season-team">🛡️ ${d.team}</span>
          <span style="font-size: 11px; color: var(--text-muted);">Pos en Liga: ${d.leaguePos}° | ${d.qualification}</span>
        </div>
        <div class="simple-season-stats">
          <span title="Partidos Jugados">P: ${d.matches}</span>
          <span title="${s1Info.name}">${player.stat1Code}: ${d.val1}</span>
          <span title="${s2Info.name}">${player.stat2Code}: ${d.val2}</span>
          <span title="Títulos">🏆 ${d.titles}</span>
          ${wonHtml}
        </div>
      `;

      const eventsContainer = document.createElement("div");
      eventsContainer.className = "season-events hidden";
      
      d.events.forEach(ev => {
        const evDiv = document.createElement("div");
        evDiv.className = "log-entry " + ev.type;
        evDiv.innerHTML = `<span class="tag">${ev.tag}</span>${ev.text}`;
        eventsContainer.appendChild(evDiv);
      });

      row.addEventListener("click", () => {
        eventsContainer.classList.toggle("hidden");
      });

      wrapper.appendChild(row);
      wrapper.appendChild(eventsContainer);
      sumEl.appendChild(wrapper);
      
      typeWriterHTML(row, contentHTML, () => {
        if (--pending === 0) {
          scrollToBottom();
          requestAnimationFrame(scrollToBottom);
        }
      });
      d.isNew = false;
    }
  }

  function renderLastSeasonEvents() {
    const wrappers = document.querySelectorAll("#simplified-summaries .season-wrapper");
    const lastSeason = player.seasons[player.seasons.length - 1];
    if (!lastSeason || wrappers.length === 0) return;
    const eventsContainer = wrappers[wrappers.length - 1].querySelector(".season-events");
    if (!eventsContainer) return;
    eventsContainer.innerHTML = "";
    lastSeason.events.forEach(ev => {
      const evDiv = document.createElement("div");
      evDiv.className = "log-entry " + ev.type;
      evDiv.innerHTML = `<span class="tag">${ev.tag}</span>${ev.text}`;
      eventsContainer.appendChild(evDiv);
    });
  }

  function showRetireScreen(reason) {
    el("screen-game").classList.add("hidden");
    el("screen-retire").classList.remove("hidden");
    el("retire-reason").textContent = reason + ".";
    
    const s1Info = STAT_LABELS[player.stat1Code];
    const s2Info = STAT_LABELS[player.stat2Code];
    
    let extraStats = "";
    if (player.ballonsDor > 0) {
      extraStats += `<div class="stat-row"><span>🌕 Balones de Oro</span><span>${player.ballonsDor}</span></div>`;
    }
    if (player.goldenBoots > 0) {
      extraStats += `<div class="stat-row"><span>🥇 Botas de Oro</span><span>${player.goldenBoots}</span></div>`;
    }

    el("retire-summary").innerHTML = `
      <div class="stat-row"><span>Nombre</span><span>${player.name}</span></div>
      <div class="stat-row"><span>Nacionalidad</span><span>${player.flag} ${player.nationality}</span></div>
      <div class="stat-row"><span>Posición</span><span>${player.positionName}</span></div>
      <div class="stat-row"><span>Último equipo</span><span>🛡️ ${player.team}</span></div>
      <div class="stat-row"><span>Edad de retiro</span><span>${player.age} años</span></div>
      <div class="stat-row"><span>Temporadas jugadas</span><span>${player.seasonsPlayed}</span></div>
      <div class="stat-row"><span>Valoración final</span><span>⭐ ${player.rating}</span></div>
      <div class="stat-row"><span>Total Partidos</span><span>${player.totalMatches}</span></div>
      <div class="stat-row"><span>Total ${s1Info.name}</span><span>${player.totalStat1}</span></div>
      <div class="stat-row"><span>Total ${s2Info.name}</span><span>${player.totalStat2}</span></div>
      ${extraStats}
    `;
  }

  function handleAdvance(times = 1) {
    el("btn-advance").disabled = true;
    el("btn-advance-2").disabled = true;
    const { injuryHappened, performance } = simulateSeason(times);
    renderSummaries();

    if (player.retired) {
      renderPlayer();
      showRetireScreen("El jugador ha decidido retirarse debido a su edad o bajo rendimiento");
      return;
    }
    
    renderPlayer();
    renderShop(); 

    if (!injuryHappened && Math.random() < 0.75) {
      generateOffers(3);
      renderOffers();
      el("action-bar").classList.add("hidden");
      el("offer-panel").classList.remove("hidden");
    } else {
      el("btn-advance").disabled = false;
      el("btn-advance-2").disabled = false;
    }
  }

  function renderOffers() {
    const list = el("offer-list");
    list.innerHTML = "";
    currentOffers.forEach((offer, i) => {
      const row = document.createElement("div");
      row.className = "offer-item";
      const budgetTxt = fmtMoney(offer.budget != null ? offer.budget : offer.salary);
      row.innerHTML = `
        <div class="offer-item-body">
          <div class="offer-item-club">🛡️ ${offer.club.nombre}</div>
          <div class="offer-item-salary">💰 <strong>${fmtMoney(offer.salary)}</strong> / temporada</div>
          <div class="offer-power">Presupuesto del club: ${budgetTxt}</div>
        </div>
        <div class="offer-actions">
          <button class="btn-danger offer-reject" data-index="${i}">❌ Rechazar</button>
          <button class="btn-success offer-accept" data-index="${i}">✅ Aceptar</button>
        </div>`;
      list.appendChild(row);
    });
  }
  
  function handleRetireEarly() {
    player.retired = true;
    renderPlayer();
    showRetireScreen("Decidiste retirarte anticipadamente por voluntad propia");
  }

  function handleAccept(index) {
    acceptOffer(index);
    el("offer-panel").classList.add("hidden");
    el("action-bar").classList.remove("hidden");
    renderPlayer();
    renderLastSeasonEvents();
    el("btn-advance").disabled = false;
    el("btn-advance-2").disabled = false;
  }

  function handleReject(index) {
    const remaining = rejectOffer(index);
    renderLastSeasonEvents();
    if (remaining.length > 0) {
      renderOffers();
    } else {
      el("offer-panel").classList.add("hidden");
      el("action-bar").classList.remove("hidden");
      el("btn-advance").disabled = false;
      el("btn-advance-2").disabled = false;
    }
  }

  function resetToCreate() {
    location.reload();
  }

  el("shop-items").addEventListener("click", (e) => {
    if (e.target.classList.contains("shop-btn")) {
      const id = e.target.getAttribute("data-id");
      if (buyItem(id)) {
        if (player.retired) {
          el("modal-shop").classList.add("hidden");
          renderPlayer();
          showRetireScreen("El desgaste físico acumulado por los potenciadores extremos forzó tu retiro");
          return;
        }
        renderPlayer();
        renderShop();
        renderSummaries();
      }
    }
  });

  el("btn-contextual").addEventListener("click", () => {
    contextualOn = !contextualOn;
    localStorage.setItem("contextual", contextualOn ? "on" : "off");
    el("btn-contextual").textContent = contextualOn ? "🎨 Color Contextual: ON" : "🎨 Color Contextual: OFF";
    if (contextualOn) applyContextualColor();
    else resetContextualColor();
  });

  if (contextualOn) el("btn-contextual").textContent = "🎨 Color Contextual: ON";

  el("input-dorsal").addEventListener("input", () => {
    el("input-dorsal").value = el("input-dorsal").value.replace(/\D/g, "").slice(0, 2);
  });

  el("btn-create").addEventListener("click", () => {
    if (!selectedPosition) return;
    
    const name = el("input-name").value.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;") || "Jugador Anónimo";
    const natIndex = el("input-nationality").value;
    const nationalityData = NATIONALITIES[natIndex];
    const careerType = document.querySelector('input[name="career-type"]:checked').value;
    const dorsalRaw = el("input-dorsal").value.trim();
    let dorsal = parseInt(dorsalRaw, 10);
    if (!(dorsal >= 1 && dorsal <= 99)) dorsal = Math.floor(Math.random() * 99) + 1;
    
    player = createPlayer(name, nationalityData, selectedPosition.code, selectedPosition.nombre, careerType, dorsal);

    el("screen-create").classList.add("hidden");
    el("screen-game").classList.remove("hidden");
    addHistory("season", "🚀 Debut", `${player.name} hace su debut profesional con <strong>${player.team}</strong> a los ${player.age} años.`);
    
    renderSummaries();
    renderPlayer();
    renderShop();
  });

// --- LÓGICA DE LA VITRINA ---
  function trophyIconHTML(name, type) {
    switch (type) {
      case "league": {
        const leagueEntry = NATIONALITIES.find(n => n.liga === name);
        return leagueEntry
          ? leagueEntry.icon
          : "<img src='assets/LigaLocal.png' class='trophy-img'>";
      }
      case "cup": {
        const cupEntry = NATIONAL_CUPS.find(c => c.name === name);
        return cupEntry
          ? `<img src='${cupEntry.icon}' class='trophy-img'>`
          : `<div class="trophy-icon">🏺</div>`;
      }
      case "intl": {
        const intlEntry = topRegionTrophies.find(n => n.name === name);
        return intlEntry
          ? `<img src='${intlEntry.icon}' class='trophy-img'>`
          : `<div class="trophy-icon">🌍</div>`;
      }
      case "sintl": {
        const sintlEntry = secRegionTrophies.find(n => n.name === name);
        return sintlEntry
          ? `<img src='${sintlEntry.icon}' class='trophy-img'>`
          : `<div class="trophy-icon">🥈</div>`;
      }
      case "worldcup":
        return `<div class="trophy-icon"><img src='assets/trophies/worldcup.png' class='trophy-img'></div>`;
      case "contcup":
        const contEntry = continentalTrophies.find(n => n.name === name);
        return contEntry
          ? `<img src='${contEntry.icon}' class='trophy-img'>`
          : `<div class="trophy-icon">🌎</div>`;
      default:
        if (name === "Balón de Oro") return `<div class="trophy-icon"><img src='assets/trophies/ballondor.png' class='trophy-img'></div>`;
        if (name === "Bota de Oro") return `<div class="trophy-icon"><img src='assets/trophies/goldenboot.png' class='trophy-img'></div>`;
        return `<div class="trophy-icon">🏆</div>`;
    }
  }

  function renderVitrina() {
    const shelf = el("vitrina-shelf");
    shelf.innerHTML = "";

    const trophies = {};
    const trophyTypeMap = {};

    player.seasons.forEach(s => {
      if (!s.wonTitles) return;
      s.wonTitles.forEach(({ name, type }) => {
        trophies[name] = (trophies[name] || 0) + 1;
        if (!trophyTypeMap[name]) trophyTypeMap[name] = type;
      });
    });

    if (player.ballonsDor > 0) {
      trophies["Balón de Oro"] = player.ballonsDor;
      trophyTypeMap["Balón de Oro"] = "individual";
    }
    if (player.goldenBoots > 0) {
      trophies["Bota de Oro"] = player.goldenBoots;
      trophyTypeMap["Bota de Oro"] = "individual";
    }

    if (Object.keys(trophies).length === 0) {
      shelf.innerHTML = `<p style="color: var(--text-muted); font-size: 14px; width: 100%; text-align: center; align-self: center; margin-bottom: 20px;">La vitrina está vacía.</p>`;
      return;
    }

    for (const [name, count] of Object.entries(trophies)) {
      const type = trophyTypeMap[name] || "other";
      const div = document.createElement("div");
      div.className = "trophy-item";
      div.innerHTML = `
        ${trophyIconHTML(name, type)}
        <div class="trophy-label">${name}</div>
        <div class="trophy-count">x${count}</div>
      `;
      shelf.appendChild(div);
    }
  }

  // --- EVENTOS DE LA VITRINA ---
  el("btn-vitrina").addEventListener("click", () => {
    renderVitrina();
    el("modal-vitrina").classList.remove("hidden");
  });

  el("btn-close-vitrina").addEventListener("click", () => {
    el("modal-vitrina").classList.add("hidden");
  });

  // --- EVENTOS DE LA TIENDA (ventana modal) ---
  el("btn-open-shop").addEventListener("click", () => {
    renderShop();
    el("modal-shop").classList.remove("hidden");
  });

  el("btn-close-shop").addEventListener("click", () => {
    el("modal-shop").classList.add("hidden");
  });

  // --- EVENTOS DE INSTRUCCIONES (ventana modal) ---
  el("btn-instructions").addEventListener("click", () => {
    el("modal-instructions").classList.remove("hidden");
  });

  el("btn-close-instructions").addEventListener("click", () => {
    el("modal-instructions").classList.add("hidden");
  });

  el("btn-advance").addEventListener("click", () => handleAdvance(1));
  el("btn-advance-2").addEventListener("click", () => handleAdvance(2));
  el("btn-retire-early").addEventListener("click", handleRetireEarly);
  el("btn-restart").addEventListener("click", resetToCreate);

  el("offer-list").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-index]");
    if (!btn) return;
    const index = parseInt(btn.getAttribute("data-index"), 10);
    if (btn.classList.contains("offer-accept")) handleAccept(index);
    else if (btn.classList.contains("offer-reject")) handleReject(index);
  });

  el("btn-chest").addEventListener("click", () => {
    el("modal-chest").classList.remove("hidden");
  });

  el("btn-chest-open").addEventListener("click", () => {
    el("modal-chest").classList.add("hidden");
    el("btn-chest").classList.add("hidden");
    player.chestPending = false;
    if (Math.random() < 0.5) {
      player.retired = true;
      renderPlayer();
      showRetireScreen("Un cofre misterioso decidió que tu carrera termina aquí");
    } else {
      player.balance += 20000000;
      renderPlayer();
      renderShop();
      renderLastSeasonEvents();
    }
  });

  el("btn-close-chest").addEventListener("click", () => {
    el("modal-chest").classList.add("hidden");
  });

  el("btn-chest-leave").addEventListener("click", () => {
    el("modal-chest").classList.add("hidden");
  });

  populateNationalities();
  buildPitch();
})();