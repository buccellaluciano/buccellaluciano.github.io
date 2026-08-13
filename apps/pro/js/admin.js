// admin.js — panel de administración con Supabase.
// Relies on: utils.js (escapeHtml, showToast, formatDate, initTheme),
// js/supabase.js (appSupabase, getMyBusiness, onSignOut, appUrl).

// ─── STATE ───────────────────────────────────────────────────────────────────

let globalStaff    = [];
let globalServices = [];
let globalConfig   = {};
let globalPlans    = [];
let globalSubs     = [];
let globalSlots    = {};
let bizId          = null;
let bizSlug        = null;

// ─── AUTH GUARD ──────────────────────────────────────────────────────────────

(async () => {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    onSignOut(() => { window.location.href = 'login.html'; });
    initTheme();
    initBrandingSection();
    loadDashboard();
    loadBranding();
})();

// ─── CONFIG NORMALIZATION ────────────────────────────────────────────────────

function normalizeConfig(b) {
    return {
        businessName: b.business_name,
        description:  b.description,
        zone:         b.zone,
        address:      b.address,
        whatsapp:     b.whatsapp,
        openTime:     String(b.open_time || '').slice(0, 5),
        closeTime:    String(b.close_time || '').slice(0, 5),
        slotDuration: b.slot_duration,
        workingDays:  b.working_days,
        brandColor:   b.brand_color,
        bookingMode:  b.booking_mode
    };
}

// ─── SERVICES VISIBILITY ────────────────────────────────────────────────────

function syncServicesVisibility() {
    const mode      = document.querySelector('input[name="cfg-mode"]:checked')?.value;
    const isService = mode === 'service';

    // Ocultar/mostrar la pestaña "Catálogo de Servicios"
    const tabBtn = document.querySelector('.tab-btn[data-tab="tab-services"]');
    if (tabBtn) tabBtn.classList.toggle('hidden', !isService);

    // Si estaba activa y se oculta, volver a la pestaña Reservas
    if (!isService && document.getElementById('tab-services')?.classList.contains('active')) {
        document.querySelector('.tab-btn[data-tab="tab-reservas"]')?.click();
    }
}

document.querySelectorAll('input[name="cfg-mode"]').forEach(r =>
    r.addEventListener('change', syncServicesVisibility)
);

// ─── LOAD DASHBOARD ─────────────────────────────────────────────────────────

async function loadDashboard() {
    try {
        const biz = await getMyBusiness();
        if (!biz) {
            showToast('No se encontró tu negocio.', 'error');
            return;
        }
        bizId   = biz.id;
        bizSlug = biz.slug;

        const [bookingsRes, servicesRes, staffRes, plansRes, subsRes] = await Promise.all([
            appSupabase.from('bookings')
                .select('id, client_name, phone, date, time, duration, service_name, assigned_staff_id, created_at')
                .order('date', { ascending: false })
                .order('time', { ascending: false }),
            appSupabase.from('services').select('*').order('created_at'),
            appSupabase.from('staff')
                .select('id, name, email, phone, assignment_type, status, staff_services(service_id)')
                .order('created_at'),
            appSupabase.from('plans').select('*').order('created_at'),
            appSupabase.from('subscriptions').select('*').order('next_billing_date')
        ]);

        globalServices = servicesRes.data || [];
        globalStaff    = (staffRes.data || []).map(s => ({
            id:               s.id,
            name:             s.name,
            email:            s.email,
            phone:            s.phone,
            assignmentType:   s.assignment_type,
            status:           s.status,
            assignedServices: (s.staff_services || []).map(x => x.service_id)
        }));
        globalPlans    = plansRes.data || [];
        globalSubs     = subsRes.data || [];
        globalConfig   = normalizeConfig(biz);

        // Grilla de clases de los planes "por clase"
        globalSlots = {};
        await Promise.all(globalPlans.filter(p => p.style === 'pilates').map(async p => {
            const { data } = await appSupabase.rpc('get_plan_slots', { p_plan: p.id });
            globalSlots[p.id] = data || [];
        }));

        // Link público
        const publicUrl = appUrl('index.html?id=' + bizSlug);
        const linkEl    = document.getElementById('public-link');
        linkEl.href        = publicUrl;
        linkEl.textContent = publicUrl;

        // Hydrate config form
        document.getElementById('cfg-name').value     = globalConfig.businessName || '';
        document.getElementById('cfg-desc').value     = globalConfig.description  || '';
        document.getElementById('cfg-zone').value     = globalConfig.zone         || '';
        document.getElementById('cfg-address').value  = globalConfig.address      || '';
        document.getElementById('cfg-whatsapp').value = globalConfig.whatsapp     || '';
        document.getElementById('cfg-open').value     = globalConfig.openTime     || '09:00';
        document.getElementById('cfg-close').value    = globalConfig.closeTime    || '18:00';
        document.getElementById('cfg-duration').value = globalConfig.slotDuration || 60;
        document.getElementById('cfg-color').value    = globalConfig.brandColor   || '#6366f1';
        initColorPicker(globalConfig.brandColor);
        applyBrandColor(globalConfig.brandColor);

        const modeInput = document.querySelector(`input[name="cfg-mode"][value="${globalConfig.bookingMode || 'direct'}"]`);
        if (modeInput) modeInput.checked = true;
        syncServicesVisibility();

        document.querySelectorAll('#cfg-days input').forEach(cb => {
            cb.checked = (globalConfig.workingDays || []).includes(parseInt(cb.value));
        });

        renderStaffTable(globalStaff);
        renderServicesTable(globalServices);
        globalBookings = bookingsRes.data || [];
        renderBookingsTable(globalBookings, globalStaff);
        renderPlans(globalPlans);
        renderSubscriptions(globalSubs);
    } catch (err) {
        showToast('Error al cargar los datos.', 'error');
    }
}

// ─── COLOR PICKER ────────────────────────────────────────────────────────────

const COLOR_NAMES = {
    '#6366f1': 'Índigo',
    '#8b5cf6': 'Violeta',
    '#ec4899': 'Rosa',
    '#f97316': 'Naranja',
    '#eab308': 'Amarillo',
    '#10b981': 'Verde esmeralda',
    '#06b6d4': 'Cian',
    '#3b82f6': 'Azul',
    '#64748b': 'Pizarra',
    '#0f172a': 'Noche',
};

function _hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
    ];
}

