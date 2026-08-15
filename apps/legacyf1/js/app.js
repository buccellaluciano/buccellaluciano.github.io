
(function () {
  const el = id => document.getElementById(id);

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  let selectedStyle = null;
  let forcedOffers = false;
  let promotionOffers = false;
  let retireReason = "";
  let simMode = "season"; // race | mid | season
  let gpCardOn = localStorage.getItem("gpcard") !== "off";
  let resultCardOn = localStorage.getItem("resultcard") !== "off";
  let betweenSeasons = false; // entre temporadas: ofertas + evaluación, botón "Siguiente temporada"
  let inPreseason = false; // pre-season de una temporada nueva (sin simular todavía)

  const badgePending = new Set();
  const badgeFailed = new Set();

  function getCachedBadge(teamName) {
    try { return localStorage.getItem("badge:" + teamName) || ""; } catch (e) { return ""; }
  }

  function setCachedBadge(teamName, url) {
    try { localStorage.setItem("badge:" + teamName, url); } catch (e) {}
  }

  function fetchTeamBadge(teamName) {
    if (badgePending.has(teamName) || badgeFailed.has(teamName) || getCachedBadge(teamName)) return;
    const team = ALL_TEAMS.find(t => t.nombre === teamName);
    const query = (team && (team.apiname || team.nombre)) || teamName;
    badgePending.add(teamName);
    fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(data => {
        const list = data && data.teams;
        if (!list || !list.length) return;
        const isF1 = t => ((t.strSport || "") + " " + (t.strLeague || "")).toLowerCase().includes("formula");
        const f1 = list.filter(isF1);
        if (!f1.length) return;
        const exact = f1.find(t => (t.strTeam || "").toLowerCase() === query.toLowerCase());
        const badge = (exact || f1[0]).strBadge;
        if (badge) {
          setCachedBadge(teamName, badge);
          updateBadges(teamName);
        }
      })
      .catch(() => setTimeout(() => badgeFailed.delete(teamName), 300000))
      .finally(() => badgePending.delete(teamName));
  }

  function updateBadges(teamName) {
    const url = getCachedBadge(teamName);
    if (!url) return;
    document.querySelectorAll(".team-badge").forEach(img => {
      if (img.dataset.badgeTeam === teamName) {
        if (img.getAttribute("src") !== url) {
          img.setAttribute("src", url);
          img.style.display = "";
        }
        img.classList.add("loaded");
      }
    });
  }

  function safeBadgeUrl(url) {
    if (!url) return "";
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    } catch (e) {
      return "";
    }
    return url.replace(/"/g, "&quot;");
  }

  function badgeHTML(teamName, extraClass = "") {
    const safe = teamName.replace(/"/g, "&quot;");
    const cls = extraClass ? `team-badge ${extraClass}` : "team-badge";
    const cached = safeBadgeUrl(getCachedBadge(teamName));
    const local = "assets/badges/" + encodeURIComponent(teamName) + ".png";
    const src = cached ? cached : local;
    const loaded = cached ? " loaded" : "";
    return `<img class="${cls}${loaded}" data-badge-team="${safe}" src="${src}" alt="" onerror="this.style.display='none'" onload="this.classList.add('loaded')">`;
  }

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

  const CONTEXTUAL_VARS = ['--primary-color', '--primary-hover', '--primary-ring', '--team-color', '--bg', '--panel', '--panel-2', '--row', '--row-alt', '--cyan', '--cyan-bg', '--blue-tint', '--panel-bg', '--panel-border', '--input-bg', '--line', '--line-strong'];

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
    // acciones y acentos
    root.setProperty('--primary-color', color);
    root.setProperty('--primary-hover', shadeHex(color, 0.2));
    root.setProperty('--primary-ring', hexToRgba(color, 0.3));
    root.setProperty('--team-color', color);
    // acentos de interfaz teñidos con el color del equipo
    root.setProperty('--cyan', shadeHex(color, 0.35));
    root.setProperty('--cyan-bg', hexToRgba(color, 0.14));
    root.setProperty('--blue-tint', hexToRgba(color, 0.16));
    // fondo y paneles oscurecidos desde el color del equipo
    root.setProperty('--bg', mixBlack(color, 0.90));
    root.setProperty('--panel', mixBlack(color, 0.87));
    root.setProperty('--panel-2', mixBlack(color, 0.82));
    root.setProperty('--row', mixBlack(color, 0.89));
    root.setProperty('--row-alt', mixBlack(color, 0.86));
    root.setProperty('--panel-bg', mixBlack(color, 0.88));
    root.setProperty('--panel-border', hexToRgba(color, 0.2));
    root.setProperty('--input-bg', mixBlack(color, 0.85));
    // líneas sutiles con el color
    root.setProperty('--line', hexToRgba(color, 0.1));
    root.setProperty('--line-strong', hexToRgba(color, 0.18));
  }

  function flashTeamColor(teamName) {
    const team = ALL_TEAMS.find(t => t.nombre === teamName);
    if (!team || !team.color) return;
    const fade = el("team-fade");
    const color = ensureReadable(team.color);
    fade.style.background = `linear-gradient(160deg, ${color}, ${mixBlack(color, 0.7)})`;
    fade.classList.remove("active");
    void fade.offsetWidth;
    fade.classList.add("active");
  }

  const STAT_LABELS = {
    "POL": { name: "Poles", icon: "🚦" },
    "VIC": { name: "Victorias", icon: "🏆" },
    "POD": { name: "Podios", icon: "🥉" },
    "PTS": { name: "Puntos", icon: "💠" },
    "ADE": { name: "Adelantamientos", icon: "⚔️" },
    "VRA": { name: "Vueltas Rápidas", icon: "⏱️" }
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

  function populateFavoriteDrivers() {
    const sel = el("input-favorite");
    F1_DRIVERS.forEach((d, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = `${d.name} — ${d.team}`;
      sel.appendChild(opt);
    });
  }

  function updateCareerTypeUI() {
    const isFavorite = document.querySelector('input[name="career-type"]:checked').value === "favorito";
    el("favorite-field").classList.toggle("hidden", !isFavorite);
    ["input-name", "input-dorsal", "input-nationality"].forEach(id => {
      el(id).disabled = isFavorite;
      if (isFavorite) el(id).classList.add("muted");
      else el(id).classList.remove("muted");
    });
  }

  function buildStyleCards() {
    const wrap = el("style-cards");
    DRIVING_STYLES.forEach((style, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "style-card";
      const s1 = STAT_LABELS[style.statPrimaria];
      const s2 = STAT_LABELS[style.statSecundaria];
      btn.innerHTML = `
        <div class="style-card-icon"><img class="style-card-icon-img" src="${style.img}" alt="" onerror="this.outerHTML='${style.icon}'"></div>
        <div class="style-card-name">${style.nombre}</div>
        <div class="style-card-desc">${style.desc}</div>
        <div class="style-card-stats">
          <span>${s1.icon} ${s1.name}</span>
          <span>${s2.icon} ${s2.name}</span>
        </div>
      `;
      btn.dataset.idx = idx;
      btn.addEventListener("click", () => selectStyle(idx, btn));
      wrap.appendChild(btn);
    });
  }

  function selectStyle(idx, btn) {
    document.querySelectorAll(".style-card").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    const style = DRIVING_STYLES[idx];
    selectedStyle = { code: style.code, nombre: style.nombre };
    el("selected-style-label").textContent = `✔️ Seleccionado: ${style.nombre}`;
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
      const isMaxFitness = (item.repeatable === true && player.fitness >= 100);
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
    if (el("nav-profile")) el("nav-profile").textContent = player.name;

    let arrowHTML = "";
    if (player.lastDelta > 0) {
      arrowHTML = '<span style="color: #10b981; font-size: 22px; text-shadow: 0 0 10px rgba(16,185,129,0.5);">▲</span>';
    } else if (player.lastDelta < 0) {
      arrowHTML = '<span style="color: #f43f5e; font-size: 22px; text-shadow: 0 0 10px rgba(244,63,94,0.5);">▼</span>';
    }
    el("rating-badge").innerHTML = `${player.rating} ${arrowHTML}`;
    el("p-team-badge").innerHTML = badgeHTML(player.team, "team-badge-lg");
    fetchTeamBadge(player.team);
    el("p-earnings").textContent = fmtMoney(player.balance);
    el("p-team").textContent = player.team;
    el("p-header-wins").textContent = player.totalWins;
    const teamData = ALL_TEAMS.find(t => t.nombre === player.team);
    document.documentElement.style.setProperty("--team-color", (teamData && teamData.color) || "#e10600");

    applyContextualColor();
    refreshSeasonNav();
    if (el("view-rivals") && el("view-rivals").classList.contains("active")) renderRivals();
    if (el("view-team") && el("view-team").classList.contains("active")) renderTeamStandings();
    if (el("view-profile") && el("view-profile").classList.contains("active")) renderProfile();
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
      fetchTeamBadge(d.team);
      const wrapper = document.createElement("div");
      wrapper.className = "season-wrapper";

      const row = document.createElement("div");
      row.className = "table-row season-row";
      row.style.cursor = "pointer";
      row.title = "Clic para ver los eventos de esta temporada";

      let wonHtml = d.wonTitles && d.wonTitles.length ? d.wonTitles.map(t => trophyIconHTML(t.name, t.type)).join('') : '';

      const contentHTML = `
        <div class="col-t">T${d.season}</div>
        <div class="col-team">${badgeHTML(d.team)}<span>${d.team}</span></div>
        <div class="col-cat">${d.category}</div>
        <div class="col-pos">${d.champPos}°</div>
        <div class="col-n">${d.matches}</div>
        <div class="col-n win">${d.wins}</div>
        <div class="col-n">${d.podiums}</div>
        <div class="col-n">${d.poles}</div>
        <div class="col-tot">${d.points}</div>
        <div class="col-tr" title="${d.wonTitles && d.wonTitles.length ? d.wonTitles.map(t => t.name).join(', ') : ''}">${wonHtml}</div>
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

  function showRetiredNotice(reason) {
    retireReason = reason;
    el("btn-advance").classList.add("hidden");
    el("btn-retire-early").classList.add("hidden");
    el("retired-notice").classList.remove("hidden");
  }

  let clubCardsEl = [];
  let clubData = [];
  let clubIndex = 0;

  function updateClubs() {
    const track = el("clubs-track");
    const viewport = el("clubs-viewport");
    const card = clubCardsEl[clubIndex];
    if (!card) return;
    const cardW = card.offsetWidth;
    const gap = 30;
    const offset = viewport.clientWidth / 2 - (clubIndex * (cardW + gap) + cardW / 2);
    track.style.transform = `translateX(${offset}px)`;
    el("clubs-counter").textContent = `${clubIndex + 1} / ${clubCardsEl.length}`;
    el("btn-prev-club").disabled = clubIndex === 0;
    el("btn-next-club").disabled = clubIndex === clubCardsEl.length - 1;
  }

  function stepClub(delta) {
    if (!clubCardsEl.length) return;
    clubIndex = clamp(clubIndex + delta, 0, clubCardsEl.length - 1);
    updateClubs();
  }

  function openClubsModal() {
    const clubs = buildTeamSummary();
    const track = el("clubs-track");
    track.innerHTML = "";
    clubCardsEl = [];
    clubData = clubs;
    clubIndex = 0;

    const faceStyleFor = clubName => {
      const team = ALL_TEAMS.find(t => t.nombre === clubName);
      const raw = team && team.color ? team.color : null;
      if (!raw) return "";
      const color = ensureReadable(raw);
      return `background: radial-gradient(circle at 30% 20%, ${hexToRgba(color, 0.5)} 0%, transparent 65%), linear-gradient(135deg, ${mixBlack(color, 0.72)} 0%, ${mixBlack(color, 0.92)} 100%);`;
    };

    clubs.forEach((c, i) => {
      fetchTeamBadge(c.club);
      const card = document.createElement("div");
      card.className = "club-card";
      card.innerHTML = `
        <div class="club-card-face" style="${faceStyleFor(c.club)}">${badgeHTML(c.club)}</div>
        <div class="club-card-name">🏎️ ${c.club}</div>
        <div class="club-card-stats">
          <div class="row"><span>👥 Fanáticos</span><b>${c.idolatria}%</b></div>
          <div class="row"><span>📅 Temporadas</span><b>${c.seasonsPlayed}</b></div>
          <div class="row"><span>🏁 Carreras</span><b>${c.matches}</b></div>
          <div class="row"><span>🏆 Títulos</span><b>${c.totalTitles}</b></div>
          <div class="row"><span>${STAT_LABELS[player.stat1Code].icon} ${STAT_LABELS[player.stat1Code].name}</span><b>${c.stat1}</b></div>
          <div class="row"><span>${STAT_LABELS[player.stat2Code].icon} ${STAT_LABELS[player.stat2Code].name}</span><b>${c.stat2}</b></div>
        </div>
        <button class="club-card-btn" data-index="${i}">🏆 Ver trofeos</button>
      `;
      track.appendChild(card);
      clubCardsEl.push(card);
    });

    el("modal-clubs").classList.remove("hidden");
    requestAnimationFrame(updateClubs);
  }

  function renderClubTrophies(club) {
    if (!club) return;
    el("club-trophies-title").textContent = `🏆 Trofeos en ${club.club}`;
    const shelf = el("club-trophies-shelf");
    shelf.innerHTML = "";

    if (!club.titles.length) {
      const emptyMsg = document.createElement("p");
      emptyMsg.style.color = "var(--text-muted)";
      emptyMsg.style.fontSize = "15px";
      emptyMsg.style.width = "100%";
      emptyMsg.style.textAlign = "center";
      emptyMsg.textContent = "Sin títulos en esta escudería.";
      shelf.appendChild(emptyMsg);
    } else {
      club.titles.forEach(t => {
        const div = document.createElement("div");
        div.className = "trophy-item";
        div.innerHTML = `
          ${trophyIconHTML(t.name, t.type)}
          <div class="trophy-label">${t.name}</div>
          <div class="trophy-count">x${t.count}</div>
        `;
        shelf.appendChild(div);
      });
    }

    el("modal-club-trophies").classList.remove("hidden");
  }

  function renderRanking(tab) {
    const list = el("ranking-list");
    list.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px;">Cargando ranking…</p>`;

    fetchRanking(tab).then(rows => {
      list.innerHTML = "";
      if (!rows.length) {
        const empty = document.createElement("p");
        empty.style.color = "var(--text-muted)";
        empty.style.textAlign = "center";
        empty.style.padding = "20px";
        empty.textContent = "Todavía no hay partidas esta semana.";
        list.appendChild(empty);
        return;
      }
      rows.forEach((r, i) => {
        const div = document.createElement("div");
        div.className = "ranking-row";
        const field = RANKING_COLUMNS[tab];
        const value = tab === "dinero" ? fmtMoney(r[field]) : String(r[field]);
        const secondary = r.team ? `🏎️ ${r.team}` : (r.style || "");
        div.innerHTML = `
          <span class="ranking-pos">${i + 1}º</span>
          <div class="ranking-player">
            <span class="name"></span>
            <span class="team"></span>
          </div>
          <span class="ranking-value"></span>
        `;
        div.querySelector(".name").textContent = r.player_name;
        div.querySelector(".team").textContent = secondary;
        div.querySelector(".ranking-value").textContent = value;
        list.appendChild(div);
      });
    }).catch(() => {
      list.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px;">No se pudo cargar el ranking.</p>`;
    });
  }

  function setRankingTab(tab) {
    document.querySelectorAll(".ranking-tab").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    renderRanking(tab);
  }

  function updateSubmitState() {
    const submitted = localStorage.getItem("ranking_submitted_week") === currentWeekStart();
    const btn = el("btn-submit-game");
    const msg = el("ranking-submit-msg");
    if (submitted) {
      btn.disabled = true;
      msg.textContent = "Ya subiste tu partida esta semana. ¡Volve el lunes!";
    } else {
      btn.disabled = false;
      msg.textContent = "Compartí tu carrera y comparala con el resto del mundo.";
    }
  }

  function openRanking() {
    el("modal-ranking").classList.remove("hidden");
    updateSubmitState();
    setRankingTab("victorias");
  }

  function showRetireScreen(reason) {
    el("screen-game").classList.add("hidden");
    el("screen-retire").classList.remove("hidden");
    el("retire-reason").textContent = reason + ".";
    window.scrollTo(0, 0);

    let extraStats = "";
    if (player.championships > 0) {
      extraStats += `<div class="stat-row"><span>🏆 Campeonatos</span><span>${player.championships}</span></div>`;
    }
    if (player.driverAwards > 0) {
      extraStats += `<div class="stat-row"><span>🌟 Piloto del Año</span><span>${player.driverAwards}</span></div>`;
    }
    if (player.goldenHelmets > 0) {
      extraStats += `<div class="stat-row"><span>🪖 Cascos de Oro</span><span>${player.goldenHelmets}</span></div>`;
    }

    el("retire-summary").innerHTML = `
      <div class="stat-row"><span>Nombre</span><span>${player.name}</span></div>
      <div class="stat-row"><span>Nacionalidad</span><span>${player.flag} ${player.nationality}</span></div>
      <div class="stat-row"><span>Estilo</span><span>${player.styleName}</span></div>
      <div class="stat-row"><span>Última escudería</span><span>🏎️ ${player.team} (${player.category})</span></div>
      <div class="stat-row"><span>Edad de retiro</span><span>${player.age} años</span></div>
      <div class="stat-row"><span>Temporadas jugadas</span><span>${player.seasonsPlayed}</span></div>
      <div class="stat-row"><span>Valoración final</span><span>⭐ ${player.rating}</span></div>
      <div class="stat-row"><span>Total Carreras</span><span>${player.totalRaces}</span></div>
      <div class="stat-row"><span>Total Victorias</span><span>${player.totalWins}</span></div>
      <div class="stat-row"><span>Total Podios</span><span>${player.totalPodiums}</span></div>
      <div class="stat-row"><span>Total Poles</span><span>${player.totalPoles}</span></div>
      <div class="stat-row"><span>Total Puntos</span><span>${player.totalPoints}</span></div>
      ${extraStats}
    `;
  }

  function nextGp() {
    const isF1 = player.category === "F1";
    const calendar = isF1 ? GP_CALENDAR : GP_CALENDAR.slice(0, 14);
    const done = player.seasonProgress ? player.seasonProgress.racesDone : 0;
    return calendar[done] || calendar[calendar.length - 1];
  }

  function showGpCard(gp, onDone) {
    if (!gp) { onDone && onDone(); return; }
    const info = GP_INFO[gp.code] || {};
    const round = (player.seasonProgress ? player.seasonProgress.racesDone : 0) + 1;
    el("gp-card-round").textContent = "ROUND " + round;
    el("gp-card-flag").textContent = gp.flag;
    el("gp-card-code").textContent = gp.code;
    el("gp-card-name").textContent = gp.name.toUpperCase() + " GRAND PRIX";
    el("gp-card-circuit").textContent = info.circuit || "";
    el("gp-card-type").textContent = info.type || "";
    el("gp-card-location").textContent = info.location ? "📍 " + info.location : "";
    el("gp-card-date").textContent = "📅 " + player.year;
    const img = el("gp-card-img");
    if (info.image) { img.src = info.image; img.style.display = ""; }
    else img.style.display = "none";
    const overlay = el("gp-card");
    overlay.classList.remove("hidden");
    void overlay.offsetWidth;
    overlay.classList.add("active");
    setTimeout(() => {
      overlay.classList.remove("active");
      overlay.classList.add("hidden");
      onDone && onDone();
    }, 1700);
  }

  function showResultCard() {
    const p = player.seasonProgress;
    const lastSeason = player.seasons[player.seasons.length - 1];
    const races = (p && p.races.length) ? p.races : (lastSeason && lastSeason.grid) || null;
    if (!races || !races.length) return;
    const last = races[races.length - 1];
    const me = last.find(x => x.isPlayer);
    if (!me || typeof me.pos !== "number" || me.pos > 3) return;
    const calendar = player.category === "F1" ? GP_CALENDAR : GP_CALENDAR.slice(0, 14);
    const gp = calendar[Math.min(races.length - 1, calendar.length - 1)];
    const won = me.pos === 1;
    if (won) {
      const trophy = GP_TROPHIES.find(t => t.code === gp.code);
      el("result-emote").innerHTML = trophy && trophy.asset
        ? `<img class="result-trophy" src="${trophy.asset}" alt="" onerror="this.outerHTML='🏆'">`
        : "🏆";
    } else {
      el("result-emote").textContent = "🥉";
    }
    el("result-kicker").textContent = won ? "VICTORIA" : "PODIO";
    el("result-title").textContent = won
      ? `¡Ganaste el GP de ${gp.name}!`
      : `Terminaste ${me.pos}° en el GP de ${gp.name}`;
    el("result-gp").textContent = `${gp.flag} ${gp.code}`;
    const overlay = el("result-card");
    overlay.classList.remove("hidden");
    void overlay.offsetWidth;
    overlay.classList.add("active");
    setTimeout(() => {
      overlay.classList.remove("active");
      overlay.classList.add("hidden");
    }, 2200);
  }

  function handleAdvance() {
    el("btn-advance").disabled = true;
    let injuryHappened = false, promotionPending = false, seasonCompleted = true;
    if (betweenSeasons) {
      betweenSeasons = false;
      if (player.seasonsPlayed > 0) {
        // entre temporadas -> pre-season de la próxima (no se simula todavía)
        inPreseason = true;
        updateSimButton();
        updateNewsTab();
        refreshSeasonNav();
        el("btn-advance").disabled = false;
        return;
      }
      updateSimButton();
      updateNewsTab();
    }
    if (inPreseason) inPreseason = false;

    const afterSim = (completed, injury, promo) => {
      seasonCompleted = completed;
      injuryHappened = injury;
      promotionPending = promo;
      renderSummaries();

      if (player.retired) {
        renderPlayer();
        showRetiredNotice("El piloto ha decidido retirarse debido a su edad, bajo rendimiento o falta de butaca");
        return;
      }

      renderPlayer();
      renderShop();

      if (!seasonCompleted) {
        forcedOffers = false;
        promotionOffers = false;
        el("btn-advance").disabled = false;
        return;
      }

      /* Temporada terminada: estado entre temporadas (ofertas + evaluación de la temporada). */
      betweenSeasons = true;
      updateSimButton();
      updateNewsTab();

      if (checkForcedTransfer()) {
        forcedOffers = true;
        promotionOffers = false;
        addHistoryToLastSeason("transfer", "⚠️ Butaca en riesgo", `Su valoración cayó más de un 5% por debajo del valor con el que llegó a la escudería. Está <strong>obligado a buscar equipo</strong>.`);
        renderLastSeasonEvents();
        generateOffers(5, "F1");
        renderProfileOffers();
      } else if (promotionPending) {
        forcedOffers = false;
        promotionOffers = true;
        generateOffers(3, "F1");
        renderProfileOffers();
      } else if (!injuryHappened && Math.random() < (player.category === "F1" ? 0.75 : 0.5)) {
        forcedOffers = false;
        promotionOffers = false;
        generateOffers(player.category === "F1" ? 3 : 2, player.category);
        renderProfileOffers();
      } else {
        forcedOffers = false;
        promotionOffers = false;
        el("btn-advance").disabled = false;
      }
    };

    if (simMode === "race") {
      const runRace = () => {
        const r = simulateRace();
        afterSim(!!r, r ? r.injuryHappened : false, r ? r.promotionPending : false);
        if (resultCardOn) showResultCard();
      };
      if (gpCardOn) showGpCard(nextGp(), runRace);
      else runRace();
    } else if (simMode === "mid") {
      const r = simulateMidSeason();
      afterSim(!!r, r ? r.injuryHappened : false, r ? r.promotionPending : false);
    } else {
      const r = simulateSeason(1);
      afterSim(true, r.injuryHappened, r.promotionPending);
    }
  }

  function handleRetireEarly() {
    player.retired = true;
    renderPlayer();
    showRetiredNotice("Decidiste retirarte anticipadamente por voluntad propia");
  }

  function handleAccept(index) {
    const prevTeam = player.team;
    acceptOffer(index);
    forcedOffers = false;
    promotionOffers = false;
    renderPlayer();
    renderLastSeasonEvents();
    if (player.team !== prevTeam) flashTeamColor(player.team);
    el("btn-advance").disabled = false;
  }

  function handleReject(index) {
    const remaining = rejectOffer(index);
    renderLastSeasonEvents();
    if (remaining.length === 0) {
      if (forcedOffers) {
        forcedOffers = false;
        renderPlayer();
        showRetiredNotice("Al rechazar todas las ofertas obligatorias, el piloto se quedó sin butaca");
        return;
      }
      promotionOffers = false;
      el("btn-advance").disabled = false;
    }
    renderProfileOffers();
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
          showRetiredNotice("El desgaste físico acumulado por los entrenamientos extremos forzó tu retiro");
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

  const SIM_MODE_LABELS = { race: "🏁 Simular: carrera", mid: "⏩ Simular: media temporada", season: "▶ Simular: temporada" };
  function updateSimMode() {
    el("btn-sim-mode").textContent = SIM_MODE_LABELS[simMode];
    el("btn-gpcard").classList.toggle("hidden", simMode !== "race");
    el("btn-gpcard").textContent = gpCardOn ? "🎬 Cards GP: ON" : "🎬 Cards GP: OFF";
    el("btn-resultcard").classList.toggle("hidden", simMode !== "race");
    el("btn-resultcard").textContent = resultCardOn ? "🏁 Avisos: ON" : "🏁 Avisos: OFF";
  }
  function updateSimButton() {
    el("btn-advance").textContent = betweenSeasons ? "▶ Siguiente temporada" : "▶ Simular";
  }
  el("btn-sim-mode").addEventListener("click", () => {
    simMode = simMode === "race" ? "mid" : simMode === "mid" ? "season" : "race";
    updateSimMode();
  });
  el("btn-gpcard").addEventListener("click", () => {
    gpCardOn = !gpCardOn;
    localStorage.setItem("gpcard", gpCardOn ? "on" : "off");
    updateSimMode();
  });
  el("btn-resultcard").addEventListener("click", () => {
    resultCardOn = !resultCardOn;
    localStorage.setItem("resultcard", resultCardOn ? "on" : "off");
    updateSimMode();
  });
  updateSimMode();
  updateSimButton();
  updateRejectAllButton();

  if (contextualOn) el("btn-contextual").textContent = "🎨 Color Contextual: ON";

  el("input-dorsal").addEventListener("input", () => {
    el("input-dorsal").value = el("input-dorsal").value.replace(/\D/g, "").slice(0, 2);
  });

  el("btn-create").addEventListener("click", () => {
    if (!selectedStyle) return;

    const name = escapeHTML(el("input-name").value.trim()) || "Piloto Anónimo";
    const natIndex = el("input-nationality").value;
    const nationalityData = NATIONALITIES[natIndex];
    const careerType = document.querySelector('input[name="career-type"]:checked').value;
    const favorite = careerType === "favorito" ? (F1_DRIVERS[parseInt(el("input-favorite").value, 10)] || null) : null;
    const dorsalRaw = el("input-dorsal").value.trim();
    let dorsal = parseInt(dorsalRaw, 10);
    if (!(dorsal >= 1 && dorsal <= 99)) dorsal = Math.floor(Math.random() * 99) + 1;

    player = createDriver(name, nationalityData, selectedStyle.code, careerType, dorsal, favorite);

    el("screen-create").classList.add("hidden");
    el("screen-game").classList.remove("hidden");
    const debut = favorite
      ? `${player.name} toma el asiento en la <strong>Fórmula 1</strong> con <strong>${player.team}</strong> a los ${player.age} años.`
      : `${player.name} hace su debut profesional en la <strong>F2</strong> con <strong>${player.team}</strong> a los ${player.age} años.`;
    addHistory("season", "🚦 Debut", debut);

    renderSummaries();
    renderPlayer();
    renderShop();
    flashTeamColor(player.team);
  });

  function trophyEmojiHTML(name, type) {
    switch (type) {
      case "f1champ":
        return `<div class="trophy-icon">🏆</div>`;
      case "f2champ":
        return `<div class="trophy-icon">🥇</div>`;
      case "constructors":
        return `<div class="trophy-icon">🛠️</div>`;
      case "gp":
        return `<div class="trophy-icon">👑</div>`;
      default:
        if (name === "Piloto del Año FIA") return `<div class="trophy-icon">🌟</div>`;
        if (name === "Casco de Oro") return `<div class="trophy-icon">🪖</div>`;
        if (name === "Rookie del Año") return `<div class="trophy-icon">🌱</div>`;
        return `<div class="trophy-icon">🏆</div>`;
    }
  }

  function trophyIconHTML(name, type) {
    const emoji = trophyEmojiHTML(name, type);
    let asset = TROPHY_ASSETS[name];
    if (!asset && type === "gp") {
      const gp = GP_TROPHIES.find(g => "GP de " + g.name === name);
      asset = gp ? gp.asset : null;
    }
    if (!asset) return emoji;
    const fb = emoji.replace(/"/g, "&quot;");
    return `<img class="trophy-img" src="${asset}" alt="${escapeHTML(name)}" data-fb="${fb}" onerror="this.outerHTML=this.getAttribute('data-fb');">`;
  }

  function collectTrophies() {
    const trophies = {};
    const typeMap = {};
    player.seasons.forEach(s => (s.wonTitles || []).forEach(t => {
      trophies[t.name] = (trophies[t.name] || 0) + 1;
      if (!typeMap[t.name]) typeMap[t.name] = t.type;
    }));
    return { trophies, typeMap };
  }

  function renderVitrina() {
    const shelf = el("vitrina-shelf");
    shelf.innerHTML = "";

    const { trophies, typeMap } = collectTrophies();

    if (Object.keys(trophies).length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.style.color = "var(--text-muted)";
      emptyMsg.style.fontSize = "14px";
      emptyMsg.style.width = "100%";
      emptyMsg.style.textAlign = "center";
      emptyMsg.style.alignSelf = "center";
      emptyMsg.style.marginBottom = "20px";
      emptyMsg.textContent = "La vitrina está vacía.";
      shelf.appendChild(emptyMsg);
    }

    for (const [name, count] of Object.entries(trophies)) {
      const type = typeMap[name] || "other";
      const div = document.createElement("div");
      div.className = "trophy-item";
      div.innerHTML = `
        ${trophyIconHTML(name, type)}
        <div class="trophy-label">${name}</div>
        <div class="trophy-count">x${count}</div>
      `;
      shelf.appendChild(div);
    }

    const idolEntries = Object.entries(player.idolatria).filter(([, v]) => v > 0);
    if (idolEntries.length) {
      const idol = document.createElement("div");
      idol.className = "vitrina-idolatria";
      let rows = "";
      for (const [team, val] of idolEntries) {
        rows += `
          <div class="vitrina-idolatry-row">
            <span>🏎️ ${team}</span>
            <div class="idolatry-bar"><div style="width:${val}%"></div></div>
            <span>${val}%</span>
          </div>`;
      }
      idol.innerHTML = `<h3>👥 Escuderías que te aman</h3>${rows}`;
      shelf.appendChild(idol);
    }
  }

  el("btn-vitrina").addEventListener("click", () => {
    renderVitrina();
    el("modal-vitrina").classList.remove("hidden");
  });

  el("btn-close-vitrina").addEventListener("click", () => {
    el("modal-vitrina").classList.add("hidden");
  });

  el("btn-shop").addEventListener("click", () => {
    renderShop();
    el("modal-shop").classList.remove("hidden");
  });

  el("btn-close-shop").addEventListener("click", () => {
    el("modal-shop").classList.add("hidden");
  });

  el("btn-instructions").addEventListener("click", () => {
    el("modal-instructions").classList.remove("hidden");
  });

  el("btn-close-instructions").addEventListener("click", () => {
    el("modal-instructions").classList.add("hidden");
  });

  el("btn-update").addEventListener("click", () => {
    el("modal-update").classList.remove("hidden");
  });

  el("btn-close-update").addEventListener("click", () => {
    el("modal-update").classList.add("hidden");
  });

  el("btn-advance").addEventListener("click", () => handleAdvance());
  el("btn-reject-all").addEventListener("click", rejectAllOffers);
  el("btn-retire-early").addEventListener("click", handleRetireEarly);
  el("btn-restart").addEventListener("click", resetToCreate);

  el("btn-view-summary").addEventListener("click", () => {
    showRetireScreen(retireReason);
  });

  el("profile-offers").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-index]");
    if (!btn) return;
    const index = parseInt(btn.getAttribute("data-index"), 10);
    if (btn.classList.contains("offer-accept")) handleAccept(index);
    else if (btn.classList.contains("offer-reject")) handleReject(index);
  });

  el("profile-sponsor").addEventListener("click", (e) => {
    if (e.target.closest("#profile-chest-btn")) {
      el("modal-chest").classList.remove("hidden");
    }
  });

  el("btn-chest-open").addEventListener("click", () => {
    el("modal-chest").classList.add("hidden");
    player.chestPending = false;
    if (Math.random() < 0.5) {
      player.retired = true;
      renderPlayer();
      showRetiredNotice("Un sponsor misterioso resultó una estafa: te quitaron la superlicencia");
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
  populateFavoriteDrivers();
  buildStyleCards();
  document.querySelectorAll('input[name="career-type"]').forEach(r => r.addEventListener("change", updateCareerTypeUI));
  updateCareerTypeUI();

  el("btn-clubs").addEventListener("click", openClubsModal);
  el("btn-close-clubs").addEventListener("click", () => el("modal-clubs").classList.add("hidden"));
  el("btn-prev-club").addEventListener("click", () => stepClub(-1));
  el("btn-next-club").addEventListener("click", () => stepClub(1));
  el("btn-vitrina-general").addEventListener("click", () => {
    renderVitrina();
    el("modal-vitrina").classList.remove("hidden");
  });

  el("clubs-track").addEventListener("click", (e) => {
    const btn = e.target.closest(".club-card-btn");
    if (!btn) return;
    const idx = parseInt(btn.dataset.index, 10);
    renderClubTrophies(clubData[idx]);
  });
  el("btn-close-club-trophies").addEventListener("click", () => {
    el("modal-club-trophies").classList.add("hidden");
  });

  el("btn-ranking").addEventListener("click", openRanking);
  el("btn-close-ranking").addEventListener("click", () => {
    el("modal-ranking").classList.add("hidden");
  });
  el("ranking-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".ranking-tab");
    if (tab) setRankingTab(tab.dataset.tab);
  });
  el("btn-submit-game").addEventListener("click", () => {
    const btn = el("btn-submit-game");
    const msg = el("ranking-submit-msg");
    btn.disabled = true;
    msg.textContent = "Subiendo partida…";
    submitPartida()
      .then(() => {
        localStorage.setItem("ranking_submitted_week", currentWeekStart());
        msg.textContent = "¡Partida subida! Ya estás en el ranking.";
        setRankingTab("victorias");
      })
      .catch((err) => {
        btn.disabled = false;
        msg.textContent = err.message.includes("configurado")
          ? "Supabase no está configurado."
          : "No se pudo subir la partida. Intentá de nuevo.";
      });
  });

  /* =====================================================================
     STANDINGS — parrilla generada desde los datos del juego
     ===================================================================== */

  const GP_CALENDAR = [
    { name: "Australia", flag: "🇦🇺", code: "AUS" }, { name: "China", flag: "🇨🇳", code: "CHN" },
    { name: "Japón", flag: "🇯🇵", code: "JPN" }, { name: "Bahréin", flag: "🇧🇭", code: "BHR" },
    { name: "Arabia Saudita", flag: "🇸🇦", code: "KSA" }, { name: "Miami", flag: "🇺🇸", code: "MIA" },
    { name: "Madrid", flag: "🇪🇸", code: "MAD" }, { name: "Mónaco", flag: "🇲🇨", code: "MCO" },
    { name: "Canadá", flag: "🇨🇦", code: "CAN" }, { name: "España", flag: "🇪🇸", code: "ESP" },
    { name: "Austria", flag: "🇦🇹", code: "AUT" }, { name: "Gran Bretaña", flag: "🇬🇧", code: "GBR" },
    { name: "Bélgica", flag: "🇧🇪", code: "BEL" }, { name: "Hungría", flag: "🇭🇺", code: "HUN" },
    { name: "Países Bajos", flag: "🇳🇱", code: "NED" }, { name: "Italia", flag: "🇮🇹", code: "ITA" },
    { name: "Azerbaiyán", flag: "🇦🇿", code: "AZE" }, { name: "Singapur", flag: "🇸🇬", code: "SIN" },
    { name: "Austin", flag: "🇺🇸", code: "USA" }, { name: "México", flag: "🇲🇽", code: "MEX" },
    { name: "Brasil", flag: "🇧🇷", code: "BRA" }, { name: "Las Vegas", flag: "🇺🇸", code: "LVG" },
    { name: "Qatar", flag: "🇶🇦", code: "QAT" }, { name: "Abu Dhabi", flag: "🇦🇪", code: "UAE" }
  ];

  function shuffle(a) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  }

  function teamColorOf(teamName) {
    const t = ALL_TEAMS.find(x => x.nombre === teamName);
    return t && t.color ? t.color : "#555";
  }

  function buildStandings() {
    const len = player.seasons.length;
    const prog = player.seasonProgress;
    const inProgress = !!prog && prog.racesDone > 0 && prog.racesDone < prog.baseRaces;
    const atInProgress = inProgress && seasonIdx === len;
    const s = atInProgress ? null : (len ? player.seasons[clamp(seasonIdx, 0, len - 1)] : null);
    const preseason = inPreseason || (!s && !atInProgress && len === 0);
    /* en pre-season la grilla es la del equipo/categoría ACTUAL (el que correrá la temporada) */
    const isF1 = inPreseason ? player.category === "F1" : (s ? s.category === "F1" : player.category === "F1");
    const playerTeam = inPreseason ? player.team : (s ? (s.team || player.team) : player.team);
    const races = isF1 ? 24 : 14;
    const calendar = isF1 ? GP_CALENDAR : GP_CALENDAR.slice(0, 14);
    const ptsTable = isF1 ? POINTS_F1 : POINTS_F2;
    const grid = buildGrid(isF1, playerTeam);
    const playerRow = grid.find(d => d.isPlayer);

    if (preseason) {
      // pre-temporada: calendario completo con celdas vacías ("–"), sin resultados
      const cat = isF1 ? "F1" : "F2";
      const statMap = {};
      (player.rivals && player.rivals[cat] || []).forEach(rr => { statMap[rr.name] = rr.stats; });
      const orderedList = grid.slice();
      orderedList.forEach((d, i) => {
        d.pos = i + 1;
        d.tot = 0;
        d.cells = new Array(races).fill(null);
        d.stats = d.isPlayer ? player.stats : statMap[d.name];
      });
      return { races, done: 0, calendar, orderedList };
    }

    /* Carreras guardadas (temporada en curso o temporada simulada carrera a carrera).
       La grilla se arma desde el roster guardado (equipos con los que realmente
       corrieron), así el mercado/traspasos posteriores no rompen las celdas. */
    const stored = atInProgress ? prog.races : (s && s.grid);
    if (stored) {
      const roster = new Map();
      stored.forEach(raceRes => raceRes.forEach(x => {
        if (!roster.has(x.name)) roster.set(x.name, { name: x.name, team: x.team, isPlayer: x.isPlayer, cells: [] });
      }));
      stored.forEach((raceRes, r) => raceRes.forEach(x => {
        const d = roster.get(x.name);
        if (d) d.cells[r] = x.pos;
      }));
      const cat = isF1 ? "F1" : "F2";
      const statMap = {};
      (player.rivals && player.rivals[cat] || []).forEach(rr => { statMap[rr.name] = rr.stats; });
      const orderedList = [...roster.values()];
      orderedList.forEach(d => {
        d.stats = d.isPlayer ? player.stats : statMap[d.name];
        // las carreras no corridas aún quedan vacías pero con el calendario completo
        for (let r = stored.length; r < races; r++) d.cells[r] = null;
        d.rawTOT = d.cells.reduce((a, p) => a + (typeof p === "number" ? (ptsTable[p - 1] || 0) : 0), 0);
      });
      orderedList.sort((a, b) => b.rawTOT - a.rawTOT);
      orderedList.forEach((d, i) => { d.pos = i + 1; d.tot = d.rawTOT; });
      return { races, done: stored.length, calendar, orderedList };
    }

    const rivals = grid.filter(d => !d.isPlayer);
    rivals.forEach(d => { d.cells = []; });
    playerRow.cells = [];

    /* Qué carreras corre el jugador, cuáles gana y cuáles hace podio (coherente con el motor). */
    const allIdx = Array.from({ length: races }, (_, i) => i);
    const ranRaces = new Set(shuffle(allIdx).slice(0, clamp(s.matches, 0, races)));
    const winRaces = new Set(shuffle([...ranRaces]).slice(0, s.wins || 0));
    const podLeft = Math.max(0, (s.podiums || 0) - (s.wins || 0));
    const podiumRaces = new Set(shuffle([...ranRaces].filter(i => !winRaces.has(i))).slice(0, podLeft));

    for (let r = 0; r < races; r++) {
      const finishers = fillRace(grid, playerRow, rivals, r);

      /* narrativa del jugador: DNS / victoria / podio mediante swaps (permutación, sin dups) */
      if (!ranRaces.has(r)) {
        playerRow.cells[r] = "DNS";
      } else if (winRaces.has(r)) {
        const winner = finishers[0];
        winner.cells[r] = playerRow.cells[r];
        playerRow.cells[r] = 1;
      } else if (podiumRaces.has(r)) {
        const target = Math.random() < 0.5 ? 2 : 3;
        const occupant = finishers.find(d => d.cells[r] === target);
        if (occupant && occupant !== playerRow) {
          const prev = playerRow.cells[r];
          occupant.cells[r] = prev;
          playerRow.cells[r] = target;
        }
      } else {
        // fuera de victorias/podios: el jugador no debe quedar en el top-3 (consistencia con el motor)
        const p = playerRow.cells[r];
        if (typeof p === "number" && p <= 3) {
          const fourth = finishers.find(d => d.cells[r] === 4);
          if (fourth && fourth !== playerRow) {
            fourth.cells[r] = p;
            playerRow.cells[r] = 4;
          } else {
            playerRow.cells[r] = 4;
          }
        }
      }
    }

    /* TOT = suma de los puntos de cada carrera simulada (sin escalados ni offsets) */
    grid.forEach(d => { d.rawTOT = d.cells.reduce((a, p) => a + (typeof p === "number" ? (ptsTable[p - 1] || 0) : 0), 0); });
    const orderedList = grid.slice().sort((a, b) => b.rawTOT - a.rawTOT);
    orderedList.forEach((d, i) => { d.pos = i + 1; d.tot = d.rawTOT; });
    return { races, done: races, calendar, orderedList };
  }

  let _stKey = "";
  let _lastDone = 0;
  let _lastTots = {};
  let _hasRendered = false;
  function renderStandings() {
    const key = `${player.seasons.length}:${seasonIdx}:${player.team}:${player.category}:${player.year}:${player.seasonProgress ? player.seasonProgress.racesDone : ""}:${inPreseason ? "P" : ""}`;
    const wrap = el("standings-scroll");
    if (key === _stKey && wrap.innerHTML) return;
    _stKey = key;
    const isFirstRender = !_hasRendered;
    _hasRendered = true;
    const data = buildStandings();
    const prevDone = _lastDone;
    const prevTots = _lastTots;
    _lastDone = data.done;
    const newTots = {};
    data.orderedList.forEach(d => { newTots[d.name] = d.tot; });
    _lastTots = newTots;

    /* FLIP: capturar la posición previa de cada fila para animar el reordenamiento */
    const oldRects = {};
    if (!isFirstRender) {
      wrap.querySelectorAll("tbody tr").forEach(row => {
        const nameEl = row.querySelector(".d-name");
        if (nameEl) oldRects[nameEl.textContent] = row.getBoundingClientRect().top;
      });
    }

    let html = `<table class="standings-table"><thead><tr><th class="pos-cell">#</th><th class="driver-cell">Driver</th>`;
    data.calendar.forEach(gp => { html += `<th class="race-cell" title="${gp.name}">${gp.flag}<span class="gp-code">${gp.code}</span></th>`; });
    html += `<th class="tot-cell">TOT</th></tr></thead><tbody>`;
    data.orderedList.forEach((d, rowI) => {
      const team = teamColorOf(d.team);
      html += `<tr class="${d.isPlayer ? 'player-row' : ''}"><td class="pos-cell">${d.pos}</td>`;
      html += `<td class="driver-cell"><span class="stripe" style="background:${team}"></span><span class="d-info"><span class="d-name">${escapeHTML(d.name)}</span><span class="d-team">${escapeHTML(d.team)}</span></span></td>`;
      d.cells.forEach((c, i) => {
        const isNew = !isFirstRender && i >= prevDone && i < data.done;
        const anim = isNew ? ` race-in" style="animation-delay:${rowI * 18}ms"` : "";
        if (c === "DNF") html += `<td class="race-cell dnf${anim}">DNF</td>`;
        else if (c === "DNS" || c == null) html += `<td class="race-cell dns${anim}">–</td>`;
        else if (c === 1) html += `<td class="race-cell p1${anim}">1</td>`;
        else if (c === 2) html += `<td class="race-cell p2${anim}">2</td>`;
        else if (c === 3) html += `<td class="race-cell p3${anim}">3</td>`;
        else html += `<td class="race-cell${anim}">${c}</td>`;
      });
      html += `<td class="tot-cell">${d.tot}</td></tr>`;
    });
    html += "</tbody></table>";
    wrap.innerHTML = html;
    stretchStandings(wrap.querySelector("table"));

    /* FLIP: animar el movimiento de filas a su nueva posición (suave, con easing).
       La fila del jugador no hace el salto para no "caer y volver" en cada carrera. */
    if (!isFirstRender && data.done > prevDone && Object.keys(oldRects).length) {
      wrap.querySelectorAll("tbody tr").forEach(row => {
        if (row.classList.contains("player-row")) return;
        const nameEl = row.querySelector(".d-name");
        if (!nameEl) return;
        const delta = (oldRects[nameEl.textContent] ?? row.getBoundingClientRect().top) - row.getBoundingClientRect().top;
        if (Math.abs(delta) < 1) return;
        const cells = row.querySelectorAll("td");
        cells.forEach(c => { c.style.transition = "none"; c.style.transform = `translateY(${delta}px)`; });
        void row.offsetHeight;
        cells.forEach(c => {
          c.style.transition = "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)";
          c.style.transform = "";
        });
      });
    }

    if (data.done > prevDone && prevDone > 0) {
      animateTots(wrap, prevTots, newTots);
    }
  }

  /* Cuenta el TOT de su valor anterior al nuevo cuando se simula una carrera. */
  function animateTots(wrap, prevTots, newTots) {
    wrap.querySelectorAll("tbody tr").forEach(row => {
      const nameEl = row.querySelector(".d-name");
      const totCell = row.querySelector(".tot-cell");
      if (!nameEl || !totCell) return;
      const from = prevTots[nameEl.textContent];
      const to = newTots[nameEl.textContent];
      if (from == null || to == null || from === to) return;
      const dur = 700;
      const start = performance.now();
      const step = t => {
        const p = Math.min(1, (t - start) / dur);
        totCell.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function renderTeamStandings() {
    const wrap = el("team-scroll");
    if (!wrap) return;
    const data = buildStandings();
    const teams = {};
    data.orderedList.forEach(d => {
      const t = teams[d.team] || (teams[d.team] = { team: d.team, pts: 0, drivers: [], isPlayer: d.isPlayer });
      t.pts += d.tot;
      t.drivers.push(d);
      if (d.isPlayer) t.isPlayer = true;
    });
    const list = Object.values(teams).sort((a, b) => b.pts - a.pts);
    list.forEach((t, i) => t.pos = i + 1);

    let html = `<table class="standings-table"><thead><tr><th class="pos-cell">#</th><th class="driver-cell">Team</th><th class="tot-cell">TOT</th></tr></thead><tbody>`;
    list.forEach(t => {
      const color = teamColorOf(t.team);
      const drivers = t.drivers.map(d => d.name).join(" · ");
      html += `<tr class="${t.isPlayer ? 'player-row' : ''}"><td class="pos-cell">${t.pos}</td>`;
      html += `<td class="driver-cell"><span class="stripe" style="background:${color}"></span><span class="d-info"><span class="d-name">${escapeHTML(t.team)}</span><span class="d-team">${escapeHTML(drivers)}</span></span></td>`;
      html += `<td class="tot-cell">${t.pts}</td></tr>`;
    });
    html += "</tbody></table>";
    wrap.innerHTML = html;
    stretchStandings(wrap.querySelector("table"));
  }

  let seasonIdx = 0;
  let _lastLen = 0;

  function stretchStandings(table) {
    const scroll = table.closest(".standings-scroll");
    if (!scroll) return;
    const posW = 34, driverW = 250, totW = 64;
    const races = table.querySelectorAll("thead th.race-cell");
    const containerW = scroll.getBoundingClientRect().width;
    const apply = (cls, w) => {
      const wpx = Math.max(0, Math.round(w)) + "px";
      table.querySelectorAll("thead th." + cls + ", tbody td." + cls).forEach(c => { c.style.width = wpx; c.style.minWidth = wpx; });
    };
    const avail = containerW - posW - driverW - totW;
    if (races.length) {
      // sin espacio: layout natural (max-content + scroll horizontal), no estirar
      if (avail <= races.length * 44) {
        table.style.tableLayout = "";
        table.style.width = "";
        table.querySelectorAll("th, td").forEach(c => { c.style.width = ""; c.style.minWidth = ""; });
        return;
      }
      table.style.tableLayout = "fixed";
      table.style.width = "100%";
      apply("pos-cell", posW);
      apply("driver-cell", driverW);
      apply("tot-cell", totW);
      const body = table.querySelectorAll("tbody td.race-cell");
      const base = Math.floor(avail / races.length);
      const rem = avail - base * races.length;
      races.forEach((th, i) => {
        const w = (base + (i < rem ? 1 : 0)) + "px";
        th.style.width = w; th.style.minWidth = w;
        if (body[i]) { body[i].style.width = w; body[i].style.minWidth = w; }
      });
    } else {
      table.style.tableLayout = "fixed";
      table.style.width = "100%";
      apply("pos-cell", posW);
      apply("tot-cell", totW);
      apply("driver-cell", Math.max(driverW, containerW - posW - totW));
    }
  }

  function refreshSeasonNav(keepPosition = false) {
    const len = player.seasons.length;
    const prog = player.seasonProgress;
    const inProgress = !!prog && prog.racesDone > 0 && prog.racesDone < prog.baseRaces;
    if (keepPosition) {
      seasonIdx = clamp(seasonIdx, 0, inProgress ? len : len - 1);
    } else if (len > _lastLen) {
      seasonIdx = len - 1;
    } else if (inProgress) {
      seasonIdx = len;
    } else {
      seasonIdx = clamp(seasonIdx, 0, len - 1);
    }
    _lastLen = len;
    if (inPreseason) {
      el("season-label").textContent = `< Season ${player.seasonsPlayed + 1} >`;
      el("btn-season-prev").disabled = true;
      el("btn-season-next").disabled = true;
      renderStandings();
      return;
    }
    if (inProgress && seasonIdx === len) {
      el("season-label").textContent = `< Season ${player.seasonsPlayed + 1} >`;
    } else {
      const s = len ? player.seasons[seasonIdx] : null;
      el("season-label").textContent = s ? `< Season ${s.season} >` : `< Season ${player.seasonsPlayed + 1} >`;
    }
    el("btn-season-prev").disabled = seasonIdx <= 0;
    el("btn-season-next").disabled = seasonIdx >= (inProgress ? len : len - 1);
    renderStandings();
  }

  /* ==================== Vistas (tabs / subnav) ==================== */

  const HEADER_TABS = ["standings", "facilities", "rnd", "vehicle", "corporate", "profile", "news"];
  const SUB_TABS = ["standings", "team", "results", "trophies", "rivals"];
  let activeHeader = "standings";
  let activeSub = "standings";

  function updateSeasonBar() {
    const isStandingsView = activeHeader === "standings" && activeSub === "standings";
    el("season-bar").classList.toggle("hidden", !isStandingsView);
    el("btn-advance").classList.toggle("hidden", !isStandingsView);
  }

  function showContent(view) {
    const placeholderTabs = ["facilities", "rnd", "vehicle", "corporate"];
    const target = placeholderTabs.includes(view) ? "placeholder" : view;
    if (HEADER_TABS.includes(view)) {
      activeHeader = view;
      activeSub = view === "standings" ? "standings" : null;
    } else if (SUB_TABS.includes(view)) {
      activeSub = view;
    }
    document.querySelectorAll(".content-view").forEach(v => v.classList.toggle("active", v.id === "view-" + target));
    document.querySelectorAll(".nav-tab").forEach(t => t.classList.toggle("active", t.dataset.view === activeHeader));
    document.querySelectorAll(".sub-tab").forEach(t => t.classList.toggle("active", t.dataset.sub === activeSub));
    el("sub-header").classList.toggle("hidden", activeHeader !== "standings");
    updateSeasonBar();
    /* si la tabla se re-renderizó oculta, se re-estira al volver a la vista */
    if (target === "standings" || target === "team") {
      const scroll = target === "standings" ? el("standings-scroll") : el("team-scroll");
      if (scroll && scroll.querySelector("table")) stretchStandings(scroll.querySelector("table"));
    }
    if (target === "rivals") renderRivals();
    if (target === "trophies") renderTrophiesView();
    if (target === "team") renderTeamStandings();
    if (target === "profile") renderProfile();
    if (target === "news") renderNews();
  }

  function updateNewsTab() {
    el("nav-news").classList.toggle("hidden", !betweenSeasons);
    if (!betweenSeasons && activeHeader === "news") showContent("standings");
  }

  function renderNews() {
    const list = el("news-list");
    const last = player.seasons[player.seasons.length - 1];
    const transfers = last ? (last.events || []).filter(e => e.type === "transfer") : [];
    if (!transfers.length) {
      list.innerHTML = `<p class="dim">No hubo fichajes esta temporada.</p>`;
      return;
    }
    let html = `<h3 class="news-title">📰 Fichajes de la parrilla</h3>`;
    transfers.forEach(e => {
      html += `<div class="news-item"><span class="news-tag">${e.tag}</span><span class="news-text">${e.text}</span></div>`;
    });
    list.innerHTML = html;
  }

  function renderProfile() {
    const head = el("profile-head");
    head.innerHTML = `
      <div class="p-avatar">${badgeHTML(player.team, "team-badge-xl")}</div>
      <div class="p-id">
        <h2>${escapeHTML(player.name)}</h2>
        <div class="p-meta">${player.flag} ${escapeHTML(player.nationality)} · ${escapeHTML(player.styleName)} · ${player.category === "F1" ? "Fórmula 1" : "Fórmula 2"} · ${escapeHTML(player.team)}</div>
      </div>`;

    el("profile-attr").innerHTML = DRIVER_STAT_KEYS.map(k =>
      `<div class="p-attr"><span>${k.toUpperCase()}</span><b>${player.stats[k]}</b></div>`
    ).join("") + `
      <div class="p-attr star"><span>◆ Media</span><b>${player.rating}</b></div>
      <div class="p-attr"><span>🎂 Edad</span><b>${player.age}</b></div>
      <div class="p-attr"><span>💪 Físico</span><b>${player.fitness}%</b></div>
      <div class="p-attr"><span>📅 Temp.</span><b>${player.seasonsPlayed}</b></div>`;

    el("profile-nums").innerHTML = `
      <div class="ov-tile"><span>💰 Balance</span><b>${fmtMoney(player.balance)}</b></div>
      <div class="ov-tile"><span>💵 Salario</span><b>${fmtMoney(player.salary)}/temp</b></div>
      <div class="ov-tile"><span>💎 Mercado</span><b>${fmtMoney(calcMarketValue(player.rating, player.age))}</b></div>
      <div class="ov-tile"><span>👥 Fanáticos</span><b>${getIdolatry(player.team)}%</b></div>`;

    el("profile-records").innerHTML = `
      <div class="ov-tile"><span>🏁 Carreras</span><b>${player.totalRaces}</b></div>
      <div class="ov-tile"><span>🏆 Victorias</span><b>${player.totalWins}</b></div>
      <div class="ov-tile"><span>🥉 Podios</span><b>${player.totalPodiums}</b></div>
      <div class="ov-tile"><span>🚦 Poles</span><b>${player.totalPoles}</b></div>
      <div class="ov-tile"><span>💠 Puntos</span><b>${player.totalPoints}</b></div>
      <div class="ov-tile"><span>👑 Títulos</span><b>${player.championships}</b></div>
      <div class="ov-tile"><span>🌟 P. del Año</span><b>${player.driverAwards}</b></div>
      <div class="ov-tile"><span>🪖 Cascos de Oro</span><b>${player.goldenHelmets}</b></div>`;

    renderProfileOffers();
    renderProfileSponsor();
  }

  function offerItemHTML(offer, i) {
    const budgetTxt = fmtMoney(offer.budget != null ? offer.budget : offer.salary);
    return `
      <div class="offer-item">
        <div class="offer-item-body">
          <div class="offer-item-club">${badgeHTML(offer.club.nombre)} 🏎️ ${offer.club.nombre} <span class="offer-cat">(${offer.club.categoria})</span></div>
          <div class="offer-item-salary">💰 <strong>${fmtMoney(offer.salary)}</strong> / temporada</div>
          <div class="offer-power">Presupuesto de la escudería: ${budgetTxt}</div>
        </div>
        <div class="offer-actions">
          <button class="btn-danger offer-reject" data-index="${i}">❌ Rechazar</button>
          <button class="btn-success offer-accept" data-index="${i}">✅ Aceptar</button>
        </div>
      </div>`;
  }

  function renderProfileOffers() {
    const box = el("profile-offers");
    if (!box) return;
    if (!currentOffers.length) {
      box.innerHTML = `<p class="dim">Todavía no hay ofertas. Al terminar una temporada, los equipos pueden llamar a tu puerta.</p>`;
    } else {
      box.innerHTML = currentOffers.map((o, i) => offerItemHTML(o, i)).join("");
      currentOffers.forEach(o => fetchTeamBadge(o.club.nombre));
    }
    updateRejectAllButton();
  }

  function updateRejectAllButton() {
    el("btn-reject-all").classList.toggle("hidden", currentOffers.length === 0);
  }

  function rejectAllOffers() {
    while (currentOffers.length) rejectOffer(0);
    renderLastSeasonEvents();
    if (forcedOffers) {
      forcedOffers = false;
      renderPlayer();
      showRetiredNotice("Al rechazar todas las ofertas obligatorias, el piloto se quedó sin butaca");
      return;
    }
    forcedOffers = false;
    promotionOffers = false;
    el("btn-advance").disabled = false;
    renderProfileOffers();
  }

  function renderProfileSponsor() {
    const box = el("profile-sponsor");
    if (!box) return;
    box.innerHTML = player.chestPending
      ? `<p>Un sponsor misterioso quiere firmar contigo.</p><button id="profile-chest-btn" class="chest-btn" type="button">🎁 ¡Sponsor misterioso!</button>`
      : `<p class="dim">El sponsor misterioso puede aparecer al avanzar temporadas.</p>`;
  }

  function renderRivals() {
    const list = el("rivals-list");
    if (!list) return;
    const data = buildStandings();
    let html = `<div class="rivals-head"><span>#</span><span>Piloto</span><span>Equipo</span><span>◆ Media</span><span>TOT</span></div>`;
    data.orderedList.forEach(d => {
      const team = teamColorOf(d.team);
      const rating = d.isPlayer ? player.rating : ratingOf(d.stats);
      html += `<div class="rival-row ${d.isPlayer ? 'player' : ''}">
        <span class="r-pos">${d.pos}</span>
        <span class="r-name"><i style="background:${team}"></i>${escapeHTML(d.name)}</span>
        <span class="r-team">${escapeHTML(d.team)}</span>
        <span class="r-rating">${rating}</span>
        <span class="r-tot">${d.tot}</span>
      </div>`;
    });
    list.innerHTML = html;
  }

  function renderTrophiesView() {
    const shelf = el("trophies-view-shelf");
    if (!shelf) return;
    shelf.innerHTML = "";
    const { trophies, typeMap } = collectTrophies();
    if (Object.keys(trophies).length === 0) {
      const p = document.createElement("p");
      p.style.cssText = "color:var(--text-dim);text-align:center;padding:30px;";
      p.textContent = "La vitrina está vacía.";
      shelf.appendChild(p);
      return;
    }
    for (const [name, count] of Object.entries(trophies)) {
      const div = document.createElement("div");
      div.className = "trophy-item";
      div.innerHTML = `${trophyIconHTML(name, typeMap[name] || "other")}<div class="trophy-label">${name}</div><div class="trophy-count">x${count}</div>`;
      shelf.appendChild(div);
    }
  }

  /* ==================== Wiring nuevo ==================== */

  document.querySelectorAll(".nav-tab").forEach(t => t.addEventListener("click", () => showContent(t.dataset.view)));
  document.querySelectorAll(".sub-tab").forEach(t => t.addEventListener("click", () => showContent(t.dataset.sub)));
  el("btn-open-vitrina").addEventListener("click", () => { renderVitrina(); el("modal-vitrina").classList.remove("hidden"); });
  el("btn-season-prev").addEventListener("click", () => { if (seasonIdx > 0) { seasonIdx--; refreshSeasonNav(true); } });
  updateSeasonBar();
  updateNewsTab();
  el("btn-season-next").addEventListener("click", () => { if (seasonIdx < player.seasons.length) { seasonIdx++; refreshSeasonNav(true); } });

  window.addEventListener("resize", () => {
    updateClubs();
    ["standings-scroll", "team-scroll"].forEach(id => {
      const t = el(id) && el(id).querySelector("table");
      if (t) stretchStandings(t);
    });
  });
})();
