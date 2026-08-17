/* ===== State ===== */
let state = null;       // состояние персонажа (state.player зеркалит серверную state)
let world = null;       // { city, areas, links, npcs, items }
let socket = null;
let fight = null;       // { npc:{key,name,hp,maxHp}, selfHp, selfMaxHp, atkZone, blkZone }

const ZONE_LABEL = { head: "Голова", chest: "Грудь", groin: "Пах", legs: "Ноги" };

/* ===== API helper ===== */
async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "ошибка запроса");
  return data;
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast-item";
  t.textContent = msg;
  document.getElementById("toast").appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

/* ===== Auth screen ===== */
document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("loginForm").classList.toggle("hidden", tab.dataset.tab !== "login");
    document.getElementById("registerForm").classList.toggle("hidden", tab.dataset.tab !== "register");
  });
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("loginError");
  errEl.textContent = "";
  try {
    const login = document.getElementById("loginLogin").value.trim();
    const password = document.getElementById("loginPassword").value;
    const data = await api("/browser-api/login", "POST", { login, password });
    await startGame(data.state);
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("registerError");
  errEl.textContent = "";
  try {
    const login = document.getElementById("regLogin").value.trim();
    const password = document.getElementById("regPassword").value;
    const email = document.getElementById("regEmail").value.trim();
    const gender = document.querySelector('input[name="gender"]:checked').value;
    const data = await api("/browser-api/register", "POST", { login, password, email, gender });
    await startGame(data.state);
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await api("/browser-api/logout", "POST");
  if (socket) socket.disconnect();
  location.reload();
});

/* ===== Bootstrap ===== */
async function startGame(playerState) {
  state = playerState;
  const w = await api("/browser-api/world");
  world = w;
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("gameScreen").classList.remove("hidden");
  connectSocket();
  renderAll();
}

function connectSocket() {
  socket = io("/browser", { withCredentials: true });
  socket.on("chat_message", (msg) => appendChatMessage(msg));
  socket.on("presence", (p) => {
    document.getElementById("onlineCount").textContent = p.players.length;
    const list = document.getElementById("onlineList");
    list.innerHTML = p.players.length
      ? p.players.map((n) => `<div class="online-item">${escapeHtml(n)}</div>`).join("")
      : '<div class="inv-empty">Никого нет</div>';
  });
}

(async () => {
  try {
    const data = await api("/browser-api/me");
    await startGame(data.state);
  } catch (e) {
    // не авторизован — остаёмся на экране входа
  }
})();

/* ===== Render ===== */
function renderAll() {
  renderTopbar();
  renderArea();
  renderCharacter();
}

function renderTopbar() {
  document.getElementById("pName").textContent = state.name;
  document.getElementById("pLevel").textContent = state.level;
  document.getElementById("hpFill").style.width = `${(state.hp / state.maxHp) * 100}%`;
  document.getElementById("hpText").textContent = `${state.hp}/${state.maxHp}`;
  document.getElementById("pRub").textContent = state.rub;
}

function areaById(id) { return world.areas.find((a) => a.id === id); }
function districtOf(area) { return area.parent ? areaById(area.parent) : null; }

function renderArea() {
  const area = areaById(state.areaId);
  const district = districtOf(area);
  if (area.bg) document.getElementById("areaPhoto").style.backgroundImage = `url(${area.bg})`;

  const locTable = document.getElementById("locTable");
  locTable.innerHTML = `
    <tr><td>Город:<br><b class="t5">${world.city}</b></td></tr>
    ${district ? `<tr><td>Район:<br><b class="t5">${district.name}</b></td></tr>` : ""}
    <tr><td>Улица:<br><b class="t5">${area.name}</b></td></tr>
    <tr><td><span class="t5">Улица не приватизирована</span></td></tr>
  `;

  const exitsRow = document.getElementById("exitsRow");
  exitsRow.innerHTML = "";
  const links = world.links.filter((l) => l.a === area.id || l.b === area.id);
  links.forEach((l) => {
    const otherId = l.a === area.id ? l.b : l.a;
    const other = areaById(otherId);
    const btn = document.createElement("button");
    btn.className = "exit-btn";
    btn.textContent = `→ ${other.name}`;
    btn.addEventListener("click", () => moveTo(otherId));
    exitsRow.appendChild(btn);
  });

  const npcRow = document.getElementById("npcRow");
  npcRow.innerHTML = "";
  document.getElementById("npcBlock").classList.toggle("hidden", !area.npcs || !area.npcs.length);
  (area.npcs || []).forEach((key) => {
    const npc = world.npcs[key];
    const card = document.createElement("div");
    card.className = "npc-card";
    card.innerHTML = `<img class="npc-icon" src="${npc.icon}" alt=""><span class="n">${npc.name}</span><span>СИЛ ${npc.str} · ЗДР ${npc.health}</span>`;
    const btn = document.createElement("button");
    btn.textContent = "Атаковать";
    btn.disabled = !!fight;
    btn.addEventListener("click", () => startFight(key));
    card.appendChild(btn);
    npcRow.appendChild(card);
  });

  const shopBlock = document.getElementById("shopBlock");
  shopBlock.classList.toggle("hidden", !area.shop);
  if (area.shop) renderShop();
}

