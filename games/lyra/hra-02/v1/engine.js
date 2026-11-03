(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CityEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FACTS = {
    mortar: "Malta za modrými dveřmi je vlhká a drží v ní modrá nit.",
    ivo: "Ivo tvrdí, že jsi modré dveře včera zamkla sama.",
    painted: "Druhé ráno je pekárenské okno jen namalované na omítce.",
    chalkMismatch: "Liova nová šipka je světlejší než včerejší čára.",
    clock: "Věž se nezpožďuje; třetí zvon přichází pokaždé včas."
  };

  const DEEDS = {
    returnedKey: "Vrátila jsi Ireně mosazný klíč.",
    wedgedDoor: "Nechala jsi klíč ve služebních dveřích, aby zůstaly otevřené.",
    chalked: "Nakreslila jsi s Liem modrou cestu přes dvůr.",
    hurried: "Nechala jsi Lia kreslit samotného a spěchala k věži.",
    followedLio: "Když se cesty rozešly, šla jsi za Liovou čerstvou šipkou.",
    followedNote: "Když se cesty rozešly, držela ses vlastního zápisu.",
    promisedIrena: "Slíbila jsi Darii, že třetí ráno přivedeš Irenu.",
    promisedLio: "Slíbila jsi Darii, že třetí ráno přivedeš Lia.",
    promisedBoth: "Slíbila jsi Darii, že zkusíš přivést Irenu i Lia."
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const addOnce = (list, value) => { if (!list.includes(value)) list.push(value); };

  function initialState() {
    return {
      version: 1,
      day: 1,
      scene: "square1",
      bells: 5,
      facts: [],
      deeds: [],
      flags: {},
      history: [],
      ending: null
    };
  }

  function noteFact(state, id) { addOnce(state.facts, id); }
  function noteDeed(state, id) { addOnce(state.deeds, id); }
  function move(state, scene, cost) {
    state.bells = Math.max(0, state.bells - (cost || 0));
    state.scene = scene;
  }

  function choose(input, id) {
    const s = clone(input);
    s.history.push({ day: s.day, scene: s.scene, choice: id });
    const key = s.scene + ":" + id;

    switch (key) {
      case "square1:inspectWall":
        noteFact(s, "mortar");
        s.flags.inspectedWall = true;
        return s;
      case "square1:askIvo":
        noteFact(s, "ivo");
        s.flags.askedIvo = true;
        return s;
      case "square1:takeWindow":
        move(s, "bakery1", 1);
        return s;
      case "bakery1:returnKey":
        noteDeed(s, "returnedKey");
        s.flags.returnedKey = true;
        move(s, "courtyard1", 1);
        return s;
      case "bakery1:wedgeDoor":
        noteDeed(s, "wedgedDoor");
        s.flags.wedgedDoor = true;
        move(s, "courtyard1", 0);
        return s;
      case "courtyard1:chalk":
        noteDeed(s, "chalked");
        s.flags.chalked = true;
        move(s, "tower1", 1);
        return s;
      case "courtyard1:hurry":
        noteDeed(s, "hurried");
        s.flags.hurried = true;
        move(s, "tower1", 0);
        return s;
      case "tower1:nextMorning":
        s.day = 2; s.bells = 5; s.scene = "square2";
        return s;
      case "square2:inspectWindow":
        noteFact(s, "painted");
        s.flags.inspectedWindow = true;
        return s;
      case "square2:askLio":
        s.flags.askedLio = true;
        if (!s.flags.chalked) noteFact(s, "chalkMismatch");
        return s;
      case "square2:useDoor":
      case "square2:useBalcony":
        move(s, "bakery2", 1);
        return s;
      case "square2:followOldChalk":
        s.flags.usedShortcut = true;
        move(s, "courtyard2", 1);
        return s;
      case "bakery2:toCourtyard":
        move(s, "courtyard2", 1);
        return s;
      case "courtyard2:followLio":
        noteDeed(s, "followedLio");
        s.flags.followedLio = true;
        move(s, "tower2", 1);
        return s;
      case "courtyard2:followNote":
        noteDeed(s, "followedNote");
        s.flags.followedNote = true;
        move(s, "tower2", 1);
        return s;
      case "tower2:inspectClock":
        noteFact(s, "clock");
        s.flags.inspectedClock = true;
        return s;
      case "tower2:promiseIrena":
        noteDeed(s, "promisedIrena"); s.flags.promise = "irena";
        s.day = 3; s.bells = 5; s.scene = "square3";
        return s;
      case "tower2:promiseLio":
        noteDeed(s, "promisedLio"); s.flags.promise = "lio";
        s.day = 3; s.bells = 5; s.scene = "square3";
        return s;
      case "tower2:promiseBoth":
        noteDeed(s, "promisedBoth"); s.flags.promise = "both";
        s.day = 3; s.bells = 5; s.scene = "square3";
        return s;
      case "square3:fetchIrena":
        move(s, "irena3", s.flags.returnedKey ? 1 : 2);
        return s;
      case "square3:fetchLio":
        move(s, "lio3", (s.flags.chalked || s.flags.followedLio) ? 1 : 2);
        return s;
      case "square3:compareTraces":
        move(s, "crossroads3", 1);
        s.flags.compared = true;
        return s;
      case "crossroads3:returnForPromise":
        s.flags.returnedForPromise = true;
        move(s, "square3", 0);
        return s;
      case "irena3:goTower":
        s.flags.broughtIrena = true;
        move(s, "final3", 1);
        return s;
      case "irena3:fetchLioToo":
        s.flags.broughtIrena = true;
        move(s, "lioAfterIrena3", 1);
        return s;
      case "lioAfterIrena3:goTower":
        s.flags.broughtLio = true;
        move(s, "final3", 1);
        return s;
      case "lio3:goTower":
        s.flags.broughtLio = true;
        move(s, "final3", 1);
        return s;
      case "lio3:fetchIrenaToo":
        s.flags.broughtLio = true;
        move(s, "irenaAfterLio3", 1);
        return s;
      case "irenaAfterLio3:goTower":
        s.flags.broughtIrena = true;
        move(s, "final3", 1);
        return s;
      case "crossroads3:oldDoor":
        s.flags.route = "door";
        move(s, "final3", 1);
        return s;
      case "crossroads3:newWindow":
        s.flags.route = "window";
        move(s, "final3", 1);
        return s;
      case "final3:keepDoor":
        s.ending = "door"; s.scene = "ending";
        return s;
      case "final3:keepWindow":
        s.ending = "window"; s.scene = "ending";
        return s;
      case "final3:drawBoth":
        s.ending = "both"; s.scene = "ending";
        return s;
      case "final3:leaveBlank":
        s.ending = "blank"; s.scene = "ending";
        return s;
      default:
        throw new Error("Neznámá volba: " + key);
    }
  }

  function choice(id, label, note, enabled) {
    return { id, label, note: note || "", enabled: enabled !== false };
  }

  function scene(state) {
    const s = state;
    const f = s.flags;
    const common = { day: s.day, bells: s.bells };
    const scenes = {
      square1: () => ({
        ...common, place: "NÁMĚSTÍ · PRVNÍ RÁNO", title: "Dveře vedou do zdi",
        paragraphs: [
          "Do hodinové věže neseš pouzdro s novým perem pro hodinářku Darii. Včera jsi šla Modrou uličkou. Dnes modré dveře otevřou jen čerstvou cihlovou zeď.",
          "Ivo zametá schod, jako by tu zeď vídal každé ráno. Nad pekárnou zůstalo otevřené vysoké okno."
        ],
        choices: [
          choice("inspectWall", f.inspectedWall ? "Zeď už jsi prohlédla" : "Prohlédnout čerstvou zeď", "Pozorování nezabere zvon.", !f.inspectedWall),
          choice("askIvo", f.askedIvo ? "Iva už ses zeptala" : "Zeptat se Iva, co si pamatuje", "Jeho odpověď je tvrzení, ne důkaz.", !f.askedIvo),
          choice("takeWindow", "Vylézt do pekárenského okna", "Jediný viditelný průchod dál.")
        ], map: "wall-window"
      }),
      bakery1: () => ({
        ...common, place: "PEKÁRNA · PRVNÍ RÁNO", title: "Klíč pod pytlem mouky",
        paragraphs: [
          "Dopadneš mezi pytle. Irena se lekne a pak se rozesměje: „Dveřmi jako ostatní už to dneska nešlo?“",
          "Při uhýbání ti pod botu zajede její mosazný klíč. Služební dveře do dvora se právě dovírají."
        ],
        choices: [
          choice("returnKey", "Vrátit Ireně klíč do dlaně", "Zdržíš se o jeden zvon."),
          choice("wedgeDoor", "Podepřít klíčem služební dveře", "Průchod zůstane otevřený; klíč nebude u Ireny.")
        ], map: "bakery"
      }),
      courtyard1: () => ({
        ...common, place: "DVŮR · PRVNÍ RÁNO", title: "Modrá čára přes dlažbu",
        paragraphs: [
          "Lio kreslí křídou šipky od okapu k bráně. „Kdyby to tu zítra bylo jinak, aspoň poznáme, co jsme nakreslili my,“ řekne a podá ti křídu.",
          "Věž je už za dvorem. Do třetího zvonu zbývá čas i na jednu odbočku."
        ],
        choices: [
          choice("chalk", "Dokreslit s Liem cestu", "Zabere jeden zvon a zanechá fyzickou stopu."),
          choice("hurry", "Nechat Lia kreslit a spěchat", "Nic nezanecháš, ale získáš čas.")
        ], map: "courtyard"
      }),
      tower1: () => ({
        ...common, place: "HODINOVÁ VĚŽ · PRVNÍ RÁNO", title: "Pero zapadne na své místo",
        paragraphs: [
          "Daria vezme pouzdro a bez řečí vymění ohnuté pero v hodinovém stroji. Třetí zvon se rozběhne přesně ve chvíli, kdy dotáhne šroub.",
          "„Zítra přines druhý díl,“ řekne. „A nepočítej s tím, že město zopakuje dnešní cestu.“"
        ],
        choices: [choice("nextMorning", "Přijít druhé ráno", "Dnešní jednání zůstane ve městě.")], map: "tower"
      }),
      square2: () => ({
        ...common, place: "NÁMĚSTÍ · DRUHÉ RÁNO", title: "Okno je namalované",
        paragraphs: [
          "Za modrými dveřmi je pořád zeď. Pekárenské okno, kterým jsi včera lezla, je dnes hladká malba na omítce.",
          f.chalked ? "Tvoje modrá čára ale začíná tam, kde jsi ji nechala, a mizí za rohem dvora." : "Od okapu vede modrá šipka, kterou si nepamatuješ. Lio tvrdí, že jste ji včera kreslili spolu."
        ].concat(f.askedLio ? [f.chalked
          ? "Lio odpoví, že jste čáru kreslili spolu. Tentokrát jeho vzpomínka odpovídá fyzické stopě, kterou jsi sama vytvořila."
          : "Lio odpoví, že jste šipku kreslili spolu. Jeho jistota ale nespraví rozdíl mezi tvou pamětí a dnešní stopou."
        ] : []),
        choices: [
          choice("inspectWindow", f.inspectedWindow ? "Malbu už jsi prohlédla" : "Dotknout se namalovaného okna", "Konkrétní dnešní změna.", !f.inspectedWindow),
          choice("askLio", f.askedLio ? "Lia už ses zeptala" : "Zeptat se Lia na šipku", "Jeho vzpomínka se může lišit od tvé.", !f.askedLio),
          f.wedgedDoor ? choice("useDoor", "Projít podepřenými služebními dveřmi", "Včerejší klíč skutečně drží průchod.") : choice("useBalcony", "Zavolat na Irenu v pekárně", "Včerejší pomoc změnila její dnešní reakci."),
          choice("followOldChalk", "Jít rovnou po včerejší čáře", "Zkratka existuje jen proto, že jsi ji kreslila.", !!f.chalked)
        ], map: "painted-window"
      }),
      bakery2: () => ({
        ...common, place: "PEKÁRNA · DRUHÉ RÁNO", title: f.returnedKey ? "Provazový žebřík" : "Dveře na mosazném klíči",
        paragraphs: f.returnedKey ? [
          "Irena tě pozná dřív, než stačíš ukázat pouzdro. „Včera jsi mi vrátila klíč. Tak dneska něco vrátím já.“ Spustí z balkonu provazový žebřík do dvora.",
          "Netvrdí, že si pamatuje stejné město. Reaguje na jednu konkrétní věc, kterou jsi udělala."
        ] : [
          "Služební dveře drží otevřené přesně tam, kde jsi nechala klíč. Irena ho ráno našla a není nadšená.",
          "„Kuchařka díky tomu stihla mouku před deštěm,“ dodá. „Ale příště mi aspoň řekni, kam dáváš moje věci.“"
        ],
        choices: [choice("toCourtyard", "Pokračovat do dvora", "Dnešní průchod vznikl ze včerejšího jednání.")], map: "bakery"
      }),
      courtyard2: () => ({
        ...common, place: "DVŮR · DRUHÉ RÁNO", title: "Dvě šipky, jeden roh",
        paragraphs: [
          f.chalked ? "Tvoje tmavší čára končí u zdi. Lio k ní právě přikresluje světlejší pokračování k tramvajové koleji." : "Modrá čára na dlažbě končí u zdi. Lio k ní právě přikresluje světlejší pokračování k tramvajové koleji.",
          "Tvůj včerejší zápis ukazuje jinam: přes průchod pod prádelnou. Obě cesty mohou vést k věži. Na vyzkoušení jedné zbývá dost času."
        ],
        choices: [
          choice("followLio", "Jít za Liovou čerstvou šipkou", "Svěříš další krok člověku, ne staré mapě."),
          choice("followNote", "Držet se vlastního zápisu", "Svěříš další krok tomu, co sis zaznamenala sama.")
        ], map: "two-arrows"
      }),
      tower2: () => ({
        ...common, place: "HODINOVÁ VĚŽ · DRUHÉ RÁNO", title: "Dva svědci pro třetí zvon",
        paragraphs: [
          "Daria zasune druhý díl do stroje. Pak ukáže na dvě páky na opačných stranách místnosti.",
          "„Zítra je musí někdo podržet současně. Irena zná dveře a Lio nové čáry. Přiveď jednoho z nich — nebo oba, pokud město dovolí.“"
        ],
        choices: [
          choice("inspectClock", f.inspectedClock ? "Stroj už jsi porovnala" : "Porovnat zvon s kapesními hodinkami", "Ověříš jednu věc, která se nemění.", !f.inspectedClock),
          choice("promiseIrena", "Slíbit, že přivedeš Irenu", "Zvolíš vztah navázaný na dveře."),
          choice("promiseLio", "Slíbit, že přivedeš Lia", "Zvolíš vztah navázaný na nové stopy."),
          choice("promiseBoth", "Slíbit, že zkusíš přivést oba", "Delší cesta; předchozí pomoc ji může zkrátit.")
        ], map: "tower"
      }),
      square3: () => ({
        ...common, place: "NÁMĚSTÍ · TŘETÍ RÁNO", title: "Město čeká, koho oslovíš",
        paragraphs: [
          "Modré dveře jsou zavřené, ale zeď za nimi zmizela. Namalované okno je zase skutečné. Obě cesty existují současně poprvé.",
          f.compared
            ? (f.promise === "both" ? "Stopy sis už porovnala. Slib přivést Irenu i Lia ale pořád čeká na tvoje jednání." : "Stopy sis už porovnala. Slib přivést jednoho člověka ale pořád čeká na tvoje jednání.")
            : (f.promise === "both" ? "Slíbila jsi přivést Irenu i Lia. Jestli ses jim dřív věnovala, město ti ten čas může vrátit." : "Slíbila jsi přivést jednoho člověka. Můžeš slib dodržet, nebo se nejdřív zastavit u stop a rozhodnout znovu.")
        ],
        choices: [
          choice("fetchIrena", "Jít pro Irenu", f.returnedKey ? "Včerejší vrácený klíč cestu zkrátí." : "Kvůli klíči bude rozhovor delší."),
          choice("fetchLio", "Jít pro Lia", (f.chalked || f.followedLio) ? "Společná čára nebo důvěra cestu zkrátí." : "Nejdřív mu budeš muset ukázat vlastní stopu."),
          choice("compareTraces", f.compared ? "Stopy už jsi porovnala" : "Nejdřív porovnat zeď, okno a šipky", "Dostupné jen po dvou konkrétních pozorováních.", !f.compared && s.facts.includes("mortar") && s.facts.includes("painted"))
        ], map: "both-open"
      }),
      irena3: () => ({
        ...common, place: "PEKÁRNA · TŘETÍ RÁNO", title: "Irena si bere zástěru s sebou",
        paragraphs: [
          f.returnedKey ? "Irena zamkne pec, vezme klíč a jde s tebou bez dalšího ptaní. „Jednou jsi mi vrátila cestu domů. Teď podržím tu tvoji.“" : "Irena nejdřív ukáže na klíč. Omluvíš se, že jsi rozhodla za ni. Po chvíli ho vytáhne ze dveří a přidá se: „Příště se zeptej.“",
          "Je připravená jít k věži."
        ],
        choices: [
          choice("goTower", "Jít s Irenou k věži", "Dorazíte jednou cestou."),
          choice("fetchLioToo", "Zkusit ještě přivést Lia", "Možné, jen pokud zbývají alespoň dva zvony.", s.bells >= 2)
        ], map: "bakery"
      }),
      lio3: () => ({
        ...common, place: "DVŮR · TŘETÍ RÁNO", title: "Lio skládá křídy do kapsy",
        paragraphs: [
          (f.chalked || f.followedLio) ? "Lio zahlédne tvoje boty na modré čáře a hned vstane. „Dneska kreslíme až uvnitř věže.“" : "Lio chce nejdřív vidět, co sis zapsala ty. Ukážeš mu rozdílné čáry; přikývne a vezme křídy.",
          "Je připravený jít k věži."
        ],
        choices: [
          choice("goTower", "Jít s Liem k věži", "Dorazíte jednou cestou."),
          choice("fetchIrenaToo", "Zkusit ještě přivést Irenu", "Možné, jen pokud zbývají alespoň dva zvony.", s.bells >= 2)
        ], map: "courtyard"
      }),
      lioAfterIrena3: () => ({
        ...common, place: "DVŮR · TŘETÍ RÁNO", title: "Druhá cesta se připojí",
        paragraphs: ["Irena počká u modré čáry. Lio si všimne jejího klíče, vezme křídy a přidá se. Nikdo z nich nemusí tvrdit, že si včerejšek pamatuje stejně."],
        choices: [choice("goTower", "Jít společně k věži", "Dvě různé cesty se potkají až u cíle.")], map: "two-arrows"
      }),
      irenaAfterLio3: () => ({
        ...common, place: "PEKÁRNA · TŘETÍ RÁNO", title: "Druhé dveře se otevřou",
        paragraphs: ["Lio počká u okna. Irena si vezme klíč a přidá se. Každý drží jinou stopu, ale oba vědí, proč jdou právě teď k věži."],
        choices: [choice("goTower", "Jít společně k věži", "Dvě různé cesty se potkají až u cíle.")], map: "bakery"
      }),
      crossroads3: () => ({
        ...common, place: "ROZCESTÍ · TŘETÍ RÁNO", title: "Stopy se shodují jen v rohu",
        paragraphs: [
          "Modrá nit z první zdi má stejný odstín jako starší vrstva křídy. Neříká ti, kdo má pravdu. Ukazuje jen, že obě změny někdo skutečně udělal.",
          "Můžeš dojít starými dveřmi nebo novým oknem. Porovnání ti cestu nevybralo; jen z ní odstranilo hádanku, která tam nebyla."
        ],
        choices: [
          choice("returnForPromise", f.promise === "both" ? "Vrátit se pro Irenu a Lia" : f.promise === "irena" ? "Vrátit se pro Irenu" : "Vrátit se pro Lia", "Porovnání bylo odbočkou, ne náhradou za slib."),
          choice("oldDoor", "Projít znovu otevřenými dveřmi", "Půjdeš sama; slíbeného člověka necháš za sebou."),
          choice("newWindow", "Vylézt skutečným oknem", "Půjdeš sama; slíbeného člověka necháš za sebou.")
        ], map: "both-open"
      }),
      final3: () => ({
        ...common, place: "HODINOVÁ VĚŽ · TŘETÍ RÁNO", title: "Třetí zvon čeká na dvě páky",
        paragraphs: [
          f.broughtIrena && f.broughtLio ? "Irena podrží mosaznou páku klíčem. Lio na druhé straně obtáhne polohu křídou. Ty vložíš poslední díl a stroj se rozběhne." : f.broughtIrena ? "Irena zaklíní jednu páku klíčem. Druhou podržíš sama, zatímco Daria vkládá poslední díl." : f.broughtLio ? "Lio vyznačí polohu jedné páky. Druhou podržíš sama, zatímco Daria vkládá poslední díl." : "Dorazila jsi sama. Jednu páku přivážeš modrou nití a druhou podržíš, zatímco Daria vkládá poslední díl.",
          "Zvon funguje. Daria položí na stůl čistou mapu náměstí. „Co na ní necháme pro zítřek?“"
        ],
        choices: [
          choice("keepDoor", "Nakreslit modré dveře", "Zachováš návrat ke známé cestě."),
          choice("keepWindow", "Nakreslit pekárenské okno", "Zachováš cestu, která vznikla změnou."),
          choice("drawBoth", "Nakreslit obě cesty i místo setkání", "Dostupné, když k věži přišli Irena i Lio.", !!(f.broughtIrena && f.broughtLio)),
          choice("leaveBlank", "Nechat mapu prázdnou a popsat jen dnešní cestu", "Dostupné po porovnání fyzických stop.", !!f.compared)
        ], map: "tower"
      }),
      ending: () => {
        const endings = {
          door: ["DVEŘE ZŮSTALY", "Ráno se na mapě objeví modrá ulička. Irena přes ni vozí mouku a občas nechá služební dveře otevřené. Okno nezmizelo; jen už není jedinou možností."],
          window: ["OKNO ZŮSTALO", "Ráno vede mapa přes pekárenské okno a dvůr. Lio pod něj nakreslí schůdek pro kratší nohy. Modré dveře zůstávají ve zdi jako připomínka cesty, která nemusí být povinnost."],
          both: ["DVĚ CESTY SE POTKALY", "Na mapě jsou dveře, okno a malý kruh u věže. Irena a Lio tam každý přidají vlastní značku. Mapa netvrdí, že šli včera stejně. Umožňuje jim dojít spolu zítra."],
          blank: ["MAPA NEPŘEDBĚHLA MĚSTO", "Daria uloží čistý list do zásuvky. Místo hotové pravdy na okraj napíšeš, kudy jste prošli dnes a kdo cestu otevřel. Zítra se budete muset znovu podívat."]
        };
        const e = endings[s.ending];
        return { ...common, place: "KONEC PRVNÍ CESTY", title: e[0], paragraphs: [e[1], "Město se nezměnilo v odpověď. Změnilo se v místo, kde je podle čeho jednat."], choices: [], map: "ending", ending: true };
      }
    };
    if (!scenes[s.scene]) throw new Error("Neznámá scéna: " + s.scene);
    return scenes[s.scene]();
  }

  function labels(state) {
    return {
      facts: state.facts.map(id => FACTS[id]),
      deeds: state.deeds.map(id => DEEDS[id])
    };
  }

  return { initialState, choose, scene, labels, FACTS, DEEDS };
});

