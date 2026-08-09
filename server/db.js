const { Pool } = require("pg");

// На Render бесплатный Web Service не даёт постоянный диск — локальный SQLite-файл
// стирался бы при каждом перезапуске. Поэтому храним в Postgres (тоже есть бесплатный
// тариф у Render, см. README про 30-дневный лимит бесплатной базы).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

const ready = pool.query(`
  CREATE TABLE IF NOT EXISTS players (
    telegram_id TEXT PRIMARY KEY,
    telegram_name TEXT,
    state_json JSONB NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )
`);

async function loadPlayer(telegramId) {
  await ready;
  const res = await pool.query("SELECT state_json, updated_at FROM players WHERE telegram_id = $1", [telegramId]);
  if (!res.rows.length) return null;
  return { state: res.rows[0].state_json, updatedAt: Number(res.rows[0].updated_at) };
}

async function savePlayer(telegramId, telegramName, state) {
  await ready;
  const now = Date.now();
  await pool.query(
    `INSERT INTO players (telegram_id, telegram_name, state_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $4)
     ON CONFLICT (telegram_id)
     DO UPDATE SET state_json = $3, telegram_name = $2, updated_at = $4`,
    [telegramId, telegramName || null, JSON.stringify(state), now]
  );
  return now;
}

module.exports = { loadPlayer, savePlayer };
