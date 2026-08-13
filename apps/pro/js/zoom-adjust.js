/* zoom-adjust.js
 * Detecta el % de zoom del navegador y expone --zoom / --zoom-scale
 * en <html> para que el CSS compense el tamaño de los elementos
 * (ver regla `html { font-size: ... }` en style.css).
 *
 * Cargar lo antes posible en <head>, antes de </head>.
 */
(function () {
    var root = document.documentElement;
    var baseDPR = window.devicePixelRatio || 1;
    var MIN_SCALE = 0.75;
    var MAX_SCALE = 1.3;

    function apply() {
        var dpr = window.devicePixelRatio || baseDPR;
        var zoomPct = Math.round((dpr / baseDPR) * 100);
        var scale = baseDPR / dpr; // inverso: compensa el zoom
        scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

        root.style.setProperty('--zoom', (zoomPct / 100).toFixed(3));
        root.style.setProperty('--zoom-scale', scale.toFixed(3));
        root.setAttribute('data-zoom', zoomPct);
        root.classList.toggle('zoom-in', zoomPct > 110);
        root.classList.toggle('zoom-out', zoomPct < 90);
    }

    function watch() {
        if (!window.matchMedia) return;
        var mq = matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
        var handler = function () {
            apply();
            mq.removeEventListener('change', handler);
            watch(); // re-engancha para el nuevo dpr
        };
        mq.addEventListener('change', handler);
    }

    apply();
    watch();
    window.addEventListener('resize', apply, { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', apply, { passive: true });
    }
})();
