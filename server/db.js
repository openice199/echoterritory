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

  CREATE TABLE IF NOT EXISTS territories (
    district_id TEXT PRIMARY KEY,
    clan_id TEXT REFERENCES clans(id) ON DELETE SET NULL,
    captured_at BIGINT
  );

  CREATE TABLE IF NOT EXISTS wars (
    id TEXT PRIMARY KEY,
    district_id TEXT NOT NULL,
    attacker_clan_id TEXT NOT NULL,
    defender_clan_id TEXT,
    status TEXT NOT NULL DEFAULT 'preparing',
    prep_ends_at BIGINT NOT NULL,
    attacker_roster JSONB NOT NULL DEFAULT '[]',
    defender_roster JSONB NOT NULL DEFAULT '[]',
    result JSONB,
    created_at BIGINT NOT NULL,
    resolved_at BIGINT
  );

  ALTER TABLE clans ADD COLUMN IF NOT EXISTS treasury BIGINT NOT NULL DEFAULT 0;
  ALTER TABLE clans ADD COLUMN IF NOT EXISTS tax_claimed_at BIGINT;
  ALTER TABLE players ADD COLUMN IF NOT EXISTS shield_until BIGINT;
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
    SELECT c.id, c.name, c.tag, c.icon, c.color, c.leader_id, c.open_join, c.created_at, c.treasury,
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
  const terrRes = await pool.query("SELECT district_id, captured_at FROM territories WHERE clan_id = $1", [clanId]);
  return { ...clanRes.rows[0], members: membersRes.rows, territories: terrRes.rows };
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

async function getShieldUntil(telegramId) {
  await ready;
  const res = await pool.query("SELECT shield_until FROM players WHERE telegram_id=$1", [telegramId]);
  return res.rows[0]?.shield_until ? Number(res.rows[0].shield_until) : null;
}

/* ===== Арена: реальные соперники ===== */
async function listArenaOpponents(excludeId, limit) {
  await ready;
  const res = await pool.query(
    `SELECT telegram_id, telegram_name, shield_until,
            state_json->'player'->>'name' AS name,
            state_json->'player'->>'level' AS level,
            state_json->'player'->>'arenaRep' AS arena_rep
     FROM players WHERE telegram_id != $1
     ORDER BY updated_at DESC LIMIT $2`,
    [excludeId, limit || 30]
  );
  return res.rows;
}

