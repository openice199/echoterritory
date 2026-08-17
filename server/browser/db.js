const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

const ready = (async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS browser_players (
      id SERIAL PRIMARY KEY,
      login VARCHAR(32) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email VARCHAR(255),
      state JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
})().catch((e) => {
  console.error("DB schema init failed (will retry lazily per-query):", e.message);
});

async function createPlayer(login, passwordHash, email, state) {
  await ready;
  const res = await pool.query(
    "INSERT INTO browser_players (login, password_hash, email, state) VALUES ($1,$2,$3,$4) RETURNING id, login, state",
    [login, passwordHash, email, state]
  );
  return res.rows[0];
}

async function getPlayerByLogin(login) {
  await ready;
  const res = await pool.query("SELECT * FROM browser_players WHERE login = $1", [login]);
  return res.rows[0] || null;
}

async function getPlayerById(id) {
  await ready;
  const res = await pool.query("SELECT id, login, email, state FROM browser_players WHERE id = $1", [id]);
  return res.rows[0] || null;
}

async function savePlayerState(id, state) {
  await ready;
  await pool.query("UPDATE browser_players SET state = $2, updated_at = now() WHERE id = $1", [id, state]);
}

async function listOnlinePlayersInArea(areaId, excludeId) {
  // используется только для получения имени/статов по id из чата/боя — облегчённая выборка
  await ready;
  const res = await pool.query("SELECT id, login, state FROM browser_players WHERE state->>'areaId' = $1 AND id != $2", [areaId, excludeId]);
  return res.rows;
}

module.exports = { pool, ready, createPlayer, getPlayerByLogin, getPlayerById, savePlayerState, listOnlinePlayersInArea };
