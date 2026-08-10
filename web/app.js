/* ===== Leveling (25 levels max) ===== */
const EXP_TABLE = [120,150,200,250,320,400,530,680,850,1100,1400,1800,2300,3000,3800,4900,6200,8000,10200,13000,16700,21400,27400,35000];
function expForNextLevel(level){
  if (level >= 25) return Infinity;
  return EXP_TABLE[level-1];
}

/* ===== State ===== */
const state = {
  player: {
    name: "Shadow",
    level: 4,
    rep: 120,
    district: "Новый город",
    hp: 115, maxHp: 115,
    exp: 180, maxExp: 250,
    rub: 12450, stars: 25,
    freePoints: 3,
    stats: { str: 14, agi: 12, hpStat: 16, luck: 10 },
    clanId: null,
    equipment: {
      weapon: "bat", accessory: null,
      jacket: "jacket", shirt: null, hat: "hat", pants: null, boots: "boots",
      bracelet1: null, bracelet2: null, bracelet3: null, bracelet4: null,
      belt: null,
    },
    arenaPoints: 0, arenaRep: 0, arenaWins: 0, arenaLosses: 0,
    territoryTokens: 0, territoryRep: 0, territoryClaimedToday: false,
    healSlotUnlocked: false,
    combatSlots: ["medkit", "bandage", null, null],
    energy: 80, maxEnergy: 100,
    povarMastery: 0, rodDurability: null, knownRecipes: [],
    travnikMastery: 0, secatorDurability: null, activeElixirs: [],
    farmacevtMastery: 0, glovesDurability: null,
    oruzejnikMastery: 0, cutterDurability: null,
    juvelirMastery: 0, sawDurability: null,
    portnoyMastery: 0, shearsDurability: null,
  },
  inventory: [
    { id:"armature", name:"Арматура", icon:"🔩", cat:"weapon", count:1, equipSlot:"weapon", dmgMin:14, dmgMax:20 },
    { id:"bat", name:"Бита", icon:"🏏", cat:"weapon", count:1, equipSlot:"weapon", dmgMin:16, dmgMax:22 },
    { id:"knife", name:"Нож", icon:"🔪", cat:"weapon", count:1, equipSlot:"weapon", dmgMin:10, dmgMax:15 },
    { id:"knuckle", name:"Кастет", icon:"🥊", cat:"weapon", count:1, equipSlot:"weapon", dmgMin:8, dmgMax:12 },
    { id:"jacket", name:"Куртка", icon:"🧥", cat:"armor", count:1, equipSlot:"jacket", zone:"chest", def:6 },
    { id:"vest", name:"Бронежилет", icon:"🦺", cat:"armor", count:1, equipSlot:"jacket", zone:"chest", def:10 },
    { id:"shirt", name:"Майка", icon:"👕", cat:"armor", count:1, equipSlot:"shirt", zone:"belly", def:4 },
    { id:"hat", name:"Шапка", icon:"🧢", cat:"armor", count:1, equipSlot:"hat", zone:"head", def:3 },
    { id:"pants", name:"Штаны", icon:"👖", cat:"armor", count:1, equipSlot:"pants", zone:"legs", def:5 },
    { id:"boots", name:"Берцы", icon:"🥾", cat:"armor", count:1, equipSlot:"boots", zone:"legs", def:4 },
    { id:"luckyCharm", name:"Кулон удачи", icon:"🔮", cat:"armor", count:1, equipSlot:"accessory", statBonus:{luck:3} },
    { id:"braceletStr", name:"Браслет силы", icon:"📿", cat:"armor", count:1, equipSlot:"bracelet", statBonus:{str:2} },
    { id:"medkit", name:"Виттатеррон", icon:"🩹", cat:"consumable", count:3 },
    { id:"bandage", name:"Террадол", icon:"🩸", cat:"consumable", count:5 },
    { id:"energy", name:"Энергетик", icon:"🥫", cat:"consumable", count:2 },
    { id:"water", name:"Вода", icon:"💧", cat:"consumable", count:4 },
    { id:"metal", name:"Металл", icon:"⚙️", cat:"material", count:12 },
    { id:"cloth", name:"Ткань", icon:"🧵", cat:"material", count:7 },
    { id:"wire", name:"Проволока", icon:"🔗", cat:"material", count:8 },
    { id:"bolts", name:"Болты", icon:"🔩", cat:"material", count:15 },
  ],
  capacity: { used: 28, max: 50 },
};

const EQUIP_SLOT_LABELS = {
  weapon:"Оружие", accessory:"Аксессуар", jacket:"Куртка", shirt:"Майка", hat:"Шапка",
  pants:"Штаны", boots:"Обувь", bracelet1:"Браслет 1", bracelet2:"Браслет 2",
  bracelet3:"Браслет 3", bracelet4:"Браслет 4", belt:"Пояс",
};
const EQUIP_SLOT_ICONS = {
  weapon:"🗡️", accessory:"🔮", jacket:"🧥", shirt:"👕", hat:"🧢",
  pants:"👖", boots:"🥾", bracelet1:"📿", bracelet2:"📿", bracelet3:"📿", bracelet4:"📿", belt:"🥋",
};
function slotAcceptsItem(slotKey, item){
  if (slotKey.startsWith("bracelet")) return item.equipSlot === "bracelet";
  return item.equipSlot === slotKey;
}
function getEquippedItem(slotKey){
  const id = state.player.equipment[slotKey];
  return id ? findItem(id) : null;
}
function getEquippedWeapon(){
  return getEquippedItem("weapon") || { name:"Голые руки", dmgMin:2, dmgMax:4 };
}
function zoneDefense(zone){
  let total = 0;
  Object.keys(state.player.equipment).forEach(slotKey => {
    const it = getEquippedItem(slotKey);
    if (it && it.zone === zone) total += (it.def || 0);
  });
  return total;
}
function equipmentStatBonus(){
  const bonus = { str:0, agi:0, hpStat:0, luck:0 };
  Object.keys(state.player.equipment).forEach(slotKey => {
    const it = getEquippedItem(slotKey);
    if (it && it.statBonus){
      Object.keys(it.statBonus).forEach(k => { bonus[k] = (bonus[k]||0) + it.statBonus[k]; });
    }
  });
  return bonus;
}
function equipmentCritBonus(){
  let total = 0;
  Object.keys(state.player.equipment).forEach(slotKey => {
    const it = getEquippedItem(slotKey);
    if (it && it.critBonus) total += it.critBonus;
  });
  return total;
}
function cleanExpiredElixirs(){
  const now = Date.now();
  const before = state.player.activeElixirs.length;
  state.player.activeElixirs = state.player.activeElixirs.filter(e => e.expiresAt > now);
  return state.player.activeElixirs.length !== before;
}
function totalElixirBuffPercent(){
  cleanExpiredElixirs();
  return state.player.activeElixirs.reduce((sum,e) => sum+e.buffPercent, 0);
}
function effectiveStats(){
  const b = equipmentStatBonus();
  const s = state.player.stats;
  const mult = 1 + totalElixirBuffPercent()/100;
  return {
    str: Math.round((s.str+b.str)*mult),
    agi: Math.round((s.agi+b.agi)*mult),
    hpStat: Math.round((s.hpStat+b.hpStat)*mult),
    luck: Math.round((s.luck+b.luck)*mult),
  };
}
function equipItem(slotKey, itemId){
  state.player.equipment[slotKey] = itemId;
}
function unequipItem(slotKey){
  state.player.equipment[slotKey] = null;
}

function findItem(id){ return state.inventory.find(i => i.id === id); }
function itemCount(id){ const it = findItem(id); return it ? it.count : 0; }
// Списывает предмет и убирает его из инвентаря при обнулении — иначе, как уже было
// с зельями/расходниками в бою, остаётся "призрачная" карточка с иконкой, которую
// нельзя использовать (count=0), но она никуда не девается из списка.
function spendItem(item, qty){
  if (!item) return;
  item.count -= (qty || 1);
  if (item.count <= 0) state.inventory = state.inventory.filter(x => x !== item);
}

/* ===== Districts ===== */
const districts = [
  { id:"vokzal", name:"Новый город", level:"1 - 5", lvlMin:1, lvlMax:5, unlocked:true, desc:"Биржевая площадь, вокзальная суета, приезжие и барыги. Здесь крутятся мелкие деньги и решаются мелкие дела." , icon:"🚉", taxValue:200, image:"assets/districts/vokzal.jpg" },
  { id:"promzona", name:"Промышленный", level:"3 - 7", lvlMin:3, lvlMax:7, unlocked:true, desc:"Заброшенные цеха и склады вдоль Первой и Второй линии. Хороший металл, плохая репутация.", icon:"🏭", taxValue:280, image:"assets/districts/promzona.jpg" },
  { id:"prospect", name:"Downtown", level:"2 - 6", lvlMin:2, lvlMax:6, unlocked:true, current:true, desc:"Деловой центр и площадь Мечты. Торговые улицы, забегаловки, толпы людей — здесь крутятся деньги.", icon:"🏙️", taxValue:240, image:"assets/districts/prospect.jpg" },
  { id:"naberezhnaya", name:"Излучина", level:"4 - 8", lvlMin:4, lvlMax:8, unlocked:false, desc:"Тихий район у речного изгиба. Спокойствие обманчиво — тут любят решать вопросы без свидетелей.", icon:"🌊", taxValue:320, image:"assets/districts/naberezhnaya.jpg" },
  { id:"les", name:"Подветренная Роща", level:"5 - 9", lvlMin:5, lvlMax:9, unlocked:false, desc:"Колониальный бульвар тонет в зарослях на самой окраине города. Мало людей, много опасности.", icon:"🌲", taxValue:360, image:"assets/districts/les.jpg" },
  { id:"old", name:"Старый город", level:"6 - 10", lvlMin:6, lvlMax:10, unlocked:false, desc:"Дворцовая площадь и Твердыня Федулова — ветхие дома и старые счёты. Сюда лучше соваться подготовленным.", icon:"🏚️", taxValue:400, image:"assets/districts/old.jpg" },
  { id:"port", name:"Порт", level:"11 - 15", lvlMin:11, lvlMax:15, unlocked:false, desc:"Причальная улица, грузовые терминалы и склады контрабанды. Серьёзные деньги — серьёзная охрана.", icon:"⚓", taxValue:600, image:"assets/districts/port.jpg" },
  { id:"center", name:"Капитанка", level:"14 - 19", lvlMin:14, lvlMax:19, unlocked:false, desc:"Деловой квартал города. Наёмная охрана, костюмы и деньги в тени закона.", icon:"🏢", taxValue:760, image:"assets/districts/center.jpg" },
  { id:"catacombs", name:"Катакомбы", level:"18 - 25", lvlMin:18, lvlMax:25, unlocked:false, desc:"Подземный чёрный рынок города. Сюда спускаются только те, кто уверен, что вернётся.", icon:"🕳️", taxValue:1000, image:"assets/districts/catacombs.jpg" },
];
let currentDistrictId = "prospect";

/* ===== Локации сбора для профессий (без боёв, с 1 уровня) ===== */
const professionSpots = [
  { id:"svalka", name:"Свалка", icon:"🏚️", profession:"oruzejnik", desc:"Сбор лома — открывает экран профессии Оружейника.", resources:[] },
  { id:"sklad", name:"Текстильный склад", icon:"📦", profession:"portnoy", desc:"Сбор ткани — открывает экран профессии Портного.", resources:[] },
  { id:"bereg", name:"Берег", icon:"🏖️", profession:"farmacevt", desc:"Сбор водорослей — открывает экран профессии Фармацевта.", resources:[] },
  { id:"priisk", name:"Прииск", icon:"⛏️", profession:"juvelir", desc:"Сбор камней — открывает экран профессии Ювелира.", resources:[] },
  { id:"pristan", name:"Пристань", icon:"🎣", profession:"povar", desc:"Рыбалка — открывает экран профессии Повара.", resources:[] },
  { id:"pustyr", name:"Поле одуванчиков", icon:"🌼", profession:"travnik", desc:"Сбор одуванчиков — открывает экран профессии Травника.", resources:[] },
];

/* ===== Занятость (нельзя путешествовать/драться, пока идёт таймер) ===== */
function isBusy(){
  return workState === "running" || fishingActive || cookingActive || gatherActive || brewActive ||
    seaweedActive || potionBrewActive || scrapActive || forgeActive || gemActive || setActive ||
    fabricActive || sewActive;
}
function busyLabel(){
  if (workState === "running") return "работа на локации";
  if (fishingActive) return "рыбалка";
  if (cookingActive) return "готовка";
  if (gatherActive) return "сбор одуванчиков";
  if (brewActive) return "варка эликсира";
  if (seaweedActive) return "сбор водорослей";
  if (potionBrewActive) return "приготовление препарата";
  if (scrapActive) return "сбор лома";
  if (forgeActive) return "ковка оружия";
  if (gemActive) return "добыча камней";
  if (setActive) return "огранка";
  if (fabricActive) return "сбор ткани";
  if (sewActive) return "пошив";
  return "";
}
function busySecondsLeft(){
  if (workState === "running") return workSeconds;
  if (fishingActive) return fishingSecondsLeft;
  if (cookingActive) return cookingSecondsLeft;
  if (gatherActive) return gatherSecondsLeft;
  if (brewActive) return brewSecondsLeft;
  if (seaweedActive) return seaweedSecondsLeft;
  if (potionBrewActive) return potionBrewSecondsLeft;
  if (scrapActive) return scrapSecondsLeft;
  if (forgeActive) return forgeSecondsLeft;
  if (gemActive) return gemSecondsLeft;
  if (setActive) return setSecondsLeft;
  if (fabricActive) return fabricSecondsLeft;
  if (sewActive) return sewSecondsLeft;
  return 0;
}
function updateBusyBanner(){
  const banner = document.getElementById("homeBusyBanner");
  if (!banner) return;
  if (isBusy()){
    banner.classList.remove("hidden");
    document.getElementById("busyBannerText").textContent = `Заняты: ${busyLabel()} — осталось ${formatTime(busySecondsLeft())}`;
  } else {
    banner.classList.add("hidden");
  }
}

// Отмечаем длительную активность (рыбалка, готовка, сбор и т.п.) в сохраняемом
// состоянии — чтобы прогресс переживал закрытие приложения: при следующем заходе
// resolveActiveJobOnLoad() либо мгновенно завершит её (если время вышло), либо
// докрутит таймер с правильным остатком. См. ACTIVE_JOB_DEFS ниже.
function beginActiveJob(kind, targetId, durationSec){
  state.player.activeJob = { kind, targetId: targetId ?? null, startedAt: Date.now(), durationSec };
}
function endActiveJob(){
  state.player.activeJob = null;
}

/* ===== Уведомления браузера (замена push от Telegram-бота в проде) ===== */
function requestNotifyPermission(){
  if ("Notification" in window && Notification.permission === "default"){
    Notification.requestPermission().catch(() => {});
  }
}
function notifyDone(title, body){
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { new Notification(title, { body }); } catch(e){}
}

/* ===== NPCs ===== */
/* ===== Экономика: защита от фарма заниженных целей =====
   Если игрок сильно выше уровнем убитого NPC, денежная награда режется —
   иначе можно бесконечно фармить лёгкую цель без реального риска. */
function moneyRewardMultiplier(playerLevel, npcLevel){
  const gap = playerLevel - npcLevel;
  if (gap <= 3) return 1;
  if (gap <= 6) return 0.6;
  if (gap <= 10) return 0.3;
  return 0.1;
}
function npcStatsForLevel(level){
  return {
    hp: 60 + level*15,
    str: Math.round(6 + level*1.3),
    agi: Math.round(5 + level),
    luck: Math.round(4 + level*0.6),
    weaponAvg: 8 + level*2,
    expReward: 30 + level*8,
    rubReward: 100 + level*30,
  };
}
const npcTemplates = {
  vokzal: [
    { name:"Гопник", level:1, tag:"слабый" },
    { name:"Барыга", level:3, tag:"средний" },
    { name:"Биржевой Вышибала", level:5, tag:"мини-босс" },
  ],
  prospect: [
    { name:"Мажор", level:2, tag:"слабый" },
    { name:"Карманник", level:4, tag:"средний" },
    { name:"Рэкетир", level:6, tag:"мини-босс" },
  ],
  promzona: [
    { name:"Сторож", level:3, tag:"слабый" },
    { name:"Металлист-бродяга", level:5, tag:"средний" },
    { name:"Прораб-вышибала", level:7, tag:"мини-босс" },
  ],
  naberezhnaya: [
    { name:"Контрабандист", level:4, tag:"слабый" },
    { name:"Речной бандит", level:6, tag:"средний" },
    { name:"Смотрящий набережной", level:8, tag:"мини-босс" },
  ],
  les: [
    { name:"Дезертир", level:5, tag:"слабый" },
    { name:"Браконьер", level:7, tag:"средний" },
    { name:"Лесной отшельник", level:9, tag:"мини-босс" },
  ],
  old: [
    { name:"Уличный боец", level:6, tag:"слабый" },
    { name:"Ветеран разборок", level:8, tag:"средний" },
    { name:"Авторитет района", level:10, tag:"мини-босс" },
  ],
  port: [
    { name:"Портовый грузчик", level:11, tag:"слабый" },
    { name:"Контрабандный курьер", level:13, tag:"средний" },
    { name:"Смотрящий порта", level:15, tag:"мини-босс" },
  ],
  center: [
    { name:"Охрана бизнес-центра", level:14, tag:"слабый" },
    { name:"Наёмник", level:16, tag:"средний" },
    { name:"Телохранитель авторитета", level:19, tag:"мини-босс" },
  ],
  catacombs: [
    { name:"Беглый уголовник", level:18, tag:"слабый" },
    { name:"Наёмный убийца", level:21, tag:"средний" },
    { name:"Барон катакомб", level:25, tag:"финальный босс" },
  ],
};

/* ===== Craft recipes ===== */
const professions = [
  { id:"oruzejnik", name:"Оружейник", icon:"🔨", desc:"Куёт оружие из металла — от арматуры до кастета." },
  { id:"portnoy", name:"Портной", icon:"🧵", desc:"Шьёт одежду и лёгкую броню. Единственный источник золотой редкости экипировки." },
  { id:"farmacevt", name:"Фармацевт", icon:"💊", desc:"Готовит аптечки и бинты из ткани и воды." },
  { id:"juvelir", name:"Ювелир", icon:"💍", desc:"Делает украшения — кулоны и браслеты." },
  { id:"povar", name:"Повар", icon:"🍳", desc:"Готовит еду, восстанавливающую энергию. Единственный источник восстановления энергии." },
  { id:"travnik", name:"Травник", icon:"🌿", desc:"Собирает и заваривает травы." },
];

/* ===== Повар: рыбалка и готовка ===== */
const ROD_MAX_DURABILITY = 50;
const ROD_PRICE = 1500;
const PLATE_PRICE = 50;
const FISHING_SECONDS = 10*60;
const COOKING_SECONDS = 2*60;

const fishSpecies = [
  { id:"crayfish", name:"Раки", icon:"🦞", masteryReq:0, catchMin:1, catchMax:5 },
  { id:"crucian", name:"Карась", icon:"🐟", masteryReq:20, catchMin:1, catchMax:4 },
  { id:"perch", name:"Окунь", icon:"🐠", masteryReq:40, catchMin:1, catchMax:3 },
  { id:"zander", name:"Судак", icon:"🐡", masteryReq:60, catchMin:1, catchMax:3 },
  { id:"sturgeon", name:"Осётр", icon:"🐋", masteryReq:80, catchMin:1, catchMax:2 },
];

const cookRecipes = [
  { id:"boiledCrayfish", name:"Варёные раки", icon:"🍲", fishId:"crayfish", masteryReq:0, energyRestore:10, learnPrice:300 },
  { id:"friedCrucian", name:"Жареный карась", icon:"🍳", fishId:"crucian", masteryReq:20, energyRestore:15, learnPrice:600 },
  { id:"bakedPerch", name:"Запечённый окунь", icon:"🍽️", fishId:"perch", masteryReq:40, energyRestore:20, learnPrice:1200 },
  { id:"zanderSoup", name:"Уха из судака", icon:"🍜", fishId:"zander", masteryReq:60, energyRestore:25, learnPrice:2000 },
  { id:"sturgeonPlate", name:"Осетрина на тарелке", icon:"🐟", fishId:"sturgeon", masteryReq:80, energyRestore:30, learnPrice:3500 },
];

/* ===== Травник: сбор одуванчиков и эликсиры ===== */
const SECATOR_MAX_DURABILITY = 50;
const SECATOR_PRICE = 1200;
const VIAL_PRICE = 40;
const GATHER_DANDELION_SECONDS = 10*60;
const GATHER_DANDELION_ENERGY_COST = 5; // 10 мин сбора = -1 прочность И -5 энергии
const BREW_SECONDS = 2*60;
const MAX_ACTIVE_ELIXIRS = 3;
const ELIXIR_DURATION_MS = 60*60*1000; // 1 час

const elixirRecipes = [
  { id:"elixirP1", name:"П-1 Power", icon:"🧪", masteryReq:0, dandelionsNeed:5, buffPercent:1, learnPrice:300 },
  { id:"elixirP2", name:"П-2 Power", icon:"🧪", masteryReq:20, dandelionsNeed:10, buffPercent:2, learnPrice:600 },
  { id:"elixirP3", name:"П-3 Power", icon:"🧪", masteryReq:40, dandelionsNeed:15, buffPercent:3, learnPrice:1200 },
  { id:"elixirP4", name:"П-4 Power", icon:"🧪", masteryReq:60, dandelionsNeed:20, buffPercent:4, learnPrice:2000 },
  { id:"elixirP5", name:"П-5 Power", icon:"🧪", masteryReq:80, dandelionsNeed:25, buffPercent:5, learnPrice:3500 },
];

/* ===== Фармацевт: сбор водорослей и зелья восстановления ===== */
const GLOVES_MAX_DURABILITY = 50;
const GLOVES_PRICE = 1200;
const THICKENER_PRICE = 40;
const GATHER_SEAWEED_SECONDS = 10*60;
const GATHER_SEAWEED_ENERGY_COST = 5; // 10 мин сбора = -1 прочность И -5 энергии
const BREW_POTION_SECONDS = 2*60;
const HOT_TURNS = 3;

/* ===== Боевой набор: 4 слота под расходники/зелья Фармацевта ===== */
const INSTANT_HEAL_ITEMS = { medkit:50, bandage:15, energy:30 };
function isCombatSlotEligible(it){ return INSTANT_HEAL_ITEMS[it.id] !== undefined || it.hotMin !== undefined; }
let loadoutPickerIndex = null;

function renderCombatLoadout(){
  const row = document.getElementById("loadoutRow");
  const pickerBox = document.getElementById("loadoutPicker");
  if (!row) return;
  row.innerHTML = "";
  state.player.combatSlots.forEach((itemId, idx) => {
    const chip = document.createElement("button");
    chip.className = "item-chip";
    if (idx === 3 && !state.player.healSlotUnlocked){
      chip.classList.add("slot-locked");
      chip.innerHTML = `🔒<span>20 реп.</span>`;
      chip.addEventListener("click", () => toast("Слот открывается на 20 репутации Echo Territory (см. Достижения)"));
    } else if (!itemId){
      chip.classList.add("slot-empty");
      chip.innerHTML = `➕<span>Пусто</span>`;
      chip.addEventListener("click", () => { loadoutPickerIndex = idx; renderCombatLoadout(); });
    } else {
      const item = findItem(itemId);
      const count = item ? item.count : 0;
      if (count <= 0) chip.classList.add("slot-out");
      chip.innerHTML = `${item ? iconHtml(item.icon) : "❔"}<span>${item ? item.name : itemId} x${count}</span>`;
      chip.addEventListener("click", () => { loadoutPickerIndex = idx; renderCombatLoadout(); });
    }
    row.appendChild(chip);
  });

  if (loadoutPickerIndex === null || (loadoutPickerIndex === 3 && !state.player.healSlotUnlocked)){
    pickerBox.innerHTML = "";
    return;
  }
  const idx = loadoutPickerIndex;
  const eligible = state.inventory.filter(isCombatSlotEligible);
  let html = `<div class="loadout-picker-list">`;
  if (state.player.combatSlots[idx]) html += `<button class="btn ghost small" id="loadoutClearBtn">Очистить слот</button>`;
  if (!eligible.length){
    html += `<p class="dim center-pad">Нет подходящих предметов. Купите аптечку/бинт в Медикаментах или сварите зелье у Фармацевта.</p>`;
  }
  eligible.forEach(it => {
    const desc = it.hotMin !== undefined ? `Восстановление ${it.hotMin}-${it.hotMax} HP за ход, 3 хода` : `+${INSTANT_HEAL_ITEMS[it.id]} HP мгновенно`;
    html += `<div class="picker-item" data-pick="${it.id}"><span class="pi-icon">${iconHtml(it.icon)}</span><div class="pi-info"><div class="pi-name">${it.name} x${it.count}</div><div class="pi-desc">${desc}</div></div><button class="btn ghost small">Выбрать</button></div>`;
  });
  html += `</div>`;
  pickerBox.innerHTML = html;
  const clearBtn = document.getElementById("loadoutClearBtn");
  if (clearBtn) clearBtn.addEventListener("click", () => { state.player.combatSlots[idx] = null; loadoutPickerIndex = null; renderCombatLoadout(); });
  pickerBox.querySelectorAll("[data-pick]").forEach(el => {
    el.addEventListener("click", () => {
      state.player.combatSlots[idx] = el.dataset.pick;
      loadoutPickerIndex = null;
      renderCombatLoadout();
    });
  });
}

function renderBattleSlots(){
  const row = document.getElementById("battleSlotsRow");
  if (!row) return;
  row.innerHTML = "";
  state.player.combatSlots.forEach((itemId, idx) => {
    const chip = document.createElement("button");
    chip.className = "item-chip";
    if (idx === 3 && !state.player.healSlotUnlocked){
      chip.classList.add("slot-locked");
      chip.innerHTML = `🔒<span>20 реп.</span>`;
    } else if (!itemId){
      chip.classList.add("slot-empty");
      chip.innerHTML = `➕<span>Пусто</span>`;
    } else {
      const item = findItem(itemId);
      const count = item ? item.count : 0;
      if (count <= 0) chip.classList.add("slot-out");
      chip.innerHTML = `${item ? iconHtml(item.icon) : "❔"}<span>${item ? item.name : "?"} x${count}</span>`;
    }
    chip.addEventListener("click", () => useCombatSlot(idx));
    row.appendChild(chip);
  });
}

function useCombatSlot(idx){
  if (battleOver) return;
  if (idx === 3 && !state.player.healSlotUnlocked){ toast("Слот открывается на 20 репутации Echo Territory (см. Достижения)"); return; }
  const itemId = state.player.combatSlots[idx];
  if (!itemId){ toast("Слот пуст — настройте боевой набор в Инвентаре"); return; }
  const item = findItem(itemId);
  if (!item || item.count <= 0){ toast("Закончилось — пополните в Инвентаре/Магазине"); return; }
  if (item.hotMin !== undefined){
    drinkPotionInBattle(item);
    return;
  }
  const heal = INSTANT_HEAL_ITEMS[item.id];
  if (heal === undefined) return;
  spendItem(item, 1);
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
  logLine(`Вы использовали ${item.name} (+${heal} HP)`, "heal");
  renderBattle(); renderHome();
}

const potionRecipes = [
  { id:"potionWeak", name:"Слабое зелье восстановления", icon:"🧪", masteryReq:0, seaweedNeed:5, hotMin:4, hotMax:15, learnPrice:300 },
  { id:"potionMedium", name:"Среднее зелье восстановления", icon:"🧪", masteryReq:20, seaweedNeed:10, hotMin:10, hotMax:24, learnPrice:600 },
  { id:"potionGood", name:"Хорошее зелье восстановления", icon:"🧪", masteryReq:40, seaweedNeed:15, hotMin:18, hotMax:36, learnPrice:1200 },
  { id:"potionBig", name:"Большое зелье восстановления", icon:"🧪", masteryReq:60, seaweedNeed:20, hotMin:28, hotMax:50, learnPrice:2000 },
  { id:"potionElite", name:"Элитное зелье восстановления", icon:"🧪", masteryReq:80, seaweedNeed:25, hotMin:40, hotMax:70, learnPrice:3500 },
];

/* ===== Оружейник: ценный лом и оружие с оглушением ===== */
const CUTTER_MAX_DURABILITY = 50;
const CUTTER_PRICE = 1200;
const COAL_PRICE = 40;
const GATHER_SCRAP_SECONDS = 10*60;
const GATHER_SCRAP_ENERGY_COST = 5;
const FORGE_SECONDS = 2*60;

const smithRecipes = [
  { id:"smithBat", name:"Утяжелённая бита", icon:"🏏", masteryReq:0, scrapNeed:5, dmgMin:16, dmgMax:22, stunChance:5, learnPrice:300 },
  { id:"smithKnuckle", name:"Цепной кастет", icon:"🥊", masteryReq:20, scrapNeed:10, dmgMin:26, dmgMax:35, stunChance:8, learnPrice:600 },
  { id:"smithCrowbar", name:"Боевой лом", icon:"🔧", masteryReq:40, scrapNeed:15, dmgMin:41, dmgMax:55, stunChance:12, learnPrice:1200 },
  { id:"smithClub", name:"Шипастая дубина", icon:"🏒", masteryReq:60, scrapNeed:20, dmgMin:65, dmgMax:89, stunChance:16, learnPrice:2000 },
  { id:"smithCleaver", name:"Мастер-тесак", icon:"🔪", masteryReq:80, scrapNeed:25, dmgMin:105, dmgMax:141, stunChance:20, learnPrice:3500 },
];

/* ===== Ювелир: драгоценные камни, браслеты и самоцветы ===== */
const SAW_MAX_DURABILITY = 50;
const SAW_PRICE = 1200;
const MOUNT_PRICE = 50;
const GATHER_GEM_SECONDS = 10*60;
const GATHER_GEM_ENERGY_COST = 5;
const SET_GEM_SECONDS = 2*60;

/* ===== Портной: редкая ткань и золотая экипировка ===== */
const SHEARS_MAX_DURABILITY = 50;
const SHEARS_PRICE = 1200;
const GOLD_THREAD_PRICE = 60;
const GATHER_FABRIC_SECONDS = 10*60;
const GATHER_FABRIC_ENERGY_COST = 5;
const SEW_SECONDS = 2*60;

