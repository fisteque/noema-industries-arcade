const assert = require("node:assert/strict");
require("./lib/content-registry.js");
const E = require("./engine.js");

function mushroomRecord(actual, forestGuess = null) {
  return {
    site: "test",
    actual,
    speciesGuess: forestGuess,
    forestGuess,
    identifiedInForest: Boolean(forestGuess),
    homeDecision: null,
    consultedLexicon: false,
    identificationMinutesCharged: false
  };
}

// Obtížnost určuje ranní soustředění a přechází i do dalšího dne.
{
  assert.equal(E.createState("normal").focus, 5);
  assert.equal(E.createState("easy").focus, 10);
  const next = E.nextDay(E.createState("easy"));
  assert.equal(next.difficulty, "easy");
  assert.equal(next.focus, 10);
}

// Prázdný žaludek zkrátí ranní soustředění, ale obtížnost zůstane zachovaná.
{
  const normal = E.createState("normal");
  normal.hunger = 0;
  assert.equal(E.nextDay(normal).focus, 3);
  const easy = E.createState("easy");
  easy.hunger = 0;
  assert.equal(E.nextDay(easy).focus, 5);
}

// Po vynechání vaření se vrací večerní rozcestník; lektvar stále potřebuje 2 sytosti a soustředění.
{
  let blocked = E.createState();
  blocked.phase = "soup";
  blocked.order = "soup-first";
  blocked.hunger = 1;
  blocked.focus = 5;
  assert.equal(E.canBrewPotion(blocked), false);
  blocked = E.skipSoup(blocked);
  assert.equal(blocked.phase, "evening-order");
  assert.equal(blocked.potion, null);
  assert.equal(E.finishEvening(blocked).phase, "ending");

  let allowed = E.createState();
  allowed.phase = "soup";
  allowed.order = "soup-first";
  allowed.hunger = 2;
  allowed.focus = 1;
  assert.equal(E.canBrewPotion(allowed), true);
  allowed = E.skipSoup(allowed);
  assert.equal(allowed.phase, "evening-order");
  allowed = E.chooseOrder(allowed, "potion-first");
  assert.equal(allowed.phase, "potion");
  assert.equal(allowed.order, "soup-first");

  let potionFirst = E.createState();
  potionFirst.phase = "evening-order";
  potionFirst = E.chooseOrder(potionFirst, "potion-first");
  potionFirst = E.skipPotion(potionFirst);
  assert.equal(potionFirst.phase, "evening-order");
  potionFirst = E.chooseOrder(potionFirst, "soup-first");
  assert.equal(potionFirst.phase, "soup");
  assert.equal(potionFirst.order, "potion-first");
}

// Lesní tip se po sběru už nedá přepsat.
{
  const state = E.createState();
  state.basket = ["hnedka"];
  state.basketRecords = [mushroomRecord("hnedka", "medovka")];
  const locked = E.identifyBasketItem(state, "basket", 0, "ohnivka");
  assert.equal(locked.basketRecords[0].speciesGuess, "medovka");
  assert.match(locked.error, /neměníš/);
}

// Tip u domácího stolu stojí 15 minut, zůstává neověřený a lexikon ho může potvrdit.
{
  let state = E.createState();
  state.phase = "identifying";
  state.minutes = E.TIMINGS.workStart;
  state.basket = ["hnedka"];
  state.basketRecords = [mushroomRecord("hnedka")];
  state = E.guessAtHome(state, 0, "hnedka");
  assert.equal(state.minutes, E.TIMINGS.workStart + 15);
  assert.equal(state.focus, 5);
  assert.equal(state.basketRecords[0].homeDecision, "guess");
  assert.equal(state.basketRecords[0].homeGuess, "hnedka");
  state = E.consultHomeLexicon(state, 0);
  assert.equal(state.minutes, E.TIMINGS.workStart + 30);
  assert.equal(state.focus, 4);
  assert.equal(state.basketRecords[0].homeDecision, "lexicon");
}

