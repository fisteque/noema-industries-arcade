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
    memoryKnowledgeId: null,
    memoryExclusion: null,
    memoryRejectedSpecies: [],
    homeDecision: null,
    consultedLexicon: false,
    identificationMinutesCharged: false
  };
}

// Zápisník nic neurčuje automaticky: hráčka musí záznam u konkrétní houby použít.
{
  let state = E.createState();
  state.phase = "home-arrival";
  state.basket = ["hnedka"];
  state.basketRecords = [mushroomRecord("hnedka")];
  state.knowledge = [{
    id: "mushroom:hnedka",
    type: "mushroom",
    species: "hnedka",
    title: "Hnědka mechová",
    text: "Jistý záznam"
  }];
  state = E.startHomeWork(state);
  assert.equal(state.phase, "identifying");
  assert.equal(state.basketRecords[0].homeDecision, null);
  assert.equal(state.basketRecords[0].speciesGuess, null);
}

// Výslovné porovnání může potvrdit druh v lese i doma a nestojí herní čas.
{
  let forest = E.createState();
  forest = E.visit(forest, "breza");
  const actual = E.getSite("breza", forest).species;
  forest.knowledge = [{
    id: `mushroom:${actual}`,
    type: "mushroom",
    species: actual,
    title: E.getSpecies(actual).name,
    text: "Jistý záznam"
  }];
  const start = forest.minutes;
  forest = E.recognizeFromKnowledge(forest, "current", 0, `mushroom:${actual}`);
  forest = E.resolve(forest, "all");
  assert.equal(forest.minutes, start);
  assert.equal(forest.basketRecords[0].memoryKnowledgeId, `mushroom:${actual}`);
  assert.equal(forest.basketRecords[0].forestGuess, null);

  let home = E.createState();
  home.phase = "identifying";
  home.basket = ["hnedka"];
  home.basketRecords = [mushroomRecord("hnedka")];
  home.knowledge = [{
    id: "mushroom:hnedka",
    type: "mushroom",
    species: "hnedka",
    title: "Hnědka mechová",
    text: "Jistý záznam"
  }];
  const homeStart = home.minutes;
  home = E.recognizeFromKnowledge(home, "home", 0, "mushroom:hnedka");
  assert.equal(home.minutes, homeStart);
  assert.equal(home.basketRecords[0].homeDecision, "memory");
  assert.equal(home.basketRecords[0].speciesGuess, "hnedka");
}

// Záporná stopa pozná konkrétní houbu, ale potvrzuje pouze vyloučený druh.
{
  let state = E.createState();
  state.phase = "identifying";
  state.basket = ["hnedka"];
  state.basketRecords = [mushroomRecord("hnedka")];
  state.knowledge = [{
    id: "not:hnedka:medovka",
    type: "exclusion",
    species: "hnedka",
    excludedSpecies: "medovka",
    title: "Není Medovka hřebenitá",
    text: "Záporná stopa"
  }];
  state = E.recognizeFromKnowledge(state, "home", 0, "not:hnedka:medovka");
  assert.equal(state.basketRecords[0].homeDecision, "memory-exclusion");
  assert.equal(state.basketRecords[0].memoryExclusion, "medovka");
  assert.equal(state.basketRecords[0].speciesGuess, null);
}

// Cizí kladný záznam houbu nepotvrdí a zůstane označený jako odmítnuté porovnání.
{
  let state = E.createState();
  state.phase = "identifying";
  state.basket = ["hnedka"];
  state.basketRecords = [mushroomRecord("hnedka")];
  state.knowledge = [{
    id: "mushroom:medovka",
    type: "mushroom",
    species: "medovka",
    title: "Medovka hřebenitá",
    text: "Jistý záznam"
  }];
  state = E.recognizeFromKnowledge(state, "home", 0, "mushroom:medovka");
  assert.match(state.error, /tahle houba není/);
  assert.deepEqual(state.basketRecords[0].memoryRejectedSpecies, ["medovka"]);
  assert.equal(state.basketRecords[0].homeDecision, null);
}

// Obtížnost určuje ranní soustředění a přechází i do dalšího dne.
{
  assert.equal(E.createState("normal").focus, 5);
  assert.equal(E.createState("easy").focus, 10);
  const next = E.nextDay(E.createState("easy"));
  assert.equal(next.difficulty, "easy");
  assert.equal(next.focus, 10);
}