function _mixColor(hex, factor) {
    const [r, g, b] = _hexToRgb(hex);
    const target = factor > 0 ? 255 : 0;
    const t = Math.abs(factor);
    const nr = Math.round(r + (target - r) * t);
    const ng = Math.round(g + (target - g) * t);
    const nb = Math.round(b + (target - b) * t);
    return `#${[nr, ng, nb].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function _hexAlpha(hex, alpha) {
    const [r, g, b] = _hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}

function applyBrandColor(color) {
    if (!color) return;
    const root = document.documentElement.style;
    root.setProperty('--brand-color', color);   // estilo público + componentes legacy
    root.setProperty('--brand',        color);   // admin.css (TailAdmin)
    root.setProperty('--brand-hover',  _mixColor(color, -0.12));
    root.setProperty('--brand-mid',    _mixColor(color,  0.25));
    root.setProperty('--brand-light',  _hexAlpha(color,  0.12));
    root.setProperty('--brand-border', _hexAlpha(color,  0.3));
    root.setProperty('--shadow-brand', `0 4px 20px ${_hexAlpha(color, 0.38)}`);
    root.setProperty('--shadow-md',    `0 4px 16px ${_hexAlpha(color, 0.22)}`);
    _updateColorPreview(color);
}

function _updateColorPreview(color) {
    const dot  = document.getElementById('color-preview-dot');
    const name = document.getElementById('color-preview-name');
    const hex  = document.getElementById('color-preview-hex');
    if (dot)  dot.style.background  = color;
    if (name) name.textContent = COLOR_NAMES[color.toLowerCase()] || 'Personalizado';
    if (hex)  hex.textContent  = color.toUpperCase();
}

let _colorPickerReady = false;

function initColorPicker(currentColor) {
    const input    = document.getElementById('cfg-color');
    const swatches = document.querySelectorAll('.color-swatch');

    const normalise  = c => (c || '#6366f1').toLowerCase();
    let   active     = normalise(currentColor);

    const markActive = (color) => {
        swatches.forEach(sw => {
            sw.classList.toggle('color-swatch--active', sw.dataset.color === color);
            sw.setAttribute('aria-checked', sw.dataset.color === color ? 'true' : 'false');
        });
    };

    const pick = (color) => {
        active      = normalise(color);
        input.value = active;
        markActive(active);
        applyBrandColor(active);
    };

    if (!_colorPickerReady) {
        swatches.forEach(sw => {
            sw.setAttribute('role', 'radio');
            sw.addEventListener('click',   ()  => pick(sw.dataset.color));
            sw.addEventListener('keydown', e   => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(sw.dataset.color); }
            });
        });
        _colorPickerReady = true;
    }

    const matchedSwatch = [...swatches].find(sw => sw.dataset.color === active);
    markActive(matchedSwatch ? active : '#6366f1');
    _updateColorPreview(active);
}

// ─── BRANDING SECTION ────────────────────────────────────────────────────────

// Cada asset: undefined = sin cambios, null = eliminar, string = nueva URL
const brandingState = { favicon: undefined, logo: undefined, background: undefined };

const BRANDING_RULES = {
    favicon:    { maxW: 512,  maxH: 512,  minW: 16,   minH: 16,   square: true,  label: 'Ícono' },
    logo:       { maxW: 800,  maxH: 300,  minW: 1,    minH: 1,    square: false, label: 'Logo' },
    background: { maxW: 8000, maxH: 8000, minW: 1200, minH: 600,  square: false, label: 'Fondo' },
};

function _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function _measureImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = reject;
        img.src = dataUrl;
    });
}

function _showBrandingError(asset, msg) {
    const el = document.getElementById(`branding-err-${asset}`);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
}

function _clearBrandingError(asset) {
    const el = document.getElementById(`branding-err-${asset}`);
    if (el) el.classList.add('hidden');
}

function _setDropzonePreview(asset, dataUrl, meta) {
    const dz    = document.getElementById(`dz-${asset}`);
    const inner = document.getElementById(`dz-${asset}-inner`);
    const prev  = document.getElementById(`prev-${asset}`);
    const img   = document.getElementById(`prev-${asset}-img`);
    const metaEl = document.getElementById(`prev-${asset}-meta`);

    if (dz)    dz.classList.add('branding-dropzone--has-file');
    if (inner) inner.classList.add('hidden');
    if (img)   img.src = dataUrl;
    if (metaEl) metaEl.textContent = meta;
    if (prev)  prev.classList.remove('hidden');
}

function _clearDropzonePreview(asset) {
    const dz    = document.getElementById(`dz-${asset}`);
    const inner = document.getElementById(`dz-${asset}-inner`);
    const prev  = document.getElementById(`prev-${asset}`);
    const img   = document.getElementById(`prev-${asset}-img`);
    const inp   = document.getElementById(`file-${asset}`);

    if (dz)    dz.classList.remove('branding-dropzone--has-file');
    if (inner) inner.classList.remove('hidden');
    if (img)   img.src = '';
    if (prev)  prev.classList.add('hidden');
    if (inp)   inp.value = '';
}

async function handleBrandingFile(asset, file) {
    _clearBrandingError(asset);
    const rules = BRANDING_RULES[asset];
    const MAX_SIZE_BYTES = 3 * 1024 * 1024;

    if (file.size > MAX_SIZE_BYTES) {
        _showBrandingError(asset, `El archivo supera el límite de 3 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
        return;
    }

    let dataUrl;
    try { dataUrl = await _fileToDataUrl(file); }
    catch { _showBrandingError(asset, 'No se pudo leer el archivo.'); return; }

    const isSvg = file.type === 'image/svg+xml';
    if (!isSvg) {
        let dims;
        try { dims = await _measureImage(dataUrl); }
        catch { _showBrandingError(asset, 'No se pudo leer las dimensiones de la imagen.'); return; }

        const { w, h } = dims;
        if (w < rules.minW || h < rules.minH) {
            _showBrandingError(asset, `${rules.label} demasiado pequeño: ${w}×${h} px. Mínimo ${rules.minW}×${rules.minH} px.`);
            return;
        }
        if (w > rules.maxW || h > rules.maxH) {
            _showBrandingError(asset, `${rules.label} demasiado grande: ${w}×${h} px. Máximo ${rules.maxW}×${rules.maxH} px.`);
            return;
        }
        if (rules.square && Math.abs(w - h) > 4) {
            _showBrandingError(asset, `${rules.label} debe ser cuadrado (${w}×${h} px detectado).`);
            return;
        }

        const sizekb = (file.size / 1024).toFixed(0);
        _setDropzonePreview(asset, dataUrl, `${w} × ${h} px · ${sizekb} KB`);
    } else {
        _setDropzonePreview(asset, dataUrl, `SVG vectorial · ${(file.size / 1024).toFixed(0)} KB`);
    }

    brandingState[asset] = dataUrl;
}

function initBrandingSection() {
    document.getElementById('open-branding-btn')?.addEventListener('click', () => {
        const sec = document.getElementById('branding-section');
        sec.classList.remove('hidden');
        sec.classList.add('fade-in');
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('close-branding-btn')?.addEventListener('click', () => {
        document.getElementById('branding-section').classList.add('hidden');
    });

    ['favicon', 'logo', 'background'].forEach(asset => {
        const inp = document.getElementById(`file-${asset}`);
        inp?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) handleBrandingFile(asset, file);
        });

        const dz = document.getElementById(`dz-${asset}`);
        dz?.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('branding-dropzone--drag'); });
        dz?.addEventListener('dragleave', () => dz.classList.remove('branding-dropzone--drag'));
        dz?.addEventListener('drop', e => {
            e.preventDefault();
            dz.classList.remove('branding-dropzone--drag');
            const file = e.dataTransfer.files[0];
            if (file) handleBrandingFile(asset, file);
        });
        dz?.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp?.click(); }
        });
    });

    document.querySelectorAll('.branding-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const asset = btn.dataset.asset;
            brandingState[asset] = null;
            _clearDropzonePreview(asset);
            _clearBrandingError(asset);
        });
    });

    document.getElementById('save-branding-btn')?.addEventListener('click', saveBranding);
}

