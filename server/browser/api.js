// REST API для Territory Browser — смонтирован в основном server.js под /browser-api,
// совершенно отдельно от /api/* (Telegram-игра). Свои таблицы (browser_players/
// browser_session), свой bcrypt-логин, никак не пересекается с telegramAuth.
const express = require("express");
const bcrypt = require("bcryptjs");

const db = require("./db");
const world = require("./world");
const combat = require("./combat");

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.playerId) return res.status(401).json({ error: "not authenticated" });
  next();
}

function freshPlayerState(name, gender) {
  const stats = { str: 3, dex: 3, health: 4 };
  return {
    name, gender,
    level: 1, exp: 0,
    stats, freePoints: 0,
    maxHp: combat.maxHpFor(stats), hp: combat.maxHpFor(stats),
    areaId: world.START_AREA,
    rub: 100,
    inventory: {},
    equipment: { rh: null, lh: null, gu: null, ac: null, bo: null, vo: null, no: null, sh: null },
    wins: 0, losses: 0,
  };
}

function fighterFromState(state) {
  const armor = { head: 0, chest: 0, groin: 0, legs: 0 };
  Object.values(state.equipment).forEach((itemId) => {
    if (!itemId) return;
    const item = world.itemById(itemId);
    if (item && item.armor) Object.keys(item.armor).forEach((z) => { armor[z] += item.armor[z]; });
  });
  const weaponItem = state.equipment.rh ? world.itemById(state.equipment.rh) : null;
  const weaponHit = weaponItem ? weaponItem.hit : world.BARE_HANDS.hit;
  return { str: state.stats.str, dex: state.stats.dex, health: state.stats.health, armor, weaponHit };
}

