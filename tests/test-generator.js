/* Автотест генератора: запуск через `node tests/test-generator.js` */
const OB = require('../js/engine.js');
const Gen = require('../js/generator.js');

const levels = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 16, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90, 100, 120, 150, 200, 300];
const seeds = ['seed-a', 'seed-b'];

let fails = 0;
let totalMs = 0;

for (const s of seeds) {
  for (const n of levels) {
    const t0 = Date.now();
    const lvl = Gen.generate(n - 1, { worldSeed: s });
    const ms = Date.now() - t0;
    totalMs += ms;

    const res = OB.simulate(lvl, lvl.aim);
    const okAim = res.win;
    const tol = (lvl.aimTolerance || 0.5) * Math.PI / 180;
    const okP = OB.simulate(lvl, lvl.aim + tol).win;
    const okM = OB.simulate(lvl, lvl.aim - tol).win;

    const fallback = lvl.fallback ? ' FALLBACK' : '';
    const status = okAim && okP && okM ? 'OK  ' : 'FAIL';
    if (status === 'FAIL') fails++;

    console.log(
      status, 'lvl', String(n).padStart(3), 'seed', s,
      'attempts', String(lvl.generateAttempts).padStart(2),
      'ms', String(ms).padStart(4),
      'enemies', lvl.enemies.length,
      'walls', lvl.walls.length,
      'bounce', lvl.targetBounces,
      'mech[' + lvl.mechanics.join(',') + ']',
      fallback,
      status === 'FAIL' ? ('=> ' + res.status + '/' + res.failReason + ' tol:' + okP + ',' + okM) : ''
    );
  }
}

console.log('\nSummary: fails=' + fails + ' of ' + levels.length * seeds.length + ', total ' + totalMs + 'ms');
console.log(fails ? 'GENERATOR TEST FAILED' : 'GENERATOR TEST OK');
process.exit(fails ? 1 : 0);
