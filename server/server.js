require("dotenv").config({ quiet: true });
const path = require("path");
const http = require("http");
const express = require("express");
const { validateInitData } = require("./telegramAuth");
const {
  loadPlayer, savePlayer, listPlayers, deletePlayer,
  listClans, getClan, getClanForPlayer, createClan, joinClan, leaveClan, tryDeductRub,
  listArenaOpponents,
  listTerritories, getTerritoryOwner, getActiveWarForDistrict, getActiveWarForClan,
  getWar, createWar, joinWarRoster, collectClanTax,
} = require("./db");
const { setupRealtime } = require("./realtime");
const { DISTRICT_TAX, WAR_PREP_MS, WAR_DECLARE_COST, startWarSweep } = require("./territory");
const { startJobNotifySweep } = require("./jobs");

const PORT = process.env.PORT || 8430;
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const ADMIN_KEY = process.env.ADMIN_KEY || "";
// Пока нет реального бота — разрешаем локальную авторизацию через заголовок x-dev-user-id.
// Как только BOT_TOKEN появится, ставь ALLOW_DEV_AUTH=0 в проде, чтобы это не осталось лазейкой.
const ALLOW_DEV_AUTH = process.env.ALLOW_DEV_AUTH !== "0";
const CLAN_CREATE_COST = 50000;

const app = express();
app.use(express.json({ limit: "300kb" }));

function authenticate(req, res, next) {
  const initData = req.body?.initData || req.query.initData;
  const verified = validateInitData(initData, BOT_TOKEN);
  if (verified) {
    req.telegramId = verified.id;
    req.telegramName = verified.username || verified.firstName || null;
    return next();
  }
  if (ALLOW_DEV_AUTH) {
    const devId = req.headers["x-dev-user-id"];
    if (devId) {
      req.telegramId = "dev_" + devId;
      req.telegramName = "dev:" + devId;
      return next();
    }
  }
  return res.status(401).json({ error: "unauthorized" });
}

app.get("/api/load", authenticate, async (req, res) => {
  try {
    const saved = await loadPlayer(req.telegramId);
    if (!saved) return res.json({ isNew: true });
    res.json({ isNew: false, state: saved.state, updatedAt: saved.updatedAt });
  } catch (e) {
    console.error("load failed:", e);
    res.status(500).json({ error: "load failed" });
  }
});

app.post("/api/save", authenticate, async (req, res) => {
  const { state } = req.body || {};
  if (!state || typeof state !== "object" || !state.player || !Array.isArray(state.inventory)) {
    return res.status(400).json({ error: "malformed state" });
  }
  try {
    const updatedAt = await savePlayer(req.telegramId, req.telegramName, state);
    res.json({ ok: true, updatedAt });
  } catch (e) {
    console.error("save failed:", e);
    res.status(500).json({ error: "save failed" });
  }
});

app.get("/api/health", (req, res) => res.json({ ok: true, devAuth: ALLOW_DEV_AUTH }));

/* ===== Кланы ===== */
app.get("/api/clans", authenticate, async (req, res) => {
  try {
    res.json(await listClans());
  } catch (e) {
    console.error("list clans failed:", e);
    res.status(500).json({ error: "failed" });
  }
});

app.get("/api/clans/mine", authenticate, async (req, res) => {
  try {
    const clan = await getClanForPlayer(req.telegramId);
    if (!clan) return res.json({ clan: null });
    res.json({ clan: await getClan(clan.id) });
  } catch (e) {
    console.error("get my clan failed:", e);
    res.status(500).json({ error: "failed" });
  }
});

app.get("/api/clans/:id", authenticate, async (req, res) => {
  try {
    const clan = await getClan(req.params.id);
    if (!clan) return res.status(404).json({ error: "not found" });
    res.json({ clan });
  } catch (e) {
    console.error("get clan failed:", e);
    res.status(500).json({ error: "failed" });
  }
});

app.post("/api/clans", authenticate, async (req, res) => {
  const { name, tag, icon, color, openJoin } = req.body || {};
  if (!name || !tag) return res.status(400).json({ error: "name and tag required" });
  try {
    const existing = await getClanForPlayer(req.telegramId);
    if (existing) return res.status(409).json({ error: "already in a clan" });
    const paid = await tryDeductRub(req.telegramId, CLAN_CREATE_COST);
    if (!paid) return res.status(402).json({ error: "insufficient funds", cost: CLAN_CREATE_COST });
    const id = "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await createClan({
      id, name, tag, icon: icon || "🐺", color: color || "#2a2a30",
      leaderId: req.telegramId, leaderName: req.telegramName, openJoin,
    });
    res.json({ ok: true, clan: await getClan(id) });
  } catch (e) {
    console.error("create clan failed:", e);
    res.status(500).json({ error: "failed" });
  }
});