// Každý den má pořád pět nálezů, ale vybírá je bez opakování ze sedmi druhů.
{
  const layouts = Array.from({ length: 12 }, (_, index) => E.createDaySpecies(index + 1));
  layouts.forEach((layout) => {
    assert.equal(Object.keys(layout).length, E.SITES.length);
    assert.equal(new Set(Object.values(layout)).size, E.SITES.length);
    Object.values(layout).forEach((id) => assert.ok(E.SPECIES[id]));
  });
  assert.equal(Object.keys(E.SPECIES).length, 7);
  assert.ok(new Set(layouts.map((layout) => Object.values(layout).join(","))).size > 1);
}

// Návrat domů je povolený až od tří hub.
{
  let state = E.createState();
  state.basket = ["hnedka", "medovka"];
  state.basketRecords = state.basket.map((id) => mushroomRecord(id));
  const blocked = E.goHome(state);
  assert.equal(blocked.phase, "forest");
  assert.match(blocked.error, /3 houbami/);
  state.basket.push("ohnivka");
  state.basketRecords.push(mushroomRecord("ohnivka"));
  assert.equal(E.goHome(state).phase, "home-arrival");
}

// Houba ponechaná v lese nezablokuje stejné naleziště.
{
  let state = E.createState();
  state = E.visit(state, "breza");
  state = E.resolve(state, "leave");
  assert.equal(state.visited.includes("breza"), false);
  assert.equal(E.visit(state, "breza").current, "breza");
}

// Chybný lesní tip vytvoří jen zápornou znalost.
{
  let state = E.createState();
  state.phase = "identifying";
  state.minutes = E.TIMINGS.workStart;
  state.basket = ["hnedka"];
  state.basketRecords = [mushroomRecord("hnedka", "medovka")];
  state = E.consultHomeLexicon(state, 0);
  assert.equal(state.basketRecords[0].homeDecision, "disproved");
  assert.equal(state.basketRecords[0].speciesGuess, null);
  assert.equal(state.knowledge[0].type, "exclusion");
  assert.equal(state.minutes, E.TIMINGS.workStart + 15);
  assert.equal(state.focus, 4);
}

// Úplné určení přepíše záporné stopy o téže houbě, i když byla paměť plná.
{
  let state = E.createState();
  state.phase = "identifying";
  state.minutes = E.TIMINGS.workStart;
  state.basket = ["hnedka"];
  state.basketRecords = [mushroomRecord("hnedka")];
  state.knowledge = [
    { id: "not:hnedka:medovka", type: "exclusion", species: "hnedka", excludedSpecies: "medovka", title: "Není Medovka", text: "Záporná stopa" },
    ...Array.from({ length: E.MEMORY_LIMIT - 1 }, (_, index) => ({
      id: `other:${index}`,
      type: "exclusion",
      species: "belokruh",
      title: `Jiná stopa ${index}`,
      text: "Jiný záznam"
    }))
  ];
  state = E.consultHomeLexicon(state, 0);
  assert.equal(state.error, null);
  assert.equal(state.knowledge.length, E.MEMORY_LIMIT);
  assert.equal(state.knowledge.some((entry) => entry.id === "not:hnedka:medovka"), false);
  assert.equal(state.knowledge.some((entry) => entry.id === "mushroom:hnedka"), true);
}

// Z plné paměti lze záznam vymazat a tím otevřít místo pro lexikon.
{
  let state = E.createState();
  state.phase = "identifying";
  state.minutes = E.TIMINGS.workStart;
  state.basket = ["medovka"];
  state.basketRecords = [mushroomRecord("medovka")];
  state.knowledge = Array.from({ length: E.MEMORY_LIMIT }, (_, index) => ({
    id: `test:${index}`,
    type: "exclusion",
    species: "belokruh",
    title: `Stopa ${index}`,
    text: "Pokusný záznam"
  }));
  const blocked = E.consultHomeLexicon(state, 0);
  assert.match(blocked.error, /Paměť je plná/);
  state = E.forgetKnowledge(blocked, "test:2");
  assert.equal(state.knowledge.length, E.MEMORY_LIMIT - 1);
  state = E.consultHomeLexicon(state, 0);
  assert.equal(state.error, null);
  assert.equal(state.knowledge.some((entry) => entry.id === "mushroom:medovka"), true);
}

