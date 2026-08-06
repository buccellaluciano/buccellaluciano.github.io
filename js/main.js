(function () {
  var PANELS = {
    proyectos: {
      title: "Proyectos",
      html: "<p>Estas son las aplicaciones del portafolio. Por ahora solo hay una app publicada:</p>" +
            "<ul><li><strong>Legacy</strong> - simulador de carrera futbolística (⚽).</li></ul>" +
            "<p>El resto de los íconos del dock son placeholders para futuros proyectos.</p>"
    },
    contacto: {
      title: "Contacto",
      html: "<p></p>" +
            "<ul><li>Email: <strong>falta captcha</strong></li>" +
            "<li>GitHub: <strong>x2</strong></li>" +
            "<li>LinkedIn: <strong>x3</strong></li></ul>"
    }
  };

  var backdrop = document.getElementById("modalBackdrop");
  var modalTitle = document.getElementById("modalTitle");
  var modalBody = document.getElementById("modalBody");
  var toastEl = document.getElementById("toast");
  var toastTimer = null;

  var clockTime = document.getElementById("clockTime");
  var clockDate = document.getElementById("clockDate");

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function updateClock() {
    var now = new Date();
    clockTime.textContent = pad(now.getHours()) + ":" + pad(now.getMinutes());
    clockDate.textContent = new Intl.DateTimeFormat("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(now);
  }

  updateClock();
  setInterval(updateClock, 10000);

  var dockHandle = document.getElementById("dockHandle");
  var dockClose = document.getElementById("dockClose");

  var appFrame = document.getElementById("appFrame");
  var APP_URLS = { legacy: "apps/legacy/index.html" };
  var activeApp = null;

  function openApp(key) {
    var url = APP_URLS[key];
    if (!url) return;
    if (appFrame.src !== new URL(url, location.href).href) {
      appFrame.src = url;
    }
    activeApp = key;
    document.body.classList.add("app-open");
  }

  function closeApp() {
    activeApp = null;
    document.body.classList.remove("app-open");
  }

  Array.prototype.forEach.call(document.querySelectorAll(".dock-item[data-app]"), function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.dataset.app;
      if (activeApp === key) {
        closeApp();
      } else {
        openApp(key);
      }
    });
  });

  function setDock(open) {
    document.body.classList.toggle("dock-closed", !open);
  }

  dockHandle.addEventListener("click", function () {
    setDock(true);
  });

  dockClose.addEventListener("click", function () {
    setDock(false);
  });

  function openPanel(key) {
    var data = PANELS[key];
    if (!data) return;
    modalTitle.textContent = data.title;
    modalBody.innerHTML = data.html;
    backdrop.hidden = false;
  }

  function closeModal() {
    backdrop.hidden = true;
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 1800);
  }

  Array.prototype.forEach.call(document.querySelectorAll(".dock-item[data-panel]"), function (btn) {
    btn.addEventListener("click", function () {
      openPanel(btn.dataset.panel);
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll(".dock-placeholder"), function (btn) {
    btn.addEventListener("click", function () {
      showToast("Próximamente");
    });
  });

  document.getElementById("modalClose").addEventListener("click", closeModal);
  backdrop.addEventListener("click", function (e) {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!backdrop.hidden) {
        closeModal();
      } else if (document.body.classList.contains("app-open")) {
        closeApp();
      }
    }
  });

  var widget = document.getElementById("musicWidget");
  var musicToggle = document.getElementById("musicToggle");
  var musicPlay = document.getElementById("musicPlay");
  var musicFill = document.getElementById("musicFill");
  var musicCur = document.getElementById("musicCur");
  var musicDur = document.getElementById("musicDur");
  var musicCover = document.getElementById("musicCover");
  var musicTitle = document.getElementById("musicTitle");
  var musicArtist = document.getElementById("musicArtist");

  var volumeBar = document.getElementById("musicVolumeBar");
  var volumeFill = document.getElementById("musicVolFill");
  var volumeIcon = document.getElementById("musicVolIcon");
  var volumeSvg = document.getElementById("musicVolSvg");

  var trackIndex = 0;
  var volume = 65;
  var muted = false;
  var yt = null;
  var player = { playing: false, current: 0, duration: 0 };

  var SVG_VOL_ON = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
  var SVG_VOL_MUTED =
    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
  var SVG_PLAY =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  var SVG_PAUSE =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

  function fmtTime(s) {
    s = Math.max(0, Math.floor(s));
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function renderPlaying() {
    musicPlay.innerHTML = player.playing ? SVG_PAUSE : SVG_PLAY;
  }

  function renderVolume() {
    var level = muted || volume === 0 ? 0 : volume;
    volumeFill.style.width = level + "%";
    volumeSvg.innerHTML = level === 0 ? SVG_VOL_MUTED : SVG_VOL_ON;
    volumeIcon.setAttribute("aria-pressed", level === 0 ? "true" : "false");
    if (yt) {
      yt.setVolume(volume);
      if (muted || volume === 0) {
        yt.mute();
      } else {
        yt.unMute();
      }
    }
  }

  function loadTrack(index, autoplay) {
    var n = TRACKS.length;
    trackIndex = ((index % n) + n) % n;
    var t = TRACKS[trackIndex];
    if (yt) {
      if (autoplay) {
        yt.loadVideoById(t.id);
      } else {
        yt.cueVideoById(t.id);
      }
    }
    musicTitle.textContent = t.title;
    musicArtist.textContent = t.artist;
    musicCover.classList.add("has-art");
    musicCover.style.backgroundImage = "url(https://i.ytimg.com/vi/" + t.id + "/hqdefault.jpg)";
    player.current = 0;
    player.duration = 0;
    musicCur.textContent = "0:00";
    musicDur.textContent = "0:00";
    musicFill.style.width = "0%";
  }

  function onStateChange(event) {
    var Y = window.YT.PlayerState;
    if (event.data === Y.PLAYING) {
      player.playing = true;
      player.duration = yt.getDuration() || 0;
    } else if (event.data === Y.PAUSED || event.data === Y.ENDED) {
      player.playing = false;
    }
    renderPlaying();
    if (event.data === Y.ENDED) {
      var repeatOn = document.querySelector('.music-btn[data-act="repeat"]').classList.contains("active");
      loadTrack(repeatOn ? trackIndex : trackIndex + 1, true);
    }
  }

  musicToggle.addEventListener("click", function () {
    document.body.classList.toggle("music-collapsed");
  });

  musicPlay.addEventListener("click", function () {
    if (!yt) return;
    if (player.playing) {
      yt.pauseVideo();
    } else {
      yt.playVideo();
    }
  });

  volumeBar.addEventListener("click", function (e) {
    var rect = volumeBar.getBoundingClientRect();
    var pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    volume = Math.max(0, Math.min(100, pct));
    muted = volume === 0;
    renderVolume();
  });

  volumeIcon.addEventListener("click", function () {
    muted = !muted;
    renderVolume();
  });

  Array.prototype.forEach.call(document.querySelectorAll(".music-btn[data-act]"), function (btn) {
    btn.addEventListener("click", function () {
      var act = btn.dataset.act;
      if (act === "play") return;
      if (act === "shuffle" || act === "repeat") {
        btn.classList.toggle("active");
        return;
      }
      if (act === "prev") {
        if (yt && yt.getCurrentTime() > 4) {
          loadTrack(trackIndex, true);
        } else {
          loadTrack(trackIndex - 1, true);
        }
      } else if (act === "next") {
        loadTrack(trackIndex + 1, true);
      }
      btn.classList.add("flash");
      setTimeout(function () { btn.classList.remove("flash"); }, 150);
    });
  });

  setInterval(function () {
    if (!yt || !player.playing) return;
    var dur = yt.getDuration() || 0;
    var cur = yt.getCurrentTime() || 0;
    if (dur) player.duration = dur;
    player.current = cur;
    musicCur.textContent = fmtTime(cur);
    if (dur) musicDur.textContent = fmtTime(dur);
    musicFill.style.width = dur ? (cur / dur) * 100 + "%" : "0%";
  }, 500);

  function initYT() {
    yt = new window.YT.Player("ytHost", {
      width: "320",
      height: "180",
      playerVars: {
        enablejsapi: 1,
        autoplay: 0,
        rel: 0,
        controls: 0,
        playsinline: 1,
        fs: 0,
        modestbranding: 1
      },
      events: {
        onReady: function () {
          renderVolume();
          loadTrack(0, false);
        },
        onStateChange: onStateChange
      }
    });
  }

  if (window.YT && window.YT.Player) {
    initYT();
  } else {
    window.onYouTubeIframeAPIReady = initYT;
    var tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    var first = document.getElementsByTagName("script")[0];
    first.parentNode.insertBefore(tag, first);
  }
})();