// client.js — página pública de reservas con Supabase.
// Relies on: utils.js (escapeHtml, showToast, formatDate, initTheme,
//                        minsToTime, timeToMins), js/supabase.js (appSupabase).

// ─── STATE ───────────────────────────────────────────────────────────────────

const urlParams  = new URLSearchParams(window.location.search);
const businessId = urlParams.get('id');   // slug o UUID del negocio

let bizId = null;   // UUID interno resuelto

const _todayInit = new Date();
const calState   = { year: _todayInit.getFullYear(), month: _todayInit.getMonth() };

// ─── BRAND COLOR ─────────────────────────────────────────────────────────────

function _hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function _mixColor(hex, factor) {
    const [r,g,b] = _hexToRgb(hex);
    const t = factor > 0 ? 255 : 0, f = Math.abs(factor);
    return '#' + [r,g,b].map(v => Math.round(v+(t-v)*f).toString(16).padStart(2,'0')).join('');
}
function _hexAlpha(hex, a) {
    const [r,g,b] = _hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
}

function _applyClientBrand(color) {
    const r = document.documentElement.style;
    r.setProperty('--brand-color',  color);
    r.setProperty('--brand-hover',  _mixColor(color, -0.12));
    r.setProperty('--brand-mid',    _mixColor(color,  0.25));
    r.setProperty('--brand-light',  _hexAlpha(color,  0.12));
    r.setProperty('--shadow-brand', `0 4px 20px ${_hexAlpha(color, 0.38)}`);
    r.setProperty('--shadow-md',    `0 4px 16px ${_hexAlpha(color, 0.22)}`);
    r.setProperty('--brand-header-bg',    _hexAlpha(color, 0.08));
    r.setProperty('--brand-header-strip', color);
}

/** Solo se aceptan URLs seguras para assets (https del storage o data:image). */
function _isSafeAssetUrl(url) {
    return typeof url === 'string' && (url.startsWith('https://') || url.startsWith('data:image/'));
}

function _applyClientBranding(branding, businessName = '') {
    if (!branding) return;

    if (branding.favicon && _isSafeAssetUrl(branding.favicon)) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = branding.favicon;
    }

    if (branding.logo && _isSafeAssetUrl(branding.logo) && DOM.businessName) {
        if (businessName) DOM.businessName.dataset.name = businessName;
        const alt = escapeHtml(businessName || 'Logo');
        const src = escapeHtml(branding.logo);
        DOM.businessName.innerHTML = `<img src="${src}" alt="${alt}" class="header-logo-img">`;
    }
}

const appState = {
    mode:     'direct',
    services: [],
    staff:    [],
    config:   {},

    selectedDate:    null,
    selectedTime:    null,
    selectedStaffId: null,
    selectedService: null,

    cart:        [],
    queue:       [],
    queueIndex:  0,
    inQueueFlow: false,
};

// ─── DOM REFS ────────────────────────────────────────────────────────────────

const DOM = {
    businessName:      document.getElementById('business-name'),

    serviceSelection:  document.getElementById('service-selection'),
    dateSelection:     document.getElementById('date-selection'),
    serviceGrid:       document.getElementById('service-grid'),

    datePicker:        document.getElementById('date-picker'),
    dateError:         document.getElementById('date-error'),
    slotsContainer:    document.getElementById('slots-container'),
    slotsGrid:         document.getElementById('slots-grid'),

    dateMainStep:      document.getElementById('date-main-step'),
    cartStepHeader:    document.getElementById('cart-step-header'),
    cartStepLabel:     document.getElementById('cart-step-label'),
    cartStepFill:      document.getElementById('cart-step-fill'),
    cartStepService:   document.getElementById('cart-step-service-name'),
    cartStepBadge:     document.getElementById('cart-step-service-badge'),
    cartStepBackBtn:   document.getElementById('cart-step-back-btn'),

    cartNextWrapper:   document.getElementById('cart-next-wrapper'),
    cartSlotSummary:   document.getElementById('cart-slot-summary'),
    cartNextBtn:       document.getElementById('cart-next-btn'),

    bookingForm:       document.getElementById('booking-form'),
    nameInput:         document.getElementById('name'),
    phoneInput:        document.getElementById('phone'),
    staffSelect:       document.getElementById('staff-select'),
    staffGroup:        document.getElementById('staff-selection-group'),
    staffNoAvail:      document.getElementById('staff-no-avail'),
    staffPickInner:    document.getElementById('staff-pick-inner'),

    singleSummaryBox:  document.getElementById('single-summary-box'),
    summaryDate:       document.getElementById('summary-date'),
    summaryTime:       document.getElementById('summary-time'),
    summaryService:    document.getElementById('summary-service'),
    cartSummaryBox:    document.getElementById('cart-summary-box'),

    successMsg:        document.getElementById('success-msg'),
    successAlert:      document.getElementById('success-alert'),
    successList:       document.getElementById('success-bookings-list'),
    newBookingBtn:     document.getElementById('new-booking-btn'),

    cartPanel:         document.getElementById('cart-panel'),
    cartBadge:         document.getElementById('cart-badge'),
    cartEmptyMsg:      document.getElementById('cart-empty-msg'),
    cartItemsList:     document.getElementById('cart-items-list'),
    cartFooter:        document.getElementById('cart-footer'),
    cartTotalDuration: document.getElementById('cart-total-duration'),
    cartProceedBtn:    document.getElementById('cart-proceed-btn'),

    cartMobileBar:     document.getElementById('cart-mobile-bar'),
    cartMobileCount:   document.getElementById('cart-mobile-count'),
    cartMobileDuration: document.getElementById('cart-mobile-duration'),
    cartMobileProceed: document.getElementById('cart-mobile-proceed'),

    banner:            document.getElementById('business-banner'),
    bannerBg:          document.getElementById('banner-bg'),
    bannerBody:        document.getElementById('banner-body'),
    bannerLogo:        document.getElementById('banner-logo'),
    bannerName:        document.getElementById('banner-name'),
    bannerDesc:        document.getElementById('banner-desc'),
    bannerLocation:    document.getElementById('banner-location'),
    bannerAddressText: document.getElementById('banner-address-text'),
    bannerWaBtn:       document.getElementById('banner-wa-btn'),
    bannerMapsBtn:     document.getElementById('banner-maps-btn'),
};

// ─── GENERIC HELPERS ─────────────────────────────────────────────────────────