// Po prvním hrnci se nejdřív zobrazí výsledek polévky.
{
  let state = E.createState();
  state.phase = "soup";
  state.order = "soup-first";
  state.minutes = E.TIMINGS.workStart;
  state.basket = ["hnedka", "modravec", "medovka"];
  state.basketRecords = state.basket.map((id) => mushroomRecord(id));
  state.potatoes = 1;
  state = E.cookSoup(state, { mushroomIndexes: [0], potatoCount: 1 });
  assert.equal(state.soup.potatoesUsed, 1);
  assert.equal(state.phase, "cooking-result");
  assert.equal(state.cookingResult.kind, "soup");
  assert.equal(state.nextPhase, "potion");
  state = E.continueCooking(state);
  assert.equal(state.phase, "potion");
}

// Nové druhy se účastní určování i vaření: Rosovka je jedlá, Inkoustovka ne.
{
  assert.ok(E.identificationOptions("rosovka").includes("rosovka"));
  assert.ok(E.identificationOptions("inkoustovka").includes("inkoustovka"));

  let edible = E.createState();
  edible.phase = "soup";
  edible.order = "soup-first";
  edible.minutes = E.TIMINGS.workStart;
  edible.basket = ["rosovka"];
  edible.basketRecords = [mushroomRecord("rosovka")];
  edible = E.cookSoup(edible, { mushroomIndexes: [0], potatoCount: 0 });
  assert.equal(edible.soup.ok, true);

  let inedible = E.createState();
  inedible.phase = "soup";
  inedible.order = "soup-first";
  inedible.minutes = E.TIMINGS.workStart;
  inedible.basket = ["inkoustovka"];
  inedible.basketRecords = [mushroomRecord("inkoustovka")];
  inedible = E.cookSoup(inedible, { mushroomIndexes: [0], potatoCount: 0 });
  assert.equal(inedible.soup.ok, false);
}

// Při opačném pořadí se před polévkou ukáže výsledek lektvaru.
{
  let state = E.createState();
  state.phase = "potion";
  state.order = "potion-first";
  state.minutes = E.TIMINGS.workStart;
  state.basket = ["modravec", "medovka", "hnedka"];
  state.basketRecords = state.basket.map((id) => mushroomRecord(id));
  state = E.brewPotion(state, ["modravec", "medovka"]);
  assert.equal(state.phase, "cooking-result");
  assert.equal(state.cookingResult.kind, "potion");
  assert.equal(state.nextPhase, "soup");
  state = E.continueCooking(state);
  assert.equal(state.phase, "soup");
}

// Druhé skutečné vaření už vede na závěr dne.
{
  let state = E.createState();
  state.phase = "potion";
  state.order = "soup-first";
  state.minutes = E.TIMINGS.workStart + E.TIMINGS.soup;
  state.basket = ["modravec", "medovka"];
  state.basketRecords = state.basket.map((id) => mushroomRecord(id));
  state = E.brewPotion(state, ["modravec", "medovka"]);
  assert.equal(state.phase, "ending");
}

// Plná ruka brání sebrání brambory.
{
  let state = E.createState();
  state.carriedItem = { kind: "potato", id: "first", style: "loose" };
  state = E.collectPotato(state, "second", "plant");
  assert.match(state.error, /v ruce už něco neseš/);
}

// Paměť přechází do dalšího dne, ostatní denní stav ne.
{
  let state = E.createState();
  state.knowledge = [{ id: "mushroom:hnedka", type: "mushroom", species: "hnedka", title: "Hnědka mechová", text: "Znalost" }];
  state.basket = ["hnedka"];
  state = E.nextDay(state);
  assert.equal(state.day, 2);
  assert.equal(state.knowledge.length, 1);
  assert.equal(state.basket.length, 0);
}

console.log("Klobouky a hlízy v2-44: pravidla prošla.");



