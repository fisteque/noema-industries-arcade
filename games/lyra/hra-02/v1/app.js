(function () {
  "use strict";
  const E = window.CityEngine;
  const key = "lyra-city-behind-doors-v1";
  let state = E.initialState();

  const $ = selector => document.querySelector(selector);
  const titleScreen = $("#titleScreen");
  const playScreen = $("#playScreen");
  const continueBtn = $("#continueBtn");
  const overlay = $("#overlay");
  const toast = $("#toast");

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && saved.version === 1) return saved;
    } catch (_) {}
    return null;
  }

  function save() { localStorage.setItem(key, JSON.stringify(state)); }
  function esc(text) { const p = document.createElement("p"); p.textContent = text; return p.innerHTML; }

  function showToast(text) {
    toast.textContent = text;
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 1800);
  }

  function renderList(target, values, empty) {
    target.innerHTML = values.length ? values.map(v => `<li>${esc(v)}</li>`).join("") : `<li class="muted">${empty}</li>`;
  }

  function renderMap(kind) {
    const map = $("#map");
    const nodes = [
      ["Náměstí", "square"], ["Pekárna", "bakery"], ["Dvůr", "yard"], ["Věž", "tower"]
    ];
    map.dataset.kind = kind;
    map.innerHTML = nodes.map(([name, cls], i) => `<div class="node ${cls} ${i <= Math.min(state.day, 3) ? "seen" : ""}"><span></span>${name}</div>`).join("") + `<div class="route" aria-hidden="true"></div>`;
  }

  function render() {
    const view = E.scene(state);
    const memory = E.labels(state);
    $("#dayLabel").textContent = view.ending ? "Město po třetím zvonu" : `${["První", "Druhé", "Třetí"][state.day - 1]} ráno`;
    $("#bells").textContent = "●".repeat(Math.max(0, state.bells)) + "○".repeat(Math.max(0, 5 - state.bells));
    $("#place").textContent = view.place;
    $("#sceneTitle").textContent = view.title;
    $("#story").innerHTML = view.paragraphs.map(p => `<p>${esc(p)}</p>`).join("");
    $("#choices").innerHTML = view.choices.length ? view.choices.map(c => `<button data-choice="${c.id}" ${c.enabled ? "" : "disabled"}><strong>${esc(c.label)}</strong>${c.note ? `<span>${esc(c.note)}</span>` : ""}</button>`).join("") : `<button class="primary" data-restart>Projít městem jinak</button>`;
    renderList($("#facts"), memory.facts.slice(-3), "Zatím nic ověřeného.");
    renderList($("#deeds"), memory.deeds.slice(-3), "Zatím žádná stopa po jednání.");
    renderMap(view.map);
    save();
  }

  function start(fresh) {
    if (fresh) state = E.initialState(); else state = load() || E.initialState();
    titleScreen.classList.add("hidden");
    playScreen.classList.remove("hidden");
    render();
  }

  function notebook() {
    const memory = E.labels(state);
    $("#notebookBody").innerHTML = `<section><h3>Ověřená pozorování</h3>${memory.facts.length ? `<ol>${memory.facts.map(v => `<li>${esc(v)}</li>`).join("")}</ol>` : "<p>Ještě sis nic důkladně neprohlédla.</p>"}</section><section><h3>Jednání, které zůstalo ve městě</h3>${memory.deeds.length ? `<ol>${memory.deeds.map(v => `<li>${esc(v)}</li>`).join("")}</ol>` : "<p>Ještě po tobě nezůstala žádná zvolená stopa.</p>"}</section><p class="notebook-end">Cizí vzpomínky jsou zaznamenané v příběhu, ale zápisník je nevydává za ověřená fakta.</p>`;
    overlay.classList.remove("hidden");
  }

  document.addEventListener("click", event => {
    const startButton = event.target.closest("[data-start]");
    if (startButton) return start(startButton.dataset.start === "new");
    const choiceButton = event.target.closest("[data-choice]");
    if (choiceButton && !choiceButton.disabled) {
      state = E.choose(state, choiceButton.dataset.choice);
      render();
      return;
    }
    if (event.target.closest("[data-notebook]")) return notebook();
    if (event.target.closest("[data-close]")) return overlay.classList.add("hidden");
    if (event.target.closest("[data-restart]")) { state = E.initialState(); render(); return; }
    if (event.target.closest("[data-reset]")) {
      if (confirm("Začít městem znovu? Dosavadní cesta se smaže.")) { localStorage.removeItem(key); state = E.initialState(); render(); showToast("Začínáš první ráno."); }
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key.toLowerCase() === "z" && overlay.classList.contains("hidden") && !playScreen.classList.contains("hidden")) notebook();
    if (event.key === "Escape") overlay.classList.add("hidden");
  });

  if (load()) continueBtn.classList.remove("hidden");
})();