const showSection = id => {
    const el = document.getElementById(id);
    el?.classList.remove('hidden');
    el?.classList.add('fade-in');
};

const setStepNumbers = (dateNum, timeNum, formNum) => {
    const d = document.getElementById('date-step-num');
    const t = document.getElementById('time-step-num');
    const f = document.getElementById('form-step-num');
    if (d) d.textContent = dateNum;
    if (t) t.textContent = timeNum;
    if (f) f.textContent = formNum;
};

const fmtDuration = mins => {
    if (!mins) return '0 min';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

const resetDateArea = () => {
    if (DOM.datePicker) DOM.datePicker.value = '';
    DOM.dateError?.classList.add('hidden');
    DOM.slotsContainer?.classList.add('hidden');
    if (DOM.slotsGrid) DOM.slotsGrid.innerHTML = '';
    DOM.bookingForm?.classList.add('hidden');
    DOM.cartNextWrapper?.classList.add('hidden');
    DOM.staffGroup?.classList.add('hidden');
    DOM.staffNoAvail?.classList.add('hidden');
    DOM.staffPickInner?.classList.remove('hidden');
    if (DOM.staffSelect) DOM.staffSelect.innerHTML = '<option value="">Sin preferencia</option>';
    _unblockNextBtn();
    const td = new Date();
    calState.year  = td.getFullYear();
    calState.month = td.getMonth();
    renderCalendar();
};

// ─── BUSINESS BANNER ─────────────────────────────────────────────────────────

const renderBanner = () => {
    const { businessName, description, address, zone, whatsapp } = appState.config;
    const branding = appState.config.branding || {};
    let hasContent = false;

    if (branding.background && DOM.bannerBg) {
        DOM.bannerBg.style.backgroundImage = `url("${branding.background}")`;
        DOM.banner?.classList.add('banner--has-bg');
        hasContent = true;
    }

    if (branding.logo && DOM.bannerLogo) {
        DOM.bannerLogo.src = branding.logo;
        DOM.bannerLogo.alt = businessName || '';
        DOM.bannerLogo.classList.remove('hidden');
        hasContent = true;
    }

    if (businessName && DOM.bannerName) {
        DOM.bannerName.textContent = businessName;
        hasContent = true;
    }

    if (description && DOM.bannerDesc) {
        DOM.bannerDesc.textContent = description;
        DOM.bannerDesc.classList.remove('hidden');
        hasContent = true;
    }

    if ((address || zone) && DOM.bannerLocation) {
        const text = [address, zone].filter(Boolean).join(', ');
        if (DOM.bannerAddressText) DOM.bannerAddressText.textContent = text;
        DOM.bannerLocation.classList.remove('hidden');

        if (address && DOM.bannerMapsBtn) {
            const q = encodeURIComponent(text);
            DOM.bannerMapsBtn.href = `https://maps.google.com/?q=${q}`;
            DOM.bannerMapsBtn.classList.remove('hidden');
        }
        hasContent = true;
    }

    if (whatsapp && DOM.bannerWaBtn) {
        DOM.bannerWaBtn.href = `https://wa.me/${whatsapp.replace(/\D/g, '')}`;
        DOM.bannerWaBtn.classList.remove('hidden');
        hasContent = true;
    }

    if (hasContent) DOM.bannerBody?.classList.remove('hidden');
};

// ─── STAFF ───────────────────────────────────────────────────────────────────

const loadAvailableStaff = async (serviceId = null) => {
    try {
        const { data, error } = await appSupabase.rpc('get_eligible_staff', {
            p_biz: bizId,
            p_service_id: serviceId || null
        });
        if (error) throw new Error();
        appState.staff = data || [];
        renderStaffOptions();
    } catch {
        DOM.staffGroup?.classList.add('hidden');
    }
};

const renderStaffOptions = () => {
    DOM.staffNoAvail?.classList.add('hidden');
    DOM.staffPickInner?.classList.remove('hidden');

    if (!appState.staff.length) {
        DOM.staffGroup?.classList.add('hidden');
        _setCurrentStaffId(null);
        _unblockNextBtn();
        return;
    }

    DOM.staffGroup?.classList.remove('hidden');

    const previousId = _getCurrentStaffId();
    DOM.staffSelect.innerHTML = '<option value="">Sin preferencia</option>';

    appState.staff.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        DOM.staffSelect.appendChild(opt);
    });

    if (previousId && appState.staff.some(s => s.id === previousId)) {
        DOM.staffSelect.value = previousId;
    } else {
        _setCurrentStaffId(null);
    }

    _unblockNextBtn();
};

const _getCurrentStaffId = () =>
    appState.inQueueFlow
        ? (appState.queue[appState.queueIndex]?.staffId ?? null)
        : appState.selectedStaffId;

const _setCurrentStaffId = (val) => {
    if (appState.inQueueFlow) {
        if (appState.queue[appState.queueIndex]) {
            appState.queue[appState.queueIndex].staffId = val;
        }
    } else {
        appState.selectedStaffId = val;
    }
};

DOM.staffSelect?.addEventListener('change', e => {
    const val = e.target.value || null;
    _setCurrentStaffId(val);

    if (appState.inQueueFlow) {
        const idx  = appState.queueIndex;
        const item = appState.queue[idx];
        if (!item) return;

        if (val) {
            const found = appState.staff.find(s => s.id === val);
            item._staffName = found ? found.name : null;
        } else {
            item._staffName = null;
        }

        const isLast = idx === appState.queue.length - 1;
        if (isLast && item.time) {
            _renderCartFormSummary();
        } else if (!isLast && item.time) {
            _renderCartNextSummary(item, item.time);
        }
    }
});

// ─── CART STAFF CONFLICT DETECTION ───────────────────────────────────────────

const _getConflictingCartStaff = (date, time, duration) => {
    const conflicting = new Set();
    const reqStart    = timeToMins(time);
    const reqEnd      = reqStart + duration;

    for (let i = 0; i < appState.queueIndex; i++) {
        const item = appState.queue[i];
        if (!item.staffId || !item.date || !item.time) continue;
        if (item.date !== date) continue;

        const itemStart = timeToMins(item.time);
        const itemEnd   = itemStart + item.service.duration;

        if (reqStart < itemEnd && reqEnd > itemStart) {
            conflicting.add(item.staffId);
        }
    }
    return conflicting;
};

const _blockNextBtn = () => {
    if (DOM.cartNextBtn)       DOM.cartNextBtn.disabled = true;
    const submitBtn = DOM.bookingForm?.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
};

