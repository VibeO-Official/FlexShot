/* Проверка игрового процесса: победа, поражение, перезапуск,
   энергия управления. Запуск: node tests/test-gameplay.js */
const { boot } = require('./harness.js');
const H = boot();
const FS = H.win.FlexShot;
const el = H.element;

let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ok   ' + name);
  else { fails++; console.log('  FAIL ' + name + (extra !== undefined ? ' -> ' + extra : '')); }
}

check('публичный API доступен', !!FS && typeof FS.startLevel === 'function');

// ---------- победа ----------
FS.startLevel(0, {});
H.tick(2);
let g = FS.game;
const lvl = g.level;
check('уровень запущен', !!lvl && g.mode === 'playing');
check('статус aiming', g.state.status === 'aiming');

const winsBefore = FS.getSave().wins;
const sol = lvl.aim;
const p = lvl.player;
const target = H.worldToClient(p.x + Math.cos(sol) * 300, p.y + Math.sin(sol) * 300);
H.dispatch('game', 'pointermove', { clientX: target.x, clientY: target.y, pointerType: 'mouse' });
check('прицел следует за мышью', Math.abs(g.aim - sol) < 0.01, g.aim + ' vs ' + sol);

H.dispatch('game', 'pointerdown', {
  clientX: target.x, clientY: target.y, pointerType: 'mouse', button: 0
});
check('после клика пуля летит', g.state.status === 'flying');

for (let i = 0; i < 600 && g.state.status === 'flying'; i++) H.tick(1, 16);
check('уровень пройден', g.state.status === 'win', g.state.status + '/' + g.state.failReason);
H.flushTimers(900);
check('экран результата открыт', el('screen-result').classList.contains('active'));
check('победа записана', FS.getSave().wins === winsBefore + 1, FS.getSave().wins);
check('уровень открыт', FS.getSave().maxCleared >= 0);
check('следующий уровень указывает вперёд', FS.getSave().levelIndex === 1, FS.getSave().levelIndex);

// ---------- поражение ----------
FS.startLevel(0, {});
H.tick(2);
g = FS.game;
const left = H.worldToClient(g.level.player.x - 300, g.level.player.y);
H.dispatch('game', 'pointerdown', {
  clientX: left.x, clientY: left.y, pointerType: 'mouse', button: 0
});
for (let i = 0; i < 1200 && g.state.status === 'flying'; i++) H.tick(1, 16);
check('неудача зафиксирована', g.state.status === 'failed', g.state.status);
H.flushTimers(900);
check('серия сброшена', FS.getSave().streak === 0);

// ---------- перезапуск с тем же seed ----------
FS.startLevel(11, {});
const seed1 = FS.game.level.seed;
const layout1 = JSON.stringify(FS.game.level.walls.map(w => [w.x, w.y, w.w, w.h]));
FS.restartLevel();
const layout2 = JSON.stringify(FS.game.level.walls.map(w => [w.x, w.y, w.w, w.h]));
check('seed сохраняется', FS.game.level.seed === seed1);
check('схема уровня та же', layout1 === layout2);
check('прицел сброшен', FS.game.state.status === 'aiming');

// ---------- энергия управления ----------
FS.startLevel(20, {});
H.tick(2);
g = FS.game;
const e0 = g.state.energy;
const t2 = H.worldToClient(g.level.player.x + 300, g.level.player.y - 10);
H.dispatch('game', 'pointerdown', { clientX: t2.x, clientY: t2.y, pointerType: 'mouse', button: 0 });
H.key('keydown', 'a');
for (let i = 0; i < 40; i++) H.tick(1, 16);
H.key('keyup', 'a');
check('энергия тратится', g.state.energy < e0, e0 + ' -> ' + g.state.energy);
check('пуля не застревает в стене', isFinite(g.state.bullet.x) && isFinite(g.state.bullet.y));

// ---------- нельзя стрелять дважды ----------
const shotsBefore = g.state.shots;
H.dispatch('game', 'pointerdown', { clientX: t2.x, clientY: t2.y, pointerType: 'mouse', button: 0 });
check('второй выстрел запрещён', g.state.shots === shotsBefore, g.state.shots);

console.log(fails ? '\nGAMEPLAY TEST FAILED: ' + fails : '\nGAMEPLAY TEST OK');
process.exit(fails ? 1 : 0);
