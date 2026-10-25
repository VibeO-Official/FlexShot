const OB = require('../js/engine.js');
const Gen = require('../js/generator.js');

// Диагностика: где именно ломается сборка уровня
const index = Number(process.argv[2] || 0);
const seed = process.argv[3] || 'wtest#' + index;

for (let a = 1; a <= 6; a++) {
  const lvl = Gen.buildAttempt(index, seed, a);
  if (!lvl) { console.log(a, 'buildAttempt -> null'); continue; }
  const tol = lvl.aimTolerance * Math.PI / 180;
  const r0 = OB.simulate(lvl, lvl.aim);
  const rp = OB.simulate(lvl, lvl.aim + tol);
  const rm = OB.simulate(lvl, lvl.aim - tol);
  console.log(a, 'aim win', r0.win, r0.status, r0.failReason,
    'kills', r0.kills + '/' + r0.enemies, 'sw', r0.switches,
    '| +tol', rp.win, '| -tol', rm.win,
    '| en', lvl.enemies.length, 'walls', lvl.walls.length,
    'mech', lvl.mechanics.join(','),
    'maxB', lvl.maxBounces, 'bUsed', r0.bounces, 't', r0.time.toFixed(1), 'maxT', lvl.maxTime.toFixed(1));
}
