/* =========================================================
   ONE BULLET / FlexShot — skins.js
   Каталог скинов пуль и оружия + логика кейса.
   Модуль чистый (без DOM): данные, редкость, выдача предметов.

   Скины меняют только внешний вид: форму пули, цвет, стиль
   следа, модель оружия и вспышку. Физика и баланс уровней
   не меняются, поэтому генератор остаётся честным.
   ========================================================= */
(function (global) {
  'use strict';

  const CASE_COST = 100;
  const START_COINS = 160;
  const ALL_OWNED_COINS = 60;

  const RARITIES = {
    common: { id: 'common', ru: 'ОБЫЧНЫЙ', en: 'COMMON', color: '#9AA7BF', weight: 58, order: 0 },
    rare: { id: 'rare', ru: 'РЕДКИЙ', en: 'RARE', color: '#38E8FF', weight: 27, order: 1 },
    epic: { id: 'epic', ru: 'ЭПИЧЕСКИЙ', en: 'EPIC', color: '#B98CFF', weight: 12, order: 2 },
    legendary: { id: 'legendary', ru: 'ЛЕГЕНДАРНЫЙ', en: 'LEGENDARY', color: '#FFB347', weight: 3, order: 3 }
  };

  // ---------------------------------------------------------
  // Пули: цвет + форма + стиль следа + искры попадания
  // ---------------------------------------------------------
  const BULLETS = [
    {
      id: 'classic', ru: 'КЛАССИКА', en: 'CLASSIC', rarity: 'common',
      core: '#FFFFFF', glow: '#FF6B35', trail: '#FF8A4C', trail2: '#FFD9A8',
      spark: ['#FF6B35', '#FFD9A0', '#FFFFFF'], muzzle: '#FFB067',
      shape: 'orb', trailStyle: 'comet', size: 1
    },
    {
      id: 'ember', ru: 'УГОЛЁК', en: 'EMBER', rarity: 'common',
      core: '#FFF2D0', glow: '#FF7A2A', trail: '#FF5A1F', trail2: '#FFC46A',
      spark: ['#FF9F43', '#FFE066', '#FF5A1F'], muzzle: '#FF9A3C',
      shape: 'orb', trailStyle: 'spark', size: 1.08
    },
    {
      id: 'mint', ru: 'МЯТА', en: 'MINT', rarity: 'common',
      core: '#F2FFFB', glow: '#4FE0A0', trail: '#54E0B0', trail2: '#C8FFE6',
      spark: ['#4FE0A0', '#B6FFE0', '#FFFFFF'], muzzle: '#8CFFD0',
      shape: 'orb', trailStyle: 'comet', size: 1
    },
    {
      id: 'sky', ru: 'НЕБО', en: 'SKY', rarity: 'rare',
      core: '#FFFFFF', glow: '#48B8FF', trail: '#55C8FF', trail2: '#C9EEFF',
      spark: ['#55C8FF', '#FFFFFF', '#9FE6FF'], muzzle: '#9FDCFF',
      shape: 'diamond', trailStyle: 'dotted', size: 1.05
    },
    {
      id: 'candy', ru: 'КАРАМЕЛЬ', en: 'CANDY', rarity: 'rare',
      core: '#FFFFFF', glow: '#FF6BC8', trail: '#FF8AD8', trail2: '#7CF3FF',
      spark: ['#FF6BC8', '#7CF3FF', '#FFFFFF'], muzzle: '#FF9ADE',
      shape: 'star', trailStyle: 'spark', size: 1.1
    },
    {
      id: 'toxic', ru: 'ТОКСИН', en: 'TOXIC', rarity: 'rare',
      core: '#F4FFD0', glow: '#A8E82A', trail: '#88D61E', trail2: '#E8FF8A',
      spark: ['#A8E82A', '#E8FF8A', '#5FA812'], muzzle: '#C6FF4A',
      shape: 'orb', trailStyle: 'wave', size: 1.05
    },
    {
      id: 'lava', ru: 'ЛАВА', en: 'LAVA', rarity: 'rare',
      core: '#FFF0C8', glow: '#FF3B1F', trail: '#FF4A1A', trail2: '#FFB347',
      spark: ['#FF4A1A', '#FFB347', '#7A1400'], muzzle: '#FF6B2A',
      shape: 'orb', trailStyle: 'spark', size: 1.12
    },
    {
      id: 'plasma', ru: 'ПЛАЗМА', en: 'PLASMA', rarity: 'epic',
      core: '#FFFFFF', glow: '#7CF3FF', trail: '#48E8FF', trail2: '#B98CFF',
      spark: ['#7CF3FF', '#B98CFF', '#FFFFFF'], muzzle: '#9FF8FF',
      shape: 'ring', trailStyle: 'plasma', size: 1.1
    },
    {
      id: 'gold', ru: 'ЗОЛОТО', en: 'GOLD', rarity: 'epic',
      core: '#FFFBE0', glow: '#FFD84D', trail: '#FFCC33', trail2: '#FFF3B0',
      spark: ['#FFD84D', '#FFF3B0', '#C99A12'], muzzle: '#FFE066',
      shape: 'star', trailStyle: 'comet', size: 1.08
    },
    {
      id: 'ice', ru: 'ЛЁД', en: 'ICE', rarity: 'epic',
      core: '#FFFFFF', glow: '#9CE8FF', trail: '#B6F0FF', trail2: '#E8FBFF',
      spark: ['#B6F0FF', '#FFFFFF', '#5AB8E8'], muzzle: '#D6F8FF',
      shape: 'diamond', trailStyle: 'dotted', size: 1.06
    },
    {
      id: 'void', ru: 'БЕЗДНА', en: 'VOID', rarity: 'epic',
      core: '#E8D8FF', glow: '#8A4CFF', trail: '#6B2FD6', trail2: '#C9A6FF',
      spark: ['#8A4CFF', '#C9A6FF', '#2A1046'], muzzle: '#B98CFF',
      shape: 'orb', trailStyle: 'galaxy', size: 1.14
    },
    {
      id: 'rainbow', ru: 'РАДУГА', en: 'RAINBOW', rarity: 'legendary',
      core: '#FFFFFF', glow: '#FF6BC8', trail: '#FF6B6B', trail2: '#7CF3FF',
      spark: ['#FF6B6B', '#FFD84D', '#4FE0A0', '#55C8FF', '#B98CFF'], muzzle: '#FFFFFF',
      shape: 'orb', trailStyle: 'rainbow', size: 1.12, rainbow: true
    },
    {
      id: 'galaxy', ru: 'ГАЛАКТИКА', en: 'GALAXY', rarity: 'legendary',
      core: '#FFFFFF', glow: '#7A5CFF', trail: '#4A2FA8', trail2: '#9FE6FF',
      spark: ['#FFFFFF', '#9FE6FF', '#B98CFF', '#FFD84D'], muzzle: '#C9B6FF',
      shape: 'star', trailStyle: 'galaxy', size: 1.16
    },
    {
      id: 'aurora', ru: 'СИЯНИЕ', en: 'AURORA', rarity: 'legendary',
      core: '#F0FFF8', glow: '#4FFFC8', trail: '#4FE0B0', trail2: '#8A7CFF',
      spark: ['#4FFFC8', '#8A7CFF', '#FFFFFF'], muzzle: '#A8FFE0',
      shape: 'ring', trailStyle: 'wave', size: 1.12
    }
  ];

  // ---------------------------------------------------------
  // Оружие: разные модели, стволы, магазины, приклады, свечение
  // ---------------------------------------------------------
  const WEAPONS = [
    { id: 'pistol', ru: 'ПИСТОЛЕТ', en: 'PISTOL', rarity: 'common', accent: '#FF6B35', sound: 'pistol' },
    { id: 'smg', ru: 'ПП «ОСА»', en: 'SMG "WASP"', rarity: 'common', accent: '#38E8FF', sound: 'smg' },
    { id: 'revolver', ru: 'РЕВОЛЬВЕР', en: 'REVOLVER', rarity: 'rare', accent: '#FFD84D', sound: 'pistol' },
    { id: 'rifle', ru: 'АВТОМАТ', en: 'ASSAULT RIFLE', rarity: 'rare', accent: '#8CE86A', sound: 'rifle' },
    { id: 'shotgun', ru: 'ДРОБОВИК', en: 'SHOTGUN', rarity: 'rare', accent: '#FF9F43', sound: 'shotgun' },
    { id: 'blaster', ru: 'БЛАСТЕР', en: 'BLASTER', rarity: 'rare', accent: '#4FE0A0', sound: 'energy' },
    { id: 'dual', ru: 'ДВОЙНЫЕ', en: 'DUAL WIELD', rarity: 'rare', accent: '#FF6BC8', sound: 'smg' },
    { id: 'crossbow', ru: 'АРБАЛЕТ', en: 'CROSSBOW', rarity: 'rare', accent: '#C9A66B', sound: 'shotgun' },
    { id: 'sniper', ru: 'СНАЙПЕРКА', en: 'SNIPER', rarity: 'epic', accent: '#9CE8FF', sound: 'sniper' },
    { id: 'plasma', ru: 'ПЛАЗМЕР', en: 'PLASMA RIFLE', rarity: 'epic', accent: '#7CF3FF', sound: 'energy' },
    { id: 'minigun', ru: 'МИНИГАН', en: 'MINIGUN', rarity: 'epic', accent: '#FFB347', sound: 'minigun' },
    { id: 'railgun', ru: 'РЕЙЛГАН', en: 'RAILGUN', rarity: 'legendary', accent: '#B98CFF', sound: 'energy' },
    { id: 'launcher', ru: 'ГРАНАТОМЁТ', en: 'LAUNCHER', rarity: 'legendary', accent: '#FF3B5C', sound: 'shotgun' }
  ];

  const BULLET_BY_ID = Object.create(null);
  BULLETS.forEach(function (b) { BULLET_BY_ID[b.id] = b; });
  const WEAPON_BY_ID = Object.create(null);
  WEAPONS.forEach(function (w) { WEAPON_BY_ID[w.id] = w; });

  function bullet(id) { return BULLET_BY_ID[id] || BULLETS[0]; }
  function weapon(id) { return WEAPON_BY_ID[id] || WEAPONS[0]; }
  function rarity(id) { return RARITIES[id] || RARITIES.common; }
  function rarityName(id, lang) {
    const r = rarity(id);
    return lang === 'en' ? r.en : r.ru;
  }

  function defaultState() {
    return {
      coins: START_COINS,
      ownedBullets: { classic: 1, ember: 1 },
      ownedWeapons: { pistol: 1 },
      bulletSkin: 'classic',
      weaponSkin: 'pistol',
      casesOpened: 0
    };
  }

  /**
   * Проверяет и чинит косметику из сохранения/облака.
   * Возвращает true, если что-то пришлось исправить.
   */
  function sanitize(state) {
    if (!state || typeof state !== 'object') return false;
    let changed = false;
    const def = defaultState();

    if (typeof state.coins !== 'number' || !isFinite(state.coins) || state.coins < 0) {
      state.coins = def.coins; changed = true;
    }
    state.coins = Math.floor(state.coins);

    if (!state.ownedBullets || typeof state.ownedBullets !== 'object') {
      state.ownedBullets = Object.assign({}, def.ownedBullets); changed = true;
    }
    if (!state.ownedWeapons || typeof state.ownedWeapons !== 'object') {
      state.ownedWeapons = Object.assign({}, def.ownedWeapons); changed = true;
    }
    if (!state.ownedBullets.classic) { state.ownedBullets.classic = 1; changed = true; }
    if (!state.ownedBullets.ember) { state.ownedBullets.ember = 1; changed = true; }
    if (!state.ownedWeapons.pistol) { state.ownedWeapons.pistol = 1; changed = true; }
    Object.keys(state.ownedBullets).forEach(function (id) {
      if (!BULLET_BY_ID[id]) { delete state.ownedBullets[id]; changed = true; }
    });
    Object.keys(state.ownedWeapons).forEach(function (id) {
      if (!WEAPON_BY_ID[id]) { delete state.ownedWeapons[id]; changed = true; }
    });
    if (!BULLET_BY_ID[state.bulletSkin] || !state.ownedBullets[state.bulletSkin]) {
      state.bulletSkin = 'classic'; changed = true;
    }
    if (!WEAPON_BY_ID[state.weaponSkin] || !state.ownedWeapons[state.weaponSkin]) {
      state.weaponSkin = 'pistol'; changed = true;
    }
    if (typeof state.casesOpened !== 'number' || !isFinite(state.casesOpened) || state.casesOpened < 0) {
      state.casesOpened = 0; changed = true;
    }
    state.casesOpened = Math.floor(state.casesOpened);
    return changed;
  }

  function isOwned(state, type, id) {
    if (!state) return false;
    const map = type === 'weapon' ? state.ownedWeapons : state.ownedBullets;
    return !!(map && map[id]);
  }

  /**
   * Открытие кейса. Сначала выбирается редкость (веса RARITIES),
   * затем случайный ещё не открытый предмет этой редкости.
   * Если все скины собраны — возвращается компенсация монетами.
   */
  function roll(state, rng) {
    const rand = rng || Math.random;
    const locked = [];
    BULLETS.forEach(function (b) {
      if (!isOwned(state, 'bullet', b.id)) locked.push({ type: 'bullet', id: b.id, item: b });
    });
    WEAPONS.forEach(function (w) {
      if (!isOwned(state, 'weapon', w.id)) locked.push({ type: 'weapon', id: w.id, item: w });
    });
    if (!locked.length) return { type: 'coins', amount: ALL_OWNED_COINS };

    const buckets = Object.create(null);
    let total = 0;
    locked.forEach(function (c) {
      const key = c.item.rarity;
      if (!buckets[key]) {
        buckets[key] = [];
        total += rarity(key).weight;
      }
      buckets[key].push(c);
    });

    let value = rand() * total;
    let chosenRarity = null;
    ['common', 'rare', 'epic', 'legendary'].forEach(function (id) {
      if (chosenRarity) return;
      const r = RARITIES[id];
      if (!buckets[id]) return;
      if (value < r.weight) chosenRarity = id;
      value -= r.weight;
    });
    if (!chosenRarity) chosenRarity = Object.keys(buckets)[0];
    const list = buckets[chosenRarity] || locked;
    const pickItem = list[Math.floor(rand() * list.length)] || locked[0];
    return {
      type: pickItem.type,
      id: pickItem.id,
      item: pickItem.item,
      rarity: pickItem.item.rarity
    };
  }

  const Skins = {
    CASE_COST: CASE_COST,
    START_COINS: START_COINS,
    ALL_OWNED_COINS: ALL_OWNED_COINS,
    RARITIES: RARITIES,
    bullets: BULLETS,
    weapons: WEAPONS,
    bullet: bullet,
    weapon: weapon,
    rarity: rarity,
    rarityName: rarityName,
    defaultState: defaultState,
    sanitize: sanitize,
    isOwned: isOwned,
    roll: roll
  };

  global.Skins = Skins;
  if (typeof module !== 'undefined' && module.exports) module.exports = Skins;
})(typeof window !== 'undefined' ? window : globalThis);