/** Sube un archivo al bucket 'branding' y devuelve su URL pública. */
async function uploadBrandingAsset(asset, file) {
    const ext  = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${bizId}/${asset}.${ext}`;
    const { error } = await appSupabase.storage
        .from('branding')
        .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
    if (error) throw new Error(error.message);
    const { data } = appSupabase.storage.from('branding').getPublicUrl(path);
    return data.publicUrl;
}

/** Borra todos los archivos del bucket que coincidan con {business}/{asset}.* */
async function removeBrandingAssetFromStorage(asset) {
    const { data: list, error } = await appSupabase.storage
        .from('branding').list(`${bizId}`, { search: asset });
    if (error || !list || !list.length) return;
    const paths = list
        .filter(f => f.name.startsWith(`${asset}.`))
        .map(f => `${bizId}/${f.name}`);
    if (paths.length) await appSupabase.storage.from('branding').remove(paths);
}

async function loadBranding() {
    try {
        const biz = await getMyBusiness();
        if (!biz) return;
        _applyBrandingPreviews(biz.branding || {});
        _applyBrandingToPage(biz.branding || {});
    } catch { /* no crítico */ }
}

function _applyBrandingPreviews(data) {
    if (data.favicon)    _setDropzonePreview('favicon',    data.favicon,    'Guardado');
    if (data.logo)       _setDropzonePreview('logo',       data.logo,       'Guardado');
    if (data.background) _setDropzonePreview('background', data.background, 'Guardado');
}

/** Solo se aceptan URLs seguras para assets (https del storage o data:image). */
function _isSafeAssetUrl(url) {
    return typeof url === 'string' && (url.startsWith('https://') || url.startsWith('data:image/'));
}

function _applyBrandingToPage(data) {
    if (data.favicon && _isSafeAssetUrl(data.favicon)) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = data.favicon;
    }

    const logoEl = document.querySelector('.tail-logo-text');
    if (logoEl) {
        if (data.logo && _isSafeAssetUrl(data.logo)) {
            logoEl.innerHTML = `<img src="${escapeHtml(data.logo)}" alt="Logo" class="header-logo-img">`;
        } else {
            logoEl.innerHTML = `Booking<strong>Admin</strong>`;
        }
    }
}

async function saveBranding() {
    const statusEl = document.getElementById('branding-save-status');
    const saveBtn  = document.getElementById('save-branding-btn');
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Guardando…';
    if (statusEl) statusEl.textContent = '';

    const payload = {};
    const changed = Object.keys(brandingState).filter(k => brandingState[k] !== undefined);
    if (!changed.length) {
        if (statusEl) statusEl.textContent = 'Sin cambios.';
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Guardar apariencia';
        return;
    }

    try {
        // 1) Uploads / deletes en Storage
        for (const asset of changed) {
            const val = brandingState[asset];
            if (val === null) {
                await removeBrandingAssetFromStorage(asset);
                payload[asset] = null;
            } else if (typeof val === 'string' && val.startsWith('data:')) {
                const file = await (await fetch(val)).blob();
                payload[asset] = await uploadBrandingAsset(asset, file);
            } else {
                payload[asset] = val;
            }
        }

        // 2) Merge en businesses.branding
        const biz  = await getMyBusiness();
        const merged = { ...(biz.branding || {}), ...payload };
        const { error } = await appSupabase
            .from('businesses')
            .update({ branding: merged, updated_at: new Date().toISOString() })
            .eq('id', bizId);
        if (error) throw error;

        showToast('Apariencia guardada.');
        if (statusEl) statusEl.textContent = '✓ Guardado';
        _applyBrandingToPage(merged);
        Object.keys(brandingState).forEach(k => { brandingState[k] = undefined; });
    } catch (err) {
        showToast(err.message || 'Error al guardar.', 'error');
    } finally {
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Guardar apariencia';
    }
}

// ─── MODALS ──────────────────────────────────────────────────────────────────

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
});

document.querySelectorAll('.modal .btn-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal').classList.add('hidden'));
});

// ─── RENDER STAFF TABLE ─────────────────────────────────────────────────────

function renderStaffTable(staff) {
    const tbody    = document.querySelector('#staff-table tbody');
    const emptyRow = document.getElementById('no-staff-row');
    const countEl  = document.getElementById('staff-count');
    tbody.querySelectorAll('tr:not(#no-staff-row)').forEach(r => r.remove());

    const hasStaff = staff && staff.length > 0;
    emptyRow.classList.toggle('hidden', hasStaff);
    countEl.textContent = hasStaff ? staff.length : '0';
    if (!hasStaff) return;

    staff.forEach(s => {
        const contactInfo = [];
        if (s.email) contactInfo.push(`<span class="text-muted">${escapeHtml(s.email)}</span>`);
        if (s.phone) contactInfo.push(`<span class="text-muted">${escapeHtml(s.phone)}</span>`);

        let assignmentBadge = '<span class="badge badge-gray">Sin asignar</span>';
        if (s.assignmentType === 'generic') {
            assignmentBadge = '<span class="badge badge-green">Genérico</span>';
        } else if (s.assignmentType === 'specific') {
            assignmentBadge = `<span class="badge badge-brand">${(s.assignedServices || []).length} servicio(s)</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td>${contactInfo.join('<br>') || '<span class="text-muted">—</span>'}</td>
            <td>${assignmentBadge}</td>
            <td>
                <button class="btn btn-sm btn-outline-brand" data-staff-id="${escapeHtml(s.id)}"
                    style="margin-top:0;">Ver turnos</button>
            </td>
            <td>
                <button class="btn btn-sm" style="margin-top:0;background:var(--brand-mid);color:#fff;"
                    data-assign-id="${escapeHtml(s.id)}">Asignar</button>
                <button class="btn btn-sm btn-danger" data-staff-delete="${escapeHtml(s.id)}"
                    style="margin-top:0.35rem;width:auto;">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-staff-id]').forEach(btn =>
        btn.addEventListener('click', () => openShiftsModal(btn.dataset.staffId))
    );
    tbody.querySelectorAll('[data-assign-id]').forEach(btn =>
        btn.addEventListener('click', () => openAssignmentModal(btn.dataset.assignId))
    );
    tbody.querySelectorAll('[data-staff-delete]').forEach(btn =>
        btn.addEventListener('click', () => deleteStaff(btn.dataset.staffDelete))
    );
}

// ─── SHIFTS MODAL ────────────────────────────────────────────────────────────

