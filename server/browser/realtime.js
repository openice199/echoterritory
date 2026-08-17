// Реалтайм-чат Territory Browser — вешается как namespace "/browser" на УЖЕ
// существующий io (тот же httpServer/socket.io, что и Telegram-игра), не создаёт
// свой Server(). io.engine.use(sessionMiddleware) применяется на уровне engine —
// это общее для всех namespace, но безвредно для Telegram-неймспейса: там
// socket.request.session просто не используется существующим кодом realtime.js.

const presenceByArea = new Map(); // areaId -> Map<socketId, {playerId, name}>

function areaRoom(areaId) { return `barea:${areaId}`; }

function broadcastPresence(nsp, areaId) {
  const map = presenceByArea.get(areaId);
  const names = map ? Array.from(map.values()).map((p) => p.name) : [];
  nsp.to(areaRoom(areaId)).emit("presence", { areaId, players: names });
}
function addPresence(areaId, socketId, playerId, name) {
  if (!presenceByArea.has(areaId)) presenceByArea.set(areaId, new Map());
  presenceByArea.get(areaId).set(socketId, { playerId, name });
}
function removePresence(areaId, socketId) {
  const map = presenceByArea.get(areaId);
  if (!map) return;
  map.delete(socketId);
  if (!map.size) presenceByArea.delete(areaId);
}

function attachBrowserRealtime(io, sessionMiddleware, db) {
  io.engine.use(sessionMiddleware);
  const nsp = io.of("/browser");

  nsp.on("connection", async (socket) => {
    const session = socket.request.session;
    const playerId = session && session.playerId;
    if (!playerId) { socket.disconnect(true); return; }

    const row = await db.getPlayerById(playerId);
    if (!row) { socket.disconnect(true); return; }

    let currentAreaId = row.state.areaId;
    socket.join(areaRoom(currentAreaId));
    addPresence(currentAreaId, socket.id, playerId, row.state.name);
    broadcastPresence(nsp, currentAreaId);

    socket.on("change_area", async (areaId) => {
      const fresh = await db.getPlayerById(playerId);
      if (!fresh || fresh.state.areaId !== areaId) return;
      socket.leave(areaRoom(currentAreaId));
      removePresence(currentAreaId, socket.id);
      broadcastPresence(nsp, currentAreaId);
      currentAreaId = areaId;
      socket.join(areaRoom(currentAreaId));
      addPresence(currentAreaId, socket.id, playerId, fresh.state.name);
      broadcastPresence(nsp, currentAreaId);
    });

    socket.on("chat_message", (text) => {
      if (typeof text !== "string" || !text.trim()) return;
      nsp.to(areaRoom(currentAreaId)).emit("chat_message", {
        name: row.state.name, text: text.trim().slice(0, 300), ts: Date.now(),
      });
    });

    socket.on("disconnect", () => {
      removePresence(currentAreaId, socket.id);
      broadcastPresence(nsp, currentAreaId);
    });
  });
}

module.exports = { attachBrowserRealtime };