const goldTierRecipes = [
  { id:"goldTier_t1", tierId:"t1", name:"Золотой тир: Дворовый", icon:"🥇", masteryReq:0, fabricNeed:5, learnPrice:300 },
  { id:"goldTier_t2", tierId:"t2", name:"Золотой тир: Уличный", icon:"🥇", masteryReq:20, fabricNeed:10, learnPrice:600 },
  { id:"goldTier_t3", tierId:"t3", name:"Золотой тир: Портовый", icon:"🥇", masteryReq:40, fabricNeed:15, learnPrice:1200 },
  { id:"goldTier_t4", tierId:"t4", name:"Золотой тир: Деловой", icon:"🥇", masteryReq:60, fabricNeed:20, learnPrice:2000 },
  { id:"goldTier_t5", tierId:"t5", name:"Золотой тир: Катакомбный", icon:"🥇", masteryReq:80, fabricNeed:25, learnPrice:3500 },
];

const jewelryRecipes = [
  { id:"braceletAgi", name:"Браслет ловкости", icon:"📿", masteryReq:0, gemsNeed:5, statBonus:{agi:2}, learnPrice:300 },
  { id:"braceletHp", name:"Браслет живучести", icon:"📿", masteryReq:20, gemsNeed:10, statBonus:{hpStat:2}, learnPrice:600 },
  { id:"braceletLuck", name:"Браслет удачи", icon:"📿", masteryReq:40, gemsNeed:15, statBonus:{luck:2}, learnPrice:1200 },
  { id:"gemCrit", name:"Самоцвет крита", icon:"💠", masteryReq:60, gemsNeed:20, critBonus:3, learnPrice:2000 },
  { id:"gemCritElite", name:"Элитный самоцвет крита", icon:"💠", masteryReq:80, gemsNeed:25, critBonus:6, learnPrice:3500 },
];

const craftRecipes = [
  { id:"armature", name:"Арматура", icon:"🔩", profession:"oruzejnik", reqLevel:1, desc:"Простая, но надёжная. Классика улиц.", time:30,
    reqs:[{id:"metal",need:5},{id:"bolts",need:2},{id:"wire",need:1}] },
  { id:"bat", name:"Бита", icon:"🏏", profession:"oruzejnik", reqLevel:2, desc:"Проверенный аргумент в любом споре.", time:45,
    reqs:[{id:"metal",need:3},{id:"cloth",need:2}] },
  { id:"knife", name:"Нож", icon:"🔪", profession:"oruzejnik", reqLevel:2, desc:"Быстрое и тихое решение проблем.", time:40,
    reqs:[{id:"metal",need:4},{id:"wire",need:1}] },
  { id:"knuckle", name:"Кастет", icon:"🥊", profession:"oruzejnik", reqLevel:5, desc:"Требуется уровень 5.", time:50,
    reqs:[{id:"metal",need:6},{id:"bolts",need:3}] },
  { id:"jacket", name:"Куртка", icon:"🧥", profession:"portnoy", reqLevel:3, desc:"Лёгкая защита корпуса, не сковывает движений.", time:60,
    reqs:[{id:"cloth",need:6},{id:"wire",need:2}] },
  { id:"vest", name:"Бронежилет", icon:"🦺", profession:"portnoy", reqLevel:4, desc:"Серьёзная защита груди и живота.", time:120,
    reqs:[{id:"metal",need:8},{id:"cloth",need:4},{id:"bolts",need:4}] },
  { id:"hat", name:"Шапка-ушанка", icon:"🧢", profession:"portnoy", reqLevel:6, desc:"Требуется уровень 6.", time:35,
    reqs:[{id:"cloth",need:5},{id:"wire",need:1}] },
  { id:"luckyCharm", name:"Кулон удачи", icon:"🔮", profession:"juvelir", reqLevel:4, desc:"Мелкая работа, но говорят — приносит везение.", time:50,
    reqs:[{id:"wire",need:3},{id:"bolts",need:1}] },
  { id:"braceletStr", name:"Браслет силы", icon:"📿", profession:"juvelir", reqLevel:3, desc:"Тяжёлый браслет, добавляет уверенности в ударе.", time:45,
    reqs:[{id:"metal",need:2},{id:"wire",need:2}] },
];
let selectedCraftId = null;
let selectedProfessionId = null;

/* ===== Shop ===== */
const medItems = [
  { id:"bandage", name:"Террадол", icon:"🩸", cat:"consumable", desc:"Дешёвая химера-таблетка. Восстанавливает 15 HP", price:300 },
  { id:"medkit", name:"Виттатеррон", icon:"🩹", cat:"consumable", desc:"Аптечный новояз, но действует. Восстанавливает 50 HP", price:900 },
  { id:"energy", name:"Энергетик", icon:"🥫", cat:"consumable", desc:"Восстанавливает 30 HP (4-й слот в бою)", price:600 },
];

/* ===== Gear tiers & rarity ===== */
const gearTiers = [
  { id:"t1", name:"Дворовый", minLevel:1, base:{jacket:6, shirt:4, hat:3, pants:5, boots:4, weaponAvg:19}, weaponName:"Кирпич", weaponIcon:"🧱", shopPrice:2800, assetPath:"assets/t1", raritySlots:["jacket","shirt","hat","pants","boots","weapon"] },
  { id:"t2", name:"Уличный", minLevel:6, base:{jacket:10, shirt:7, hat:5, pants:8, boots:7, weaponAvg:30}, weaponName:"Труба", weaponIcon:"🔧", shopPrice:6500 },
  { id:"t3", name:"Портовый", minLevel:11, base:{jacket:16, shirt:11, hat:8, pants:13, boots:11, weaponAvg:48}, weaponName:"Топор", weaponIcon:"🪓", shopPrice:15000 },
  { id:"t4", name:"Деловой", minLevel:16, base:{jacket:26, shirt:18, hat:13, pants:21, boots:18, weaponAvg:77}, weaponName:"Мачете", weaponIcon:"🔪", shopPrice:34000 },
  { id:"t5", name:"Катакомбный", minLevel:21, base:{jacket:42, shirt:29, hat:21, pants:34, boots:29, weaponAvg:123}, weaponName:"Обрез арматуры", weaponIcon:"🔩", shopPrice:78000 },
];
const rarities = {
  grey: { label:"Серый", mult:0.75, obtainable:"drop" },
  blue: { label:"Синий", mult:1.0, obtainable:"shop" },
  gold: { label:"Золотой", mult:1.5, obtainable:"craft" },
};
const slotMeta = {
  jacket:{icon:"🧥", zone:"chest", label:"куртка"},
  shirt:{icon:"👕", zone:"belly", label:"майка"},
  hat:{icon:"🧢", zone:"head", label:"шапка"},
  pants:{icon:"👖", zone:"legs", label:"штаны"},
  boots:{icon:"🥾", zone:"legs", label:"обувь"},
};

function buildGearCatalog(){
  const catalog = [];
  gearTiers.forEach(tier => {
    Object.keys(rarities).forEach(rarId => {
      const rar = rarities[rarId];
      Object.keys(slotMeta).forEach(slot => {
        const meta = slotMeta[slot];
        const def = Math.round(tier.base[slot] * rar.mult);
        let icon = meta.icon;
        if (tier.assetPath){
          icon = (tier.raritySlots && tier.raritySlots.includes(slot))
            ? `${tier.assetPath}/${slot}_${rarId}.png`
            : `${tier.assetPath}/${slot}.gif`;
        }
        catalog.push({
          id:`${tier.id}_${slot}_${rarId}`, name:`${tier.name} ${meta.label}`, icon,
          cat:"armor", equipSlot:slot, zone:meta.zone, def, rarity:rarId, tierId:tier.id,
        });
      });
      const dmgAvg = Math.round(tier.base.weaponAvg * rar.mult);
      let weaponIcon = tier.weaponIcon;
      if (tier.assetPath){
        weaponIcon = (tier.raritySlots && tier.raritySlots.includes("weapon"))
          ? `${tier.assetPath}/weapon_${rarId}.png`
          : `${tier.assetPath}/weapon.gif`;
      }
      catalog.push({
        id:`${tier.id}_weapon_${rarId}`, name:`${tier.name} ${tier.weaponName}`, icon:weaponIcon,
        cat:"weapon", equipSlot:"weapon", dmgMin:Math.round(dmgAvg*0.85), dmgMax:Math.round(dmgAvg*1.15),
        rarity:rarId, tierId:tier.id,
      });
    });
  });
  return catalog;
}
const gearCatalog = buildGearCatalog();
function catalogItem(id){ return gearCatalog.find(i => i.id === id); }
function iconHtml(icon){
  return icon.includes("/") ? `<img class="icon-img" src="${icon}" alt="">` : icon;
}
function gearTierForLevel(level){
  const idx = Math.min(4, Math.floor((level-1)/5));
  return gearTiers[idx];
}
function addOrStackItem(catalogEntry, qty){
  const existing = findItem(catalogEntry.id);
  if (existing) existing.count += qty;
  else state.inventory.push({ ...catalogEntry, count: qty });
}
function maybeDropGear(npcLevel){
  if (Math.random() > 0.3) return; // 30% шанс дропа
  const tier = gearTierForLevel(npcLevel);
  const slots = [...Object.keys(slotMeta), "weapon"];
  const slot = slots[Math.floor(Math.random()*slots.length)];
  const item = catalogItem(`${tier.id}_${slot}_grey`);
  addOrStackItem(item, 1);
  logLine(`Выпало: ${item.name} (серый)`, "heal");
}

/* ===== Аукцион ===== */
const AUCTION_SELL_SECONDS = 90; // демо: в реальной игре — часы/дни, здесь сжато для показа механики
const AUCTION_COMMISSION = 0.08; // комиссия аукциона — уходит из экономики совсем, сдерживает инфляцию терр
const auctionSeed = [
  { seller:"Саня_Бродяга", itemId:"t1_weapon_blue", price:1400 },
  { seller:"Люся_Ночная", itemId:"t2_jacket_grey", price:2600 },
  { seller:"Кот", itemId:"t1_boots_gold", price:3200 },
  { seller:"Дым", itemId:"t2_hat_blue", price:1800 },
  { seller:"Юля", itemId:"t3_pants_blue", price:9500 },
  { seller:"Тень", itemId:"t1_shirt_gold", price:1100 },
];
state.market = {
  listings: auctionSeed.map((s, i) => ({ listingId:"m"+i, seller:s.seller, item: catalogItem(s.itemId), price:s.price })),
  myListings: [],
};
let auctionView = "market";
let auctionSellItemId = null;
let auctionTimerHandle = null;

function renderAuction(){
  const root = document.getElementById("auctionRoot");
  if (!root) return;
  root.innerHTML = `
    <div class="tabs" data-group="auctionTab">
      <button class="tab ${auctionView==="market"?"active":""}" data-tab="market">Рынок</button>
      <button class="tab ${auctionView==="mine"?"active":""}" data-tab="mine">Мои лоты</button>
    </div>
    <div id="auctionBody"></div>
  `;
  document.querySelectorAll('.tabs[data-group="auctionTab"] .tab').forEach(t => {
    t.addEventListener("click", () => { auctionView = t.dataset.tab; renderAuction(); });
  });
  if (auctionView === "market") renderAuctionMarket(); else renderAuctionMine();
  if (!auctionTimerHandle && state.market.myListings.length) startAuctionTimer();
}

function renderAuctionMarket(){
  const body = document.getElementById("auctionBody");
  if (!body) return;
  if (!state.market.listings.length){
    body.innerHTML = `<p class="dim center-pad">Рынок пуст.</p>`;
    return;
  }
  body.innerHTML = `<div class="shop-list" id="auctionMarketList"></div>`;
  const list = document.getElementById("auctionMarketList");
  state.market.listings.forEach(l => {
    const el = document.createElement("div");
    el.className = "shop-item";
    el.innerHTML = `
      <span class="si-icon">${iconHtml(l.item.icon)}</span>
      <div class="si-info">
        <div class="si-name">${l.item.rarity?`<span class="rarity-dot rarity-${l.item.rarity}"></span>`:""}${l.item.name}</div>
        <div class="si-desc">от ${l.seller}</div>
      </div>
      <span class="si-price">${l.price.toLocaleString("ru-RU")} Т</span>
    `;
    el.addEventListener("click", () => buyListing(l));
    list.appendChild(el);
  });
}

function buyListing(l){
  if (state.player.rub < l.price){ toast("Недостаточно Т"); return; }
  state.player.rub -= l.price;
  addOrStackItem(l.item, 1);
  state.market.listings = state.market.listings.filter(x => x.listingId !== l.listingId);
  toast(`Куплено: ${l.item.name}`);
  renderAuction(); renderHome(); renderInventory("all");
}

function renderAuctionMine(){
  const body = document.getElementById("auctionBody");
  if (!body) return;
  let html = "";
  if (state.market.myListings.length){
    html += `<div class="shop-list" id="auctionMineList" style="margin-bottom:14px;"></div>`;
  } else {
    html += `<p class="dim">Вы пока ничего не выставили.</p>`;
  }
  html += `<div class="card">
    <div class="card-title">Выставить предмет</div>
    <div id="auctionSellPicker"></div>
  </div>`;
  body.innerHTML = html;

  if (state.market.myListings.length){
    const list = document.getElementById("auctionMineList");
    state.market.myListings.forEach(l => {
      const el = document.createElement("div");
      el.className = "shop-item";
      const m = Math.floor(l.secondsLeft/60), s = l.secondsLeft%60;
      el.innerHTML = `
        <span class="si-icon">${iconHtml(l.item.icon)}</span>
        <div class="si-info">
          <div class="si-name">${l.item.name}</div>
          <div class="si-desc">${l.price.toLocaleString("ru-RU")} Т · продастся через ${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}</div>
        </div>
        <button class="btn ghost small" data-cancel="${l.listingId}">Снять</button>
      `;
      el.querySelector("[data-cancel]").addEventListener("click", (e) => { e.stopPropagation(); cancelListing(l.listingId); });
      list.appendChild(el);
    });
  }

  const picker = document.getElementById("auctionSellPicker");
  const sellable = state.inventory.filter(i => i.count > 0 && i.cat !== "material");
  if (auctionSellItemId){
    const item = findItem(auctionSellItemId);
    if (!item){ auctionSellItemId = null; renderAuctionMine(); return; }
    const refValue = estimateItemValue(item);
    picker.innerHTML = `
      <p class="dim" style="margin:0 0 4px;">${iconHtml(item.icon)} ${item.name} (у вас: ${item.count})</p>
      <p class="dim" style="margin:0 0 8px;font-size:11.5px;">Ориентир рынка: ~${refValue.toLocaleString("ru-RU")} Т. Чем выше цена относительно ориентира — тем ниже шанс, что лот купят до истечения срока. Аукцион берёт комиссию ${Math.round(AUCTION_COMMISSION*100)}% с продажи.</p>
      <div class="row-between" style="gap:8px;margin-bottom:8px;">
        <input type="number" id="auctionPriceInput" placeholder="Цена в Т" min="1" value="${refValue}" style="flex:1;background:var(--card);border:1px solid var(--card-border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:14px;">
      </div>
      <p class="dim" style="margin:0 0 8px;font-size:11.5px;" id="auctionChanceHint"></p>
      <div class="row-between" style="gap:8px;">
        <button class="btn ghost" id="auctionCancelPick">Отмена</button>
        <button class="btn primary" id="auctionConfirmSell">Выставить</button>
      </div>
    `;
    const priceInput = document.getElementById("auctionPriceInput");
    const hint = document.getElementById("auctionChanceHint");
    const updateHint = () => {
      const price = parseInt(priceInput.value, 10) || 0;
      const chance = Math.round(auctionSellChance(price, refValue) * 100);
      const payout = Math.round(price * (1 - AUCTION_COMMISSION));
      hint.textContent = price > 0 ? `Шанс продажи: ~${chance}% · на руки после комиссии: ${payout.toLocaleString("ru-RU")} Т` : "";
    };
    updateHint();
    priceInput.addEventListener("input", updateHint);
    document.getElementById("auctionCancelPick").addEventListener("click", () => { auctionSellItemId = null; renderAuctionMine(); });
    document.getElementById("auctionConfirmSell").addEventListener("click", () => {
      const price = parseInt(priceInput.value, 10);
      if (!price || price <= 0){ toast("Укажите цену"); return; }
      listItemForSale(item, price);
    });
  } else if (!sellable.length){
    picker.innerHTML = `<p class="dim center-pad">Нечего выставить.</p>`;
  } else {
    picker.innerHTML = `<div class="clan-list" id="auctionPickList"></div>`;
    const list = document.getElementById("auctionPickList");
    sellable.forEach(it => {
      const el = document.createElement("div");
      el.className = "picker-item";
      el.innerHTML = `<span class="pi-icon">${iconHtml(it.icon)}</span><div class="pi-info"><div class="pi-name">${it.name}</div><div class="pi-desc">Количество: ${it.count}</div></div><button class="btn ghost small">Выбрать</button>`;
      el.addEventListener("click", () => { auctionSellItemId = it.id; renderAuctionMine(); });
      list.appendChild(el);
    });
  }
}

function estimateItemValue(item){
  if (item.tierId){
    const tier = gearTiers.find(t => t.id === item.tierId);
    const base = item.equipSlot === "weapon" ? tier.shopPrice : Math.round(tier.shopPrice * 0.35);
    const mult = rarities[item.rarity] ? rarities[item.rarity].mult : 1;
    return Math.round(base * mult);
  }
  if (item.hotMin !== undefined) return 350;
  if (item.id === "medkit") return 900;
  if (item.id === "bandage") return 300;
  if (item.id === "energy") return 450;
  if (item.buffPercent) return 400;
  if (item.statBonus) return 800;
  return 200;
}
function auctionSellChance(price, refValue){
  const ratio = price / refValue;
  if (ratio <= 1) return 0.95;
  if (ratio <= 1.5) return 0.75;
  if (ratio <= 2) return 0.45;
  if (ratio <= 3) return 0.2;
  return 0.05;
}

function listItemForSale(item, price){
  item.count--;
  if (item.count <= 0){
    state.inventory = state.inventory.filter(x => x !== item);
    Object.keys(state.player.equipment).forEach(slot => {
      if (state.player.equipment[slot] === item.id) state.player.equipment[slot] = null;
    });
  }
  const refValue = estimateItemValue(item);
  const willSell = Math.random() < auctionSellChance(price, refValue);
  state.market.myListings.push({ listingId:"my"+Date.now()+Math.random(), item:{ ...item, count:1 }, price, listedAt: Date.now(), secondsLeft: AUCTION_SELL_SECONDS, willSell });
  auctionSellItemId = null;
  toast(`Выставлено: ${item.name} за ${price.toLocaleString("ru-RU")} Т`);
  renderAuctionMine();
  renderInventory("all");
  startAuctionTimer();
}

function cancelListing(listingId){
  const l = state.market.myListings.find(x => x.listingId === listingId);
  if (!l) return;
  state.market.myListings = state.market.myListings.filter(x => x.listingId !== listingId);
  addOrStackItem(l.item, 1);
  toast(`Лот снят, предмет возвращён в инвентарь`);
  renderAuctionMine();
  renderInventory("all");
}

function startAuctionTimer(){
  if (auctionTimerHandle) return;
  auctionTimerHandle = setInterval(() => {
    if (!state.market.myListings.length){ clearInterval(auctionTimerHandle); auctionTimerHandle = null; return; }
    // Считаем остаток от реального времени размещения лота (listedAt), а не декрементом —
    // иначе, как и с другими таймерами в игре, отсчёт просто замирает, пока приложение
    // закрыто, и лот "продаётся" куда дольше заявленных 90 секунд.
    state.market.myListings.forEach(l => {
      l.secondsLeft = Math.max(0, AUCTION_SELL_SECONDS - Math.floor((Date.now() - (l.listedAt || Date.now())) / 1000));
    });
    const finished = state.market.myListings.filter(l => l.secondsLeft <= 0);
    state.market.myListings = state.market.myListings.filter(l => l.secondsLeft > 0);
    finished.forEach(l => {
      if (l.willSell){
        const payout = Math.round(l.price * (1 - AUCTION_COMMISSION));
        state.player.rub += payout;
        toast(`Продано: ${l.item.name} за ${l.price.toLocaleString("ru-RU")} Т − комиссия ${Math.round(AUCTION_COMMISSION*100)}% = ${payout.toLocaleString("ru-RU")} Т на руки`);
      } else {
        addOrStackItem(l.item, 1);
        toast(`«${l.item.name}» не нашёл покупателя по цене ${l.price.toLocaleString("ru-RU")} Т — вернули в инвентарь`);
        renderInventory(currentInvFilter);
      }
    });
    if (finished.length){ renderHome(); }
    const auctionScreen = document.querySelector('.screen[data-screen="auction"]');
    if (auctionScreen && auctionScreen.classList.contains("active") && auctionView === "mine") renderAuctionMine();
  }, 1000);
}

/* ===== Chat ===== */
const chatSeed = [
  { name:"Гопник", time:"12:45", text:"Кто в Новом городе? Движ будет через 5 минут." },
  { name:"Саня_Бродяга", time:"12:46", text:"Продам арматуру, недорого." },
  { name:"Тень", time:"12:47", text:"Ищу напарника на Промзону, опыт есть." },
  { name:"Admin", time:"12:48", text:"Уважайте друг друга и соблюдайте правила.", admin:true },
];

const districtOnlineUsers = [
  { name:"Гопник", online:true },
  { name:"Admin", online:true, admin:true },
  { name:"Кекс", online:true },
  { name:"Барон", online:true },
  { name:"Тень", online:true },
  { name:"Дым", online:true },
  { name:"Юля", online:true },
  { name:"Саня_Бродяга", online:false, lastSeen:"20 мин назад" },
  { name:"Люся_Ночная", online:false, lastSeen:"2 ч назад" },
  { name:"Кот", online:false, lastSeen:"5 мин назад" },
];

/* ===== Clan ===== */
const CLAN_CREATE_COST = 50000;
const CLAN_CREATE_MIN_LEVEL = 10;

const emblemPresets = [
  { icon:"🐺", color:"#2a2a30", flagColor:"#9a9aa4" }, { icon:"💀", color:"#2a2a30", flagColor:"#d8d8dc" }, { icon:"🐍", color:"#1e2a1e", flagColor:"#4fd66a" },
  { icon:"🦅", color:"#1e2430", flagColor:"#5b9bd6" }, { icon:"⚔️", color:"#301e1e", flagColor:"#e05a5a" }, { icon:"🛡️", color:"#1e2530", flagColor:"#5b9bd6" },
  { icon:"👑", color:"#302818", flagColor:"#d6b24f" }, { icon:"🔥", color:"#301c14", flagColor:"#e0813f" }, { icon:"⭐", color:"#302a14", flagColor:"#d6b24f" },
  { icon:"🩸", color:"#2e1414", flagColor:"#e05a5a" }, { icon:"🕷️", color:"#241e30", flagColor:"#a56fe0" }, { icon:"🐉", color:"#1c2818", flagColor:"#4fd66a" },
  { icon:"🦂", color:"#2a1e14", flagColor:"#e0813f" }, { icon:"🔱", color:"#14262e", flagColor:"#4fc3d6" }, { icon:"🎯", color:"#241e1e", flagColor:"#e05a5a" },
];

let clans = [
  { id:"wolves", name:"Волчья Стая", tag:"WOLF", icon:"🐺", color:"#2a2a30", flagColor:"#9a9aa4", level:6, members:[
    { name:"Барон", role:"leader", online:true, level:14, avatar:"🧔", stats:{str:18,agi:14,hpStat:20,luck:9}, weapon:{name:"Арматура",dmgMin:20,dmgMax:28} },
    { name:"Кекс", role:"officer", online:true, level:9, avatar:"🧑", stats:{str:12,agi:16,hpStat:11,luck:13}, weapon:{name:"Нож",dmgMin:10,dmgMax:15} },
    { name:"Люся_Ночная", role:"member", online:false, lastSeen:"2 ч назад", level:7, avatar:"👩", stats:{str:9,agi:15,hpStat:10,luck:11}, weapon:{name:"Кастет",dmgMin:8,dmgMax:12} },
  ], territories:["Промышленный"], openJoin:true, treasury:1450, taxClaimedToday:false },
  { id:"crows", name:"Чёрные Вороны", tag:"CROW", icon:"🦅", color:"#1e2430", flagColor:"#5b9bd6", level:4, members:[
    { name:"Грач", role:"leader", online:false, lastSeen:"вчера", level:11, avatar:"🧑‍🦱", stats:{str:15,agi:11,hpStat:15,luck:8}, weapon:{name:"Бита",dmgMin:16,dmgMax:22} },
    { name:"Тень", role:"member", online:true, level:6, avatar:"🧑", stats:{str:10,agi:13,hpStat:9,luck:10}, weapon:{name:"Нож",dmgMin:10,dmgMax:15} },
  ], territories:[], openJoin:false, treasury:0, taxClaimedToday:false },
  { id:"vipers", name:"Гадюшник", tag:"VPR", icon:"🐍", color:"#1e2a1e", flagColor:"#4fd66a", level:8, members:[
    { name:"Змей", role:"leader", online:true, level:16, avatar:"🧔", stats:{str:19,agi:17,hpStat:18,luck:12}, weapon:{name:"Арматура",dmgMin:20,dmgMax:28} },
    { name:"Юля", role:"officer", online:true, level:10, avatar:"👩", stats:{str:11,agi:18,hpStat:12,luck:14}, weapon:{name:"Нож",dmgMin:10,dmgMax:15} },
    { name:"Кот", role:"member", online:false, lastSeen:"5 мин назад", level:8, avatar:"🧑", stats:{str:13,agi:12,hpStat:11,luck:9}, weapon:{name:"Кастет",dmgMin:8,dmgMax:12} },
    { name:"Дым", role:"member", online:true, level:5, avatar:"🧑", stats:{str:8,agi:10,hpStat:9,luck:7}, weapon:{name:"Бита",dmgMin:16,dmgMax:22} },
  ], territories:["Старый город","Подветренная Роща"], openJoin:true, treasury:3120, taxClaimedToday:false },
];

const clanChats = {
  wolves: [
    { name:"Барон", role:"leader", time:"11:02", text:"Сегодня вечером держим Промзону, всем быть на месте." },
    { name:"Кекс", role:"officer", time:"11:05", text:"Принял, буду." },
  ],
  crows: [
    { name:"Грач", role:"leader", time:"09:40", text:"Кто может закрыть смену в Новом городе?" },
  ],
  vipers: [
    { name:"Змей", role:"leader", time:"14:12", text:"Затягиваем Лес крепче, не пускаем чужих." },
    { name:"Юля", role:"officer", time:"14:15", text:"Есть." },
    { name:"Дым", role:"member", time:"14:20", text:"Могу выйти на охрану через час." },
  ],
};

function ownerOfDistrict(districtName){
  return clans.find(c => c.territories.includes(districtName)) || null;
}

function clanDailyTax(c){
  return c.territories.reduce((sum, name) => {
    const d = districts.find(x => x.name === name);
    return sum + (d ? d.taxValue : 0);
  }, 0);
}

function myClan(){ return clans.find(c => c.id === state.player.clanId) || null; }

function renderName(){
  if (typeof realClan !== "undefined" && realClan) return `${realClan.icon} <span class="clan-tag">[${realClan.tag}]</span> ${state.player.name}`;
  const c = myClan();
  if (!c) return state.player.name;
  return `${c.icon} <span class="clan-tag">[${c.tag}]</span> ${state.player.name}`;
}

let clanView = "list";
let clanWizard = { step:1, name:"", tag:"", iconIdx:0, joinType:"open" };

function goClanView(view){ clanView = view; renderClan(); }

function renderClan(){
  const root = document.getElementById("clanRoot");
  const c = myClan();
  if (c){ renderClanDetail(root, c); return; }
  if (clanView === "create"){ renderClanWizard(root); return; }
  renderClanList(root);
}

function renderClanList(root){
  root.innerHTML = `
    <div class="card no-clan-card">
      <div class="nc-icon">🛡️</div>
      <div><b>Вы не состоите в клане</b></div>
      <p class="dim">Вступите в существующий клан или создайте свой — тег и эмблема сразу появятся рядом с вашим ником.</p>
      <button class="btn primary full" id="createClanBtn">СОЗДАТЬ КЛАН (−${CLAN_CREATE_COST.toLocaleString("ru-RU")} Т)</button>
    </div>
    <div class="clan-list" id="clanListBox"></div>
  `;
  const box = document.getElementById("clanListBox");
  clans.forEach(cl => {
    const el = document.createElement("div");
    el.className = "clan-row";
    el.innerHTML = `
      <div class="clan-emblem" style="background:${cl.color}">${cl.icon}</div>
      <div class="clan-row-info">
        <div class="clan-row-name"><span class="clan-tag">[${cl.tag}]</span> ${cl.name}</div>
        <div class="clan-row-sub">Ур. ${cl.level} · ${cl.members.length} участников · <span class="${cl.openJoin?"clan-badge-open":"clan-badge-closed"}">${cl.openJoin?"Открытый":"По заявке"}</span></div>
      </div>
      <button class="btn ghost small joinClanBtn" data-id="${cl.id}">${cl.openJoin?"Вступить":"Заявка"}</button>
    `;
    box.appendChild(el);
  });
  document.getElementById("createClanBtn").addEventListener("click", () => {
    if (state.player.level < CLAN_CREATE_MIN_LEVEL){ toast(`Создание клана доступно с уровня ${CLAN_CREATE_MIN_LEVEL}`); return; }
    if (state.player.rub < CLAN_CREATE_COST){ toast("Недостаточно Т для создания клана"); return; }
    clanWizard = { step:1, name:"", tag:"", iconIdx:0, joinType:"open" };
    goClanView("create");
  });
  document.querySelectorAll(".joinClanBtn").forEach(b => {
    b.addEventListener("click", () => {
      const cl = clans.find(x => x.id === b.dataset.id);
      if (cl.openJoin){
        cl.members.push({ name: state.player.name, role:"member" });
        state.player.clanId = cl.id;
        toast(`Вы вступили в клан «${cl.name}»`);
        renderClan(); renderHome();
      } else {
        toast(`Заявка отправлена лидеру клана «${cl.name}»`);
      }
    });
  });
}

