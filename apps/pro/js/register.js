// register.js — alta de cuenta con Supabase Auth.
// El negocio se crea automáticamente por el trigger on_auth_user_created
// a partir de business_name y whatsapp en user_metadata.
// Relies on utils.js (initTheme, escapeHtml) y js/supabase.js (appSupabase).

const DOM = {
    form:            document.getElementById('register-form'),
    submitBtn:       document.getElementById('submit-btn'),
    errorEl:         document.getElementById('error-msg'),
    successEl:       document.getElementById('success-msg'),
    username:        document.getElementById('username'),
    email:           document.getElementById('email'),
    password:        document.getElementById('password'),
    passwordConfirm: document.getElementById('password-confirm'),
    businessName:    document.getElementById('business-name'),
    phone:           document.getElementById('phone')
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const hideMessages = () => {
    DOM.errorEl.classList.add('hidden');
    DOM.successEl.classList.add('hidden');
};

const showError = (msg) => {
    DOM.successEl.classList.add('hidden');
    DOM.errorEl.className   = 'alert alert-error';
    DOM.errorEl.textContent = msg;
    DOM.errorEl.classList.remove('hidden');
    DOM.errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const showSuccess = (msg) => {
    DOM.errorEl.classList.add('hidden');
    DOM.successEl.className   = 'alert alert-success';
    DOM.successEl.textContent = msg;
    DOM.successEl.classList.remove('hidden');
};

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isValidPhone = (p) => /^[\d\s\+\-\(\)]{7,}$/.test(p);

// ─── Form Submit ─────────────────────────────────────────────────────────────

DOM.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const username        = DOM.username.value.trim();
    const email           = DOM.email.value.trim();
    const password        = DOM.password.value;
    const passwordConfirm = DOM.passwordConfirm.value;
    const businessName    = DOM.businessName.value.trim();
    const phone           = DOM.phone.value.trim();

    // ── Client-side validation ───────────────────────────────────────────────

    if (!username || !email || !password || !passwordConfirm || !businessName) {
        showError('Completá todos los campos obligatorios.');
        return;
    }
    if (username.length < 3) {
        showError('El usuario debe tener al menos 3 caracteres.');
        return;
    }
    if (password.length < 6) {
        showError('La contraseña debe tener al menos 6 caracteres.');
        return;
    }
    if (password !== passwordConfirm) {
        showError('Las contraseñas no coinciden.');
        return;
    }
    if (!isValidEmail(email)) {
        showError('Ingresá un email válido.');
        return;
    }
    if (phone && !isValidPhone(phone)) {
        showError('El teléfono ingresado no parece válido.');
        return;
    }

    // ── Submit ───────────────────────────────────────────────────────────────

    DOM.submitBtn.disabled    = true;
    DOM.submitBtn.textContent = 'Creando cuenta…';

    try {
        const { data, error } = await appSupabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username,
                    business_name: businessName,
                    whatsapp: phone || null
                }
            }
        });

        if (error) {
            showError(error.message || 'Ocurrió un error al registrar.');
            return;
        }

        if (data.session) {
            // Confirmación de email desactivada → sesión inmediata
            showSuccess('¡Cuenta creada! Redirigiendo al panel…');
            setTimeout(() => { window.location.href = 'admin.html'; }, 1200);
        } else {
            // Confirmación de email activada → el negocio se crea igual por trigger
            showSuccess('¡Cuenta creada! Revisá tu email para confirmar y luego iniciá sesión.');
            setTimeout(() => { window.location.href = 'login.html'; }, 2800);
        }
    } catch {
        showError('Error de conexión. Intentá de nuevo.');
    } finally {
        DOM.submitBtn.disabled    = false;
        DOM.submitBtn.textContent = 'Crear mi negocio';
    }
});

initTheme();
