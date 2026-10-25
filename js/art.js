/* =========================================================
   ONE BULLET / FlexShot — art.js
   Вся графика арены рисуется кодом на Canvas 2D:
   • остров из блоков травы и земли (как блок из Minecraft);
   • стены-деревья: дуб, берёза, ель, тёмный дуб, джунгли,
     акация, пальма, кактус, сухое дерево, лёд и ворота;
   • персонаж и враги — стикмены с пистолетами;
   • погода и мелкий декор биома.

   Модуль не хранит состояние игры: все функции получают
   контекст и данные. Спрайты деревьев и пол кешируются,
   поэтому в игровом цикле остаётся только drawImage.
   ========================================================= */
(function (global) {
  'use strict';

  const Biomes = global.Biomes || (typeof require === 'function' ? require('./biomes.js') : null);
  const TAU = Math.PI * 2;
  const W = 1280, H = 720;
  const PAD = 18;                 // запас спрайта дерева под крону, тень и листву
  const TREE_CACHE_LIMIT = 120;

  // =========================================================
  // Цвета и детерминированный «шум»
  // =========================================================
  function hexToRgb(hex) {
    if (typeof hex !== 'string') return [0, 0, 0];
    if (hex.indexOf('rgb') === 0) {
      const parts = hex.slice(hex.indexOf('(') + 1, hex.indexOf(')')).split(',');
      return [parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0, parseInt(parts[2], 10) || 0];
    }
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    if (!isFinite(n)) return [0, 0, 0];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(hex, a) {
    const c = hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function mix(a, b, t) {
    const ca = hexToRgb(a), cb = hexToRgb(b);
    const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
    const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
    const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function shade(hex, amt) {
    return amt >= 0 ? mix(hex, '#FFFFFF', amt) : mix(hex, '#000000', -amt);
  }

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

  function noise(x, y, seed) {
    return mulberry32((Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ seed) >>> 0)();
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function createSurface(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function roundRect(g, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.lineTo(x + w - rr, y);
    g.quadraticCurveTo(x + w, y, x + w, y + rr);
    g.lineTo(x + w, y + h - rr);
    g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    g.lineTo(x + rr, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - rr);
    g.lineTo(x, y + rr);
    g.quadraticCurveTo(x, y, x + rr, y);
    g.closePath();
  }

  // =========================================================
  // Пол: блок травы + земляная рамка острова
  // =========================================================
  function grassField(g, x, y, w, h, biome, rng) {
    const p = biome.grass;
    g.fillStyle = p.base;
    g.fillRect(x, y, w, h);

    // Мягкие пятна травы — как шум текстуры блока, без шахматной сетки
    const patches = Math.round((w * h) / 5200);
    for (let i = 0; i < patches; i++) {
      g.fillStyle = rng() < 0.5 ? p.light : p.dark;
      g.globalAlpha = 0.06 + rng() * 0.10;
      g.beginPath();
      g.ellipse(x + rng() * w, y + rng() * h,
        18 + rng() * 60, 12 + rng() * 38, rng() * 3, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;

    // Пиксельная крошка — «текстура блока»
    const specks = Math.round((w * h) / 150);
    for (let i = 0; i < specks; i++) {
      const px = x + rng() * (w - 4);
      const py = y + rng() * (h - 4);
      const n = rng();
      g.fillStyle = n < 0.5 ? p.light : p.dark;
      g.globalAlpha = 0.12 + rng() * 0.28;
      g.fillRect(px, py, 2 + Math.floor(rng() * 4), 2 + Math.floor(rng() * 4));
    }
    g.globalAlpha = 1;

    // Редкие прожилки-травинки
    g.lineCap = 'round';
    const blades = Math.round((w * h) / 26000);
    for (let i = 0; i < blades; i++) {
      const px = x + rng() * w, py = y + rng() * h;
      g.strokeStyle = p.blade;
      g.globalAlpha = 0.16 + rng() * 0.2;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + (rng() - 0.5) * 4, py - 3 - rng() * 4);
      g.stroke();
    }
    g.globalAlpha = 1;

    // Едва заметные стыки блоков 32×32
    g.strokeStyle = 'rgba(0,0,0,0.035)';
    g.lineWidth = 1;
    for (let cx = x + 32; cx < x + w; cx += 32) {
      g.beginPath(); g.moveTo(Math.round(cx) + 0.5, y); g.lineTo(Math.round(cx) + 0.5, y + h); g.stroke();
    }
    for (let cy = y + 32; cy < y + h; cy += 32) {
      g.beginPath(); g.moveTo(x, Math.round(cy) + 0.5); g.lineTo(x + w, Math.round(cy) + 0.5); g.stroke();
    }

    // Верхний свет и лёгкое затемнение краёв
    const lite = g.createRadialGradient(x + w * 0.42, y + h * 0.36, 40, x + w / 2, y + h / 2, w * 0.72);
    lite.addColorStop(0, 'rgba(255,255,255,0.06)');
    lite.addColorStop(1, 'rgba(0,0,0,0.04)');
    g.fillStyle = lite;
    g.fillRect(x, y, w, h);
  }

  function drawGrassTuft(g, x, y, p, rng, big) {
    const blades = 3 + Math.floor(rng() * 3);
    const k = big ? 1.3 : 0.9;
    g.strokeStyle = p.blade;
    g.lineWidth = 1.5;
    g.lineCap = 'round';
    for (let i = 0; i < blades; i++) {
      const dx = (i - blades / 2) * 2.2 * k;
      const hgt = (5 + rng() * 7) * k;
      g.globalAlpha = 0.5 + rng() * 0.4;
      g.beginPath();
      g.moveTo(x + dx, y);
      g.quadraticCurveTo(x + dx + (rng() - 0.5) * 4, y - hgt * 0.6, x + dx + (rng() - 0.5) * 6, y - hgt);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function drawFlower(g, x, y, color, rng) {
    const r = 1.6 + rng() * 1.2;
    g.fillStyle = color;
    g.globalAlpha = 0.92;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      g.beginPath();
      g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.95, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#FFE9A3';
    g.beginPath(); g.arc(x, y, r * 0.7, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }

  function drawPebble(g, x, y, biome, rng) {
    const s = 2 + rng() * 3;
    g.fillStyle = shade(biome.soil.dark, 0.25);
    g.globalAlpha = 0.8;
    g.beginPath();
    g.ellipse(x, y, s * 1.3, s, rng() * 0.6, 0, TAU);
    g.fill();
    g.fillStyle = shade(biome.soil.light, 0.3);
    g.beginPath();
    g.ellipse(x - s * 0.25, y - s * 0.35, s * 0.6, s * 0.45, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }

  function drawMushroom(g, x, y, biome, rng) {
    const s = 0.8 + rng() * 0.7;
    const cap = biome.flower[Math.floor(rng() * biome.flower.length)] || '#E05A6A';
    g.fillStyle = '#EDE3D2';
    g.fillRect(x - 1.2 * s, y - 2 * s, 2.4 * s, 4 * s);
    g.fillStyle = cap;
    g.beginPath();
    g.ellipse(x, y - 3 * s, 4.4 * s, 3 * s, 0, Math.PI, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.65)';
    g.beginPath(); g.arc(x - 1.4 * s, y - 4 * s, 0.9 * s, 0, TAU); g.fill();
    g.beginPath(); g.arc(x + 1.6 * s, y - 3.4 * s, 0.7 * s, 0, TAU); g.fill();
  }

  function drawLily(g, x, y, rng) {
    const r = 4 + rng() * 4;
    g.fillStyle = '#3E7A3A';
    g.globalAlpha = 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y, r, 0.35, TAU - 0.15);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(20,50,20,0.5)';
    g.lineWidth = 1;
    g.stroke();
    g.globalAlpha = 1;
  }

  function drawBush(g, x, y, biome, rng) {
    const p = biome.leaf;
    g.fillStyle = p.dark;
    g.globalAlpha = 0.9;
    g.beginPath();
    g.ellipse(x, y, 6 + rng() * 3, 3.5 + rng() * 2, 0, 0, TAU);
    g.fill();
    g.fillStyle = p.base;
    g.beginPath();
    g.ellipse(x - 1.5, y - 1.5, 4.2 + rng() * 2, 2.6 + rng() * 1.4, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }

  function drawSmallCactus(g, x, y, biome) {
    g.fillStyle = biome.leaf.base;
    roundRect(g, x - 2.2, y - 8, 4.4, 10, 1.6);
    g.fill();
    g.fillStyle = biome.leaf.light;
    g.fillRect(x - 1.6, y - 8, 1.2, 9);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(x + 1.4, y - 7); g.lineTo(x + 1.4, y - 1);
    g.moveTo(x - 2, y - 5); g.lineTo(x - 2, y - 2);
    g.stroke();
  }

  function drawShell(g, x, y, rng) {
    g.fillStyle = '#FFF1E4';
    g.beginPath();
    g.arc(x, y, 3 + rng() * 1.6, Math.PI, TAU);
    g.fill();
    g.strokeStyle = 'rgba(214,176,146,0.8)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.arc(x, y, 1.8, Math.PI, TAU);
    g.stroke();
  }

  // ---------- Список занятых мест (декор не лезет на механику) ----------
  function collectOccupied(level) {
    const list = [];
    if (!level) return list;
    const push = function (x, y, w, h) { list.push({ x: x, y: y, w: w, h: h }); };

    (level.walls || []).forEach(function (w) { push(w.x - 6, w.y - 6, w.w + 12, w.h + 12); });
    (level.doors || []).forEach(function (d) { push(d.x - 8, d.y - 8, d.w + 16, d.h + 16); });
    (level.switches || []).forEach(function (s) { push(s.x - 26, s.y - 26, 52, 52); });
    (level.portals || []).forEach(function (p) { push(p.x - 36, p.y - 36, 72, 72); });
    (level.wells || []).forEach(function (w) { push(w.x - w.r - 8, w.y - w.r - 8, w.r * 2 + 16, w.r * 2 + 16); });
    (level.enemies || []).forEach(function (e) { push(e.x - 38, e.y - 30, 76, 64); });
    if (level.player) push(level.player.x - 38, level.player.y - 34, 76, 68);
    return list;
  }

  function isFree(x, y, occupied, pad) {
    for (let i = 0; i < occupied.length; i++) {
      const r = occupied[i];
      if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return false;
    }
    return true;
  }

  function drawPond(g, cx, cy, rx, ry, biome, rng) {
    const w = biome.water;
    g.save();
    g.fillStyle = w.dark;
    g.beginPath(); g.ellipse(cx, cy, rx + 2, ry + 2, 0, 0, TAU); g.fill();
    g.fillStyle = w.base;
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    g.fillStyle = w.light;
    g.globalAlpha = 0.55;
    g.beginPath(); g.ellipse(cx - rx * 0.2, cy - ry * 0.25, rx * 0.62, ry * 0.5, 0, 0, TAU); g.fill();
    g.globalAlpha = 0.5;
    g.strokeStyle = w.light;
    g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const yy = cy - ry * 0.3 + i * ry * 0.35;
      g.beginPath();
      g.arc(cx + (rng() - 0.5) * rx * 0.4, yy, rx * (0.3 + rng() * 0.45), Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.restore();
  }

  function drawGroundFeatures(g, biome, left, top, width, height, rng, occupied) {
    const ponds = [];
    // Вода: болото и побережье (не под стенами и механизмами)
    if (biome.water) {
      const count = biome.id === 'beach' ? 1 : 2;
      let placed = 0;
      for (let attempt = 0; attempt < 50 && placed < count; attempt++) {
        const cx = left + width * (0.18 + rng() * 0.64);
        const cy = top + height * (0.18 + rng() * 0.64);
        const rx = 55 + rng() * 80, ry = 30 + rng() * 40;
        if (occupied && !isFree(cx, cy, occupied, Math.max(rx, ry) * 0.8)) continue;
        ponds.push({ cx: cx, cy: cy, rx: rx, ry: ry });
        drawPond(g, cx, cy, rx, ry, biome, rng);
        placed++;
      }
    }

    // Снежные поля
    if (biome.snow) {
      // Мягкие сугробы, без «белых колец»
      for (let i = 0; i < 26; i++) {
        const cx = left + rng() * width, cy = top + rng() * height;
        const rx = 18 + rng() * 52, ry = 10 + rng() * 26;
        g.fillStyle = 'rgba(255,255,255,' + (0.10 + rng() * 0.14).toFixed(2) + ')';
        g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(170,204,226,' + (0.05 + rng() * 0.06).toFixed(2) + ')';
        g.beginPath(); g.ellipse(cx + rx * 0.25, cy + ry * 0.3, rx * 0.7, ry * 0.65, 0, 0, TAU); g.fill();
      }
      // Искры на снегу
      for (let i = 0; i < 60; i++) {
        g.fillStyle = 'rgba(255,255,255,' + (0.35 + rng() * 0.5).toFixed(2) + ')';
        g.fillRect(left + rng() * width, top + rng() * height, 1 + rng() * 2, 1 + rng() * 2);
      }
      // трещины льда
      g.strokeStyle = 'rgba(120,175,205,0.3)';
      g.lineWidth = 1.2;
      for (let i = 0; i < 11; i++) {
        const x = left + rng() * width, y = top + rng() * height;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (rng() - 0.5) * 70, y + (rng() - 0.5) * 50);
        g.lineTo(x + (rng() - 0.5) * 90, y + (rng() - 0.5) * 70);
        g.stroke();
      }
    }

    // Песчаные волны / глиняные полосы
    if (biome.ripples) {
      const dark = rgba(biome.soil.dark, biome.id === 'badlands' ? 0.24 : 0.17);
      g.strokeStyle = dark;
      g.lineWidth = 1.6;
      for (let y = top + 26; y < top + height; y += 40) {
        g.beginPath();
        for (let x = left - 12; x <= left + width + 12; x += 16) {
          const yy = y + Math.sin((x - left) * 0.012 + y * 0.02) * 5;
          if (x === left - 12) g.moveTo(x, yy); else g.lineTo(x, yy);
        }
        g.stroke();
      }
      for (let i = 0; i < 70; i++) {
        g.fillStyle = rgba(biome.soil.light, 0.25);
        g.fillRect(left + rng() * width, top + rng() * height, 2 + rng() * 4, 1 + rng() * 2);
      }
    }

    // Тёмные пятна мха/листвы
    if (biome.dark) {
      for (let i = 0; i < 18; i++) {
        g.fillStyle = 'rgba(10,24,10,0.12)';
        g.beginPath();
        g.ellipse(left + rng() * width, top + rng() * height, 30 + rng() * 70, 18 + rng() * 40, 0, 0, TAU);
        g.fill();
      }
    }
    return ponds;
  }

  // ---------- Мелкий декор: трава, цветы, грибы, камни ----------
  function inPond(x, y, ponds) {
    for (let i = 0; i < ponds.length; i++) {
      const p = ponds[i];
      const dx = (x - p.cx) / p.rx;
      const dy = (y - p.cy) / p.ry;
      if (dx * dx + dy * dy <= 1.05) return true;
    }
    return false;
  }

  function drawDecor(g, biome, left, top, width, height, occupied, ponds, rng) {
    const d = biome.decor;
    const area = width * height;

    function spot(pad) {
      for (let i = 0; i < 40; i++) {
        const x = left + 26 + rng() * (width - 52);
        const y = top + 26 + rng() * (height - 52);
        if (inPond(x, y, ponds)) continue;
        if (isFree(x, y, occupied, pad)) return { x: x, y: y };
      }
      return null;
    }

    // Трава
    const tufts = Math.round(area / 8200 * d.tuft);
    for (let i = 0; i < tufts; i++) {
      const p = spot(6);
      if (p) drawGrassTuft(g, p.x, p.y, biome.grass, rng, rng() < 0.25);
    }

    // Цветы
    const flowers = Math.round(area / 26000 * d.flower);
    for (let i = 0; i < flowers; i++) {
      const p = spot(8);
      if (!p) continue;
      const col = biome.flower[Math.floor(rng() * biome.flower.length)] || '#FFD84D';
      drawFlower(g, p.x, p.y, col, rng);
    }

    // Камни
    const pebbles = Math.round(area / 42000 * d.pebble);
    for (let i = 0; i < pebbles; i++) {
      const p = spot(6);
      if (p) drawPebble(g, p.x, p.y, biome, rng);
    }

    // Грибы
    const mushrooms = Math.round(area / 46000 * d.mushroom);
    for (let i = 0; i < mushrooms; i++) {
      const p = spot(8);
      if (p) drawMushroom(g, p.x, p.y, biome, rng);
    }

    // Кусты
    const bushes = Math.round(area / 52000 * d.bush);
    for (let i = 0; i < bushes; i++) {
      const p = spot(10);
      if (p) drawBush(g, p.x, p.y, biome, rng);
    }

    // Кактусы
    const cacti = Math.round(area / 70000 * d.cactus);
    for (let i = 0; i < cacti; i++) {
      const p = spot(8);
      if (p) drawSmallCactus(g, p.x, p.y, biome);
    }

    // Ракушки
    const shells = Math.round(area / 60000 * d.shell);
    for (let i = 0; i < shells; i++) {
      const p = spot(6);
      if (p) drawShell(g, p.x, p.y, rng);
    }

    // Кувшинки — только в воде
    if (ponds.length && d.lily > 0) {
      const lilies = Math.round(10 * d.lily);
      for (let i = 0; i < lilies; i++) {
        const pond = ponds[Math.floor(rng() * ponds.length)];
        const a = rng() * TAU, rr = Math.sqrt(rng()) * 0.8;
        drawLily(g, pond.cx + Math.cos(a) * pond.rx * rr, pond.cy + Math.sin(a) * pond.ry * rr, rng);
      }
    }
  }

  /**
   * Пол арены одного уровня: трава/песок/снег биома, декор
   * и земляная рамка-остров. Готовится один раз и потом
   * просто копируется на холст.
   */
  function buildFloor(level, biome) {
    const border = (global.OB && global.OB.BORDER) || 24;
    const width = (global.OB && global.OB.W) || W;
    const height = (global.OB && global.OB.H) || H;
    const b = biome || (Biomes ? Biomes.byId('plains') : null);
    if (!b) return createSurface(width, height);
    const seedText = ((level && (level.seed || level.index)) || 'menu') + ':' + b.id;
    const rng = mulberry32(hash(seedText));

    const c = createSurface(width, height);
    const g = c.getContext('2d');
    if (!g) return c;

    g.fillStyle = b.grass.dark;
    g.fillRect(0, 0, width, height);

    const left = border, top = border;
    const fw = width - border * 2, fh = height - border * 2;

    g.save();
    g.beginPath();
    g.rect(left, top, fw, fh);
    g.clip();

    grassField(g, left, top, fw, fh, b, rng);
    const occupied = collectOccupied(level);
    const ponds = drawGroundFeatures(g, b, left, top, fw, fh, rng, occupied);
    drawDecor(g, b, left, top, fw, fh, occupied, ponds, rng);
    if (b.fog) {
      g.fillStyle = b.fog;
      g.fillRect(left, top, fw, fh);
    }
    g.restore();

    drawDirtFrame(g, width, height, border, b, rng);

    // Общая виньетка — механика и пуля не теряются на светлом фоне
    const vg = g.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.32,
      width / 2, height / 2, Math.max(width, height) * 0.74);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = vg;
    g.fillRect(0, 0, width, height);

    if (b.dark) {
      g.fillStyle = 'rgba(8, 4, 16, 0.08)';
      g.fillRect(left, top, fw, fh);
    }
    return c;
  }


  function drawDirtFrame(g, width, height, border, biome, rng) {
    const s = biome.soil;
    const block = 12;
    const seed = Math.floor(rng() * 100000);

    function blockStrip(x, y, w, h, shadeDir) {
      for (let by = y; by < y + h; by += block) {
        for (let bx = x; bx < x + w; bx += block) {
          const n = noise(bx / block, by / block, seed);
          let col = n < 0.34 ? s.top : (n < 0.68 ? s.light : s.dark);
          if (shadeDir === 'bottom') col = mix(col, s.dark, 0.35);
          if (shadeDir === 'top') col = mix(col, s.light, 0.16);
          col = mix(col, '#FFFFFF', 0.05);
          const bw = Math.min(block, x + w - bx);
          const bh = Math.min(block, y + h - by);
          g.fillStyle = col;
          g.fillRect(bx, by, bw, bh);
          if (n > 0.5) {
            g.fillStyle = rgba(s.speck, 0.35);
            g.fillRect(bx + 2, by + 3, 3, 2);
            g.fillRect(bx + 7, by + 7, 2, 2);
          }
          g.strokeStyle = 'rgba(0,0,0,0.18)';
          g.lineWidth = 1;
          g.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        }
      }
    }

    blockStrip(0, 0, width, border, 'top');
    blockStrip(0, height - border, width, border, 'bottom');
    blockStrip(0, border, border, height - border * 2, 'left');
    blockStrip(width - border, border, border, height - border * 2, 'right');

    // Тёмный низ «утёса» — эффект объёма блока
    const cliff = g.createLinearGradient(0, height - border, 0, height);
    cliff.addColorStop(0, 'rgba(0,0,0,0)');
    cliff.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = cliff;
    g.fillRect(0, height - border, width, border);

    // Травяная кромка по внутреннему краю
    const gp = biome.grass;
    const lip = mix(gp.base, gp.dark, 0.2);
    g.fillStyle = lip;
    g.fillRect(border, border - 3, width - border * 2, 3);
    g.fillRect(border, height - border, width - border * 2, 3);
    g.fillRect(border - 3, border, 3, height - border * 2);
    g.fillRect(width - border, border, 3, height - border * 2);

    g.fillStyle = gp.light;
    g.fillRect(border, border - 3, width - border * 2, 1);
    g.fillRect(border, height - border, width - border * 2, 1);
    g.fillRect(border - 3, border, 1, height - border * 2);
    g.fillRect(width - border, border, 1, height - border * 2);

    // Травинки, свисающие с кромки
    for (let i = 0; i < 46; i++) {
      const horiz = i % 2 === 0;
      g.strokeStyle = gp.blade;
      g.globalAlpha = 0.5 + rng() * 0.4;
      g.lineWidth = 1.3;
      g.beginPath();
      if (horiz) {
        const x = border + 10 + rng() * (width - border * 2 - 20);
        if (rng() < 0.5) { g.moveTo(x, border); g.lineTo(x + (rng() - 0.5) * 5, border + 5 + rng() * 4); }
        else { g.moveTo(x, height - border); g.lineTo(x + (rng() - 0.5) * 5, height - border - 5 - rng() * 4); }
      } else {
        const y = border + 10 + rng() * (height - border * 2 - 20);
        if (rng() < 0.5) { g.moveTo(border, y); g.lineTo(border + 5 + rng() * 4, y + (rng() - 0.5) * 5); }
        else { g.moveTo(width - border, y); g.lineTo(width - border - 5 - rng() * 4, y + (rng() - 0.5) * 5); }
      }
      g.stroke();
    }
    g.globalAlpha = 1;

    // Внутренняя тень от рамки
    const inner = border;
    const tg = g.createLinearGradient(0, inner, 0, inner + 10);
    tg.addColorStop(0, 'rgba(0,0,0,0.14)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = tg; g.fillRect(inner, inner, width - inner * 2, 10);

    const bg = g.createLinearGradient(0, height - inner, 0, height - inner - 10);
    bg.addColorStop(0, 'rgba(0,0,0,0.14)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg; g.fillRect(inner, height - inner - 10, width - inner * 2, 10);

    const lg = g.createLinearGradient(inner, 0, inner + 10, 0);
    lg.addColorStop(0, 'rgba(0,0,0,0.12)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = lg; g.fillRect(inner, inner, 10, height - inner * 2);

    const rg = g.createLinearGradient(width - inner, 0, width - inner - 10, 0);
    rg.addColorStop(0, 'rgba(0,0,0,0.12)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(width - inner - 10, inner, 10, height - inner * 2);
  }





  // =========================================================
  // Стены-деревья: спрайт на каждую стену, кешируется
  // =========================================================
  function speciesFor(kind, biome) {
    if (kind === 'glass') return 'ice';
    if (kind === 'door') return 'gate';
    if (kind === 'block') return 'dead';
    return biome.tree;
  }

  function leafSkin(biome, kind) {
    if (kind === 'bouncy') {
      // Осеннее золотое дерево — ускоряющая поверхность
      return { base: '#C4832B', light: '#E9B24A', dark: '#8C5C1D', edge: '#5E3C12', accent: '#FFD84D' };
    }
    if (kind === 'soft') {
      // Бледная «вязкая» крона
      return { base: '#8A93B4', light: '#B7C1DE', dark: '#687094', edge: '#434A66', accent: '#DCE6FF' };
    }
    return biome.leaf;
  }

  function treeCore(g, x, y, r, biome, species, rng) {
    const log = biome.log;
    const l = biome.leaf;
    const coreR = clamp(r * 0.18, 2.2, 5.5);

    g.save();

    if (species === 'birch') {
      // Белый ствол с чёрными штрихами, чуть выглядывает из листвы
      g.fillStyle = '#F3F1E4';
      g.beginPath();
      g.ellipse(x + 1, y + 1, coreR * 1.25, coreR, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(120,116,100,0.85)';
      g.lineWidth = 1;
      g.stroke();
      g.strokeStyle = 'rgba(28,28,24,0.85)';
      g.lineWidth = 1.3;
      for (let i = 0; i < 3; i++) {
        const a = rng() * TAU;
        g.beginPath();
        g.moveTo(x + Math.cos(a) * coreR * 0.3, y + Math.sin(a) * coreR * 0.3);
        g.lineTo(x + Math.cos(a) * coreR * 0.85, y + Math.sin(a) * coreR * 0.85);
        g.stroke();
      }
    } else if (species === 'palm') {
      g.fillStyle = log.bark;
      g.beginPath(); g.arc(x, y, coreR, 0, TAU); g.fill();
      g.strokeStyle = rgba(log.ring, 0.9);
      g.lineWidth = 1;
      g.beginPath(); g.arc(x, y, coreR * 0.55, 0, TAU); g.stroke();
      g.fillStyle = '#6B4A24';
      g.beginPath(); g.arc(x - coreR * 0.8, y + coreR * 0.5, 1.6, 0, TAU); g.fill();
      g.beginPath(); g.arc(x + coreR * 0.85, y + coreR * 0.2, 1.4, 0, TAU); g.fill();
    } else {
      // Небольшой кусок коры, а не «глаз» посреди кроны
      g.fillStyle = log.bark;
      g.beginPath();
      g.ellipse(x + 0.8, y + 0.8, coreR * 1.15, coreR * 0.9, rng() * 1.2, 0, TAU);
      g.fill();
      g.fillStyle = rgba(log.light, 0.85);
      g.beginPath();
      g.ellipse(x - coreR * 0.25, y - coreR * 0.2, coreR * 0.55, coreR * 0.42, 0, 0, TAU);
      g.fill();
      g.fillStyle = rgba(log.dark, 0.75);
      g.fillRect(x + coreR * 0.2, y - coreR * 0.8, 1.6, 2.6);
      g.fillRect(x - coreR * 0.9, y + coreR * 0.2, 2.2, 1.6);
    }

    // Листва частично прикрывает ствол
    g.fillStyle = rgba(l.base, 0.92);
    g.beginPath();
    g.arc(x + coreR * 0.9, y - coreR * 0.7, coreR * 0.65, 0, TAU);
    g.fill();
    g.fillStyle = rgba(l.dark, 0.85);
    g.beginPath();
    g.arc(x - coreR * 0.95, y + coreR * 0.45, coreR * 0.5, 0, TAU);
    g.fill();

    g.restore();
  }

  function leafFringe(g, w, h, l, rng) {
    const step = 8;
    const out = 4;
    const tones = [l.light, l.base, l.dark];
    const tone = function () { return tones[Math.floor(rng() * tones.length)]; };

    for (let x = -out; x < w + out; x += step) {
      for (let side = 0; side < 2; side++) {
        if (rng() < 0.18) continue;
        const size = 3 + rng() * 5;
        g.fillStyle = tone();
        g.fillRect(x + (rng() - 0.5) * 3,
          side === 0 ? -rng() * out : h - size + rng() * out, size, size);
      }
    }
    for (let y = -out; y < h + out; y += step) {
      for (let side = 0; side < 2; side++) {
        if (rng() < 0.22) continue;
        const size = 3 + rng() * 5;
        g.fillStyle = tone();
        g.fillRect(side === 0 ? -rng() * out : w - size + rng() * out,
          y + (rng() - 0.5) * 3, size, size);
      }
    }
  }

  function paintCanopy(g, w, h, biome, species, kind, rng) {
    const l = biome.leaf;
    const alongX = w >= h;
    const len = Math.max(w, h);
    const thick = Math.min(w, h);
    const OV = 7;
    const compact = len / Math.max(1, thick) < 1.55 || len < 46;
    const trees = [];

    if (compact) {
      trees.push({ x: w / 2, y: h / 2, r: clamp(len * 0.78 + 4, 18, 46) });
    } else {
      const count = clamp(Math.round(len / 44), 1, 8);
      const baseR = clamp(thick * 0.75 + 4, 13, 28);
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const jitter = (rng() - 0.5) * Math.min(4, thick * 0.12);
        trees.push({
          x: alongX ? t * w : w / 2 + jitter,
          y: alongX ? h / 2 + jitter : t * h,
          r: baseR * (0.92 + rng() * 0.16)
        });
      }
    }

    // Тени
    for (let i = 0; i < trees.length; i++) {
      const tr = trees[i];
      g.fillStyle = 'rgba(8,16,8,0.12)';
      g.beginPath();
      g.ellipse(tr.x + 3, tr.y + 4, tr.r * 1.05, tr.r * 0.72, 0, 0, TAU);
      g.fill();
    }

    g.save();
    roundRect(g, -OV, -OV, w + OV * 2, h + OV * 2, clamp(thick * 0.35 + 6, 8, 18));
    g.clip();

    for (let ti = 0; ti < trees.length; ti++) {
      const tr = trees[ti];

      // Крона из перекрывающихся листовых кластеров
      const blobs = 12 + Math.floor(tr.r / 4);
      for (let b = 0; b < blobs; b++) {
        const a = (b / blobs) * TAU + rng() * 0.6;
        const dist = tr.r * (0.08 + rng() * 0.36);
        const br = tr.r * (0.26 + rng() * 0.24);
        const n = rng();
        g.fillStyle = n < 0.5 ? l.base : (n < 0.86 ? l.light : l.dark);
        g.globalAlpha = 0.8;
        g.beginPath();
        g.ellipse(tr.x + Math.cos(a) * dist, tr.y + Math.sin(a) * dist, br,
          br * (species === 'acacia' ? 0.62 : 0.8 + rng() * 0.18), rng() * 3, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;

      // Светлая шапка кроны
      g.fillStyle = rgba(l.light, 0.22);
      g.beginPath();
      g.ellipse(tr.x - tr.r * 0.18, tr.y - tr.r * 0.25, tr.r * 0.58, tr.r * 0.42, -0.4, 0, TAU);
      g.fill();

      // Неровные листовые лопасти по краю
      const lobes = species === 'spruce' ? 0 : 4 + Math.floor(tr.r / 12);
      for (let k = 0; k < lobes; k++) {
        const a = (k / lobes) * TAU + rng() * 0.5;
        const rad = tr.r * (0.86 + rng() * 0.18);
        g.fillStyle = rng() < 0.5 ? rgba(l.light, 0.75) : rgba(l.base, 0.8);
        g.beginPath();
        g.ellipse(tr.x + Math.cos(a) * rad, tr.y + Math.sin(a) * rad,
          tr.r * (0.16 + rng() * 0.1), tr.r * (0.12 + rng() * 0.08), a, 0, TAU);
        g.fill();
      }

      g.save();
      g.beginPath();
      g.arc(tr.x, tr.y, tr.r * 1.02, 0, TAU);
      g.clip();

      // Пиксельная листва
      for (let s = 0; s < 20; s++) {
        const n = rng();
        g.fillStyle = n < 0.42 ? l.base : (n < 0.74 ? l.light : l.dark);
        g.globalAlpha = 0.28 + rng() * 0.3;
        g.fillRect(tr.x + (rng() - 0.5) * tr.r * 2, tr.y + (rng() - 0.5) * tr.r * 2,
          3 + rng() * 6, 3 + rng() * 6);
      }
      g.globalAlpha = 1;

      // Порода
      if (species === 'spruce') {
        // Колючие лапы ели
        for (let k = 0; k < 11; k++) {
          const a = (k / 11) * TAU + 0.25;
          const inner = tr.r * 0.58;
          const outer = tr.r * (1.04 + rng() * 0.14);
          const wdt = 0.16 + rng() * 0.08;
          g.fillStyle = k % 2 === 0 ? rgba(l.base, 0.85) : rgba(l.light, 0.6);
          g.beginPath();
          g.moveTo(tr.x + Math.cos(a - wdt) * inner, tr.y + Math.sin(a - wdt) * inner);
          g.lineTo(tr.x + Math.cos(a) * outer, tr.y + Math.sin(a) * outer);
          g.lineTo(tr.x + Math.cos(a + wdt) * inner, tr.y + Math.sin(a + wdt) * inner);
          g.closePath();
          g.fill();
        }
        g.fillStyle = rgba(l.dark, 0.5);
        g.beginPath();
        g.arc(tr.x, tr.y, tr.r * 0.32, 0, TAU);
        g.fill();
      } else if (species === 'jungle') {
        g.strokeStyle = rgba(l.dark, 0.55);
        g.lineWidth = 2;
        for (let k = 0; k < 2; k++) {
          const x0 = tr.x - tr.r * 0.7 + rng() * tr.r * 1.4;
          g.beginPath();
          g.moveTo(x0, tr.y - tr.r);
          g.bezierCurveTo(x0 + 8, tr.y - tr.r * 0.3, x0 - 8, tr.y + tr.r * 0.3, x0 + 4, tr.y + tr.r);
          g.stroke();
        }
        for (let k = 0; k < 4; k++) {
          g.fillStyle = rgba(l.light, 0.5);
          g.beginPath();
          g.ellipse(tr.x + (rng() - 0.5) * tr.r, tr.y + (rng() - 0.5) * tr.r,
            tr.r * 0.2, tr.r * 0.1, rng() * TAU, 0, TAU);
          g.fill();
        }
      } else if (species === 'palm') {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU + 0.3;
          g.strokeStyle = k % 2 ? rgba(l.light, 0.9) : rgba(l.base, 0.95);
          g.lineWidth = Math.max(2, tr.r * 0.16);
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(tr.x, tr.y);
          g.quadraticCurveTo(
            tr.x + Math.cos(a) * tr.r * 0.7, tr.y + Math.sin(a) * tr.r * 0.7,
            tr.x + Math.cos(a + 0.12) * tr.r * 1.12, tr.y + Math.sin(a + 0.12) * tr.r * 1.12
          );
          g.stroke();
        }
      } else if (species === 'acacia') {
        g.strokeStyle = rgba(biome.log.bark, 0.8);
        g.lineWidth = Math.max(1.6, tr.r * 0.1);
        for (let k = 0; k < 2; k++) {
          const dir = k ? 1 : -1;
          g.beginPath();
          g.moveTo(tr.x, tr.y + tr.r * 0.15);
          g.quadraticCurveTo(tr.x + dir * tr.r * 0.4, tr.y, tr.x + dir * tr.r * 0.85, tr.y - tr.r * 0.2);
          g.stroke();
        }
      }

      // Снежная шапка
      if (biome.snow) {
        for (let k = 0; k < 14; k++) {
          g.fillStyle = 'rgba(255,255,255,' + (0.55 + rng() * 0.35).toFixed(2) + ')';
          g.fillRect(tr.x + (rng() - 0.5) * tr.r * 1.8, tr.y + (rng() - 0.5) * tr.r * 1.8,
            2 + rng() * 4, 2 + rng() * 3);
        }
        // Снег на кончиках лап
        if (species === 'spruce') {
          for (let k = 0; k < 11; k++) {
            const a = (k / 11) * TAU + 0.25;
            g.fillStyle = 'rgba(255,255,255,0.85)';
            g.fillRect(tr.x + Math.cos(a) * tr.r * 0.98, tr.y + Math.sin(a) * tr.r * 0.98, 3.4, 2.4);
          }
        }
      }
      g.restore();

      treeCore(g, tr.x, tr.y, tr.r, biome, species, rng);
    }
    g.restore();

    // Рваная кромка листвы
    leafFringe(g, w, h, l, rng);

    // Лёгкий объём кроны
    g.save();
    roundRect(g, -OV, -OV, w + OV * 2, h + OV * 2, clamp(thick * 0.35 + 6, 8, 18));
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(-OV, -OV, w + OV * 2, Math.min(9, h * 0.25));
    g.restore();
  }

  function paintDeadTree(g, w, h, biome, kind, rng) {
    const log = biome.log;
    g.fillStyle = '#241710';
    roundRect(g, 0, 0, w, h, 4);
    g.fill();
    g.save();
    roundRect(g, 1, 1, w - 2, h - 2, 4);
    g.clip();

    // Тёмная труха
    for (let i = 0; i < 22; i++) {
      g.fillStyle = rgba(log.dark, 0.25 + rng() * 0.3);
      g.fillRect(rng() * w, rng() * h, 3 + rng() * 9, 3 + rng() * 9);
    }

    // Толстые ветки
    const alongX = w >= h;
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = i === 0 ? log.bark : log.light;
      g.lineWidth = 3 + rng() * 4;
      g.lineCap = 'round';
      g.beginPath();
      if (alongX) {
        g.moveTo(-2, h * (0.2 + rng() * 0.6));
        g.quadraticCurveTo(w * 0.4, h * (0.1 + rng() * 0.8), w + 2, h * (0.2 + rng() * 0.6));
      } else {
        g.moveTo(w * (0.2 + rng() * 0.6), -2);
        g.quadraticCurveTo(w * (0.1 + rng() * 0.8), h * 0.4, w * (0.2 + rng() * 0.6), h + 2);
      }
      g.stroke();
    }
    // Тонкие сучья
    for (let i = 0; i < 12; i++) {
      g.strokeStyle = rgba(log.light, 0.55);
      g.lineWidth = 1 + rng() * 1.8;
      g.beginPath();
      const x = rng() * w, y = rng() * h;
      g.moveTo(x, y);
      g.lineTo(x + (rng() - 0.5) * 26, y + (rng() - 0.5) * 26);
      g.stroke();
    }

    if (kind === 'block') {
      // Поглотитель: багровые трещины и тлеющее ядро
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + rng();
        g.strokeStyle = 'rgba(255,59,92,' + (0.55 + rng() * 0.3) + ')';
        g.lineWidth = 1.4 + rng() * 1.4;
        g.beginPath();
        g.moveTo(w / 2, h / 2);
        let px = w / 2, py = h / 2;
        for (let k = 1; k <= 3; k++) {
          px += Math.cos(a + (rng() - 0.5) * 1.2) * (Math.min(w, h) / 5);
          py += Math.sin(a + (rng() - 0.5) * 1.2) * (Math.min(w, h) / 5);
          g.lineTo(clamp(px, 2, w - 2), clamp(py, 2, h - 2));
        }
        g.stroke();
      }
      const glow = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, Math.max(8, Math.min(w, h) * 0.6));
      glow.addColorStop(0, 'rgba(255,59,92,0.55)');
      glow.addColorStop(1, 'rgba(255,59,92,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
    } else {
      // Сухие листья на мёртвом дереве
      for (let i = 0; i < 4; i++) {
        g.fillStyle = rgba(biome.leaf.base, 0.45);
        g.beginPath();
        g.ellipse(rng() * w, rng() * h, 4 + rng() * 7, 3 + rng() * 5, rng() * 3, 0, TAU);
        g.fill();
      }
    }
    g.restore();
  }

  function paintCactus(g, w, h, biome, rng) {
    const l = biome.leaf;
    const alongX = w >= h;
    const len = Math.max(w, h);
    const thick = Math.min(w, h);
    const count = clamp(Math.round(len / 48), 1, 4);

    // Сегменты кактуса — округлые «подушки», а не прямоугольник
    for (let i = 0; i < count; i++) {
      const segLen = len / count + 3;
      const pos = i * (len / count) - 1.5;
      const x0 = alongX ? pos : 0;
      const y0 = alongX ? 0 : pos;
      const cw = alongX ? segLen : w;
      const ch = alongX ? h : segLen;
      const rad = Math.min(ch / 2, cw / 2, 13);

      g.fillStyle = l.dark;
      roundRect(g, x0 + 1, y0 + 1, cw - 2, ch - 2, rad);
      g.fill();
      g.fillStyle = mix(l.base, l.light, rng() * 0.28);
      roundRect(g, x0 + 3, y0 + 3, cw - 6, ch - 6, Math.max(2, rad - 2));
      g.fill();

      // Шов между сегментами
      if (i > 0) {
        g.strokeStyle = rgba(l.dark, 0.55);
        g.lineWidth = 1.6;
        g.beginPath();
        if (alongX) {
          g.moveTo(x0 + 2, y0 + 5);
          g.lineTo(x0 + 2, y0 + ch - 5);
        } else {
          g.moveTo(x0 + 5, y0 + 2);
          g.lineTo(x0 + cw - 5, y0 + 2);
        }
        g.stroke();
      }

      // Рёбра вдоль сегмента
      const ridges = clamp(Math.floor((alongX ? ch : cw) / 5), 2, 5);
      for (let k = 0; k < ridges; k++) {
        const t = (k + 1) / (ridges + 1);
        g.strokeStyle = k % 2 === 0 ? rgba(l.dark, 0.5) : rgba(l.light, 0.65);
        g.lineWidth = 1.4;
        g.beginPath();
        if (alongX) {
          g.moveTo(x0 + 5, y0 + t * ch);
          g.lineTo(x0 + cw - 5, y0 + t * ch);
        } else {
          g.moveTo(x0 + t * cw, y0 + 5);
          g.lineTo(x0 + t * cw, y0 + ch - 5);
        }
        g.stroke();

        // Колючки
        g.fillStyle = 'rgba(250,255,240,0.8)';
        for (let s = 7; s < (alongX ? cw : ch) - 6; s += 9) {
          const jitter = (rng() - 0.5) * 2;
          if (alongX) g.fillRect(x0 + s + jitter, y0 + t * ch - 1, 1.5, 1.5);
          else g.fillRect(x0 + t * cw - 1, y0 + s + jitter, 1.5, 1.5);
        }
      }

      // Свет сверху-слева
      g.save();
      roundRect(g, x0 + 3, y0 + 3, cw - 6, ch - 6, Math.max(2, rad - 2));
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(x0 + 3, y0 + 3, cw - 6, Math.max(2, ch * 0.22));
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(x0 + 3, y0 + ch - Math.max(2, ch * 0.16) - 3, cw - 6, Math.max(2, ch * 0.16));
      g.restore();
    }

    // Один цветок на кактусе
    if (thick > 22 && count <= 2 && rng() < 0.65) {
      const fx = alongX ? w * 0.5 : w * 0.5;
      const fy = alongX ? h * 0.5 : h * 0.5;
      g.fillStyle = '#FF8FB1';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        g.beginPath();
        g.arc(fx + Math.cos(a) * 3.2, fy + Math.sin(a) * 3.2, 2.4, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#FFE066';
      g.beginPath(); g.arc(fx, fy, 1.8, 0, TAU); g.fill();
    }
  }



  function paintIce(g, w, h, biome, rng) {
    g.fillStyle = 'rgba(150,233,255,0.62)';
    roundRect(g, 0, 0, w, h, 3);
    g.fill();

    const cell = 12;
    for (let y = 1; y < h - 1; y += cell) {
      for (let x = 1; x < w - 1; x += cell) {
        g.fillStyle = rng() < 0.5 ? 'rgba(220,250,255,0.30)' : 'rgba(78,178,208,0.28)';
        g.fillRect(x, y, Math.min(cell - 1, w - x - 1), Math.min(cell - 1, h - y - 1));
      }
    }

    // Морозные трещины
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(rng() * w, 0);
      g.lineTo(rng() * w, h * 0.4);
      g.lineTo(rng() * w, h);
      g.stroke();
    }
    // Блик
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillRect(3, 2, Math.max(2, w * 0.4), 2);
    g.fillRect(2, 3, 2, Math.max(2, h * 0.35));
  }

  function paintGate(g, w, h, biome, rng) {
    const log = biome.log;
    const alongX = w >= h;
    g.fillStyle = log.bark;
    roundRect(g, 0, 0, w, h, 3);
    g.fill();
    const step = 10;
    const len = alongX ? w : h;
    for (let i = 0; i < len; i += step) {
      g.fillStyle = rng() < 0.5 ? log.light : log.dark;
      g.globalAlpha = 0.65;
      if (alongX) g.fillRect(i, 1, step - 2, h - 2);
      else g.fillRect(1, i, w - 2, step - 2);
    }
    g.globalAlpha = 1;

    // Светящаяся рамка и руна
    g.strokeStyle = 'rgba(56,232,255,0.95)';
    g.lineWidth = 2;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
    const cx = w / 2, cy = h / 2;
    const r = clamp(Math.min(w, h) * 0.22, 2.5, 7);
    g.fillStyle = 'rgba(56,232,255,0.8)';
    g.beginPath();
    g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(235,255,255,0.9)';
    g.lineWidth = 1;
    g.stroke();
  }

  function paintKind(g, w, h, kind, biome, rng) {
    const l = biome.leaf;
    let outline = rgba(l.edge, 0.7);
    let width = 1.5;

    if (kind === 'bouncy') {
      // Оранжевая подсветка + шевроны ускорения
      g.fillStyle = 'rgba(255,122,42,0.16)';
      roundRect(g, 1, 1, w - 2, h - 2, 5);
      g.fill();
      const alongX = w >= h;
      const len = Math.max(w, h);
      const n = clamp(Math.floor(len / 70), 1, 3);
      const ang = alongX ? 0 : Math.PI / 2;
      g.strokeStyle = 'rgba(255,140,60,0.95)';
      g.lineWidth = 2.4;
      g.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / (n + 1);
        const cx = alongX ? t * w : w / 2;
        const cy = alongX ? h / 2 : t * h;
        g.save();
        g.translate(cx, cy);
        g.rotate(ang);
        g.beginPath();
        g.moveTo(-4, -6); g.lineTo(3, 0); g.lineTo(-4, 6);
        g.stroke();
        g.restore();
      }
      outline = 'rgba(255,122,42,0.95)';
      width = 2.5;
    } else if (kind === 'soft') {
      // Бледная листва и пунктир — «вязкая» поверхность
      g.fillStyle = 'rgba(210,220,255,0.16)';
      roundRect(g, 1, 1, w - 2, h - 2, 5);
      g.fill();
      g.setLineDash([7, 6]);
      g.strokeStyle = 'rgba(206,216,255,0.9)';
      g.lineWidth = 2;
      roundRect(g, 1, 1, w - 2, h - 2, 5);
      g.stroke();
      g.setLineDash([]);
      outline = null;
    } else if (kind === 'block') {
      outline = 'rgba(255,59,92,0.95)';
      width = 2.5;
    } else if (kind === 'glass') {
      outline = 'rgba(200,250,255,0.95)';
    } else if (kind === 'door') {
      outline = 'rgba(56,232,255,0.95)';
    }

    if (outline) {
      g.strokeStyle = outline;
      g.lineWidth = width;
      if (kind === 'mirror' || kind === 'mover') {
        g.setLineDash([5, 5]);
        g.lineWidth = 1;
      }
      roundRect(g, 1, 1, w - 2, h - 2, 4);
      g.stroke();
      g.setLineDash([]);
    }
  }

  function paintTree(g, w, h, biome, kind, wallId) {
    const species = speciesFor(kind, biome);
    const rng = mulberry32(hash(String(wallId) + ':' + biome.id + ':' + kind + ':' +
      Math.round(w) + 'x' + Math.round(h)));

    // Тень дерева на траве (для кроны тень рисуется по каждому дереву)
    g.save();
    g.globalAlpha = 0.24;
    g.fillStyle = '#08120A';
    if (species === 'ice' || species === 'gate' || species === 'dead' || species === 'cactus') {
      roundRect(g, 4, 6, w, h, 6);
      g.fill();
    }
    g.restore();

    if (species === 'ice') {
      paintIce(g, w, h, biome, rng);
    } else if (species === 'gate') {
      paintGate(g, w, h, biome, rng);
    } else if (species === 'cactus') {
      paintCactus(g, w, h, biome, rng);
    } else if (species === 'dead') {
      paintDeadTree(g, w, h, biome, kind, rng);
    } else {
      // Блики/ускорители перекрашивают крону, порода остаётся узнаваемой
      const skin = Object.assign({}, biome, { leaf: leafSkin(biome, kind) });
      paintCanopy(g, w, h, skin, species, kind, rng);
    }

    paintKind(g, w, h, kind, biome, rng);
  }

  const treeCache = new Map();

  function treeSprite(wall, biome) {
    const kind = wall.type || 'mirror';
    const w = Math.max(1, Math.round(wall.w));
    const h = Math.max(1, Math.round(wall.h));
    const key = biome.id + '|' + kind + '|' + w + 'x' + h + '|' + (wall.id || '');
    const hit = treeCache.get(key);
    if (hit) return hit;

    const canvas = createSurface(w + PAD * 2, h + PAD * 2);
    const g = canvas.getContext('2d');
    if (g) {
      g.translate(PAD, PAD);
      paintTree(g, w, h, biome, kind, wall.id || (w + 'x' + h));
    }
    const sprite = { canvas: canvas, pad: PAD, w: w, h: h, kind: kind };
    if (treeCache.size >= TREE_CACHE_LIMIT) {
      const oldest = treeCache.keys().next().value;
      if (oldest) treeCache.delete(oldest);
    }
    treeCache.set(key, sprite);
    return sprite;
  }

  function drawWalls(ctx, level, state, timeSec, biome) {
    if (!level) return;
    const t = state ? state.t : 0;
    const rectFn = (global.OB && global.OB.wallRect) ? global.OB.wallRect : function (w) { return w; };
    const walls = level.walls || [];

    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];

      // Рамку арены рисует пол (земляной остров), а не деревья
      if (w.id === 'bT' || w.id === 'bB' || w.id === 'bL' || w.id === 'bR') continue;

      const rect = rectFn(w, t);

      // Разбитое стекло: осколки и пустое место
      if (state && state.brokenWalls.indexOf(w.id) !== -1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(180,240,255,0.28)';
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
        ctx.setLineDash([]);
        const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
        ctx.strokeStyle = 'rgba(198,245,255,0.65)';
        ctx.lineWidth = 2;
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * TAU + 0.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10);
          ctx.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }

      // Открытая дверь — только светящийся контур
      if (w.type === 'door') {
        let open = false;
        if (state) {
          for (let k = 0; k < state.doors.length; k++) {
            if (state.doors[k].def.id === w.id && state.doors[k].open) open = true;
          }
        }
        if (open) {
          ctx.save();
          ctx.strokeStyle = 'rgba(56,232,255,0.3)';
          ctx.setLineDash([5, 8]);
          ctx.lineWidth = 1.5;
          ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
          ctx.restore();
          continue;
        }
      }

      // Движущаяся стена: пунктир хода
      if (w.type === 'mover' && w.amp) {
        ctx.save();
        ctx.strokeStyle = 'rgba(24,40,24,0.25)';
        ctx.setLineDash([4, 7]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        if (w.axis === 'x') {
          ctx.moveTo(w.x - w.amp + w.w / 2, w.y + w.h / 2);
          ctx.lineTo(w.x + w.amp + w.w / 2, w.y + w.h / 2);
        } else {
          ctx.moveTo(w.x + w.w / 2, w.y - w.amp + w.h / 2);
          ctx.lineTo(w.x + w.w / 2, w.y + w.amp + w.h / 2);
        }
        ctx.stroke();
        ctx.restore();
      }

      const sprite = treeSprite(w, biome);
      const sway = w.type === 'mover' ? 0 : Math.sin(timeSec * 0.9 + (hash(w.id) % 10)) * 0.7;
      ctx.drawImage(sprite.canvas,
        Math.round(rect.x - PAD + sway), Math.round(rect.y - PAD));
    }
  }

  // =========================================================
  // Стикмены: игрок и враги, пистолет, анимация шага
  // =========================================================
  function drawPistol(g, s, ink, flash) {
    g.fillStyle = ink;
    // затвор и ствол
    g.fillRect(2 * s, -3.4 * s, 13 * s, 4.6 * s);
    g.fillRect(13 * s, -2.6 * s, 3.2 * s, 3.4 * s);
    // рукоять
    g.beginPath();
    g.moveTo(3.2 * s, -1.2 * s);
    g.lineTo(8.2 * s, -1.2 * s);
    g.lineTo(6.6 * s, 8 * s);
    g.lineTo(3.4 * s, 8 * s);
    g.closePath();
    g.fill();
    // скоба
    g.strokeStyle = ink;
    g.lineWidth = 1.3 * s;
    g.beginPath();
    g.arc(7 * s, 1.6 * s, 2.6 * s, 0, Math.PI);
    g.stroke();
    // блик на затворе
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(3.2 * s, -3 * s, 10 * s, 1.2 * s);

    if (flash > 0.02) {
      const fx = 18 * s;
      const r = (4 + flash * 7) * s;
      g.fillStyle = 'rgba(255,214,120,' + (0.9 * flash).toFixed(2) + ')';
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const rr = i % 2 === 0 ? r : r * 0.36;
        const px = fx + Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,' + (0.85 * flash).toFixed(2) + ')';
      g.beginPath();
      g.arc(fx, 0, 2.2 * s * (0.4 + flash), 0, TAU);
      g.fill();
    }
  }

  function stickmanScale(r) {
    return clamp((r || 18) / 23.5, 0.62, 1.05);
  }

  /**
   * Рисует стикмена с большим белым лицом, тонкими руками-ногами,
   * коричневыми ботинками и пистолетом. Координаты — центр фигуры.
   */
  function drawStickman(g, o) {
    const s = o.scale || 1;
    const ink = o.ink || '#14161C';
    const inkSoft = o.inkSoft || ink;
    const head = o.head || '#F8FAFD';
    const shoes = o.shoes || '#7A4A24';
    const walk = o.walk || 0;
    const swing = Math.sin(walk) * (o.walking ? 1 : 0.18);
    const face = o.face === -1 ? -1 : 1;

    g.save();
    g.translate(o.x, o.y);
    if (o.alpha != null) g.globalAlpha = o.alpha;

    // Тень на земле
    g.fillStyle = 'rgba(8, 18, 10, 0.24)';
    g.beginPath();
    g.ellipse(1.5 * s, 20.5 * s, 11 * s, 4 * s, 0, 0, TAU);
    g.fill();

    g.strokeStyle = ink;
    g.lineWidth = 2.7 * s;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // Ноги
    for (let side = -1; side <= 1; side += 2) {
      const footX = side * 6.4 * s + swing * 3.1 * s;
      const footY = 18.2 * s;
      const kneeX = footX * 0.55 + side * 1.2 * s;
      const kneeY = 10.8 * s;
      g.strokeStyle = ink;
      g.lineWidth = 2.7 * s;
      g.beginPath();
      g.moveTo(0, 3 * s);
      g.lineTo(kneeX, kneeY);
      g.lineTo(footX, footY);
      g.stroke();

      // Ботинок
      g.fillStyle = shoes;
      g.beginPath();
      g.ellipse(footX + side * 1.5 * s, footY + 1.7 * s, 4.8 * s, 2.7 * s, side * 0.12, 0, TAU);
      g.fill();
      g.strokeStyle = shade(shoes, -0.35);
      g.lineWidth = 1.1 * s;
      g.beginPath();
      g.ellipse(footX + side * 1.5 * s, footY + 2.9 * s, 4.2 * s, 1.1 * s, 0, 0, TAU);
      g.stroke();
    }

    // Туловище
    g.strokeStyle = ink;
    g.lineWidth = 2.7 * s;
    g.beginPath();
    g.moveTo(0, -12 * s);
    g.lineTo(0, 3.2 * s);
    g.stroke();

    // Свободная рука
    g.strokeStyle = inkSoft;
    g.lineWidth = 2.4 * s;
    g.beginPath();
    g.moveTo(0, -8.6 * s);
    g.quadraticCurveTo(-5.4 * s, -4 * s, -7.6 * s - swing * 2.6 * s, 1.4 * s + swing * 2.4 * s);
    g.stroke();
    g.fillStyle = inkSoft;
    g.beginPath();
    g.arc(-7.6 * s - swing * 2.6 * s, 1.4 * s + swing * 2.4 * s, 1.9 * s, 0, TAU);
    g.fill();




    // Голова
    g.fillStyle = head;
    g.strokeStyle = ink;
    g.lineWidth = 2.8 * s;
    g.beginPath();
    g.arc(0, -23.2 * s, 10 * s, 0, TAU);
    g.fill();
    g.stroke();

    // Каракули-волосы, как у стикмена с картинки
    g.strokeStyle = ink;
    g.lineWidth = 1.7 * s;
    g.beginPath();
    g.arc(face * -3.2 * s, -31 * s, 4.1 * s, Math.PI * 1.03, Math.PI * 1.6);
    g.stroke();
    g.beginPath();
    g.arc(face * -0.4 * s, -33.2 * s, 4.5 * s, Math.PI * 1.08, Math.PI * 1.72);
    g.stroke();
    g.beginPath();
    g.arc(face * 3.4 * s, -31.4 * s, 3.6 * s, Math.PI * 1.2, Math.PI * 1.8);
    g.stroke();

    if (o.enemy) {
      // Красная бандана и злые глаза
      g.fillStyle = 'rgba(232,42,70,0.95)';
      roundRect(g, -9.4 * s, -31.6 * s, 18.8 * s, 3.8 * s, 1.6 * s);
      g.fill();
      g.fillStyle = '#E82A46';
      g.beginPath();
      g.moveTo(8.4 * s, -30.4 * s);
      g.lineTo(13.2 * s, -27.4 * s);
      g.lineTo(9 * s, -26.6 * s);
      g.closePath();
      g.fill();

      g.fillStyle = '#B3122E';
      g.beginPath(); g.arc(-3.4 * s, -23.6 * s, 1.6 * s, 0, TAU); g.fill();
      g.beginPath(); g.arc(3.4 * s, -23.6 * s, 1.6 * s, 0, TAU); g.fill();
      g.strokeStyle = ink;
      g.lineWidth = 1.5 * s;
      g.beginPath();
      g.moveTo(-5.6 * s, -27 * s); g.lineTo(-1.6 * s, -25.6 * s);
      g.moveTo(5.6 * s, -27 * s); g.lineTo(1.6 * s, -25.6 * s);
      g.stroke();
    } else {
      // Спокойное лицо героя
      g.strokeStyle = 'rgba(20,22,28,0.55)';
      g.lineWidth = 1.3 * s;
      g.beginPath();
      g.arc(0, -19.6 * s, 2.4 * s, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    }

    // Рука с пистолетом, направленная по прицелу
    const aim = o.aim || 0;
    const shoulderX = 1.4 * s * face;
    const shoulderY = -9 * s;
    const handX = shoulderX + Math.cos(aim) * 12.5 * s;
    const handY = shoulderY + Math.sin(aim) * 12.5 * s;

    g.strokeStyle = ink;
    g.lineWidth = 2.5 * s;
    g.beginPath();
    g.moveTo(shoulderX, shoulderY);
    g.lineTo(handX, handY);
    g.stroke();
    g.fillStyle = ink;
    g.beginPath();
    g.arc(handX, handY, 2.1 * s, 0, TAU);
    g.fill();

    g.save();
    g.translate(handX, handY);
    g.rotate(aim);
    if (Math.cos(aim) < 0) g.scale(1, -1);
    drawPistol(g, s, ink, o.flash || 0);
    g.restore();

    g.restore();
  }

  // =========================================================
  // Игрок и враги
  // =========================================================
  function drawPlayer(ctx, level, aim, timeSec, opts) {
    if (!level || !level.player) return;
    opts = opts || {};
    const p = level.player;
    const s = stickmanScale(p.r || 17);
    const accent = '#7CF3FF';

    if (opts.aiming !== false) {
      const pulse = 1 + Math.sin(timeSec * 2.4) * 0.07;
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 13 * s, 24, 9, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (p.r + 9) * pulse, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    drawStickman(ctx, {
      x: p.x, y: p.y, scale: s, aim: aim,
      ink: '#12151C', head: '#FBFCFE', shoes: '#8C5527',
      face: Math.cos(aim) >= 0 ? 1 : -1,
      walking: false, walk: 0, flash: opts.recoil || 0
    });
  }

  function drawEnemy(ctx, def, x, y, r, timeSec, opts) {
    opts = opts || {};
    const b = opts.biome || (Biomes ? Biomes.byId('plains') : null);
    const s = stickmanScale(r || 18);
    const alive = opts.alive !== false;
    const player = opts.player || { x: x + 200, y: y };
    const aimToPlayer = Math.atan2(player.y - y, player.x - x);

    if (!alive) {
      const age = opts.age != null
        ? Math.max(0, opts.age)
        : Math.max(0, timeSec - (opts.hitT || 0));
      if (age > 1.5) return;
      const alpha = Math.max(0, 1 - age / 1.5);
      // лужица чернил
      ctx.save();
      ctx.globalAlpha = alpha * 0.55;
      ctx.fillStyle = '#3A0A16';
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 18 + age * 12, 7 + age * 5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();

      const dir = (opts.index || 0) % 2 === 0 ? 1 : -1;
      const ang = dir * Math.min(1.35, age * 5);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      drawStickman(ctx, {
        x: 0, y: 0, scale: s, aim: aimToPlayer,
        ink: '#1A0A0F', head: '#EFDDE1', shoes: '#3A1C1C',
        enemy: true, alpha: alpha, flash: 0, face: 1
      });
      ctx.restore();
      return;
    }

    // Маршрут патруля/орбиты
    if (def.move && def.move.type === 'patrol') {
      const m = def.move;
      ctx.save();
      ctx.strokeStyle = 'rgba(120,20,36,0.22)';
      ctx.setLineDash([3, 7]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(def.x - (m.ax === 'x' ? m.amp : 0), def.y - (m.ax === 'y' ? m.amp : 0));
      ctx.lineTo(def.x + (m.ax === 'x' ? m.amp : 0), def.y + (m.ax === 'y' ? m.amp : 0));
      ctx.stroke();
      ctx.restore();
    } else if (def.move && def.move.type === 'orbit') {
      const m = def.move;
      ctx.save();
      ctx.strokeStyle = 'rgba(120,20,36,0.18)';
      ctx.setLineDash([3, 8]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(m.cx, m.cy, m.r, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // Красное свечение и пунктир радиуса попадания
    ctx.save();
    const pulse = 1 + Math.sin(timeSec * 3 + (opts.index || 0)) * 0.06;
    const glow = ctx.createRadialGradient(x, y, 1, x, y, r * 2.1 * pulse);
    glow.addColorStop(0, 'rgba(255,59,92,0.28)');
    glow.addColorStop(1, 'rgba(255,59,92,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.1 * pulse, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,59,92,0.30)';
    ctx.setLineDash([2, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.restore();

    const moving = !!(def.move && def.move.type !== 'static');
    const walk = timeSec * 5.2 + (opts.index || 0) * 1.9;
    const shoe = b && b.id === 'snowy' ? '#4A3A3A' : '#3A1C1C';

    drawStickman(ctx, {
      x: x, y: y, scale: s, aim: aimToPlayer,
      ink: '#1A0A0F', head: '#F4E4E7', shoes: shoe,
      enemy: true, walking: moving, walk: walk,
      face: Math.cos(aimToPlayer) >= 0 ? 1 : -1,
      flash: 0
    });
  }

  // =========================================================
  // Погода биома (поверх арены, не перекрывает механику)
  // =========================================================
  function drawWeather(ctx, biome, timeSec, opts) {
    if (!biome || !biome.weather) return;
    const width = (opts && opts.width) || W;
    const height = (opts && opts.height) || H;
    const reduced = !!(opts && opts.reduced);
    const type = biome.weather.type;
    const color = biome.weather.color || '#FFFFFF';
    const rate = biome.weather.rate || 0.4;
    const count = Math.max(6, Math.round((reduced ? 34 : 92) * rate));

    ctx.save();
    for (let i = 0; i < count; i++) {
      const rng = mulberry32(hash(biome.id + ':' + type + ':' + i));
      const r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng();

      if (type === 'snow') {
        const x = ((r1 * width + Math.sin(timeSec * 0.7 + i) * 16 + timeSec * 11) % width + width) % width;
        const y = ((r2 * height + timeSec * (16 + r3 * 26)) % height + height) % height;
        ctx.globalAlpha = 0.35 + r4 * 0.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 0.9 + r4 * 1.9, 0, TAU);
        ctx.fill();
      } else if (type === 'rain') {
        const x = ((r1 * (width + 160) + timeSec * 42) % (width + 160)) - 80;
        const y = ((r2 * height + timeSec * (420 + r3 * 260)) % (height + 120)) - 60;
        ctx.globalAlpha = 0.25 + r4 * 0.18;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5, y + 13);
        ctx.stroke();
      } else if (type === 'leaf') {
        const x = ((r1 * width + Math.sin(timeSec * 0.8 + i) * 26) % width + width) % width;
        const y = ((r2 * height + timeSec * (22 + r3 * 26)) % height + height) % height;
        const a = timeSec * (0.8 + r3) + i;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.globalAlpha = 0.55 + r4 * 0.3;
        ctx.fillStyle = r4 > 0.5 ? biome.leaf.light : biome.leaf.base;
        ctx.fillRect(-2.4, -1.6, 4.8, 3.2);
        ctx.restore();
      } else if (type === 'spore') {
        const x = ((r1 * width + Math.sin(timeSec * 0.5 + i * 1.3) * 24) % width + width) % width;
        const y = ((r2 * height + Math.cos(timeSec * 0.62 + i) * 18) % height + height) % height;
        const a = 0.28 + (Math.sin(timeSec * 2 + i) * 0.5 + 0.5) * 0.42;
        ctx.globalAlpha = a * 0.25;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, 4.4, 0, TAU); ctx.fill();
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(x, y, 1.4, 0, TAU); ctx.fill();
      } else if (type === 'dust') {
        const x = ((r1 * width + timeSec * (46 + r3 * 62)) % width + width) % width;
        const y = ((r2 * height + Math.sin(timeSec * 0.9 + i) * 7) % height + height) % height;
        ctx.globalAlpha = 0.16 + r4 * 0.22;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 2.6, 1.3);
      } else {
        // pollen
        const x = ((r1 * width + Math.sin(timeSec * 0.45 + i) * 18 + timeSec * 7) % width + width) % width;
        const y = ((r2 * height + Math.cos(timeSec * 0.55 + i * 0.8) * 12) % height + height) % height;
        ctx.globalAlpha = 0.25 + r4 * 0.35;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 1 + r4 * 1.4, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function clearCache() {
    treeCache.clear();
  }

  const Art = {
    W: W, H: H, PAD: PAD,
    buildFloor: buildFloor,
    treeSprite: treeSprite,
    drawWalls: drawWalls,
    drawPlayer: drawPlayer,
    drawEnemy: drawEnemy,
    drawStickman: drawStickman,
    drawWeather: drawWeather,
    speciesFor: speciesFor,
    stickmanScale: stickmanScale,
    clearCache: clearCache,
    color: rgba,
    mix: mix,
    shade: shade,
    hash: hash
  };

  global.Art = Art;
  if (typeof module !== 'undefined' && module.exports) module.exports = Art;
})(typeof window !== 'undefined' ? window : globalThis);
