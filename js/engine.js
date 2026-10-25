/* =========================================================
   ONE BULLET / FlexShot — engine.js
   Чистая игровая физика: пуля, рикошеты, стены, враги,
   переключатели, двери, телепорты, энергия управления.

   Модуль ничего не знает про DOM, поэтому тот же код
   используется игрой и генератором уровней (проверка
   проходимости идёт той же физикой — без расхождений).
   ========================================================= */
(function (global) {
  'use strict';

  // ---------- Логическое пространство арены ----------
  const W = 1280;
  const H = 720;
  const BORDER = 24;          // толщина рамки-стены вокруг арены
  const BULLET_R = 5;
  const ENEMY_R = 18;         // базовый радиус врага
  const SWITCH_R = 14;
  const PORTAL_R = 24;
  const BASE_SPEED = 560;     // px/сек в логических координатах

  // ---------- Настройки баланса ----------
  const CFG = {
    speedMin: 240,
    speedMax: 900,
    thrustAccel: 700,             // ускорение W / замедление S
    turnRate: 95 * Math.PI / 180, // рад/сек при A/D
    energyMaxDefault: 100,
    turnCost: 15,                 // энергии в секунду за поворот
    thrustCost: 12,               // энергии в секунду за скорость
    steerSlowMo: 0.35,            // замедление времени при управлении
    portalCooldown: 0.18,
    defaultMaxBounces: 7,
    defaultMaxTime: 16,
    defaultMaxDistance: 5200
  };

  // =========================================================
  // Реестр типов стен — точка расширения контента.
  // Новый тип поверхности = одна запись здесь, физику менять не нужно.
  // =========================================================
  const WALL_TYPES = {
    mirror: { reflect: true, rest: 1, label: 'mirror' },
    bouncy: { reflect: true, rest: 1.14, label: 'bouncy' },  // ускоряет пулю
    soft:   { reflect: true, rest: 0.72, label: 'soft' },    // гасит скорость
    block:  { reflect: false, absorb: true, label: 'block' },// поглощает пулю
    glass:  { reflect: false, breakable: true, label: 'glass' },
    door:   { reflect: true, rest: 1, door: true, label: 'door' }
  };

  function registerWallType(name, def) {
    WALL_TYPES[name] = Object.assign({ reflect: false }, def);
  }

  // =========================================================
  // Реестр схем движения врагов — тоже точка расширения.
  // move = { type:'patrol', ax:'x'|'y', amp, freq, phase }
  // move = { type:'orbit', cx, cy, r, omega, phase }
  // =========================================================
  const ENEMY_MOVES = {
    static: function (enemy, t, out) { out.x = enemy.x; out.y = enemy.y; return out; },
    patrol: function (enemy, t, out) {
      const m = enemy.move;
      const shift = Math.sin(t * m.freq + (m.phase || 0)) * m.amp;
      out.x = enemy.x + (m.ax === 'x' ? shift : 0);
      out.y = enemy.y + (m.ax === 'y' ? shift : 0);
      return out;
    },
    orbit: function (enemy, t, out) {
      const m = enemy.move;
      const a = t * m.omega + (m.phase || 0);
      out.x = m.cx + Math.cos(a) * m.r;
      out.y = m.cy + Math.sin(a) * m.r;
      return out;
    }
  };

  function registerEnemyMove(name, fn) { ENEMY_MOVES[name] = fn; }

  // =========================================================
  // Геометрия
  // =========================================================
  function pointToRect(px, py, r) {
    const cx = px < r.x ? r.x : (px > r.x + r.w ? r.x + r.w : px);
    const cy = py < r.y ? r.y : (py > r.y + r.h ? r.y + r.h : py);
    return Math.hypot(px - cx, py - cy);
  }

  // Текущий прямоугольник стены (у движущихся меняется со временем)
  function wallRect(wall, t) {
    if (wall.type !== 'mover') return wall;
    const shift = Math.sin(t * wall.speed + (wall.phase || 0)) * wall.amp;
    let x = wall.x, y = wall.y;
    if (wall.axis === 'x') x += shift; else y += shift;
    return { x: x, y: y, w: wall.w, h: wall.h, wall: wall };
  }

  // Прямоугольник, который движущаяся стена занимает за всё время
  function sweptRect(wall) {
    if (wall.type !== 'mover') return { x: wall.x, y: wall.y, w: wall.w, h: wall.h };
    const a = Math.abs(wall.amp);
    return wall.axis === 'x'
      ? { x: wall.x - a, y: wall.y, w: wall.w + a * 2, h: wall.h }
      : { x: wall.x, y: wall.y - a, w: wall.w, h: wall.h + a * 2 };
  }

  function enemyMoveRadius(enemy) {
    const m = enemy.move || { type: 'static' };
    if (m.type === 'patrol') return Math.abs(m.amp);
    if (m.type === 'orbit') return m.r + 1;
    return 0;
  }

  const tmpEnemyPos = { x: 0, y: 0 };
  function enemyPos(enemy, t, out) {
    const fn = ENEMY_MOVES[(enemy.move && enemy.move.type) || 'static'] || ENEMY_MOVES.static;
    return fn(enemy, t, out || tmpEnemyPos);
  }

  function rectsOverlap(a, b, gap) {
    const g = gap || 0;
    return a.x < b.x + b.w + g && a.x + a.w + g > b.x &&
           a.y < b.y + b.h + g && a.y + a.h + g > b.y;
  }

  // =========================================================
  // Создание состояния уровня
  // =========================================================
  function createState(level) {
    return {
      level: level,
      t: 0,
      ghost: false,
      bullet: {
        active: false, flying: false,
        x: level.player.x, y: level.player.y,
        angle: level.aim || 0, speed: BASE_SPEED,
        trail: [], bounces: 0, distance: 0, portalCooldown: 0
      },
      energy: level.energyMax != null ? level.energyMax : CFG.energyMaxDefault,
      enemies: level.enemies.map(function (e) {
        return { def: e, alive: true, hitT: 0, x: e.x, y: e.y };
      }),
      switches: level.switches.map(function (s) { return { def: s, on: false, flash: 0 }; }),
      doors: level.doors.map(function (d) { return { def: d, open: false }; }),
      brokenWalls: [],
      events: [],
      status: 'aiming',       // aiming | flying | win | failed
      failReason: '',
      timeScale: 1,
      shots: 0
    };
  }

  function doorOpen(st, channel) {
    if (!channel) return false;
    const list = st.switches.filter(function (s) { return s.def.channel === channel; });
    return list.length > 0 && list.every(function (s) { return s.on; });
  }

  function refreshDoors(st) {
    for (let i = 0; i < st.doors.length; i++) {
      st.doors[i].open = doorOpen(st, st.doors[i].def.channel);
    }
  }

  function emit(st, type, data) {
    data = data || {};
    data.type = type;
    data.t = st.t;
    st.events.push(data);
    if (st.events.length > 400) st.events.shift();
  }

  // =========================================================
  // Выстрел
  // =========================================================
  function fire(st, angle) {
    if (st.status !== 'aiming') return false;
    const b = st.bullet;
    const p = st.level.player;
    b.active = true;
    b.flying = true;
    b.angle = angle;
    b.speed = BASE_SPEED;
    b.x = p.x + Math.cos(angle) * (p.r + 10);
    b.y = p.y + Math.sin(angle) * (p.r + 10);
    b.trail.length = 0;
    b.trail.push({ x: b.x, y: b.y });
    b.bounces = 0;
    b.distance = 0;
    st.t = 0;
    st.status = 'flying';
    st.shots++;
    emit(st, 'fire', { x: b.x, y: b.y, angle: angle });
    return true;
  }

  // =========================================================
  // Один фиксированный шаг симуляции (1/120 сек)
  // =========================================================
  function step(st, dt, input) {
    if (st.status !== 'flying') return;
    input = input || {};
    const b = st.bullet;
    const lvl = st.level;
    const maxB = lvl.maxBounces != null ? lvl.maxBounces : CFG.defaultMaxBounces;
    const maxT = lvl.maxTime != null ? lvl.maxTime : CFG.defaultMaxTime;
    const maxD = lvl.maxDistance != null ? lvl.maxDistance : CFG.defaultMaxDistance;

    st.t += dt;
    st.timeScale = 1;
    b.portalCooldown = Math.max(0, b.portalCooldown - dt);

    // ----- ограниченное управление полётом (тратит энергию) -----
    let steering = false;
    if ((input.turn || 0) !== 0 && st.energy > 0) {
      b.angle += input.turn * CFG.turnRate * dt;
      st.energy = Math.max(0, st.energy - CFG.turnCost * dt);
      steering = true;
    }
    if ((input.thrust || 0) !== 0 && st.energy > 0) {
      b.speed += input.thrust * CFG.thrustAccel * dt;
      b.speed = Math.min(CFG.speedMax, Math.max(CFG.speedMin, b.speed));
      st.energy = Math.max(0, st.energy - CFG.thrustCost * dt);
      steering = true;
    }
    if (steering) st.timeScale = CFG.steerSlowMo;

    applyWells(st, dt);

    // ----- движение -----
    const dist = b.speed * dt;
    b.x += Math.cos(b.angle) * dist;
    b.y += Math.sin(b.angle) * dist;
    b.distance += dist;

    // ----- след -----
    const lastTrail = b.trail[b.trail.length - 1];
    if (!lastTrail || Math.hypot(b.x - lastTrail.x, b.y - lastTrail.y) > 7) {
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 80) b.trail.shift();
    }

    resolveWalls(st, b);
    if (st.status !== 'flying') return;

    resolvePortals(st, b);
    if (st.status !== 'flying') return;

    resolveSwitches(st, b);
    resolveEnemies(st, b);
    if (st.status !== 'flying') return;

    // ----- проигрыш по лимитам -----
    if (b.bounces > maxB) return fail(st, 'ricochets');
    if (st.t > maxT) return fail(st, 'time');
    if (b.distance > maxD) return fail(st, 'distance');
    if (b.x < -100 || b.x > W + 100 || b.y < -100 || b.y > H + 100) return fail(st, 'escaped');
  }

  function fail(st, reason) {
    if (st.status !== 'flying') return;
    st.status = 'failed';
    st.failReason = reason;
    st.bullet.flying = false;
    emit(st, 'fail', { reason: reason, x: st.bullet.x, y: st.bullet.y });
  }

  // =========================================================
  // Гравитационные колодцы (появляются на поздних уровнях).
  // Детерминированно закручивают пулю, пока она внутри радиуса.
  // =========================================================
  function applyWells(st, dt) {
    const wells = st.level.wells;
    if (!wells || !wells.length) return;
    const b = st.bullet;
    for (let i = 0; i < wells.length; i++) {
      const w = wells[i];
      const dx = b.x - w.x, dy = b.y - w.y;
      const d = Math.hypot(dx, dy);
      if (d > w.r || d < 1) continue;
      const falloff = 1 - d / w.r;
      b.angle += (w.dir || 1) * (w.bend || 1.4) * falloff * dt;
    }
  }

  // =========================================================
  // Столкновения со стенами
  // =========================================================
  function resolveWalls(st, b) {
    const walls = st.level.walls;
    for (let i = 0; i < walls.length; i++) {
      const wall = walls[i];
      if (wall.type === 'door' && doorOpen(st, wall.channel)) continue;
      if (st.brokenWalls.indexOf(wall.id) !== -1) continue;

      const rect = wallRect(wall, st.t);
      const d = pointToRect(b.x, b.y, rect);
      if (d >= BULLET_R) continue;

      // ----- нормаль столкновения -----
      let nx = 0, ny = 0;
      if (d > 0.0001) {
        const cx = Math.min(Math.max(b.x, rect.x), rect.x + rect.w);
        const cy = Math.min(Math.max(b.y, rect.y), rect.y + rect.h);
        nx = (b.x - cx) / d;
        ny = (b.y - cy) / d;
      } else {
        // центр пули внутри стены — выталкиваем по ближайшей грани
        const left = b.x - rect.x, right = rect.x + rect.w - b.x;
        const top = b.y - rect.y, bottom = rect.y + rect.h - b.y;
        const m = Math.min(left, right, top, bottom);
        nx = m === left ? -1 : m === right ? 1 : 0;
        ny = m === top ? -1 : m === bottom ? 1 : 0;
        if (nx === 0 && ny === 0) ny = -1;
      }

      const type = WALL_TYPES[wall.type] || WALL_TYPES.mirror;

      // Разрушаемое стекло: ломается, пуля продолжает полёт
      if (type.breakable) {
        st.brokenWalls.push(wall.id);
        b.speed = Math.max(CFG.speedMin, b.speed * 0.94);
        emit(st, 'break', { x: b.x, y: b.y, nx: nx, ny: ny, wall: wall });
        continue;
      }

      // Блок: пуля погибает
      if (type.absorb) {
        b.x += nx * (BULLET_R - d + 0.5);
        b.y += ny * (BULLET_R - d + 0.5);
        emit(st, 'absorb', { x: b.x, y: b.y });
        fail(st, 'blocked');
        return;
      }

      // ----- отражение -----
      let vx = Math.cos(b.angle) * b.speed;
      let vy = Math.sin(b.angle) * b.speed;

      if (wall.type === 'mover') {
        // учитываем скорость движущейся стены, но ограниченно (честная физика)
        const wv = Math.cos(st.t * wall.speed + (wall.phase || 0)) * wall.amp * wall.speed;
        const wx = wall.axis === 'x' ? wv : 0;
        const wy = wall.axis === 'y' ? wv : 0;
        const rel = (vx - wx) * nx + (vy - wy) * ny;
        if (rel < 0) {
          vx -= 2 * rel * nx * 0.75;
          vy -= 2 * rel * ny * 0.75;
          vx += wx * 0.2;
          vy += wy * 0.2;
          b.angle = Math.atan2(vy, vx);
          b.speed = Math.min(CFG.speedMax, Math.hypot(vx, vy));
        }
      } else {
        const dot = vx * nx + vy * ny;
        if (dot < 0) {
          vx -= 2 * dot * nx;
          vy -= 2 * dot * ny;
          b.angle = Math.atan2(vy, vx);
          const rest = type.rest != null ? type.rest : 1;
          b.speed = Math.min(CFG.speedMax, Math.max(CFG.speedMin, Math.hypot(vx, vy) * rest));
        }
      }

      // выталкивание из стены (пуля никогда не застревает внутри)
      b.x += nx * (BULLET_R - d + 0.75);
      b.y += ny * (BULLET_R - d + 0.75);

      b.bounces++;
      emit(st, 'bounce', {
        x: b.x, y: b.y, nx: nx, ny: ny, wall: wall,
        bounces: b.bounces, kind: wall.type
      });

      if (b.bounces > (st.level.maxBounces != null ? st.level.maxBounces : CFG.defaultMaxBounces)) {
        fail(st, 'ricochets');
        return;
      }
    }
  }

  // =========================================================
  // Телепорты (направление полёта сохраняется)
  // =========================================================
  function resolvePortals(st, b) {
    const portals = st.level.portals || [];
    for (let i = 0; i < portals.length; i++) {
      const p = portals[i];
      if (b.portalCooldown > 0) break;
      if (Math.hypot(b.x - p.x, b.y - p.y) > PORTAL_R) continue;

      let target = null;
      for (let j = 0; j < portals.length; j++) {
        if (portals[j].pair === p.pair && portals[j].id !== p.id) { target = portals[j]; break; }
      }
      if (!target) continue;

      b.x = target.x + Math.cos(b.angle) * (PORTAL_R + BULLET_R + 4);
      b.y = target.y + Math.sin(b.angle) * (PORTAL_R + BULLET_R + 4);
      b.portalCooldown = CFG.portalCooldown;
      b.trail.length = 0;
      b.trail.push({ x: b.x, y: b.y });
      emit(st, 'portal', { x: p.x, y: p.y, toX: b.x, toY: b.y });
      return;
    }
  }

  // =========================================================
  // Переключатели и двери
  // =========================================================
  function resolveSwitches(st, b) {
    for (let i = 0; i < st.switches.length; i++) {
      const s = st.switches[i];
      if (s.on) continue;
      if (Math.hypot(b.x - s.def.x, b.y - s.def.y) > SWITCH_R + BULLET_R) continue;
      s.on = true;
      s.flash = 1;
      emit(st, 'switch', { x: s.def.x, y: s.def.y, channel: s.def.channel });
      refreshDoors(st);
      for (let d = 0; d < st.doors.length; d++) {
        if (st.doors[d].open && !st.doors[d].wasOpen) {
          st.doors[d].wasOpen = true;
          emit(st, 'doorOpen', { x: st.doors[d].def.x, y: st.doors[d].def.y });
        }
      }
    }
  }

  // =========================================================
  // Враги — пуля пробивает врага насквозь
  // =========================================================
  const tmpPos = { x: 0, y: 0 };
  function resolveEnemies(st, b) {
    if (st.ghost) return;
    for (let i = 0; i < st.enemies.length; i++) {
      const e = st.enemies[i];
      if (!e.alive) continue;
      enemyPos(e.def, st.t, tmpPos);
      e.x = tmpPos.x; e.y = tmpPos.y;
      const r = (e.def.r || ENEMY_R) + BULLET_R;
      if (Math.hypot(b.x - e.x, b.y - e.y) > r) continue;

      e.alive = false;
      e.hitT = st.t;
      b.speed = Math.max(CFG.speedMin, b.speed * 0.96);
      emit(st, 'kill', { x: e.x, y: e.y, r: e.def.r || ENEMY_R });

      if (st.enemies.every(function (en) { return !en.alive; })) {
        st.status = 'win';
        b.flying = false;
        emit(st, 'win', { x: b.x, y: b.y });
        return;
      }
    }
  }

  // Флаги анимации (не влияют на физику)
  function updateFx(st, dt) {
    for (let i = 0; i < st.switches.length; i++) {
      st.switches[i].flash = Math.max(0, st.switches[i].flash - dt * 2);
    }
  }

  // =========================================================
  // Трассировка траектории: предпросмотр прицела и проверка
  // проходимости уровня генератором.
  // ghost = true — врагов не убиваем (для построения пути).
  // =========================================================
  function trace(level, angle, opts) {
    opts = opts || {};
    const st = createState(level);
    st.ghost = !!opts.ghost;
    fire(st, angle);

    const maxSteps = Math.round((opts.maxTime || 26) * 120);
    const maxB = opts.maxBounces != null ? opts.maxBounces : 1e9;
    const points = [{ x: st.bullet.x, y: st.bullet.y, t: 0, bounces: 0 }];
    const bounces = [];
    let steps = 0;

    while (st.status === 'flying' && steps < maxSteps && st.bullet.bounces <= maxB) {
      const before = st.bullet.bounces;
      step(st, 1 / 120, null);
      steps++;
      if (st.bullet.bounces > before) {
        const ev = st.events[st.events.length - 1];
        if (ev && ev.type === 'bounce') bounces.push(ev);
      }
      if (steps % 3 === 0 || st.status !== 'flying') {
        points.push({ x: st.bullet.x, y: st.bullet.y, t: st.t, bounces: st.bullet.bounces });
      }
    }

    return {
      state: st,
      points: points,
      bounces: bounces,
      endX: st.bullet.x,
      endY: st.bullet.y,
      endT: st.t,
      status: st.status,
      failReason: st.failReason
    };
  }

  // Краткий отчёт о выстреле (генератор и автотесты)
  function simulate(level, angle, opts) {
    const res = trace(level, angle, opts);
    return {
      win: res.state.status === 'win',
      status: res.status,
      failReason: res.failReason,
      kills: res.state.enemies.filter(function (e) { return !e.alive; }).length,
      enemies: res.state.enemies.length,
      switches: res.state.switches.filter(function (s) { return s.on; }).length,
      bounces: res.state.bullet.bounces,
      energy: res.state.energy,
      time: res.endT
    };
  }

  const OB = {
    W: W, H: H, BORDER: BORDER, BULLET_R: BULLET_R, ENEMY_R: ENEMY_R,
    SWITCH_R: SWITCH_R, PORTAL_R: PORTAL_R, BASE_SPEED: BASE_SPEED, CFG: CFG,
    WALL_TYPES: WALL_TYPES, ENEMY_MOVES: ENEMY_MOVES,
    registerWallType: registerWallType, registerEnemyMove: registerEnemyMove,
    createState: createState, fire: fire, step: step, updateFx: updateFx, applyWells: applyWells,
    trace: trace, simulate: simulate, fail: fail,
    wallRect: wallRect, sweptRect: sweptRect, enemyPos: enemyPos,
    enemyMoveRadius: enemyMoveRadius, pointToRect: pointToRect,
    rectsOverlap: rectsOverlap, doorOpen: doorOpen, refreshDoors: refreshDoors
  };

  global.OB = OB;
  if (typeof module !== 'undefined' && module.exports) module.exports = OB;
})(typeof window !== 'undefined' ? window : globalThis);
