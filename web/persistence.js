/* ===== Сохранение прогресса на сервере =====
   Работает поверх уже загруженного app.js — использует его глобальный `state`.
   В реальном Telegram берёт initData из Telegram.WebApp, вне Telegram — dev-режим
   с случайным id, который живёт в localStorage браузера. */
(function(){
  const tg = window.Telegram && window.Telegram.WebApp;
  const initData = tg && tg.initData ? tg.initData : null;

  let devUserId = localStorage.getItem("t2026_dev_id");
  if (!devUserId){
    devUserId = "browser_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("t2026_dev_id", devUserId);
  }

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
      toast("Прогресс загружен");
    } else {
      saveNow(); // первый заход — сразу создаём запись
    }
    renderHome();
    setInterval(saveNow, 10000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveNow();
    });
  })();
})();