// Hladový večer (2 sytosti a méně) nechá ráno jen 2 sytosti a zkrátí soustředění.
{
  const normal = E.createState("normal");
  normal.hunger = 2;
  assert.equal(E.nextDay(normal).hunger, 2);
  assert.equal(E.nextDay(normal).focus, 3);
  const easy = E.createState("easy");
  easy.hunger = 1;
  assert.equal(E.nextDay(easy).hunger, 2);
  assert.equal(E.nextDay(easy).focus, 5);
  const fed = E.createState("normal");
  fed.hunger = 3;
  assert.equal(E.nextDay(fed).hunger, 10);
  assert.equal(E.nextDay(fed).focus, 5);
}

// Po vynechání se pokračuje rovnou druhým vařením nebo závěrem; hotový večer nemá mezistanici.
{
  let blocked = E.createState();
  blocked.phase = "soup";
  blocked.order = "soup-first";
  blocked.hunger = 1;
  blocked.focus = 5;
  assert.equal(E.canBrewPotion(blocked), false);
  blocked = E.skipSoup(blocked);
  assert.equal(blocked.phase, "ending");
  assert.equal(blocked.potion.title, "Na lektvar nezbyla síla");

  let allowed = E.createState();
  allowed.phase = "soup";
  allowed.order = "soup-first";
  allowed.hunger = 2;
  allowed.focus = 1;
  assert.equal(E.canBrewPotion(allowed), true);
  allowed = E.skipSoup(allowed);
  assert.equal(allowed.phase, "potion");
  assert.equal(allowed.order, "soup-first");

  let potionFirst = E.createState();
  potionFirst.phase = "evening-order";
  potionFirst = E.chooseOrder(potionFirst, "potion-first");
  potionFirst = E.skipPotion(potionFirst);
  assert.equal(potionFirst.phase, "soup");
  assert.equal(potionFirst.order, "potion-first");

  let completed = E.createState();
  completed.phase = "potion";
  completed.soup = { ok: true, title: "Hotová polévka" };
  completed = E.skipPotion(completed);
  assert.equal(completed.phase, "ending");
}

// Nový lesní tip v košíku stojí 5 minut; stejný tip ani návrat k „nevím“ čas neberou.
{
  let state = E.createState();
  state.basket = ["hnedka"];
  state.basketRecords = [mushroomRecord("hnedka", "medovka")];
  const start = state.minutes;
  state = E.identifyBasketItem(state, "basket", 0, "hnedka");
  assert.equal(state.basketRecords[0].speciesGuess, "hnedka");
  assert.equal(state.basketRecords[0].forestGuess, "hnedka");
  assert.equal(state.minutes, start + 5);
  state = E.identifyBasketItem(state, "basket", 0, "hnedka");
  assert.equal(state.minutes, start + 5);
  state = E.identifyBasketItem(state, "basket", 0, "");
  assert.equal(state.basketRecords[0].speciesGuess, null);
  assert.equal(state.minutes, start + 5);
  state = E.identifyBasketItem(state, "basket", 0, "inkoustovka");
  assert.equal(state.minutes, start + 10);
  assert.match(state.notes[0], /Po 5 minutách/);
}

// První tip se účtuje až při sebrání; neurčená houba žádný čas navíc nestojí.
{
  let guessed = E.createState();
  const guessedStart = guessed.minutes;
  guessed = E.visit(guessed, "breza");
  guessed = E.setIdentification(guessed, "speciesGuess", E.identificationOptions(E.getSite("breza", guessed).species)[0]);
  assert.equal(guessed.minutes, guessedStart);
  guessed = E.resolve(guessed, "all");
  assert.equal(guessed.minutes, guessedStart + 5);

  let unknown = E.createState();
  const unknownStart = unknown.minutes;
  unknown = E.visit(unknown, "breza");
  unknown = E.resolve(unknown, "all");
  assert.equal(unknown.minutes, unknownStart);
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
  assert.match(blocked.error, /Zápisník je plný/);
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







// Následné porovnání se zápisníkem nesmí přepsat čerstvé určení lexikonem.
{
  let state = E.createState();
  state.phase = "identifying";
  state.minutes = E.TIMINGS.workStart;
  state.basket = ["ohnivka"];
  state.basketRecords = [mushroomRecord("ohnivka")];
  state = E.consultHomeLexicon(state, 0);
  assert.equal(state.basketRecords[0].homeDecision, "lexicon");
  assert.ok(state.knowledge.some((entry) => entry.id === "mushroom:ohnivka"));
  state = E.recognizeFromKnowledge(state, "home", 0, "mushroom:ohnivka");
  assert.equal(state.basketRecords[0].homeDecision, "lexicon");
  assert.equal(state.basketRecords[0].guessSource || null, null);
  assert.equal(state.basketRecords[0].speciesGuess, "ohnivka");
}

console.log("Klobouky a hlízy v2-61: pravidla prošla.");

