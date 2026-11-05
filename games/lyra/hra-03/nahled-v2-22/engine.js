(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KloboukyEngine = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const SPECIES = {
    medovka: {
      id: "medovka",
      name: "Medovka hřebenitá",
      icon: "🍄",
      kind: "edible",
      atlas: "JEDLÁ · Tupé hřebínky, medová vůně. V polévce zesládne, v lektvaru drží směr.",
      clues: ["zlatý klobouk", "tupé hřebínky místo lupenů", "vůně po medu a meruňce"]
    },
    hnedka: {
      id: "hnedka",
      name: "Hnědka mechová",
      icon: "🍄",
      kind: "edible",
      atlas: "JEDLÁ · Pod kloboukem má měkké póry a na třeni síťku. Spolehlivý základ polévky.",
      clues: ["kaštanový klobouk", "měkké póry na spodku", "jemná síťka na třeni"]
    },
    ohnivka: {
      id: "ohnivka",
      name: "Ohnivka zubatá",
      icon: "🍄",
      kind: "inedible",
      atlas: "NEJEDLÁ · Ostré husté lupeny a pepřový pach. Zkazí polévku i lektvar.",
      clues: ["oranžový nálevkovitý klobouk", "ostré husté lupeny", "pepřový pach"]
    },
    belokruh: {
      id: "belokruh",
      name: "Bělokruh zákeřný",
      icon: "🍄",
      kind: "poison",
      atlas: "JEDOVATÝ · Bílý prsten a vakovitá pochva u země. Do košíku s jídlem nepatří.",
      clues: ["bledý klobouk", "bílý prsten na třeni", "vakovitá pochva schovaná v jehličí"]
    },
    modravec: {
      id: "modravec",
      name: "Modravec měsíční",
      icon: "🍄",
      kind: "potion",
      atlas: "NEJÍ SE · Stříbrné výtrusy vedou lektvar. S Medovkou nebo Hnědkou tvoří stabilní pár.",
      clues: ["modrý klobouk světélkuje ve stínu", "dutý chladný třeň", "po otočení pouští stříbrné výtrusy"]
    }
  };

  const SITES = [
    { id: "breza", name: "Březový okraj", icon: "🌿", species: "medovka", potatoes: 0, intro: "Mezi kořeny je teplo a něco zlatého se opírá o břízu." },
    { id: "mech", name: "Mechová pěšina", icon: "🌲", species: "hnedka", potatoes: 0, intro: "V mechu sedí hnědý klobouk a splývá s mokrou zemí." },
    { id: "parez", name: "Starý pařez", icon: "🪵", species: "ohnivka", potatoes: 0, intro: "Pařez je obsypaný oranžovými nálevkami. Vypadají až příliš ochotně." },
    { id: "rokle", name: "Bílá rokle", icon: "🕳️", species: "belokruh", potatoes: 0, intro: "Pod jehličím se leskne bledý klobouk." },
    { id: "studenka", name: "Měsíční studánka", icon: "🌙", species: "modravec", potatoes: 0, intro: "Ve stínu studánky svítí modrý klobouk. Voda kolem něj se nehýbe." }
  ];

  const IDENTIFICATION_OPTIONS = {
    medovka: ["medovka", "hnedka", "ohnivka"],
    hnedka: ["hnedka", "medovka", "modravec"],
    ohnivka: ["ohnivka", "medovka", "belokruh"],
    belokruh: ["belokruh", "modravec", "ohnivka"],
    modravec: ["modravec", "belokruh", "hnedka"]
  };
  const MEMORY_LIMIT = 5;
  const BASKET_LIMIT = 5;
  const NIGHT_START = 20 * 60;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isNight(minutes) {
    const minute = ((Math.floor(minutes) % 1440) + 1440) % 1440;
    return minute >= NIGHT_START || minute < 5 * 60;
  }

  function advanceMinutes(state, minutes) {
    const amount = Math.max(0, Math.floor(minutes || 0));
    state.minutes = Number.isFinite(state.minutes) ? state.minutes : 7 * 60;
    state.hungerMinutes = Number.isFinite(state.hungerMinutes) ? state.hungerMinutes : 0;
    state.minutes += amount;
    state.hungerMinutes += amount;
    while (state.hungerMinutes >= 30) {
      state.hungerMinutes -= 30;
      state.hunger = Math.max(0, state.hunger - 1);
    }
    return state;
  }

  function basketLoad(state) {
    return (state.basket?.length || 0) + (state.potatoes || 0);
  }

  function createState() {
    return {
      phase: "forest",
      minutes: 7 * 60,
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
      current: null,
      order: null,
      soup: null,
      potion: null,
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
    return fail(state, "Druh se teď určuje až doma.");
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
        speciesGuess: null,
        consultedLexicon: false,
        identificationMinutesCharged: false
      };
      if (basketLoad(state) < BASKET_LIMIT) {
        state.basket.push(species.id);
        state.basketRecords.push(record);
        state.notes.unshift(`${clock(state.minutes)} · Bereš neurčenou houbu do košíku.`);
      } else if (!state.carriedItem) {
        state.carriedItem = { kind: "mushroom", id: species.id, record };
        state.notes.unshift(`${clock(state.minutes)} · Košík je plný; neurčenou houbu neseš v ruce.`);
      } else {
        return fail(state, "Košík je plný a v ruce už něco neseš.");
      }
    } else {
      state.notes.unshift(`${clock(state.minutes)} · Necháváš houbu tam, kde vyrostla.`);
    }
    state.visited.push(site.id);
    state.current = null;
    state.identificationDraft = { speciesGuess: null };
    state.error = null;
    return state;
  }

  function goHome(input) {
    const state = clone(input);
    if (state.phase !== "forest" || state.current) return fail(state, "Teď ještě nemůžeš odejít z lesa.");
    if (basketLoad(state) < BASKET_LIMIT) return fail(state, "Domů se vydáš až s plným košíkem.");
    const handDelay = state.carriedItem ? 30 : 0;
    advanceMinutes(state, 30 + handDelay);
    if (state.carriedItem?.kind === "mushroom") {
      state.basket.push(state.carriedItem.id);
      state.basketRecords.push(state.carriedItem.record);
    } else if (state.carriedItem?.kind === "potato") {
      state.potatoes += 1;
    }
    const carried = Boolean(state.carriedItem);
    state.carriedItem = null;
    state.phase = state.basket.length ? "identifying" : "evening-order";
    state.notes.unshift(`${clock(state.minutes)} · Jsi doma. Cesta trvala ${carried ? "hodinu s nálezem v ruce" : "půl hodiny"}.`);
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
    record.speciesGuess = speciesGuess || null;
    state.error = null;
    return state;
  }

  function consultHomeLexicon(input, index) {
    const state = clone(input);
    if (state.phase !== "identifying") return fail(state, "Lexikon otevíráš až doma při určování.");
    const record = state.basketRecords?.[index];
    if (!record) return fail(state, "Tahle houba v košíku není.");
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
    if (!record.identificationMinutesCharged) {
      advanceMinutes(state, 15);
      record.identificationMinutesCharged = true;
    }
    state.notes.unshift(`${clock(state.minutes)} · V domácím lexikonu určuješ: ${species.atlas}`);
    state.error = null;
    return state;
  }

  function finishHomeIdentification(input) {
    const state = clone(input);
    if (state.phase !== "identifying") return fail(state, "Určování teď nekončí.");
    let charged = 0;
    state.basketRecords.forEach((record) => {
      if (record.speciesGuess && !record.identificationMinutesCharged) {
        advanceMinutes(state, 15);
        record.identificationMinutesCharged = true;
        charged += 1;
      }
    });
    state.phase = "sorting";
    state.notes.unshift(charged
      ? `${clock(state.minutes)} · Domácí určování zabralo ${charged * 15} minut.`
      : `${clock(state.minutes)} · Houby necháváš bez určení a jdeš rovnou třídit.`);
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
    if (basketLoad(state) < BASKET_LIMIT) {
      state.potatoes += 1;
    } else if (!state.carriedItem) {
      state.carriedItem = { kind: "potato", id: potatoId, style };
    } else {
      return fail(state, "Košík je plný a v ruce už něco neseš.");
    }
    state.collectedPotatoes.push(potatoId);
    const note = style === "plant"
      ? "Na kraji lesa vytahuješ z natě jednu bramboru."
      : "Pod křovím nacházíš pohozenou bramboru.";
    state.notes.unshift(`${clock(state.minutes)} · ${note}${state.carriedItem?.id === potatoId ? " Neseš ji v ruce." : ""}`);
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
    advanceMinutes(state, squares);
    state.error = null;
    return state;
  }

  function hitTree(input) {
    const state = clone(input);
    state.focus = Math.max(0, state.focus - 1);
    state.notes.unshift(`${clock(state.minutes)} · Náraz do kmene ti bere 1 soustředění.`);
    state.error = null;
    return state;
  }

  function chooseOrder(input, order) {
    const state = clone(input);
    if (state.phase !== "evening-order" || !["soup-first", "potion-first"].includes(order)) return fail(state, "Večer ještě nezačal.");
    state.order = order;
    state.phase = order === "soup-first" ? "soup" : "potion";
    state.notes.unshift(order === "soup-first" ? "Nejdřív stavíš na kamna polévku." : "Nejdřív zapaluješ modrý kahan pod lektvarem.");
    state.error = null;
    return state;
  }

  function cookSoup(input) {
    const state = clone(input);
    if (state.phase !== "soup") return fail(state, "Polévka teď není na řadě.");
    const sorted = Array.isArray(state.soupIdentifications) ? state.soupIdentifications : [];
    const normalized = state.basket.map((id, index) => {
      const record = state.basketRecords?.[index];
      const decision = sorted.find((entry) => entry.site === record?.site);
      return { index, id, guess: decision?.guess };
    });
    if (normalized.some((entry) => !["edible", "inedible"].includes(entry.guess))) {
      return fail(state, "Nejdřív se vrať k třídění hub.");
    }
    const chosenEntries = normalized.filter((entry) => entry.guess === "edible");
    const chosen = chosenEntries.map((entry) => entry.id);
    const chosenIndexes = chosenEntries.map((entry) => entry.index);
    const kinds = chosen.map((id) => getSpecies(id).kind);
    const startedAt = state.minutes;
    advanceMinutes(state, 60);
    const night = isNight(startedAt) || isNight(state.minutes);
    const nightFailure = night && Math.random() < 0.28;
    let result;
    if (kinds.includes("poison")) {
      result = { ok: false, title: "Polévka, která se brání", text: "Za jedlou jsi označila Bělokruh. Vývar se změnil v bílou mlhu; hrnec vyléváš.", tone: "danger" };
      state.hunger = Math.max(0, state.hunger - 2);
      state.focus = Math.max(0, state.focus - 2);
    } else if (kinds.includes("inedible") || kinds.includes("potion")) {
      result = { ok: false, title: "Hořký omyl", text: "Jedna z hub označených jako jedlá pálí nebo svítí. Polévku nejíš.", tone: "warning" };
      state.focus = Math.max(0, state.focus - 1);
    } else if (nightFailure) {
      result = { ok: false, title: "Hrnec po tmě přetekl", text: "Suroviny byly bezpečné, ale noční vaření se rozpadlo v nepozornosti. Hlad zůstává.", tone: "warning" };
      state.focus = Math.max(0, state.focus - 1);
    } else if (state.potatoes > 0 && kinds.includes("edible")) {
      result = { ok: true, title: "Polévka drží lžíci", text: "Brambory ji zahustily a správně vytříděná houba jí dala vůni lesa.", tone: "good" };
      state.hunger = 10;
      state.focus = Math.min(7, state.focus + 3);
    } else if (state.potatoes > 0) {
      result = { ok: true, title: "Poctivá bramboračka", text: "Houby označené jako nejedlé zůstaly stranou. Brambory samy stačily na bezpečnou večeři.", tone: "good" };
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
    state.potatoes = 0;
    state.soup = { ...result, night, startedAt };
    state.notes.unshift(`${clock(state.minutes)} · Polévka: ${result.title}.`);
    state.phase = state.order === "soup-first" ? "potion" : "ending";
    state.error = null;
    return state;
  }

  function skipSoup(input) {
    const state = clone(input);
    if (state.phase !== "soup") return fail(state, "Polévka teď není na řadě.");
    state.soup = { ok: false, title: "Hrnec zůstal studený", text: "Večeři jsi vynechala.", tone: "plain" };
    state.phase = state.order === "soup-first" ? "potion" : "ending";
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
    const chosen = validSelection(state, ingredients);
    if (chosen.length !== 2) return fail(state, "Lektvar potřebuje právě dvě houby.");
    const set = new Set(chosen);
    const stablePair = set.has("modravec") && (set.has("medovka") || set.has("hnedka"));
    const nightOnlyPair = set.has("modravec") && set.has("ohnivka");
    const startedAt = state.minutes;
    advanceMinutes(state, 60);
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
    goHome,
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
    cookingAbility,
    atlasCost,
    MEMORY_LIMIT,
    BASKET_LIMIT,
    isNight,
    basketLoad,
    getSite,
    getSpecies,
    clock
  };
});