function openShiftsModal(staffId) {
    const member = globalStaff.find(s => s.id === staffId);
    if (!member) return;
    document.getElementById('shift-staff-name').textContent = member.name;
    document.getElementById('shift-staff-id').value         = staffId;

    const openTime  = globalConfig.openTime  || '00:00';
    const closeTime = globalConfig.closeTime || '23:59';

    const startInput = document.getElementById('shift-start');
    const endInput   = document.getElementById('shift-end');
    startInput.min = openTime;
    startInput.max = closeTime;
    endInput.min   = openTime;
    endInput.max   = closeTime;

    const hintEl = document.getElementById('shift-hours-hint');
    if (hintEl) hintEl.textContent = `Horario del local: ${openTime} – ${closeTime}`;

    openModal('shifts-modal');
    loadShifts(staffId);
}

async function loadShifts(staffId) {
    try {
        const { data, error } = await appSupabase
            .from('shifts')
            .select('id, start_time, end_time, shift_date, recurring_days')
            .eq('staff_id', staffId)
            .order('created_at');
        if (error) throw error;
        const shifts = (data || []).map(s => ({
            id:            s.id,
            startTime:     String(s.start_time).slice(0, 5),
            endTime:       String(s.end_time).slice(0, 5),
            date:          s.shift_date,
            recurringDays: s.recurring_days
        }));
        renderShiftsTable(shifts, staffId);
    } catch { /* ignorado */ }
}

function renderShiftsTable(shifts, staffId) {
    const tbody    = document.querySelector('#shifts-table tbody');
    const emptyRow = document.getElementById('no-shifts-row');
    tbody.querySelectorAll('tr:not(#no-shifts-row)').forEach(r => r.remove());

    const hasShifts = shifts && shifts.length > 0;
    emptyRow.classList.toggle('hidden', hasShifts);
    if (!hasShifts) return;

    shifts.forEach(shift => {
        const type = shift.date ? `Puntual: ${escapeHtml(shift.date)}` : 'Recurrente';
        const tr   = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(shift.startTime)}</strong></td>
            <td><strong>${escapeHtml(shift.endTime)}</strong></td>
            <td><span class="badge badge-gray">${type}</span></td>
            <td>
                <button class="btn btn-sm btn-danger" data-shift-id="${escapeHtml(shift.id)}"
                    style="margin-top:0;width:auto;">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-shift-id]').forEach(btn =>
        btn.addEventListener('click', () => deleteShift(staffId, btn.dataset.shiftId))
    );
}

async function deleteShift(staffId, shiftId) {
    if (!confirm('¿Eliminar este turno?')) return;
    try {
        const { error } = await appSupabase
            .from('shifts').delete()
            .eq('id', shiftId).eq('staff_id', staffId);
        if (error) throw error;
        showToast('Turno eliminado.');
        loadShifts(staffId);
    } catch { /* ignorado */ }
}

document.getElementById('shift-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn     = e.submitter;
    btn.disabled  = true;
    const staffId = document.getElementById('shift-staff-id').value;

    const startTime = document.getElementById('shift-start').value;
    const endTime   = document.getElementById('shift-end').value;
    const openTime  = globalConfig.openTime  || '00:00';
    const closeTime = globalConfig.closeTime || '23:59';

    if (startTime < openTime || endTime > closeTime) {
        showToast(`El turno debe estar dentro del horario del local (${openTime} – ${closeTime}).`, 'error');
        btn.disabled = false;
        return;
    }
    if (startTime >= endTime) {
        showToast('El horario de inicio debe ser anterior al de fin.', 'error');
        btn.disabled = false;
        return;
    }

    const newShift = {
        staff_id:      staffId,
        start_time:    startTime,
        end_time:      endTime,
        shift_date:    document.getElementById('shift-date').value || null,
        recurring_days: Array.from(document.querySelectorAll('#shift-days input:checked')).map(cb => parseInt(cb.value))
    };

    try {
        const { error } = await appSupabase.from('shifts').insert(newShift);
        if (error) {
            showToast(error.message || 'Error al agregar turno.', 'error');
        } else {
            showToast('Turno agregado.');
            e.target.reset();
            loadShifts(staffId);
        }
    } catch { /* ignorado */ } finally {
        btn.disabled = false;
    }
});

// ─── ASSIGNMENT MODAL ────────────────────────────────────────────────────────

function openAssignmentModal(staffId) {
    const member = globalStaff.find(s => s.id === staffId);
    if (!member) return;

    document.getElementById('assignment-staff-name').textContent = member.name;
    document.getElementById('assignment-staff-id').value         = staffId;

    const currentType = member.assignmentType || 'generic';
    document.querySelectorAll('input[name="assignment-type"]').forEach(r => {
        r.checked = r.value === currentType;
    });

    populateAssignmentServices(globalServices, member.assignedServices || []);
    syncAssignmentVisibility();
    openModal('assignment-modal');
}

document.querySelectorAll('input[name="assignment-type"]').forEach(r =>
    r.addEventListener('change', syncAssignmentVisibility)
);

function syncAssignmentVisibility() {
    const type = document.querySelector('input[name="assignment-type"]:checked')?.value;
    document.getElementById('generic-assignment').classList.toggle('hidden',  type !== 'generic');
    document.getElementById('specific-assignment').classList.toggle('hidden', type !== 'specific');
}

function populateAssignmentServices(services, assignedServices) {
    const container = document.getElementById('assignment-services');
    container.innerHTML = '';

    if (!services || services.length === 0) {
        container.innerHTML = '<span class="text-muted">Sin servicios disponibles.</span>';
        return;
    }

    services.forEach(s => {
        const label = document.createElement('label');
        label.innerHTML = `
            <input type="checkbox" value="${escapeHtml(s.id)}" ${assignedServices.includes(s.id) ? 'checked' : ''}>
            <span>${escapeHtml(s.name)}</span>
        `;
        container.appendChild(label);
    });
}

document.getElementById('assignment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn    = e.submitter;
    btn.disabled = true;

    const staffId        = document.getElementById('assignment-staff-id').value;
    const assignmentType = document.querySelector('input[name="assignment-type"]:checked')?.value;
    const serviceIds     = assignmentType === 'specific'
        ? Array.from(document.querySelectorAll('#assignment-services input:checked')).map(cb => cb.value)
        : [];

    try {
        const { data, error } = await appSupabase.rpc('set_staff_assignment', {
            p_staff_id: staffId,
            p_assignment_type: assignmentType,
            p_service_ids: serviceIds
        });
        if (error || !data?.ok) {
            showToast(data?.error || error?.message || 'Error al guardar asignación.', 'error');
        } else {
            showToast('Asignación guardada.');
            closeModal('assignment-modal');
            loadDashboard();
        }
    } catch { /* ignorado */ } finally {
        btn.disabled = false;
    }
});

// ─── RENDER SERVICES TABLE ───────────────────────────────────────────────────