app.post("/api/clans/:id/join", authenticate, async (req, res) => {
  try {
    const existing = await getClanForPlayer(req.telegramId);
    if (existing) return res.status(409).json({ error: "already in a clan" });
    const clan = await getClan(req.params.id);
    if (!clan) return res.status(404).json({ error: "not found" });
    if (!clan.open_join) return res.status(403).json({ error: "closed" });
    await joinClan(req.params.id, req.telegramId, req.telegramName);
    res.json({ ok: true, clan: await getClan(req.params.id) });
  } catch (e) {
    console.error("join clan failed:", e);
    res.status(500).json({ error: "failed" });
  }
});

app.post("/api/clans/:id/leave", authenticate, async (req, res) => {
  try {
    await leaveClan(req.params.id, req.telegramId);
    res.json({ ok: true });
  } catch (e) {
    console.error("leave clan failed:", e);
    res.status(500).json({ error: "failed" });
  }
});

/* ===== Арена: список соперников (сам бой теперь живой, пошаговый — через
   Socket.IO события arena_challenge/arena_turn_choice/... в server/liveArena.js,
   не REST). */
app.get("/api/arena/opponents", authenticate, async (req, res) => {
  try {
    const list = await listArenaOpponents(req.telegramId, 30);
    const now = Date.now();
    res.json(list.map((o) => ({
      telegramId: o.telegram_id,
      name: o.name || o.telegram_name || "Игрок",
      level: o.level ? Number(o.level) : 1,
      arenaRep: o.arena_rep ? Number(o.arena_rep) : 0,
      shielded: o.shield_until ? Number(o.shield_until) > now : false,
    })));
  } catch (e) {
    console.error("arena opponents failed:", e);
    res.status(500).json({ error: "failed" });
  }
});

/* ===== Публичный профиль игрока: ник, уровень, экипировка, статы — то, что
   можно увидеть, кликнув на чей-то ник в чате/арене/клане. Деньги (rub/stars)
   и полный инвентарь намеренно не отдаём — только то, что реально "видно". */
app.get("/api/players/:telegramId/profile", authenticate, async (req, res) => {
  try {
    const saved = await loadPlayer(req.params.telegramId);
    if (!saved) return res.status(404).json({ error: "not found" });
    const p = saved.state.player;
    const inv = Array.isArray(saved.state.inventory) ? saved.state.inventory : [];
    const equipment = {};
    Object.keys(p.equipment || {}).forEach((slot) => {
      const itemId = p.equipment[slot];
      const item = itemId ? inv.find((i) => i.id === itemId) : null;
      equipment[slot] = item ? {
        id: item.id, name: item.name, icon: item.icon, rarity: item.rarity,
        dmgMin: item.dmgMin, dmgMax: item.dmgMax, def: item.def, zone: item.zone,
        statBonus: item.statBonus, critBonus: item.critBonus,
      } : null;
    });
    const clan = await getClanForPlayer(req.params.telegramId);
    res.json({
      telegramId: req.params.telegramId,
      name: p.name, level: p.level, rep: p.rep, district: p.district,
      hp: p.hp, maxHp: p.maxHp, stats: p.stats, avatarId: p.avatarId || "default",
      arenaRep: p.arenaRep || 0, arenaWins: p.arenaWins || 0, arenaLosses: p.arenaLosses || 0,
      equipment,
      clan: clan ? { id: clan.id, name: clan.name, tag: clan.tag, icon: clan.icon, color: clan.color } : null,
    });
  } catch (e) {
    console.error("player profile failed:", e);
    res.status(500).json({ error: "failed" });
  }
});

/* ===== Территории и войны за улицы (реальные кланы) ===== */
app.get("/api/territory", authenticate, async (req, res) => {
  try {
    const rows = await listTerritories();
    const map = {};
    rows.forEach((r) => { if (r.clan_id) map[r.district_id] = { clanId: r.clan_id, name: r.clan_name, tag: r.clan_tag, icon: r.clan_icon, color: r.clan_color }; });
    res.json({ owners: map, taxTable: DISTRICT_TAX });
  } catch (e) {
    console.error("list territory failed:", e);
    res.status(500).json({ error: "failed" });
  }
});

app.get("/api/territory/:districtId/war", authenticate, async (req, res) => {
  try {
    const war = await getActiveWarForDistrict(req.params.districtId);
    res.json({ war });
  } catch (e) {
    console.error("get district war failed:", e);
    res.status(500).json({ error: "failed" });
  }
});

