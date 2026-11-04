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
    next.explorer = { x: 0, z: 11.4, yaw: Math.PI, pitch: 0 };
    return next;
  }

  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE));
      if (!value || !value.phase) return null;
      if (!value.explorer) value.explorer = { x: 0, z: 11.4, yaw: Math.PI, pitch: 0 };
      if (!Number.isFinite(value.explorer.pitch)) value.explorer.pitch = 0;
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
        <p class="eyebrow">Lýra · pracovní v2-7</p>
        <h1>Klobouky<br><span>a hlízy</span></h1>
        <p class="lede">Les už není seznam zastávek. Je potřeba vejít do porostu, hledat mezi kapradím a rozeznat nález dřív, než skončí v košíku.</p>
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
        <div><p class="eyebrow">Klobouky a hlízy · v2-7</p><h2>${phaseName()}</h2></div>
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
          <canvas id="forest-canvas" width="1280" height="720" tabindex="0" aria-label="Les z pohledu první osoby. Kliknutím aktivuješ ovládání myší."></canvas>
          <div class="crosshair" aria-hidden="true"><i></i><i></i></div>
          <div class="forest-hud"><span id="compass">S</span><span id="forest-count">Nálezy ${state.visited.length}/5</span></div>
          <button class="forest-prompt" id="forest-prompt" data-action="inspect" hidden>Prozkoumat nález <b>E</b></button>
          <div class="look-hint" id="look-hint"><b>Klikni do lesa</b><span>myš · rozhlížení &nbsp; WASD · chůze &nbsp; Shift · běh</span></div>
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
    document.querySelectorAll("[data-resolve]").forEach((button) => button.addEventListener("click", () => {
      const next = E.resolve(state, button.dataset.resolve);
      const returnsToForest = next.phase === "forest" && !next.current;
      set(next);
      if (returnsToForest) requestForestPointerLock();
    }));
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
    const forestView = document.getElementById("forest-view");
    const compass = document.getElementById("compass");
    const keys = new Set();
    let last = performance.now();
    let target = null;
    let dirtySave = false;

    scene = { canvas, keys, raf: 0, cleanups: [], stepPhase: 0, cameraBob: 0, cameraSway: 0, bump: null };

    const onKeyDown = (event) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
      keys.add(event.code);
      if (event.code === "KeyE") inspect();
    };
    const onKeyUp = (event) => keys.delete(event.code);
    const onMouseMove = (event) => {
      if (document.pointerLockElement !== canvas) return;
      state.explorer.yaw = wrap(state.explorer.yaw + event.movementX * 0.00235);
      state.explorer.pitch = clamp(state.explorer.pitch - event.movementY * 0.0019, -0.82, 0.82);
      dirtySave = true;
    };
    const onLock = () => {
      const locked = document.pointerLockElement === canvas;
      lookHint.hidden = locked;
      canvas.classList.toggle("locked", locked);
      forestView.classList.toggle("mouse-active", locked);
      if (locked) canvas.focus();
    };
    const requestLook = () => requestForestPointerLock();

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onLock);
    canvas.addEventListener("click", requestLook);
    prompt.addEventListener("click", inspect);
    scene.cleanups.push(() => window.removeEventListener("keydown", onKeyDown), () => window.removeEventListener("keyup", onKeyUp), () => document.removeEventListener("mousemove", onMouseMove), () => document.removeEventListener("pointerlockchange", onLock), () => canvas.removeEventListener("click", requestLook), () => prompt.removeEventListener("click", inspect));

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
      const blocker = world.trees.find((tree) => distance(nx, nz, tree.x, tree.z) < tree.radius + 0.32);
      if (blocker) {
        const side = (blocker.x - p.x) * Math.cos(p.yaw) - (blocker.z - p.z) * Math.sin(p.yaw);
        scene.bump = { side: side < 0 ? "left" : "right", until: performance.now() + 360 };
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
      if (target) prompt.firstChild.textContent = "Prozkoumat nález ";
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
    if (document.pointerLockElement === scene.canvas) document.exitPointerLock?.();
    cancelAnimationFrame(scene.raf);
    scene.cleanups.forEach((cleanup) => cleanup());
    scene = null;
  }

  function drawForest(ctx, canvas, target, now, cameraBob, cameraSway) {
    const width = canvas.width;
    const height = canvas.height;
    const pitch = state.explorer.pitch || 0;
    const horizon = clamp(height * (0.455 + pitch * 0.62) + cameraBob * height * 0.8, height * 0.06, height * 0.94);
    const cameraHeight = 1.62 + cameraBob;

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
    drawGroundTexture(ctx, width, height, horizon);

    const objects = [];
    world.trees.forEach((item) => pushProjected(objects, item, "tree", width, horizon, cameraHeight, cameraSway));
    world.ferns.forEach((item) => pushProjected(objects, item, item.kind, width, horizon, cameraHeight, cameraSway));
    world.ground.forEach((item) => pushProjected(objects, item, item.kind, width, horizon, cameraHeight, cameraSway));
    E.SITES.forEach((site) => {
      if (state.visited.includes(site.id)) return;
      const pos = SITE_POSITIONS[site.id];
      pushProjected(objects, { ...pos, site, height: mushroomHeight(site.species) }, "mushroom", width, horizon, cameraHeight, cameraSway);
    });
    objects.sort((a, b) => b.depth - a.depth);
    objects.forEach((object) => {
      if (object.kind === "tree") drawTree(ctx, object);
      else if (object.kind === "mushroom") drawMushroom(ctx, object, target && target.id === object.item.site.id);
      else if (object.kind === "rock") drawRock(ctx, object);
      else if (object.kind === "leaf") drawLeaf(ctx, object);
      else drawFoliage(ctx, object);
    });

    const fog = ctx.createLinearGradient(0, horizon - 70, 0, horizon + 190);
    fog.addColorStop(0, "rgba(229,218,181,.13)");
    fog.addColorStop(0.46, "rgba(215,211,177,.055)");
    fog.addColorStop(1, "rgba(220,215,185,0)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, horizon - 70, width, 260);

    const vignette = ctx.createRadialGradient(width / 2, height * 0.48, height * 0.12, width / 2, height * 0.5, width * 0.72);
    vignette.addColorStop(0, "rgba(4,12,8,0)");
    vignette.addColorStop(0.72, "rgba(4,12,8,.03)");
    vignette.addColorStop(1, "rgba(4,12,8,.48)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    drawCollisionScratch(ctx, width, height, now);
  }

  function drawCollisionScratch(ctx, width, height, now) {
    const bump = scene?.bump;
    if (!bump || now >= bump.until) return;
    const remaining = clamp((bump.until - now) / 360, 0, 1);
    const left = bump.side === "left";
    const edge = left ? width * 0.015 : width * 0.985;
    const inward = left ? 1 : -1;
    ctx.save();
    ctx.globalAlpha = Math.sin(remaining * Math.PI) * 0.9;
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

  function pushProjected(list, item, kind, width, horizon, cameraHeight, cameraSway) {
    const p = state.explorer;
    const dx = item.x - p.x;
    const dz = item.z - p.z;
    const depth = dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw);
    if (depth < 0.3 || depth > 31) return;
    const side = dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw);
    const focal = width / (2 * Math.tan(FOV / 2));
    const screenX = width / 2 + side / depth * focal + cameraSway * width;
    const groundY = horizon + cameraHeight / depth * focal;
    const scale = focal / depth;
    const maxWidth = (kind === "tree" ? 2.5 : kind === "mushroom" ? 1.3 : 2) * scale;
    if (screenX < -maxWidth || screenX > width + maxWidth) return;
    list.push({ item, kind, depth, x: screenX, y: groundY, scale, fog: clamp(1 - (depth - 5) / 28, 0.22, 1) });
  }

  function drawGroundTexture(ctx, width, height, horizon) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#d2bd7a";
    for (let i = 1; i < 20; i += 1) {
      const y = horizon + Math.pow(i / 19, 1.75) * (height - horizon);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(width * 0.5, y + Math.sin(i * 1.7) * 5, width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.08;
    for (let i = -6; i <= 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(width / 2, horizon);
      ctx.lineTo(width / 2 + i * width * 0.13, height);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTree(ctx, object) {
    const { item, x, y, scale, fog } = object;
    const height = item.height * scale;
    const trunk = clamp(item.radius * scale * 1.45, 4, 310);
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

    const crown = Math.min(390, scale * (item.birch ? 3.15 : 3.8));
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
    const h = Math.min(190, item.height * scale);
    const w = Math.max(2, h * (kind === "fern" ? 0.85 : 0.55));
    ctx.save();
    ctx.globalAlpha = fog * 0.94;
    ctx.strokeStyle = kind === "fern" ? item.color : item.color || "#77905b";
    ctx.fillStyle = item.color || "#557a4c";
    ctx.lineWidth = Math.max(1, h * 0.022);
    if (kind === "fern") {
      for (let arm = -2; arm <= 2; arm += 1) {
        const tipX = x + arm * w * 0.31;
        const tipY = y - h * (0.78 + Math.abs(arm) * 0.025);
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.quadraticCurveTo(x + arm * w * 0.1, y - h * 0.45, tipX, tipY);
        ctx.stroke();
        for (let leaf = 2; leaf <= 7; leaf += 1) {
          const t = leaf / 8;
          const lx = x + (tipX - x) * t;
          const ly = y + (tipY - y) * t;
          const leafSize = h * (0.075 * (1 - t * 0.55));
          ctx.beginPath(); ctx.ellipse(lx - leafSize * 0.56, ly, leafSize, leafSize * 0.26, -0.45 + arm * 0.05, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.ellipse(lx + leafSize * 0.56, ly, leafSize, leafSize * 0.26, 0.45 + arm * 0.05, 0, TAU); ctx.fill();
        }
      }
    } else {
      for (let blade = -5; blade <= 5; blade += 1) {
        const bend = blade * w * 0.085;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + bend * 0.15, y - h * 0.58, x + bend, y - h * (0.72 + Math.abs(blade % 3) * 0.1)); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawRock(ctx, object) {
    const s = Math.min(170, object.scale * object.item.height);
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
    const s = Math.min(42, Math.max(2, object.scale * object.item.height));
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

  function drawMushroom(ctx, object, isTarget) {
    const id = object.item.site.species;
    const s = Math.min(150, object.scale * object.item.height);
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

  function makeWorld() {
    const trees = [];
    const ferns = [];
    const ground = [];
    let seed = 72931;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 52; i += 1) {
      let x = random() * 28 - 14;
      let z = random() * 28 - 14;
      const nearStart = distance(x, z, 0, 11.4) < 2.2;
      const nearSite = Object.values(SITE_POSITIONS).some((site) => distance(x, z, site.x, site.z) < 1.65);
      if (nearStart || nearSite) { i -= 1; continue; }
      trees.push({ x, z, radius: 0.3 + random() * 0.34, height: 4.8 + random() * 4.4, birch: random() > 0.76, warm: random() > 0.55, seed: Math.floor(random() * 97) });
    }
    for (let i = 0; i < 185; i += 1) ferns.push({ x: random() * 28 - 14, z: random() * 28 - 14, height: 0.42 + random() * 1.05, kind: random() > 0.45 ? "grass" : "fern", color: random() > 0.5 ? "#3f6744" : "#5a7d4e" });
    for (let i = 0; i < 70; i += 1) {
      const rock = random() > 0.72;
      ground.push({ x: random() * 28 - 14, z: random() * 28 - 14, height: rock ? 0.18 + random() * 0.34 : 0.08 + random() * 0.1, kind: rock ? "rock" : "leaf", light: random() > 0.5, angle: random() * TAU, color: random() > 0.5 ? "#9c6f3c" : "#6c4c2f" });
    }
    Object.entries(SITE_POSITIONS).forEach(([id, site], siteIndex) => {
      for (let i = 0; i < 8; i += 1) {
        const a = i / 8 * TAU + siteIndex * 0.41;
        const radius = 0.38 + (i % 3) * 0.24;
        ferns.push({ x: site.x + Math.cos(a) * radius, z: site.z + Math.sin(a) * radius, height: 0.55 + (i % 4) * 0.14, kind: i % 2 ? "fern" : "grass", color: id === "studenka" ? "#477063" : "#486d45" });
      }
    });
    return { trees, ferns, ground };
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
