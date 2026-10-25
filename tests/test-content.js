/* Детерминизм, ежедневное испытание, рост сложности: node tests/test-content.js */
const OB = require('../js/engine.js');
const Gen = require('../js/generator.js');

let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ok   ' + name);
  else { fails++; console.log('  FAIL ' + name + (extra !== undefined ? ' -> ' + extra : '')); }
}

function fingerprint(level) {
  return JSON.stringify({
    walls: level.walls.map(w => [w.type, w.x, w.y, w.w, w.h, w.channel || '', w.axis || '']),
    enemies: level.enemies.map(e => [e.x, e.y, e.r, e.move.type, e.move.amp || 0, e.move.r || 0]),
    switches: level.switches.map(s => [s.x, s.y, s.channel]),
    doors: level.doors.map(d => [d.x, d.y, d.w, d.h, d.channel]),
    portals: level.portals.map(p => [p.x, p.y, p.id]),
    wells: (level.wells || []).map(w => [w.x, w.y, w.r, w.dir]),
    player: [level.player.x, level.player.y], aim: level.aim
  });
}

// --- детерминизм ---
const a = Gen.generate(42, { worldSeed: 'alpha' });
const b = Gen.generate(42, { worldSeed: 'alpha' });
const c = Gen.generate(42, { worldSeed: 'beta' });
check('один seed → одинаковый уровень', fingerprint(a) === fingerprint(b));
check('разные seed → разные уровни', fingerprint(a) !== fingerprint(c));

// --- ежедневное испытание: seed из даты ---
function daily(day) {
  const seed = 'daily-' + day;
  const index = 30 + (Gen.hash('daily:' + day) % 70);
  const lvl = Gen.generate(index, { seed, worldSeed: 'любой' });
  return { index, lvl };
}
const d1 = daily('2026-03-14');
const d2 = daily('2026-03-14');
const d3 = daily('2026-03-15');
check('один день → одно испытание', fingerprint(d1.lvl) === fingerprint(d2.lvl));
check('разные дни → разные арены', fingerprint(d1.lvl) !== fingerprint(d3.lvl));
check('уровень испытания 31..100', d1.index >= 30 && d1.index <= 99, d1.index);
check('испытание проходимо', OB.simulate(d1.lvl, d1.lvl.aim).win);
check('seed не зависит от игрока', d1.lvl.seed.indexOf('daily-2026-03-14') === 0, d1.lvl.seed);

// --- рост сложности ---
let prevBounce = -1;
let okBounce = true;
let okEnergy = true;
let prevEnergy = 999;
for (let i = 0; i < 140; i++) {
  const d = Gen.difficulty(i);
  if (d.bounceTarget < prevBounce) okBounce = false;
  prevBounce = d.bounceTarget;
  if (i >= 31 && d.energyMax > prevEnergy + 100) okEnergy = false;
  prevEnergy = d.energyMax;
}
check('число обязательных отскоков не падает', okBounce);
check('энергия не растёт после 31 уровня', okEnergy);

// --- новые механики появляются ---
const l55 = Gen.generate(54, { worldSeed: 'mech' });
const l120 = Gen.generate(119, { worldSeed: 'mech' });
check('колодцы появляются в поздних уровнях',
  (l55.mechanics.includes('well') || l120.mechanics.includes('well')),
  l55.mechanics.join(',') + ' / ' + l120.mechanics.join(','));

// --- лимиты объектов ---
let maxWalls = 0, maxEnemies = 0;
for (let i = 0; i < 60; i++) {
  const lvl = Gen.generate(i * 7, { worldSeed: 'limits' });
  maxWalls = Math.max(maxWalls, lvl.walls.length);
  maxEnemies = Math.max(maxEnemies, lvl.enemies.length);
  if (!OB.simulate(lvl, lvl.aim).win) { fails++; console.log('  FAIL проходимость уровня', i * 7); }
}
check('стен не больше 64', maxWalls <= 64, maxWalls);
check('врагов не больше 7', maxEnemies <= 7, maxEnemies);

console.log(fails ? '\nCONTENT TEST FAILED: ' + fails : '\nCONTENT TEST OK');
process.exit(fails ? 1 : 0);
