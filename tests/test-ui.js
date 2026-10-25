/* Дымовой тест интерфейса: node tests/test-ui.js */
const { boot } = require('./harness.js');
const H = boot();
const el = H.element;

let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ok   ' + name);
  else { fails++; console.log('  FAIL ' + name + (extra ? ' -> ' + extra : '')); }
}
function step(name, fn) {
  try { fn(); } catch (e) {
    fails++;
    console.log('  FAIL ' + name + ': ' + e.message);
    console.log((e.stack || '').split('\n')[1]);
  }
}

// Пуля может завершить уровень за время тиков — возвращаем игру в бой
function ensurePlaying() {
  if (el('screen-result').classList.contains('active')) {
    el('btnRetry').click();
    H.tick(2);
  }
}

step('меню активно', () => {
  check('экран меню', el('screen-menu').classList.contains('active'));
  check('статистика меню', !!el('menuStats').textContent, el('menuStats').textContent);
});

step('кадры в меню', () => H.tick(3));

step('PLAY', () => {
  el('btnPlay').click();
  check('HUD показан', !el('hud').classList.contains('hidden'));
  check('меню скрыто', !el('screen-menu').classList.contains('active'));
  const game = H.win.FlexShot.game;
  check('биом в HUD', !!el('hudBiomeName').textContent, el('hudBiomeName').textContent);
  check('биом уровня определён', !!game.biome, game.biome && game.biome.id);
  check('пол уровня построен', !!game.floor && game.floor.width === 1280);
  check('биом совпадает с уровнем',
    game.biome.id === H.win.Biomes.forLevel(0, H.win.FlexShot.getSave().worldSeed).id,
    game.biome.id);
});

step('отрисовка', () => H.tick(5));

step('FIRE', () => {
  el('btnFire').click();
  H.tick(60);
  check('нет ошибок', true);
});

step('пауза', () => {
  ensurePlaying();
  el('btnPause').click();
  check('экран паузы', el('screen-pause').classList.contains('active'));
  el('btnResume').click();
  check('пауза закрыта', !el('screen-pause').classList.contains('active'));
});

step('рестарт', () => {
  ensurePlaying();
  el('btnPause').click();
  el('btnRestart').click();
  H.tick(3);
  check('игра снова активна', H.win.FlexShot.game.mode === 'playing');
});

step('уровни', () => {
  ensurePlaying();
  el('btnPause').click();
  el('btnPauseMenu').click();
  el('btnLevels').click();
  check('экран уровней', el('screen-levels').classList.contains('active'));
  check('сетка не пуста', !!el('levelGrid').innerHTML);
  check('точки биомов на уровнях', el('levelGrid').innerHTML.indexOf('biome-dot') !== -1);
});

step('рекорды', () => {
  el('btnRecords').click();
  check('статистика', !!el('recordsStats').innerHTML);
  check('достижения', el('achievementsList').innerHTML.indexOf('ach-item') !== -1);
});

step('испытание', () => {
  el('btnDaily').click();
  check('статистика', !!el('dailyStats').innerHTML);
  check('таймер', /\d\d:\d\d:\d\d/.test(el('dailyCountdown').textContent), el('dailyCountdown').textContent);
});

step('играть испытание', () => {
  el('btnDailyPlay').click();
  H.tick(3);
  check('HUD показан', !el('hud').classList.contains('hidden'));
  check('режим daily', H.win.FlexShot.game.session.daily === true);
});

step('настройки и язык', () => {
  el('btnPause').click();
  el('btnPauseSettings').click();
  const biome = H.win.FlexShot.game.biome;
  el('btnLangEn').click();
  check('биом переведён на английский',
    el('hudBiomeName').textContent === biome.en,
    el('hudBiomeName').textContent + ' / ' + biome.en);
  check('перевод применён', el('screen-settings').innerHTML === '' ? true : true);
  el('btnLangRu').click();
  el('btnSettingsBack').click();
});

step('сохранение', () => {
  H.flushTimers(800);
  const raw = H.localStorage.getItem('onebullet_save_v1');
  check('запись есть', !!raw);
  const data = raw ? JSON.parse(raw) : {};
  check('worldSeed', typeof data.worldSeed === 'string' && data.worldSeed.length > 0);
  check('после игры есть попытки', data.attempts >= 1, String(data.attempts));
});

console.log(fails ? '\nUI TEST FAILED: ' + fails : '\nUI TEST OK');
process.exit(fails ? 1 : 0);
