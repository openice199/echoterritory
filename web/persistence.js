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

  function apiHeaders(){
    const headers = { "Content-Type": "application/json" };
    if (!initData) headers["x-dev-user-id"] = devUserId;
    return headers;
  }

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

  (async () => {
    // Скрипт подключён в конце body, после app.js — DOM и state уже готовы, ждать DOMContentLoaded не нужно.
    const saved = await loadSave();
    if (applySave(saved)){
      toast(`С возвращением, ${state.player.name}!`);
    } else {
      startFresh();
      toast(`Добро пожаловать в Химер-Сити, ${displayName}!`);
      saveNow(); // первый заход — сразу создаём запись
    }
    renderHome();
    setInterval(saveNow, 10000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveNow();
    });
  })();
})();
