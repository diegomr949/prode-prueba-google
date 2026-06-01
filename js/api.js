/* ═══════════════════════════════════════════════════════════
   api.js — ADAPTADO PARA GOOGLE APPS SCRIPT
   Manejo de tokens locales y proxy POST total
   OPTIMIZADO: deduplicación de requests en vuelo, caché de
   datos estáticos en memoria
═══════════════════════════════════════════════════════════ */

const _meta    = document.querySelector('meta[name="api-base"]');
const API_BASE = _meta ? _meta.getAttribute('content').replace(/\/$/, '') : '';

if (!API_BASE) console.error('[API] ⚠ Falta <meta name="api-base"> en el HTML.');
const TIMEOUT_MS = 15_000;

/* ── Deduplicación: evita llamadas duplicadas en vuelo simultáneas ── */
const _inflight = {};

/* ── HTTP helper adaptado para GAS ── */
async function http(path, method = 'GET', body = null) {
    const token = localStorage.getItem('PRODE_TOKEN');

    // 1. Limpiar barra inicial
    let cleanPath = path.startsWith('/') ? path.substring(1) : path;

    // 2. Separar ruta base de query params
    let route       = cleanPath;
    let queryParams = '';

    if (cleanPath.includes('?')) {
        const parts = cleanPath.split('?');
        route       = parts[0];
        queryParams = '&' + parts[1];
    } else if (cleanPath.includes('&')) {
        const parts = cleanPath.split('&');
        route       = parts[0];
        queryParams = '&' + parts.slice(1).join('&');
    }

    // 3. URL final para Google Apps Script
    let url = API_BASE + '?route=' + encodeURIComponent(route) + queryParams;
    if (token) url += '&token=' + encodeURIComponent(token);

    const fetchMethod = method === 'GET' ? 'GET' : 'POST';
    const inflightKey = method + ':' + path;

    // 4. Si es GET y ya hay una llamada idéntica en vuelo, reutilizarla
    if (fetchMethod === 'GET' && _inflight[inflightKey]) {
        return _inflight[inflightKey];
    }

    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    const fetchOptions = {
        method: fetchMethod,
        signal: ctrl.signal,
    };
    if (fetchMethod === 'POST') {
        fetchOptions.body = JSON.stringify({ originalMethod: method, body });
    }

    const promise = fetch(url, fetchOptions)
        .then(async res => {
            clearTimeout(tid);
            const textRes = await res.text();
            let data;
            try { data = JSON.parse(textRes); } catch(e) { return null; }

            if (data.error && data.code === 401) {
                Auth.logout();
                Toast.info('Tu sesión expiró. Iniciá sesión nuevamente.');
                return null;
            }
            return { ok: !data.error, status: data.code || 200, data: data.data };
        })
        .catch(e => {
            clearTimeout(tid);
            if (e.name === 'AbortError') Toast.err('El servidor tardó demasiado.');
            else                          Toast.err('Error de conexión.');
            return null;
        })
        .finally(() => {
            // Limpiar la entrada de vuelo al terminar
            delete _inflight[inflightKey];
        });

    // Solo deduplicar GETs
    if (fetchMethod === 'GET') {
        _inflight[inflightKey] = promise;
    }

    return promise;
}

/* ── APIs ── */

const ApiAuth = {
    login: async (email, password) => {
        const r = await http('auth/login', 'POST', { email, password });
        if (r?.ok && r.data.token) localStorage.setItem('PRODE_TOKEN', r.data.token);
        return r;
    },
    registro: async (nombre, email, password, area) => {
        const r = await http('auth/registro', 'POST', { nombre, email, password, area });
        if (r?.ok && r.data.token) localStorage.setItem('PRODE_TOKEN', r.data.token);
        return r;
    },
    me:     () => http('auth/me'),
    logout: () => localStorage.removeItem('PRODE_TOKEN'),
};

const ApiPartidos = {
    getAll: (estado = null) => http('partidos' + (estado ? `&estado=${encodeURIComponent(estado)}` : '')),
};

const ApiPredicciones = {
    getMias: () => http('predicciones/mis-predicciones'),
    guardar(pid, gl, gv) {
        if (!Number.isInteger(pid) || pid <= 0)          return Promise.resolve(null);
        if (!Number.isInteger(gl) || gl < 0 || gl > 20) return Promise.resolve(null);
        if (!Number.isInteger(gv) || gv < 0 || gv > 20) return Promise.resolve(null);
        return http('predicciones', 'POST', { partidoId: pid, golesLocal: gl, golesVisitante: gv });
    },
};

const ApiRanking = {
    get:      (area = null) => http('ranking' + (area ? `&area=${encodeURIComponent(area)}` : '')),
    getAreas: () => http('ranking/areas'),
};

const ApiEquipos = {
    getAll:       ()   => http('equipos'),
    getJugadores: (id) => http(`equipos/${id}/jugadores`),
};

const ApiAdmin = {
    getUsuarios:     ()          => http('admin/usuarios'),
    getDashboardUsuario: (id)    => http(`admin/usuarios/${id}/dashboard`),
    resetPassword:   (id, p)     => http(`admin/usuarios/${id}/reset-password`, 'PUT', { nuevaPassword: p }),
    actualizarArea:  (id, area)  => http(`admin/usuarios/${id}/area`, 'PUT', { area: area || null }),
    getAreas:        ()          => http('ranking/areas'),
    cargarResultado: (pid, gl, gv) => http(`admin/partidos/${pid}/resultado`, 'PUT', { golesLocal: gl, golesVisitante: gv }),
};

const ApiPerfil = {
    cambiarPassword: (passwordActual, nuevaPassword) =>
        http('perfil/cambiar-password', 'PUT', { passwordActual, nuevaPassword }),
};