function renderClanWizard(root){
  const w = clanWizard;
  let body = "";
  if (w.step === 1){
    body = `
      <div class="wizard-field">
        <label>Название клана</label>
        <input type="text" id="wizName" maxlength="24" placeholder="Например: Стальные Псы" value="${w.name}">
      </div>`;
  } else if (w.step === 2){
    body = `
      <div class="wizard-field">
        <label>Тег клана (3-5 символов, будет отображаться перед ником)</label>
        <input type="text" id="wizTag" maxlength="5" placeholder="Например: WOLF" value="${w.tag}" style="text-transform:uppercase">
      </div>`;
  } else if (w.step === 3){
    body = `
      <div class="wizard-field"><label>Выберите эмблему</label></div>
      <div class="icon-grid" id="iconGrid"></div>`;
  } else if (w.step === 4){
    body = `
      <div class="wizard-field"><label>Тип вступления</label></div>
      <div class="join-type-row">
        <div class="join-type-opt ${w.joinType==="open"?"selected":""}" data-jt="open"><b>Открытый</b><div class="dim">вступление мгновенно</div></div>
        <div class="join-type-opt ${w.joinType==="closed"?"selected":""}" data-jt="closed"><b>По заявке</b><div class="dim">одобряет лидер</div></div>
      </div>
      <div class="card" style="margin-top:10px;">
        <div class="clan-detail-header">
          <div class="clan-emblem" style="background:${emblemPresets[w.iconIdx].color}">${emblemPresets[w.iconIdx].icon}</div>
          <div>
            <div class="clan-row-name"><span class="clan-tag">[${w.tag||"TAG"}]</span> ${w.name||"Название клана"}</div>
            <div class="dim">Предпросмотр</div>
          </div>
        </div>
      </div>`;
  }

  root.innerHTML = `
    <div class="card">
      <div class="wizard-steps">
        ${[1,2,3,4].map(n => `<span class="wizard-dot ${n===w.step?"active":""}"></span>`).join("")}
      </div>
      <div style="margin-top:14px;">${body}</div>
      <div class="wizard-nav" style="margin-top:16px;">
        <button class="btn ghost" id="wizBack">${w.step===1?"Отмена":"Назад"}</button>
        <button class="btn primary" id="wizNext">${w.step===4?"СОЗДАТЬ":"Далее"}</button>
      </div>
    </div>
  `;

  if (w.step === 3){
    const grid = document.getElementById("iconGrid");
    emblemPresets.forEach((p,i) => {
      const sw = document.createElement("div");
      sw.className = "icon-swatch" + (i===w.iconIdx?" selected":"");
      sw.style.background = p.color;
      sw.textContent = p.icon;
      sw.addEventListener("click", () => { w.iconIdx = i; renderClanWizard(root); });
      grid.appendChild(sw);
    });
  }
  if (w.step === 4){
    document.querySelectorAll(".join-type-opt").forEach(o => {
      o.addEventListener("click", () => { w.joinType = o.dataset.jt; renderClanWizard(root); });
    });
  }

  document.getElementById("wizBack").addEventListener("click", () => {
    if (w.step === 1){ goClanView("list"); return; }
    w.step--; renderClanWizard(root);
  });
  document.getElementById("wizNext").addEventListener("click", () => {
    if (w.step === 1){
      const val = document.getElementById("wizName").value.trim();
      if (val.length < 3){ toast("Название должно быть не короче 3 символов"); return; }
      w.name = val;
    }
    if (w.step === 2){
      const val = document.getElementById("wizTag").value.trim().toUpperCase();
      if (val.length < 3){ toast("Тег должен быть не короче 3 символов"); return; }
      w.tag = val;
    }
    if (w.step === 4){
      createClan();
      return;
    }
    w.step++; renderClanWizard(root);
  });
}

function createClan(){
  const w = clanWizard;
  const preset = emblemPresets[w.iconIdx];
  const id = "clan_" + Date.now();
  const newClan = {
    id, name:w.name, tag:w.tag, icon:preset.icon, color:preset.color, flagColor:preset.flagColor, level:1,
    members:[{ name: state.player.name, role:"leader" }],
    territories:[], openJoin: w.joinType === "open",
  };
  clans.push(newClan);
  state.player.clanId = id;
  state.player.rub -= CLAN_CREATE_COST;
  toast(`Клан «${newClan.name}» создан!`);
  renderHome();
  renderClan();
}

function renderClanDetail(root, c){
  const isLeader = c.members.find(m => m.name === state.player.name)?.role === "leader";
  const onlineCount = c.members.filter(m => m.online).length;
  root.innerHTML = `
    <div class="card">
      <div class="clan-detail-header">
        <div class="clan-emblem" style="background:${c.color}">${c.icon}</div>
        <div>
          <div class="clan-row-name" style="font-size:16px;"><span class="clan-tag">[${c.tag}]</span> ${c.name}</div>
          <div class="dim">Уровень ${c.level} · ${onlineCount} / ${c.members.length} онлайн · ${c.territories.length ? "Территории: "+c.territories.join(", ") : "Без территорий"}</div>
        </div>
      </div>
    </div>
    ${(activeWar && activeWar.status!=="resolved" && (activeWar.attackerClanId===c.id || activeWar.defenderClanId===c.id)) ? `
    <div class="war-banner" id="warBannerBtn">
      <span style="font-size:22px;">⚔️</span>
      <div><b>Идёт война за «${activeWar.districtName}»!</b><div class="dim">${activeWar.attackerClanId===c.id?"Ваш клан атакует":"Ваш клан защищается"} — нажмите, чтобы собрать отряд</div></div>
    </div>` : ""}
    <div class="card">
      <div class="card-title">💰 Казна клана</div>
      <div class="ach-row"><span>Баланс казны</span><b style="color:var(--gold);">${c.treasury.toLocaleString("ru-RU")} Т</b></div>
      ${c.territories.length ? `
        <div style="margin-top:8px;">
          ${c.territories.map(name => {
            const d = districts.find(x => x.name === name);
            return `<div class="street-row" style="display:flex;justify-content:space-between;padding:6px 0;font-size:12.5px;"><span>${name}</span><span style="color:var(--gold);">+${(d?d.taxValue:0).toLocaleString("ru-RU")} Т/сутки</span></div>`;
          }).join("")}
        </div>
        <button class="btn primary full" id="collectTaxBtn" style="margin-top:8px;" ${c.taxClaimedToday?"disabled":""}>
          ${c.taxClaimedToday ? "Налог за сегодня уже собран" : `СОБРАТЬ НАЛОГ (+${clanDailyTax(c).toLocaleString("ru-RU")} Т)`}
        </button>
      ` : `<div class="dim" style="margin-top:6px;">Клан не держит территорий — налог не начисляется. Объявите войну за район на карте.</div>`}
    </div>
    <button class="clanchat-btn" id="openClanChatBtn">💬 <b>Чат клана</b><span class="dim" style="margin-left:auto;">только для участников</span></button>
    <div class="card">
      <div class="card-title">Участники</div>
      <div class="clan-list" id="memberList"></div>
    </div>
    <button class="btn ghost full" id="leaveClanBtn">${isLeader ? "РАСПУСТИТЬ КЛАН" : "ПОКИНУТЬ КЛАН"}</button>
  `;
  const warBanner = document.getElementById("warBannerBtn");
  if (warBanner) warBanner.addEventListener("click", () => showScreen("territorywar"));
  const collectTaxBtn = document.getElementById("collectTaxBtn");
  if (collectTaxBtn && !c.taxClaimedToday){
    collectTaxBtn.addEventListener("click", () => {
      const amount = clanDailyTax(c);
      c.treasury += amount;
      c.taxClaimedToday = true;
      toast(`Казна клана пополнена на ${amount.toLocaleString("ru-RU")} Т`);
      renderClanDetail(root, c);
      updateClanTaxBanner();
    });
  }
  const box = document.getElementById("memberList");
  c.members.forEach(m => {
    const isMe = m.name === state.player.name;
    const el = document.createElement("div");
    el.className = "member-row";
    const roleLabel = m.role === "leader" ? "Лидер" : m.role === "officer" ? "Офицер" : "Участник";
    const statusText = isMe ? "в сети" : (m.online ? "в сети" : `был(а) ${m.lastSeen || "недавно"}`);
    el.innerHTML = `
      <span class="status-dot ${(isMe || m.online) ? "online" : "offline"}"></span>
      <div class="member-main">
        <span>${isMe ? renderName() : m.name}</span>
        <span class="member-sub">${isMe ? "" : "Ур. "+m.level+" · "+statusText}</span>
      </div>
      <span class="member-role ${m.role==="leader"?"leader":""}">${roleLabel}</span>
    `;
    el.addEventListener("click", () => {
      if (isMe){ showScreen("character"); return; }
      openPlayerProfile(m, c);
    });
    box.appendChild(el);
  });
  document.getElementById("openClanChatBtn").addEventListener("click", () => openClanChat(c));
  document.getElementById("leaveClanBtn").addEventListener("click", () => {
    if (isLeader && c.members.length > 1){ toast("Сначала передайте лидерство или выведите всех участников"); return; }
    clans = clans.filter(x => x.id !== c.id || !isLeader);
    if (!isLeader) c.members = c.members.filter(m => m.name !== state.player.name);
    state.player.clanId = null;
    clanView = "list";
    toast(isLeader ? `Клан «${c.name}» распущен` : `Вы покинули клан «${c.name}»`);
    renderHome();
    renderClan();
  });
}

/* ===== Player profile (view teammate) ===== */
function openPlayerProfile(member, clan){
  screenStack.push("playerProfile");
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelector('.screen[data-screen="playerProfile"]').classList.add("active");
  document.getElementById("screenTitle").textContent = "Профиль игрока";
  document.getElementById("backBtn").classList.remove("hidden");
  document.getElementById("menuBtn").classList.add("hidden");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  const root = document.getElementById("playerProfileRoot");
  const roleLabel = member.role === "leader" ? "Лидер" : member.role === "officer" ? "Офицер" : "Участник";
  const statusText = member.online ? "в сети" : `был(а) ${member.lastSeen || "недавно"}`;
  const atk = Math.round(member.stats.str * 1.5 + member.weapon.dmgMin);
  const def = Math.min(60, Math.round(member.stats.hpStat * 1.2 + 10));
  const dodge = Math.min(25, Math.round(member.stats.agi * 0.3));
  const crit = Math.min(50, Math.round(5 + member.stats.luck * 0.5));

  root.innerHTML = `
    <div class="card">
      <div class="pp-header">
        <div class="avatar-wrap">
          <div class="avatar">${member.avatar}</div>
          <span class="status-dot ${member.online?"online":"offline"}"></span>
        </div>
        <div>
          <div class="pp-name">${clan.icon} <span class="clan-tag">[${clan.tag}]</span> ${member.name}</div>
          <div class="dim">Уровень ${member.level} · ${roleLabel}</div>
          <div class="dim">${statusText}</div>
        </div>
      </div>
    </div>
    <div class="pp-stat-list">
      <div class="pp-stat-row"><span class="stat-icon">💪</span><span class="stat-name">Сила</span><b>${member.stats.str}</b></div>
      <div class="pp-stat-row"><span class="stat-icon">🏃</span><span class="stat-name">Ловкость</span><b>${member.stats.agi}</b></div>
      <div class="pp-stat-row"><span class="stat-icon">❤️</span><span class="stat-name">Здоровье</span><b>${member.stats.hpStat}</b></div>
      <div class="pp-stat-row"><span class="stat-icon">⭐</span><span class="stat-name">Удача</span><b>${member.stats.luck}</b></div>
    </div>
    <div class="card-title">Основные показатели</div>
    <div class="derived-grid">
      <div class="derived-item"><span class="dim">Атака</span><b>${atk}</b></div>
      <div class="derived-item"><span class="dim">Защита</span><b>${def}%</b></div>
      <div class="derived-item"><span class="dim">Уклонение</span><b>${dodge}%</b></div>
      <div class="derived-item"><span class="dim">Шанс крита</span><b>${crit}%</b></div>
      <div class="derived-item"><span class="dim">Оружие</span><b style="font-size:11.5px;">${member.weapon.name}</b></div>
      <div class="derived-item"><span class="dim">Урон оружия</span><b>${member.weapon.dmgMin}-${member.weapon.dmgMax}</b></div>
    </div>
    <button class="btn ghost full" id="ppWriteBtn">НАПИСАТЬ В ЧАТ КЛАНА</button>
  `;
  document.getElementById("ppWriteBtn").addEventListener("click", () => {
    if (screenStack.length > 1) screenStack.pop();
    openClanChat(clan);
  });
}

/* ===== Clan chat ===== */
function openClanChat(clan){
  screenStack.push("clanchat");
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelector('.screen[data-screen="clanchat"]').classList.add("active");
  document.getElementById("screenTitle").textContent = `Чат клана: ${clan.tag}`;
  document.getElementById("backBtn").classList.remove("hidden");
  document.getElementById("menuBtn").classList.add("hidden");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  document.getElementById("clanChatHeader").innerHTML = `
    <div class="clanchat-header-card">
      <div class="clan-emblem" style="background:${clan.color}">${clan.icon}</div>
      <div><b>[${clan.tag}] ${clan.name}</b><div class="dim">${clan.members.length} участников</div></div>
    </div>
  `;
  renderClanChatMessages(clan);

  const sendBtn = document.getElementById("clanChatSendBtn");
  const input = document.getElementById("clanChatInput");
  sendBtn.onclick = () => sendClanChat(clan);
  input.onkeydown = (e) => { if (e.key === "Enter") sendClanChat(clan); };
}

function renderClanChatMessages(clan){
  const box = document.getElementById("clanChatMessages");
  const msgs = clanChats[clan.id] || (clanChats[clan.id] = []);
  box.innerHTML = msgs.map(m => `
    <div class="chat-msg">
      <div class="chat-avatar">${m.role==="leader"?"👑":m.role==="officer"?"🎖️":"🙂"}</div>
      <div class="chat-body">
        <div class="chat-head"><span class="chat-name">${m.isMe ? renderName() : m.name}</span><span class="chat-time">${m.time}</span></div>
        <div class="chat-text">${m.text}</div>
      </div>
    </div>`).join("") || `<p class="dim center-pad">Пока никто не писал. Будьте первым!</p>`;
  box.scrollTop = box.scrollHeight;
}

function sendClanChat(clan){
  const input = document.getElementById("clanChatInput");
  const text = input.value.trim();
  if (!text) return;
  const now = new Date();
  (clanChats[clan.id] || (clanChats[clan.id] = [])).push({
    name: state.player.name, role:"member", isMe:true,
    time:`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`, text
  });
  input.value = "";
  renderClanChatMessages(clan);
}

/* ===== Реальные кланы (общая база на сервере, см. server/db.js + server/server.js) =====
   Отдельно от старой мок-системы выше (clans/myClan/renderClan) — та по-прежнему
   держит арену и войны за территории на выдуманных ботах, это осознанно не трогаем
   в этом проходе. Экран «Клан» в навигации теперь ведёт сюда. */
let realClan = null;
let realClanList = [];
let realClanView = "list";
let realWizard = { name:"", tag:"", iconIdx:0, openJoin:true };
let realClanChatUnsub = null;

function realClanTag(){
  if (!realClan) return "";
  return `${realClan.icon} <span class="clan-tag">[${realClan.tag}]</span> `;
}

async function refreshRealClan(){
  try {
    const r = await apiFetch("/api/clans/mine");
    realClan = r.clan;
  } catch (e) {
    console.warn("refreshRealClan failed:", e);
    realClan = null;
  }
}

async function renderRealClan(){
  const root = document.getElementById("clanRoot");
  root.innerHTML = `<p class="dim center-pad">Загрузка…</p>`;
  await refreshRealClan();
  if (realClan){ renderRealClanDetail(root); return; }
  if (realClanView === "create"){ renderRealClanWizard(root); return; }
  await renderRealClanList(root);
}

async function renderRealClanList(root){
  let list = [];
  try { list = await apiFetch("/api/clans"); } catch (e) { console.warn(e); }
  realClanList = list;
  root.innerHTML = `
    <div class="card no-clan-card">
      <div class="nc-icon">🛡️</div>
      <div><b>Вы не состоите в клане</b></div>
      <p class="dim">Вступите в существующий клан или создайте свой — тег и эмблема сразу появятся рядом с вашим ником.</p>
      <button class="btn primary full" id="createRealClanBtn">СОЗДАТЬ КЛАН (−${CLAN_CREATE_COST.toLocaleString("ru-RU")} Т)</button>
    </div>
    <div class="clan-list" id="realClanListBox"></div>
  `;
  const box = document.getElementById("realClanListBox");
  if (!list.length){
    box.innerHTML = `<p class="dim center-pad">Пока никто не создал клан. Будьте первыми!</p>`;
  }
  list.forEach(cl => {
    const el = document.createElement("div");
    el.className = "clan-row";
    el.innerHTML = `
      <div class="clan-emblem" style="background:${cl.color}">${cl.icon}</div>
      <div class="clan-row-info">
        <div class="clan-row-name"><span class="clan-tag">[${cl.tag}]</span> ${cl.name}</div>
        <div class="clan-row-sub">${cl.member_count} участников · <span class="${cl.open_join?"clan-badge-open":"clan-badge-closed"}">${cl.open_join?"Открытый":"Закрыт"}</span></div>
      </div>
      <button class="btn ghost small joinRealClanBtn" data-id="${cl.id}" ${cl.open_join?"":"disabled"}>${cl.open_join?"Вступить":"Закрыт"}</button>
    `;
    box.appendChild(el);
  });
  document.getElementById("createRealClanBtn").addEventListener("click", () => {
    if (state.player.level < CLAN_CREATE_MIN_LEVEL){ toast(`Создание клана доступно с уровня ${CLAN_CREATE_MIN_LEVEL}`); return; }
    realWizard = { name:"", tag:"", iconIdx:0, openJoin:true };
    realClanView = "create";
    renderRealClan();
  });
  document.querySelectorAll(".joinRealClanBtn").forEach(b => {
    b.addEventListener("click", async () => {
      try {
        await apiFetch(`/api/clans/${b.dataset.id}/join`, { method:"POST", body: JSON.stringify({}) });
        toast("Вы вступили в клан!");
        renderRealClan();
      } catch (e) {
        toast(e.data?.error === "already in a clan" ? "Вы уже состоите в клане" : "Не удалось вступить");
      }
    });
  });
}

function renderRealClanWizard(root){
  const w = realWizard;
  root.innerHTML = `
    <div class="card">
      <div class="wizard-field">
        <label>Название клана</label>
        <input type="text" id="rwName" maxlength="24" placeholder="Например: Стальные Псы" value="${w.name}">
      </div>
      <div class="wizard-field" style="margin-top:10px;">
        <label>Тег (3-5 символов)</label>
        <input type="text" id="rwTag" maxlength="5" placeholder="Например: WOLF" value="${w.tag}" style="text-transform:uppercase">
      </div>
      <div class="wizard-field" style="margin-top:10px;"><label>Эмблема</label></div>
      <div class="icon-grid" id="rwIconGrid"></div>
      <div class="wizard-field" style="margin-top:10px;"><label>Тип вступления</label></div>
      <div class="join-type-row">
        <div class="join-type-opt ${w.openJoin?"selected":""}" data-jt="open"><b>Открытый</b><div class="dim">вступление мгновенно</div></div>
        <div class="join-type-opt ${!w.openJoin?"selected":""}" data-jt="closed"><b>Закрытый</b><div class="dim">пока без заявок</div></div>
      </div>
      <div class="wizard-nav" style="margin-top:16px;">
        <button class="btn ghost" id="rwCancel">Отмена</button>
        <button class="btn primary" id="rwSubmit">СОЗДАТЬ</button>
      </div>
    </div>
  `;
  const grid = document.getElementById("rwIconGrid");
  emblemPresets.forEach((p,i) => {
    const sw = document.createElement("div");
    sw.className = "icon-swatch" + (i===w.iconIdx?" selected":"");
    sw.style.background = p.color;
    sw.textContent = p.icon;
    sw.addEventListener("click", () => { w.iconIdx = i; renderRealClanWizard(root); });
    grid.appendChild(sw);
  });
  document.querySelectorAll(".join-type-opt").forEach(o => {
    o.addEventListener("click", () => { w.openJoin = o.dataset.jt === "open"; renderRealClanWizard(root); });
  });
  document.getElementById("rwCancel").addEventListener("click", () => { realClanView = "list"; renderRealClan(); });
  document.getElementById("rwSubmit").addEventListener("click", async () => {
    const name = document.getElementById("rwName").value.trim();
    const tag = document.getElementById("rwTag").value.trim().toUpperCase();
    if (name.length < 3){ toast("Название должно быть не короче 3 символов"); return; }
    if (tag.length < 3){ toast("Тег должен быть не короче 3 символов"); return; }
    const preset = emblemPresets[w.iconIdx];
    try {
      await apiFetch("/api/clans", { method:"POST", body: JSON.stringify({ name, tag, icon: preset.icon, color: preset.color, openJoin: w.openJoin }) });
      toast(`Клан «${name}» создан!`);
      realClanView = "list";
      renderHome();
      renderRealClan();
    } catch (e) {
      if (e.data?.error === "insufficient funds") toast(`Недостаточно Т — нужно ${CLAN_CREATE_COST.toLocaleString("ru-RU")}`);
      else if (e.data?.error === "already in a clan") toast("Вы уже состоите в клане");
      else toast("Не удалось создать клан");
    }
  });
}

function renderRealClanDetail(root){
  const c = realClan;
  const isLeader = c.leader_id === window.myTelegramId;
  const territories = c.territories || [];
  const dailyTax = territories.reduce((sum, t) => {
    const d = districts.find(x => x.id === t.district_id);
    return sum + (d ? d.taxValue : 0);
  }, 0);
  const cooldownMs = 20 * 60 * 60 * 1000;
  const msLeft = c.tax_claimed_at ? cooldownMs - (Date.now() - Number(c.tax_claimed_at)) : 0;
  const canClaim = msLeft <= 0;
  root.innerHTML = `
    <div class="card">
      <div class="clan-detail-header">
        <div class="clan-emblem" style="background:${c.color}">${c.icon}</div>
        <div>
          <div class="clan-row-name" style="font-size:16px;"><span class="clan-tag">[${c.tag}]</span> ${c.name}</div>
          <div class="dim">${c.members.length} участников</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Территория и казна</div>
      <div class="dim" style="margin-bottom:8px;">Казна: <b style="color:var(--gold);">${Number(c.treasury||0).toLocaleString("ru-RU")} Т</b></div>
      ${territories.length ? territories.map(t => {
        const d = districts.find(x => x.id === t.district_id);
        return `<div class="street-row" style="display:flex;justify-content:space-between;padding:6px 0;font-size:12.5px;"><span>${d?d.name:t.district_id}</span><span style="color:var(--gold);">+${(d?d.taxValue:0).toLocaleString("ru-RU")} Т/сутки</span></div>`;
      }).join("") : `<p class="dim" style="font-size:12px;">Клан пока не держит районов — объявите войну на карте.</p>`}
      ${territories.length ? `<button class="btn primary full" id="collectTaxBtn" style="margin-top:8px;" ${canClaim?"":"disabled"}>${canClaim ? `СОБРАТЬ НАЛОГ (+${dailyTax.toLocaleString("ru-RU")} Т)` : `Налог собран, ждите ~${Math.ceil(msLeft/3600000)} ч`}</button>` : ""}
    </div>
    <button class="clanchat-btn" id="openRealClanChatBtn">💬 <b>Чат клана</b><span class="dim" style="margin-left:auto;">только для участников</span></button>
    <div class="card">
      <div class="card-title">Участники</div>
      <div class="clan-list" id="realMemberList"></div>
    </div>
    <button class="btn ghost full" id="leaveRealClanBtn">${isLeader && c.members.length>1 ? "ПОКИНУТЬ (лидерство перейдёт другому)" : isLeader ? "РАСПУСТИТЬ КЛАН" : "ПОКИНУТЬ КЛАН"}</button>
  `;
  const collectBtn = document.getElementById("collectTaxBtn");
  if (collectBtn) collectBtn.addEventListener("click", async () => {
    try {
      const r = await apiFetch("/api/clans/mine/collect-tax", { method:"POST", body: JSON.stringify({}) });
      if (r.alreadyClaimed){ toast("Налог уже собран сегодня"); return; }
      toast(`Собрано ${Number(r.amount).toLocaleString("ru-RU")} Т в казну клана`);
      renderRealClan();
    } catch (e) {
      toast("Не удалось собрать налог");
    }
  });
  const box = document.getElementById("realMemberList");
  c.members.forEach(m => {
    const isMe = m.telegram_id === window.myTelegramId;
    const el = document.createElement("div");
    el.className = "member-row";
    const roleLabel = m.role === "leader" ? "Лидер" : "Участник";
    el.innerHTML = `
      <span class="status-dot online"></span>
      <div class="member-main">
        <span>${isMe ? "(вы) " : ""}${m.name || "Игрок"}</span>
      </div>
      <span class="member-role ${m.role==="leader"?"leader":""}">${roleLabel}</span>
    `;
    box.appendChild(el);
  });
  document.getElementById("openRealClanChatBtn").addEventListener("click", () => openRealClanChat(c));
  document.getElementById("leaveRealClanBtn").addEventListener("click", async () => {
    try {
      await apiFetch(`/api/clans/${c.id}/leave`, { method:"POST", body: JSON.stringify({}) });
      toast("Вы покинули клан");
      renderRealClan();
      renderHome();
    } catch (e) {
      toast("Не удалось выполнить действие");
    }
  });
}

function openRealClanChat(clan){
  screenStack.push("clanchat");
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelector('.screen[data-screen="clanchat"]').classList.add("active");
  document.getElementById("screenTitle").textContent = `Чат клана: ${clan.tag}`;
  document.getElementById("backBtn").classList.remove("hidden");
  document.getElementById("menuBtn").classList.add("hidden");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  document.getElementById("clanChatHeader").innerHTML = `
    <div class="clanchat-header-card">
      <div class="clan-emblem" style="background:${clan.color}">${clan.icon}</div>
      <div><b>[${clan.tag}] ${clan.name}</b><div class="dim">${clan.members.length} участников</div></div>
    </div>
  `;
  document.getElementById("clanChatMessages").innerHTML = `<p class="dim center-pad">Загрузка…</p>`;
  window.joinChatRoom("clan:" + clan.id);
  realClanChatUnsub = () => renderRealClanChatMessages();
  window.setOnChatUpdate(realClanChatUnsub);
  renderRealClanChatMessages();

  const sendBtn = document.getElementById("clanChatSendBtn");
  const input = document.getElementById("clanChatInput");
  sendBtn.onclick = () => sendRealClanChat();
  input.onkeydown = (e) => { if (e.key === "Enter") sendRealClanChat(); };
}

function renderRealClanChatMessages(){
  const box = document.getElementById("clanChatMessages");
  if (!box) return;
  const messages = (window.chatState && window.chatState.messages) || [];
  box.innerHTML = messages.length ? messages.map(m => `
    <div class="chat-msg">
      <div class="chat-avatar">🙂</div>
      <div class="chat-body">
        <div class="chat-head"><span class="chat-name">${m.telegramId === window.myTelegramId ? realClanTag() + state.player.name : m.name}</span><span class="chat-time">${m.time}</span></div>
        <div class="chat-text">${m.text}</div>
      </div>
    </div>`).join("") : `<p class="dim center-pad">Пока никто не писал. Будьте первым!</p>`;
  box.scrollTop = box.scrollHeight;
}

function sendRealClanChat(){
  const input = document.getElementById("clanChatInput");
  const text = input.value.trim();
  if (!text) return;
  window.sendChatMessage(text);
  input.value = "";
}

/* ===== Arena ===== */
const beltTiers = [
  { id:"belt1", name:"Кожаный пояс", cost:100, bonus:2 },
  { id:"belt2", name:"Армированный пояс", cost:500, bonus:4 },
  { id:"belt3", name:"Стальной пояс", cost:1500, bonus:6 },
  { id:"belt4", name:"Пояс чемпиона", cost:5000, bonus:10 },
  { id:"belt5", name:"Легендарный пояс арены", cost:15000, bonus:15 },
];

function nameSeed(name){
  let h = 0;
  for (let i=0;i<name.length;i++) h = (h*31 + name.charCodeAt(i)) % 97;
  return h;
}
// Реальные соперники арены — с сервера (см. /api/arena/opponents), не выдуманные боты.

const ARENA_RANKS = [
  { rep:0, name:"Новичок" },
  { rep:50, name:"Боец" },
  { rep:150, name:"Гладиатор" },
  { rep:350, name:"Чемпион" },
  { rep:700, name:"Легенда арены" },
];
function arenaRankTitle(rep){
  let title = ARENA_RANKS[0].name;
  for (const r of ARENA_RANKS){ if (rep >= r.rep) title = r.name; }
  return title;
}
function arenaNextRank(rep){
  return ARENA_RANKS.find(r => r.rep > rep) || null;
}

let arenaView = "list";

function renderArena(){
  const root = document.getElementById("arenaRoot");
  const p = state.player;
  const rankTitle = arenaRankTitle(p.arenaRep);
  const next = arenaNextRank(p.arenaRep);
  root.innerHTML = `
    <div class="card arena-summary">
      <div class="derived-item"><span class="dim">Очки</span><b>${p.arenaPoints}</b></div>
      <div class="derived-item"><span class="dim">Репутация</span><b>${p.arenaRep}</b></div>
      <div class="derived-item"><span class="dim">W / L</span><b>${p.arenaWins}/${p.arenaLosses}</b></div>
    </div>
    <div class="card" style="text-align:center;">
      <div class="dim" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Ваш ранг</div>
      <div class="card-title" style="font-size:18px;margin:2px 0 4px;color:var(--gold);">🏆 ${rankTitle}</div>
      ${next ? `<div class="dim" style="font-size:11.5px;">До «${next.name}»: ${next.rep - p.arenaRep} репутации</div>` : `<div class="dim" style="font-size:11.5px;">Максимальный ранг</div>`}
    </div>
    <div class="tabs" data-group="arenaTab">
      <button class="tab ${arenaView==="list"?"active":""}" data-tab="list">Соперники</button>
      <button class="tab ${arenaView==="rating"?"active":""}" data-tab="rating">Рейтинг</button>
      <button class="tab ${arenaView==="shop"?"active":""}" data-tab="shop">Пояса</button>
    </div>
    <div id="arenaBody"></div>
  `;
  document.querySelectorAll('.tabs[data-group="arenaTab"] .tab').forEach(t => {
    t.addEventListener("click", () => { arenaView = t.dataset.tab; renderArena(); });
  });
  if (arenaView === "list") renderArenaList();
  else if (arenaView === "rating") renderArenaRating();
  else renderArenaShop();
}

async function renderArenaRating(){
  const body = document.getElementById("arenaBody");
  body.innerHTML = `<p class="dim center-pad">Загрузка…</p>`;
  const p = state.player;
  let opponents = [];
  try { opponents = await apiFetch("/api/arena/opponents"); } catch (e) { console.warn(e); }
  const rows = opponents.map(o => ({ name:o.name, level:o.level, rep:o.arenaRep, isMe:false }));
  rows.push({ name:p.name, level:p.level, rep:p.arenaRep, isMe:true });
  rows.sort((a,b) => b.rep - a.rep);
  body.innerHTML = `<div class="clan-list" id="arenaRatingList"></div>`;
  const list = document.getElementById("arenaRatingList");
  rows.forEach((r, i) => {
    const el = document.createElement("div");
    el.className = "opponent-row" + (r.isMe ? " current" : "");
    if (r.isMe) el.style.borderColor = "var(--gold)";
    el.innerHTML = `
      <b style="width:22px;text-align:center;color:${i<3?"var(--gold)":"var(--text-dim)"};">${i+1}</b>
      <div class="opponent-main">
        <span class="opponent-name">${r.isMe?"<b>"+r.name+" (вы)</b>":r.name}</span>
        <span class="opponent-sub">Ур. ${r.level} · ${arenaRankTitle(r.rep||0)}</span>
      </div>
      <b style="color:var(--gold);white-space:nowrap;">${r.rep||0} реп.</b>
    `;
    list.appendChild(el);
  });
}

