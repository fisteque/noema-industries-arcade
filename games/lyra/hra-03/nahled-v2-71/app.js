(function () {
  "use strict";

  const E = window.KloboukyEngine;
  const STORAGE = "lyra-klobouky-a-hlizy-v2-71-preview";
  const LEGACY_STORAGE = "lyra-klobouky-a-hlizy-v2-70-preview";
  const app = document.getElementById("app");
  const TAU = Math.PI * 2;
  const FOV = Math.PI / 2.7;
  const VERTICAL_LOOK = 0.86;
  const LOOK_DOWN_LIMIT = -1.46;
  const LOOK_UP_LIMIT = 1.42;
  const WORLD_LIMIT = 14;
  const OBJECT_DRAW_DISTANCE = WORLD_LIMIT * 3;
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

  let savedState = load();
  let state = null;
  let selectedDifficulty = savedState?.difficulty === "easy" ? "easy" : "normal";
  let selected = [];
  let selectedSoup = [];
  let selectedSoupPotatoes = 0;
  let tableFocus = null;
  let forestPanelView = null;
  let memoryTarget = null;
  let memoryDescriptionId = null;
  let overflowDescriptionId = null;
  let endingView = "summary";
  let scene = null;
  let messageTimer = 0;
  let sitePositions = savedState?.sitePositions || cloneSitePositions(DEFAULT_SITE_POSITIONS);
  let world = makeWorld(sitePositions);

  // Pravé tlačítko v celé lesní fázi uvolňuje myš, ale nikdy neotevírá
  // systémové kontextové menu — ani během prohlídky právě nalezené houby.
  document.addEventListener("contextmenu", (event) => {
    if (state?.phase === "forest") event.preventDefault();
  });

  document.addEventListener("keydown", (event) => {
    if (!state || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const handled = handleGameKey(event.code);
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
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

  function normalizeSiteSpecies(layout) {
    if (!layout || typeof layout !== "object") return null;
    const chosen = SITE_IDS.map((id) => layout[id]);
    const valid = chosen.every((id) => Boolean(E.SPECIES[id])) && new Set(chosen).size === SITE_IDS.length;
    return valid ? Object.fromEntries(SITE_IDS.map((id) => [id, layout[id]])) : null;
  }

  function freshState(previous = null, difficulty = selectedDifficulty) {
    const next = previous ? E.nextDay(previous) : E.createState(difficulty);
    next.explorer = { x: 0, z: 11.4, yaw: Math.PI, pitch: 0 };
    next.layoutSeed = randomSeed();
    next.sitePositions = createSitePositions(next.layoutSeed);
    next.siteSpecies = E.createDaySpecies(next.layoutSeed);
    return next;
  }

  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE) || localStorage.getItem(LEGACY_STORAGE));
      if (!value || !value.phase) return null;
      if (!value.explorer) value.explorer = { x: 0, z: 11.4, yaw: Math.PI, pitch: 0 };
      if (!Number.isFinite(value.explorer.pitch)) value.explorer.pitch = 0;
      if (!Number.isFinite(value.layoutSeed)) value.layoutSeed = randomSeed();
      value.sitePositions = normalizeSitePositions(value.sitePositions) || createSitePositions(value.layoutSeed);
      value.siteSpecies = normalizeSiteSpecies(value.siteSpecies) || E.createDaySpecies(value.layoutSeed);
      value.knowledge = Array.isArray(value.knowledge) ? value.knowledge : [];
      value.identifications = value.identifications && typeof value.identifications === "object" ? value.identifications : {};
      value.identificationDraft = value.identificationDraft || { speciesGuess: null };
      value.identificationDraft.memoryKnowledgeId ||= null;
      value.identificationDraft.memoryExclusion ||= null;
      value.identificationDraft.memoryRejectedSpecies = Array.isArray(value.identificationDraft.memoryRejectedSpecies) ? value.identificationDraft.memoryRejectedSpecies : [];
      value.basketRecords = Array.isArray(value.basketRecords) ? value.basketRecords : [];
      value.basketRecords.forEach((record) => {
        record.memoryKnowledgeId ||= null;
        record.memoryExclusion ||= null;
        record.memoryRejectedSpecies = Array.isArray(record.memoryRejectedSpecies) ? record.memoryRejectedSpecies : [];
      });
      value.collectedPotatoes = Array.isArray(value.collectedPotatoes) ? value.collectedPotatoes : [];
      value.soupIdentifications = Array.isArray(value.soupIdentifications) ? value.soupIdentifications : [];
      value.minutes = Number.isFinite(value.minutes) ? value.minutes : E.TIMINGS.dayStart;
      value.hungerMinutes = Number.isFinite(value.hungerMinutes) ? value.hungerMinutes : 0;
      value.walkedRemainder = Number.isFinite(value.walkedRemainder) ? value.walkedRemainder : 0;
      value.collisionFreeMinutes = Number.isFinite(value.collisionFreeMinutes) ? value.collisionFreeMinutes : 0;
      value.rockingHours = Number.isFinite(value.rockingHours) ? value.rockingHours : 0;
      value.identificationSummary = Array.isArray(value.identificationSummary) ? value.identificationSummary : [];
      value.day = Number.isFinite(value.day) ? Math.max(1, Math.floor(value.day)) : 1;
      value.difficulty = value.difficulty === "easy" ? "easy" : "normal";
      value.forcedHome = value.forcedHome || null;
      value.carriedItem = value.carriedItem || null;
      value.dirtySoupPot = Boolean(value.dirtySoupPot);
      value.coldSoup = value.coldSoup || null;
      value.potState = ["clean", "dirty", "dried", "full"].includes(value.potState)
        ? value.potState
        : value.coldSoup || value.soup?.leftForMorning
          ? "full"
          : value.dirtySoupPot
            ? "dried"
            : "clean";
      value.dirtySoupPot = value.potState !== "clean";
      value.potCleanupNext = value.potCleanupNext || null;
      value.pendingKnowledge = value.pendingKnowledge || null;
      value.gameOver = Boolean(value.gameOver);
      value.gameOverReason = value.gameOverReason || null;
      if (value.soup && value.soup.eaten === undefined) {
        value.soup.eaten = true;
        value.soup.leftForMorning = false;
      } else if (value.soup && value.soup.leftForMorning === undefined) {
        value.soup.leftForMorning = false;
      }
      if (value.phase === "evening-order" && value.soup && value.potion) value.phase = "ending";
      return value;
    } catch (_) {
      return null;
    }
  }

  function save() {
    if (state) {
      localStorage.setItem(STORAGE, JSON.stringify(state));
      savedState = JSON.parse(JSON.stringify(state));
    }
  }

  function set(next, ui = {}) {
    const forestErrorOnly = Boolean(
      state?.phase === "forest" &&
      next?.phase === "forest" &&
      next.error &&
      sameStateApartFromError(state, next)
    );
    const previousLayout = state?.sitePositions;
    if (!Number.isFinite(next.layoutSeed)) next.layoutSeed = state?.layoutSeed || randomSeed();
    next.sitePositions = normalizeSitePositions(next.sitePositions) ||
      normalizeSitePositions(previousLayout) ||
      createSitePositions(next.layoutSeed);
    const layoutChanged = !world || JSON.stringify(previousLayout) !== JSON.stringify(next.sitePositions);
    state = next;
    if (!state.pendingKnowledge) overflowDescriptionId = null;
    if (layoutChanged) {
      sitePositions = cloneSitePositions(state.sitePositions);
      world = makeWorld(sitePositions);
    }
    if (!ui.keepSelections) {
      selected = [];
      selectedSoup = [];
      selectedSoupPotatoes = 0;
    }
    tableFocus = Number.isInteger(ui.tableFocus) ? ui.tableFocus : ui.keepTableFocus ? tableFocus : null;
    forestPanelView = ui.forestPanelView ?? null;
    if (Object.prototype.hasOwnProperty.call(ui, "memoryTarget")) memoryTarget = ui.memoryTarget;
    else if (forestPanelView !== "memory") memoryTarget = null;
    save();
    if (forestErrorOnly) {
      showForestMessage(next.error);
      scheduleTransientMessage();
      return;
    }
    render();
    scheduleTransientMessage();
  }

  function sameStateApartFromError(left, right) {
    const a = { ...left, error: null };
    const b = { ...right, error: null };
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function showForestMessage(message) {
    const element = document.querySelector(".forest-message");
    if (!element) return;
    element.textContent = message || "";
    element.hidden = !message;
  }

  function scheduleTransientMessage() {
    window.clearTimeout(messageTimer);
    messageTimer = 0;
    const message = state?.error;
    if (!message) return;
    messageTimer = window.setTimeout(() => {
      if (!state || state.error !== message) return;
      state.error = null;
      save();
      if (state.phase === "forest") {
        showForestMessage("");
      } else {
        document.querySelector(".toast")?.remove();
      }
    }, 3000);
  }

  function start(difficulty = selectedDifficulty) {
    selectedDifficulty = difficulty === "easy" ? "easy" : "normal";
    memoryDescriptionId = null;
    overflowDescriptionId = null;
    set(freshState(null, selectedDifficulty));
    resumeForestLook();
  }

  function continueSavedGame() {
    if (!savedState) return;
    endingView = "summary";
    selectedDifficulty = savedState.difficulty === "easy" ? "easy" : "normal";
    state = JSON.parse(JSON.stringify(savedState));
    sitePositions = cloneSitePositions(state.sitePositions);
    world = makeWorld(sitePositions);
    forestPanelView = null;
    memoryTarget = null;
    memoryDescriptionId = null;
    overflowDescriptionId = null;
    render();
    scheduleTransientMessage();
    resumeForestLook();
  }

  function startNextDay() {
    endingView = "summary";
    set(freshState(state));
    resumeForestLook();
  }

  function returnToTitle() {
    window.clearTimeout(messageTimer);
    endingView = "summary";
    state = null;
    forestPanelView = null;
    selected = [];
    selectedSoup = [];
    selectedSoupPotatoes = 0;
    tableFocus = null;
    memoryTarget = null;
    memoryDescriptionId = null;
    overflowDescriptionId = null;
    render();
  }

  function render() {
    stopScene();
    if (!state) return renderTitle();
    if (state.gameOver) return renderGameOver();
    if (state.phase === "ending") return renderEnding();
    const pageError = state.error && state.phase !== "forest"
      ? `<div class="toast" role="status">${esc(state.error)}</div>`
      : "";
    app.innerHTML = `${header()}<div class="shell">${mainPanel()}</div>${knowledgeOverflowPanel()}${pageError}`;
    bind();
    paintMushroomIcons();
    if (state.phase === "forest") startScene();
  }

  function renderTitle() {
    const hasSave = Boolean(savedState);
    const difficultyName = selectedDifficulty === "easy" ? "Lehká" : "Normální";
    app.innerHTML = `
      <section class="title-screen">
        <div class="moon" aria-hidden="true"></div>
        <p class="eyebrow">Lýra · pracovní v2-71</p>
        <h1>Klobouky<br><span>a hlízy</span></h1>
        <p class="lede">V lese hledáš, určuješ nebo si nejistotu neseš domů. Po třech houbách můžeš odejít, košík ale pojme pět. Bramboru či šestou houbu uneseš pouze v ruce.</p>
        <div class="title-menu">
          ${hasSave ? `<button class="primary big" data-continue>Pokračovat · den ${savedState.day || 1} · ${savedState.difficulty === "easy" ? "lehká" : "normální"}</button>` : ""}
          <div class="difficulty-picker" role="group" aria-label="Obtížnost nové hry">
            <button class="difficulty-choice${selectedDifficulty === "normal" ? " selected" : ""}" data-difficulty="normal"><b>Normální</b><span>Start 5 · spánek +3, nejvýš 7</span></button>
            <button class="difficulty-choice${selectedDifficulty === "easy" ? " selected" : ""}" data-difficulty="easy"><b>Lehká</b><span>Start 10 · spánek +5, nejvýš 10</span></button>
          </div>
          <button class="secondary big" data-new-game>Nová hra · ${difficultyName.toLowerCase()}</button>
        </div>
        <div class="title-help">
          <span><b>WASD</b> chůze</span><span><b>E</b> potvrdit</span><span><b>Q</b> zavřít</span><span><b>H</b> hlavní menu</span><span><b>F</b> košík</span><span><b>X</b> deník cesty</span><span><b>C</b> zápisník</span><span><b>R</b> chléb</span>
        </div>
        <p class="small">Po každém otevření si vybereš pokračování, nebo novou hru. Na telefonu použij tlačítka pod výhledem.</p>
      </section>`;
    bind();
  }

  function header() {
    return `
      <header class="game-header">
        <p class="eyebrow">Klobouky a hlízy · v2-71 · ${state.difficulty === "easy" ? "lehká" : "normální"} · den ${state.day || 1}</p>
      </header>`;
  }

  function renderGameOver() {
    stopScene();
    app.innerHTML = `${header()}<main class="card main-card game-over-card"><section><div class="retired-witch-hat" aria-hidden="true"><i></i><b></b></div><p class="kicker">Výprava končí · den ${state.day || 1} · ${E.clock(state.minutes)}</p><h1>Klobouk jde na hřebík</h1><p>${esc(state.gameOverReason || "Jídlo i soustředění klesly na nulu.")} Bez sytosti a čisté hlavy už není bezpečné chodit do lesa ani stát u kotlíku.</p><p class="game-over-farewell">Pověsíš čarodějnický klobouk na hřebík, zavřeš zápisník a jdeš se pořádně najíst do města.</p><p class="game-over-rule">V zápisníku po výpravě zůstalo ${state.knowledge.length} z ${E.MEMORY_LIMIT} poznatků.</p><div class="game-over-actions"><button class="primary big" data-new-game data-key-e><kbd>E</kbd> Začít novou hru</button><button class="quiet big" data-title-screen data-key-q><kbd>Q</kbd> Hlavní menu</button></div></section></main>`;
    bind();
  }

  function mainPanel() {
    if (state.phase === "morning-soup") return morningSoupPanel();
    if (state.phase === "pot-cleanup") return potCleanupPanel();
    if (state.phase === "forest") return forestPanel();
    if (state.phase === "home-arrival") return homeArrivalPanel();
    if (state.phase === "identifying") return homeIdentificationPanel();
    if (state.phase === "evening-order") return orderPanel();
    if (state.phase === "soup" || state.phase === "potion") return cookingPanel(state.phase);
    if (state.phase === "cooking-result") return cookingResultPanel();
    return "";
  }

  function knowledgeDescriptionContent(entry) {
    const negative = entry.type === "exclusion";
    const species = entry.species ? E.getSpecies(entry.species) : null;
    const clues = species?.clues || [];
    const use = negative
      ? "Dokud neurčíš skutečný druh, zápisník žádné použití ani recept nedoporučí."
      : species?.use || "Použití a recepty zatím neznáš.";
    return `<div class="memory-description-head">${species ? mushroomIcon(species.id, "memory-description-icon") : ""}<div><h4>${esc(entry.title)}</h4><p>${negative ? "Neúplný poznatek" : "Ověřený poznatek"}</p></div></div><section><h5>Co sis zapsala</h5><p>${esc(entry.text)}</p></section>${clues.length ? `<section><h5>Znaky ze sběru</h5><ul>${clues.map((clue) => `<li>${esc(clue)}</li>`).join("")}</ul></section>` : ""}<section><h5>Recepty a použití</h5><p>${esc(use)}</p></section>`;
  }

  function knowledgeOverflowPanel() {
    if (!state?.pendingKnowledge) return "";
    const pending = state.pendingKnowledge;
    const describedEntry = overflowDescriptionId && [pending, ...state.knowledge].find((entry) => entry.id === overflowDescriptionId);
    if (describedEntry) {
      const isPending = describedEntry.id === pending.id;
      return `<div class="knowledge-overflow-backdrop"><section class="knowledge-overflow-panel knowledge-overflow-description-panel memory-description-panel" role="dialog" aria-modal="true"><p class="kicker">${isPending ? "Nový poznatek" : "Zapsaný poznatek"} · popis</p>${knowledgeDescriptionContent(describedEntry)}<button class="quiet overflow-description-back" data-close-overflow-description data-key-q><kbd>Q</kbd> Zpět k výběru</button></section></div>`;
    }
    const pendingIcon = pending.species ? mushroomIcon(pending.species, "knowledge-overflow-icon") : "";
    const entries = state.knowledge.map((entry) => {
      const icon = entry.species ? mushroomIcon(entry.species, "knowledge-overflow-icon") : "";
      return `<li>${icon}<div class="knowledge-overflow-copy"><b>${esc(entry.title)}</b><span>${esc(entry.text)}</span></div><div class="knowledge-overflow-actions"><button class="memory-description" data-overflow-description="${esc(entry.id)}">Popis</button><button class="danger-link" data-replace-knowledge="${esc(entry.id)}">Vymazat</button></div></li>`;
    }).join("");
    return `<div class="knowledge-overflow-backdrop"><section class="knowledge-overflow-panel" role="dialog" aria-modal="true"><p class="kicker">Lexikon určil výsledek · zápisník ${state.knowledge.length}/${E.MEMORY_LIMIT}</p><h3>Nový poznatek</h3><article class="pending-knowledge">${pendingIcon}<div><b>${esc(pending.title)}</b><p>${esc(pending.text)}</p><button class="memory-description" data-overflow-description="${esc(pending.id)}">Popis</button></div></article><p>Zápisník je plný. Tlačítkem <b>Vymazat</b> uvolníš místo a nový poznatek se uloží místo vybraného záznamu; nebo ho můžeš použít jen dnes.</p><ul>${entries}</ul><button class="quiet" data-dismiss-pending-knowledge data-key-q><kbd>Q</kbd> Nezapisovat nový poznatek</button></section></div>`;
  }

  function forestPanel() {
    const load = E.basketLoad(state);
    const full = load >= E.BASKET_LIMIT;
    const canGoHome = load >= E.HOME_MINIMUM;
    return `
      <main class="card main-card forest-card">
        <div class="section-head">
          <div><p class="kicker">Les</p><h3>${full ? "Košík je plný; ještě máš dvě ruce" : canGoHome ? "Můžeš domů, nebo hledat dál" : "Najdi, co porost schovává"}</h3></div>
        </div>
        <div class="forest-view" id="forest-view">
          <canvas id="forest-canvas" width="1280" height="720" tabindex="0" aria-label="Les z pohledu první osoby. Kliknutím aktivuješ ovládání myší."></canvas>
          <div class="crosshair" aria-hidden="true"><i></i><i></i></div>
          <div class="forest-hud" aria-label="Stav postavy">
            <span id="compass" title="Směr">S</span>
            <div class="forest-meters">
              <span id="hud-time" title="Čas">🕰 ${E.clock(state.minutes)}</span>
              <span id="hud-hunger" title="Sytost">🥣 ${formatHunger(state.hunger)}/10</span>
              <span id="hud-focus" title="Soustředění">✦ ${state.focus}</span>
            </div>
          </div>
          <nav class="forest-shortcuts" aria-label="Lesní nabídky">
            <button data-forest-panel="basket" class="basket-shortcut"><kbd>F</kbd><span>Košík</span>${basketShortcutIcons()}</button>
            <button data-forest-panel="memory"><kbd>C</kbd><span>Zápisník ${state.knowledge.length}/${E.MEMORY_LIMIT}</span></button>
            ${state.bread ? `<button class="bread-shortcut" data-action="bread"><kbd>R</kbd><span>Sníst chleba</span></button>` : ""}
          </nav>
          <div class="forest-lower-shortcut">
            <button data-forest-panel="notes"><kbd>X</kbd><span>Deník cesty</span></button>
            <button data-title-screen><kbd>H</kbd><span>Hlavní menu</span></button>
          </div>
          <div class="forest-actions">
            ${canGoHome ? `<button class="forest-action home" data-action="home"><kbd>Q</kbd> Jít domů · ${state.carriedItem ? "1 h" : "30 min"} →</button>` : ""}
          </div>
          <div class="release-hint" id="release-hint" hidden>Pravé tlačítko nebo Esc · uvolnit myš</div>
          <button class="forest-prompt" id="forest-prompt" data-action="inspect" hidden>Prozkoumat nález <b>E</b></button>
          <div class="look-hint" id="look-hint"><b>Klikni do lesa</b><span>myš · rozhlížení i bez pointer locku &nbsp; pravé tlačítko · uvolnit myš</span></div>
          ${forestOverlay()}
          <div class="forest-message" role="status"${state.error ? "" : " hidden"}>${state.error ? esc(state.error) : ""}</div>
        </div>
        <div class="touch-controls" aria-label="Ovládání lesa">
          <div class="turn-controls"><button data-step="turn-left" aria-label="Otočit doleva">↶</button><button data-step="forward" aria-label="Jít dopředu">▲</button><button data-step="turn-right" aria-label="Otočit doprava">↷</button></div>
          <div class="move-controls"><button data-step="left" aria-label="Úkrok doleva">◀</button><button data-step="back" aria-label="Jít dozadu">▼</button><button data-step="right" aria-label="Úkrok doprava">▶</button></div>
          <div class="look-controls"><button data-step="look-down" aria-label="Sklonit pohled k zemi">↧ <span>Sklonit se</span></button><button data-step="look-center" aria-label="Vyrovnat svislý pohled">◎ <span>Vyrovnat pohled</span></button></div>
        </div>
        <p class="forest-tip">${state.carriedItem?.kind === "potato" ? "S bramborou v ruce zabere každý čtverec chůze 2 minuty." : canGoHome ? (state.carriedItem ? "Můžeš stisknout Q a jít domů; věc v ruce prodlouží cestu na hodinu." : "Můžeš stisknout Q a jít domů za půl hodiny, nebo hledat dál.") : `Po ${E.HOME_MINIMUM} houbách se můžeš vrátit. Při chůzi přibývá čas.`}</p>
      </main>`;
  }

  function morningSoupPanel() {
    return `<main class="card main-card cottage-card indoor-card morning-soup-card"><div class="cottage-stage indoor-stage morning-soup-stage">
      ${phaseHud()}
      <div class="cottage-window"><i></i><i></i></div><div class="rocking-chair"><span></span></div><div class="cottage-tea-table"><div class="cold-soup-bowl">🥣</div></div>
      <section class="scene-copy morning-soup-copy"><p class="kicker">Ráno · chata · ${E.clock(state.minutes)}</p><h3>V hrnci zůstala včerejší polévka</h3><p>Studená přidá 5 sytosti a její snědení zabere 30 minut. Potom ještě zvolíš, zda hrnec půl hodiny umyješ, nebo ho necháš zaschnout na pozdější hodinové drhnutí.</p><div class="morning-soup-actions"><button class="primary" data-eat-cold-soup data-key-e><kbd>E</kbd> Sníst studenou · 30 min</button><button class="quiet" data-leave-cold-soup data-key-q><kbd>Q</kbd> Nechat zaschnout · vyrazit hned</button></div></section>
      ${utilityOverlay()}
    </div></main>`;
  }

  function potStatusInfo() {
    const status = state.potState || (state.dirtySoupPot ? "dried" : "clean");
    if (status === "dirty") return { status, minutes: E.TIMINGS.potCleanup, label: "Umýt špinavý hrnec · 30 min", note: "Hrnec je čerstvě špinavý." };
    if (status === "full") return { status, minutes: E.TIMINGS.potScrub, label: "Vylít a vydrhnout hrnec · 60 min", note: "V hrnci zůstala stará polévka." };
    if (status === "dried") return { status, minutes: E.TIMINGS.potScrub, label: "Vydrhnout zaschlý hrnec · 60 min", note: "Hrnec nebyl umytý hned a zaschl." };
    return { status: "clean", minutes: 0, label: "Hrnec je čistý", note: "Polévku můžeš začít vařit." };
  }

  function potCleanupPanel() {
    const morning = state.potCleanupNext === "forest";
    return `<main class="card main-card cooking-card indoor-card kitchen-card"><div class="cooking-stage indoor-stage result-workstation-stage kitchen-cooking-stage">${phaseHud()}<div class="kitchen-window" aria-hidden="true"><i></i><i></i></div><div class="kitchen-shelf cooking-shelf" aria-hidden="true"><i></i><i></i><i></i></div><div class="copper-pans" aria-hidden="true"><i></i><i></i><i></i></div><div class="kitchen-hearth" aria-hidden="true"><span class="soup-pot dirty-pot"></span><b>♨</b></div><section class="cooking-copy cooking-result-copy pot-cleanup-copy"><p class="kicker">${morning ? "Po studené snídani" : "Po jídle"} · ${E.clock(state.minutes)}</p><h3>Hrnec je ještě čerstvě špinavý</h3><p>Když ho umyješ hned, zabere to 30 minut. Když ho necháš být, zaschne a před příští polévkou ho budeš drhnout celou hodinu.</p><div class="cooking-result-actions"><button class="primary" data-wash-pot data-key-e><kbd>E</kbd> Umýt hned · 30 min</button><button class="quiet" data-leave-pot-dirty data-key-q><kbd>Q</kbd> ${morning ? "Nechat zaschnout · do lesa" : "Nechat zaschnout"}</button></div></section>${utilityOverlay()}</div></main>`;
  }

  function formatHunger(value) {
    return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
  }

  function optionOrder(speciesId, salt = speciesId) {
    const options = E.identificationOptions(speciesId).slice();
    let hash = 2166136261;
    String(salt).split("").forEach((character) => {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619) >>> 0;
    });
    for (let index = options.length - 1; index > 0; index -= 1) {
      hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
      const swap = hash % (index + 1);
      [options[index], options[swap]] = [options[swap], options[index]];
    }
    return options;
  }

  function memoryTargetToken(target) {
    return target ? `${target.source}:${Number(target.index) || 0}` : "";
  }

  function parseMemoryTarget(token) {
    const [source, rawIndex] = String(token || "").split(":");
    if (!["current", "basket", "hand", "home"].includes(source)) return null;
    return { source, index: Number(rawIndex) || 0 };
  }

  function defaultMemoryTarget() {
    if (state.current) return { source: "current", index: 0 };
    if (state.phase === "identifying" && Number.isInteger(tableFocus)) return { source: "home", index: tableFocus };
    return null;
  }

  function memoryTargetInfo(target = memoryTarget) {
    if (!target) return { label: "bez vybrané houby", record: null };
    if (target.source === "current") return { label: "s houbou před tebou", record: state.identificationDraft || null };
    if (target.source === "hand") return { label: "s houbou v ruce", record: state.carriedItem?.record || null };
    const record = state.basketRecords?.[target.index] || null;
    return { label: target.source === "home" ? `s houbou ${target.index + 1} u stolu` : `s houbou ${target.index + 1} v košíku`, record };
  }

  function basketShortcutIcons() {
    const basketSlots = Array.from({ length: E.BASKET_LIMIT }, (_, index) => {
      const id = state.basket?.[index];
      if (!id) return '<span class="shortcut-slot empty" title="Prázdné místo" aria-label="Prázdné místo"></span>';
      const record = state.basketRecords?.[index];
      const unknown = !record?.speciesGuess;
      const label = unknown ? "Nevím" : E.getSpecies(record.speciesGuess).name;
      return `<span class="shortcut-slot${unknown ? " unknown" : ""}" title="${esc(label)}">${mushroomIcon(id, "shortcut-item-icon")}${unknown ? '<b class="slot-state">?</b>' : ""}</span>`;
    });
    let hand = '<span class="shortcut-slot hand-slot empty" title="Volná ruka" aria-label="Volná ruka"><b class="hand-symbol">✋</b></span>';
    if (state.carriedItem?.kind === "mushroom") {
      const record = state.carriedItem.record;
      const unknown = !record?.speciesGuess;
      const label = unknown ? "Nevím · v ruce" : `${E.getSpecies(record.speciesGuess).name} · v ruce`;
      hand = `<span class="shortcut-slot hand-slot${unknown ? " unknown" : ""}" title="${esc(label)}">${mushroomIcon(state.carriedItem.id, "shortcut-item-icon")}${unknown ? '<b class="slot-state">?</b>' : ""}</span>`;
    } else if (state.carriedItem?.kind === "potato") {
      hand = '<span class="shortcut-slot hand-slot shortcut-potato" title="Brambora v ruce">🥔</span>';
    }
    return `<span class="shortcut-items">${basketSlots.join("")}${hand}</span>`;
  }

  function phaseHud() {
    const hungerClass = state.hunger <= 0 ? "meter-danger" : state.hunger <= 4 ? "meter-warning" : "";
    const focusClass = state.focus <= 0 ? "meter-danger" : state.focus <= 2 ? "meter-warning" : "";
    return `<div class="phase-hud" aria-label="Stav postavy a nabídky">
      <div class="phase-meters">
        <span title="Čas">🕰 ${E.clock(state.minutes)}</span>
        <span class="${hungerClass}" title="Sytost">🥣 ${formatHunger(state.hunger)}/10</span>
        <span class="${focusClass}" title="Soustředění">✦ ${state.focus}</span>
      </div>
      <nav class="phase-shortcuts">
        <button data-forest-panel="memory"><kbd>C</kbd><span>Zápisník ${state.knowledge.length}/${E.MEMORY_LIMIT}</span></button>
      </nav>
    </div>
    <div class="phase-lower-shortcut">
      <button data-forest-panel="notes"><kbd>X</kbd><span>Deník cesty</span></button>
      <button data-title-screen><kbd>H</kbd><span>Hlavní menu</span></button>
    </div>`;
  }

  function mushroomIcon(id, className = "") {
    return `<canvas class="mushroom-menu-icon ${className}" data-mushroom-icon="${esc(id)}" width="96" height="82" aria-hidden="true"></canvas>`;
  }

  function forestOverlay() {
    if (forestPanelView) return utilityOverlay();
    if (!state.current) return "";
    if (state.current) {
      const site = E.getSite(state.current, state);
      const species = E.getSpecies(site.species);
      const full = E.basketLoad(state) >= E.BASKET_LIMIT;
      const guess = state.identificationDraft?.speciesGuess || null;
      const memoryEntry = state.identificationDraft?.memoryKnowledgeId
        ? state.knowledge.find((entry) => entry.id === state.identificationDraft.memoryKnowledgeId)
        : null;
      const memoryNote = memoryEntry
        ? `<p class="memory-result-note">${memoryEntry.type === "mushroom" ? `Zápisník potvrzuje: ${esc(memoryEntry.title)}.` : `Zápisník poznává stopu: ${esc(memoryEntry.title)}.`}</p>`
        : "";
      const options = optionOrder(species.id, site.id).map((id, index) => {
        const option = E.getSpecies(id);
        return `<button class="id-choice species-button text-only${guess === id ? " selected" : ""}" data-current-species="${id}" data-choice-number="${index + 1}"><kbd>${index + 1}</kbd>${esc(option.name)}</button>`;
      }).join("");
      return `<section class="forest-find-inline" role="dialog" aria-label="Nalezená houba">
        <div class="forest-find-specimen">${mushroomIcon(species.id, "find-specimen-icon")}</div>
        <p class="forest-find-context"><b>${esc(site.name)}</b><span>${species.clues.map(esc).join(" · ")}</span></p>
        <div class="identification-question"><h4>Co si myslíš, že je to za houbu?</h4><button class="journal-link" data-open-memory="current:0">V Zápisníku</button></div>
        <p class="forest-guess-cost">Tip zabere 5 minut.</p>
        ${memoryNote}
        <div class="forest-find-options">${options}</div>
        <button class="forest-unknown${guess ? "" : " selected"}" data-current-species="" data-choice-number="4"><kbd>4</kbd> Nevím</button>
        <div class="forest-find-actions"><button class="primary" data-resolve="all" data-key-e><kbd>E</kbd> ${full ? (state.carriedItem ? "Košík i ruka jsou plné" : "Vzít do ruky") : "Vzít do košíku"}</button><button class="quiet" data-resolve="leave"><kbd>Q</kbd> Nechat</button></div>
      </section>`;
    }
    return utilityOverlay();
  }

  function basketItemRow(id, record, source, index) {
    record ||= { site: `${source}-${index}`, actual: id, speciesGuess: null };
    const unknown = !record?.speciesGuess;
    const guessedSpecies = unknown ? null : E.getSpecies(record.speciesGuess);
    const name = guessedSpecies?.name || "";
    const recognizedByNotebook = Boolean(guessedSpecies && record.memoryKnowledgeId);
    const notebookEntry = recognizedByNotebook
      ? state.knowledge.find((entry) => entry.id === record.memoryKnowledgeId && entry.type === "mushroom")
      : null;
    const forestChoices = state.phase === "forest" ? optionOrder(record.actual || id, `basket-${state.day}-${record.site}-${source}-${index}`).map((speciesId) => {
      const option = E.getSpecies(speciesId);
      return `<button class="text-species${record.speciesGuess === speciesId ? " selected" : ""}" data-inventory-species="${speciesId}" data-inventory-source="${source}" data-inventory-index="${index}">${esc(option.name)}</button>`;
    }).join("") : "";
    const forestContent = recognizedByNotebook
      ? `<small class="basket-notebook-description">${esc(notebookEntry?.text || guessedSpecies.atlas)}</small><div class="inventory-action-row notebook-inventory-action"><span>Určeno zápisníkem</span><button class="danger-link" data-discard-inventory="${source}:${index}">Vyhodit</button></div>`
      : `<div class="basket-inline-options">${forestChoices}<button class="text-species${unknown ? " selected" : ""}" data-inventory-species="" data-inventory-source="${source}" data-inventory-index="${index}">Nevím</button></div><div class="inventory-action-row"><span>Tipni si, zabere to 5 min. · <button class="journal-link inline" data-open-memory="${memoryTargetToken({ source, index })}">Zápisník</button></span><button class="danger-link" data-discard-inventory="${source}:${index}">Vyhodit</button></div>`;
    return `<article class="basket-overlay-item${unknown ? " unknown" : ""}${recognizedByNotebook ? " notebook-identified" : ""}">
      ${mushroomIcon(id)}
      <div class="basket-item-body">${unknown ? "" : `<b>${esc(name)}</b>`}
        ${state.phase === "forest" ? forestContent : ""}
      </div>
    </article>`;
  }

  function utilityOverlay() {
    if (!forestPanelView) return "";
    if (forestPanelView === "home-confirm") {
      return `<div class="scene-modal-backdrop"><section class="scene-modal confirm-home" role="dialog" aria-modal="true"><p class="kicker">Návrat z lesa</p><h4>Chceš se opravdu vydat domů?</h4><p>Cesta potrvá ${state.carriedItem ? "hodinu, protože něco neseš v ruce" : "30 minut"}.</p><div class="scene-modal-actions home-confirm-actions"><button class="quiet" data-close-forest-panel><kbd>Q</kbd> Ne, hledat dál</button>${state.bread ? '<button class="secondary" data-confirm-bread><kbd>R</kbd> Sníst chleba</button>' : ""}<button class="primary" data-confirm-home data-key-e><kbd>E</kbd> Ano, jít domů</button></div></section></div>`;
    }
    if (forestPanelView === "notes") {
      return `<div class="scene-modal-backdrop"><section class="scene-modal forest-book" role="dialog" aria-modal="true"><button class="modal-close" data-close-forest-panel aria-label="Zavřít"><kbd>Q</kbd><span>Zavřít</span></button><p class="kicker">Deník cesty · X</p><h4>Stopy dnešní cesty</h4><ol class="overlay-notes">${state.notes.map((note) => `<li>${esc(note)}</li>`).join("")}</ol></section></div>`;
    }
    if (forestPanelView === "memory") {
      const targetInfo = memoryTargetInfo();
      const describedEntry = memoryDescriptionId && state.knowledge.find((entry) => entry.id === memoryDescriptionId);
      if (describedEntry) {
        return `<div class="scene-modal-backdrop forest-soft-backdrop"><section class="scene-modal forest-book forest-soft-panel memory-description-panel" role="dialog" aria-modal="true"><button class="modal-close" data-close-memory-description aria-label="Zpět do zápisníku"><kbd>Q</kbd><span>Zpět</span></button><p class="kicker">Zápisník · popis</p>${knowledgeDescriptionContent(describedEntry)}</section></div>`;
      }
      const entries = state.knowledge.map((entry) => {
        const negative = entry.type === "exclusion";
        const icon = entry.species && E.getSpecies(entry.species)
          ? mushroomIcon(entry.species, "memory-icon")
          : "";
        const selected = targetInfo.record?.memoryKnowledgeId === entry.id;
        const rejected = !negative && targetInfo.record?.memoryRejectedSpecies?.includes(entry.species);
        const recognizeLabel = selected ? (negative ? "Poznána stopa" : "Určeno zápisníkem") : rejected ? "Není to tahle" : "Podle zápisníku";
        return `<li class="${negative ? "negative-memory" : "positive-memory"}${selected ? " memory-match" : ""}${rejected ? " memory-rejected" : ""}">${icon}<div class="memory-entry-copy"><b>${esc(entry.title)}</b><span>${esc(entry.text)}</span><div class="memory-actions"><button class="memory-recognize" data-recognize-knowledge="${esc(entry.id)}"${!memoryTarget || selected || rejected ? " disabled" : ""}>${recognizeLabel}</button><button class="memory-description" data-description-knowledge="${esc(entry.id)}">Popis</button><button class="forget-memory" data-forget-knowledge="${esc(entry.id)}">Vymazat</button></div></div></li>`;
      }).join("");
      return `<div class="scene-modal-backdrop forest-soft-backdrop"><section class="scene-modal forest-book forest-soft-panel" role="dialog" aria-modal="true"><button class="modal-close" data-close-forest-panel aria-label="Zavřít"><kbd>Q</kbd><span>Zavřít</span></button><p class="kicker">Zápisník · C · ${state.knowledge.length}/${E.MEMORY_LIMIT}</p><h4>Co sis poznamenala</h4><p class="memory-compare-note">${memoryTarget ? `Porovnáváš ${esc(targetInfo.label)}.` : "Otevři zápisník od konkrétní houby, pokud ji chceš porovnat."}</p><ul class="overlay-memory">${entries || '<li class="empty-memory">Zatím bez zapsané znalosti.</li>'}</ul></section></div>`;
    }
    const items = state.basket.map((id, index) => basketItemRow(id, state.basketRecords?.[index], "basket", index)).join("");
    const hand = state.carriedItem ? (state.carriedItem.kind === "mushroom"
      ? basketItemRow(state.carriedItem.id, state.carriedItem.record, "hand", 0)
      : `<article class="basket-overlay-item hand"><span class="large-potato">🥔</span><div class="basket-item-body"><b>Brambora v ruce</b>${state.phase === "forest" ? '<div class="inventory-action-row"><span>Do košíku na houby nepatří.</span><button class="danger-link" data-discard-inventory="hand:0">Zahodit</button></div>' : ""}</div></article>`) : "";
    const potatoes = state.potatoes ? `<article class="basket-overlay-item"><span class="large-potato">🥔</span><div class="basket-item-body"><b>Brambory × ${state.potatoes}</b><small>ve spíži</small></div></article>` : "";
    return `<div class="scene-modal-backdrop forest-soft-backdrop"><section class="scene-modal basket-overlay forest-soft-panel" role="dialog" aria-modal="true"><button class="modal-close" data-close-forest-panel aria-label="Zavřít"><kbd>Q</kbd><span>Zavřít</span></button><p class="kicker">Košík · F</p><h4>Co sis odnesla z porostu</h4><div class="basket-overlay-list">${items || (!hand && !potatoes ? "<p class=\"empty\">Košík je zatím prázdný.</p>" : "")}${hand}${potatoes}</div></section></div>`;
  }

  function confidenceState(record) {
    if (record?.homeDecision === "memory" || record?.homeDecision === "lexicon") {
      return { className: "confidence-certain", badge: "✓", label: "potvrzená" };
    }
    if (record?.homeDecision === "memory-exclusion") {
      return { className: "confidence-exclusion", badge: "−", label: "známé vyloučení" };
    }
    if (record?.homeDecision === "guess" || record?.forestGuess || record?.speciesGuess) {
      return { className: "confidence-guess", badge: "~", label: "jen tip" };
    }
    return { className: "confidence-unknown", badge: "?", label: "neurčená" };
  }

  function tableMushrooms(mode) {
    const buttons = state.basket.map((id, index) => {
      const record = state.basketRecords?.[index] || {};
      const confidence = confidenceState(record);
      const guessed = record.speciesGuess ? E.getSpecies(record.speciesGuess) : null;
      const active = tableFocus === index;
      const chosen = mode === "soup" ? selectedSoup.includes(index) : mode === "potion" ? selected.includes(index) : false;
      return `<button class="table-mushroom ${confidence.className}${active ? " focused" : ""}${chosen ? " chosen" : ""}" data-table-mushroom="${index}" data-table-mode="${mode}" title="${esc(guessed?.name || "Neurčená houba")}">
        ${mushroomIcon(id, "table-mushroom-icon")}<span class="confidence-badge">${confidence.badge}</span><small>${index + 1}</small>
      </button>`;
    }).join("");
    const potatoes = mode === "soup" ? Array.from({ length: state.potatoes || 0 }, (_, index) => {
      const chosen = index < selectedSoupPotatoes;
      return `<button class="table-potato${chosen ? " chosen" : ""}" data-toggle-potato="${index}" title="Brambora ${index + 1}">🥔<small>${index + 1}</small></button>`;
    }).join("") : "";
    return `<div class="mushroom-worktable table-${mode}" aria-label="Houby na stole">${buttons || '<span class="empty-table">Košík je prázdný</span>'}${potatoes}</div>`;
  }

  function homeMushroomDialog(index) {
    if (!Number.isInteger(index) || !state.basket[index]) {
      return `<section class="table-dialog table-dialog-empty"><p class="kicker">Stůl u lexikonu</p><h3>Vyber houbu na stole</h3><p>Barva světla ukazuje jistotu: zelená je potvrzená, zlatá je tip a červená zůstává neurčená.</p></section>`;
    }
    const id = state.basket[index];
    const species = E.getSpecies(id);
    const record = state.basketRecords?.[index] || {};
    const decision = record.homeDecision || null;
    const lookupGuessId = record.forestGuess || record.homeGuess || null;
    const lookupGuess = lookupGuessId ? E.getSpecies(lookupGuessId) : null;
    const tippedLookup = Boolean(lookupGuess);
    const lexiconCost = tippedLookup ? 1 : 2;
    const lexiconMinutes = tippedLookup ? 15 : 30;
    const knowledgeId = tippedLookup && lookupGuessId !== id ? `not:${id}:${lookupGuessId}` : `mushroom:${id}`;
    const lexiconDisabled = state.focus < lexiconCost || E.isDepleted(state);
    const lexiconLabel = E.isDepleted(state) ? "Lexikon teď nezvládneš" : `Lexikon · ${lexiconMinutes} min · ${lexiconCost} soustředění`;
    const picture = `<div class="table-dialog-specimen">${mushroomIcon(id, "table-dialog-icon")}</div>`;

    if (decision === "memory" || decision === "lexicon") {
      return `<section class="table-dialog confidence-certain">${picture}<p class="kicker">Houba ${index + 1} · ${decision === "memory" ? "potvrzená zápisníkem" : "ověřená lexikonem"}</p><h3>${esc(species.name)}</h3><p>${esc(species.atlas)}</p></section>`;
    }
    if (decision === "disproved") {
      const excluded = E.getSpecies(record.forestGuess || record.homeGuess);
      return `<section class="table-dialog confidence-unknown">${picture}<p class="kicker">Houba ${index + 1} · tip vyvrácen</p><h3>Nevím</h3><p>Lexikon potvrdil pouze to, že to není ${esc(excluded.name)}. Záporná stopa zůstala v zápisníku.</p></section>`;
    }
    if (decision === "guess") {
      return `<section class="table-dialog confidence-guess">${picture}<p class="kicker">Houba ${index + 1} · neověřený tip</p><h3>${esc(lookupGuess?.name || "Nevím")}</h3><p>${record.forestGuess ? "Tip sis přinesla z lesa." : "Tip vznikl u stolu."} Zatím svítí zlatě.</p><button class="secondary" data-home-lexicon="${index}"${lexiconDisabled ? " disabled" : ""}>Ověřit v lexikonu · 15 min · 1 soustředění</button></section>`;
    }

    const options = optionOrder(id, `home:${state.day || 1}:${index}:${record.site || id}`).map((optionId, optionIndex) => {
      const option = E.getSpecies(optionId);
      return `<button class="id-choice species-button text-only" data-home-guess="${esc(optionId)}" data-home-guess-index="${index}" data-choice-number="${optionIndex + 1}"><kbd>${optionIndex + 1}</kbd>${esc(option.name)}</button>`;
    }).join("");
    return `<section class="table-dialog confidence-unknown">${picture}<p class="kicker">Houba ${index + 1} · určování u lexikonu</p><h3>Co si myslíš, že je to za houbu?</h3><div class="table-dialog-options">${options}</div><div class="table-dialog-actions"><button class="secondary" data-home-lexicon="${index}"${lexiconDisabled ? " disabled" : ""}>${esc(lexiconLabel)}</button><button class="id-choice unknown-choice" data-home-unknown="${index}" data-choice-number="4"><kbd>4</kbd> Nevím</button></div><p class="table-dialog-hint">Tip zabere 15 minut. Klávesy 1–4 fungují stejně jako v lese.</p></section>`;
  }

  function homeArrivalPanel() {
    const start = Math.max(state.minutes, E.TIMINGS.workStart);
    const waiting = state.minutes < E.TIMINGS.workStart;
    const emergency = E.isDepleted(state);
    const heading = emergency ? "Dnes už jen určit houby a postavit hrnec" : waiting ? "Do práce zbývá chvíle na čaj" : "Dílna už čeká";
    const copy = emergency
      ? `${state.forcedHome || "Došlo ti jídlo nebo soustředění."} Do 16:00 jen čekáš; potom známé houby poznáš podle zápisníku, ostatní můžeš nechat jako „nevím“ a uvařit polévku. Lektvar teď nezvládneš.`
      : waiting
        ? "Práce začne v 16:00. Každá celá hodina u čaje vrátí 1 soustředění; doma sytost neubývá."
        : `Přišla jsi až po 16:00, takže začneš hned v ${E.clock(start)}.`;
    return `<main class="card main-card cottage-card indoor-card"><div class="cottage-stage indoor-stage">
      ${phaseHud()}
      <div class="cottage-window"><i></i><i></i></div><div class="rocking-chair"><span></span></div><div class="cottage-tea-table"><div class="tea-cup">☕<i></i><i></i></div></div>
      <div class="scene-copy"><p class="kicker">Chaloupka · příjezd ${E.clock(state.arrivalMinutes ?? state.minutes)}</p><h3>${heading}</h3><p>${esc(copy)}</p><div class="home-arrival-actions"><button class="primary" data-start-home-work data-key-e><kbd>E</kbd> Začít pracovat v ${E.clock(start)}</button></div></div>
      ${utilityOverlay()}
    </div></main>`;
  }

  function homeIdentificationTablePanel() {
    const unresolved = state.basketRecords.some((record) => !record?.homeDecision);
    return `<main class="card main-card home-identification indoor-card"><div class="workroom-stage indoor-stage">
      ${phaseHud()}
      <div class="workroom-window" aria-hidden="true"><i></i><i></i><b>16:00</b></div>
      <div class="kitchen-shelf workroom-shelf" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="hanging-herbs">☘︎ ☘︎ ☘︎</div>
      <div class="workroom-table" aria-hidden="true"></div>
      <div class="lexicon-prop" aria-hidden="true"><span>LEXIKON</span><i></i></div>
      ${tableMushrooms("identify")}
      <section class="indoor-caption"><p class="kicker">Dílna · ${E.clock(state.minutes)}</p><h3>Houby vedle lexikonu</h3><p>Klikni na houbu. Jistota zůstává vidět přímo na stole.</p><button class="primary" data-finish-identification data-key-e${unresolved ? " disabled" : ""}><kbd>E</kbd> ${unresolved ? "Rozhodnout u všech hub" : "Dokončit určování"}</button></section>
      ${homeMushroomDialog(tableFocus)}
      ${utilityOverlay()}
    </div></main>`;
  }

  function homeIdentificationPanel() {
    const unresolved = state.basketRecords.some((record) => !record?.homeDecision);
    const rows = state.basket.map((id, index) => {
      const species = E.getSpecies(id);
      const record = state.basketRecords?.[index] || {};
      const decision = record.homeDecision || null;
      const lookupGuessId = record.forestGuess || record.homeGuess || null;
      const lookupGuess = lookupGuessId ? E.getSpecies(lookupGuessId) : null;
      const tippedLookup = Boolean(lookupGuess);
      const lexiconCost = tippedLookup ? 1 : 2;
      const lexiconMinutes = tippedLookup ? 15 : 30;
      const knowledgeId = tippedLookup && lookupGuessId !== id
        ? `not:${id}:${lookupGuessId}`
        : `mushroom:${id}`;
      const lexiconDisabled = state.focus < lexiconCost || E.isDepleted(state);
      const lexiconLabel = E.isDepleted(state)
          ? "Lexikon teď nezvládneš"
          : `Lexikon · ${lexiconMinutes} min · ✦ ${lexiconCost}`;
      const journalButton = `<button class="memory-action" data-open-memory="home:${index}">Zápisník</button>`;
      const lexiconButton = `<button class="lexicon-action" data-home-lexicon="${index}"${lexiconDisabled ? " disabled" : ""}>${esc(lexiconLabel)}</button>`;
      if (decision === "memory") {
        return `<article class="home-id-row known">${mushroomIcon(id, "home-row-icon")}<div class="home-id-options">
          <h4>${esc(species.name)}</h4>
          <p class="atlas-line">${esc(species.atlas)}</p>
          <div class="row-actions">${journalButton}</div>
        </div></article>`;
      }
      if (decision === "lexicon") {
        return `<article class="home-id-row known">${mushroomIcon(id, "home-row-icon")}<div class="home-id-options">
          <h4>${esc(species.name)}</h4>
          <p class="atlas-line">${esc(species.atlas)}</p>
          <div class="row-actions">${journalButton}</div>
        </div></article>`;
      }
      if (decision === "memory-exclusion") {
        const excluded = record.memoryExclusion ? E.getSpecies(record.memoryExclusion) : null;
        return `<article class="home-id-row memory-negative">${mushroomIcon(id, "home-row-icon")}<div class="home-id-options">
          <h4 class="unknown-label">Není ${esc(excluded?.name || "dříve vyloučený druh")}</h4>
          <p class="atlas-line">Zápisník poznal tuto houbu, ale její druh ještě nepotvrdil.</p>
          <div class="row-actions">${lexiconButton}${journalButton}</div>
        </div></article>`;
      }
      if (decision === "disproved") {
        const excluded = E.getSpecies(record.forestGuess || record.homeGuess);
        return `<article class="home-id-row unknown">${mushroomIcon(id, "home-row-icon")}<div class="home-id-options">
          <h4 class="unknown-label">Nevím</h4>
          <p class="atlas-line">Lexikon zjistil jen to, že tahle houba není ${esc(excluded.name)}.</p>
          <div class="row-actions">${journalButton}</div>
        </div></article>`;
      }
      if (decision === "guess") {
        return `<article class="home-id-row guessed">${mushroomIcon(id, "home-row-icon")}<div class="home-id-options">
          <h4 class="guess-label">${esc(lookupGuess.name)}</h4>
          <p class="atlas-line">Neověřený tip. Do vaření půjde pod tímto názvem.</p>
          <div class="row-actions">${lexiconButton}${journalButton}</div>
        </div></article>`;
      }
      const unknownSelected = decision === "unknown";
      const guessOptions = optionOrder(id, `home:${state.day || 1}:${index}:${record.site || id}`).map((optionId) => {
        const option = E.getSpecies(optionId);
        return `<button class="id-choice species-button text-only guess-option" data-home-guess="${esc(optionId)}" data-home-guess-index="${index}">${esc(option.name)}</button>`;
      }).join("");
      return `<article class="home-id-row unknown">${mushroomIcon(id, "home-row-icon")}<div class="home-id-options">
        ${unknownSelected ? '<h4 class="unknown-label">Nevím</h4>' : ""}
        ${unknownSelected ? "" : `<div class="id-grid species-options">${guessOptions}</div>`}
        <div class="row-actions">
          ${lexiconButton}
          ${journalButton}
          <button class="id-choice unknown-choice${unknownSelected ? " selected" : ""}" data-home-unknown="${index}">Nevím</button>
        </div>
      </div></article>`;
    }).join("");
    return `<main class="card main-card home-identification indoor-card compact-list-card"><div class="workroom-stage indoor-stage compact-list-stage">
      ${phaseHud()}
      <div class="workroom-window compact-workroom-window" aria-hidden="true"><i></i><i></i><b>16:00</b></div>
      <div class="kitchen-shelf workroom-shelf compact-workroom-shelf" aria-hidden="true"><i></i><i></i><i></i></div><div class="alchemy-table compact-alchemy-table" aria-hidden="true"><span>⚗</span><b>♨</b></div><div class="hanging-herbs">☘︎ ☘︎ ☘︎</div>
      <section class="compact-panel workroom-copy home-list-copy"><header class="compact-panel-head"><div><p class="kicker">Dílna · ${E.clock(state.minutes)}</p><h3>Určení hub</h3></div><p class="identification-legend"><span class="certain-key">Zápisník a lexikon = jisté</span><span class="guess-key">Tip = nejisté</span><span class="unknown-key">Nevím = jisté</span></p></header><div class="home-id-list">${rows}</div><footer class="compact-panel-footer"><button class="primary finish-home-id" data-finish-identification data-key-e${unresolved ? " disabled" : ""}><kbd>E</kbd> ${unresolved ? "Rozhodnout u všech hub" : "Dokončit určování"}</button></footer></section>
      ${utilityOverlay()}
    </div></main>`;
  }
  function orderPanel() {
    const soupDone = Boolean(state.soup);
    const potionDone = Boolean(state.potion);
    const soupBlocked = false;
    const potionBlocked = !E.canBrewPotion(state);
    const hasDecision = soupDone || potionDone;
    const pot = potStatusInfo();
    const soupNote = pot.status !== "clean"
      ? `${pot.note} Nejdřív ho umyj.`
      : `60 min · ✦ ${E.COSTS.soupFocus}. Polévku můžeš dovařit i z posledních sil.`;
    return `
      <main class="card main-card evening-card indoor-card">
        <div class="evening-stage indoor-stage">
          ${phaseHud()}
          <div class="kitchen-window evening-window" aria-hidden="true"><i></i><i></i></div>
          <div class="kitchen-shelf cooking-shelf evening-shelf" aria-hidden="true"><i></i><i></i><i></i></div>
          <div class="copper-pans evening-pans" aria-hidden="true"><i></i><i></i><i></i></div>
          <div class="alchemy-bench evening-bench" aria-hidden="true"><span class="retort">⚗</span><span class="flask flask-a"></span><span class="flask flask-b"></span><span class="candle">♨</span></div>
          <div class="hanging-herbs evening-herbs" aria-hidden="true">☘︎ ☘︎ ☘︎</div>
          <section class="evening-copy">
            <p class="kicker">Večer · chata · ${E.clock(state.minutes)}</p>
            <h3>${hasDecision ? "Co ještě dnes postavíš na kamna?" : potionBlocked ? "Nejdřív musí přijít polévka" : "Hlad se posadil ke stolu dřív než ty"}</h3>
            <p class="night-rules"><b>Po ${E.clock(E.TIMINGS.nightStart)} už je tma.</b> Pracuje se hůř a každá započatá hodina krátí odpočinek na další den. Některé lektvary však uvaříš jen při měsíci.</p>
            <div class="order-grid">
              <button class="order-card" data-order="soup-first"${soupDone || pot.status !== "clean" || soupBlocked ? " disabled" : ""}><span>🥣</span><b>${soupDone ? esc(state.soup.title) : "Vařit polévku"}</b><small>${soupDone ? "O polévce už je pro dnešek rozhodnuto." : soupNote}</small></button>
              <button class="order-card" data-order="potion-first"${potionBlocked || potionDone ? " disabled" : ""}><span>🧪</span><b>${potionDone ? esc(state.potion.title) : "Vařit lektvar"}</b><small>${potionDone ? "O lektvaru už je pro dnešek rozhodnuto." : potionBlocked ? `Potřebuješ 2 sytosti a ✦ ${E.COSTS.potionFocus}.` : `60 min · ✦ ${E.COSTS.potionFocus}. Přesnost ovlivní hlad, noc i zbylé soustředění.`}</small></button>
            </div>
            <div class="choice-row">${pot.status !== "clean" ? `<button class="secondary" data-wash-pot>${esc(pot.label)}</button>` : ""}<button class="quiet" data-finish-evening>Ukončit večer</button></div>
          </section>
          ${utilityOverlay()}
        </div>
      </main>`;
  }

  function identificationStatus(record) {
    if (record?.homeDecision === "memory") return { className: "confirmed-memory", label: "potvrzeno zápisníkem" };
    if (record?.homeDecision === "lexicon") return { className: "confirmed-lexicon", label: "potvrzeno lexikonem" };
    if (record?.homeDecision === "memory-exclusion") {
      const excluded = record.memoryExclusion ? E.getSpecies(record.memoryExclusion) : null;
      return { className: "unknown-species", label: `zápisník potvrdil: není ${excluded?.name || "dříve vyloučený druh"}` };
    }
    if (record?.homeDecision === "guess") return { className: "unverified-tip", label: "neověřeno zápisníkem ani lexikonem" };
    if (record?.homeDecision === "disproved") return { className: "unknown-species", label: "tip vyvrácen lexikonem · druh neznámý" };
    return { className: "unknown-species", label: "druh zůstal neurčený" };
  }

  function cookingMushroomDialog(kind, index) {
    const potion = kind === "potion";
    if (!Number.isInteger(index) || !state.basket[index]) {
      return `<section class="table-dialog cooking-table-dialog table-dialog-empty"><p class="kicker">${potion ? "Stůl u baněk" : "Stůl u hrnce"}</p><h3>Vyber houbu na stole</h3><p>Po kliknutí uvidíš její zapsané jméno, jistotu určení a můžeš ji přidat do směsi.</p></section>`;
    }
    const id = state.basket[index];
    const record = state.basketRecords?.[index] || {};
    const guessed = record.speciesGuess ? E.getSpecies(record.speciesGuess) : null;
    const status = identificationStatus(record);
    const confidence = confidenceState(record);
    const chosen = potion ? selected.includes(index) : selectedSoup.includes(index);
    return `<section class="table-dialog cooking-table-dialog ${confidence.className}">
      <div class="table-dialog-specimen">${mushroomIcon(id, "table-dialog-icon")}</div>
      <p class="kicker">Houba ${index + 1} · ${esc(status.label)}</p>
      <h3>${esc(guessed?.name || "Neurčená houba")}</h3>
      <p>${potion ? "Položíš ji k baňkám pro lektvar." : "Položíš ji vedle hrnce pro polévku."} Skutečný účinek se ukáže až po vaření.</p>
      <button class="${chosen ? "quiet" : "primary"}" data-toggle-cooking="${kind}:${index}">${chosen ? "Odebrat ze směsi" : potion ? "Přidat k baňkám" : "Přidat k hrnci"}</button>
    </section>`;
  }

  function cookingTablePanel(kind) {
    const potion = kind === "potion";
    const focusCost = potion ? E.COSTS.potionFocus : E.COSTS.soupFocus;
    const alchemyLight = E.isNight(state.minutes) ? "alchemy-night" : "alchemy-day";
    const blockedPotion = potion && !E.canBrewPotion(state);
    const blockedSoup = false;
    const blocked = blockedPotion || blockedSoup;
    const nightCooking = E.isNight(state.minutes) || E.isNight(state.minutes + E.TIMINGS[kind]);
    const room = potion
      ? `<div class="alchemy-window ${alchemyLight}" aria-hidden="true"><i></i><i></i></div><div class="alchemy-shelves" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="alchemy-bench" aria-hidden="true"><span class="retort">⚗</span><span class="flask flask-a"></span><span class="flask flask-b"></span><span class="candle">♨</span></div><div class="hanging-herbs alchemy-herbs" aria-hidden="true">☘︎ ☘︎ ☘︎</div>`
      : `<div class="kitchen-window" aria-hidden="true"><i></i><i></i></div><div class="kitchen-shelf cooking-shelf" aria-hidden="true"><i></i><i></i><i></i></div><div class="copper-pans" aria-hidden="true"><i></i><i></i><i></i></div><div class="kitchen-hearth" aria-hidden="true"><span class="soup-pot"></span><i class="steam steam-one"></i><i class="steam steam-two"></i><b>♨</b></div><div class="hanging-herbs kitchen-herbs" aria-hidden="true">☘︎ ☘︎ ☘︎</div>`;
    const selectedCount = potion ? selected.length : selectedSoup.length + selectedSoupPotatoes;
    return `<main class="card main-card cooking-card indoor-card ${potion ? "alchemy-card" : "kitchen-card"}"><div class="cooking-stage indoor-stage ${potion ? "alchemy-cooking-stage " + alchemyLight : "kitchen-cooking-stage"}">
      ${phaseHud()}${room}<div class="workroom-table cooking-worktable" aria-hidden="true"></div>${tableMushrooms(kind)}
      <section class="indoor-caption cooking-caption"><p class="kicker">${potion ? "Alchymistická dílna" : "Kuchyně"} · ${E.clock(state.minutes)} → +${E.TIMINGS[kind]} min · ✦ ${focusCost}</p><h3>${potion ? "Houby čekají u baněk" : "Houby čekají u polévky"}</h3><p>${blocked ? `Chybí síla: ${potion ? `lektvar potřebuje 2 sytosti a ${focusCost} soustředění` : `polévka potřebuje ${focusCost} soustředění`}.` : `Vybráno: ${selectedCount}. Kliknutím otevři houbu a přidej ji do směsi.`}</p><p class="cooking-night-note">${nightCooking ? "Tahle hodina zasáhne do noci a nese noční riziko." : `Do ${E.clock(E.TIMINGS.nightStart)} vaříš bez nočního postihu.`}</p><div class="choice-row"><button class="primary" data-cook="${kind}" data-key-e${blocked ? " disabled" : ""}><kbd>E</kbd> ${potion ? "Uvařit lektvar" : "Uvařit polévku"} · ${E.TIMINGS[kind]} min · ✦ ${focusCost}</button>${potion ? `<button class="quiet" data-skip="potion">${blockedPotion ? "Jít k polévce" : "Vynechat lektvar"}</button>` : '<button class="quiet" data-skip="soup">Vynechat polévku</button>'}</div></section>
      ${cookingMushroomDialog(kind, tableFocus)}${utilityOverlay()}
    </div></main>`;
  }

  function cookingPanel(kind) {
    const potion = kind === "potion";
    const focusCost = potion ? E.COSTS.potionFocus : E.COSTS.soupFocus;
    const alchemyLight = E.isNight(state.minutes) ? "alchemy-night" : "alchemy-day";
    const blockedPotion = potion && !E.canBrewPotion(state);
    const blockedSoup = false;
    const blocked = blockedPotion || blockedSoup;
    const nightCooking = E.isNight(state.minutes) || E.isNight(state.minutes + E.TIMINGS[kind]);
    const items = state.basket.map((id, index) => {
      const species = E.getSpecies(id);
      const record = state.basketRecords?.[index];
      const guessed = record?.speciesGuess ? E.getSpecies(record.speciesGuess) : null;
      const label = guessed?.name || "Neurčená houba";
      const status = identificationStatus(record);
      if (potion) {
        const checked = selected.includes(index) ? " checked" : "";
        return `<label class="ingredient ${status.className}"><input type="checkbox" data-ingredient="${index}"${checked}>${mushroomIcon(id, "ingredient-icon")}<span><b>${esc(label)}</b><small class="ingredient-origin">${esc(status.label)}</small><small>vyber dvě houby pro lektvar</small></span></label>`;
      }
      const checked = selectedSoup.includes(index) ? " checked" : "";
      return `<label class="ingredient ${status.className}"><input type="checkbox" data-soup-ingredient="${index}"${checked}>${mushroomIcon(id, "ingredient-icon")}<span><b>${esc(label)}</b><small class="ingredient-origin">${esc(status.label)}</small><small>výběrem ji považuješ za vhodnou do polévky</small></span></label>`;
    }).join("");
    const potatoes = potion ? "" : Array.from({ length: state.potatoes || 0 }, (_, index) => `<label class="ingredient"><input type="checkbox" data-soup-potato="${index}"${index < selectedSoupPotatoes ? " checked" : ""}><span class="potato-choice">🥔</span><span><b>Brambora ${index + 1}</b><small>ze spíže · vyber ji do hrnce</small></span></label>`).join("");
    const room = potion
      ? `<div class="alchemy-window ${alchemyLight}" aria-hidden="true"><i></i><i></i></div>
          <div class="alchemy-shelves" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
          <div class="alchemy-bench" aria-hidden="true"><span class="retort">⚗</span><span class="flask flask-a"></span><span class="flask flask-b"></span><span class="candle">♨</span></div>
          <div class="hanging-herbs alchemy-herbs" aria-hidden="true">☘︎ ☘︎ ☘︎</div>`
      : `<div class="kitchen-window" aria-hidden="true"><i></i><i></i></div>
          <div class="kitchen-shelf cooking-shelf" aria-hidden="true"><i></i><i></i><i></i></div>
          <div class="copper-pans" aria-hidden="true"><i></i><i></i><i></i></div>
          <div class="kitchen-hearth" aria-hidden="true"><span class="soup-pot"></span><i class="steam steam-one"></i><i class="steam steam-two"></i><b>♨</b></div>
          <div class="hanging-herbs kitchen-herbs" aria-hidden="true">☘︎ ☘︎ ☘︎</div>`;
    return `
      <main class="card main-card cooking-card indoor-card compact-list-card ${potion ? "alchemy-card" : "kitchen-card"}">
        <div class="cooking-stage indoor-stage compact-list-stage ${potion ? "alchemy-cooking-stage " + alchemyLight : "kitchen-cooking-stage"}">
          ${phaseHud()}
          ${room}
          <section class="cooking-copy compact-panel cooking-list-panel">
            <p class="kicker">${potion ? "Alchymistická dílna · lektvar" : "Kuchyně · polévka"} · ${E.clock(state.minutes)} → +${E.TIMINGS[kind]} min · ✦ ${focusCost}</p>
            <h3>${potion ? "Dvě houby a přesný rytmus" : "Co opravdu vložíš do hrnce?"}</h3>
            <p>${blocked ? `Chybí síla: ${potion ? `lektvar potřebuje 2 sytosti a ${focusCost} soustředění` : `polévka potřebuje ${focusCost} soustředění`}.` : potion ? `Vyber právě dvě houby. Schopnost vařit před zaplacením ceny: <b>${E.cookingAbility(state)}</b>.` : `Vyber podle vzhledu, jména a zápisníku; následky ukáže až hotová polévka v ${E.clock(state.minutes + E.TIMINGS.soup)}.`}</p>
            <p class="cooking-night-note">${nightCooking ? "Tahle hodina zasáhne do noci a nese noční riziko." : `Do ${E.clock(E.TIMINGS.nightStart)} vaříš bez nočního postihu.`}</p>
            <div class="ingredients">${items}${potatoes}${(!items && !potatoes) ? `<p class="empty">${potion ? "Košík je prázdný." : "Nemáš žádnou dostupnou surovinu do polévky."}</p>` : ""}</div>
          </section>
          <div class="workstation-action ${potion ? "alchemy-action" : "kitchen-action"}">
            <span>${potion ? "U baněk" : "U hrnce"}</span>
            <button class="primary" data-cook="${kind}" data-key-e${blocked ? " disabled" : ""}><kbd>E</kbd> ${potion ? "Uvařit lektvar" : "Uvařit polévku"} · ${E.TIMINGS[kind]} min · ✦ ${focusCost}</button>
            <button class="quiet workstation-skip" data-skip="${kind}" data-key-q><kbd>Q</kbd> ${potion ? "Vynechat lektvar" : "Vynechat polévku"}</button>
          </div>
          ${utilityOverlay()}
        </div>
      </main>`;
  }

  function resultArtwork(kind, tone) {
    if (kind === "potion") {
      return `<div class="result-art potion-art tone-${esc(tone || "plain")}" aria-hidden="true"><span class="potion-glow"></span><span class="potion-bottle"><i></i></span><b>✦</b></div>`;
    }
    return `<div class="result-art soup-art tone-${esc(tone || "plain")}" aria-hidden="true"><span class="result-bowl"><i></i></span><b class="result-steam">⌁</b><em>✦</em></div>`;
  }

  function cookingResultPanel() {
    const kind = state.cookingResult?.kind === "potion" ? "potion" : "soup";
    const potion = kind === "potion";
    const result = state[kind] || { title: "Vaření skončilo", text: "Výsledek čeká na stole.", tone: "plain" };
    const alchemyLight = E.isNight(state.minutes) ? "alchemy-night" : "alchemy-day";
    const nextLabel = state.nextPhase === "potion"
      ? "Pokračovat k lektvaru"
      : state.nextPhase === "soup"
        ? "Pokračovat k polévce"
        : "Uzavřít den";
    const room = potion
      ? `<div class="alchemy-window ${alchemyLight}" aria-hidden="true"><i></i><b></b></div><div class="alchemy-shelves" aria-hidden="true"><i></i><i></i><i></i></div><div class="alchemy-bench" aria-hidden="true"><span class="retort">⚗</span><span class="flask flask-a"></span><span class="flask flask-b"></span><span class="candle">♨</span></div><div class="hanging-herbs alchemy-herbs" aria-hidden="true">☘︎ ☘︎ ☘︎</div>`
      : `<div class="kitchen-window" aria-hidden="true"><i></i><i></i></div><div class="kitchen-shelf cooking-shelf" aria-hidden="true"><i></i><i></i><i></i></div><div class="copper-pans" aria-hidden="true"><i></i><i></i><i></i></div><div class="kitchen-hearth" aria-hidden="true"><span class="soup-pot"></span><i class="steam steam-one"></i><i class="steam steam-two"></i><b>♨</b></div><div class="hanging-herbs kitchen-herbs" aria-hidden="true">☘︎ ☘︎ ☘︎</div>`;
    const soupWaiting = !potion && result.eaten === null;
    const actions = soupWaiting
      ? `<p class="soup-decision-hint">Co nesníš, zůstane přes noc v hrnci. Ráno to můžeš sníst studené, nebo nechat na odpolední úklid.</p><div class="cooking-result-actions"><button class="primary" data-eat-soup data-key-e><kbd>E</kbd> Sníst polévku · 30 min</button><button class="quiet" data-leave-soup data-key-q><kbd>Q</kbd> Nechat v hrnci</button></div>`
      : `<button class="primary" data-continue-cooking data-key-e><kbd>E</kbd> ${esc(nextLabel)}</button>`;
    return `<main class="card main-card cooking-card indoor-card ${potion ? "alchemy-card" : "kitchen-card"}"><div class="cooking-stage indoor-stage result-workstation-stage ${potion ? "alchemy-cooking-stage " + alchemyLight : "kitchen-cooking-stage"}">${phaseHud()}${room}<section class="cooking-copy cooking-result-copy result-${esc(result.tone || "plain")}">${resultArtwork(kind, result.tone)}<p class="kicker">${potion ? "Výsledek lektvaru" : "Výsledek polévky"} · ${E.clock(state.minutes)}</p><h3>${esc(result.title)}</h3><p>${esc(result.text)}</p>${actions}</section>${utilityOverlay()}</div></main>`;
  }

  function sidePanel() {
    const basket = state.basket.map((id, index) => {
      const record = state.basketRecords?.[index];
      const guessed = record?.speciesGuess ? E.getSpecies(record.speciesGuess) : null;
      const name = guessed?.name || "Neurčená houba";
      const method = record?.consultedLexicon ? "lexikon" : record?.speciesGuess ? "tip" : "bez určení";
      return `<li>${esc(name)} <small>${method}</small></li>`;
    }).join("");
    const knowledge = state.knowledge.map((entry) =>
      `<li><b>${esc(entry.title)}</b><span>${esc(entry.text)}</span></li>`
    ).join("");
    return `
      <aside class="card side-card">
        <section><p class="kicker">Košík</p><ul class="basket-list">${basket || `<li class="muted">zatím prázdný</li>`}${state.potatoes ? `<li>Brambory × ${state.potatoes}</li>` : ""}</ul></section>
        <section><p class="kicker">Zápisník · ${state.knowledge.length}/${E.MEMORY_LIMIT}</p><ul class="memory-list">${knowledge || `<li class="muted">zatím bez znalostí</li>`}</ul></section>
        <section><p class="kicker">Deník cesty</p><ol class="notes">${state.notes.slice(0, 7).map((note) => `<li>${esc(note)}</li>`).join("")}</ol></section>
      </aside>`;
  }

  function renderFireplace() {
    stopScene();
    app.innerHTML = `${header()}
      <section class="ending ending-room indoor-stage fireplace-room">
        ${phaseHud()}
        <div class="ending-window" aria-hidden="true"><i></i><i></i></div>
        <div class="kitchen-hearth ending-hearth fireplace-focus" aria-hidden="true"><span class="soup-pot"></span><b class="fire">♨</b></div>
        <div class="rocking-chair fireplace-chair" aria-hidden="true"><span></span></div>
        <section class="fireplace-copy">
          <p class="eyebrow">U krbu · konec dne ${state.day || 1}</p>
          <h1>Ještě chvíli u ohně</h1>
          <p>Den je uzavřený. Zápisník zůstane, ostatní se ráno rozloží znovu.</p>
          <div class="ending-actions">
            <button class="primary big" data-next-day data-key-e><kbd>E</kbd> Další den</button>
            <button class="quiet big" data-ending-summary data-key-q><kbd>Q</kbd> Zpět na závěr dne</button>
          </div>
        </section>
        ${utilityOverlay()}
      </section>`;
    bind();
    paintMushroomIcons();
  }

  function renderEnding() {
    if (endingView === "fireplace") return renderFireplace();
    stopScene();
    const soup = state.soup || { title: "Bez polévky", text: "Hrnec zůstal stranou.", tone: "plain" };
    const potion = state.potion || { title: "Bez lektvaru", text: "Lahvička zůstala prázdná.", tone: "plain" };
    const score = E.scoreDay(state);
    const morning = E.morningPreview(state);
    const soupTitle = Number(soup.potatoesUsed || 0) > 0 ? "Brambora zachránila večer" : "Houbový vývar zahřál večer";
    const title = soup.ok && potion.ok ? "Teplo dole, světlo nahoře" : soup.ok ? soupTitle : potion.ok ? "Kouzlo nalačno" : "Les si nechal poslední slovo";
    const points = (value) => value > 0 ? `+${value}` : String(value);
    const identificationReview = (state.identificationSummary || []).map((record) => {
      const status = identificationStatus(record);
      const guessed = record.speciesGuess ? E.getSpecies(record.speciesGuess) : null;
      const excluded = record.memoryExclusion ? E.getSpecies(record.memoryExclusion) : null;
      const name = record.homeDecision === "memory-exclusion"
        ? `Není ${excluded?.name || "vyloučený druh"}`
        : status.className === "unverified-tip" && guessed
          ? `Tip: ${guessed.name}`
          : guessed?.name || "Nevím";
      return `<li class="ending-identification ${status.className}">${mushroomIcon(record.actual, "ending-id-icon ending-summary-icon")}<span><b>${esc(name)}</b><small>${esc(status.label)}</small></span></li>`;
    }).join("");
    app.innerHTML = `${header()}
      <section class="ending ending-room indoor-stage">
        ${phaseHud()}
        <div class="ending-window" aria-hidden="true"><i></i><i></i></div>
        <div class="kitchen-shelf cooking-shelf ending-shelf" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="kitchen-hearth ending-hearth" aria-hidden="true"><span class="soup-pot"></span><b class="fire">♨</b></div>
        <div class="alchemy-bench ending-bench" aria-hidden="true"><span class="retort">⚗</span><span class="flask flask-a"></span><span class="flask flask-b"></span><span class="candle">♨</span></div>
        <div class="ending-table" aria-hidden="true"><span>🥣</span><i></i><b>🧪</b></div>
        <div class="ending-copy">
          <header class="ending-head"><p class="eyebrow">Konec dne ${state.day || 1}</p><h1>${esc(title)}</h1></header>
          <div class="ending-summary">
            <div class="ending-primary-summary">
              <div class="ending-grid">
                <article class="result ${esc(soup.tone)}"><span class="ending-summary-icon ending-result-icon">🥣</span><div><h3>${esc(soup.title)}</h3><p>${esc(soup.text)}</p></div></article>
                <article class="result ${esc(potion.tone)}"><span class="ending-summary-icon ending-result-icon">🧪</span><div><h3>${esc(potion.title)}</h3><p>${esc(potion.text)}</p></div></article>
              </div>
              ${identificationReview ? `<section class="ending-identification-review"><h2>Určení hub</h2><p>Žlutý tip zůstává odhadem do potvrzení zápisníkem nebo lexikonem.</p><ul>${identificationReview}</ul></section>` : ""}
            </div>
            <section class="score-card" aria-label="Bodování dne">
              <h2>Skóre dne <strong>${score.total}</strong></h2>
              <div class="score-row"><span>Polévka</span><b>${points(score.soupPoints)}</b></div>
              <div class="score-row"><span>Lektvar</span><b>${points(score.potionPoints)}</b></div>
              <div class="score-row"><span>Zbytky · ${score.leftovers}</span><b>${points(score.leftoverPoints)}</b></div>
              <div class="score-row"><span>Houpací křeslo · ${score.rockingHours} h</span><b>${points(score.chairPoints)}</b></div>
              <div class="score-row penalty"><span>Špatně určené houby · ${score.wrongGuesses}</span><b>${score.mistakePoints}</b></div>
            </section>
          </div>
          <p class="ending-note">Den končí v ${E.clock(state.minutes)}. Sytost je ${formatHunger(state.hunger)}/10 a soustředění ${state.focus}. Spánek spotřebuje ${morning.sleepHungerCost} sytosti a ${morning.gameOver ? "síly už na noc nestačí" : `ráno nechá ${formatHunger(morning.hunger)} sytosti a ${morning.focus} soustředění`}.${morning.latePenalty ? ` Pozdní ulehnutí ubralo ${morning.latePenalty} z možné obnovy soustředění.` : ""} Zápisník obsahuje ${state.knowledge.length} záznamů.</p>
          <div class="ending-actions">
            <button class="primary big" data-next-day data-key-e><kbd>E</kbd> Další den</button>
            <button class="quiet big" data-ending-fireplace data-key-q><kbd>Q</kbd> Ke krbu</button>
          </div>
        </div>
        ${utilityOverlay()}
      </section>`;
    bind();
    paintMushroomIcons();
  }

  function bind() {
    document.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => {
      selectedDifficulty = button.dataset.difficulty === "easy" ? "easy" : "normal";
      renderTitle();
    }));
    document.querySelector("[data-new-game]")?.addEventListener("click", () => start(selectedDifficulty));
    document.querySelector("[data-continue]")?.addEventListener("click", continueSavedGame);
    document.querySelector("[data-next-day]")?.addEventListener("click", startNextDay);
    document.querySelector("[data-ending-fireplace]")?.addEventListener("click", () => {
      endingView = "fireplace";
      renderEnding();
    });
    document.querySelector("[data-ending-summary]")?.addEventListener("click", () => {
      endingView = "summary";
      renderEnding();
    });
    document.querySelector("[data-title-screen]")?.addEventListener("click", returnToTitle);
    document.querySelectorAll("[data-replace-knowledge]").forEach((button) => button.addEventListener("click", () => {
      overflowDescriptionId = null;
      set(E.replacePendingKnowledge(state, button.dataset.replaceKnowledge), { keepSelections: true, keepTableFocus: true });
    }));
    document.querySelector("[data-dismiss-pending-knowledge]")?.addEventListener("click", () => {
      overflowDescriptionId = null;
      set(E.dismissPendingKnowledge(state), { keepSelections: true, keepTableFocus: true });
    });
    document.querySelectorAll("[data-overflow-description]").forEach((button) => button.addEventListener("click", () => {
      overflowDescriptionId = button.dataset.overflowDescription;
      render();
    }));
    document.querySelector("[data-close-overflow-description]")?.addEventListener("click", () => {
      overflowDescriptionId = null;
      render();
    });
    document.querySelector("[data-eat-cold-soup]")?.addEventListener("click", () => set(E.eatColdSoup(state)));
    document.querySelector("[data-leave-cold-soup]")?.addEventListener("click", () => set(E.leaveColdSoup(state)));
    document.querySelectorAll("[data-wash-pot]").forEach((button) => button.addEventListener("click", () => set(E.washPot(state), { keepSelections: true, keepTableFocus: true })));
    document.querySelector("[data-leave-pot-dirty]")?.addEventListener("click", () => set(E.leavePotDirty(state)));
    document.querySelector("[data-start-home-work]")?.addEventListener("click", () => set(E.startHomeWork(state)));
    document.querySelector('[data-action="bread"]')?.addEventListener("click", () => {
      forestPanelView = null;
      set(E.eatBread(state));
      resumeForestLook();
    });
    document.querySelector('[data-action="home"]')?.addEventListener("click", openHomeConfirmation);
    document.querySelector("[data-confirm-home]")?.addEventListener("click", () => set(E.goHome(state)));
    document.querySelector("[data-confirm-bread]")?.addEventListener("click", () => set(E.eatBread(state), { forestPanelView: "home-confirm", keepSelections: true, keepTableFocus: true }));
    document.querySelectorAll("[data-forest-panel]").forEach((button) => button.addEventListener("click", () => {
      togglePanel(button.dataset.forestPanel);
    }));
    document.querySelector("[data-close-forest-panel]")?.addEventListener("click", () => {
      forestPanelView = null;
      memoryTarget = null;
      render();
      resumeForestLook();
    });
    document.querySelectorAll("[data-open-memory]").forEach((button) => button.addEventListener("click", () => {
      memoryTarget = parseMemoryTarget(button.dataset.openMemory);
      memoryDescriptionId = null;
      if (memoryTarget?.source === "home") tableFocus = memoryTarget.index;
      forestPanelView = "memory";
      render();
    }));
    document.querySelectorAll("[data-recognize-knowledge]").forEach((button) => button.addEventListener("click", () => {
      if (!memoryTarget) return;
      const target = { ...memoryTarget };
      const next = E.recognizeFromKnowledge(state, target.source, target.index, button.dataset.recognizeKnowledge);
      const recognized = !next.error;
      set(next, recognized ? {
        forestPanelView: null,
        memoryTarget: null,
        keepSelections: true,
        tableFocus: target.source === "home" ? target.index : undefined,
        keepTableFocus: target.source !== "home"
      } : {
        forestPanelView: "memory",
        memoryTarget: target,
        keepSelections: true,
        tableFocus: target.source === "home" ? target.index : undefined,
        keepTableFocus: target.source !== "home"
      });
    }));
    document.querySelectorAll("[data-current-species]").forEach((button) => button.addEventListener("click", () => {
      set(E.setIdentification(state, "speciesGuess", button.dataset.currentSpecies));
    }));
    document.querySelectorAll("[data-inventory-species]").forEach((button) => button.addEventListener("click", () => {
      const source = button.dataset.inventorySource;
      const index = Number(button.dataset.inventoryIndex);
      set(E.identifyBasketItem(state, source, index, button.dataset.inventorySpecies), { forestPanelView: "basket" });
    }));
    document.querySelectorAll("[data-discard-inventory]").forEach((button) => button.addEventListener("click", () => {
      const [source, rawIndex] = button.dataset.discardInventory.split(":");
      set(E.discardInventoryItem(state, source, Number(rawIndex)), { forestPanelView: "basket" });
    }));
    document.querySelectorAll("[data-home-lexicon]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.homeLexicon);
      set(E.consultHomeLexicon(state, index), { keepSelections: true, tableFocus: index });
    }));
    document.querySelectorAll("[data-home-guess]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.homeGuessIndex);
      set(E.guessAtHome(state, index, button.dataset.homeGuess), { keepSelections: true, tableFocus: index });
    }));
    document.querySelectorAll("[data-home-unknown]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.homeUnknown);
      set(E.leaveHomeUnknown(state, index), { keepSelections: true, tableFocus: index });
    }));
    document.querySelectorAll("[data-table-mushroom]").forEach((button) => button.addEventListener("click", () => {
      tableFocus = Number(button.dataset.tableMushroom);
      render();
    }));
    document.querySelectorAll("[data-toggle-cooking]").forEach((button) => button.addEventListener("click", () => {
      const [kind, rawIndex] = button.dataset.toggleCooking.split(":");
      const index = Number(rawIndex);
      if (kind === "potion") selected = selected.includes(index) ? selected.filter((item) => item !== index) : [...selected, index];
      else selectedSoup = selectedSoup.includes(index) ? selectedSoup.filter((item) => item !== index) : [...selectedSoup, index];
      tableFocus = index;
      render();
    }));
    document.querySelectorAll("[data-toggle-potato]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.togglePotato);
      selectedSoupPotatoes = index < selectedSoupPotatoes ? Math.max(0, selectedSoupPotatoes - 1) : Math.min(state.potatoes || 0, selectedSoupPotatoes + 1);
      render();
    }));
    document.querySelectorAll("[data-forget-knowledge]").forEach((button) => button.addEventListener("click", () => {
      set(E.forgetKnowledge(state, button.dataset.forgetKnowledge), { forestPanelView: "memory", memoryTarget, keepSelections: true, keepTableFocus: true });
    }));
    document.querySelectorAll("[data-description-knowledge]").forEach((button) => button.addEventListener("click", () => {
      memoryDescriptionId = button.dataset.descriptionKnowledge;
      render();
    }));
    document.querySelector("[data-close-memory-description]")?.addEventListener("click", () => {
      memoryDescriptionId = null;
      render();
    });
    document.querySelector("[data-finish-identification]")?.addEventListener("click", () => set(E.finishHomeIdentification(state)));
    document.querySelectorAll("[data-resolve]").forEach((button) => button.addEventListener("click", () => {
      const next = E.resolve(state, button.dataset.resolve);
      const returnsToForest = next.phase === "forest" && !next.current;
      set(next);
      if (returnsToForest) resumeForestLook();
    }));
    document.querySelectorAll("[data-order]").forEach((button) => button.addEventListener("click", () => set(E.chooseOrder(state, button.dataset.order))));
    document.querySelector("[data-finish-evening]")?.addEventListener("click", () => set(E.finishEvening(state)));
    document.querySelectorAll("[data-ingredient]").forEach((input) => input.addEventListener("change", () => {
      const index = Number(input.dataset.ingredient);
      selected = input.checked ? [...selected, index] : selected.filter((item) => item !== index);
    }));
    document.querySelectorAll("[data-soup-ingredient]").forEach((input) => input.addEventListener("change", () => {
      const index = Number(input.dataset.soupIngredient);
      selectedSoup = input.checked ? [...new Set([...selectedSoup, index])] : selectedSoup.filter((item) => item !== index);
    }));
    document.querySelectorAll("[data-soup-potato]").forEach((input) => input.addEventListener("change", () => {
      selectedSoupPotatoes = document.querySelectorAll("[data-soup-potato]:checked").length;
    }));
    document.querySelectorAll("[data-cook]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.cook === "soup") {
        set(E.cookSoup(state, { mushroomIndexes: selectedSoup, potatoCount: selectedSoupPotatoes }));
      } else {
        const ingredients = selected.map((index) => state.basket[index]).filter(Boolean);
        set(E.brewPotion(state, ingredients));
      }
    }));
    document.querySelectorAll("[data-skip]").forEach((button) => button.addEventListener("click", () => set(button.dataset.skip === "soup" ? E.skipSoup(state) : E.skipPotion(state))));
    document.querySelector("[data-eat-soup]")?.addEventListener("click", () => set(E.eatSoup(state)));
    document.querySelector("[data-leave-soup]")?.addEventListener("click", () => set(E.leaveSoup(state)));
    document.querySelector("[data-continue-cooking]")?.addEventListener("click", () => set(E.continueCooking(state)));
  }

  function togglePanel(panel) {
    if (!state || (state.current && panel !== "memory")) return;
    const closing = forestPanelView === panel;
    if (!closing && panel === "memory") memoryTarget = defaultMemoryTarget();
    if (closing || panel !== "memory") memoryTarget = null;
    memoryDescriptionId = null;
    forestPanelView = closing ? null : panel;
    render();
    if (closing) resumeForestLook();
  }

  function openHomeConfirmation() {
    if (state.phase !== "forest" || state.current) return;
    if (E.basketLoad(state) < E.HOME_MINIMUM) {
      set(E.goHome(state));
      resumeForestLook();
      return;
    }
    forestPanelView = "home-confirm";
    render();
  }

  function handleGameKey(code) {
    if (code === "KeyH") {
      returnToTitle();
      return true;
    }
    if (state.pendingKnowledge && code !== "KeyQ") return true;
    const choiceNumber = /^Digit[1-4]$/.test(code) ? Number(code.slice(-1)) : /^Numpad[1-4]$/.test(code) ? Number(code.slice(-1)) : 0;
    if (choiceNumber && !forestPanelView) {
      const selector = state.current
        ? `[data-current-species][data-choice-number="${choiceNumber}"]`
        : state.phase === "identifying" && Number.isInteger(tableFocus)
          ? `[data-choice-number="${choiceNumber}"][data-home-guess], [data-choice-number="${choiceNumber}"][data-home-unknown]`
          : null;
      const choice = selector ? document.querySelector(selector) : null;
      if (choice) {
        choice.click();
        return true;
      }
    }
    if (code === "KeyF" && state.phase === "forest") {
      togglePanel("basket");
      return true;
    }
    if (code === "KeyX" || code === "KeyC") {
      const panel = code === "KeyX" ? "notes" : "memory";
      togglePanel(panel);
      return true;
    }
    if (code === "KeyR" && state.phase === "forest" && !state.current) {
      const confirmingHome = forestPanelView === "home-confirm";
      set(E.eatBread(state), confirmingHome ? { forestPanelView: "home-confirm", keepSelections: true, keepTableFocus: true } : {});
      resumeForestLook();
      return true;
    }
    if (code === "KeyQ") {
      if (state.gameOver) {
        returnToTitle();
        return true;
      }
      if (state.pendingKnowledge) {
        if (overflowDescriptionId) {
          overflowDescriptionId = null;
          render();
          return true;
        }
        document.querySelector("[data-dismiss-pending-knowledge]")?.click();
        return true;
      }
      if (forestPanelView === "memory" && memoryDescriptionId) {
        memoryDescriptionId = null;
        render();
        return true;
      }
      if (forestPanelView) {
        forestPanelView = null;
        memoryTarget = null;
        memoryDescriptionId = null;
        render();
        resumeForestLook();
        return true;
      }
      if (state.phase === "ending") {
        endingView = endingView === "fireplace" ? "summary" : "fireplace";
        renderEnding();
        return true;
      }
      if (state.phase === "morning-soup") {
        document.querySelector("[data-leave-cold-soup]")?.click();
        return true;
      }
      if (state.phase === "pot-cleanup") {
        document.querySelector("[data-leave-pot-dirty]")?.click();
        return true;
      }
      if (state.phase === "cooking-result" && state.cookingResult?.kind === "soup" && state.soup?.eaten === null) {
        document.querySelector("[data-leave-soup]")?.click();
        return true;
      }
      if (state.current) {
        set(E.resolve(state, "leave"));
        resumeForestLook();
        return true;
      }
      if (state.phase === "forest") {
        openHomeConfirmation();
        return true;
      }
      if (state.phase === "soup" || state.phase === "potion") {
        const skip = document.querySelector("[data-skip]");
        if (skip) {
          skip.click();
          return true;
        }
      }
      return false;
    }
    if (code === "KeyE") {
      if (state.gameOver) {
        start(selectedDifficulty);
        return true;
      }
      if (state.pendingKnowledge) return true;
      if (forestPanelView === "home-confirm") {
        set(E.goHome(state));
        return true;
      }
      if (forestPanelView) return true;
      if (state.current) {
        const next = E.resolve(state, "all");
        const returnsToForest = next.phase === "forest" && !next.current;
        set(next);
        if (returnsToForest) resumeForestLook();
        return true;
      }
      const primary = document.querySelector("[data-key-e]:not(:disabled)");
      if (primary && state.phase !== "forest") {
        primary.click();
        return true;
      }
    }
    return false;
  }

  function paintMushroomIcons() {
    document.querySelectorAll("canvas[data-mushroom-icon]").forEach((canvas) => {
      const id = canvas.dataset.mushroomIcon;
      const ctx = canvas.getContext("2d");
      if (!ctx || !E.getSpecies(id)) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawMushroom(ctx, {
        item: { site: { species: id }, height: 1 },
        scale: 62,
        x: canvas.width / 2,
        y: canvas.height * 0.94,
        fog: 1
      }, false);
    });
  }

  function requestForestPointerLock() {
    const canvas = document.getElementById("forest-canvas");
    if (!canvas) return;
    canvas.focus();
    if (!canvas.requestPointerLock) return;
    const pendingLock = canvas.requestPointerLock();
    if (pendingLock?.catch) pendingLock.catch(() => {});
  }

  function resumeForestLook() {
    if (!state || state.phase !== "forest" || state.current || forestPanelView) return;
    requestForestPointerLock();
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
    const hudTime = document.getElementById("hud-time");
    const hudHunger = document.getElementById("hud-hunger");
    const hudFocus = document.getElementById("hud-focus");
    const keys = new Set();
    let last = performance.now();
    let target = null;
    let dirtySave = false;
    let fallbackLook = false;
    let fallbackTimer = 0;
    let lastMouseX = null;
    let lastMouseY = null;
    const overlayActive = () => Boolean(state.current || forestPanelView);

    scene = { canvas, keys, raf: 0, cleanups: [], stepPhase: 0, cameraBob: 0, cameraSway: 0, bump: null };

    // CSS mění na úzkých obrazovkách průzor z 16:9 na 4:3. Kreslicí plocha
    // proto musí sledovat skutečný rozměr prvku; jinak se hotový obraz 16:9
    // pouze svisle natáhne. Změna velikosti nijak nemění polohu ani pohled.
    const syncCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(320, Math.round(rect.width * density));
      const height = Math.max(240, Math.round(rect.height * density));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
    };
    const canvasObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(syncCanvasSize)
      : null;
    syncCanvasSize();
    canvasObserver?.observe(forestView);
    window.addEventListener("resize", syncCanvasSize);
    scene.cleanups.push(() => canvasObserver?.disconnect(), () => window.removeEventListener("resize", syncCanvasSize));

    const onKeyDown = (event) => {
      if (overlayActive()) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
      keys.add(event.code);
      if (event.code === "KeyE") inspect();
    };
    const onKeyUp = (event) => keys.delete(event.code);
    const onMouseMove = (event) => {
      if (overlayActive()) return;
      const locked = document.pointerLockElement === canvas;
      if (!locked && (!fallbackLook || event.target !== canvas)) return;
      const fallbackX = lastMouseX === null ? 0 : event.clientX - lastMouseX;
      const fallbackY = lastMouseY === null ? 0 : event.clientY - lastMouseY;
      const dx = locked ? event.movementX : (event.movementX || fallbackX);
      const dy = locked ? event.movementY : (event.movementY || fallbackY);
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      state.explorer.yaw = wrap(state.explorer.yaw + clamp(dx, -90, 90) * 0.00235);
      state.explorer.pitch = clamp(state.explorer.pitch - clamp(dy, -90, 90) * 0.00375, LOOK_DOWN_LIMIT, LOOK_UP_LIMIT);
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
      if (overlayActive()) return;
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
        else if (step === "look-down") state.explorer.pitch = clamp((state.explorer.pitch || 0) - 0.34, LOOK_DOWN_LIMIT, LOOK_UP_LIMIT);
        else if (step === "look-center") state.explorer.pitch = 0;
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

    function leaveForestIfDepleted() {
      if (!E.isDepleted(state)) return false;
      set(state);
      return true;
    }

    function tryMove(dx, dz) {
      const p = state.explorer;
      const nx = clamp(p.x + dx, -WORLD_LIMIT, WORLD_LIMIT);
      const nz = clamp(p.z + dz, -WORLD_LIMIT, WORLD_LIMIT);
      const blocker = world.trees.find((tree) => distance(nx, nz, tree.x, tree.z) < tree.radius + 0.32);
      if (blocker) {
        const now = performance.now();
        const newImpact = !scene.bump || now >= scene.bump.until;
        const side = (blocker.x - p.x) * Math.cos(p.yaw) - (blocker.z - p.z) * Math.sin(p.yaw);
        scene.bump = { side: side < 0 ? "left" : "right", until: now + SCRATCH_LINGER_MS };
        if (newImpact) {
          state = E.hitTree(state);
          if (leaveForestIfDepleted()) return;
        }
        dirtySave = true;
        return;
      }
      const walked = Math.hypot(nx - p.x, nz - p.z);
      p.x = nx;
      p.z = nz;
      state.walkedRemainder = (state.walkedRemainder || 0) + walked;
      const wholeSquares = Math.floor(state.walkedRemainder);
      if (wholeSquares > 0) {
        state.walkedRemainder -= wholeSquares;
        state = E.walk(state, wholeSquares);
        if (leaveForestIfDepleted()) return;
      }
      dirtySave = true;
    }

    function frame(now) {
      if (!scene || scene.canvas !== canvas) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = state.explorer;
      const paused = overlayActive();
      const turn = paused ? 0 : (keys.has("ArrowLeft") ? -1 : 0) + (keys.has("ArrowRight") ? 1 : 0);
      if (turn) { p.yaw = wrap(p.yaw + turn * dt * 1.8); dirtySave = true; }
      const forward = paused ? 0 : (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
      const strafe = paused ? 0 : (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      if (forward || strafe) {
        const length = Math.max(1, Math.hypot(forward, strafe));
        const running = keys.has("ShiftLeft") || keys.has("ShiftRight");
        const speed = dt * (running ? 5.15 : 3.05) / length;
        const dx = (Math.sin(p.yaw) * forward + Math.cos(p.yaw) * strafe) * speed;
        const dz = (Math.cos(p.yaw) * forward - Math.sin(p.yaw) * strafe) * speed;
        tryMove(dx, dz);
        if (!scene || state.phase !== "forest") return;
        scene.stepPhase += dt * (running ? 10.5 : 7.2);
        scene.cameraBob += (Math.sin(scene.stepPhase * 2) * 0.028 - scene.cameraBob) * Math.min(1, dt * 13);
        scene.cameraSway += (Math.sin(scene.stepPhase) * 0.012 - scene.cameraSway) * Math.min(1, dt * 10);
      } else {
        scene.cameraBob += (0 - scene.cameraBob) * Math.min(1, dt * 10);
        scene.cameraSway += (0 - scene.cameraSway) * Math.min(1, dt * 10);
      }
      target = paused ? null : nearestTarget();
      prompt.hidden = !target;
      if (target) prompt.firstChild.textContent = target.kind === "potato" ? "Sebrat bramboru " : "Prozkoumat houbu ";
      compass.textContent = compassName(p.yaw);
      hudTime.textContent = `🕰 ${E.clock(state.minutes)}`;
      hudHunger.textContent = `🥣 ${formatHunger(state.hunger)}/10`;
      hudFocus.textContent = `✦ ${state.focus}`;
      hudHunger.classList.toggle("meter-warning", state.hunger > 0 && state.hunger <= 4);
      hudHunger.classList.toggle("meter-danger", state.hunger <= 0);
      hudFocus.classList.toggle("meter-warning", state.focus > 0 && state.focus <= 2);
      hudFocus.classList.toggle("meter-danger", state.focus <= 0);
      drawForest(ctx, canvas, target, now, scene.cameraBob, scene.cameraSway);
      if (dirtySave && Math.floor(now / 1000) !== Math.floor((now - dt * 1000) / 1000)) { save(); dirtySave = false; }
      scene.raf = requestAnimationFrame(frame);
    }

    function nearestTarget() {
      const p = state.explorer;
      let best = null;
      E.activeSites(state).forEach((site) => {
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
    const pitch = clamp(state.explorer.pitch || 0, LOOK_DOWN_LIMIT, LOOK_UP_LIMIT);
    const horizon = clamp(height * 0.455 + pitch * height * VERTICAL_LOOK, height * -1.15, height * 2.05);
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
    E.activeSites(state).forEach((site) => {
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
    // Dvanáct slabých vrstev zůstává, ale každá končí u odpovídající
    // vzdálenostní čáry země. Společný přední limit chrání trávu a síť
    // v bezprostředním popředí před šedým přelivem.
    const mistBands = Array.from({ length: 12 }, (_, index) => {
      const progress = index / 11;
      return {
        depth: 30 - progress * 27,
        alpha: 0.082 - progress * 0.032,
        top: 0.13 - progress * 0.19
      };
    });
    let distanceFogBand = 0;
    objects.forEach((object) => {
      while (distanceFogBand < mistBands.length && object.depth < mistBands[distanceFogBand].depth) {
        drawDistanceMist(ctx, width, height, horizon, cameraHeight, mistBands[distanceFogBand]);
        distanceFogBand += 1;
      }
      if (object.kind === "tree") drawTree(ctx, object);
      else if (object.kind === "mushroom") drawMushroom(ctx, object, false);
      else if (object.kind === "rock") drawRock(ctx, object);
      else if (object.kind === "leaf") drawLeaf(ctx, object);
      else if (object.kind === "cone") drawPinecone(ctx, object);
      else if (object.kind === "potatoPlant" || object.kind === "potatoLoose") drawPotato(ctx, object, false);
      else drawFoliage(ctx, object);
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

  function drawDistanceMist(ctx, width, height, horizon, cameraHeight, band) {
    // Vrstva leží mezi horizontem a čárou země v dané vzdálenosti. Nikdy
    // nepřeteče přes vzdálenou část sítě do trávy přímo pod pozorovatelkou.
    const top = clamp(horizon + height * band.top - height * 0.06, height * 0.03, height * 0.78);
    const projectedGround = horizon + cameraHeight / Math.max(band.depth, 1) * projectionFocal(width);
    const foregroundCutoff = clamp(horizon + height * 0.24, height * 0.22, height * 0.78);
    const bottom = clamp(Math.min(projectedGround, foregroundCutoff), top + height * 0.025, height * 0.8);
    if (bottom <= top) return;
    const mist = ctx.createLinearGradient(0, top, 0, bottom);
    mist.addColorStop(0, "rgba(222,225,202,0)");
    mist.addColorStop(0.14, `rgba(222,225,202,${band.alpha})`);
    mist.addColorStop(0.68, `rgba(206,217,195,${band.alpha * 0.62})`);
    mist.addColorStop(1, "rgba(174,194,176,0)");
    ctx.save();
    ctx.fillStyle = mist;
    ctx.fillRect(0, top, width, bottom - top);
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
    const sunrise = E.TIMINGS.dayStart;
    const sunset = E.TIMINGS.nightStart;
    const solarNoon = (sunrise + sunset) / 2;
    const morning = state.minutes <= solarNoon;
    const arcProgress = morning
      ? clamp((state.minutes - sunrise) / (solarNoon - sunrise), 0, 1)
      : clamp((state.minutes - solarNoon) / (sunset - solarNoon), 0, 1);
    const elevation = Math.pow(morning ? Math.sin(arcProgress * Math.PI / 2) : Math.cos(arcProgress * Math.PI / 2), 0.82);
    // Kompas má jih na 0, východ na +π/2 a západ na −π/2.
    // Dvě výslovné poloviny oblouku proto kotví slunce přesně na jih uprostřed dne.
    const sunWorldAzimuth = morning
      ? Math.PI / 2 + (0 - Math.PI / 2) * arcProgress
      : 0 + (-Math.PI / 2) * arcProgress;
    const relativeAngle = angleDiff(sunWorldAzimuth, state.explorer?.yaw || 0);
    const glowX = width / 2 + relativeAngle * (width / FOV);
    // Kotouč vychází těsně pod horizontem, v poledne vystoupá vysoko
    // a k večeru se po stejné křivce znovu vrátí k obzoru.
    const glowY = clamp(horizon + height * 0.04 - height * elevation * 0.64, height * 0.035, horizon + height * 0.055);
    const visibleMargin = width * 0.42;
    if (glowX < -visibleMargin || glowX > width + visibleMargin || horizon <= 0) return;

    const glowRadius = height * (0.27 + elevation * 0.15);
    const glow = ctx.createRadialGradient(glowX, glowY, 2, glowX, glowY, glowRadius);
    glow.addColorStop(0, "rgba(255,246,194,.68)");
    glow.addColorStop(0.2, "rgba(247,226,169,.19)");
    glow.addColorStop(1, "rgba(255,238,188,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, Math.max(horizon, 0));

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.045 + elevation * 0.055 + Math.sin(now * 0.00025) * 0.008;
    ctx.fillStyle = "#f4ddb0";
    for (let i = -2; i <= 1; i += 1) {
      const x = glowX + i * width * 0.055;
      ctx.beginPath();
      ctx.moveTo(x, glowY);
      ctx.lineTo(x + width * 0.13, height);
      ctx.lineTo(x + width * 0.23, height);
      ctx.lineTo(x + width * 0.018, glowY);
      ctx.fill();
    }
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = "#ffe7a4";
    ctx.beginPath();
    ctx.arc(glowX, glowY, clamp(height * 0.026, 10, 25), 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawDistantForest(ctx, width, height, horizon) {
    // Siluety mají pevné světové azimuty. Při otočení pozorovatelky tedy
    // skutečně odplouvají s krajinou a nezůstávají přilepené ke kurzoru.
    const segmentCount = 56;
    const segmentAngle = TAU / segmentCount;
    const pixelsPerRadian = width / FOV;
    const yaw = state.explorer.yaw;
    const layers = [
      { color: "rgba(48,70,55,.43)", base: 0.06, size: 0.18, offset: segmentAngle * 0.42 },
      { color: "rgba(31,55,42,.66)", base: 0.035, size: 0.25, offset: 0 }
    ];
    layers.forEach((layer, layerIndex) => {
      const baseY = horizon + height * layer.base;
      ctx.fillStyle = layer.color;
      ctx.fillRect(0, baseY, width, Math.max(0, horizon + height * 0.12 - baseY));
      for (let index = 0; index < segmentCount; index += 1) {
        const worldAngle = index * segmentAngle + layer.offset;
        const relativeAngle = angleDiff(worldAngle, yaw);
        if (Math.abs(relativeAngle) > FOV / 2 + segmentAngle) continue;
        const centerX = width / 2 + relativeAngle * pixelsPerRadian;
        const halfWidth = segmentAngle * pixelsPerRadian * (0.54 - layerIndex * 0.04);
        const wave = Math.sin(index * 2.17 + layerIndex) * 0.03;
        const crownY = horizon - height * (layer.size + wave + ((index * 7) % 5) * 0.012);
        ctx.beginPath();
        ctx.moveTo(centerX - halfWidth, baseY);
        ctx.lineTo(centerX, crownY);
        ctx.lineTo(centerX + halfWidth, baseY);
        ctx.closePath();
        ctx.fill();
      }
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
    const pitchOffset = clamp(p.pitch || 0, LOOK_DOWN_LIMIT, LOOK_UP_LIMIT) * height * VERTICAL_LOOK;

    // Vodorovně je svět znovu válcový: poloha i velikost používají úhel a
    // radiální vzdálenost, takže se při úkroku srozumitelně otáčí kolem hráčky.
    // Svislé rozhlížení posouvá horizont bez změny hloubky či výšky kamery.
    // Hráčka se tak při pohledu dolů nesnižuje k podlaze. Výška i měřítko
    // používají radiální vzdálenost, takže se krajní objekt při pouhém
    // rozhlížení nezvětšuje ani neposouvá po zemi.
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
    if (!base || base.distance > OBJECT_DRAW_DISTANCE) return;

    // Paty i velikost používají tutéž radiální vzdálenost válcové projekce.
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
      const edgeCrown = i === 0 || i === 3 || i === 6 || i === 8;
      ctx.globalAlpha = fog * (edgeCrown ? 0.72 : 0.96);
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
    } else if (id === "rosovka") {
      ctx.fillStyle = stemGradient; ctx.beginPath(); ctx.moveTo(x - s * 0.08, y); ctx.lineTo(x - s * 0.11, y - s * 0.54); ctx.lineTo(x + s * 0.1, y - s * 0.54); ctx.lineTo(x + s * 0.09, y); ctx.fill();
      ctx.fillStyle = capGradient("#efb3ad", "#a95f62"); ctx.beginPath(); ctx.ellipse(x, y - s * 0.58, s * 0.56, s * 0.32, 0, Math.PI, TAU); ctx.quadraticCurveTo(x, y - s * 0.32, x - s * 0.56, y - s * 0.58); ctx.fill();
      ctx.fillStyle = "#f5ddd2"; for (let i = 0; i < 8; i += 1) { const a = i * 2.17; ctx.beginPath(); ctx.arc(x + Math.cos(a) * s * 0.34, y - s * (0.63 + Math.sin(a) * 0.13), Math.max(1, s * 0.024), 0, TAU); ctx.fill(); }
      ctx.strokeStyle = "#f1d7c1"; ctx.lineWidth = Math.max(1, s * 0.018); for (let i = -3; i <= 3; i += 1) { ctx.beginPath(); ctx.moveTo(x, y - s * 0.47); ctx.lineTo(x + i * s * 0.16, y - s * 0.53); ctx.stroke(); }
    } else if (id === "inkoustovka") {
      ctx.fillStyle = stemGradient; ctx.beginPath(); ctx.moveTo(x - s * 0.075, y); ctx.lineTo(x - s * 0.1, y - s * 0.58); ctx.lineTo(x + s * 0.09, y - s * 0.58); ctx.lineTo(x + s * 0.075, y); ctx.fill();
      ctx.fillStyle = capGradient("#8b67a9", "#35203e"); ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.49); ctx.quadraticCurveTo(x, y - s * 1.03, x + s * 0.5, y - s * 0.49); ctx.quadraticCurveTo(x + s * 0.28, y - s * 0.35, x, y - s * 0.39); ctx.quadraticCurveTo(x - s * 0.26, y - s * 0.34, x - s * 0.5, y - s * 0.49); ctx.fill();
      ctx.fillStyle = "#a4509b"; [-0.33, -0.05, 0.27].forEach((offset, index) => { ctx.beginPath(); ctx.ellipse(x + offset * s, y - s * (0.42 - index * 0.018), s * 0.035, s * 0.085, 0, 0, TAU); ctx.fill(); });
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
    for (let i = 0; i < 232; i += 1) {
      const dense = random() > 0.84;
      ferns.push({
        x: random() * 28 - 14,
        z: random() * 28 - 14,
        height: dense ? 0.72 + random() * 0.5 : 0.28 + random() * 0.62,
        width: dense ? 0.9 + random() * 0.32 : 0.78,
        kind: dense ? "denseFern" : random() > 0.36 ? "grass" : "fern",
        color: random() > 0.5 ? "#3f6744" : "#5a7d4e"
      });
    }
    for (let i = 0; i < 21; i += 1) {
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
      [0.42].forEach((offset, bushIndex) => {
        const a = baseAngle + offset;
        const radius = bushIndex ? 1.18 : 0.82;
        bushes.push({
          x: site.x + Math.cos(a) * radius,
          z: site.z + Math.sin(a) * radius,
          height: 0.9,
          width: 1.18,
          color: id === "studenka" ? "#2d554c" : "#294d33",
          light: bushIndex === 0,
          seed: siteIndex * 11 + bushIndex
        });
      });
    });
    return { trees, ferns, bushes, ground, potatoes };
  }

  function mushroomHeight(id) {
    return ({ medovka: 0.4, hnedka: 0.44, ohnivka: 0.36, belokruh: 0.5, modravec: 0.42, rosovka: 0.38, inkoustovka: 0.43 })[id] || 0.4;
  }

  function phaseName() {
    if (state.phase === "forest") return state.current ? "Nález v porostu" : "Les z první osoby";
    if (state.phase === "home-arrival") return "Chvíle v chaloupce";
    if (state.phase === "identifying") return "Domácí určování";
    if (state.phase === "sorting") return "Třídění hub";
    if (state.phase === "evening-order") return "Návrat do chaty";
    if (state.phase === "soup") return "Polévka";
    if (state.phase === "potion") return "Lektvar";
    if (state.phase === "cooking-result") return "Výsledek vaření";
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




