// Статичные данные мира для MVP — небольшой, но подлинный срез оригинала
// (реальные районы/NPC/предметы из восстановленного дампа territory.ru,
// не все 358 areas/72 предмета сразу — расширяется по фазам плана).

const CITY = "Химер-Сити";

const AREAS = [
  { id: "novy_gorod", name: "Новый город", type: "district", parent: null },
  { id: "ng_vokzal", name: "Вокзал", type: "street", parent: "novy_gorod", shop: false, npcs: ["bomj"] },
  { id: "ng_rynok", name: "Хитрованский рынок", type: "street", parent: "novy_gorod", shop: true, npcs: ["bomj", "taxist"] },

  { id: "armandon", name: "Армандон", type: "district", parent: null },
  { id: "ar_sklad", name: "Склад", type: "street", parent: "armandon", shop: false, npcs: ["zek", "manyak"] },
  { id: "ar_magaz", name: 'Магазин "Территория"', type: "street", parent: "armandon", shop: true, npcs: ["znayka"] },

  { id: "staryi_gorod", name: "Старый город", type: "district", parent: null },
  { id: "sg_tupik", name: "Тёмный тупик", type: "street", parent: "staryi_gorod", shop: false, npcs: ["psycho", "killer"] },
  { id: "sg_ploshad", name: "Центральная площадь", type: "street", parent: "staryi_gorod", shop: true, npcs: ["bender"] },
];

// Расстояние — условные секунды в пути (в оригинале areas_links.DISTANCE было 15000-40000,
// здесь отмасштабировано вниз для играбельного MVP).
const LINKS = [
  { a: "ng_vokzal", b: "ng_rynok", distance: 8 },
  { a: "ng_rynok", b: "ar_sklad", distance: 20 },
  { a: "ar_sklad", b: "ar_magaz", distance: 8 },
  { a: "ar_magaz", b: "sg_tupik", distance: 20 },
  { a: "sg_tupik", b: "sg_ploshad", distance: 8 },
];

const START_AREA = "ng_vokzal";

// Реальные NPC-шаблоны (bot_artikuls) с их статами из досье.
const NPCS = {
  bomj: { name: "Бомж", canAttack: false, str: 3, dex: 3, health: 3, hit: [1, 3], armor: {} },
  manyak: { name: "Маньяк", canAttack: true, str: 6, dex: 6, health: 6, hit: [2, 5], armor: {} },
  bender: { name: "Остап Бендер", canAttack: false, str: 2, dex: 2, health: 6, hit: [1, 2], armor: {} },
  taxist: { name: "Сумасшедший таксист", canAttack: false, str: 3, dex: 2, health: 3, hit: [1, 3], armor: {} },
  zek: { name: "Вечный зек", canAttack: true, str: 1, dex: 10, health: 5, hit: [1, 3], armor: {} },
  znayka: { name: "Знайка", canAttack: false, str: 1, dex: 2, health: 3, hit: [1, 2], armor: {} },
  psycho: { name: "Уличный псих", canAttack: true, str: 10, dex: 10, health: 10, hit: [3, 8], armor: { head: 1, chest: 1, groin: 1, legs: 1 } },
  killer: { name: "Ночной убийца", canAttack: true, str: 10, dex: 10, health: 10, hit: [4, 10], armor: { head: 1, chest: 2, groin: 1, legs: 1 } },
};

// Срез реального каталога предметов (72 в оригинале) — по одному-два на слот,
// с подлинными названиями/ценами/весом и бонусами там, где они были задокументированы.
const ITEMS = [
  { id: "kastet", name: "Кастет", slot: "rh", type: "weapon", weight: 4, price: 52, hit: [2, 6] },
  { id: "topor", name: "Топорик", slot: "rh", type: "weapon", weight: 4, price: 49, hit: [2, 7] },
  { id: "rozochka", name: "Розочка", slot: "rh", type: "weapon", weight: 3, price: 23, hit: [1, 3] },

  { id: "vyaz_shapka", name: "Вязаная шапка", slot: "gu", type: "headwear", weight: 4, price: 21, armor: { head: 2 } },
  { id: "beisbolka", name: "Бейсболка", slot: "gu", type: "headwear", weight: 3, price: 9, armor: { head: 1 } },

  { id: "telnyashka", name: "Тельняшка", slot: "no", type: "armor", weight: 4, price: 18, armor: { chest: 2 } },
  { id: "sviter", name: "Свитер чёрный", slot: "no", type: "armor", weight: 5, price: 19, armor: { chest: 1 } },

  { id: "jeans_varenki", name: "Джинсы варенки", slot: "sh", type: "pants", weight: 3, price: 11, armor: { groin: 1 } },
  { id: "jeans_sinie", name: "Джинсы синие", slot: "sh", type: "pants", weight: 5, price: 17, armor: { groin: 2 } },

  { id: "krossovki", name: "Кроссовки", slot: "bo", type: "shoes", weight: 3, price: 19.5, armor: { legs: 1 } },
  { id: "botinki", name: "Ботинки", slot: "bo", type: "shoes", weight: 5, price: 22, armor: { legs: 4 } },
];

const BARE_HANDS = { hit: [1, 2] };

function itemById(id) {
  return ITEMS.find((i) => i.id === id) || null;
}

function areaById(id) {
  return AREAS.find((a) => a.id === id) || null;
}

function linkedAreas(areaId) {
  return LINKS.filter((l) => l.a === areaId || l.b === areaId).map((l) => {
    const otherId = l.a === areaId ? l.b : l.a;
    return { area: areaById(otherId), distance: l.distance };
  });
}

module.exports = { CITY, AREAS, LINKS, NPCS, ITEMS, START_AREA, BARE_HANDS, itemById, areaById, linkedAreas };