async function renderArenaList(){
  const body = document.getElementById("arenaBody");
  body.innerHTML = `<p class="dim center-pad">Загрузка…</p>`;
  let opponents = [];
  try { opponents = await apiFetch("/api/arena/opponents"); } catch (e) { console.warn(e); }
  body.innerHTML = `<div class="clan-list" id="arenaOppList"></div>`;
  const list = document.getElementById("arenaOppList");
  if (!opponents.length){
    list.innerHTML = `<p class="dim center-pad">Пока нет других игроков — позови друзей!</p>`;
    return;
  }
  opponents.forEach(o => {
    const el = document.createElement("div");
    el.className = "opponent-row";
    el.innerHTML = `
      <span class="status-dot online"></span>
      <div class="opponent-main">
        <span class="opponent-name">${o.name}</span>
        <span class="opponent-sub">Ур. ${o.level}</span>
      </div>
      ${o.shielded ? `<span class="shield-badge">🛡 щит</span>` : `<button class="btn primary small challengeBtn">Вызвать</button>`}
    `;
    if (!o.shielded){
      el.querySelector(".challengeBtn").addEventListener("click", () => challengeOpponent(o));
    }
    list.appendChild(el);
  });
}

async function challengeOpponent(opponent){
  if (isBusy()){ toast(`Вы заняты (${busyLabel()}) — нельзя вызвать на арену`); return; }
  toast(`Вызов отправлен игроку ${opponent.name}…`);
  let result;
  try {
    result = await apiFetch("/api/arena/challenge", { method:"POST", body: JSON.stringify({ opponentTelegramId: opponent.telegramId }) });
  } catch (e) {
    toast(e.data?.error === "shielded" ? "Соперник под щитом" : "Не удалось начать бой");
    return;
  }
  const savedLoaded = await apiFetch("/api/load");
  if (savedLoaded && !savedLoaded.isNew){
    Object.assign(state.player, savedLoaded.state.player || {});
  }
  renderHome();

  screenStack.push("battle");
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelector('.screen[data-screen="battle"]').classList.add("active");
  document.getElementById("screenTitle").textContent = `Арена: ${opponent.name}`;
  document.getElementById("backBtn").classList.remove("hidden");
  document.getElementById("menuBtn").classList.add("hidden");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("battleSelectView").classList.add("hidden");
  document.getElementById("battleFightView").classList.remove("hidden");
  document.getElementById("battleActiveArea").classList.add("hidden");
  document.getElementById("battleLog").innerHTML = "";
  document.getElementById("enemyName").textContent = opponent.name;
  document.getElementById("enemyLevel").textContent = opponent.level;
  document.getElementById("enemy-hp-text").textContent = result.won ? "0 / 100" : "100 / 100";
  document.getElementById("enemy-hp-bar").style.width = result.won ? "0%" : "100%";
  document.getElementById("battle-p-hp-text").textContent = `${state.player.hp} / ${state.player.maxHp}`;
  document.getElementById("battle-p-hp-bar").style.width = `${Math.max(0,(state.player.hp/state.player.maxHp)*100)}%`;

  const resultBox = document.getElementById("battleResult");
  resultBox.classList.remove("hidden");
  const chips = result.won
    ? `<span class="br-chip">🏆 +15 очков арены</span><span class="br-chip">⭐ +15 репутации</span><span class="br-chip">🛡 щит сопернику на 10 мин</span>`
    : `<span class="br-chip">🥊 +5 очков арены</span>`;
  resultBox.className = "battle-result " + (result.won ? "win" : "lose");
  resultBox.innerHTML = `
    <div class="br-icon">${result.won?"🏆":"💀"}</div>
    <div class="br-title">${result.won?"Победа":"Поражение"}</div>
    <div class="br-sub">${opponent.name} · дуэль решена за ${result.rounds} раунд(ов)</div>
    <div class="br-rewards">${chips}</div>
    <button class="btn primary full" id="battleContinueBtn">ВЕРНУТЬСЯ НА АРЕНУ</button>`;
  document.getElementById("battleContinueBtn").addEventListener("click", () => showScreen("arena"));
}

function renderArenaShop(){
  const body = document.getElementById("arenaBody");
  const p = state.player;
  body.innerHTML = beltTiers.map(b => `
    <div class="belt-card">
      <div class="clan-emblem">🥋</div>
      <div class="belt-info">
        <div class="belt-name">${b.name}</div>
        <div class="belt-desc">+${b.bonus} ко всем статам</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <span class="belt-cost">${b.cost} очк.</span>
        <button class="btn ${p.arenaPoints>=b.cost?"primary":"ghost"} small buyBeltBtn" data-id="${b.id}" ${p.arenaPoints<b.cost?"disabled":""}>Купить</button>
      </div>
    </div>
  `).join("");
  document.querySelectorAll(".buyBeltBtn").forEach(btn => {
    btn.addEventListener("click", () => buyBelt(btn.dataset.id));
  });
}

function buyBelt(id){
  const tier = beltTiers.find(b => b.id === id);
  const p = state.player;
  if (p.arenaPoints < tier.cost){ toast("Недостаточно очков арены"); return; }
  p.arenaPoints -= tier.cost;
  const existing = findItem(tier.id);
  if (existing) existing.count = 1;
  else state.inventory.push({
    id: tier.id, name: tier.name, icon:"🥋", cat:"armor", count:1,
    equipSlot:"belt", statBonus:{ str:tier.bonus, agi:tier.bonus, hpStat:tier.bonus, luck:tier.bonus },
  });
  equipItem("belt", tier.id);
  renderArena();
  renderHome();
  toast(`Куплен и надет: ${tier.name}`);
}

/* ===== Territory Wars (реальные кланы, сервер разрешает бои) ===== */
const WAR_DECLARE_COST = 5000;
let territoryOwners = {}; // districtId -> {clanId,name,tag,icon,color}
let currentWarId = null;
let warPollHandle = null;
let clanInfoCache = {};
let warLineRequestSeq = 0;

async function refreshTerritoryOwners(){
  try {
    const r = await apiFetch("/api/territory");
    territoryOwners = r.owners || {};
  } catch (e) { console.warn("refreshTerritoryOwners failed:", e); }
}

async function getClanInfo(clanId){
  if (!clanId) return null;
  if (clanInfoCache[clanId]) return clanInfoCache[clanId];
  try {
    const r = await apiFetch(`/api/clans/${clanId}`);
    clanInfoCache[clanId] = r.clan;
    return r.clan;
  } catch (e) { return null; }
}

function renderDistrictWarLine(d, owner){
  const line = document.getElementById("districtWarLine");
  if (!line) return;
  const seq = ++warLineRequestSeq;
  line.innerHTML = `<p class="dim" style="margin-top:8px;font-size:11px;">Проверка района…</p>`;
  apiFetch(`/api/territory/${d.id}/war`).then(r => {
    if (seq !== warLineRequestSeq) return;
    const war = r.war;
    if (war){
      line.innerHTML = `<button class="btn primary full" id="openWarBtn" style="margin-top:8px;">⚔️ ИДЁТ ВОЙНА — ОТКРЫТЬ</button>`;
      document.getElementById("openWarBtn").addEventListener("click", () => { currentWarId = war.id; showScreen("territorywar"); });
      return;
    }
    if (!realClan){ line.innerHTML = ""; return; }
    if (owner && owner.clanId === realClan.id){ line.innerHTML = ""; return; }
    line.innerHTML = `<button class="btn ghost full" id="declareWarBtn" style="margin-top:8px;">ОБЪЯВИТЬ АТАКУ (−${WAR_DECLARE_COST.toLocaleString("ru-RU")} Т)</button>`;
    document.getElementById("declareWarBtn").addEventListener("click", () => declareWar(d, owner));
  }).catch(e => { if (seq === warLineRequestSeq){ console.warn("war check failed:", e); line.innerHTML = ""; } });
}

async function declareWar(district, owner){
  if (!realClan){ toast("Нужно состоять в клане"); return; }
  try {
    const r = await apiFetch(`/api/territory/${district.id}/declare`, { method:"POST", body: JSON.stringify({}) });
    currentWarId = r.war.id;
    const savedLoaded = await apiFetch("/api/load");
    if (savedLoaded && !savedLoaded.isNew) Object.assign(state.player, savedLoaded.state.player || {});
    renderHome();
    toast(`Атака на «${district.name}» объявлена! Собирайте отряд.`);
    showScreen("territorywar");
  } catch (e) {
    const msg = {
      "insufficient funds": `Недостаточно Т — нужно ${WAR_DECLARE_COST.toLocaleString("ru-RU")}`,
      "war already active here": "Здесь уже идёт война",
      "your clan is already at war": "Ваш клан уже воюет в другом районе",
      "you already own this": "Это уже ваша территория",
      "not in a clan": "Нужно состоять в клане",
    }[e.data && e.data.error] || "Не удалось объявить войну";
    toast(msg);
  }
}

function renderWar(){
  const root = document.getElementById("warRoot");
  if (!currentWarId){
    root.innerHTML = `<p class="dim center-pad">Сейчас нет открытой войны. Откройте её на карте — там, где уже идёт бой за район, либо объявите атаку сами.</p>`;
    clearInterval(warPollHandle); warPollHandle = null;
    return;
  }
  loadAndRenderWar();
  clearInterval(warPollHandle);
  warPollHandle = setInterval(loadAndRenderWar, 3000);
}

async function loadAndRenderWar(){
  const root = document.getElementById("warRoot");
  if (!currentWarId) return;
  let war;
  try {
    const r = await apiFetch(`/api/territory/wars/${currentWarId}`);
    war = r.war;
  } catch (e) {
    clearInterval(warPollHandle); warPollHandle = null;
    root.innerHTML = `<p class="dim center-pad">Война не найдена.</p>`;
    return;
  }
  if (war.status === "resolved"){
    clearInterval(warPollHandle); warPollHandle = null;
    await getClanInfo(war.attacker_clan_id);
    if (war.defender_clan_id) await getClanInfo(war.defender_clan_id);
    renderRealWarReport(root, war);
    renderMap();
    return;
  }
  await renderRealWarPrep(root, war);
}

async function renderRealWarPrep(root, war){
  const atk = await getClanInfo(war.attacker_clan_id);
  const def = war.defender_clan_id ? await getClanInfo(war.defender_clan_id) : null;
  if (!realClan) await refreshRealClan();
  const d = districts.find(x => x.id === war.district_id);
  const secsLeft = Math.max(0, Math.round((Number(war.prep_ends_at) - Date.now())/1000));
  const mm = String(Math.floor(secsLeft/60)).padStart(2,"0");
  const ss = String(secsLeft%60).padStart(2,"0");
  const atkRoster = war.attacker_roster || [];
  const defRoster = war.defender_roster || [];
  root.innerHTML = `
    <div class="card">
      <div class="war-vs-row">
        <div class="war-side"><div class="clan-emblem" style="background:${atk?atk.color:"#333"}">${atk?atk.icon:"⚔️"}</div><b>[${atk?atk.tag:"?"}]</b><span class="dim">${atk?atk.name:"—"}</span></div>
        <div class="war-vs-label">VS</div>
        <div class="war-side">${def?`<div class="clan-emblem" style="background:${def.color}">${def.icon}</div><b>[${def.tag}]</b><span class="dim">${def.name}</span>`:`<div class="clan-emblem">🏳️</div><b>Ничья территория</b>`}</div>
      </div>
      <div class="war-timer-big" id="warTimerBig">${mm}:${ss}</div>
      <div class="war-status-label">До начала боя за «${d?d.name:war.district_id}» — собирайте отряд</div>
    </div>
    <div class="roster-cols">
      <div class="roster-col">
        <div class="roster-col-title">Атакующие (${atkRoster.length})</div>
        <div id="atkRoster">${renderWarRosterHtml(atkRoster)}</div>
        <button class="btn primary full" id="joinAtkBtn" style="margin-top:4px;">Я В БОЮ</button>
      </div>
      <div class="roster-col">
        <div class="roster-col-title">Защитники (${defRoster.length})</div>
        <div id="defRoster">${renderWarRosterHtml(defRoster)}</div>
        <button class="btn primary full" id="joinDefBtn" style="margin-top:4px;">Я В БОЮ</button>
      </div>
    </div>
  `;
  const myTid = window.myTelegramId;
  const isAttackerSide = !!(realClan && realClan.id === war.attacker_clan_id);
  const isDefenderSide = !!(realClan && def && realClan.id === war.defender_clan_id);
  const inAtk = atkRoster.some(r => r.telegramId === myTid);
  const inDef = defRoster.some(r => r.telegramId === myTid);
  const joinAtkBtn = document.getElementById("joinAtkBtn");
  const joinDefBtn = document.getElementById("joinDefBtn");
  joinAtkBtn.disabled = !isAttackerSide || inAtk;
  joinDefBtn.disabled = !isDefenderSide || inDef;
  joinAtkBtn.addEventListener("click", () => joinWarSide("attacker"));
  joinDefBtn.addEventListener("click", () => joinWarSide("defender"));
}

function renderWarRosterHtml(roster){
  if (!roster.length) return `<p class="dim" style="font-size:11px;">Пока никого</p>`;
  return roster.map(r => `<div class="roster-item">🟢 ${r.telegramId === window.myTelegramId ? renderName() : (r.name||"Игрок")}</div>`).join("");
}

async function joinWarSide(side){
  try {
    await apiFetch(`/api/territory/wars/${currentWarId}/join`, { method:"POST", body: JSON.stringify({ side }) });
    toast("Вы вступили в бой!");
    loadAndRenderWar();
  } catch (e) {
    const msg = {
      "wrong clan for this side": "Это не ваш клан",
      "war not open for joining": "Набор отряда уже закрыт",
      "not in a clan": "Нужно состоять в клане",
    }[e.data && e.data.error] || "Не удалось присоединиться";
    toast(msg);
  }
}

function renderRealWarReport(root, war){
  const result = war.result || {};
  const atk = clanInfoCache[war.attacker_clan_id];
  const def = war.defender_clan_id ? clanInfoCache[war.defender_clan_id] : null;
  root.innerHTML = `
    <div class="card">
      <div class="card-title">${result.attackerWon ? "🏆 Территория захвачена" : "🛡 Атака отбита"}</div>
      <div class="war-vs-row">
        <div class="war-side">${atk?`<div class="clan-emblem" style="background:${atk.color}">${atk.icon}</div>`:""}<b>${result.attackerScore||0}</b></div>
        <div class="war-vs-label">VS</div>
        <div class="war-side">${def?`<div class="clan-emblem" style="background:${def.color}">${def.icon}</div>`:`<div class="clan-emblem">🏳️</div>`}<b>${result.defenderScore||0}</b></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Отчёт о бое</div>
      ${(result.log||[]).map(l => `<div class="war-report-row">${l}</div>`).join("")}
    </div>
    <button class="btn primary full" id="closeWarBtn">ЗАКРЫТЬ</button>
  `;
  document.getElementById("closeWarBtn").addEventListener("click", () => {
    currentWarId = null;
    showScreen("map");
  });
}

/* ===== Battle ===== */
const zoneMultiplier = { head:1.5, chest:1.0, belly:0.8, legs:0.6 };
const zoneLabel = { head:"голову", chest:"грудь", belly:"живот", legs:"ноги" };
let enemy = null;
let selAttack = null, selBlock = null;
let turnTimerHandle = null, turnSeconds = 15;
let battleOver = false;
let battleMode = "pve";
let arenaOpponentRef = null;
let activeHot = null; // { name, hotMin, hotMax, turnsLeft } — зелье восстановления Фармацевта

function derivedStats(){
  const s = effectiveStats();
  const weapon = getEquippedWeapon();
  const atk = Math.round(s.str * 1.5 + weapon.dmgMin);
  const totalDef = zoneDefense("head") + zoneDefense("chest") + zoneDefense("belly") + zoneDefense("legs");
  const dodge = Math.min(25, Math.round(s.agi * 0.3));
  const crit = Math.min(50, Math.round(5 + s.luck * 0.5) + equipmentCritBonus());
  const init = s.agi;
  return { atk, def:totalDef, dodge, crit, init };
}

function computeDamage(attackerStats, weaponAvg, zone, blockZone, defenderArmor){
  const roll = () => Math.random() * 100;
  const dodgeChance = Math.min(25, attackerStats.agiDef * 0.3);
  if (roll() < dodgeChance) return { dmg:0, dodged:true, crit:false, blocked:false };

  let base = (attackerStats.str * 1.5 + weaponAvg) * (1 + attackerStats.agi * 0.01);
  const critChance = 5 + attackerStats.luck * 0.5 + (attackerStats.critBonus || 0);
  const isCrit = roll() < critChance;
  let dmg = base * zoneMultiplier[zone] * (isCrit ? 2 : 1);

  const blocked = zone === blockZone;
  if (blocked) dmg *= 0.3;

  dmg = Math.max(1, Math.round(dmg - (defenderArmor || 0)));
  return { dmg, dodged:false, crit:isCrit, blocked };
}

/* ===== Navigation ===== */
const screenTitles = {
  home:"Territory", map:"Карта города", battle:"Бой", character:"Персонаж",
  inventory:"Инвентарь", craft:"Профессии", work:"Работа", shop:"Магазин", chat:"Чат района", clan:"Клан", arena:"Арена", territorywar:"Война за территорию", auction:"Аукцион", stub:"Скоро"
};
let screenStack = ["home"];

function showScreen(name, opts={}){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.querySelector(`.screen[data-screen="${name}"]`);
  el.classList.add("active");
  document.getElementById("screenTitle").textContent = opts.title || screenTitles[name] || "";
  document.getElementById("backBtn").classList.toggle("hidden", name === "home");
  document.getElementById("menuBtn").classList.toggle("hidden", name !== "home");

  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.goto === name && name !== "stub");
  });

  if (name === "stub" && opts.title) document.getElementById("stubText").textContent = `Раздел «${opts.title}» появится в следующей версии.`;
  if (name !== screenStack[screenStack.length-1]) screenStack.push(name);
  if (warPollHandle && name !== "territorywar"){ clearInterval(warPollHandle); warPollHandle = null; }

  if (name === "map") renderMap();
  if (name === "character") renderCharacter();
  if (name === "inventory") renderInventory("all");
  if (name === "craft") renderCraft();
  if (name === "shop") renderShop("weapon");
  if (name === "chat") renderChat();
  if (name === "clan") renderRealClan();
  if (name === "arena") renderArena();
  if (name === "auction") renderAuction();
  if (name === "territorywar") renderWar();
  if (name === "work") enterWorkScreen();
  if (name === "battle") ensureBattleStarted();
}

document.getElementById("backBtn").addEventListener("click", () => {
  if (screenStack.length > 1) screenStack.pop();
  const prev = screenStack.length > 1 ? screenStack[screenStack.length-1] : "home";
  screenStack.pop();
  showScreen(prev);
});

document.querySelectorAll("[data-goto]").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.goto, { title: btn.dataset.title }));
});

document.getElementById("addFundsBtn").addEventListener("click", () => toast("Пополнение баланса — в следующей версии"));

/* ===== Toast ===== */
function toast(msg){
  const t = document.createElement("div");
  t.className = "toast-item";
  t.textContent = msg;
  document.getElementById("toast").appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

/* ===== Render: Home ===== */
function renderHome(){
  const p = state.player;
  document.getElementById("p-name").innerHTML = renderName();
  document.getElementById("p-level").textContent = p.level;
  document.getElementById("p-rep").textContent = p.rep;
  document.getElementById("p-district").textContent = p.district;
  document.getElementById("p-hp-text").textContent = `${p.hp} / ${p.maxHp}`;
  document.getElementById("p-hp-bar").style.width = `${(p.hp/p.maxHp)*100}%`;
  document.getElementById("p-exp-text").textContent = `${p.exp} / ${p.maxExp}`;
  document.getElementById("p-exp-bar").style.width = `${(p.exp/p.maxExp)*100}%`;
  document.getElementById("p-energy-text").textContent = `${p.energy} / ${p.maxEnergy}`;
  document.getElementById("p-energy-bar").style.width = `${(p.energy/p.maxEnergy)*100}%`;
  document.getElementById("p-rub").textContent = p.rub.toLocaleString("ru-RU");
  document.getElementById("p-stars").textContent = p.stars;
  document.getElementById("shop-rub").textContent = p.rub.toLocaleString("ru-RU");
  document.getElementById("shop-stars").textContent = p.stars;
  document.getElementById("p-avatar-lvl").textContent = p.level;
  document.getElementById("p-avatar-ring").style.background = `conic-gradient(var(--gold) 0 ${Math.round((p.exp/p.maxExp)*100)}%, var(--card-border) ${Math.round((p.exp/p.maxExp)*100)}% 100%)`;
  const fd = districts.find(x => x.name === p.district);
  if (fd){
    document.getElementById("districtFlavorName").textContent = fd.name;
    document.getElementById("districtFlavorDesc").textContent = fd.desc;
  }
  updateBusyBanner();
  updateClanTaxBanner();
}

function updateClanTaxBanner(){
  const banner = document.getElementById("clanTaxBanner");
  if (!banner) return;
  const c = realClan;
  if (!c || !c.territories || c.territories.length === 0){ banner.classList.add("hidden"); return; }
  const tax = c.territories.reduce((sum, t) => {
    const d = districts.find(x => x.id === t.district_id);
    return sum + (d ? d.taxValue : 0);
  }, 0);
  const cooldownMs = 20 * 60 * 60 * 1000;
  const canClaim = !c.tax_claimed_at || (Date.now() - Number(c.tax_claimed_at)) >= cooldownMs;
  banner.classList.remove("hidden");
  banner.innerHTML = `<span class="td"></span><span>Клан «<b>${c.name}</b>» держит ${c.territories.length} ${c.territories.length===1?"район":"района"} — казна <b>${c.treasury.toLocaleString("ru-RU")} Т</b>${canClaim?`, налог ещё не собран (+${tax.toLocaleString("ru-RU")} Т)`:""}</span>`;
}

/* ===== Render: Map ===== */
function findLocation(id){
  const d = districts.find(x => x.id === id);
  if (d) return { loc:d, isGather:false };
  const s = professionSpots.find(x => x.id === id);
  if (s) return { loc:s, isGather:true };
  return null;
}

function isDistrictUnlocked(d){
  return d.unlocked || state.player.level >= d.lvlMin;
}

async function renderMap(){
  const grid = document.getElementById("districtGrid");
  await refreshTerritoryOwners();
  grid.innerHTML = "";
  districts.forEach(d => {
    const owner = territoryOwners[d.id];
    const unlocked = isDistrictUnlocked(d);
    const div = document.createElement("div");
    div.dataset.locId = d.id;
    div.className = "district-card" + (d.id===currentDistrictId?" current":"") + (!unlocked?" locked":"");
    div.innerHTML = `
      ${owner?`<span class="territory-strip" style="background:${owner.color}"></span>`:""}
      ${owner?`<span class="territory-badge" style="border-color:${owner.color}">${owner.icon} ${owner.tag}</span>`:""}
      ${!unlocked?'<span class="lock-icon">🔒</span>':""}
      <div class="dn">${d.name}</div><div class="dl">Уровень: ${d.level}</div>`;
    div.addEventListener("click", () => {
      if (!unlocked){ toast(`Район заблокирован. Доступен с уровня ${d.level.split(" ")[0]}`); return; }
      selectDistrict(d.id);
    });
    grid.appendChild(div);
  });
  professionSpots.forEach(spot => {
    const prof = professions.find(p => p.id === spot.profession);
    const div = document.createElement("div");
    div.dataset.locId = spot.id;
    div.className = "district-card gather-card" + (spot.id===currentDistrictId?" current":"");
    div.innerHTML = `<div class="dn">${spot.icon} ${spot.name}</div><div class="dl">${prof.name} · без боёв</div>`;
    div.addEventListener("click", () => selectDistrict(spot.id));
    grid.appendChild(div);
  });
  selectDistrict(currentDistrictId, true);
}

function setLocationImage(elId, loc){
  const el = document.getElementById(elId);
  if (loc.image){
    el.style.backgroundImage = `url("${loc.image}")`;
    el.classList.add("has-photo");
    el.textContent = "";
  } else {
    el.style.backgroundImage = "";
    el.classList.remove("has-photo");
    el.textContent = loc.icon;
  }
}

function selectDistrict(id, silent){
  const found = findLocation(id);
  const d = found.loc;
  document.getElementById("map-current").textContent = d.name;
  document.getElementById("districtDesc").textContent = d.desc;
  setLocationImage("districtImage", d);

  if (found.isGather){
    document.getElementById("districtLevelLine").innerHTML = `Локация сбора: <b>${professions.find(p=>p.id===d.profession).name}</b> · без боёв, с 1 уровня`;
    document.getElementById("districtOwnerLine").innerHTML = "";
    document.getElementById("districtWarLine").innerHTML = "";
  } else {
    document.getElementById("districtLevelLine").innerHTML = `Рекомендуемый уровень: <b>${d.level}</b>`;
    const owner = territoryOwners[d.id];
    document.getElementById("districtOwnerLine").innerHTML = owner
      ? `<div class="owner-line"><div class="clan-emblem" style="background:${owner.color}">${owner.icon}</div><span>Контролирует: <span class="clan-tag">[${owner.tag}]</span> ${owner.name}</span></div>`
      : `<div class="owner-line dim">Ничейная территория</div>`;
    renderDistrictWarLine(d, owner);
  }

  document.querySelectorAll("#districtGrid .district-card").forEach(el => {
    el.classList.toggle("current", el.dataset.locId === id);
  });
  document.getElementById("travelBtn").dataset.target = id;
  document.getElementById("travelBtn").disabled = id === currentDistrictId || isBusy();
  document.getElementById("travelBtn").firstChild.textContent = id === currentDistrictId ? "ВЫ ЗДЕСЬ " : "ПЕРЕМЕСТИТЬСЯ ";
  if (!silent) document.getElementById("travelTimer").textContent = "";
}

document.getElementById("changeDistrictBtn").addEventListener("click", () => toast("Выберите локацию на карте ниже"));

let travelHandle = null;
document.getElementById("travelBtn").addEventListener("click", (e) => {
  if (isBusy()){ toast(`Вы заняты (${busyLabel()}) — дождитесь окончания`); return; }
  const btn = e.currentTarget;
  const target = btn.dataset.target;
  if (!target || target === currentDistrictId) return;
  const found = findLocation(target);
  const d = found.loc;
  let secs = 8;
  btn.disabled = true;
  clearInterval(travelHandle);
  travelHandle = setInterval(() => {
    document.getElementById("travelTimer").textContent = `00:${String(secs).padStart(2,"0")}`;
    secs--;
    if (secs < 0){
      clearInterval(travelHandle);
      currentDistrictId = target;
      state.player.district = d.name;
      renderHome();
      renderMap();
      toast(`Вы переместились: «${d.name}»`);
    }
  }, 1000);
});

/* ===== Render: Character ===== */
function renderCharacter(){
  const p = state.player;
  document.getElementById("c-level").textContent = p.level;
  document.getElementById("c-exp-text").textContent = `${p.exp} / ${p.maxExp}`;
  document.getElementById("c-exp-bar").style.width = `${(p.exp/p.maxExp)*100}%`;
  document.getElementById("freePoints").textContent = p.freePoints;
  document.getElementById("stat-str").textContent = p.stats.str;
  document.getElementById("stat-agi").textContent = p.stats.agi;
  document.getElementById("stat-hp").textContent = p.stats.hpStat;
  document.getElementById("stat-luck").textContent = p.stats.luck;

  document.querySelectorAll(".stat-plus").forEach(b => b.disabled = p.freePoints <= 0);

  const d = derivedStats();
  document.getElementById("d-hp").textContent = p.maxHp;
  document.getElementById("d-def").textContent = d.def;
  document.getElementById("d-atk").textContent = d.atk;
  document.getElementById("d-dodge").textContent = d.dodge + "%";
  document.getElementById("d-crit").textContent = d.crit + "%";
  document.getElementById("d-init").textContent = d.init;
  renderActiveElixirs();
}

function renderActiveElixirs(){
  const root = document.getElementById("activeElixirsRoot");
  if (!root) return;
  cleanExpiredElixirs();
  const list = state.player.activeElixirs;
  if (!list.length){ root.innerHTML = ""; return; }
  root.innerHTML = `
    <div class="card-title" style="margin-top:10px;">Активные эликсиры</div>
    ${list.map(e => {
      const msLeft = Math.max(0, e.expiresAt - Date.now());
      const mins = Math.floor(msLeft/60000), secs = Math.floor((msLeft%60000)/1000);
      return `<div class="ach-row"><span>🧪 ${e.name} (+${e.buffPercent}%)</span><b>${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}</b></div>`;
    }).join("")}
  `;
}

/* ===== Equipment ===== */
const EQUIP_SLOT_ORDER = ["weapon","accessory","jacket","shirt","hat","pants","boots","bracelet1","bracelet2","bracelet3","bracelet4","belt"];
let equipPickerSlot = null;

function renderEquipment(){
  const root = document.getElementById("equipRoot");
  if (equipPickerSlot){ renderEquipPicker(root); return; }

  const bonus = equipmentStatBonus();
  root.innerHTML = `
    <div class="card">
      <div class="card-title">Бонус от экипировки</div>
      <div class="equip-bonus-row"><span class="dim">Сила</span><b>+${bonus.str}</b></div>
      <div class="equip-bonus-row"><span class="dim">Ловкость</span><b>+${bonus.agi}</b></div>
      <div class="equip-bonus-row"><span class="dim">Здоровье</span><b>+${bonus.hpStat}</b></div>
      <div class="equip-bonus-row"><span class="dim">Удача</span><b>+${bonus.luck}</b></div>
    </div>
    <div class="equip-grid" id="equipGrid"></div>
  `;
  const grid = document.getElementById("equipGrid");
  EQUIP_SLOT_ORDER.forEach(slotKey => {
    const item = getEquippedItem(slotKey);
    const el = document.createElement("div");
    el.className = "equip-slot" + (item ? " filled" : "");
    el.innerHTML = `
      <span class="es-icon">${item ? iconHtml(item.icon) : EQUIP_SLOT_ICONS[slotKey]}</span>
      <span class="es-label">${EQUIP_SLOT_LABELS[slotKey]}</span>
      <span class="es-item">${item ? `${item.rarity?`<span class="rarity-dot rarity-${item.rarity}"></span>`:""}${item.name}` : "пусто"}</span>
      ${item ? `<span class="es-stat">${itemStatDesc(item)}</span>` : ""}
    `;
    el.addEventListener("click", () => { equipPickerSlot = slotKey; renderEquipment(); });
    grid.appendChild(el);
  });
}

function renderEquipPicker(root){
  const slotKey = equipPickerSlot;
  const current = getEquippedItem(slotKey);
  const compatible = state.inventory.filter(it => it.count > 0 && slotAcceptsItem(slotKey, it));

  root.innerHTML = `
    <div class="row-between" style="margin-bottom:10px;">
      <button class="btn ghost small" id="equipBackBtn">‹ Назад</button>
      <b>${EQUIP_SLOT_LABELS[slotKey]}</b>
      <span></span>
    </div>
    ${current ? `<button class="btn ghost full" id="unequipBtn" style="margin-bottom:10px;">Снять «${current.name}»</button>` : ""}
    <div class="clan-list" id="pickerList"></div>
  `;
  const list = document.getElementById("pickerList");
  if (compatible.length === 0){
    list.innerHTML = `<p class="dim center-pad">Нет подходящих предметов в инвентаре.</p>`;
  }
  compatible.forEach(it => {
    const isEquipped = state.player.equipment[slotKey] === it.id;
    const desc = itemStatDesc(it) + (!isEquipped ? itemCompareDelta(it, current) : "");
    const el = document.createElement("div");
    el.className = "picker-item";
    el.innerHTML = `
      <span class="pi-icon">${iconHtml(it.icon)}</span>
      <div class="pi-info"><div class="pi-name">${it.rarity?`<span class="rarity-dot rarity-${it.rarity}"></span>`:""}${it.name}${isEquipped?" (экипировано)":""}</div><div class="pi-desc">${desc}</div></div>
      <button class="btn ${isEquipped?"ghost":"primary"} small">${isEquipped?"Снять":"Надеть"}</button>
    `;
    el.querySelector("button").addEventListener("click", () => {
      if (isEquipped) unequipItem(slotKey); else equipItem(slotKey, it.id);
      renderEquipment(); renderCharacter(); renderHome();
    });
    list.appendChild(el);
  });
  document.getElementById("equipBackBtn").addEventListener("click", () => { equipPickerSlot = null; renderEquipment(); });
  if (current) document.getElementById("unequipBtn").addEventListener("click", () => { unequipItem(slotKey); renderEquipment(); renderCharacter(); renderHome(); });
}

function zoneLabelCap(zone){ return { head:"голова", chest:"грудь", belly:"живот", legs:"ноги" }[zone] || zone; }
function statShort(k){ return { str:"Сила", agi:"Ловк", hpStat:"Здор", luck:"Удача" }[k] || k; }

function itemStatDesc(item){
  if (item.def !== undefined) return `Защита: ${item.def}${item.zone?` (${zoneLabelCap(item.zone)})`:""}`;
  if (item.dmgMin !== undefined) return `Урон: ${item.dmgMin}-${item.dmgMax}`;
  if (item.statBonus) return "Бонус: " + Object.entries(item.statBonus).map(([k,v]) => `+${v} ${statShort(k)}`).join(", ");
  if (item.critBonus) return `Крит: +${item.critBonus}%`;
  if (item.energyRestore) return `Восстанавливает ${item.energyRestore} энергии`;
  if (item.buffPercent) return `+${item.buffPercent}% ко всем статам на 1 час`;
  if (item.hotMin !== undefined) return `Восстановление ${item.hotMin}-${item.hotMax} HP за ход в бою`;
  return "";
}
function itemCompareDelta(item, current){
  if (!current || current === item) return "";
  if (item.def !== undefined && current.def !== undefined){
    const d = item.def - current.def;
    if (d === 0) return "";
    return ` <span class="${d>0?"ok":"bad"}">(${d>0?"+":""}${d} к текущему)</span>`;
  }
  if (item.dmgMin !== undefined && current.dmgMin !== undefined){
    const avgNew = (item.dmgMin+item.dmgMax)/2, avgCur = (current.dmgMin+current.dmgMax)/2;
    const d = Math.round(avgNew-avgCur);
    if (d === 0) return "";
    return ` <span class="${d>0?"ok":"bad"}">(${d>0?"+":""}${d} ур. к текущему)</span>`;
  }
  return "";
}

/* ===== Achievements ===== */
function territoriesHeldByPlayerClan(){
  if (realClan && realClan.territories) return realClan.territories.length;
  return 0;
}

function renderAchievements(){
  const p = state.player;
  const root = document.getElementById("achRoot");
  const held = territoriesHeldByPlayerClan();
  root.innerHTML = `
    <div class="ach-card">
      <div class="card-title">🛠️ Профессии</div>
      ${professions.map(prof => {
        const count = craftRecipes.filter(r => r.profession === prof.id).length;
        const mastery = getMastery(prof.id);
        const status = mastery !== null ? `Мастерство ${mastery}` : (count ? `${count} рец.` : "скоро");
        return `<div class="ach-row"><span>${prof.icon} ${prof.name}</span><b>${status}</b></div>`;
      }).join("")}
      <div class="dim" style="margin-top:6px;">Известно рецептов: ${p.knownRecipes.length}</div>
    </div>
    <div class="ach-card">
      <div class="card-title">🏆 Арена</div>
      <div class="ach-row"><span>Очки арены (баланс)</span><b>${p.arenaPoints}</b></div>
      <div class="ach-row"><span>Репутация арены (всего)</span><b>${p.arenaRep}</b></div>
      <div class="ach-row"><span>Побед / Поражений</span><b>${p.arenaWins} / ${p.arenaLosses}</b></div>
    </div>
    <div class="ach-card">
      <div class="card-title">🏙️ Echo Territory</div>
      <div class="ach-row"><span>Жетоны (баланс)</span><b>${p.territoryTokens}</b></div>
      <div class="ach-row"><span>Репутация Echo Territory</span><b>${p.territoryRep}</b></div>
      <div class="ach-progress-label"><span>До 4-го слота лечилок в бою</span><span>${Math.min(p.territoryRep,20)} / 20</span></div>
      <div class="bar"><div class="bar-fill exp" style="width:${Math.min(100,(p.territoryRep/20)*100)}%"></div></div>
      <div class="dim" style="margin-top:8px;">${held>0 ? `Ваш клан держит ${held} ${held===1?"район":"района"} — ${held} ${held===1?"жетон":"жетона"} в сутки на игрока.` : "Ваш клан не держит территорий — жетоны не начисляются."}</div>
      <button class="btn primary full" id="claimTokensBtn" style="margin-top:6px;" ${(held===0||p.territoryClaimedToday)?"disabled":""}>
        ${p.territoryClaimedToday ? "Жетоны за сегодня уже получены" : `ПОЛУЧИТЬ ЖЕТОНЫ ЗА СЕГОДНЯ (+${held})`}
      </button>
      <button class="btn ghost full" id="convertRepBtn" style="margin-top:6px;" ${p.territoryTokens<=0?"disabled":""}>ОБМЕНЯТЬ 1 ЖЕТОН НА РЕПУТАЦИЮ</button>
      <button class="btn ghost full" id="territoryShopBtn" style="margin-top:6px;">МАГАЗИН ТЕРРИТОРИЙ</button>
    </div>
  `;
  const claimBtn = document.getElementById("claimTokensBtn");
  if (held > 0 && !p.territoryClaimedToday){
    claimBtn.addEventListener("click", () => {
      p.territoryTokens += held;
      p.territoryClaimedToday = true;
      toast(`Получено ${held} ${held===1?"жетон":"жетона"} Echo Territory`);
      renderAchievements();
    });
  }
  const convertBtn = document.getElementById("convertRepBtn");
  if (p.territoryTokens > 0){
    convertBtn.addEventListener("click", () => {
      p.territoryTokens--;
      p.territoryRep++;
      if (p.territoryRep >= 20 && !p.healSlotUnlocked){
        p.healSlotUnlocked = true;
        toast("Открыт 4-й слот лечилок в бою!");
      } else {
        toast("Жетон обменян на +1 репутацию Echo Territory");
      }
      renderAchievements();
    });
  }
  document.getElementById("territoryShopBtn").addEventListener("click", () => {
    toast("Магазин территорий в разработке — ассортимент появится с системой профессий");
  });
}

document.querySelectorAll(".stat-plus").forEach(btn => {
  btn.addEventListener("click", () => {
    const p = state.player;
    if (p.freePoints <= 0) return;
    const key = btn.dataset.stat === "hp" ? "hpStat" : btn.dataset.stat;
    p.stats[key]++;
    p.freePoints--;
    if (key === "hpStat"){ p.maxHp += 5; p.hp += 5; }
    renderCharacter();
    renderHome();
    toast("Очко распределено");
  });
});

document.querySelectorAll('.tabs[data-group="charTab"] .tab').forEach(t => {
  t.addEventListener("click", () => switchTab("charTab", t.dataset.tab));
});
function switchTab(group, tab){
  document.querySelectorAll(`.tabs[data-group="${group}"] .tab`).forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  if (group === "charTab"){
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === tab));
    if (tab === "equip") renderEquipment();
    if (tab === "ach") renderAchievements();
  }
  if (group === "invTab") renderInventory(tab);
  if (group === "shopTab") renderShop(tab);
  if (group === "chatTab") renderChatTab(tab);
}