async function applyArenaOutcome(challengerId, opponentId, challengerWon) {
  await ready;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cRes = await client.query("SELECT state_json FROM players WHERE telegram_id=$1 FOR UPDATE", [challengerId]);
    if (!cRes.rows.length) { await client.query("ROLLBACK"); return null; }
    const cState = cRes.rows[0].state_json;
    const p = cState.player;
    const now = Date.now();
    if (challengerWon) {
      p.arenaPoints = (p.arenaPoints || 0) + 15;
      p.arenaRep = (p.arenaRep || 0) + 15;
      p.arenaWins = (p.arenaWins || 0) + 1;
      await client.query("UPDATE players SET shield_until=$1 WHERE telegram_id=$2", [now + 10 * 60 * 1000, opponentId]);
    } else {
      p.arenaPoints = (p.arenaPoints || 0) + 5;
      p.arenaRep = (p.arenaRep || 0) + 5;
      p.arenaLosses = (p.arenaLosses || 0) + 1;
      p.hp = Math.round((p.maxHp || 100) * 0.3);
    }
    await client.query("UPDATE players SET state_json=$1, updated_at=$2 WHERE telegram_id=$3", [JSON.stringify(cState), now, challengerId]);
    await client.query("COMMIT");
    return cState;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/* ===== Территории и войны за улицы ===== */
async function listTerritories() {
  await ready;
  const res = await pool.query(`
    SELECT t.district_id, t.clan_id, t.captured_at, c.name AS clan_name, c.tag AS clan_tag, c.icon AS clan_icon, c.color AS clan_color
    FROM territories t LEFT JOIN clans c ON c.id = t.clan_id
  `);
  return res.rows;
}

async function getTerritoryOwner(districtId) {
  await ready;
  const res = await pool.query("SELECT clan_id FROM territories WHERE district_id=$1", [districtId]);
  return res.rows[0]?.clan_id || null;
}

async function setTerritoryOwner(districtId, clanId) {
  await ready;
  await pool.query(
    `INSERT INTO territories (district_id, clan_id, captured_at) VALUES ($1,$2,$3)
     ON CONFLICT (district_id) DO UPDATE SET clan_id=$2, captured_at=$3`,
    [districtId, clanId, Date.now()]
  );
}

async function getActiveWarForDistrict(districtId) {
  await ready;
  const res = await pool.query("SELECT * FROM wars WHERE district_id=$1 AND status != 'resolved' ORDER BY created_at DESC LIMIT 1", [districtId]);
  return res.rows[0] || null;
}

async function getActiveWarForClan(clanId) {
  await ready;
  const res = await pool.query(
    "SELECT * FROM wars WHERE (attacker_clan_id=$1 OR defender_clan_id=$1) AND status != 'resolved' LIMIT 1",
    [clanId]
  );
  return res.rows[0] || null;
}

async function getWar(warId) {
  await ready;
  const res = await pool.query("SELECT * FROM wars WHERE id=$1", [warId]);
  return res.rows[0] || null;
}

async function createWar({ id, districtId, attackerClanId, defenderClanId, prepEndsAt }) {
  await ready;
  const now = Date.now();
  await pool.query(
    `INSERT INTO wars (id, district_id, attacker_clan_id, defender_clan_id, status, prep_ends_at, attacker_roster, defender_roster, created_at)
     VALUES ($1,$2,$3,$4,'preparing',$5,'[]','[]',$6)`,
    [id, districtId, attackerClanId, defenderClanId || null, prepEndsAt, now]
  );
  return getWar(id);
}

async function joinWarRoster(warId, side, telegramId, name) {
  await ready;
  const col = side === "attacker" ? "attacker_roster" : "defender_roster";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(`SELECT ${col} AS roster FROM wars WHERE id=$1 FOR UPDATE`, [warId]);
    if (!res.rows.length) { await client.query("ROLLBACK"); return null; }
    const roster = res.rows[0].roster || [];
    if (!roster.some((r) => r.telegramId === telegramId)) roster.push({ telegramId, name });
    await client.query(`UPDATE wars SET ${col}=$1 WHERE id=$2`, [JSON.stringify(roster), warId]);
    await client.query("COMMIT");
    return roster;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function getExpiredWars() {
  await ready;
  const res = await pool.query("SELECT * FROM wars WHERE status='preparing' AND prep_ends_at <= $1", [Date.now()]);
  return res.rows;
}

async function resolveWarRow(warId, result) {
  await ready;
  await pool.query("UPDATE wars SET status='resolved', result=$1, resolved_at=$2 WHERE id=$3", [JSON.stringify(result), Date.now(), warId]);
}

/* ===== Уведомления о завершённой длительной работе (рыбалка, ковка и т.п.) =====
   Работа — это часть JSONB-состояния игрока (state.player.activeJob), схема для
   неё не нужна: sweep просто ищет игроков, у кого дедлайн уже прошёл, но флаг
   notified ещё не выставлен, шлёт им сообщение в бота и точечно патчит только
   этот вложенный флаг через jsonb_set — без полной перезаписи state_json, чтобы
   не столкнуться с параллельным автосохранением клиента.
 */
async function listPendingJobNotifications(now) {
  await ready;
  const res = await pool.query(
    `SELECT telegram_id, state_json->'player'->'activeJob' AS job
     FROM players
     WHERE state_json->'player'->'activeJob' IS NOT NULL
       AND (state_json->'player'->'activeJob'->>'notified') IS DISTINCT FROM 'true'
       AND ((state_json->'player'->'activeJob'->>'startedAt')::bigint
            + (state_json->'player'->'activeJob'->>'durationSec')::numeric * 1000) <= $1`,
    [now]
  );
  return res.rows;
}

async function markJobNotified(telegramId) {
  await ready;
  await pool.query(
    `UPDATE players SET state_json = jsonb_set(state_json, '{player,activeJob,notified}', 'true'::jsonb)
     WHERE telegram_id = $1`,
    [telegramId]
  );
}

async function collectClanTax(clanId, taxTable) {
  await ready;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const clanRes = await client.query("SELECT treasury, tax_claimed_at FROM clans WHERE id=$1 FOR UPDATE", [clanId]);
    if (!clanRes.rows.length) { await client.query("ROLLBACK"); return null; }
    const lastClaimed = clanRes.rows[0].tax_claimed_at ? Number(clanRes.rows[0].tax_claimed_at) : 0;
    const now = Date.now();
    if (now - lastClaimed < 20 * 60 * 60 * 1000) {
      await client.query("ROLLBACK");
      return { alreadyClaimed: true, nextInMs: 20 * 60 * 60 * 1000 - (now - lastClaimed) };
    }
    const terrRes = await client.query("SELECT district_id FROM territories WHERE clan_id=$1", [clanId]);
    let total = 0;
    terrRes.rows.forEach((r) => { total += taxTable[r.district_id] || 0; });
    const newTreasury = Number(clanRes.rows[0].treasury) + total;
    await client.query("UPDATE clans SET treasury=$1, tax_claimed_at=$2 WHERE id=$3", [newTreasury, now, clanId]);
    await client.query("COMMIT");
    return { amount: total, treasury: newTreasury };
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
  listArenaOpponents, applyArenaOutcome, getShieldUntil,
  listTerritories, getTerritoryOwner, setTerritoryOwner,
  getActiveWarForDistrict, getActiveWarForClan, getWar, createWar, joinWarRoster,
  getExpiredWars, resolveWarRow, collectClanTax,
  listPendingJobNotifications, markJobNotified,
};
