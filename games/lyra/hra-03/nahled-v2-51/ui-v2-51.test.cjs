const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "engine.js"), "utf8");
const style = fs.readFileSync(path.join(root, "style.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert.match(app, /STORAGE = "lyra-klobouky-a-hlizy-v2-51-preview"/);
assert.match(app, /LEGACY_STORAGE = "lyra-klobouky-a-hlizy-v2-50-preview"/);
assert.match(app, /Lýra · pracovní v2-51/);
assert.match(html, /style\.css\?rev=2-51-1/);
assert.match(html, /lib\/content-registry\.js\?rev=2-51-1/);
assert.match(html, /engine\.js\?rev=2-51-1/);
assert.match(html, /app\.js\?rev=2-51-1/);

// Pohled, pointer lock a návrat do menu zůstávají chráněné.
assert.match(app, /const LOOK_DOWN_LIMIT = -1\.54/);
assert.match(app, /const LOOK_UP_LIMIT = 1\.47/);
assert.match(app, /function start\([\s\S]*?resumeForestLook\(\);/);
assert.match(app, /function continueSavedGame\([\s\S]*?resumeForestLook\(\);/);
assert.match(app, /function startNextDay\([\s\S]*?resumeForestLook\(\);/);
assert.match(app, /if \(code === "KeyH"\)/);

// Košík je úzký hnědý panel, bez popisku „určeno v lese“.
const basketRow = app.slice(app.indexOf("function basketItemRow"), app.indexOf("function utilityOverlay"));
assert.doesNotMatch(basketRow, /určeno v lese/);
assert.match(basketRow, /basket-inline-options[\s\S]*?inventory-action-row[\s\S]*?Tipni si, zabere to 5 min\.[\s\S]*?data-open-memory[\s\S]*?data-discard-inventory[\s\S]*?>Vyhodit</);
assert.match(app, /data-discard-inventory="hand:0">Zahodit/);
assert.match(style, /basket-overlay \{[\s\S]*?rgba\(55, 35, 22, \.92\)/);
assert.match(style, /forest-book \{[\s\S]*?rgba\(11, 39, 24, \.94\)/);
assert.ok(style.lastIndexOf("V2-51") > style.lastIndexOf("V2-50"));
assert.match(style.slice(style.lastIndexOf("V2-51")), /width: min\(520px, calc\(100% - 24px\)\)/);

// Zápisník je dostupný u nálezu, košíku i domácího určování a rozhoduje až po kliknutí.
assert.match(app, /data-open-memory="current:0"/);
assert.match(app, /data-open-memory="\$\{memoryTargetToken\(\{ source, index \}\)\}"/);
assert.match(app, /data-open-memory="home:\$\{index\}"/);
assert.match(app, /data-recognize-knowledge="\$\{esc\(entry\.id\)\}"/);
assert.match(app, /"Rozpoznat"/);
assert.match(app, /Není to tahle/);
assert.match(app, /Poznána stopa/);
assert.match(app, /E\.recognizeFromKnowledge\(state, memoryTarget\.source, memoryTarget\.index/);
assert.match(engine, /function recognizeFromKnowledge/);
assert.match(engine, /homeDecision = "memory-exclusion"/);
assert.match(engine, /tahle houba není \$\{entry\.title\}/);

// Domácí určování je napravo, cena je ikonová a zdroj jistoty je čitelný.
assert.match(style, /\.compact-list-stage \.home-list-copy \{[\s\S]*?right: 3%;[\s\S]*?left: 22%;/);
assert.match(app, /Zápisník a lexikon = jisté/);
assert.match(app, /Žlutá = tip/);
assert.match(app, /\(tip zabere 15 min\)/);
assert.doesNotMatch(app, /Tip od stolu zabere 15 minut a zůstane žlutý/);
assert.match(app, /Lexikon · \$\{lexiconMinutes\} min · 🥣 \$\{lexiconFoodCost\} · ✦ \$\{lexiconCost\}/);
assert.match(app, /class="id-choice species-button text-only guess-option"/);
assert.match(app, /class="lexicon-action"/);
assert.match(app, /class="memory-action"/);
assert.match(style, /\.guess-option \{[\s\S]*?background: #e4bd69/);
assert.match(style, /\.row-actions \.lexicon-action,[\s\S]*?\.row-actions \.memory-action \{[\s\S]*?background: rgba\(53, 119, 67, \.52\)/);

// Závěr zachovává stav, maluje ikony hub a nezobrazuje košík.
const ending = app.slice(app.indexOf("function renderEnding()"), app.indexOf("function bind()"));
assert.match(ending, /\$\{phaseHud\(\)\}/);
assert.match(ending, /\$\{utilityOverlay\(\)\}/);
assert.doesNotMatch(ending, /data-forest-panel="basket"/);
assert.match(ending, /ending-id-icon ending-summary-icon/);
assert.match(ending, /bind\(\);\s*paintMushroomIcons\(\);/);
assert.match(style, /\.ending-room \.ending-identification \.ending-id-icon \{[\s\S]*?width: 48px !important;[\s\S]*?height: 42px !important;/);

// Vaření má Q pod hlavní akcí a slunce stále prochází jihem.
assert.match(app, /class="workstation-action[\s\S]*?data-cook="\$\{kind\}"[\s\S]*?data-skip="\$\{kind\}" data-key-q><kbd>Q<\/kbd>/);
assert.match(app, /const solarNoon = 12 \* 60/);
assert.match(app, /0 \+ \(-Math\.PI \/ 2\) \* arcProgress/);

console.log("v2-51 notebook recognition and compact UI checks passed");
