/* ═══════════════════════════════════════════════════════════
   store.js — Estado global · CPCE Mendoza · Prode Mundial 2026
   Versión SIN JWT

   Con sesiones de servidor:
   · No hay token que guardar en sessionStorage
   · La sesión vive en el servidor; el navegador solo tiene la cookie
   · Al recargar la página, llamamos GET /auth/me para saber si
     hay sesión activa y recuperar los datos del usuario
   · Si /me devuelve 401 → mostrar login
═══════════════════════════════════════════════════════════ */

/* ── Sanitización XSS ── */
const XSS = {
    sanitize(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    },
    s: (v) => XSS.sanitize(v),
};

/* ── Store del usuario en memoria ── */
// Ya no usamos sessionStorage para datos de auth.
// El usuario se carga desde /auth/me al iniciar la app.
const Store = {
    _user: null,

    setUser(user) {
        Store._user = user ? {
            nombre: user.nombre,
            email:  user.email,
            rol:    user.rol,
            area:   user.area || null,
        } : null;
    },

    getUser()  { return Store._user; },
    clearUser(){ Store._user = null; },
    clear()    { Store.clearUser(); },
};

/* ── Estado de la app ── */
const State = {
    partidos:  [],
    misPreds:  {},
    pending:   {},
    ranking:   [],
    equipos:   [],
    filter:    'todos',
    resetId:   null,
    areaId:    null,
    viewStack: [],

    get user()    { return Store.getUser(); },
    get isAdmin() { return State.user?.rol === 'ROLE_ADMIN'; },
};

/* ── Toast ── */
const Toast = {
    show(msg, type = 'ok') {
        const t = document.createElement('div');
        t.className = `toast t${type}`;
        t.textContent = msg;
        document.getElementById('toasts').appendChild(t);
        setTimeout(() => t.remove(), 2900);
    },
    ok(msg)   { Toast.show(msg, 'ok'); },
    err(msg)  { Toast.show(msg, 'err'); },
    info(msg) { Toast.show(msg, 'info'); },
};

/* ── Modal ── */
const Modal = {
    open(id)  { document.getElementById(id)?.classList.add('open'); },
    close()   { document.querySelectorAll('.moverlay').forEach(m => m.classList.remove('open')); },
};
document.addEventListener('click', e => {
    if (e.target.classList.contains('moverlay')) Modal.close();
});