function renderServicesTable(services) {
    const tbody    = document.querySelector('#services-table tbody');
    const emptyRow = document.getElementById('no-services-row');
    tbody.querySelectorAll('tr:not(#no-services-row)').forEach(r => r.remove());

    const hasServices = services && services.length > 0;
    emptyRow.classList.toggle('hidden', hasServices);
    if (!hasServices) return;

    services.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${escapeHtml(s.name)}</strong>
                ${s.description ? `<br><span class="text-muted">${escapeHtml(s.description)}</span>` : ''}
            </td>
            <td><span class="badge badge-gray">${s.duration} min</span></td>
            <td>${s.price != null ? `$${parseFloat(s.price).toLocaleString('es-AR')}` : '<span class="text-muted">—</span>'}</td>
            <td>
                <button class="btn btn-sm btn-danger" data-svc-id="${escapeHtml(s.id)}"
                    style="margin-top:0;width:auto;">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-svc-id]').forEach(btn =>
        btn.addEventListener('click', () => deleteService(btn.dataset.svcId))
    );
}

// ─── RENDER BOOKINGS TABLE ───────────────────────────────────────────────────

function _bookingTime(b) { return String(b.time || '').slice(0, 5); }

// ─── ORDEN DE RESERVAS (filtros de la tab) ──────────────────────────────────

let bookingsSort = 'closest';   // 'closest' | 'farthest' | 'turns-desc' | 'turns-asc'
let globalBookings = [];

/** Fecha de referencia de un grupo según el modo de orden. */
function _groupRef(group, mode) {
    const toMs = b => new Date(`${b.date}T${_bookingTime(b)}`).getTime();
    const now  = Date.now();
    const future = group.filter(b => toMs(b) >= now);

    if (mode === 'closest') {
        // turno futuro más próximo; si no hay, el pasado más reciente
        return future.length ? Math.min(...future.map(toMs)) : Math.max(...group.map(toMs));
    }
    if (mode === 'farthest') {
        // turno futuro más lejano; si no hay, el pasado más viejo
        return future.length ? Math.max(...future.map(toMs)) : Math.min(...group.map(toMs));
    }
    return 0;
}

function renderBookingsTable(bookings, staff) {
    const tbody    = document.querySelector('#bookings-table tbody');
    const emptyRow = document.getElementById('no-bookings-row');
    const countEl  = document.getElementById('bookings-count');
    tbody.querySelectorAll('tr:not(#no-bookings-row)').forEach(r => r.remove());

    const hasBookings = bookings && bookings.length > 0;
    emptyRow.classList.toggle('hidden', hasBookings);
    countEl.textContent = hasBookings ? bookings.length : '0';
    if (!hasBookings) return;

    const sorted = [...bookings].sort(
        (a, b) => new Date(`${b.date}T${_bookingTime(b)}`) - new Date(`${a.date}T${_bookingTime(a)}`)
    );

    const groups = new Map();
    const keySeq = [];
    sorted.forEach(b => {
        const key = `${(b.client_name || '').trim().toLowerCase()}|||${(b.phone || '').trim()}`;
        if (!groups.has(key)) { groups.set(key, []); keySeq.push(key); }
        groups.get(key).push(b);
    });

    // Orden de los grupos según el filtro activo
    const sortedKeys = [...keySeq].sort((ka, kb) => {
        const ga = groups.get(ka);
        const gb = groups.get(kb);
        switch (bookingsSort) {
            case 'closest':    return _groupRef(ga, 'closest') - _groupRef(gb, 'closest');
            case 'farthest':   return _groupRef(gb, 'farthest') - _groupRef(ga, 'farthest');
            case 'turns-desc': return gb.length - ga.length;
            case 'turns-asc':  return ga.length - gb.length;
            default:           return 0;
        }
    });

    let stackIdx = 0;
    sortedKeys.forEach(key => {
        const group = groups.get(key);
        if (group.length === 1) {
            tbody.appendChild(_makeBookingRow(group[0], staff, false));
        } else {
            const stackId = `stk-${stackIdx++}`;
            tbody.appendChild(_makeStackHeader(group, staff, stackId));
            group.forEach(b => tbody.appendChild(_makeBookingRow(b, staff, true, stackId)));
        }
    });
}

function _makeBookingRow(b, staff, isChild, stackId) {
    const serviceLabel = b.service_name
        ? `<span class="badge badge-brand">${escapeHtml(b.service_name)}</span>`
        : `<span class="badge badge-gray">Estándar</span>`;

    const staffName = b.assigned_staff_id
        ? (staff?.find(s => s.id === b.assigned_staff_id)?.name || 'Sin asignar')
        : '—';

    const cancelBtn = b.id
        ? `<button class="btn btn-sm btn-danger booking-cancel-btn"
               style="margin-top:0;width:auto;">Cancelar</button>`
        : '';

    const tr = document.createElement('tr');
    if (isChild) tr.className = `booking-child booking-child--${stackId} hidden`;

    if (isChild) {
        tr.innerHTML = `
            <td class="booking-child-indent">${escapeHtml(b.date)}</td>
            <td><strong>${escapeHtml(_bookingTime(b))}</strong></td>
            <td>${serviceLabel}</td>
            <td><span class="text-muted">—</span></td>
            <td><span class="text-muted">${escapeHtml(staffName)}</span></td>
            <td><span class="text-muted">—</span></td>
            <td>${cancelBtn}</td>
        `;
    } else {
        tr.innerHTML = `
            <td>${escapeHtml(b.date)}</td>
            <td><strong>${escapeHtml(_bookingTime(b))}</strong></td>
            <td>${serviceLabel}</td>
            <td><strong>${escapeHtml(b.client_name)}</strong></td>
            <td><span class="text-muted">${escapeHtml(staffName)}</span></td>
            <td>${escapeHtml(b.phone)}</td>
            <td>${cancelBtn}</td>
        `;
    }

    if (b.id) {
        tr.querySelector('.booking-cancel-btn')
            .addEventListener('click', () => deleteBooking(b.id));
    }
    return tr;
}

