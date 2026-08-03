// js/app.js
(function () {
  const el = id => document.getElementById(id);
  let selectedPosition = null;

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
      const isDisabled = (!canAfford || isMaxFitness);
      
      div.innerHTML = `
        <div class="shop-item-header">
          <span>${item.icon} ${item.name}</span>
          <span style="color: ${canAfford ? 'var(--text-main)' : '#ff3b30'}">${fmtMoney(item.price)}</span>
        </div>
        <div class="shop-item-desc">${item.desc}</div>
        <button class="shop-btn" data-id="${item.id}" ${isDisabled ? 'disabled' : ''}>Comprar</button>
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

    el("p-earnings").textContent = fmtMoney(player.balance);
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
    
    if (el("row-balon")) {
      el("row-balon").classList.toggle("hidden", player.ballonsDor === 0);
      el("p-balon").textContent = player.ballonsDor;
    }
    if (el("row-bota")) {
      el("row-bota").classList.toggle("hidden", player.goldenBoots === 0);
      el("p-bota").textContent = player.goldenBoots;
    }
  }

  function renderSummaries() {
    const sumEl = el("simplified-summaries");
    const newSeasons = player.seasons.filter(s => s.isNew);
    if (newSeasons.length === 0) return;

    let pending = newSeasons.length;
    const scrollToBottom = () => {
      sumEl.scrollTo({ top: sumEl.scrollHeight, behavior: 'smooth' });
    };

    for (const d of newSeasons) {
      const wrapper = document.createElement("div");
      wrapper.className = "season-wrapper";
      
      const row = document.createElement("div");
      row.className = "simple-season-row";
      row.style.cursor = "pointer";
      row.title = "Clic para ver los eventos de esta temporada";
      
      let wonHtml = d.wonTitles && d.wonTitles.length ? `<span style="font-size:11px; color:var(--offer-text); font-weight:700;">(🏆 ${d.wonTitles.map(t => t.name).join(', ')})</span>` : '';
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

    if (!injuryHappened && Math.random() < 0.30) {
      const offer = generateOffer(performance);
      el("offer-team").textContent = offer.club.nombre;
      el("offer-salary").textContent = fmtMoney(offer.salary);

      const power = getRegionPower(offer.club.nombre);
      let powerLabel = "Bajo";
      if (power >= 1.8) powerLabel = "Muy Alto";
      else if (power >= 1.2) powerLabel = "Alto";
      else if (power >= 0.8) powerLabel = "Medio";
      el("offer-power").innerHTML = `💪 Poder adquisitivo del club: <strong>${powerLabel}</strong> (x${power.toFixed(2)})`;
      
      el("action-bar").classList.add("hidden");
      el("offer-panel").classList.remove("hidden");
    } else {
      el("btn-advance").disabled = false;
      el("btn-advance-2").disabled = false;
    }
  }
  
  function handleRetireEarly() {
    player.retired = true;
    renderPlayer();
    showRetireScreen("Decidiste retirarte anticipadamente por voluntad propia");
  }

  function handleAccept() {
    el("offer-panel").classList.add("hidden");
    el("action-bar").classList.remove("hidden");
    acceptOffer();
    renderSummaries();
    renderPlayer();
    el("btn-advance").disabled = false;
    el("btn-advance-2").disabled = false;
  }

  function handleReject() {
    el("offer-panel").classList.add("hidden");
    el("action-bar").classList.remove("hidden");
    rejectOffer();
    renderSummaries();
    el("btn-advance").disabled = false;
    el("btn-advance-2").disabled = false;
  }

  function resetToCreate() {
    location.reload();
  }

  el("shop-items").addEventListener("click", (e) => {
    if (e.target.classList.contains("shop-btn")) {
      const id = e.target.getAttribute("data-id");
      if (buyItem(id)) {
        renderPlayer();
        renderShop();
        renderSummaries();
      }
    }
  });

  el("btn-theme").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    el("btn-theme").textContent = isDark ? "☀️ Tema Claro" : "🌙 Tema Oscuro";
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });

  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    el("btn-theme").textContent = "☀️ Tema Claro";
  }

  el("btn-create").addEventListener("click", () => {
    if (!selectedPosition) return;
    
    const name = el("input-name").value.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;") || "Jugador Anónimo";
    const natIndex = el("input-nationality").value;
    const nationalityData = NATIONALITIES[natIndex];
    
    player = createPlayer(name, nationalityData, selectedPosition.code, selectedPosition.nombre);

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

  el("btn-advance").addEventListener("click", () => handleAdvance(1));
  el("btn-advance-2").addEventListener("click", () => handleAdvance(2));
  el("btn-retire-early").addEventListener("click", handleRetireEarly);
  el("btn-accept").addEventListener("click", handleAccept);
  el("btn-reject").addEventListener("click", handleReject);
  el("btn-restart").addEventListener("click", resetToCreate);

  populateNationalities();
  buildPitch();
})();