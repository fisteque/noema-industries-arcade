(function (root, factory) {
  const content = root?.KloboukyContent || (typeof require === "function" ? require("./lib/content-registry.js") : null);
  const api = factory(content);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KloboukyEngine = api;
})(typeof window !== "undefined" ? window : globalThis, function (content) {
  "use strict";
  if (!content) throw new Error("Chybí registr herního obsahu.");
  const { SPECIES, SITES, IDENTIFICATION_OPTIONS, TIMINGS, EQUIPMENT } = content;
  const MEMORY_LIMIT = 5;
  const BASKET_LIMIT = EQUIPMENT.baskets.wicker.capacity;
  const HOME_MINIMUM = EQUIPMENT.baskets.wicker.returnThreshold;
  const NIGHT_START = TIMINGS.nightStart;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isNight(minutes) {
    const minute = ((Math.floor(minutes) % 1440) + 1440) % 1440;
    return minute >= NIGHT_START || minute < 5 * 60;
  }

  function advanceMinutes(state, minutes) {
    const amount = Math.max(0, Math.floor(minutes || 0));
    state.minutes = Number.isFinite(state.minutes) ? state.minutes : TIMINGS.dayStart;
    state.hungerMinutes = Number.isFinite(state.hungerMinutes) ? state.hungerMinutes : 0;
    state.minutes += amount;
    state.hungerMinutes += amount;
    while (state.hungerMinutes >= TIMINGS.hungerTick) {
      state.hungerMinutes -= TIMINGS.hungerTick;
      state.hunger = Math.max(0, state.hunger - 1);
    }
    return state;
  }

  function basketLoad(state) {
    return state.basket?.length || 0;
  }

  function isDepleted(state) {
    return Number(state?.hunger || 0) <= 0 || Number(state?.focus || 0) <= 0;
  }

  function createState() {
    return {
      phase: "forest",
      day: 1,
      minutes: TIMINGS.dayStart,
      hungerMinutes: 0,
      hunger: 10,
      focus: 5,
      bread: 1,
      visited: [],
      compared: [],
      basket: [],
      basketRecords: [],
      carriedItem: null,
      potatoes: 0,
      collectedPotatoes: [],
      knowledge: [],
      identifications: {},
      identificationDraft: { speciesGuess: null },
      soupIdentifications: [],
      arrivalMinutes: null,
      current: null,
      order: null,
      soup: null,
      potion: null,
      identificationSummary: [],
      rockingHours: 0,
      collisionFreeMinutes: 0,
      forcedHome: null,
      walkedRemainder: 0,
      notes: ["V 07:00 vyrážíš s chlebem, prázdným košíkem a lexikon necháváš doma."],
      error: null
    };
  }

  function getSite(id) {
    return SITES.find((site) => site.id === id);
  }

  function getSpecies(id) {
    return SPECIES[id];
  }

  function atlasCost(state) {
    if (!state.current) return 2;
    const site = getSite(state.current);
    const known = state.knowledge?.some((entry) => entry.type === "mushroom" && entry.species === site?.species);
    return known ? 0 : 2;
  }

  function identificationOptions(speciesId) {
    return (IDENTIFICATION_OPTIONS[speciesId] || Object.keys(SPECIES).slice(0, 3)).slice();
  }

  function setIdentification(input, field, value) {
    const state = clone(input);
    const site = getSite(state.current);
    if (state.phase !== "forest" || !site || field !== "speciesGuess") return fail(state, "Teď není co určovat.");
    const allowed = identificationOptions(site.species);
    if (value && !allowed.includes(value)) return fail(state, "Tahle možnost k nálezu nepatří.");
    state.identificationDraft = { speciesGuess: value || null };
    state.error = null;
    return state;
  }

  function visit(input, siteId) {
    const state = clone(input);
    const site = getSite(siteId);
    if (state.phase !== "forest" || state.current || !site || state.visited.includes(siteId)) return fail(state, "Tudy už dnešní cesta nevede.");
    state.current = siteId;
    state.error = null;
    state.notes.unshift(`${clock(state.minutes)} · ${site.name}: ${site.intro}`);
    return state;
  }

  function compare(input) {
    const state = clone(input);
    return fail(state, "Lexikon zůstal doma. V lese se musíš dívat sama.");
  }

  function resolve(input, choice) {
    const state = clone(input);
    const site = getSite(state.current);
    if (!site) return fail(state, "Není co ukládat do košíku.");
    const species = getSpecies(site.species);
    state.basketRecords ||= [];
    if (choice === "all") {
      const record = {
        site: site.id,
        actual: species.id,
        speciesGuess: state.identificationDraft?.speciesGuess || null,
        identifiedInForest: Boolean(state.identificationDraft?.speciesGuess),
        consultedLexicon: false,
        identificationMinutesCharged: false
      };
      if (basketLoad(state) < BASKET_LIMIT) {
        state.basket.push(species.id);
        state.basketRecords.push(record);
        state.notes.unshift(`${clock(state.minutes)} · Bereš ${record.speciesGuess ? "v lese určenou" : "neurčenou"} houbu do košíku.`);
      } else if (!state.carriedItem) {
        state.carriedItem = { kind: "mushroom", id: species.id, record };
        state.notes.unshift(`${clock(state.minutes)} · Košík je plný; ${record.speciesGuess ? "určenou" : "neurčenou"} houbu neseš v ruce.`);
      } else {
        return fail(state, "Košík je plný a v ruce už něco neseš.");
      }
      state.visited.push(site.id);
    } else {
      state.notes.unshift(`${clock(state.minutes)} · Necháváš houbu tam, kde vyrostla.`);
    }
    state.current = null;
    state.identificationDraft = { speciesGuess: null };
    state.error = null;
    return state;
  }

  function identifyBasketItem(input, source, index, speciesGuess) {
    const state = clone(input);
    if (state.phase !== "forest" || state.current) return fail(state, "Obsah košíku teď neurčuješ.");
    const record = source === "hand" ? state.carriedItem?.record : state.basketRecords?.[index];
    if (!record) return fail(state, "Tahle houba už v inventáři není.");
    const allowed = identificationOptions(record.actual);
    if (speciesGuess && !allowed.includes(speciesGuess)) return fail(state, "Tahle možnost k nálezu nepatří.");
    record.speciesGuess = speciesGuess || null;
    record.identifiedInForest = Boolean(speciesGuess);
    state.notes.unshift(`${clock(state.minutes)} · ${speciesGuess ? `V lese ji určuješ jako ${getSpecies(speciesGuess).name}.` : "Určení houby odkládáš."}`);
    state.error = null;
    return state;
  }

  function discardInventoryItem(input, source, index) {
    const state = clone(input);
    if (state.phase !== "forest" || state.current) return fail(state, "Teď nemůžeš přerovnávat inventář.");
    if (source === "hand") {
      if (!state.carriedItem) return fail(state, "V ruce nic neneseš.");
      state.notes.unshift(`${clock(state.minutes)} · Nález z ruky necháváš v lese.`);
      state.carriedItem = null;
    } else {
      if (!state.basket?.[index]) return fail(state, "Tahle houba už v košíku není.");
      state.basket.splice(index, 1);
      state.basketRecords.splice(index, 1);
      state.notes.unshift(`${clock(state.minutes)} · Jednu houbu vyhazuješ z košíku.`);
    }
    state.error = null;
    return state;
  }

  function goHome(input, options = {}) {
    const state = clone(input);
    const forced = Boolean(options.forced) || isDepleted(state);
    if (state.phase !== "forest") return fail(state, "Teď ještě nemůžeš odejít z lesa.");
    if (state.current && !forced) return fail(state, "Teď ještě nemůžeš odejít z lesa.");
    if (basketLoad(state) < HOME_MINIMUM && !forced) return fail(state, `Domů se můžeš vydat nejdřív se ${HOME_MINIMUM} houbami.`);
    if (forced) {
      state.current = null;
      state.identificationDraft = { speciesGuess: null };
      state.forcedHome = options.reason || (state.focus <= 0 ? "Došlo ti soustředění." : "Došlo ti jídlo.");
    }
    const handDelay = state.carriedItem ? TIMINGS.carriedItemDelay : 0;
    advanceMinutes(state, TIMINGS.travelHome + handDelay);
    if (state.carriedItem?.kind === "mushroom") {
      state.basket.push(state.carriedItem.id);
      state.basketRecords.push(state.carriedItem.record);
    } else if (state.carriedItem?.kind === "potato") {
      state.potatoes += 1;
    }
    const carried = Boolean(state.carriedItem);
    state.carriedItem = null;
    state.arrivalMinutes = state.minutes;
    state.phase = "home-arrival";
    const reason = state.forcedHome ? ` ${state.forcedHome}` : "";
    state.notes.unshift(`${clock(state.minutes)} · Jsi doma. Cesta trvala ${carried ? "hodinu s nálezem v ruce" : "půl hodiny"}.${reason}`);
    state.error = null;
    return state;
  }

  function forceHome(input, reason) {
    return goHome(input, { forced: true, reason });
  }

  function startHomeWork(input) {
    const state = clone(input);
    if (state.phase !== "home-arrival") return fail(state, "V chaloupce teď není na co čekat.");
    const emergency = isDepleted(state);
    if (state.minutes < TIMINGS.workStart) {
      const waitingMinutes = TIMINGS.workStart - state.minutes;
      const rockingHours = Math.floor(waitingMinutes / 60);
      state.minutes = TIMINGS.workStart;
      if (rockingHours > 0 && !emergency) {
        state.hunger = Math.max(0, state.hunger - rockingHours * 0.5);
        state.focus = Math.min(7, state.focus + rockingHours);
        state.rockingHours = (state.rockingHours || 0) + rockingHours;
        state.notes.unshift(`${clock(state.minutes)} · ${rockingHours} ${rockingHours === 1 ? "hodina v houpacím křesle bere" : "hodiny v houpacím křesle berou"} ${rockingHours * 0.5} sytosti a vracejí ${rockingHours} soustředění.`);
      } else if (rockingHours > 0 && emergency) {
        state.notes.unshift(`${clock(state.minutes)} · Bez jídla nebo soustředění jen čekáš do začátku práce; v křesle neodpočíváš.`);
      }
    }
    state.identificationSummary = [];
    state.phase = state.basket.length ? "identifying" : "evening-order";
    state.notes.unshift(`${clock(state.minutes)} · Odkládáš čaj a začínáš pracovat.`);
    state.error = null;
    return state;
  }

  function homeSetIdentification(input, index, speciesGuess) {
    const state = clone(input);
    if (state.phase !== "identifying") return fail(state, "Houby teď neurčuješ.");
    const record = state.basketRecords?.[index];
    if (!record) return fail(state, "Tahle houba v košíku není.");
    const allowed = identificationOptions(record.actual);
    if (speciesGuess && !allowed.includes(speciesGuess)) return fail(state, "Tahle možnost k nálezu nepatří.");
    const nextGuess = speciesGuess || null;
    const changed = (record.speciesGuess || null) !== nextGuess;
    record.speciesGuess = nextGuess;
    if (changed) {
      record.identifiedInForest = false;
      record.consultedLexicon = false;
      record.identificationMinutesCharged = false;
    }
    state.error = null;
    return state;
  }

  function consultHomeLexicon(input, index) {
    const state = clone(input);
    if (state.phase !== "identifying") return fail(state, "Lexikon otevíráš až doma při určování.");
    if (isDepleted(state)) return fail(state, "Bez jídla nebo soustředění zvládneš jen hádat druh a vařit polévku.");
    const record = state.basketRecords?.[index];
    if (!record) return fail(state, "Tahle houba v košíku není.");
    if (record.consultedLexicon) return fail(state, "Lexikon už tuhle houbu potvrdil.");
    if (state.focus < 2) return fail(state, "Na hledání v lexikonu potřebuješ 2 soustředění.");
    const species = getSpecies(record.actual);
    const known = state.knowledge.find((entry) => entry.type === "mushroom" && entry.species === species.id);
    if (!known && state.knowledge.length >= MEMORY_LIMIT) return fail(state, "Paměť je plná. Tuhle znalost už nemáš kam uložit.");
    if (!known) {
      state.knowledge.push({
        id: `mushroom:${species.id}`,
        type: "mushroom",
        species: species.id,
        title: species.name,
        text: species.atlas,
        reliable: true
      });
    }
    record.speciesGuess = species.id;
    record.consultedLexicon = true;
    record.identifiedInForest = false;
    record.identificationMinutesCharged = true;
    state.focus -= 2;
    advanceMinutes(state, TIMINGS.homeLexicon);
    state.notes.unshift(`${clock(state.minutes)} · Lexikon bere ${TIMINGS.homeLexicon} minut a 2 soustředění: ${species.atlas}`);
    state.error = null;
    return state;
  }

  function finishHomeIdentification(input) {
    const state = clone(input);
    if (state.phase !== "identifying") return fail(state, "Určování teď nekončí.");
    if (state.basketRecords.some((record) => !record?.speciesGuess)) {
      return fail(state, "U každé houby musíš vybrat jeden druh.");
    }
    let charged = 0;
    state.basketRecords.forEach((record) => {
      if (record.speciesGuess && !record.identificationMinutesCharged && !record.identifiedInForest) {
        advanceMinutes(state, TIMINGS.homeIdentification);
        record.identificationMinutesCharged = true;
        charged += 1;
      }
    });
    state.identificationSummary = state.basketRecords.map((record) => ({
      actual: record.actual,
      speciesGuess: record.speciesGuess || null
    }));
    state.phase = "evening-order";
    state.notes.unshift(charged
      ? `${clock(state.minutes)} · Domácí určování zabralo ${charged * TIMINGS.homeIdentification} minut.`
      : `${clock(state.minutes)} · Určení z lesa zůstalo beze změny; jdeš k vaření.`);
    state.error = null;
    return state;
  }

  function sortMushrooms(input, decisions) {
    const state = clone(input);
    if (state.phase !== "sorting") return fail(state, "Houby se teď netřídí.");
    const supplied = Array.isArray(decisions) ? decisions : [];
    const normalized = state.basket.map((id, index) => {
      const decision = supplied.find((entry) => Number(entry?.index) === index);
      const record = state.basketRecords?.[index];
      return {
        site: record?.site || `basket-${index}`,
        actual: id,
        guess: decision?.guess,
        speciesGuess: record?.speciesGuess || null
      };
    });
    if (normalized.some((entry) => !["edible", "inedible"].includes(entry.guess))) {
      return fail(state, "Před vařením roztřiď každou houbu na jedlou, nebo nejedlou.");
    }
    state.soupIdentifications = normalized;
    state.phase = "evening-order";
    const edibleCount = normalized.filter((entry) => entry.guess === "edible").length;
    state.notes.unshift(`Třídění: ${edibleCount} do polévky, ${normalized.length - edibleCount} stranou.`);
    state.error = null;
    return state;
  }

  function collectPotato(input, potatoId, style) {
    const state = clone(input);
    state.collectedPotatoes ||= [];
    if (state.phase !== "forest" || state.current) return fail(state, "Teď bramboru sebrat nemůžeš.");
    if (!potatoId || state.collectedPotatoes.includes(potatoId)) return fail(state, "Tady už žádná brambora není.");
    if (state.carriedItem) return fail(state, "Brambora do košíku na houby nepatří a v ruce už něco neseš.");
    state.carriedItem = { kind: "potato", id: potatoId, style };
    state.collectedPotatoes.push(potatoId);
    const note = style === "plant"
      ? "Na kraji lesa vytahuješ z natě jednu bramboru."
      : "Pod křovím nacházíš pohozenou bramboru.";
    state.notes.unshift(`${clock(state.minutes)} · ${note} Neseš ji v ruce; do košíku na houby nepatří.`);
    state.error = null;
    return state;
  }

  function eatBread(input) {
    const state = clone(input);
    if (state.phase !== "forest" || !state.bread) return fail(state, "Chléb už nemáš.");
    state.bread = 0;
    state.hunger = Math.min(10, state.hunger + 3);
    state.focus = Math.min(6, state.focus + 1);
    state.notes.unshift(`${clock(state.minutes)} · Jíš chleba. Sytost i pozornost se vracejí.`);
    state.error = null;
    return state;
  }

  function walk(input, squares) {
    const state = clone(input);
    const amount = Math.max(0, Math.floor(squares || 0));
    advanceMinutes(state, amount);
    state.collisionFreeMinutes = (Number.isFinite(state.collisionFreeMinutes) ? state.collisionFreeMinutes : 0) + amount;
    const safeHours = Math.floor(state.collisionFreeMinutes / 60);
    if (safeHours > 0) {
      state.collisionFreeMinutes -= safeHours * 60;
      const before = state.focus;
      state.focus = Math.min(7, state.focus + safeHours);
      const gained = state.focus - before;
      if (gained > 0) state.notes.unshift(`${clock(state.minutes)} · Hodina chůze bez nárazu vrací ${gained} soustředění.`);
    }
    state.error = null;
    return state;
  }

  function hitTree(input) {
    const state = clone(input);
    state.focus = Math.max(0, state.focus - 1);
    state.collisionFreeMinutes = 0;
    state.notes.unshift(`${clock(state.minutes)} · Náraz do kmene ti bere 1 soustředění a přeruší klidnou hodinu.`);
    state.error = null;
    return state;
  }

  function chooseOrder(input, order) {
    const state = clone(input);
    if (state.phase !== "evening-order" || !["soup-first", "potion-first"].includes(order)) return fail(state, "Večer ještě nezačal.");
    if (order === "potion-first" && isDepleted(state)) return fail(state, "Bez jídla nebo soustředění musí přijít nejdřív polévka.");
    state.order = order;
    state.phase = order === "soup-first" ? "soup" : "potion";
    state.notes.unshift(order === "soup-first" ? "Nejdřív stavíš na kamna polévku." : "Nejdřív zapaluješ modrý kahan pod lektvarem.");
    state.error = null;
    return state;
  }

  function cookSoup(input, selection) {
    const state = clone(input);
    if (state.phase !== "soup") return fail(state, "Polévka teď není na řadě.");
    const normalized = state.basket.map((id, index) => {
      const record = state.basketRecords?.[index];
      return { index, id, record };
    });
    const requestedIndexes = new Set((selection?.mushroomIndexes || []).map(Number));
    const chosenEntries = normalized.filter((entry) => requestedIndexes.has(entry.index));
    const chosenPotatoes = Math.max(0, Math.min(state.potatoes || 0, Math.floor(selection?.potatoCount || 0)));
    if (!chosenEntries.length && !chosenPotatoes) return fail(state, "Vyber aspoň jednu surovinu do polévky.");
    const chosen = chosenEntries.map((entry) => entry.id);
    const chosenIndexes = chosenEntries.map((entry) => entry.index);
    const kinds = chosen.map((id) => getSpecies(id).kind);
    const startedAt = state.minutes;
    advanceMinutes(state, TIMINGS.soup);
    const night = isNight(startedAt) || isNight(state.minutes);
    const nightFailure = night && Math.random() < 0.28;
    let result;
    if (kinds.includes("poison")) {
      result = { ok: false, title: "Polévka, která se brání", text: "Do hrnce jsi vybrala Bělokruh. Vývar se změnil v bílou mlhu; hrnec vyléváš.", tone: "danger" };
      state.hunger = Math.max(0, state.hunger - 2);
      state.focus = Math.max(0, state.focus - 2);
    } else if (kinds.includes("inedible") || kinds.includes("potion")) {
      result = { ok: false, title: "Hořký omyl", text: "Jedna z vybraných hub pálí nebo svítí. Polévku nejíš.", tone: "warning" };
      state.focus = Math.max(0, state.focus - 1);
    } else if (nightFailure) {
      result = { ok: false, title: "Hrnec po tmě přetekl", text: "Suroviny byly bezpečné, ale noční vaření se rozpadlo v nepozornosti. Hlad zůstává.", tone: "warning" };
      state.focus = Math.max(0, state.focus - 1);
    } else if (chosenPotatoes > 0 && kinds.includes("edible")) {
      result = { ok: true, title: "Polévka drží lžíci", text: "Brambory ji zahustily a dobře vybraná houba jí dala vůni lesa.", tone: "good" };
      state.hunger = 10;
      state.focus = Math.min(7, state.focus + 3);
    } else if (chosenPotatoes > 0) {
      result = { ok: true, title: "Poctivá bramboračka", text: "Houby zůstaly stranou. Brambory samy stačily na bezpečnou večeři.", tone: "good" };
      state.hunger = 9;
      state.focus = Math.min(7, state.focus + 2);
    } else if (kinds.includes("edible")) {
      result = { ok: true, title: "Tenký houbový vývar", text: "Správně vybraná houba voní dobře, ale bez brambor zasytí jen na chvíli.", tone: "plain" };
      state.hunger = Math.min(10, state.hunger + 4);
      state.focus = Math.min(7, state.focus + 1);
    } else {
      result = { ok: false, title: "Prázdný hrnec", text: "Všechny houby zůstaly stranou a brambory nemáš.", tone: "plain" };
    }
    removeBasketIndexes(state, chosenIndexes);
    state.potatoes -= chosenPotatoes;
    state.soup = { ...result, night, startedAt };
    state.notes.unshift(`${clock(state.minutes)} · Polévka: ${result.title}.`);
    if (state.order === "soup-first" && isDepleted(state)) {
      state.potion = { ok: false, title: "Na lektvar nezbyla síla", text: "Po nepovedené polévce už zvládneš jen uzavřít den.", tone: "plain", ability: 0 };
      state.phase = "ending";
    } else {
      state.phase = state.order === "soup-first" ? "potion" : "ending";
    }
    state.error = null;
    return state;
  }

  function skipSoup(input) {
    const state = clone(input);
    if (state.phase !== "soup") return fail(state, "Polévka teď není na řadě.");
    state.soup = { ok: false, title: "Hrnec zůstal studený", text: "Večeři jsi vynechala.", tone: "plain" };
    if (state.order === "soup-first" && isDepleted(state)) {
      state.potion = { ok: false, title: "Na lektvar nezbyla síla", text: "Bez večeře už dílnu neotevřeš.", tone: "plain", ability: 0 };
      state.phase = "ending";
    } else {
      state.phase = state.order === "soup-first" ? "potion" : "ending";
    }
    state.notes.unshift("Polévku nevaříš.");
    state.error = null;
    return state;
  }

  function cookingAbility(state) {
    const penalty = state.hunger <= 3 ? 3 : state.hunger <= 5 ? 2 : state.hunger <= 7 ? 1 : 0;
    return Math.max(0, state.focus - penalty);
  }

  function brewPotion(input, ingredients) {
    const state = clone(input);
    if (state.phase !== "potion") return fail(state, "Lektvar teď není na řadě.");
    if (isDepleted(state)) return fail(state, "Bez jídla nebo soustředění lektvar neuvaříš. Nejdřív potřebuješ polévku.");
    const chosen = validSelection(state, ingredients);
    if (chosen.length !== 2) return fail(state, "Lektvar potřebuje právě dvě houby.");
    const set = new Set(chosen);
    const stablePair = set.has("modravec") && (set.has("medovka") || set.has("hnedka"));
    const nightOnlyPair = set.has("modravec") && set.has("ohnivka");
    const startedAt = state.minutes;
    advanceMinutes(state, TIMINGS.potion);
    const night = isNight(startedAt) || isNight(state.minutes);
    const ability = Math.max(0, cookingAbility(state) - (night ? 1 : 0));
    const nightFailure = night && Math.random() < 0.24;
    let result;
    if (nightOnlyPair && night && ability >= 4 && !nightFailure) {
      result = { ok: true, title: "Lektvar nočního oka", text: "Ohnivka po setmění nepálí proti modři, ale skrz ni. Ve tmě se na chvíli ukáže, co se ve dne schovává.", tone: "magic" };
    } else if (nightOnlyPair && !night) {
      result = { ok: false, title: "Směs čeká na noc", text: "Modrá a oranžová se za denního světla odmítají spojit. Tahle dvojice potřebuje tmu.", tone: "plain" };
    } else if (stablePair && ability >= 3 && !nightFailure) {
      const honey = set.has("medovka");
      result = {
        ok: true,
        title: honey ? "Lektvar jasné stopy" : "Lektvar tichého ohně",
        text: honey ? "Stříbrné výtrusy se srovnají do jediné cesty." : "Modré světlo se usadí pod hladinou a nic nepřikrášlí.",
        tone: "magic"
      };
    } else if ((stablePair || nightOnlyPair) && nightFailure) {
      result = { ok: false, title: "Noční rytmus se zlomil", text: "Správná směs se v únavě rozpojila těsně před dokončením.", tone: "warning" };
    } else if (stablePair) {
      result = { ok: false, title: "Lektvar se rozpojil", text: "Suroviny byly správné, ale hlad a únava roztrhly rytmus míchání.", tone: "warning" };
    } else if (chosen.some((id) => ["belokruh", "ohnivka"].includes(id))) {
      result = { ok: false, title: "Kahan zhasl", text: "Směs vyšle štiplavý oblak a sama sfoukne plamen.", tone: "danger" };
    } else {
      result = { ok: false, title: "Obyčejně teplá voda", text: "Dvě dobré věci ještě nemusejí vytvořit vztah.", tone: "plain" };
    }
    removeBasketRecords(state, chosen);
    state.basket = removeItems(state.basket, chosen);
    state.potion = { ...result, ability, night, startedAt };
    state.notes.unshift(`${clock(state.minutes)} · Lektvar: ${result.title}.`);
    state.phase = state.order === "potion-first" ? "soup" : "ending";
    state.error = null;
    return state;
  }

  function skipPotion(input) {
    const state = clone(input);
    if (state.phase !== "potion") return fail(state, "Lektvar teď není na řadě.");
    state.potion = { ok: false, title: "Lahvička zůstala prázdná", text: "Ne každý večer potřebuje kouzlo.", tone: "plain", ability: cookingAbility(state) };
    state.phase = state.order === "potion-first" ? "soup" : "ending";
    state.notes.unshift("Lektvar nevaříš.");
    state.error = null;
    return state;
  }

  function scoreDay(input) {
    const state = clone(input);
    const summary = Array.isArray(state.identificationSummary) ? state.identificationSummary : [];
    const wrongGuesses = summary.filter((record) => record.speciesGuess && record.speciesGuess !== record.actual).length;
    const leftovers = (state.basket?.length || 0) + (state.potatoes || 0) + (state.bread ? 1 : 0) + (state.carriedItem ? 1 : 0);
    const soupPoints = state.soup?.ok ? 8 : 0;
    const potionPoints = state.potion?.ok ? 8 : 0;
    const leftoverPoints = leftovers;
    const chairPoints = Math.max(0, Math.floor(state.rockingHours || 0));
    const mistakePoints = -2 * wrongGuesses;
    const total = soupPoints + potionPoints + leftoverPoints + chairPoints + mistakePoints;
    return {
      soupPoints,
      potionPoints,
      leftovers,
      leftoverPoints,
      rockingHours: Math.max(0, Math.floor(state.rockingHours || 0)),
      chairPoints,
      wrongGuesses,
      mistakePoints,
      total
    };
  }

  function nextDay(input) {
    const previous = clone(input);
    const state = createState();
    state.day = Math.max(1, Math.floor(previous.day || 1)) + 1;
    state.knowledge = clone(Array.isArray(previous.knowledge) ? previous.knowledge : []);
    state.notes = [`Den ${state.day} · Paměť zůstala; do lesa znovu vyrážíš v 07:00.`];
    return state;
  }

  function validSelection(state, ids) {
    const available = state.basket.slice();
    const chosen = [];
    (Array.isArray(ids) ? ids : []).forEach((id) => {
      const index = available.indexOf(id);
      if (index >= 0) {
        chosen.push(id);
        available.splice(index, 1);
      }
    });
    return chosen;
  }

  function removeItems(source, ids) {
    const copy = source.slice();
    ids.forEach((id) => {
      const index = copy.indexOf(id);
      if (index >= 0) copy.splice(index, 1);
    });
    return copy;
  }

  function removeBasketRecords(state, ids) {
    if (!Array.isArray(state.basketRecords)) return;
    const remaining = state.basketRecords.slice();
    ids.forEach((id) => {
      const index = remaining.findIndex((record) => record.actual === id);
      if (index >= 0) remaining.splice(index, 1);
    });
    state.basketRecords = remaining;
  }

  function removeBasketIndexes(state, indexes) {
    const remove = new Set(indexes);
    state.basket = state.basket.filter((_, index) => !remove.has(index));
    if (Array.isArray(state.basketRecords)) {
      state.basketRecords = state.basketRecords.filter((_, index) => !remove.has(index));
    }
  }

  function fail(state, message) {
    state.error = message;
    return state;
  }

  function clock(minutes) {
    const total = ((Math.floor(minutes || 0) % 1440) + 1440) % 1440;
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }

  return {
    SPECIES,
    SITES,
    createState,
    visit,
    compare,
    setIdentification,
    identificationOptions,
    resolve,
    identifyBasketItem,
    discardInventoryItem,
    goHome,
    forceHome,
    startHomeWork,
    homeSetIdentification,
    consultHomeLexicon,
    finishHomeIdentification,
    sortMushrooms,
    collectPotato,
    eatBread,
    walk,
    hitTree,
    chooseOrder,
    cookSoup,
    skipSoup,
    brewPotion,
    skipPotion,
    scoreDay,
    nextDay,
    isDepleted,
    cookingAbility,
    atlasCost,
    MEMORY_LIMIT,
    BASKET_LIMIT,
    HOME_MINIMUM,
    TIMINGS,
    EQUIPMENT,
    isNight,
    basketLoad,
    getSite,
    getSpecies,
    clock
  };
});

