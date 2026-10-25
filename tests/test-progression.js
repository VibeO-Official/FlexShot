/* Прогрессия: 12 уровней подряд, кнопка NEXT, достижения: node tests/test-progression.js */
const { boot } = require('./harness.js');
const H = boot();
const FS = H.win.FlexShot;
let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ok   ' + name);
  else { fails++; console.log('  FAIL ' + name + (extra !== undefined ? ' -> ' + extra : '')); }
}

function winCurrentLevel() {
  const lvl = FS.game.level;
  const pt = H.worldToClient(lvl.player.x + Math.cos(lvl.aim) * 300,
    lvl.player.y + Math.sin(lvl.aim) * 300);
  H.dispatch('game', 'pointerdown', { clientX: pt.x, clientY: pt.y, pointerType: 'mouse', button: 0 });
  for (let i = 0; i < 900 && FS.game.state.status === 'flying'; i++) H.tick(1, 16);
  H.flushTimers(900);
  return FS.game.state.status === 'win';
}

FS.startLevel(0, {});
H.tick(2);
check('первый уровень открыт', FS.game.level.index === 0);

for (let i = 0; i < 12; i++) {
  const won = winCurrentLevel();
  check('уровень ' + (i + 1) + ' пройден', won, FS.game.state.status + '/' + FS.game.state.failReason);
  check('экран результата', H.element('screen-result').classList.contains('active'));
  check('кнопка NEXT видна', !H.element('btnNext').classList.contains('hidden'));

  const before = FS.game.level.index;
  H.element('btnNext').click();
  H.tick(2);
  const after = FS.game.level.index;
  check('следующий уровень (seed меняется)', after === before + 1 && FS.game.level.seed !== 'w' + FS.getSave().worldSeed + '#' + before,
    before + ' -> ' + after);
  check('HUD снова виден', !H.element('hud').classList.contains('hidden'));
}

const save = FS.getSave();
check('побед 12', save.wins === 12, save.wins);
check('maxCleared = 11', save.maxCleared === 11, save.maxCleared);
check('серия 12', save.streak === 12, save.streak);
check('лучшая серия 12', save.bestStreak === 12, save.bestStreak);
check('достижения открылись', Object.keys(save.achievements).length >= 3,
  JSON.stringify(save.achievements));
check('рекорды сохранены', Object.keys(save.bestScores).length === 12, Object.keys(save.bestScores).length);

// повторное прохождение уровня обновляет лучший счёт, но не ломает прогресс
const lvl10 = 9;
FS.startLevel(lvl10, {});
H.tick(2);
winCurrentLevel();
check('повтор не уменьшает прогресс', FS.getSave().maxCleared >= 11, FS.getSave().maxCleared);
check('bestScores на месте', !!FS.getSave().bestScores[lvl10]);

console.log(fails ? '\nPROGRESSION TEST FAILED: ' + fails : '\nPROGRESSION TEST OK');
process.exit(fails ? 1 : 0);
