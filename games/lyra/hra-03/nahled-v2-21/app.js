(function () {
  "use strict";

  const E = window.KloboukyEngine;
  const STORAGE = "lyra-klobouky-a-hlizy-v2-21-preview";
  const app = document.getElementById("app");
  const TAU = Math.PI * 2;
  const FOV = Math.PI / 2.7;
  const VERTICAL_LOOK = 0.72;
  const WORLD_LIMIT = 14;
  const SCRATCH_LINGER_MS = 1600;
  const SITE_IDS = ["breza", "mech", "parez", "rokle", "studenka"];
  const DEFAULT_SITE_POSITIONS = {
    breza: { x: -8.2, z: -7.1 },
    mech: { x: 7.4, z: -7.5 },
    parez: { x: -9.1, z: 3.2 },
    rokle: { x: 8.7, z: 5.1 },
    studenka: { x: 0.2, z: -1.2 }
  };
  const SITE_REGIONS = [
    [{ x: -10.4, z: -8.3 }, { x: -8.1, z: -6.6 }, { x: -10.7, z: -4.7 }],
    [{ x: 9.8, z: -8.1 }, { x: 6.8, z: -7.2 }, { x: 10.4, z: -4.9 }],
    [{ x: -10.2, z: -0.2 }, { x: -8.3, z: 3.0 }, { x: -10.0, z: 6.2 }],
    [{ x: 9.8, z: -0.5 }, { x: 8.1, z: 3.6 }, { x: 10.1, z: 6.5 }],
    [{ x: 0.1, z: -2.3 }, { x: -2.2, z: 2.5 }, { x: 2.3, z: 4.7 }, { x: -0.5, z: 6.8 }]
  ];

  let state = load();
  let selected = [];
  let soupChoices = {};
  let scene = null;
  let sitePositions = state?.sitePositions || cloneSitePositions(DEFAULT_SITE_POSITIONS);
  let world = makeWorld(sitePositions);

  // Pravé tlačítko v celé lesní fázi uvolňuje myš, ale nikdy neotevírá
  // systémové kontextové menu — ani během prohlídky právě nalezené houby.
  document.addEventListener("contextmenu", (event) => {
    if (state?.phase === "forest") event.preventDefault();
  });

  function cloneSitePositions(layout) {
    return Object.fromEntries(SITE_IDS.map((id) => [id, { x: layout[id].x, z: layout[id].z }]));
  }

  function randomSeed() {
    if (window.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      window.crypto.getRandomValues(value);
      return value[0] || 1;
    }
    return ((Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0) || 1;
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function createSitePositions(seed) {
    const random = seededRandom(seed);
    const chosen = SITE_REGIONS.map((region) => ({ ...region[Math.floor(random() * region.length)] }));
    for (let i = chosen.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
    }
    return Object.fromEntries(SITE_IDS.map((id, index) => [id, chosen[index]]));
  }

  function normalizeSitePositions(layout) {
    if (!layout || typeof layout !== "object") return null;
    const valid = SITE_IDS.every((id) => {
      const point = layout[id];
      return point && Number.isFinite(point.x) && Number.isFinite(point.z) &&
        Math.abs(point.x) <= WORLD_LIMIT - 1 && Math.abs(point.z) <= WORLD_LIMIT - 1;
    });
    return valid ? cloneSitePositions(layout) : null;
  }

  function freshState() {
    const next = E.createState();
    next.explorer = { x: 0, z: 11.4, yaw: Math.PI, pitch: 0 };
    next.layoutSeed = randomSeed();
    next.sitePositions = createSitePositions(next.layoutSeed);
    return next;
  }

  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE));
      if (!value || !value.phase) return null;
      if (!value.explorer) value.explorer = { x: 0, z: 11.4, yaw: Math.PI, pitch: 0 };
      if (!Number.isFinite(value.explorer.pitch)) value.explorer.pitch = 0;
      if (!Number.isFinite(value.layoutSeed)) value.layoutSeed = randomSeed();
      value.sitePositions = normalizeSitePositions(value.sitePositions) || createSitePositions(value.layoutSeed);
      value.knowledge = Array.isArray(value.knowledge) ? value.knowledge : [];
      value.identifications = value.identifications && typeof value.identifications === "object" ? value.identifications : {};
      value.identificationDraft = value.identificationDraft || { speciesGuess: null };
      value.basketRecords = Array.isArray(value.basketRecords) ? value.basketRecords : [];
      value.collectedPotatoes = Array.isArray(value.collectedPotatoes) ? value.collectedPotatoes : [];
      value.soupIdentifications = Array.isArray(value.soupIdentifications) ? value.soupIdentifications : [];
      return value;
    } catch (_) {
      return null;
    }
  }

  function save() {
    if (state) localStorage.setItem(STORAGE, JSON.stringify(state));
  }

  function set(next) {
    const previousLayout = state?.sitePositions;
    if (!Number.isFinite(next.layoutSeed)) next.layoutSeed = state?.layoutSeed || randomSeed();
    next.sitePositions = normalizeSitePositions(next.sitePositions) ||
      normalizeSitePositions(previousLayout) ||
      createSitePositions(next.layoutSeed);
    const layoutChanged = !world || JSON.stringify(previousLayout) !== JSON.stringify(next.sitePositions);
    state = next;
    if (layoutChanged) {
      sitePositions = cloneSitePositions(state.sitePositions);
      world = makeWorld(sitePositions);
    }
    selected = [];
    soupChoices = {};
    save();
    render();
  }

  function start() {
    set(freshState());
  }

  function render() {
    stopScene();
    if (!state) return renderTitle();
    if (state.phase === "ending") return renderEnding();
    app.innerHTML = `${header()}<div class="shell">${mainPanel()}${sidePanel()}</div>${state.error ? `<div class="toast" role="status">${esc(state.error)}</div>` : ""}`;
    bind();
    if (state.phase === "forest" && !state.current) startScene();
  }

  function renderTitle() {
    app.innerHTML = `
      <section class="title-screen">
        <div class="moon" aria-hidden="true"></div>
        <p class="eyebrow">Lýra · pracovní v2-21</p>
        <h1>Klobouky<br><span>a hlízy</span></h1>
        <p class="lede">Houba se nepředstaví sama. Druh můžeš určit, vyhledat v lexikonu, nebo risknout nejistotu. O jedlosti rozhodneš až večer u hrnce; brambory musíš v lese najít zvlášť.</p>
        <button class="primary big" data-start>Vstoupit do lesa</button>
        <div class="title-help">
          <span><b>WASD</b> chůze</span><span><b>myš</b> rozhlížení</span><span><b>Shift</b> běh</span><span><b>E</b> prozkoumat</span>
        </div>
        <p class="small">Na telefonu použij tlačítka pod výhledem. Postup této pracovní verze se ukládá jen v tomto prohlížeči.</p>
      </section>`;
    bind();
  }

  function header() {
    return `
      <header class="game-header">
        <div><p class="eyebrow">Klobouky a hlízy · v2-21</p><h2>${phaseName()}</h2></div>
        ${state.phase === "forest" ? "" : `<div class="meters" aria-label="Stav postavy">
          <span title="Čas">🕰 ${E.clock(state.hour)}</span>
          <span title="Hlad">🥣 ${state.hunger}/10</span>
          <span title="Soustředění">✦ ${state.focus}</span>
          <span title="Nálezy">🧺 ${state.basket.length + state.potatoes}</span>
        </div>`}
      </header>`;
  }

  function mainPanel() {
    if (state.phase === "forest") return state.current ? findPanel() : forestPanel();
    if (state.phase === "sorting") return sortingPanel();
    if (state.phase === "evening-order") return orderPanel();
    if (state.phase === "soup" || state.phase === "potion") return cookingPanel(state.phase);
    return "";
  }

  function forestPanel() {
    return `
      <main class="card main-card forest-card">
        <div class="section-head">
          <div><p class="kicker">Les · ${state.visited.length}/5 míst</p><h3>${state.visited.length === E.SITES.length ? "Košík je plný, ale les ještě ne" : "Najdi, co porost schovává"}</h3></div>
        </div>
        <p class="muted forest-copy">Barva pomůže, ale nestačí. Houby se krčí v porostu; brambory rostou s natí na kraji lesa nebo leží pohozené pod křovím. Přibliž se, zamiř středem výhledu a použij E.</p>
        <div class="forest-view" id="forest-view">
          <canvas id="forest-canvas" width="1280" height="720" tabindex="0" aria-label="Les z pohledu první osoby. Kliknutím aktivuješ ovládání myší."></canvas>
          <div class="crosshair" aria-hidden="true"><i></i><i></i></div>
          <div class="forest-hud" aria-label="Stav postavy">
            <span id="compass" title="Směr">S</span>
            <div class="forest-meters">
              <span title="Čas">🕰 ${E.clock(state.hour)}</span>
              <span title="Hlad">🥣 ${state.hunger}/10</span>
              <span title="Soustředění">✦ ${state.focus}</span>
              <span title="Košík">🧺 ${state.basket.length + state.potatoes}</span>
            </div>
          </div>
          <div class="forest-actions">
            ${state.bread ? `<button class="forest-action" data-action="bread">🥖 Sníst chleba</button>` : ""}
            ${state.visited.length === E.SITES.length ? `<button class="forest-action home" data-action="home">Jít domů →</button>` : ""}
          </div>
          <div class="release-hint" id="release-hint" hidden>Pravé tlačítko nebo Esc · uvolnit myš</div>
          <button class="forest-prompt" id="forest-prompt" data-action="inspect" hidden>Prozkoumat nález <b>E</b></button>
          <div class="look-hint" id="look-hint"><b>Klikni do lesa</b><span>myš · rozhlížení i bez pointer locku &nbsp; pravé tlačítko · uvolnit myš</span></div>
        </div>
        <div class="touch-controls" aria-label="Ovládání lesa">
          <div class="turn-controls"><button data-step="turn-left" aria-label="Otočit doleva">↶</button><button data-step="forward" aria-label="Jít dopředu">▲</button><button data-step="turn-right" aria-label="Otočit doprava">↷</button></div>
          <div class="move-controls"><button data-step="left" aria-label="Úkrok doleva">◀</button><button data-step="back" aria-label="Jít dozadu">▼</button><button data-step="right" aria-label="Úkrok doprava">▶</button></div>
        </div>
        <p class="forest-tip">${state.visited.length === E.SITES.length ? "Všechny houby máš. Můžeš dál hledat vzácné brambory, nebo se vrátit domů." : "Houby jsou malé. U kraje hledej nať; v křoví zase hnědou hlízu mezi listím a šiškami."}</p>
      </main>`;
  }

  function findPanel() {
    const site = E.getSite(state.current);
    const species = E.getSpecies(site.species);
    const compared = state.compared.includes(site.id);
    const known = state.knowledge.some((entry) => entry.type === "mushroom" && entry.species === species.id);
    const draft = state.identificationDraft || { speciesGuess: null };
    const options = E.identificationOptions(species.id);
    const optionButtons = options.map((id) => {
      const option = E.getSpecies(id);
      const active = draft.speciesGuess === id;
      return `<button class="id-choice${active ? " selected" : ""}" data-species="${esc(id)}" aria-pressed="${active}">${esc(option.name)}</button>`;
    }).join("");
    return `
      <main class="card main-card find-card">
        <p class="kicker">${esc(site.name)}</p>
        <div class="specimen specimen-${species.id}" aria-hidden="true"><span class="specimen-cap"></span><span class="specimen-stem"></span></div>
        <h3>Neznámá houba</h3>
        <p class="intro">${esc(site.intro)}</p>
        <ul class="clues">${species.clues.map((clue) => `<li>${esc(clue)}</li>`).join("")}</ul>

        <section class="identification-box" aria-label="Určení nálezu">
          <div class="id-step">
            <p><b>Který druh?</b> <span>nepovinné · bez odpovědi −1 soustředění</span></p>
            <div class="id-grid species-options">${optionButtons}</div>
            <button class="quiet tiny" data-species="">Druh neurčuji</button>
          </div>
        </section>

        ${compared
          ? `<div class="atlas"><b>${known ? "Paměť" : "Lexikon"}:</b> ${esc(species.atlas)}</div>`
          : `<button class="secondary atlas-button" data-action="compare">${known ? "Vybavit si z paměti · zdarma" : "Vyhledat v lexikonu · −2 soustředění"}</button>`}
        <p class="muted">Jedlost teď neurčuješ. Rozhodnutí přijde až večer při vaření polévky.</p>
        <div class="choice-row">
          <button class="primary" data-resolve="all">Vzít houbu</button>
          <button class="quiet" data-resolve="leave">Nechat v lese</button>
        </div>
      </main>`;
  }


  function sortingPanel() {
    const items = state.basket.map((id, index) => {
      const species = E.getSpecies(id);
      const record = state.basketRecords?.[index];
      const guessed = record?.speciesGuess ? E.getSpecies(record.speciesGuess) : null;
      const label = guessed?.name || "Neurčená houba";
      const guess = soupChoices[index] || "";
      return `<div class="ingredient soup-ingredient">
        <span class="ingredient-mark specimen-mini specimen-${species.id}"></span>
        <span><b>${esc(label)}</b><small>Rozhodni podle vzhledu, paměti a lexikonu.</small></span>
        <span class="soup-verdicts">
          <button type="button" class="id-choice${guess === "edible" ? " selected" : ""}" data-soup-index="${index}" data-soup-guess="edible" aria-pressed="${guess === "edible"}">Jedlá · k polévce</button>
          <button type="button" class="id-choice${guess === "inedible" ? " selected" : ""}" data-soup-index="${index}" data-soup-guess="inedible" aria-pressed="${guess === "inedible"}">Nejedlá · stranou</button>
        </span>
      </div>`;
    }).join("");
    return `
      <main class="card main-card cooking-card sorting-card">
        <p class="kicker">Večer · třídění</p>
        <h3>Rozděl košík dřív, než zapálíš kamna</h3>
        <p>Označ každou houbu jako jedlou nebo nejedlou. Do polévky se později nabídnou jen ty, které teď považuješ za jedlé; skutečný druh zůstává skrytý.</p>
        <div class="ingredients">${items || `<p class="empty">Košík je prázdný.</p>`}</div>
        <div class="choice-row"><button class="primary" data-confirm-sorting>Potvrdit třídění</button></div>
      </main>`;
  }

  function orderPanel() {
    return `
      <main class="card main-card evening-card">
        <p class="kicker">Večer · chata</p>
        <h3>Hlad se posadil ke stolu dřív než ty</h3>
        <p>Pořadí rozhoduje. Najíst se první může vrátit soustředění; lektvar vařený nalačno se může rozpadnout i ze správných surovin.</p>
        <div class="order-grid">
          <button class="order-card" data-order="soup-first"><span>🥣</span><b>Nejdřív polévku</b><small>Ztišit hlad, potom kouzlit.</small></button>
          <button class="order-card" data-order="potion-first"><span>🧪</span><b>Nejdřív lektvar</b><small>Risknout přesnost, dokud je světlo.</small></button>
        </div>
      </main>`;
  }

  function cookingPanel(kind) {
    const potion = kind === "potion";
    const sorted = Array.isArray(state.soupIdentifications) ? state.soupIdentifications : [];
    const items = state.basket.map((id, index) => {
      const species = E.getSpecies(id);
      const record = state.basketRecords?.[index];
      const guessed = record?.speciesGuess ? E.getSpecies(record.speciesGuess) : null;
      const label = guessed?.name || "Neurčená houba";
      if (potion) {
        const checked = selected.includes(index) ? " checked" : "";
        return `<label class="ingredient"><input type="checkbox" data-ingredient="${index}"${checked}><span class="ingredient-mark specimen-mini specimen-${species.id}"></span><span><b>${esc(label)}</b><small>vyber dvě houby pro lektvar</small></span></label>`;
      }
      const decision = sorted.find((entry) => entry.site === record?.site);
      if (decision?.guess !== "edible") return "";
      return `<div class="ingredient soup-ingredient ready">
        <span class="ingredient-mark specimen-mini specimen-${species.id}"></span>
        <span><b>${esc(label)}</b><small>při třídění označená jako jedlá · půjde do hrnce</small></span>
      </div>`;
    }).join("");
    return `
      <main class="card main-card cooking-card">
        <p class="kicker">${potion ? "Lektvar" : "Polévka"}</p>
        <h3>${potion ? "Dvě houby a přesný rytmus" : "Do hrnce jen z jedlé hromádky"}</h3>
        <p>${potion ? `Aktuální schopnost vařit: <b>${E.cookingAbility(state)}</b>. Lektvar potřebuje právě dvě houby.` : `Brambory v zásobě: <b>${state.potatoes}</b>. Nejedlé houby se tu už nenabízejí; brambory se přidají automaticky.`}</p>
        <div class="ingredients">${items || `<p class="empty">${potion ? "Košík je prázdný." : "Žádnou houbu jsi nezařadila mezi jedlé. Brambory můžeš uvařit samotné."}</p>`}</div>
        <div class="choice-row">
          <button class="primary" data-cook="${kind}">${potion ? "Uvařit lektvar" : "Uvařit polévku"}</button>
          <button class="quiet" data-skip="${kind}">Vynechat</button>
        </div>
      </main>`;
  }

  function sidePanel() {
    const basket = state.basket.map((id, index) => {
      const record = state.basketRecords?.[index];
      const guessed = record?.speciesGuess ? E.getSpecies(record.speciesGuess) : null;
      const name = guessed?.name || "Neurčená houba";
      const sorted = state.soupIdentifications?.find((entry) => entry.site === record?.site);
      const verdict = sorted ? (sorted.guess === "edible" ? "jedlá · k polévce" : "nejedlá · stranou") : "jedlost zatím neurčená";
      return `<li>${esc(name)} <small>${verdict}</small></li>`;
    }).join("");
    const knowledge = state.knowledge.map((entry) =>
      `<li><b>${esc(entry.title)}</b><span>${esc(entry.text)}</span></li>`
    ).join("");
    return `
      <aside class="card side-card">
        <section><p class="kicker">Košík</p><ul class="basket-list">${basket || `<li class="muted">zatím prázdný</li>`}${state.potatoes ? `<li>Brambory × ${state.potatoes}</li>` : ""}</ul></section>
        <section><p class="kicker">Paměť · ${state.knowledge.length}/${E.MEMORY_LIMIT}</p><ul class="memory-list">${knowledge || `<li class="muted">zatím bez znalostí</li>`}</ul></section>
        <section><p class="kicker">Zápisník</p><ol class="notes">${state.notes.slice(0, 7).map((note) => `<li>${esc(note)}</li>`).join("")}</ol></section>
      </aside>`;
  }

  function renderEnding() {
    stopScene();
    const soup = state.soup || { title: "Bez polévky", text: "Hrnec zůstal stranou.", tone: "plain" };
    const potion = state.potion || { title: "Bez lektvaru", text: "Lahvička zůstala prázdná.", tone: "plain" };
    const title = soup.ok && potion.ok ? "Teplo dole, světlo nahoře" : soup.ok ? "Brambora zachránila večer" : potion.ok ? "Kouzlo nalačno" : "Les si nechal poslední slovo";
    app.innerHTML = `
      <section class="ending">
        <p class="eyebrow">Konec dne</p><h1>${esc(title)}</h1>
        <div class="ending-grid">
          <article class="result ${esc(soup.tone)}"><span>🥣</span><h3>${esc(soup.title)}</h3><p>${esc(soup.text)}</p></article>
          <article class="result ${esc(potion.tone)}"><span>🧪</span><h3>${esc(potion.title)}</h3><p>${esc(potion.text)}</p></article>
        </div>
        <p class="ending-note">V lese jsi prozkoumala ${state.visited.length} míst. Došla jsi s hladem ${state.hunger}/10 a soustředěním ${state.focus}.</p>
        <button class="primary big" data-restart>Jít znovu, jinou stopou</button>
      </section>`;
    bind();
  }

  function bind() {
    document.querySelectorAll("[data-start],[data-restart]").forEach((button) => button.addEventListener("click", start));
    document.querySelector('[data-action="bread"]')?.addEventListener("click", () => set(E.eatBread(state)));
    document.querySelector('[data-action="home"]')?.addEventListener("click", () => set(E.goHome(state)));
    document.querySelector('[data-action="compare"]')?.addEventListener("click", () => set(E.compare(state)));
    document.querySelectorAll("[data-species]").forEach((button) => button.addEventListener("click", () => set(E.setIdentification(state, "species", button.dataset.species))));
    document.querySelectorAll("[data-resolve]").forEach((button) => button.addEventListener("click", () => {
      const next = E.resolve(state, button.dataset.resolve);
      const returnsToForest = next.phase === "forest" && !next.current;
      set(next);
      if (returnsToForest) scene?.requestLook?.();
    }));
    document.querySelectorAll("[data-order]").forEach((button) => button.addEventListener("click", () => set(E.chooseOrder(state, button.dataset.order))));
    document.querySelector("[data-confirm-sorting]")?.addEventListener("click", () => {
      const decisions = state.basket.map((_, index) => ({ index, guess: soupChoices[index] }));
      set(E.sortMushrooms(state, decisions));
    });
    document.querySelectorAll("[data-ingredient]").forEach((input) => input.addEventListener("change", () => {
      const index = Number(input.dataset.ingredient);
      selected = input.checked ? [...selected, index] : selected.filter((item) => item !== index);
    }));
    document.querySelectorAll("[data-soup-index]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.soupIndex);
      soupChoices[index] = button.dataset.soupGuess;
      document.querySelectorAll(`[data-soup-index="${index}"]`).forEach((choice) => {
        const active = choice.dataset.soupGuess === soupChoices[index];
        choice.classList.toggle("selected", active);
        choice.setAttribute("aria-pressed", String(active));
      });
    }));
    document.querySelectorAll("[data-cook]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.cook === "soup") {
        set(E.cookSoup(state));
      } else {
        const ingredients = selected.map((index) => state.basket[index]).filter(Boolean);
        set(E.brewPotion(state, ingredients));
      }
    }));
    document.querySelectorAll("[data-skip]").forEach((button) => button.addEventListener("click", () => set(button.dataset.skip === "soup" ? E.skipSoup(state) : E.skipPotion(state))));
  }

  function requestForestPointerLock() {
    const canvas = document.getElementById("forest-canvas");
    if (!canvas) return;
    canvas.focus();
    if (!canvas.requestPointerLock) return;
    const pendingLock = canvas.requestPointerLock();
    if (pendingLock?.catch) pendingLock.catch(() => {});
  }

  function startScene() {
    const canvas = document.getElementById("forest-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const prompt = document.getElementById("forest-prompt");
    const lookHint = document.getElementById("look-hint");
    const releaseHint = document.getElementById("release-hint");
    const forestView = document.getElementById("forest-view");
    const compass = document.getElementById("compass");
    const keys = new Set();
    let last = performance.now();
    let target = null;
    let dirtySave = false;
    let fallbackLook = false;
    let fallbackTimer = 0;
    let lastMouseX = null;
    let lastMouseY = null;

    scene = { canvas, keys, raf: 0, cleanups: [], stepPhase: 0, cameraBob: 0, cameraSway: 0, bump: null };

    const onKeyDown = (event) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
      keys.add(event.code);
      if (event.code === "KeyE") inspect();
    };
    const onKeyUp = (event) => keys.delete(event.code);
    const onMouseMove = (event) => {
      const locked = document.pointerLockElement === canvas;
      if (!locked && (!fallbackLook || event.target !== canvas)) return;
      const fallbackX = lastMouseX === null ? 0 : event.clientX - lastMouseX;
      const fallbackY = lastMouseY === null ? 0 : event.clientY - lastMouseY;
      const dx = locked ? event.movementX : (event.movementX || fallbackX);
      const dy = locked ? event.movementY : (event.movementY || fallbackY);
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      state.explorer.yaw = wrap(state.explorer.yaw + clamp(dx, -90, 90) * 0.00235);
      state.explorer.pitch = clamp(state.explorer.pitch - clamp(dy, -90, 90) * 0.00345, -1.38, 1.38);
      dirtySave = true;
    };
    const updateLookUi = () => {
      const active = document.pointerLockElement === canvas || fallbackLook;
      lookHint.hidden = active;
      releaseHint.hidden = !active;
      canvas.classList.toggle("locked", document.pointerLockElement === canvas);
      forestView.classList.toggle("mouse-active", active);
      if (active) canvas.focus();
    };
    const onLock = () => {
      const locked = document.pointerLockElement === canvas;
      if (locked) {
        window.clearTimeout(fallbackTimer);
        fallbackLook = false;
        lastMouseX = null;
        lastMouseY = null;
      }
      updateLookUi();
    };
    const requestLook = () => {
      fallbackLook = false;
      lastMouseX = null;
      lastMouseY = null;
      requestForestPointerLock();
      window.clearTimeout(fallbackTimer);
      fallbackTimer = window.setTimeout(() => {
        if (document.pointerLockElement !== canvas) {
          fallbackLook = true;
          updateLookUi();
        }
      }, 220);
    };
    scene.requestLook = requestLook;
    const releaseLook = (event) => {
      if (event.button !== 2 && event.type !== "contextmenu") return;
      event.preventDefault();
      window.clearTimeout(fallbackTimer);
      fallbackLook = false;
      lastMouseX = null;
      lastMouseY = null;
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      else updateLookUi();
    };
    const resetFallbackDelta = () => { lastMouseX = null; lastMouseY = null; };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onLock);
    canvas.addEventListener("click", requestLook);
    canvas.addEventListener("mousedown", releaseLook);
    canvas.addEventListener("contextmenu", releaseLook);
    canvas.addEventListener("mouseleave", resetFallbackDelta);
    prompt.addEventListener("click", inspect);
    scene.cleanups.push(() => window.clearTimeout(fallbackTimer), () => window.removeEventListener("keydown", onKeyDown), () => window.removeEventListener("keyup", onKeyUp), () => document.removeEventListener("mousemove", onMouseMove), () => document.removeEventListener("pointerlockchange", onLock), () => canvas.removeEventListener("click", requestLook), () => canvas.removeEventListener("mousedown", releaseLook), () => canvas.removeEventListener("contextmenu", releaseLook), () => canvas.removeEventListener("mouseleave", resetFallbackDelta), () => prompt.removeEventListener("click", inspect));

    document.querySelectorAll("[data-step]").forEach((button) => {
      const action = () => {
        const step = button.dataset.step;
        if (step === "turn-left") state.explorer.yaw = wrap(state.explorer.yaw - 0.28);
        else if (step === "turn-right") state.explorer.yaw = wrap(state.explorer.yaw + 0.28);
        else moveStep(step, 0.75);
        save();
      };
      button.addEventListener("click", action);
      scene.cleanups.push(() => button.removeEventListener("click", action));
    });

    function inspect() {
      if (!target) return;
      if (target.kind === "potato") {
        set(E.collectPotato(state, target.id, target.style));
        scene?.requestLook?.();
      } else {
        set(E.visit(state, target.id));
      }
    }

    function moveStep(direction, amount) {
      const yaw = state.explorer.yaw;
      let dx = 0;
      let dz = 0;
      if (direction === "forward") { dx = Math.sin(yaw) * amount; dz = Math.cos(yaw) * amount; }
      if (direction === "back") { dx = -Math.sin(yaw) * amount; dz = -Math.cos(yaw) * amount; }
      if (direction === "left") { dx = -Math.cos(yaw) * amount; dz = Math.sin(yaw) * amount; }
      if (direction === "right") { dx = Math.cos(yaw) * amount; dz = -Math.sin(yaw) * amount; }
      tryMove(dx, dz);
    }

    function tryMove(dx, dz) {
      const p = state.explorer;
      const nx = clamp(p.x + dx, -WORLD_LIMIT, WORLD_LIMIT);
      const nz = clamp(p.z + dz, -WORLD_LIMIT, WORLD_LIMIT);
      const blocker = world.trees.find((tree) => distance(nx, nz, tree.x, tree.z) < tree.radius + 0.32);
      if (blocker) {
        const side = (blocker.x - p.x) * Math.cos(p.yaw) - (blocker.z - p.z) * Math.sin(p.yaw);
        scene.bump = { side: side < 0 ? "left" : "right", until: performance.now() + SCRATCH_LINGER_MS };
        return;
      }
      p.x = nx;
      p.z = nz;
      dirtySave = true;
    }

    function frame(now) {
      if (!scene || scene.canvas !== canvas) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = state.explorer;
      const turn = (keys.has("ArrowLeft") || keys.has("KeyQ") ? -1 : 0) + (keys.has("ArrowRight") || keys.has("KeyR") ? 1 : 0);
      if (turn) { p.yaw = wrap(p.yaw + turn * dt * 1.8); dirtySave = true; }
      const forward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
      const strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      if (forward || strafe) {
        const length = Math.max(1, Math.hypot(forward, strafe));
        const running = keys.has("ShiftLeft") || keys.has("ShiftRight");
        const speed = dt * (running ? 5.15 : 3.05) / length;
        const dx = (Math.sin(p.yaw) * forward + Math.cos(p.yaw) * strafe) * speed;
        const dz = (Math.cos(p.yaw) * forward - Math.sin(p.yaw) * strafe) * speed;
        tryMove(dx, dz);
        scene.stepPhase += dt * (running ? 10.5 : 7.2);
        scene.cameraBob += (Math.sin(scene.stepPhase * 2) * 0.028 - scene.cameraBob) * Math.min(1, dt * 13);
        scene.cameraSway += (Math.sin(scene.stepPhase) * 0.012 - scene.cameraSway) * Math.min(1, dt * 10);
      } else {
        scene.cameraBob += (0 - scene.cameraBob) * Math.min(1, dt * 10);
        scene.cameraSway += (0 - scene.cameraSway) * Math.min(1, dt * 10);
      }
      target = nearestTarget();
      prompt.hidden = !target;
      if (target) prompt.firstChild.textContent = target.kind === "potato" ? "Sebrat bramboru " : "Prozkoumat houbu ";
      compass.textContent = compassName(p.yaw);
      drawForest(ctx, canvas, target, now, scene.cameraBob, scene.cameraSway);
      if (dirtySave && Math.floor(now / 1000) !== Math.floor((now - dt * 1000) / 1000)) { save(); dirtySave = false; }
      scene.raf = requestAnimationFrame(frame);
    }

    function nearestTarget() {
      const p = state.explorer;
      let best = null;
      E.SITES.forEach((site) => {
        if (state.visited.includes(site.id)) return;
        const pos = sitePositions[site.id];
        const d = distance(p.x, p.z, pos.x, pos.z);
        const angle = Math.abs(angleDiff(Math.atan2(pos.x - p.x, pos.z - p.z), p.yaw));
        if (d < 1.85 && angle < 0.7 && (!best || d < best.distance)) {
          best = { kind: "mushroom", ...site, distance: d };
        }
      });
      world.potatoes.forEach((potato) => {
        if (state.collectedPotatoes?.includes(potato.id)) return;
        const d = distance(p.x, p.z, potato.x, potato.z);
        const angle = Math.abs(angleDiff(Math.atan2(potato.x - p.x, potato.z - p.z), p.yaw));
        if (d < 1.45 && angle < 0.72 && (!best || d < best.distance)) {
          best = { kind: "potato", ...potato, distance: d };
        }
      });
      return best;
    }

    scene.raf = requestAnimationFrame(frame);
  }

  function stopScene() {
    if (!scene) return;
    if (document.pointerLockElement === scene.canvas) document.exitPointerLock?.();
    cancelAnimationFrame(scene.raf);
    scene.cleanups.forEach((cleanup) => cleanup());
    scene = null;
  }

  function drawForest(ctx, canvas, target, now, cameraBob, cameraSway) {
    const width = canvas.width;
    const height = canvas.height;
    const pitch = state.explorer.pitch || 0;
    const verticalLook = height * VERTICAL_LOOK;
    const horizon = clamp(height * 0.455 + pitch * verticalLook, height * -0.62, height * 1.62);
    const cameraHeight = 1.62;

    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizon, 1));
    sky.addColorStop(0, "#597b78");
    sky.addColorStop(0.52, "#9ab19b");
    sky.addColorStop(1, "#d9ca9f");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, Math.max(horizon, 0));
    drawSkyLight(ctx, width, height, horizon, now);
    drawDistantForest(ctx, width, height, horizon);

    const ground = ctx.createLinearGradient(0, horizon, 0, height);
    ground.addColorStop(0, "#59624a");
    ground.addColorStop(0.42, "#33442f");
    ground.addColorStop(1, "#102019");
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, width, height - horizon);
    drawGroundTexture(ctx, width, height, cameraHeight, cameraSway);

    const objects = [];
    world.trees.forEach((item) => pushProjected(objects, item, "tree", width, height, cameraHeight, cameraSway));
    world.ferns.forEach((item) => pushProjected(objects, item, item.kind, width, height, cameraHeight, cameraSway));
    world.bushes.forEach((item) => pushProjected(objects, item, "bush", width, height, cameraHeight, cameraSway));
    world.ground.forEach((item) => pushProjected(objects, item, item.kind, width, height, cameraHeight, cameraSway));
    world.potatoes.forEach((item) => {
      if (!state.collectedPotatoes?.includes(item.id)) {
        pushProjected(objects, item, item.style === "plant" ? "potatoPlant" : "potatoLoose", width, height, cameraHeight, cameraSway);
      }
    });
    E.SITES.forEach((site) => {
      if (state.visited.includes(site.id)) return;
      const pos = sitePositions[site.id];
      pushProjected(objects, { ...pos, site, height: mushroomHeight(site.species) }, "mushroom", width, height, cameraHeight, cameraSway);
    });
    const targetObject = target ? objects.find((object) => {
      if (target.kind === "mushroom") return object.kind === "mushroom" && object.item.site.id === target.id;
      if (target.kind === "potato") return (object.kind === "potatoPlant" || object.kind === "potatoLoose") && object.item.id === target.id;
      return false;
    }) : null;
    objects.sort((a, b) => b.depth - a.depth);
    // Pět vrstev se vkládá mezi vzdálenostní pásy. Nejvzdálenější objekty
    // překryje všech pět, nejbližší žádná; nejde tedy o průhlednost objektů,
    // ale o skutečnou atmosférickou vrstvu mezi nimi a pozorovatelem.
    const mistBands = [
      { depth: 22, alpha: 0.24, top: 0.105 },
      { depth: 13, alpha: 0.16, top: 0.07 },
      { depth: 9, alpha: 0.11, top: 0.035 },
      { depth: 6, alpha: 0.075, top: 0.0 },
      { depth: 3.7, alpha: 0.045, top: -0.035 }
    ];
    let distanceFogBand = 0;
    objects.forEach((object) => {
      while (distanceFogBand < mistBands.length && object.depth < mistBands[distanceFogBand].depth) {
        drawDistanceMist(ctx, width, height, horizon, mistBands[distanceFogBand].alpha, mistBands[distanceFogBand].top);
        distanceFogBand += 1;
      }
      if (object.kind === "tree") drawTree(ctx, object);
      else if (object.kind === "mushroom") drawMushroom(ctx, object, false);
      else if (object.kind === "rock") drawRock(ctx, object);
      else if (object.kind === "leaf") drawLeaf(ctx, object);
      else if (object.kind === "cone") drawPinecone(ctx, object);
      else if (object.kind === "potatoPlant" || object.kind === "potatoLoose") {
        drawPotato(ctx, object, false);
      } else drawFoliage(ctx, object);
    });

    const vignette = ctx.createRadialGradient(width / 2, height * 0.48, height * 0.12, width / 2, height * 0.5, width * 0.72);
    vignette.addColorStop(0, "rgba(4,12,8,0)");
    vignette.addColorStop(0.72, "rgba(4,12,8,.03)");
    vignette.addColorStop(1, "rgba(4,12,8,.48)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // Původní nález zůstává na své světové kotvě. Vedle tlačítka se kreslí
    // druhý, plný exemplář, aby byl čitelný klobouk i noha bez zakrytí lesa.
    if (targetObject) drawTargetPromptPreview(ctx, targetObject, width, height);
    drawCollisionScratch(ctx, width, height, now);
  }

  function drawTargetPromptPreview(ctx, object, width, height) {
    // Tlačítko je uprostřed dole; náhled stojí vlevo vedle něj a nepřekrývá
    // ani tlačítko, ani původní nález ve světě.
    const x = clamp(width / 2 - Math.min(width * 0.2, 245), 92, width - 92);
    const y = height - 28;
    if (object.kind === "mushroom") {
      const previewHeight = clamp(height * 0.19, 118, 148);
      drawMushroom(ctx, {
        ...object,
        x,
        y,
        scale: previewHeight / Math.max(object.item.height, 0.01),
        fog: 1
      }, true);
      return;
    }
    const previewHeight = clamp(height * 0.145, 92, 118);
    drawPotato(ctx, {
      ...object,
      x,
      y,
      scale: previewHeight / Math.max(object.item.height, 0.01),
      fog: 1
    }, true);
  }

  function drawDistanceMist(ctx, width, height, horizon, alpha, centerOffset) {
    // Mlha je omezená na průsvitný vodorovný pás: nezesvětluje celou podlahu
    // a mezi vzdálenostmi zůstávají rozeznatelné jednotlivé prostorové vrstvy.
    const center = clamp(horizon + height * centerOffset, height * 0.08, height * 0.88);
    const bandHeight = height * 0.19;
    const top = center - bandHeight * 0.48;
    const bottom = center + bandHeight * 0.52;
    const mist = ctx.createLinearGradient(0, top, 0, bottom);
    mist.addColorStop(0, "rgba(222,225,202,0)");
    mist.addColorStop(0.26, `rgba(222,225,202,${alpha * 0.46})`);
    mist.addColorStop(0.52, `rgba(224,226,201,${alpha})`);
    mist.addColorStop(0.76, `rgba(202,214,193,${alpha * 0.5})`);
    mist.addColorStop(1, "rgba(194,207,188,0)");
    ctx.save();
    ctx.fillStyle = mist;
    ctx.fillRect(0, top, width, bandHeight);

    // Dvě široké, lehce posunuté mlžné vlečky ruší dojem jednolité šedé desky.
    ctx.globalAlpha = alpha * 0.34;
    ctx.fillStyle = "#e0e2c9";
    ctx.beginPath();
    ctx.ellipse(width * 0.28, center - bandHeight * 0.04, width * 0.34, bandHeight * 0.16, -0.025, 0, TAU);
    ctx.ellipse(width * 0.76, center + bandHeight * 0.08, width * 0.31, bandHeight * 0.14, 0.03, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawCollisionScratch(ctx, width, height, now) {
    const bump = scene?.bump;
    if (!bump || now >= bump.until) return;
    const remaining = clamp((bump.until - now) / SCRATCH_LINGER_MS, 0, 1);
    const left = bump.side === "left";
    const edge = left ? width * 0.015 : width * 0.985;
    const inward = left ? 1 : -1;
    ctx.save();
    ctx.globalAlpha = remaining > 0.62 ? 0.9 : Math.pow(remaining / 0.62, 0.68) * 0.9;
    ctx.strokeStyle = "#d8b786";
    ctx.lineWidth = Math.max(3, width * 0.004);
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i += 1) {
      const y = height * (0.43 + i * 0.07);
      ctx.beginPath();
      ctx.moveTo(edge, y - height * 0.035);
      ctx.lineTo(edge + inward * width * (0.035 + i * 0.008), y);
      ctx.lineTo(edge + inward * width * (0.012 + i * 0.004), y + height * 0.045);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSkyLight(ctx, width, height, horizon, now) {
    const glowX = width * (0.73 + Math.sin(state.explorer.yaw * 0.5) * 0.06);
    const glowY = Math.max(38, horizon * 0.28);
    const glow = ctx.createRadialGradient(glowX, glowY, 2, glowX, glowY, height * 0.48);
    glow.addColorStop(0, "rgba(255,244,190,.58)");
    glow.addColorStop(0.24, "rgba(247,226,169,.16)");
    glow.addColorStop(1, "rgba(255,238,188,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, Math.max(horizon, 0));
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.055 + Math.sin(now * 0.00025) * 0.012;
    ctx.fillStyle = "#f4ddb0";
    for (let i = 0; i < 4; i += 1) {
      const x = width * (0.54 + i * 0.075);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + width * 0.19, height);
      ctx.lineTo(x + width * 0.29, height);
      ctx.lineTo(x + width * 0.035, 0);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDistantForest(ctx, width, height, horizon) {
    const yawShift = state.explorer.yaw * 47;
    const layers = [
      { color: "rgba(48,70,55,.43)", base: 0.06, size: 0.18 },
      { color: "rgba(31,55,42,.66)", base: 0.035, size: 0.25 }
    ];
    layers.forEach((layer, layerIndex) => {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(0, horizon + height * layer.base);
      for (let i = -1; i <= 22; i += 1) {
        const x = i / 21 * width;
        const wave = Math.sin(i * 2.17 + yawShift * 0.015 + layerIndex) * 0.03;
        const crownY = horizon - height * (layer.size + wave + ((i * 7) % 5) * 0.012);
        ctx.lineTo(x, horizon + height * layer.base);
        ctx.lineTo(x + width / 42, crownY);
        ctx.lineTo(x + width / 21, horizon + height * layer.base);
      }
      ctx.lineTo(width, horizon + height * 0.12);
      ctx.lineTo(0, horizon + height * 0.12);
      ctx.fill();
    });
  }

  function projectionFocal(width) {
    return width / (2 * Math.tan(FOV / 2));
  }

  function projectWorldPoint(worldX, worldZ, worldY, width, height, cameraHeight, cameraSway = 0) {
    const p = state.explorer;
    const dx = worldX - p.x;
    const dz = worldZ - p.z;
    const lateral = dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw);
    const forward = dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw);
    if (forward <= 0.08) return null;

    const focal = projectionFocal(width);
    const distance = Math.hypot(dx, dz);
    const viewAngle = Math.atan2(lateral, forward);
    const pitchOffset = (p.pitch || 0) * height * VERTICAL_LOOK;

    // Válcová vodorovná projekce: kraj obrazu je další úhel na oblouku kolem
    // pozorovatele, ne vzdálenější bod na plochém skle. Při otáčení se proto
    // všechny objekty posouvají stejnou úhlovou rychlostí a nepředbíhají se.
    // Výška i měřítko používají radiální vzdálenost, takže se krajní objekt
    // při pouhém rozhlížení nezvětšuje ani neposouvá po zemi.
    return {
      x: width / 2 + viewAngle * (width / FOV),
      y: height * 0.455 + pitchOffset - (worldY - cameraHeight) / distance * focal,
      depth: distance,
      forward,
      lateral,
      distance,
      viewAngle,
      focal
    };
  }

  function pushProjected(list, item, kind, width, height, cameraHeight, cameraSway) {
    const base = projectWorldPoint(item.x, item.z, 0, width, height, cameraHeight, cameraSway);
    if (!base || base.distance > 31) return;

    // Paty i velikost používají tutéž radiální vzdálenost. Při chůzi k
    // objektu se zvětší, při samotném otočení zůstane beze změny.
    const scale = base.focal / Math.max(base.distance, 0.12);
    const maxWidth = (kind === "tree" ? 2.5 : kind === "mushroom" ? 1.3 : kind === "bush" ? 3.8 : kind === "denseFern" ? 2.8 : 2) * scale;
    if (base.x < -maxWidth || base.x > width + maxWidth) return;
    list.push({
      item,
      kind,
      depth: base.depth,
      distance: base.distance,
      x: base.x,
      y: base.y,
      scale,
      fog: 1
    });
  }

  function drawGroundTexture(ctx, width, height, cameraHeight, cameraSway) {
    const drawLine = (fixed, alongX) => {
      let drawing = false;
      ctx.beginPath();
      for (let step = -56; step <= 56; step += 1) {
        const value = step * 0.25;
        const worldX = alongX ? value : fixed;
        const worldZ = alongX ? fixed : value;
        const point = projectWorldPoint(worldX, worldZ, 0, width, height, cameraHeight, cameraSway);
        const visible = point &&
          point.x > -width * 0.65 && point.x < width * 1.65 &&
          point.y > -height * 0.45 && point.y < height * 1.45;
        if (!visible) {
          drawing = false;
          continue;
        }
        if (!drawing) {
          ctx.moveTo(point.x, point.y);
          drawing = true;
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();
    };

    ctx.save();
    ctx.strokeStyle = "#d2bd7a";
    ctx.lineWidth = 1;
    for (let coordinate = -14; coordinate <= 14; coordinate += 2) {
      ctx.globalAlpha = coordinate % 4 === 0 ? 0.105 : 0.065;
      drawLine(coordinate, true);
      drawLine(coordinate, false);
    }
    ctx.restore();
  }

  function drawTree(ctx, object) {
    const { item, x, y, scale, fog } = object;
    const height = item.height * scale;
    const trunk = Math.max(4, item.radius * scale * 1.45);
    const top = y - height;
    ctx.save();
    ctx.globalAlpha = fog;
    const shadow = ctx.createRadialGradient(x, y, 0, x, y, Math.max(12, trunk * 2.1));
    shadow.addColorStop(0, "rgba(5,13,8,.48)");
    shadow.addColorStop(1, "rgba(5,13,8,0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(x, y + Math.min(8, scale * 0.05), trunk * 2.1, Math.max(3, trunk * 0.34), 0, 0, TAU);
    ctx.fill();

    const bark = ctx.createLinearGradient(x - trunk / 2, 0, x + trunk / 2, 0);
    if (item.birch) {
      bark.addColorStop(0, "#8b8d78"); bark.addColorStop(0.28, "#d8d4b8"); bark.addColorStop(0.68, "#eee6c8"); bark.addColorStop(1, "#777867");
    } else {
      bark.addColorStop(0, "#251a15"); bark.addColorStop(0.25, "#4a3124"); bark.addColorStop(0.63, item.warm ? "#76503a" : "#5d4230"); bark.addColorStop(1, "#291d18");
    }
    ctx.fillStyle = bark;
    ctx.beginPath();
    ctx.moveTo(x - trunk * 0.58, y);
    ctx.lineTo(x - trunk * 0.35, top);
    ctx.lineTo(x + trunk * 0.34, top);
    ctx.lineTo(x + trunk * 0.6, y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = item.birch ? "rgba(48,46,39,.62)" : "rgba(18,11,9,.46)";
    ctx.lineWidth = Math.max(1, trunk * 0.035);
    const barkLines = trunk > 26 ? 7 : 4;
    for (let i = 0; i < barkLines; i += 1) {
      const offset = ((i + 1) / (barkLines + 1) - 0.5) * trunk * 0.8;
      ctx.beginPath();
      if (item.birch) {
        const lineY = top + height * (0.16 + (i * 0.137 + item.seed * 0.01) % 0.72);
        ctx.moveTo(x - trunk * 0.38, lineY);
        ctx.quadraticCurveTo(x + offset * 0.2, lineY + trunk * 0.07, x + trunk * 0.3, lineY);
      } else {
        ctx.moveTo(x + offset, y);
        ctx.quadraticCurveTo(x + offset * 0.58, top + height * 0.56, x + offset * 0.45, top);
      }
      ctx.stroke();
    }

    ctx.fillStyle = item.birch ? "rgba(106,126,85,.82)" : "rgba(40,67,45,.92)";
    ctx.beginPath();
    ctx.moveTo(x - trunk * 0.55, y - trunk * 0.12); ctx.lineTo(x - trunk * 1.45, y + trunk * 0.16); ctx.lineTo(x - trunk * 0.1, y); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + trunk * 0.54, y - trunk * 0.12); ctx.lineTo(x + trunk * 1.35, y + trunk * 0.14); ctx.lineTo(x + trunk * 0.08, y); ctx.fill();

    const crown = scale * (item.birch ? 3.15 : 3.8);
    const crownY = top + crown * 0.12;
    const palette = item.birch ? ["#557650", "#66865a", "#789263"] : ["#1d3a2b", "#2b4b34", "#3d6040"];
    for (let i = 0; i < 9; i += 1) {
      const a = i * 2.19 + item.seed;
      const radius = crown * (0.25 + ((i * 17 + item.seed * 3) % 9) * 0.018);
      ctx.fillStyle = palette[(i + item.seed) % palette.length];
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * crown * 0.37, crownY + Math.sin(a) * crown * 0.22, radius * 1.18, radius * 0.72, a * 0.12, 0, TAU);
      ctx.fill();
    }
    if (item.birch) {
      ctx.globalAlpha = fog * 0.22;
      ctx.fillStyle = "#e4d896";
      ctx.beginPath(); ctx.ellipse(x - crown * 0.15, crownY - crown * 0.16, crown * 0.34, crown * 0.14, -0.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawFoliage(ctx, object) {
    const { item, x, y, scale, fog, kind } = object;
    const h = Math.max(2, item.height * scale);
    const widthFactor = kind === "bush" ? item.width || 1.25 : kind === "denseFern" ? item.width || 1.2 : kind === "fern" ? 0.85 : 0.55;
    const w = Math.max(2, h * widthFactor);
    ctx.save();
    const nearBushAlpha = kind === "bush"
      ? clamp((object.distance - 0.55) / 1.45, 0.62, 1)
      : 1;
    ctx.globalAlpha = fog * nearBushAlpha * (kind === "bush" ? 0.99 : 0.95);
    ctx.strokeStyle = item.color || "#4c7548";
    ctx.fillStyle = item.color || "#557a4c";
    ctx.lineWidth = Math.max(1, h * 0.022);

    if (kind === "bush") {
      const shadow = ctx.createRadialGradient(x, y, 0, x, y, w * 0.72);
      shadow.addColorStop(0, "rgba(5,18,10,.5)");
      shadow.addColorStop(1, "rgba(5,18,10,0)");
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.72, Math.max(3, h * 0.16), 0, 0, TAU);
      ctx.fill();
      const shades = item.light ? ["#264b32", "#3e6d42", "#5b834e"] : ["#1d3f2b", "#2b5535", "#416b3e"];
      const lobes = [
        [-0.42, -0.34, 0.34], [-0.18, -0.55, 0.39], [0.12, -0.58, 0.42],
        [0.4, -0.36, 0.34], [-0.5, -0.12, 0.3], [-0.06, -0.22, 0.46], [0.46, -0.1, 0.31]
      ];
      lobes.forEach(([ox, oy, size], index) => {
        const edgeLobe = index === 0 || index === 3 || index === 4 || index === 6;
        ctx.globalAlpha = fog * nearBushAlpha * (edgeLobe ? 0.74 : 0.98);
        ctx.fillStyle = shades[(index + (item.seed || 0)) % shades.length];
        ctx.beginPath();
        ctx.ellipse(x + ox * w, y + oy * h, w * size, h * size * 0.72, (index - 3) * 0.08, 0, TAU);
        ctx.fill();
      });
      ctx.globalAlpha = fog * nearBushAlpha * 0.48;
      ctx.fillStyle = "#8ca56a";
      for (let i = 0; i < 7; i += 1) {
        const px = x + (((i * 37 + (item.seed || 0) * 11) % 83) / 82 - 0.5) * w * 0.95;
        const py = y - h * (0.18 + ((i * 19) % 47) / 75);
        ctx.beginPath();
        ctx.ellipse(px, py, Math.max(1.5, h * 0.026), Math.max(1, h * 0.012), i * 0.7, 0, TAU);
        ctx.fill();
      }
    } else if (kind === "fern" || kind === "denseFern") {
      const dense = kind === "denseFern";
      const armMin = dense ? -4 : -2;
      const armMax = dense ? 4 : 2;
      ctx.lineWidth = Math.max(1, h * (dense ? 0.03 : 0.022));
      for (let arm = armMin; arm <= armMax; arm += 1) {
        const divisor = dense ? 4 : 2;
        const tipX = x + arm / divisor * w * 0.62;
        const tipY = y - h * (0.76 + Math.abs(arm) * (dense ? 0.018 : 0.025));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + arm * w * (dense ? 0.045 : 0.1), y - h * 0.46, tipX, tipY);
        ctx.stroke();
        const leafMax = dense ? 9 : 7;
        for (let leaf = 2; leaf <= leafMax; leaf += 1) {
          const t = leaf / (leafMax + 1);
          const lx = x + (tipX - x) * t;
          const ly = y + (tipY - y) * t;
          const leafSize = h * ((dense ? 0.086 : 0.075) * (1 - t * 0.5));
          ctx.beginPath();
          ctx.ellipse(lx - leafSize * 0.58, ly, leafSize, leafSize * (dense ? 0.32 : 0.26), -0.45 + arm * 0.04, 0, TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(lx + leafSize * 0.58, ly, leafSize, leafSize * (dense ? 0.32 : 0.26), 0.45 + arm * 0.04, 0, TAU);
          ctx.fill();
        }
      }
    } else {
      for (let blade = -5; blade <= 5; blade += 1) {
        const bend = blade * w * 0.085;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + bend * 0.15, y - h * 0.58, x + bend, y - h * (0.72 + Math.abs(blade % 3) * 0.1));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawRock(ctx, object) {
    const s = Math.max(2, object.scale * object.item.height);
    const gradient = ctx.createLinearGradient(object.x - s, object.y - s, object.x + s, object.y);
    gradient.addColorStop(0, object.item.light ? "#9b9c85" : "#626b5e");
    gradient.addColorStop(0.58, object.item.light ? "#6e7567" : "#3f4a42");
    gradient.addColorStop(1, "#26342d");
    ctx.save();
    ctx.globalAlpha = object.fog * 0.92;
    ctx.fillStyle = "rgba(4,12,8,.36)";
    ctx.beginPath(); ctx.ellipse(object.x, object.y, s * 0.78, s * 0.15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(object.x - s * 0.62, object.y);
    ctx.quadraticCurveTo(object.x - s * 0.5, object.y - s * 0.52, object.x - s * 0.08, object.y - s * 0.68);
    ctx.quadraticCurveTo(object.x + s * 0.48, object.y - s * 0.55, object.x + s * 0.66, object.y);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawLeaf(ctx, object) {
    const s = Math.max(2, object.scale * object.item.height);
    ctx.save();
    ctx.globalAlpha = object.fog * 0.72;
    ctx.translate(object.x, object.y - s * 0.12);
    ctx.rotate(object.item.angle);
    ctx.fillStyle = object.item.color;
    ctx.beginPath();
    ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * 0.48, s, 0); ctx.quadraticCurveTo(0, s * 0.34, -s, 0); ctx.fill();
    ctx.strokeStyle = "rgba(45,30,15,.45)"; ctx.lineWidth = Math.max(1, s * 0.04); ctx.beginPath(); ctx.moveTo(-s * 0.72, 0); ctx.lineTo(s * 0.76, 0); ctx.stroke();
    ctx.restore();
  }

  function drawPinecone(ctx, object) {
    const s = Math.max(2.5, object.scale * object.item.height);
    ctx.save();
    ctx.globalAlpha = object.fog * 0.9;
    ctx.translate(object.x, object.y - s * 0.2);
    ctx.rotate(object.item.angle);
    const gradient = ctx.createLinearGradient(-s * 0.6, -s, s * 0.6, s);
    gradient.addColorStop(0, "#8b6338");
    gradient.addColorStop(0.55, "#5b3b25");
    gradient.addColorStop(1, "#2d2017");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.48, s, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(224,178,104,.55)";
    ctx.lineWidth = Math.max(1, s * 0.055);
    for (let row = -3; row <= 3; row += 1) {
      const y = row * s * 0.22;
      const half = s * 0.42 * (1 - Math.abs(row) / 5);
      ctx.beginPath();
      ctx.moveTo(-half, y - s * 0.08);
      ctx.quadraticCurveTo(0, y + s * 0.09, half, y - s * 0.08);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPotato(ctx, object, isTarget) {
    const { item, x, y, scale, fog, kind } = object;
    const planted = kind === "potatoPlant";
    const h = Math.max(3, item.height * scale);
    ctx.save();
    ctx.globalAlpha = fog;
    if (planted) {
      ctx.strokeStyle = "#4c7544";
      ctx.fillStyle = "#5f884c";
      ctx.lineWidth = Math.max(1, h * 0.045);
      for (let stem = -2; stem <= 2; stem += 1) {
        const tipX = x + stem * h * 0.18;
        const tipY = y - h * (0.72 + Math.abs(stem) * 0.04);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + stem * h * 0.05, y - h * 0.42, tipX, tipY);
        ctx.stroke();
        for (let leaf = 1; leaf <= 3; leaf += 1) {
          const t = leaf / 4;
          const lx = x + (tipX - x) * t;
          const ly = y + (tipY - y) * t;
          ctx.beginPath();
          ctx.ellipse(lx - h * 0.08, ly, h * 0.11, h * 0.045, -0.45, 0, TAU);
          ctx.ellipse(lx + h * 0.08, ly, h * 0.11, h * 0.045, 0.45, 0, TAU);
          ctx.fill();
        }
      }
      ctx.fillStyle = "#b69ac2";
      for (let flower = -1; flower <= 1; flower += 1) {
        ctx.beginPath();
        ctx.arc(x + flower * h * 0.16, y - h * (0.68 + Math.abs(flower) * 0.06), Math.max(1.5, h * 0.035), 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = "#8c6035";
      ctx.beginPath();
      ctx.ellipse(x, y - h * 0.015, h * 0.16, h * 0.075, -0.08, 0, TAU);
      ctx.fill();
    } else {
      const s = h;
      ctx.fillStyle = "rgba(5,12,8,.42)";
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.04, s * 0.62, s * 0.16, 0, 0, TAU);
      ctx.fill();
      const skin = ctx.createRadialGradient(x - s * 0.18, y - s * 0.28, s * 0.04, x, y - s * 0.18, s * 0.62);
      skin.addColorStop(0, "#c59658");
      skin.addColorStop(0.58, "#9a693d");
      skin.addColorStop(1, "#5e3d28");
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.22, s * 0.52, s * 0.34, item.angle * 0.18, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(68,40,22,.7)";
      [-0.24, 0.04, 0.28].forEach((offset, index) => {
        ctx.beginPath();
        ctx.arc(x + offset * s, y - s * (0.25 + index * 0.025), Math.max(1, s * 0.025), 0, TAU);
        ctx.fill();
      });
    }
    if (isTarget) {
      ctx.strokeStyle = "rgba(255,224,133,.85)";
      ctx.lineWidth = Math.max(1.5, h * 0.025);
      ctx.beginPath();
      ctx.ellipse(x, y, h * (planted ? 0.48 : 0.72), h * 0.16, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMushroom(ctx, object, isTarget) {
    const id = object.item.site.species;
    const s = Math.max(isTarget ? 58 : 2, object.scale * object.item.height);
    const x = object.x;
    const y = object.y;
    ctx.save();
    ctx.globalAlpha = object.fog;
    ctx.fillStyle = "rgba(5,12,8,.46)";
    ctx.beginPath(); ctx.ellipse(x, y + s * 0.025, s * 0.52, s * 0.1, 0, 0, TAU); ctx.fill();
    if (isTarget) {
      ctx.strokeStyle = "rgba(255,229,145,.72)";
      ctx.lineWidth = Math.max(1.5, s * 0.025);
      ctx.beginPath(); ctx.ellipse(x, y + s * 0.025, s * 0.72, s * 0.16, 0, 0, TAU); ctx.stroke();
      ctx.shadowColor = "rgba(255,238,164,.76)";
      ctx.shadowBlur = Math.max(10, s * 0.28);
    }
    const capGradient = (top, bottom) => {
      const gradient = ctx.createLinearGradient(x, y - s, x, y - s * 0.28);
      gradient.addColorStop(0, top); gradient.addColorStop(0.62, bottom); gradient.addColorStop(1, "#3a281d");
      return gradient;
    };
    const stemGradient = ctx.createLinearGradient(x - s * 0.16, 0, x + s * 0.16, 0);
    stemGradient.addColorStop(0, "#8f7652"); stemGradient.addColorStop(0.45, "#e3cf9f"); stemGradient.addColorStop(1, "#88704e");
    if (id === "medovka") {
      ctx.fillStyle = capGradient("#f0c45c", "#c87c1f");
      ctx.beginPath(); ctx.moveTo(x - s * 0.58, y - s * 0.52); ctx.quadraticCurveTo(x, y - s * 0.95, x + s * 0.62, y - s * 0.5); ctx.quadraticCurveTo(x + s * 0.2, y - s * 0.33, x, y - s * 0.38); ctx.quadraticCurveTo(x - s * 0.25, y - s * 0.3, x - s * 0.58, y - s * 0.52); ctx.fill();
      ctx.fillStyle = stemGradient; ctx.fillRect(x - s * 0.09, y - s * 0.48, s * 0.18, s * 0.5);
      ctx.strokeStyle = "#795728"; ctx.lineWidth = Math.max(1, s * 0.025); for (let i = -2; i <= 2; i += 1) { ctx.beginPath(); ctx.moveTo(x, y - s * 0.42); ctx.lineTo(x + i * s * 0.18, y - s * 0.51); ctx.stroke(); }
    } else if (id === "hnedka") {
      ctx.fillStyle = stemGradient; ctx.fillRect(x - s * 0.1, y - s * 0.52, s * 0.2, s * 0.54);
      ctx.fillStyle = capGradient("#9b7049", "#5a3423"); ctx.beginPath(); ctx.ellipse(x, y - s * 0.55, s * 0.55, s * 0.31, 0, Math.PI, TAU); ctx.quadraticCurveTo(x, y - s * 0.23, x - s * 0.55, y - s * 0.55); ctx.fill();
      ctx.fillStyle = "#a38158"; for (let i = -3; i <= 3; i += 1) { ctx.beginPath(); ctx.arc(x + i * s * 0.12, y - s * 0.48 + (i % 2) * s * 0.025, Math.max(1, s * 0.025), 0, TAU); ctx.fill(); }
    } else if (id === "ohnivka") {
      ctx.fillStyle = capGradient("#ff9b3f", "#d84420"); ctx.beginPath(); ctx.moveTo(x - s * 0.63, y - s * 0.48); ctx.quadraticCurveTo(x - s * 0.27, y - s * 0.62, x, y - s * 0.31); ctx.quadraticCurveTo(x + s * 0.25, y - s * 0.64, x + s * 0.65, y - s * 0.47); ctx.quadraticCurveTo(x + s * 0.35, y - s * 0.76, x, y - s * 0.82); ctx.quadraticCurveTo(x - s * 0.38, y - s * 0.78, x - s * 0.63, y - s * 0.48); ctx.fill();
      ctx.fillStyle = stemGradient; ctx.beginPath(); ctx.moveTo(x - s * 0.09, y); ctx.lineTo(x - s * 0.16, y - s * 0.52); ctx.lineTo(x + s * 0.16, y - s * 0.52); ctx.lineTo(x + s * 0.09, y); ctx.fill();
      ctx.strokeStyle = "#6e2e1d"; ctx.lineWidth = Math.max(1, s * 0.02); for (let i = -3; i <= 3; i += 1) { ctx.beginPath(); ctx.moveTo(x, y - s * 0.45); ctx.lineTo(x + i * s * 0.17, y - s * 0.5); ctx.stroke(); }
    } else if (id === "belokruh") {
      ctx.fillStyle = stemGradient; ctx.beginPath(); ctx.moveTo(x - s * 0.13, y); ctx.lineTo(x - s * 0.1, y - s * 0.58); ctx.lineTo(x + s * 0.1, y - s * 0.58); ctx.lineTo(x + s * 0.15, y); ctx.fill();
      ctx.fillStyle = capGradient("#fffdf0", "#c9c2ab"); ctx.beginPath(); ctx.ellipse(x, y - s * 0.62, s * 0.52, s * 0.3, 0, Math.PI, TAU); ctx.quadraticCurveTo(x, y - s * 0.38, x - s * 0.52, y - s * 0.62); ctx.fill();
      ctx.strokeStyle = "#f4f0df"; ctx.lineWidth = Math.max(2, s * 0.06); ctx.beginPath(); ctx.ellipse(x, y - s * 0.35, s * 0.2, s * 0.07, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = "#c7c2ae"; ctx.beginPath(); ctx.ellipse(x, y, s * 0.22, s * 0.08, 0, 0, TAU); ctx.fill();
    } else {
      ctx.shadowColor = "#69b7da"; ctx.shadowBlur = Math.max(6, s * 0.22);
      ctx.fillStyle = stemGradient; ctx.beginPath(); ctx.moveTo(x - s * 0.08, y); ctx.lineTo(x - s * 0.12, y - s * 0.58); ctx.lineTo(x + s * 0.09, y - s * 0.58); ctx.lineTo(x + s * 0.08, y); ctx.fill();
      ctx.fillStyle = capGradient("#65acd0", "#285c91"); ctx.beginPath(); ctx.moveTo(x - s * 0.55, y - s * 0.54); ctx.quadraticCurveTo(x, y - s * 1.02, x + s * 0.52, y - s * 0.54); ctx.quadraticCurveTo(x, y - s * 0.32, x - s * 0.55, y - s * 0.54); ctx.fill();
      ctx.fillStyle = "#d9eef0"; for (let i = 0; i < 7; i += 1) { const a = i * 2.39; ctx.beginPath(); ctx.arc(x + Math.cos(a) * s * 0.31, y - s * (0.64 + Math.sin(a) * 0.13), Math.max(1, s * 0.018), 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }

  function makeWorld(layout) {
    const trees = [];
    const ferns = [];
    const bushes = [];
    const ground = [];
    const potatoes = [];
    let seed = 72931;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 52; i += 1) {
      const x = random() * 28 - 14;
      const z = random() * 28 - 14;
      const nearStart = distance(x, z, 0, 11.4) < 2.2;
      const nearSite = Object.values(layout).some((site) => distance(x, z, site.x, site.z) < 1.7);
      if (nearStart || nearSite) { i -= 1; continue; }
      const baseRadius = 0.3 + random() * 0.34;
      const treeHeight = 7.2 + random() * 6;
      const birch = random() > 0.76;
      trees.push({ x, z, radius: baseRadius * (birch ? 0.76 : 1), height: treeHeight, birch, warm: random() > 0.55, seed: Math.floor(random() * 97) });
    }
    for (let i = 0; i < 205; i += 1) {
      const dense = random() > 0.84;
      ferns.push({
        x: random() * 28 - 14,
        z: random() * 28 - 14,
        height: dense ? 0.72 + random() * 0.5 : 0.28 + random() * 0.62,
        width: dense ? 0.9 + random() * 0.32 : 0.78,
        kind: dense ? "denseFern" : random() > 0.45 ? "grass" : "fern",
        color: random() > 0.5 ? "#3f6744" : "#5a7d4e"
      });
    }
    for (let i = 0; i < 30; i += 1) {
      const x = random() * 26 - 13;
      const z = random() * 26 - 13;
      if (distance(x, z, 0, 11.4) < 1.8) { i -= 1; continue; }
      bushes.push({
        x, z,
        height: 0.72 + random() * 0.72,
        width: 0.9 + random() * 0.85,
        color: random() > 0.5 ? "#294d35" : "#365c3b",
        light: random() > 0.55,
        seed: Math.floor(random() * 91)
      });
    }
    const edgeAnchors = [
      { x: -12.5 + random() * 0.7, z: -8 + random() * 5 },
      { x: 12.5 - random() * 0.7, z: -1 + random() * 7 },
      { x: -6 + random() * 12, z: -12.5 + random() * 0.7 }
    ];
    edgeAnchors.slice(0, 2).forEach((point, index) => {
      potatoes.push({
        id: `potato-edge-${index + 1}`,
        x: point.x,
        z: point.z,
        height: 0.5 + random() * 0.14,
        style: "plant",
        angle: random() * TAU
      });
    });
    bushes.filter((bush) => distance(bush.x, bush.z, 0, 11.4) > 2.4).slice(3, 4).forEach((bush, index) => {
      const angle = random() * TAU;
      potatoes.push({
        id: `potato-loose-${index + 1}`,
        x: bush.x + Math.cos(angle) * (0.28 + random() * 0.22),
        z: bush.z + Math.sin(angle) * (0.28 + random() * 0.22),
        height: 0.2 + random() * 0.05,
        style: "loose",
        angle
      });
    });
    for (let i = 0; i < 190; i += 1) {
      const roll = random();
      const kind = roll < 0.12 ? "rock" : roll < 0.48 ? "cone" : "leaf";
      const height = kind === "rock"
        ? 0.18 + random() * 0.34
        : kind === "cone"
          ? 0.12 + random() * 0.1
          : 0.06 + random() * 0.08;
      ground.push({
        x: random() * 28 - 14,
        z: random() * 28 - 14,
        height,
        kind,
        light: random() > 0.5,
        angle: random() * TAU,
        color: kind === "leaf" ? (random() > 0.5 ? "#9c6f3c" : "#6c4c2f") : "#6a4528"
      });
    }
    Object.entries(layout).forEach(([id, site], siteIndex) => {
      const baseAngle = siteIndex * 1.73 + 0.35;
      for (let i = 0; i < 12; i += 1) {
        const a = baseAngle + i / 12 * TAU;
        const radius = 0.52 + (i % 4) * 0.27;
        const dense = i % 4 === 1 || i % 6 === 0;
        ferns.push({
          x: site.x + Math.cos(a) * radius,
          z: site.z + Math.sin(a) * radius,
          height: dense ? 0.78 + (i % 3) * 0.12 : 0.38 + (i % 4) * 0.09,
          width: dense ? 1 : 0.78,
          kind: dense ? "denseFern" : i % 2 ? "fern" : "grass",
          color: id === "studenka" ? "#3d685f" : "#3c633f"
        });
      }
      [0.42, 2.78].forEach((offset, bushIndex) => {
        const a = baseAngle + offset;
        const radius = bushIndex ? 1.18 : 0.82;
        bushes.push({
          x: site.x + Math.cos(a) * radius,
          z: site.z + Math.sin(a) * radius,
          height: bushIndex ? 1.05 : 0.92,
          width: bushIndex ? 1.48 : 1.24,
          color: id === "studenka" ? "#2d554c" : "#294d33",
          light: bushIndex === 0,
          seed: siteIndex * 11 + bushIndex
        });
      });
    });
    return { trees, ferns, bushes, ground, potatoes };
  }

  function mushroomHeight(id) {
    return ({ medovka: 0.4, hnedka: 0.44, ohnivka: 0.36, belokruh: 0.5, modravec: 0.42 })[id] || 0.4;
  }

  function phaseName() {
    if (state.phase === "forest") return state.current ? "Nález v porostu" : "Les z první osoby";
    if (state.phase === "sorting") return "Třídění hub";
    if (state.phase === "evening-order") return "Návrat do chaty";
    if (state.phase === "soup") return "Polévka";
    if (state.phase === "potion") return "Lektvar";
    return "";
  }

  function compassName(yaw) {
    const names = ["S", "SV", "V", "JV", "J", "JZ", "Z", "SZ"];
    return names[Math.round(wrap(yaw) / TAU * 8) % 8];
  }

  function distance(x1, z1, x2, z2) { return Math.hypot(x1 - x2, z1 - z2); }
  function wrap(value) { return (value % TAU + TAU) % TAU; }
  function angleDiff(a, b) { return ((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function esc(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }

  render();
})();