const _unblockNextBtn = () => {
    if (DOM.cartNextBtn)       DOM.cartNextBtn.disabled = false;
    const submitBtn = DOM.bookingForm?.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = false;
};

const loadSlotStaffAvailability = async (date, time) => {
    const qItem     = appState.inQueueFlow ? appState.queue[appState.queueIndex] : null;
    const service   = qItem?.service ?? appState.selectedService;
    const duration  = service?.duration ?? appState.config.slotDuration;
    const serviceId = service?.id ?? '';

    try {
        const { data, error } = await appSupabase.rpc('get_free_staff', {
            p_biz:       bizId,
            p_date:      date,
            p_time:      time,
            p_duration:  duration,
            p_service_id: serviceId || null
        });
        if (error) throw new Error();
        const serverStaff = data || [];

        if (appState.inQueueFlow && serverStaff.length > 0) {
            const conflicting = _getConflictingCartStaff(date, time, duration);
            if (conflicting.size > 0) {
                appState.staff = serverStaff.filter(s => !conflicting.has(s.id));

                if (appState.staff.length === 0) {
                    DOM.staffGroup?.classList.remove('hidden');
                    DOM.staffNoAvail?.classList.remove('hidden');
                    DOM.staffPickInner?.classList.add('hidden');
                    _blockNextBtn();
                    return;
                }
            } else {
                appState.staff = serverStaff;
            }
        } else {
            appState.staff = serverStaff;
        }

        renderStaffOptions();
    } catch {
        // best-effort: conservar lista previa
    }
};

// ─── CUSTOM CALENDAR ─────────────────────────────────────────────────────────

