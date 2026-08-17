// Позонная боевая формула — адаптация реальной формулы territory.ru (fight.module)
// под MVP-набор статов (STRENGTH/DEXTERITY/HEALTH). Полный набор (WILL/INTUITION/
// CHARM/MIND/PROF_*) из оригинала добавится в фазе 3+, когда появятся кланы/война —
// пока крит/уворот упрощены до diminishing-кривой от одного DEX вместо композиции из 5 статов.

const ZONES = ["head", "chest", "groin", "legs"];

const EXP_TABLE = [0, 5, 10, 17, 25, 35, 47, 60, 75, 92, 110, 130, 152, 175, 200, 227, 255, 285, 317, 350, 385, 422, 460, 500, 542, 585, 630, 677, 725, 775, 827];

function maxHpFor(stats) {
  return 4 * stats.health + stats.str;
}

function computeDamage({ str, weaponHit, blockZone, zone, defenderArmorZone, defenderDex }) {
  const dodgeChance = Math.min(30, (Math.atan(defenderDex / 15) / (Math.PI / 2)) * 30);
  if (Math.random() * 100 < dodgeChance) return { dmg: 0, dodged: true, crit: false };

  const x1 = Math.random();
  const x2 = 0.5 + Math.random() * 0.5;
  const x3 = Math.random();
  const [hitMin, hitMax] = weaponHit;
  let dmg = 0.5 + (hitMin + (hitMax - hitMin) * x1) + str * x2 - (defenderArmorZone || 0) * x3;

  const critChance = 5 + str * 0.3;
  const isCrit = Math.random() * 100 < critChance;
  if (isCrit) dmg *= 1.8;

  if (zone === blockZone) {
    dmg = isCrit ? dmg / 2 : 0;
  }
  dmg = zone === blockZone && !isCrit ? 0 : Math.max(1, Math.round(dmg));
  return { dmg, dodged: false, crit: isCrit };
}

function armorForZone(armorObj, zone) {
  return (armorObj && armorObj[zone]) || 0;
}

module.exports = { ZONES, EXP_TABLE, maxHpFor, computeDamage, armorForZone };
