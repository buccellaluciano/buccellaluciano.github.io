// ─── CONFIGURACIÓN DE SUPABASE ────────────────────────────────────────────────
// Reemplazá estos dos valores por los de TU proyecto (Settings → API).
// La anon key es PÚBLICA por diseño; la seguridad real la da RLS.
// Este archivo se carga después del CDN de supabase-js en cada página.
const SUPABASE_URL      = 'https://axrfjhbissrsrcpwtsjr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mzTQfM1JoxnYYVWwEwAdRA_ZkTGogrH';

let appSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// ─── HELPERS DE SESIÓN ───────────────────────────────────────────────────────

/** Devuelve el usuario autenticado (o null). */
async function getCurrentUser() {
    const { data: { user } } = await appSupabase.auth.getUser();
    return user;
}

/** Devuelve el negocio del usuario autenticado (o null). */
async function getMyBusiness() {
    const user = await getCurrentUser();
    if (!user) return null;
    const { data } = await appSupabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .single();
    return data || null;
}

/** Ejecuta `cb` cuando la sesión se cierra (logout) o expira. */
function onSignOut(cb) {
    appSupabase.auth.onAuthStateChange(event => {
        if (event === 'SIGNED_OUT') cb();
    });
}

/** URL absoluta de una página de la app (resuelve bien en subdirectorio). */
function appUrl(page) {
    return new URL(page, window.location.href).href;
}