/* ===== Render: Inventory ===== */
document.querySelectorAll('.tabs[data-group="invTab"] .tab').forEach(t => {
  t.addEventListener("click", () => switchTab("invTab", t.dataset.tab));
});
let currentInvFilter = "all";
let invDetailItemId = null;

function renderInventory(filter){
  currentInvFilter = filter;
  renderCombatLoadout();
  const grid = document.getElementById("invGrid");
  grid.innerHTML = "";
  const items = state.inventory.filter(i => filter === "all" || i.cat === filter);
  items.forEach(i => {
    const el = document.createElement("div");
    el.className = "inv-item" + (invDetailItemId === i.id ? " selected" : "");
    el.innerHTML = `<span class="ii-icon">${iconHtml(i.icon)}</span><span class="ii-name">${i.rarity?`<span class="rarity-dot rarity-${i.rarity}"></span>`:""}${i.name}</span>${i.count>1?`<span class="ii-count">x${i.count}</span>`:""}`;
    el.addEventListener("click", () => { invDetailItemId = i.id; renderInventory(filter); });
    grid.appendChild(el);
  });
  document.getElementById("invCap").textContent = `${state.capacity.used} / ${state.capacity.max}`;
  renderInvDetail();
}

function renderInvDetail(){
  const box = document.getElementById("invDetail");
  if (!box) return;
  if (!invDetailItemId){ box.innerHTML = ""; return; }
  const item = findItem(invDetailItemId);
  if (!item){ invDetailItemId = null; box.innerHTML = ""; return; }
  const desc = itemStatDesc(item);
  const equippedHere = item.equipSlot ? getEquippedItem(item.equipSlot) : null;
  const compareNote = equippedHere && equippedHere !== item ? `<p class="dim" style="margin:0 0 8px;font-size:11.5px;">Сейчас надето: ${equippedHere.name}${itemCompareDelta(item, equippedHere)}</p>` : "";
  let actions = "";
  if (item.energyRestore) actions += `<button class="btn primary small" id="invUseBtn">Съесть</button>`;
  else if (item.buffPercent) actions += `<button class="btn primary small" id="invUseBtn">Выпить</button>`;
  if (item.cat !== "material") actions += `<button class="btn ghost small" id="invSellBtn">На аукцион</button>`;
  actions += `<button class="btn ghost small" id="invDropBtn">Выбросить</button>`;
  box.innerHTML = `
    <div class="card">
      <div class="row-between" style="margin-bottom:6px;">
        <div class="card-title" style="margin:0;">${item.rarity?`<span class="rarity-dot rarity-${item.rarity}"></span>`:""}${item.name}</div>
        <button class="icon-btn small" id="invDetailClose">✕</button>
      </div>
      ${desc?`<p class="dim" style="margin:0 0 8px;">${desc}</p>`:""}
      ${compareNote}
      <p class="dim" style="margin:0 0 10px;">Количество: ${item.count}</p>
      <div class="row-between" style="gap:8px;flex-wrap:wrap;">${actions}</div>
    </div>
  `;
  document.getElementById("invDetailClose").addEventListener("click", () => { invDetailItemId = null; renderInventory(currentInvFilter); });
  const useBtn = document.getElementById("invUseBtn");
  if (useBtn) useBtn.addEventListener("click", () => {
    invDetailItemId = null;
    if (item.energyRestore) eatFood(item); else drinkElixir(item);
  });
  const sellBtn = document.getElementById("invSellBtn");
  if (sellBtn) sellBtn.addEventListener("click", () => {
    auctionSellItemId = item.id;
    auctionView = "mine";
    invDetailItemId = null;
    showScreen("auction");
  });
  document.getElementById("invDropBtn").addEventListener("click", () => dropItem(item));
}

function dropItem(item){
  item.count--;
  if (item.count <= 0){
    state.inventory = state.inventory.filter(x => x !== item);
    Object.keys(state.player.equipment).forEach(slot => {
      if (state.player.equipment[slot] === item.id) state.player.equipment[slot] = null;
    });
    invDetailItemId = null;
  }
  toast(`Выброшено: ${item.name}`);
  renderInventory(currentInvFilter);
  renderHome();
}
function eatFood(item){
  const p = state.player;
  if (p.energy >= p.maxEnergy){ toast("Энергия уже полная"); return; }
  item.count--;
  if (item.count <= 0) state.inventory = state.inventory.filter(x => x !== item);
  p.energy = Math.min(p.maxEnergy, p.energy + item.energyRestore);
  renderHome();
  renderInventory("all");
  toast(`Съедено: ${item.name} (+${item.energyRestore} энергии)`);
}
function inBattle(){ return !!enemy && !battleOver; }
function drinkElixir(item){
  const p = state.player;
  if (inBattle()){ toast("Эликсиры можно пить только вне боя"); return; }
  cleanExpiredElixirs();
  const already = p.activeElixirs.find(e => e.id === item.id);
  if (!already && p.activeElixirs.length >= MAX_ACTIVE_ELIXIRS){
    toast(`Можно держать не больше ${MAX_ACTIVE_ELIXIRS} разных эликсиров одновременно`);
    return;
  }
  item.count--;
  if (item.count <= 0) state.inventory = state.inventory.filter(x => x !== item);
  const expiresAt = Date.now() + ELIXIR_DURATION_MS;
  if (already) already.expiresAt = expiresAt;
  else p.activeElixirs.push({ id:item.id, name:item.name, buffPercent:item.buffPercent, expiresAt });
  renderHome();
  renderInventory("all");
  toast(`Выпит ${item.name}: +${item.buffPercent}% ко всем статам на 1 час`);
}
document.getElementById("expandInvBtn").addEventListener("click", () => {
  if (state.player.rub < 1000){ toast("Недостаточно Т для расширения"); return; }
  state.player.rub -= 1000;
  state.capacity.max += 10;
  renderHome();
  renderInventory("all");
  toast("Вместимость инвентаря увеличена на 10 (−1000 Т)");
});

/* ===== Render: Professions ===== */
function getMastery(profId){
  if (profId === "povar") return state.player.povarMastery;
  if (profId === "travnik") return state.player.travnikMastery;
  if (profId === "farmacevt") return state.player.farmacevtMastery;
  if (profId === "oruzejnik") return state.player.oruzejnikMastery;
  if (profId === "juvelir") return state.player.juvelirMastery;
  if (profId === "portnoy") return state.player.portnoyMastery;
  return null;
}

function renderCraft(){
  const root = document.getElementById("professionsRoot");
  if (selectedProfessionId){ renderProfessionDetail(root); return; }
  root.innerHTML = `<div class="clan-list" id="professionList"></div>`;
  const list = document.getElementById("professionList");
  professions.forEach(prof => {
    const count = craftRecipes.filter(r => r.profession === prof.id).length;
    const mastery = getMastery(prof.id);
    const status = mastery !== null ? `Мастерство ${mastery}` : (count ? count+" рец." : "скоро");
    const el = document.createElement("div");
    el.className = "clan-row";
    el.innerHTML = `
      <div class="clan-emblem" style="background:#242428;">${prof.icon}</div>
      <div class="clan-row-info">
        <div class="clan-row-name">${prof.name}</div>
        <div class="clan-row-sub">${prof.desc}</div>
      </div>
      <span class="dim" style="font-size:11px;white-space:nowrap;">${status}</span>
    `;
    el.addEventListener("click", () => { selectedProfessionId = prof.id; selectedCraftId = null; renderCraft(); });
    list.appendChild(el);
  });
}

function renderProfessionDetail(root){
  const prof = professions.find(p => p.id === selectedProfessionId);
  if (prof.id === "povar"){ renderPovarDetail(root, prof); return; }
  if (prof.id === "travnik"){ renderTravnikDetail(root, prof); return; }
  if (prof.id === "farmacevt"){ renderFarmacevtDetail(root, prof); return; }
  if (prof.id === "oruzejnik"){ renderOruzejnikDetail(root, prof); return; }
  if (prof.id === "juvelir"){ renderJuvelirDetail(root, prof); return; }
  if (prof.id === "portnoy"){ renderPortnoyDetail(root, prof); return; }
  const recipes = craftRecipes.filter(r => r.profession === prof.id);
  if (!selectedCraftId && recipes.length) selectedCraftId = recipes[0].id;

  root.innerHTML = `
    <div class="row-between" style="margin-bottom:10px;">
      <button class="btn ghost small" id="profBackBtn">‹ Назад</button>
      <b>${prof.icon} ${prof.name}</b>
      <span></span>
    </div>
    ${recipes.length ? `
      <div class="craft-layout">
        <div class="craft-list" id="craftList"></div>
        <div class="craft-detail card" id="craftDetail"></div>
      </div>
    ` : `<p class="dim center-pad">Рецепты этой профессии появятся позже.</p>`}
  `;
  document.getElementById("profBackBtn").addEventListener("click", () => { selectedProfessionId = null; renderCraft(); });
  if (!recipes.length) return;

  const list = document.getElementById("craftList");
  recipes.forEach(r => {
    const locked = state.player.level < r.reqLevel;
    const el = document.createElement("button");
    el.className = "craft-list-item" + (r.id===selectedCraftId?" selected":"") + (locked?" locked":"");
    el.innerHTML = `${r.icon} ${r.name}${locked?`<small>нужен ур. ${r.reqLevel}</small>`:""}`;
    el.addEventListener("click", () => { selectedCraftId = r.id; renderProfessionDetail(root); });
    list.appendChild(el);
  });
  renderCraftDetail();
}

let craftQty = 1;
function renderCraftDetail(){
  const r = craftRecipes.find(x => x.id === selectedCraftId);
  const detail = document.getElementById("craftDetail");
  const locked = state.player.level < r.reqLevel;
  const reqsHtml = r.reqs.map(req => {
    const have = itemCount(req.id);
    const need = req.need * craftQty;
    const ok = have >= need;
    const mat = state.inventory.find(i=>i.id===req.id);
    return `<div class="req-row"><span>${mat.icon} ${mat.name}</span><span class="${ok?"ok":"bad"}">${have} / ${need}</span></div>`;
  }).join("");
  const canCraft = !locked && r.reqs.every(req => itemCount(req.id) >= req.need * craftQty);

  detail.innerHTML = `
    <div class="craft-preview">${r.icon}</div>
    <div class="card-title">${r.name}</div>
    <p class="dim">${r.desc}</p>
    <div class="dim" style="font-weight:600;">Требования:</div>
    <div class="req-list">${reqsHtml}</div>
    <div class="qty-row">
      <button id="qtyMinus">−</button>
      <span id="qtyVal">${craftQty}</span>
      <button id="qtyPlus">+</button>
    </div>
    <button class="btn primary full" id="craftBtn" ${canCraft?"":"disabled"}>${locked?`НУЖЕН УРОВЕНЬ ${r.reqLevel}`:"СОЗДАТЬ"}</button>
    <div class="dim">Время создания: ${formatTime(r.time*craftQty)}</div>
  `;

  document.getElementById("qtyMinus").addEventListener("click", () => { if (craftQty>1){craftQty--; renderCraftDetail();} });
  document.getElementById("qtyPlus").addEventListener("click", () => { craftQty++; renderCraftDetail(); });
  if (canCraft) document.getElementById("craftBtn").addEventListener("click", () => doCraft(r));
}

