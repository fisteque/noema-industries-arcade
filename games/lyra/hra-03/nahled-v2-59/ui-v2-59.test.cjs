const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "engine.js"), "utf8");
const style = fs.readFileSync(path.join(root, "style.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert.match(app, /STORAGE = "lyra-klobouky-a-hlizy-v2-59-preview"/);
assert.match(app, /LEGACY_STORAGE = "lyra-klobouky-a-hlizy-v2-58-preview"/);
assert.match(app, /Lýra · pracovní v2-59/);
assert.match(html, /style\.css\?rev=2-59-1/);
assert.match(html, /lib\/content-registry\.js\?rev=2-59-1/);
assert.match(html, /engine\.js\?rev=2-59-1/);
assert.match(html, /app\.js\?rev=2-59-1/);

// Pohled, pointer lock a návrat do menu zůstávají chráněné.
assert.match(app, /const VERTICAL_LOOK = 0\.86/);
assert.match(app, /const LOOK_DOWN_LIMIT = -1\.46/);
assert.match(app, /const LOOK_UP_LIMIT = 1\.42/);
assert.doesNotMatch(app, /projectedY|projectedDepth|CAMERA_PITCH_SCALE/);
assert.match(app, /pitchOffset = clamp\(p\.pitch \|\| 0, LOOK_DOWN_LIMIT, LOOK_UP_LIMIT\) \* height \* VERTICAL_LOOK/);
assert.match(app, /viewAngle = Math\.atan2\(lateral, forward\)/);
assert.match(app, /x: width \/ 2 \+ viewAngle \* \(width \/ FOV\)/);
assert.match(app, /height \* 0\.455 \+ pitchOffset - \(worldY - cameraHeight\) \/ distance \* focal/);
assert.match(app, /scale = base\.focal \/ Math\.max\(base\.distance, 0\.12\)/);
assert.doesNotMatch(app, /billboardStretch|function drawProjectedObject/);
assert.match(app, /value\.phase === "evening-order" && value\.soup && value\.potion/);
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
assert.match(app, /Tip = nejisté/);
assert.doesNotMatch(app, /Houba \$\{index \+ 1\} · neznámá/);
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




// V2-52 drží obslužné zkratky pohromadě a seznamy už neroztahují řádky.
assert.match(app, /phase-lower-shortcut[\s\S]*?Deník cesty[\s\S]*?Hlavní menu/);
assert.match(app, /forest-lower-shortcut[\s\S]*?Deník cesty[\s\S]*?Hlavní menu/);
assert.match(style, /V2-52:[\s\S]*?align-content: start;[\s\S]*?grid-auto-rows: max-content/);

// Dílna má krátké jednorádkové popisy a bez nadpisu potvrzení zápisníkem.
assert.doesNotMatch(app, /Houba \$\{index \+ 1\} · potvrzeno zápisníkem/);
assert.match(app, /Neověřený tip\. Do vaření půjde pod tímto názvem\./);
assert.doesNotMatch(app, /pokud ho neověříš/);
assert.match(style, /compact-list-stage \.atlas-line \{[\s\S]*?white-space: nowrap;[\s\S]*?text-overflow: ellipsis/);

// Závěr a krb mají obousměrné E/Q ovládání.
assert.match(app, /data-next-day data-key-e><kbd>E<\/kbd> Další den/);
assert.match(app, /data-ending-fireplace data-key-q><kbd>Q<\/kbd> Ke krbu/);
assert.match(app, /function renderFireplace\([\s\S]*?data-ending-summary data-key-q><kbd>Q<\/kbd> Zpět na závěr dne/);
assert.match(app, /state\.phase === "ending"[\s\S]*?endingView = endingView === "fireplace" \? "summary" : "fireplace"/);


// V2-54: hotové karty začínají názvem a legenda dál obsahuje červené „Nevím“.
const lexiconCard = app.slice(app.indexOf('if (decision === "lexicon")'), app.indexOf('if (decision === "memory-exclusion")'));
assert.doesNotMatch(lexiconCard, /class="kicker"/);
assert.doesNotMatch(lexiconCard, /Lexikon určil druh/);
assert.doesNotMatch(lexiconCard, /Lexikon potvrdil lesní tip/);
assert.equal((lexiconCard.match(/<p /g) || []).length, 1);
const completedCards = app.slice(app.indexOf('if (decision === "memory")'), app.indexOf('const unknownSelected'));
assert.doesNotMatch(completedCards, /class="kicker"/);
assert.match(app, /certain-key">Zápisník a lexikon = jisté/);
assert.match(app, /guess-key">Tip = nejisté/);
assert.match(app, /unknown-key">Nevím = jisté/);
assert.match(style, /identification-legend \.unknown-key \{[\s\S]*?rgba\(105, 42, 35, \.82\)/);

// Nové klávesy platí v obsluze i nápovědě; Q zavírá vrstvu před přepnutím krbu.
const keyboard = app.slice(app.indexOf("function handleGameKey"), app.indexOf("function paintMushroomIcons"));
assert.match(keyboard, /code === "KeyX" \|\| code === "KeyC"/);
assert.match(keyboard, /code === "KeyR" && state\.phase === "forest"/);
assert.doesNotMatch(keyboard, /KeyV/);
assert.doesNotMatch(app, /keys\.has\("KeyR"\)/);
assert.ok(keyboard.indexOf("if (forestPanelView)") < keyboard.indexOf('if (state.phase === "ending")'));
assert.match(app, /<kbd>C<\/kbd><span>Zápisník/);
assert.match(app, /<kbd>R<\/kbd><span>Sníst chleba/);
assert.match(app, /function renderFireplace\([\s\S]*?bind\(\);\s*paintMushroomIcons\(\);/);
assert.match(style, /home-id-row\.guessed \.row-actions button \{[\s\S]*?background: #e4bd69/);
const verifiedRow = app.slice(app.indexOf('if (decision === "lexicon")'), app.indexOf('if (decision === "memory-exclusion")'));
assert.match(verifiedRow, /\$\{journalButton\}/);
assert.doesNotMatch(verifiedRow, /\$\{lexiconButton\}/);

console.log("v2-59 confidence-colored actions and stable geometry passed");

