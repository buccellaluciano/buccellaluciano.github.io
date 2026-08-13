// ─── SHARED UTILITY FUNCTIONS ────────────────────────────────────────────────

/**
 * Escapes HTML to prevent XSS attacks.
 * @param {string|null} str - The string to escape
 * @returns {string} - The escaped string
 */
function escapeHtml(str) {
    if (str == null) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(str).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Shows a toast notification with type (success, error, info)
 * @param {string} message - The message to display
 * @param {string} type - Type: 'success', 'error', or 'info'
 * @param {number} duration - Duration in milliseconds (default 3200ms)
 */
function showToast(message, type = 'success', duration = 3200) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) toast.remove();
        }, { once: true });
    }, duration);
}

/**
 * Formats a date string to Spanish locale format
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} - Formatted date (e.g., "jueves, 14 de abril de 2026")
 */
function formatDate(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Converts minutes to HH:MM format
 * @param {number} mins - Minutes since midnight
 * @returns {string} - Time in HH:MM format
 */
function minsToTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Converts HH:MM format to minutes
 * @param {string} str - Time in HH:MM format
 * @returns {number} - Minutes since midnight
 */
function timeToMins(str) {
    if (!str) return 0;
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
}
/**
 * Initializes dark/light theme from localStorage or OS preference.
 * Requires a #theme-toggle button and .icon-sun / .icon-moon SVGs inside it.
 * @param {string} [toggleId='theme-toggle'] - ID of the toggle button
 */
function initTheme(toggleId = 'theme-toggle') {
    const savedTheme  = localStorage.getItem('saas_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark-mode');
    }

    document.getElementById(toggleId)?.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('saas_theme', isDark ? 'dark' : 'light');
    });
}
