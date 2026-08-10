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
  );

  CREATE TABLE IF NOT EXISTS clans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tag TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    leader_id TEXT NOT NULL,
    open_join BOOLEAN NOT NULL DEFAULT true,
    created_at BIGINT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clan_members (
    clan_id TEXT NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
    telegram_id TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at BIGINT NOT NULL,
    PRIMARY KEY (clan_id, telegram_id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    room TEXT NOT NULL,
    telegram_id TEXT NOT NULL,
    name TEXT,
    text TEXT NOT NULL,
    created_at BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_room_time ON chat_messages(room, created_at);
`).catch((err) => {
  console.error("DB init query failed (server stays up, queries will error individually):", err.message);
});

pool.on("error", (err) => {
  // Idle-клиент разорвал соединение (например, Render перезапустил Postgres) —
  // логируем, но не роняем процесс. Пул сам переподключится на следующий запрос.
  console.error("Postgres pool error:", err.message);
});

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

async function listPlayers() {
  await ready;
  const res = await pool.query(
    "SELECT telegram_id, telegram_name, updated_at, state_json->'player'->>'name' as player_name, state_json->'player'->>'level' as level FROM players ORDER BY updated_at DESC LIMIT 50"
  );
  return res.rows;
}

async function deletePlayer(telegramId) {
  await ready;
  await pool.query("DELETE FROM players WHERE telegram_id = $1", [telegramId]);
}

/* ===== Кланы ===== */
async function listClans() {
  await ready;
  const res = await pool.query(`
    SELECT c.id, c.name, c.tag, c.icon, c.color, c.leader_id, c.open_join, c.created_at,
           COUNT(m.telegram_id)::int AS member_count
    FROM clans c
    LEFT JOIN clan_members m ON m.clan_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at ASC
  `);
  return res.rows;
}

async function getClan(clanId) {
  await ready;
  const clanRes = await pool.query("SELECT * FROM clans WHERE id = $1", [clanId]);
  if (!clanRes.rows.length) return null;
  const membersRes = await pool.query(
    "SELECT telegram_id, name, role, joined_at FROM clan_members WHERE clan_id = $1 ORDER BY joined_at ASC",
    [clanId]
  );
  return { ...clanRes.rows[0], members: membersRes.rows };
}

async function getClanForPlayer(telegramId) {
  await ready;
  const res = await pool.query(
    `SELECT c.* FROM clans c JOIN clan_members m ON m.clan_id = c.id WHERE m.telegram_id = $1`,
    [telegramId]
  );
  return res.rows[0] || null;
}

async function createClan({ id, name, tag, icon, color, leaderId, leaderName, openJoin }) {
  await ready;
  const now = Date.now();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO clans (id, name, tag, icon, color, leader_id, open_join, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, name, tag, icon, color, leaderId, openJoin !== false, now]
    );
    await client.query(
      `INSERT INTO clan_members (clan_id, telegram_id, name, role, joined_at) VALUES ($1,$2,$3,'leader',$4)`,
      [id, leaderId, leaderName || null, now]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function joinClan(clanId, telegramId, name) {
  await ready;
  await pool.query(
    `INSERT INTO clan_members (clan_id, telegram_id, name, role, joined_at) VALUES ($1,$2,$3,'member',$4)
     ON CONFLICT (clan_id, telegram_id) DO NOTHING`,
    [clanId, telegramId, name || null, Date.now()]
  );
}

async function leaveClan(clanId, telegramId) {
  await ready;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const clanRes = await client.query("SELECT leader_id FROM clans WHERE id = $1 FOR UPDATE", [clanId]);
    if (!clanRes.rows.length) { await client.query("ROLLBACK"); return; }
    await client.query("DELETE FROM clan_members WHERE clan_id = $1 AND telegram_id = $2", [clanId, telegramId]);
    const remaining = await client.query(
      "SELECT telegram_id FROM clan_members WHERE clan_id = $1 ORDER BY joined_at ASC", [clanId]
    );
    if (!remaining.rows.length) {
      await client.query("DELETE FROM clans WHERE id = $1", [clanId]);
    } else if (clanRes.rows[0].leader_id === telegramId) {
      const nextLeader = remaining.rows[0].telegram_id;
      await client.query("UPDATE clans SET leader_id = $1 WHERE id = $2", [nextLeader, clanId]);
      await client.query("UPDATE clan_members SET role = 'leader' WHERE clan_id = $1 AND telegram_id = $2", [clanId, nextLeader]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/* ===== Чат ===== */
async function getChatHistory(room, limit) {
  await ready;
  const res = await pool.query(
    "SELECT telegram_id, name, text, created_at FROM chat_messages WHERE room = $1 ORDER BY created_at DESC LIMIT $2",
    [room, limit || 50]
  );
  return res.rows.reverse();
}

async function saveChatMessage(room, telegramId, name, text) {
  await ready;
  const now = Date.now();
  await pool.query(
    "INSERT INTO chat_messages (room, telegram_id, name, text, created_at) VALUES ($1,$2,$3,$4,$5)",
    [room, telegramId, name || null, text, now]
  );
  return now;
}

async function tryDeductRub(telegramId, amount) {
  await ready;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query("SELECT state_json FROM players WHERE telegram_id = $1 FOR UPDATE", [telegramId]);
    if (!res.rows.length) { await client.query("ROLLBACK"); return false; }
    const state = res.rows[0].state_json;
    const rub = (state.player && state.player.rub) || 0;
    if (rub < amount) { await client.query("ROLLBACK"); return false; }
    state.player.rub = rub - amount;
    await client.query(
      "UPDATE players SET state_json = $1, updated_at = $2 WHERE telegram_id = $3",
      [JSON.stringify(state), Date.now(), telegramId]
    );
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  loadPlayer, savePlayer, listPlayers, deletePlayer,
  listClans, getClan, getClanForPlayer, createClan, joinClan, leaveClan,
  getChatHistory, saveChatMessage, tryDeductRub,
};
