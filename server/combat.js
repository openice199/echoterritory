// Серверная копия боевых формул из web/app.js (zoneDefense/equipmentStatBonus/
// effectiveStats/computeDamage/simulateDuel) — намеренно продублирована, а не
// импортирована, т.к. клиентский файл написан для браузера (глобальный `state`).
// Держи в синхроне с app.js, если меняешь баланс боя.

const ZONES = ["head", "chest", "belly", "legs"];
const ZONE_MULTIPLIER = { head: 1.5, chest: 1.0, belly: 0.8, legs: 0.6 };

function getEquippedItem(state, slotKey) {
  const id = state.player.equipment[slotKey];
  return id ? state.inventory.find((i) => i.id === id) : null;
}

function getEquippedWeapon(state) {
  return getEquippedItem(state, "weapon") || { name: "Голые руки", dmgMin: 2, dmgMax: 4 };
}

function zoneDefense(state, zone) {
  let total = 0;
  Object.keys(state.player.equipment).forEach((slotKey) => {
    const it = getEquippedItem(state, slotKey);
    if (it && it.zone === zone) total += it.def || 0;
  });
  return total;
}

function equipmentStatBonus(state) {
  const bonus = { str: 0, agi: 0, hpStat: 0, luck: 0 };
  Object.keys(state.player.equipment).forEach((slotKey) => {
    const it = getEquippedItem(state, slotKey);
    if (it && it.statBonus) {
      Object.keys(it.statBonus).forEach((k) => { bonus[k] = (bonus[k] || 0) + it.statBonus[k]; });
    }
  });
  return bonus;
}

function equipmentCritBonus(state) {
  let total = 0;
  Object.keys(state.player.equipment).forEach((slotKey) => {
    const it = getEquippedItem(state, slotKey);
    if (it && it.critBonus) total += it.critBonus;
  });
  return total;
}

function effectiveStats(state) {
  const b = equipmentStatBonus(state);
  const s = state.player.stats;
  return {
    str: Math.round(s.str + b.str),
    agi: Math.round(s.agi + b.agi),
    hpStat: Math.round(s.hpStat + b.hpStat),
    luck: Math.round(s.luck + b.luck),
  };
}

// Профиль бойца для упрощённого (не позонного интерактивного, а мгновенно
// разрешаемого) дуэльного симулятора — тот же, что использует клиент для арены/войн.
function fighterFromState(state) {
  const s = effectiveStats(state);
  const w = getEquippedWeapon(state);
  return {
    str: s.str, agi: s.agi, luck: s.luck, hpStat: s.hpStat,
    weaponAvg: (w.dmgMin + w.dmgMax) / 2,
    def: zoneDefense(state, "chest"),
    critBonus: equipmentCritBonus(state),
  };
}

function computeDamage(attackerStats, weaponAvg, zone, blockZone, defenderArmor) {
  const roll = () => Math.random() * 100;
  const dodgeChance = Math.min(25, attackerStats.agiDef * 0.3);
  if (roll() < dodgeChance) return { dmg: 0, dodged: true, crit: false };
  const base = (attackerStats.str * 1.5 + weaponAvg) * (1 + attackerStats.agi * 0.01);
  const critChance = 5 + attackerStats.luck * 0.5 + (attackerStats.critBonus || 0);
  const isCrit = roll() < critChance;
  let dmg = base * ZONE_MULTIPLIER[zone] * (isCrit ? 1.5 : 1);
  if (zone === blockZone) dmg *= 0.3;
  // % снижение урона с уменьшающейся отдачей вместо плоского вычитания —
  // держи в синхроне с web/app.js::computeDamage.
  const mitigation = Math.min(0.7, (defenderArmor || 0) / ((defenderArmor || 0) + 30));
  dmg = Math.max(1, Math.round(dmg * (1 - mitigation)));
  return { dmg, dodged: false, crit: isCrit };
}

// Один раунд = один обмен ударами. Возвращает итог всей дуэли (до 20 раундов,
// как в клиентском симуляторе арены/войн).
function simulateDuel(a, b) {
  let hpA = 80 + a.hpStat * 4;
  let hpB = 80 + b.hpStat * 4;
  const maxHpA = hpA, maxHpB = hpB;
  let rounds = 0;
  while (hpA > 0 && hpB > 0 && rounds < 20) {
    rounds++;
    const zoneA = ZONES[Math.floor(Math.random() * 4)];
    const zoneBBlock = ZONES[Math.floor(Math.random() * 4)];
    const resA = computeDamage({ str: a.str, agi: a.agi, luck: a.luck, agiDef: b.agi, critBonus: a.critBonus }, a.weaponAvg, zoneA, zoneBBlock, b.def);
    if (!resA.dodged) hpB -= resA.dmg;
    if (hpB <= 0) break;
    const zoneB = ZONES[Math.floor(Math.random() * 4)];
    const zoneABlock = ZONES[Math.floor(Math.random() * 4)];
    const resB = computeDamage({ str: b.str, agi: b.agi, luck: b.luck, agiDef: a.agi, critBonus: b.critBonus }, b.weaponAvg, zoneB, zoneABlock, a.def);
    if (!resB.dodged) hpA -= resB.dmg;
  }
  return { aWins: hpA >= hpB, hpA: Math.max(0, hpA), hpB: Math.max(0, hpB), maxHpA, maxHpB, rounds };
}

module.exports = { fighterFromState, simulateDuel, effectiveStats, computeDamage, ZONES };
