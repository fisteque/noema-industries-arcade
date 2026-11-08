const assert = require("node:assert/strict");
require("./lib/content-registry.js");
const E = require("./engine.js");

let state = E.createState();
state = E.collectPotato(state, "potato-test", "loose");
assert.equal(state.carriedItem.kind, "potato");
assert.equal(state.potatoes, 0);
for (const site of E.SITES) {
  state = E.visit(state, site.id);
  if (site.id === "breza") state = E.setIdentification(state, "speciesGuess", "medovka");
  state = E.resolve(state, "all");
}
assert.equal(E.basketLoad(state), 5);
assert.equal(state.basketRecords[0].identifiedInForest, true);
state = E.goHome(state);
assert.equal(state.phase, "home-arrival");
assert.equal(state.potatoes, 1);
state = E.startHomeWork(state);
assert.equal(state.minutes, E.TIMINGS.workStart);
assert.equal(state.phase, "identifying");
state.basketRecords.forEach((record, index) => {
  if (!record.homeDecision) state = E.leaveHomeUnknown(state, index);
});
const beforeFinish = state.minutes;
state = E.finishHomeIdentification(state);
assert.equal(state.minutes, beforeFinish);
assert.equal(state.phase, "evening-order");

let threshold = E.createState();
threshold.basket = ["medovka", "hnedka"];
threshold.basketRecords = [{ actual: "medovka" }, { actual: "hnedka" }];
assert.equal(E.goHome(threshold).phase, "forest");
threshold.basket.push("ohnivka");
threshold.basketRecords.push({ actual: "ohnivka" });
assert.equal(E.goHome(threshold).phase, "home-arrival");

let inventory = E.createState();
inventory.basket = ["hnedka"];
inventory.basketRecords = [{ site: "mech", actual: "hnedka", speciesGuess: "medovka", forestGuess: "medovka", identifiedInForest: true }];
const inventoryStart = inventory.minutes;
inventory = E.identifyBasketItem(inventory, "basket", 0, "medovka");
assert.equal(inventory.error, null);
assert.equal(inventory.basketRecords[0].speciesGuess, "medovka");
assert.equal(inventory.minutes, inventoryStart);
inventory = E.identifyBasketItem(inventory, "basket", 0, "hnedka");
assert.equal(inventory.basketRecords[0].speciesGuess, "hnedka");
assert.equal(inventory.minutes, inventoryStart + 5);
inventory = E.discardInventoryItem(inventory, "basket", 0);
assert.equal(inventory.basket.length, 0);

let atlas = E.createState();
atlas.phase = "identifying";
atlas.minutes = E.TIMINGS.workStart;
atlas.basket = ["hnedka"];
atlas.basketRecords = [{ site: "mech", actual: "hnedka", speciesGuess: null, identifiedInForest: false, identificationMinutesCharged: false }];
atlas = E.consultHomeLexicon(atlas, 0);
assert.equal(atlas.focus, 3);
assert.equal(atlas.minutes, E.TIMINGS.workStart + 30);
assert.equal(atlas.hunger, 10);
assert.equal(E.TIMINGS.hungerTick, 60);
assert.equal(atlas.basketRecords[0].consultedLexicon, true);

let rocking = E.createState();
rocking.phase = "home-arrival";
rocking.minutes = 13 * 60 + 40;
rocking.hunger = 9;
rocking.focus = 3;
rocking.basket = ["medovka"];
rocking.basketRecords = [{ site: "breza", actual: "medovka" }];
rocking = E.startHomeWork(rocking);
assert.equal(rocking.minutes, E.TIMINGS.workStart);
assert.equal(rocking.hunger, 9);
assert.equal(rocking.focus, 5);
assert.equal(rocking.phase, "identifying");
assert.ok(rocking.notes.some((note) => /doma sytost neubývá/.test(note)));

let soup = E.createState();
soup.phase = "soup";
soup.minutes = E.TIMINGS.workStart;
soup.order = "soup-first";
soup.basket = ["medovka", "hnedka"];
soup.basketRecords = [{ site: "a", actual: "medovka" }, { site: "b", actual: "hnedka" }];
soup.potatoes = 1;
soup = E.cookSoup(soup, { mushroomIndexes: [1], potatoCount: 0 });
assert.equal(soup.soup.potatoesUsed, 0);
assert.deepEqual(soup.basket, ["medovka"]);
assert.equal(soup.potatoes, 1);
assert.equal(soup.minutes, E.TIMINGS.workStart + 60);
assert.equal(soup.phase, "cooking-result");
assert.equal(soup.nextPhase, null);
soup = E.eatSoup(soup);
assert.equal(soup.minutes, E.TIMINGS.workStart + 90);
assert.equal(soup.phase, "pot-cleanup");
soup = E.washPot(soup);
assert.equal(soup.minutes, E.TIMINGS.workStart + 120);
assert.equal(soup.phase, "potion");

let memory = E.createState();
memory.knowledge = Array.from({ length: E.MEMORY_LIMIT }, (_, index) => ({
  id: `test:${index}`,
  type: "exclusion",
  species: "hnedka",
  title: `Záporná stopa ${index}`,
  text: "Pokusný záznam"
}));
memory = E.forgetKnowledge(memory, "test:2");
assert.equal(memory.knowledge.length, E.MEMORY_LIMIT - 1);
assert.equal(memory.knowledge.some((entry) => entry.id === "test:2"), false);

let corrected = E.createState();
corrected.phase = "identifying";
corrected.minutes = E.TIMINGS.workStart;
corrected.focus = 5;
corrected.basket = ["hnedka"];
corrected.basketRecords = [{ actual: "hnedka", forestGuess: null, speciesGuess: null, homeDecision: null, consultedLexicon: false }];
corrected.knowledge = [
  { id: "not:hnedka:medovka", type: "exclusion", species: "hnedka", excludedSpecies: "medovka", title: "Není Medovka", text: "Záporná stopa" },
  ...Array.from({ length: E.MEMORY_LIMIT - 1 }, (_, index) => ({ id: `other:${index}`, type: "exclusion", species: "belokruh", title: `Jiná stopa ${index}`, text: "Jiný záznam" }))
];
corrected = E.consultHomeLexicon(corrected, 0);
assert.equal(corrected.error, null);
assert.equal(corrected.knowledge.length, E.MEMORY_LIMIT);
assert.equal(corrected.knowledge.some((entry) => entry.id === "not:hnedka:medovka"), false);
assert.equal(corrected.knowledge.some((entry) => entry.id === "mushroom:hnedka"), true);

assert.equal(Object.keys(E.SPECIES).length, 7);
const daySpecies = E.createDaySpecies(7316);
assert.equal(Object.keys(daySpecies).length, 5);
assert.equal(new Set(Object.values(daySpecies)).size, 5);

console.log("v2-71 compatibility engine checks passed");




