require("dotenv").config({ quiet: true });
const path = require("path");
const express = require("express");
const { validateInitData } = require("./telegramAuth");
const { loadPlayer, savePlayer } = require("./db");

const PORT = process.env.PORT || 8430;
const BOT_TOKEN = process.env.BOT_TOKEN || "";
// Пока нет реального бота — разрешаем локальную авторизацию через заголовок x-dev-user-id.
// Как только BOT_TOKEN появится, ставь ALLOW_DEV_AUTH=0 в проде, чтобы это не осталось лазейкой.
const ALLOW_DEV_AUTH = process.env.ALLOW_DEV_AUTH !== "0";

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

// Отдаём статику игры тем же сервером — один процесс, один деплой.
app.use(express.static(path.join(__dirname, "..", "web")));

app.listen(PORT, () => {
  console.log(`Territory 2026 server on http://localhost:${PORT} (dev auth: ${ALLOW_DEV_AUTH})`);
});
