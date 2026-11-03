/* =========================================================
   ONE BULLET / FlexShot — enemies.js
   Архетипы врагов. Это слой внешности и характера:
   физика (радиус, движение) остаётся из уровня, поэтому
   проходимость и генерация не меняются.

   kindFor() детерминированно выбирает тип по позиции,
   схеме движения и индексу врага.
   ========================================================= */
(function (global) {
  'use strict';

  const TYPES = [
    {
      id: 'grunt', ru: 'ШТУРМОВИК', en: 'GRUNT', tier: 1,
      weapon: 'pistol', ink: '#1A0A0F', head: '#F4E4E7', shoes: '#3A1C1C',
      band: '#E82A46', hat: 'bandana', aura: '#FF3B5C'
    },
    {
      id: 'runner', ru: 'БЕГУН', en: 'RUNNER', tier: 1,
      weapon: 'smg', ink: '#14202A', head: '#EAF4F8', shoes: '#1E3A46',
      band: '#38E8FF', hat: 'cap', scarf: true, aura: '#38E8FF'
    },
    {
      id: 'marksman', ru: 'СНАЙПЕР', en: 'MARKSMAN', tier: 1,
      weapon: 'sniper', ink: '#142018', head: '#DDE8D8', shoes: '#24342A',
      band: '#8CE86A', hat: 'hood', laser: true, aura: '#8CE86A'
    },
    {
      id: 'heavy', ru: 'ТЯЖЕЛОВЕС', en: 'HEAVY', tier: 2,
      weapon: 'shotgun', ink: '#221418', head: '#E8D8D8', shoes: '#3A2020',
      band: '#FF6B35', hat: 'helmet', armor: true, aura: '#FF6B35'
    },
    {
      id: 'captain', ru: 'КАПИТАН', en: 'CAPTAIN', tier: 2,
      weapon: 'revolver', ink: '#241A12', head: '#F4E8D8', shoes: '#4A3020',
      band: '#FFD84D', hat: 'officer', epaulettes: true, aura: '#FFD84D'
    },
    {
      id: 'ninja', ru: 'НИНДЗЯ', en: 'NINJA', tier: 2,
      weapon: 'smg', ink: '#08080F', head: '#B8B8C8', shoes: '#08080F',
      band: '#B3122E', hat: 'hood', scarf: true, aura: '#B3122E'
    },
    {
      id: 'drone', ru: 'ДРОН', en: 'DRONE', tier: 3,
      weapon: 'plasma', ink: '#2A2E38', head: '#C8D8E8', shoes: '#2A2E38',
      band: '#38E8FF', robot: true, aura: '#38E8FF'
    },
    {
      id: 'juggernaut', ru: 'ДЖАГГЕРНАУТ', en: 'JUGGERNAUT', tier: 3,
      weapon: 'minigun', ink: '#1E2424', head: '#A8B8B8', shoes: '#1E2424',
      band: '#FF9F43', hat: 'helmet', armor: true, aura: '#FF9F43'
    },
    {
      id: 'alien', ru: 'ПРИШЕЛЕЦ', en: 'ALIEN', tier: 2,
      weapon: 'blaster', ink: '#1A3A20', head: '#8FE07A', shoes: '#1A3A20',
      band: '#4FE07A', hat: 'antenna', alien: true, aura: '#4FE07A'
    },
    {
      id: 'zombie', ru: 'ЗОМБИ', en: 'ZOMBIE', tier: 1,
      weapon: 'pistol', ink: '#24301E', head: '#B8C89A', shoes: '#2A2A1E',
      band: '#7A2A2A', hat: 'none', zombie: true, aura: '#7A2A2A'
    },
    {
      id: 'saboteur', ru: 'САБОТЁР', en: 'SABOTEUR', tier: 2,
      weapon: 'dual', ink: '#2A1420', head: '#F0DDE4', shoes: '#2A1420',
      band: '#FF6BC8', hat: 'cap', scarf: true, aura: '#FF6BC8'
    },
    {
      id: 'guardian', ru: 'СТРАЖ', en: 'GUARDIAN', tier: 3,
      weapon: 'railgun', ink: '#1A2438', head: '#C8D8F0', shoes: '#1A2438',
      band: '#B98CFF', hat: 'helmet', armor: true, aura: '#B98CFF'
    }
  ];

  const BY_ID = Object.create(null);
  TYPES.forEach(function (t) { BY_ID[t.id] = t; });

  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function byId(id) { return BY_ID[id] || TYPES[0]; }

  /**
   * Тип врага выводится из уровня и индекса. Это значит:
   * одинаковый уровень всегда даёт одинаковый набор врагов,
   * а разные схемы движения получают разных противников.
   */
  function kindFor(def, index) {
    if (!def) return TYPES[0];
    if (def.kind && BY_ID[def.kind]) return BY_ID[def.kind];
    const move = (def.move && def.move.type) || 'static';
    const h = hash(String(Math.round(def.x || 0)) + ':' + String(Math.round(def.y || 0)) +
      ':' + move + ':' + String(index || 0));
    if (move === 'orbit') {
      const pool = ['drone', 'drone', 'alien', 'ninja', 'guardian'];
      return BY_ID[pool[h % pool.length]];
    }
    if (move === 'patrol') {
      const pool = ['runner', 'runner', 'marksman', 'saboteur', 'ninja', 'captain'];
      return BY_ID[pool[h % pool.length]];
    }
    const pool = ['grunt', 'grunt', 'heavy', 'juggernaut', 'marksman', 'captain', 'zombie', 'runner', 'saboteur'];
    return BY_ID[pool[h % pool.length]];
  }

  const Enemies = {
    list: TYPES,
    ids: TYPES.map(function (t) { return t.id; }),
    byId: byId,
    kindFor: kindFor,
    hash: hash
  };

  global.Enemies = Enemies;
  if (typeof module !== 'undefined' && module.exports) module.exports = Enemies;
})(typeof window !== 'undefined' ? window : globalThis);
