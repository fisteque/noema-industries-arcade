const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "engine.js"), "utf8");
const content = fs.readFileSync(path.join(root, "lib/content-registry.js"), "utf8");
const style = fs.readFileSync(path.join(root, "style.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert.match(app, /STORAGE = "lyra-klobouky-a-hlizy-v2-72-preview"/);
assert.match(app, /LEGACY_STORAGE = "lyra-klobouky-a-hlizy-v2-71-preview"/);
assert.match(app, /Lýra · pracovní v2-72/);
assert.match(html, /style\.css\?rev=2-72/);
assert.match(html, /lib\/content-registry\.js\?rev=2-72/);
assert.match(html, /engine\.js\?rev=2-72/);
assert.match(html, /app\.js\?rev=2-72/);

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
assert.match(app, /"Podle zápisníku"/);
assert.match(app, /Není to tahle/);
assert.match(app, /Poznána stopa/);
assert.match(app, /E\.recognizeFromKnowledge\(state, target\.source, target\.index/);
assert.match(engine, /function recognizeFromKnowledge/);
assert.match(engine, /homeDecision = "memory-exclusion"/);
assert.match(engine, /tahle houba není \$\{entry\.title\}/);

// Domácí určování je napravo, cena lexikonu je krátká a zdroj jistoty je čitelný.
assert.match(style, /\.compact-list-stage \.home-list-copy \{[\s\S]*?right: 3%;[\s\S]*?left: 22%;/);
assert.match(app, /Zápisník a lexikon = jisté/);
assert.match(app, /Tip = nejisté/);
assert.doesNotMatch(app, /Houba \$\{index \+ 1\} · neznámá/);
assert.doesNotMatch(app, /Tip od stolu zabere 15 minut a zůstane žlutý/);
assert.match(app, /Lexikon · \$\{lexiconMinutes\} min · ✦ \$\{lexiconCost\}/);
assert.doesNotMatch(app, /lexiconFoodCost|hungerCostForMinutes/);
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
assert.match(app, /const sunrise = E\.TIMINGS\.dayStart/);
assert.match(app, /const sunset = E\.TIMINGS\.nightStart/);
assert.match(app, /const solarNoon = \(sunrise \+ sunset\) \/ 2/);
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
assert.doesNotMatch(style, /home-id-row\.guessed \.row-actions button \{[\s\S]*?background: #e4bd69/);
assert.match(style, /V2-61:[\s\S]*?workroom-stage\.compact-list-stage[\s\S]*?min-height: 720px !important/);
assert.match(style, /V2-61:[\s\S]*?home-list-copy \{[\s\S]*?inset: 118px 3% 92px;[\s\S]*?overflow: hidden/);
assert.match(style, /V2-61:[\s\S]*?home-id-list \{[\s\S]*?flex: 1 1 auto;[\s\S]*?overflow-y: auto/);
assert.match(style, /V2-61:[\s\S]*?row-actions \{[\s\S]*?flex-wrap: nowrap/);
assert.match(style, /V2-61:[\s\S]*?cooking-list-panel \{[\s\S]*?inset: 118px 3% 190px/);
assert.match(style, /V2-61:[\s\S]*?workstation-action \{[\s\S]*?grid-template-columns: repeat\(2/);
assert.match(style, /V2-61:[\s\S]*?fireplace-copy \{[\s\S]*?inset: 118px 3% 96px/);
assert.match(engine, /doma sytost neubývá/);
assert.match(style, /V2-62:[\s\S]*?fireplace-copy \{[\s\S]*?left: auto;[\s\S]*?width: min\(360px, 56%\)/);
assert.match(style, /V2-62:[\s\S]*?fireplace-copy \.ending-actions \{[\s\S]*?grid-template-columns: 1fr/);
assert.match(style, /V2-62:[\s\S]*?fireplace-chair \{[\s\S]*?left: 24%/);
assert.match(style, /V2-63:[\s\S]*?fireplace-copy \{[\s\S]*?bottom: auto;[\s\S]*?max-height: calc\(100% - 220px\);[\s\S]*?align-content: start/);
const verifiedRow = app.slice(app.indexOf('if (decision === "lexicon")'), app.indexOf('if (decision === "memory-exclusion")'));
assert.match(verifiedRow, /\$\{journalButton\}/);
assert.doesNotMatch(verifiedRow, /\$\{lexiconButton\}/);

// V2-64: polévka má E/Q rozhodnutí a ráno vlastní volbu před vstupem do lesa.
assert.match(app, /data-eat-soup data-key-e><kbd>E<\/kbd> Sníst polévku · 30 min/);
assert.match(app, /data-leave-soup data-key-q><kbd>Q<\/kbd> Nechat v hrnci/);
assert.match(app, /data-eat-cold-soup data-key-e><kbd>E<\/kbd> Sníst studenou · 30 min/);
assert.match(app, /data-leave-cold-soup data-key-q><kbd>Q<\/kbd> Nechat zaschnout · vyrazit hned/);
assert.match(app, /state\.carriedItem\?\.kind === "potato" \? "S bramborou v ruce zabere každý čtverec chůze 2 minuty\./);
assert.match(app, /E\.isNight\(state\.minutes\) \? "alchemy-night" : "alchemy-day"/);
assert.match(style, /V2-64:[\s\S]*?\.cooking-result-actions,[\s\S]*?\.morning-soup-actions/);

// V2-65: hrnec má vlastní stav a plný zápisník neblokuje použití lexikonu.
assert.match(app, /data-wash-pot data-key-e><kbd>E<\/kbd> Umýt hned · 30 min/);
assert.match(app, /data-leave-pot-dirty data-key-q><kbd>Q<\/kbd>/);
assert.match(app, /data-replace-knowledge="\$\{esc\(entry\.id\)\}">Vymazat/);
assert.match(app, /data-dismiss-pending-knowledge data-key-q><kbd>Q<\/kbd> Nezapisovat nový poznatek/);
assert.doesNotMatch(app, /lexiconDisabled = state\.focus < lexiconCost \|\| E\.isDepleted\(state\) \|\| memoryFull/);
assert.match(style, /V2-65:[\s\S]*?knowledge-overflow-backdrop/);
assert.match(style, /V2-65:[\s\S]*?cold-soup-bowl \{ display: none/);

// V2-66: nábytek v chaloupce zůstává za mobilním dialogem a hrnek sedí na stolku.
assert.match(style, /V2-66:[\s\S]*?\.cottage-stage \.scene-copy \{ z-index: 6/);
assert.match(style, /\.cottage-stage \.cottage-tea-table \{ z-index: 3/);
assert.match(style, /\.cottage-tea-table \.tea-cup \{ bottom: calc\(100% - 8px\)/);
assert.match(style, /V2-66:[\s\S]*?\.cottage-stage \.cottage-tea-table[\s\S]*?transform: scale\(\.5\)/);

// V2-67: plný zápisník ukazuje ikony i celé texty a úspěšné porovnání zápisník zavře.
assert.match(app, /knowledge-overflow-icon[\s\S]*?pending-knowledge[\s\S]*?\$\{esc\(pending\.text\)\}/);
assert.match(app, /knowledge-overflow-copy[\s\S]*?\$\{esc\(entry\.text\)\}/);
assert.match(app, /const recognized = !next\.error;[\s\S]*?forestPanelView: null,[\s\S]*?memoryTarget: null/);
assert.match(style, /V2-67:[\s\S]*?knowledge-overflow-panel \.knowledge-overflow-copy span[\s\S]*?white-space: normal/);

// Na špinavý hrnec se upozorňuje až před polévkou, ne při příchodu.
const arrival = app.slice(app.indexOf("function homeArrivalPanel"), app.indexOf("function homeIdentificationTablePanel"));
assert.doesNotMatch(arrival, /potStatusInfo|pot-status|data-wash-pot/);
const order = app.slice(app.indexOf("function orderPanel"), app.indexOf("function identificationStatus"));
assert.match(order, /potStatusInfo/);
assert.match(order, /data-wash-pot/);

// Vaření ukazuje cenu i noční pravidla; spánek dědí zdroje, obnovuje focus podle obtížnosti a hra končí až na obou nulách.
assert.match(app, /Uvařit lektvar" : "Uvařit polévku"} · \$\{E\.TIMINGS\[kind\]\} min · ✦ \$\{focusCost\}/);
assert.match(app, /Po \$\{E\.clock\(E\.TIMINGS\.nightStart\)\} už je tma/);
assert.match(engine, /function morningPreview/);
assert.match(engine, /normalSleepFocus/);
assert.match(engine, /easySleepFocus/);
assert.match(engine, /else if \(state\.focus > 0\)[\s\S]*?state\.focus = Math\.max\(0, state\.focus - 1\)/);
assert.match(engine, /state\.gameOver = true/);
assert.match(app, /function renderGameOver/);

// V2-68: úplné vyčerpání má příběhový závěr a přímé volby E/Q.
assert.match(app, /Klobouk jde na hřebík/);
assert.match(app, /Pověsíš čarodějnický klobouk na hřebík, zavřeš zápisník a jdeš se pořádně najíst do města/);
assert.match(app, /data-new-game data-key-e><kbd>E<\/kbd> Začít novou hru/);
assert.match(app, /data-title-screen data-key-q><kbd>Q<\/kbd> Hlavní menu/);
assert.match(style, /V2-68:[\s\S]*?retired-witch-hat/);

// V2-69: zápisník má kratší akci, u odchodu lze sníst chleba a polévka zachrání i při obou nulách.
assert.match(app, /data-confirm-bread><kbd>R<\/kbd> Sníst chleba/);
assert.match(app, /forestPanelView: "home-confirm"/);
assert.match(style, /V2-69:[\s\S]*?overlay-memory \.memory-actions button[\s\S]*?font-size: \.68rem/);
assert.match(engine, /function canStillEatSoup/);
assert.match(engine, /if \(canStillEatSoup\(state\)\) return false/);
assert.match(app, /const soupBlocked = false/);

// V2-70: večerní text je kratší a každý poznatek má rozbalitelný úplný popis.
assert.doesNotMatch(order, /Po vynechání jednoho vaření/);
assert.match(order, /Pracuje se hůř a každá započatá hodina krátí odpočinek na další den/);
assert.match(app, /data-description-knowledge="\$\{esc\(entry\.id\)\}">Popis/);
assert.match(app, /memoryDescriptionId[\s\S]*?memory-description-panel/);
assert.match(app, /function knowledgeDescriptionContent[\s\S]*?Co sis zapsala[\s\S]*?\$\{esc\(entry\.text\)\}/);
assert.match(app, /const clues = species\?\.clues/);
assert.match(app, /Znaky ze sběru/);
assert.match(app, /Recepty a použití/);
assert.match(content, /use: "[^"]+"/);
assert.match(style, /V2-70:[\s\S]*?memory-description-panel/);

// V2-71: hlad ubývá po hodině, domácí HUD varuje barvou a známá houba už není tipovací formulář.
assert.match(content, /hungerTick: 60/);
assert.match(app, /phase-meters[\s\S]*?class="\$\{hungerClass\}" title="Sytost"/);
assert.match(style, /V2-71:[\s\S]*?phase-meters span\.meter-warning[\s\S]*?phase-meters span\.meter-danger/);
assert.match(app, /const recognizedByNotebook = Boolean\(guessedSpecies && record\.memoryKnowledgeId\)/);
assert.match(app, /recognizedByNotebook[\s\S]*?basket-notebook-description[\s\S]*?Určeno zápisníkem/);
assert.match(style, /basket-overlay-item\.notebook-identified[\s\S]*?basket-notebook-description/);

// Popis je dostupný u nového i nahrazovaného poznatku a Q se z detailu vrací k výběru.
assert.match(app, /data-overflow-description="\$\{esc\(pending\.id\)\}">Popis/);
assert.match(app, /data-overflow-description="\$\{esc\(entry\.id\)\}">Popis/);
assert.match(app, /knowledge-overflow-description-panel[\s\S]*?knowledgeDescriptionContent\(describedEntry\)/);
assert.match(app, /if \(overflowDescriptionId\)[\s\S]*?overflowDescriptionId = null;[\s\S]*?render\(\)/);

// V2-72: zápisníková jistota je zelená i v malém košíku a lesní popis je menší a rolovací.
assert.match(app, /const notebookIdentified = Boolean\(record\?\.speciesGuess && record\?\.memoryKnowledgeId\)/);
assert.match(app, /notebookIdentified \? " notebook-identified"/);
assert.match(app, /Určeno zápisníkem ·/);
assert.match(style, /V2-72:[\s\S]*?shortcut-slot\.notebook-identified/);
assert.match(style, /scene-modal\.forest-soft-panel\.forest-book\.memory-description-panel[\s\S]*?max-height: min\(390px,[\s\S]*?overflow-y: auto;[\s\S]*?touch-action: pan-y/);
assert.match(style, /scene-modal\.forest-soft-panel\.forest-book\.memory-description-panel section p,[\s\S]*?font-size: \.68rem/);

console.log("v2-72 shortcut certainty and scrollable forest description passed");

