(function () {
  var PANELS = {
    proyectos: {
      title: "Proyectos",
      html: "<p>Estas son las aplicaciones del portafolio:</p>" +
            "<ul><li><strong>Legacy</strong> - simulador de carrera futbolística (⚽).</li>" +
            "<li><strong>ezbiz</strong> - turnos y suscripciones para negocios (📅).</li></ul>" +
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
  var APP_URLS = {
    legacy: "apps/legacy/index.html",
    pro: "apps/pro/landing.html"
  };
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
})();