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
  const POTION_MIN_HUNGER = 2;

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

  function canBrewPotion(state) {
    return Number(state?.hunger || 0) >= POTION_MIN_HUNGER && Number(state?.focus || 0) > 0;
  }

  function normalizeDifficulty(value) {
    return value === "easy" ? "easy" : "normal";
  }

  function morningFocus(difficulty) {
    return normalizeDifficulty(difficulty) === "easy" ? 10 : 5;
  }

  function recoveryFocusCap(state, normalCap = 7) {
    return normalizeDifficulty(state?.difficulty) === "easy" ? 10 : normalCap;
  }

  function createState(difficulty = "normal") {
    const normalizedDifficulty = normalizeDifficulty(difficulty);
    return {
      phase: "forest",
      difficulty: normalizedDifficulty,
      day: 1,
      minutes: TIMINGS.dayStart,
      hungerMinutes: 0,
      hunger: 10,
      focus: morningFocus(normalizedDifficulty),
      bread: 1,
      visited: [],
      siteSpecies: Object.fromEntries(SITES.map((site) => [site.id, site.species])),
      compared: [],
      basket: [],
      basketRecords: [],
      carriedItem: null,
      potatoes: 0,
      collectedPotatoes: [],
      knowledge: [],
      identifications: {},
      identificationDraft: { speciesGuess: null, memoryKnowledgeId: null, memoryExclusion: null, memoryRejectedSpecies: [] },
      soupIdentifications: [],
      arrivalMinutes: null,
      current: null,
      order: null,
      soup: null,
      potion: null,
      cookingResult: null,
      nextPhase: null,
      identificationSummary: [],
      rockingHours: 0,
      collisionFreeMinutes: 0,
      forcedHome: null,
      walkedRemainder: 0,
      notes: ["V 07:00 vyrážíš s chlebem, prázdným košíkem a lexikon necháváš doma."],
      error: null
    };
  }

  function createDaySpecies(seed) {
    let value = ((Number(seed) || 1) ^ 0x9e3779b9) >>> 0;
    const random = () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
    const species = Object.keys(SPECIES);
    for (let index = species.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [species[index], species[other]] = [species[other], species[index]];
    }
    return Object.fromEntries(SITES.map((site, index) => [site.id, species[index]]));
  }

  function activeSites(state) {
    const mapping = state?.siteSpecies || {};
    return SITES.map((site) => ({ ...site, species: SPECIES[mapping[site.id]] ? mapping[site.id] : site.species }));
  }

  function getSite(id, state) {
    return activeSites(state).find((site) => site.id === id);
  }

  function getSpecies(id) {
    return SPECIES[id];
  }

  function atlasCost(state) {
    if (!state.current) return 2;
    const site = getSite(state.current, state);
    const known = state.knowledge?.some((entry) => entry.type === "mushroom" && entry.species === site?.species);
    return known ? 0 : 2;
  }

  function identificationOptions(speciesId) {
    return (IDENTIFICATION_OPTIONS[speciesId] || Object.keys(SPECIES).slice(0, 3)).slice();
  }

  function setIdentification(input, field, value) {
    const state = clone(input);
    const site = getSite(state.current, state);
    if (state.phase !== "forest" || !site || field !== "speciesGuess") return fail(state, "Teď není co určovat.");
    const allowed = identificationOptions(site.species);
    if (value && !allowed.includes(value)) return fail(state, "Tahle možnost k nálezu nepatří.");
    state.identificationDraft = {
      speciesGuess: value || null,
      memoryKnowledgeId: null,
      memoryExclusion: null,
      memoryRejectedSpecies: state.identificationDraft?.memoryRejectedSpecies || []
    };
    state.error = null;
    return state;
  }

  function visit(input, siteId) {
    const state = clone(input);
    const site = getSite(siteId, state);
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
    const site = getSite(state.current, state);
    if (!site) return fail(state, "Není co ukládat do košíku.");
    const species = getSpecies(site.species);
    state.basketRecords ||= [];
    if (choice === "all") {
      const memoryKnowledgeId = state.identificationDraft?.memoryKnowledgeId || null;
      const memoryExclusion = state.identificationDraft?.memoryExclusion || null;
      const record = {
        site: site.id,
        actual: species.id,
        speciesGuess: state.identificationDraft?.speciesGuess || null,
        forestGuess: memoryKnowledgeId ? null : state.identificationDraft?.speciesGuess || null,
        identifiedInForest: Boolean(state.identificationDraft?.speciesGuess) && !memoryKnowledgeId,
        memoryKnowledgeId,
        memoryExclusion,
        memoryRejectedSpecies: state.identificationDraft?.memoryRejectedSpecies || [],
        homeDecision: null,
        consultedLexicon: false,
        identificationMinutesCharged: false
      };
      const toBasket = basketLoad(state) < BASKET_LIMIT;
      if (!toBasket && state.carriedItem) return fail(state, "Košík je plný a v ruce už něco neseš.");
      if (record.speciesGuess && !record.memoryKnowledgeId) advanceMinutes(state, 5);
      if (toBasket) {
        state.basket.push(species.id);
        state.basketRecords.push(record);
        state.notes.unshift(`${clock(state.minutes)} · Bereš ${record.memoryExclusion ? "podle záporné stopy rozpoznanou" : record.memoryKnowledgeId ? "ze zápisníku rozpoznanou" : record.speciesGuess ? "po 5 minutách tipování" : "neurčenou"} houbu do košíku.`);
      } else {
        state.carriedItem = { kind: "mushroom", id: species.id, record };
        state.notes.unshift(`${clock(state.minutes)} · Košík je plný; ${record.memoryExclusion ? "podle záporné stopy rozpoznanou houbu" : record.memoryKnowledgeId ? "ze zápisníku rozpoznanou houbu" : record.speciesGuess ? "po 5 minutách tipování houbu" : "neurčenou houbu"} neseš v ruce.`);
      }
      state.visited.push(site.id);
    } else {
      state.notes.unshift(`${clock(state.minutes)} · Necháváš houbu tam, kde vyrostla.`);
    }
    state.current = null;
    state.identificationDraft = { speciesGuess: null, memoryKnowledgeId: null, memoryExclusion: null, memoryRejectedSpecies: [] };
    state.error = null;
    return state;
  }

  function identifyBasketItem(input, source, index, speciesGuess) {
    const state = clone(input);
    if (state.phase !== "forest" || state.current) return fail(state, "Teď nemůžeš měnit tipy v košíku.");

    let record = null;
    if (source === "hand") {
      if (state.carriedItem?.kind !== "mushroom" || !state.carriedItem.record) return fail(state, "V ruce teď žádnou houbu nemáš.");
      record = state.carriedItem.record;
    } else {
      record = state.basketRecords?.[index] || null;
      if (!state.basket?.[index] || !record) return fail(state, "Tahle houba už v košíku není.");
    }

    const nextGuess = speciesGuess || null;
    const allowed = identificationOptions(record.actual);
    if (nextGuess && !allowed.includes(nextGuess)) return fail(state, "Tahle možnost k nálezu nepatří.");
    if ((record.speciesGuess || null) === nextGuess) {
      state.error = null;
      return state;
    }

    record.speciesGuess = nextGuess;
    record.forestGuess = nextGuess;
    record.identifiedInForest = Boolean(nextGuess);
    record.guessSource = nextGuess ? "forest" : null;
    record.memoryKnowledgeId = null;
    record.memoryExclusion = null;
    if (nextGuess) {
      advanceMinutes(state, 5);
      state.notes.unshift(`${clock(state.minutes)} · Po 5 minutách v košíku tipuješ ${getSpecies(nextGuess).name}.`);
    } else {
      state.notes.unshift(`${clock(state.minutes)} · V košíku necháváš houbu znovu jako neurčenou.`);
    }
    state.error = null;
    return state;
  }

  function recognizeFromKnowledge(input, source, index, knowledgeId) {
    const state = clone(input);
    const entry = state.knowledge?.find((item) => item.id === knowledgeId);
    if (!entry) return fail(state, "Tenhle záznam už v zápisníku není.");

    let target = null;
    let actual = null;
    if (source === "current") {
      const site = state.phase === "forest" && state.current ? getSite(state.current, state) : null;
      if (!site) return fail(state, "Teď nemáš před sebou houbu k porovnání.");
      actual = site.species;
      state.identificationDraft ||= { speciesGuess: null };
      target = state.identificationDraft;
    } else if (source === "hand") {
      if (state.phase !== "forest" || state.carriedItem?.kind !== "mushroom" || !state.carriedItem.record) {
        return fail(state, "V ruce teď nemáš houbu k porovnání.");
      }
      target = state.carriedItem.record;
      actual = target.actual;
    } else {
      if (source === "home" && state.phase !== "identifying") return fail(state, "Doma teď houby neurčuješ.");
      if (source === "basket" && state.phase !== "forest") return fail(state, "Košík teď neporovnáváš v lese.");
      target = state.basketRecords?.[index] || null;
      actual = target?.actual || null;
      if (!target) return fail(state, "Tahle houba už není k porovnání.");
    }

    if (entry.species !== actual) {
      if (entry.type === "mushroom") {
        target.memoryRejectedSpecies = [...new Set([...(target.memoryRejectedSpecies || []), entry.species])];
        state.error = `Zápisník odpovídá: tahle houba není ${entry.title}.`;
      } else {
        state.error = `Zápisník odpovídá: tohle není houba z poznámky „${entry.title}“.`;
      }
      state.notes.unshift(`${clock(state.minutes)} · ${state.error}`);
      return state;
    }

    const preserveLexiconDecision = source === "home" && state.phase === "identifying" && target.homeDecision === "lexicon";
    target.memoryKnowledgeId = entry.id;
    target.memoryRejectedSpecies = target.memoryRejectedSpecies || [];
    if (entry.type === "mushroom") {
      target.speciesGuess = entry.species;
      target.memoryExclusion = null;
      if (source !== "current") {
        target.identifiedInForest = false;
        if (!preserveLexiconDecision) {
          target.guessSource = "memory";
          if (state.phase === "identifying") target.homeDecision = "memory";
        }
      }
      state.notes.unshift(`${clock(state.minutes)} · Zápisník potvrzuje: ${entry.title}.`);
    } else {
      if (!preserveLexiconDecision) {
        target.speciesGuess = null;
        target.memoryExclusion = entry.excludedSpecies || null;
      }
      if (source !== "current") {
        target.identifiedInForest = false;
        if (!preserveLexiconDecision) {
          target.guessSource = "memory-exclusion";
          if (state.phase === "identifying") target.homeDecision = "memory-exclusion";
        }
      }
      const excluded = entry.excludedSpecies ? getSpecies(entry.excludedSpecies) : null;
      state.notes.unshift(`${clock(state.minutes)} · Ze zápisníku poznáváš tuhle houbu jako tu, která není ${excluded?.name || "dříve vyloučený druh"}.`);
    }
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
      state.identificationDraft = { speciesGuess: null, memoryKnowledgeId: null, memoryExclusion: null, memoryRejectedSpecies: [] };
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
        state.focus = Math.min(recoveryFocusCap(state), state.focus + rockingHours);
        state.rockingHours = (state.rockingHours || 0) + rockingHours;
        state.notes.unshift(`${clock(state.minutes)} · ${rockingHours} ${rockingHours === 1 ? "hodina v houpacím křesle bere" : "hodiny v houpacím křesle berou"} ${rockingHours * 0.5} sytosti a vracejí ${rockingHours} soustředění.`);
      } else if (rockingHours > 0 && emergency) {
        state.notes.unshift(`${clock(state.minutes)} · Bez jídla nebo soustředění jen čekáš do začátku práce; v křesle neodpočíváš.`);
      }
    }
    state.identificationSummary = [];
    state.basketRecords.forEach((record) => {
      record.forestGuess = record.forestGuess || (record.identifiedInForest ? record.speciesGuess : null);
      const remembered = record.memoryKnowledgeId
        ? state.knowledge.find((entry) => entry.id === record.memoryKnowledgeId && entry.species === record.actual)
        : null;
      if (remembered?.type === "mushroom") {
        record.speciesGuess = remembered.species;
        record.homeGuess = null;
        record.guessSource = "memory";
        record.homeDecision = "memory";
        record.consultedLexicon = false;
        record.identificationMinutesCharged = true;
      } else if (remembered?.type === "exclusion") {
        record.speciesGuess = null;
        record.homeGuess = null;
        record.memoryExclusion = remembered.excludedSpecies || null;
        record.guessSource = "memory-exclusion";
        record.homeDecision = "memory-exclusion";
        record.consultedLexicon = false;
        record.identificationMinutesCharged = true;
      } else {
        record.memoryKnowledgeId = null;
        record.memoryExclusion = null;
        record.homeGuess = null;
        record.speciesGuess = record.forestGuess || null;
        record.guessSource = record.forestGuess ? "forest" : null;
        record.homeDecision = record.forestGuess ? "guess" : null;
        record.consultedLexicon = false;
        record.identificationMinutesCharged = false;
      }
    });
    state.phase = state.basket.length ? "identifying" : "evening-order";
    state.notes.unshift(`${clock(state.minutes)} · Odkládáš čaj a začínáš pracovat; zápisník použiješ jen u houby, kterou s ním sama porovnáš.`);
    state.error = null;
    return state;
  }

  function homeSetIdentification(input) {
    const state = clone(input);
    return fail(state, "Doma tipuješ přes volbu u konkrétní houby; tip zabere 15 minut.");
  }

  function guessAtHome(input, index, speciesGuess) {
    const state = clone(input);
    if (state.phase !== "identifying") return fail(state, "Houby teď neurčuješ.");
    const record = state.basketRecords?.[index];
    if (!record) return fail(state, "Tahle houba v košíku není.");
    if (record.forestGuess) return fail(state, "Tip z lesa už doma neměníš; můžeš ho jen ověřit v lexikonu.");
    if (record.homeDecision === "memory" || record.homeDecision === "lexicon") return fail(state, "Tahle houba už je potvrzená.");
    if (record.homeDecision === "disproved") return fail(state, "Lexikon už tento tip vyvrátil.");
    const allowed = identificationOptions(record.actual);
    if (!speciesGuess || !allowed.includes(speciesGuess)) return fail(state, "Vyber jeden ze tří nabízených druhů.");
    if (record.homeGuess) return fail(state, "Tip od stolu už je zapsaný; můžeš ho ověřit v lexikonu.");
    record.speciesGuess = speciesGuess;
    record.homeGuess = speciesGuess;
    record.guessSource = "home";
    record.homeDecision = "guess";
    record.consultedLexicon = false;
    record.identificationMinutesCharged = true;
    record.memoryKnowledgeId = null;
    record.memoryExclusion = null;
    advanceMinutes(state, 15);
    state.notes.unshift(`${clock(state.minutes)} · Po 15 minutách u stolu tipuješ ${getSpecies(speciesGuess).name}. Je to zatím jen neověřený tip.`);
    state.error = null;
    return state;
  }

  function consultHomeLexicon(input, index) {
    const state = clone(input);
    if (state.phase !== "identifying") return fail(state, "Lexikon otevíráš až doma při určování.");
    if (isDepleted(state)) return fail(state, "Bez jídla nebo soustředění můžeš neznámou houbu už jen nechat jako „nevím“.");
    const record = state.basketRecords?.[index];
    if (!record) return fail(state, "Tahle houba v košíku není.");
    if (record.homeDecision === "memory") return fail(state, "Tuhle houbu už znáš ze zápisníku z minulých dnů.");
    if (record.consultedLexicon) return fail(state, "Lexikon už tenhle dotaz vyřešil.");
    const species = getSpecies(record.actual);
    const lookupGuess = record.forestGuess || record.homeGuess || null;
    const focusCost = lookupGuess ? 1 : 2;
    const lookupMinutes = lookupGuess ? 15 : TIMINGS.homeLexicon;
    if (state.focus < focusCost) return fail(state, `Na hledání v lexikonu potřebuješ ${focusCost} soustředění.`);
    const confirmed = !lookupGuess || lookupGuess === species.id;
    const knowledgeId = confirmed ? `mushroom:${species.id}` : `not:${species.id}:${lookupGuess}`;
    const known = state.knowledge.find((entry) => entry.id === knowledgeId);
    const obsoleteNegativeIds = confirmed
      ? state.knowledge.filter((entry) => entry.type === "exclusion" && entry.species === species.id).map((entry) => entry.id)
      : [];
    const availableAfterCorrection = state.knowledge.length - obsoleteNegativeIds.length;
    if (!known && availableAfterCorrection >= MEMORY_LIMIT) return fail(state, "Zápisník je plný. Otevři zápisník V a jeden záznam vymaž.");
    if (confirmed && obsoleteNegativeIds.length) {
      state.knowledge = state.knowledge.filter((entry) => !obsoleteNegativeIds.includes(entry.id));
    }
    if (!known && confirmed) {
      state.knowledge.push({
        id: knowledgeId,
        type: "mushroom",
        species: species.id,
        title: species.name,
        text: species.atlas,
        reliable: true
      });
    } else if (!known) {
      const excluded = getSpecies(lookupGuess);
      state.knowledge.push({
        id: knowledgeId,
        type: "exclusion",
        species: species.id,
        excludedSpecies: lookupGuess,
        title: `Není ${excluded.name}`,
        text: `${species.clues.join(" · ")} — tahle houba není ${excluded.name}.`,
        reliable: true
      });
    }
    record.consultedLexicon = true;
    record.identifiedInForest = false;
    record.identificationMinutesCharged = true;
    record.memoryKnowledgeId = null;
    record.memoryExclusion = null;
    state.focus -= focusCost;
    advanceMinutes(state, lookupMinutes);
    if (confirmed) {
      record.speciesGuess = species.id;
      record.homeDecision = "lexicon";
      const verdict = lookupGuess
        ? `Lexikon za 15 minut a 1 soustředění potvrzuje tip ${getSpecies(lookupGuess).name}.`
        : `Lexikon za ${lookupMinutes} minut a 2 soustředění určuje druh ${species.name}.`;
      state.notes.unshift(`${clock(state.minutes)} · ${verdict} ${species.atlas}`);
    } else {
      const excluded = getSpecies(lookupGuess);
      record.speciesGuess = null;
      record.homeDecision = "disproved";
      state.notes.unshift(`${clock(state.minutes)} · Lexikon za 15 minut a 1 soustředění vyvrací tip ${excluded.name}. Správný druh dál nevíš; do zápisníku ukládáš jen vyloučení.`);
    }
    state.error = null;
    return state;
  }

  function forgetKnowledge(input, knowledgeId) {
    const state = clone(input);
    const index = state.knowledge.findIndex((entry) => entry.id === knowledgeId);
    if (index < 0) return fail(state, "Tenhle záznam už v zápisníku není.");
    const [forgotten] = state.knowledge.splice(index, 1);
    state.notes.unshift(`${clock(state.minutes)} · Ze zápisníku mažeš záznam „${forgotten.title}“.`);
    state.error = null;
    return state;
  }

  function leaveHomeUnknown(input, index) {
    const state = clone(input);
    if (state.phase !== "identifying") return fail(state, "Houby teď neurčuješ.");
    const record = state.basketRecords?.[index];
    if (!record) return fail(state, "Tahle houba v košíku není.");
    if (record.homeDecision === "memory") return fail(state, "Tuhle houbu už znáš ze zápisníku z minulých dnů.");
    record.speciesGuess = null;
    record.homeDecision = "unknown";
    record.consultedLexicon = false;
    record.identificationMinutesCharged = true;
    record.memoryKnowledgeId = null;
    record.memoryExclusion = null;
    state.notes.unshift(`${clock(state.minutes)} · Houbu necháváš jako „nevím“.`);
    state.error = null;
    return state;
  }

  function finishHomeIdentification(input) {
    const state = clone(input);
    if (state.phase !== "identifying") return fail(state, "Určování teď nekončí.");
    if (state.basketRecords.some((record) => !record?.homeDecision)) {
      return fail(state, "U každé neznámé houby zvol tip, lexikon, nebo „nevím“.");
    }
    state.identificationSummary = state.basketRecords.map((record) => ({
      actual: record.actual,
      speciesGuess: record.speciesGuess || null,
      forestGuess: record.forestGuess || null,
      homeGuess: record.homeGuess || null,
      homeDecision: record.homeDecision,
      memoryKnowledgeId: record.memoryKnowledgeId || null,
      memoryExclusion: record.memoryExclusion || null
    }));
    state.phase = "evening-order";
    const identified = state.basketRecords.filter((record) => record.speciesGuess).length;
    const unknown = state.basketRecords.length - identified;
    state.notes.unshift(`${clock(state.minutes)} · Před vařením máš ${identified} určených hub a ${unknown} označených „nevím“.`);
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
    state.focus = Math.min(recoveryFocusCap(state, 6), state.focus + 1);
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
      state.focus = Math.min(recoveryFocusCap(state), state.focus + safeHours);
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
    if (order === "soup-first" && state.soup) return fail(state, "O polévce už je pro dnešek rozhodnuto.");
    if (order === "potion-first" && state.potion) return fail(state, "O lektvaru už je pro dnešek rozhodnuto.");
    if (order === "potion-first" && !canBrewPotion(state)) return fail(state, "Na lektvar potřebuješ aspoň 2 sytosti a nějaké soustředění. Nejdřív přijde polévka.");
    if (!state.order) state.order = order;
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
      const poisonous = chosen.filter((id) => getSpecies(id).kind === "poison").map((id) => getSpecies(id).name).join(" a ");
      result = { ok: false, title: "Polévka, která se brání", text: `Do hrnce se dostala jedovatá houba (${poisonous}). Vývar se změnil v dráždivou mlhu; hrnec vyléváš.`, tone: "danger" };
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
      state.focus = Math.min(recoveryFocusCap(state), state.focus + 3);
    } else if (chosenPotatoes > 0) {
      result = { ok: true, title: "Poctivá bramboračka", text: "Houby zůstaly stranou. Brambory samy stačily na bezpečnou večeři.", tone: "good" };
      state.hunger = 9;
      state.focus = Math.min(recoveryFocusCap(state), state.focus + 2);
    } else if (kinds.includes("edible")) {
      result = { ok: true, title: "Tenký houbový vývar", text: "Správně vybraná houba voní dobře, ale bez brambor zasytí jen na chvíli.", tone: "plain" };
      state.hunger = Math.min(10, state.hunger + 4);
      state.focus = Math.min(recoveryFocusCap(state), state.focus + 1);
    } else {
      result = { ok: false, title: "Prázdný hrnec", text: "Všechny houby zůstaly stranou a brambory nemáš.", tone: "plain" };
    }
    removeBasketIndexes(state, chosenIndexes);
    state.potatoes -= chosenPotatoes;
    state.soup = { ...result, night, startedAt, potatoesUsed: chosenPotatoes };
    state.notes.unshift(`${clock(state.minutes)} · Polévka: ${result.title}.`);
    if (state.order === "soup-first" && !canBrewPotion(state)) {
      state.potion = { ok: false, title: "Na lektvar nezbyla síla", text: "Po nepovedené polévce už zvládneš jen uzavřít den.", tone: "plain", ability: 0 };
      state.phase = "cooking-result";
      state.cookingResult = { kind: "soup" };
      state.nextPhase = "ending";
    } else if (state.order === "soup-first") {
      state.phase = "cooking-result";
      state.cookingResult = { kind: "soup" };
      state.nextPhase = "potion";
    } else {
      state.phase = "ending";
    }
    state.error = null;
    return state;
  }

  function skipSoup(input) {
    const state = clone(input);
    if (state.phase !== "soup") return fail(state, "Polévka teď není na řadě.");
    state.soup = { ok: false, title: "Hrnec zůstal studený", text: "Večeři jsi vynechala.", tone: "plain" };
    state.phase = "evening-order";
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
    if (!canBrewPotion(state)) return fail(state, "Na lektvar potřebuješ aspoň 2 sytosti a nějaké soustředění. Nejdřív potřebuješ polévku.");
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
    if (state.order === "potion-first") {
      state.phase = "cooking-result";
      state.cookingResult = { kind: "potion" };
      state.nextPhase = "soup";
    } else {
      state.phase = "ending";
    }
    state.error = null;
    return state;
  }

  function continueCooking(input) {
    const state = clone(input);
    if (state.phase !== "cooking-result") return fail(state, "Teď není od čeho pokračovat.");
    if (!["soup", "potion", "ending"].includes(state.nextPhase)) return fail(state, "Další krok vaření chybí.");
    state.phase = state.nextPhase;
    state.cookingResult = null;
    state.nextPhase = null;
    state.error = null;
    return state;
  }

  function skipPotion(input) {
    const state = clone(input);
    if (state.phase !== "potion") return fail(state, "Lektvar teď není na řadě.");
    state.potion = { ok: false, title: "Lahvička zůstala prázdná", text: "Ne každý večer potřebuje kouzlo.", tone: "plain", ability: cookingAbility(state) };
    state.phase = "evening-order";
    state.notes.unshift("Lektvar nevaříš.");
    state.error = null;
    return state;
  }

  function finishEvening(input) {
    const state = clone(input);
    if (state.phase !== "evening-order") return fail(state, "Večer teď nemůžeš uzavřít.");
    state.phase = "ending";
    state.notes.unshift(`${clock(state.minutes)} · Končíš dnešní práci v kuchyni a dílně.`);
    state.error = null;
    return state;
  }

  function scoreDay(input) {
    const state = clone(input);
    const summary = Array.isArray(state.identificationSummary) ? state.identificationSummary : [];
    const wrongGuesses = summary.filter((record) => {
      const guess = record.forestGuess || record.homeGuess;
      return guess && guess !== record.actual;
    }).length;
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
    const state = createState(previous.difficulty);
    state.day = Math.max(1, Math.floor(previous.day || 1)) + 1;
    const hungryMorning = Number(previous.hunger || 0) <= 2;
    if (hungryMorning) {
      state.hunger = 2;
      state.focus = normalizeDifficulty(previous.difficulty) === "easy" ? 5 : 3;
    }
    state.knowledge = clone(Array.isArray(previous.knowledge) ? previous.knowledge : []);
    state.notes = [hungryMorning
      ? `Den ${state.day} · Po hladovém večeru vyrážíš v 07:00 se 2 body sytosti a jen s ${state.focus} soustředěními.`
      : `Den ${state.day} · Zápisník zůstal; do lesa znovu vyrážíš v 07:00.`];
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
    recognizeFromKnowledge,
    discardInventoryItem,
    goHome,
    forceHome,
    startHomeWork,
    homeSetIdentification,
    guessAtHome,
    consultHomeLexicon,
    forgetKnowledge,
    leaveHomeUnknown,
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
    continueCooking,
    skipPotion,
    finishEvening,
    scoreDay,
    nextDay,
    isDepleted,
    canBrewPotion,
    cookingAbility,
    atlasCost,
    MEMORY_LIMIT,
    BASKET_LIMIT,
    HOME_MINIMUM,
    POTION_MIN_HUNGER,
    TIMINGS,
    EQUIPMENT,
    isNight,
    basketLoad,
    getSite,
    activeSites,
    createDaySpecies,
    getSpecies,
    clock
  };
});