function renderShop() {
  const grid = document.getElementById("shopGrid");
  grid.innerHTML = "";
  world.items.forEach((item) => {
    const owned = state.inventory[item.id] || 0;
    const div = document.createElement("div");
    div.className = "shop-item";
    div.innerHTML = `<img class="item-icon" src="${item.icon}" alt=""><span class="n">${item.name}</span><span class="p">${item.price} Т${owned ? ` · есть: ${owned}` : ""}</span>`;
    const row = document.createElement("div");
    row.className = "row";
    const buyBtn = document.createElement("button");
    buyBtn.className = "buy";
    buyBtn.textContent = "Купить";
    buyBtn.addEventListener("click", () => shopAction("buy", item.id));
    row.appendChild(buyBtn);
    if (owned) {
      const sellBtn = document.createElement("button");
      sellBtn.className = "sell";
      sellBtn.textContent = "Продать";
      sellBtn.addEventListener("click", () => shopAction("sell", item.id));
      row.appendChild(sellBtn);
    }
    div.appendChild(row);
    grid.appendChild(div);
  });
}

async function shopAction(kind, itemId) {
  try {
    const data = await api(`/browser-api/shop/${kind}`, "POST", { itemId });
    state = data.state;
    renderAll();
  } catch (e) {
    toast(e.message);
  }
}

function itemById(id) { return world.items.find((i) => i.id === id); }

function renderCharacter() {
  document.getElementById("statStr").textContent = state.stats.str;
  document.getElementById("statDex").textContent = state.stats.dex;
  document.getElementById("statHealth").textContent = state.stats.health;
  document.getElementById("freePoints").textContent = state.freePoints > 0 ? `Свободных очков: ${state.freePoints}` : "";
  document.querySelectorAll(".stat-plus").forEach((b) => { b.disabled = state.freePoints <= 0; });

  const portraitSrc = `assets/player/${state.gender === "f" ? "woman" : "man"}.gif`;
  const portraitImg = document.getElementById("dollPortraitImg");
  if (portraitImg.getAttribute("src") !== portraitSrc) portraitImg.src = portraitSrc;

  document.querySelectorAll(".doll-slot").forEach((slotEl) => {
    const slot = slotEl.dataset.slot;
    const itemId = state.equipment[slot];
    slotEl.classList.toggle("filled", !!itemId);
    slotEl.innerHTML = itemId
      ? `<img class="item-icon" src="${itemById(itemId).icon}" alt="${itemById(itemId).name}">`
      : "";
    slotEl.onclick = itemId ? () => unequip(slot) : null;
  });

  const grid = document.getElementById("inventoryGrid");
  grid.innerHTML = "";
  const entries = Object.entries(state.inventory).filter(([, c]) => c > 0);
  if (!entries.length) {
    grid.innerHTML = '<div class="inv-empty">Рюкзак пуст</div>';
  }
  entries.forEach(([itemId, count]) => {
    const item = itemById(itemId);
    const row = document.createElement("div");
    row.className = "inv-item";
    row.innerHTML = `<img class="item-icon" src="${item.icon}" alt=""><span class="n">${item.name}</span><span class="c">×${count}</span>`;
    const btn = document.createElement("button");
    btn.textContent = "Надеть";
    btn.addEventListener("click", () => equip(itemId));
    row.appendChild(btn);
    grid.appendChild(row);
  });
}

document.querySelectorAll(".stat-plus").forEach((b) => {
  b.addEventListener("click", async () => {
    try {
      const data = await api("/browser-api/stats/allocate", "POST", { stat: b.dataset.stat });
      state = data.state;
      renderAll();
    } catch (e) { toast(e.message); }
  });
});

async function equip(itemId) {
  try {
    const data = await api("/browser-api/equip", "POST", { itemId });
    state = data.state;
    renderAll();
  } catch (e) { toast(e.message); }
}
async function unequip(slot) {
  try {
    const data = await api("/browser-api/unequip", "POST", { slot });
    state = data.state;
    renderAll();
  } catch (e) { toast(e.message); }
}

/* ===== Movement ===== */
async function moveTo(areaId) {
  try {
    const data = await api("/browser-api/move", "POST", { areaId });
    state = data.state;
    if (socket) socket.emit("change_area", areaId);
    document.getElementById("chatLog").innerHTML = "";
    renderAll();
  } catch (e) { toast(e.message); }
}

