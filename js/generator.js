/* =========================================================
   ONE BULLET / FlexShot — generator.js
   Процедурная генерация бесконечных уровней.

   Принцип: уровень строится «вокруг решения». Сначала арена,
   затем находится реальная траектория пули (та же физика, что
   в игре), и враги/переключатели/двери/стекло/телепорты
   размещаются НА этой траектории. После сборки уровень
   проверяется симуляцией с допуском на точность прицела.
   Если проверка не прошла — генерируется другой вариант.
   ========================================================= */
(function (global) {
  'use strict';
  const DEBUG = !!(global.GEN_DEBUG ||
    (typeof process !== 'undefined' && process.env && process.env.GEN_DEBUG));
  const log = DEBUG ? function () { console.log.apply(console, ['[gen]'].concat([].slice.call(arguments))); } : function () {};
  const OB = global.OB || (typeof require === 'function' ? require('./engine.js') : null);

  const W = OB.W, H = OB.H, B = OB.BORDER;

  // =========================================================
  // Детерминированный ГПСЧ (mulberry32) + хеш строки в seed
  // =========================================================
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // =========================================================
  // Сложность по номеру уровня (0 = первый уровень)
  // =========================================================
  function difficulty(index) {
    const i = index;
    const bounceTarget = i < 4 ? 0
      : i < 8 ? 1
      : i < 16 ? 2
      : i < 31 ? 3
      : i < 51 ? 4
      : i < 101 ? 5
      : Math.min(7, 5 + Math.floor((i - 100) / 60));

    const energyMax = i < 15 ? 999
      : i < 31 ? 100
      : Math.max(26, 100 - Math.floor((i - 31) * 0.7));

    const maxEnemies = i < 3 ? 1
      : i < 6 ? 2
      : i < 11 ? 2
      : i < 16 ? 3
      : i < 31 ? 3
      : i < 51 ? 4
      : i < 101 ? 5
      : 6;

    return {
      index: i,
      tier: i < 6 ? 1 : i < 16 ? 2 : i < 31 ? 3 : i < 51 ? 4 : i < 101 ? 5 : 6,
      bounceTarget: bounceTarget,
      energyMax: energyMax,
      maxEnemies: maxEnemies,
      maxBounces: bounceTarget + (i < 10 ? 5 : i < 31 ? 4 : 3),
      maxTime: 12 + Math.min(6, bounceTarget * 0.7),
      maxDistance: 3200 + bounceTarget * 900,
      moverCount: i < 6 ? 0 : (i < 31 ? 1 : 2),
      decoys: i < 2 ? 0 : i < 6 ? 1 : (i < 16 ? 2 : (i < 51 ? 3 : 4)),
      useBouncy: i >= 12,
      useSoft: i >= 10,
      blocks: i >= 4,
      useGlass: i >= 31,
      usePortals: i >= 31,
      useWells: i >= 50,
      useDoors: i >= 8,
      orbitEnemies: i >= 20,
      enemyRadius: i < 21 ? 18 : i < 61 ? 16 : 15,
      aimTolerance: i < 6 ? 0.9 : i < 16 ? 0.7 : i < 31 ? 0.52 : i < 51 ? 0.44 : 0.36,
      previewBounces: i < 6 ? 3 : i < 16 ? 2 : i < 31 ? 1 : 0
    };
  }

  const ARENA = { x: B + 10, y: B + 10, w: W - (B + 10) * 2, h: H - (B + 10) * 2 };

  function borders() {
    return [
      { id: 'bT', x: 0, y: 0, w: W, h: B, type: 'mirror' },
      { id: 'bB', x: 0, y: H - B, w: W, h: B, type: 'mirror' },
      { id: 'bL', x: 0, y: 0, w: B, h: H, type: 'mirror' },
      { id: 'bR', x: W - B, y: 0, w: B, h: H, type: 'mirror' }
    ];
  }

  function rnd(rng, a, b) { return a + rng() * (b - a); }
  function rndInt(rng, a, b) { return Math.floor(rnd(rng, a, b + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  // Минимальное расстояние от точки до всех стен (с учётом хода движущихся)
  function clearance(px, py, walls, skipId) {
    let min = Infinity;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (skipId && w.id === skipId) continue;
      const d = OB.pointToRect(px, py, OB.sweptRect(w));
      if (d < min) min = d;
    }
    return min;
  }

  function insideArena(r, pad) {
    const p = pad || 0;
    return r.x >= ARENA.x + p && r.y >= ARENA.y + p &&
           r.x + r.w <= ARENA.x + ARENA.w - p &&
           r.y + r.h <= ARENA.y + ARENA.h - p;
  }

  // =========================================================
  // Шаблоны арен: заранее разработанные конструкции.
  // Все стены — прямоугольники (AABB), физика честная.
  // =========================================================
  const TEMPLATES = {
    pillars: function (rng) {
      const out = [];
      const cols = rndInt(rng, 2, 4), rows = rndInt(rng, 2, 3);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (rng() < 0.18) continue;
          const x = ARENA.x + 170 + i * ((ARENA.w - 300) / Math.max(1, cols - 1));
          const y = ARENA.y + 120 + j * ((ARENA.h - 240) / Math.max(1, rows - 1));
          out.push({ x: x - 22, y: y - 55, w: 44, h: 110, type: 'mirror' });
        }
      }
      return out;
    },

    rooms: function (rng) {
      const out = [];
      const vx = ARENA.x + ARENA.w * rnd(rng, 0.42, 0.58);
      out.push({ x: vx, y: ARENA.y + 40, w: 16, h: ARENA.h * 0.34, type: 'mirror' });
      out.push({ x: vx, y: ARENA.y + ARENA.h * 0.66, w: 16, h: ARENA.h * 0.34, type: 'mirror' });
      const hy = ARENA.y + ARENA.h * rnd(rng, 0.42, 0.58);
      out.push({ x: ARENA.x + 30, y: hy, w: ARENA.w * 0.28, h: 16, type: 'mirror' });
      out.push({ x: ARENA.x + ARENA.w * 0.72 - 30, y: hy, w: ARENA.w * 0.28, h: 16, type: 'mirror' });
      return out;
    },

    // «Ромб» из отдельных блоков по диагоналям
    diamond: function (rng) {
      const out = [];
      const cx = ARENA.x + ARENA.w / 2, cy = ARENA.y + ARENA.h / 2;
      const s = rnd(rng, 150, 230);
      const count = 7, block = 26;
      for (let k = 0; k < count; k++) {
        const f = k / (count - 1);
        const dx = (f - 0.5) * 2 * s;
        const dy = (1 - Math.abs(f - 0.5) * 2) * s;
        if (k % 3 === 1) continue; // разрывы
        out.push({ x: cx + dx - block / 2, y: cy - dy - block / 2, w: block, h: block, type: 'mirror' });
        out.push({ x: cx + dx - block / 2, y: cy + dy - block / 2, w: block, h: block, type: 'mirror' });
      }
      return out;
    },

    zigzag: function (rng) {
      const out = [];
      const n = rndInt(rng, 3, 5);
      for (let i = 0; i < n; i++) {
        const up = i % 2 === 0;
        const x = ARENA.x + 120 + i * ((ARENA.w - 240) / n);
        const h = rnd(rng, 120, 230);
        out.push({ x: x, y: up ? ARENA.y : ARENA.y + ARENA.h - h, w: 24, h: h, type: 'mirror' });
      }
      return out;
    },

    corners: function (rng) {
      const out = [];
      const s = rnd(rng, 110, 190);
      out.push({ x: ARENA.x + 40, y: ARENA.y + 40, w: s, h: 22, type: 'mirror' });
      out.push({ x: ARENA.x + 40, y: ARENA.y + 40, w: 22, h: s, type: 'mirror' });
      out.push({ x: ARENA.x + ARENA.w - 40 - s, y: ARENA.y + ARENA.h - 62, w: s, h: 22, type: 'mirror' });
      out.push({ x: ARENA.x + ARENA.w - 62, y: ARENA.y + ARENA.h - 40 - s, w: 22, h: s, type: 'mirror' });
      return out;
    },

    stairs: function (rng) {
      const out = [];
      const n = rndInt(rng, 3, 5);
      for (let i = 0; i < n; i++) {
        out.push({
          x: ARENA.x + 100 + i * 60,
          y: ARENA.y + 90 + i * (ARENA.h - 220) / n,
          w: 160, h: 22, type: 'mirror'
        });
      }
      return out;
    },

    // «Кольцо» из блоков с разрывами
    ring: function () {
      const out = [];
      const cx = ARENA.x + ARENA.w / 2, cy = ARENA.y + ARENA.h / 2;
      const r = 175, seg = 14, block = 24;
      for (let k = 0; k < seg; k++) {
        if (k % 4 === 2) continue;
        const a = (k / seg) * Math.PI * 2;
        out.push({
          x: cx + Math.cos(a) * r - block / 2,
          y: cy + Math.sin(a) * r - block / 2,
          w: block, h: block, type: 'mirror'
        });
      }
      return out;
    }
  };

  const TEMPLATE_NAMES = Object.keys(TEMPLATES);

  // =========================================================
  // Разбор траектории на прямые отрезки (телепорт = разрыв)
  // =========================================================
  function buildPath(tr) {
    const pts = tr.points;
    const segs = [];
    if (!pts || pts.length < 2) return { segs: segs, total: 0 };

    function closeSegment(a, b) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len > 6) {
        segs.push({
          x0: a.x, y0: a.y, x1: b.x, y1: b.y,
          len: len, t0: a.t, t1: b.t,
          dirx: dx / len, diry: dy / len,
          bounces: a.bounces
        });
      }
    }

    let startPt = pts[0];
    for (let i = 1; i < pts.length - 1; i++) {
      const d1x = pts[i].x - pts[i - 1].x, d1y = pts[i].y - pts[i - 1].y;
      const d2x = pts[i + 1].x - pts[i].x, d2y = pts[i + 1].y - pts[i].y;
      const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
      const jump = l2 > 60 || l1 > 60;
      // изменение направления = отскок или телепорт
      const cos = (l1 > 0.001 && l2 > 0.001) ? (d1x * d2x + d1y * d2y) / (l1 * l2) : 1;
      if (jump || cos < 0.985) {
        closeSegment(startPt, pts[i]);
        startPt = pts[i];
      }
    }
    closeSegment(startPt, pts[pts.length - 1]);

    let total = 0;
    for (let i = 0; i < segs.length; i++) {
      segs[i].arc0 = total;
      total += segs[i].len;
      segs[i].arc1 = total;
    }
    return { segs: segs, total: total };
  }

  // Точка на траектории по пройденному пути
  function pointAtArc(path, arc) {
    const segs = path.segs;
    if (!segs.length) return null;
    const a = Math.max(0, Math.min(path.total - 0.01, arc));
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (a >= s.arc1 && i < segs.length - 1) continue;
      const f = Math.min(1, Math.max(0, (a - s.arc0) / Math.max(0.001, s.len)));
      return {
        x: s.x0 + (s.x1 - s.x0) * f,
        y: s.y0 + (s.y1 - s.y0) * f,
        t: s.t0 + (s.t1 - s.t0) * f,
        bounces: s.bounces,
        dirx: s.dirx, diry: s.diry,
        seg: s, arc: a
      };
    }
    return null;
  }

  // =========================================================
  // Поиск решения: угол выстрела, дающий нужное число отскоков
  // =========================================================
  function findSolution(draft, rng, targetBounces) {
    const dbg = { status: 0, bounces: 0, corner: 0, segs: 0, first: 0, last: 0, total: 0 };
    for (let attempt = 0; attempt < 700; attempt++) {
      const angle = rnd(rng, -Math.PI, Math.PI);
      const tr = OB.trace(draft, angle, {
        ghost: true, maxBounces: targetBounces + 1, maxTime: 22
      });
      if (tr.status !== 'flying') { dbg.status++; continue; }
      if (tr.bounces.length < targetBounces + 1) { dbg.bounces++; continue; }

      // Отскоки только от «плоских» граней — предсказуемая физика
      let corner = false;
      for (let i = 0; i < tr.bounces.length; i++) {
        const ev = tr.bounces[i];
        if (Math.abs(ev.nx) < 0.92 && Math.abs(ev.ny) < 0.92) { corner = true; break; }
        if (ev.wall && ev.wall.type !== 'mirror' && ev.wall.type !== 'mover') { corner = true; break; }
      }
      if (corner) { dbg.corner++; continue; }

      const path = buildPath(tr);
      if (path.segs.length < targetBounces + 2) { dbg.segs++; continue; }
      if (path.segs[0].len < 130) { dbg.first++; continue; }
      if (path.segs[path.segs.length - 1].len < 130) { dbg.last++; continue; }
      if (path.total < 600) { dbg.total++; continue; }

      return { angle: angle, trace: tr, path: path };
    }
    log('findSolution fail', JSON.stringify(dbg), 'target', targetBounces);
    return null;
  }

  // =========================================================
  // Свободная стартовая точка игрока
  // =========================================================
  function pickPlayer(walls, rng) {
    for (let i = 0; i < 200; i++) {
      const x = rnd(rng, ARENA.x + 80, ARENA.x + ARENA.w - 80);
      const y = rnd(rng, ARENA.y + 80, ARENA.y + ARENA.h - 80);
      if (clearance(x, y, walls) > 78) return { x: x, y: y, r: 17 };
    }
    return null;
  }

  // =========================================================
  // Движущиеся стены
  // =========================================================
  function addMovers(walls, rng, count) {
    let added = 0;
    for (let attempt = 0; attempt < 80 && added < count; attempt++) {
      const axis = rng() < 0.5 ? 'x' : 'y';
      const long = rnd(rng, 100, 190), thick = 20;
      const w = axis === 'x' ? thick : long;
      const h = axis === 'x' ? long : thick;
      const amp = rnd(rng, 55, 115);
      const x = rnd(rng, ARENA.x + amp + 70, ARENA.x + ARENA.w - amp - 70 - w);
      const y = rnd(rng, ARENA.y + amp + 70, ARENA.y + ARENA.h - amp - 70 - h);
      const rect = { x: x, y: y, w: w, h: h };
      if (!insideArena(rect, 12)) continue;
      const swept = axis === 'x'
        ? { x: rect.x - amp, y: rect.y, w: rect.w + amp * 2, h: rect.h }
        : { x: rect.x, y: rect.y - amp, w: rect.w, h: rect.h + amp * 2 };
      let bad = false;
      for (let i = 0; i < walls.length; i++) {
        if (OB.rectsOverlap(swept, OB.sweptRect(walls[i]), 34)) { bad = true; break; }
      }
      if (bad) continue;

      walls.push({
        id: 'm' + added, x: rect.x, y: rect.y, w: w, h: h, type: 'mover',
        axis: axis, amp: amp, speed: rnd(rng, 1.0, 1.9), phase: rnd(rng, 0, Math.PI * 2)
      });
      added++;
    }
    return added;
  }

  // Превращение части стен в особые поверхности
  function applySurfaces(walls, rng, diff) {
    const candidates = walls.filter(function (w) {
      return w.type === 'mirror' && w.id.indexOf('b') !== 0 && Math.max(w.w, w.h) > 80;
    });
    let bouncyLeft = diff.useBouncy ? rndInt(rng, 1, 2) : 0;
    let softLeft = diff.useSoft ? 1 : 0;
    for (let i = 0; i < candidates.length; i++) {
      const r = rng();
      if (bouncyLeft > 0 && r < 0.3) { candidates[i].type = 'bouncy'; bouncyLeft--; }
      else if (softLeft > 0 && r < 0.5) { candidates[i].type = 'soft'; softLeft--; }
    }
  }

  // =========================================================
  // Вставка разрушаемого стекла прямо на путь пули
  // =========================================================
  function insertGlass(draft, rng, path, walls, glassCount) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const s = rnd(rng, path.total * 0.12, path.total * 0.88);
      const p = pointAtArc(path, s);
      if (!p) continue;
      if (clearance(p.x, p.y, walls) < 46) continue;
      const horizontal = Math.abs(p.dirx) > Math.abs(p.diry);
      const w = horizontal ? 12 : 96, h = horizontal ? 96 : 12;
      const rect = { x: p.x - w / 2, y: p.y - h / 2, w: w, h: h };
      if (!insideArena(rect, 24)) continue;
      let bad = false;
      for (let i = 0; i < walls.length; i++) {
        if (OB.rectsOverlap(rect, OB.sweptRect(walls[i]), 8)) { bad = true; break; }
      }
      if (bad) continue;
      return { id: 'g' + glassCount, x: rect.x, y: rect.y, w: w, h: h, type: 'glass' };
    }
    return null;
  }

  // =========================================================
  // Телепорты: одна пара, вылет сохраняет направление
  // =========================================================
  function tryPortals(draft, rng, path, targetBounces) {
    if (path.total < 900) return false;

    let a = null;
    for (let i = 0; i < 40; i++) {
      const s = rnd(rng, 320, path.total * 0.6);
      const p = pointAtArc(path, s);
      if (!p) continue;
      if (clearance(p.x, p.y, draft.walls) < 72) continue;
      if (Math.hypot(p.x - draft.player.x, p.y - draft.player.y) < 220) continue;
      a = p;
      break;
    }
    if (!a) return false;

    for (let i = 0; i < 60; i++) {
      const x = rnd(rng, ARENA.x + 80, ARENA.x + ARENA.w - 80);
      const y = rnd(rng, ARENA.y + 80, ARENA.y + ARENA.h - 80);
      if (clearance(x, y, draft.walls) < 95) continue;
      if (Math.hypot(x - a.x, y - a.y) < 360) continue;
      if (Math.hypot(x - draft.player.x, y - draft.player.y) < 240) continue;

      // выход не должен стоять на уже пройденной части траектории
      let onPath = false;
      for (let k = 0; k < path.segs.length && !onPath; k++) {
        const seg = path.segs[k];
        if (seg.arc0 > a.arc) break;
        for (let d = 0; d <= seg.len; d += 20) {
          const px = seg.x0 + seg.dirx * d, py = seg.y0 + seg.diry * d;
          if (Math.hypot(px - x, py - y) < 70) { onPath = true; break; }
        }
      }
      if (onPath) continue;

      const pair = 'p0';
      draft.portals = [
        { id: 'pa', pair: pair, x: a.x, y: a.y },
        { id: 'pb', pair: pair, x: x, y: y }
      ];

      const tr2 = OB.trace(draft, draft.aim, {
        ghost: true, maxBounces: targetBounces + 2, maxTime: 24
      });
      const portalEv = tr2.state.events.filter(function (e) { return e.type === 'portal'; });

      if (tr2.status === 'flying' && portalEv.length >= 1 && tr2.endT > portalEv[0].t + 0.45) {
        return { trace: tr2, path: buildPath(tr2) };
      }
      draft.portals = [];
    }
    return false;
  }

  // =========================================================
  // Переключатель + дверь. Дверь перекрывает путь, но
  // переключатель на этом же пути открывает её вовремя.
  // =========================================================
  function tryDoor(draft, rng, path, targetBounces, channelIndex) {
    if (path.total < 800) return false;

    let doorP = null;
    for (let i = 0; i < 50; i++) {
      const s = rnd(rng, path.total * 0.42, path.total * 0.78);
      const p = pointAtArc(path, s);
      if (!p) continue;
      if (p.bounces > targetBounces) continue;
      if (clearance(p.x, p.y, draft.walls) < 78) continue;
      if (Math.hypot(p.x - draft.player.x, p.y - draft.player.y) < 250) continue;
      let nearPortal = false;
      for (let k = 0; k < draft.portals.length; k++) {
        if (Math.hypot(p.x - draft.portals[k].x, p.y - draft.portals[k].y) < 110) nearPortal = true;
      }
      if (nearPortal) continue;
      doorP = p;
      break;
    }
    if (!doorP) return false;

    const horizontal = Math.abs(doorP.dirx) > Math.abs(doorP.diry);
    const w = horizontal ? 16 : 130, h = horizontal ? 130 : 16;
    const doorRect = { x: doorP.x - w / 2, y: doorP.y - h / 2, w: w, h: h };
    if (!insideArena(doorRect, 20)) return false;
    for (let i = 0; i < draft.walls.length; i++) {
      if (OB.rectsOverlap(doorRect, OB.sweptRect(draft.walls[i]), 10)) return false;
    }

    // переключатель должен стоять раньше двери на этом же пути
    let swP = null;
    for (let i = 0; i < 50; i++) {
      const s = rnd(rng, 150, doorP.arc - 150);
      const p = pointAtArc(path, s);
      if (!p) continue;
      if (clearance(p.x, p.y, draft.walls) < 30) continue;
      if (Math.hypot(p.x - draft.player.x, p.y - draft.player.y) < 200) continue;
      if (Math.hypot(p.x - doorP.x, p.y - doorP.y) < 90) continue;
      let nearOther = false;
      for (let k = 0; k < draft.switches.length; k++) {
        if (Math.hypot(p.x - draft.switches[k].x, p.y - draft.switches[k].y) < 90) nearOther = true;
      }
      if (nearOther) continue;
      swP = p;
      break;
    }
    if (!swP) return false;

    const channel = 'd' + channelIndex;
    const door = {
      id: 'door' + channelIndex, x: doorRect.x, y: doorRect.y, w: w, h: h,
      type: 'door', channel: channel
    };
    const sw = { id: 'sw' + channelIndex, x: swP.x, y: swP.y, channel: channel };

    draft.walls.push(door);
    draft.doors.push(door);
    draft.switches.push(sw);

    const tr2 = OB.trace(draft, draft.aim, {
      ghost: true, maxBounces: targetBounces + 2, maxTime: 26
    });
    const doorHits = tr2.state.events.filter(function (e) {
      return e.type === 'bounce' && e.wall && e.wall.id === door.id;
    }).length;
    const switchHits = tr2.state.events.filter(function (e) { return e.type === 'switch'; }).length;

    if (tr2.status !== 'flying' || doorHits > 0 || switchHits < 1 || tr2.endT < doorP.t + 0.35) {
      draft.walls.pop();
      draft.doors.pop();
      draft.switches.pop();
      return false;
    }
    return { trace: tr2, path: buildPath(tr2), doorArc: doorP.arc, door: door };
  }

  // =========================================================
  // Враги: размещаются точно на траектории, поэтому попадание
  // гарантировано решением. Сложность добавляют схемы движения.
  // =========================================================
  function makeEnemy(rng, p, r, diff, idx, draft) {
    const modes = ['static', 'static'];
    if (diff.tier >= 2) modes.push('patrol');
    if (diff.orbitEnemies && idx % 2 === 1) modes.push('orbit');
    let mode = pick(rng, modes);

    if (mode === 'patrol') {
      const amp = rnd(rng, 26, 62), freq = rnd(rng, 1.0, 1.8);
      const axes = rng() < 0.5 ? ['x', 'y'] : ['y', 'x'];
      for (let a = 0; a < axes.length; a++) {
        const axis = axes[a];
        const phase = -p.t * freq;
        let ok = true;
        for (let k = -1; k <= 1; k += 0.5) {
          const px = p.x + (axis === 'x' ? amp * k : 0);
          const py = p.y + (axis === 'y' ? amp * k : 0);
          if (clearance(px, py, draft.walls) < r + 9) { ok = false; break; }
          if (Math.hypot(px - draft.player.x, py - draft.player.y) < r + 60) { ok = false; break; }
        }
        if (ok) {
          return {
            x: p.x, y: p.y, r: r,
            move: { type: 'patrol', ax: axis, amp: amp, freq: freq, phase: phase }
          };
        }
      }
      mode = 'static';
    }

    if (mode === 'orbit') {
      const orbR = rnd(rng, 30, 54);
      const omega = (rng() < 0.5 ? -1 : 1) * rnd(rng, 0.9, 1.5);
      for (let a = 0; a < 6; a++) {
        const phase0 = rnd(rng, 0, Math.PI * 2);
        const ang = p.t * omega + phase0;
        const cx = p.x - Math.cos(ang) * orbR;
        const cy = p.y - Math.sin(ang) * orbR;
        let ok = true;
        for (let k = 0; k < 12; k++) {
          const t2 = (k / 12) * Math.PI * 2;
          const sx = cx + Math.cos(t2) * orbR;
          const sy = cy + Math.sin(t2) * orbR;
          if (clearance(sx, sy, draft.walls) < r + 9) { ok = false; break; }
          if (Math.hypot(sx - draft.player.x, sy - draft.player.y) < r + 60) { ok = false; break; }
        }
        if (ok) {
          return {
            x: p.x, y: p.y, r: r,
            move: { type: 'orbit', cx: cx, cy: cy, r: orbR, omega: omega, phase: phase0 }
          };
        }
      }
      mode = 'static';
    }

    if (clearance(p.x, p.y, draft.walls) < r + 12) return null;
    return { x: p.x, y: p.y, r: r, move: { type: 'static' } };
  }

  function addEnemies(draft, rng, path, diff, count, minArc, existing, minBounce) {
    const enemies = [];
    const startArc = minArc || 150;
    const needBounce = minBounce || 0;
    for (let a = 0; a < 500 && enemies.length < count; a++) {
      const s = rnd(rng, startArc, path.total - 60);
      const p = pointAtArc(path, s);
      if (!p) continue;
      if (p.bounces > diff.bounceTarget) continue;
      if (p.bounces < needBounce) continue;

      const r = Math.max(13, diff.enemyRadius + rndInt(rng, -1, 1));
      if (clearance(p.x, p.y, draft.walls) < r + 38) continue;
      if (Math.hypot(p.x - draft.player.x, p.y - draft.player.y) < 180) continue;

      let near = false;
      for (let k = 0; k < draft.switches.length; k++) {
        if (Math.hypot(p.x - draft.switches[k].x, p.y - draft.switches[k].y) < 80) near = true;
      }
      for (let k = 0; k < draft.portals.length; k++) {
        if (Math.hypot(p.x - draft.portals[k].x, p.y - draft.portals[k].y) < 90) near = true;
      }
      for (let k = 0; k < draft.doors.length; k++) {
        if (OB.pointToRect(p.x, p.y, draft.doors[k]) < 90) near = true;
      }
      for (let k = 0; k < enemies.length; k++) {
        if (Math.hypot(p.x - enemies[k].x, p.y - enemies[k].y) < 150) near = true;
      }
      if (existing) {
        for (let k = 0; k < existing.length; k++) {
          if (Math.hypot(p.x - existing[k].x, p.y - existing[k].y) < 150) near = true;
        }
      }
      if (near) continue;

      const enemy = makeEnemy(rng, p, r, diff, enemies.length, draft);
      if (!enemy) continue;
      enemies.push(enemy);
    }
    return enemies;
  }

  // =========================================================
  // Ловушки-декоры: блоки (смертельны) и зеркала.
  // Стоят в стороне от решения, но усложняют прицел.
  // =========================================================
  function pathTooClose(rect, path, margin) {
    for (let k = 0; k < path.segs.length; k++) {
      const seg = path.segs[k];
      for (let d = 0; d <= seg.len; d += 16) {
        const px = seg.x0 + seg.dirx * d, py = seg.y0 + seg.diry * d;
        if (OB.pointToRect(px, py, rect) < margin) return true;
      }
    }
    return false;
  }

  function addDecoys(draft, rng, path, count, diff) {
    let added = 0;
    for (let a = 0; a < 160 && added < count; a++) {
      const type = diff.blocks && rng() < 0.6 ? 'block' : 'mirror';
      const w = rnd(rng, 36, 110), h = rnd(rng, 22, 64);
      const x = rnd(rng, ARENA.x + 40, ARENA.x + ARENA.w - 40 - w);
      const y = rnd(rng, ARENA.y + 40, ARENA.y + ARENA.h - 40 - h);
      const rect = { x: x, y: y, w: w, h: h };

      if (Math.hypot(x + w / 2 - draft.player.x, y + h / 2 - draft.player.y) < 150) continue;
      if (pathTooClose(rect, path, 66)) continue;

      let bad = false;
      for (let i = 0; i < draft.walls.length; i++) {
        if (OB.rectsOverlap(rect, OB.sweptRect(draft.walls[i]), 16)) { bad = true; break; }
      }
      for (let i = 0; i < draft.enemies.length && !bad; i++) {
        const e = draft.enemies[i];
        if (Math.hypot(cxOf(rect) - e.x, cyOf(rect) - e.y) < 140) bad = true;
      }
      for (let i = 0; i < draft.switches.length && !bad; i++) {
        if (OB.pointToRect(draft.switches[i].x, draft.switches[i].y, rect) < 60) bad = true;
      }
      for (let i = 0; i < draft.portals.length && !bad; i++) {
        if (OB.pointToRect(draft.portals[i].x, draft.portals[i].y, rect) < 70) bad = true;
      }
      if (bad) continue;

      draft.walls.push({
        id: 'w' + (draft.walls.length), x: x, y: y, w: w, h: h, type: type
      });
      added++;
    }
    return added;
  }

  // Гравитационные колодцы: ставятся в стороне от решения, но
  // усложняют чтение арены и наказывают за неточный прицел.
  function addWells(draft, rng, path, count) {
    let added = 0;
    for (let a = 0; a < 140 && added < count; a++) {
      const r = rnd(rng, 62, 104);
      const x = rnd(rng, ARENA.x + r + 20, ARENA.x + ARENA.w - r - 20);
      const y = rnd(rng, ARENA.y + r + 20, ARENA.y + ARENA.h - r - 20);

      if (clearance(x, y, draft.walls) < r + 26) continue;
      if (Math.hypot(x - draft.player.x, y - draft.player.y) < r + 120) continue;
      if (pathTooClose({ x: x - r, y: y - r, w: r * 2, h: r * 2 }, path, 30)) continue;

      let bad = false;
      for (let i = 0; i < draft.enemies.length && !bad; i++) {
        if (Math.hypot(x - draft.enemies[i].x, y - draft.enemies[i].y) < r + 70) bad = true;
      }
      for (let i = 0; i < draft.switches.length && !bad; i++) {
        if (Math.hypot(x - draft.switches[i].x, y - draft.switches[i].y) < r + 50) bad = true;
      }
      for (let i = 0; i < draft.portals.length && !bad; i++) {
        if (Math.hypot(x - draft.portals[i].x, y - draft.portals[i].y) < r + 60) bad = true;
      }
      if (bad) continue;

      draft.wells.push({
        id: 'well' + added, x: x, y: y, r: r,
        bend: rnd(rng, 1.1, 1.8), dir: rng() < 0.5 ? 1 : -1
      });
      added++;
    }
    return added;
  }

  function cxOf(r) { return r.x + r.w / 2; }
  function cyOf(r) { return r.y + r.h / 2; }

  // =========================================================
  // Добавление стен шаблона с проверками (без наложений)
  // =========================================================
  function addTemplateWalls(walls, rng, name, budget) {
    let rects;
    try { rects = TEMPLATES[name](rng); } catch (e) { return 0; }
    let added = 0;
    for (let i = 0; i < rects.length; i++) {
      if (walls.length >= budget) break;
      const r = {
        x: Math.round(rects[i].x), y: Math.round(rects[i].y),
        w: Math.round(rects[i].w), h: Math.round(rects[i].h)
      };
      if (r.w < 10 || r.h < 10) continue;
      if (!insideArena(r, 18)) continue;
      let bad = false;
      for (let k = 0; k < walls.length; k++) {
        if (OB.rectsOverlap(r, OB.sweptRect(walls[k]), 28)) { bad = true; break; }
      }
      if (bad) continue;
      walls.push({ id: 'w' + walls.length, x: r.x, y: r.y, w: r.w, h: r.h, type: 'mirror' });
      added++;
    }
    return added;
  }

  // =========================================================
  // Одна попытка сборки уровня
  // =========================================================
  function buildAttempt(index, baseSeed, attemptNo) {
    const diff = difficulty(index);
    const seed = baseSeed + ':' + attemptNo;
    const rng = mulberry32(hash(seed));
    const relax = attemptNo > 40;
    const target = Math.max(0, diff.bounceTarget - (attemptNo > 70 ? 1 : 0));

    const walls = borders();
    const tpl = pick(rng, TEMPLATE_NAMES);
    addTemplateWalls(walls, rng, tpl, 32);
    if (rng() < 0.45) addTemplateWalls(walls, rng, pick(rng, TEMPLATE_NAMES), 38);

    if (!relax) addMovers(walls, rng, diff.moverCount);
    applySurfaces(walls, rng, diff);

    const player = pickPlayer(walls, rng);
    if (!player) { log('attempt', attemptNo, 'no player'); return null; }

    const draft = {
      walls: walls, player: player,
      enemies: [], switches: [], doors: [], portals: [], wells: [],
      aim: 0, maxBounces: 99, maxTime: 24
    };

    // 1) Находим реальную траекторию-решение
    const sol = findSolution(draft, rng, target);
    if (!sol) { log('attempt', attemptNo, 'no solution, walls', walls.length); return null; }
    draft.aim = sol.angle;
    let path = sol.path;

    // 2) Стекло на пути (ломается, пуля летит дальше)
    if (diff.useGlass && !relax && rng() < 0.8) {
      const glass = insertGlass(draft, rng, path, walls, 1);
      if (glass) {
        walls.push(glass);
        const tr = OB.trace(draft, draft.aim, { ghost: true, maxBounces: target + 2, maxTime: 26 });
        const broke = tr.state.events.some(function (e) { return e.type === 'break'; });
        if (tr.status === 'flying' && broke) path = buildPath(tr);
        else walls.pop();
      }
    }

    // 3) Телепорт
    if (diff.usePortals && !relax && path.total > 1000 && rng() < 0.8) {
      const res = tryPortals(draft, rng, path, target);
      if (res) path = res.path;
    }

    // 4) Переключатель + дверь
    let doorInfo = null;
    if (diff.useDoors && !relax) {
      const res = tryDoor(draft, rng, path, target, 1);
      if (res) { doorInfo = res; path = res.path; }
    }

    // 5) Враги: сначала тот, что за дверью (дверь становится нужной),
    //    и все они стоят после нужного числа отскоков
    const wanted = Math.max(1, Math.min(diff.maxEnemies,
      (diff.maxEnemies > 1 ? 2 : 1) + Math.floor(rng() * (diff.maxEnemies - 1))));
    let enemies = [];
    if (doorInfo) {
      enemies = addEnemies(draft, rng, path, diff, 1, doorInfo.doorArc + 70, null, target);
    }
    enemies = enemies.concat(addEnemies(
      draft, rng, path, diff, wanted - enemies.length, 220, enemies, target
    ));
    if (enemies.length < wanted) {
      enemies = enemies.concat(addEnemies(
        draft, rng, path, diff, wanted - enemies.length, 200, enemies, Math.max(0, target - 1)
      ));
    }

    if (!enemies.length) { log('attempt', attemptNo, 'no enemies'); return null; }
    draft.enemies = enemies;

    // 6) Декоративные ловушки (не на пути решения)
    addDecoys(draft, rng, path, diff.decoys, diff);
    if (diff.useWells) addWells(draft, rng, path, 2);

    // 7) Итоговый уровень
    const mechanics = [];
    if (walls.some(function (w) { return w.type === 'mover'; })) mechanics.push('mover');
    if (walls.some(function (w) { return w.type === 'bouncy'; })) mechanics.push('bouncy');
    if (walls.some(function (w) { return w.type === 'soft'; })) mechanics.push('soft');
    if (walls.some(function (w) { return w.type === 'block'; })) mechanics.push('block');
    if (walls.some(function (w) { return w.type === 'glass'; })) mechanics.push('glass');
    if (doorInfo) mechanics.push('door');
    if (draft.portals.length) mechanics.push('portal');
    if (draft.wells.length) mechanics.push('well');
    if (enemies.some(function (e) { return e.move.type === 'patrol'; })) mechanics.push('patrol');
    if (enemies.some(function (e) { return e.move.type === 'orbit'; })) mechanics.push('orbit');

    return {
      index: index,
      seed: seed,
      name: 'ARENA ' + (index + 1),
      tier: diff.tier,
      walls: walls,
      enemies: enemies,
      switches: draft.switches,
      doors: draft.doors,
      portals: draft.portals,
      wells: draft.wells,
      player: player,
      aim: sol.angle,
      targetBounces: target,
      maxBounces: diff.maxBounces,
      maxTime: Math.max(diff.maxTime, sol.trace.endT + 4),
      maxDistance: Math.max(diff.maxDistance, path.total + 900),
      energyMax: diff.energyMax,
      previewBounces: diff.previewBounces,
      mechanics: mechanics,
      difficulty: diff.tier,
      aimTolerance: diff.aimTolerance
    };
  }

  // =========================================================
  // Проверка проходимости: решение должно срабатывать
  // не только в идеальном угле, но и в пределах допуска
  // (стрельба мышью никогда не бывает идеально точной).
  // =========================================================
  function verify(level, tolDeg, quiet) {
    if (!level || !level.enemies || !level.enemies.length) return false;
    const tol = (tolDeg != null ? tolDeg : 0.5) * Math.PI / 180;
    const angles = [level.aim, level.aim + tol, level.aim - tol];

    for (let i = 0; i < angles.length; i++) {
      const res = OB.simulate(level, angles[i], { maxTime: 30 });
      if (!res.win) {
        if (!quiet) {
          level.lastVerifyFail = res.failReason || ('kill ' + res.kills + '/' + res.enemies);
        }
        return false;
      }
    }

    // ---- структурные проверки ----
    for (let i = 0; i < level.enemies.length; i++) {
      const e = level.enemies[i];
      if (e.x < ARENA.x || e.x > ARENA.x + ARENA.w || e.y < ARENA.y || e.y > ARENA.y + ARENA.h) return false;
      if (clearance(e.x, e.y, level.walls) < e.r + 2) return false;
    }
    for (let i = 0; i < level.switches.length; i++) {
      const s = level.switches[i];
      if (!level.doors.some(function (d) { return d.channel === s.channel; })) return false;
    }
    for (let i = 0; i < level.doors.length; i++) {
      if (!level.switches.some(function (s) { return s.channel === level.doors[i].channel; })) return false;
    }
    for (let i = 0; i < level.walls.length; i++) {
      const w = level.walls[i];
      if (w.id.indexOf('b') === 0) continue;
      if (!insideArena(w, -2)) return false;
    }
    if (level.walls.length > 64) return false;
    if (level.enemies.length > 7) return false;
    return true;
  }

  // =========================================================
  // Запасной простой уровень (если генерация не удалась)
  // =========================================================
  function fallback(index, seed) {
    const diff = difficulty(index);
    const walls = borders();
    walls.push({ id: 'w0', x: W / 2 - 12, y: 140, w: 24, h: 160, type: 'mirror' });
    const level = {
      index: index, seed: seed + ':fallback', name: 'ARENA ' + (index + 1),
      tier: diff.tier,
      walls: walls,
      enemies: [{ x: 1040, y: 500, r: 18, move: { type: 'static' } }],
      switches: [], doors: [], portals: [],
      player: { x: 180, y: 500, r: 17 },
      aim: 0,
      targetBounces: 0,
      maxBounces: Math.max(3, diff.maxBounces),
      maxTime: 14, maxDistance: 3400,
      energyMax: diff.energyMax,
      previewBounces: Math.max(1, diff.previewBounces),
      mechanics: [],
      difficulty: diff.tier,
      aimTolerance: 0.9,
      fallback: true
    };
    if (verify(level, 0.9, true)) return level;

    // самый простой вариант — точно проходим
    const l2 = {
      index: index, seed: seed + ':simple', name: 'ARENA ' + (index + 1),
      tier: 1, walls: borders(), enemies: [{ x: 860, y: 360, r: 20, move: { type: 'static' } }],
      switches: [], doors: [], portals: [],
      player: { x: 240, y: 360, r: 17 }, aim: 0,
      targetBounces: 0, maxBounces: 4, maxTime: 14, maxDistance: 3400,
      energyMax: 999, previewBounces: 3,
      mechanics: [], difficulty: 1, aimTolerance: 1.2, fallback: true
    };
    return l2;
  }

  // =========================================================
  // Публичная генерация с кешем
  // =========================================================
  const cache = Object.create(null);

  function generate(index, opts) {
    opts = opts || {};
    const worldSeed = opts.worldSeed || 'flexshot';
    const baseSeed = opts.seed || ('w' + worldSeed + '#' + index);
    const key = baseSeed;
    if (cache[key]) return cache[key];

    const diff = difficulty(index);
    const t0 = now();
    for (let attempt = 1; attempt <= 80; attempt++) {
      let lvl = null;
      try {
        lvl = buildAttempt(index, baseSeed, attempt);
      } catch (e) {
        log('build error:', e && e.message);
        lvl = null;
      }
      let ok = false;
      if (lvl) {
        try { ok = verify(lvl, diff.aimTolerance); }
        catch (e) { ok = false; }
      }
      if (ok) {
        lvl.generateAttempts = attempt;
        lvl.verified = true;
        lvl.genMs = Math.round(now() - t0);
        cache[key] = lvl;
        return lvl;
      }
      if (lvl) log('attempt', attempt, 'verify failed:', lvl.lastVerifyFail, 'en', lvl.enemies.length, 'walls', lvl.walls.length, 'mech', lvl.mechanics.join(','));
      if (now() - t0 > 1500) break; // не подвешиваем игру
    }
    const fb = fallback(index, baseSeed);
    fb.generateAttempts = 0;
    fb.verified = true;
    fb.genMs = Math.round(now() - t0);
    cache[key] = fb;
    return fb;
  }

  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function clearCache() {
    for (const k in cache) delete cache[k];
  }

  const Gen = {
    generate: generate,
    verify: verify,
    difficulty: difficulty,
    buildAttempt: buildAttempt,
    fallback: fallback,
    clearCache: clearCache,
    hash: hash,
    mulberry32: mulberry32,
    templates: TEMPLATE_NAMES,
    ARENA: ARENA
  };

  global.Gen = Gen;
  if (typeof module !== 'undefined' && module.exports) module.exports = Gen;
})(typeof window !== 'undefined' ? window : globalThis);
