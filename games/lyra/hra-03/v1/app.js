(function () {
  "use strict";
  const E = window.KloboukyEngine;
  const STORAGE = "lyra-klobouky-a-hlizy-v1";
  const app = document.getElementById("app");
  let state = load();
  let selected = [];

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE));
      return saved && saved.phase ? saved : null;
    } catch (_) { return null; }
  }

  function save() {
    if (state) localStorage.setItem(STORAGE, JSON.stringify(state));
  }

  function set(next) {
    state = next;
    selected = [];
    save();
    render();
  }

  function start() {
    set(E.createState());
  }

  function render() {
    if (!state) return renderTitle();
    if (state.phase === "ending") return renderEnding();
    app.innerHTML = `${header()}<div class="shell">${mainPanel()}${sidePanel()}</div>${state.error ? `<div class="toast">${esc(state.error)}</div>` : ""}`;
    bind();
  }

  function renderTitle() {
    app.innerHTML = `<section class="title-screen">
      <p class="eyebrow">LÝRA · HRA 03 · v1</p>
      <div class="title-icons" aria-hidden="true"><span>🍄</span><span>🥔</span><span>🫕</span></div>
      <h1>Klobouky<br><em>a hlízy</em></h1>
      <p class="lead">Co dáš do košíku, bude večer vařit s tebou.</p>
      <button class="primary" data-action="start">Vyrazit do lesa</button>
      <p class="small">Pět míst, jeden krajíc a večer na polévku i lektvar. Houby ve hře jsou smyšlené a nejsou návodem ke skutečnému sběru.</p>
      ${load() ? `<button class="link-btn" data-action="continue">Pokračovat v dnešní cestě</button>` : ""}
    </section>`;
    bind();
  }

  function header() {
    return `<header class="topbar">
      <div><p class="eyebrow">KLOBOUKY A HLÍZY</p><strong>${phaseName()}</strong></div>
      <div class="stats">
        <span title="Čas">🕰️ ${state.phase === "forest" ? E.clock(state.hour) : "večer"}</span>
        <span title="Hlad">🥣 ${state.hunger}/10</span>
        <span title="Soustředění">✦ ${state.focus}</span>
        <button class="reset" data-action="reset" title="Nová cesta">↻</button>
      </div>
    </header>`;
  }

  function mainPanel() {
    if (state.phase === "forest") return forestPanel();
    if (state.phase === "evening-order") return orderPanel();
    if (state.phase === "soup") return cookingPanel("soup");
    if (state.phase === "potion") return cookingPanel("potion");
    return "";
  }

  function forestPanel() {
    if (state.current) return findPanel();
    return `<section class="card main-card">
      <p class="eyebrow">DO SOUMRAKU ZBÝVÁ ${E.SITES.length - state.visited.length} ZASTÁVEK</p>
      <h2>Kam se podíváš?</h2>
      <div class="sites">${E.SITES.map((site) => {
        const done = state.visited.includes(site.id);
        return `<button class="site ${done ? "done" : ""}" data-visit="${site.id}" ${done ? "disabled" : ""}>
          <span>${site.icon}</span><strong>${site.name}</strong><small>${done ? "prohlédnuto" : "hodina cesty a hledání"}</small>
        </button>`;
      }).join("")}</div>
      ${state.bread ? `<button class="bread" data-action="bread">🥖 Sníst chleba · hlad −3, soustředění +1</button>` : `<p class="muted">Po chlebu zbyl jen ubrousek.</p>`}
    </section>`;
  }

  function findPanel() {
    const site = E.getSite(state.current);
    const species = E.getSpecies(site.species);
    const compared = state.compared.includes(site.id);
    const visibleClues = state.hunger >= 7 && !compared ? species.clues.slice(0, 2) : species.clues;
    return `<section class="card main-card find-card">
      <p class="eyebrow">${site.icon} ${site.name} · ${E.clock(state.hour)}</p>
      <h2>${species.name}</h2>
      <p class="intro">${site.intro}</p>
      <ul class="clues">${visibleClues.map((clue) => `<li>${esc(clue)}</li>`).join("")}${visibleClues.length < species.clues.length ? `<li class="blurred">Poslední znak hlady neudržíš v pozornosti.</li>` : ""}</ul>
      ${compared ? `<div class="atlas ${species.kind}"><strong>Atlas:</strong> ${esc(species.atlas)}</div>` : `<button class="atlas-btn" data-action="compare" ${state.focus < E.atlasCost(state) ? "disabled" : ""}>📖 Porovnat s atlasem · −${E.atlasCost(state)} soustředění</button>`}
      ${site.potatoes ? `<p class="potato">🥔 Vedle nálezu jsou ${site.potatoes === 1 ? "jedna lesní brambora" : "dvě lesní brambory"}.</p>` : ""}
      <div class="choices">
        <button class="primary" data-resolve="all">Vzít ${site.potatoes ? "všechno" : "houbu"}</button>
        ${site.potatoes ? `<button data-resolve="potatoes">Vzít jen brambory</button>` : ""}
        <button data-resolve="leave">Nechat v lese</button>
      </div>
    </section>`;
  }

  function orderPanel() {
    return `<section class="card main-card evening">
      <p class="eyebrow">VEČER · CHALOUPKA NA KRAJI LESA</p>
      <h2>Co postavíš na kamna první?</h2>
      <p>Hlad je ${state.hunger}/10 a soustředění ${state.focus}. Polévka může ruce uklidnit. Lektvar ale možná potřebuje surovinu, kterou bys do ní spotřebovala.</p>
      <div class="order-grid">
        <button data-order="soup-first"><span>🫕</span><strong>Nejdřív polévku</strong><small>Najíst se, potom míchat lektvar.</small></button>
        <button data-order="potion-first"><span>⚗️</span><strong>Nejdřív lektvar</strong><small>Šetřit suroviny, ale vařit hladová.</small></button>
      </div>
    </section>`;
  }

  function cookingPanel(kind) {
    const soup = kind === "soup";
    const ability = E.cookingAbility(state);
    return `<section class="card main-card cooking ${kind}">
      <p class="eyebrow">${soup ? "POLÉVKA" : "LEKTVAR"} · ${state.order === "soup-first" ? "POLÉVKA PRVNÍ" : "LEKTVAR PRVNÍ"}</p>
      <h2>${soup ? "Co dáš do hrnce?" : "Vyber právě dvě houby"}</h2>
      <p>${soup ? `Brambory použiješ všechny (${state.potatoes}). Vyber houby, které k nim přidáš.` : `Tvoje současná schopnost udržet postup je ${ability}. Stabilní lektvar potřebuje alespoň 3.`}</p>
      <div class="ingredients">${state.basket.length ? state.basket.map((id, index) => {
        const sp = E.getSpecies(id);
        const known = state.compared.some((siteId) => E.getSite(siteId).species === id);
        return `<button class="ingredient ${selected.includes(index) ? "selected" : ""}" data-ingredient="${index}">
          <span>${sp.icon}</span><strong>${esc(sp.name)}</strong><small>${known ? kindLabel(sp.kind) : "bez jistého určení"}</small>
        </button>`;
      }).join("") : `<p class="empty">V košíku už není žádná houba.</p>`}</div>
      <div class="choices">
        <button class="primary" data-cook="${kind}" ${!soup && selected.length !== 2 ? "disabled" : ""}>${soup ? "Uvařit polévku" : "Uvařit lektvar"}</button>
        <button data-skip="${kind}">${soup ? "Nechat hrnec studený" : "Nevyrábět lektvar"}</button>
      </div>
    </section>`;
  }

  function sidePanel() {
    const basket = state.basket.map((id) => E.getSpecies(id));
    return `<aside class="side">
      <section class="card basket"><p class="eyebrow">KOŠÍK</p>
        <div class="basket-items">${state.potatoes ? `<span>🥔 × ${state.potatoes}</span>` : ""}${basket.map((sp) => `<span>${sp.icon} ${esc(sp.name)}</span>`).join("") || (!state.potatoes ? `<span class="muted">prázdný</span>` : "")}</div>
      </section>
      <section class="card notebook"><p class="eyebrow">DNEŠNÍ STOPA</p><ol>${state.notes.slice(0, 7).map((note) => `<li>${esc(note)}</li>`).join("")}</ol></section>
      <section class="card warning"><strong>Jen herní podhoubí</strong><p>Všechny druhy a jejich znaky jsou smyšlené. Skutečné houby podle této hry neurčuj ani nejez.</p></section>
    </aside>`;
  }

  function renderEnding() {
    const good = state.soup && state.soup.ok;
    const magic = state.potion && state.potion.ok;
    const title = good && magic ? "Teplo dole, světlo nahoře" : good ? "Brambora zachránila večer" : magic ? "Kouzlo na prázdný žaludek" : "Les zůstal v košíku";
    app.innerHTML = `<section class="ending-screen ${good && magic ? "complete" : ""}">
      <p class="eyebrow">KONEC DNEŠNÍ CESTY</p>
      <div class="ending-icons">${good ? "🫕" : "🥣"} ${magic ? "✨" : "🌫️"}</div>
      <h1>${title}</h1>
      <div class="results">
        <article class="${state.soup?.tone || "plain"}"><span>POLÉVKA</span><h2>${esc(state.soup?.title || "Bez polévky")}</h2><p>${esc(state.soup?.text || "")}</p></article>
        <article class="${state.potion?.tone || "plain"}"><span>LEKTVAR</span><h2>${esc(state.potion?.title || "Bez lektvaru")}</h2><p>${esc(state.potion?.text || "")}</p></article>
      </div>
      <p class="epilogue">${good && magic ? "Nejdřív ses postarala o tělo a pak udržela kouzlo. Ráno nebudeš vědět všechno — ale budeš vědět, podle čeho jsi jednala." : good ? "Večeře není menší výsledek než kouzlo. Hlad už za tebe další volbu neudělá." : "Některé chyby se poznají až u kamen. Zítra můžeš jít lesem jinak."}</p>
      <button class="primary" data-action="restart">Jít znovu od rána</button>
    </section>`;
    bind();
  }

  function bind() {
    app.querySelectorAll("[data-action]").forEach((el) => el.addEventListener("click", () => {
      const action = el.dataset.action;
      if (action === "start" || action === "restart" || action === "reset") start();
      if (action === "continue") { state = load(); render(); }
      if (action === "bread") set(E.eatBread(state));
      if (action === "compare") set(E.compare(state));
    }));
    app.querySelectorAll("[data-visit]").forEach((el) => el.addEventListener("click", () => set(E.visit(state, el.dataset.visit))));
    app.querySelectorAll("[data-resolve]").forEach((el) => el.addEventListener("click", () => set(E.resolve(state, el.dataset.resolve))));
    app.querySelectorAll("[data-order]").forEach((el) => el.addEventListener("click", () => set(E.chooseOrder(state, el.dataset.order))));
    app.querySelectorAll("[data-ingredient]").forEach((el) => el.addEventListener("click", () => {
      const index = Number(el.dataset.ingredient);
      selected = selected.includes(index) ? selected.filter((n) => n !== index) : selected.concat(index);
      render();
    }));
    app.querySelectorAll("[data-cook]").forEach((el) => el.addEventListener("click", () => {
      const ids = selected.map((index) => state.basket[index]);
      set(el.dataset.cook === "soup" ? E.cookSoup(state, ids) : E.brewPotion(state, ids));
    }));
    app.querySelectorAll("[data-skip]").forEach((el) => el.addEventListener("click", () => set(el.dataset.skip === "soup" ? E.skipSoup(state) : E.skipPotion(state))));
  }

  function phaseName() {
    return state.phase === "forest" ? "Ráno a odpoledne v lese" : state.phase === "evening-order" ? "Večer u kamen" : state.phase === "soup" ? "Vaření polévky" : "Míchání lektvaru";
  }

  function kindLabel(kind) {
    return ({ edible: "atlas: jedlá", inedible: "atlas: nejedlá", poison: "atlas: jedovatá", potion: "atlas: jen do lektvaru" })[kind];
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
  }

  render();
})();
