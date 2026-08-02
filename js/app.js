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

  function typeWriterHTML(element, htmlContent) {
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
    
    // --- Lógica de la flecha de rendimiento ---
    let arrowHTML = "";
    if (player.lastDelta > 0) {
      arrowHTML = '<span style="color: #10b981; font-size: 22px; text-shadow: 0 0 10px rgba(16,185,129,0.5);">▲</span>';
    } else if (player.lastDelta < 0) {
      arrowHTML = '<span style="color: #f43f5e; font-size: 22px; text-shadow: 0 0 10px rgba(244,63,94,0.5);">▼</span>';
    }
    el("rating-badge").innerHTML = `${player.rating} ${arrowHTML}`;
    // ----------------------------------------

    el("p-earnings").textContent = fmtMoney(player.balance);
    el("p-nationality").textContent = `${player.flag} ${player.nationality}`;
    el("p-position").textContent = `${player.positionName} (${player.position})`;
    el("p-team").textContent = `🛡️ ${player.team}`;
    el("p-age").textContent = `${player.age} años`;
    el("p-seasons").textContent = player.seasonsPlayed;
    
    // Estadísticas dinámicas del menú
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
  }

  function renderSummaries() {
    const sumEl = el("simplified-summaries");
    const newSeasons = player.seasons.filter(s => s.isNew);
    if (newSeasons.length === 0) return;

    for (const d of newSeasons) {
      const wrapper = document.createElement("div");
      wrapper.className = "season-wrapper";
      
      const row = document.createElement("div");
      row.className = "simple-season-row";
      row.style.cursor = "pointer";
      row.title = "Clic para ver los eventos de esta temporada";
      
      let wonHtml = d.wonTitles && d.wonTitles.length ? `<span style="font-size:11px; color:var(--offer-text); font-weight:700;">(🏆 ${d.wonTitles.join(', ')})</span>` : '';
      
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

      // Contenedor oculto con los eventos de esta temporada específica
      const eventsContainer = document.createElement("div");
      eventsContainer.className = "season-events hidden";
      
      d.events.forEach(ev => {
        const evDiv = document.createElement("div");
        evDiv.className = "log-entry " + ev.type;
        evDiv.innerHTML = `<span class="tag">${ev.tag}</span>${ev.text}`;
        eventsContainer.appendChild(evDiv);
      });

      // Al hacer clic en la fila, se muestran u ocultan sus eventos
      row.addEventListener("click", () => {
        eventsContainer.classList.toggle("hidden");
      });

      wrapper.appendChild(row);
      wrapper.appendChild(eventsContainer);
      sumEl.appendChild(wrapper);
      
      typeWriterHTML(row, contentHTML);
      d.isNew = false;
    }
    
    setTimeout(() => { sumEl.scrollTo({ top: sumEl.scrollHeight, behavior: 'smooth' }); }, 50);
  }

  function showRetireScreen(reason) {
    el("screen-game").classList.add("hidden");
    el("screen-retire").classList.remove("hidden");
    el("retire-reason").textContent = reason + ".";
    
    const s1Info = STAT_LABELS[player.stat1Code];
    const s2Info = STAT_LABELS[player.stat2Code];
    
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
    `;
  }

  function handleAdvance() {
    el("btn-advance").disabled = true;
    const { injuryHappened, performance } = simulateSeason();
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
      
      el("action-bar").classList.add("hidden");
      el("offer-panel").classList.remove("hidden");
    } else {
      el("btn-advance").disabled = false;
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
  }

  function handleReject() {
    el("offer-panel").classList.add("hidden");
    el("action-bar").classList.remove("hidden");
    rejectOffer();
    renderSummaries();
    el("btn-advance").disabled = false;
  }

  function resetToCreate() {
    // Al recargar la página completamente, todos los scripts se vuelven a cargar
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
    // Guardar preferencia para que persista al recargar la página
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });

  // Restaurar el tema si la página fue recargada
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

  el("btn-advance").addEventListener("click", handleAdvance);
  el("btn-retire-early").addEventListener("click", handleRetireEarly);
  el("btn-accept").addEventListener("click", handleAccept);
  el("btn-reject").addEventListener("click", handleReject);
  el("btn-restart").addEventListener("click", resetToCreate);

  populateNationalities();
  buildPitch();
})();