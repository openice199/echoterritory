/* ===== Сохранение прогресса на сервере =====
   Работает поверх уже загруженного app.js — использует его глобальный `state`.
   В реальном Telegram берёт initData из Telegram.WebApp, вне Telegram — dev-режим
   с случайным id, который живёт в localStorage браузера. */
(function(){
  const tg = window.Telegram && window.Telegram.WebApp;
  const initData = tg && tg.initData ? tg.initData : null;
  const tgUser = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;

  let devUserId = localStorage.getItem("t2026_dev_id");
  if (!devUserId){
    devUserId = "browser_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("t2026_dev_id", devUserId);
  }

  const displayName = tgUser ? (tgUser.first_name || tgUser.username || "Игрок") : ("Игрок_" + devUserId.slice(-4));
  window.myTelegramId = tgUser ? String(tgUser.id) : ("dev_" + devUserId);
  window.myDisplayName = displayName;

  function apiHeaders(){
    const headers = { "Content-Type": "application/json" };
    if (!initData) headers["x-dev-user-id"] = devUserId;
    return headers;
  }

  // Общий помощник для REST-вызовов к своему бэкенду (кланы и т.п.) —
  // сама подставляет initData/dev-заголовок, как остальные вызовы в этом файле.
  window.apiFetch = async function(url, options){
    options = options || {};
    const method = options.method || "GET";
    let body = options.body;
    if (method === "GET"){
      const sep = url.includes("?") ? "&" : "?";
      if (initData) url += sep + "initData=" + encodeURIComponent(initData);
    } else {
      const parsed = body ? JSON.parse(body) : {};
      if (initData) parsed.initData = initData;
      body = JSON.stringify(parsed);
    }
    const res = await fetch(url, { method, headers: apiHeaders(), body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data.error || ("HTTP " + res.status)); err.data = data; throw err; }
    return data;
  };

  // ===== Реальное время: присутствие и чат =====
  let socket = null;
  let joinedRoom = null;
  let onChatUpdate = null;
  window.chatState = { messages: [], presence: [] };

  function fmtTime(ts){
    const d = new Date(ts);
    return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
  }

  function connectSocket(){
    if (typeof io !== "function") { console.warn("socket.io client не загрузился"); return; }
    socket = io({ auth: initData ? { initData } : { devUserId } });
    socket.on("chat_history", (history) => {
      window.chatState.messages = history.map(m => ({ telegramId: m.telegram_id, name: m.name, text: m.text, time: fmtTime(Number(m.created_at)) }));
      if (onChatUpdate) onChatUpdate();
    });
    socket.on("chat_message", (m) => {
      window.chatState.messages.push({ telegramId: m.telegramId, name: m.name, text: m.text, time: fmtTime(m.created_at) });
      if (window.chatState.messages.length > 200) window.chatState.messages.shift();
      if (onChatUpdate) onChatUpdate();
    });
    socket.on("presence", (list) => {
      window.chatState.presence = list;
      if (onChatUpdate) onChatUpdate();
    });
  }

  window.setOnChatUpdate = function(cb){ onChatUpdate = cb; };
  window.joinChatRoom = function(room){
    if (!socket || joinedRoom === room) return;
    joinedRoom = room;
    socket.emit("join_room", room);
  };
  window.leaveChatRoom = function(){
    if (!socket || !joinedRoom) return;
    socket.emit("leave_room");
    joinedRoom = null;
    window.chatState = { messages: [], presence: [] };
  };
  window.sendChatMessage = function(text){
    if (!socket) return;
    socket.emit("chat_message", text);
  };

  async function loadSave(){
    try {
      const url = "/api/load" + (initData ? "?initData=" + encodeURIComponent(initData) : "");
      const res = await fetch(url, { headers: apiHeaders() });
      if (!res.ok) throw new Error("load failed: " + res.status);
      return await res.json();
    } catch (e) {
      console.warn("Не удалось загрузить сохранение, играем начисто:", e);
      return null;
    }
  }

  async function saveNow(){
    try {
      const body = { state };
      if (initData) body.initData = initData;
      const res = await fetch("/api/save", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save failed: " + res.status);
    } catch (e) {
      console.warn("Не удалось сохранить прогресс:", e);
    }
  }

  // Стартовый набор новичка — тир 1 "Дворовый" серой редкости на всех слотах,
  // ровно то, что уже отрисовано как настоящий арт (не эмодзи-заглушка).
  function freshInventory(){
    const kitIds = ["t1_weapon_grey","t1_jacket_grey","t1_shirt_grey","t1_hat_grey","t1_pants_grey","t1_boots_grey"];
    const items = kitIds.map(id => ({ ...catalogItem(id), count: 1 }));
    items.push({ id:"medkit", name:"Виттатеррон", icon:"🩹", cat:"consumable", count:1 });
    items.push({ id:"bandage", name:"Террадол", icon:"🩸", cat:"consumable", count:2 });
    return items;
  }

  function freshPlayerState(name){
    return {
      name: name,
      level: 1,
      rep: 0,
      district: "Новый город",
      hp: 80, maxHp: 80,
      exp: 0, maxExp: EXP_TABLE[0],
      rub: 500, stars: 0,
      freePoints: 5,
      stats: { str: 8, agi: 8, hpStat: 8, luck: 8 },
      clanId: null,
      equipment: {
        weapon: "t1_weapon_grey", accessory: null,
        jacket: "t1_jacket_grey", shirt: "t1_shirt_grey", hat: "t1_hat_grey", pants: "t1_pants_grey", boots: "t1_boots_grey",
        bracelet1: null, bracelet2: null, bracelet3: null, bracelet4: null,
        belt: null,
      },
      arenaPoints: 0, arenaRep: 0, arenaWins: 0, arenaLosses: 0,
      territoryTokens: 0, territoryRep: 0, territoryClaimedToday: false,
      activeJob: null,
      healSlotUnlocked: false,
      combatSlots: ["medkit", "bandage", null, null],
      energy: 100, maxEnergy: 100,
      povarMastery: 0, rodDurability: null, knownRecipes: [],
      travnikMastery: 0, secatorDurability: null, activeElixirs: [],
      farmacevtMastery: 0, glovesDurability: null,
      oruzejnikMastery: 0, cutterDurability: null,
      juvelirMastery: 0, sawDurability: null,
      portnoyMastery: 0, shearsDurability: null,
    };
  }

  function startFresh(){
    state.player = freshPlayerState(displayName);
    state.inventory = freshInventory();
    state.capacity = { used: state.inventory.length, max: 50 };
    currentDistrictId = "vokzal";
  }

  function applySave(saved){
    if (!saved || saved.isNew || !saved.state) return false;
    Object.assign(state.player, saved.state.player || {});
    if (Array.isArray(saved.state.inventory)) state.inventory = saved.state.inventory;
    if (saved.state.capacity) Object.assign(state.capacity, saved.state.capacity);
    if (saved.state.market) state.market = saved.state.market;
    return true;
  }

  // Автоматически заходим/выходим из чат-комнаты района при навигации —
  // оборачиваем уже существующий showScreen, не трогая его код в app.js.
  const _origShowScreen = window.showScreen;
  window.showScreen = function(name, opts){
    // "clanchat" открывается напрямую через openRealClanChat (минуя showScreen), но
    // возврат "назад" из неё идёт через showScreen — значит, выходим из любой активной
    // комнаты (район или клан) при переходе на любой экран, кроме самого чата района.
    if (name !== "chat" && joinedRoom) window.leaveChatRoom();
    _origShowScreen(name, opts);
    if (name === "chat") window.joinChatRoom(currentDistrictId);
  };

  (async () => {
    // Скрипт подключён в конце body, после app.js — DOM и state уже готовы, ждать DOMContentLoaded не нужно.
    connectSocket();
    window.setOnChatUpdate(() => {
      if (typeof renderChatTab === "function" && typeof chatTabActive !== "undefined") renderChatTab(chatTabActive);
    });
    const saved = await loadSave();
    if (applySave(saved)){
      toast(`С возвращением, ${state.player.name}!`);
      if (typeof resolveActiveJobOnLoad === "function"){
        resolveActiveJobOnLoad();
        saveNow(); // сразу фиксируем итог (докрученный таймер или готовые ресурсы), чтобы сервер не слал повторное уведомление
      }
    } else {
      startFresh();
      toast(`Добро пожаловать в Химер-Сити, ${displayName}!`);
      saveNow(); // первый заход — сразу создаём запись
    }
    renderHome();
    if (typeof refreshRealClan === "function"){
      refreshRealClan().then(renderHome);
    }
    setInterval(saveNow, 10000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveNow();
    });
  })();
})();