/* ===== Chat ===== */
document.getElementById("chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text || !socket) return;
  socket.emit("chat_message", text);
  input.value = "";
});

function appendChatMessage(msg) {
  const log = document.getElementById("chatLog");
  const div = document.createElement("div");
  div.className = "chat-msg";
  div.innerHTML = `<span class="who">${msg.name}:</span>${escapeHtml(msg.text)}`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ===== Fight ===== */
async function startFight(npcKey) {
  try {
    const data = await api("/browser-api/fight/start", "POST", { npcKey });
    fight = { npc: data.npc, selfHp: data.selfHp, selfMaxHp: data.selfMaxHp, atkZone: null, blkZone: null };
    document.getElementById("fightOverlay").classList.remove("hidden");
    document.getElementById("fightLog").innerHTML = "";
    renderFight();
    renderArea();
  } catch (e) { toast(e.message); }
}

function renderFight() {
  document.getElementById("fightSelfName").textContent = state.name;
  document.getElementById("fightNpcName").textContent = fight.npc.name;
  document.getElementById("fightSelfPortrait").src = `assets/player/${state.gender === "f" ? "woman" : "man"}.gif`;
  document.getElementById("fightNpcPortrait").src = world.npcs[fight.npc.key].icon;
  document.getElementById("fightSelfHpFill").style.width = `${Math.max(0, (fight.selfHp / fight.selfMaxHp) * 100)}%`;
  document.getElementById("fightSelfHpText").textContent = `${fight.selfHp}/${fight.selfMaxHp}`;
  document.getElementById("fightNpcHpFill").style.width = `${Math.max(0, (fight.npc.hp / fight.npc.maxHp) * 100)}%`;
  document.getElementById("fightNpcHpText").textContent = `${fight.npc.hp}/${fight.npc.maxHp}`;
  document.querySelectorAll("#atkZones button").forEach((b) => b.classList.toggle("selected", b.dataset.zone === fight.atkZone));
  document.querySelectorAll("#blkZones button").forEach((b) => b.classList.toggle("selected", b.dataset.zone === fight.blkZone));
  document.getElementById("fightTurnBtn").disabled = !fight.atkZone || !fight.blkZone;
}

document.querySelectorAll("#atkZones button").forEach((b) => {
  b.addEventListener("click", () => { if (fight) { fight.atkZone = b.dataset.zone; renderFight(); } });
});
document.querySelectorAll("#blkZones button").forEach((b) => {
  b.addEventListener("click", () => { if (fight) { fight.blkZone = b.dataset.zone; renderFight(); } });
});

function fightLogLine(text, cls) {
  const log = document.getElementById("fightLog");
  const div = document.createElement("div");
  if (cls) div.className = cls;
  div.textContent = text;
  log.prepend(div);
}

document.getElementById("fightTurnBtn").addEventListener("click", async () => {
  if (!fight || !fight.atkZone || !fight.blkZone) return;
  try {
    const data = await api("/browser-api/fight/turn", "POST", { zone: fight.atkZone, block: fight.blkZone });
    fight.npc.hp = data.npcHp;
    fight.selfHp = data.selfHp;

    if (data.playerAtk.dodged) fightLogLine(`${fight.npc.name} увернулся от вашего удара в ${ZONE_LABEL[fight.atkZone]}`);
    else fightLogLine(`Вы бьёте в ${ZONE_LABEL[fight.atkZone]}: ${data.playerAtk.dmg} урона${data.playerAtk.crit ? " (КРИТ!)" : ""}`);
    if (data.npcAtk) {
      if (data.npcAtk.dodged) fightLogLine(`Вы увернулись от удара ${fight.npc.name}`);
      else fightLogLine(`${fight.npc.name} бьёт вас: ${data.npcAtk.dmg} урона${data.npcAtk.crit ? " (КРИТ!)" : ""}`);
    }

    fight.atkZone = null; fight.blkZone = null;
    renderFight();

    if (data.over) {
      state = data.state;
      if (data.won) {
        fightLogLine(`Победа! +${data.reward.exp} опыта, +${data.reward.rub} Т${data.reward.leveledUp ? ` — новый уровень ${data.reward.level}!` : ""}`, "chat-msg");
        toast(`Победа над ${fight.npc.name}!`);
      } else {
        fightLogLine("Вы проиграли бой и очнулись с частью здоровья...", "chat-msg");
        toast("Поражение...");
      }
      setTimeout(() => {
        document.getElementById("fightOverlay").classList.add("hidden");
        fight = null;
        renderAll();
      }, 1800);
    }
  } catch (e) { toast(e.message); }
});

document.getElementById("fightFleeBtn").addEventListener("click", async () => {
  try {
    await api("/browser-api/fight/flee", "POST");
  } catch (e) { /* ignore */ }
  fight = null;
  document.getElementById("fightOverlay").classList.add("hidden");
  renderArea();
});
