/* Сохранение и загрузка прогресса: node tests/test-save.js */
const { boot } = require('./harness.js');

let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ok   ' + name);
  else { fails++; console.log('  FAIL ' + name + (extra !== undefined ? ' -> ' + extra : '')); }
}

// 1) играем и выигрываем первый уровень
let H = boot();
let FS = H.win.FlexShot;
FS.startLevel(0, {});
H.tick(2);
const lvl = FS.game.level;
const pt = H.worldToClient(lvl.player.x + Math.cos(lvl.aim) * 300,
  lvl.player.y + Math.sin(lvl.aim) * 300);
H.dispatch('game', 'pointerdown', { clientX: pt.x, clientY: pt.y, pointerType: 'mouse', button: 0 });
for (let i = 0; i < 600 && FS.game.state.status === 'flying'; i++) H.tick(1, 16);
H.flushTimers(900);
check('уровень пройден', FS.game.state.status === 'win', FS.game.state.status);
const saved = H.localStorage.getItem('onebullet_save_v1');
check('сохранение записано', !!saved);

// 2) «перезагрузка страницы» с тем же localStorage
H = boot({ storage: { onebullet_save_v1: saved } });
FS = H.win.FlexShot;
const s = FS.getSave();
check('maxCleared восстановлен', s.maxCleared >= 0, s.maxCleared);
check('уровень восстановлен', s.levelIndex >= 1, s.levelIndex);
check('победы восстановлены', s.wins >= 1, s.wins);
check('меню показывает прогресс', /\d/.test(H.element('menuStats').textContent));

// 3) битый JSON не ломает игру
H = boot({ storage: { onebullet_save_v1: '{не json' } });
FS = H.win.FlexShot;
check('битое сохранение проигнорировано', FS.getSave().maxCleared === -1);
check('меню работает', H.element('screen-menu').classList.contains('active'));

// 4) сброс прогресса
H = boot({ storage: { onebullet_save_v1: saved } });
FS = H.win.FlexShot;
H.element('btnSettings').click();
H.element('btnReset').click();
check('прогресс сброшен', FS.getSave().maxCleared === -1);
const after = JSON.parse(H.localStorage.getItem('onebullet_save_v1'));
check('сброс сохранён', after.maxCleared === -1);

console.log(fails ? '\nSAVE TEST FAILED: ' + fails : '\nSAVE TEST OK');
process.exit(fails ? 1 : 0);
