/* Биомы и процедурная графика: node tests/test-biomes.js */
const Biomes = require('../js/biomes.js');
const Gen = require('../js/generator.js');

let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ok   ' + name);
  else { fails++; console.log('  FAIL ' + name + (extra !== undefined ? ' -> ' + extra : '')); }
}

// ---------- палитры ----------
const REQUIRED = ['id', 'ru', 'en', 'icon', 'tree', 'accent', 'grass', 'soil', 'leaf', 'log', 'weather', 'decor'];
const GRASS = ['base', 'light', 'dark', 'blade'];
const SOIL = ['top', 'light', 'dark', 'speck'];
const LEAF = ['base', 'light', 'dark', 'edge'];
const LOG = ['bark', 'light', 'dark', 'ring', 'ringDark'];
const SPECIES = ['oak', 'birch', 'spruce', 'dark_oak', 'jungle', 'acacia', 'cactus', 'palm', 'dead'];
const WEATHER = ['snow', 'rain', 'leaf', 'spore', 'dust', 'pollen'];

let palettesOk = true;
const uniqueIds = new Set();
for (const b of Biomes.list) {
  for (const key of REQUIRED) if (b[key] === undefined) palettesOk = false;
  for (const key of GRASS) if (!b.grass || !b.grass[key]) palettesOk = false;
  for (const key of SOIL) if (!b.soil || !b.soil[key]) palettesOk = false;
  for (const key of LEAF) if (!b.leaf || !b.leaf[key]) palettesOk = false;
  for (const key of LOG) if (!b.log || !b.log[key]) palettesOk = false;
  if (SPECIES.indexOf(b.tree) === -1) palettesOk = false;
  if (!b.weather || WEATHER.indexOf(b.weather.type) === -1) palettesOk = false;
  uniqueIds.add(b.id);
}
check('у всех биомов полные палитры', palettesOk);
check('id биомов уникальны', uniqueIds.size === Biomes.count, uniqueIds.size + '/' + Biomes.count);
check('биомов не меньше 10', Biomes.count >= 10, Biomes.count);
check('шаг перебора взаимно прост с числом биомов', (function () {
  const gcd = (x, y) => y ? gcd(y, x % y) : x;
  return gcd(Biomes.step, Biomes.count) === 1;
})(), Biomes.step + '/' + Biomes.count);

// ---------- выбор биома ----------
const a = Biomes.forLevel(42, 'seed-one');
const b = Biomes.forLevel(42, 'seed-one');
const c = Biomes.forLevel(43, 'seed-one');
check('биом детерминирован', a.id === b.id, a.id + ' / ' + b.id);
check('соседние уровни — разные биомы', a.id !== c.id, a.id + ' / ' + c.id);

const seen = new Set();
for (let i = 0; i < Biomes.count * 2; i++) seen.add(Biomes.forLevel(i, 'cover').id);
check('полный круг биомов за 2×N уровней', seen.size === Biomes.count, seen.size + '/' + Biomes.count);

check('название на русском', Biomes.name(a, 'ru') === a.ru);
check('название на английском', Biomes.name(a, 'en') === a.en);
check('неизвестный id → равнины', Biomes.byId('nope').id === 'plains');
check('первый уровень — равнины', Biomes.forLevel(0, 'any-seed').id === 'plains');

// ---------- связка с генератором ----------
const lvl = Gen.generate(17, { worldSeed: 'biome-test' });
check('у уровня есть биом', !!lvl.biome && Biomes.ids.indexOf(lvl.biome) !== -1, lvl.biome);
check('биом уровня совпадает с выбором UI',
  lvl.biome === Biomes.forLevel(17, 'biome-test').id,
  lvl.biome + ' / ' + Biomes.forLevel(17, 'biome-test').id);
const first = Gen.generate(0, { worldSeed: 'biome-test' });
check('первый уровень проходим в равнинах', first.biome === 'plains', first.biome);

const daily = Gen.generate(37, { seed: 'daily-2026-01-01', worldSeed: 'biome-test' });
check('ежедневное испытание: биом из seed',
  daily.biome === Biomes.forLevel(37, 'daily-2026-01-01').id,
  daily.biome);