function formatTime(sec){
  const m = Math.floor(sec/60), s = sec%60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function doCraft(r){
  r.reqs.forEach(req => { spendItem(findItem(req.id), req.need * craftQty); });
  const existing = findItem(r.id);
  if (existing) existing.count += craftQty;
  else state.inventory.push({ id:r.id, name:r.name, icon:r.icon, cat:"weapon", count:craftQty });
  craftQty = 1;
  renderCraft();
  renderInventory("all");
  toast(`Создано: ${r.name}`);
}

/* ===== Повар: рыбалка и готовка ===== */
let povarView = "fishing";
let fishingActive = false, fishingSecondsLeft = 0, fishingTargetId = null, fishingHandle = null;
let cookingActive = false, cookingSecondsLeft = 0, cookingTargetId = null, cookingHandle = null;

function renderPovarDetail(root, prof){
  root.innerHTML = `
    <div class="row-between" style="margin-bottom:10px;">
      <button class="btn ghost small" id="profBackBtn">‹ Назад</button>
      <b>${prof.icon} ${prof.name}</b>
      <span></span>
    </div>
    <div class="tabs" data-group="povarTab">
      <button class="tab ${povarView==="fishing"?"active":""}" data-tab="fishing">Рыбалка</button>
      <button class="tab ${povarView==="recipes"?"active":""}" data-tab="recipes">Рецепты</button>
    </div>
    <div id="povarBody"></div>
  `;
  document.getElementById("profBackBtn").addEventListener("click", () => { selectedProfessionId = null; renderCraft(); });
  document.querySelectorAll('.tabs[data-group="povarTab"] .tab').forEach(t => {
    t.addEventListener("click", () => { povarView = t.dataset.tab; renderPovarDetail(root, prof); });
  });
  if (povarView === "fishing") renderFishingView(); else renderCookingView();
}

function renderFishingView(){
  const p = state.player;
  const body = document.getElementById("povarBody");
  if (!body) return;
  const hasRod = p.rodDurability !== null && p.rodDurability > 0;
  const atPier = currentDistrictId === "pristan";
  body.innerHTML = `
    <div class="card">
      <div class="card-title">🏞️ Пристань</div>
      <div class="dim">Мастерство: ${p.povarMastery} · Удочка: ${hasRod ? p.rodDurability+"/"+ROD_MAX_DURABILITY : "нет — купите в магазине"}</div>
      ${!atPier ? `<div class="dim" style="color:#e0a83f;margin-top:6px;">Нужно физически переместиться на Пристань (Карта города), чтобы рыбачить.</div>` : ""}
      ${fishingActive ? `<div class="war-timer-big" id="fishTimer" style="margin-top:8px;">${formatTime(fishingSecondsLeft)}</div><div class="war-status-label">Ловим: ${fishSpecies.find(f=>f.id===fishingTargetId).name}</div>` : ""}
    </div>
    <div class="clan-list" id="fishList"></div>
  `;
  const list = document.getElementById("fishList");
  fishSpecies.forEach(f => {
    const locked = p.povarMastery < f.masteryReq;
    const disabled = locked || !hasRod || fishingActive || !atPier;
    const el = document.createElement("div");
    el.className = "npc-row";
    el.innerHTML = `
      <div class="npc-avatar">${f.icon}</div>
      <div class="npc-main">
        <div class="npc-name">${f.name}</div>
        <div class="npc-sub">Мастерство ${f.masteryReq}+ · улов ${f.catchMin}-${f.catchMax} за 10 мин · есть: ${itemCount(f.id)}</div>
      </div>
      <button class="btn ${disabled?"ghost":"primary"} small" ${disabled?"disabled":""}>Ловить</button>
    `;
    if (!disabled){
      el.querySelector("button").addEventListener("click", () => startFishing(f.id));
    }
    list.appendChild(el);
  });
}

function startFishing(fishId){
  if (currentDistrictId !== "pristan"){ toast("Нужно быть на Пристани"); return; }
  if (isBusy()){ toast(`Вы заняты (${busyLabel()})`); return; }
  fishingActive = true;
  fishingTargetId = fishId;
  fishingSecondsLeft = FISHING_SECONDS;
  beginActiveJob("fishing", fishId, FISHING_SECONDS);
  renderFishingView();
  updateBusyBanner();
  clearInterval(fishingHandle);
  fishingHandle = setInterval(() => {
    fishingSecondsLeft--;
    const timerEl = document.getElementById("fishTimer");
    if (timerEl) timerEl.textContent = formatTime(fishingSecondsLeft);
    updateBusyBanner();
    if (fishingSecondsLeft <= 0){
      clearInterval(fishingHandle);
      finishFishing();
    }
  }, 1000);
}
function finishFishing(){
  endActiveJob();
  const f = fishSpecies.find(x => x.id === fishingTargetId);
  const caught = f.catchMin + Math.floor(Math.random()*(f.catchMax-f.catchMin+1));
  const existing = findItem(f.id);
  if (existing) existing.count += caught;
  else state.inventory.push({ id:f.id, name:f.name, icon:f.icon, cat:"material", count:caught });
  state.player.rodDurability--;
  fishingActive = false;
  const brokeRod = state.player.rodDurability <= 0;
  if (brokeRod){ state.player.rodDurability = null; }
  toast(`Улов: ${f.name} x${caught}${brokeRod?" — удочка сломалась!":""}`);
  notifyDone("Рыбалка завершена", `Поймано: ${f.name} x${caught}${brokeRod?". Удочка сломалась!":""}`);
  renderInventory("all");
  renderFishingView();
  updateBusyBanner();
}

function renderCookingView(){
  const p = state.player;
  const body = document.getElementById("povarBody");
  if (!body) return;
  const known = cookRecipes.filter(r => p.knownRecipes.includes(r.id));
  body.innerHTML = cookingActive ? `
    <div class="card">
      <div class="card-title">Готовим: ${cookRecipes.find(r=>r.id===cookingTargetId).name}</div>
      <div class="war-timer-big" id="cookTimer">${formatTime(cookingSecondsLeft)}</div>
    </div>
  ` : (known.length ? `<div class="clan-list" id="cookList"></div>` : `<p class="dim center-pad">Нет изученных рецептов. Купите их в магазине «Всё для повара».</p>`);
  if (cookingActive || !known.length) return;
  const list = document.getElementById("cookList");
  known.forEach(r => {
    const have = itemCount(r.fishId);
    const havePlate = itemCount("plate");
    const canCook = have >= 5 && havePlate >= 1;
    const fishName = fishSpecies.find(f=>f.id===r.fishId).name;
    const el = document.createElement("div");
    el.className = "npc-row";
    el.innerHTML = `
      <div class="npc-avatar">${r.icon}</div>
      <div class="npc-main">
        <div class="npc-name">${r.name}</div>
        <div class="npc-sub">5× ${fishName} (есть ${have}) + 1 Тарелка (есть ${havePlate}) · +${r.energyRestore} энергии</div>
      </div>
      <button class="btn ${canCook?"primary":"ghost"} small" ${canCook?"":"disabled"}>Готовить</button>
    `;
    if (canCook) el.querySelector("button").addEventListener("click", () => startCooking(r.id));
    list.appendChild(el);
  });
}

function startCooking(recipeId){
  if (isBusy()){ toast(`Вы заняты (${busyLabel()})`); return; }
  const r = cookRecipes.find(x => x.id === recipeId);
  spendItem(findItem(r.fishId), 5);
  spendItem(findItem("plate"), 1);
  renderInventory("all");
  cookingActive = true;
  cookingTargetId = recipeId;
  cookingSecondsLeft = COOKING_SECONDS;
  beginActiveJob("cooking", recipeId, COOKING_SECONDS);
  renderCookingView();
  updateBusyBanner();
  clearInterval(cookingHandle);
  cookingHandle = setInterval(() => {
    cookingSecondsLeft--;
    const timerEl = document.getElementById("cookTimer");
    if (timerEl) timerEl.textContent = formatTime(cookingSecondsLeft);
    updateBusyBanner();
    if (cookingSecondsLeft <= 0){
      clearInterval(cookingHandle);
      finishCooking();
    }
  }, 1000);
}
function finishCooking(){
  endActiveJob();
  const r = cookRecipes.find(x => x.id === cookingTargetId);
  const existing = findItem(r.id);
  if (existing) existing.count += 1;
  else state.inventory.push({ id:r.id, name:r.name, icon:r.icon, cat:"consumable", count:1, energyRestore:r.energyRestore });
  state.player.povarMastery++;
  cookingActive = false;
  toast(`Готово: ${r.name}! Мастерство Повара: ${state.player.povarMastery}`);
  notifyDone("Готовка завершена", `Приготовлено: ${r.name}`);
  renderInventory("all");
  renderCookingView();
  updateBusyBanner();
}

/* ===== Травник: сбор одуванчиков и варка эликсиров ===== */
let travnikView = "gather";
let gatherActive = false, gatherSecondsLeft = 0, gatherHandle = null;
let brewActive = false, brewTargetId = null, brewSecondsLeft = 0, brewHandle = null;

function renderTravnikDetail(root, prof){
  root.innerHTML = `
    <div class="row-between" style="margin-bottom:10px;">
      <button class="btn ghost small" id="profBackBtn">‹ Назад</button>
      <b>${prof.icon} ${prof.name}</b>
      <span></span>
    </div>
    <div class="tabs" data-group="travnikTab">
      <button class="tab ${travnikView==="gather"?"active":""}" data-tab="gather">Сбор</button>
      <button class="tab ${travnikView==="brew"?"active":""}" data-tab="brew">Эликсиры</button>
    </div>
    <div id="travnikBody"></div>
  `;
  document.getElementById("profBackBtn").addEventListener("click", () => { selectedProfessionId = null; renderCraft(); });
  document.querySelectorAll('.tabs[data-group="travnikTab"] .tab').forEach(t => {
    t.addEventListener("click", () => { travnikView = t.dataset.tab; renderTravnikDetail(root, prof); });
  });
  if (travnikView === "gather") renderGatherView(); else renderBrewView();
}

function renderGatherView(){
  const p = state.player;
  const body = document.getElementById("travnikBody");
  if (!body) return;
  const hasSecator = p.secatorDurability !== null && p.secatorDurability > 0;
  const atField = currentDistrictId === "pustyr";
  const disabled = !hasSecator || gatherActive || !atField || isBusy();
  body.innerHTML = `
    <div class="card">
      <div class="card-title">🌼 Поле одуванчиков</div>
      <div class="dim">Мастерство: ${p.travnikMastery} · Секатор: ${hasSecator ? p.secatorDurability+"/"+SECATOR_MAX_DURABILITY : "нет — купите в магазине"} · Одуванчиков: ${itemCount("dandelion")}</div>
      ${!atField ? `<div class="dim" style="color:#e0a83f;margin-top:6px;">Нужно физически переместиться на Поле одуванчиков (Карта города), чтобы собирать.</div>` : ""}
      ${gatherActive ? `<div class="war-timer-big" id="gatherTimer" style="margin-top:8px;">${formatTime(gatherSecondsLeft)}</div><div class="war-status-label">Собираем одуванчики...</div>` : ""}
    </div>
    <button class="btn ${disabled?"ghost":"primary"} full" id="gatherBtn" ${disabled?"disabled":""}>СОБИРАТЬ (10 мин, −1 прочность, −${GATHER_DANDELION_ENERGY_COST} энергии)</button>
  `;
  if (!disabled) document.getElementById("gatherBtn").addEventListener("click", startGather);
}

function startGather(){
  if (currentDistrictId !== "pustyr"){ toast("Нужно быть на Поле одуванчиков"); return; }
  if (isBusy()){ toast(`Вы заняты (${busyLabel()})`); return; }
  if (state.player.energy < GATHER_DANDELION_ENERGY_COST){ toast("Недостаточно энергии"); return; }
  state.player.energy -= GATHER_DANDELION_ENERGY_COST;
  renderHome();
  gatherActive = true;
  gatherSecondsLeft = GATHER_DANDELION_SECONDS;
  beginActiveJob("gather", null, GATHER_DANDELION_SECONDS);
  renderGatherView();
  updateBusyBanner();
  clearInterval(gatherHandle);
  gatherHandle = setInterval(() => {
    gatherSecondsLeft--;
    const timerEl = document.getElementById("gatherTimer");
    if (timerEl) timerEl.textContent = formatTime(gatherSecondsLeft);
    updateBusyBanner();
    if (gatherSecondsLeft <= 0){
      clearInterval(gatherHandle);
      finishGather();
    }
  }, 1000);
}
function finishGather(){
  endActiveJob();
  const caught = 1 + Math.floor(Math.random()*5);
  const existing = findItem("dandelion");
  if (existing) existing.count += caught;
  else state.inventory.push({ id:"dandelion", name:"Одуванчики", icon:"🌼", cat:"material", count:caught });
  state.player.secatorDurability--;
  gatherActive = false;
  const broke = state.player.secatorDurability <= 0;
  if (broke){ state.player.secatorDurability = null; }
  toast(`Собрано: Одуванчики x${caught}${broke?" — секатор сломался!":""}`);
  notifyDone("Сбор завершён", `Собрано одуванчиков: ${caught}${broke?". Секатор сломался!":""}`);
  renderInventory("all");
  renderGatherView();
  updateBusyBanner();
}

function renderBrewView(){
  const p = state.player;
  const body = document.getElementById("travnikBody");
  if (!body) return;
  const known = elixirRecipes.filter(r => p.knownRecipes.includes(r.id));
  body.innerHTML = brewActive ? `
    <div class="card">
      <div class="card-title">Варим: ${elixirRecipes.find(r=>r.id===brewTargetId).name}</div>
      <div class="war-timer-big" id="brewTimer">${formatTime(brewSecondsLeft)}</div>
    </div>
  ` : (known.length ? `<div class="clan-list" id="brewList"></div>` : `<p class="dim center-pad">Нет изученных рецептов. Купите их в магазине «Всё для травника».</p>`);
  if (brewActive || !known.length) return;
  const list = document.getElementById("brewList");
  known.forEach(r => {
    const have = itemCount("dandelion");
    const haveVial = itemCount("vial");
    const canBrew = have >= r.dandelionsNeed && haveVial >= 1 && !isBusy();
    const el = document.createElement("div");
    el.className = "npc-row";
    el.innerHTML = `
      <div class="npc-avatar">${r.icon}</div>
      <div class="npc-main">
        <div class="npc-name">${r.name}</div>
        <div class="npc-sub">${r.dandelionsNeed}× Одуванчики (есть ${have}) + 1 Пузырёк (есть ${haveVial}) · +${r.buffPercent}% на 1 час</div>
      </div>
      <button class="btn ${canBrew?"primary":"ghost"} small" ${canBrew?"":"disabled"}>Варить</button>
    `;
    if (canBrew) el.querySelector("button").addEventListener("click", () => startBrew(r.id));
    list.appendChild(el);
  });
}

function startBrew(recipeId){
  if (isBusy()){ toast(`Вы заняты (${busyLabel()})`); return; }
  const r = elixirRecipes.find(x => x.id === recipeId);
  spendItem(findItem("dandelion"), r.dandelionsNeed);
  spendItem(findItem("vial"), 1);
  renderInventory("all");
  brewActive = true;
  brewTargetId = recipeId;
  brewSecondsLeft = BREW_SECONDS;
  beginActiveJob("brew", recipeId, BREW_SECONDS);
  renderBrewView();
  updateBusyBanner();
  clearInterval(brewHandle);
  brewHandle = setInterval(() => {
    brewSecondsLeft--;
    const timerEl = document.getElementById("brewTimer");
    if (timerEl) timerEl.textContent = formatTime(brewSecondsLeft);
    updateBusyBanner();
    if (brewSecondsLeft <= 0){
      clearInterval(brewHandle);
      finishBrew();
    }
  }, 1000);
}
function finishBrew(){
  endActiveJob();
  const r = elixirRecipes.find(x => x.id === brewTargetId);
  const existing = findItem(r.id);
  if (existing) existing.count += 1;
  else state.inventory.push({ id:r.id, name:r.name, icon:r.icon, cat:"consumable", count:1, buffPercent:r.buffPercent });
  state.player.travnikMastery++;
  brewActive = false;
  toast(`Готово: ${r.name}! Мастерство Травника: ${state.player.travnikMastery}`);
  notifyDone("Варка завершена", `Сварен эликсир: ${r.name}`);
  renderInventory("all");
  renderBrewView();
  updateBusyBanner();
}

/* ===== Фармацевт: сбор водорослей и зелья восстановления ===== */
let farmacevtView = "gather";
let seaweedActive = false, seaweedSecondsLeft = 0, seaweedHandle = null;
let potionBrewActive = false, potionBrewTargetId = null, potionBrewSecondsLeft = 0, potionBrewHandle = null;

function renderFarmacevtDetail(root, prof){
  root.innerHTML = `
    <div class="row-between" style="margin-bottom:10px;">
      <button class="btn ghost small" id="profBackBtn">‹ Назад</button>
      <b>${prof.icon} ${prof.name}</b>
      <span></span>
    </div>
    <div class="tabs" data-group="farmacevtTab">
      <button class="tab ${farmacevtView==="gather"?"active":""}" data-tab="gather">Сбор</button>
      <button class="tab ${farmacevtView==="brew"?"active":""}" data-tab="brew">Препараты</button>
    </div>
    <div id="farmacevtBody"></div>
  `;
  document.getElementById("profBackBtn").addEventListener("click", () => { selectedProfessionId = null; renderCraft(); });
  document.querySelectorAll('.tabs[data-group="farmacevtTab"] .tab').forEach(t => {
    t.addEventListener("click", () => { farmacevtView = t.dataset.tab; renderFarmacevtDetail(root, prof); });
  });
  if (farmacevtView === "gather") renderSeaweedGatherView(); else renderPotionBrewView();
}

function renderSeaweedGatherView(){
  const p = state.player;
  const body = document.getElementById("farmacevtBody");
  if (!body) return;
  const hasGloves = p.glovesDurability !== null && p.glovesDurability > 0;
  const atShore = currentDistrictId === "bereg";
  const disabled = !hasGloves || seaweedActive || !atShore || isBusy();
  body.innerHTML = `
    <div class="card">
      <div class="card-title">🏖️ Берег</div>
      <div class="dim">Мастерство: ${p.farmacevtMastery} · Перчатки: ${hasGloves ? p.glovesDurability+"/"+GLOVES_MAX_DURABILITY : "нет — купите в магазине"} · Водорослей: ${itemCount("seaweed")}</div>
      ${!atShore ? `<div class="dim" style="color:#e0a83f;margin-top:6px;">Нужно физически переместиться на Берег (Карта города), чтобы собирать.</div>` : ""}
      ${seaweedActive ? `<div class="war-timer-big" id="seaweedTimer" style="margin-top:8px;">${formatTime(seaweedSecondsLeft)}</div><div class="war-status-label">Собираем водоросли...</div>` : ""}
    </div>
    <button class="btn ${disabled?"ghost":"primary"} full" id="seaweedBtn" ${disabled?"disabled":""}>СОБИРАТЬ (10 мин, −1 прочность, −${GATHER_SEAWEED_ENERGY_COST} энергии)</button>
  `;
  if (!disabled) document.getElementById("seaweedBtn").addEventListener("click", startGatherSeaweed);
}

function startGatherSeaweed(){
  if (currentDistrictId !== "bereg"){ toast("Нужно быть на Берегу"); return; }
  if (isBusy()){ toast(`Вы заняты (${busyLabel()})`); return; }
  if (state.player.energy < GATHER_SEAWEED_ENERGY_COST){ toast("Недостаточно энергии"); return; }
  state.player.energy -= GATHER_SEAWEED_ENERGY_COST;
  renderHome();
  seaweedActive = true;
  seaweedSecondsLeft = GATHER_SEAWEED_SECONDS;
  beginActiveJob("seaweed", null, GATHER_SEAWEED_SECONDS);
  renderSeaweedGatherView();
  updateBusyBanner();
  clearInterval(seaweedHandle);
  seaweedHandle = setInterval(() => {
    seaweedSecondsLeft--;
    const timerEl = document.getElementById("seaweedTimer");
    if (timerEl) timerEl.textContent = formatTime(seaweedSecondsLeft);
    updateBusyBanner();
    if (seaweedSecondsLeft <= 0){
      clearInterval(seaweedHandle);
      finishGatherSeaweed();
    }
  }, 1000);
}
function finishGatherSeaweed(){
  endActiveJob();
  const caught = 1 + Math.floor(Math.random()*5);
  const existing = findItem("seaweed");
  if (existing) existing.count += caught;
  else state.inventory.push({ id:"seaweed", name:"Водоросли", icon:"🌿", cat:"material", count:caught });
  state.player.glovesDurability--;
  seaweedActive = false;
  const broke = state.player.glovesDurability <= 0;
  if (broke){ state.player.glovesDurability = null; }
  toast(`Собрано: Водоросли x${caught}${broke?" — перчатки порвались!":""}`);
  notifyDone("Сбор завершён", `Собрано водорослей: ${caught}${broke?". Перчатки порвались!":""}`);
  renderInventory("all");
  renderSeaweedGatherView();
  updateBusyBanner();
}

function renderPotionBrewView(){
  const p = state.player;
  const body = document.getElementById("farmacevtBody");
  if (!body) return;
  const known = potionRecipes.filter(r => p.knownRecipes.includes(r.id));
  body.innerHTML = potionBrewActive ? `
    <div class="card">
      <div class="card-title">Готовим: ${potionRecipes.find(r=>r.id===potionBrewTargetId).name}</div>
      <div class="war-timer-big" id="potionBrewTimer">${formatTime(potionBrewSecondsLeft)}</div>
    </div>
  ` : (known.length ? `<div class="clan-list" id="potionBrewList"></div>` : `<p class="dim center-pad">Нет изученных рецептов. Купите их в магазине «Всё для Фармацевта».</p>`);
  if (potionBrewActive || !known.length) return;
  const list = document.getElementById("potionBrewList");
  known.forEach(r => {
    const have = itemCount("seaweed");
    const haveThick = itemCount("thickener");
    const canBrew = have >= r.seaweedNeed && haveThick >= 1 && !isBusy();
    const el = document.createElement("div");
    el.className = "npc-row";
    el.innerHTML = `
      <div class="npc-avatar">${r.icon}</div>
      <div class="npc-main">
        <div class="npc-name">${r.name}</div>
        <div class="npc-sub">${r.seaweedNeed}× Водоросли (есть ${have}) + 1 Загуститель (есть ${haveThick}) · ${r.hotMin}-${r.hotMax} HP/ход × ${HOT_TURNS} хода</div>
      </div>
      <button class="btn ${canBrew?"primary":"ghost"} small" ${canBrew?"":"disabled"}>Готовить</button>
    `;
    if (canBrew) el.querySelector("button").addEventListener("click", () => startBrewPotion(r.id));
    list.appendChild(el);
  });
}

function startBrewPotion(recipeId){
  if (isBusy()){ toast(`Вы заняты (${busyLabel()})`); return; }
  const r = potionRecipes.find(x => x.id === recipeId);
  spendItem(findItem("seaweed"), r.seaweedNeed);
  spendItem(findItem("thickener"), 1);
  renderInventory("all");
  potionBrewActive = true;
  potionBrewTargetId = recipeId;
  potionBrewSecondsLeft = BREW_POTION_SECONDS;
  beginActiveJob("potionBrew", recipeId, BREW_POTION_SECONDS);
  renderPotionBrewView();
  updateBusyBanner();
  clearInterval(potionBrewHandle);
  potionBrewHandle = setInterval(() => {
    potionBrewSecondsLeft--;
    const timerEl = document.getElementById("potionBrewTimer");
    if (timerEl) timerEl.textContent = formatTime(potionBrewSecondsLeft);
    updateBusyBanner();
    if (potionBrewSecondsLeft <= 0){
      clearInterval(potionBrewHandle);
      finishBrewPotion();
    }
  }, 1000);
}
function finishBrewPotion(){
  endActiveJob();
  const r = potionRecipes.find(x => x.id === potionBrewTargetId);
  const existing = findItem(r.id);
  if (existing) existing.count += 1;
  else state.inventory.push({ id:r.id, name:r.name, icon:r.icon, cat:"consumable", count:1, hotMin:r.hotMin, hotMax:r.hotMax });
  state.player.farmacevtMastery++;
  potionBrewActive = false;
  toast(`Готово: ${r.name}! Мастерство Фармацевта: ${state.player.farmacevtMastery}`);
  notifyDone("Приготовление завершено", `Готово: ${r.name}`);
  renderInventory("all");
  renderPotionBrewView();
  updateBusyBanner();
}

/* ===== Оружейник: сбор лома и ковка оружия с оглушением ===== */
let oruzejnikView = "gather";
let scrapActive = false, scrapSecondsLeft = 0, scrapHandle = null;
let forgeActive = false, forgeTargetId = null, forgeSecondsLeft = 0, forgeHandle = null;

function renderOruzejnikDetail(root, prof){
  root.innerHTML = `
    <div class="row-between" style="margin-bottom:10px;">
      <button class="btn ghost small" id="profBackBtn">‹ Назад</button>
      <b>${prof.icon} ${prof.name}</b>
      <span></span>
    </div>
    <div class="tabs" data-group="oruzejnikTab">
      <button class="tab ${oruzejnikView==="gather"?"active":""}" data-tab="gather">Сбор</button>
      <button class="tab ${oruzejnikView==="forge"?"active":""}" data-tab="forge">Ковка</button>
    </div>
    <div id="oruzejnikBody"></div>
  `;
  document.getElementById("profBackBtn").addEventListener("click", () => { selectedProfessionId = null; renderCraft(); });
  document.querySelectorAll('.tabs[data-group="oruzejnikTab"] .tab').forEach(t => {
    t.addEventListener("click", () => { oruzejnikView = t.dataset.tab; renderOruzejnikDetail(root, prof); });
  });
  if (oruzejnikView === "gather") renderScrapGatherView(); else renderForgeView();
}

function renderScrapGatherView(){
  const p = state.player;
  const body = document.getElementById("oruzejnikBody");
  if (!body) return;
  const hasCutter = p.cutterDurability !== null && p.cutterDurability > 0;
  const atSvalka = currentDistrictId === "svalka";
  const disabled = !hasCutter || scrapActive || !atSvalka || isBusy();
  body.innerHTML = `
    <div class="card">
      <div class="card-title">🏚️ Свалка</div>
      <div class="dim">Мастерство: ${p.oruzejnikMastery} · Кусачки: ${hasCutter ? p.cutterDurability+"/"+CUTTER_MAX_DURABILITY : "нет — купите в магазине"} · Ценного лома: ${itemCount("scrap")}</div>
      ${!atSvalka ? `<div class="dim" style="color:#e0a83f;margin-top:6px;">Нужно физически переместиться на Свалку (Карта города), чтобы собирать.</div>` : ""}
      ${scrapActive ? `<div class="war-timer-big" id="scrapTimer" style="margin-top:8px;">${formatTime(scrapSecondsLeft)}</div><div class="war-status-label">Собираем лом...</div>` : ""}
    </div>
    <button class="btn ${disabled?"ghost":"primary"} full" id="scrapBtn" ${disabled?"disabled":""}>СОБИРАТЬ (10 мин, −1 прочность, −${GATHER_SCRAP_ENERGY_COST} энергии)</button>
  `;
  if (!disabled) document.getElementById("scrapBtn").addEventListener("click", startGatherScrap);
}

function startGatherScrap(){
  if (currentDistrictId !== "svalka"){ toast("Нужно быть на Свалке"); return; }
  if (isBusy()){ toast(`Вы заняты (${busyLabel()})`); return; }
  if (state.player.energy < GATHER_SCRAP_ENERGY_COST){ toast("Недостаточно энергии"); return; }
  state.player.energy -= GATHER_SCRAP_ENERGY_COST;
  renderHome();
  scrapActive = true;
  scrapSecondsLeft = GATHER_SCRAP_SECONDS;
  beginActiveJob("scrap", null, GATHER_SCRAP_SECONDS);
  renderScrapGatherView();
  updateBusyBanner();
  clearInterval(scrapHandle);
  scrapHandle = setInterval(() => {
    scrapSecondsLeft--;
    const timerEl = document.getElementById("scrapTimer");
    if (timerEl) timerEl.textContent = formatTime(scrapSecondsLeft);
    updateBusyBanner();
    if (scrapSecondsLeft <= 0){
      clearInterval(scrapHandle);
      finishGatherScrap();
    }
  }, 1000);
}
function finishGatherScrap(){
  endActiveJob();
  const caught = 1 + Math.floor(Math.random()*5);
  const existing = findItem("scrap");
  if (existing) existing.count += caught;
  else state.inventory.push({ id:"scrap", name:"Ценный лом", icon:"🧲", cat:"material", count:caught });
  const bonusMetal = 2 + Math.floor(Math.random()*3);
  const bonusBolts = 1 + Math.floor(Math.random()*3);
  const em = findItem("metal"); if (em) em.count += bonusMetal; else state.inventory.push({ id:"metal", name:"Металл", icon:"⚙️", cat:"material", count:bonusMetal });
  const eb = findItem("bolts"); if (eb) eb.count += bonusBolts; else state.inventory.push({ id:"bolts", name:"Болты", icon:"🔩", cat:"material", count:bonusBolts });
  state.player.cutterDurability--;
  scrapActive = false;
  const broke = state.player.cutterDurability <= 0;
  if (broke){ state.player.cutterDurability = null; }
  toast(`Собрано: Ценный лом x${caught}, Металл x${bonusMetal}, Болты x${bonusBolts}${broke?" — кусачки сломались!":""}`);
  notifyDone("Сбор завершён", `Собрано лома: ${caught}${broke?". Кусачки сломались!":""}`);
  renderInventory("all");
  renderScrapGatherView();
  updateBusyBanner();
}

function renderForgeView(){
  const p = state.player;
  const body = document.getElementById("oruzejnikBody");
  if (!body) return;
  const known = smithRecipes.filter(r => p.knownRecipes.includes(r.id));
  body.innerHTML = forgeActive ? `
    <div class="card">
      <div class="card-title">Куём: ${smithRecipes.find(r=>r.id===forgeTargetId).name}</div>
      <div class="war-timer-big" id="forgeTimer">${formatTime(forgeSecondsLeft)}</div>
    </div>
  ` : (known.length ? `<div class="clan-list" id="forgeList"></div>` : `<p class="dim center-pad">Нет изученных рецептов. Купите их в магазине «Всё для Оружейника».</p>`);
  if (forgeActive || !known.length) return;
  const list = document.getElementById("forgeList");
  known.forEach(r => {
    const have = itemCount("scrap");
    const haveCoal = itemCount("coal");
    const canForge = have >= r.scrapNeed && haveCoal >= 1 && !isBusy();
    const el = document.createElement("div");
    el.className = "npc-row";
    el.innerHTML = `
      <div class="npc-avatar">${r.icon}</div>
      <div class="npc-main">
        <div class="npc-name">${r.name}</div>
        <div class="npc-sub">${r.scrapNeed}× Ценный лом (есть ${have}) + 1 Уголь (есть ${haveCoal}) · Урон ${r.dmgMin}-${r.dmgMax}, оглушение ${r.stunChance}%</div>
      </div>
      <button class="btn ${canForge?"primary":"ghost"} small" ${canForge?"":"disabled"}>Ковать</button>
    `;
    if (canForge) el.querySelector("button").addEventListener("click", () => startForge(r.id));
    list.appendChild(el);
  });
}

function startForge(recipeId){
  if (isBusy()){ toast(`Вы заняты (${busyLabel()})`); return; }
  const r = smithRecipes.find(x => x.id === recipeId);
  spendItem(findItem("scrap"), r.scrapNeed);
  spendItem(findItem("coal"), 1);
  renderInventory("all");
  forgeActive = true;
  forgeTargetId = recipeId;
  forgeSecondsLeft = FORGE_SECONDS;
  beginActiveJob("forge", recipeId, FORGE_SECONDS);
  renderForgeView();
  updateBusyBanner();
  clearInterval(forgeHandle);
  forgeHandle = setInterval(() => {
    forgeSecondsLeft--;
    const timerEl = document.getElementById("forgeTimer");
    if (timerEl) timerEl.textContent = formatTime(forgeSecondsLeft);
    updateBusyBanner();
    if (forgeSecondsLeft <= 0){
      clearInterval(forgeHandle);
      finishForge();
    }
  }, 1000);
}
function finishForge(){
  endActiveJob();
  const r = smithRecipes.find(x => x.id === forgeTargetId);
  const existing = findItem(r.id);
  if (existing) existing.count += 1;
  else state.inventory.push({ id:r.id, name:r.name, icon:r.icon, cat:"weapon", count:1, equipSlot:"weapon", dmgMin:r.dmgMin, dmgMax:r.dmgMax, stunChance:r.stunChance });
  state.player.oruzejnikMastery++;
  forgeActive = false;
  toast(`Готово: ${r.name}! Мастерство Оружейника: ${state.player.oruzejnikMastery}`);
  notifyDone("Ковка завершена", `Готово: ${r.name}`);
  renderInventory("all");
  renderForgeView();
  updateBusyBanner();
}

/* ===== Ювелир: сбор камней, браслеты и самоцветы крита ===== */
let juvelirView = "gather";
let gemActive = false, gemSecondsLeft = 0, gemHandle = null;
let setActive = false, setTargetId = null, setSecondsLeft = 0, setHandle = null;

function renderJuvelirDetail(root, prof){
  root.innerHTML = `
    <div class="row-between" style="margin-bottom:10px;">
      <button class="btn ghost small" id="profBackBtn">‹ Назад</button>
      <b>${prof.icon} ${prof.name}</b>
      <span></span>
    </div>
    <div class="tabs" data-group="juvelirTab">
      <button class="tab ${juvelirView==="gather"?"active":""}" data-tab="gather">Сбор</button>
      <button class="tab ${juvelirView==="set"?"active":""}" data-tab="set">Огранка</button>
    </div>
    <div id="juvelirBody"></div>
  `;
  document.getElementById("profBackBtn").addEventListener("click", () => { selectedProfessionId = null; renderCraft(); });
  document.querySelectorAll('.tabs[data-group="juvelirTab"] .tab').forEach(t => {
    t.addEventListener("click", () => { juvelirView = t.dataset.tab; renderJuvelirDetail(root, prof); });
  });
  if (juvelirView === "gather") renderGemGatherView(); else renderSetView();
}

function renderGemGatherView(){
  const p = state.player;
  const body = document.getElementById("juvelirBody");
  if (!body) return;
  const hasSaw = p.sawDurability !== null && p.sawDurability > 0;
  const atPriisk = currentDistrictId === "priisk";
  const disabled = !hasSaw || gemActive || !atPriisk || isBusy();
  body.innerHTML = `
    <div class="card">
      <div class="card-title">⛏️ Прииск</div>
      <div class="dim">Мастерство: ${p.juvelirMastery} · Пила: ${hasSaw ? p.sawDurability+"/"+SAW_MAX_DURABILITY : "нет — купите в магазине"} · Камней: ${itemCount("gem")}</div>
      ${!atPriisk ? `<div class="dim" style="color:#e0a83f;margin-top:6px;">Нужно физически переместиться на Прииск (Карта города), чтобы собирать.</div>` : ""}
      ${gemActive ? `<div class="war-timer-big" id="gemTimer" style="margin-top:8px;">${formatTime(gemSecondsLeft)}</div><div class="war-status-label">Добываем камни...</div>` : ""}
    </div>
    <button class="btn ${disabled?"ghost":"primary"} full" id="gemBtn" ${disabled?"disabled":""}>ДОБЫВАТЬ (10 мин, −1 прочность, −${GATHER_GEM_ENERGY_COST} энергии)</button>
  `;
  if (!disabled) document.getElementById("gemBtn").addEventListener("click", startGatherGem);
}

function startGatherGem(){
  if (currentDistrictId !== "priisk"){ toast("Нужно быть на Прииске"); return; }
  if (isBusy()){ toast(`Вы заняты (${busyLabel()})`); return; }
  if (state.player.energy < GATHER_GEM_ENERGY_COST){ toast("Недостаточно энергии"); return; }
  state.player.energy -= GATHER_GEM_ENERGY_COST;
  renderHome();
  gemActive = true;
  gemSecondsLeft = GATHER_GEM_SECONDS;
  beginActiveJob("gem", null, GATHER_GEM_SECONDS);
  renderGemGatherView();
  updateBusyBanner();
  clearInterval(gemHandle);
  gemHandle = setInterval(() => {
    gemSecondsLeft--;
    const timerEl = document.getElementById("gemTimer");
    if (timerEl) timerEl.textContent = formatTime(gemSecondsLeft);
    updateBusyBanner();
    if (gemSecondsLeft <= 0){
      clearInterval(gemHandle);
      finishGatherGem();
    }
  }, 1000);
}
function finishGatherGem(){
  endActiveJob();
  const caught = 1 + Math.floor(Math.random()*5);
  const existing = findItem("gem");
  if (existing) existing.count += caught;
  else state.inventory.push({ id:"gem", name:"Драгоценный камень", icon:"💎", cat:"material", count:caught });
  const bonusMetal = 1 + Math.floor(Math.random()*3);
  const bonusWire = 1 + Math.floor(Math.random()*3);
  const bonusBolts = 1 + Math.floor(Math.random()*2);
  const em = findItem("metal"); if (em) em.count += bonusMetal; else state.inventory.push({ id:"metal", name:"Металл", icon:"⚙️", cat:"material", count:bonusMetal });
  const ew = findItem("wire"); if (ew) ew.count += bonusWire; else state.inventory.push({ id:"wire", name:"Проволока", icon:"🔗", cat:"material", count:bonusWire });
  const eb = findItem("bolts"); if (eb) eb.count += bonusBolts; else state.inventory.push({ id:"bolts", name:"Болты", icon:"🔩", cat:"material", count:bonusBolts });
  state.player.sawDurability--;
  gemActive = false;
  const broke = state.player.sawDurability <= 0;
  if (broke){ state.player.sawDurability = null; }
  toast(`Добыто: Камни x${caught}, Металл x${bonusMetal}, Проволока x${bonusWire}, Болты x${bonusBolts}${broke?" — пила сломалась!":""}`);
  notifyDone("Добыча завершена", `Добыто камней: ${caught}${broke?". Пила сломалась!":""}`);
  renderInventory("all");
  renderGemGatherView();
  updateBusyBanner();
}

function renderSetView(){
  const p = state.player;
  const body = document.getElementById("juvelirBody");
  if (!body) return;
  const known = jewelryRecipes.filter(r => p.knownRecipes.includes(r.id));
  body.innerHTML = setActive ? `
    <div class="card">
      <div class="card-title">Огранка: ${jewelryRecipes.find(r=>r.id===setTargetId).name}</div>
      <div class="war-timer-big" id="setTimer">${formatTime(setSecondsLeft)}</div>
    </div>
  ` : (known.length ? `<div class="clan-list" id="setList"></div>` : `<p class="dim center-pad">Нет изученных рецептов. Купите их в магазине «Всё для Ювелира».</p>`);
  if (setActive || !known.length) return;
  const list = document.getElementById("setList");
  known.forEach(r => {
    const have = itemCount("gem");
    const haveMount = itemCount("mount");
    const canSet = have >= r.gemsNeed && haveMount >= 1 && !isBusy();
    const effectText = r.statBonus ? "Бонус: " + Object.entries(r.statBonus).map(([k,v]) => `+${v} ${statShort(k)}`).join(", ") : `+${r.critBonus}% шанс крита`;
    const el = document.createElement("div");
    el.className = "npc-row";
    el.innerHTML = `
      <div class="npc-avatar">${r.icon}</div>
      <div class="npc-main">
        <div class="npc-name">${r.name}</div>
        <div class="npc-sub">${r.gemsNeed}× Камни (есть ${have}) + 1 Оправа (есть ${haveMount}) · ${effectText}</div>
      </div>
      <button class="btn ${canSet?"primary":"ghost"} small" ${canSet?"":"disabled"}>Огранить</button>
    `;
    if (canSet) el.querySelector("button").addEventListener("click", () => startSet(r.id));
    list.appendChild(el);
  });
}

function startSet(recipeId){
  if (isBusy()){ toast(`Вы заняты (${busyLabel()})`); return; }
  const r = jewelryRecipes.find(x => x.id === recipeId);
  spendItem(findItem("gem"), r.gemsNeed);
  spendItem(findItem("mount"), 1);
  renderInventory("all");
  setActive = true;
  setTargetId = recipeId;
  setSecondsLeft = SET_GEM_SECONDS;
  beginActiveJob("set", recipeId, SET_GEM_SECONDS);
  renderSetView();
  updateBusyBanner();
  clearInterval(setHandle);
  setHandle = setInterval(() => {
    setSecondsLeft--;
    const timerEl = document.getElementById("setTimer");
    if (timerEl) timerEl.textContent = formatTime(setSecondsLeft);
    updateBusyBanner();
    if (setSecondsLeft <= 0){
      clearInterval(setHandle);
      finishSet();
    }
  }, 1000);
}
function finishSet(){
  endActiveJob();
  const r = jewelryRecipes.find(x => x.id === setTargetId);
  const existing = findItem(r.id);
  const equipSlot = r.statBonus ? "bracelet" : "accessory";
  if (existing) existing.count += 1;
  else state.inventory.push({ id:r.id, name:r.name, icon:r.icon, cat:"armor", count:1, equipSlot, statBonus:r.statBonus, critBonus:r.critBonus });
  state.player.juvelirMastery++;
  setActive = false;
  toast(`Готово: ${r.name}! Мастерство Ювелира: ${state.player.juvelirMastery}`);
  notifyDone("Огранка завершена", `Готово: ${r.name}`);
  renderInventory("all");
  renderSetView();
  updateBusyBanner();
}

/* ===== Портной: сбор редкой ткани и пошив золотой экипировки ===== */
let portnoyView = "gather";
let fabricActive = false, fabricSecondsLeft = 0, fabricHandle = null;
let sewActive = false, sewTargetId = null, sewSecondsLeft = 0, sewHandle = null;

function renderPortnoyDetail(root, prof){
  root.innerHTML = `
    <div class="row-between" style="margin-bottom:10px;">
      <button class="btn ghost small" id="profBackBtn">‹ Назад</button>
      <b>${prof.icon} ${prof.name}</b>
      <span></span>
    </div>
    <div class="tabs" data-group="portnoyTab">
      <button class="tab ${portnoyView==="gather"?"active":""}" data-tab="gather">Сбор</button>
      <button class="tab ${portnoyView==="sew"?"active":""}" data-tab="sew">Пошив</button>
    </div>
    <div id="portnoyBody"></div>
  `;
  document.getElementById("profBackBtn").addEventListener("click", () => { selectedProfessionId = null; renderCraft(); });
  document.querySelectorAll('.tabs[data-group="portnoyTab"] .tab').forEach(t => {
    t.addEventListener("click", () => { portnoyView = t.dataset.tab; renderPortnoyDetail(root, prof); });
  });
  if (portnoyView === "gather") renderFabricGatherView(); else renderSewView();
}

function renderFabricGatherView(){
  const p = state.player;
  const body = document.getElementById("portnoyBody");
  if (!body) return;
  const hasShears = p.shearsDurability !== null && p.shearsDurability > 0;
  const atSklad = currentDistrictId === "sklad";
  const disabled = !hasShears || fabricActive || !atSklad || isBusy();
  body.innerHTML = `
    <div class="card">
      <div class="card-title">📦 Текстильный склад</div>
      <div class="dim">Мастерство: ${p.portnoyMastery} · Ножницы: ${hasShears ? p.shearsDurability+"/"+SHEARS_MAX_DURABILITY : "нет — купите в магазине"} · Редкой ткани: ${itemCount("fabric")}</div>
      ${!atSklad ? `<div class="dim" style="color:#e0a83f;margin-top:6px;">Нужно физически переместиться на Текстильный склад (Карта города), чтобы собирать.</div>` : ""}
      ${fabricActive ? `<div class="war-timer-big" id="fabricTimer" style="margin-top:8px;">${formatTime(fabricSecondsLeft)}</div><div class="war-status-label">Ищем редкую ткань...</div>` : ""}
    </div>
    <button class="btn ${disabled?"ghost":"primary"} full" id="fabricBtn" ${disabled?"disabled":""}>СОБИРАТЬ (10 мин, −1 прочность, −${GATHER_FABRIC_ENERGY_COST} энергии)</button>
  `;
  if (!disabled) document.getElementById("fabricBtn").addEventListener("click", startGatherFabric);
}

function startGatherFabric(){
  if (currentDistrictId !== "sklad"){ toast("Нужно быть на Текстильном складе"); return; }
  if (isBusy()){ toast(`Вы заняты (${busyLabel()})`); return; }
  if (state.player.energy < GATHER_FABRIC_ENERGY_COST){ toast("Недостаточно энергии"); return; }
  state.player.energy -= GATHER_FABRIC_ENERGY_COST;
  renderHome();
  fabricActive = true;
  fabricSecondsLeft = GATHER_FABRIC_SECONDS;
  beginActiveJob("fabric", null, GATHER_FABRIC_SECONDS);
  renderFabricGatherView();
  updateBusyBanner();
  clearInterval(fabricHandle);
  fabricHandle = setInterval(() => {
    fabricSecondsLeft--;
    const timerEl = document.getElementById("fabricTimer");
    if (timerEl) timerEl.textContent = formatTime(fabricSecondsLeft);
    updateBusyBanner();
    if (fabricSecondsLeft <= 0){
      clearInterval(fabricHandle);
      finishGatherFabric();
    }
  }, 1000);
}
function finishGatherFabric(){
  endActiveJob();
  const caught = 1 + Math.floor(Math.random()*5);
  const existing = findItem("fabric");
  if (existing) existing.count += caught;
  else state.inventory.push({ id:"fabric", name:"Отрез редкой ткани", icon:"🎗️", cat:"material", count:caught });
  const bonusCloth = 2 + Math.floor(Math.random()*3);
  const bonusWire = 1 + Math.floor(Math.random()*2);
  const ec = findItem("cloth"); if (ec) ec.count += bonusCloth; else state.inventory.push({ id:"cloth", name:"Ткань", icon:"🧵", cat:"material", count:bonusCloth });
  const ew = findItem("wire"); if (ew) ew.count += bonusWire; else state.inventory.push({ id:"wire", name:"Проволока", icon:"🔗", cat:"material", count:bonusWire });
  state.player.shearsDurability--;
  fabricActive = false;
  const broke = state.player.shearsDurability <= 0;
  if (broke){ state.player.shearsDurability = null; }
  toast(`Собрано: Редкая ткань x${caught}, Ткань x${bonusCloth}, Проволока x${bonusWire}${broke?" — ножницы затупились!":""}`);
  notifyDone("Сбор завершён", `Собрано редкой ткани: ${caught}${broke?". Ножницы затупились!":""}`);
  renderInventory("all");
  renderFabricGatherView();
  updateBusyBanner();
}

function renderSewView(){
  const p = state.player;
  const body = document.getElementById("portnoyBody");
  if (!body) return;
  const known = goldTierRecipes.filter(r => p.knownRecipes.includes(r.id));
  body.innerHTML = sewActive ? `
    <div class="card">
      <div class="card-title">Шьём: ${catalogItem(sewTargetId).name}</div>
      <div class="war-timer-big" id="sewTimer">${formatTime(sewSecondsLeft)}</div>
    </div>
  ` : (known.length ? `<div id="sewGroups"></div>` : `<p class="dim center-pad">Нет изученных золотых тиров. Купите их в магазине «Всё для Портного».</p>`);
  if (sewActive || !known.length) return;
  const groups = document.getElementById("sewGroups");
  known.forEach(tierRec => {
    const header = document.createElement("div");
    header.className = "card-title";
    header.style.marginTop = "10px";
    header.textContent = tierRec.name;
    groups.appendChild(header);
    const slots = [...Object.keys(slotMeta), "weapon"];
    const list = document.createElement("div");
    list.className = "clan-list";
    slots.forEach(slot => {
      const item = catalogItem(`${tierRec.tierId}_${slot}_gold`);
      const have = itemCount("fabric");
      const haveThread = itemCount("goldThread");
      const canSew = have >= tierRec.fabricNeed && haveThread >= 1 && !isBusy();
      const el = document.createElement("div");
      el.className = "npc-row";
      el.innerHTML = `
        <div class="npc-avatar">${iconHtml(item.icon)}</div>
        <div class="npc-main">
          <div class="npc-name">${item.name}</div>
          <div class="npc-sub">${tierRec.fabricNeed}× Редкая ткань (есть ${have}) + 1 Золотая нить (есть ${haveThread})</div>
        </div>
        <button class="btn ${canSew?"primary":"ghost"} small" ${canSew?"":"disabled"}>Шить</button>
      `;
      if (canSew) el.querySelector("button").addEventListener("click", () => startSew(item.id, tierRec.fabricNeed));
      list.appendChild(el);
    });
    groups.appendChild(list);
  });
}

function startSew(catalogId, fabricNeed){
  if (isBusy()){ toast(`Вы заняты (${busyLabel()})`); return; }
  spendItem(findItem("fabric"), fabricNeed);
  spendItem(findItem("goldThread"), 1);
  renderInventory("all");
  sewActive = true;
  sewTargetId = catalogId;
  sewSecondsLeft = SEW_SECONDS;
  beginActiveJob("sew", catalogId, SEW_SECONDS);
  renderSewView();
  updateBusyBanner();
  clearInterval(sewHandle);
  sewHandle = setInterval(() => {
    sewSecondsLeft--;
    const timerEl = document.getElementById("sewTimer");
    if (timerEl) timerEl.textContent = formatTime(sewSecondsLeft);
    updateBusyBanner();
    if (sewSecondsLeft <= 0){
      clearInterval(sewHandle);
      finishSew();
    }
  }, 1000);
}
function finishSew(){
  endActiveJob();
  const item = catalogItem(sewTargetId);
  addOrStackItem(item, 1);
  state.player.portnoyMastery++;
  sewActive = false;
  toast(`Готово: ${item.name}! Мастерство Портного: ${state.player.portnoyMastery}`);
  notifyDone("Пошив завершён", `Готово: ${item.name}`);
  renderInventory("all");
  renderSewView();
  updateBusyBanner();
}

/* ===== Render: Work (локации сбора) ===== */
const WORK_DURATION_SECONDS = 8*60+24;
const WORK_ENERGY_COST = Math.round(WORK_DURATION_SECONDS/60); // 10 мин работы = 10 энергии
function canAffordWork(){ return state.player.energy >= WORK_ENERGY_COST; }
let workSeconds = WORK_DURATION_SECONDS;
let workHandle = null;
let workState = "idle"; // idle | running | done

function currentGatherSpot(){ return professionSpots.find(s => s.id === currentDistrictId) || null; }

function workBtnLabel(){
  return workState === "running" ? "ПРЕРВАТЬ РАБОТУ" : workState === "done" ? "ЗАБРАТЬ РЕСУРСЫ" : "НАЧАТЬ РАБОТУ";
}

function enterWorkScreen(){
  const spot = currentGatherSpot();
  if (spot && spot.id === "pristan"){
    selectedProfessionId = "povar";
    povarView = "fishing";
    selectedCraftId = null;
    showScreen("craft");
    return;
  }
  if (spot && spot.id === "pustyr"){
    selectedProfessionId = "travnik";
    travnikView = "gather";
    selectedCraftId = null;
    showScreen("craft");
    return;
  }
  if (spot && spot.id === "bereg"){
    selectedProfessionId = "farmacevt";
    farmacevtView = "gather";
    selectedCraftId = null;
    showScreen("craft");
    return;
  }
  if (spot && spot.id === "svalka"){
    selectedProfessionId = "oruzejnik";
    oruzejnikView = "gather";
    selectedCraftId = null;
    showScreen("craft");
    return;
  }
  if (spot && spot.id === "priisk"){
    selectedProfessionId = "juvelir";
    juvelirView = "gather";
    selectedCraftId = null;
    showScreen("craft");
    return;
  }
  if (spot && spot.id === "sklad"){
    selectedProfessionId = "portnoy";
    portnoyView = "gather";
    selectedCraftId = null;
    showScreen("craft");
    return;
  }
  renderWorkFlavor();
  const hasSpot = !!spot;
  document.getElementById("workBtn").classList.toggle("hidden", !hasSpot);
  document.querySelector(".work-timer-block").classList.toggle("hidden", !hasSpot);
  if (!hasSpot) return;
  document.getElementById("workBtn").textContent = workBtnLabel();
  const m = Math.floor(workSeconds/60), s = workSeconds%60;
  document.getElementById("workTimer").textContent = `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function renderWorkFlavor(){
  const spot = currentGatherSpot();
  if (!spot){
    setLocationImage("workImage", {icon:"🚫"});
    document.getElementById("workTitle").textContent = "Вы не на локации сбора";
    document.getElementById("workSubtitle").textContent = "";
    document.getElementById("workDesc").textContent = "Переместитесь на одну из локаций сбора на Карте города, чтобы добывать ресурсы для своей профессии.";
    document.getElementById("workFindsRow").innerHTML = "";
    return;
  }
  setLocationImage("workImage", spot);
  document.getElementById("workTitle").textContent = spot.name;
  document.getElementById("workSubtitle").textContent = professions.find(p=>p.id===spot.profession).name;
  document.getElementById("workDesc").textContent = spot.desc;
  document.getElementById("workFindsRow").innerHTML = spot.resources.map(r => `<span class="item-chip static">${r.icon}</span>`).join("");
}

function tickWork(){
  const m = Math.floor(workSeconds/60), s = workSeconds%60;
  document.getElementById("workTimer").textContent = `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  updateBusyBanner();
  if (workSeconds <= 0){
    clearInterval(workHandle);
    workState = "done";
    document.getElementById("workBtn").textContent = workBtnLabel();
    const spot = currentGatherSpot();
    notifyDone("Работа завершена", `${spot?spot.name:"Локация"}: ресурсы готовы, заберите их.`);
    updateBusyBanner();
    return;
  }
  workSeconds--;
}
function startWork(){
  if (isBusy()){ toast(`Вы заняты (${busyLabel()})`); return; }
  if (!canAffordWork()){ toast("Недостаточно энергии для новой смены"); return; }
  state.player.energy -= WORK_ENERGY_COST;
  renderHome();
  workState = "running";
  workSeconds = WORK_DURATION_SECONDS;
  document.getElementById("workBtn").textContent = workBtnLabel();
  updateBusyBanner();
  clearInterval(workHandle);
  workHandle = setInterval(tickWork, 1000);
}

function collectGatherResources(){
  const spot = currentGatherSpot();
  if (!spot) return;
  const parts = spot.resources.map(r => {
    const qty = r.min + Math.floor(Math.random()*(r.max-r.min+1));
    const existing = findItem(r.id);
    if (existing) existing.count += qty;
    else state.inventory.push({ id:r.id, name:r.name, icon:r.icon, cat:"material", count:qty });
    return `${r.name} x${qty}`;
  });
  renderInventory("all");
  toast(`Получено: ${parts.join(", ")}`);
}

document.getElementById("workBtn").addEventListener("click", () => {
  if (workState === "idle"){
    startWork();
  } else if (workState === "done"){
    collectGatherResources();
    workState = "idle";
    workSeconds = WORK_DURATION_SECONDS;
    document.getElementById("workBtn").textContent = workBtnLabel();
  } else {
    clearInterval(workHandle);
    workState = "idle";
    workSeconds = WORK_DURATION_SECONDS;
    document.getElementById("workBtn").textContent = workBtnLabel();
    toast("Работа прервана, ресурсы не получены");
  }
  updateBusyBanner();
});

/* ===== Render: Shop ===== */
document.querySelectorAll('.tabs[data-group="shopTab"] .tab').forEach(t => {
  t.addEventListener("click", () => switchTab("shopTab", t.dataset.tab));
});
function renderShop(filter){
  const list = document.getElementById("shopList");
  list.innerHTML = "";
  if (filter === "meds"){ renderShopMeds(list); return; }
  if (filter === "povar"){ renderShopPovar(list); return; }
  if (filter === "travnik"){ renderShopTravnik(list); return; }
  if (filter === "farmacevt"){ renderShopFarmacevt(list); return; }
  if (filter === "oruzejnik"){ renderShopOruzejnik(list); return; }
  if (filter === "juvelir"){ renderShopJuvelir(list); return; }
  if (filter === "portnoy"){ renderShopPortnoy(list); return; }
  const slots = filter === "weapon" ? ["weapon"] : Object.keys(slotMeta);
  gearTiers.forEach(tier => {
    const locked = state.player.level < tier.minLevel;
    const header = document.createElement("div");
    header.className = "card-title";
    header.style.marginTop = "10px";
    header.textContent = `${tier.name} (ур. ${tier.minLevel}+)${locked?" — заблокировано":""}`;
    list.appendChild(header);
    slots.forEach(slot => {
      const item = catalogItem(`${tier.id}_${slot}_blue`);
      const price = slot === "weapon" ? tier.shopPrice : Math.round(tier.shopPrice * 0.35);
      const el = document.createElement("div");
      el.className = "shop-item";
      const equippedHere = getEquippedItem(slot);
      const desc = itemStatDesc(item) + itemCompareDelta(item, equippedHere);
      el.innerHTML = `
        <span class="si-icon">${iconHtml(item.icon)}</span>
        <div class="si-info"><div class="si-name"><span class="rarity-dot rarity-blue"></span>${item.name}</div><div class="si-desc">${desc}</div></div>
        <div class="si-price">${locked?`ур. ${tier.minLevel}`:`${price.toLocaleString("ru-RU")} Т`}</div>
      `;
      if (!locked){
        el.addEventListener("click", () => buyTierItem(item, price));
      } else {
        el.style.opacity = "0.5";
      }
      list.appendChild(el);
    });
  });
}
function buyTierItem(item, price){
  if (state.player.rub < price){ toast("Недостаточно Т"); return; }
  state.player.rub -= price;
  addOrStackItem(item, 1);
  renderHome();
  toast(`Куплено: ${item.name} (синий)`);
}

function renderShopMeds(list){
  medItems.forEach(i => {
    const el = document.createElement("div");
    el.className = "shop-item";
    el.innerHTML = `<span class="si-icon">${i.icon}</span><div class="si-info"><div class="si-name">${i.name}</div><div class="si-desc">${i.desc}</div></div><div class="si-price">${i.price.toLocaleString("ru-RU")} Т</div>`;
    el.addEventListener("click", () => buyMedItem(i));
    list.appendChild(el);
  });
}
function buyMedItem(i){
  if (state.player.rub < i.price){ toast("Недостаточно Т"); return; }
  state.player.rub -= i.price;
  const existing = findItem(i.id);
  if (existing) existing.count += 1;
  else state.inventory.push({ id:i.id, name:i.name, icon:i.icon, cat:i.cat, count:1 });
  renderHome();
  toast(`Куплено: ${i.name}`);
}

function renderShopPovar(list){
  const p = state.player;
  const rodEl = document.createElement("div");
  rodEl.className = "shop-item";
  const rodDesc = p.rodDurability === null ? "Новая удочка, прочность 50/50" : `Есть удочка: ${p.rodDurability}/${ROD_MAX_DURABILITY} — покупка заменит на новую`;
  rodEl.innerHTML = `<span class="si-icon">🎣</span><div class="si-info"><div class="si-name">Удочка</div><div class="si-desc">${rodDesc}</div></div><div class="si-price">${ROD_PRICE.toLocaleString("ru-RU")} Т</div>`;
  rodEl.addEventListener("click", buyRod);
  list.appendChild(rodEl);

  const plateEl = document.createElement("div");
  plateEl.className = "shop-item";
  plateEl.innerHTML = `<span class="si-icon">🍽️</span><div class="si-info"><div class="si-name">Тарелка</div><div class="si-desc">Нужна для готовки, 1 шт. на блюдо (есть: ${itemCount("plate")})</div></div><div class="si-price">${PLATE_PRICE.toLocaleString("ru-RU")} Т</div>`;
  plateEl.addEventListener("click", buyPlate);
  list.appendChild(plateEl);

  const header = document.createElement("div");
  header.className = "card-title";
  header.style.marginTop = "10px";
  header.textContent = "Рецепты блюд";
  list.appendChild(header);

  cookRecipes.forEach(r => {
    const known = p.knownRecipes.includes(r.id);
    const lockedByMastery = p.povarMastery < r.masteryReq;
    const el = document.createElement("div");
    el.className = "shop-item";
    el.innerHTML = `
      <span class="si-icon">${r.icon}</span>
      <div class="si-info"><div class="si-name">${r.name}</div><div class="si-desc">Мастерство ${r.masteryReq}+ · +${r.energyRestore} энергии${known?" · изучено":""}</div></div>
      <div class="si-price">${known?"✓":lockedByMastery?`масс. ${r.masteryReq}`:`${r.learnPrice.toLocaleString("ru-RU")} Т`}</div>
    `;
    if (!known && !lockedByMastery) el.addEventListener("click", () => buyRecipe(r));
    else el.style.opacity = known ? "0.6" : "0.5";
    list.appendChild(el);
  });
}
function buyRod(){
  if (state.player.rub < ROD_PRICE){ toast("Недостаточно Т"); return; }
  state.player.rub -= ROD_PRICE;
  state.player.rodDurability = ROD_MAX_DURABILITY;
  renderHome();
  renderShop("povar");
  toast("Куплена новая удочка (50/50)");
}
function buyPlate(){
  if (state.player.rub < PLATE_PRICE){ toast("Недостаточно Т"); return; }
  state.player.rub -= PLATE_PRICE;
  const existing = findItem("plate");
  if (existing) existing.count += 1;
  else state.inventory.push({ id:"plate", name:"Тарелка", icon:"🍽️", cat:"material", count:1 });
  renderHome();
  renderShop("povar");
  toast("Куплена тарелка");
}
function buyRecipe(r){
  if (state.player.rub < r.learnPrice){ toast("Недостаточно Т"); return; }
  state.player.rub -= r.learnPrice;
  state.player.knownRecipes.push(r.id);
  renderHome();
  renderShop("povar");
  toast(`Рецепт изучен: ${r.name}`);
}

function renderShopTravnik(list){
  const p = state.player;
  const secEl = document.createElement("div");
  secEl.className = "shop-item";
  const secDesc = p.secatorDurability === null ? "Новый секатор, прочность 50/50" : `Есть секатор: ${p.secatorDurability}/${SECATOR_MAX_DURABILITY} — покупка заменит на новый`;
  secEl.innerHTML = `<span class="si-icon">✂️</span><div class="si-info"><div class="si-name">Секатор</div><div class="si-desc">${secDesc}</div></div><div class="si-price">${SECATOR_PRICE.toLocaleString("ru-RU")} Т</div>`;
  secEl.addEventListener("click", buySecator);
  list.appendChild(secEl);

  const vialEl = document.createElement("div");
  vialEl.className = "shop-item";
  vialEl.innerHTML = `<span class="si-icon">🫙</span><div class="si-info"><div class="si-name">Пустой пузырёк</div><div class="si-desc">Нужен для варки эликсира, 1 шт. на эликсир (есть: ${itemCount("vial")})</div></div><div class="si-price">${VIAL_PRICE.toLocaleString("ru-RU")} Т</div>`;
  vialEl.addEventListener("click", buyVial);
  list.appendChild(vialEl);

  const header = document.createElement("div");
  header.className = "card-title";
  header.style.marginTop = "10px";
  header.textContent = "Рецепты эликсиров";
  list.appendChild(header);

  elixirRecipes.forEach(r => {
    const known = p.knownRecipes.includes(r.id);
    const lockedByMastery = p.travnikMastery < r.masteryReq;
    const el = document.createElement("div");
    el.className = "shop-item";
    el.innerHTML = `
      <span class="si-icon">${r.icon}</span>
      <div class="si-info"><div class="si-name">${r.name}</div><div class="si-desc">Мастерство ${r.masteryReq}+ · +${r.buffPercent}% ко всем статам на 1 час${known?" · изучено":""}</div></div>
      <div class="si-price">${known?"✓":lockedByMastery?`масс. ${r.masteryReq}`:`${r.learnPrice.toLocaleString("ru-RU")} Т`}</div>
    `;
    if (!known && !lockedByMastery) el.addEventListener("click", () => buyElixirRecipe(r));
    else el.style.opacity = known ? "0.6" : "0.5";
    list.appendChild(el);
  });
}
function buySecator(){
  if (state.player.rub < SECATOR_PRICE){ toast("Недостаточно Т"); return; }
  state.player.rub -= SECATOR_PRICE;
  state.player.secatorDurability = SECATOR_MAX_DURABILITY;
  renderHome();
  renderShop("travnik");
  toast("Куплен новый секатор (50/50)");
}
function buyVial(){
  if (state.player.rub < VIAL_PRICE){ toast("Недостаточно Т"); return; }
  state.player.rub -= VIAL_PRICE;
  const existing = findItem("vial");
  if (existing) existing.count += 1;
  else state.inventory.push({ id:"vial", name:"Пустой пузырёк", icon:"🫙", cat:"material", count:1 });
  renderHome();
  renderShop("travnik");
  toast("Куплен пузырёк");
}
function buyElixirRecipe(r){
  if (state.player.rub < r.learnPrice){ toast("Недостаточно Т"); return; }
  state.player.rub -= r.learnPrice;
  state.player.knownRecipes.push(r.id);
  renderHome();
  renderShop("travnik");
  toast(`Рецепт изучен: ${r.name}`);
}

function renderShopFarmacevt(list){
  const p = state.player;
  const glovesEl = document.createElement("div");
  glovesEl.className = "shop-item";
  const glovesDesc = p.glovesDurability === null ? "Новые перчатки, прочность 50/50" : `Есть перчатки: ${p.glovesDurability}/${GLOVES_MAX_DURABILITY} — покупка заменит на новые`;
  glovesEl.innerHTML = `<span class="si-icon">🧤</span><div class="si-info"><div class="si-name">Водолазные перчатки</div><div class="si-desc">${glovesDesc}</div></div><div class="si-price">${GLOVES_PRICE.toLocaleString("ru-RU")} Т</div>`;
  glovesEl.addEventListener("click", buyGloves);
  list.appendChild(glovesEl);

  const thickEl = document.createElement("div");
  thickEl.className = "shop-item";
  thickEl.innerHTML = `<span class="si-icon">🧪</span><div class="si-info"><div class="si-name">Загуститель</div><div class="si-desc">Нужен для приготовления, 1 шт. на препарат (есть: ${itemCount("thickener")})</div></div><div class="si-price">${THICKENER_PRICE.toLocaleString("ru-RU")} Т</div>`;
  thickEl.addEventListener("click", buyThickener);
  list.appendChild(thickEl);

  const header = document.createElement("div");
  header.className = "card-title";
  header.style.marginTop = "10px";
  header.textContent = "Рецепты препаратов";
  list.appendChild(header);

  potionRecipes.forEach(r => {
    const known = p.knownRecipes.includes(r.id);
    const lockedByMastery = p.farmacevtMastery < r.masteryReq;
    const el = document.createElement("div");
    el.className = "shop-item";
    el.innerHTML = `
      <span class="si-icon">${r.icon}</span>
      <div class="si-info"><div class="si-name">${r.name}</div><div class="si-desc">Мастерство ${r.masteryReq}+ · ${r.hotMin}-${r.hotMax} HP/ход × ${HOT_TURNS}${known?" · изучено":""}</div></div>
      <div class="si-price">${known?"✓":lockedByMastery?`масс. ${r.masteryReq}`:`${r.learnPrice.toLocaleString("ru-RU")} Т`}</div>
    `;
    if (!known && !lockedByMastery) el.addEventListener("click", () => buyPotionRecipe(r));
    else el.style.opacity = known ? "0.6" : "0.5";
    list.appendChild(el);
  });
}
function buyGloves(){
  if (state.player.rub < GLOVES_PRICE){ toast("Недостаточно Т"); return; }
  state.player.rub -= GLOVES_PRICE;
  state.player.glovesDurability = GLOVES_MAX_DURABILITY;
  renderHome();
  renderShop("farmacevt");
  toast("Куплены новые водолазные перчатки (50/50)");
}
function buyThickener(){
  if (state.player.rub < THICKENER_PRICE){ toast("Недостаточно Т"); return; }
  state.player.rub -= THICKENER_PRICE;
  const existing = findItem("thickener");
  if (existing) existing.count += 1;
  else state.inventory.push({ id:"thickener", name:"Загуститель", icon:"🧪", cat:"material", count:1 });
  renderHome();
  renderShop("farmacevt");
  toast("Куплен загуститель");
}
function buyPotionRecipe(r){
  if (state.player.rub < r.learnPrice){ toast("Недостаточно Т"); return; }
  state.player.rub -= r.learnPrice;
  state.player.knownRecipes.push(r.id);
  renderHome();
  renderShop("farmacevt");
  toast(`Рецепт изучен: ${r.name}`);
}

function renderShopOruzejnik(list){
  const p = state.player;
  const cutterEl = document.createElement("div");
  cutterEl.className = "shop-item";
  const cutterDesc = p.cutterDurability === null ? "Новые кусачки, прочность 50/50" : `Есть кусачки: ${p.cutterDurability}/${CUTTER_MAX_DURABILITY} — покупка заменит на новые`;
  cutterEl.innerHTML = `<span class="si-icon">🗜️</span><div class="si-info"><div class="si-name">Кусачки для лома</div><div class="si-desc">${cutterDesc}</div></div><div class="si-price">${CUTTER_PRICE.toLocaleString("ru-RU")} Т</div>`;
  cutterEl.addEventListener("click", buyCutter);
  list.appendChild(cutterEl);

  const coalEl = document.createElement("div");
  coalEl.className = "shop-item";
  coalEl.innerHTML = `<span class="si-icon">⚫</span><div class="si-info"><div class="si-name">Уголь</div><div class="si-desc">Нужен для ковки, 1 шт. на оружие (есть: ${itemCount("coal")})</div></div><div class="si-price">${COAL_PRICE.toLocaleString("ru-RU")} Т</div>`;
  coalEl.addEventListener("click", buyCoal);
  list.appendChild(coalEl);

  const header = document.createElement("div");
  header.className = "card-title";
  header.style.marginTop = "10px";
  header.textContent = "Рецепты оружия";
  list.appendChild(header);

  smithRecipes.forEach(r => {
    const known = p.knownRecipes.includes(r.id);
    const lockedByMastery = p.oruzejnikMastery < r.masteryReq;
    const el = document.createElement("div");
    el.className = "shop-item";
    el.innerHTML = `
      <span class="si-icon">${r.icon}</span>
      <div class="si-info"><div class="si-name">${r.name}</div><div class="si-desc">Мастерство ${r.masteryReq}+ · Урон ${r.dmgMin}-${r.dmgMax}, оглушение ${r.stunChance}%${known?" · изучено":""}</div></div>
      <div class="si-price">${known?"✓":lockedByMastery?`масс. ${r.masteryReq}`:`${r.learnPrice.toLocaleString("ru-RU")} Т`}</div>
    `;
    if (!known && !lockedByMastery) el.addEventListener("click", () => buySmithRecipe(r));
    else el.style.opacity = known ? "0.6" : "0.5";
    list.appendChild(el);
  });
}
function buyCutter(){
  if (state.player.rub < CUTTER_PRICE){ toast("Недостаточно Т"); return; }
  state.player.rub -= CUTTER_PRICE;
  state.player.cutterDurability = CUTTER_MAX_DURABILITY;
  renderHome();
  renderShop("oruzejnik");
  toast("Куплены новые кусачки (50/50)");
}
function buyCoal(){
  if (state.player.rub < COAL_PRICE){ toast("Недостаточно Т"); return; }
  state.player.rub -= COAL_PRICE;
  const existing = findItem("coal");
  if (existing) existing.count += 1;
  else state.inventory.push({ id:"coal", name:"Уголь", icon:"⚫", cat:"material", count:1 });
  renderHome();
  renderShop("oruzejnik");
  toast("Куплен уголь");
}
function buySmithRecipe(r){
  if (state.player.rub < r.learnPrice){ toast("Недостаточно Т"); return; }
  state.player.rub -= r.learnPrice;
  state.player.knownRecipes.push(r.id);
  renderHome();
  renderShop("oruzejnik");
  toast(`Рецепт изучен: ${r.name}`);
}

function renderShopJuvelir(list){
  const p = state.player;
  const sawEl = document.createElement("div");
  sawEl.className = "shop-item";
  const sawDesc = p.sawDurability === null ? "Новая пила, прочность 50/50" : `Есть пила: ${p.sawDurability}/${SAW_MAX_DURABILITY} — покупка заменит на новую`;
  sawEl.innerHTML = `<span class="si-icon">🪚</span><div class="si-info"><div class="si-name">Ювелирная пила</div><div class="si-desc">${sawDesc}</div></div><div class="si-price">${SAW_PRICE.toLocaleString("ru-RU")} Т</div>`;
  sawEl.addEventListener("click", buySaw);
  list.appendChild(sawEl);

  const mountEl = document.createElement("div");
  mountEl.className = "shop-item";
  mountEl.innerHTML = `<span class="si-icon">💠</span><div class="si-info"><div class="si-name">Оправа</div><div class="si-desc">Нужна для огранки, 1 шт. на украшение (есть: ${itemCount("mount")})</div></div><div class="si-price">${MOUNT_PRICE.toLocaleString("ru-RU")} Т</div>`;
  mountEl.addEventListener("click", buyMount);
  list.appendChild(mountEl);

  const header = document.createElement("div");
  header.className = "card-title";
  header.style.marginTop = "10px";
  header.textContent = "Рецепты украшений";
  list.appendChild(header);

  jewelryRecipes.forEach(r => {
    const known = p.knownRecipes.includes(r.id);
    const lockedByMastery = p.juvelirMastery < r.masteryReq;
    const effectText = r.statBonus ? "Бонус: " + Object.entries(r.statBonus).map(([k,v]) => `+${v} ${statShort(k)}`).join(", ") : `+${r.critBonus}% крита`;
    const el = document.createElement("div");
    el.className = "shop-item";
    el.innerHTML = `
      <span class="si-icon">${r.icon}</span>
      <div class="si-info"><div class="si-name">${r.name}</div><div class="si-desc">Мастерство ${r.masteryReq}+ · ${effectText}${known?" · изучено":""}</div></div>
      <div class="si-price">${known?"✓":lockedByMastery?`масс. ${r.masteryReq}`:`${r.learnPrice.toLocaleString("ru-RU")} Т`}</div>
    `;
    if (!known && !lockedByMastery) el.addEventListener("click", () => buyJewelryRecipe(r));
    else el.style.opacity = known ? "0.6" : "0.5";
    list.appendChild(el);
  });
}
function buySaw(){
  if (state.player.rub < SAW_PRICE){ toast("Недостаточно Т"); return; }
  state.player.rub -= SAW_PRICE;
  state.player.sawDurability = SAW_MAX_DURABILITY;
  renderHome();
  renderShop("juvelir");
  toast("Куплена новая ювелирная пила (50/50)");
}
function buyMount(){
  if (state.player.rub < MOUNT_PRICE){ toast("Недостаточно Т"); return; }
  state.player.rub -= MOUNT_PRICE;
  const existing = findItem("mount");
  if (existing) existing.count += 1;
  else state.inventory.push({ id:"mount", name:"Оправа", icon:"💠", cat:"material", count:1 });
  renderHome();
  renderShop("juvelir");
  toast("Куплена оправа");
}
function buyJewelryRecipe(r){
  if (state.player.rub < r.learnPrice){ toast("Недостаточно Т"); return; }
  state.player.rub -= r.learnPrice;
  state.player.knownRecipes.push(r.id);
  renderHome();
  renderShop("juvelir");
  toast(`Рецепт изучен: ${r.name}`);
}

function renderShopPortnoy(list){
  const p = state.player;
  const shearsEl = document.createElement("div");
  shearsEl.className = "shop-item";
  const shearsDesc = p.shearsDurability === null ? "Новые ножницы, прочность 50/50" : `Есть ножницы: ${p.shearsDurability}/${SHEARS_MAX_DURABILITY} — покупка заменит на новые`;
  shearsEl.innerHTML = `<span class="si-icon">🪡</span><div class="si-info"><div class="si-name">Портновские ножницы</div><div class="si-desc">${shearsDesc}</div></div><div class="si-price">${SHEARS_PRICE.toLocaleString("ru-RU")} Т</div>`;
  shearsEl.addEventListener("click", buyShears);
  list.appendChild(shearsEl);

  const threadEl = document.createElement("div");
  threadEl.className = "shop-item";
  threadEl.innerHTML = `<span class="si-icon">🧶</span><div class="si-info"><div class="si-name">Золотая нить</div><div class="si-desc">Нужна для пошива, 1 шт. на предмет (есть: ${itemCount("goldThread")})</div></div><div class="si-price">${GOLD_THREAD_PRICE.toLocaleString("ru-RU")} Т</div>`;
  threadEl.addEventListener("click", buyGoldThread);
  list.appendChild(threadEl);

  const header = document.createElement("div");
  header.className = "card-title";
  header.style.marginTop = "10px";
  header.textContent = "Золотые тиры";
  list.appendChild(header);

  goldTierRecipes.forEach(r => {
    const known = p.knownRecipes.includes(r.id);
    const lockedByMastery = p.portnoyMastery < r.masteryReq;
    const el = document.createElement("div");
    el.className = "shop-item";
    el.innerHTML = `
      <span class="si-icon">${r.icon}</span>
      <div class="si-info"><div class="si-name">${r.name}</div><div class="si-desc">Мастерство ${r.masteryReq}+ · открывает пошив всех 6 предметов тира${known?" · изучено":""}</div></div>
      <div class="si-price">${known?"✓":lockedByMastery?`масс. ${r.masteryReq}`:`${r.learnPrice.toLocaleString("ru-RU")} Т`}</div>
    `;
    if (!known && !lockedByMastery) el.addEventListener("click", () => buyGoldTierRecipe(r));
    else el.style.opacity = known ? "0.6" : "0.5";
    list.appendChild(el);
  });
}
function buyShears(){
  if (state.player.rub < SHEARS_PRICE){ toast("Недостаточно Т"); return; }
  state.player.rub -= SHEARS_PRICE;
  state.player.shearsDurability = SHEARS_MAX_DURABILITY;
  renderHome();
  renderShop("portnoy");
  toast("Куплены новые портновские ножницы (50/50)");
}
function buyGoldThread(){
  if (state.player.rub < GOLD_THREAD_PRICE){ toast("Недостаточно Т"); return; }
  state.player.rub -= GOLD_THREAD_PRICE;
  const existing = findItem("goldThread");
  if (existing) existing.count += 1;
  else state.inventory.push({ id:"goldThread", name:"Золотая нить", icon:"🧶", cat:"material", count:1 });
  renderHome();
  renderShop("portnoy");
  toast("Куплена золотая нить");
}
function buyGoldTierRecipe(r){
  if (state.player.rub < r.learnPrice){ toast("Недостаточно Т"); return; }
  state.player.rub -= r.learnPrice;
  state.player.knownRecipes.push(r.id);
  renderHome();
  renderShop("portnoy");
  toast(`Рецепт изучен: ${r.name}`);
}

/* ===== Render: Chat (реальные сообщения и присутствие через сокет, см. persistence.js) ===== */
let chatTabActive = "chat";
document.querySelectorAll('.tabs[data-group="chatTab"] .tab').forEach(t => {
  t.addEventListener("click", () => { chatTabActive = t.dataset.tab; switchTab("chatTab", t.dataset.tab); });
});
function renderChatTab(tab){
  chatTabActive = tab;
  const box = document.getElementById("chatMessages");
  const presence = (window.chatState && window.chatState.presence) || [];
  document.getElementById("onlineTabBtn").textContent = `Онлайн (${presence.length})`;
  if (tab === "online"){
    box.innerHTML = presence.length ? presence.map(u => `
      <div class="online-row">
        <span class="status-dot online"></span>
        <div class="member-main">
          <span>${u.telegramId === window.myTelegramId ? "(вы) " : ""}${u.name}</span>
          <span class="member-sub">в сети</span>
        </div>
      </div>`).join("") : `<p class="dim center-pad">Здесь пока никого.</p>`;
  } else {
    renderChat();
  }
}
function renderChat(){
  const box = document.getElementById("chatMessages");
  const messages = (window.chatState && window.chatState.messages) || [];
  const presence = (window.chatState && window.chatState.presence) || [];
  document.getElementById("onlineTabBtn").textContent = `Онлайн (${presence.length})`;
  box.innerHTML = messages.length ? messages.map(m => `
    <div class="chat-msg">
      <div class="chat-avatar">🙂</div>
      <div class="chat-body">
        <div class="chat-head"><span class="chat-name">${m.telegramId === window.myTelegramId ? renderName() : m.name}</span><span class="chat-time">${m.time}</span></div>
        <div class="chat-text">${m.text}</div>
      </div>
    </div>`).join("") : `<p class="dim center-pad">Пока тихо — напишите первым.</p>`;
  box.scrollTop = box.scrollHeight;
}
function sendChat(){
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  sendChatMessage(text);
  input.value = "";
}
document.getElementById("chatSendBtn").addEventListener("click", sendChat);
document.getElementById("chatInput").addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });

