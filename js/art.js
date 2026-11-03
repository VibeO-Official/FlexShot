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
  const Enemies = global.Enemies || (typeof require === 'function' ? require('./enemies.js') : null);
  const TAU = Math.PI * 2;
  const W = 1280, H = 720;
  const PAD = 18;                 // запас спрайта дерева под крону, тень и листву
  const TREE_CACHE_LIMIT = 160;

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

  function drawPetal(g, x, y, color, rng) {
    g.save();
    g.translate(x, y);
    g.rotate(rng() * TAU);
    g.fillStyle = color;
    g.globalAlpha = 0.55 + rng() * 0.4;
    g.beginPath();
    g.ellipse(0, 0, 2.2 + rng() * 1.8, 1.1 + rng() * 1.1, 0, 0, TAU);
    g.fill();
    g.restore();
  }

  function drawCrystal(g, x, y, color, rng) {
    const h = 5 + rng() * 8;
    const w = 2 + rng() * 2.5;
    g.save();
    g.translate(x, y);
    g.rotate((rng() - 0.5) * 0.7);
    g.fillStyle = rgba(color, 0.85);
    g.beginPath();
    g.moveTo(-w, 1);
    g.lineTo(0, -h);
    g.lineTo(w, 1);
    g.lineTo(0, 3);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.moveTo(-w * 0.25, 0);
    g.lineTo(0, -h * 0.8);
    g.lineTo(w * 0.15, -h * 0.1);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawBambooShoot(g, x, y, biome, rng) {
    const h = 8 + rng() * 13;
    const l = biome.leaf;
    g.strokeStyle = l.base;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rng() - 0.5) * 3, y - h);
    g.stroke();
    g.strokeStyle = rgba(biome.log.bark, 0.8);
    g.lineWidth = 0.9;
    for (let k = 1; k < 3; k++) {
      const yy = y - h * (k / 3);
      g.beginPath(); g.moveTo(x - 1.6, yy); g.lineTo(x + 1.6, yy); g.stroke();
    }
    g.fillStyle = rgba(l.light, 0.85);
    g.beginPath();
    g.ellipse(x + 3, y - h * 0.65, 4, 1.2, 0.5, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(x - 3, y - h * 0.4, 3.4, 1.1, -0.5, 0, TAU);
    g.fill();
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
    // Лепестки сакуры
    if (biome.petals) {
      for (let i = 0; i < 90; i++) {
        g.fillStyle = rgba(i % 3 === 0 ? '#FFFFFF' : biome.leaf.light, 0.35 + rng() * 0.4);
        g.save();
        g.translate(left + rng() * width, top + rng() * height);
        g.rotate(rng() * TAU);
        g.fillRect(-2, -1, 4, 2);
        g.restore();
      }
      for (let i = 0; i < 12; i++) {
        g.fillStyle = 'rgba(255, 190, 215, 0.10)';
        g.beginPath();
        g.ellipse(left + rng() * width, top + rng() * height, 30 + rng() * 70, 16 + rng() * 34, 0, 0, TAU);
        g.fill();
      }
    }

    // Мицелий грибного острова
    if (biome.mycelium) {
      for (let i = 0; i < 22; i++) {
        g.fillStyle = rgba(biome.leaf.light, 0.10 + rng() * 0.12);
        g.beginPath();
        g.ellipse(left + rng() * width, top + rng() * height, 20 + rng() * 55, 12 + rng() * 30, 0, 0, TAU);
        g.fill();
      }
      for (let i = 0; i < 24; i++) {
        g.fillStyle = 'rgba(210, 180, 255, 0.35)';
        g.fillRect(left + rng() * width, top + rng() * height, 1.4, 1.4);
      }
    }

    // Пепел и тлеющие искры Багрового леса
    if (biome.ash) {
      for (let i = 0; i < 26; i++) {
        g.fillStyle = 'rgba(30, 8, 8, 0.22)';
        g.beginPath();
        g.ellipse(left + rng() * width, top + rng() * height, 20 + rng() * 60, 12 + rng() * 34, 0, 0, TAU);
        g.fill();
      }
      for (let i = 0; i < 26; i++) {
        g.fillStyle = rgba(biome.flower[0], 0.5);
        g.fillRect(left + rng() * width, top + rng() * height, 2, 2);
      }
    }

    // Фиолетовые блики Искажения/Энда
    if (biome.void) {
      for (let i = 0; i < 34; i++) {
        g.fillStyle = rgba(i % 2 ? biome.leaf.light : '#8A7CFF', 0.25 + rng() * 0.3);
        g.fillRect(left + rng() * width, top + rng() * height, 1 + rng() * 2.4, 1 + rng() * 2.4);
      }
      for (let i = 0; i < 10; i++) {
        g.fillStyle = rgba(biome.leaf.accent || '#E8C8FF', 0.18);
        g.beginPath();
        g.ellipse(left + rng() * width, top + rng() * height, 12 + rng() * 30, 8 + rng() * 20, 0, 0, TAU);
        g.fill();
      }
    }

    // Галька каменистого берега
    if (biome.stony) {
      for (let i = 0; i < 80; i++) {
        g.fillStyle = rgba(i % 2 ? biome.soil.light : biome.soil.dark, 0.4);
        g.beginPath();
        g.ellipse(left + rng() * width, top + rng() * height, 2 + rng() * 5, 1.4 + rng() * 3.2, 0, 0, TAU);
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

    // Лепестки сакуры
    const petals = Math.round(area / 9000 * (d.petal || 0));
    for (let i = 0; i < petals; i++) {
      const p = spot(4);
      if (!p) continue;
      drawPetal(g, p.x, p.y,
        biome.flower[Math.floor(rng() * biome.flower.length)] || '#FFC1D8', rng);
    }

    // Кристаллы
    const crystals = Math.round(area / 52000 * (d.crystal || 0));
    for (let i = 0; i < crystals; i++) {
      const p = spot(8);
      if (p) drawCrystal(g, p.x, p.y, biome.leaf.light, rng);
    }

    // Молодой бамбук
    const shoots = Math.round(area / 38000 * (d.bamboo || 0));
    for (let i = 0; i < shoots; i++) {
      const p = spot(8);
      if (p) drawBambooShoot(g, p.x, p.y, biome, rng);
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
      } else if (species === 'cherry') {
        // Розовые соцветия
        for (let k = 0; k < 18; k++) {
          const a = rng() * TAU, d = rng() * tr.r * 0.88;
          const bx = tr.x + Math.cos(a) * d;
          const by = tr.y + Math.sin(a) * d;
          g.fillStyle = k % 4 === 0 ? 'rgba(255,240,246,0.9)' : rgba(l.light, 0.9);
          g.beginPath();
          g.arc(bx, by, 1.6 + rng() * 2.2, 0, TAU);
          g.fill();
          if (k % 2 === 0) {
            g.fillStyle = rgba(l.base, 0.8);
            g.beginPath(); g.arc(bx + 2.2, by + 1.2, 1.1, 0, TAU); g.fill();
          }
        }
      } else if (species === 'crimson') {
        // Багровые усики и тлеющие искры
        g.strokeStyle = rgba(l.dark, 0.8);
        g.lineWidth = 1.6;
        for (let k = 0; k < 3; k++) {
          const x0 = tr.x + (rng() - 0.5) * tr.r;
          g.beginPath();
          g.moveTo(x0, tr.y - tr.r * 0.8);
          g.bezierCurveTo(x0 + 10, tr.y - tr.r * 0.2, x0 - 10, tr.y + tr.r * 0.2, x0 + 4, tr.y + tr.r * 0.85);
          g.stroke();
        }
        for (let k = 0; k < 7; k++) {
          g.fillStyle = rgba(l.accent || '#FF9F43', 0.85);
          g.fillRect(tr.x + (rng() - 0.5) * tr.r * 1.7, tr.y + (rng() - 0.5) * tr.r * 1.7, 2, 2);
        }
      } else if (species === 'warped') {
        // Бирюзовые усики и свечение
        g.strokeStyle = rgba(l.light, 0.55);
        g.lineWidth = 1.6;
        for (let k = 0; k < 3; k++) {
          const x0 = tr.x + (rng() - 0.5) * tr.r;
          g.beginPath();
          g.moveTo(x0, tr.y - tr.r * 0.8);
          g.bezierCurveTo(x0 + 10, tr.y - tr.r * 0.2, x0 - 10, tr.y + tr.r * 0.2, x0 + 4, tr.y + tr.r * 0.85);
          g.stroke();
        }
        for (let k = 0; k < 8; k++) {
          g.fillStyle = rgba(l.accent || '#8A7CFF', 0.8);
          g.beginPath();
          g.arc(tr.x + (rng() - 0.5) * tr.r * 1.7, tr.y + (rng() - 0.5) * tr.r * 1.7, 1 + rng() * 1.4, 0, TAU);
          g.fill();
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
      // Сухие листья на мёртвом дереве — отличают обычную стену от поглотителя
      for (let i = 0; i < 8; i++) {
        g.fillStyle = rng() < 0.35
          ? rgba(biome.flower[0] || '#FFB347', 0.4)
          : rgba(biome.leaf.light, 0.5);
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



  function paintMushroom(g, w, h, biome, rng) {
    const l = biome.leaf;
    const log = biome.log;
    const alongX = w >= h;
    const len = Math.max(w, h);
    const count = clamp(Math.round(len / 56), 1, 4);
    const OV = 6;

    for (let i = 0; i < count; i++) {
      const cx = alongX ? (i + 0.5) / count * w : w / 2;
      const cy = alongX ? h / 2 : (i + 0.5) / count * h;
      const r = clamp(Math.min(w, h) * 0.68 + 5, 12, 32);

      // Тень гриба
      g.fillStyle = 'rgba(10,8,16,0.2)';
      g.beginPath();
      g.ellipse(cx + 3, cy + 4, r * 1.05, r * 0.72, 0, 0, TAU);
      g.fill();

      g.save();
      g.beginPath();
      g.arc(cx, cy, r, 0, TAU);
      g.clip();

      // Шляпка
      const grad = g.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 1, cx, cy, r);
      grad.addColorStop(0, l.light);
      grad.addColorStop(0.6, l.base);
      grad.addColorStop(1, l.dark);
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(cx, cy, r, r * 0.9, 0, 0, TAU);
      g.fill();

      // Пятнышки
      for (let k = 0; k < 9; k++) {
        const a = rng() * TAU, d = rng() * r * 0.72;
        g.fillStyle = 'rgba(250,244,228,' + (0.55 + rng() * 0.35).toFixed(2) + ')';
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d,
          1.6 + rng() * 2.6, 1.3 + rng() * 2, rng() * 3, 0, TAU);
        g.fill();
      }

      // Пластинки и пенёк
      g.fillStyle = rgba(log.light, 0.9);
      g.beginPath();
      g.ellipse(cx, cy + r * 0.12, r * 0.3, r * 0.24, 0, 0, TAU);
      g.fill();
      g.strokeStyle = rgba(log.ringDark, 0.8);
      g.lineWidth = 1;
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r * 0.08, cy + r * 0.12 + Math.sin(a) * r * 0.06);
        g.lineTo(cx + Math.cos(a) * r * 0.27, cy + r * 0.12 + Math.sin(a) * r * 0.21);
        g.stroke();
      }

      g.restore();

      // Тёмная кромка шляпки
      g.strokeStyle = rgba(l.edge, 0.9);
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, r - 1, 0, TAU);
      g.stroke();
    }

    // Трава/мицелий вокруг грибницы
    g.save();
    roundRect(g, -OV, -OV, w + OV * 2, h + OV * 2, 8);
    g.clip();
    for (let k = 0; k < 10; k++) {
      g.fillStyle = rgba(l.dark, 0.18 + rng() * 0.2);
      g.fillRect(rng() * w, rng() * h, 2 + rng() * 5, 2 + rng() * 4);
    }
    g.restore();
  }

  function paintBamboo(g, w, h, biome, rng) {
    const l = biome.leaf;
    const log = biome.log;
    const OV = 6;
    const count = clamp(Math.round(w / 9), 4, 12);

    g.save();
    roundRect(g, -OV, -OV, w + OV * 2, h + OV * 2, 8);
    g.clip();

    // Тёмная глубина чащи
    g.fillStyle = rgba(l.dark, 0.92);
    g.fillRect(-OV, -OV, w + OV * 2, h + OV * 2);

    for (let i = 0; i < count; i++) {
      const x = -OV + (i + 0.5) / count * (w + OV * 2);
      const cw = 4 + rng() * 3;
      const lean = (rng() - 0.5) * 3;
      const tone = i % 2 === 0 ? log.light : l.light;

      // Тень между стволами
      g.fillStyle = 'rgba(8,18,10,0.55)';
      g.fillRect(x - cw, -OV, cw * 2.2, h + OV * 2);

      g.strokeStyle = tone;
      g.lineWidth = cw;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x + lean, -OV);
      g.quadraticCurveTo(x - lean, h * 0.5, x + lean, h + OV);
      g.stroke();

      // Светлая грань
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      g.lineWidth = Math.max(0.8, cw * 0.3);
      g.beginPath();
      g.moveTo(x + lean - cw * 0.28, -OV);
      g.quadraticCurveTo(x - lean - cw * 0.28, h * 0.5, x + lean - cw * 0.28, h + OV);
      g.stroke();

      // Узлы
      for (let y = 6 + rng() * 10; y < h + OV; y += 15) {
        g.strokeStyle = rgba(log.bark, 0.9);
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(x - cw * 0.65 + lean * 0.3, y);
        g.lineTo(x + cw * 0.65 + lean * 0.3, y);
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.2)';
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(x - cw * 0.5 + lean * 0.3, y + 1.4);
        g.lineTo(x + cw * 0.5 + lean * 0.3, y + 1.4);
        g.stroke();
      }

      // Листья
      for (let k = 0; k < 4; k++) {
        const y = 8 + rng() * (h + 4);
        const dir = rng() < 0.5 ? -1 : 1;
        g.fillStyle = rgba(k % 2 ? l.light : l.base, 0.9);
        g.beginPath();
        g.ellipse(x + dir * (cw + 3), y, 5 + rng() * 4, 1.3 + rng() * 0.9, dir * 0.55, 0, TAU);
        g.fill();
      }
    }

    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(-OV, -OV, w + OV * 2, Math.min(9, h * 0.3));
    g.restore();
  }

  function paintIceSpike(g, w, h, biome, rng) {
    const l = biome.leaf;
    const OV = 6;
    const alongX = w >= h;
    const len = Math.max(w, h);
    const count = clamp(Math.round(len / 26), 1, 8);

    g.save();
    roundRect(g, -OV, -OV, w + OV * 2, h + OV * 2, 7);
    g.clip();

    // Прозрачное ледяное основание
    g.fillStyle = 'rgba(196,236,250,0.16)';
    g.fillRect(-OV, -OV, w + OV * 2, h + OV * 2);

    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const cx = alongX ? t * w : w / 2 + (rng() - 0.5) * w * 0.22;
      const cy = alongX ? h / 2 + (rng() - 0.5) * h * 0.22 : t * h;
      const base = clamp(Math.min(w, h) * (0.3 + rng() * 0.14), 6, 15);
      const tip = base * (1.7 + rng() * 0.8);
      const side = rng() < 0.5 ? -1 : 1;
      const ang = rng() * Math.PI * 2;

      // Тень
      g.fillStyle = 'rgba(40,90,120,0.35)';
      g.beginPath();
      g.ellipse(cx + 3, cy + 4, base * 0.9, base * 0.42, ang, 0, TAU);
      g.fill();

      g.save();
      g.translate(cx, cy);
      g.rotate(ang);

      // Тёмная грань
      g.fillStyle = rgba(l.dark, 0.95);
      g.beginPath();
      g.moveTo(-base, side * base * 0.55);
      g.lineTo(0, side * tip);
      g.lineTo(base, side * base * 0.55);
      g.closePath();
      g.fill();

      // Светлая грань
      g.fillStyle = rgba(l.light, 0.95);
      g.beginPath();
      g.moveTo(-base * 0.82, side * base * 0.45);
      g.lineTo(-base * 0.08, side * tip * 0.93);
      g.lineTo(base * 0.2, side * base * 0.38);
      g.closePath();
      g.fill();

      // Блик
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.beginPath();
      g.moveTo(-base * 0.38, side * base * 0.36);
      g.lineTo(-base * 0.06, side * tip * 0.8);
      g.lineTo(base * 0.05, side * base * 0.28);
      g.closePath();
      g.fill();

      // Контур
      g.strokeStyle = rgba(l.edge, 0.95);
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(-base, side * base * 0.55);
      g.lineTo(0, side * tip);
      g.lineTo(base, side * base * 0.55);
      g.stroke();
      g.restore();
    }

    for (let k = 0; k < 20; k++) {
      g.fillStyle = 'rgba(255,255,255,' + (0.5 + rng() * 0.4).toFixed(2) + ')';
      g.fillRect(rng() * w, rng() * h, 1.2, 1.2);
    }
    g.restore();
  }

  function paintChorus(g, w, h, biome, rng) {
    const l = biome.leaf;
    const log = biome.log;
    const OV = 6;
    const alongX = w >= h;
    const len = Math.max(w, h);
    const count = clamp(Math.round(len / 44), 1, 6);

    g.save();
    roundRect(g, -OV, -OV, w + OV * 2, h + OV * 2, 9);
    g.clip();

    // Тёмная фиолетовая чаща
    g.fillStyle = rgba(l.dark, 0.68);
    g.fillRect(-OV, -OV, w + OV * 2, h + OV * 2);

    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const cx = alongX ? t * w : w / 2;
      const cy = alongX ? h / 2 : t * h;
      const r = clamp(Math.min(w, h) * 0.38 + 5, 9, 20);

      // Стебли
      g.strokeStyle = rgba(log.bark, 0.9);
      g.lineWidth = Math.max(1.6, r * 0.16);
      for (let k = 0; k < 4; k++) {
        const a = rng() * TAU;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4);
        g.lineTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35);
        g.stroke();
      }

      // Бутоны-цветы
      const bulbs = 4 + Math.floor(r / 5);
      for (let k = 0; k < bulbs; k++) {
        const a = (k / bulbs) * TAU + rng() * 0.5;
        const d = r * (0.25 + rng() * 0.55);
        const bx = cx + Math.cos(a) * d;
        const by = cy + Math.sin(a) * d;
        const br = r * (0.28 + rng() * 0.15);
        g.fillStyle = k % 3 === 0 ? l.light : l.base;
        g.beginPath();
        g.ellipse(bx, by, br, br * (0.8 + rng() * 0.3), a, 0, TAU);
        g.fill();
        g.fillStyle = rgba(l.accent || '#FFD84D', 0.85);
        g.beginPath();
        g.arc(bx, by, br * 0.24, 0, TAU);
        g.fill();
        g.strokeStyle = rgba(l.edge, 0.55);
        g.lineWidth = 0.8;
        g.beginPath();
        g.ellipse(bx, by, br, br * 0.9, a, 0, TAU);
        g.stroke();
      }

      // Лёгкое свечение
      const glow = g.createRadialGradient(cx, cy, 1, cx, cy, r * 1.8);
      glow.addColorStop(0, rgba(l.light, 0.16));
      glow.addColorStop(1, rgba(l.light, 0));
      g.fillStyle = glow;
      g.beginPath();
      g.arc(cx, cy, r * 1.8, 0, TAU);
      g.fill();
    }
    g.restore();
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
    if (species === 'ice' || species === 'gate' || species === 'dead' || species === 'cactus' ||
        species === 'bamboo' || species === 'ice_spike' || species === 'chorus') {
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
    } else if (species === 'mushroom') {
      paintMushroom(g, w, h, biome, rng);
    } else if (species === 'bamboo') {
      paintBamboo(g, w, h, biome, rng);
    } else if (species === 'ice_spike') {
      paintIceSpike(g, w, h, biome, rng);
    } else if (species === 'chorus') {
      paintChorus(g, w, h, biome, rng);
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
  function flashAt(g, x, y, s, flash, color, shape) {
    if (!flash || flash < 0.02) return;
    const rr = (4 + flash * 8) * s;
    g.save();
    g.translate(x, y);
    g.fillStyle = rgba(color, 0.9 * flash);
    g.strokeStyle = rgba(color, 0.9 * flash);
    g.lineWidth = 1.5 * s;
    if (shape === 'ring') {
      g.beginPath(); g.arc(0, 0, rr * 0.8, 0, TAU); g.stroke();
      g.beginPath(); g.arc(0, 0, rr * 0.4, 0, TAU); g.fill();
    } else if (shape === 'burst') {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        const rr2 = i % 2 === 0 ? rr : rr * 0.4;
        const px = Math.cos(a) * rr2, py = Math.sin(a) * rr2;
        if (i === 0) { g.beginPath(); g.moveTo(px, py); }
        else g.lineTo(px, py);
      }
      g.closePath(); g.fill();
    } else if (shape === 'spark') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.3;
        g.beginPath();
        g.moveTo(Math.cos(a) * rr * 0.2, Math.sin(a) * rr * 0.2);
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        g.stroke();
      }
      g.beginPath(); g.arc(0, 0, rr * 0.35, 0, TAU); g.fill();
    } else {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const rr2 = i % 2 === 0 ? rr : rr * 0.34;
        const px = Math.cos(a) * rr2, py = Math.sin(a) * rr2;
        if (i === 0) { g.beginPath(); g.moveTo(px, py); }
        else g.lineTo(px, py);
      }
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,' + (0.8 * flash).toFixed(2) + ')';
      g.beginPath(); g.arc(0, 0, 2.2 * s * (0.4 + flash), 0, TAU); g.fill();
    }
    g.restore();
  }

  function drawPistol(g, s, ink, flash, accent) {
    const accentColor = accent || '#FF6B35';
    g.fillStyle = ink;
    g.fillRect(2 * s, -3.4 * s, 13 * s, 4.6 * s);
    g.fillRect(13 * s, -2.6 * s, 3.2 * s, 3.4 * s);
    g.beginPath();
    g.moveTo(3.2 * s, -1.2 * s);
    g.lineTo(8.2 * s, -1.2 * s);
    g.lineTo(6.6 * s, 8 * s);
    g.lineTo(3.4 * s, 8 * s);
    g.closePath();
    g.fill();
    g.strokeStyle = ink;
    g.lineWidth = 1.3 * s;
    g.beginPath();
    g.arc(7 * s, 1.6 * s, 2.6 * s, 0, Math.PI);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(3.2 * s, -3 * s, 10 * s, 1.2 * s);
    g.fillStyle = accentColor;
    g.fillRect(11.5 * s, -2.2 * s, 2.2 * s, 1.2 * s);
    flashAt(g, 18 * s, 0, s, flash, accentColor, 'star');
  }

  // Векторные модели оружия. Координаты — в «единицах стикмена»,
  // +x — направление ствола. Цвета: ink / accent / light / dark / glass.
  const GUN_ART = {
    pistol: {
      rects: [[2, -3.4, 13, 4.6, 'ink'], [13, -2.6, 3.2, 3.4, 'ink'],
        [3.2, -3, 10, 1.2, 'light'], [11.5, -2.2, 2.2, 1.2, 'accent']],
      polys: [[[3.2, -1.2], [8.2, -1.2], [6.6, 8], [3.4, 8], 'ink']],
      arcs: [[7, 1.6, 2.6, 'stroke']],
      flash: [18, 0, 'star', 'accent']
    },
    revolver: {
      rects: [[2, -3.2, 12, 4, 'ink'], [12, -2.5, 4, 3, 'ink'],
        [4.5, -4.4, 6, 1.2, 'light'], [12.6, -2.1, 2.4, 1.1, 'accent']],
      polys: [[[3, -1], [8, -1], [6.6, 8], [3, 8], 'ink']],
      circles: [[6.6, -0.6, 3.4, 'inkFill'], [6.6, -0.6, 2.1, 'accentFill'], [6.6, -0.6, 0.8, 'inkFill']],
      arcs: [[7, 1.6, 2.4, 'stroke']],
      flash: [17, 0, 'star', 'accent']
    },
    smg: {
      rects: [[-5, -2.6, 5, 3, 'ink'], [0, -2.6, 14, 4.6, 'ink'],
        [13, -1.8, 5, 2.2, 'ink'], [7, 2, 4.5, 7, 'ink'],
        [10.5, 2, 2.2, 5.4, 'dark'], [2, -2, 8, 1, 'light'],
        [1.5, -0.4, 3, 1.6, 'accent']],
      polys: [[[5.5, 2], [8, 2], [7.2, 7.4], [5, 7.4], 'dark']],
      flash: [20, 0, 'burst', 'accent']
    },
    rifle: {
      rects: [[-7, -2.8, 6, 3.4, 'ink'], [0, -2.9, 19, 4.8, 'ink'],
        [18, -1.8, 6, 2.2, 'ink'], [6, 2, 4.5, 8, 'ink'],
        [10.5, 2, 2.2, 6, 'dark'], [4, -7, 10, 2.6, 'dark'],
        [5, -6.7, 8, 1.2, 'accent'], [1, -2.4, 12, 1, 'light']],
      polys: [[[2, -2.9], [5, -5.2], [8, -2.9], 'dark']],
      flash: [26, 0, 'star', 'accent']
    },
    shotgun: {
      rects: [[-6, -2.8, 6, 3.4, 'ink'], [0, -3, 9, 5.2, 'ink'],
        [8, -3.4, 15, 2.4, 'ink'], [8, 0, 15, 2.4, 'ink'],
        [9, 3, 6, 2.6, 'dark'], [1, -2.6, 7, 1, 'light'],
        [10, 0.6, 10, 0.9, 'accent']],
      polys: [[[-4, -2.4], [-1, -4.6], [1, -2.4], 'dark']],
      flash: [24, -1, 'burst', 'accent']
    },
    blaster: {
      rects: [[1, -3.6, 13, 5, 'ink'], [12, -2.2, 6, 2.8, 'ink'],
        [2, -3.2, 9, 1.1, 'light'], [3, 3, 2.4, 5, 'accent']],
      polys: [[[1.5, -3.4], [-2, -5.6], [0.5, -1.6], 'dark'],
        [[1.5, 1.2], [-2, 3.2], [0.5, -0.2], 'dark']],
      circles: [[6, -0.8, 2.8, 'accentFill'], [6, -0.8, 1.2, 'whiteFill']],
      flash: [19, 0, 'ring', 'accent']
    },
    crossbow: {
      rects: [[-4, -2, 12, 4, 'ink'], [8, -0.7, 12, 1.4, 'dark'],
        [9, -1.2, 6, 2.4, 'accent'], [-4, -2.4, 5, 1, 'light']],
      polys: [[[7, -1], [13, -9], [15, -7], [9, -0.4], 'dark'],
        [[7, 1], [13, 9], [15, 7], [9, 0.4], 'dark']],
      lines: [[13, -8, 13, 8, 'string', 1], [13, -8, 9, 0, 'string', 0.8], [13, 8, 9, 0, 'string', 0.8]],
      flash: [20, 0, 'spark', 'accent']
    },
    sniper: {
      rects: [[-9, -2.8, 8, 3.4, 'ink'], [0, -2.8, 20, 4.2, 'ink'],
        [19, -1.6, 11, 2, 'ink'], [4, 2, 4, 7, 'ink'], [9, 2, 2, 5, 'dark'],
        [5, -7.4, 13, 2.8, 'dark'], [6, -7.1, 8, 1.2, 'glass'],
        [1, -2.4, 13, 1, 'light'], [20, -1.2, 8, 0.8, 'accent']],
      lines: [[16, 3, 12, 9, 'ink', 1.6], [16, 3, 20, 9, 'ink', 1.6]],
      flash: [32, 0, 'spark', 'accent']
    },
    plasma: {
      rects: [[1, -3.8, 14, 5.2, 'ink'], [13, -2.4, 5, 3, 'ink'],
        [2, -3.4, 9, 1.1, 'light'], [4, 2.6, 2.4, 5.4, 'ink']],
      polys: [[[14, -3.2], [19, -4.6], [19, -1.8], 'accent'],
        [[14, 1.8], [19, 3.2], [19, 0.6], 'accent']],
      circles: [[7, -0.8, 3.4, 'accentFill'], [7, -0.8, 1.5, 'whiteFill']],
      flash: [21, 0, 'ring', 'accent']
    },
    minigun: {
      rects: [[3, -5.2, 17, 2.2, 'ink'], [3, -1.1, 17, 2.2, 'ink'],
        [3, 3, 17, 2.2, 'ink'], [9, -1, 7, 1.6, 'light'],
        [1, -4, 4, 8, 'dark']],
      circles: [[7, 0, 5, 'inkFill'], [7, 0, 3.4, 'darkFill'], [7, 0, 1.4, 'accentFill']],
      polys: [[[-4, -2], [-1, -4], [0, 2], [-3, 4], 'ink']],
      flash: [22, 0, 'burst', 'accent']
    },
    launcher: {
      rects: [[0, -4.4, 19, 8.8, 'ink'], [3, -3.4, 12, 1.4, 'light'],
        [6, 3.4, 3, 5, 'ink'], [9, -2.8, 10, 1, 'accent']],
      polys: [[[19, -4.4], [25, -2.4], [25, 2.4], [19, 4.4], 'dark']],
      circles: [[10, -0.2, 3, 'accentFill'], [10, -0.2, 1.2, 'inkFill']],
      flash: [26, 0, 'burst', 'accent']
    },
    railgun: {
      rects: [[0, -2.6, 17, 4, 'ink'], [13, -4.4, 12, 1.4, 'ink'],
        [13, 3, 12, 1.4, 'ink'], [3, -2.2, 9, 1, 'light']],
      lines: [[9, -3.8, 24, -3.8, 'accent', 1.4], [9, 3.8, 24, 3.8, 'accent', 1.4]],
      circles: [[7, -0.6, 3.2, 'accentFill'], [7, -0.6, 1.4, 'whiteFill']],
      flash: [27, 0, 'spark', 'accent']
    }
  };

  function partColor(type, ink, accent) {
    if (type === 'accent') return accent;
    if (type === 'light') return 'rgba(255,255,255,0.3)';
    if (type === 'dark') return shade(ink, -0.35);
    if (type === 'glass') return 'rgba(160,240,255,0.85)';
    if (type === 'whiteFill') return 'rgba(255,255,255,0.9)';
    if (type === 'accentFill') return accent;
    if (type === 'darkFill') return shade(ink, -0.5);
    if (type === 'inkFill') return ink;
    if (type === 'string') return 'rgba(225,235,245,0.8)';
    return ink;
  }

  function drawWeapon(g, s, id, ink, flash, accent) {
    const A = accent || '#FF6B35';
    const f = flash || 0;

    if (id === 'dual') {
      g.save();
      g.translate(-f * 2.2 * s, 0);
      g.save();
      g.translate(0, -2.8 * s);
      drawPistol(g, s, ink, f, A);
      g.restore();
      g.save();
      g.translate(0, 2.8 * s);
      drawPistol(g, s, ink, f, A);
      g.restore();
      g.restore();
      return;
    }

    const art = GUN_ART[id] || GUN_ART.pistol;
    g.save();
    g.translate(-f * 2.2 * s, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    if (art.rects) {
      for (let i = 0; i < art.rects.length; i++) {
        const r = art.rects[i];
        g.fillStyle = partColor(r[4], ink, A);
        g.fillRect(r[0] * s, r[1] * s, r[2] * s, r[3] * s);
      }
    }
    if (art.polys) {
      for (let i = 0; i < art.polys.length; i++) {
        const poly = art.polys[i];
        g.fillStyle = partColor(poly[poly.length - 1], ink, A);
        g.beginPath();
        for (let k = 0; k < poly.length - 1; k++) {
          const pt = poly[k];
          if (k === 0) g.moveTo(pt[0] * s, pt[1] * s);
          else g.lineTo(pt[0] * s, pt[1] * s);
        }
        g.closePath();
        g.fill();
      }
    }
    if (art.circles) {
      for (let i = 0; i < art.circles.length; i++) {
        const c = art.circles[i];
        const type = c[3];
        if (type === 'stroke' || type === 'strokeInk' || type === 'strokeAccent') {
          g.strokeStyle = type === 'strokeAccent' ? A : ink;
          g.lineWidth = Math.max(1, 1.1 * s);
          g.beginPath(); g.arc(c[0] * s, c[1] * s, c[2] * s, 0, TAU); g.stroke();
        } else {
          g.fillStyle = partColor(type, ink, A);
          g.beginPath(); g.arc(c[0] * s, c[1] * s, c[2] * s, 0, TAU); g.fill();
        }
      }
    }
    if (art.arcs) {
      for (let i = 0; i < art.arcs.length; i++) {
        const a = art.arcs[i];
        g.strokeStyle = ink;
        g.lineWidth = Math.max(1, 1.1 * s);
        g.beginPath(); g.arc(a[0] * s, a[1] * s, a[2] * s, 0, Math.PI); g.stroke();
      }
    }
    if (art.lines) {
      for (let i = 0; i < art.lines.length; i++) {
        const l = art.lines[i];
        g.strokeStyle = partColor(l[4], ink, A);
        g.lineWidth = Math.max(0.8, l[5] * s);
        g.beginPath();
        g.moveTo(l[0] * s, l[1] * s);
        g.lineTo(l[2] * s, l[3] * s);
        g.stroke();
      }
    }
    if (art.flash) {
      const fl = art.flash;
      flashAt(g, fl[0] * s, fl[1] * s, s, f,
        fl[3] === 'accent' ? A : '#FFD27A', fl[2]);
    }
    g.restore();
  }

  /**
   * Голова пули выбранного скина. Хвост рисует script.js по точкам
   * траектории (у каждого стиля свой вид).
   */
  function drawBulletHead(ctx, x, y, skin, timeSec, scale) {
    const t = timeSec || 0;
    const base = scale || 6;
    const size = base * (skin.size || 1);
    const glow = skin.rainbow
      ? 'hsl(' + Math.round((t * 160) % 360) + ',100%,65%)'
      : skin.glow;

    ctx.save();
    ctx.translate(x, y);

    // Тёмный контур для читаемости на снегу и песке
    ctx.fillStyle = 'rgba(18,12,8,0.45)';
    ctx.beginPath(); ctx.arc(0, 0, size + 2.4, 0, TAU); ctx.fill();

    ctx.globalAlpha = 0.32;
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, size * 2.1, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    if (skin.shape === 'diamond') {
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.25);
      ctx.lineTo(size, 0);
      ctx.lineTo(0, size * 1.25);
      ctx.lineTo(-size, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = skin.core;
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.62);
      ctx.lineTo(size * 0.5, 0);
      ctx.lineTo(0, size * 0.62);
      ctx.lineTo(-size * 0.5, 0);
      ctx.closePath();
      ctx.fill();
    } else if (skin.shape === 'star') {
      ctx.fillStyle = glow;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - Math.PI / 2;
        const r = i % 2 === 0 ? size * 1.45 : size * 0.62;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = skin.core;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, TAU); ctx.fill();
    } else if (skin.shape === 'ring') {
      ctx.strokeStyle = glow;
      ctx.lineWidth = Math.max(1.6, size * 0.36);
      ctx.beginPath(); ctx.arc(0, 0, size * 0.92, 0, TAU); ctx.stroke();
      ctx.fillStyle = skin.core;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.42, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, size * 1.1, 0, TAU); ctx.fill();
      ctx.fillStyle = skin.core;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.62, 0, TAU); ctx.fill();
    }

    // Дополнительные искры для «галактики» и «плазмы»
    if (skin.trailStyle === 'galaxy') {
      for (let i = 0; i < 3; i++) {
        const a = t * 2.4 + (i / 3) * TAU;
        ctx.fillStyle = i % 2 ? skin.trail2 : skin.spark[i % skin.spark.length];
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * size * 1.7, Math.sin(a) * size * 1.7, 1.2, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function stickmanScale(r) {
    return clamp((r || 18) / 23.5, 0.62, 1.05);
  }

  /**
   * Рисует стикмена с большим белым лицом, тонкими руками-ногами,
   * коричневыми ботинками и пистолетом. Координаты — центр фигуры.
   */
  function drawEnemyHat(g, s, o, band, ink) {
    const hat = o.hat || 'bandana';
    if (hat === 'none') return;

    if (hat === 'bandana') {
      g.fillStyle = band;
      roundRect(g, -9.4 * s, -31.6 * s, 18.8 * s, 3.8 * s, 1.6 * s);
      g.fill();
      g.beginPath();
      g.moveTo(8.4 * s, -30.4 * s);
      g.lineTo(13.2 * s, -27.4 * s);
      g.lineTo(9 * s, -26.6 * s);
      g.closePath();
      g.fill();
    } else if (hat === 'cap') {
      g.fillStyle = band;
      g.beginPath();
      g.arc(0, -27.6 * s, 9.4 * s, Math.PI, TAU);
      g.fill();
      g.fillRect(-9.4 * s, -28.4 * s, 18.8 * s, 2.6 * s);
      g.fillStyle = shade(band, -0.35);
      roundRect(g, -4 * s, -29.4 * s, 15 * s, 2.4 * s, 1.2 * s);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.beginPath(); g.arc(0, -31.2 * s, 1.4 * s, 0, TAU); g.fill();
    } else if (hat === 'helmet') {
      g.fillStyle = 'rgba(170,184,196,0.92)';
      g.beginPath();
      g.arc(0, -24.6 * s, 11.4 * s, Math.PI, TAU);
      g.fill();
      g.fillRect(-11.4 * s, -25 * s, 22.8 * s, 2.4 * s);
      g.fillStyle = 'rgba(30,38,44,0.9)';
      roundRect(g, -8.2 * s, -25.2 * s, 16.4 * s, 3.2 * s, 1.4 * s);
      g.fill();
      g.strokeStyle = rgba(band, 0.8);
      g.lineWidth = 1.4 * s;
      g.beginPath(); g.arc(0, -24.6 * s, 11 * s, Math.PI, TAU); g.stroke();
    } else if (hat === 'hood') {
      g.strokeStyle = ink;
      g.lineWidth = 4.6 * s;
      g.beginPath();
      g.arc(0, -23.2 * s, 10.6 * s, Math.PI * 0.92, Math.PI * 2.08);
      g.stroke();
      g.fillStyle = ink;
      g.beginPath();
      g.moveTo(-10.4 * s, -23 * s);
      g.lineTo(-14 * s, -14.6 * s);
      g.lineTo(-8.6 * s, -15.8 * s);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(10.4 * s, -23 * s);
      g.lineTo(14 * s, -14.6 * s);
      g.lineTo(8.6 * s, -15.8 * s);
      g.closePath();
      g.fill();
    } else if (hat === 'officer') {
      g.fillStyle = '#20262E';
      g.beginPath();
      g.arc(0, -28.4 * s, 9.6 * s, Math.PI, TAU);
      g.fill();
      g.fillRect(-9.6 * s, -29.2 * s, 19.2 * s, 3 * s);
      g.fillStyle = band;
      g.fillRect(-9.6 * s, -27.4 * s, 19.2 * s, 2.2 * s);
      g.fillStyle = '#14181E';
      roundRect(g, -2.5 * s, -30 * s, 15.5 * s, 2.4 * s, 1.2 * s);
      g.fill();
      g.fillStyle = '#FFD84D';
      g.beginPath(); g.arc(0, -29.6 * s, 1.6 * s, 0, TAU); g.fill();
    } else if (hat === 'antenna') {
      g.strokeStyle = band;
      g.lineWidth = 1.4 * s;
      g.beginPath();
      g.moveTo(-4 * s, -31 * s);
      g.quadraticCurveTo(-6 * s, -36 * s, -4 * s, -38 * s);
      g.moveTo(4 * s, -31 * s);
      g.quadraticCurveTo(6 * s, -35 * s, 7 * s, -37 * s);
      g.stroke();
      g.fillStyle = band;
      g.beginPath(); g.arc(-4 * s, -38.4 * s, 1.7 * s, 0, TAU); g.fill();
      g.beginPath(); g.arc(7 * s, -37.4 * s, 1.7 * s, 0, TAU); g.fill();
    }
  }


  function drawStickman(g, o) {
    const s = o.scale || 1;
    const ink = o.ink || '#14161C';
    const inkSoft = o.inkSoft || ink;
    const head = o.head || '#F8FAFD';
    const shoes = o.shoes || '#7A4A24';
    const band = o.band || '#E82A46';
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

    // Шарф разведчика/ниндзя
    if (o.scarf) {
      g.strokeStyle = band;
      g.lineWidth = 2.1 * s;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-1.2 * s * face, -11.4 * s);
      g.quadraticCurveTo(-10 * s * face, -15 * s, -18 * s * face, -9.6 * s + Math.sin(walk) * 1.6 * s);
      g.stroke();
      g.strokeStyle = rgba(band, 0.55);
      g.lineWidth = 1.2 * s;
      g.beginPath();
      g.moveTo(-1.2 * s * face, -10.6 * s);
      g.quadraticCurveTo(-9 * s * face, -12.6 * s, -15 * s * face, -8 * s + Math.sin(walk) * 1.4 * s);
      g.stroke();
    }

    // Броня тяжеловеса/стража
    if (o.armor) {
      g.fillStyle = 'rgba(176,190,200,0.82)';
      roundRect(g, -6.4 * s, -11.4 * s, 12.8 * s, 8.4 * s, 2.4 * s);
      g.fill();
      g.strokeStyle = rgba(ink, 0.8);
      g.lineWidth = 1.2 * s;
      g.stroke();
      g.fillStyle = 'rgba(208,220,228,0.9)';
      g.beginPath(); g.ellipse(-7 * s, -9.4 * s, 3.6 * s, 2.4 * s, -0.3, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(7 * s, -9.4 * s, 3.6 * s, 2.4 * s, 0.3, 0, TAU); g.fill();
      g.strokeStyle = rgba(band, 0.8);
      g.lineWidth = 1.4 * s;
      g.beginPath();
      g.moveTo(-4 * s, -8.6 * s);
      g.lineTo(0, -6.2 * s);
      g.lineTo(4 * s, -8.6 * s);
      g.stroke();
    }

    // Золотые эполеты капитана
    if (o.epaulettes) {
      g.fillStyle = '#FFD84D';
      g.beginPath(); g.ellipse(-7 * s, -9.8 * s, 3.2 * s, 1.7 * s, -0.2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(7 * s, -9.8 * s, 3.2 * s, 1.7 * s, 0.2, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(120,86,10,0.7)';
      g.lineWidth = 0.9 * s;
      g.stroke();
    }




    // Голова
    g.fillStyle = head;
    g.strokeStyle = ink;
    g.lineWidth = 2.8 * s;
    g.beginPath();
    g.arc(0, -23.2 * s, 10 * s, 0, TAU);
    g.fill();
    g.stroke();

    // Каракули-волосы, как у стикмена с картинки (не под шлемом/капюшоном)
    const hasHair = !o.enemy || !o.hat || o.hat === 'bandana' || o.hat === 'none' || o.hat === 'cap';
    if (hasHair) {
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
    }

    if (o.enemy) {
      drawEnemyHat(g, s, o, band, ink);

      if (o.alien) {
        // Большие чёрные глаза пришельца
        g.fillStyle = '#12200E';
        g.beginPath();
        g.ellipse(-3.8 * s, -24 * s, 2.6 * s, 4.2 * s, -0.45, 0, TAU);
        g.fill();
        g.beginPath();
        g.ellipse(3.8 * s, -24 * s, 2.6 * s, 4.2 * s, 0.45, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.beginPath(); g.arc(-4.4 * s, -25.4 * s, 0.7 * s, 0, TAU); g.fill();
        g.beginPath(); g.arc(3.2 * s, -25.4 * s, 0.7 * s, 0, TAU); g.fill();
      } else if (o.zombie) {
        g.fillStyle = '#4A1A1A';
        g.beginPath(); g.arc(-3.4 * s, -23.8 * s, 1.7 * s, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(40,50,30,0.8)';
        g.lineWidth = 1.2 * s;
        g.beginPath();
        g.moveTo(1.4 * s, -23.4 * s); g.lineTo(5.4 * s, -23.4 * s);
        g.moveTo(1.8 * s, -21.8 * s); g.lineTo(5 * s, -21.8 * s);
        g.stroke();
      } else {
        const eye = o.eye || band;
        g.fillStyle = shade(eye, -0.25);
        g.beginPath(); g.arc(-3.4 * s, -23.6 * s, 1.6 * s, 0, TAU); g.fill();
        g.beginPath(); g.arc(3.4 * s, -23.6 * s, 1.6 * s, 0, TAU); g.fill();
        g.strokeStyle = ink;
        g.lineWidth = 1.5 * s;
        g.beginPath();
        g.moveTo(-5.6 * s, -27 * s); g.lineTo(-1.6 * s, -25.6 * s);
        g.moveTo(5.6 * s, -27 * s); g.lineTo(1.6 * s, -25.6 * s);
        g.stroke();
      }
    } else {
      // Спокойное лицо героя
      g.strokeStyle = 'rgba(20,22,28,0.55)';
      g.lineWidth = 1.3 * s;
      g.beginPath();
      g.arc(0, -19.6 * s, 2.4 * s, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    }

    // Рука с оружием, направленная по прицелу
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
    drawWeapon(g, s, o.weapon || 'pistol', ink, o.flash || 0, o.weaponAccent || band);
    g.restore();

    g.restore();
  }

  // =========================================================
  // Игрок и враги
  // =========================================================
  // Дрон — не стикмен: летающая машина с винтами и плазмером
  function drawDrone(ctx, x, y, s, kind, aim, timeSec, alpha) {
    const bob = Math.sin(timeSec * 3.4) * 2.4 * s;
    const cy = y + bob;
    const A = kind.band || '#38E8FF';

    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;

    // Тень и аэрозоль
    ctx.fillStyle = 'rgba(8,14,18,0.22)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 19 * s, 13 * s, 4.4 * s, 0, 0, TAU);
    ctx.fill();

    // Винты
    const spin = 0.55 + Math.abs(Math.sin(timeSec * 22)) * 0.45;
    ctx.strokeStyle = 'rgba(190,220,235,0.4)';
    ctx.lineWidth = 1.3 * s;
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(x, cy - 12 * s);
      ctx.lineTo(x + side * 13 * s, cy - 12 * s);
      ctx.stroke();
      ctx.fillStyle = 'rgba(190,225,240,0.22)';
      ctx.beginPath();
      ctx.ellipse(x + side * 13 * s, cy - 12 * s, 9 * s * spin, 2.1 * s, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(A, 0.65);
      ctx.beginPath();
      ctx.arc(x + side * 13 * s, cy - 12 * s, 7 * s * spin, 0, TAU);
      ctx.stroke();
    }

    // Корпус
    ctx.fillStyle = kind.ink || '#2A2E38';
    ctx.beginPath();
    ctx.ellipse(x, cy - 3 * s, 10.5 * s, 7 * s, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(A, 0.7);
    ctx.lineWidth = 1.4 * s;
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,220,235,0.16)';
    ctx.beginPath();
    ctx.ellipse(x - 2 * s, cy - 5 * s, 6 * s, 3.2 * s, -0.3, 0, TAU);
    ctx.fill();

    // Антенна и глаз
    ctx.strokeStyle = rgba(A, 0.8);
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(x - 2 * s, cy - 10 * s);
    ctx.lineTo(x - 5 * s, cy - 17 * s);
    ctx.stroke();
    ctx.fillStyle = A;
    ctx.beginPath(); ctx.arc(x - 5 * s, cy - 18 * s, 1.6 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#E82A46';
    ctx.beginPath(); ctx.arc(x + 4 * s, cy - 4 * s, 2.1 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(x + 4.6 * s, cy - 4.6 * s, 0.7 * s, 0, TAU); ctx.fill();

    // Реактивная струя
    const flick = 0.7 + Math.sin(timeSec * 17) * 0.3;
    ctx.fillStyle = rgba(A, 0.4);
    ctx.beginPath();
    ctx.moveTo(x - 4 * s, cy + 3 * s);
    ctx.lineTo(x, cy + (8 + 4 * flick) * s);
    ctx.lineTo(x + 4 * s, cy + 3 * s);
    ctx.closePath();
    ctx.fill();

    // Плазмер снизу
    ctx.save();
    ctx.translate(x, cy + 4 * s);
    ctx.rotate(aim);
    if (Math.cos(aim) < 0) ctx.scale(1, -1);
    drawWeapon(ctx, s * 0.9, kind.weapon || 'plasma', kind.ink || '#2A2E38', 0, A);
    ctx.restore();

    ctx.restore();
  }


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
      walking: false, walk: 0, flash: opts.recoil || 0,
      weapon: opts.weapon || 'pistol',
      weaponAccent: opts.weaponAccent || '#FF6B35'
    });
  }

  function drawEnemy(ctx, def, x, y, r, timeSec, opts) {
    opts = opts || {};
    const b = opts.biome || (Biomes ? Biomes.byId('plains') : null);
    const s = stickmanScale(r || 18);
    const alive = opts.alive !== false;
    const player = opts.player || { x: x + 200, y: y };
    const aimToPlayer = Math.atan2(player.y - y, player.x - x);
    const kind = Enemies ? Enemies.kindFor(def, opts.index) : null;
    const aura = (kind && kind.aura) || '#FF3B5C';

    if (!alive) {
      const age = opts.age != null
        ? Math.max(0, opts.age)
        : Math.max(0, timeSec - (opts.hitT || 0));
      if (age > 1.5) return;
      const alpha = Math.max(0, 1 - age / 1.5);

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
      if (kind && kind.id === 'drone') {
        drawDrone(ctx, 0, 0, s, kind, aimToPlayer, timeSec, alpha);
      } else if (kind && kind.id === 'juggernaut' && age > 0.55) {
        // Тяжёлый корпус падает и искрит
        drawStickman(ctx, {
          x: 0, y: 0, scale: s, aim: aimToPlayer,
          ink: kind.ink, head: kind.head, shoes: kind.shoes,
          enemy: true, alpha: alpha * 0.9, flash: 0, face: 1,
          weapon: kind.weapon, weaponAccent: kind.band,
          band: kind.band, hat: kind.hat, armor: kind.armor
        });
        ctx.fillStyle = 'rgba(255,180,60,' + (alpha * 0.8).toFixed(2) + ')';
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU + age * 3;
          ctx.fillRect(Math.cos(a) * 10, -6 + Math.sin(a) * 8, 2.4, 2.4);
        }
      } else {
        drawStickman(ctx, {
          x: 0, y: 0, scale: s, aim: aimToPlayer,
          ink: kind ? kind.ink : '#1A0A0F', head: kind ? kind.head : '#EFDDE1',
          shoes: kind ? kind.shoes : '#3A1C1C', band: kind ? kind.band : '#E82A46',
          enemy: true, alpha: alpha, flash: 0, face: 1,
          weapon: kind ? kind.weapon : 'pistol',
          weaponAccent: kind ? kind.band : '#E82A46',
          hat: kind ? kind.hat : 'bandana',
          scarf: !!(kind && kind.scarf), armor: !!(kind && kind.armor),
          epaulettes: !!(kind && kind.epaulettes),
          alien: !!(kind && kind.alien), zombie: !!(kind && kind.zombie)
        });
      }
      ctx.restore();

      // Искры после падения
      if (age < 0.8) {
        ctx.save();
        ctx.globalAlpha = 1 - age / 0.8;
        ctx.fillStyle = aura;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + age * 5;
          ctx.fillRect(x + Math.cos(a) * (10 + age * 30), y + Math.sin(a) * (8 + age * 24), 2, 2);
        }
        ctx.restore();
      }
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

    // Лазерный прицел снайпера — только визуальная угроза
    if (kind && kind.laser) {
      const len = Math.min(220, Math.hypot(player.x - x, player.y - y));
      ctx.save();
      ctx.globalAlpha = 0.14 + (Math.sin(timeSec * 4) * 0.5 + 0.5) * 0.08;
      ctx.strokeStyle = aura;
      ctx.setLineDash([5, 7]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(aimToPlayer) * 18, y + Math.sin(aimToPlayer) * 18);
      ctx.lineTo(x + Math.cos(aimToPlayer) * len, y + Math.sin(aimToPlayer) * len);
      ctx.stroke();
      ctx.restore();
    }

    // Свечение и пунктир радиуса попадания
    ctx.save();
    const pulse = 1 + Math.sin(timeSec * 3 + (opts.index || 0)) * 0.06;
    const glow = ctx.createRadialGradient(x, y, 1, x, y, r * 2.1 * pulse);
    glow.addColorStop(0, rgba(aura, 0.24));
    glow.addColorStop(1, rgba(aura, 0));
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

    if (kind && kind.id === 'drone') {
      drawDrone(ctx, x, y, s, kind, aimToPlayer, timeSec, 1);
      return;
    }

    const snowy = b && b.id === 'snowy';
    drawStickman(ctx, {
      x: x, y: y, scale: s, aim: aimToPlayer,
      ink: kind ? kind.ink : '#1A0A0F',
      head: kind ? kind.head : '#F4E4E7',
      shoes: kind ? kind.shoes : (snowy ? '#4A3A3A' : '#3A1C1C'),
      band: kind ? kind.band : '#E82A46',
      enemy: true, walking: moving, walk: walk,
      face: Math.cos(aimToPlayer) >= 0 ? 1 : -1,
      flash: 0,
      weapon: kind ? kind.weapon : 'pistol',
      weaponAccent: kind ? kind.band : '#E82A46',
      hat: kind ? kind.hat : 'bandana',
      scarf: !!(kind && kind.scarf), armor: !!(kind && kind.armor),
      epaulettes: !!(kind && kind.epaulettes),
      alien: !!(kind && kind.alien), zombie: !!(kind && kind.zombie)
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
      } else if (type === 'petal') {
        const x = ((r1 * width + Math.sin(timeSec * 0.6 + i) * 34 + timeSec * 16) % width + width) % width;
        const y = ((r2 * height + timeSec * (20 + r3 * 22)) % height + height) % height;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(timeSec * (1.1 + r4) + i);
        ctx.globalAlpha = 0.5 + r4 * 0.4;
        ctx.fillStyle = r4 > 0.4 ? color : '#FFF0F5';
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.8 + r4 * 1.8, 1.2 + r4, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (type === 'ash') {
        const x = ((r1 * width + Math.sin(timeSec * 0.5 + i) * 22 + timeSec * 18) % width + width) % width;
        const y = ((r2 * height - timeSec * (14 + r3 * 24) + height * 2) % height + height) % height;
        ctx.globalAlpha = 0.2 + r4 * 0.4;
        ctx.fillStyle = r4 > 0.55 ? '#FF9F43' : color;
        const sz = 1.2 + r4 * 2;
        ctx.fillRect(x, y, sz, sz);
        if (r4 > 0.8) {
          ctx.globalAlpha = 0.16;
          ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
        }
      } else if (type === 'spark') {
        const x = ((r1 * width + Math.sin(timeSec * 0.7 + i * 1.4) * 30) % width + width) % width;
        const y = ((r2 * height + Math.cos(timeSec * 0.8 + i) * 22) % height + height) % height;
        const a = 0.25 + (Math.sin(timeSec * 2.6 + i) * 0.5 + 0.5) * 0.55;
        ctx.globalAlpha = a * 0.2;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(x, y, 1.1 + r4 * 1.4, 0, TAU); ctx.fill();
        ctx.globalAlpha = a * 0.7;
        ctx.fillRect(x - 3, y - 0.5, 6, 1);
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
    drawWeapon: drawWeapon,
    drawBulletHead: drawBulletHead,
    drawDrone: drawDrone,
    gunArt: GUN_ART,
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