const cached = Gen.generate(17, { worldSeed: 'biome-test' });
check('кэш сохраняет биом', cached.biome === lvl.biome);

// ---------- графика на заглушке Canvas ----------
function fakeCanvas() {
  const gradient = { addColorStop: function () {} };
  const target = {
    createLinearGradient: function () { return gradient; },
    createRadialGradient: function () { return gradient; },
    createPattern: function () { return null; },
    measureText: function () { return { width: 10 }; },
    getImageData: function () { return { data: [] }; }
  };
  let canvas = null;
  const ctx = new Proxy(target, {
    get: function (t, p) {
      if (p === 'canvas') return canvas;
      if (p in t) return t[p];
      return function () {};
    },
    set: function (t, p, v) { t[p] = v; return true; }
  });
  canvas = {
    width: 1, height: 1,
    getContext: function () { return ctx; }
  };
  return canvas;
}

global.document = { createElement: function () { return fakeCanvas(); } };
const Art = require('../js/art.js');

check('остров рисуется на весь холст', (function () {
  const floor = Art.buildFloor(lvl, Biomes.byId(lvl.biome));
  return floor.width === 1280 && floor.height === 720;
})(), 'canvas size');

check('спрайт дерева кешируется и совпадает с прямоугольником', (function () {
  const wall = { id: 'wx', x: 0, y: 0, w: 44, h: 110, type: 'mirror' };
  const before = Art.treeSprite(wall, Biomes.byId('plains'));
  const after = Art.treeSprite(wall, Biomes.byId('plains'));
  return before === after && before.canvas.width === 44 + Art.PAD * 2;
})());

check('типы стен → породы',
  Art.speciesFor('glass', Biomes.byId('plains')) === 'ice' &&
  Art.speciesFor('door', Biomes.byId('plains')) === 'gate' &&
  Art.speciesFor('block', Biomes.byId('plains')) === 'dead' &&
  Art.speciesFor('mirror', Biomes.byId('birch')) === 'birch');

let artOk = true;
let artError = '';
try {
  const kinds = ['mirror', 'mover', 'bouncy', 'soft', 'block', 'glass', 'door'];
  for (const biome of Biomes.list) {
    for (const kind of kinds) {
      Art.treeSprite({ id: 't-' + biome.id + '-' + kind, x: 0, y: 0, w: 44, h: 110, type: kind }, biome);
      Art.treeSprite({ id: 's-' + biome.id + '-' + kind, x: 0, y: 0, w: 26, h: 26, type: kind }, biome);
    }
  }
} catch (e) { artOk = false; artError = e.message; }
check('все породы и типы стен рисуются', artOk, artError);

let sceneOk = true;
let sceneError = '';
try {
  const ctx = fakeCanvas().getContext('2d');
  const state = {
    t: 1.5, brokenWalls: [], doors: [],
    enemies: [{ def: { x: 800, y: 400, r: 18, move: { type: 'patrol', ax: 'x', amp: 40, freq: 1 } }, alive: true, hitT: 0 }]
  };
  for (const biome of Biomes.list) {
    Art.drawWalls(ctx, lvl, state, 1.2, biome);
    Art.drawWeather(ctx, biome, 3.2, { width: 1280, height: 720 });
    Art.drawPlayer(ctx, lvl, 0.7, 1.2, { biome: biome, aiming: true, recoil: 0.4 });
    Art.drawEnemy(ctx, state.enemies[0].def, 800, 400, 18, 1.2, {
      biome: biome, alive: true, player: lvl.player, index: 0
    });
    Art.drawEnemy(ctx, state.enemies[0].def, 700, 300, 18, 1.2, {
      biome: biome, alive: false, age: 0.4, player: lvl.player, index: 1
    });
  }
} catch (e) { sceneOk = false; sceneError = e.message; }
check('арена, погода и стикмены рисуются во всех биомах', sceneOk, sceneError);

check('масштаб стикмена ограничен', Art.stickmanScale(0) >= 0.6 && Art.stickmanScale(100) <= 1.1);

console.log(fails ? '\nBIOME TEST FAILED: ' + fails : '\nBIOME TEST OK');
process.exit(fails ? 1 : 0);

