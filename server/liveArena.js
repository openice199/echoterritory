const { fighterFromState, computeDamage, ZONES } = require("./combat");
const db = require("./db");

const CHALLENGE_TIMEOUT_MS = 60 * 1000;
const ROUND_TIMEOUT_MS = 20 * 1000;
const MAX_ROUNDS = 20;

const socketsByPlayer = new Map(); // telegramId -> Set<socket>
const pendingChallenges = new Map(); // challengeId -> {...}
const activeBattles = new Map(); // battleId -> {...}
const playerBattle = new Map(); // telegramId -> battleId
const playerPendingChallenge = new Map(); // challengerId -> challengeId

function randZone() { return ZONES[Math.floor(Math.random() * ZONES.length)]; }

function emitToPlayer(telegramId, event, payload) {
  const set = socketsByPlayer.get(telegramId);
  if (!set || !set.size) return false;
  for (const s of set) s.emit(event, payload);
  return true;
}

async function notifyTelegram(botToken, telegramId, text) {
  if (!botToken || !/^\d+$/.test(telegramId)) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: telegramId, text }),
    });
  } catch (e) {
    console.error("arena telegram notify failed:", e.message);
  }
}

function armRoundTimeout(battleId) {
  const battle = activeBattles.get(battleId);
  if (!battle) return;
  clearTimeout(battle.roundTimeoutHandle);
  battle.roundTimeoutHandle = setTimeout(() => {
    if (!battle.a.choice) battle.a.choice = { zone: randZone(), block: randZone() };
    if (!battle.b.choice) battle.b.choice = { zone: randZone(), block: randZone() };
    resolveRound(battleId);
  }, ROUND_TIMEOUT_MS);
}

function maybeResolveRound(battleId) {
  const battle = activeBattles.get(battleId);
  if (!battle || battle.status !== "active") return;
  if (!battle.a.choice || !battle.b.choice) return;
  clearTimeout(battle.roundTimeoutHandle);
  resolveRound(battleId);
}

function resolveRound(battleId) {
  const battle = activeBattles.get(battleId);
  if (!battle || battle.status !== "active") return;
  battle.round++;

  const aAtk = computeDamage(
    { str: battle.a.fighter.str, agi: battle.a.fighter.agi, luck: battle.a.fighter.luck, agiDef: battle.b.fighter.agi, critBonus: battle.a.fighter.critBonus },
    battle.a.fighter.weaponAvg, battle.a.choice.zone, battle.b.choice.block, battle.b.fighter.def
  );
  if (!aAtk.dodged) battle.b.hp = Math.max(0, battle.b.hp - aAtk.dmg);

  let bAtk = null;
  if (battle.b.hp > 0) {
    bAtk = computeDamage(
      { str: battle.b.fighter.str, agi: battle.b.fighter.agi, luck: battle.b.fighter.luck, agiDef: battle.a.fighter.agi, critBonus: battle.b.fighter.critBonus },
      battle.b.fighter.weaponAvg, battle.b.choice.zone, battle.a.choice.block, battle.a.fighter.def
    );
    if (!bAtk.dodged) battle.a.hp = Math.max(0, battle.a.hp - bAtk.dmg);
  }

  // Каждой стороне шлём результат в терминах "я/соперник" — так клиенту не нужно
  // помнить, был ли он "a" (вызывающим) или "b" в этом бою.
  const aInfo = { zone: battle.a.choice.zone, block: battle.a.choice.block, ...aAtk };
  const bInfo = bAtk ? { zone: battle.b.choice.zone, block: battle.b.choice.block, ...bAtk } : null;
  emitToPlayer(battle.a.id, "arena_round_result", {
    battleId, round: battle.round, selfHp: battle.a.hp, oppHp: battle.b.hp,
    selfAtk: aInfo, oppAtk: bInfo,
  });
  emitToPlayer(battle.b.id, "arena_round_result", {
    battleId, round: battle.round, selfHp: battle.b.hp, oppHp: battle.a.hp,
    selfAtk: bInfo, oppAtk: aInfo,
  });

  battle.a.choice = null;
  battle.b.choice = null;

  const over = battle.a.hp <= 0 || battle.b.hp <= 0 || battle.round >= MAX_ROUNDS;
  if (over) endBattle(battleId);
  else armRoundTimeout(battleId);
}

async function endBattle(battleId) {
  const battle = activeBattles.get(battleId);
  if (!battle) return;
  battle.status = "ended";
  clearTimeout(battle.roundTimeoutHandle);
  activeBattles.delete(battleId);
  playerBattle.delete(battle.a.id);
  playerBattle.delete(battle.b.id);

  const aWon = battle.a.hp >= battle.b.hp;
  const winner = aWon ? battle.a : battle.b;
  const loser = aWon ? battle.b : battle.a;

  try {
    await db.applyLiveArenaResult(winner.id, loser.id);
  } catch (e) {
    console.error("applyLiveArenaResult failed:", e.message);
  }

  emitToPlayer(battle.a.id, "arena_battle_end", { battleId, won: aWon, selfHp: battle.a.hp, oppHp: battle.b.hp, oppName: battle.b.name });
  emitToPlayer(battle.b.id, "arena_battle_end", { battleId, won: !aWon, selfHp: battle.b.hp, oppHp: battle.a.hp, oppName: battle.a.name });
}

