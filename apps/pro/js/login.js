// login.js — login con Supabase Auth (por email).
// Relies on utils.js (initTheme) y js/supabase.js (appSupabase).

const DOM = {
    form:      document.getElementById('login-form'),
    submitBtn: document.getElementById('submit-btn'),
    errorEl:   document.getElementById('error-msg'),
    email:     document.getElementById('email'),
    password:  document.getElementById('password')
};

const hideError = () => {
    DOM.errorEl.classList.add('hidden');
    DOM.errorEl.className = 'alert alert-error hidden';
};

const showError = (msg) => {
    DOM.errorEl.className = 'alert alert-error';
    DOM.errorEl.textContent = msg;
    DOM.errorEl.classList.remove('hidden');
};

DOM.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email    = DOM.email.value.trim();
    const password = DOM.password.value;

    if (!email || !password) {
        showError('Completá todos los campos.');
        return;
    }

    DOM.submitBtn.disabled    = true;
    DOM.submitBtn.textContent = 'Entrando…';

    try {
        const { error } = await appSupabase.auth.signInWithPassword({ email, password });
        if (error) {
            showError('Usuario o contraseña incorrectos.');
        } else {
            window.location.href = 'admin.html';
        }
    } catch {
        showError('Error de conexión. Intentá de nuevo.');
    } finally {
        DOM.submitBtn.disabled    = false;
        DOM.submitBtn.textContent = 'Entrar al Panel';
    }
});

// ─── LOGIN CON GOOGLE (OAuth) ────────────────────────────────────────────────

document.getElementById('google-login-btn')?.addEventListener('click', async () => {
    hideError();
    const { error } = await appSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: appUrl('admin.html')
        }
    });
    if (error) {
        showError(error.message || 'No se pudo iniciar sesión con Google.');
    }
    // Si no hay error, el navegador redirige a Google y vuelve a admin.html
    // con la sesión en la URL (detectSessionInUrl: true la captura).
});

initTheme();
