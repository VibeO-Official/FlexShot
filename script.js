/* =========================================================
   ONE BULLET / FlexShot — script.js
   Игра, интерфейс, ввод, отрисовка, сохранения, ежедневные
   испытания, достижения и связка с Yandex Games SDK.
   ========================================================= */
(function () {
  'use strict';

  const OB = window.OB;
  const Gen = window.Gen;
  const Yandex = window.Yandex;
  const Biomes = window.Biomes;
  const Art = window.Art;
  const W = OB.W, H = OB.H;
  const SIM_DT = 1 / 120;
  const STORAGE_KEY = 'onebullet_save_v1';
  const PER_PAGE = 24;

  const COLORS = {
    bg: '#0B0D12', field: '#151923', wall: '#303746', wallFill: '#1A202C',
    bullet: '#FFFFFF', accent: '#FF6B35', enemy: '#FF3B5C', mech: '#38E8FF',
    text: '#E8EDF7', muted: '#7C8698'
  };

  // =========================================================
  // Локализация
  // =========================================================
  const TEXTS = {
    ru: {
      'menu.tagline': 'Одна пуля. Бесконечные миры.',
      'menu.play': 'ИГРАТЬ',
      'menu.levels': 'УРОВНИ',
      'menu.daily': 'ИСПЫТАНИЕ',
      'menu.records': 'РЕКОРДЫ',
      'menu.settings': 'НАСТРОЙКИ',
      'menu.note': 'Прогресс сохраняется в браузере',
      'menu.progress': 'УРОВЕНЬ {n} · ПРОЙДЕНО {w} · СЕРИЯ {s}',
      'hud.energy': 'ЭНЕРГИЯ',
      'hud.fire': 'FIRE',
      'levels.title': 'УРОВНИ',
      'levels.more': 'Новые арены генерируются бесконечно.',
      'levels.locked': 'Уровень закрыт. Пройдите предыдущие.',
      'daily.title': 'ИСПЫТАНИЕ ДНЯ',
      'daily.next': 'До нового испытания',
      'daily.note': 'Одно и то же испытание для всех игроков. Сложность зависит от даты.',
      'daily.play': 'ИГРАТЬ ИСПЫТАНИЕ',
      'daily.best': 'Лучшая попытка',
      'daily.attempts': 'Попыток сегодня',
      'daily.wins': 'Пройдено сегодня',
      'daily.streak': 'Дней подряд',
      'records.title': 'РЕКОРДЫ',
      'records.achievements': 'ДОСТИЖЕНИЯ',
      'settings.title': 'НАСТРОЙКИ',
      'settings.sound': 'Звук',
      'settings.volume': 'Громкость',
      'settings.fx': 'Меньше эффектов',
      'settings.lang': 'Язык',
      'settings.reset': 'СБРОСИТЬ ПРОГРЕСС',
      'settings.resetNote': 'Сброс удалит открытые уровни, рекорды и достижения.',
      'settings.resetDone': 'Прогресс сброшен',
      'pause.title': 'ПАУЗА',
      'pause.resume': 'ПРОДОЛЖИТЬ',
      'pause.restart': 'ЗАНОВО',
      'pause.menu': 'В МЕНЮ',
      'result.win': 'УРОВЕНЬ ПРОЙДЕН',
      'result.fail': 'НЕУДАЧА',
      'result.next': 'СЛЕДУЮЩИЙ УРОВЕНЬ',
      'result.retry': 'ЕЩЁ РАЗ',
      'result.dailyWin': 'ИСПЫТАНИЕ ПРОЙДЕНО',
      'result.dailyFail': 'ИСПЫТАНИЕ НЕ ПРОЙДЕНО',
      'result.score': 'ОЧКИ',
      'result.bounces': 'РИКОШЕТЫ',
      'result.energy': 'ЭНЕРГИЯ',
      'result.time': 'ВРЕМЯ',
      'result.shots': 'ВЫСТРЕЛЫ',
      'result.newRecord': 'НОВЫЙ РЕКОРД',
      'stat.level': 'Текущий уровень',
      'stat.cleared': 'Пройдено уровней',
      'stat.wins': 'Побед',
      'stat.attempts': 'Попыток',
      'stat.streak': 'Серия',
      'stat.bestStreak': 'Лучшая серия',
      'stat.achievements': 'Достижения',
      'stat.bounces': 'Рикошетов',
      'fail.blocked': 'Пуля попала в блок-поглотитель.',
      'fail.ricochets': 'Закончились рикошеты.',
      'fail.time': 'Время вышло.',
      'fail.distance': 'Пуля слишком долго летела.',
      'fail.escaped': 'Пуля покинула арену.',
      'fail.miss': 'Цели остались целы.',
      'hint.first': 'Прицельтесь мышью и выстрелите. Убить нужно всех врагов.',
      'hint.bounce': 'Стены отражают пулю. Постройте траекторию через рикошеты.',
      'hint.steer': 'В полёте: A/D — подруливать, W/S — скорость. Это тратит энергию.',
      'hint.bouncy': 'Оранжевые стены ускоряют пулю, фиолетовые — гасят.',
      'hint.switch': 'Активируйте переключатель: он открывает дверь на пути.',
      'hint.block': 'Тёмные блоки с красной штриховкой поглощают пулю.',
      'hint.glass': 'Стекло ломается от попадания, и пуля летит дальше.',
      'hint.portal': 'Телепорт выбрасывает пулю с другой стороны, сохраняя направление.',
      'hint.well': 'Фиолетовые колодцы закручивают пулю. Держитесь от них подальше.',
      'hint.patrol': 'Враги двигаются. Цельтесь с упреждением.',
      'hint.energy': 'Энергия управления ограничена. Планируйте выстрел заранее.',
      'hint.ricochets': 'Число рикошетов ограничено — следите за счётчиком.',
      'biome.label': 'БИОМ',
      'biome.new': 'Новый биом: {name}',
      'ui.rotate': 'Поверните устройство горизонтально',
      'ach.unlocked': 'ДОСТИЖЕНИЕ: {name}'
    },
    en: {
      'menu.tagline': 'One bullet. Endless worlds.',
      'menu.play': 'PLAY',
      'menu.levels': 'LEVELS',
      'menu.daily': 'DAILY',
      'menu.records': 'RECORDS',
      'menu.settings': 'SETTINGS',
      'menu.note': 'Progress is saved in your browser',
      'menu.progress': 'LEVEL {n} · CLEARED {w} · STREAK {s}',
      'hud.energy': 'ENERGY',
      'hud.fire': 'FIRE',
      'levels.title': 'LEVELS',
      'levels.more': 'New arenas are generated endlessly.',
      'levels.locked': 'Level locked. Clear the previous ones.',
      'daily.title': 'DAILY CHALLENGE',
      'daily.next': 'Next challenge in',
      'daily.note': 'Same challenge for every player. Difficulty depends on the date.',
      'daily.play': 'PLAY DAILY',
      'daily.best': 'Best attempts',
      'daily.attempts': 'Attempts today',
      'daily.wins': 'Cleared today',
      'daily.streak': 'Day streak',
      'records.title': 'RECORDS',
      'records.achievements': 'ACHIEVEMENTS',
      'settings.title': 'SETTINGS',
      'settings.sound': 'Sound',
      'settings.volume': 'Volume',
      'settings.fx': 'Fewer effects',
      'settings.lang': 'Language',
      'settings.reset': 'RESET PROGRESS',
      'settings.resetNote': 'This deletes unlocked levels, records and achievements.',
      'settings.resetDone': 'Progress reset',
      'pause.title': 'PAUSED',
      'pause.resume': 'RESUME',
      'pause.restart': 'RESTART',
      'pause.menu': 'MENU',
      'result.win': 'LEVEL CLEARED',
      'result.fail': 'FAILED',
      'result.next': 'NEXT LEVEL',
      'result.retry': 'TRY AGAIN',
      'result.dailyWin': 'DAILY CLEARED',
      'result.dailyFail': 'DAILY FAILED',
      'result.score': 'SCORE',
      'result.bounces': 'BOUNCES',
      'result.energy': 'ENERGY',
      'result.time': 'TIME',
      'result.shots': 'SHOTS',
      'result.newRecord': 'NEW RECORD',
      'stat.level': 'Current level',
      'stat.cleared': 'Levels cleared',
      'stat.wins': 'Wins',
      'stat.attempts': 'Attempts',
      'stat.streak': 'Streak',
      'stat.bestStreak': 'Best streak',
      'stat.achievements': 'Achievements',
      'stat.bounces': 'Bounces',
      'fail.blocked': 'The bullet hit an absorber block.',
      'fail.ricochets': 'Out of ricochets.',
      'fail.time': 'Time is up.',
      'fail.distance': 'The bullet flew too long.',
      'fail.escaped': 'The bullet left the arena.',
      'fail.miss': 'Targets are still alive.',
      'hint.first': 'Aim with the mouse and fire. Every enemy must die.',
      'hint.bounce': 'Walls reflect the bullet. Build your path with ricochets.',
      'hint.steer': 'In flight: A/D steer, W/S change speed. It drains energy.',
      'hint.bouncy': 'Orange walls speed the bullet up, purple walls slow it down.',
      'hint.switch': 'Hit the switch to open the door blocking your path.',
      'hint.block': 'Dark blocks with red hatching absorb the bullet.',
      'hint.glass': 'Glass shatters on impact and the bullet keeps flying.',
      'hint.portal': 'A portal teleports the bullet, keeping its direction.',
      'hint.well': 'Purple wells bend the bullet. Keep your path away from them.',
      'hint.patrol': 'Enemies move. Lead your shot.',
      'hint.energy': 'Steering energy is limited. Plan the shot.',
      'hint.ricochets': 'Ricochets are limited — watch the counter.',
      'biome.label': 'BIOME',
      'biome.new': 'New biome: {name}',
      'ui.rotate': 'Rotate your device to landscape',
      'ach.unlocked': 'ACHIEVEMENT: {name}'
    }
  };

  let lang = 'ru';

  function t(key, vars) {
    const table = TEXTS[lang] || TEXTS.ru;
    let str = table[key] != null ? table[key] : (TEXTS.ru[key] != null ? TEXTS.ru[key] : key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        str = str.replace('{' + k + '}', vars[k]);
      });
    }
    return str;
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.documentElement.lang = lang;
  }

  // =========================================================
  // Сохранение прогресса (localStorage + облако при наличии SDK)
  // =========================================================
  function randomSeed() {
    return Math.random().toString(36).slice(2, 10);
  }

  function defaultSave() {
    return {
      version: 1,
      worldSeed: randomSeed(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      levelIndex: 0,
      maxCleared: -1,
      wins: 0,
      attempts: 0,
      streak: 0,
      bestStreak: 0,
      totalBounces: 0,
      bestScores: {},
      achievements: {},
      seenTips: {},
      seenBiomes: {},
      daily: { date: '', attempts: 0, wins: 0, bestAttempts: 0, bestScore: 0, streakDays: 0, lastWinDate: '' },
      settings: { sound: true, volume: 0.7, lang: '', reducedFx: false }
    };
  }

  function mergeSave(raw) {
    const base = defaultSave();
    if (!raw || typeof raw !== 'object') return base;

    Object.keys(base).forEach(function (k) {
      if (raw[k] === undefined || raw[k] === null) return;
      if (k === 'settings' || k === 'daily' || k === 'bestScores' ||
          k === 'achievements' || k === 'seenTips' || k === 'seenBiomes') {
        if (typeof raw[k] === 'object') {
          Object.keys(raw[k]).forEach(function (kk) { base[k][kk] = raw[k][kk]; });
        }
      } else if (typeof base[k] === typeof raw[k]) {
        base[k] = raw[k];
      }
    });

    ['levelIndex', 'maxCleared', 'wins', 'attempts', 'streak', 'bestStreak', 'totalBounces']
      .forEach(function (k) {
        if (typeof base[k] !== 'number' || !isFinite(base[k]) || base[k] < 0) base[k] = 0;
      });
    if (!base.worldSeed) base.worldSeed = randomSeed();
    return base;
  }

  let save = defaultSave();
  let storageOk = true;
  let saveTimer = 0;

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      save = mergeSave(raw ? JSON.parse(raw) : null);
    } catch (e) {
      storageOk = false;
      save = defaultSave();
    }
  }

  function persist(immediate) {
    save.updatedAt = Date.now();
    if (saveTimer) clearTimeout(saveTimer);
    const write = function () {
      saveTimer = 0;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); }
      catch (e) { storageOk = false; }
      if (storageOk && Yandex) Yandex.save(save);
    };
    if (immediate) write();
    else saveTimer = setTimeout(write, 400);
  }

  // =========================================================
  // Достижения (расширяемый список)
  // =========================================================
  const ACHIEVEMENTS = [
    { id: 'first', icon: '🎯', ru: 'Первый выстрел в цель', en: 'First blood',
      descRu: 'Пройдите первый уровень', descEn: 'Clear your first level',
      check: function (s) { return s.wins >= 1; } },
    { id: 'wins10', icon: '⚡', ru: 'Десять побед', en: 'Ten wins',
      descRu: 'Пройдите 10 уровней', descEn: 'Clear 10 levels',
      check: function (s) { return s.wins >= 10; } },
    { id: 'wins50', icon: '🔥', ru: 'Пятьдесят побед', en: 'Fifty wins',
      descRu: 'Пройдите 50 уровней', descEn: 'Clear 50 levels',
      check: function (s) { return s.wins >= 50; } },
    { id: 'wins200', icon: '👑', ru: 'Легенда рикошета', en: 'Ricochet legend',
      descRu: 'Пройдите 200 уровней', descEn: 'Clear 200 levels',
      check: function (s) { return s.wins >= 200; } },
    { id: 'levels10', icon: '🧭', ru: 'Разгон', en: 'Warming up',
      descRu: 'Откройте 10-й уровень', descEn: 'Reach level 10',
      check: function (s) { return s.maxCleared + 1 >= 10; } },
    { id: 'levels25', icon: '🌌', ru: 'Глубже в арену', en: 'Deeper',
      descRu: 'Откройте 25-й уровень', descEn: 'Reach level 25',
      check: function (s) { return s.maxCleared + 1 >= 25; } },
    { id: 'levels50', icon: '🛰', ru: 'Орбита', en: 'Orbit',
      descRu: 'Откройте 50-й уровень', descEn: 'Reach level 50',
      check: function (s) { return s.maxCleared + 1 >= 50; } },
    { id: 'levels100', icon: '♾', ru: 'Бесконечность', en: 'Infinity',
      descRu: 'Откройте 100-й уровень', descEn: 'Reach level 100',
      check: function (s) { return s.maxCleared + 1 >= 100; } },
    { id: 'streak5', icon: '🚀', ru: 'Серия из пяти', en: 'Five in a row',
      descRu: 'Пройдите 5 уровней без поражений', descEn: 'Clear 5 levels without a loss',
      check: function (s) { return s.bestStreak >= 5; } },
    { id: 'streak10', icon: '💎', ru: 'Серия из десяти', en: 'Ten in a row',
      descRu: 'Пройдите 10 уровней без поражений', descEn: 'Clear 10 levels without a loss',
      check: function (s) { return s.bestStreak >= 10; } },
    { id: 'oneshot', icon: '🥇', ru: 'Один выстрел', en: 'One shot',
      descRu: 'Пройдите уровень с первого выстрела', descEn: 'Clear a level with your first shot',
      check: function (s, c) { return c && c.shots === 1 && c.fails === 0; } },
    { id: 'bounce5', icon: '🎱', ru: 'Мастер рикошета', en: 'Ricochet master',
      descRu: 'Пройдите уровень с 5+ рикошетами', descEn: 'Clear a level with 5+ bounces',
      check: function (s, c) { return c && c.bounces >= 5; } },
    { id: 'daily1', icon: '📅', ru: 'Испытание дня', en: 'Daily player',
      descRu: 'Пройдите ежедневное испытание', descEn: 'Clear a daily challenge',
      check: function (s) { return (s.daily.wins || 0) >= 1; } },
    { id: 'daily7', icon: '🗓', ru: 'Неделя испытаний', en: 'Daily week',
      descRu: 'Проходите испытания 7 дней подряд', descEn: 'Clear daily challenges 7 days in a row',
      check: function (s) { return (s.daily.streakDays || 0) >= 7; } }
  ];

  function checkAchievements(win, ctx) {
    if (!win) return;
    let any = false;
    ACHIEVEMENTS.forEach(function (a) {
      if (save.achievements[a.id]) return;
      let ok = false;
      try { ok = a.check(save, ctx); } catch (e) { ok = false; }
      if (ok) {
        save.achievements[a.id] = Date.now();
        any = true;
        toast(t('ach.unlocked', { name: lang === 'ru' ? a.ru : a.en }), 2600);
        Audio.sfx('ach');
      }
    });
    if (any) persist(true);
  }

  // =========================================================
  // Звук (Web Audio API, короткие синтезированные эффекты)
  // =========================================================
  const Audio = {
    ctx: null, master: null, ready: false,

    unlock: function () {
      if (this.ready) {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = save.settings.sound ? save.settings.volume : 0;
        this.master.connect(this.ctx.destination);
        this.ready = true;
      } catch (e) { this.ready = false; }
    },

    setVolume: function () {
      if (!this.ready || !this.master) return;
      this.master.gain.value = save.settings.sound ? save.settings.volume : 0;
    },

    tone: function (freq, dur, type, gain, slideTo) {
      if (!this.ready || !save.settings.sound) return;
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), ctx.currentTime + dur);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(gain || 0.15, ctx.currentTime + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    },

    noise: function (dur, gain) {
      if (!this.ready || !save.settings.sound) return;
      const ctx = this.ctx;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      g.gain.value = gain || 0.12;
      src.buffer = buffer;
      src.connect(g);
      g.connect(this.master);
      src.start();
    },

    sfx: function (name) {
      if (!this.ready || !save.settings.sound) return;
      switch (name) {
        case 'fire': this.tone(680, 0.16, 'square', 0.1, 180); break;
        case 'bounce': this.tone(320, 0.07, 'triangle', 0.08, 220); break;
        case 'bouncy': this.tone(520, 0.09, 'triangle', 0.09, 760); break;
        case 'soft': this.tone(180, 0.1, 'sine', 0.07, 120); break;
        case 'kill': this.tone(150, 0.22, 'sawtooth', 0.1, 60); this.noise(0.16, 0.08); break;
        case 'switch': this.tone(880, 0.12, 'sine', 0.1, 1320); break;
        case 'door': this.tone(300, 0.2, 'sine', 0.08, 520); break;
        case 'portal': this.tone(420, 0.22, 'sine', 0.09, 1200); break;
        case 'break': this.noise(0.2, 0.12); this.tone(900, 0.1, 'triangle', 0.06, 400); break;
        case 'win':
          this.tone(523, 0.14, 'triangle', 0.11);
          setTimeout(this.tone.bind(this, 659, 0.14, 'triangle', 0.11), 110);
          setTimeout(this.tone.bind(this, 784, 0.24, 'triangle', 0.12), 220);
          break;
        case 'lose': this.tone(220, 0.3, 'sawtooth', 0.09, 90); break;
        case 'click': this.tone(420, 0.05, 'square', 0.05); break;
        case 'ach':
          this.tone(784, 0.12, 'sine', 0.1);
          setTimeout(this.tone.bind(this, 1046, 0.2, 'sine', 0.1), 120);
          break;
      }
    }
  };

  // =========================================================
  // DOM и базовые помощники
  // =========================================================
  const $ = function (id) { return document.getElementById(id); };

  const dom = {
    canvas: $('game'),
    hud: $('hud'),
    hudLevel: $('hudLevel'),
    hudBiome: $('hudBiome'),
    hudBiomeIcon: $('hudBiomeIcon'),
    hudBiomeName: $('hudBiomeName'),
    hudBounces: $('hudBounces'),
    hudBouncesVal: $('hudBouncesVal'),
    hudEnemies: $('hudEnemies'),
    hudEnemiesVal: $('hudEnemiesVal'),
    hudEnergyVal: $('hudEnergyVal'),
    hudEnergyFill: $('hudEnergyFill'),
    hint: $('hint'),
    hintText: $('hintText'),
    toasts: $('toasts'),
    touch: $('touch'),
    btnFire: $('btnFire'),
    btnFireTouch: $('btnFireTouch'),
    menuStats: $('menuStats'),
    levelGrid: $('levelGrid'),
    levelsPageLabel: $('levelsPageLabel'),
    recordsStats: $('recordsStats'),
    achievementsList: $('achievementsList'),
    dailyDate: $('dailyDate'),
    dailyLevel: $('dailyLevel'),
    dailyCountdown: $('dailyCountdown'),
    dailyStats: $('dailyStats'),
    resultBadge: $('resultBadge'),
    resultTitle: $('resultTitle'),
    resultSub: $('resultSub'),
    resultStats: $('resultStats'),
    btnNext: $('btnNext'),
    btnRetry: $('btnRetry'),
    toggleSound: $('toggleSound'),
    rangeVolume: $('rangeVolume'),
    toggleFx: $('toggleFx'),
    btnLangRu: $('btnLangRu'),
    btnLangEn: $('btnLangEn')
  };

  const ctx = dom.canvas.getContext('2d', { alpha: false });

  // =========================================================
  // Уведомления и подсказки
  // =========================================================
  function toast(text, ms) {
    if (!dom.toasts) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    dom.toasts.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 320);
    }, ms || 1800);
  }

  let hintTimer = 0;

  function showHint(text, ms) {
    if (!dom.hint) return;
    dom.hintText.textContent = text;
    dom.hint.classList.remove('hidden');
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(hideHint, ms || 6500);
  }

  function hideHint() {
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = 0; }
    if (dom.hint) dom.hint.classList.add('hidden');
  }

  // =========================================================
  // Экраны
  // =========================================================
  const SCREEN_IDS = {
    menu: 'screen-menu', levels: 'screen-levels', daily: 'screen-daily',
    records: 'screen-records', settings: 'screen-settings',
    pause: 'screen-pause', result: 'screen-result'
  };

  function showScreen(name) {
    Game.screen = name;
    Object.keys(SCREEN_IDS).forEach(function (key) {
      const el = $(SCREEN_IDS[key]);
      if (el) el.classList.toggle('active', key === name);
    });
  }

  function hideScreens() {
    Game.screen = null;
    Object.keys(SCREEN_IDS).forEach(function (key) {
      const el = $(SCREEN_IDS[key]);
      if (el) el.classList.remove('active');
    });
  }

  // =========================================================
  // Состояние игры
  // =========================================================
  const Game = {
    mode: 'menu',          // menu | playing | paused | result
    screen: 'menu',
    level: null,
    levelIndex: 0,
    biome: null,
    floor: null,
    state: null,
    aim: 0,
    preview: null,
    previewBounces: 0,
    acc: 0,
    recoil: 0,
    clock: 0,
    fx: { particles: [], rings: [], shake: 0, flash: 0, flashColor: COLORS.enemy, slow: 0, slowTarget: 0 },
    keys: { left: false, right: false, fast: false, slow: false },
    session: null,
    result: null,
    timers: [],
    prefetched: {},
    settingsFrom: 'menu',
    adBusy: false,
    levelsSinceAd: 0
  };

  function clearTimers() {
    Game.timers.forEach(function (id) { clearTimeout(id); });
    Game.timers.length = 0;
  }

  function later(fn, ms) {
    const id = setTimeout(fn, ms);
    Game.timers.push(id);
    return id;
  }

  // =========================================================
  // Ежедневное испытание (одинаково для всех в один день, UTC)
  // =========================================================
  function utcDateKey(d) {
    const date = d || new Date();
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function dailyIndex() {
    // 31..100 — уровни повышенной сложности, одинаковые для всех игроков
    return 30 + (Gen.hash('daily:' + utcDateKey()) % 70);
  }

  function dailySeed() {
    return 'daily-' + utcDateKey();
  }

  function refreshDaily() {
    const key = utcDateKey();
    if (!save.daily || save.daily.date !== key) {
      save.daily = {
        date: key,
        attempts: 0,
        wins: 0,
        bestAttempts: (save.daily && save.daily.bestAttempts) || 0,
        bestScore: (save.daily && save.daily.bestScore) || 0,
        streakDays: (save.daily && save.daily.streakDays) || 0,
        lastWinDate: (save.daily && save.daily.lastWinDate) || ''
      };
      persist();
    }
  }

  // =========================================================
  // Запуск уровня
  // =========================================================
  function prefetch(index) {
    if (index < 0 || Game.prefetched[index]) return;
    const run = function () {
      try {
        const lvl = Gen.generate(index, { worldSeed: save.worldSeed });
        Game.prefetched[index] = true;
        if (Art && Biomes) {
          const biome = Biomes.byId(lvl.biome || Biomes.forLevel(lvl.index, save.worldSeed).id);
          // Заранее готовим пол и спрайты деревьев — переход без рывка
          floorFor(lvl, biome);
          for (let i = 0; i < lvl.walls.length; i++) {
            const wall = lvl.walls[i];
            if (wall.id === 'bT' || wall.id === 'bB' || wall.id === 'bL' || wall.id === 'bR') continue;
            Art.treeSprite(wall, biome);
          }
        }
      } catch (e) { /* генерация повторится при запуске */ }
    };
    // Готовим следующий уровень в простое, чтобы не ронять FPS
    if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 1500 });
    else setTimeout(run, 250);
  }

  function startLevel(index, opts) {
    opts = opts || {};
    clearTimers();
    hideHint();

    const daily = !!opts.daily;
    const lvl = daily
      ? Gen.generate(dailyIndex(), { seed: dailySeed(), worldSeed: save.worldSeed })
      : Gen.generate(index, { worldSeed: save.worldSeed });

    Game.level = lvl;
    Game.levelIndex = index;
    Game.state = OB.createState(lvl);

    // Биом и его пол рисуются кодом (см. js/biomes.js и js/art.js)
    const biome = Biomes
      ? Biomes.byId(lvl.biome || Biomes.forLevel(lvl.index, save.worldSeed).id)
      : null;
    Game.biome = biome;
    Game.floor = biome ? floorFor(lvl, biome) : null;
    Game.aim = Math.atan2(H / 2 - lvl.player.y, W / 2 - lvl.player.x);
    Game.previewBounces = lvl.previewBounces || 0;
    Game.acc = 0;
    Game.recoil = 0;
    applyBiomeUI(biome);
    Game.session = {
      index: index, daily: daily, shots: 0, fails: 0,
      usedSteer: false, startedAt: Date.now(), done: false
    };
    Game.result = null;
    Game.fx.particles.length = 0;
    Game.fx.rings.length = 0;
    Game.fx.shake = 0;
    Game.fx.slow = 0;
    Game.fx.flash = 0.3;
    Game.fx.flashColor = COLORS.mech;
    Game.keys.left = Game.keys.right = Game.keys.fast = Game.keys.slow = false;

    Game.mode = 'playing';
    hideScreens();
    dom.hud.classList.remove('hidden');
    updateTouchVisibility();
    recomputePreview();
    updateHUD();
    showLevelTip(lvl);

    if (biome && !save.seenBiomes[biome.id]) {
      save.seenBiomes[biome.id] = 1;
      persist();
      if (!daily) toast(t('biome.new', { name: Biomes.name(biome, lang) }), 2200);
    }

    if (!daily) {
      save.levelIndex = index;
      persist(true);
      prefetch(index + 1);
    }

    Audio.unlock();
    if (Yandex) Yandex.gameplayStart();
  }

  function restartLevel() {
    if (!Game.session) return;
    startLevel(Game.levelIndex, { daily: Game.session.daily });
  }

  // Обучение: подсказка о новой механике показывается один раз
  function showLevelTip(lvl) {
    const tips = [];
    if (lvl.index === 0) tips.push('hint.first');
    if (lvl.index === 1) tips.push('hint.bounce');
    if (lvl.index === 2) tips.push('hint.steer');

    const mech = lvl.mechanics || [];
    if (mech.indexOf('block') !== -1) tips.push('hint.block');
    if (mech.indexOf('bouncy') !== -1) tips.push('hint.bouncy');
    if (mech.indexOf('door') !== -1) tips.push('hint.switch');
    if (mech.indexOf('glass') !== -1) tips.push('hint.glass');
    if (mech.indexOf('portal') !== -1) tips.push('hint.portal');
    if (mech.indexOf('well') !== -1) tips.push('hint.well');
    if (mech.indexOf('patrol') !== -1 || mech.indexOf('orbit') !== -1) tips.push('hint.patrol');
    if (lvl.index >= 15 && lvl.energyMax < 500) tips.push('hint.energy');
    if (lvl.maxBounces <= 4) tips.push('hint.ricochets');

    for (let i = 0; i < tips.length; i++) {
      const key = tips[i];
      if (save.seenTips[key]) continue;
      save.seenTips[key] = 1;
      persist();
      showHint(t(key), 7000);
      return;
    }
  }

  // =========================================================
  // Выстрел
  // =========================================================
  function fire() {
    if (Game.mode !== 'playing' || !Game.state) return;
    if (Game.state.status !== 'aiming') return;

    Audio.unlock();
    Audio.sfx('fire');
    if (!OB.fire(Game.state, Game.aim)) return;

    Game.session.shots++;
    Game.recoil = 1;
    save.attempts++;
    if (Game.session.daily) save.daily.attempts = (save.daily.attempts || 0) + 1;
    persist();
    hideHint();
    spawnMuzzle();
    updateHUD();
  }

  function computeScore(st, lvl, session) {
    const cap = Math.min(100, lvl.energyMax != null ? lvl.energyMax : 100);
    const energyRatio = cap > 0 ? Math.max(0, Math.min(1, st.energy / cap)) : 0;
    const base = 600 + st.bullet.bounces * 140 + Math.round(energyRatio * 260);
    return base + (session.shots === 1 ? 250 : 0);
  }

  // Ограничиваем размер таблицы рекордов (бесконечные уровни)
  function pruneBestScores() {
    const keys = Object.keys(save.bestScores);
    if (keys.length <= 400) return;
    keys.sort(function (a, b) { return Number(a) - Number(b); });
    for (let i = 0; i < keys.length - 400; i++) delete save.bestScores[keys[i]];
  }

  // =========================================================
  // Победа / поражение
  // =========================================================
  function onWin() {
    if (!Game.session || Game.session.done) return;
    Game.session.done = true;
    const st = Game.state;
    const lvl = Game.level;
    const score = computeScore(st, lvl, Game.session);

    save.wins++;
    save.streak++;
    save.bestStreak = Math.max(save.bestStreak, save.streak);
    save.totalBounces += st.bullet.bounces;

    let record = false;
    if (!Game.session.daily) {
      const prev = save.bestScores[lvl.index] || 0;
      if (score > prev) { save.bestScores[lvl.index] = score; record = prev > 0; }
      pruneBestScores();
      save.maxCleared = Math.max(save.maxCleared, lvl.index);
      save.levelIndex = lvl.index + 1;
    } else {
      save.daily.wins = (save.daily.wins || 0) + 1;
      const prevBest = save.daily.bestAttempts || 0;
      if (!prevBest || Game.session.shots < prevBest) save.daily.bestAttempts = Game.session.shots;
      if (score > (save.daily.bestScore || 0)) save.daily.bestScore = score;

      const today = utcDateKey();
      if (save.daily.lastWinDate !== today) {
        const yesterday = utcDateKey(new Date(Date.now() - 86400000));
        save.daily.streakDays = (save.daily.lastWinDate === yesterday)
          ? (save.daily.streakDays || 0) + 1 : 1;
        save.daily.lastWinDate = today;
      }
    }

    Game.result = {
      win: true, daily: Game.session.daily, score: score, record: record,
      bounces: st.bullet.bounces, energy: Math.max(0, Math.round(st.energy)),
      time: st.t, shots: Game.session.shots, index: lvl.index
    };

    checkAchievements(true, {
      shots: Game.session.shots, fails: Game.session.fails,
      bounces: st.bullet.bounces, energy: st.energy
    });
    persist(true);

    Audio.sfx('win');
    burst(st.bullet.x, st.bullet.y, COLORS.mech, 42, 340);
    Game.fx.rings.push({ x: st.bullet.x, y: st.bullet.y, r: 6, max: 190, color: COLORS.mech, life: 1 });
    Game.fx.flash = 0.5;
    Game.fx.flashColor = COLORS.mech;
    Game.mode = 'result';
    if (Yandex) Yandex.gameplayStop();

    later(function () { showResult(true); }, 520);
  }

  function onLose() {
    if (!Game.session || Game.session.done) return;
    Game.session.done = true;
    Game.session.fails++;
    save.streak = 0;
    persist();

    const st = Game.state;
    Game.result = {
      win: false, daily: Game.session.daily,
      reason: st.failReason || 'miss',
      bounces: st.bullet.bounces,
      shots: Game.session.shots,
      index: Game.level.index
    };

    Audio.sfx('lose');
    Game.fx.shake = 1;
    Game.fx.flash = 0.35;
    Game.fx.flashColor = COLORS.enemy;
    Game.mode = 'result';
    if (Yandex) Yandex.gameplayStop();

    later(function () { showResult(false); }, 620);
  }

  // =========================================================
  // Пауза, меню, следующий уровень
  // =========================================================
  function pauseGame() {
    if (Game.mode !== 'playing') return;
    Game.mode = 'paused';
    Game.keys.left = Game.keys.right = Game.keys.fast = Game.keys.slow = false;
    showScreen('pause');
    if (Yandex) Yandex.gameplayStop();
  }

  function resumeGame() {
    if (Game.mode !== 'paused') return;
    Game.mode = 'playing';
    hideScreens();
    updateTouchVisibility();
    if (Yandex) Yandex.gameplayStart();
  }

  function goMenu() {
    clearTimers();
    Game.mode = 'menu';
    Game.state = null;
    Game.level = null;
    Game.session = null;
    Game.result = null;
    hideScreens();
    dom.hud.classList.add('hidden');
    if (dom.touch) dom.touch.classList.add('hidden');
    if (Yandex) Yandex.gameplayStop();
    refreshMenu();
    showScreen('menu');
  }

  // Переход к следующему уровню.
  // Реклама (если SDK подключён) — только здесь, между уровнями.
  function nextLevel() {
    if (Game.adBusy) return;
    if (!Game.session || Game.session.daily) { goMenu(); return; }

    const next = Game.levelIndex + 1;
    Audio.sfx('click');

    // Реклама — не чаще, чем раз в 3 перехода и не раньше 3-го уровня.
    // Плюс собственный интервал в yandex.js (90 секунд).
    Game.levelsSinceAd = (Game.levelsSinceAd || 0) + 1;
    const adAllowed = Game.levelsSinceAd >= 3 && Game.levelIndex >= 2;

    if (adAllowed && Yandex && Yandex.canShowAd()) {
      Game.adBusy = true;
      Game.levelsSinceAd = 0;
      Yandex.interstitial().then(function () {
        Game.adBusy = false;
        startLevel(next, {});
      });
    } else {
      startLevel(next, {});
    }
  }

  // =========================================================
  // Частицы и эффекты
  // =========================================================
  function burst(x, y, color, count, speed) {
    const n = Math.max(4, Math.round(count * (save.settings.reducedFx ? 0.45 : 1)));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.35 + Math.random() * 0.65) * speed;
      Game.fx.particles.push({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 1, decay: 0.9 + Math.random() * 1.6,
        size: 1.3 + Math.random() * 2.2, color: color
      });
    }
    if (Game.fx.particles.length > 420) {
      Game.fx.particles.splice(0, Game.fx.particles.length - 420);
    }
  }

  function spawnMuzzle() {
    if (!Game.state || !Game.level) return;
    const p = Game.level.player;
    // Вспышка у дула пистолета, а не в центре стикмена
    const mx = p.x + Math.cos(Game.aim) * 22;
    const my = p.y + Math.sin(Game.aim) * 22;
    burst(mx, my, COLORS.accent, 14, 190);
    Game.fx.rings.push({ x: mx, y: my, r: 4, max: 38, color: COLORS.accent, life: 1 });
  }

  function updateFx(dt) {
    Game.clock += dt;
    Game.recoil = Math.max(0, Game.recoil - dt * 7);
    const p = Game.fx.particles;
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.94;
      q.vy *= 0.94;
      q.life -= q.decay * dt;
      if (q.life <= 0) p.splice(i, 1);
    }
    const rings = Game.fx.rings;
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.r += (r.max - r.r) * Math.min(1, dt * 7) + 40 * dt;
      r.life -= dt * 2.1;
      if (r.life <= 0) rings.splice(i, 1);
    }
    Game.fx.shake = Math.max(0, Game.fx.shake - dt * 3.4);
    Game.fx.flash = Math.max(0, Game.fx.flash - dt * 1.9);
    Game.fx.slow += (Game.fx.slowTarget - Game.fx.slow) * Math.min(1, dt * 9);
  }

  // =========================================================
  // Игровой цикл и события
  // =========================================================
  function steeringInput() {
    return {
      turn: (Game.keys.right ? 1 : 0) - (Game.keys.left ? 1 : 0),
      thrust: (Game.keys.fast ? 1 : 0) - (Game.keys.slow ? 1 : 0)
    };
  }

  function update(dt) {
    updateFx(dt);
    const st = Game.state;
    if (!st) return;

    if (st.status === 'flying') {
      const input = steeringInput();
      const wantsSteer = (input.turn !== 0 || input.thrust !== 0) && st.energy > 0;
      Game.fx.slowTarget = wantsSteer ? 1 : 0;

      Game.acc += dt * (wantsSteer ? OB.CFG.steerSlowMo : 1);
      let guard = 0;
      while (Game.acc >= SIM_DT && st.status === 'flying' && guard < 10) {
        OB.step(st, SIM_DT, input);
        OB.updateFx(st, SIM_DT);
        Game.acc -= SIM_DT;
        guard++;
      }
      if (guard >= 10) Game.acc = 0;
      if (wantsSteer && Game.session) Game.session.usedSteer = true;

      if (st.status === 'win') onWin();
      else if (st.status === 'failed') onLose();
      updateHUD();
    } else {
      Game.fx.slowTarget = 0;
    }

    if (st.events.length) processEvents(st);
  }

  function processEvents(st) {
    const events = st.events;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.type === 'bounce') {
        burst(e.x, e.y, e.kind === 'bouncy' ? COLORS.accent : '#9AA7BF', e.kind === 'bouncy' ? 12 : 7, 170);
        Game.fx.rings.push({ x: e.x, y: e.y, r: 3, max: 30, color: COLORS.accent, life: 1 });
        Game.fx.shake = Math.max(Game.fx.shake, 0.16);
        if (e.kind === 'bouncy') Audio.sfx('bouncy');
        else if (e.kind === 'soft') Audio.sfx('soft');
        else Audio.sfx('bounce');
      } else if (e.type === 'break') {
        burst(e.x, e.y, COLORS.mech, 18, 240);
        Audio.sfx('break');
      } else if (e.type === 'kill') {
        burst(e.x, e.y, COLORS.enemy, 26, 290);
        Game.fx.rings.push({ x: e.x, y: e.y, r: 6, max: 80, color: COLORS.enemy, life: 1 });
        Game.fx.shake = Math.max(Game.fx.shake, 0.45);
        Audio.sfx('kill');
      } else if (e.type === 'switch') {
        Game.fx.rings.push({ x: e.x, y: e.y, r: 6, max: 64, color: COLORS.mech, life: 1 });
        burst(e.x, e.y, COLORS.mech, 12, 160);
        Audio.sfx('switch');
      } else if (e.type === 'doorOpen') {
        Audio.sfx('door');
      } else if (e.type === 'portal') {
        Game.fx.rings.push({ x: e.x, y: e.y, r: 8, max: 60, color: COLORS.mech, life: 1 });
        Game.fx.rings.push({ x: e.toX, y: e.toY, r: 8, max: 60, color: COLORS.accent, life: 1 });
        Audio.sfx('portal');
      } else if (e.type === 'absorb') {
        burst(e.x, e.y, COLORS.enemy, 20, 220);
      }
    }
    events.length = 0;
  }

  // =========================================================
  // HUD
  // =========================================================
  const hudCache = { level: '', bounces: '', enemies: '', energy: '', fire: '' };

  function updateHUD() {
    const st = Game.state, lvl = Game.level;
    if (!st || !lvl) return;

    if (Game.biome) applyBiomeUI(Game.biome);

    const levelText = (Game.session && Game.session.daily ? 'DAILY · ' : 'LEVEL ') + (lvl.index + 1);
    if (levelText !== hudCache.level) {
      dom.hudLevel.textContent = levelText;
      hudCache.level = levelText;
    }

    const left = Math.max(0, lvl.maxBounces - st.bullet.bounces);
    const bText = String(left);
    if (bText !== hudCache.bounces) {
      dom.hudBouncesVal.textContent = bText;
      dom.hudBounces.classList.toggle('danger', left <= 1);
      hudCache.bounces = bText;
    }

    const enemies = st.enemies.filter(function (e) { return e.alive; }).length;
    const eText = String(enemies);
    if (eText !== hudCache.enemies) {
      dom.hudEnemiesVal.textContent = eText;
      hudCache.enemies = eText;
    }

    const infinite = (lvl.energyMax || 0) >= 500;
    const energyVal = infinite ? '∞' : String(Math.ceil(st.energy));
    const fill = infinite ? 100 : Math.max(0, Math.min(100, (st.energy / (lvl.energyMax || 100)) * 100));
    const key = energyVal + '|' + Math.round(fill);
    if (key !== hudCache.energy) {
      dom.hudEnergyVal.textContent = energyVal;
      dom.hudEnergyFill.style.width = fill + '%';
      dom.hudEnergyFill.classList.toggle('low', fill < 34);
      hudCache.energy = key;
    }

    const canFire = st.status === 'aiming';
    if (String(canFire) !== hudCache.fire) {
      dom.btnFire.disabled = !canFire;
      hudCache.fire = String(canFire);
    }
  }

  function recomputePreview() {
    if (!Game.state || !Game.level || Game.state.status !== 'aiming') {
      Game.preview = null;
      return;
    }
    const res = OB.trace(Game.level, Game.aim, {
      maxBounces: Game.previewBounces, maxTime: 5
    });
    Game.preview = { points: res.points, bounces: res.bounces };
  }

  // =========================================================
  // Экран результата
  // =========================================================
  function statCard(value, label) {
    return '<div class="stat-card"><b>' + value + '</b><span>' + label + '</span></div>';
  }

  function showResult(win) {
    const r = Game.result || {};
    const daily = !!r.daily;

    dom.resultBadge.textContent = win ? '✓' : '✕';
    dom.resultBadge.classList.toggle('fail', !win);
    dom.resultTitle.textContent = daily
      ? t(win ? 'result.dailyWin' : 'result.dailyFail')
      : t(win ? 'result.win' : 'result.fail');

    if (win) {
      const biomeSuffix = Game.biome && Biomes
        ? ' · ' + Biomes.name(Game.biome, lang)
        : '';
      dom.resultSub.textContent = (r.record ? t('result.newRecord') + ' · ' : '') +
        (daily ? utcDateKey() : 'ARENA ' + (Game.levelIndex + 1) + biomeSuffix);
    } else {
      dom.resultSub.textContent = t('fail.' + (r.reason || 'miss'));
    }

    const cards = [];
    if (win) cards.push(statCard(r.score, t('result.score')));
    cards.push(statCard(r.bounces || 0, t('result.bounces')));
    if (win) cards.push(statCard(r.energy, t('result.energy')));
    if (win) cards.push(statCard((r.time || 0).toFixed(1) + 's', t('result.time')));
    cards.push(statCard(r.shots || 1, t('result.shots')));
    dom.resultStats.innerHTML = cards.join('');

    dom.btnNext.classList.toggle('hidden', daily || !win);
    dom.btnRetry.classList.remove('hidden');
    dom.hud.classList.add('hidden');
    if (dom.touch) dom.touch.classList.add('hidden');
    dom.hint.classList.add('hidden');
    showScreen('result');
    refreshMenu();
  }

  // =========================================================
  // Интерфейс: меню, уровни, рекорды, испытание
  // =========================================================
  let levelsPage = 0;

  function refreshMenu() {
    if (!dom.menuStats) return;
    const level = Math.min(save.levelIndex, save.maxCleared + 1) + 1;
    dom.menuStats.textContent = t('menu.progress', {
      n: level, w: Math.max(0, save.maxCleared + 1), s: save.bestStreak
    });
  }

  function openLevels(page) {
    const lastVisible = save.maxCleared + 2;
    const pageCount = Math.max(1, Math.ceil(lastVisible / PER_PAGE));
    if (page === undefined) page = Math.floor(Math.min(save.levelIndex, save.maxCleared + 1) / PER_PAGE);
    levelsPage = Math.max(0, Math.min(pageCount - 1, page));
    renderLevels(pageCount);
    showScreen('levels');
    Audio.sfx('click');
  }

  function renderLevels(pageCount) {
    const maxUnlocked = save.maxCleared + 1;
    const start = levelsPage * PER_PAGE;
    const end = Math.min(start + PER_PAGE, maxUnlocked + 2);
    let html = '';

    for (let i = start; i < end; i++) {
      const cleared = i <= save.maxCleared;
      const isCurrent = i === maxUnlocked;
      const locked = i > maxUnlocked;
      const best = save.bestScores[i] || 0;
      const bio = Biomes ? Biomes.forLevel(i, save.worldSeed) : null;
      const bioName = bio ? Biomes.name(bio, lang) : '';
      const cls = ['level-cell'];
      if (cleared) cls.push('cleared');
      if (isCurrent) cls.push('current');
      if (locked) cls.push('locked');
      html += '<button class="' + cls.join(' ') + '" data-index="' + i + '"' +
        ' title="' + bioName + '"' +
        (locked ? ' disabled' : '') + '>' + (i + 1) +
        (bio ? '<i class="biome-dot" style="background:' + bio.accent + '"></i>' : '') +
        '<small>' + (locked ? '🔒' : (best || (cleared ? '★' : '▶'))) + '</small></button>';
    }

    dom.levelGrid.innerHTML = html;
    dom.levelsPageLabel.textContent = (levelsPage + 1) + ' / ' + Math.max(1, pageCount);
  }

  function renderRecords() {
    const unlocked = ACHIEVEMENTS.filter(function (a) { return save.achievements[a.id]; }).length;
    dom.recordsStats.innerHTML = [
      statCard(Math.min(save.levelIndex, save.maxCleared + 1) + 1, t('stat.level')),
      statCard(Math.max(0, save.maxCleared + 1), t('stat.cleared')),
      statCard(save.wins, t('stat.wins')),
      statCard(save.attempts, t('stat.attempts')),
      statCard(save.streak, t('stat.streak')),
      statCard(save.bestStreak, t('stat.bestStreak')),
      statCard(save.totalBounces, t('stat.bounces')),
      statCard(unlocked + '/' + ACHIEVEMENTS.length, t('stat.achievements'))
    ].join('');

    dom.achievementsList.innerHTML = ACHIEVEMENTS.map(function (a) {
      const done = !!save.achievements[a.id];
      return '<div class="ach-item' + (done ? ' unlocked' : '') + '">' +
        '<div class="ach-icon">' + (done ? a.icon : '🔒') + '</div>' +
        '<div class="ach-text"><b>' + (lang === 'ru' ? a.ru : a.en) + '</b>' +
        '<span>' + (lang === 'ru' ? a.descRu : a.descEn) + '</span></div></div>';
    }).join('');
  }

  function countdownText() {
    const now = new Date();
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
    let sec = Math.max(0, Math.floor((next - now.getTime()) / 1000));
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    sec %= 3600;
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return h + ':' + m + ':' + s;
  }

  function renderDaily() {
    refreshDaily();
    const key = utcDateKey();
    let dateStr = key;
    try {
      dateStr = new Date(key + 'T00:00:00Z').toLocaleDateString(
        lang === 'ru' ? 'ru-RU' : 'en-GB',
        { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }
      );
    } catch (e) { /* оставляем ISO-дату */ }

    dom.dailyDate.textContent = dateStr;
    dom.dailyDate.setAttribute('data-key', key);
    const dailyBiome = Biomes
      ? Biomes.forLevel(dailyIndex(), dailySeed())
      : null;
    dom.dailyLevel.textContent = 'ARENA ' + (dailyIndex() + 1) +
      (dailyBiome ? ' · ' + dailyBiome.icon + ' ' + Biomes.name(dailyBiome, lang) : '');
    dom.dailyCountdown.textContent = countdownText();
    dom.dailyStats.innerHTML = [
      statCard(save.daily.bestAttempts || '—', t('daily.best')),
      statCard(save.daily.bestScore || 0, t('result.score')),
      statCard(save.daily.attempts || 0, t('daily.attempts')),
      statCard(save.daily.wins || 0, t('daily.wins')),
      statCard(save.daily.streakDays || 0, t('daily.streak'))
    ].join('');

    const btn = $('btnDailyPlay');
    if (btn) btn.textContent = save.daily.wins > 0 ? t('result.retry') : t('daily.play');
  }

  // =========================================================
  // Настройки, язык, мобильное управление
  // =========================================================
  function openSettings() {
    Game.settingsFrom = (Game.mode === 'paused' || Game.mode === 'playing') ? 'pause' : 'menu';
    if (Game.mode === 'playing') pauseGame();
    dom.toggleSound.checked = !!save.settings.sound;
    dom.rangeVolume.value = Math.round((save.settings.volume || 0) * 100);
    dom.toggleFx.checked = !!save.settings.reducedFx;
    dom.btnLangRu.classList.toggle('primary', lang === 'ru');
    dom.btnLangEn.classList.toggle('primary', lang === 'en');
    showScreen('settings');
    Audio.sfx('click');
  }

  function closeSettings() {
    if (Game.settingsFrom === 'pause' && Game.mode === 'paused') showScreen('pause');
    else { showScreen('menu'); refreshMenu(); }
  }

  function setLanguage(next) {
    lang = next === 'en' ? 'en' : 'ru';
    save.settings.lang = lang;
    persist();
    applyI18n();
    refreshMenu();
    if (Game.screen === 'records') renderRecords();
    if (Game.screen === 'daily') renderDaily();
    if (Game.screen === 'levels') {
      renderLevels(Math.max(1, Math.ceil((save.maxCleared + 2) / PER_PAGE)));
    }
    dom.btnLangRu.classList.toggle('primary', lang === 'ru');
    dom.btnLangEn.classList.toggle('primary', lang === 'en');
    if (Game.state) updateHUD();
  }

  function isTouchDevice() {
    return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  function updateTouchVisibility() {
    if (!dom.touch) return;
    const touch = isTouchDevice();
    dom.touch.classList.toggle('hidden', !(touch && Game.mode === 'playing'));
    if (dom.btnFire) dom.btnFire.classList.toggle('hidden', touch);
  }

  // =========================================================
  // Отрисовка: холст, фон
  // =========================================================
  const view = { scale: 1, dpr: 1 };

  // Пол уровня строится один раз и кешируется на несколько уровней
  const floorCache = new Map();

  function floorFor(lvl, biome) {
    if (!Art) return null;
    const key = (lvl.seed || ('i' + lvl.index)) + '|' + biome.id;
    let canvas = floorCache.get(key);
    if (canvas) return canvas;
    canvas = Art.buildFloor(lvl, biome);
    if (floorCache.size >= 3) {
      const oldest = floorCache.keys().next().value;
      if (oldest) floorCache.delete(oldest);
    }
    floorCache.set(key, canvas);
    return canvas;
  }

  const biomeUi = { name: '', icon: '', accent: '' };

  function applyBiomeUI(biome) {
    if (!biome || !Biomes) return;
    const name = Biomes.name(biome, lang);
    if (dom.hudBiomeName && name !== biomeUi.name) {
      dom.hudBiomeName.textContent = name;
      biomeUi.name = name;
      if (dom.hudBiome) dom.hudBiome.title = t('biome.label') + ': ' + name;
    }
    if (dom.hudBiomeIcon && biome.icon !== biomeUi.icon) {
      dom.hudBiomeIcon.textContent = biome.icon;
      biomeUi.icon = biome.icon;
    }
    if (dom.hudBiome && biome.accent !== biomeUi.accent) {
      dom.hudBiome.style.borderColor = Art ? Art.color(biome.accent, 0.55) : biome.accent;
      biomeUi.accent = biome.accent;
    }
  }

  function resizeCanvas() {
    const rect = dom.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (dom.canvas.width !== w || dom.canvas.height !== h) {
      dom.canvas.width = w;
      dom.canvas.height = h;
    }
    view.dpr = dpr;
    view.scale = rect.width / W;
    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, 0, 0);
  }

  // Статичный фон кэшируется один раз
  let bgCanvas = null;

  function buildBackground() {
    // Меню/пауза: тот же остров, но в биоме равнин
    if (Art && Biomes) {
      bgCanvas = Art.buildFloor(null, Biomes.byId('plains'));
      return;
    }
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = COLORS.bg;
    g.fillRect(0, 0, W, H);
    bgCanvas = c;
  }

  // =========================================================
  // Отрисовка стен и механизмов
  // =========================================================
  function drawWalls(timeSec) {
    // Стены — деревья биома: у каждой стены свой спрайт (кеш в Art)
    if (!Art || !Game.biome) return;
    Art.drawWalls(ctx, Game.level, Game.state, timeSec, Game.biome);
  }

  function drawWells(timeSec) {
    const lvl = Game.level;
    if (!lvl || !lvl.wells || !lvl.wells.length) return;
    for (let i = 0; i < lvl.wells.length; i++) {
      const w = lvl.wells[i];
      ctx.save();
      ctx.translate(w.x, w.y);

      ctx.fillStyle = 'rgba(16,8,26,0.28)';
      ctx.beginPath();
      ctx.arc(0, 0, w.r + 2, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(0, 0, w.r * 0.15, 0, 0, w.r);
      grad.addColorStop(0, 'rgba(185,140,255,0.16)');
      grad.addColorStop(1, 'rgba(185,140,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, w.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(185,140,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 9]);
      ctx.beginPath();
      ctx.arc(0, 0, w.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // вращающиеся дуги показывают направление закрутки
      ctx.strokeStyle = 'rgba(185,140,255,0.8)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const a0 = w.dir * timeSec * 0.9 + (k / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, w.r * 0.62, a0, a0 + 0.8);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(185,140,255,0.9)';
      ctx.beginPath();
      ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawSwitches() {
    const lvl = Game.level, st = Game.state;
    if (!lvl) return;

    for (let i = 0; i < lvl.switches.length; i++) {
      const s = lvl.switches[i];
      let door = null;
      for (let k = 0; k < lvl.doors.length; k++) {
        if (lvl.doors[k].channel === s.channel) { door = lvl.doors[k]; break; }
      }
      const on = st && st.switches[i] && st.switches[i].on;

      if (door) {
        ctx.save();
        ctx.strokeStyle = on ? 'rgba(56,232,255,0.28)' : 'rgba(56,232,255,0.1)';
        ctx.setLineDash([3, 8]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(door.x + door.w / 2, door.y + door.h / 2);
        ctx.stroke();
        ctx.restore();
      }

      const flash = st && st.switches[i] ? st.switches[i].flash : 0;
      ctx.save();
      ctx.translate(s.x, s.y);

      // Круглая каменная плита — чтобы кристалл читался на траве
      ctx.fillStyle = 'rgba(36,44,38,0.55)';
      ctx.beginPath();
      ctx.arc(0, 0, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(16,24,20,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 21, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(Math.PI / 4);
      const size = 11 + (on ? 1.5 : 0) + flash * 3;
      if (on) {
        ctx.shadowColor = COLORS.mech;
        ctx.shadowBlur = 18;
        ctx.fillStyle = 'rgba(56,232,255,0.9)';
      } else {
        ctx.fillStyle = 'rgba(56,232,255,0.2)';
      }
      ctx.strokeStyle = COLORS.mech;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-size, -size, size * 2, size * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (!on) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56,232,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, OB.SWITCH_R + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawPortals(timeSec) {
    const lvl = Game.level;
    if (!lvl || !lvl.portals || !lvl.portals.length) return;
    for (let i = 0; i < lvl.portals.length; i++) {
      const p = lvl.portals[i];
      const isA = p.id === 'pa';
      const color = isA ? COLORS.mech : COLORS.accent;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(10,20,24,0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, OB.PORTAL_R + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      for (let k = 0; k < 3; k++) {
        const r = OB.PORTAL_R - k * 6;
        const dir = k % 2 === 0 ? 1 : -1;
        const a0 = timeSec * 1.4 * dir + k * 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, r, a0, a0 + Math.PI * 1.25);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '700 11px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isA ? 'A' : 'B', 0, 0);
      ctx.restore();
    }
  }

  function drawEnemies(timeSec) {
    const st = Game.state;
    if (!st || !Art || !Game.biome) return;
    const tmp = { x: 0, y: 0 };
    const player = Game.level.player;

    for (let i = 0; i < st.enemies.length; i++) {
      const e = st.enemies[i];
      OB.enemyPos(e.def, st.t, tmp);
      // Время смерти считаем по игровым часам: после победы st.t замирает
      if (!e.alive && e.deathAt == null) e.deathAt = Game.clock;

      Art.drawEnemy(ctx, e.def, tmp.x, tmp.y, e.def.r || OB.ENEMY_R, timeSec, {
        biome: Game.biome,
        index: i,
        alive: e.alive,
        age: e.alive ? 0 : Game.clock - (e.deathAt || 0),
        player: player
      });
    }
  }

  function drawPlayer(timeSec) {
    const lvl = Game.level, st = Game.state;
    if (!lvl || !st || !Art || !Game.biome) return;
    Art.drawPlayer(ctx, lvl, Game.aim, timeSec, {
      biome: Game.biome,
      aiming: st.status === 'aiming',
      recoil: Game.recoil
    });
  }

  // Честный предпросмотр: та же физика, что и у настоящего выстрела
  function drawAimPreview() {
    const st = Game.state;
    if (!st || st.status !== 'aiming' || !Game.preview || !Game.preview.points) return;
    const pts = Game.preview.points;
    if (pts.length < 2) return;

    ctx.save();

    // Траектория: тёмная подложка + светлый пунктир — видно и на траве, и на песке
    const tracePath = function (color, width) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        if (Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) > 60) {
          ctx.moveTo(pts[i].x, pts[i].y); // телепорт — линию не тянем
        } else {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
      }
      ctx.stroke();
    };

    ctx.setLineDash([6, 7]);
    tracePath('rgba(8,18,10,0.32)', 3.6);
    tracePath('rgba(255,255,255,0.6)', 1.5);
    ctx.setLineDash([]);

    for (let i = 2; i < pts.length; i += 3) {
      ctx.fillStyle = 'rgba(255,107,53,0.6)';
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }

    const b = Game.preview.bounces || [];
    for (let i = 0; i < b.length; i++) {
      ctx.strokeStyle = 'rgba(8,18,10,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b[i].x, b[i].y, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,138,70,0.95)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(b[i].x, b[i].y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    const p = Game.level.player;
    const ax = p.x + Math.cos(Game.aim) * 1000;
    const ay = p.y + Math.sin(Game.aim) * 1000;
    ctx.strokeStyle = 'rgba(8,18,10,0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.restore();
  }

  function drawBullet() {
    const st = Game.state;
    if (!st) return;
    const b = st.bullet;
    if (!b.active) return;

    // Тёмная подложка трассера — пуля видна и на снегу, и на песке
    for (let i = 1; i < b.trail.length; i++) {
      const a = i / b.trail.length;
      ctx.strokeStyle = 'rgba(20,12,6,' + (a * 0.18).toFixed(3) + ')';
      ctx.lineWidth = 3 + a * 3.6;
      ctx.beginPath();
      ctx.moveTo(b.trail[i - 1].x, b.trail[i - 1].y);
      ctx.lineTo(b.trail[i].x, b.trail[i].y);
      ctx.stroke();
    }

    for (let i = 1; i < b.trail.length; i++) {
      const a = i / b.trail.length;
      ctx.strokeStyle = 'rgba(255,107,53,' + (a * 0.55).toFixed(3) + ')';
      ctx.lineWidth = 1 + a * 3.4;
      ctx.beginPath();
      ctx.moveTo(b.trail[i - 1].x, b.trail[i - 1].y);
      ctx.lineTo(b.trail[i].x, b.trail[i].y);
      ctx.stroke();
    }

    if (st.status !== 'flying' && st.status !== 'win') return;

    ctx.save();
    ctx.fillStyle = 'rgba(24,14,6,0.42)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, OB.BULLET_R + 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = COLORS.bullet;
    ctx.shadowBlur = 22;
    ctx.fillStyle = COLORS.bullet;
    ctx.beginPath();
    ctx.arc(b.x, b.y, OB.BULLET_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,107,53,0.5)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, OB.BULLET_R + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    const p = Game.fx.particles;
    for (let i = 0; i < p.length; i++) {
      const q = p[i];
      ctx.globalAlpha = Math.max(0, q.life);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;

    const rings = Game.fx.rings;
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      ctx.globalAlpha = Math.max(0, r.life);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawSlowMo() {
    if (Game.fx.slow < 0.02) return;
    const a = Game.fx.slow * 0.5;
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
    grad.addColorStop(0, 'rgba(56,232,255,0)');
    grad.addColorStop(1, 'rgba(56,232,255,' + (a * 0.35).toFixed(3) + ')');
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(56,232,255,' + (a * 0.5).toFixed(3) + ')';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.restore();
  }

  function render(timeSec) {
    if (!bgCanvas) buildBackground();
    ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, 0, 0);

    ctx.save();
    if (Game.fx.shake > 0.01) {
      ctx.translate((Math.random() - 0.5) * Game.fx.shake * 14,
        (Math.random() - 0.5) * Game.fx.shake * 14);
    }

    ctx.drawImage(Game.floor || bgCanvas, 0, 0, W, H);
    if (Game.level) {
      drawWalls(timeSec);
      drawWells(timeSec);
      drawSwitches();
      drawPortals(timeSec);
      drawEnemies(timeSec);
      drawAimPreview();
      drawBullet();
      drawPlayer(timeSec);
      drawParticles();
      if (Art && Game.biome) {
        Art.drawWeather(ctx, Game.biome, timeSec, {
          width: W, height: H, reduced: !!save.settings.reducedFx
        });
      }
    }
    ctx.restore();

    drawSlowMo();

    if (Game.fx.flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.55, Game.fx.flash);
      ctx.fillStyle = Game.fx.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  // =========================================================
  // Ввод: мышь, клавиатура, сенсор
  // =========================================================
  function toWorld(clientX, clientY) {
    const rect = dom.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / Math.max(1, rect.width) * W,
      y: (clientY - rect.top) / Math.max(1, rect.height) * H
    };
  }

  function aimAt(clientX, clientY) {
    if (!Game.level || !Game.state || Game.state.status !== 'aiming') return;
    const pt = toWorld(clientX, clientY);
    const p = Game.level.player;
    const dx = pt.x - p.x, dy = pt.y - p.y;
    if (Math.hypot(dx, dy) < 8) return;
    const next = Math.atan2(dy, dx);
    if (Math.abs(next - Game.aim) > 0.0005) {
      Game.aim = next;
      recomputePreview();
    }
  }

  function nudgeAim(delta) {
    if (!Game.state || Game.state.status !== 'aiming') return;
    Game.aim += delta;
    recomputePreview();
  }

  let pointerDown = false;

  function bindInput() {
    dom.canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      Audio.unlock();
      pointerDown = true;
      aimAt(e.clientX, e.clientY);
      // На компьютере левый клик стреляет; на сенсоре — кнопка FIRE
      if ((e.pointerType || 'mouse') === 'mouse' && e.button === 0) fire();
    }, { passive: false });

    dom.canvas.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse' || pointerDown) aimAt(e.clientX, e.clientY);
    });

    window.addEventListener('pointerup', function () { pointerDown = false; });
    window.addEventListener('pointercancel', function () { pointerDown = false; });
    dom.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    window.addEventListener('keydown', function (e) {
      const k = e.key.toLowerCase();
      const arrows = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) !== -1;
      if (arrows || (k === ' ' && Game.mode === 'playing')) e.preventDefault();

      if (k === 'a' || k === 'arrowleft') {
        Game.keys.left = true;
        if (Game.state && Game.state.status === 'aiming') nudgeAim(-0.012);
      }
      if (k === 'd' || k === 'arrowright') {
        Game.keys.right = true;
        if (Game.state && Game.state.status === 'aiming') nudgeAim(0.012);
      }
      if (k === 'w' || k === 'arrowup') Game.keys.fast = true;
      if (k === 's' || k === 'arrowdown') Game.keys.slow = true;

      if (k === ' ' || k === 'enter') {
        if (Game.mode === 'playing') fire();
      }
      if (k === 'r') {
        if (Game.mode === 'playing' || Game.mode === 'paused' || Game.mode === 'result') restartLevel();
      }
      if (k === 'escape' || k === 'p') {
        if (Game.mode === 'playing') pauseGame();
        else if (Game.mode === 'paused') resumeGame();
      }
      if (k === 'm') {
        save.settings.sound = !save.settings.sound;
        Audio.setVolume();
        persist();
        if (dom.toggleSound) dom.toggleSound.checked = !!save.settings.sound;
        toast(save.settings.sound ? '🔊' : '🔇', 900);
      }
    });

    window.addEventListener('keyup', function (e) {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') Game.keys.left = false;
      if (k === 'd' || k === 'arrowright') Game.keys.right = false;
      if (k === 'w' || k === 'arrowup') Game.keys.fast = false;
      if (k === 's' || k === 'arrowdown') Game.keys.slow = false;
    });

    // экранные кнопки удержания
    document.querySelectorAll('[data-hold]').forEach(function (btn) {
      const key = btn.getAttribute('data-hold');
      const on = function (e) {
        e.preventDefault();
        Audio.unlock();
        Game.keys[key] = true;
        btn.classList.add('held');
      };
      const off = function () {
        Game.keys[key] = false;
        btn.classList.remove('held');
      };
      btn.addEventListener('pointerdown', on, { passive: false });
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
    });

    if (dom.btnFireTouch) {
      dom.btnFireTouch.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        Audio.unlock();
        fire();
      }, { passive: false });
    }

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', function () { setTimeout(resizeCanvas, 250); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && Game.mode === 'playing') pauseGame();
    });
  }

  // =========================================================
  // Привязка интерфейса
  // =========================================================
  function bindUI() {
    const on = function (id, fn) {
      const el = $(id);
      if (el) el.addEventListener('click', fn);
    };

    on('btnPlay', function () {
      Audio.unlock();
      Audio.sfx('click');
      startLevel(Math.max(0, Math.min(save.levelIndex, save.maxCleared + 1)), {});
    });

    on('btnLevels', function () { Audio.unlock(); openLevels(); });
    on('btnDaily', function () {
      Audio.unlock();
      renderDaily();
      showScreen('daily');
      Audio.sfx('click');
    });
    on('btnRecords', function () { renderRecords(); showScreen('records'); Audio.sfx('click'); });
    on('btnSettings', function () { openSettings(); });
    on('btnPauseSettings', function () { openSettings(); });

    on('btnLevelsBack', function () { showScreen('menu'); refreshMenu(); });
    on('btnDailyBack', function () { showScreen('menu'); refreshMenu(); });
    on('btnRecordsBack', function () { showScreen('menu'); refreshMenu(); });
    on('btnSettingsBack', function () { closeSettings(); });

    on('btnLevelsPrev', function () { if (levelsPage > 0) openLevels(levelsPage - 1); });
    on('btnLevelsNext', function () {
      const pageCount = Math.max(1, Math.ceil((save.maxCleared + 2) / PER_PAGE));
      if (levelsPage < pageCount - 1) openLevels(levelsPage + 1);
    });

    if (dom.levelGrid) {
      dom.levelGrid.addEventListener('click', function (e) {
        const cell = e.target.closest ? e.target.closest('.level-cell') : null;
        if (!cell) return;
        const index = Number(cell.getAttribute('data-index'));
        if (!isFinite(index)) return;
        if (index > save.maxCleared + 1) { toast(t('levels.locked')); return; }
        Audio.sfx('click');
        startLevel(index, {});
      });
    }

    on('btnDailyPlay', function () {
      Audio.unlock();
      startLevel(dailyIndex(), { daily: true });
    });

    on('btnPause', function () { pauseGame(); Audio.sfx('click'); });
    on('btnResume', function () { resumeGame(); });
    on('btnRestart', function () { Audio.sfx('click'); restartLevel(); });
    on('btnPauseMenu', function () { goMenu(); });

    on('btnFire', function () { fire(); });
    on('btnNext', function () { nextLevel(); });
    on('btnRetry', function () { Audio.sfx('click'); restartLevel(); });
    on('btnResultMenu', function () { goMenu(); });

    if (dom.toggleSound) {
      dom.toggleSound.addEventListener('change', function () {
        save.settings.sound = dom.toggleSound.checked;
        Audio.unlock();
        Audio.setVolume();
        persist();
      });
    }
    if (dom.rangeVolume) {
      dom.rangeVolume.addEventListener('input', function () {
        save.settings.volume = Number(dom.rangeVolume.value) / 100;
        Audio.unlock();
        Audio.setVolume();
        persist();
      });
    }
    if (dom.toggleFx) {
      dom.toggleFx.addEventListener('change', function () {
        save.settings.reducedFx = dom.toggleFx.checked;
        persist();
      });
    }
    on('btnLangRu', function () { setLanguage('ru'); });
    on('btnLangEn', function () { setLanguage('en'); });

    on('btnReset', function () {
      if (!window.confirm(t('settings.resetNote'))) return;
      save = defaultSave();
      save.worldSeed = randomSeed();
      persist(true);
      Gen.clearCache();
      Game.prefetched = {};
      closeSettings();
      refreshMenu();
      toast(t('settings.resetDone'));
    });
  }

  // =========================================================
  // Главный цикл
  // =========================================================
  let lastTs = 0;

  function frame(ts) {
    requestAnimationFrame(frame);
    const raw = lastTs ? (ts - lastTs) / 1000 : 1 / 60;
    lastTs = ts;
    const dt = Math.min(0.05, Math.max(0, raw));

    if (Game.mode === 'playing' && Game.state) update(dt);
    else updateFx(dt);

    render(ts / 1000);
  }

  // =========================================================
  // Облачное сохранение (если SDK доступен)
  // =========================================================
  function mergeCloud(remote) {
    if (!remote || typeof remote !== 'object') return;
    // Не подменяем сохранение посреди забега
    if (Game.mode === 'playing' || Game.mode === 'paused') { persist(true); return; }

    const localCleared = save.maxCleared;
    const remoteCleared = typeof remote.maxCleared === 'number' ? remote.maxCleared : -1;
    const remoteNewer = remote.updatedAt && remote.updatedAt > save.updatedAt;

    if (remoteCleared > localCleared || (remoteCleared === localCleared && remoteNewer)) {
      const cloud = mergeSave(remote);
      cloud.worldSeed = remote.worldSeed || save.worldSeed;
      save = cloud;
      persist(true);
      refreshMenu();
      if (Game.screen === 'records') renderRecords();
    } else if (localCleared > remoteCleared) {
      persist(true);
    }
  }

  // =========================================================
  // Инициализация
  // =========================================================
  function detectLang() {
    if (save.settings.lang === 'ru' || save.settings.lang === 'en') return save.settings.lang;
    const nav = (navigator.language || 'ru').toLowerCase();
    return nav.indexOf('ru') === 0 ? 'ru' : 'en';
  }

  function bindYandex() {
    if (!Yandex) return;

    Yandex.onAdStateChange = function (open) {
      if (open) {
        if (Audio.ready && Audio.ctx) { try { Audio.ctx.suspend(); } catch (e) {} }
        if (Game.mode === 'playing') pauseGame();
      } else {
        if (Audio.ready && Audio.ctx) { try { Audio.ctx.resume(); } catch (e) {} }
        Audio.setVolume();
      }
    };

    Yandex.init().then(function (res) {
      if (!res || !res.ok) return;
      if (!save.settings.lang && res.lang) setLanguage(res.lang);
      Yandex.load().then(function (remote) {
        mergeCloud(remote);
        refreshMenu();
      });
    });
  }

  function init() {
    loadSave();
    lang = detectLang();

    bindUI();
    bindInput();
    applyI18n();
    resizeCanvas();
    buildBackground();
    refreshDaily();
    refreshMenu();
    dom.hud.classList.add('hidden');
    if (dom.touch) dom.touch.classList.add('hidden');
    showScreen('menu');

    bindYandex();

    // таймер до следующего ежедневного испытания
    setInterval(function () {
      if (Game.screen !== 'daily') return;
      const key = utcDateKey();
      if (dom.dailyDate.getAttribute('data-key') !== key) {
        refreshDaily();
        renderDaily();
      } else {
        dom.dailyCountdown.textContent = countdownText();
      }
    }, 1000);

    requestAnimationFrame(frame);
  }

  // Небольшой публичный API: полезен для отладки и встраивания
  window.FlexShot = {
    version: '1.1.0',
    startLevel: startLevel,
    restartLevel: restartLevel,
    fire: fire,
    game: Game,
    biomes: Biomes,
    art: Art,
    getSave: function () { return save; }
  };

  init();
})();