/* ── Router ── */
const Router = {
    current: null,
    VIEWS: ['partidos', 'ranking', 'selecciones', 'reglamento', 'perfil', 'admin'],

    go(name, params = {}) {
        if (!Router.VIEWS.includes(name)) return;
        if (name === 'admin' && !State.isAdmin) return;

        if (Router.current) State.viewStack.push(Router.current);
        document.querySelectorAll('#main .view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${name}`)?.classList.add('active');
        Router.current = name;
        document.querySelectorAll('[data-v]').forEach(b =>
            b.classList.toggle('active', b.dataset.v === name)
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
        Views.load(name, params);
    },
};

/* ── Auth ── */
const Auth = {
    saveSession(data) {
        // Solo guardamos en memoria, no en sessionStorage
        // La sesión real vive en el servidor
        Store.setUser({
            nombre: data.nombre,
            email:  data.email,
            rol:    data.rol,
            area:   data.area || null,
        });
    },

    logout() {
        // Llamar al servidor para invalidar la sesión
        ApiAuth.logout().catch(() => {}); // fire-and-forget
        Store.clear();
        State.partidos = []; State.misPreds = {};
        State.pending  = []; State.ranking  = [];

        document.getElementById('topbar').style.display     = 'none';
        document.getElementById('mobile-nav').style.display = 'none';
        document.getElementById('main').style.display       = 'none';
        document.querySelectorAll('#main .view')
            .forEach(v => v.classList.remove('active'));

        const lv = document.getElementById('view-login');
        lv.style.display = 'flex';
        lv.classList.add('active');
    },

    boot() {
        const user = State.user;
        if (!user) { Auth.logout(); return; }

        document.getElementById('view-login').style.display = 'none';
        document.getElementById('view-login').classList.remove('active');
        document.getElementById('topbar').style.display     = 'flex';
        document.getElementById('mobile-nav').style.display = 'block';
        document.getElementById('main').style.display       = 'block';

        // Topbar
        document.getElementById('ubn').textContent  = user.nombre;
        document.getElementById('ubp').textContent  = '0 pts';
        document.getElementById('ubav').textContent = Fmt.iniciales(user.nombre);

        if (State.isAdmin) {
            document.querySelectorAll('.admin-nav-item')
                .forEach(el => el.style.display = '');
        }

        Router.go('partidos');
    },

    /* Restaurar sesión al recargar la página —
       llama a /auth/me y si hay sesión activa arranca la app */
    async restore() {
        const r = await ApiAuth.me();
        if (r?.ok && r.data) {
            Auth.saveSession(r.data);
            Auth.boot();
        }
        // Si da 401 → Auth.logout() ya fue llamado por el http helper → muestra login
    },
};

/* ── Formato ── */
const Fmt = {
    fecha(iso) {
        return new Date(iso).toLocaleString('es-AR', {
            weekday: 'short', day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit',
        }) + ' hs';
    },
    fechaCorta(iso) {
        return new Date(iso).toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit',
        }) + ' hs';
    },
    iniciales(nombre) {
        return (nombre || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    },
    puntosLabel(pts) {
        if (pts === 3) return '🎯 Pleno · 3 pts';
        if (pts === 1) return '👍 Tendencia · 1 pt';
        if (pts === 0) return '❌ Sin puntos';
        return '— Pendiente';
    },
    puntosClass(pts) {
        if (pts === 3) return 'p3';
        if (pts === 1) return 'p1';
        if (pts === 0) return 'p0';
        return 'pp';
    },
    posicion(n) { return ({ 1:'🥇', 2:'🥈', 3:'🥉' })[n] || n; },
    posicionJugador(pos) {
        return ({
            PORTERO:    { label:'POR', cls:'pos-P' },
            DEFENSA:    { label:'DEF', cls:'pos-D' },
            MEDIOCAMPO: { label:'MED', cls:'pos-M' },
            DELANTERO:  { label:'DEL', cls:'pos-A' },
        })[pos] || { label: XSS.s(pos), cls: '' };
    },
    flag(url, nombre) {
        return `<img class="flag" src="${XSS.s(url)}" alt="${XSS.s(nombre)}"
                 onerror="this.style.visibility='hidden'" />`;
    },
    badge(estado, bloqueada) {
        if (estado === 'EN_JUEGO')   return '<span class="badge b-live">En vivo</span>';
        if (estado === 'FINALIZADO') return '<span class="badge b-done">Finalizado</span>';
        if (bloqueada)               return '<span class="badge b-lock">🔒 Cerrado</span>';
        return '<span class="badge b-open">Abierto</span>';
    },
    goles(val) {
        const n = parseInt(val);
        return (!isNaN(n) && n >= 0 && n <= 20) ? n : '?';
    },
};

/* ── FAB ── */
const Fab = {
    update() {
        const n   = Object.keys(State.pending).length;
        const fab = document.getElementById('fab');
        document.getElementById('fabn').textContent = n;
        fab.style.display = n > 0 ? 'flex' : 'none';
    },

    async saveAll() {
        const keys = Object.keys(State.pending);
        if (!keys.length) return;

        const fab = document.getElementById('fab');
        fab.disabled  = true;
        fab.textContent = '⏳ Guardando...';

        let ok = 0, fail = 0;

        for (const pid of keys) {
            const { golesLocal, golesVisitante } = State.pending[pid];
            if (golesLocal === null || golesVisitante === null) { fail++; continue; }

            const r = await ApiPredicciones.guardar(
                parseInt(pid), golesLocal, golesVisitante
            );
            if (r?.ok) {
                State.misPreds[pid] = r.data;
                delete State.pending[pid];
                ok++;
            } else {
                const msg = r?.data?.error ? XSS.s(r.data.error) : `Error partido ${pid}`;
                Toast.err(msg);
                fail++;
            }
        }

        fab.disabled = false;
        fab.innerHTML = '💾 Guardar predicciones ';
        const span = document.createElement('span');
        span.className   = 'fabn';
        span.id          = 'fabn';
        span.textContent = Object.keys(State.pending).length;
        fab.appendChild(span);

        if (ok)   Toast.ok(`✅ ${ok} predicción${ok > 1 ? 'es' : ''} guardada${ok > 1 ? 's' : ''}`);
        if (fail) Toast.err(`⚠️ ${fail} no ${fail > 1 ? 'pudieron' : 'pudo'} guardarse`);

        Views.Partidos.refreshStats();
        Fab.update();
        Views.Partidos.render();
    },
};