function _makeStackHeader(group, staff, stackId) {
    const first  = group[0];
    const allIds = group.map(b => b.id).filter(Boolean);
    const count  = group.length;

    const now      = new Date();
    const future   = group
        .filter(b => new Date(`${b.date}T${_bookingTime(b)}`) >= now)
        .sort((a, b) => new Date(`${a.date}T${_bookingTime(a)}`) - new Date(`${b.date}T${_bookingTime(b)}`));
    const highlight = future[0] || group[0];

    const nextLabel = `${escapeHtml(highlight.date)} · <strong>${escapeHtml(_bookingTime(highlight))}</strong>`;

    const services  = [...new Set(group.map(b => b.service_name).filter(Boolean))];
    const svcSuffix = services.length
        ? services.map(s => `<span class="badge badge-brand">${escapeHtml(s)}</span>`).join(' ')
        : `<span class="badge badge-gray">Estándar</span>`;

    const tr = document.createElement('tr');
    tr.className = 'booking-stack-header';
    tr.dataset.stackId = stackId;

    tr.innerHTML = `
        <td colspan="7" class="booking-stack-cell">
            <div class="booking-stack-inner">
            <button class="booking-stack-toggle" type="button" aria-expanded="false">
                <span class="booking-stack-chevron" aria-hidden="true">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2.5"
                        stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </span>
                <div class="booking-stack-identity">
                    <strong>${escapeHtml(first.client_name)}</strong>
                    <span class="text-muted">${escapeHtml(first.phone)}</span>
                </div>
                <span class="badge badge-brand booking-stack-count">${count} turnos</span>
                <span class="booking-stack-services">${svcSuffix}</span>
                <span class="booking-stack-next text-muted">
                    Próx.&nbsp;${nextLabel}
                </span>
            </button>
            <button class="btn btn-sm btn-danger booking-stack-cancel-all"
                    type="button" style="margin-top:0;width:auto;flex-shrink:0;">
                Cancelar todos
            </button>
            </div>
        </td>
    `;

    const toggleBtn = tr.querySelector('.booking-stack-toggle');
    toggleBtn.addEventListener('click', () => _toggleStack(stackId, tr));

    tr.querySelector('.booking-stack-cancel-all')
        .addEventListener('click', () => cancelAllBookings(allIds, count));

    return tr;
}

function _toggleStack(stackId, headerRow) {
    const children = document.querySelectorAll(`.booking-child--${stackId}`);
    const isOpen   = headerRow.classList.contains('booking-stack-open');

    headerRow.classList.toggle('booking-stack-open', !isOpen);
    headerRow.querySelector('.booking-stack-toggle')
              .setAttribute('aria-expanded', String(!isOpen));

    children.forEach((tr, i) => {
        if (isOpen) {
            tr.classList.remove('booking-child-visible');
            tr.classList.add('hidden');
        } else {
            tr.classList.remove('hidden');
            tr.style.animationDelay = `${i * 35}ms`;
            tr.classList.add('booking-child-visible');
        }
    });
}

async function cancelAllBookings(ids, count) {
    if (!confirm(`¿Cancelar los ${count} turnos de este cliente? El cliente no será notificado automáticamente.`)) return;
    try {
        for (const id of ids) {
            await appSupabase.from('bookings').delete().eq('id', id).eq('business_id', bizId);
        }
        showToast(`${count} reservas canceladas.`);
        loadDashboard();
    } catch { /* ignorado */ }
}

// ─── SUSCRIPCIONES — PLANS Y SUSCRIPTORES ────────────────────────────────────

function renderPlans(plans) {
    const grid = document.getElementById('plans-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!plans || !plans.length) {
        grid.innerHTML = '<div class="subs-empty">Aún no hay planes creados. Creá un plan mensual (ej. Yoga 8 clases) para que tus clientes se suscriban.</div>';
        return;
    }

    plans.forEach(p => {
        const styleLabel = p.style === 'pilates' ? 'Por clase (Pilates)' : 'Acceso libre (Gimnasio)';
        const slotCount  = (globalSlots[p.id] || []).length;
        const capMeta    = p.style === 'pilates' ? `Clases semanales: ${slotCount}` : 'Acceso libre';
        const card = document.createElement('div');
        card.className = 'plan-card' + (p.active ? '' : ' plan-card--inactive');
        card.innerHTML = `
            <div class="plan-name">${escapeHtml(p.name)}</div>
            <div class="plan-price">$${parseFloat(p.price).toLocaleString('es-AR')}<span class="plan-per">/mes</span></div>
            <div class="plan-meta">${escapeHtml(styleLabel)} · ${escapeHtml(capMeta)} · Cobro día ${p.billing_day}</div>
            ${p.description ? `<div class="plan-meta">${escapeHtml(p.description)}</div>` : ''}
            <div class="plan-card-actions">
                <button type="button" class="btn btn-sm ${p.active ? 'btn-ghost' : 'btn-primary'}" data-plan-toggle="${escapeHtml(p.id)}">
                    ${p.active ? 'Desactivar' : 'Activar'}
                </button>
                <button type="button" class="btn btn-sm btn-danger" data-plan-delete="${escapeHtml(p.id)}">Eliminar</button>
            </div>
        `;
        grid.appendChild(card);
    });

    grid.querySelectorAll('[data-plan-toggle]').forEach(btn =>
        btn.addEventListener('click', () => togglePlan(btn.dataset.planToggle))
    );
    grid.querySelectorAll('[data-plan-delete]').forEach(btn =>
        btn.addEventListener('click', () => deletePlan(btn.dataset.planDelete))
    );
}

function _subStatusBadge(s) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = s.status === 'active' && new Date(s.next_billing_date + 'T00:00:00') < today;
    if (s.status === 'active')   return overdue
        ? '<span class="badge badge-orange">Vencida</span>'
        : '<span class="badge badge-green">Activa</span>';
    if (s.status === 'paused')   return '<span class="badge badge-gray">Pausada</span>';
    return '<span class="badge badge-gray">Cancelada</span>';
}

function renderSubscriptions(subs) {
    const tbody    = document.querySelector('#subs-table tbody');
    const emptyRow = document.getElementById('no-subs-row');
    const countEl  = document.getElementById('subs-count');
    if (!tbody) return;
    tbody.querySelectorAll('tr:not(#no-subs-row)').forEach(r => r.remove());

    const has = subs && subs.length > 0;
    if (emptyRow) emptyRow.classList.toggle('hidden', has);
    if (countEl) countEl.textContent = has ? subs.length : '0';

    // Stats (punto 4)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const active = subs.filter(s => s.status === 'active');
    const mrr = active.reduce((a, s) => a + (parseFloat(s.plan_price) || 0), 0);
    const expiring = active.filter(s => {
        const d = new Date(s.next_billing_date + 'T00:00:00');
        return d >= today && d <= in7;
    }).length;

    const elActive = document.getElementById('subs-active');
    const elMrr    = document.getElementById('subs-mrr');
    const elExp    = document.getElementById('subs-expiring');
    if (elActive) elActive.textContent = active.length;
    if (elMrr)    elMrr.textContent    = '$' + mrr.toLocaleString('es-AR');
    if (elExp)    elExp.textContent    = expiring;

    if (!has) return;

    subs.forEach(s => {
        const isActive = s.status === 'active';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(s.client_name)}</strong><br><span class="text-muted">${escapeHtml(s.phone)}</span></td>
            <td>${escapeHtml(s.plan_name)}</td>
            <td>${escapeHtml(s.start_date)}</td>
            <td>${escapeHtml(s.next_billing_date)}</td>
            <td>${_subStatusBadge(s)}</td>
            <td>
                <button type="button" class="btn btn-sm btn-outline-brand" data-sub-toggle="${escapeHtml(s.id)}" style="margin-top:0;">
                    ${isActive ? 'Pausar' : 'Reactivar'}
                </button>
                <button type="button" class="btn btn-sm btn-danger" data-sub-delete="${escapeHtml(s.id)}" style="margin-top:0.35rem;width:auto;">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-sub-toggle]').forEach(btn =>
        btn.addEventListener('click', () => toggleSubscription(btn.dataset.subToggle))
    );
    tbody.querySelectorAll('[data-sub-delete]').forEach(btn =>
        btn.addEventListener('click', () => deleteSubscription(btn.dataset.subDelete))
    );
}

