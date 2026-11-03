(function () {
  "use strict";

  const E = window.KloboukyEngine;
  const STORAGE = "lyra-klobouky-a-hlizy-v2-preview";
  const app = document.getElementById("app");
  const TAU = Math.PI * 2;
  const FOV = Math.PI / 2.7;
  const WORLD_LIMIT = 14;
  const SITE_POSITIONS = {
    breza: { x: -8.2, z: -7.1 },
    mech: { x: 7.4, z: -7.5 },
    parez: { x: -9.1, z: 3.2 },
    rokle: { x: 8.7, z: 5.1 },
    studenka: { x: 0.2, z: -1.2 }
  };

  let state = load();
  let selected = [];
  let scene = null;

  const world = makeWorld();

  function freshState() {
    const next = E.createState();
    next.explorer = { x: 0, z: 11.4, yaw: Math.PI };
    return next;
  }

  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE));
      if (!value || !value.phase) return null;
      if (!value.explorer) value.explorer = { x: 0, z: 11.4, yaw: Math.PI };
      return value;
    } catch (_) {
      return null;
    }
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
        <p class="eyebrow">Lýra · pracovní v2</p>
        <h1>Klobouky<br><span>a hlízy</span></h1>
        <p class="lede">Les už není seznam zastávek. Je potřeba vejít do porostu, hledat mezi kapradím a rozeznat nález dřív, než skončí v košíku.</p>
        <button class="primary big" data-start>Vstoupit do lesa</button>
        <div class="title-help">
          <span><b>WASD</b> chůze</span><span><b>myš / šipky</b> rozhlížení</span><span><b>E</b> prozkoumat</span>
        </div>
        <p class="small">Na telefonu použij tlačítka pod výhledem. Postup této pracovní verze se ukládá jen v tomto prohlížeči.</p>
      </section>`;
    bind();
  }

  function header() {
    return `
      <header class="game-header">
        <div><p class="eyebrow">Klobouky a hlízy · v2</p><h2>${phaseName()}</h2></div>
        <div class="meters" aria-label="Stav postavy">
          <span title="Čas">🕰 ${E.clock(state.hour)}</span>
          <span title="Hlad">🥣 ${state.hunger}/10</span>
          <span title="Soustředění">✦ ${state.focus}</span>
          <span title="Nálezy">🧺 ${state.basket.length + state.potatoes}</span>
        </div>
      </header>`;
  }

  function mainPanel() {
    if (state.phase === "forest") return state.current ? findPanel() : forestPanel();
    if (state.phase === "evening-order") return orderPanel();
    if (state.phase === "soup" || state.phase === "potion") return cookingPanel(state.phase);
    return "";
  }

  function forestPanel() {
    return `
      <main class="card main-card forest-card">
        <div class="section-head">
          <div><p class="kicker">Les · ${state.visited.length}/5 míst</p><h3>Najdi, co porost schovává</h3></div>
          ${state.bread ? `<button class="quiet" data-action="bread">Sníst chleba</button>` : ""}
        </div>
        <p class="muted forest-copy">Barva pomůže, ale nestačí. Přibliž se, zamiř středem výhledu a nález prozkoumej. Stromy tě nepustí skrz, kapradí naopak rádo překáží ve výhledu.</p>
        <div class="forest-view" id="forest-view">
          <canvas id="forest-canvas" width="960" height="540" tabindex="0" aria-label="Les z pohledu první osoby"></canvas>
          <div class="crosshair" aria-hidden="true"><i></i><i></i></div>
          <div class="forest-hud"><span id="compass">S</span><span id="forest-count">Nálezy ${state.visited.length}/5</span></div>
          <button class="forest-prompt" id="forest-prompt" data-action="inspect" hidden>Prozkoumat nález <b>E</b></button>
          <button class="look-button" id="look-button" type="button">Klikni pro rozhlížení myší</button>
        </div>
        <div class="touch-controls" aria-label="Ovládání lesa">
          <div class="turn-controls"><button data-step="turn-left" aria-label="Otočit doleva">↶</button><button data-step="forward" aria-label="Jít dopředu">▲</button><button data-step="turn-right" aria-label="Otočit doprava">↷</button></div>
          <div class="move-controls"><button data-step="left" aria-label="Úkrok doleva">◀</button><button data-step="back" aria-label="Jít dozadu">▼</button><button data-step="right" aria-label="Úkrok doprava">▶</button></div>
        </div>
        <p class="forest-tip">Houby jsou malé. Někdy uvidíš nejdřív jen barvu klobouku mezi listy.</p>
      </main>`;
  }

  function findPanel() {
    const site = E.getSite(state.current);
    const species = E.getSpecies(site.species);
    const compared = state.compared.includes(site.id);
    return `
      <main class="card main-card find-card">
        <p class="kicker">${esc(site.name)}</p>
        <div class="specimen specimen-${species.id}" aria-hidden="true"><span class="specimen-cap"></span><span class="specimen-stem"></span></div>
        <h3>${esc(species.name)}</h3>
        <p class="intro">${esc(site.intro)}</p>
        <ul class="clues">${species.clues.map((clue) => `<li>${esc(clue)}</li>`).join("")}</ul>
        ${compared ? `<div class="atlas"><b>Atlas:</b> ${esc(species.atlas)}</div>` : `<button class="secondary" data-action="compare">Porovnat s atlasem · −${E.atlasCost(state)} soustředění</button>`}
        <div class="choice-row">
          <button class="primary" data-resolve="all">Vzít všechno</button>
          ${site.potatoes ? `<button class="secondary" data-resolve="potatoes">Vzít jen ${site.potatoes === 1 ? "bramboru" : "brambory"}</button>` : ""}
          <button class="quiet" data-resolve="leave">Nechat v lese</button>
        </div>
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
    const items = state.basket.map((id, index) => {
      const species = E.getSpecies(id);
      const checked = selected.includes(index) ? " checked" : "";
      return `<label class="ingredient"><input type="checkbox" data-ingredient="${index}"${checked}><span class="ingredient-mark specimen-mini specimen-${species.id}"></span><span><b>${esc(species.name)}</b><small>${esc(species.clues[0])}</small></span></label>`;
    }).join("");
    return `
      <main class="card main-card cooking-card">
        <p class="kicker">${potion ? "Lektvar" : "Polévka"}</p>
        <h3>${potion ? "Dvě houby a přesný rytmus" : "Co půjde do hrnce?"}</h3>
        <p>${potion ? `Aktuální schopnost vařit: <b>${E.cookingAbility(state)}</b>. Lektvar potřebuje právě dvě houby.` : `Brambory v zásobě: <b>${state.potatoes}</b>. Vyber libovolné houby; brambory se přidají automaticky.`}</p>
        <div class="ingredients">${items || `<p class="empty">Košík je prázdný.</p>`}</div>
        <div class="choice-row">
          <button class="primary" data-cook="${kind}">${potion ? "Uvařit lektvar" : "Uvařit polévku"}</button>
          <button class="quiet" data-skip="${kind}">Vynechat</button>
        </div>
      </main>`;
  }

  function sidePanel() {
    const basket = state.basket.map((id) => `<li>${esc(E.getSpecies(id).name)}</li>`).join("");
    return `
      <aside class="card side-card">
        <section><p class="kicker">Košík</p><ul class="basket-list">${basket || `<li class="muted">zatím prázdný</li>`}${state.potatoes ? `<li>Brambory × ${state.potatoes}</li>` : ""}</ul></section>
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
    document.querySelector('[data-action="compare"]')?.addEventListener("click", () => set(E.compare(state)));
    document.querySelectorAll("[data-resolve]").forEach((button) => button.addEventListener("click", () => set(E.resolve(state, button.dataset.resolve))));
    document.querySelectorAll("[data-order]").forEach((button) => button.addEventListener("click", () => set(E.chooseOrder(state, button.dataset.order))));
    document.querySelectorAll("[data-ingredient]").forEach((input) => input.addEventListener("change", () => {
      const index = Number(input.dataset.ingredient);
      selected = input.checked ? [...selected, index] : selected.filter((item) => item !== index);
    }));
    document.querySelectorAll("[data-cook]").forEach((button) => button.addEventListener("click", () => {
      const ingredients = selected.map((index) => state.basket[index]).filter(Boolean);
      set(button.dataset.cook === "soup" ? E.cookSoup(state, ingredients) : E.brewPotion(state, ingredients));
    }));
    document.querySelectorAll("[data-skip]").forEach((button) => button.addEventListener("click", () => set(button.dataset.skip === "soup" ? E.skipSoup(state) : E.skipPotion(state))));
  }

  function startScene() {
    const canvas = document.getElementById("forest-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const prompt = document.getElementById("forest-prompt");
    const lookButton = document.getElementById("look-button");
    const compass = document.getElementById("compass");
    const keys = new Set();
    let last = performance.now();
    let target = null;
    let dirtySave = false;

    scene = { canvas, keys, raf: 0, cleanups: [] };

    const onKeyDown = (event) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
      keys.add(event.code);
      if (event.code === "KeyE") inspect();
    };
    const onKeyUp = (event) => keys.delete(event.code);
    const onMouseMove = (event) => {
      if (document.pointerLockElement !== canvas) return;
      state.explorer.yaw = wrap(state.explorer.yaw + event.movementX * 0.0028);
      dirtySave = true;
    };
    const onLock = () => {
      lookButton.hidden = document.pointerLockElement === canvas;
      canvas.classList.toggle("locked", document.pointerLockElement === canvas);
    };
    const requestLook = () => canvas.requestPointerLock?.();

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onLock);
    lookButton.addEventListener("click", requestLook);
    prompt.addEventListener("click", inspect);
    scene.cleanups.push(() => window.removeEventListener("keydown", onKeyDown), () => window.removeEventListener("keyup", onKeyUp), () => document.removeEventListener("mousemove", onMouseMove), () => document.removeEventListener("pointerlockchange", onLock), () => lookButton.removeEventListener("click", requestLook), () => prompt.removeEventListener("click", inspect));

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
      set(E.visit(state, target.id));
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
      const blocked = world.trees.some((tree) => distance(nx, nz, tree.x, tree.z) < tree.radius + 0.32);
      if (!blocked) { p.x = nx; p.z = nz; dirtySave = true; }
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
        const speed = dt * 3.1;
        const dx = (Math.sin(p.yaw) * forward + Math.cos(p.yaw) * strafe) * speed;
        const dz = (Math.cos(p.yaw) * forward - Math.sin(p.yaw) * strafe) * speed;
        tryMove(dx, dz);
      }
      target = nearestTarget();
      prompt.hidden = !target;
      if (target) prompt.firstChild.textContent = "Prozkoumat nález ";
      compass.textContent = compassName(p.yaw);
      drawForest(ctx, canvas, target);
      if (dirtySave && Math.floor(now / 1000) !== Math.floor((now - dt * 1000) / 1000)) { save(); dirtySave = false; }
      scene.raf = requestAnimationFrame(frame);
    }

    function nearestTarget() {
      const p = state.explorer;
      let best = null;
      E.SITES.forEach((site) => {
        if (state.visited.includes(site.id)) return;
        const pos = SITE_POSITIONS[site.id];
        const d = distance(p.x, p.z, pos.x, pos.z);
        const angle = Math.abs(angleDiff(Math.atan2(pos.x - p.x, pos.z - p.z), p.yaw));
        if (d < 1.85 && angle < 0.7 && (!best || d < best.distance)) best = { ...site, distance: d };
      });
      return best;
    }

    scene.raf = requestAnimationFrame(frame);
  }

  function stopScene() {
    if (!scene) return;
    cancelAnimationFrame(scene.raf);
    scene.cleanups.forEach((cleanup) => cleanup());
    scene = null;
  }

  function drawForest(ctx, canvas, target) {
    const width = canvas.width;
    const height = canvas.height;
    const horizon = height * 0.47;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#8da99b");
    sky.addColorStop(1, "#d7cba8");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizon);
    const ground = ctx.createLinearGradient(0, horizon, 0, height);
    ground.addColorStop(0, "#536044");
    ground.addColorStop(1, "#17271f");
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, width, height - horizon);
    drawGroundTexture(ctx, width, height, horizon);

    const objects = [];
    world.trees.forEach((item) => pushProjected(objects, item, "tree", width, height, horizon));
    world.ferns.forEach((item) => pushProjected(objects, item, item.kind, width, height, horizon));
    E.SITES.forEach((site) => {
      if (state.visited.includes(site.id)) return;
      const pos = SITE_POSITIONS[site.id];
      pushProjected(objects, { ...pos, site, height: mushroomHeight(site.species) }, "mushroom", width, height, horizon);
    });
    objects.sort((a, b) => b.depth - a.depth);
    objects.forEach((object) => {
      if (object.kind === "tree") drawTree(ctx, object);
      else if (object.kind === "mushroom") drawMushroom(ctx, object, target && target.id === object.item.site.id);
      else drawFoliage(ctx, object);
    });

    const fog = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 125);
    fog.addColorStop(0, "rgba(220,215,185,.09)");
    fog.addColorStop(1, "rgba(220,215,185,0)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, horizon - 40, width, 165);
  }

  function pushProjected(list, item, kind, width, height, horizon) {
    const p = state.explorer;
    const dx = item.x - p.x;
    const dz = item.z - p.z;
    const depth = dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw);
    if (depth < 0.3 || depth > 31) return;
    const side = dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw);
    const focal = width / (2 * Math.tan(FOV / 2));
    const screenX = width / 2 + side / depth * focal;
    const groundY = horizon + 1.62 / depth * focal;
    const scale = focal / depth;
    const maxWidth = (kind === "tree" ? 2.2 : kind === "mushroom" ? 1.3 : 1.8) * scale;
    if (screenX < -maxWidth || screenX > width + maxWidth) return;
    list.push({ item, kind, depth, x: screenX, y: groundY, scale, fog: clamp(1 - (depth - 5) / 28, 0.22, 1) });
  }

  function drawGroundTexture(ctx, width, height, horizon) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = "#c8b979";
    for (let i = 0; i < 18; i += 1) {
      const y = horizon + Math.pow(i / 17, 1.7) * (height - horizon);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawTree(ctx, object) {
    const { item, x, y, scale, fog } = object;
    const height = item.height * scale;
    const trunk = Math.max(3, item.radius * scale * 1.35);
    ctx.save();
    ctx.globalAlpha = fog;
    ctx.fillStyle = item.birch ? "#d8d5bd" : "#4b3425";
    ctx.fillRect(x - trunk / 2, y - height, trunk, height);
    if (item.birch) {
      ctx.fillStyle = "rgba(45,42,34,.55)";
      for (let i = 1; i < 6; i += 1) ctx.fillRect(x - trunk / 2, y - height + height * i / 7, trunk * 0.7, Math.max(1, scale * 0.035));
    }
    ctx.fillStyle = item.birch ? "#79916a" : "#344d38";
    const crown = Math.min(260, scale * (item.birch ? 2.8 : 3.4));
    ctx.beginPath();
    ctx.ellipse(x, y - height, crown * 0.6, crown * 0.42, 0, 0, TAU);
    ctx.ellipse(x - crown * 0.28, y - height + crown * 0.06, crown * 0.42, crown * 0.3, -0.25, 0, TAU);
    ctx.ellipse(x + crown * 0.3, y - height + crown * 0.03, crown * 0.45, crown * 0.32, 0.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawFoliage(ctx, object) {
    const { item, x, y, scale, fog, kind } = object;
    const h = Math.min(190, item.height * scale);
    const w = Math.max(2, h * (kind === "fern" ? 0.85 : 0.55));
    ctx.save();
    ctx.globalAlpha = fog * 0.94;
    ctx.strokeStyle = kind === "fern" ? item.color : "#77905b";
    ctx.lineWidth = Math.max(1, h * 0.035);
    if (kind === "fern") {
      for (let arm = -3; arm <= 3; arm += 1) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + arm * w * 0.12, y - h * 0.48, x + arm * w * 0.28, y - h * (0.72 + Math.abs(arm) * 0.035));
        ctx.stroke();
      }
    } else {
      for (let blade = -3; blade <= 3; blade += 1) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + blade * w * 0.1, y - h * 0.55, x + blade * w * 0.18, y - h); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawMushroom(ctx, object, isTarget) {
    const id = object.item.site.species;
    const s = Math.min(150, object.scale * object.item.height);
    const x = object.x;
    const y = object.y;
    ctx.save();
    ctx.globalAlpha = object.fog;
    if (isTarget) { ctx.shadowColor = "rgba(255,238,164,.72)"; ctx.shadowBlur = Math.max(8, s * 0.24); }
    if (id === "medovka") {
      ctx.fillStyle = "#d99b2b";
      ctx.beginPath(); ctx.moveTo(x - s * 0.58, y - s * 0.52); ctx.quadraticCurveTo(x, y - s * 0.95, x + s * 0.62, y - s * 0.5); ctx.quadraticCurveTo(x + s * 0.2, y - s * 0.33, x, y - s * 0.38); ctx.quadraticCurveTo(x - s * 0.25, y - s * 0.3, x - s * 0.58, y - s * 0.52); ctx.fill();
      ctx.fillStyle = "#d6b46d"; ctx.fillRect(x - s * 0.09, y - s * 0.48, s * 0.18, s * 0.5);
      ctx.strokeStyle = "#795728"; ctx.lineWidth = Math.max(1, s * 0.025); for (let i = -2; i <= 2; i += 1) { ctx.beginPath(); ctx.moveTo(x, y - s * 0.42); ctx.lineTo(x + i * s * 0.18, y - s * 0.51); ctx.stroke(); }
    } else if (id === "hnedka") {
      ctx.fillStyle = "#d7c5a0"; ctx.fillRect(x - s * 0.1, y - s * 0.52, s * 0.2, s * 0.54);
      ctx.fillStyle = "#6f472b"; ctx.beginPath(); ctx.ellipse(x, y - s * 0.55, s * 0.55, s * 0.31, 0, Math.PI, TAU); ctx.quadraticCurveTo(x, y - s * 0.23, x - s * 0.55, y - s * 0.55); ctx.fill();
      ctx.fillStyle = "#a38158"; for (let i = -3; i <= 3; i += 1) { ctx.beginPath(); ctx.arc(x + i * s * 0.12, y - s * 0.48 + (i % 2) * s * 0.025, Math.max(1, s * 0.025), 0, TAU); ctx.fill(); }
    } else if (id === "ohnivka") {
      ctx.fillStyle = "#e55d24"; ctx.beginPath(); ctx.moveTo(x - s * 0.63, y - s * 0.48); ctx.quadraticCurveTo(x - s * 0.27, y - s * 0.62, x, y - s * 0.31); ctx.quadraticCurveTo(x + s * 0.25, y - s * 0.64, x + s * 0.65, y - s * 0.47); ctx.quadraticCurveTo(x + s * 0.35, y - s * 0.76, x, y - s * 0.82); ctx.quadraticCurveTo(x - s * 0.38, y - s * 0.78, x - s * 0.63, y - s * 0.48); ctx.fill();
      ctx.fillStyle = "#cf8a4c"; ctx.beginPath(); ctx.moveTo(x - s * 0.09, y); ctx.lineTo(x - s * 0.16, y - s * 0.52); ctx.lineTo(x + s * 0.16, y - s * 0.52); ctx.lineTo(x + s * 0.09, y); ctx.fill();
      ctx.strokeStyle = "#6e2e1d"; ctx.lineWidth = Math.max(1, s * 0.02); for (let i = -3; i <= 3; i += 1) { ctx.beginPath(); ctx.moveTo(x, y - s * 0.45); ctx.lineTo(x + i * s * 0.17, y - s * 0.5); ctx.stroke(); }
    } else if (id === "belokruh") {
      ctx.fillStyle = "#ded9c8"; ctx.beginPath(); ctx.moveTo(x - s * 0.13, y); ctx.lineTo(x - s * 0.1, y - s * 0.58); ctx.lineTo(x + s * 0.1, y - s * 0.58); ctx.lineTo(x + s * 0.15, y); ctx.fill();
      ctx.fillStyle = "#f1eee1"; ctx.beginPath(); ctx.ellipse(x, y - s * 0.62, s * 0.52, s * 0.3, 0, Math.PI, TAU); ctx.quadraticCurveTo(x, y - s * 0.38, x - s * 0.52, y - s * 0.62); ctx.fill();
      ctx.strokeStyle = "#f4f0df"; ctx.lineWidth = Math.max(2, s * 0.06); ctx.beginPath(); ctx.ellipse(x, y - s * 0.35, s * 0.2, s * 0.07, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = "#c7c2ae"; ctx.beginPath(); ctx.ellipse(x, y, s * 0.22, s * 0.08, 0, 0, TAU); ctx.fill();
    } else {
      ctx.shadowColor = "#69b7da"; ctx.shadowBlur = Math.max(6, s * 0.22);
      ctx.fillStyle = "#bed4d4"; ctx.beginPath(); ctx.moveTo(x - s * 0.08, y); ctx.lineTo(x - s * 0.12, y - s * 0.58); ctx.lineTo(x + s * 0.09, y - s * 0.58); ctx.lineTo(x + s * 0.08, y); ctx.fill();
      ctx.fillStyle = "#3a78a5"; ctx.beginPath(); ctx.moveTo(x - s * 0.55, y - s * 0.54); ctx.quadraticCurveTo(x, y - s * 1.02, x + s * 0.52, y - s * 0.54); ctx.quadraticCurveTo(x, y - s * 0.32, x - s * 0.55, y - s * 0.54); ctx.fill();
      ctx.fillStyle = "#d9eef0"; for (let i = 0; i < 7; i += 1) { const a = i * 2.39; ctx.beginPath(); ctx.arc(x + Math.cos(a) * s * 0.31, y - s * (0.64 + Math.sin(a) * 0.13), Math.max(1, s * 0.018), 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }

  function makeWorld() {
    const trees = [];
    const ferns = [];
    let seed = 72931;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 48; i += 1) {
      let x = random() * 28 - 14;
      let z = random() * 28 - 14;
      const nearStart = distance(x, z, 0, 11.4) < 2.2;
      const nearSite = Object.values(SITE_POSITIONS).some((site) => distance(x, z, site.x, site.z) < 1.65);
      if (nearStart || nearSite) { i -= 1; continue; }
      trees.push({ x, z, radius: 0.34 + random() * 0.3, height: 4.5 + random() * 3.8, birch: random() > 0.78 });
    }
    for (let i = 0; i < 125; i += 1) ferns.push({ x: random() * 28 - 14, z: random() * 28 - 14, height: 0.45 + random() * 0.9, kind: random() > 0.38 ? "grass" : "fern", color: random() > 0.5 ? "#486d45" : "#557a4c" });
    Object.entries(SITE_POSITIONS).forEach(([id, site], siteIndex) => {
      for (let i = 0; i < 8; i += 1) {
        const a = i / 8 * TAU + siteIndex * 0.41;
        const radius = 0.38 + (i % 3) * 0.24;
        ferns.push({ x: site.x + Math.cos(a) * radius, z: site.z + Math.sin(a) * radius, height: 0.55 + (i % 4) * 0.14, kind: i % 2 ? "fern" : "grass", color: id === "studenka" ? "#477063" : "#486d45" });
      }
    });
    return { trees, ferns };
  }

  function mushroomHeight(id) {
    return ({ medovka: 0.64, hnedka: 0.72, ohnivka: 0.58, belokruh: 0.82, modravec: 0.68 })[id] || 0.65;
  }

  function phaseName() {
    if (state.phase === "forest") return state.current ? "Nález v porostu" : "Les z první osoby";
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
