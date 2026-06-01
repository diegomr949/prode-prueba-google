/* ═══════════════════════════════════════════════════════════
   store.js — Estado global · CPCE Mendoza
   OPTIMIZADO: carga paralela en Auth.boot, evita re-fetches
   innecesarios en vistas que ya tienen datos en State
═══════════════════════════════════════════════════════════ */

const XSS = {
    sanitize(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;')
            .replace(/'/g,  '&#x27;')
            .replace(/\//g, '&#x2F;');
    },
    s: (v) => XSS.sanitize(v),
};

const Store = {
    _user: null,
    setUser(user) {
        Store._user = user
            ? { nombre: user.nombre, email: user.email, rol: user.rol, area: user.area || null }
            : null;
    },
    getUser()  { return Store._user; },
    clearUser(){ Store._user = null; },
    clear()    { Store.clearUser(); },
};

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

const Toast = {
    show(msg, type = 'ok') {
        const t = document.createElement('div');
        t.className  = `toast t${type}`;
        t.textContent = msg;
        document.getElementById('toasts').appendChild(t);
        setTimeout(() => t.remove(), 2900);
    },
    ok(msg)   { Toast.show(msg, 'ok');   },
    err(msg)  { Toast.show(msg, 'err');  },
    info(msg) { Toast.show(msg, 'info'); },
};

const Modal = {
    open(id) { document.getElementById(id)?.classList.add('open'); },
    close()  { document.querySelectorAll('.moverlay').forEach(m => m.classList.remove('open')); },
};
document.addEventListener('click', e => {
    if (e.target.classList.contains('moverlay')) Modal.close();
});

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

const Auth = {
    saveSession(data) { Store.setUser(data); },

    logout() {
        ApiAuth.logout();
        Store.clear();
        State.partidos  = [];
        State.misPreds  = {};
        State.pending   = {};
        State.ranking   = [];
        State.equipos   = [];

        document.getElementById('fab').style.display        = 'none';
        document.getElementById('topbar').style.display     = 'none';
        document.getElementById('mobile-nav').style.display = 'none';
        document.getElementById('main').style.display       = 'none';
        document.querySelectorAll('#main .view').forEach(v => v.classList.remove('active'));

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
        document.getElementById('ubn').textContent          = user.nombre;
        document.getElementById('ubp').textContent          = '0 pts';
        document.getElementById('ubav').textContent         = Fmt.iniciales(user.nombre);

        if (State.isAdmin) {
            document.querySelectorAll('.admin-nav-item').forEach(el => el.style.display = '');
        }

        // Precarga en paralelo: partidos + predicciones + ranking juntos
        // para que todas las vistas tengan datos disponibles de inmediato
        Auth._precargarDatos().then(() => {
            Router.go('partidos');
        });
    },

    async _precargarDatos() {
        const [rp, rm, rr] = await Promise.all([
            ApiPartidos.getAll(),
            ApiPredicciones.getMias(),
            ApiRanking.get(),
        ]);

        if (rp?.ok) State.partidos = rp.data || [];

        if (rm?.ok) {
            State.misPreds = {};
            (rm.data || []).forEach(p => { State.misPreds[p.partidoId] = p; });
        }

        if (rr?.ok) {
            State.ranking = rr.data || [];
            // Actualizar posición del usuario en la topbar
            const mio = State.ranking.find(u => u.email === State.user?.email);
            if (mio) {
                const pts = Object.values(State.misPreds)
                    .reduce((s, p) => s + (p.puntosObtenidos || 0), 0);
                document.getElementById('ubp').textContent = `${pts} pts`;
                document.getElementById('spos') && (document.getElementById('spos').textContent = `#${mio.posicion}`);
            }
        }
    },

    async restore() {
        if (!localStorage.getItem('PRODE_TOKEN')) return Auth.logout();
        const r = await ApiAuth.me();
        if (r?.ok && r.data) { Auth.saveSession(r.data); Auth.boot(); }
        else Auth.logout();
    },
};

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
    iniciales(n) {
        return (n || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
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
    posicion(n) { return ({ 1: '🥇', 2: '🥈', 3: '🥉' })[n] || n; },
    posicionJugador(pos) {
        return ({
            PORTERO:    { label: 'POR', cls: 'pos-P' },
            DEFENSA:    { label: 'DEF', cls: 'pos-D' },
            MEDIOCAMPO: { label: 'MED', cls: 'pos-M' },
            DELANTERO:  { label: 'DEL', cls: 'pos-A' },
        })[pos] || { label: XSS.s(pos), cls: '' };
    },
    flag(url, nom) {
        return `<img class="flag" src="${XSS.s(url)}" alt="${XSS.s(nom)}" onerror="this.style.visibility='hidden'" />`;
    },
    badge(est, blq) {
        if (est === 'EN_JUEGO')   return '<span class="badge b-live">En vivo</span>';
        if (est === 'FINALIZADO') return '<span class="badge b-done">Finalizado</span>';
        if (blq)                  return '<span class="badge b-lock">🔒 Cerrado</span>';
        return '<span class="badge b-open">Abierto</span>';
    },
    goles(val) {
        const n = parseInt(val);
        return (!isNaN(n) && n >= 0 && n <= 20) ? n : '?';
    },
};

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
        fab.disabled    = true;
        fab.textContent = '⏳ Guardando...';

        // Lanzar todas las predicciones en paralelo en lugar de secuencialmente
        const resultados = await Promise.all(
            keys.map(async pid => {
                const { golesLocal, golesVisitante } = State.pending[pid];
                if (golesLocal === null || golesVisitante === null) return { pid, ok: false, invalido: true };
                const r = await ApiPredicciones.guardar(parseInt(pid), golesLocal, golesVisitante);
                return { pid, ok: r?.ok, data: r?.data };
            })
        );

        let ok = 0, fail = 0;
        resultados.forEach(({ pid, ok: exito, invalido, data }) => {
            if (invalido) { fail++; return; }
            if (exito) {
                State.misPreds[pid] = {
                    ...State.misPreds[pid],
                    ...data,
                    fechaCarga:      new Date().toISOString(),
                    puntosObtenidos: null,
                };
                delete State.pending[pid];
                ok++;
            } else {
                Toast.err(`Error partido ${pid}`);
                fail++;
            }
        });

        fab.disabled  = false;
        fab.innerHTML = '💾 Guardar predicciones <span class="fabn" id="fabn">'
            + Object.keys(State.pending).length + '</span>';

        if (ok)   Toast.ok(`✅ ${ok} predicción${ok > 1 ? 'es' : ''} guardada${ok > 1 ? 's' : ''}`);
        if (fail) Toast.err(`⚠️ ${fail} fallo${fail > 1 ? 's' : ''}`);

        Views.Partidos.refreshStats();
        Fab.update();
        Views.Partidos.render();
    },
};