async function togglePlan(id) {
    const p = globalPlans.find(x => x.id === id);
    if (!p) return;
    const { error } = await appSupabase.from('plans')
        .update({ active: !p.active }).eq('id', id).eq('business_id', bizId);
    if (error) { showToast(error.message || 'Error al actualizar plan.', 'error'); }
    else { showToast('Plan actualizado.'); loadDashboard(); }
}

async function deletePlan(id) {
    if (!confirm('¿Eliminar este plan? Las suscripciones existentes quedarán sin plan asociado.')) return;
    const { error } = await appSupabase.from('plans')
        .delete().eq('id', id).eq('business_id', bizId);
    if (error) { showToast(error.message || 'Error al eliminar plan.', 'error'); }
    else { showToast('Plan eliminado.'); loadDashboard(); }
}

async function toggleSubscription(id) {
    const s = globalSubs.find(x => x.id === id);
    if (!s) return;
    const next = s.status === 'active' ? 'paused' : 'active';
    const { error } = await appSupabase.from('subscriptions')
        .update({ status: next }).eq('id', id).eq('business_id', bizId);
    if (error) { showToast(error.message || 'Error al actualizar suscripción.', 'error'); }
    else { showToast('Suscripción actualizada.'); loadDashboard(); }
}

async function deleteSubscription(id) {
    if (!confirm('¿Eliminar esta suscripción?')) return;
    const { error } = await appSupabase.from('subscriptions')
        .delete().eq('id', id).eq('business_id', bizId);
    if (error) { showToast(error.message || 'Error al eliminar suscripción.', 'error'); }
    else { showToast('Suscripción eliminada.'); loadDashboard(); }
}

// ─── ACTIONS ─────────────────────────────────────────────────────────────────

async function deleteService(serviceId) {
    if (!confirm('¿Eliminar este servicio?')) return;
    try {
        const { error } = await appSupabase
            .from('services').delete().eq('id', serviceId).eq('business_id', bizId);
        if (error) throw error;
        showToast('Servicio eliminado.');
        loadDashboard();
    } catch { /* ignorado */ }
}

async function deleteBooking(bookingId) {
    if (!confirm('¿Cancelar esta reserva? El cliente no será notificado automáticamente.')) return;
    try {
        const { error } = await appSupabase
            .from('bookings').delete().eq('id', bookingId).eq('business_id', bizId);
        if (error) throw error;
        showToast('Reserva cancelada.');
        loadDashboard();
    } catch { /* ignorado */ }
}

async function deleteStaff(staffId) {
    if (!confirm('¿Eliminar este empleado? También se eliminarán sus turnos.')) return;
    try {
        const { error } = await appSupabase
            .from('staff').delete().eq('id', staffId).eq('business_id', bizId);
        if (error) throw error;
        showToast('Empleado eliminado.');
        loadDashboard();
    } catch { /* ignorado */ }
}

// ─── COPY LINK ───────────────────────────────────────────────────────────────

document.getElementById('copy-link-btn').addEventListener('click', async () => {
    const url = document.getElementById('public-link').textContent;
    try {
        await navigator.clipboard.writeText(url);
        showToast('Link copiado al portapapeles.');
    } catch {
        showToast('No se pudo copiar el link.', 'error');
    }
});

// ─── CONFIG FORM ─────────────────────────────────────────────────────────────

document.getElementById('config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn      = e.submitter;
    const original = btn.textContent;
    btn.disabled   = true;
    btn.textContent = 'Guardando…';

    const openTime  = document.getElementById('cfg-open').value;
    const closeTime = document.getElementById('cfg-close').value;
    if (openTime >= closeTime) {
        showToast('El horario de apertura debe ser anterior al de cierre.', 'error');
        btn.disabled    = false;
        btn.textContent = original;
        return;
    }

    const workingDays = Array.from(document.querySelectorAll('#cfg-days input:checked')).map(cb => parseInt(cb.value));
    const newConfig = {
        businessName: document.getElementById('cfg-name').value.trim(),
        description:  document.getElementById('cfg-desc').value.trim()     || null,
        zone:         document.getElementById('cfg-zone').value.trim()     || null,
        address:      document.getElementById('cfg-address').value.trim()  || null,
        whatsapp:     document.getElementById('cfg-whatsapp').value.trim() || null,
        bookingMode:  document.querySelector('input[name="cfg-mode"]:checked')?.value || 'direct',
        openTime,
        closeTime,
        slotDuration: parseInt(document.getElementById('cfg-duration').value),
        brandColor:   document.getElementById('cfg-color').value,
        workingDays
    };

    applyBrandColor(newConfig.brandColor);

    try {
        // Slug único (mismo nombre → mismo slug, excluye el propio negocio)
        const { data: slug } = await appSupabase.rpc('next_available_slug', {
            p_name:   newConfig.businessName,
            p_own_id: bizId
        });

        const { error } = await appSupabase
            .from('businesses')
            .update({
                business_name: newConfig.businessName,
                description:   newConfig.description,
                zone:          newConfig.zone,
                address:       newConfig.address,
                whatsapp:      newConfig.whatsapp,
                booking_mode:  newConfig.bookingMode,
                open_time:     newConfig.openTime,
                close_time:    newConfig.closeTime,
                slot_duration: newConfig.slotDuration,
                brand_color:   newConfig.brandColor,
                working_days:  newConfig.workingDays,
                slug:          slug,
                updated_at:    new Date().toISOString()
            })
            .eq('id', bizId);

        if (error) throw error;

        showToast('Configuración guardada.');
        bizSlug = slug;
        const newUrl = appUrl('index.html?id=' + slug);
        const linkEl = document.getElementById('public-link');
        linkEl.href        = newUrl;
        linkEl.textContent = newUrl;
    } catch (err) {
        showToast(err.message || 'Error al guardar.', 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = original;
    }
});

// ─── SERVICE FORM ────────────────────────────────────────────────────────────

document.getElementById('service-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn    = e.submitter;
    btn.disabled = true;

    const newService = {
        business_id: bizId,
        name:        document.getElementById('srv-name').value.trim(),
        duration:    parseInt(document.getElementById('srv-duration').value),
        price:       document.getElementById('srv-price').value  || null,
        description: document.getElementById('srv-desc').value.trim() || null
    };

    try {
        const { error } = await appSupabase.from('services').insert(newService);
        if (error) {
            showToast(error.message || 'Error al agregar servicio.', 'error');
        } else {
            showToast('Servicio agregado.');
            e.target.reset();
            closeModal('service-modal');
            loadDashboard();
        }
    } catch { /* ignorado */ } finally {
        btn.disabled = false;
    }
});

// ─── STAFF FORM ──────────────────────────────────────────────────────────────

