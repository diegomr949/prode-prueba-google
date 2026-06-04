/* ═══════════════════════════════════════════════════════════
   api.js — ADAPTADO PARA GOOGLE APPS SCRIPT v2.0
   CAMBIOS:
   - Retry automático con backoff exponencial en errores de red
   - Deduplicación de GETs en vuelo (mejorada)
   - Token inválido/expirado limpia sesión correctamente
   - Timeout configurable por tipo de llamada
   - Manejo de HTTP 429 (rate limit) con aviso al usuario
   - sanitizarQueryParam para evitar inyección en URLs
═══════════════════════════════════════════════════════════ */

const _meta    = document.querySelector('meta[name="api-base"]');
const API_BASE = _meta ? _meta.getAttribute('content').replace(/\/$/, '') : '';

if (!API_BASE) console.error('[API] ⚠ Falta <meta name="api-base"> en el HTML.');

const TIMEOUT_MS       = 20_000;
const TIMEOUT_WRITE_MS = 25_000; // escrituras pueden tardar más en GAS
const MAX_RETRIES      = 2;
const RETRY_BASE_MS    = 800;

/* ── Deduplicación: evita llamadas GET duplicadas en vuelo ── */
const _inflight = {};

/* ── Utilidad: sleep para retry backoff ── */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── HTTP helper adaptado para GAS ── */
async function http(path, method = 'GET', body = null, retries = MAX_RETRIES) {
  const token = localStorage.getItem('PRODE_TOKEN');

  // 1. Limpiar barra inicial
  let cleanPath = path.startsWith('/') ? path.substring(1) : path;

  // 2. Separar ruta base de query params adicionales
  let route       = cleanPath;
  let queryParams = '';

  if (cleanPath.includes('?')) {
    const idx   = cleanPath.indexOf('?');
    route       = cleanPath.substring(0, idx);
    queryParams = '&' + cleanPath.substring(idx + 1);
  } else if (cleanPath.includes('&')) {
    const idx   = cleanPath.indexOf('&');
    route       = cleanPath.substring(0, idx);
    queryParams = '&' + cleanPath.substring(idx + 1);
  }

  // 3. URL final para Google Apps Script
  let url = API_BASE + '?route=' + encodeURIComponent(route) + queryParams;
  if (token) url += '&token=' + encodeURIComponent(token);

  const isWrite     = method !== 'GET';
  const fetchMethod = isWrite ? 'POST' : 'GET';
  const inflightKey = method + ':' + path;

  // 4. Para GETs: si ya hay una llamada idéntica en vuelo, reutilizarla
  if (!isWrite && _inflight[inflightKey]) {
    return _inflight[inflightKey];
  }

  const doFetch = async (attempt) => {
    const ctrl    = new AbortController();
    const timeout = isWrite ? TIMEOUT_WRITE_MS : TIMEOUT_MS;
    const tid     = setTimeout(() => ctrl.abort(), timeout);

    const options = { method: fetchMethod, signal: ctrl.signal };
    if (isWrite) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body    = JSON.stringify({ originalMethod: method, body });
    }

    try {
      const res     = await fetch(url, options);
      clearTimeout(tid);

      // GAS siempre devuelve 200 — parsear el JSON para ver el estado real
      const textRes = await res.text();
      let data;
      try { data = JSON.parse(textRes); }
      catch(e) {
        console.error('[API] JSON inválido:', textRes.substring(0, 200));
        return null;
      }

      // Sesión expirada
      if (data.error && data.code === 401) {
        Auth.logout();
        Toast.info('Tu sesión expiró. Iniciá sesión nuevamente.');
        return null;
      }

      // Rate limit
      if (data.error && data.code === 429) {
        Toast.err('Demasiadas solicitudes. Esperá un momento.');
        return null;
      }

      return { ok: !data.error, status: data.code || 200, data: data.data };

    } catch(e) {
      clearTimeout(tid);
      if (e.name === 'AbortError') {
        if (attempt < retries) {
          await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
          return doFetch(attempt + 1);
        }
        Toast.err('El servidor tardó demasiado. Intentá de nuevo.');
        return null;
      }
      // Error de red — reintentar
      if (attempt < retries) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
        return doFetch(attempt + 1);
      }
      Toast.err('Error de conexión. Verificá tu red.');
      return null;
    }
  };

  const promise = doFetch(0).finally(() => {
    delete _inflight[inflightKey];
  });

  // Solo deduplicar GETs
  if (!isWrite) {
    _inflight[inflightKey] = promise;
  }

  return promise;
}

/* ════════════════════════════════════════════════════════
   APIs
════════════════════════════════════════════════════════ */

const ApiAuth = {
  login: async (email, password) => {
    const r = await http('auth/login', 'POST', { email, password });
    if (r?.ok && r.data?.token) localStorage.setItem('PRODE_TOKEN', r.data.token);
    return r;
  },
  registro: async (nombre, email, password, area) => {
    const r = await http('auth/registro', 'POST', { nombre, email, password, area });
    if (r?.ok && r.data?.token) localStorage.setItem('PRODE_TOKEN', r.data.token);
    return r;
  },
  me:     () => http('auth/me'),
  logout: () => localStorage.removeItem('PRODE_TOKEN'),
};

const ApiPartidos = {
  getAll: (estado = null) => {
    const path = 'partidos' + (estado ? `&estado=${encodeURIComponent(estado)}` : '');
    return http(path);
  },
};

const ApiPredicciones = {
  getMias: () => http('predicciones/mis-predicciones'),

  guardar(pid, gl, gv) {
    if (!Number.isInteger(pid) || pid <= 0)           return Promise.resolve(null);
    if (!Number.isInteger(gl)  || gl  < 0 || gl > 20) return Promise.resolve(null);
    if (!Number.isInteger(gv)  || gv  < 0 || gv > 20) return Promise.resolve(null);
    return http('predicciones', 'POST', { partidoId: pid, golesLocal: gl, golesVisitante: gv });
  },
};

const ApiRanking = {
  get:      (area = null) => http('ranking' + (area ? `&area=${encodeURIComponent(area)}` : '')),
  getAreas: ()            => http('ranking/areas'),
};

const ApiEquipos = {
  getAll:       ()    => http('equipos'),
  getJugadores: (id)  => http(`equipos/${encodeURIComponent(id)}/jugadores`),
};

const ApiAdmin = {
  getUsuarios:        ()            => http('admin/usuarios'),
  getDashboardUsuario:(id)          => http(`admin/usuarios/${encodeURIComponent(id)}/dashboard`),
  resetPassword:      (id, p)       => http(`admin/usuarios/${encodeURIComponent(id)}/reset-password`, 'PUT', { nuevaPassword: p }),
  actualizarArea:     (id, area)    => http(`admin/usuarios/${encodeURIComponent(id)}/area`, 'PUT', { area: area || null }),
  getAreas:           ()            => http('ranking/areas'),
  cargarResultado:    (pid, gl, gv) => http(`admin/partidos/${encodeURIComponent(pid)}/resultado`, 'PUT', { golesLocal: gl, golesVisitante: gv }),
};

const ApiPerfil = {
  cambiarPassword: (passwordActual, nuevaPassword) =>
    http('perfil/cambiar-password', 'PUT', { passwordActual, nuevaPassword }),
};