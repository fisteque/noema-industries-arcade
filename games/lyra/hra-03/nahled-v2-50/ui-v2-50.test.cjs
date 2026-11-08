const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const style = fs.readFileSync(path.join(root, "style.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert.match(app, /STORAGE = "lyra-klobouky-a-hlizy-v2-50-preview"/);
assert.match(app, /LEGACY_STORAGE = "lyra-klobouky-a-hlizy-v2-49-preview"/);
assert.match(app, /Lýra · pracovní v2-50/);
assert.match(html, /style\.css\?rev=2-50-1/);
assert.match(html, /app\.js\?rev=2-50-1/);

// Pohled se opravdu může sklopit téměř kolmo k zemi.
assert.match(app, /const VERTICAL_LOOK = 1\.02/);
assert.match(app, /const LOOK_DOWN_LIMIT = -1\.54/);
assert.match(app, /const LOOK_UP_LIMIT = 1\.47/);
assert.match(app, /clamp\(state\.explorer\.pitch - clamp\(dy, -90, 90\) \* 0\.00375, LOOK_DOWN_LIMIT, LOOK_UP_LIMIT\)/);
assert.match(app, /clamp\(\(state\.explorer\.pitch \|\| 0\) - 0\.34, LOOK_DOWN_LIMIT, LOOK_UP_LIMIT\)/);
assert.match(app, /clamp\(height \* 0\.455 \+ pitch \* verticalLook, height \* -1\.15, height \* 2\.05\)/);

// Start, pokračování i další den znovu žádají ovládání myší.
assert.match(app, /function start\([\s\S]*?set\(freshState[\s\S]*?resumeForestLook\(\);/);
assert.match(app, /function continueSavedGame\([\s\S]*?render\(\);[\s\S]*?resumeForestLook\(\);/);
assert.match(app, /function startNextDay\([\s\S]*?set\(freshState\(state\)\);[\s\S]*?resumeForestLook\(\);/);
assert.match(app, /data-continue>Pokračovat · den \$\{savedState\.day \|\| 1\} · \$\{savedState\.difficulty === "easy" \? "lehká" : "normální"\}/);
assert.match(app, /if \(code === "KeyH"\) \{\s*returnToTitle\(\);/);
assert.match(app, /data-title-screen><kbd>H<\/kbd><span>Hlavní menu<\/span>/);

// Určování doma nezvětšuje neznámou kartu růžovou výzvou.
assert.doesNotMatch(app, /Tipni druh, otevři lexikon, nebo nech/);
assert.match(app, /\$\{unknownSelected \? '<h4 class="unknown-label">Nevím<\/h4>' : ""\}/);
assert.match(app, /<div class="id-grid species-options">\$\{guessOptions\}<\/div>/);

// V košíku jsou u neurčené houby rovnou volby a až pod nimi krátká cena tipu.
assert.doesNotMatch(app, /Nevím druh/);
assert.match(app, /const name = unknown \? "" : E\.getSpecies\(record\.speciesGuess\)\.name/);
assert.match(app, /\$\{unknown \? "" : `<b>\$\{esc\(name\)\}<\/b><small>\$\{esc\(method\)\}<\/small>`\}/);
assert.match(app, /<div class="basket-inline-options">\$\{forestChoices\}<button[\s\S]*?>Nevím<\/button><\/div><p class="basket-guess-question">Tipni si, zabere to 5 min\.<\/p>/);

// Vynechání je přímo pod vařením a používá Q.
assert.match(app, /class="workstation-action[\s\S]*?data-cook="\$\{kind\}"[\s\S]*?data-skip="\$\{kind\}" data-key-q><kbd>Q<\/kbd>/);
assert.match(app, /state\.phase === "soup" \|\| state\.phase === "potion"[\s\S]*?querySelector\("\[data-skip\]"\)/);
assert.match(style, /\.workstation-action \{[\s\S]*?justify-items: stretch;[\s\S]*?min-width: 190px;/);
assert.match(style, /\.workstation-action > button \{ width: 100%; \}/);
assert.match(style, /\.indoor-stage\.result-workstation-stage \.cooking-result-copy \{ bottom: 90px; \}/);

// Závěr zachovává stav i nabídky kromě košíku a sjednocuje ikony.
const ending = app.slice(app.indexOf("function renderEnding()"), app.indexOf("function bind()"));
assert.match(ending, /\$\{header\(\)\}/);
assert.match(ending, /\$\{phaseHud\(\)\}/);
assert.match(ending, /\$\{utilityOverlay\(\)\}/);
assert.doesNotMatch(ending, /data-forest-panel="basket"/);
assert.match(ending, /ending-summary-icon ending-result-icon/);
assert.match(ending, /ending-id-icon ending-summary-icon/);
assert.match(style, /\.ending-room\.indoor-stage \.ending-copy \{\s*inset: 92px 10% 52px;/);
assert.match(style, /\.ending-summary-icon \{[\s\S]*?width: 48px !important;[\s\S]*?height: 42px !important;/);
assert.match(style, /\.ending-room \.ending-identification \{[\s\S]*?grid-template-columns: 48px minmax\(0, 1fr\);/);

// Dřívější důležité vlastnosti náhledu zůstávají chráněné.
assert.match(app, /const solarNoon = 12 \* 60/);
assert.match(app, /0 \+ \(-Math\.PI \/ 2\) \* arcProgress/);
assert.match(app, /sameStateApartFromError\(state, next\)/);
assert.match(app, /scheduleTransientMessage/);
assert.match(app, /data-choice-number="\$\{index \+ 1\}"/);
assert.match(app, /data-choice-number="4"/);
assert.match(style, /\.indoor-stage \{[\s\S]*?aspect-ratio: 16 \/ 9;/);
assert.match(style, /\.compact-list-stage \.home-id-list \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
assert.match(style, /\.scene-modal\.forest-soft-panel\.forest-book,[\s\S]*?\.scene-modal\.forest-soft-panel\.basket-overlay \{[\s\S]*?width: min\(620px,[\s\S]*?height: min\(500px,/);

console.log("v2-50 controls, guessing, cooking and ending layout passed");
