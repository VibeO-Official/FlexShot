/* =========================================================
   ONE BULLET / FlexShot — biomes.js
   Биомы арены: палитры травы и земли, породы деревьев,
   декор и погода. Модуль чистый (без DOM), поэтому биом
   можно проверить автотестами и использовать в генераторе.

   Порядок в списке важен: соседние уровни берут биомы,
   отстоящие друг от друга на STEP (взаимно простое с числом
   биомов), поэтому подряд идущие уровни всегда выглядят
   по-разному, а весь набор проходит полный круг.
   ========================================================= */
(function (global) {
  'use strict';

  const BIOMES = [
    // -------------------------------------------------------
    // 1. Равнины — светлая трава, дубы, цветы, летний зной
    // -------------------------------------------------------
    {
      id: 'plains', ru: 'РАВНИНЫ', en: 'PLAINS', icon: '🌾', tree: 'oak',
      accent: '#8FD64F',
      grass: { base: '#6CBD4A', light: '#7ED158', dark: '#59A33B', blade: '#A3E477' },
      soil: { top: '#8B5A2B', light: '#A9713A', dark: '#5E3A1C', speck: '#C08A52' },
      leaf: { base: '#3F8C2D', light: '#59B23D', dark: '#2A6520', edge: '#1F4E18', accent: '#FFD84D' },
      log: { bark: '#6B4A2B', light: '#8A6238', dark: '#4A3220', ring: '#C39A63', ringDark: '#8A6A42' },
      flower: ['#FFD84D', '#FF6B6B', '#FFFFFF', '#B98CFF'],
      weather: { type: 'pollen', color: '#FFF3B0', rate: 0.32 },
      decor: { tuft: 1, flower: 0.95, pebble: 0.35, mushroom: 0, bush: 0, cactus: 0, lily: 0, shell: 0 },
      fog: 'rgba(255, 236, 170, 0.05)',
      dark: false
    },

    // -------------------------------------------------------
    // 2. Лес — плотные дубы, палая листва, много грибов
    // -------------------------------------------------------
    {
      id: 'forest', ru: 'ЛЕС', en: 'FOREST', icon: '🌳', tree: 'oak',
      accent: '#63C24B',
      grass: { base: '#4E9B3B', light: '#5DAE45', dark: '#3F7F2F', blade: '#7DCB5E' },
      soil: { top: '#7A4E27', light: '#956137', dark: '#4F3218', speck: '#A97447' },
      leaf: { base: '#357C27', light: '#4DA236', dark: '#22581C', edge: '#173F13', accent: '#F0B23E' },
      log: { bark: '#5F4126', light: '#7C5633', dark: '#3F2A17', ring: '#B58B57', ringDark: '#7A5A37' },
      flower: ['#FFFFFF', '#FFD84D', '#D98CFF', '#FF7B7B'],
      weather: { type: 'leaf', color: '#4E9B3B', rate: 0.45 },
      decor: { tuft: 1, flower: 0.5, pebble: 0.3, mushroom: 0.55, bush: 0.2, cactus: 0, lily: 0, shell: 0 },
      fog: 'rgba(20, 50, 16, 0.08)',
      dark: false
    },

    // -------------------------------------------------------
    // 3. Берёзовая роща — белые стволы, светлая листва
    // -------------------------------------------------------
    {
      id: 'birch', ru: 'БЕРЁЗОВАЯ РОЩА', en: 'BIRCH GROVE', icon: '🌿', tree: 'birch',
      accent: '#B6E86B',
      grass: { base: '#77C153', light: '#8AD463', dark: '#62A942', blade: '#D8F7A6' },
      soil: { top: '#8A6544', light: '#A27C57', dark: '#5E4429', speck: '#C4A57E' },
      leaf: { base: '#69B33C', light: '#8BD455', dark: '#4C8C2A', edge: '#356A1D', accent: '#FFE066' },
      log: { bark: '#E6E3D4', light: '#F7F5EA', dark: '#A9A794', ring: '#D6CFB2', ringDark: '#9B957C' },
      flower: ['#FFFFFF', '#FFD84D', '#B98CFF'],
      weather: { type: 'leaf', color: '#B6E86B', rate: 0.3 },
      decor: { tuft: 1, flower: 0.75, pebble: 0.3, mushroom: 0.35, bush: 0, cactus: 0, lily: 0, shell: 0 },
      fog: 'rgba(240, 255, 200, 0.05)',
      dark: false
    },

    // -------------------------------------------------------
    // 4. Тайга — хвоя, холодная трава, мшистые камни
    // -------------------------------------------------------
    {
      id: 'taiga', ru: 'ТАЙГА', en: 'TAIGA', icon: '🌲', tree: 'spruce',
      accent: '#4FA98A',
      grass: { base: '#4F9155', light: '#5FA563', dark: '#3E7544', blade: '#87C98A' },
      soil: { top: '#6D5236', light: '#87694A', dark: '#463322', speck: '#9C7C57' },
      leaf: { base: '#2C6B4C', light: '#3D8762', dark: '#1C4B34', edge: '#123524', accent: '#7BE0B0' },
      log: { bark: '#4A3826', light: '#644C33', dark: '#2E2215', ring: '#A3814F', ringDark: '#6B5233' },
      flower: ['#B7E8FF', '#FFFFFF', '#8FD6B0'],
      weather: { type: 'pollen', color: '#BFE9D4', rate: 0.22 },
      decor: { tuft: 1, flower: 0.25, pebble: 0.7, mushroom: 0.45, bush: 0.25, cactus: 0, lily: 0, shell: 0 },
      fog: 'rgba(120, 190, 170, 0.05)',
      dark: false
    },

    // -------------------------------------------------------
    // 5. Снежная тундра — снег, ели, ледяные поля
    // -------------------------------------------------------
    {
      id: 'snowy', ru: 'СНЕЖНАЯ ТУНДРА', en: 'SNOWY TUNDRA', icon: '❄️', tree: 'spruce',
      accent: '#CDEBFF',
      grass: { base: '#DEEAF1', light: '#F2F8FC', dark: '#C3D5E1', blade: '#FFFFFF' },
      soil: { top: '#8A7B69', light: '#A39280', dark: '#5F5446', speck: '#C9BDA9' },
      leaf: { base: '#2C5F54', light: '#3E7D6E', dark: '#1B4139', edge: '#102C26', accent: '#9CE8FF' },
      log: { bark: '#4A3A2B', light: '#64503C', dark: '#2F2418', ring: '#A98B60', ringDark: '#6E563A' },
      flower: ['#FFFFFF', '#CDEBFF'],
      weather: { type: 'snow', color: '#FFFFFF', rate: 0.75 },
      decor: { tuft: 0.35, flower: 0.08, pebble: 0.45, mushroom: 0, bush: 0.15, cactus: 0, lily: 0, shell: 0 },
      fog: 'rgba(210, 240, 255, 0.09)',
      dark: false, snow: true
    },

    // -------------------------------------------------------
    // 6. Тёмный лес — тёмная листва, гигантские грибы
    // -------------------------------------------------------
    {
      id: 'dark_forest', ru: 'ТЁМНЫЙ ЛЕС', en: 'DARK FOREST', icon: '🍄', tree: 'dark_oak',
      accent: '#7E5BA8',
      grass: { base: '#446F35', light: '#568B45', dark: '#355C2C', blade: '#6FAE5C' },
      soil: { top: '#57402C', light: '#6C5138', dark: '#372619', speck: '#7F6247' },
      leaf: { base: '#2E6828', light: '#43853A', dark: '#1E4A1C', edge: '#143014', accent: '#C46BFF' },
      log: { bark: '#3E2C1D', light: '#553E2A', dark: '#261A10', ring: '#8B6A45', ringDark: '#5A4229' },
      flower: ['#C46BFF', '#FF5C7A', '#FFFFFF'],
      weather: { type: 'spore', color: '#C9A6FF', rate: 0.4 },
      decor: { tuft: 0.7, flower: 0.2, pebble: 0.4, mushroom: 1, bush: 0.3, cactus: 0, lily: 0, shell: 0 },
      fog: 'rgba(30, 12, 46, 0.10)',
      dark: true
    },

    // -------------------------------------------------------
    // 7. Джунгли — буйная зелень, лианы, тёплый дождь
    // -------------------------------------------------------
    {
      id: 'jungle', ru: 'ДЖУНГЛИ', en: 'JUNGLE', icon: '🌴', tree: 'jungle',
      accent: '#4FE07A',
      grass: { base: '#4FA83A', light: '#63BD48', dark: '#3D8C2C', blade: '#8CE86A' },
      soil: { top: '#7A5230', light: '#94663D', dark: '#50331B', speck: '#B07D4B' },
      leaf: { base: '#2C8B2C', light: '#44B33A', dark: '#1B6420', edge: '#114518', accent: '#FFE45C' },
      log: { bark: '#5C4326', light: '#775834', dark: '#3B2A16', ring: '#B08A54', ringDark: '#755B36' },
      flower: ['#FF6B9D', '#FFD84D', '#8CE86A', '#FF8A3D'],
      weather: { type: 'rain', color: '#A8E6FF', rate: 0.6 },
      decor: { tuft: 1, flower: 0.7, pebble: 0.25, mushroom: 0.4, bush: 0.6, cactus: 0, lily: 0.25, shell: 0 },
      fog: 'rgba(20, 90, 30, 0.07)',
      dark: false
    },

    // -------------------------------------------------------
    // 8. Болото — мутная вода, лилии, туман
    // -------------------------------------------------------
    {
      id: 'swamp', ru: 'БОЛОТО', en: 'SWAMP', icon: '🐸', tree: 'oak',
      accent: '#7FB35B',
      grass: { base: '#5A7740', light: '#698748', dark: '#486234', blade: '#8FAE62' },
      soil: { top: '#5A4A31', light: '#6F5C3E', dark: '#3B2F1F', speck: '#85714E' },
      leaf: { base: '#3E6B33', light: '#527F3F', dark: '#2B4E25', edge: '#1D3719', accent: '#B6D46A' },
      log: { bark: '#4E3E2A', light: '#665139', dark: '#30251A', ring: '#9B8055', ringDark: '#665235' },
      flower: ['#C9D86B', '#9FB8FF', '#FFFFFF'],
      weather: { type: 'rain', color: '#BFE3C2', rate: 0.45 },
      decor: { tuft: 0.9, flower: 0.25, pebble: 0.4, mushroom: 0.7, bush: 0.35, cactus: 0, lily: 0.9, shell: 0 },
      water: { base: '#3F5E43', light: '#517A52', dark: '#2C4230' },
      fog: 'rgba(60, 90, 50, 0.12)',
      dark: true
    },

    // -------------------------------------------------------
    // 9. Саванна — сухая трава, акации, пыль
    // -------------------------------------------------------
    {
      id: 'savanna', ru: 'САВАННА', en: 'SAVANNA', icon: '🦒', tree: 'acacia',
      accent: '#E2C455',
      grass: { base: '#B3A24C', light: '#C7B65B', dark: '#94853B', blade: '#E3D37C' },
      soil: { top: '#A8783F', light: '#C08D4F', dark: '#775227', speck: '#D9AC6A' },
      leaf: { base: '#6E9A32', light: '#8CB840', dark: '#52762A', edge: '#3A571D', accent: '#FFD84D' },
      log: { bark: '#6B4B2C', light: '#876138', dark: '#46301B', ring: '#B98C55', ringDark: '#7C5C37' },
      flower: ['#FFD84D', '#FF9F43', '#FFFFFF'],
      weather: { type: 'dust', color: '#EAD79A', rate: 0.4 },
      decor: { tuft: 1, flower: 0.35, pebble: 0.6, mushroom: 0, bush: 0.8, cactus: 0.25, lily: 0, shell: 0 },
      fog: 'rgba(220, 190, 110, 0.06)',
      dark: false
    },

    // -------------------------------------------------------
    // 10. Пустыня — песок, кактусы, мёртвые кусты
    // -------------------------------------------------------
    {
      id: 'desert', ru: 'ПУСТЫНЯ', en: 'DESERT', icon: '🌵', tree: 'cactus',
      accent: '#F2D97A',
      grass: { base: '#E0CE96', light: '#EFE1B2', dark: '#C6B279', blade: '#F7ECC0' },
      soil: { top: '#C9A86A', light: '#DFBE7D', dark: '#9A7C48', speck: '#EFD7A0' },
      leaf: { base: '#4E8E3C', light: '#66A94E', dark: '#356B2A', edge: '#234C1C', accent: '#FFE066' },
      log: { bark: '#8C6A3E', light: '#A8834F', dark: '#654A28', ring: '#D2B27A', ringDark: '#9C7B4A' },
      flower: ['#FF6B6B', '#FFD84D'],
      weather: { type: 'dust', color: '#F4E4B4', rate: 0.5 },
      decor: { tuft: 0.15, flower: 0.02, pebble: 0.7, mushroom: 0, bush: 0.55, cactus: 0.7, lily: 0, shell: 0 },
      fog: 'rgba(255, 226, 150, 0.07)',
      dark: false, ripples: true
    },

    // -------------------------------------------------------
    // 11. Бедлендс — красная глина, сухие деревья, пыль
    // -------------------------------------------------------
    {
      id: 'badlands', ru: 'БЕДЛЕНДС', en: 'BADLANDS', icon: '🏜️', tree: 'dead',
      accent: '#E4813F',
      grass: { base: '#C2764A', light: '#D58A56', dark: '#A15C36', blade: '#E9A06A' },
      soil: { top: '#A9522F', light: '#C4653B', dark: '#7A3820', speck: '#DE8A55' },
      leaf: { base: '#7C4A2A', light: '#96603A', dark: '#5A331C', edge: '#3E2212', accent: '#FF9F43' },
      log: { bark: '#6B4126', light: '#875434', dark: '#482915', ring: '#B58A57', ringDark: '#7C5A36' },
      flower: ['#FFB347', '#E86A4A'],
      weather: { type: 'dust', color: '#F0B27A', rate: 0.5 },
      decor: { tuft: 0.35, flower: 0.05, pebble: 0.8, mushroom: 0, bush: 0.7, cactus: 0.3, lily: 0, shell: 0 },
      fog: 'rgba(190, 90, 45, 0.08)',
      dark: false, ripples: true
    },

    // -------------------------------------------------------
    // 12. Побережье — песок, вода, пальмы, ракушки
    // -------------------------------------------------------
    {
      id: 'beach', ru: 'ПОБЕРЕЖЬЕ', en: 'BEACH', icon: '🏖️', tree: 'palm',
      accent: '#6FD8E8',
      grass: { base: '#E6D9AC', light: '#F3E8C2', dark: '#CFC08A', blade: '#FBF3D2' },
      soil: { top: '#C9B27A', light: '#DFC98E', dark: '#9C8655', speck: '#F0E0AE' },
      leaf: { base: '#3E9A46', light: '#57B95A', dark: '#2B7333', edge: '#1D5424', accent: '#FFE066' },
      log: { bark: '#8A6A44', light: '#A58456', dark: '#624A2C', ring: '#D0B080', ringDark: '#96774D' },
      flower: ['#FF8A8A', '#FFD84D', '#FFFFFF'],
      weather: { type: 'pollen', color: '#D9F7FF', rate: 0.3 },
      decor: { tuft: 0.55, flower: 0.1, pebble: 0.3, mushroom: 0, bush: 0.15, cactus: 0, lily: 0, shell: 0.9 },
      water: { base: '#3FA7C4', light: '#64C7DC', dark: '#2C7F9B' },
      fog: 'rgba(140, 220, 235, 0.05)',
      dark: false
    }
  ];

  const BY_ID = Object.create(null);
  for (let i = 0; i < BIOMES.length; i++) BY_ID[BIOMES[i].id] = BIOMES[i];

  // ---------- Детерминированный выбор биома ----------
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = a % b; a = b; b = t; }
    return a;
  }

  // Шаг перебора биомов, взаимно простой с их количеством.
  function stepFor(n) {
    if (n <= 1) return 0;
    let step = 5 % n;
    if (step === 0) step = 1;
    while (gcd(step, n) !== 1) step++;
    return step;
  }

  const STEP = stepFor(BIOMES.length);

  /**
   * Биом для уровня. index — номер уровня (0-based), seed — worldSeed.
   * Один и тот же уровень всегда получает один и тот же биом,
   * а соседние уровни — разные (шаг взаимно прост с числом биомов).
   */
  function forLevel(index, seed) {
    // Первый уровень — всегда равнины: обучение начинается со светлой травы
    if (Math.floor(index || 0) === 0) return BIOMES[0];
    const n = BIOMES.length;
    const salt = hash('biome:' + (seed || 'flexshot')) % n;
    const i = ((Math.floor(index || 0) * STEP + salt) % n + n) % n;
    return BIOMES[i];
  }

  function byId(id) {
    return BY_ID[id] || BIOMES[0];
  }

  function name(biome, lang) {
    const b = typeof biome === 'string' ? byId(biome) : (biome || BIOMES[0]);
    return lang === 'en' ? b.en : b.ru;
  }

  function accent(biome) {
    const b = typeof biome === 'string' ? byId(biome) : (biome || BIOMES[0]);
    return b.accent || '#8FD64F';
  }

  const Biomes = {
    list: BIOMES,
    ids: BIOMES.map(function (b) { return b.id; }),
    count: BIOMES.length,
    step: STEP,
    forLevel: forLevel,
    byId: byId,
    name: name,
    accent: accent,
    hash: hash
  };

  global.Biomes = Biomes;
  if (typeof module !== 'undefined' && module.exports) module.exports = Biomes;
})(typeof window !== 'undefined' ? window : globalThis);
