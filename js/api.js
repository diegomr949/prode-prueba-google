/* ═══════════════════════════════════════════════════════════
   api.js — HTTP sin JWT · CPCE Mendoza · Prode Mundial 2026

   Con sesiones de servidor:
   · El navegador envía la cookie PRODE_SESSION automáticamente
   · credentials: 'include' es OBLIGATORIO en fetch
   · Sin header Authorization, sin token en sessionStorage
   · El 401 significa sesión expirada → ir al login
═══════════════════════════════════════════════════════════ */

const _meta    = document.querySelector('meta[name="api-base"]');
const API_BASE = _meta ? _meta.getAttribute('content').replace(/\/$/, '') : '';

if (!API_BASE) {
    console.error('[API] ⚠ Falta <meta name="api-base"> en el HTML.');
}

const TIMEOUT_MS = 15_000;

/* ── HTTP helper ── */
async function http(path, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    // Sin Authorization header — la cookie se envía automáticamente

    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(API_BASE + path, {
            method,
            headers,
            body:        body ? JSON.stringify(body) : null,
            signal:      ctrl.signal,
            credentials: 'include',   // OBLIGATORIO: envía la cookie de sesión
        });
        clearTimeout(tid);

        // Sesión expirada o no autenticado → logout y login
        if (res.status === 401) {
            Auth.logout();
            Toast.info('Tu sesión expiró. Por favor iniciá sesión nuevamente.');
            return null;
        }

        if (res.status === 429) {
            const retry = res.headers.get('Retry-After') || '60';
            Toast.err(`Demasiados intentos. Esperá ${retry} segundos.`);
            return null;
        }

        const txt = await res.text();
        if (!txt) return { ok: res.ok, status: res.status, data: null };
        try { return { ok: res.ok, status: res.status, data: JSON.parse(txt) }; }
        catch { return { ok: res.ok, status: res.status, data: txt }; }

    } catch (e) {
        clearTimeout(tid);
        if (e.name === 'AbortError') Toast.err('El servidor tardó demasiado. Intentá de nuevo.');
        else                          Toast.err('Error de conexión.');
        return null;
    }
}

/* ── Auth ── */
const ApiAuth = {
    // Login: el servidor crea la sesión y devuelve cookie automáticamente
    login:  (email, password) => http('/auth/login', 'POST', { email, password }),
    // Me: verifica si hay sesión activa al cargar la app
    me:     ()                => http('/auth/me'),
    // Logout: invalida la sesión en el servidor
    logout: ()                => http('/auth/logout', 'POST'),
};

/* ── Partidos ── */
const ApiPartidos = {
    getAll: (estado = null) =>
        http('/partidos' + (estado ? `?estado=${encodeURIComponent(estado)}` : '')),
};

/* ── Predicciones ── */
const ApiPredicciones = {
    getMias: () => http('/predicciones/mis-predicciones'),
    guardar(pid, gl, gv) {
        if (!Number.isInteger(pid) || pid <= 0)                  return null;
        if (!Number.isInteger(gl) || gl < 0 || gl > 20)          return null;
        if (!Number.isInteger(gv) || gv < 0 || gv > 20)          return null;
        return http('/predicciones', 'POST', {
            partidoId: pid, golesLocal: gl, golesVisitante: gv
        });
    },
};

/* ── Ranking ── */
const ApiRanking = {
    get:      (area = null) =>
        http('/ranking' + (area ? `?area=${encodeURIComponent(area)}` : '')),
    getAreas: () => http('/ranking/areas'),
};

/* ── Equipos ── */
const ApiEquipos = {
    getAll:       ()    => http('/equipos'),
    getJugadores: (id)  =>
        Number.isInteger(id) && id > 0 ? http(`/equipos/${id}/jugadores`) : null,
};

/* ── Admin ── */
const ApiAdmin = {
    getUsuarios:     ()                    => http('/admin/usuarios'),
    getDashboard:    (id)                  =>
        Number.isInteger(id) && id > 0 ? http(`/admin/usuarios/${id}/dashboard`) : null,
    resetPassword:   (id, p)              =>
        (Number.isInteger(id) && p?.length >= 6)
            ? http(`/admin/usuarios/${id}/reset-password`, 'PUT', { nuevaPassword: p })
            : null,
    actualizarArea:  (id, area)           =>
        Number.isInteger(id) && id > 0
            ? http(`/admin/usuarios/${id}/area`, 'PUT', { area: area || null })
            : null,
    crearUsuario:    (nombre, email, password, area) =>
        http('/admin/usuarios', 'POST', { nombre, email, password, area: area || null }),
    getAreas:        ()                   => http('/admin/areas'),
    cargarResultado: (pid, gl, gv)        =>
        http(`/admin/partidos/${pid}/resultado`, 'PUT', {
            golesLocal: gl, golesVisitante: gv
        }),
};

/* ── Perfil ── */
const ApiPerfil = {
    cambiarPassword: (passwordActual, nuevaPassword) =>
        (passwordActual && nuevaPassword?.length >= 6)
            ? http('/perfil/cambiar-password', 'PUT', { passwordActual, nuevaPassword })
            : null,
};