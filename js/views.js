/* ═══════════════════════════════════════════════════════════
   views.js — Lógica de todas las vistas de la SPA v2.0
   CPCE Mendoza · Prode Mundial 2026
   CAMBIOS:
   - userCardHTML: onclick usa data-* attributes + delegación
     de eventos, eliminando interpolación de strings con datos
     de usuario en atributos onclick (vector XSS).
   - Ranking: porcentajeAciertos ahora llega del backend y
     se muestra correctamente.
   - Admin.loadResultados: no reutiliza State.partidos para
     la vista de resultados (necesita datos frescos del server).
   - Partidos._ticker: limpiado también al navegar a otra vista.
   - Selecciones: search() reutiliza el template correctamente.
   - Perfil: historial ordenado por fecha del PARTIDO, no de carga.
   - Admin.confirmarResultado: deshabilita el botón durante el
     envío para evitar doble submit.
   - Todos los renders usan DocumentFragment o innerHTML asignado
     una sola vez por sección (evita reflows múltiples).
═══════════════════════════════════════════════════════════ */

const Views = {

  load(name, params = {}) {
    switch (name) {
      case 'partidos':    Views.Partidos.load();    break;
      case 'ranking':     Views.Ranking.load();     break;
      case 'selecciones': Views.Selecciones.load(); break;
      case 'reglamento':  Views.Reglamento.load();  break;
      case 'perfil':      Views.Perfil.load();      break;
      case 'admin':       Views.Admin.load();       break;
    }
  },

  /* ═══════════════════════════════════════════════
     AUTH VIEW
  ═══════════════════════════════════════════════ */
  Auth: {
    async doLogin() {
      const emailEl = document.getElementById('le');
      const passEl  = document.getElementById('lp');
      const email   = emailEl?.value.trim() || '';
      const pass    = passEl?.value || '';

      if (!email || !pass) return Toast.err('Completá todos los campos');

      const btn = document.getElementById('bl');
      if (btn) { btn.disabled = true; btn.textContent = 'Ingresando...'; }

      const r = await ApiAuth.login(email, pass);

      if (btn) { btn.disabled = false; btn.textContent = 'Ingresar'; }

      if (!r?.ok) return Toast.err(r?.data?.error || 'Credenciales incorrectas');
      Auth.saveSession(r.data);
      Auth.boot();
    },

    async doReg() {
      const nombre = document.getElementById('rn')?.value.trim() || '';
      const email  = document.getElementById('re')?.value.trim() || '';
      const area   = document.getElementById('ra')?.value.trim() || '';
      const pass   = document.getElementById('rp')?.value || '';

      if (!nombre || !email || !pass) return Toast.err('Completá todos los campos obligatorios');
      if (pass.length < 6) return Toast.err('La contraseña debe tener al menos 6 caracteres');

      const btn = document.getElementById('br');
      if (btn) { btn.disabled = true; btn.textContent = 'Creando cuenta...'; }

      const r = await ApiAuth.registro(nombre, email, pass, area || null);

      if (btn) { btn.disabled = false; btn.textContent = 'Crear cuenta'; }

      if (!r?.ok) return Toast.err(r?.data?.error || 'Error al registrarse');
      Toast.ok('¡Cuenta creada! Bienvenido/a 🎉');
      Auth.saveSession(r.data);
      Auth.boot();
    },
  },

  /* ═══════════════════════════════════════════════
     REGLAMENTO
  ═══════════════════════════════════════════════ */
  Reglamento: {
    _loaded: false,
    load() {
      // El reglamento es estático: renderizar solo una vez
      if (Views.Reglamento._loaded) return;
      const out = document.getElementById('reglamento-content');
      if (!out) return;
      out.innerHTML = Views.Reglamento.html();
      Views.Reglamento._loaded = true;
    },

    html() {
      return `
      <div style="background:linear-gradient(135deg,var(--navy) 0%,var(--blue) 100%);
                  border-radius:var(--rl);padding:32px 36px;margin-bottom:24px;
                  display:flex;align-items:center;gap:24px;flex-wrap:wrap">
        <div style="font-size:56px;line-height:1;filter:drop-shadow(0 4px 12px rgba(0,0,0,.3))">🏆</div>
        <div>
          <div style="font-family:var(--disp);font-size:clamp(24px,4vw,36px);
                      font-weight:800;color:#fff;letter-spacing:.5px;line-height:1">
            PRODE MUNDIAL 2026
          </div>
          <div style="font-size:14px;color:rgba(255,255,255,.7);margin-top:6px">
            Reglamento oficial · Consejo Profesional de Ciencias Económicas de Mendoza
          </div>
          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
            <span style="background:rgba(255,255,255,.15);color:#fff;font-size:12px;
                         font-weight:600;padding:4px 12px;border-radius:20px;
                         border:1px solid rgba(255,255,255,.25)">📅 Junio – Julio 2026</span>
            <span style="background:rgba(255,255,255,.15);color:#fff;font-size:12px;
                         font-weight:600;padding:4px 12px;border-radius:20px;
                         border:1px solid rgba(255,255,255,.25)">🏟️ 48 selecciones · 12 grupos</span>
            <span style="background:rgba(255,255,255,.15);color:#fff;font-size:12px;
                         font-weight:600;padding:4px 12px;border-radius:20px;
                         border:1px solid rgba(255,255,255,.25)">🎯 Uso interno CPCE Mendoza</span>
          </div>
        </div>
      </div>

      <div style="background:var(--white);border:1px solid var(--border);
                  border-radius:var(--rl);overflow:hidden;box-shadow:var(--shm);margin-bottom:20px">
        <div style="background:var(--navy);padding:16px 24px;display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">🎯</span>
          <span style="font-family:var(--disp);font-size:20px;font-weight:800;color:#fff;letter-spacing:.5px">SISTEMA DE PUNTUACIÓN</span>
        </div>
        <div style="padding:20px 24px">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px">
            ${[
              { pts: 3, color: 'var(--amber)', border: '#f0c060', bg: 'var(--abg)', titulo: 'Resultado exacto',
                desc: 'Acertás los goles exactos de ambos equipos', ej: 'predecís <strong>2-1</strong> y termina <strong>2-1</strong>' },
              { pts: 1, color: 'var(--blue)',  border: '#a0c0e8', bg: 'var(--light)', titulo: 'Tendencia correcta',
                desc: 'Acertás quién gana o que hay empate, pero no los goles exactos', ej: 'predecís <strong>2-0</strong> y termina <strong>1-0</strong>' },
              { pts: 0, color: 'var(--red)',   border: '#f0a0a0', bg: 'var(--rbg)', titulo: 'Sin acierto',
                desc: 'No acertás ni el resultado ni quién gana o empata', ej: 'predecís <strong>2-0</strong> y termina <strong>0-1</strong>' },
            ].map(c => `
              <div style="background:${c.bg};border:2px solid ${c.border};border-radius:var(--r);padding:20px;text-align:center">
                <div style="font-family:var(--disp);font-size:52px;font-weight:800;color:${c.color};line-height:1">${c.pts}</div>
                <div style="font-size:13px;font-weight:700;color:${c.color};text-transform:uppercase;letter-spacing:1px;margin-top:2px">PUNTOS</div>
                <div style="font-size:13px;font-weight:600;color:var(--text);margin-top:10px">${c.titulo}</div>
                <div style="font-size:12px;color:var(--tmut);margin-top:4px;line-height:1.4">${c.desc}</div>
                <div style="margin-top:10px;background:var(--white);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--tmid);border:1px solid ${c.border}">
                  Ej: ${c.ej}
                </div>
              </div>`).join('')}
          </div>
          <div style="background:var(--bg);border-radius:var(--r);overflow:hidden;border:1px solid var(--border)">
            <div style="padding:10px 16px;border-bottom:1px solid var(--border);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--tmut)">
              📊 Ejemplos de puntuación
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead>
                <tr style="background:var(--white)">
                  <th style="padding:10px 14px;text-align:left;color:var(--tmid);font-weight:600;border-bottom:1px solid var(--border)">Resultado real</th>
                  <th style="padding:10px 14px;text-align:left;color:var(--tmid);font-weight:600;border-bottom:1px solid var(--border)">Tu predicción</th>
                  <th style="padding:10px 14px;text-align:center;color:var(--tmid);font-weight:600;border-bottom:1px solid var(--border)">Puntos</th>
                  <th style="padding:10px 14px;text-align:left;color:var(--tmid);font-weight:600;border-bottom:1px solid var(--border)">Motivo</th>
                </tr>
              </thead>
              <tbody>
                ${[
                  ['2 – 1','2 – 1','🎯 3','Resultado exacto — ¡pleno!'],
                  ['3 – 0','1 – 0','👍 1','Acertaste que ganaba el local'],
                  ['1 – 1','2 – 2','👍 1','Acertaste el empate'],
                  ['0 – 0','0 – 0','🎯 3','Empate exacto — ¡pleno!'],
                  ['1 – 2','2 – 0','❌ 0','Predijiste local, ganó visitante'],
                  ['0 – 1','1 – 1','❌ 0','Predijiste empate, ganó visitante'],
                ].map(([r, p, pts, m], i) => `
                  <tr style="background:${i % 2 === 0 ? 'var(--white)' : 'var(--bg)'}">
                    <td style="padding:9px 14px;font-weight:700;color:var(--navy)">${r}</td>
                    <td style="padding:9px 14px;color:var(--tmid)">${p}</td>
                    <td style="padding:9px 14px;text-align:center;font-weight:700">${pts}</td>
                    <td style="padding:9px 14px;color:var(--tmut);font-size:12px">${m}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:20px">
        ${[
          { color: 'var(--cpce-blue,var(--blue))', ico: '👥', titulo: 'PARTICIPACIÓN', items: [
            ['✅','Puede participar todo el personal del CPCE Mendoza.'],
            ['✅','El registro es gratuito y de uso exclusivo interno.'],
            ['✅','Cada participante tiene una cuenta individual e intransferible.'],
            ['✅','La participación es voluntaria.'],
            ['⚠️','Queda prohibido compartir o ceder el acceso a la cuenta a otra persona.'],
          ]},
          { color: 'var(--green)', ico: '⚽', titulo: 'PREDICCIONES', items: [
            ['📝','Se pronostica el marcador exacto (goles de cada equipo) de cada partido.'],
            ['🔓','Las predicciones están abiertas desde que el partido aparece en el fixture.'],
            ['🔒','Las predicciones se cierran automáticamente <strong>15 minutos antes</strong> del inicio del partido.'],
            ['✏️','Podés modificar tu predicción todas las veces que quieras hasta el cierre.'],
            ['🚫','Una vez cerrado el partido no se puede cargar ni modificar ningún pronóstico.'],
            ['0️⃣','Los partidos sin predicción cargada otorgan 0 puntos automáticamente.'],
          ]},
          { color: 'var(--amber)', ico: '🏅', titulo: 'RANKING Y DESEMPATES', items: [
            ['📊','La tabla de posiciones se actualiza automáticamente al cargar cada resultado.'],
            ['🌐','Existe un ranking general y rankings por área/sector del Consejo.'],
            ['1️⃣','<strong>Primer criterio de desempate:</strong> mayor cantidad de plenos (resultados exactos).'],
            ['2️⃣','<strong>Segundo criterio de desempate:</strong> fecha de registro más antigua en el sistema.'],
            ['👁️','Todos los participantes pueden ver el ranking completo en tiempo real.'],
          ]},
          { color: '#6b21a8', ico: '🔍', titulo: 'TRANSPARENCIA', items: [
            ['📡','Los resultados reales los carga únicamente el administrador del sistema.'],
            ['⚡','El cálculo de puntos es automático e inmediato al cargar el resultado.'],
            ['⚠️','Ante errores de carga, el administrador puede corregir un resultado. El sistema recalcula los puntos automáticamente.'],
          ]},
          { color: '#0f766e', ico: '🗓️', titulo: 'FASES DEL TORNEO', items: [
            ['⚽','<strong>Fase de grupos:</strong> 48 partidos, 12 grupos de 4 equipos. Los 2 primeros de cada grupo avanzan más 8 mejores terceros.'],
            ['⚽','<strong>Ronda de 32:</strong> 32 equipos clasificados.'],
            ['⚽','<strong>Octavos, cuartos, semifinales y final</strong> completan el torneo.'],
            ['📋','Las predicciones de cada fase se habilitarán a medida que avance el Mundial.'],
            ['🏆','El sistema acumula puntos de <strong>todas las fases</strong> del torneo.'],
          ]},
          { color: 'var(--navy)', ico: '🛠️', titulo: 'SOPORTE Y CONTACTO', items: [
            ['🔑','¿Olvidaste tu contraseña? Contactá al administrador del sistema para que te la resetee.'],
            ['✏️','¿Querés cambiar tu contraseña? Podés hacerlo desde <strong>Mi Perfil → Cambiar contraseña</strong>.'],
            ['🏢','¿Tu área no está asignada? Consultá al administrador para que te la agregue.'],
            ['🐛','¿Encontraste un error en un resultado? Notificalo inmediatamente al administrador.'],
            ['📱','El sistema funciona desde cualquier dispositivo con navegador web.'],
          ]},
        ].map(s => `
          <div style="background:var(--white);border:1px solid var(--border);border-radius:var(--rl);box-shadow:var(--sh);overflow:hidden">
            <div style="background:${s.color};padding:14px 20px;display:flex;align-items:center;gap:8px">
              <span style="font-size:18px">${s.ico}</span>
              <span style="font-family:var(--disp);font-size:17px;font-weight:800;color:#fff;letter-spacing:.3px">${s.titulo}</span>
            </div>
            <div style="padding:18px 20px">
              <ul style="list-style:none;display:flex;flex-direction:column;gap:10px">
                ${s.items.map(([ico, txt]) => `
                  <li style="display:flex;gap:10px;font-size:13px;line-height:1.5;color:var(--tmid)">
                    <span style="flex-shrink:0;margin-top:1px">${ico}</span><span>${txt}</span>
                  </li>`).join('')}
              </ul>
            </div>
          </div>`).join('')}
      </div>

      <div style="background:var(--light);border:1px solid var(--bstrong);border-radius:var(--r);
                  padding:16px 20px;display:flex;gap:12px;align-items:flex-start">
        <span style="font-size:20px;flex-shrink:0">ℹ️</span>
        <div style="font-size:13px;color:var(--tmid);line-height:1.6">
          <strong style="color:var(--navy)">Nota:</strong>
          Este Prode es una actividad recreativa interna del Consejo Profesional de Ciencias Económicas de Mendoza.
          No tiene fines económicos ni constituye apuesta de ningún tipo.
          La participación implica la aceptación de este reglamento.
          El CPCE se reserva el derecho de realizar modificaciones al reglamento en caso de ser necesario,
          comunicándolo oportunamente a los participantes.
        </div>
      </div>`;
    },
  },

  /* ═══════════════════════════════════════════════
     FIXTURE — PARTIDOS
  ═══════════════════════════════════════════════ */
  Partidos: {
    _ticker: null,

    async load() {
      if (State.partidos.length > 0) {
        Views.Partidos.refreshStats();
        Views.Partidos.render();
        Views.Partidos._startTicker();
        Views.Partidos._refreshBackground();
        return;
      }
      document.getElementById('mout').innerHTML = '<div class="spinner"></div>';
      const [rp, rm] = await Promise.all([
        ApiPartidos.getAll(),
        ApiPredicciones.getMias(),
      ]);
      if (!rp?.ok) return Toast.err('No se pudieron cargar los partidos');
      State.partidos = rp.data || [];
      State.misPreds = {};
      (rm?.data || []).forEach(p => { State.misPreds[p.partidoId] = p; });
      Views.Partidos.refreshStats();
      Views.Partidos.render();
      Views.Partidos._startTicker();
    },

    _startTicker() {
      Views.Partidos._stopTicker();
      Views.Partidos._ticker = setInterval(() => {
        if (Router.current !== 'partidos') {
          Views.Partidos._stopTicker();
          return;
        }
        const ahora   = Date.now();
        const ventana = (MINUTOS_CIERRE + 2) * 60 * 1000;
        const hayProximos = State.partidos.some(p => {
          if (p.estado !== 'PENDIENTE') return false;
          const inicio = new Date(p.fechaHora).getTime();
          const diff   = inicio - ahora;
          return diff >= -60_000 && diff <= ventana;
        });
        if (hayProximos) Views.Partidos.render();
      }, 30_000);
    },

    _stopTicker() {
      if (Views.Partidos._ticker) {
        clearInterval(Views.Partidos._ticker);
        Views.Partidos._ticker = null;
      }
    },

    async _refreshBackground() {
      const [rp, rm] = await Promise.all([
        ApiPartidos.getAll(),
        ApiPredicciones.getMias(),
      ]);
      if (!rp?.ok) return;
      State.partidos = rp.data || [];
      State.misPreds = {};
      (rm?.data || []).forEach(p => { State.misPreds[p.partidoId] = p; });
      Views.Partidos.refreshStats();
      Views.Partidos.render();
    },

    refreshStats() {
      const vals   = Object.values(State.misPreds);
      const pts    = vals.reduce((s, p) => s + (p.puntosObtenidos || 0), 0);
      const plenos = vals.filter(p => p.puntosObtenidos === 3).length;
      const pct    = State.partidos.length
        ? Math.round(vals.length / State.partidos.length * 100) : 0;

      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('sp',   pts);
      set('spl',  plenos);
      set('spr',  vals.length);
      set('sprs', `de ${State.partidos.length} partidos`);
      set('ubp',  `${pts} pts`);
      set('plbl', `${vals.length} de ${State.partidos.length} pronosticados`);
      set('ppct', pct + '%');

      const pbar = document.getElementById('pbar');
      if (pbar) pbar.style.width = pct + '%';

      const mio   = State.ranking.find(u => u.email === State.user?.email);
      const posEl = document.getElementById('spos');
      if (posEl) posEl.textContent = mio ? `#${mio.posicion}` : '—';
    },

    setFilter(f, btn) {
      State.filter = f;
      document.querySelectorAll('#view-partidos .tab').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      Views.Partidos.render();
    },

    render() {
      let lista = State.partidos;
      if (State.filter !== 'todos') lista = lista.filter(p => p.estado === State.filter);

      const out = document.getElementById('mout');
      if (!out) return;

      if (!lista.length) {
        out.innerHTML = `<div class="empty"><div class="eico">🔍</div>No hay partidos en esta categoría</div>`;
        return;
      }

      const grupos = {};
      lista.forEach(p => { (grupos[p.grupo] = grupos[p.grupo] || []).push(p); });

      // Construir HTML en un solo string y asignar una sola vez (menos reflows)
      out.innerHTML = Object.keys(grupos).sort().map(g => `
        <div class="grp-section">
          <div class="grp-label">
            <span class="grp-pill">GRUPO ${XSS.s(g)}</span>
            <div class="grp-line"></div>
          </div>
          <div class="mgrid">${grupos[g].map(Views.Partidos.cardHTML).join('')}</div>
        </div>`).join('');
    },

    cardHTML(p) {
      const m  = State.misPreds[p.id];
      const pd = State.pending[p.id];
      const lk = Fmt.estaBloquedoPorTiempo(p.estado, p.fechaHora);

      let center = '';
      if (p.estado === 'FINALIZADO') {
        center = `
          <div class="sdisplay">
            <span class="snum">${p.golesLocal ?? '?'}</span>
            <span class="ssep">–</span>
            <span class="snum">${p.golesVisitante ?? '?'}</span>
          </div>`;
      } else {
        const vl = pd?.golesLocal     ?? m?.golesLocalPredichos     ?? '';
        const vv = pd?.golesVisitante ?? m?.golesVisitantePredichos ?? '';
        center = `
          <div class="pinputs">
            <input type="number" min="0" max="20" class="pi"
              value="${vl}" placeholder="0" ${lk ? 'disabled' : ''}
              data-pid="${p.id}" data-side="l"
              oninput="Views.Partidos.onInput(this)" />
            <span class="psep">–</span>
            <input type="number" min="0" max="20" class="pi"
              value="${vv}" placeholder="0" ${lk ? 'disabled' : ''}
              data-pid="${p.id}" data-side="v"
              oninput="Views.Partidos.onInput(this)" />
          </div>`;
      }

      let footer = '';
      if (p.estado === 'FINALIZADO') {
        if (m) {
          footer = `
            <div class="mfooter">
              <span class="my-lbl">Tu pronóstico:
                <span class="my-sc">${m.golesLocalPredichos} – ${m.golesVisitantePredichos}</span>
              </span>
              <span class="pbadge ${Fmt.puntosClass(m.puntosObtenidos)}">
                ${Fmt.puntosLabel(m.puntosObtenidos)}
              </span>
            </div>`;
        } else {
          footer = `
            <div class="mfooter">
              <span class="my-lbl">Sin pronóstico</span>
              <span class="pbadge p0">❌ Sin puntos</span>
            </div>`;
        }
      } else if (pd) {
        footer = `
          <div class="mfooter">
            <span style="color:var(--amber);font-size:12px;font-weight:600">● Cambios sin guardar</span>
          </div>`;
      } else if (m && !lk) {
        footer = `
          <div class="mfooter">
            <span style="color:var(--green);font-size:12px;font-weight:600">
              ✓ Guardado: ${m.golesLocalPredichos}–${m.golesVisitantePredichos}
            </span>
          </div>`;
      } else if (lk && m) {
        footer = `
          <div class="mfooter">
            <span class="my-lbl">Tu pronóstico:
              <span class="my-sc">${m.golesLocalPredichos} – ${m.golesVisitantePredichos}</span>
            </span>
            <span class="pbadge pp">En juego</span>
          </div>`;
      }

      return `
        <div class="mcard ${lk ? 'locked' : ''}">
          <div class="mcard-top">
            <span class="mdate">${Fmt.fecha(p.fechaHora)}</span>
            ${Fmt.badge(p.estado, lk, p.fechaHora)}
          </div>
          <div class="mteams">
            <div class="team">
              ${Fmt.flag(p.banderaLocal, p.equipoLocal)}
              <div class="tname">${XSS.s(p.equipoLocal)}</div>
            </div>
            <div class="mcenter">${center}</div>
            <div class="team">
              ${Fmt.flag(p.banderaVisitante, p.equipoVisitante)}
              <div class="tname">${XSS.s(p.equipoVisitante)}</div>
            </div>
          </div>
          ${footer}
        </div>`;
    },

    // Ahora recibe el elemento input directamente (sin parámetros interpolados)
    onInput(input) {
      const pid  = parseInt(input.dataset.pid);
      const side = input.dataset.side;
      const val  = input.value;

      if (!State.pending[pid]) {
        const m = State.misPreds[pid];
        State.pending[pid] = {
          golesLocal:     m?.golesLocalPredichos     ?? null,
          golesVisitante: m?.golesVisitantePredichos ?? null,
        };
      }
      State.pending[pid][side === 'l' ? 'golesLocal' : 'golesVisitante'] =
        val === '' ? null : parseInt(val);
      Fab.update();
    },
  },

  /* ═══════════════════════════════════════════════
     RANKING
  ═══════════════════════════════════════════════ */
  Ranking: {
    async load() {
      if (State.ranking.length > 0) {
        Views.Ranking._populate(State.ranking);
        Views.Ranking._loadAreas();
        Views.Ranking._refreshBackground();
        return;
      }
      document.getElementById('rout').innerHTML = '<div class="spinner"></div>';
      const [r, rAreas] = await Promise.all([
        ApiRanking.get(),
        ApiRanking.getAreas(),
      ]);
      if (!r?.ok) return Toast.err('Error al cargar el ranking');
      State.ranking = r.data || [];
      Views.Ranking._populateAreas(rAreas);
      Views.Ranking._populate(State.ranking);
    },

    async _loadAreas() {
      const sel = document.getElementById('ranking-area-filter');
      if (sel && sel.options.length <= 1) {
        const rAreas = await ApiRanking.getAreas();
        Views.Ranking._populateAreas(rAreas);
      }
    },

    async _refreshBackground() {
      const r = await ApiRanking.get();
      if (!r?.ok) return;
      State.ranking = r.data || [];
      // Solo re-renderizar si la vista sigue activa
      if (Router.current === 'ranking') {
        Views.Ranking.render(State.ranking);
      }
    },

    _populateAreas(rAreas) {
      const sel = document.getElementById('ranking-area-filter');
      if (sel && rAreas?.ok && rAreas.data?.length) {
        sel.innerHTML = '<option value="">🌐 Todas las áreas</option>' +
          rAreas.data.map(a => `<option value="${XSS.s(a)}">${XSS.s(a)}</option>`).join('');
      }
    },

    _populate(data) {
      const mio   = data.find(u => u.email === State.user?.email);
      const posEl = document.getElementById('spos');
      if (posEl) posEl.textContent = mio ? `#${mio.posicion}` : '—';
      Views.Ranking.render(data);
    },

    async filtrarPorArea(area) {
      document.getElementById('rout').innerHTML = '<div class="spinner"></div>';
      const r = await ApiRanking.get(area || null);
      if (!r?.ok) return Toast.err('Error al filtrar el ranking');
      Views.Ranking.render(r.data || []);
    },

    render(data) {
      const out = document.getElementById('rout');
      if (!out) return;

      if (!data.length) {
        out.innerHTML = `<div class="empty"><div class="eico">📊</div>Aún no hay datos en el ranking</div>`;
        return;
      }

      const myEmail = State.user?.email;
      const rows = data.map(u => `
        <tr class="${u.email === myEmail ? 'isme' : ''}">
          <td><div class="rpos">${Fmt.posicion(u.posicion)}</div></td>
          <td>
            <div class="rname">
              ${XSS.s(u.nombre)}
              ${u.email === myEmail ? '<span class="metag">vos</span>' : ''}
            </div>
            <div class="remail">${XSS.s(u.email)}</div>
            ${u.area ? `<div style="font-size:11px;color:var(--blue);margin-top:2px;font-weight:500">🏢 ${XSS.s(u.area)}</div>` : ''}
          </td>
          <td><span class="rpts">${u.puntosTotales}</span></td>
          <td><strong>${u.plenosTotales}</strong></td>
          <td style="color:var(--tmut);font-size:13px">${u.porcentajeAciertos ?? 0}%</td>
          <td style="color:var(--tmut);font-size:13px">${u.partidosPredichos}</td>
        </tr>`).join('');

      out.innerHTML = `
        <div class="rtable-wrap">
          <table class="rtable">
            <thead>
              <tr>
                <th>#</th>
                <th style="text-align:left">Participante</th>
                <th>Puntos</th>
                <th>Plenos ⭐</th>
                <th>% Aciertos</th>
                <th>Predicciones</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="margin-top:14px;padding:12px 16px;background:var(--white);
                    border:1px solid var(--border);border-radius:var(--r);
                    font-size:12px;color:var(--tmut);box-shadow:var(--sh)">
          <strong style="color:var(--tmid)">Sistema de puntos:</strong>
          &nbsp;🎯 Resultado exacto = 3 pts &nbsp;·&nbsp;
          👍 Ganador/empate = 1 pt &nbsp;·&nbsp;
          ❌ Sin acierto = 0 pts &nbsp;·&nbsp;
          Desempate: más plenos → registro más antiguo
        </div>`;
    },
  },

  /* ═══════════════════════════════════════════════
     SELECCIONES
  ═══════════════════════════════════════════════ */
  Selecciones: {
    async load() {
      if (State.equipos && State.equipos.length > 0) {
        if (!State.partidos.length) {
          const rp = await ApiPartidos.getAll();
          if (rp?.ok) State.partidos = rp.data || [];
        }
        Views.Selecciones.render(State.equipos);
        return;
      }
      document.getElementById('sel-out').innerHTML = '<div class="spinner"></div>';
      const needsPartidos = !State.partidos.length;
      const calls         = [ApiEquipos.getAll()];
      if (needsPartidos)  calls.push(ApiPartidos.getAll());
      const [r, rp]       = await Promise.all(calls);
      if (needsPartidos && rp?.ok) State.partidos = rp.data || [];
      if (!r?.ok || !r.data) {
        document.getElementById('sel-out').innerHTML =
          '<div class="empty">⚠ No pudimos cargar los equipos.</div>';
        return;
      }
      State.equipos = r.data;
      Views.Selecciones.render(State.equipos);
    },

    render(equipos) {
      const out = document.getElementById('sel-out');
      if (!out) return;
      if (!equipos.length) { out.innerHTML = '<div class="empty">Sin equipos cargados</div>'; return; }

      const grupos = {};
      equipos.forEach(e => { (grupos[e.grupo] = grupos[e.grupo] || []).push(e); });

      const cards = Object.keys(grupos).sort().map(g => `
        <div class="grp-section">
          <div class="grp-label">
            <span class="grp-pill">GRUPO ${XSS.s(g)}</span>
            <div class="grp-line"></div>
          </div>
          <div class="equipos-grid">
            ${grupos[g].map(Views.Selecciones.equipoCardHTML).join('')}
          </div>
        </div>`).join('');

      out.innerHTML = `
        <div class="equipos-search">
          <span class="ico">🔍</span>
          <input type="text" placeholder="Buscar selección..."
                 oninput="Views.Selecciones.search(this.value)" />
        </div>
        <div id="sel-grupos">${cards}</div>`;
    },

    equipoCardHTML(e) {
      const stats = Views.Selecciones.calcStats(e.nombre);
      return `
        <div class="equipo-card" data-nombre="${XSS.s(e.nombre)}"
             onclick="Views.Selecciones.showDetail(this.dataset.nombre)">
          <div class="eq-top">
            <img class="eq-flag" src="${XSS.s(e.banderaUrl || '')}" alt="${XSS.s(e.nombre)}"
                 loading="lazy" onerror="this.style.visibility='hidden'" />
            <div>
              <div class="eq-name">${XSS.s(e.nombre)}</div>
              <div class="eq-grp">Grupo ${XSS.s(e.grupo)}</div>
            </div>
          </div>
          <div class="eq-stats">
            <div class="eq-stat"><div class="eq-stat-v">${stats.pj}</div><div class="eq-stat-l">PJ</div></div>
            <div class="eq-stat"><div class="eq-stat-v">${stats.pts}</div><div class="eq-stat-l">PTS</div></div>
            <div class="eq-stat"><div class="eq-stat-v">${stats.gf}</div><div class="eq-stat-l">GF</div></div>
            <div class="eq-stat"><div class="eq-stat-v">${stats.gc}</div><div class="eq-stat-l">GC</div></div>
          </div>
        </div>`;
    },

    calcStats(nombre) {
      const stats = { pj: 0, pts: 0, gf: 0, gc: 0 };
      State.partidos
        .filter(p => p.estado === 'FINALIZADO' &&
          (p.equipoLocal === nombre || p.equipoVisitante === nombre))
        .forEach(p => {
          const esLocal = p.equipoLocal === nombre;
          const gf = parseInt(esLocal ? p.golesLocal : p.golesVisitante) || 0;
          const gc = parseInt(esLocal ? p.golesVisitante : p.golesLocal) || 0;
          stats.pj++;
          stats.gf += gf;
          stats.gc += gc;
          if (gf > gc)      stats.pts += 3;
          else if (gf === gc) stats.pts += 1;
        });
      return stats;
    },

    search(q) {
      const txt      = q.toLowerCase();
      const filtrado = State.equipos.filter(e =>
        e.nombre.toLowerCase().includes(txt) || e.grupo.toLowerCase().includes(txt)
      );
      const grupos = {};
      filtrado.forEach(e => { (grupos[e.grupo] = grupos[e.grupo] || []).push(e); });
      const cont = document.getElementById('sel-grupos');
      if (!cont) return;
      cont.innerHTML = Object.keys(grupos).sort().map(g => `
        <div class="grp-section">
          <div class="grp-label">
            <span class="grp-pill">GRUPO ${XSS.s(g)}</span>
            <div class="grp-line"></div>
          </div>
          <div class="equipos-grid">
            ${grupos[g].map(Views.Selecciones.equipoCardHTML).join('')}
          </div>
        </div>`).join('') || '<div class="empty">Sin resultados</div>';
    },

    async showDetail(nombre) {
      const equipo = State.equipos.find(e => e.nombre === nombre);
      if (!equipo) return;

      const cont = document.getElementById('sel-detail-content');
      if (!cont) return;
      cont.innerHTML = '<div class="spinner"></div>';
      Modal.open('modal-sel-detail');

      const rj        = await ApiEquipos.getJugadores(equipo.id);
      const jugadores = (rj?.ok && Array.isArray(rj.data)) ? rj.data : [];

      cont.innerHTML = `
        <div class="eq-detail-head">
          <img class="eq-detail-flag" src="${XSS.s(equipo.banderaUrl || '')}"
               alt="${XSS.s(equipo.nombre)}" onerror="this.style.display='none'" />
          <div>
            <div class="eq-detail-name">${XSS.s(equipo.nombre)}</div>
            <div class="eq-detail-sub">Grupo ${XSS.s(equipo.grupo)}</div>
          </div>
        </div>
        <div class="eq-detail-body">
          <div style="font-family:var(--disp);font-size:16px;font-weight:800;margin-bottom:12px">Plantilla</div>
          ${jugadores.length > 0
            ? Views.Selecciones.jugadoresHTML(jugadores)
            : '<div class="empty">Sin información</div>'}
        </div>`;
    },

    jugadoresHTML(jugadores) {
      const orden  = ['PORTERO', 'DEFENSA', 'MEDIOCAMPO', 'DELANTERO'];
      const grupos = {};
      jugadores.forEach(j => { (grupos[j.posicion] = grupos[j.posicion] || []).push(j); });
      return orden.filter(pos => grupos[pos]?.length).map(pos => `
        <div style="margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;color:var(--tmut);text-transform:uppercase;margin-bottom:6px">${pos}</div>
          ${grupos[pos].sort((a, b) => a.nroCamiseta - b.nroCamiseta).map(j => `
            <div class="j-row" style="padding:6px;border-bottom:1px solid #eee">
              <span style="width:25px;font-weight:bold">${parseInt(j.nroCamiseta) || ''}</span>
              <span>${XSS.s(j.nombre)} ${j.esEstrella ? '⭐' : ''}</span>
            </div>`).join('')}
        </div>`).join('');
    },
  },

  /* ═══════════════════════════════════════════════
     MI PERFIL
  ═══════════════════════════════════════════════ */
  Perfil: {
    async load() {
      const out  = document.getElementById('perfil-out');
      if (!out) return;
      out.innerHTML = '<div class="spinner"></div>';

      const user = State.user;
      if (!user) return;

      const needsPartidos = !State.partidos.length;
      const needsPreds    = !Object.keys(State.misPreds).length;

      if (needsPartidos || needsPreds) {
        const calls = [];
        if (needsPartidos) calls.push(ApiPartidos.getAll());
        if (needsPreds)    calls.push(ApiPredicciones.getMias());
        const results = await Promise.all(calls);
        let idx = 0;
        if (needsPartidos && results[idx]?.ok) { State.partidos = results[idx].data || []; idx++; }
        if (needsPreds    && results[idx]?.ok) {
          State.misPreds = {};
          (results[idx].data || []).forEach(p => { State.misPreds[p.partidoId] = p; });
        }
      }

      const vals   = Object.values(State.misPreds);
      const pts    = vals.reduce((s, p) => s + (p.puntosObtenidos || 0), 0);
      const plenos = vals.filter(p => p.puntosObtenidos === 3).length;
      const tend   = vals.filter(p => p.puntosObtenidos === 1).length;
      const fallos = vals.filter(p => p.puntosObtenidos === 0).length;

      const mio = State.ranking.find(u => u.email === user.email);
      const pos = mio ? `#${mio.posicion}` : '—';

      // Ordenar por fecha del PARTIDO (no de carga) y filtrar finalizados
      const predsOrdenadas = vals
        .filter(p => {
          const partido = State.partidos.find(pt => pt.id === p.partidoId);
          return partido?.estado === 'FINALIZADO';
        })
        .sort((a, b) => {
          const pa = State.partidos.find(pt => pt.id === a.partidoId);
          const pb = State.partidos.find(pt => pt.id === b.partidoId);
          return new Date(pb?.fechaHora || 0) - new Date(pa?.fechaHora || 0);
        });

      const historialHTML = predsOrdenadas.length
        ? predsOrdenadas.slice(0, 20).map(p => {
            const partido = State.partidos.find(pt => pt.id === p.partidoId);
            if (!partido) return '';
            return `
              <div class="pred-row">
                <div class="pred-teams">${XSS.s(partido.equipoLocal)} vs. ${XSS.s(partido.equipoVisitante)}</div>
                <span class="pred-score" style="white-space:nowrap">
                  Real: ${partido.golesLocal ?? '?'}–${partido.golesVisitante ?? '?'}
                </span>
                <span class="pred-mi">${p.golesLocalPredichos}–${p.golesVisitantePredichos}</span>
                <span class="pbadge ${Fmt.puntosClass(p.puntosObtenidos)}">
                  ${Fmt.puntosLabel(p.puntosObtenidos)}
                </span>
              </div>`;
          }).join('')
        : '<div style="color:var(--tmut);font-size:13px">Aún no tenés predicciones finalizadas</div>';

      out.innerHTML = `
        <div class="perfil-header">
          <div class="perfil-av">${Fmt.iniciales(user.nombre)}</div>
          <div class="perfil-info">
            <h2>${XSS.s(user.nombre)}</h2>
            <p>${XSS.s(user.email)}</p>
            <p style="margin-top:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span class="ucrole ${user.rol === 'ROLE_ADMIN' ? 'radm' : 'rusr'}">
                ${user.rol === 'ROLE_ADMIN' ? 'Administrador' : 'Participante'}
              </span>
              ${user.area
                ? `<span style="font-size:12px;color:var(--blue);font-weight:600">🏢 ${XSS.s(user.area)}</span>`
                : `<span style="font-size:12px;color:var(--tmut)">Sin área asignada — pedísela al admin</span>`}
            </p>
          </div>
          <div class="perfil-badge">
            <div class="val">${XSS.s(pos)}</div>
            <div class="lbl">Posición</div>
          </div>
        </div>

        <div class="stats-row" style="margin-bottom:20px">
          <div class="scard">
            <div class="slabel">Puntos totales</div><div class="sval">${pts}</div>
            <div class="ssub">acumulados</div>
          </div>
          <div class="scard accent-amber">
            <div class="slabel">Plenos 🎯</div><div class="sval amber">${plenos}</div>
            <div class="ssub">resultado exacto</div>
          </div>
          <div class="scard accent-green">
            <div class="slabel">Tendencias 👍</div><div class="sval green">${tend}</div>
            <div class="ssub">ganador/empate</div>
          </div>
          <div class="scard">
            <div class="slabel">Fallos ❌</div><div class="sval navy">${fallos}</div>
            <div class="ssub">sin acierto</div>
          </div>
          <div class="scard">
            <div class="slabel">Predicciones</div><div class="sval">${vals.length}</div>
            <div class="ssub">de ${State.partidos.length} partidos</div>
          </div>
        </div>

        <div class="panel" style="margin-bottom:20px">
          <div class="panel-head">
            <div class="panel-title">📋 Historial de predicciones</div>
            <span style="font-size:12px;color:var(--tmut)">últimas ${Math.min(predsOrdenadas.length, 20)}</span>
          </div>
          <div class="panel-body">
            <div class="pred-list">${historialHTML}</div>
          </div>
        </div>

        <div class="pass-section">
          <h3>🔑 Cambiar contraseña</h3>
          <div class="pass-grid">
            <div class="field" style="margin:0">
              <label>Contraseña actual</label>
              <input type="password" id="pass-actual" placeholder="••••••••" />
            </div>
            <div class="field" style="margin:0">
              <label>Nueva contraseña</label>
              <input type="password" id="pass-nueva" placeholder="mín. 6 caracteres" />
            </div>
            <div class="field" style="margin:0">
              <label>Confirmar nueva</label>
              <input type="password" id="pass-confirm" placeholder="repetir contraseña" />
            </div>
            <button class="btn-sec" onclick="Views.Perfil.cambiarPassword()">Actualizar</button>
          </div>
        </div>`;
    },

    async cambiarPassword() {
      const actual  = document.getElementById('pass-actual')?.value  || '';
      const nueva   = document.getElementById('pass-nueva')?.value   || '';
      const confirm = document.getElementById('pass-confirm')?.value || '';

      if (!actual || !nueva || !confirm) return Toast.err('Completá todos los campos');
      if (nueva.length < 6)             return Toast.err('La nueva contraseña debe tener al menos 6 caracteres');
      if (nueva !== confirm)            return Toast.err('Las contraseñas no coinciden');

      const r = await ApiPerfil.cambiarPassword(actual, nueva);
      if (!r?.ok) return Toast.err(r?.data?.error || 'Error al cambiar la contraseña');

      Toast.ok('✅ Contraseña actualizada correctamente');
      if (document.getElementById('pass-actual'))  document.getElementById('pass-actual').value  = '';
      if (document.getElementById('pass-nueva'))   document.getElementById('pass-nueva').value   = '';
      if (document.getElementById('pass-confirm')) document.getElementById('pass-confirm').value = '';
    },
  },

  /* ═══════════════════════════════════════════════
     ADMIN
  ═══════════════════════════════════════════════ */
  Admin: {
    load() {
      Views.Admin.loadUsuarios();
      // Renderizar formulario de creación de usuario si la tab 'c' está activa
      const apc = document.getElementById('apc');
      if (apc && apc.innerHTML.trim() === '') Views.Admin.renderCrearUsuario();
    },

    switchTab(tab, btn) {
      document.querySelectorAll('.atab2').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      document.getElementById('apu').style.display = tab === 'u' ? '' : 'none';
      document.getElementById('apc').style.display = tab === 'c' ? '' : 'none';
      document.getElementById('apr').style.display = tab === 'r' ? '' : 'none';
      if (tab === 'u') Views.Admin.loadUsuarios();
      if (tab === 'c') Views.Admin.renderCrearUsuario();
      if (tab === 'r') Views.Admin.loadResultados();
    },

    renderCrearUsuario() {
      const apc = document.getElementById('apc');
      if (!apc) return;
      apc.innerHTML = `
        <div class="panel" style="max-width:480px">
          <div class="panel-head"><div class="panel-title">➕ Crear nuevo usuario</div></div>
          <div class="panel-body" style="display:flex;flex-direction:column;gap:14px">
            <div class="field" style="margin:0">
              <label>Nombre completo</label>
              <input type="text" id="cu-nombre" placeholder="Juan Pérez" />
            </div>
            <div class="field" style="margin:0">
              <label>Email</label>
              <input type="email" id="cu-email" placeholder="juan@cpce.org.ar" />
            </div>
            <div class="field" style="margin:0">
              <label>Contraseña</label>
              <input type="text" id="cu-pass" placeholder="Mínimo 6 caracteres" />
            </div>
            <div class="field" style="margin:0">
              <label>Área / Sector (opcional)</label>
              <input type="text" id="cu-area" placeholder="Ej: Contabilidad" />
            </div>
            <button class="btn-p" style="margin-top:4px" onclick="Views.Admin.crearUsuario(this)">
              ➕ Crear usuario
            </button>
          </div>
        </div>`;
    },

    async crearUsuario(btn) {
      const nombre = document.getElementById('cu-nombre')?.value.trim() || '';
      const email  = document.getElementById('cu-email')?.value.trim()  || '';
      const pass   = document.getElementById('cu-pass')?.value           || '';
      const area   = document.getElementById('cu-area')?.value.trim()   || '';

      if (!nombre || !email || !pass) return Toast.err('Completá nombre, email y contraseña');
      if (pass.length < 6)           return Toast.err('La contraseña debe tener al menos 6 caracteres');

      if (btn) { btn.disabled = true; btn.textContent = 'Creando...'; }
      const r = await ApiAuth.registro(nombre, email, pass, area || null);
      if (btn) { btn.disabled = false; btn.textContent = '➕ Crear usuario'; }

      if (!r?.ok) return Toast.err(r?.data?.error || 'Error al crear el usuario');
      Toast.ok(`✅ Usuario "${nombre}" creado correctamente`);
      // Limpiar campos
      ['cu-nombre','cu-email','cu-pass','cu-area'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      Views.Admin.loadUsuarios();
    },

    async loadUsuarios() {
      const apu = document.getElementById('apu');
      if (!apu) return;
      apu.innerHTML = '<div class="spinner"></div>';
      const r = await ApiAdmin.getUsuarios();
      if (!r?.ok) return Toast.err('Error al cargar usuarios');

      const users = r.data || [];
      if (!users.length) {
        apu.innerHTML = '<div class="empty"><div class="eico">👥</div>Sin usuarios registrados</div>';
        return;
      }

      const totalPts   = users.reduce((s, u) => s + u.puntosTotales, 0);
      const totalPreds = users.reduce((s, u) => s + u.partidosPredichos, 0);

      apu.innerHTML = `
        <div class="stats-row" style="margin-bottom:20px">
          <div class="scard">
            <div class="slabel">Participantes</div>
            <div class="sval">${users.filter(u => u.rol !== 'ROLE_ADMIN').length}</div>
            <div class="ssub">registrados</div>
          </div>
          <div class="scard">
            <div class="slabel">Total predicciones</div>
            <div class="sval">${totalPreds}</div>
            <div class="ssub">en el sistema</div>
          </div>
          <div class="scard accent-amber">
            <div class="slabel">Puntos repartidos</div>
            <div class="sval amber">${totalPts}</div>
            <div class="ssub">acumulados</div>
          </div>
        </div>
        <div class="agrid" id="users-grid"></div>`;

      // Renderizar cards con data-attributes para evitar XSS via onclick
      const grid = document.getElementById('users-grid');
      if (grid) {
        grid.innerHTML = users.map(Views.Admin.userCardHTML).join('');
      }
    },

    userCardHTML(u) {
      const ini  = Fmt.iniciales(u.nombre);
      const adm  = u.rol === 'ROLE_ADMIN';
      const area = u.area ? XSS.s(u.area) : null;
      return `
        <div class="ucard"
             data-uid="${u.id}"
             data-nombre="${XSS.s(u.nombre)}"
             data-area="${XSS.s(u.area || '')}">
          <div class="uchead">
            <div class="ucav">${ini}</div>
            <div>
              <div class="ucname">${XSS.s(u.nombre)}</div>
              <div class="ucemail">${XSS.s(u.email)}</div>
              ${area
                ? `<div style="font-size:11px;color:var(--blue);font-weight:500;margin-top:2px">🏢 ${area}</div>`
                : `<div style="font-size:11px;color:var(--tmut);margin-top:2px">Sin área asignada</div>`}
            </div>
            <span class="ucrole ${adm ? 'radm' : 'rusr'}">${adm ? 'Admin' : 'Usuario'}</span>
          </div>
          <div class="ucstats">
            <div><div class="usv">${u.puntosTotales}</div><div class="usl">Puntos</div></div>
            <div><div class="usv">${u.plenosTotales}</div><div class="usl">Plenos</div></div>
            <div><div class="usv">${u.partidosPredichos}</div><div class="usl">Pred.</div></div>
            <div><div class="usv">${u.partidosPendientes}</div><div class="usl">Pend.</div></div>
          </div>
          <div class="ucact">
            <button class="btnsm" onclick="Views.Admin._accionCard(this,'reset')">
              🔑 Reset contraseña
            </button>
            <button class="btnsm" onclick="Views.Admin._accionCard(this,'area')">
              🏢 ${area ? 'Cambiar área' : 'Asignar área'}
            </button>
            <button class="btnsm" onclick="Views.Admin._accionCard(this,'dashboard')">
              👁 Ver predicciones
            </button>
          </div>
        </div>`;
    },

    // Delegación: lee datos desde el data-* del .ucard padre
    _accionCard(btn, accion) {
      const card   = btn.closest('[data-uid]');
      if (!card) return;
      const uid    = parseInt(card.dataset.uid);
      const nombre = card.dataset.nombre || '';
      const area   = card.dataset.area   || '';
      if (accion === 'reset')     Views.Admin.openReset(uid, nombre);
      if (accion === 'area')      Views.Admin.openArea(uid, nombre, area);
      if (accion === 'dashboard') Views.Admin.verDashboard(uid, nombre);
    },

    openReset(id, nombre) {
      State.resetId = id;
      const sub = document.getElementById('mresub');
      if (sub) sub.textContent = `Nueva contraseña para: ${nombre}`;
      const inp = document.getElementById('mpass');
      if (inp) inp.value = '';
      Modal.open('modal-reset');
      setTimeout(() => inp?.focus(), 100);
    },

    async confirmReset() {
      const pass = document.getElementById('mpass')?.value || '';
      if (pass.length < 6) return Toast.err('Mínimo 6 caracteres');
      const r = await ApiAdmin.resetPassword(State.resetId, pass);
      if (!r?.ok) return Toast.err('Error al resetear contraseña');
      Modal.close();
      Toast.ok('✅ Contraseña actualizada correctamente');
    },

    openArea(id, nombre, areaActual) {
      State.areaId = id;
      const sub = document.getElementById('marea-sub');
      if (sub) sub.textContent = `Área o sector para: ${nombre}`;
      const inp = document.getElementById('marea-input');
      if (inp) inp.value = areaActual || '';
      Modal.open('modal-area');
      setTimeout(() => inp?.focus(), 100);
    },

    async confirmArea() {
      const area = document.getElementById('marea-input')?.value.trim() || '';
      const r    = await ApiAdmin.actualizarArea(State.areaId, area || null);
      if (!r?.ok) return Toast.err('Error al actualizar el área');
      Modal.close();
      Toast.ok(`✅ Área ${area ? `"${area}" asignada` : 'removida'} correctamente`);
      Views.Admin.loadUsuarios();
    },

    async verDashboard(id, nombre) {
      const titleEl = document.getElementById('mdash-title');
      const bodyEl  = document.getElementById('mdash-body');
      if (titleEl) titleEl.textContent = nombre;
      if (bodyEl)  bodyEl.innerHTML    = '<div class="spinner"></div>';
      Modal.open('modal-dashboard');

      const r = await ApiAdmin.getDashboardUsuario(id);
      if (!r?.ok || !bodyEl) {
        if (bodyEl) bodyEl.innerHTML = '<div class="empty"><div class="eico">⚠️</div>Error al cargar datos</div>';
        return;
      }

      const u         = r.data;
      const predsHTML = u.predicciones?.length
        ? u.predicciones.map(p => {
            const partido = State.partidos.find(pt => pt.id === p.partidoId);
            const teams   = partido
              ? `${XSS.s(partido.equipoLocal)} vs. ${XSS.s(partido.equipoVisitante)}`
              : `Partido #${p.partidoId}`;
            return `
              <div class="pred-row">
                <span class="pred-teams">${teams}</span>
                <span class="pred-mi">${p.golesLocalPredichos}–${p.golesVisitantePredichos}</span>
                <span class="pbadge ${Fmt.puntosClass(p.puntosObtenidos)}">
                  ${p.puntosObtenidos !== null ? Fmt.puntosLabel(p.puntosObtenidos) : '— Pendiente'}
                </span>
              </div>`;
          }).join('')
        : '<div style="color:var(--tmut);font-size:13px">Sin predicciones cargadas</div>';

      bodyEl.innerHTML = `
        <div class="stats-row" style="margin-bottom:16px">
          <div class="scard"><div class="slabel">Puntos</div><div class="sval">${u.puntosTotales}</div></div>
          <div class="scard accent-amber"><div class="slabel">Plenos</div><div class="sval amber">${u.plenosTotales}</div></div>
          <div class="scard"><div class="slabel">Predicciones</div><div class="sval">${u.partidosPredichos}</div></div>
          <div class="scard"><div class="slabel">Pendientes</div><div class="sval navy">${u.partidosPendientes}</div></div>
        </div>
        <div class="pred-list">${predsHTML}</div>`;
    },

    async loadResultados() {
      const apr = document.getElementById('apr');
      if (!apr) return;
      apr.innerHTML = '<div class="spinner"></div>';

      // Siempre pedir datos frescos del servidor para resultados
      let r  = await ApiPartidos.getAll('EN_JUEGO');
      let ps = (r?.ok && Array.isArray(r?.data)) ? r.data : [];

      if (!ps.length) {
        r  = await ApiPartidos.getAll('PENDIENTE');
        ps = (r?.ok && Array.isArray(r?.data)) ? r.data.slice(0, 24) : [];
      }

      if (!ps.length) {
        apr.innerHTML = '<div class="empty"><div class="eico">✅</div>No hay partidos pendientes de resultado</div>';
        return;
      }

      apr.innerHTML = `
        <div style="background:var(--abg);border:1px solid #f0c060;border-radius:var(--r);
                    padding:11px 15px;margin-bottom:18px;font-size:13px;color:var(--amber)">
          ⚠️ Al confirmar un resultado se calcularán los puntos de todos los participantes.
          Esta acción no se puede deshacer.
        </div>
        <div class="rlist">
          ${ps.map(p => {
            const d = Fmt.fechaCorta(p.fechaHora);
            return `
              <div class="rentry">
                <div style="flex:1;min-width:180px">
                  <div class="rteams">${XSS.s(p.equipoLocal)} vs. ${XSS.s(p.equipoVisitante)}</div>
                  <div class="rdate">
                    Grupo ${XSS.s(p.grupo)} — ${d}
                    <span class="badge ${p.estado === 'EN_JUEGO' ? 'b-live' : 'b-open'}"
                          style="margin-left:6px">${p.estado}</span>
                  </div>
                </div>
                <div class="rinputs">
                  <img src="${XSS.s(p.banderaLocal)}"
                       style="width:22px;height:15px;border-radius:2px;object-fit:cover"
                       loading="lazy" onerror="this.style.display='none'" />
                  <input type="number" min="0" max="20" class="ri" id="rl-${p.id}" placeholder="0" />
                  <span style="color:var(--tmut)">–</span>
                  <input type="number" min="0" max="20" class="ri" id="rv-${p.id}" placeholder="0" />
                  <img src="${XSS.s(p.banderaVisitante)}"
                       style="width:22px;height:15px;border-radius:2px;object-fit:cover"
                       loading="lazy" onerror="this.style.display='none'" />
                </div>
                <button class="btnok" data-pid="${p.id}"
                        onclick="Views.Admin.confirmarResultado(this)">
                  ✓ Confirmar
                </button>
              </div>`;
          }).join('')}
        </div>`;
    },

    async confirmarResultado(btn) {
      const pid = parseInt(btn.dataset.pid);
      const l   = document.getElementById(`rl-${pid}`)?.value;
      const v   = document.getElementById(`rv-${pid}`)?.value;

      if (l === '' || l === undefined || v === '' || v === undefined)
        return Toast.err('Ingresá ambos valores');
      if (parseInt(l) < 0 || parseInt(l) > 20 || parseInt(v) < 0 || parseInt(v) > 20)
        return Toast.err('Los goles deben ser entre 0 y 20');

      // Deshabilitar para evitar doble submit
      btn.disabled    = true;
      btn.textContent = '⏳';

      const r = await ApiAdmin.cargarResultado(pid, parseInt(l), parseInt(v));

      btn.disabled    = false;
      btn.textContent = '✓ Confirmar';

      if (!r?.ok) return Toast.err(r?.data?.error || 'Error al cargar resultado');

      Toast.ok('✅ Resultado cargado · Puntos calculados automáticamente');
      Views.Admin.loadResultados();

      // Refrescar datos en paralelo en background
      Promise.all([ApiPartidos.getAll(), ApiRanking.get()]).then(([rp, rr]) => {
        if (rp?.ok) State.partidos = rp.data || [];
        if (rr?.ok) State.ranking  = rr.data || [];
      });
    },
  },
};