const { fighterFromState, simulateDuel } = require("./combat");
const db = require("./db");

// Ставки налога — зеркало districts[].taxValue из web/app.js. Держи в синхроне.
const DISTRICT_TAX = {
  vokzal: 200, promzona: 280, prospect: 240, naberezhnaya: 320, les: 360,
  old: 400, port: 600, center: 760, catacombs: 1000,
};

const WAR_PREP_MS = 5 * 60 * 1000; // реальным людям нужно время собраться — 5 минут
const WAR_DECLARE_COST = 5000;

async function resolveRoster(roster) {
  const out = [];
  for (const r of roster || []) {
    const saved = await db.loadPlayer(r.telegramId);
    if (!saved) continue;
    out.push({ telegramId: r.telegramId, name: r.name, fighter: fighterFromState(saved.state) });
  }
  return out;
}

async function resolveWar(war) {
  const attackers = await resolveRoster(war.attacker_roster);
  const defenders = await resolveRoster(war.defender_roster);
  let result;

  if (!defenders.length) {
    await db.setTerritoryOwner(war.district_id, war.attacker_clan_id);
    result = { attackerWon: true, uncontested: true, attackerScore: 0, defenderScore: 0, log: ["Защитники не явились — территория перешла без боя."] };
  } else if (!attackers.length) {
    result = { attackerWon: false, uncontested: true, attackerScore: 0, defenderScore: 0, log: ["Атакующие не явились — атака провалена."] };
  } else {
    const log = [];
    let attackerScore = 0, defenderScore = 0;
    const pairs = Math.min(attackers.length, defenders.length);
    for (let i = 0; i < pairs; i++) {
      const duel = simulateDuel(attackers[i].fighter, defenders[i].fighter);
      if (duel.aWins) { attackerScore++; log.push(`⚔️ ${attackers[i].name} побеждает ${defenders[i].name}`); }
      else { defenderScore++; log.push(`🛡 ${defenders[i].name} отбивает ${attackers[i].name}`); }
    }
    attackers.slice(pairs).forEach((a) => {
      if (Math.random() < 0.6) { attackerScore++; log.push(`⚔️ ${a.name} прорывается через охрану района`); }
      else log.push(`🛡 Охрана района останавливает ${a.name}`);
    });
    defenders.slice(pairs).forEach((d) => {
      if (Math.random() < 0.5) { defenderScore++; log.push(`🛡 ${d.name} держит рубеж в одиночку`); }
    });
    const attackerWon = attackerScore > defenderScore;
    if (attackerWon) await db.setTerritoryOwner(war.district_id, war.attacker_clan_id);
    result = { attackerWon, attackerScore, defenderScore, log };
  }

  await db.resolveWarRow(war.id, result);
  return result;
}

function startWarSweep(io) {
  setInterval(async () => {
    try {
      const expired = await db.getExpiredWars();
      for (const war of expired) {
        const result = await resolveWar(war);
        if (io) io.emit("war_resolved", { warId: war.id, districtId: war.district_id, result });
      }
    } catch (e) {
      console.error("war sweep failed:", e.message);
    }
  }, 15000);
}

module.exports = { DISTRICT_TAX, WAR_PREP_MS, WAR_DECLARE_COST, resolveWar, startWarSweep };