document.getElementById('staff-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn    = e.submitter;
    btn.disabled = true;

    const newStaff = {
        business_id: bizId,
        name:  document.getElementById('staff-name').value.trim(),
        email: document.getElementById('staff-email').value.trim() || null,
        phone: document.getElementById('staff-phone').value.trim() || null
    };

    try {
        const { error } = await appSupabase.from('staff').insert(newStaff);
        if (error) {
            showToast(error.message || 'Error al agregar empleado.', 'error');
        } else {
            showToast('Empleado agregado.');
            e.target.reset();
            closeModal('staff-modal');
            loadDashboard();
        }
    } catch { /* ignorado */ } finally {
        btn.disabled = false;
    }
});

// ─── ABRIR MODALES DE ALTA (empleado / servicio) ─────────────────────────────

document.getElementById('open-staff-modal-btn')?.addEventListener('click', () => openModal('staff-modal'));
document.getElementById('open-service-modal-btn')?.addEventListener('click', () => openModal('service-modal'));

// ─── SUSCRIPCIONES (maqueta) ─────────────────────────────────────────────────

document.getElementById('open-plan-modal-btn')?.addEventListener('click', () => {
    // asegurar una fila de clase por defecto al abrir
    const list = document.getElementById('plan-slots-list');
    if (list && !list.children.length) addPlanSlotRow();
    openModal('plan-modal');
});

// Alternar campos según el estilo de plan (Pilates / Gimnasio)
function syncPlanStyle() {
    const style     = document.querySelector('input[name="plan-style"]:checked')?.value;
    const slotsGroup = document.getElementById('plan-slots-group');
    const gymNote    = document.getElementById('plan-gym-note');
    if (slotsGroup) slotsGroup.classList.toggle('hidden', style !== 'pilates');
    if (gymNote)    gymNote.classList.toggle('hidden', style !== 'gym');
}

// Agregar una fila de clase al editor de slots del plan
function addPlanSlotRow() {
    const list = document.getElementById('plan-slots-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'plan-slot-row';
    row.innerHTML = `
        <select class="slot-day">
            <option value="1">Lun</option>
            <option value="2">Mar</option>
            <option value="3">Mié</option>
            <option value="4">Jue</option>
            <option value="5">Vie</option>
            <option value="6">Sáb</option>
            <option value="0">Dom</option>
        </select>
        <input type="time" class="slot-start" value="09:00">
        <input type="time" class="slot-end" value="10:00">
        <input type="number" class="slot-cap" placeholder="Cupo" min="1" value="12">
        <button type="button" class="btn-close slot-remove" aria-label="Quitar clase">×</button>
    `;
    list.appendChild(row);
    row.querySelector('.slot-remove').addEventListener('click', () => row.remove());
}

document.getElementById('add-plan-slot-btn')?.addEventListener('click', addPlanSlotRow);

document.querySelectorAll('input[name="plan-style"]').forEach(r =>
    r.addEventListener('change', syncPlanStyle)
);

document.getElementById('plan-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn    = e.submitter;
    btn.disabled = true;

    const style = document.querySelector('input[name="plan-style"]:checked')?.value || 'pilates';
    const newPlan = {
        business_id: bizId,
        name:        document.getElementById('plan-name').value.trim(),
        price:       parseFloat(document.getElementById('plan-price').value) || 0,
        style,
        billing_day: parseInt(document.getElementById('plan-billing-day').value) || 1,
        description: document.getElementById('plan-desc').value.trim() || null
    };

    // Clases semanales (solo estilo "por clase")
    const slots = Array.from(document.querySelectorAll('#plan-slots-list .plan-slot-row'))
        .map(row => ({
            day_of_week: parseInt(row.querySelector('.slot-day').value),
            start_time:  row.querySelector('.slot-start').value,
            end_time:    row.querySelector('.slot-end').value,
            capacity:    parseInt(row.querySelector('.slot-cap').value) || 1
        }))
        .filter(s => s.start_time && s.end_time && s.start_time < s.end_time);

    try {
        const { data, error } = await appSupabase.from('plans').insert(newPlan).select();
        if (error) {
            showToast(error.message || 'Error al crear plan.', 'error');
        } else {
            const planId = data?.[0]?.id;
            if (style === 'pilates' && planId && slots.length) {
                await appSupabase.from('plan_slots').insert(
                    slots.map(s => ({ plan_id: planId, ...s }))
                );
            }
            showToast('Plan creado.');
            e.target.reset();
            document.getElementById('plan-slots-list').innerHTML = '';
            closeModal('plan-modal');
            syncPlanStyle();
            loadDashboard();
        }
    } catch { /* ignorado */ } finally {
        btn.disabled = false;
    }
});

// ─── LOGOUT ──────────────────────────────────────────────────────────────────

async function doLogout() {
    await appSupabase.auth.signOut();
    window.location.href = 'login.html';
}

document.getElementById('logout-btn').addEventListener('click', doLogout);
document.getElementById('confirm-logout').addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) doLogout();
});

// ─── FILTRO DE ORDEN DE RESERVAS ─────────────────────────────────────────────

document.getElementById('bookings-sort')?.addEventListener('change', e => {
    bookingsSort = e.target.value;
    renderBookingsTable(globalBookings, globalStaff);
});

/* ============================================================
   PESTAÑAS (TABS) + TEMA OSCURO + MENÚ MÓVIL
   Integrado en admin.js (reemplaza a js/panel-tabs.js)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    /* ── 1. GESTIÓN DE PESTAÑAS (TABS) ────────────────────────── */
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Desactivar todos los botones y paneles
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));

            // Activar la pestaña y el panel correspondiente
            button.classList.add('active');
            const activePanel = document.getElementById(targetTab);
            if (activePanel) {
                activePanel.classList.add('active');
            }
        });
    });

    /* ── 3. MENÚ LATERAL RESPONSIVO (MÓVIL) ──────────────────── */
    const mobileToggleBtn = document.getElementById('mobile-toggle-btn');
    const sidebar = document.getElementById('tail-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function toggleMobileSidebar() {
        if (sidebar) sidebar.classList.toggle('open');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
    }

    if (mobileToggleBtn) {
        mobileToggleBtn.addEventListener('click', toggleMobileSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleMobileSidebar);
    }

    /* ── Colapso de sidebar en desktop ───────────────────────── */
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-collapsed');
        });
    }

    /* ── Acción "Panel Principal" del sidebar → tab Reservas ──── */
    const mainBtn = document.getElementById('sidebar-main-btn');
    if (mainBtn) {
        mainBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelector('.tab-btn[data-tab="tab-reservas"]')?.click();
        });
    }

    /* ── Acción "Configuración" del sidebar → abre modal ───────── */
    const configBtn = document.getElementById('sidebar-config-btn');
    const configModal = document.getElementById('config-modal');
    if (configBtn && configModal) {
        configBtn.addEventListener('click', (e) => {
            e.preventDefault();
            configModal.classList.remove('hidden');
        });
    }
});