/* ===== Battle ===== */
function ensureBattleStarted(){
  if (battleMode === "pve" && enemy && !battleOver){
    showBattleFightView();
  } else {
    showBattleTargetSelect();
  }
}
function showBattleTargetSelect(){
  document.getElementById("battleSelectView").classList.remove("hidden");
  document.getElementById("battleFightView").classList.add("hidden");
  renderBattleTargetList();
}
function showBattleFightView(){
  document.getElementById("battleSelectView").classList.add("hidden");
  document.getElementById("battleFightView").classList.remove("hidden");
}
function renderBattleTargetList(){
  const d = districts.find(x => x.id === currentDistrictId);
  const list = document.getElementById("battleTargetList");
  if (!d){
    document.getElementById("battleDistrictName").textContent = currentGatherSpot()?.name || "—";
    list.innerHTML = `<p class="dim center-pad">Это локация сбора, здесь нет противников. Переместитесь в боевой район.</p>`;
    return;
  }
  document.getElementById("battleDistrictName").textContent = d.name;
  const templates = npcTemplates[currentDistrictId] || [];
  list.innerHTML = "";
  if (isBusy()){
    list.innerHTML = `<p class="dim center-pad">Вы заняты (${busyLabel()}) — дождитесь окончания, прежде чем драться.</p>`;
    return;
  }
  templates.forEach(tpl => {
    const s = npcStatsForLevel(tpl.level);
    const mult = moneyRewardMultiplier(state.player.level, tpl.level);
    const rubShown = Math.round(s.rubReward * mult);
    const tagClass = tpl.tag==="слабый"?"weak":tpl.tag==="средний"?"mid":"boss";
    const el = document.createElement("div");
    el.className = "npc-row";
    el.innerHTML = `
      <div class="npc-avatar">🧍</div>
      <div class="npc-main">
        <div class="npc-name">${tpl.name}</div>
        <div class="npc-sub">Ур. ${tpl.level} · HP ${s.hp} · Награда: ${s.expReward} EXP, ${rubShown} Т${mult<1?" (низкий уровень цели)":""}</div>
      </div>
      <span class="npc-tag ${tagClass}">${tpl.tag}</span>
    `;
    el.addEventListener("click", () => {
      showBattleFightView();
      startBattle("pve", tpl);
    });
    list.appendChild(el);
  });
  if (!templates.length) list.innerHTML = `<p class="dim center-pad">В этом районе пока нет противников.</p>`;
}
function oppMaxHp(o){ return 70 + o.stats.hpStat * 3; }
function startBattle(mode, opponent){
  battleMode = mode || "pve";
  if (battleMode === "arena"){
    arenaOpponentRef = opponent;
    const hp = oppMaxHp(opponent);
    enemy = { name: opponent.name, level: opponent.level, hp, maxHp: hp };
  } else {
    arenaOpponentRef = null;
    const s = npcStatsForLevel(opponent.level);
    enemy = {
      name: opponent.name, level: opponent.level, hp: s.hp, maxHp: s.hp,
      combat: { str:s.str, agi:s.agi, luck:s.luck, weaponAvg:s.weaponAvg, defense: Math.round(s.str/4) },
      expReward: s.expReward, rubReward: s.rubReward,
    };
  }
  selAttack = null; selBlock = null;
  battleOver = false;
  activeHot = null;
  document.getElementById("battleLog").innerHTML = "";
  document.getElementById("battleResult").classList.add("hidden");
  document.getElementById("battleActiveArea").classList.remove("hidden");
  logLine(battleMode === "arena" ? `Дуэль началась против ${opponent.name}!` : `Вы вошли в бой с ${enemy.name}!`);
  renderBattle();
  startTurnTimer();
}
function renderBattle(){
  document.getElementById("enemyName").textContent = enemy.name;
  document.getElementById("enemyLevel").textContent = enemy.level;
  document.getElementById("enemy-hp-text").textContent = `${Math.max(0,enemy.hp)} / ${enemy.maxHp}`;
  document.getElementById("enemy-hp-bar").style.width = `${Math.max(0,(enemy.hp/enemy.maxHp)*100)}%`;
  const p = state.player;
  document.getElementById("battle-p-hp-text").textContent = `${Math.max(0,p.hp)} / ${p.maxHp}`;
  document.getElementById("battle-p-hp-bar").style.width = `${Math.max(0,(p.hp/p.maxHp)*100)}%`;
  document.querySelectorAll('.zone-grid[data-group="attack"] .zone-btn').forEach(b => b.classList.toggle("selected", b.dataset.zone===selAttack));
  document.querySelectorAll('.zone-grid[data-group="block"] .zone-btn').forEach(b => b.classList.toggle("selected", b.dataset.zone===selBlock));
  renderBattleSlots();
}

