const { Server } = require("socket.io");
const { validateInitData } = require("./telegramAuth");
const { getChatHistory, saveChatMessage } = require("./db");

// room = либо id района ("vokzal"), либо "clan:<id>" для кланового чата.
function setupRealtime(httpServer, { botToken, allowDevAuth }) {
  const io = new Server(httpServer, { cors: { origin: "*" } });
  const presence = new Map(); // room -> Map(socket.id -> {telegramId, name})

  function authFromHandshake(auth) {
    if (auth && auth.initData) {
      const v = validateInitData(auth.initData, botToken);
      if (v) return { telegramId: v.id, name: v.username || v.firstName || "Игрок" };
    }
    if (allowDevAuth && auth && auth.devUserId) {
      return { telegramId: "dev_" + auth.devUserId, name: "dev:" + auth.devUserId };
    }
    return null;
  }

  function broadcastPresence(room) {
    const map = presence.get(room);
    const seen = new Set();
    const list = [];
    if (map) {
      for (const v of map.values()) {
        if (seen.has(v.telegramId)) continue;
        seen.add(v.telegramId);
        list.push({ telegramId: v.telegramId, name: v.name });
      }
    }
    io.to(room).emit("presence", list);
  }

  io.on("connection", (socket) => {
    const identity = authFromHandshake(socket.handshake.auth);
    if (!identity) {
      socket.emit("auth_error");
      socket.disconnect(true);
      return;
    }
    socket.telegramId = identity.telegramId;
    socket.name = identity.name;
    let currentRoom = null;

    function leaveCurrent() {
      if (!currentRoom) return;
      const map = presence.get(currentRoom);
      if (map) {
        map.delete(socket.id);
        broadcastPresence(currentRoom);
      }
      socket.leave(currentRoom);
      currentRoom = null;
    }

    socket.on("join_room", async (room) => {
      if (typeof room !== "string" || !room) return;
      leaveCurrent();
      currentRoom = room;
      socket.join(room);
      if (!presence.has(room)) presence.set(room, new Map());
      presence.get(room).set(socket.id, { telegramId: socket.telegramId, name: socket.name });
      broadcastPresence(room);
      try {
        const history = await getChatHistory(room, 50);
        socket.emit("chat_history", history);
      } catch (e) {
        console.error("chat history failed:", e);
      }
    });

    socket.on("leave_room", () => leaveCurrent());

    socket.on("chat_message", async (text) => {
      if (!currentRoom || typeof text !== "string") return;
      const clean = text.slice(0, 500).trim();
      if (!clean) return;
      try {
        const createdAt = await saveChatMessage(currentRoom, socket.telegramId, socket.name, clean);
        io.to(currentRoom).emit("chat_message", {
          telegramId: socket.telegramId, name: socket.name, text: clean, created_at: createdAt,
        });
      } catch (e) {
        console.error("chat save failed:", e);
      }
    });

    socket.on("disconnect", () => leaveCurrent());
  });

  return io;
}

module.exports = { setupRealtime };
