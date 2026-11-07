const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const style = fs.readFileSync(path.join(root, "style.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert.match(app, /lyra-klobouky-a-hlizy-v2-45-preview/);
assert.match(app, /LEGACY_STORAGE = "lyra-klobouky-a-hlizy-v2-44-preview"/);
assert.match(style, /\.forest-hud \.forest-meters \{\s*top: 0;\s*left: 0;\s*right: auto;/);
assert.match(style, /\.forest-shortcuts \{\s*top: 38px;/);
assert.match(style, /@media \(max-width: 460px\)[\s\S]*?\.forest-hud #compass \{\s*right: 0;\s*left: auto;\s*transform: none;/);
assert.match(style, /\.touch-controls \{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
assert.match(style, /\.forest-shortcuts kbd,\s*\.forest-lower-shortcut kbd \{\s*width: 18px;/);
assert.doesNotMatch(app, /<nav class="phase-shortcuts">\s*<button data-forest-panel="basket"/);
assert.match(app, /code === "KeyF" && state\.phase === "forest"/);
assert.match(style, /\.forest-shortcuts button:not\(\.basket-shortcut\) > span:not\(\.shortcut-items\),[\s\S]*?\.phase-lower-shortcut button > span \{\s*display: inline;/);
assert.match(app, /data-skip="soup">Vynechat polévku/);
assert.match(app, /data-finish-evening>Ukončit večer/);
assert.match(app, /sunWorldAzimuth = Math\.PI \/ 2 - dayProgress \* Math\.PI/);
assert.match(app, /Math\.pow\(Math\.sin\(dayProgress \* Math\.PI\), 0\.82\)/);
assert.match(app, /horizon \+ height \* 0\.04 - height \* elevation \* 0\.64/);
assert.match(app, /state\.minutes - sunrise/);
assert.match(app, /sameStateApartFromError\(state, next\)/);
assert.match(app, /scheduleTransientMessage/);
assert.match(app, /neověřeno pamětí ani lexikonem/);
assert.match(style, /\.toast \{ pointer-events: none; \}/);
assert.match(style, /\.ingredient\.unverified-tip/);
assert.match(style, /\.ending-identification\.unverified-tip/);
assert.match(html, /style\.css\?rev=2-45-1/);
assert.match(html, /app\.js\?rev=2-45-1/);

console.log("v2-45 sun arc, transient messages, identification provenance and mobile checks passed");