// ===== Auth =====
router.post("/register", async (req, res) => {
  try {
    const { login, password, email, gender } = req.body || {};
    if (!login || !password || login.length < 3 || password.length < 4) {
      return res.status(400).json({ error: "логин от 3 и пароль от 4 символов" });
    }
    const existing = await db.getPlayerByLogin(login);
    if (existing) return res.status(409).json({ error: "логин занят" });
    const hash = await bcrypt.hash(password, 10);
    const state = freshPlayerState(login, gender === "f" ? "f" : "m");
    const row = await db.createPlayer(login, hash, email || null, state);
    req.session.playerId = row.id;
    res.json({ ok: true, state: row.state });
  } catch (e) {
    console.error("[browser] register failed:", e);
    res.status(500).json({ error: "ошибка регистрации" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { login, password } = req.body || {};
    const row = await db.getPlayerByLogin(login || "");
    if (!row) return res.status(401).json({ error: "неверный логин или пароль" });
    const ok = await bcrypt.compare(password || "", row.password_hash);
    if (!ok) return res.status(401).json({ error: "неверный логин или пароль" });
    req.session.playerId = row.id;
    res.json({ ok: true, state: row.state });
  } catch (e) {
    console.error("[browser] login failed:", e);
    res.status(500).json({ error: "ошибка входа" });
  }
});

router.post("/logout", (req, res) => { req.session.destroy(() => res.json({ ok: true })); });

router.get("/me", requireAuth, async (req, res) => {
  const row = await db.getPlayerById(req.session.playerId);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json({ state: row.state });
});

// ===== World =====
router.get("/world", (req, res) => {
  res.json({ city: world.CITY, areas: world.AREAS, links: world.LINKS, npcs: world.NPCS, items: world.ITEMS });
});

// ===== Movement =====
router.post("/move", requireAuth, async (req, res) => {
  const row = await db.getPlayerById(req.session.playerId);
  const state = row.state;
  const { areaId } = req.body || {};
  const neighbors = world.linkedAreas(state.areaId).map((n) => n.area.id);
  if (!neighbors.includes(areaId)) return res.status(400).json({ error: "туда нельзя пройти напрямую" });
  state.areaId = areaId;
  await db.savePlayerState(row.id, state);
  res.json({ ok: true, state });
});

// ===== Shop =====
router.post("/shop/buy", requireAuth, async (req, res) => {
  const row = await db.getPlayerById(req.session.playerId);
  const state = row.state;
  const area = world.areaById(state.areaId);
  if (!area || !area.shop) return res.status(400).json({ error: "здесь нет магазина" });
  const item = world.itemById((req.body || {}).itemId);
  if (!item) return res.status(404).json({ error: "предмет не найден" });
  if (state.rub < item.price) return res.status(400).json({ error: "недостаточно денег" });
  state.rub = Math.round((state.rub - item.price) * 100) / 100;
  state.inventory[item.id] = (state.inventory[item.id] || 0) + 1;
  await db.savePlayerState(row.id, state);
  res.json({ ok: true, state });
});

router.post("/shop/sell", requireAuth, async (req, res) => {
  const row = await db.getPlayerById(req.session.playerId);
  const state = row.state;
  const area = world.areaById(state.areaId);
  if (!area || !area.shop) return res.status(400).json({ error: "здесь нет магазина" });
  const item = world.itemById((req.body || {}).itemId);
  if (!item || !state.inventory[item.id]) return res.status(400).json({ error: "нет такого предмета" });
  state.inventory[item.id] -= 1;
  if (state.inventory[item.id] <= 0) delete state.inventory[item.id];
  state.rub = Math.round((state.rub + item.price * 0.5) * 100) / 100;
  await db.savePlayerState(row.id, state);
  res.json({ ok: true, state });
});

// ===== Equipment =====
router.post("/equip", requireAuth, async (req, res) => {
  const row = await db.getPlayerById(req.session.playerId);
  const state = row.state;
  const item = world.itemById((req.body || {}).itemId);
  if (!item || !state.inventory[item.id]) return res.status(400).json({ error: "нет такого предмета в рюкзаке" });
  const prevItemId = state.equipment[item.slot];
  state.inventory[item.id] -= 1;
  if (state.inventory[item.id] <= 0) delete state.inventory[item.id];
  if (prevItemId) state.inventory[prevItemId] = (state.inventory[prevItemId] || 0) + 1;
  state.equipment[item.slot] = item.id;
  await db.savePlayerState(row.id, state);
  res.json({ ok: true, state });
});

router.post("/unequip", requireAuth, async (req, res) => {
  const row = await db.getPlayerById(req.session.playerId);
  const state = row.state;
  const { slot } = req.body || {};
  const itemId = state.equipment[slot];
  if (!itemId) return res.status(400).json({ error: "слот пуст" });
  state.equipment[slot] = null;
  state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
  await db.savePlayerState(row.id, state);
  res.json({ ok: true, state });
});

// ===== Stat points =====
router.post("/stats/allocate", requireAuth, async (req, res) => {
  const row = await db.getPlayerById(req.session.playerId);
  const state = row.state;
  const { stat } = req.body || {};
  if (!["str", "dex", "health"].includes(stat)) return res.status(400).json({ error: "неверный стат" });
  if (state.freePoints <= 0) return res.status(400).json({ error: "нет свободных очков" });
  state.stats[stat] += 1;
  state.freePoints -= 1;
  const newMax = combat.maxHpFor(state.stats);
  state.hp += newMax - state.maxHp;
  state.maxHp = newMax;
  await db.savePlayerState(row.id, state);
  res.json({ ok: true, state });
});

// ===== Combat vs NPCs =====
const activeFights = new Map();

router.post("/fight/start", requireAuth, async (req, res) => {
  const row = await db.getPlayerById(req.session.playerId);
  const state = row.state;
  if (activeFights.has(row.id)) return res.status(400).json({ error: "вы уже в бою" });
  const area = world.areaById(state.areaId);
  const { npcKey } = req.body || {};
  if (!area || !area.npcs.includes(npcKey)) return res.status(400).json({ error: "такого противника здесь нет" });
  const npc = world.NPCS[npcKey];
  const npcMaxHp = combat.maxHpFor({ str: npc.str, health: npc.health });
  activeFights.set(row.id, { npcKey, npcHp: npcMaxHp, npcMaxHp, areaId: state.areaId, round: 0 });
  res.json({ ok: true, npc: { key: npcKey, name: npc.name, hp: npcMaxHp, maxHp: npcMaxHp }, selfHp: state.hp, selfMaxHp: state.maxHp });
});

router.post("/fight/turn", requireAuth, async (req, res) => {
  const row = await db.getPlayerById(req.session.playerId);
  const state = row.state;
  const fight = activeFights.get(row.id);
  if (!fight) return res.status(400).json({ error: "нет активного боя" });
  const { zone, block } = req.body || {};
  if (!combat.ZONES.includes(zone) || !combat.ZONES.includes(block)) return res.status(400).json({ error: "неверная зона" });

  const npc = world.NPCS[fight.npcKey];
  const fighter = fighterFromState(state);

  const playerAtk = combat.computeDamage({
    str: fighter.str, weaponHit: fighter.weaponHit, zone, blockZone: "none",
    defenderArmorZone: combat.armorForZone(npc.armor, zone), defenderDex: npc.dex,
  });
  fight.npcHp = Math.max(0, fight.npcHp - playerAtk.dmg);

  let npcAtk = null;
  if (fight.npcHp > 0) {
    const npcZone = combat.ZONES[Math.floor(Math.random() * 4)];
    const npcBlock = combat.ZONES[Math.floor(Math.random() * 4)];
    npcAtk = combat.computeDamage({
      str: npc.str, weaponHit: npc.hit, zone: npcZone, blockZone: block,
      defenderArmorZone: combat.armorForZone(fighter.armor, npcZone), defenderDex: fighter.dex,
    });
    state.hp = Math.max(0, state.hp - npcAtk.dmg);
  }
  fight.round += 1;

  const npcDefeated = fight.npcHp <= 0;
  const playerDefeated = state.hp <= 0;
  let reward = null;

  if (npcDefeated || playerDefeated || fight.round >= 20) {
    activeFights.delete(row.id);
    if (npcDefeated) {
      const expGain = 5 + npc.str + npc.health;
      const rubGain = 5 + Math.round(npc.str * 1.5);
      state.exp += expGain;
      state.rub = Math.round((state.rub + rubGain) * 100) / 100;
      state.wins += 1;
      let leveledUp = false;
      while (state.level < 30 && state.exp >= combat.EXP_TABLE[state.level]) {
        state.level += 1;
        state.freePoints += 3;
        leveledUp = true;
      }
      if (leveledUp) {
        const newMax = combat.maxHpFor(state.stats);
        state.hp = Math.min(newMax, state.hp + (newMax - state.maxHp));
        state.maxHp = newMax;
      }
      reward = { exp: expGain, rub: rubGain, leveledUp, level: state.level };
    } else if (playerDefeated) {
      state.losses += 1;
      state.hp = Math.max(1, Math.round(state.maxHp * 0.3));
    }
  }
  await db.savePlayerState(row.id, state);

  res.json({
    ok: true, round: fight.round, playerAtk, npcAtk,
    npcHp: fight.npcHp, npcMaxHp: fight.npcMaxHp,
    selfHp: state.hp, selfMaxHp: state.maxHp,
    over: npcDefeated || playerDefeated || fight.round >= 20,
    won: npcDefeated, reward, state,
  });
});

router.post("/fight/flee", requireAuth, (req, res) => {
  activeFights.delete(req.session.playerId);
  res.json({ ok: true });
});

module.exports = router;