app.get("/api/territory/wars/:warId", authenticate, async (req, res) => {
  try {
    const war = await getWar(req.params.warId);
    if (!war) return res.status(404).json({ error: "not found" });
    res.json({ war });
  } catch (e) {
    console.error("get war failed:", e);
    res.status(500).json({ error: "failed" });
  }
});

app.post("/api/territory/:districtId/declare", authenticate, async (req, res) => {
  try {
    const myClan = await getClanForPlayer(req.telegramId);
    if (!myClan) return res.status(403).json({ error: "not in a clan" });
    const existingDistrictWar = await getActiveWarForDistrict(req.params.districtId);
    if (existingDistrictWar) return res.status(409).json({ error: "war already active here" });
    const myActiveWar = await getActiveWarForClan(myClan.id);
    if (myActiveWar) return res.status(409).json({ error: "your clan is already at war" });
    const ownerClanId = await getTerritoryOwner(req.params.districtId);
    if (ownerClanId === myClan.id) return res.status(400).json({ error: "you already own this" });
    const paid = await tryDeductRub(req.telegramId, WAR_DECLARE_COST);
    if (!paid) return res.status(402).json({ error: "insufficient funds", cost: WAR_DECLARE_COST });
    const id = "w_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const war = await createWar({
      id, districtId: req.params.districtId, attackerClanId: myClan.id,
      defenderClanId: ownerClanId, prepEndsAt: Date.now() + WAR_PREP_MS,
    });
    res.json({ ok: true, war });
  } catch (e) {
    console.error("declare war failed:", e);
    res.status(500).json({ error: "failed" });
  }
});

app.post("/api/territory/wars/:warId/join", authenticate, async (req, res) => {
  const { side } = req.body || {};
  if (side !== "attacker" && side !== "defender") return res.status(400).json({ error: "side must be attacker or defender" });
  try {
    const war = await getWar(req.params.warId);
    if (!war) return res.status(404).json({ error: "not found" });
    if (war.status !== "preparing") return res.status(409).json({ error: "war not open for joining" });
    const myClan = await getClanForPlayer(req.telegramId);
    if (!myClan) return res.status(403).json({ error: "not in a clan" });
    const expectedClanId = side === "attacker" ? war.attacker_clan_id : war.defender_clan_id;
    if (myClan.id !== expectedClanId) return res.status(403).json({ error: "wrong clan for this side" });
    const roster = await joinWarRoster(req.params.warId, side, req.telegramId, req.telegramName || myClan.tag);
    res.json({ ok: true, roster });
  } catch (e) {
    console.error("join war roster failed:", e);
    res.status(500).json({ error: "failed" });
  }
});

app.post("/api/clans/mine/collect-tax", authenticate, async (req, res) => {
  try {
    const myClan = await getClanForPlayer(req.telegramId);
    if (!myClan) return res.status(403).json({ error: "not in a clan" });
    const result = await collectClanTax(myClan.id, DISTRICT_TAX);
    if (!result) return res.status(404).json({ error: "not found" });
    res.json(result);
  } catch (e) {
    console.error("collect tax failed:", e);
    res.status(500).json({ error: "failed" });
  }
});

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).json({ error: "forbidden" });
  next();
}
app.get("/api/admin/players", requireAdmin, async (req, res) => {
  res.json(await listPlayers());
});
app.post("/api/admin/reset", requireAdmin, async (req, res) => {
  const { telegramId } = req.body || {};
  if (!telegramId) return res.status(400).json({ error: "telegramId required" });
  await deletePlayer(telegramId);
  res.json({ ok: true });
});
app.post("/api/admin/grant-money", requireAdmin, async (req, res) => {
  const { telegramId, amount } = req.body || {};
  if (!telegramId || !amount) return res.status(400).json({ error: "telegramId and amount required" });
  const saved = await loadPlayer(telegramId);
  if (!saved) return res.status(404).json({ error: "not found" });
  saved.state.player.rub = (saved.state.player.rub || 0) + Number(amount);
  await savePlayer(telegramId, null, saved.state);
  res.json({ ok: true, rub: saved.state.player.rub });
});

// Отдаём статику игры тем же сервером — один процесс, один деплой.
app.use(express.static(path.join(__dirname, "..", "web")));

const httpServer = http.createServer(app);
const io = setupRealtime(httpServer, { botToken: BOT_TOKEN, allowDevAuth: ALLOW_DEV_AUTH });
startWarSweep(io);
startJobNotifySweep(BOT_TOKEN);

httpServer.listen(PORT, () => {
  console.log(`Territory 2026 server on http://localhost:${PORT} (dev auth: ${ALLOW_DEV_AUTH})`);
});
