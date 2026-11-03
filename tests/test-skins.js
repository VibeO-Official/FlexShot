/* Скины, кейс и монеты: node tests/test-skins.js */
const Skins = require('../js/skins.js');
const Enemies = require('../js/enemies.js');

let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ok   ' + name);
  else { fails++; console.log('  FAIL ' + name + (extra !== undefined ? ' -> ' + extra : '')); }
}

// ---------- каталог ----------
check('скины пуль есть', Skins.bullets.length >= 12, Skins.bullets.length);
check('модели оружия есть', Skins.weapons.length >= 10, Skins.weapons.length);
check('у каждой пули свой стиль следа', Skins.bullets.every(b => !!b.trailStyle && !!b.shape));
check('у каждого оружия свой id', new Set(Skins.weapons.map(w => w.id)).size === Skins.weapons.length);
check('редкости определены',
  ['common', 'rare', 'epic', 'legendary'].every(r => !!Skins.RARITIES[r]));
check('неизвестный скин → классика', Skins.bullet('nope').id === 'classic');
check('неизвестное оружие → пистолет', Skins.weapon('nope').id === 'pistol');

// ---------- сохранение ----------
const def = Skins.defaultState();
check('стартовые монеты', def.coins === Skins.START_COINS, def.coins);
check('классика и уголёк открыты', !!def.ownedBullets.classic && !!def.ownedBullets.ember);
check('пистолет открыт', !!def.ownedWeapons.pistol);

const junk = { coins: -50, ownedBullets: { classic: 1, hacker: 1 }, ownedWeapons: {}, bulletSkin: 'hacker', weaponSkin: 'nope' };
Skins.sanitize(junk);
check('sanitize чинит монеты', junk.coins === Skins.START_COINS, junk.coins);
check('sanitize убирает неизвестные скины', !junk.ownedBullets.hacker);
check('sanitize возвращает классику', junk.bulletSkin === 'classic');
check('sanitize возвращает пистолет', junk.weaponSkin === 'pistol' && !!junk.ownedWeapons.pistol);

// ---------- кейс ----------
const state = Skins.defaultState();
const seen = new Set();
let bad = false;
for (let i = 0; i < 400; i++) {
  const res = Skins.roll(state, () => Math.random());
  if (res.type === 'coins') continue;
  if (!res.id || !res.item) { bad = true; break; }
  if (Skins.isOwned(state, res.type, res.id)) { bad = true; break; }
  seen.add(res.type + ':' + res.id);
  if (res.type === 'bullet') state.ownedBullets[res.id] = 1;
  else state.ownedWeapons[res.id] = 1;
}
check('кейс не выдаёт уже открытое', !bad);
check('кейс выдаёт разные предметы', seen.size >= 8, seen.size);

// Все скины собраны → компенсация, но не бесконечная прибыль
const full = Skins.defaultState();
Skins.bullets.forEach(b => { full.ownedBullets[b.id] = 1; });
Skins.weapons.forEach(w => { full.ownedWeapons[w.id] = 1; });
const all = Skins.roll(full, Math.random);
check('все скины собраны → монеты', all.type === 'coins', all.type);
check('компенсация меньше цены кейса', all.amount < Skins.CASE_COST, all.amount + '/' + Skins.CASE_COST);

// ---------- враги ----------
check('типов врагов не меньше 10', Enemies.list.length >= 10, Enemies.list.length);
check('виды врагов уникальны', new Set(Enemies.ids).size === Enemies.ids.length);
const kinds = new Set();
for (let i = 0; i < 80; i++) {
  const k = Enemies.kindFor({
    x: 100 + (i * 47) % 900,
    y: 100 + (i * 83) % 500,
    move: { type: ['static', 'patrol', 'orbit'][i % 3] }
  }, i);
  kinds.add(k.id);
}
check('архетипы врагов разнообразны', kinds.size >= 7, kinds.size);
check('тип врага детерминирован',
  Enemies.kindFor({ x: 10, y: 20, move: { type: 'patrol' } }, 3).id ===
  Enemies.kindFor({ x: 10, y: 20, move: { type: 'patrol' } }, 3).id);

console.log(fails ? '\nSKINS TEST FAILED: ' + fails : '\nSKINS TEST OK');
process.exit(fails ? 1 : 0);
