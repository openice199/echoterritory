require("dotenv").config({ quiet: true });
const path = require("path");
const http = require("http");
const express = require("express");
const { validateInitData } = require("./telegramAuth");
const {
  loadPlayer, savePlayer, listPlayers, deletePlayer,
  listClans, getClan, getClanForPlayer, createClan, joinClan, leaveClan, tryDeductRub,
} = require("./db");
const { setupRealtime } = require("./realtime");

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

// Отдаём статику игры тем же сервером — один процесс, один деплой.
app.use(express.static(path.join(__dirname, "..", "web")));

const httpServer = http.createServer(app);
setupRealtime(httpServer, { botToken: BOT_TOKEN, allowDevAuth: ALLOW_DEV_AUTH });

httpServer.listen(PORT, () => {
  console.log(`Territory 2026 server on http://localhost:${PORT} (dev auth: ${ALLOW_DEV_AUTH})`);
});
