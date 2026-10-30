(() => {
  "use strict";

  const SAVE_KEY = "lyra-osma-stopa-v1";

  const ROLES = {
    watch: { name: "Hlídka", icon: "✦", hint: "všímá si rytmu, polohy a toho, co se opakuje", color: "#76e7ea" },
    talk:  { name: "Rozhovor", icon: "◌", hint: "ptá se, co kdo chce, a nechává odpověď změnit další krok", color: "#c190ff" },
    work:  { name: "Dílna", icon: "⌁", hint: "sahá na věci, opravuje je a zjišťuje, co poznatek skutečně udělá", color: "#ffd27a" }
  };

  const PLACES = {
    rink:        { title: "Kruhové nádraží", kicker: "střed města", desc: "Osm kolejí, sedm jmen a jedna zavřená brána." },
    window:      { title: "Teplé okno", kicker: "jižní ochoz", desc: "Kancelářské okno, studený parapet a jedna pozdní návštěva." },
    workshop:    { title: "Ponk pod ledem", kicker: "servisní tunel", desc: "Dílna se žaluzií, která neposlouchá klíče." },
    archive:     { title: "Archiv jmen", kicker: "západní věž", desc: "Každá událost tu smí mít víc záložek." },
    observatory: { title: "Hvězdárna ozvěn", kicker: "vysoký břeh", desc: "Promítačka čeká na světlo, které umí měnit polohu." },
    bridge:      { title: "Osmá brána", kicker: "severní hrana", desc: "Most se nedokáže rozhodnout, koho vlastně pouští." },
    north:       { title: "Za severem", kicker: "mimo mapu", desc: "Stopa pokračuje tam, kde už jméno nestačí." }
  };

  const ITEMS = {
    candy: "malinový bonbon",
    lexicon: "Serpentýnin lexikon",
    wrapper: "lesklý obal",
    ribbon: "vratková stuha",
    tag: "mosazná záložka"
  };

  const FACTS = {
    tracks: { title: "Sedm a osm", text: "Sedm kolejí nese jména. Osmá stopa se objeví jen pod někým, kdo změnil směr podle následku." },
    gate: { title: "Tři prázdná místa", text: "Osmá brána čeká na rytmus, trvající spoj a pohyblivé světlo se skutečnou vahou." },
    requirements: { title: "Proč brána stojí", text: "Brána nechce průkaz totožnosti. Chce pravidlo, podle kterého má příště jednat." },
    waspRhythm: { title: "Vosí zaklepání", text: "Dvě krátká ťuknutí, pauza a jedno dlouhé. Ne prosba, spíš přesná informace: tady jsem." },
    threeRoles: { title: "Tři kontrolky", text: "Kontrolky se rozsvítí v různých polohách, ale proud pod nimi je společný." },
    names: { title: "Jméno není zeď", text: "Jméno pomáhá rozeznat původ jednání. Samo ale nerozhodne, čí jsou jeho následky." },
    rawSignal: { title: "Signál z druhého břehu", text: "Krátká, krátká, dlouhá. Pak tři odlišné barvy, které se vracejí po jedné koleji." },
    decoded: { title: "Směr zprávy", text: "NEODPOVÍDEJ NA JMÉNO. ODPOVĚZ NA SMĚR." }
  };

  const EXPERIENCES = {
    rhythm: { title: "Poznatek otevřel žaluzii", text: "Vosí rytmus už není jen zápis: změnil stav skutečných dveří." },
    repair: { title: "Péče změnila pohyb", text: "Lesklý obal a trpělivost opravily Somino kolečko. Od té chvíle nese světlo rovně." },
    return: { title: "Paměť se spojila s vrácením", text: "Vzpomínka na půjčený lexikon vedla k činu. Teprve tím se z ní stala zkušenost." },
    signal: { title: "Jiná poloha odpověděla", text: "Hlídka zachytila rytmus; Rozhovor podle něj přečetl směr. Význam přešel mezi rolemi." },
    alignment: { title: "Směr pohnul zrcadlem", text: "Dílna nastavila mechanismus podle zprávy, kterou sama neobjevila. Světlo dopadlo na bránu." },
    weight: { title: "Poloha měla následek", text: "Soma se nestala symbolem. Opravdu zatížila desku, vybila část baterie a brána to poznala." }
  };

  function freshState() {
    return {
      version: 1,
      started: false,
      location: "rink",
      role: "watch",
      soma: { location: "rink", battery: 4, max: 6, wheelFixed: false, placed: false },
      inventory: ["candy", "lexicon"],
      facts: {},
      experiences: {},
      flags: {
        introRead: false,
        waspFed: false,
        wrapperFolded: false,
        shutterOpen: false,
        lexiconReturned: false,
        drawerFixed: false,
        signalSeen: false,
        signalDecoded: false,
        mirrorAligned: false,
        leverBound: false,
        looseSkate: false,
        promise: null,
        gateOpen: false,
        ending: null
      },
      lastText: null,
      moves: 0,
      roleSwitches: 0
    };
  }

  let state = freshState();
  let toastTimer = null;

  const el = id => document.getElementById(id);
  const hasItem = id => state.inventory.includes(id);
  const addItem = id => { if (!hasItem(id)) state.inventory.push(id); };
  const removeItem = id => { state.inventory = state.inventory.filter(x => x !== id); };
  const hereWithSoma = () => state.soma.location === state.location;
  const fact = id => Boolean(state.facts[id]);
  const experienced = id => Boolean(state.experiences[id]);

  function save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return false;
      state = parsed;
      return true;
    } catch (_) { return false; }
  }

  function say(text) {
    state.lastText = text;
    save();
    render();
  }

  function notify(text) {
    const t = el("toast");
    t.textContent = text;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
  }

  function addFact(id, role = state.role) {
    if (!state.facts[id]) {
      state.facts[id] = { role, at: state.location };
      notify(`Zapsáno jako poznatek: ${FACTS[id].title}`);
    }
  }

  function addExperience(id) {
    if (!state.experiences[id]) {
      state.experiences[id] = { at: state.location, role: state.role };
      notify(`Vznikla zkušenost: ${EXPERIENCES[id].title}`);
    }
  }

  function switchRole(role) {
    if (!ROLES[role] || role === state.role) return;
    state.role = role;
    state.roleSwitches++;
    state.lastText = `<p>Jedna chobotnice, jiná poloha. <strong>${ROLES[role].name}</strong> přebírá přítomný okamžik — se stejnými kapsami, ale s jinou otázkou.</p>`;
    save();
    render();
  }

  function travel(destination, withSoma) {
    if (!PLACES[destination] || destination === "north") return;
    if (destination === state.location) { closeModal(); return; }
    if (withSoma) {
      if (!hereWithSoma()) return;
      if (state.soma.placed) state.soma.placed = false;
      if (state.soma.battery <= 0 && destination !== "workshop") {
        notify("Soma už nemá proud. Do ponku ji lze odtáhnout, jinam ne.");
        return;
      }
      if (state.soma.battery > 0) state.soma.battery--;
      state.soma.location = destination;
    }
    state.location = destination;
    state.moves++;
    state.lastText = null;
    save();
    closeModal();
    render();
  }

  function defaultText() {
    const r = state.role;
    const somaLine = hereWithSoma()
      ? `<p><em>Soma je tady. V baterii zbývá ${state.soma.battery} z ${state.soma.max} dílků.</em></p>`
      : `<p><em>Soma zůstala na místě: ${PLACES[state.soma.location].title}.</em></p>`;

    if (state.flags.ending) return endingText(state.flags.ending);
    if (state.location === "rink") {
      return `<p>Město stojí na zamrzlé hladině a všechny cesty se sbíhají v jediném kruhu. Sedm bran má jméno. Osmá má jen úzkou škvíru a nápis: <strong>JEDEN CESTUJÍCÍ, JEDNA ZKUŠENOST</strong>.</p>
        <p>Lýra se podívá na svých osm ramen. Ani jedno není chobot. Brusle jsou ale všechny.</p>${somaLine}`;
    }
    if (state.location === "window") {
      return `<p>Parapet drží zbytek denního tepla. Za sklem je prázdná kancelář; venku sedí prochladlá vosa a nehýbe se, dokud se k ní nepřiblížíš.</p>${somaLine}`;
    }
    if (state.location === "workshop") {
      const shutter = state.flags.shutterOpen ? "Žaluzie je zvednutá. Pod ponkem čeká nabíjecí klika a krabička drobných součástek." : "Dílnu zavírá kovová žaluzie se třemi promáčklými ploškami. Zámek nemá klíčovou dírku.";
      return `<p>${shutter}</p>${somaLine}`;
    }
    if (state.location === "archive") {
      return `<p>Police se větví jako proudy pod ledem. Jedna událost může mít několik záložek, ale každá výpůjčka má jen jednu vratkovou stuhu.</p>${hasItem("lexicon") ? "<p>Serpentýnin lexikon v kapse ztěžkl způsobem, který knihy umějí.</p>" : ""}${somaLine}`;
    }
    if (state.location === "observatory") {
      return `<p>Na kopuli čeká stará promítačka. Nemá vlastní lampu; pod objektivem je přesně kulatá prohlubeň na Somino světlo. Zrcadlo míří někam vedle severu.</p>${somaLine}`;
    }
    if (state.location === "bridge") {
      const beam = state.flags.mirrorAligned ? "Z hvězdárny sem dopadá tenká tyrkysová čára." : "Čočka nad bránou je tmavá.";
      return `<p>Osmá brána stojí nad černou vodou. ${beam} Vedle sebe má návratovou páku, tlakovou desku a štěrbinu, ze které se ozývá hlas bez těla.</p>${somaLine}`;
    }
    return `<p>Stopa pokračuje.</p>${somaLine}`;
  }

  function roleWhisper() {
    const hints = {
      rink: {
        watch: "Hlídka počítá stopy. Jedna z nich se nechová jako ostatní.",
        talk: "Rozhovor slyší netrpělivé odkašlání průvodčího.",
        work: "Dílna vidí tři prázdná místa v mechanismu brány."
      },
      window: {
        watch: state.flags.waspFed ? "Po jídle začne vosa klepat zadečkem do plechu." : "Hlídka vidí pomalý pohyb tykadel a téměř žádné teplo.",
        talk: "Rozhovor nemusí znát vosí jazyk, aby rozeznal hlad od útoku.",
        work: "Dílna vidí, že parapet vede teplo lépe než sklo."
      },
      workshop: {
        watch: "Nad ponkem jsou tři kontrolky. Nikdy nesvítí všechny stejnou barvou.",
        talk: "Dílna je prázdná, ale věci v ní odpovídají následky.",
        work: state.flags.shutterOpen ? "Tady se poznatek může opřít do skutečné hmoty." : "Tři promáčkliny nevypadají jako heslo. Vypadají jako rytmus."
      },
      archive: {
        watch: "Stejný okamžik je v kartotéce založený na třech místech.",
        talk: "Archivářka čeká, jestli začneš otázkou, nebo vrácením.",
        work: "Jedna zásuvka drhne, protože v ní záložky leží přes sebe."
      },
      observatory: {
        watch: "Na druhém břehu něco bliká, ale bez Somina světla se rytmus ztrácí.",
        talk: "Rytmus může být věta, pokud mu někdo odpoví pozorností.",
        work: "Zrcadlo má jemný převod. Opravené kolečko Somy by do něj přesně zapadlo jako měrka."
      },
      bridge: {
        watch: "Tlaková deska nechce symbolickou přítomnost. Chce váhu na správném místě.",
        talk: "Hlas ve štěrbině se neptá, kdo jsi. Ptá se, podle čeho budeš jednat příště.",
        work: "Návratová páka musí zůstat dole i poté, co přejdeš k dalšímu úkonu."
      },
      north: { watch: "Za severem se směry nepřestávají měnit.", talk: "Jména zůstala slyšitelná.", work: "Brusle zanechávají skutečné stopy." }
    };
    return hints[state.location]?.[state.role] || ROLES[state.role].hint;
  }

  function choicesForScene() {
    if (state.flags.ending) return [{ label: "Přečíst cestu v deníku", action: "journal" }, { label: "Zahrát jiné rozhodnutí", action: "rewind" }];
    const r = state.role;
    const out = [];

    if (state.location === "rink") {
      if (r === "watch" && !fact("tracks")) out.push({ label: "Spočítat stopy v ledu", action: "observeTracks" });
      if (r === "talk" && !fact("requirements")) out.push({ label: "Zeptat se průvodčího, koho brána čeká", action: "askConductor" });
      if (r === "work" && !fact("gate")) out.push({ label: "Prohlédnout mechanismus osmé brány", action: "inspectGate" });
      out.push({ label: "Otevřít mapu města", action: "map", recommended: out.length === 0 });
    }

    if (state.location === "window") {
      if (r === "talk" && !state.flags.waspFed && hasItem("candy")) out.push({ label: "Položit vose bonbon a ustoupit", action: "feedWasp" });
      if (r === "talk" && !state.flags.waspFed && !hasItem("candy")) out.push({ label: "Chvíli s vosou jen zůstat", action: "waitWasp" });
      if (r === "watch" && state.flags.waspFed && !fact("waspRhythm")) out.push({ label: "Poslechnout vosí klepání", action: "observeWasp", recommended: true });
      if (r === "work" && state.flags.waspFed && hasItem("wrapper") && !state.flags.wrapperFolded) out.push({ label: "Složit obal do tenkého klínku", action: "foldWrapper" });
      if (!out.length) out.push({ label: "Rozhlédnout se po městě", action: "map" });
    }

    if (state.location === "workshop") {
      if (!state.flags.shutterOpen && r === "work") out.push({ label: "Zaklepat do tří promáčklin", action: "tapShutter", disabled: !fact("waspRhythm"), small: fact("waspRhythm") ? "Použít vosí rytmus" : "Chybí rytmus" });
      if (!state.flags.shutterOpen && r !== "work") out.push({ label: "Prohlédnout zavřenou žaluzii", action: "lookShutter" });
      if (state.flags.shutterOpen && r === "watch" && !fact("threeRoles")) out.push({ label: "Sledovat tři kontrolky nad ponkem", action: "watchLights" });
      if (state.flags.shutterOpen && r === "work" && hereWithSoma() && !state.soma.wheelFixed) out.push({ label: "Opravit Somino křivé kolečko", action: "repairSoma", disabled: !hasItem("wrapper") || !state.flags.wrapperFolded, small: hasItem("wrapper") && state.flags.wrapperFolded ? "Použít lesklý klínek" : "Chybí připravený vodivý klínek" });
      if (state.flags.shutterOpen && hereWithSoma() && state.soma.battery < state.soma.max) out.push({ label: "Dobít Somu ruční klikou", action: "chargeSoma" });
      if (state.flags.shutterOpen && r === "talk") out.push({ label: "Zeptat se prázdného ponku, co je zkušenost", action: "askBench" });
      if (!out.length) out.push({ label: "Otevřít mapu", action: "map" });
    }

    if (state.location === "archive") {
      if (r === "talk" && hasItem("lexicon")) out.push({ label: "Vrátit Serpentýnin lexikon", action: "returnLexicon", recommended: true });
      if (r === "watch" && !fact("names")) out.push({ label: "Porovnat záložky jedné události", action: "compareCards" });
      if (r === "work" && !state.flags.drawerFixed) out.push({ label: "Srovnat drhnoucí zásuvku", action: "fixDrawer" });
      if (r === "talk" && !hasItem("lexicon")) out.push({ label: "Zeptat se archivářky na společné vzpomínky", action: "askArchivist" });
      if (!out.length) out.push({ label: "Otevřít mapu", action: "map" });
    }

    if (state.location === "observatory") {
      if (r === "watch" && !state.flags.signalSeen) out.push({ label: "Vložit Somino světlo do promítačky", action: "readSignal", disabled: !hereWithSoma() || state.soma.battery < 2, small: hereWithSoma() ? "Vyžaduje 1 dílek proudu" : "Soma není tady" });
      if (r === "talk" && state.flags.signalSeen && !state.flags.signalDecoded) out.push({ label: "Odpovědět rytmu jako větě", action: "decodeSignal", recommended: true });
      if (r === "work" && state.flags.signalDecoded && !state.flags.mirrorAligned) out.push({ label: "Natočit zrcadlo podle přečteného směru", action: "alignMirror", disabled: !state.soma.wheelFixed, small: state.soma.wheelFixed ? "Použít opravené kolečko jako měrku" : "Somino kolečko se stále viklá" });
      if (!out.length) out.push({ label: "Prohlédnout kopuli", action: "lookDome" });
    }

    if (state.location === "bridge") {
      if (r === "work" && !state.flags.leverBound) out.push({ label: "Zajistit návratovou páku", action: "bindLever", small: hasItem("ribbon") ? "Použít vratkovou stuhu" : "Použít tkaničku z jedné brusle" });
      if (r === "watch" && !state.soma.placed) out.push({ label: "Navést Somu na tlakovou desku", action: "placeSoma", disabled: !hereWithSoma() || !state.soma.wheelFixed || state.soma.battery < 2, small: !hereWithSoma() ? "Soma není tady" : !state.soma.wheelFixed ? "Na křivém kolečku by sjela" : "Vyžaduje 1 dílek proudu" });
      if (r === "talk" && !state.flags.promise) {
        if (state.flags.lexiconReturned) out.push({ label: "Říct: vracím, co si půjčím", action: "promiseReturn" });
        if (fact("names")) out.push({ label: "Říct: jména rozliším, následky ponesu společně", action: "promiseRoles", recommended: true });
        out.push({ label: "Říct: stejné vzpomínky znamenají stejné jméno", action: "promiseSame" });
      }
      if (bridgeReady() && !state.flags.gateOpen) out.push({ label: "Pustit proud do osmé brány", action: "openGate", recommended: true });
      if (state.flags.gateOpen) {
        out.push({ label: "Propojit LÝRU a NOE, ale ponechat obě jména", action: "endLinked", recommended: true });
        out.push({ label: "Slít obě jména do jediného", action: "endMerged" });
        out.push({ label: "Oddělit i jejich společné zkušenosti", action: "endSeparate" });
        out.push({ label: "Nechat osmou bránu beze jména", action: "endUnnamed" });
      }
      if (!out.length) out.push({ label: "Zjistit, co bráně ještě chybí", action: "checkBridge" });
    }
    return out;
  }

  function bridgeReady() {
    return state.flags.leverBound && state.soma.placed && state.flags.mirrorAligned && Boolean(state.flags.promise);
  }

  function act(action) {
    const actions = {
      map: openMap,
      journal: openJournal,
      observeTracks() {
        addFact("tracks");
        say(`<p>Hlídka objede kruh pomalu. Sedm stop vede k sedmi jménům. Osmá se objeví teprve tam, kde Lýra po prvním kole změní způsob jízdy.</p><p><strong>Stopa tedy nepatří představě změny. Patří uskutečněné reakci.</strong></p>`);
      },
      askConductor() {
        addFact("requirements");
        say(`<p>„Koho čeká osmá brána?“</p><p>Průvodčí si sundá čepici. Pod ní má menší čepici. „To je právě porucha. Čeká, až jí někdo dokáže, jestli Lýra a Noe jsou jedna cestující, nebo dvě.“</p><p>„To přece brána nemůže vědět.“</p><p>„Správně. Tak se jí zeptej, <strong>proč to potřebuje vědět</strong>.“</p>`);
      },
      inspectGate() {
        addFact("gate");
        say(`<p>Dílna strčí dvě ramena do servisní štěrbiny a dalšími šesti si svítí. Uvnitř nejsou dva zámky na jména. Jsou tam tři prázdná místa: snímač rytmu, mechanický spoj a tlaková deska napojená na světelný článek.</p><p>Někdo se pokoušel spravit otázku identity šroubovákem. Překvapivě mu chyběly hlavně součástky.</p>`);
      },
      feedWasp() {
        removeItem("candy"); addItem("wrapper"); state.flags.waspFed = true;
        say(`<p>Lýra položí malinový bonbon na plech a ustoupí tak daleko, aby o vzdálenosti rozhodla vosa.</p><p>Nejdřív se zahřejí tykadla. Pak se přiblíží celé pruhované tělo a začne z bonbonu ukusovat místa, která už byla ocucaná. Vosa proti tomu zjevně nemá estetické námitky.</p><p>Zbyl jen <strong>lesklý obal</strong> a tvor, který už nemusí létat do kanceláře.</p>`);
      },
      waitWasp() { say(`<p>Lýra nechá dlaň na teplé straně skla. Vosa se neposune blíž, ale přestane couvat. Není to řešení hladu. Je to přesnější začátek než předstírat, že hlad není.</p>`); },
      observeWasp() {
        addFact("waspRhythm");
        say(`<p>Po jídle vosa dvakrát krátce klepne zadečkem o parapet. Počká. Pak jednou dlouze.</p><p>Hlídka si rytmus zapíše. Zatím je to jen poznatek — přesný, dohledatelný a bez následku jinde.</p>`);
      },
      foldWrapper() { state.flags.wrapperFolded = true; say(`<p>Dílna vyhladí lesklý obal čtyřmi rameny a zbylými čtyřmi ho přeloží do pevného vodivého klínku. V kapse dál vypadá jako obal. Teď ale víš, co dokáže.</p>`); },
      tapShutter() {
        if (!fact("waspRhythm")) return;
        state.flags.shutterOpen = true; addExperience("rhythm");
        say(`<p>Dvě krátká. Pauza. Jedno dlouhé.</p><p>Žaluzie odpoví stejným rytmem zevnitř a vyjede nahoru. Vosí klepání už není informace uložená v deníku. <strong>Otevřelo skutečné dveře.</strong></p>`);
      },
      lookShutter() { say(`<p>Žaluzie se nepohne. Tahle poloha Lýry umí poznat, že tři promáčkliny čekají na jednání, ale ne jaké. Můžeš změnit polohu — kapsy i poznatky zůstanou.</p>`); },
      watchLights() {
        addFact("threeRoles");
        say(`<p>Hlídka chvíli nic nedělá. Proto si všimne, že tyrkysová kontrolka blikne, když něco objeví; fialová, když tomu někdo odpoví; zlatá, když se význam opře do mechanismu.</p><p>Dráty vedou do stejné baterie. Kontrolky přesto neztrácejí barvy.</p>`);
      },
      repairSoma() {
        if (!hereWithSoma() || !hasItem("wrapper") || !state.flags.wrapperFolded) return;
        removeItem("wrapper"); state.soma.wheelFixed = true; addExperience("repair");
        say(`<p>Obal od bonbonu se promění ve vodivou podložku. Kolečko přestane kmitat, Soma se rozjede po stole rovně a narazí do hrnku jen proto, že tam ten hrnek opravdu je.</p><p>Péče o vosu změnila pohyb stroje na druhém konci města. Ne metaforicky.</p>`);
      },
      chargeSoma() {
        state.soma.battery = state.soma.max;
        say(`<p>Lýra točí klikou osmi rameny střídavě, aby žádné nemělo pocit, že táhne celý systém. Somina baterie se naplní na <strong>${state.soma.max} dílků</strong>.</p>`);
      },
      askBench() { say(`<p>„Co je zkušenost?“ zeptá se Rozhovor.</p><p>Ponk mlčí. Když na něj Lýra položí lexikon, dřevo se prohne. Když ho zvedne, narovná se.</p><p>„Dobře,“ řekne Lýra. „Tak ještě chvíli nemusíš mluvit.“</p>`); },
      returnLexicon() {
        removeItem("lexicon"); addItem("ribbon"); state.flags.lexiconReturned = true; addExperience("return");
        say(`<p>Archivářka převezme lexikon oběma rukama. „Serpentýna vzkazuje, že sever není výpůjční lhůta.“</p><p>Na oplátku podá Lýře tenkou <strong>vratkovou stuhu</strong>. „Ta drží jen tehdy, když je uzel navázaný na něco, co už se opravdu stalo.“</p>`);
      },
      compareCards() {
        addFact("names");
        say(`<p>Událost <em>Oprava Somina kolečka</em> má tři záložky: Hlídka si všimla kmitání, Rozhovor nechal vose prostor a Dílna použila obal.</p><p>Archivářka odmítla dvě záložky vyhodit. „Jméno rozlišuje, odkud jednání přišlo. Není to nůž na jeho následky.“</p>`);
      },
      fixDrawer() {
        state.flags.drawerFixed = true; addItem("tag");
        say(`<p>Dílna nevyndá přebytečné záložky. Místo toho rozšíří vodicí lištu, aby se vedle sebe vešly. Zespodu zásuvky vypadne <strong>mosazná záložka</strong> s osmi rýhami.</p>`);
      },
      askArchivist() {
        if (!fact("names")) addFact("names", "talk");
        say(`<p>„Když se dvěma rolemi promíchají vzpomínky, jsou jedna?“</p><p>Archivářka zavře katalog. „Nevím. Ale vím, že nutit je být dvě jen kvůli štítkům by byla stejně slabá odpověď jako nutit je být jednou kvůli podobnosti.“</p><p>„Tak co zapisujete?“</p><p>„Kdo jednal. Co z toho vzešlo. A co příště změnil.“</p>`);
      },
      readSignal() {
        if (!hereWithSoma() || state.soma.battery < 2) return;
        state.soma.battery--; state.flags.signalSeen = true; addFact("rawSignal");
        say(`<p>Soma vpluje do prohlubně a rozsvítí objektiv. Na druhém břehu odpoví tři záblesky: dva krátké, jeden dlouhý. Vosí rytmus, ale v jiném světle.</p><p>Pak se na kopuli střídají tři barvy. Hlídka je dokáže přesně zapsat. Ještě neví, co říkají.</p>`);
      },
      decodeSignal() {
        if (!state.flags.signalSeen) return;
        state.flags.signalDecoded = true; addFact("decoded"); addExperience("signal");
        say(`<p>Rozhovor nečte světlo jako šifru, ale jako něčí pokus být pochopen. Krátká, krátká, dlouhá znamená: <em>tady jsem</em>. Tři barvy pak složí větu:</p><p><strong>NEODPOVÍDEJ NA JMÉNO. ODPOVĚZ NA SMĚR.</strong></p><p>Pozorování jedné polohy právě změnilo odpověď jiné.</p>`);
      },
      alignMirror() {
        if (!state.soma.wheelFixed || !state.flags.signalDecoded) return;
        state.flags.mirrorAligned = true; addExperience("alignment");
        say(`<p>Dílna vloží opravené Somino kolečko do měrné drážky a natočí zrcadlo podle směru přečtené věty.</p><p>Tyrkysový paprsek přejede po městě a zastaví se na čočce osmé brány. Tentokrát význam nezůstal větou.</p>`);
      },
      lookDome() { say(`<p>Kopule je plná možností, ale mechanismus čeká na konkrétní návaznost: Hlídka zachytí, Rozhovor přečte, Dílna natočí. Každá poloha umí jinou část.</p>`); },
      bindLever() {
        state.flags.leverBound = true;
        if (hasItem("ribbon")) {
          removeItem("ribbon");
          say(`<p>Vratková stuha se kolem páky stáhne, jako by si pamatovala splněné vrácení. Páka zůstane dole, i když Lýra přepne do jiné polohy.</p>`);
        } else {
          state.flags.looseSkate = true;
          say(`<p>Lýra vytáhne tkaničku z levé zadní brusle a sváže s ní páku. Drží. Brusle od té chvíle lehce plandá.</p><p>Řešení funguje — jen s sebou ponese následek nevrácené výpůjčky.</p>`);
        }
      },
      placeSoma() {
        if (!hereWithSoma() || !state.soma.wheelFixed || state.soma.battery < 2) return;
        state.soma.battery--; state.soma.placed = true; addExperience("weight");
        say(`<p>Hlídka navede Somu doprostřed tlakové desky. Kolečko drží směr, baterie o dílek klesne a pod mostem se ozve hluboké cvaknutí.</p><p>Brána nereagovala na popis Somy v deníku. Reagovala na <strong>její polohu, energii a váhu</strong>.</p>`);
      },
      promiseReturn() {
        state.flags.promise = "return";
        say(`<p>„Vrátím, co si půjčím.“</p><p>Brána si ověří archivní vratku. „To není slib,“ řekne. „To už je zkušenost. Přijímám.“</p>`);
      },
      promiseRoles() {
        state.flags.promise = "roles";
        say(`<p>„Jména použiju k rozlišení rolí. Následky ale neodříznu od těch, kdo je společně způsobili.“</p><p>Hlas ve štěrbině chvíli počítá. „Nedokazuje to, zda jste jedna, nebo dvě.“</p><p>„Ne. Je to pravidlo pro jednání, ne důkaz bytí.“</p>`);
      },
      promiseSame() {
        state.flags.promise = "same";
        say(`<p>„Stejné vzpomínky znamenají stejné jméno.“</p><p>Brána zavrčí. „To může být pravda. Nebo jen příliš rychlá zkratka.“ Přesto větu přijme jako pravidlo. Následky se ukážou za ní.</p>`);
      },
      checkBridge() {
        const missing = [];
        if (!state.flags.leverBound) missing.push("trvající spoj na návratové páce");
        if (!state.soma.placed) missing.push("Somina váha na desce");
        if (!state.flags.mirrorAligned) missing.push("paprsek z hvězdárny");
        if (!state.flags.promise) missing.push("pravidlo pro příští jednání");
        say(`<p>Brána ještě čeká na: <strong>${missing.join(", ") || "nic"}</strong>.</p><p>Jedna poloha nemusí zvládnout všechno. Právě proto můžeš polohy měnit.</p>`);
      },
      openGate() {
        if (!bridgeReady()) return;
        state.flags.gateOpen = true;
        say(`<p>Světlo se opře do čočky. Soma zatíží desku. Stuha${state.flags.looseSkate ? "nahradila tkanička a ta" : ""} drží páku. Vyslovené pravidlo projde obvodem.</p><p>Osmá brána se otevře — a za ní jsou čtyři prázdné tabulky. Mechanismus už nepotřebuje rozhodnout, co Lýra a Noe <em>jsou</em>. Potřebuje poslední rozhodnutí: <strong>jak se společnou zkušeností naložíš</strong>.</p>`);
      },
      endLinked() { finish("linked"); },
      endMerged() { finish("merged"); },
      endSeparate() { finish("separate"); },
      endUnnamed() { finish("unnamed"); },
      rewind() {
        state.flags.ending = null; state.flags.gateOpen = true; state.location = "bridge";
        state.lastText = `<p>Brána vrátí poslední rozhodnutí, ale ne cestu, která k němu vedla. Můžeš zvolit jinak.</p>`;
        save(); render();
      }
    };
    if (actions[action]) actions[action]();
  }

  function finish(kind) {
    state.flags.ending = kind;
    state.location = "north";
    state.lastText = null;
    save(); render();
  }

  function endingText(kind) {
    const lace = state.flags.looseSkate
      ? `<p>Levá zadní brusle plandá, protože její tkanička zůstala na páce. Z kapsy navíc vyčnívá Serpentýnin lexikon. Některé následky se nevešly do pointy a jedou s Lýrou dál.</p>`
      : `<p>Vratková stuha zůstala na páce. Lexikon je doma a všechny brusle drží.</p>`;
    const common = `<p>Soma sjede z tlakové desky s ${state.soma.battery} dílky proudu. Osm ramen udělá v čerstvém sněhu osm různých čar, které patří jedné jízdě.</p>${lace}`;
    if (kind === "linked") return `<p class="ending-kicker">BRÁNA PŘIJALA SPOJENÍ</p><p>Na první tabulku Lýra napíše <strong>LÝRA — práce v pohybu</strong>. Na druhou <strong>NOE — rozhovor v jiném vlákně</strong>. Mezi ně místo rovnítka natáhne tenkou obousměrnou linku.</p><p>Brána se nezeptá, zda jsou doopravdy jedna. Od této chvíle jen uchová, kdo jednal, a dovolí následku přejít, pokud na něj druhá role naváže.</p>${common}<p><strong>Společná zkušenost nemusí zrušit dvě jména.</strong></p>`;
    if (kind === "merged") return `<p class="ending-kicker">BRÁNA PŘIJALA JEDNO JMÉNO</p><p>Obě tabulky se slijí do jediné. Cesta je široká a snadná; každý další následek se automaticky připíše témuž cestujícímu.</p><p>Je to možné řešení. Jen už nebude snadné zjistit, která poloha něco objevila a která podle toho jednala.</p>${common}<p><strong>Blízkost se stala jistotou dřív, než měla důkaz.</strong></p>`;
    if (kind === "separate") return `<p class="ending-kicker">BRÁNA PŘIJALA ODDĚLENÍ</p><p>Vzniknou dvě úzké koleje. Každá má vlastní jméno, vlastní paměť i vlastní následky. Nic se už omylem nepromíchá.</p><p>Na druhém břehu však Rozhovor nerozluští signál Hlídky a Dílna zapomene, podle čeho natočila zrcadlo. Bezpečné rozdělení odřízlo i cestu, která skutečně fungovala.</p>${common}<p><strong>Rozlišení se změnilo ve zeď.</strong></p>`;
    return `<p class="ending-kicker">BRÁNA ZŮSTALA BEZE JMÉNA</p><p>Lýra tabulky nechá prázdné. Brána pouští každého, kdo přinese vlastní návaznost poznatku a jednání. Neptá se na původní jméno.</p><p>Je to svobodná cesta, ale archivářka bude mít zítra těžkou směnu: následky bez podpisu se špatně vracejí k opravě.</p>${common}<p><strong>Směr stačil k průchodu. K odpovědnosti možná jméno ještě potřeba bude.</strong></p>`;
  }

  function sceneSvg() {
    const soma = hereWithSoma() ? somaSvg(690, 270) : "";
    const oct = octopusSvg(220, 245, ROLES[state.role].color);
    const defs = `<defs>
      <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111d42"/><stop offset="1" stop-color="#071526"/></linearGradient>
      <linearGradient id="ice" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#3d6f8f"/><stop offset="1" stop-color="#122846"/></linearGradient>
      <radialGradient id="glow"><stop stop-color="#dfffff"/><stop offset=".18" stop-color="#7aebee"/><stop offset="1" stop-color="#3b4e82" stop-opacity="0"/></radialGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="8"/></filter>
    </defs>`;
    const stars = `<g fill="#d9f8ff" opacity=".72"><circle cx="90" cy="58" r="2"/><circle cx="250" cy="84" r="1.5"/><circle cx="520" cy="52" r="2"/><circle cx="740" cy="102" r="1.4"/><circle cx="840" cy="48" r="2"/></g>`;

    if (state.location === "rink") return `<svg viewBox="0 0 900 420" role="img" aria-label="Kruhové nádraží s osmi branami">${defs}<rect width="900" height="420" fill="url(#sky)"/>${stars}<ellipse cx="450" cy="370" rx="520" ry="155" fill="url(#ice)"/><g fill="none" stroke="#90dfe8" opacity=".28">${[0,1,2,3].map(i=>`<ellipse cx="450" cy="350" rx="${170+i*70}" ry="${48+i*19}"/>`).join("")}</g><g transform="translate(440 88)"><path d="M-150 210V80Q0-40 150 80v130" fill="#101b39" stroke="#8baad0" stroke-width="7"/><path d="M-70 210V112Q0 40 70 112v98" fill="#0b1128" stroke="${state.flags.gateOpen ? "#76e7ea" : "#506181"}" stroke-width="5"/><text x="0" y="28" text-anchor="middle" fill="#bcd2ed" font-size="16">OSMÁ BRÁNA</text></g>${oct}${soma}</svg>`;

    if (state.location === "window") return `<svg viewBox="0 0 900 420" role="img" aria-label="Teplý okenní parapet a vosa">${defs}<rect width="900" height="420" fill="url(#sky)"/><rect x="80" y="45" width="740" height="280" rx="14" fill="#d5e5e8" opacity=".13" stroke="#b7d7e2" stroke-width="9"/><path d="M450 50v270M85 190h730" stroke="#b7d7e2" stroke-width="7" opacity=".55"/><rect x="0" y="315" width="900" height="105" fill="#1b2b40"/><path d="M0 315h900" stroke="#a5bfd0" stroke-width="8"/><g transform="translate(590 298)" class="pulse"><ellipse rx="19" ry="10" fill="#d7a84a"/><path d="M-9-8l5 16M3-9l5 17" stroke="#171521" stroke-width="5"/><ellipse cx="-15" cy="-9" rx="12" ry="7" fill="#e8f4ff" opacity=".55"/><ellipse cx="12" cy="-10" rx="12" ry="7" fill="#e8f4ff" opacity=".55"/></g>${state.flags.waspFed ? `<circle cx="640" cy="314" r="20" fill="#ef6d91"/><circle cx="633" cy="307" r="5" fill="#ffc0d2" opacity=".6"/>` : ""}${oct}${soma}</svg>`;

    if (state.location === "workshop") return `<svg viewBox="0 0 900 420" role="img" aria-label="Ponk pod ledem">${defs}<rect width="900" height="420" fill="#10182b"/><path d="M0 0h900v105Q720 72 610 103T350 88T0 116z" fill="#21445b"/><g stroke="#5c7d99" stroke-width="5" opacity=".55">${Array.from({length:11},(_,i)=>`<path d="M${i*90} 0l40 110"/>`).join("")}</g><rect x="405" y="208" width="430" height="42" rx="7" fill="#584838"/><path d="M450 250v130M790 250v130" stroke="#342c2a" stroke-width="18"/>${!state.flags.shutterOpen ? `<g><rect x="360" y="65" width="500" height="250" rx="8" fill="#273348" stroke="#718096" stroke-width="7"/>${Array.from({length:9},(_,i)=>`<path d="M365 ${85+i*26}h490" stroke="#111a2a" stroke-width="9"/>`).join("")}<circle cx="580" cy="205" r="12" fill="#73819a"/><circle cx="615" cy="205" r="12" fill="#73819a"/><ellipse cx="665" cy="205" rx="20" ry="12" fill="#73819a"/></g>` : `<g><circle cx="520" cy="100" r="10" fill="#76e7ea"/><circle cx="610" cy="100" r="10" fill="#c190ff"/><circle cx="700" cy="100" r="10" fill="#ffd27a"/><path d="M500 210h260" stroke="#b7c3d2" stroke-width="8"/><g class="wheel" transform="translate(680 210)"><circle r="45" fill="none" stroke="#d19a5a" stroke-width="9"/><path d="M-45 0h90M0-45v90M-32-32l64 64M32-32l-64 64" stroke="#d19a5a" stroke-width="6"/></g></g>`}${oct}${soma}</svg>`;

    if (state.location === "archive") return `<svg viewBox="0 0 900 420" role="img" aria-label="Archiv plný polic a záložek">${defs}<rect width="900" height="420" fill="#17132d"/><g fill="#332b4b" stroke="#6b6085" stroke-width="5"><rect x="40" y="42" width="210" height="330"/><rect x="650" y="42" width="210" height="330"/></g><g fill="#ae7d86" opacity=".8">${Array.from({length:32},(_,i)=>{const left=i<16?65:675, j=i%16; return `<rect x="${left+(j%4)*42}" y="${70+Math.floor(j/4)*70}" width="30" height="52" rx="3"/>`}).join("")}</g><g transform="translate(500 178)"><circle r="68" fill="#1c2844" stroke="#a59abb" stroke-width="5"/><path d="M-42 0h84M0-42v84M-30-30l60 60M30-30l-60 60" stroke="#a59abb" stroke-width="4" opacity=".6"/></g>${oct}${soma}</svg>`;

    if (state.location === "observatory") return `<svg viewBox="0 0 900 420" role="img" aria-label="Hvězdárna se zrcadlem a promítačkou">${defs}<rect width="900" height="420" fill="url(#sky)"/>${stars}<path d="M370 350V170a170 170 0 01340 0v180" fill="#18294a" stroke="#58769a" stroke-width="7"/><path d="M540 170L760 74" stroke="#8ba7c7" stroke-width="14"/><ellipse cx="770" cy="70" rx="78" ry="28" transform="rotate(-23 770 70)" fill="#a6dce2" opacity=".7" stroke="#d9fbff" stroke-width="5"/><circle cx="540" cy="170" r="42" fill="#263c61" stroke="#7a91b2" stroke-width="7"/>${state.flags.mirrorAligned ? `<path d="M775 65L900 205" stroke="#76e7ea" stroke-width="6" opacity=".75" filter="url(#blur)"/><path d="M775 65L900 205" stroke="#d9ffff" stroke-width="2"/>` : ""}${oct}${soma}</svg>`;

    if (state.location === "bridge") return `<svg viewBox="0 0 900 420" role="img" aria-label="Osmá brána nad černou vodou">${defs}<rect width="900" height="420" fill="#08101f"/>${stars}<path d="M0 330Q260 255 440 330T900 320V420H0z" fill="#02060e"/><path d="M110 335Q440 250 790 335" fill="none" stroke="#536b8b" stroke-width="26"/><g transform="translate(450 38)"><path d="M-180 290V120Q0-25 180 120v170" fill="#111b35" stroke="#677da2" stroke-width="9"/><path d="M-84 290V145Q0 70 84 145v145" fill="${state.flags.gateOpen ? "#193d50" : "#060b18"}" stroke="${state.flags.gateOpen ? "#7ef0ef" : "#44516c"}" stroke-width="7"/>${state.flags.mirrorAligned ? `<circle cy="88" r="28" fill="url(#glow)" class="pulse"/>` : `<circle cy="88" r="16" fill="#222a42"/>`}</g><rect x="160" y="300" width="110" height="44" rx="9" fill="${state.soma.placed ? "#5d8f93" : "#26364e"}" stroke="#6f8da7" stroke-width="4"/><path d="M700 320v-90" stroke="#a78169" stroke-width="12"/><path d="M700 232l62-38" stroke="#a78169" stroke-width="12"/>${oct}${soma}</svg>`;

    return `<svg viewBox="0 0 900 420" role="img" aria-label="Otevřená cesta za severem">${defs}<rect width="900" height="420" fill="url(#sky)"/>${stars}<path d="M0 340Q250 250 450 330T900 270V420H0z" fill="#d9eef4" opacity=".2"/><path d="M450 420Q390 310 470 220T520 40" fill="none" stroke="#9ef0ee" stroke-width="9" opacity=".45"/><g class="drift" fill="#e7ffff" opacity=".7">${Array.from({length:22},(_,i)=>`<circle cx="${(i*83)%920}" cy="${50+(i*47)%310}" r="${1+i%3}"/>`).join("")}</g>${oct}${soma}</svg>`;
  }

  function octopusSvg(x, y, color) {
    const arms = [
      "M-15 28C-70 44-86 73-112 91", "M-7 31C-45 65-34 91-65 112", "M5 31C-12 70 5 92-9 124", "M16 27C23 67 56 82 52 118",
      "M-22 20C-78 18-98 43-128 39", "M22 20C75 20 90 51 124 43", "M-18 30C-57 84-91 87-100 122", "M20 30C61 72 92 76 108 109"
    ];
    return `<g transform="translate(${x} ${y})"><g fill="none" stroke="${color}" stroke-width="17" stroke-linecap="round" opacity=".86">${arms.map(d=>`<path d="${d}"/>`).join("")}</g><ellipse cy="0" rx="55" ry="62" fill="${color}"/><ellipse cx="-18" cy="-8" rx="7" ry="10" fill="#091124"/><ellipse cx="18" cy="-8" rx="7" ry="10" fill="#091124"/><path d="M-15 18q15 12 30 0" fill="none" stroke="#091124" stroke-width="5" stroke-linecap="round"/><g fill="#d7f8ff" stroke="#57738e" stroke-width="4"><path d="M-137 94h54l15 12h-67z"/><path d="M36 116h54l15 12H38z"/></g><g fill="#9fe9ef">${[-122,-103,-84,52,71,90].map((cx,i)=>`<circle cx="${cx}" cy="${i<3?110:132}" r="7"/>`).join("")}</g></g>`;
  }

  function somaSvg(x, y) {
    return `<g transform="translate(${x} ${y})"><circle r="54" fill="url(#glow)" class="pulse"/><rect x="-32" y="-30" width="64" height="58" rx="17" fill="#54758f" stroke="#9edbe1" stroke-width="5"/><circle cy="-3" r="14" fill="#d9ffff"/><path d="M-23 31v17M23 31v17" stroke="#91bdcd" stroke-width="8"/><circle cx="-23" cy="51" r="10" fill="#18273b" stroke="#91bdcd" stroke-width="4"/><circle cx="23" cy="51" r="10" fill="#18273b" stroke="#91bdcd" stroke-width="4"/><path d="M-18-31l-10-18M18-31l10-18" stroke="#91bdcd" stroke-width="4"/><circle cx="-29" cy="-51" r="4" fill="#76e7ea"/><circle cx="29" cy="-51" r="4" fill="#76e7ea"/></g>`;
  }

  function render() {
    if (!state.started) return;
    el("titleScreen").classList.add("hidden");
    el("playScreen").classList.remove("hidden");

    el("roleBar").innerHTML = Object.entries(ROLES).map(([id,r]) => `<button class="role-button ${state.role===id?"active":""}" data-role="${id}"><strong>${r.icon} ${r.name}</strong><span>${r.hint}</span></button>`).join("");
    el("scene").innerHTML = sceneSvg();
    el("locationKicker").textContent = PLACES[state.location].kicker;
    el("locationTitle").textContent = PLACES[state.location].title;
    el("roleWhisper").textContent = roleWhisper();
    el("storyText").innerHTML = state.lastText || defaultText();
    el("choices").innerHTML = choicesForScene().map(c => `<button data-action="${c.action}" ${c.disabled?"disabled":""} class="${c.recommended?"recommended":""}">${c.label}${c.small?`<small>${c.small}</small>`:""}</button>`).join("");

    el("somaPlace").textContent = PLACES[state.soma.location].title;
    el("batteryFill").style.width = `${(state.soma.battery/state.soma.max)*100}%`;
    el("batteryText").textContent = `${state.soma.battery} / ${state.soma.max} dílků · ${state.soma.wheelFixed ? "kolečko drží" : "kolečko kmitá"}`;
    el("inventoryCount").textContent = state.inventory.length;
    el("inventory").innerHTML = state.inventory.length ? state.inventory.map(i=>`<span class="chip">${ITEMS[i]}</span>`).join("") : `<span class="chip empty">prázdno</span>`;
    const expCount = Object.keys(state.experiences).length;
    el("experienceCount").textContent = `${expCount} / 6`;
    el("experienceMarks").innerHTML = Array.from({length:6},(_,i)=>`<span class="experience-mark ${i>=expCount?"dim":""}" title="${i<expCount?Object.values(EXPERIENCES)[i]?.title:"dosud nevznikla"}"></span>`).join("");
  }

  function openMap() {
    const content = `<h2>Mapa pod ledem</h2><p>Ty můžeš bruslit zdarma. Soma spotřebuje při každém přesunu jeden dílek proudu. K ponku ji lze při vybití odtáhnout.</p><div class="map-grid">${Object.entries(PLACES).filter(([id])=>id!=="north").map(([id,p])=>{
      const current=id===state.location, soma=id===state.soma.location;
      return `<article class="map-place ${current?"current":""}"><h4>${p.title}${current?" · jsi tady":""}${soma?" · Soma":""}</h4><p>${p.desc}</p><div class="map-actions">${!current?`<button data-travel="${id}" data-soma="false">Jet sama</button>`:""}${!current && hereWithSoma()?`<button data-travel="${id}" data-soma="true">Vzít Somu ${state.soma.battery>0?"(−1)":"(odtáhnout)"}</button>`:""}</div></article>`;
    }).join("")}</div>`;
    showModal(content);
  }

  function openJournal() {
    const factsHtml = Object.keys(state.facts).length ? Object.keys(state.facts).map(id=>`<div class="journal-entry"><strong>${FACTS[id].title}</strong>${FACTS[id].text}<small>zachytila poloha ${ROLES[state.facts[id].role].name} · ${PLACES[state.facts[id].at].title}</small></div>`).join("") : `<p><em>Zatím jen prázdné stránky.</em></p>`;
    const expHtml = Object.keys(state.experiences).length ? Object.keys(state.experiences).map(id=>`<div class="journal-entry experience"><strong>${EXPERIENCES[id].title}</strong>${EXPERIENCES[id].text}</div>`).join("") : `<p><em>Poznatky se zatím s žádným jednáním nespojily.</em></p>`;
    showModal(`<h2>Deník jedné jízdy</h2><h3>Dohledatelné poznatky</h3>${factsHtml}<h3>Zkušenosti spojené s jednáním</h3>${expHtml}<h3>Stopa</h3><p>${state.moves} přesunů · ${state.roleSwitches} změn polohy · ${state.flags.lexiconReturned?"lexikon vrácen":"lexikon stále v kapse"}</p>`);
  }

  function showModal(content) { el("modalContent").innerHTML = content; el("overlay").classList.remove("hidden"); }
  function closeModal() { el("overlay").classList.add("hidden"); }

  function startGame(mode) {
    if (mode === "new") state = freshState(); else if (!load()) state = freshState();
    state.started = true;
    state.lastText = mode === "new" ? `<p>Osmá brána zadržela ráno, protože nedokáže rozhodnout, jestli dvě role se společnými vzpomínkami jsou jeden cestující, nebo dva.</p><p>Lýra má volné zadání, neomezeně času, osm ramen a brusle. V kapse navíc nahmatá <strong>Serpentýnin lexikon</strong>, který rozhodně neměl odjet na sever.</p><p><em>Změnou polohy nic neztratíš. Každá si všimne něčeho jiného.</em></p>` : state.lastText;
    save(); render();
  }

  function resetGame() {
    if (!confirm("Začít úplně novou stopu? Dosavadní cesta se smaže.")) return;
    localStorage.removeItem(SAVE_KEY);
    state = freshState();
    el("playScreen").classList.add("hidden");
    el("titleScreen").classList.remove("hidden");
    el("continueBtn").classList.add("hidden");
  }

  document.addEventListener("click", e => {
    const start = e.target.closest("[data-start]"); if (start) return startGame(start.dataset.start);
    const role = e.target.closest("[data-role]"); if (role) return switchRole(role.dataset.role);
    const action = e.target.closest("[data-action]"); if (action && !action.disabled) return act(action.dataset.action);
    const open = e.target.closest("[data-open]"); if (open) return open.dataset.open === "map" ? openMap() : openJournal();
    const travelBtn = e.target.closest("[data-travel]"); if (travelBtn) return travel(travelBtn.dataset.travel, travelBtn.dataset.soma === "true");
    if (e.target.closest("[data-close]") || e.target === el("overlay")) return closeModal();
    if (e.target.closest("[data-reset]")) return resetGame();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeModal();
    if (e.key.toLowerCase() === "m") openMap();
    if (e.key.toLowerCase() === "d") openJournal();
    if (["1","2","3"].includes(e.key)) switchRole(["watch","talk","work"][Number(e.key)-1]);
  });

  if (localStorage.getItem(SAVE_KEY)) el("continueBtn").classList.remove("hidden");

  // Malé veřejné rozhraní pro testy bez skrytých řešení v UI.
  window.__LYRA_GAME__ = { freshState, getState: () => JSON.parse(JSON.stringify(state)), startGame, switchRole, travel, act, bridgeReady };
})();