const MONTHS_ES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const renderCalendar = () => {
    const { year, month } = calState;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const labelEl = document.getElementById('cal-month-label');
    if (labelEl) labelEl.textContent = `${MONTHS_ES[month]} ${year}`;

    const prevBtn = document.getElementById('cal-prev-btn');
    if (prevBtn) {
        prevBtn.disabled = year === today.getFullYear() && month === today.getMonth();
    }

    const grid = document.getElementById('cal-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const selStr    = DOM.datePicker?.value ?? '';
    const selDate   = selStr ? new Date(selStr + 'T00:00:00') : null;
    const workDays  = appState.config.workingDays ?? [];

    const firstDow     = new Date(year, month, 1).getDay();
    const startOffset  = (firstDow + 6) % 7;
    const daysInMonth  = new Date(year, month + 1, 0).getDate();
    const prevMonDays  = new Date(year, month, 0).getDate();
    const totalCells   = startOffset + daysInMonth;
    const trailingFill = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

    const makeCell = (label, classes, clickable, dateStr) => {
        const btn = document.createElement('button');
        btn.type        = 'button';
        btn.textContent = label;
        btn.className   = ['cal-day', ...classes].join(' ');
        if (!clickable) btn.disabled = true;
        if (clickable && dateStr) {
            btn.addEventListener('click', () => _selectCalendarDay(dateStr, btn));
        }
        return btn;
    };

    for (let i = 0; i < startOffset; i++) {
        grid.appendChild(makeCell(prevMonDays - startOffset + 1 + i, ['cal-day--other'], false));
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const date   = new Date(year, month, d);
        const dow    = date.getDay();
        const dStr   = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isPast = date < today;
        const isWork = workDays.includes(dow);
        const isTdy  = date.getTime() === today.getTime();
        const isSel  = selDate && date.getTime() === selDate.getTime();

        const cls = [];
        if (isTdy)               cls.push('cal-day--today');
        if (isSel)               cls.push('cal-day--selected');
        if (isPast || !isWork)   cls.push('cal-day--disabled');

        grid.appendChild(makeCell(d, cls, !isPast && isWork, dStr));
    }

    for (let i = 1; i <= trailingFill; i++) {
        grid.appendChild(makeCell(i, ['cal-day--other'], false));
    }
};

const navigateCalendarTo = (dateStr) => {
    if (!dateStr) return;
    const d = new Date(dateStr + 'T00:00:00');
    calState.year  = d.getFullYear();
    calState.month = d.getMonth();
    renderCalendar();
};

const _selectCalendarDay = (dateStr, cell) => {
    document.querySelectorAll('.cal-day--selected')
        .forEach(c => c.classList.remove('cal-day--selected'));
    cell.classList.add('cal-day--selected');

    if (DOM.datePicker) {
        DOM.datePicker.value = dateStr;
        DOM.datePicker.dispatchEvent(new Event('change', { bubbles: true }));
    }
};

// ─── DATE PICKER — event wiring ──────────────────────────────────────────────

const setupDatePicker = () => {
    renderCalendar();

    document.getElementById('cal-prev-btn')?.addEventListener('click', () => {
        calState.month--;
        if (calState.month < 0) { calState.month = 11; calState.year--; }
        renderCalendar();
    });
    document.getElementById('cal-next-btn')?.addEventListener('click', () => {
        calState.month++;
        if (calState.month > 11) { calState.month = 0; calState.year++; }
        renderCalendar();
    });

    DOM.datePicker.addEventListener('change', e => {
        const date      = e.target.value;
        const dayOfWeek = new Date(date + 'T00:00:00').getDay();

        DOM.dateError?.classList.add('hidden');
        DOM.slotsContainer?.classList.add('hidden');
        DOM.bookingForm?.classList.add('hidden');
        DOM.cartNextWrapper?.classList.add('hidden');
        DOM.staffGroup?.classList.add('hidden');

        if (appState.inQueueFlow) {
            appState.queue[appState.queueIndex].time = null;
        } else {
            appState.selectedTime = null;
        }

        if (!(appState.config.workingDays || []).includes(dayOfWeek)) {
            DOM.dateError.textContent = 'Ese día no es laborable. Elegí otro.';
            DOM.dateError?.classList.remove('hidden');
            return;
        }

        if (appState.inQueueFlow) {
            appState.queue[appState.queueIndex].date = date;
            fetchSlots(date);
        } else {
            if (appState.mode === 'service' && !appState.selectedService) {
                DOM.dateError.textContent = 'Primero elegí un servicio.';
                DOM.dateError?.classList.remove('hidden');
                return;
            }
            appState.selectedDate = date;
            fetchSlots(date);
        }
    });
};

// ─── SLOTS ───────────────────────────────────────────────────────────────────

const SLOT_GROUPS = [
    { label: 'Mañana',  from: 0,    to: 720  },
    { label: 'Tarde',   from: 720,  to: 1080 },
    { label: 'Noche',   from: 1080, to: 1440 },
];

const fetchSlots = async (date) => {
    const qItem     = appState.inQueueFlow ? appState.queue[appState.queueIndex] : null;
    const service   = qItem?.service ?? appState.selectedService;
    const duration  = service?.duration ?? appState.config.slotDuration;
    const serviceId = service?.id ?? '';

    if (DOM.slotsGrid) DOM.slotsGrid.innerHTML =
        '<div class="slots-loading"><span class="spinner"></span>Cargando horarios…</div>';
    DOM.slotsContainer?.classList.remove('hidden');
    DOM.bookingForm?.classList.add('hidden');
    DOM.cartNextWrapper?.classList.add('hidden');

    try {
        const { data, error } = await appSupabase.rpc('get_available_slots', {
            p_biz:        bizId,
            p_date:       date,
            p_service_id: serviceId || null,
            p_duration:   duration
        });
        if (error) throw new Error();
        const slots = data || [];
        if (DOM.slotsGrid) DOM.slotsGrid.innerHTML = '';

        if (!slots.length) {
            if (DOM.slotsGrid) DOM.slotsGrid.innerHTML =
                '<p class="text-muted" style="padding:1rem 0;">No hay horarios disponibles para este día.</p>';
            return;
        }

        const grouped = { Mañana: [], Tarde: [], Noche: [] };
        slots.forEach(slot => {
            const m = timeToMins(slot);
            const g = SLOT_GROUPS.find(g => m >= g.from && m < g.to);
            if (g) grouped[g.label].push(slot);
        });

        SLOT_GROUPS.forEach(({ label }) => {
            if (!grouped[label].length) return;

            const section = document.createElement('div');
            section.className = 'slots-section';

            const hdr = document.createElement('div');
            hdr.className   = 'slots-section-label';
            hdr.textContent = label;
            section.appendChild(hdr);

            const inner = document.createElement('div');
            inner.className = 'slots-inner-grid';

            grouped[label].forEach(slot => {
                const btn = document.createElement('button');
                btn.className    = 'slot-btn';
                btn.type         = 'button';
                btn.dataset.slot = slot;
                btn.innerHTML    = `<span class="slot-time">${slot}</span>`;
                btn.addEventListener('click', () => selectSlot(slot, btn));
                inner.appendChild(btn);
            });

            section.appendChild(inner);
            DOM.slotsGrid.appendChild(section);
        });
    } catch {
        if (DOM.slotsGrid) DOM.slotsGrid.innerHTML =
            '<p class="text-muted">Error al cargar los horarios. Intentá de nuevo.</p>';
    }
};

const selectSlot = async (time, btn) => {
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (appState.inQueueFlow) {
        const item   = appState.queue[appState.queueIndex];
        item.time    = time;
        item.staffId = null;
        item._staffName = null;
        const isLast = appState.queueIndex === appState.queue.length - 1;

        await loadSlotStaffAvailability(item.date, time);

        DOM.staffGroup?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        if (isLast) {
            _renderCartFormSummary();
            DOM.bookingForm?.classList.remove('hidden');
            DOM.bookingForm?.classList.add('fade-in');
            DOM.cartNextWrapper?.classList.add('hidden');
        } else {
            _renderCartNextSummary(item, time);
            DOM.cartNextWrapper?.classList.remove('hidden');
            DOM.cartNextWrapper?.classList.add('fade-in');
            DOM.bookingForm?.classList.add('hidden');
        }

    } else {
        appState.selectedTime = time;

        if (DOM.summaryDate) DOM.summaryDate.textContent = formatDate(appState.selectedDate);
        if (DOM.summaryTime) DOM.summaryTime.textContent = time;

        if (appState.mode === 'service' && appState.selectedService) {
            if (DOM.summaryService) {
                DOM.summaryService.textContent = `Servicio: ${appState.selectedService.name}`;
                DOM.summaryService.classList.remove('hidden');
            }
        } else {
            DOM.summaryService?.classList.add('hidden');
        }

        await loadSlotStaffAvailability(appState.selectedDate, time);

        DOM.bookingForm?.classList.remove('hidden');
        DOM.bookingForm?.classList.add('fade-in');
        DOM.bookingForm?.scrollIntoView({ behavior: 'smooth' });
    }
};

// ─── CART — STATE MANAGEMENT ─────────────────────────────────────────────────

const cartGetQty = serviceId =>
    appState.cart.find(i => i.service.id === serviceId)?.qty ?? 0;

const cartSetQty = (service, qty) => {
    const clamped = Math.max(0, Math.min(5, qty));
    const idx = appState.cart.findIndex(i => i.service.id === service.id);

    if (clamped === 0) {
        if (idx !== -1) appState.cart.splice(idx, 1);
    } else if (idx !== -1) {
        appState.cart[idx].qty = clamped;
    } else {
        appState.cart.push({ service, qty: clamped });
    }

    _syncServiceCardQty(service.id);
    renderCartPanel();
};

const cartTotalCount    = () => appState.cart.reduce((a, i) => a + i.qty, 0);
const cartTotalDuration = () => appState.cart.reduce((a, i) => a + i.service.duration * i.qty, 0);

// ─── CART — PANEL RENDERING ──────────────────────────────────────────────────

const renderCartPanel = () => {
    const count = cartTotalCount();
    const total = cartTotalDuration();

    if (DOM.cartBadge) {
        DOM.cartBadge.textContent = count;
        DOM.cartBadge.classList.toggle('hidden', count === 0);
    }

    if (count === 0) {
        DOM.cartEmptyMsg?.classList.remove('hidden');
        DOM.cartItemsList?.classList.add('hidden');
        DOM.cartFooter?.classList.add('hidden');
    } else {
        DOM.cartEmptyMsg?.classList.add('hidden');
        DOM.cartItemsList?.classList.remove('hidden');
        DOM.cartFooter?.classList.remove('hidden');

        if (DOM.cartItemsList) {
            DOM.cartItemsList.innerHTML = appState.cart.map(({ service, qty }) => `
                <div class="cart-item-row" data-sid="${service.id}">
                    <div class="cart-item-info">
                        <span class="cart-item-name">${escapeHtml(service.name)}</span>
                        <span class="cart-item-meta text-muted">
                            ⏱ ${service.duration} min${service.price != null
                                ? ` · $${parseFloat(service.price).toLocaleString('es-AR')}` : ''}
                        </span>
                    </div>
                    <div class="cart-item-qty-wrap">
                        <button class="qty-btn qty-minus" type="button"
                            data-sid="${service.id}" aria-label="Quitar uno">−</button>
                        <span class="qty-value">${qty}</span>
                        <button class="qty-btn qty-plus" type="button"
                            data-sid="${service.id}" aria-label="Agregar uno"
                            ${qty >= 5 ? 'disabled' : ''}>+</button>
                    </div>
                </div>
            `).join('');

            DOM.cartItemsList.querySelectorAll('.qty-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const item = appState.cart.find(i => i.service.id === btn.dataset.sid);
                    if (!item) return;
                    cartSetQty(item.service, item.qty + (btn.classList.contains('qty-plus') ? 1 : -1));
                });
            });
        }

        if (DOM.cartTotalDuration) DOM.cartTotalDuration.textContent = fmtDuration(total);
    }

    if (DOM.cartMobileBar) {
        DOM.cartMobileBar.classList.toggle('hidden', count === 0);
        if (count > 0) {
            if (DOM.cartMobileCount)
                DOM.cartMobileCount.textContent = `${count} ${count === 1 ? 'servicio' : 'servicios'}`;
            if (DOM.cartMobileDuration)
                DOM.cartMobileDuration.textContent = fmtDuration(total);
        }
    }
};