document.querySelectorAll('.zone-grid[data-group="attack"] .zone-btn').forEach(b => {
  b.addEventListener("click", () => { selAttack = b.dataset.zone; renderBattle(); });
});
document.querySelectorAll('.zone-grid[data-group="block"] .zone-btn').forEach(b => {
  b.addEventListener("click", () => { selBlock = b.dataset.zone; renderBattle(); });
});

function logLine(text, cls){
  const box = document.getElementById("battleLog");
  const div = document.createElement("div");
  div.className = "log-line" + (cls?` ${cls}`:"");
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function startTurnTimer(){
  clearInterval(turnTimerHandle);
  turnSeconds = 15;
  document.getElementById("turnTimer").textContent = turnSeconds;
  turnTimerHandle = setInterval(() => {
    turnSeconds--;
    document.getElementById("turnTimer").textContent = Math.max(0,turnSeconds);
    if (turnSeconds <= 0){
      clearInterval(turnTimerHandle);
      resolveTurn();
    }
  }, 1000);
}

document.getElementById("endTurnBtn").addEventListener("click", () => {
  if (battleOver) return;
  clearInterval(turnTimerHandle);
  resolveTurn();
});

function tickActiveHot(){
  if (!activeHot) return;
  const p = state.player;
  const heal = activeHot.hotMin + Math.floor(Math.random()*(activeHot.hotMax-activeHot.hotMin+1));
  p.hp = Math.min(p.maxHp, p.hp + heal);
  activeHot.turnsLeft--;
  logLine(`${activeHot.name}: +${heal} HP`, "heal");
  if (activeHot.turnsLeft <= 0){
    logLine(`Действие зелья закончилось.`, "heal");
    activeHot = null;
  }
  renderHome();
}

function performEnemyAttack(blkZone){
  const p = state.player;
  const s = effectiveStats();
  const isArena = battleMode === "arena";
  const oppStats = isArena ? arenaOpponentRef.stats : enemy.combat;
  const oppWeaponAvg = isArena ? (arenaOpponentRef.weapon.dmgMin + arenaOpponentRef.weapon.dmgMax)/2 : enemy.combat.weaponAvg;
  const enemyAtkZone = ["head","chest","belly","legs"][Math.floor(Math.random()*4)];
  const enemyResult = computeDamage(
    { str:oppStats.str, agi:oppStats.agi, luck:oppStats.luck, agiDef: s.agi },
    oppWeaponAvg,
    enemyAtkZone, blkZone, zoneDefense(enemyAtkZone)
  );
  if (enemyResult.dodged){
    logLine("Вы уклонились от удара!");
  } else {
    p.hp -= enemyResult.dmg;
    logLine(`${enemy.name} наносит удар в ${zoneLabel[enemyAtkZone]}. ${enemyResult.blocked?"Вы заблокировали! ":""}Урон ${enemyResult.dmg}`, "hit");
  }
  renderHome();
  return p.hp <= 0;
}

function drinkPotionInBattle(item){
  if (battleOver) return;
  if (activeHot){ toast("Зелье уже действует, дождитесь окончания"); return; }
  spendItem(item, 1);
  activeHot = { name:item.name, hotMin:item.hotMin, hotMax:item.hotMax, turnsLeft: HOT_TURNS };
  logLine(`Вы выпили ${item.name}. Восстановление начнётся со следующего хода.`, "heal");
  clearInterval(turnTimerHandle);
  renderBattle();
  const blkZone = selBlock || ["head","chest","belly","legs"][Math.floor(Math.random()*4)];
  const died = performEnemyAttack(blkZone);
  if (died){
    state.player.hp = 0;
    endBattle(false);
    return;
  }
  selAttack = null; selBlock = null;
  renderBattle();
  startTurnTimer();
}

function resolveTurn(){
  if (battleOver) return;
  const p = state.player;
  tickActiveHot();
  const s = effectiveStats();
  const weapon = getEquippedWeapon();
  const isArena = battleMode === "arena";
  const oppDefense = isArena ? Math.round(arenaOpponentRef.stats.hpStat/3) : enemy.combat.defense;
  const atkZone = selAttack || ["head","chest","belly","legs"][Math.floor(Math.random()*4)];
  const blkZone = selBlock || ["head","chest","belly","legs"][Math.floor(Math.random()*4)];

  const enemyBlockZone = ["head","chest","belly","legs"][Math.floor(Math.random()*4)];
  const playerResult = computeDamage(
    { str:s.str, agi:s.agi, luck:s.luck, agiDef: 10, critBonus: equipmentCritBonus() },
    (weapon.dmgMin + weapon.dmgMax)/2,
    atkZone, enemyBlockZone, oppDefense
  );

  let stunned = false;
  if (playerResult.dodged){
    logLine(`${enemy.name} уклонился от вашего удара!`, "you");
  } else {
    enemy.hp -= playerResult.dmg;
    logLine(`Ваш удар в ${zoneLabel[atkZone]}. ${playerResult.crit?"Крит! ":""}${playerResult.blocked?"Частично заблокировано. ":""}Урон ${playerResult.dmg}`, playerResult.crit?"crit":"you");
    if (weapon.stunChance && Math.random()*100 < weapon.stunChance){
      stunned = true;
      logLine(`Оглушение! ${enemy.name} пропускает следующий удар.`, "crit");
    }
  }
  renderBattle();

  if (enemy.hp <= 0){
    endBattle(true);
    return;
  }

  if (!stunned){
    const died = performEnemyAttack(blkZone);
    if (died){
      p.hp = 0;
      endBattle(false);
      return;
    }
  }

  selAttack = null; selBlock = null;
  renderBattle();
  startTurnTimer();
}

function endBattle(won){
  battleOver = true;
  clearInterval(turnTimerHandle);
  document.getElementById("battleActiveArea").classList.add("hidden");
  const resultBox = document.getElementById("battleResult");
  resultBox.classList.remove("hidden");

  if (battleMode === "arena"){
    const p = state.player;
    let chips = "";
    let continueLabel = "ВЕРНУТЬСЯ НА АРЕНУ";
    if (won){
      p.arenaPoints += 15; p.arenaRep += 15; p.arenaWins++;
      arenaOpponentRef.shieldUntil = Date.now() + 10*60*1000;
      logLine(`${enemy.name} повержен! +15 очков арены.`, "crit");
      chips = `<span class="br-chip">🏆 +15 очков арены</span><span class="br-chip">⭐ +15 репутации</span><span class="br-chip">🛡 щит сопернику на 10 мин</span>`;
      resultBox.className = "battle-result win";
      resultBox.innerHTML = `<div class="br-icon">🏆</div><div class="br-title">Победа</div><div class="br-sub">${arenaOpponentRef.name} повержен(а) на арене</div><div class="br-rewards">${chips}</div><button class="btn primary full" id="battleContinueBtn">${continueLabel}</button>`;
    } else {
      p.arenaPoints += 5; p.arenaRep += 5; p.arenaLosses++;
      logLine(`Вы проиграли дуэль. +5 очков арены (за попытку).`, "hit");
      p.hp = Math.round(p.maxHp * 0.3);
      chips = `<span class="br-chip">🥊 +5 очков арены</span>`;
      resultBox.className = "battle-result lose";
      resultBox.innerHTML = `<div class="br-icon">💀</div><div class="br-title">Поражение</div><div class="br-sub">${arenaOpponentRef.name} оказался(-ась) сильнее</div><div class="br-rewards">${chips}</div><button class="btn primary full" id="battleContinueBtn">${continueLabel}</button>`;
    }
    renderHome();
    document.getElementById("battleContinueBtn").addEventListener("click", () => showScreen("arena"));
    return;
  }

  if (won){
    const mult = moneyRewardMultiplier(state.player.level, enemy.level);
    const rubGain = Math.round(enemy.rubReward * mult);
    logLine(`${enemy.name} повержен! Получено: ${enemy.expReward} EXP, ${rubGain} Т${mult<1?" (цель ниже вашего уровня, награда снижена)":""}`, "crit");
    state.player.exp += enemy.expReward;
    state.player.rub += rubGain;
    let leveledUp = false;
    while (state.player.exp >= state.player.maxExp && state.player.level < 25){
      state.player.exp -= state.player.maxExp;
      state.player.level++;
      state.player.freePoints += 3;
      state.player.maxExp = expForNextLevel(state.player.level);
      logLine(`Новый уровень: ${state.player.level}!`, "crit");
      leveledUp = true;
    }
    if (state.player.level >= 25) state.player.exp = 0;
    const invCountBefore = state.inventory.length;
    maybeDropGear(enemy.level);
    let chips = `<span class="br-chip">✨ +${enemy.expReward} EXP</span><span class="br-chip">+${rubGain.toLocaleString("ru-RU")} Т</span>`;
    if (leveledUp) chips += `<span class="br-chip levelup">🎉 Уровень ${state.player.level}!</span>`;
    if (state.inventory.length > invCountBefore){
      const newItem = state.inventory[state.inventory.length-1];
      chips += `<span class="br-chip">${iconHtml(newItem.icon)} ${newItem.name}</span>`;
    }
    resultBox.className = "battle-result win";
    resultBox.innerHTML = `<div class="br-icon">🏆</div><div class="br-title">Победа</div><div class="br-sub">${enemy.name} повержен</div><div class="br-rewards">${chips}</div><button class="btn primary full" id="battleContinueBtn">ВЫБРАТЬ ДРУГОГО NPC</button>`;
  } else {
    logLine(`Вы потерпели поражение. Восстановитесь и возвращайтесь.`, "hit");
    state.player.hp = Math.round(state.player.maxHp * 0.3);
    resultBox.className = "battle-result lose";
    resultBox.innerHTML = `<div class="br-icon">💀</div><div class="br-title">Поражение</div><div class="br-sub">${enemy.name} оказался сильнее — вы отступили</div><div class="br-rewards"><span class="br-chip">❤️ HP восстановлено до 30%</span></div><button class="btn primary full" id="battleContinueBtn">ВЫБРАТЬ ДРУГОГО NPC</button>`;
  }
  renderHome();
  document.getElementById("battleContinueBtn").addEventListener("click", () => showBattleTargetSelect());
}

/* ===== Восстановление активной работы после закрытия приложения =====
   state.player.activeJob переживает автосохранение (каждые 10с + при сворачивании),
   поэтому при следующем заходе можно либо мгновенно завершить работу (если время
   истекло, пока приложения не было открыто), либо докрутить таймер с верным остатком. */
const ACTIVE_JOB_DEFS = {
  fishing:    { setActive:v=>fishingActive=v, setTarget:v=>fishingTargetId=v, setSeconds:v=>fishingSecondsLeft=v, getSeconds:()=>fishingSecondsLeft, setHandle:v=>fishingHandle=v, clearHandle:()=>clearInterval(fishingHandle), timerElId:"fishTimer", finish:finishFishing, render:renderFishingView },
  cooking:    { setActive:v=>cookingActive=v, setTarget:v=>cookingTargetId=v, setSeconds:v=>cookingSecondsLeft=v, getSeconds:()=>cookingSecondsLeft, setHandle:v=>cookingHandle=v, clearHandle:()=>clearInterval(cookingHandle), timerElId:"cookTimer", finish:finishCooking, render:renderCookingView },
  gather:     { setActive:v=>gatherActive=v, setTarget:null, setSeconds:v=>gatherSecondsLeft=v, getSeconds:()=>gatherSecondsLeft, setHandle:v=>gatherHandle=v, clearHandle:()=>clearInterval(gatherHandle), timerElId:"gatherTimer", finish:finishGather, render:renderGatherView },
  brew:       { setActive:v=>brewActive=v, setTarget:v=>brewTargetId=v, setSeconds:v=>brewSecondsLeft=v, getSeconds:()=>brewSecondsLeft, setHandle:v=>brewHandle=v, clearHandle:()=>clearInterval(brewHandle), timerElId:"brewTimer", finish:finishBrew, render:renderBrewView },
  seaweed:    { setActive:v=>seaweedActive=v, setTarget:null, setSeconds:v=>seaweedSecondsLeft=v, getSeconds:()=>seaweedSecondsLeft, setHandle:v=>seaweedHandle=v, clearHandle:()=>clearInterval(seaweedHandle), timerElId:"seaweedTimer", finish:finishGatherSeaweed, render:renderSeaweedGatherView },
  potionBrew: { setActive:v=>potionBrewActive=v, setTarget:v=>potionBrewTargetId=v, setSeconds:v=>potionBrewSecondsLeft=v, getSeconds:()=>potionBrewSecondsLeft, setHandle:v=>potionBrewHandle=v, clearHandle:()=>clearInterval(potionBrewHandle), timerElId:"potionBrewTimer", finish:finishBrewPotion, render:renderPotionBrewView },
  scrap:      { setActive:v=>scrapActive=v, setTarget:null, setSeconds:v=>scrapSecondsLeft=v, getSeconds:()=>scrapSecondsLeft, setHandle:v=>scrapHandle=v, clearHandle:()=>clearInterval(scrapHandle), timerElId:"scrapTimer", finish:finishGatherScrap, render:renderScrapGatherView },
  forge:      { setActive:v=>forgeActive=v, setTarget:v=>forgeTargetId=v, setSeconds:v=>forgeSecondsLeft=v, getSeconds:()=>forgeSecondsLeft, setHandle:v=>forgeHandle=v, clearHandle:()=>clearInterval(forgeHandle), timerElId:"forgeTimer", finish:finishForge, render:renderForgeView },
  gem:        { setActive:v=>gemActive=v, setTarget:null, setSeconds:v=>gemSecondsLeft=v, getSeconds:()=>gemSecondsLeft, setHandle:v=>gemHandle=v, clearHandle:()=>clearInterval(gemHandle), timerElId:"gemTimer", finish:finishGatherGem, render:renderGemGatherView },
  set:        { setActive:v=>setActive=v, setTarget:v=>setTargetId=v, setSeconds:v=>setSecondsLeft=v, getSeconds:()=>setSecondsLeft, setHandle:v=>setHandle=v, clearHandle:()=>clearInterval(setHandle), timerElId:"setTimer", finish:finishSet, render:renderSetView },
  fabric:     { setActive:v=>fabricActive=v, setTarget:null, setSeconds:v=>fabricSecondsLeft=v, getSeconds:()=>fabricSecondsLeft, setHandle:v=>fabricHandle=v, clearHandle:()=>clearInterval(fabricHandle), timerElId:"fabricTimer", finish:finishGatherFabric, render:renderFabricGatherView },
  sew:        { setActive:v=>sewActive=v, setTarget:v=>sewTargetId=v, setSeconds:v=>sewSecondsLeft=v, getSeconds:()=>sewSecondsLeft, setHandle:v=>sewHandle=v, clearHandle:()=>clearInterval(sewHandle), timerElId:"sewTimer", finish:finishSew, render:renderSewView },
};

function resumeActiveTimerJob(kind, remainingSec){
  const def = ACTIVE_JOB_DEFS[kind];
  def.setActive(true);
  def.setSeconds(Math.max(1, Math.ceil(remainingSec)));
  def.render();
  updateBusyBanner();
  def.clearHandle();
  def.setHandle(setInterval(() => {
    def.setSeconds(def.getSeconds() - 1);
    const el = document.getElementById(def.timerElId);
    if (el) el.textContent = formatTime(def.getSeconds());
    updateBusyBanner();
    if (def.getSeconds() <= 0){
      def.clearHandle();
      def.finish();
    }
  }, 1000));
}

function resolveActiveJobOnLoad(){
  const job = state.player.activeJob;
  if (!job) return;
  const def = ACTIVE_JOB_DEFS[job.kind];
  if (!def){ state.player.activeJob = null; return; }
  if (def.setTarget) def.setTarget(job.targetId);
  const remainingSec = job.durationSec - (Date.now() - job.startedAt) / 1000;
  if (remainingSec <= 0){
    def.finish(); // сам обнулит state.player.activeJob через endActiveJob()
    toast("Пока вас не было — работа завершилась, ресурсы уже в инвентаре.");
  } else {
    resumeActiveTimerJob(job.kind, remainingSec);
  }
}

/* ===== Пассивная регенерация HP (вне боя, реальное время) ===== */
const HP_REGEN_TICK_SECONDS = 8;
function hpRegenAmount(){
  const p = state.player;
  const s = effectiveStats();
  return Math.max(1, Math.round(p.maxHp * 0.015 + s.hpStat * 0.1));
}
function tickHpRegen(){
  const p = state.player;
  if (inBattle()) return;
  if (p.hp >= p.maxHp) return;
  p.hp = Math.min(p.maxHp, p.hp + hpRegenAmount());
  renderHome();
}
setInterval(tickHpRegen, HP_REGEN_TICK_SECONDS * 1000);

/* ===== Init ===== */
requestNotifyPermission();
renderHome();
