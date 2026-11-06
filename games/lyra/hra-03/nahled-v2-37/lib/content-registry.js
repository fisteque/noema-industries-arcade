(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KloboukyContent = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const SPECIES = {
    medovka: {
      id: "medovka", name: "Medovka hřebenitá", icon: "🍄", kind: "edible",
      atlas: "JEDLÁ · Tupé hřebínky, medová vůně. V polévce zesládne, v lektvaru drží směr.",
      clues: ["zlatý klobouk", "tupé hřebínky místo lupenů", "vůně po medu a meruňce"]
    },
    hnedka: {
      id: "hnedka", name: "Hnědka mechová", icon: "🍄", kind: "edible",
      atlas: "JEDLÁ · Pod kloboukem má měkké póry a na třeni síťku. Spolehlivý základ polévky.",
      clues: ["kaštanový klobouk", "měkké póry na spodku", "jemná síťka na třeni"]
    },
    ohnivka: {
      id: "ohnivka", name: "Ohnivka zubatá", icon: "🍄", kind: "inedible",
      atlas: "NEJEDLÁ · Ostré husté lupeny a pepřový pach. Zkazí polévku i lektvar.",
      clues: ["oranžový nálevkovitý klobouk", "ostré husté lupeny", "pepřový pach"]
    },
    belokruh: {
      id: "belokruh", name: "Bělokruh zákeřný", icon: "🍄", kind: "poison",
      atlas: "JEDOVATÝ · Bílý prsten a vakovitá pochva u země. Do košíku s jídlem nepatří.",
      clues: ["bledý klobouk", "bílý prsten na třeni", "vakovitá pochva schovaná v jehličí"]
    },
    modravec: {
      id: "modravec", name: "Modravec měsíční", icon: "🍄", kind: "potion",
      atlas: "NEJÍ SE · Stříbrné výtrusy vedou lektvar. S Medovkou nebo Hnědkou tvoří stabilní pár.",
      clues: ["modrý klobouk světélkuje ve stínu", "dutý chladný třeň", "po otočení pouští stříbrné výtrusy"]
    },
    rosovka: {
      id: "rosovka", name: "Rosovka perlová", icon: "🍄", kind: "edible",
      atlas: "JEDLÁ · Narůžovělý klobouk drží kapky rosy a řídké lupeny voní po zeleném jablku. Polévku zjemní.",
      clues: ["narůžovělý klobouk s perličkami rosy", "řídké krémové lupeny", "vůně po zeleném jablku"]
    },
    inkoustovka: {
      id: "inkoustovka", name: "Inkoustovka fialová", icon: "🍄", kind: "inedible",
      atlas: "NEJEDLÁ · Sametový fialový klobouk při poranění pouští tmavou šťávu. Polévku obarví a zhořkne; její místo v lektvaru zatím neznáš.",
      clues: ["sametový fialový klobouk", "tmavá šťáva na poraněném okraji", "kovová vůně"]
    }
  };

  const SITES = [
    { id: "breza", name: "Březový okraj", icon: "🌿", species: "medovka", intro: "Mezi kořeny je teplo a něco zlatého se opírá o břízu." },
    { id: "mech", name: "Mechová pěšina", icon: "🌲", species: "hnedka", intro: "V mechu sedí hnědý klobouk a splývá s mokrou zemí." },
    { id: "parez", name: "Starý pařez", icon: "🪵", species: "ohnivka", intro: "Pařez je obsypaný oranžovými nálevkami. Vypadají až příliš ochotně." },
    { id: "rokle", name: "Bílá rokle", icon: "🕳️", species: "belokruh", intro: "Pod jehličím se leskne bledý klobouk." },
    { id: "studenka", name: "Měsíční studánka", icon: "🌙", species: "modravec", intro: "Ve stínu studánky svítí modrý klobouk. Voda kolem něj se nehýbe." }
  ];

  const IDENTIFICATION_OPTIONS = {
    medovka: ["medovka", "rosovka", "ohnivka"],
    hnedka: ["hnedka", "medovka", "inkoustovka"],
    ohnivka: ["ohnivka", "rosovka", "belokruh"],
    belokruh: ["belokruh", "inkoustovka", "modravec"],
    modravec: ["modravec", "inkoustovka", "hnedka"],
    rosovka: ["rosovka", "medovka", "belokruh"],
    inkoustovka: ["inkoustovka", "modravec", "hnedka"]
  };

  const TIMINGS = {
    dayStart: 7 * 60,
    workStart: 16 * 60,
    travelHome: 30,
    carriedItemDelay: 30,
    homeIdentification: 15,
    homeLexicon: 30,
    soup: 60,
    potion: 60,
    hungerTick: 30,
    nightStart: 18 * 60
  };

  const EQUIPMENT = {
    baskets: {
      wicker: { id: "wicker", name: "Proutěný košík", capacity: 5, returnThreshold: 3, accepts: ["mushroom"] }
    }
  };

  return { SPECIES, SITES, IDENTIFICATION_OPTIONS, TIMINGS, EQUIPMENT };
});