const _syncServiceCardQty = serviceId => {
    const card = document.querySelector(`.service-card[data-sid="${serviceId}"]`);
    if (!card) return;
    const qty       = cartGetQty(serviceId);
    const valEl     = card.querySelector('.qty-value');
    const minusBtn  = card.querySelector('.qty-btn.qty-minus');
    const plusBtn   = card.querySelector('.qty-btn.qty-plus');
    const limitMsg  = card.querySelector('.qty-limit-msg');

    if (valEl)   valEl.textContent   = qty;
    if (minusBtn) minusBtn.disabled  = qty <= 0;
    if (plusBtn)  plusBtn.disabled   = qty >= 5;
    if (limitMsg) limitMsg.classList.toggle('hidden', qty < 5);

    card.classList.toggle('in-cart', qty > 0);
};

// ─── CART — BOOKING QUEUE FLOW ───────────────────────────────────────────────

const buildQueue = () => {
    appState.queue = [];
    appState.cart.forEach(({ service, qty }) => {
        for (let i = 0; i < qty; i++) {
            appState.queue.push({ service, date: null, time: null, staffId: null });
        }
    });
    appState.queueIndex = 0;
};

const startCartFlow = () => {
    if (cartTotalCount() === 0) return;
    buildQueue();
    appState.inQueueFlow = true;

    DOM.serviceSelection?.classList.add('hidden');

    showSection('date-selection');
    DOM.cartStepHeader?.classList.remove('hidden');
    DOM.dateMainStep?.classList.add('hidden');

    showQueueStep(0);
    DOM.dateSelection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const showQueueStep = index => {
    appState.queueIndex = index;
    const item  = appState.queue[index];
    const total = appState.queue.length;

    resetDateArea();

    if (DOM.cartStepLabel)
        DOM.cartStepLabel.textContent = `Turno ${index + 1} de ${total}`;

    if (DOM.cartStepFill)
        DOM.cartStepFill.style.width = `${((index + 1) / total) * 100}%`;

    if (DOM.cartStepService)
        DOM.cartStepService.textContent = item.service.name;

    if (DOM.cartStepBadge) {
        const sameServiceItems = appState.queue.filter(q => q.service.id === item.service.id);
        if (sameServiceItems.length > 1) {
            const nthOfService = appState.queue
                .slice(0, index + 1)
                .filter(q => q.service.id === item.service.id).length;
            DOM.cartStepBadge.textContent = `${nthOfService} de ${sameServiceItems.length}`;
            DOM.cartStepBadge.classList.remove('hidden');
        } else {
            DOM.cartStepBadge.classList.add('hidden');
        }
    }

    if (DOM.cartStepBackBtn)
        DOM.cartStepBackBtn.textContent = index === 0 ? '← Volver al catálogo' : '← Turno anterior';

    if (item.date) {
        DOM.datePicker.value = item.date;
        navigateCalendarTo(item.date);
        fetchSlots(item.date).then(() => {
            if (item.time) {
                document.querySelectorAll('.slot-btn').forEach(b => {
                    if (b.dataset.slot === item.time) b.classList.add('active');
                });
                const isLast = index === total - 1;
                if (isLast) {
                    _renderCartFormSummary();
                    DOM.bookingForm?.classList.remove('hidden');
                } else {
                    _renderCartNextSummary(item, item.time);
                    DOM.cartNextWrapper?.classList.remove('hidden');
                }
            }
        });
    }
};

const advanceQueue = () => {
    _cacheStaffName(appState.queueIndex);
    if (appState.queueIndex < appState.queue.length - 1) {
        showQueueStep(appState.queueIndex + 1);
        DOM.dateSelection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

const goBackInQueue = () => {
    if (appState.queueIndex > 0) {
        showQueueStep(appState.queueIndex - 1);
        DOM.dateSelection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        _exitCartFlow();
    }
};

const _exitCartFlow = () => {
    appState.inQueueFlow = false;
    appState.queue       = [];
    appState.queueIndex  = 0;

    DOM.cartStepHeader?.classList.add('hidden');
    DOM.dateMainStep?.classList.remove('hidden');
    DOM.dateSelection?.classList.add('hidden');

    showSection('service-selection');
    resetDateArea();
    DOM.serviceSelection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const _staffName = (staffId) => {
    if (!staffId) return 'Sin preferencia';
    const found = appState.staff.find(s => s.id === staffId);
    if (found) return found.name;
    for (const item of appState.queue) {
        if (item._staffName && item.staffId === staffId) return item._staffName;
    }
    return 'Empleado asignado';
};

const _cacheStaffName = (index) => {
    const item = appState.queue[index];
    if (!item) return;
    if (item.staffId) {
        const found = appState.staff.find(s => s.id === item.staffId);
        if (found) item._staffName = found.name;
    } else {
        item._staffName = null;
    }
};

const _renderCartNextSummary = (item, time) => {
    if (!DOM.cartSlotSummary) return;
    const staffLabel = item.staffId
        ? `<span class="cart-slot-staff">👤 ${escapeHtml(_staffName(item.staffId))}</span>`
        : `<span class="cart-slot-staff text-muted">👤 Sin preferencia</span>`;

    DOM.cartSlotSummary.innerHTML = `
        <div class="cart-slot-confirmed">
            <span class="cart-slot-check">✓</span>
            <div class="cart-slot-confirmed-info">
                <strong>${escapeHtml(item.service.name)}</strong>
                <span class="text-muted">${formatDate(item.date)} · <strong>${time}</strong></span>
                ${staffLabel}
            </div>
        </div>
    `;
    const remaining = appState.queue.length - appState.queueIndex - 1;
    if (DOM.cartNextBtn) {
        DOM.cartNextBtn.textContent = remaining === 1
            ? 'Último turno →'
            : `Siguiente turno (${remaining} restantes) →`;
    }
};

const _renderCartFormSummary = () => {
    DOM.singleSummaryBox?.classList.add('hidden');

    if (DOM.cartSummaryBox) {
        DOM.cartSummaryBox.classList.remove('hidden');

        const rows = appState.queue.map((item, i) => {
            const name = item.staffId
                ? escapeHtml(item._staffName || _staffName(item.staffId))
                : '<span class="text-muted">Sin preferencia</span>';
            return `
                <div class="cart-summary-row">
                    <span class="cart-summary-num">${i + 1}</span>
                    <div class="cart-summary-detail">
                        <strong>${escapeHtml(item.service.name)}</strong>
                        <span class="text-muted">
                            ${formatDate(item.date)}
                            <span class="cart-summary-time-pill">${item.time}</span>
                        </span>
                        <span class="cart-summary-staff">👤 ${name}</span>
                    </div>
                    <span class="cart-summary-dur text-muted">⏱ ${item.service.duration} min</span>
                </div>
            `;
        }).join('');

        const totalDur = appState.queue.reduce((a, q) => a + q.service.duration, 0);
        DOM.cartSummaryBox.innerHTML = `
            <p class="summary-main" style="margin-bottom:0.85rem">
                📋 Resumen de turnos
                <span class="badge badge-brand" style="margin-left:0.5rem">
                    ${appState.queue.length} ${appState.queue.length === 1 ? 'turno' : 'turnos'}
                </span>
            </p>
            <div class="cart-summary-list">${rows}</div>
            <p class="cart-summary-total text-muted">
                Tiempo total estimado: <strong>${fmtDuration(totalDur)}</strong>
            </p>
        `;
    }
};

// ─── CART — EVENT LISTENERS ──────────────────────────────────────────────────

DOM.cartNextBtn?.addEventListener('click', advanceQueue);
DOM.cartStepBackBtn?.addEventListener('click', goBackInQueue);
DOM.cartProceedBtn?.addEventListener('click', startCartFlow);
DOM.cartMobileProceed?.addEventListener('click', startCartFlow);

// ─── SERVICE MODE ────────────────────────────────────────────────────────────

const setupServiceMode = async () => {
    DOM.cartPanel?.classList.remove('hidden');
    renderCartPanel();

    try {
        const { data, error } = await appSupabase
            .from('services')
            .select('id, name, duration, price, description')
            .eq('business_id', bizId)
            .order('created_at');
        if (error) throw new Error();
        appState.services = data || [];
        DOM.serviceGrid.innerHTML = '';

        if (!appState.services.length) {
            DOM.serviceGrid.innerHTML = '<p class="text-muted">No hay servicios disponibles.</p>';
        } else {
            appState.services.forEach(_renderServiceCard);
        }

        showSection('service-selection');
        setStepNumbers(2, 3, 4);
        document.getElementById('date-step-title').textContent = 'Elegí una fecha';
    } catch {
        DOM.serviceGrid.innerHTML = '<p class="text-muted">Error al cargar servicios.</p>';
    }
};

const _renderServiceCard = service => {
    const div = document.createElement('div');
    div.className = 'service-card';
    div.setAttribute('data-sid', service.id);

    div.innerHTML = `
        <h4>${escapeHtml(service.name)}</h4>
        <p class="text-muted">${escapeHtml(service.description || '')}</p>
        <div class="service-meta">
            <span>⏱ ${service.duration} min</span>
            ${service.price != null
                ? `<span>$${parseFloat(service.price).toLocaleString('es-AR')}</span>`
                : ''}
        </div>
        <div class="qty-row">
            <button class="qty-btn qty-minus" type="button" disabled aria-label="Quitar uno">−</button>
            <span class="qty-value">0</span>
            <button class="qty-btn qty-plus" type="button" aria-label="Agregar uno">+</button>
            <span class="qty-limit-msg hidden text-muted">máx.</span>
        </div>
    `;

    div.querySelector('.qty-minus').addEventListener('click', e => {
        e.stopPropagation();
        cartSetQty(service, cartGetQty(service.id) - 1);
    });
    div.querySelector('.qty-plus').addEventListener('click', e => {
        e.stopPropagation();
        cartSetQty(service, cartGetQty(service.id) + 1);
    });

    DOM.serviceGrid.appendChild(div);
};

// ─── BOOKING SUBMIT ──────────────────────────────────────────────────────────

DOM.bookingForm?.addEventListener('submit', async e => {
    e.preventDefault();

    const name  = DOM.nameInput?.value.trim();
    const phone = DOM.phoneInput?.value.trim();

    if (!name || !phone) {
        showToast('Completá nombre y teléfono.', 'error');
        return;
    }

    const btn = e.submitter;
    btn.disabled    = true;
    btn.textContent = 'Confirmando…';

    try {
        if (appState.inQueueFlow) {
            await _submitCartBookings(name, phone);
        } else {
            await _submitDirectBooking(name, phone);
        }
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Confirmar reserva';
    }
});

/** Llama a create_booking (RPC) y devuelve { ok, error } */
async function _rpcBooking(payload) {
    const { data, error } = await appSupabase.rpc('create_booking', payload);
    if (error) return { ok: false, error: error.message || 'Error de conexión.' };
    if (data && data.ok) return { ok: true };
    return { ok: false, error: data?.error || 'Ese turno ya fue tomado. Por favor elegí otro.' };
}

const _submitDirectBooking = async (name, phone) => {
    const payload = {
        p_biz:               bizId,
        p_date:              appState.selectedDate,
        p_time:              appState.selectedTime,
        p_name:              name,
        p_phone:             phone,
        p_service_name:      appState.selectedService?.name     ?? null,
        p_service_id:        appState.selectedService?.id       ?? null,
        p_duration:          appState.selectedService?.duration ?? appState.config.slotDuration,
        p_assigned_staff_id: appState.selectedStaffId           ?? null,
    };

    const res = await _rpcBooking(payload);

    if (res.ok) {
        DOM.bookingForm?.classList.add('hidden');
        DOM.slotsContainer?.classList.add('hidden');
        DOM.staffGroup?.classList.add('hidden');
        showSection('success-msg');
        if (DOM.successAlert) {
            DOM.successAlert.className = 'alert alert-success alert-success-lg';
            DOM.successAlert.textContent = '✓ ¡Reserva confirmada! Te esperamos.';
        }
        DOM.successList?.classList.add('hidden');
    } else {
        showToast(res.error, 'error');
        fetchSlots(appState.selectedDate);
    }
};

const _submitCartBookings = async (name, phone) => {
    const results = [];

    for (const item of appState.queue) {
        const payload = {
            p_biz:               bizId,
            p_date:              item.date,
            p_time:              item.time,
            p_name:              name,
            p_phone:             phone,
            p_service_name:      item.service.name,
            p_service_id:        item.service.id,
            p_duration:          item.service.duration,
            p_assigned_staff_id: item.staffId ?? null,
        };

        const res = await _rpcBooking(payload);
        results.push({ item, ok: res.ok, error: res.error });
    }

    DOM.bookingForm?.classList.add('hidden');
    DOM.slotsContainer?.classList.add('hidden');
    DOM.cartNextWrapper?.classList.add('hidden');

    const allOk  = results.every(r => r.ok);
    const someOk = results.some(r => r.ok);

    if (DOM.successAlert) {
        if (allOk) {
            DOM.successAlert.className   = 'alert alert-success alert-success-lg';
            const n = results.length;
            DOM.successAlert.textContent = n === 1
                ? '✓ ¡Reserva confirmada! Te esperamos.'
                : `✓ ¡${n} reservas confirmadas! Te esperamos.`;
        } else if (someOk) {
            DOM.successAlert.className   = 'alert alert-info alert-success-lg';
            DOM.successAlert.textContent = '⚠ Algunas reservas no pudieron confirmarse. Revisá los detalles.';
        } else {
            DOM.successAlert.className   = 'alert alert-error alert-success-lg';
            DOM.successAlert.textContent = '✕ No se pudo confirmar ninguna reserva. Por favor intentá de nuevo.';
        }
    }

    if (DOM.successList) {
        DOM.successList.classList.remove('hidden');
        DOM.successList.innerHTML = results.map(({ item, ok, error }) => {
            const staffLine = item.staffId
                ? `<span class="text-muted">👤 ${escapeHtml(item._staffName || 'Empleado asignado')}</span>`
                : `<span class="text-muted">👤 Sin preferencia</span>`;
            return `
                <div class="success-booking-item ${ok ? 'success-booking-ok' : 'success-booking-err'}">
                    <div class="success-booking-icon">${ok ? '✓' : '✕'}</div>
                    <div class="success-booking-info">
                        <strong>${escapeHtml(item.service.name)}</strong>
                        <span class="text-muted">${formatDate(item.date)} · <strong>${item.time}</strong></span>
                        ${staffLine}
                        ${!ok && error ? `<span class="success-booking-error-msg">${escapeHtml(error)}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    showSection('success-msg');
};

// ─── NUEVA RESERVA ───────────────────────────────────────────────────────────

DOM.newBookingBtn?.addEventListener('click', () => {
    appState.selectedDate    = null;
    appState.selectedTime    = null;
    appState.selectedStaffId = null;
    appState.selectedService = null;
    appState.inQueueFlow     = false;
    appState.cart            = [];
    appState.queue           = [];
    appState.queueIndex      = 0;

    resetDateArea();
    if (DOM.nameInput)  DOM.nameInput.value  = '';
    if (DOM.phoneInput) DOM.phoneInput.value = '';

    DOM.successMsg?.classList.add('hidden');
    DOM.successList?.classList.add('hidden');
    if (DOM.successAlert) {
        DOM.successAlert.className   = 'alert alert-success alert-success-lg';
        DOM.successAlert.textContent = '✓ ¡Reserva confirmada! Te esperamos.';
    }

    DOM.singleSummaryBox?.classList.remove('hidden');
    DOM.cartSummaryBox?.classList.add('hidden');
    if (DOM.cartSummaryBox) DOM.cartSummaryBox.innerHTML = '';

    if (appState.mode === 'service') {
        appState.services.forEach(s => _syncServiceCardQty(s.id));
        renderCartPanel();
        DOM.cartStepHeader?.classList.add('hidden');
        DOM.dateMainStep?.classList.remove('hidden');
        DOM.dateSelection?.classList.add('hidden');
        showSection('service-selection');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ─── INIT ────────────────────────────────────────────────────────────────────

const initClient = async () => {
    initTheme();

    if (!businessId) {
        window.location.replace('landing.html');
        return;
    }

    try {
        // Resolver negocio por slug o UUID
        let biz = null;
        const bySlug = await appSupabase.from('businesses')
            .select('*').eq('slug', businessId).maybeSingle();
        if (bySlug.data) {
            biz = bySlug.data;
        } else {
            const byId = await appSupabase.from('businesses')
                .select('*').eq('id', businessId).maybeSingle();
            biz = byId.data;
        }
        if (!biz) throw new Error('not-found');

        bizId = biz.id;
        appState.config = {
            businessName: biz.business_name,
            description:  biz.description,
            zone:         biz.zone,
            address:      biz.address,
            whatsapp:     biz.whatsapp,
            brandColor:   biz.brand_color,
            openTime:     String(biz.open_time || '').slice(0, 5),
            closeTime:    String(biz.close_time || '').slice(0, 5),
            slotDuration: biz.slot_duration,
            workingDays:  biz.working_days,
            bookingMode:  biz.booking_mode,
            branding:     biz.branding || {}
        };

        document.title = `${appState.config.businessName} — Reservar turno`;
        DOM.businessName.dataset.name = appState.config.businessName;
        DOM.businessName.textContent  = appState.config.businessName;
        _applyClientBrand(appState.config.brandColor || '#6366f1');
        _applyClientBranding(appState.config.branding || {}, appState.config.businessName);

        appState.mode = appState.config.bookingMode || 'direct';

        renderBanner();

        if (appState.mode === 'service') {
            await setupServiceMode();
        } else {
            await loadAvailableStaff();
            setStepNumbers(1, 2, 3);
            document.getElementById('date-step-title').textContent = 'Elegí una fecha';
            showSection('date-selection');
        }

        setupDatePicker();
        await loadSubscriptionPlans();
    } catch {
        document.body.innerHTML =
            '<p style="text-align:center;margin-top:3rem;color:#8890a4;">Negocio no encontrado.</p>';
    }
};

// ─── SUSCRIPCIÓN MENSUAL (público) ───────────────────────────────────────────

let selectedPlanId = null;
let publicPlans    = [];

async function loadSubscriptionPlans() {
    try {
        const { data, error } = await appSupabase
            .from('plans')
            .select('*')
            .eq('business_id', bizId)
            .eq('active', true)
            .order('price');
        if (error) return;
        const plans = data || [];
        if (!plans.length) return;

        publicPlans = plans;
        // Mostrar la pestaña "Suscripción" (la sección ya está dentro del panel)
        const subsTab = document.getElementById('subs-tab-btn');
        if (subsTab) subsTab.classList.remove('hidden');
        renderPublicPlans(plans);
    } catch { /* no crítico */ }
}

function renderPublicPlans(plans) {
    const grid = document.getElementById('plans-public-grid');
    if (!grid) return;
    grid.innerHTML = '';

    plans.forEach(p => {
        const styleLabel = p.style === 'pilates' ? 'Por clase (Pilates)' : 'Acceso libre (Gimnasio)';
        const capMeta    = p.style === 'pilates' ? ` · Cupo ${p.capacity_per_day || '—'} por día` : '';
        const card = document.createElement('div');
        card.className = 'plan-card';
        card.innerHTML = `
            <div class="plan-name">${escapeHtml(p.name)}</div>
            <div class="plan-price">$${parseFloat(p.price).toLocaleString('es-AR')}<span class="plan-per">/mes</span></div>
            <div class="plan-meta">${escapeHtml(styleLabel)}${escapeHtml(capMeta)}</div>
            ${p.description ? `<div class="plan-meta">${escapeHtml(p.description)}</div>` : ''}
            <button type="button" class="btn btn-primary" data-plan-sub="${escapeHtml(p.id)}">Suscribirme</button>
        `;
        grid.appendChild(card);
    });

    grid.querySelectorAll('[data-plan-sub]').forEach(btn =>
        btn.addEventListener('click', () => selectPlan(btn.dataset.planSub))
    );
}

function selectPlan(planId) {
    const plan = publicPlans.find(p => p.id === planId);
    selectedPlanId = planId;
    document.getElementById('subscribe-plan-name').textContent = plan?.name || '';
    document.getElementById('subscribe-form-wrap').classList.remove('hidden');
    document.getElementById('subscribe-success').classList.add('hidden');
    document.getElementById('subscribe-error').classList.add('hidden');

    // Si es plan "por clase", cargar la grilla de clases disponibles
    if (plan?.style === 'pilates') {
        loadPublicSlots(planId);
    } else {
        const slotsEl = document.getElementById('subscribe-slots');
        slotsEl.innerHTML = '';
        slotsEl.classList.add('hidden');
    }

    document.getElementById('subscribe-form-wrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const fmtTimeShort = t => String(t || '').slice(0, 5);

async function loadPublicSlots(planId) {
    const slotsEl = document.getElementById('subscribe-slots');
    if (!slotsEl) return;
    slotsEl.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">Cargando clases…</p>';
    slotsEl.classList.remove('hidden');

    const { data, error } = await appSupabase.rpc('get_plan_slots', { p_plan: planId });
    if (error || !data?.length) {
        slotsEl.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">No hay clases disponibles para este plan.</p>';
        return;
    }

    slotsEl.innerHTML = '<label class="subs-slots-label">Elegí tus clases (días y horarios)</label>';
    const wrap = document.createElement('div');
    wrap.className = 'subs-slots-grid';

    data.forEach(slot => {
        const full = slot.enrolled >= slot.capacity;
        const label = document.createElement('label');
        label.className = 'subs-slot' + (full ? ' subs-slot--full' : '');
        label.innerHTML = `
            <input type="checkbox" value="${escapeHtml(slot.id)}" ${full ? 'disabled' : ''}>
            <span class="subs-slot-time">${DAYS_ES[slot.day_of_week]} ${fmtTimeShort(slot.start_time)}–${fmtTimeShort(slot.end_time)}</span>
            <span class="subs-slot-cap">${full ? 'Llena' : `${slot.enrolled}/${slot.capacity}`}</span>
        `;
        wrap.appendChild(label);
    });

    slotsEl.appendChild(wrap);
}

document.getElementById('subscribe-btn')?.addEventListener('click', async () => {
    const name  = document.getElementById('sub-name')?.value.trim();
    const phone = document.getElementById('sub-phone')?.value.trim();
    const errEl = document.getElementById('subscribe-error');

    if (!name || !phone) {
        if (errEl) { errEl.textContent = 'Completá nombre y teléfono.'; errEl.classList.remove('hidden'); }
        return;
    }
    if (!selectedPlanId) return;

    const slotIds = Array.from(document.querySelectorAll('#subscribe-slots input[type="checkbox"]:checked'))
        .map(cb => cb.value);

    const { data, error } = await appSupabase.rpc('create_subscription', {
        p_biz: bizId,
        p_plan_id: selectedPlanId,
        p_name: name,
        p_phone: phone,
        p_slot_ids: slotIds
    });

    if (error || !data?.ok) {
        if (errEl) { errEl.textContent = data?.error || error?.message || 'No se pudo completar la suscripción.'; errEl.classList.remove('hidden'); }
        return;
    }

    const successEl = document.getElementById('subscribe-success');
    if (successEl) {
        successEl.textContent = `✓ ¡Suscripción confirmada! Próximo cobro: ${data.next_billing_date || ''}`;
        successEl.classList.remove('hidden');
    }
    document.getElementById('subscribe-form-wrap').classList.add('hidden');
    document.getElementById('sub-name').value = '';
    document.getElementById('sub-phone').value = '';
});

// ─── PESTAÑAS DE NAVEGACIÓN ───────────────────────────────────────────────────

document.querySelectorAll('.public-tabs-nav .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        document.querySelectorAll('.public-tabs-nav .tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === target));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});

initClient();