function attachLiveArena(io, socket, { botToken }) {
  const telegramId = socket.telegramId;
  if (!socketsByPlayer.has(telegramId)) socketsByPlayer.set(telegramId, new Set());
  socketsByPlayer.get(telegramId).add(socket);

  socket.on("arena_challenge", async ({ opponentTelegramId, opponentName } = {}) => {
    if (!opponentTelegramId || opponentTelegramId === telegramId) {
      socket.emit("arena_challenge_error", { error: "invalid opponent" });
      return;
    }
    if (playerBattle.has(telegramId)) { socket.emit("arena_challenge_error", { error: "already in a battle" }); return; }
    if (playerPendingChallenge.has(telegramId)) { socket.emit("arena_challenge_error", { error: "challenge already pending" }); return; }
    if (playerBattle.has(opponentTelegramId)) { socket.emit("arena_challenge_error", { error: "opponent is busy" }); return; }
    const shieldUntil = await db.getShieldUntil(opponentTelegramId);
    if (shieldUntil && shieldUntil > Date.now()) { socket.emit("arena_challenge_error", { error: "shielded" }); return; }

    const challengeId = "ch_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const timeoutHandle = setTimeout(() => {
      const c = pendingChallenges.get(challengeId);
      if (!c) return;
      pendingChallenges.delete(challengeId);
      playerPendingChallenge.delete(c.challengerId);
      emitToPlayer(c.challengerId, "arena_challenge_timeout", { challengeId });
    }, CHALLENGE_TIMEOUT_MS);

    pendingChallenges.set(challengeId, {
      id: challengeId, challengerId: telegramId, challengerName: socket.name,
      opponentId: opponentTelegramId, opponentName: opponentName || "Игрок", timeoutHandle,
    });
    playerPendingChallenge.set(telegramId, challengeId);

    emitToPlayer(opponentTelegramId, "arena_challenge_incoming", { challengeId, challengerId: telegramId, challengerName: socket.name });
    socket.emit("arena_challenge_sent", { challengeId });
    notifyTelegram(botToken, opponentTelegramId, `⚔️ ${socket.name} вызывает вас на арену! Откройте игру, чтобы принять бой.`);
  });

  socket.on("arena_challenge_respond", async ({ challengeId, accept } = {}) => {
    const c = pendingChallenges.get(challengeId);
    if (!c || c.opponentId !== telegramId) return;
    clearTimeout(c.timeoutHandle);
    pendingChallenges.delete(challengeId);
    playerPendingChallenge.delete(c.challengerId);

    if (!accept) {
      emitToPlayer(c.challengerId, "arena_challenge_declined", { challengeId });
      return;
    }
    if (playerBattle.has(c.challengerId) || playerBattle.has(c.opponentId)) {
      emitToPlayer(c.challengerId, "arena_challenge_error", { error: "opponent is busy" });
      socket.emit("arena_challenge_error", { error: "already in a battle" });
      return;
    }

    const [challengerSaved, opponentSaved] = await Promise.all([
      db.loadPlayer(c.challengerId), db.loadPlayer(c.opponentId),
    ]);
    if (!challengerSaved || !opponentSaved) {
      emitToPlayer(c.challengerId, "arena_challenge_error", { error: "player not found" });
      socket.emit("arena_challenge_error", { error: "player not found" });
      return;
    }

    const fA = fighterFromState(challengerSaved.state);
    const fB = fighterFromState(opponentSaved.state);
    const maxHpA = 60 + fA.hpStat * 3;
    const maxHpB = 60 + fB.hpStat * 3;
    const battleId = "b_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const battle = {
      id: battleId,
      a: { id: c.challengerId, name: c.challengerName, fighter: fA, hp: maxHpA, maxHp: maxHpA, choice: null },
      b: { id: c.opponentId, name: opponentSaved.state.player.name || c.opponentName, fighter: fB, hp: maxHpB, maxHp: maxHpB, choice: null },
      round: 0, status: "active", roundTimeoutHandle: null,
    };
    activeBattles.set(battleId, battle);
    playerBattle.set(c.challengerId, battleId);
    playerBattle.set(c.opponentId, battleId);

    emitToPlayer(battle.a.id, "arena_battle_start", { battleId, selfHp: battle.a.hp, selfMaxHp: battle.a.maxHp, oppName: battle.b.name, oppHp: battle.b.hp, oppMaxHp: battle.b.maxHp });
    emitToPlayer(battle.b.id, "arena_battle_start", { battleId, selfHp: battle.b.hp, selfMaxHp: battle.b.maxHp, oppName: battle.a.name, oppHp: battle.a.hp, oppMaxHp: battle.a.maxHp });
    armRoundTimeout(battleId);
  });

  socket.on("arena_turn_choice", ({ battleId, zone, block } = {}) => {
    const battle = activeBattles.get(battleId);
    if (!battle || battle.status !== "active") return;
    const side = battle.a.id === telegramId ? "a" : battle.b.id === telegramId ? "b" : null;
    if (!side || battle[side].choice) return;
    battle[side].choice = { zone: ZONES.includes(zone) ? zone : randZone(), block: ZONES.includes(block) ? block : randZone() };
    const other = side === "a" ? "b" : "a";
    emitToPlayer(battle[other].id, "arena_opponent_ready", { battleId });
    maybeResolveRound(battleId);
  });

  socket.on("disconnect", () => {
    const set = socketsByPlayer.get(telegramId);
    if (set) {
      set.delete(socket);
      if (!set.size) socketsByPlayer.delete(telegramId);
    }
  });
}

module.exports = { attachLiveArena };
