(function () {
  'use strict';
  const E = window.Padla, $ = id => document.getElementById(id);
  const KEY = 'noema-vega-padla-v2';
  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const duration = min => min % 60 ? `${Math.floor(min / 60)} h 30` : `${min / 60} h`;
  const clock = tick => `${String(8 + Math.floor(tick / 2)).padStart(2, '0')}:${tick % 2 ? '30' : '00'}`;
  let state = E.fresh(), selected = 0, saved = false, storageOK = true, sound = false, audio;
  let modal = '', returnFocus = null, toastTimer, saveWarning = false;
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem('noema-vega-padla-v2-nahled11');
    if (raw) { const parsed = JSON.parse(raw); if (E.valid(parsed)) { state = parsed; saved = true; } }
  } catch (_) { storageOK = false; }

  function beep(type = 'work') {
    if (!sound) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      if (!audio) audio = new Context();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const tones = type === 'win' ? [440, 554, 659, 880] : type === 'undo' ? [440, 330] : type === 'jam' ? [185, 147] : [330, 440];
      tones.forEach((frequency, i) => {
        const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + i * .09;
        osc.type = 'sine'; osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.045, t + .015); gain.gain.exponentialRampToValueAtTime(.001, t + .17);
        osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + .2);
      });
    } catch (_) { /* Audio is optional; gameplay never depends on it. */ }
  }
  function toast(text) {
    $('toast').textContent = text; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); saved = true; storageOK = true; }
    catch (_) { storageOK = false; if (!saveWarning) { toast('Prohlížeč nepovolil ukládání. Hrát můžeš dál; nezavírej tuto kartu.'); saveWarning = true; } }
  }
  function box(x, y, w, h, d, front, top, side) {
    return `<path d="M${x} ${y}h${w}v${h}h-${w}Z" fill="${front}"/><path d="M${x} ${y}l${d} -${d}h${w}l-${d} ${d}Z" fill="${top}"/><path d="M${x+w} ${y}l${d} -${d}v${h}l-${d} ${d}Z" fill="${side}"/>`;
  }
  function duck(x, y, scale = 1, color = '#edc77e') {
    return `<g transform="translate(${x} ${y}) scale(${scale})" class="bird"><ellipse cy="12" rx="25" ry="7" fill="#233c3244"/><path d="M-20 1Q-4 9 13-1L17 4Q12 19-9 13Q-22 9-20 1" fill="${color}"/><circle cx="12" cy="-3" r="10" fill="${color}"/><path d="M19-5l12 5-12 3Z" fill="#d87d45"/><circle cx="15" cy="-6" r="1.7" fill="#27362c"/><path d="M-12 6q9 7 17-1" stroke="#b78e51" stroke-width="2" fill="none"/></g>`;
  }
  function tree(x, y, size = 1) {
    return `<g transform="translate(${x} ${y}) scale(${size})"><ellipse cy="12" rx="34" ry="12" fill="#1c2e2440"/><path d="M0 10V-49M0-22l-15-13M0-29l18-12" stroke="#998a61" stroke-width="6"/><path d="M-28-35Q-49-64-18-77Q-5-106 18-82Q48-84 43-55Q59-22 28-18Q4-10-14-24Q-32-16-28-35" fill="#667e50"/><path d="M-20-52q19-20 37-5M-11-74q21-12 34 5" fill="none" stroke="#899565" stroke-width="3" opacity=".6"/></g>`;
  }
  function pondRobot(i, x, y) {
    const u = state.units[i], color = E.STATIONS[i].color;
    // Their workshop colours and aerials stay; only the tools change.
    const props = [
      '<g transform="translate(-40 18) rotate(-16)"><path d="M-7 0h16v6H-7z" fill="#e9b379"/><path d="M0 0v-9" stroke="#724f39" stroke-width="5"/><circle cy="-10" r="5" fill="#ad6946"/></g><path d="m13 4 12-8-6-9" fill="none" stroke="#364a40" stroke-width="5"/><g transform="translate(13 -13) rotate(-18)"><path d="M-9-4h17v7H-9Z" fill="#75694b"/><path d="M-8-6h11l4 6h-15Zm0 7h12l4 7H-8Z" fill="#344a45"/><path d="m4-5 2 5m0 2 2 5" stroke="#a5d1c4" stroke-width="3"/></g>',
      '<path d="m12 5 14-5 5-10" fill="none" stroke="#354a40" stroke-width="5"/><g transform="translate(32 -10) rotate(32)"><path d="M-5-14h10l3 5-2 15H-6l-2-15Z" fill="#c6d9c6"/><path d="M-4-18h8v4h-8Z" fill="#617776"/></g><g transform="translate(-31 18)"><path d="m-8-12 3 15h10l3-15Z" fill="#edb8a1"/><circle cy="-13" r="8" fill="#f6dbac"/><circle cx="-2" cy="-19" r="3" fill="#ae574b"/><path d="m3-10 4-17 6-2" fill="none" stroke="#e3e8c8" stroke-width="2"/></g>',
      '<path d="M-16 3l-11 6-10-4m52-1 12-7 6 7" fill="none" stroke="#354a40" stroke-width="5"/><g transform="translate(29 21)"><path d="M-16-8 0-15 18-10 2-2Z" fill="#674e39"/><path d="m-16-8 18 6v13l-18-6Zm18 6 16-8V3L2 11Z" fill="#c69560"/><path d="m-16-8-7-7 17 5 8 8Zm18 6 16-8 7-1-14 11Z" fill="#eac18a"/><path d="m-5-10 9-9" stroke="#edd3a1" stroke-width="7" stroke-linecap="round"/></g>'
    ];
    const broken = u.jammed;
    const workingProps = [
      '<path d="m-17 11-13 6 14 11 23-7Z" fill="#f0e2ba"/><path d="m-16 20 3-5 5 3-3 4Z" fill="#ce704d"/><path d="m14 5 11 1-5-12" fill="none" stroke="#364a40" stroke-width="5"/><g transform="translate(19 -8) rotate(14)"><path d="M-9 0H8v5H-9Z" fill="#995f43"/><path d="M0 0v-8" stroke="#845d46" stroke-width="5"/><circle cy="-10" r="5" fill="#d79760"/></g>',
      '<path d="m12 5 11 1 5-5" fill="none" stroke="#354a40" stroke-width="5"/><g transform="translate(30 5) rotate(16)"><path d="M-6-10h14l4 18H-9Z" fill="#ced6bf"/><path d="m-7-3-8-4 8 12m16-13q12-1 8 8l-5 2" fill="none" stroke="#afbaaa" stroke-width="3"/><path d="M-7-10h16" stroke="#465547" stroke-width="3"/></g><path d="M4 14h11v8q-6 6-11 0zm11 1q9-2 3 6h-3" fill="#f3ce99"/><path d="M6 11q-4-5 0-9" stroke="#eee2c5" fill="none" stroke-width="2"/>',
      '<path d="m14 5 13-5 3-7" fill="none" stroke="#354a40" stroke-width="5"/><path d="M30-6q0-20 14-38" stroke="#e6dbbb" fill="none" stroke-width="1.5"/><path d="m45-66 13 13-15 13-10-18Z" fill="#edbc77"/><path d="m45-66-2 26 15-13Z" fill="#c87761"/><path d="m43-40 3 5-5 4 5 5" stroke="#d0bc94" fill="none" stroke-width="2"/><path d="m-24 16-15 3 15 7 13-4Z" fill="#e5cb98"/>'
    ];
    const rug = i === 2 && broken ? '<path d="m-52 22 79-8 27 19-79 11Z" fill="#cb886e"/><path d="m-33 20 28 21m-7-24 28 21m-5-23 28 20m-80-5 78-9m-64 17 77-9" fill="none" stroke="#e7b99a" stroke-width="2"/>' : '';
    // Silhouettes differ as well as colours: a crooked stamp arm, an open boiler, uneven pincers.
    const damage = [
      '<g transform="translate(-19 3) rotate(26)"><path d="M-3-7h7V8h-7Z" fill="#58645b"/><path d="m-4-3 10 3-9 3 9 3" fill="none" stroke="#ecd395" stroke-width="2"/><rect x="-11" y="8" width="22" height="5" rx="1" fill="#a2674e"/></g>',
      '<g transform="translate(-12 2)"><path d="m1-3 16 2-2 14-16-3Z" fill="#374941"/><path d="m2 0 8 2-7 3 7 2-8 2" stroke="#db8c5b" stroke-width="2" fill="none"/><path d="m1-3-8-7-5 10 10 7Z" fill="#b4c6a7" stroke="#52675a" stroke-width="2"/></g>',
      '<g transform="translate(-18 5)"><path d="M1-4-9 1-17-5m8 6-5 10-7 1" fill="none" stroke="#394d53" stroke-width="5"/><path d="m-17-6-4-3m0 21-4 1" stroke="#d8b57d" stroke-width="3"/></g>'
    ];
    const head = broken
      ? '<path d="m-3-22-4-6-10 2-3-4" stroke="#c8ad80" stroke-width="3" fill="none"/><circle cx="-20" cy="-31" r="4" fill="#ed9778"/><rect x="-14" y="-24" width="28" height="24" rx="8" fill="#e7dfba"/><path d="m-10-15 6 5m-1-6-5 6m12-3q3-4 6 0m-12 7q4 3 8-1" fill="none" stroke="#435342" stroke-width="2"/>'
      : '<path d="m-4-22-2-9" stroke="#e1dbaf" stroke-width="2"/><circle cx="-7" cy="-32" r="3" fill="#e2e394"/><rect x="-14" y="-24" width="28" height="24" rx="8" fill="#e7dfba"/><path d="M-8-13q3-4 6 0m4 0q3-4 6 0m-12 7q4 3 8-1" fill="none" stroke="#435342" stroke-width="2"/>';
    const plate = !broken && E.fridayFault(state,i) ? '<rect x="-8" y="3" width="16" height="8" rx="2" fill="#cbd6c0"/><path d="m-6 5 2 2m6 0 2 2" stroke="#536455" stroke-width="2"/>' : '';
    return `<g transform="translate(${x} ${y}) scale(1.16)" data-pond-robot="${i}">${rug}<ellipse cy="24" rx="25" ry="5" fill="#314637" opacity=".5"/><g stroke="#354a40" stroke-width="5" stroke-linecap="round"><path d="m-9 12-3 9h-9m28-9 5 9h8"/></g><rect x="-16" y="-4" width="32" height="21" rx="6" fill="${color}"/>${head}${broken ? props[i] + damage[i] : plate + workingProps[i]}</g>`;
  }
  function fridayCrew() {
    const good = [
      'Štemplík natiskl na pohlednici dvě kachní stopy. Podal ti ji dřív, než razítko stačilo zaschnout.',
      'Kofeínek nalil kávu do dvou plecháčků. Ten s ouškem otočeným k lavičce je tvůj.',
      'Krabík vytáhl z krabice papírového draka. Stačil jeden závan od vody a už jen povoluje provázek.'
    ];
    const bad = [
      'V pátek v dílně Štemplíkovi nefungovalo razítko. K rybníku si místo něj vzal dalekohled. „Porucha razítkování. Kachnování funguje.“',
      'V pátek v dílně Kofeínkovi stávkoval ohřev. Na piknik tedy vzal šejkr, jahody a kopeček zmrzliny. Podává ti koktejl: „Brčko chceš?“',
      'V pátek v dílně měl Krabík poruchu balení. K rybníku ale došel i s ní. Popadl deku za roh, škubl a rozvinul ji až k lavičce. „Rozbalit ještě umím.“'
    ];
    const fixed = [
      'V pátek se Štemplíkovi v dílně zaseklo razítko. Po servisu zase tiskne. Podává ti pohlednici: jedna kachní stopa, druhá a mezi nimi jeho mastný otisk palce.',
      'Kofeínkovi v pátek zlobil ohřev. Teď u vody nalévá kávu. Nad plecháčkem se zvedá pára. „Vidíš? Už zase hřeju.“',
      'Krabíkovi v pátek v dílně vypovědělo balení. Po opravě složil z balicího papíru draka. Jednou kleští drží provázek a druhou ti ukazuje, jak vysoko už vyletěl.'
    ];
    return state.units.map((u,i) => u ? `<p>${(u.jammed ? bad : E.fridayFault(state,i) ? fixed : good)[i]}</p>` : '').join('');
  }
  function sleepingDuck(x,y,k) {
    return `<g transform="translate(${x} ${y}) scale(${k})"><ellipse cy="8" rx="22" ry="3" fill="#495b74"/><path d="M-19-4q9 7 18-1 12-7 18 2-4 13-22 11-12-1-14-12" fill="#c5b999"/><circle cx="6" cy="-5" r="7" fill="#d8c9aa"/><path d="m1-4-5 2 5 1" fill="#a97a54"/><path d="M3-6q2 2 4 0m-19 6q7 5 14 2" fill="none" stroke="#726b70" stroke-width="1.5"/></g>`;
  }
  function pondArt(rest = false, friday = false, light = 'day') {
    const crew = friday ? [0, 1, 2].filter(i => state.units[i]) : [];
    const bank = crew.length ? `<path d="M0 215Q141 192 228 212T455 208Q552 183 650 197V278H0Z" fill="#647953"/><path d="M0 264Q160 232 323 250T650 227V278H0Z" fill="#596e4d"/>${crew.map((i,n) => pondRobot(i, 325 + (n - (crew.length - 1) / 2) * 145, n % 2 ? 229 : 224)).join('')}` : '';
    const label = crew.length ? 'Páteční piknik u rybníka. ' + crew.map(i => (state.units[i].jammed ? ['Štemplík s nakřivo visícím razítkem pozoruje kachny','Kofeínek s otevřeným krytem ohřevu míchá koktejl','Krabík s ohnutou kleští rozbaluje deku'] : ['Štemplík razítkuje pohlednici','Kofeínek nalévá kávu','Krabík pouští draka'])[i]).join(', ') + '.' : 'Klidný rybník, lavička a kachna. Tady už se nepracuje.';
    return `<svg viewBox="0 0 650 ${crew.length ? 278 : 220}" role="img" aria-label="${light === 'night' ? 'Noční rybník. U rákosí spí dvě kachny; lavička je prázdná.' : light === 'empty' ? 'Prázdná lavička u tichého rybníka.' : rest && !friday ? 'Sedíš sám na lavičce u rybníka.' : label}"  xmlns="http://www.w3.org/2000/svg"><rect width="650" height="220" fill="#3a4d3d"/><path d="M0 140Q180 40 357 115T650 113V220H0Z" fill="#435a42"/><path d="M0 189Q200 82 410 169T650 148V220H0Z" fill="#516947"/><ellipse cx="374" cy="157" rx="157" ry="58" fill="#789584"/><ellipse cx="374" cy="150" rx="150" ry="51" fill="#8da99a"/><g stroke="#c3d5b5" fill="none" opacity=".65" class="pond-line"><path d="M263 148q31-8 56 0m100 18q35-8 62 0M328 121q34-6 65 0M324 185q29 4 49-1"/></g><path d="M0 216Q160 167 213 206" fill="none" stroke="#9e9e73" stroke-width="23"/>${tree(124, 131, 1.5)}${tree(559, 112, 1.2)}${tree(593, 161, .65)}<g transform="translate(160 159) rotate(-12)"><path d="M0 8h62v8H0Zm0-12h62v8H0Z" fill="#cca579"/><path d="M7 16v17m49-17v17M6-4v-10m50 10v-10" stroke="#293e31" stroke-width="5"/></g>${rest ? '<g transform="translate(182 161)"><path d="M0 0v20m0-10l13 4m-12-4l-9 8" stroke="#efaf6d" stroke-width="8" stroke-linecap="round"/><circle cy="-10" r="9" fill="#e2d3ad"/><path d="M-11-13q10-18 22 0" fill="#d18254"/></g>' : ''}${light === 'day' ? duck(375,151,1.05) + duck(435,126,.5,'#dfdfb6') : ''}<g stroke="#a1ae7b" stroke-width="3"><path d="M244 197v-20m0 14l-8-7m8 4 6-11M492 189v-22m0 14 8-6m-8 9-6-6M287 103v-14m0 6 6-3"/></g>${light === 'day' ? '<path d="M270 49q6-7 12 0q6-7 12 0m133 21q5-5 10 0q5-5 10 0" stroke="#c1c8a0" stroke-width="2" fill="none"/><circle cx="404" cy="49" r="17" fill="#e9b87a" opacity=".85"/>' : ''}${light === 'night' ? `<rect width="650" height="220" fill="#121937" opacity=".73"/><path d="M403 28a17 17 0 1 0 18 20 17 17 0 0 1-18-20" fill="#f1dfac"/><g fill="#e9d9b9"><circle cx="213" cy="24" r="1.4"/><circle cx="255" cy="52" r="1"/><circle cx="316" cy="20" r="1.8"/><circle cx="472" cy="33" r="1.2"/><circle cx="510" cy="17" r="1"/></g><path d="M399 134h19m-26 5h24m-16 6h8" stroke="#a5aab2" fill="none" opacity=".65"/>${sleepingDuck(454,171,.84)}${sleepingDuck(482,167,.61)}` : ''}${bank}</svg>`;
  }
  function machine(i) {
    const u = state.units[i], color = E.STATIONS[i].color;
    const places = [[171, 167], [365, 127], [548, 222]];
    const [x, y] = places[i];
    let art;
    if (i === 0) art = `${box(-38, 0, 75, 49, 16, '#b8885c', '#e6bd82', '#896b4e')}<path d="M-19 4v-44h42V4" stroke="#455249" stroke-width="9" fill="none"/><path d="M2-42v30" stroke="#a6b29b" stroke-width="7"/><rect x="-14" y="-13" width="34" height="10" rx="2" fill="#e6a362"/><path d="M-22 11h40l10 17h-41Z" fill="#eee8c7"/><path d="M-12 19h19m-15 4h19" stroke="#8e9a7c" stroke-width="2"/><circle cx="43" cy="25" r="8" fill="#303f34"/><circle cx="43" cy="25" r="3" fill="#e4b27b"/>`;
    else if (i === 1) art = `${box(-39, 0, 78, 55, 18, '#7e987e', '#b9c7a1', '#5b7765')}<path d="M-17-3v-38q19-13 39 0v38Z" fill="#cf9d6d"/><ellipse cx="2" cy="-38" rx="20" ry="8" fill="#e7c391"/><path d="M22-29h15v17H22" stroke="#a87c56" stroke-width="6" fill="none"/><path d="M-21 16h19v14q-9 10-19 0Z" fill="#eee6c9"/><path d="M-2 18q13 0 5 9h-5" fill="none" stroke="#eee6c9" stroke-width="3"/><path d="M-21-28h-9v17" stroke="#cf9d6d" stroke-width="6" fill="none"/><circle cx="19" cy="23" r="7" fill="#344c3b"/><circle cx="19" cy="23" r="3" fill="#b4d28d"/><g class="steam" fill="none" stroke="#e0e1bd" stroke-width="2"><path d="M-10-52q-6-9 0-17m14 19q6-12 0-21"/></g>`;
    else art = `${box(-48, 6, 97, 34, 20, '#748b9a', '#c0cbbd', '#526c7a')}<path d="M-38 15H40m-78 10H40" stroke="#354b50" stroke-width="4"/><path d="M-29 11v20m17-20v20m17-20v20m17-20v20m17-20v20" stroke="#b8c1ac" stroke-width="3"/>${box(-23, -21, 40, 29, 13, '#c99a68', '#e5bc87', '#a47a53')}<path d="M-3-21v29m0-29 13-13" stroke="#efddad" stroke-width="7"/><path d="M-39 41v10m79-10v10" stroke="#32484b" stroke-width="6"/>`;
    const helper = u ? `<g transform="translate(72 22)" class="bot ${u.jammed ? 'jammed' : ''}"><ellipse cy="34" rx="20" ry="8" fill="#28392c55"/><path d="M-9 23v10m18-10v10" stroke="#354438" stroke-width="6"/><rect x="-15" y="0" width="30" height="25" rx="7" fill="${u.jammed ? '#c18173' : color}"/><path d="M-15 9h-8v9m38-9h7v9" fill="none" stroke="#354438" stroke-width="5"/><rect x="-12" y="-16" width="24" height="23" rx="8" fill="#e2dfba"/><path d="M-4-16v-7" stroke="#d7d5ab" stroke-width="2"/><circle cx="-4" cy="-25" r="4" fill="${u.jammed ? '#f0a391' : '#d9df8b'}"/>${u.jammed ? '<path d="m-7-8 4 4m0-4-4 4m12-4 4 4m0-4-4 4" stroke="#48533e" stroke-width="2"/>' : '<circle cx="-5" cy="-6" r="2" fill="#3a4736"/><circle cx="5" cy="-6" r="2" fill="#3a4736"/>'}<path d="M-5 2h10" stroke="#b78d52" stroke-width="3"/>${u.level ? '<path d="M6 12h6v6l-3 3-3-3Z" fill="#eae5b7"/>' : ''}</g>` : `<g transform="translate(77 42)" opacity=".55"><path d="M-14-19h28V0h-28Z" fill="#a9aa7b"/><path d="M-14-19l7-6h28l-7 6Z" fill="#c1bd8b"/><path d="M14 0l7-6v-19l-7 6Z" fill="#7c885e"/><text x="0" y="-5" text-anchor="middle" font-size="14" fill="#43523b">?</text></g>`;
    return `<g transform="translate(${x} ${y})" class="svg-station" data-select="${i}" role="button" tabindex="0" aria-label="${E.STATIONS[i].name}, zbývá ${state.jobs[i]} zakázek" id="map-station-${i}"><ellipse class="station-halo" cx="10" cy="35" rx="92" ry="43" fill="${color}" opacity="${selected === i ? '.18' : '0'}"/><ellipse cx="10" cy="39" rx="65" ry="24" fill="#28362c33"/>${art}${helper}<g transform="translate(-48 -60)"><circle r="12" fill="${selected === i ? '#f4ae68' : '#364537'}" stroke="${selected === i ? '#f4ae68' : '#82916c'}"/><text text-anchor="middle" y="4" font-family="monospace" font-size="11" fill="${selected === i ? '#26372c' : '#e3e7cf'}">${i+1}</text></g>${state.produced[i] ? `<text class="pulse-ring" x="24" y="-45" fill="#fff0b4" font-family="monospace" font-size="20">−${state.produced[i]}</text>` : ''}</g>`;
  }
  function workshopArt() {
    return `<svg viewBox="0 0 840 420" xmlns="http://www.w3.org/2000/svg" aria-label="Dílna se třemi pracovišti. Vyber razítkárnu, kávovar nebo balírnu."><defs><pattern id="floor-lines" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(-16)"><path d="M0 34H34" stroke="#a2a580" stroke-width="1" opacity=".4"/></pattern></defs><rect width="840" height="420" fill="#37463b"/><path d="M0 325Q139 220 266 306T613 262T840 260V420H0Z" fill="#42533f"/><path d="M840 390Q662 261 534 359T210 420" stroke="#7e8960" stroke-width="33" fill="none"/><ellipse cx="693" cy="346" rx="111" ry="40" fill="#7c9e8b"/><ellipse cx="693" cy="341" rx="105" ry="35" fill="#8aa994"/><g class="pond-line" fill="none" stroke="#bfceb2" stroke-width="2"><path d="M628 339h29m40 21h31m-7-31h39"/></g>${duck(693, 339, .58)}${tree(757, 186, .95)}${tree(797, 228, .63)}${tree(78, 324, .62)}<path d="M65 213 424 91 697 247 337 382Z" fill="#26382b" opacity=".55"/><path d="M65 199 424 77 697 233V247L337 374 65 213Z" fill="#7d8165"/><path d="M65 199 424 77 697 233 337 360Z" fill="#b4b491"/><path d="M65 199 424 77 697 233 337 360Z" fill="url(#floor-lines)"/><path d="M65 199V117L424 0V77Z" fill="#657b61"/><path d="M424 0 697 153V233L424 77Z" fill="#4f6754"/><path d="M65 117 424 0 697 153" fill="none" stroke="#899375" stroke-width="7"/><path d="M80 193 423 89 681 232" fill="none" stroke="#e0d7a4" stroke-width="3"/><path d="M126 240 340 319 590 236" fill="none" stroke="#d3c79a" stroke-width="4" stroke-dasharray="10 7"/><path d="M84 193 84 132 375 40" fill="none" stroke="#a0a789" stroke-width="5"/><path d="M253 75v49" stroke="#a0a789" stroke-width="5"/><path d="m111 131 79-26v-48l-79 26Z" fill="#a3b59a"/><path d="m118 123 65-22v-33l-65 21Z" fill="#354e43"/><path d="M150 80v33m-32-9 65-21" stroke="#a3b59a" stroke-width="4"/><path d="m293 70 63-20v35l-63 21Z" fill="#4d6251"/><path d="M304 78l42-13m-42 23 42-13" stroke="#a6ae86" stroke-width="2"/><path d="M314 73v11m18-16v12" stroke="#dbb881" stroke-width="4"/><g transform="translate(494 76) rotate(29)"><rect width="78" height="27" rx="3" fill="#cad0a8"/><text x="39" y="12" text-anchor="middle" font-family="monospace" font-size="7" fill="#3d543e">NOEMA INDUSTRIES</text><text x="39" y="22" text-anchor="middle" font-family="monospace" font-size="6" fill="#3d543e">VOLNO VE VÝROBĚ</text></g><path d="M593 119v28" stroke="#b7b390" stroke-width="2"/><path d="M584 152q0-15 9-15t9 15Z" fill="#e7ba70"/><circle cx="593" cy="155" r="3" fill="#e7ba70"/>${machine(1)}${machine(0)}${machine(2)}<g transform="translate(348 273)"><ellipse cy="20" rx="16" ry="7" fill="#56614755"/><path d="M-9 0v20m18-20v20" stroke="#304a42" stroke-width="6"/><path d="M-14-18h28v25h-28Z" fill="#e6a063"/><path d="M-16-13l-7 13m39-13 7 13" stroke="#e6a063" stroke-width="6"/><circle cy="-29" r="13" fill="#dccca6"/><path d="M-14-30q-2-22 18-19l8 13Z" fill="#805941"/><circle cx="5" cy="-29" r="2" fill="#344739"/></g><g transform="translate(269 299)" class="bot"><ellipse cy="18" rx="19" ry="6" fill="#50614844"/><path d="M-14 9v-17q14-20 28 0v23l-7-6-7 6-7-6-7 6Z" fill="#d2d1c8"/><path d="M-18-10l16-28 17 30Z" fill="#676882"/><path d="m-4-24 4 3-3 3-3-3Z" fill="#e4c57f"/><circle cx="-5" cy="-3" r="2" fill="#4c4e60"/><circle cx="5" cy="-3" r="2" fill="#4c4e60"/></g><g stroke="#a8b383" stroke-width="2"><path d="M526 373v-17m0 9 5-5m-5 2-5-4M54 266v-14m0 7 6-5M785 295v-18m0 10 6-7"/></g></svg>`;
  }
  function actionButton(action, title, cost, special = '') {
    const why = E.reason(state, action, selected);
    return `<button id="action-${action}" class="action-btn ${special}" data-action="${action}" ${why ? 'disabled' : ''} title="${esc(why || title)}"><span>${title}<small>${cost}</small></span><span aria-hidden="true">${action === 'manual' ? '↗' : '+'}</span></button>`;
  }
  function render() {
    const focus = document.activeElement && document.activeElement.id;
    const working = state.status === 'playing', total = E.left(state);
    $('days').innerHTML = E.DAYS.map((d, i) => `<div class="day ${i === state.day ? 'active' : ''} ${i < state.records.length ? 'done' : ''}" ${i === state.day ? 'aria-current="step"' : ''}><span class="dot">${i < state.records.length ? '✓' : i+1}</span>${d.slice(0,2).toUpperCase()}</div>`).join('');
    $('bolts').textContent = state.bolts;
    $('day-label').textContent = `${E.DAYS[state.day].toUpperCase()} · SMĚNA 0${state.day+1}`;
    $('clock').textContent = clock(state.tick);
    $('track').innerHTML = Array.from({ length: 16 }, (_, i) => `<span class="tick ${i < state.tick ? 'used' : ''} ${i === 9 && state.day === 4 ? 'deadline' : ''}"></span>`).join('');
    $('track').setAttribute('aria-label', `Pracovní doba od 08:00 do 16:00. Aktuální čas: ${clock(state.tick)}.`);
    $('end-clock').textContent = '16:00';
    const tidy = E.isTidy(state), messy = state.cleanPieces === 2;
    const late = working && state.tick >= 15, stopped = state.tick >= E.productionEnd(state.day);
    $('remaining-time').textContent = state.day === 4 ? (tidy ? 'Uklizeno · cíl 13:00' : (state.tick <= 9 ? 'Pro odchod ve 13:00 začni uklízet do 12:30' : 'Páteční výroba končí v 16:00')) : `Do úklidu ${duration(Math.max(0,15-state.tick)*30)}`;
    $('scene').innerHTML = workshopArt();
    const bots = state.units.filter(Boolean).length, broken = state.units.filter(u => u && u.jammed).length;
    $('scene-message').textContent = !working ? 'Zamčeno. Volno se nedá odpracovat.' : broken ? `${broken}× zaseknuto. Ruční práce pořád funguje.` : bots ? 'Pomocníci pracují i během tvých ostatních akcí.' : 'Pomocníci ještě spí v krabicích.';
    $('stations').innerHTML = E.STATIONS.map((m, i) => {
      const u = state.units[i], finished = !state.jobs[i];
      const status = finished ? 'Zakázky hotové' : !u ? 'Ruční provoz' : u.jammed ? 'Zaseknuto · servis!' : `${['Další razítko','Další káva','Další balíček'][i]} za ${u.phase ? '30' : '60'} min`;
      return `<button id="station-${i}" class="station-tab ${selected === i ? 'selected' : ''}" style="--station-color:${m.color}" data-select="${i}" aria-pressed="${selected === i}" aria-label="${m.name}, zbývá ${state.jobs[i]} z ${state.total[i]}"><div class="station-top"><strong>${m.short}</strong><span class="station-number">0${i+1}</span></div><div class="station-count">${state.jobs[i]} <small>/ ${state.total[i]} zbývá</small></div><div class="job-dots" aria-hidden="true">${Array.from({ length: Math.min(state.total[i], 20) }, (_, j) => `<span class="job-dot ${j >= state.jobs[i] ? 'done' : ''}"></span>`).join('')}</div><span class="station-status ${finished ? 'good' : u && u.jammed ? 'bad' : ''}">${status}</span></button>`;
    }).join('');
    let notice;
    if (!working) notice = 'Dnešní směna skončila. Všichni pomocníci jsou vypnutí.';
    else if (late) notice = (stopped ? 'Výroba skončila. Až budeš chtít zavřít, stiskni Padla.' : 'Je 15:30. Můžeš dát Padla, nebo využít poslední půlhodinu výroby.') + (total ? (state.day === 4 ? ' Pokud teď zavřeš, zbývající zakázky zůstanou nedokončené.' : ' Zbývající zakázky přejdou na zítřek.') : ' Všechny zakázky jsou hotové.');
    else if (messy) notice = 'Koště předběhlo výrobu. Po začátku úklidu přibyl druhý kus a na stole je zase nepořádek. ' + (total ? 'Před odchodem bude potřeba dalších 30 minut úklidu.' : 'Zakázky jsou hotové. Ještě půl hodiny úklidu a v ' + clock(state.tick+1) + ' můžeš zamknout.');
    else if (!total) notice = `Dnes máš hotovo. ${tidy ? 'Je uklizeno, můžeš hned zamknout.' : 'Po půlhodině úklidu zamkneš v '+clock(state.tick+1)+'.'}${state.parcelReady ? ' Balíček na ráno už čeká u dveří.' : ''}`;
    else if (state.day === 0 && state.tick === 0) notice = 'Vyber si pracoviště. Ručně zvládneš jednu zakázku za půl hodiny. Montáž zabere hodinu; první kus pomocník udělá až při další práci.';
    else if (state.units.some((u, i) => u && u.jammed && state.jobs[i])) {
      const i = state.units.findIndex((u, i) => u && u.jammed && state.jobs[i]);
      notice = E.STATIONS[i].helper + ' stojí. Na tomto pracovišti ještě zbývá práce. Můžeš ji dodělat ručně, nebo dát pomocníka do servisu.';
    } else if (state.day === 0 && state.last === 'build' && bots === 1 && state.jobs[state.units.findIndex(Boolean)]) {
      const helper = E.STATIONS[state.units.findIndex(Boolean)].helper;
      notice = helper + ' je na místě. Montáž je hotová, zakázky ještě ne. Pusť se do jiné práce: za hodinu bude mít první kus.';
    } else if (state.day === 0 && state.last === 'manual' && !bots && state.tick === 1) {
      notice = 'První zakázka je ze stolu. Takhle můžeš pokračovat ručně. Pokud postavíš pomocníka, bude na svém pracovišti dělat i během tvé práce jinde.';
    } else if (state.day === 4 && state.tick === 0) {
      notice = 'Dnes je ten pátek. Výroba může běžet až do čtyř, s úklidem do půl páté. Až budou všechny tři hromádky prázdné, zamkni. V půl jedné už začni uklízet, ať v jednu zamkneš.';
    }
    else notice = bots ? 'Při ruční práci běží i pomocníci. Na kartě pracoviště vidíš, kdy bude další kus hotový.' : 'Pracoviště můžeš střídat. Čas uběhne až ve chvíli, kdy něco uděláš.';
    $('notice').textContent = notice; $('notice').classList.toggle('ready', !total && working && !messy);
    $('wait').disabled = !!E.reason(state,'wait'); $('close').disabled = !!E.reason(state, 'close');
    $('close-label').textContent = late ? 'Padla · zamknout dílnu' : messy ? 'Znovu uklidit a zamknout' : tidy ? 'Zamknout a jít k rybníku ↗' : total ? 'Padla. Jdu k rybníku ↗' : 'Uklidit a zamknout';
    $('close-detail').textContent = late ? ((tidy && !total) ? `Uklizeno · odchod hned v ${clock(state.tick)}` : `30 min na zavření · odchod v ${clock(state.tick+1)}`) : total ? `Zbývá ${total} zakázek` : !working ? 'Zamčeno' : tidy ? `Uklizeno · odchod hned v ${clock(state.tick)}` : `30 min úklidu · odchod ${clock(state.tick+1)}`;
    const m = E.STATIONS[selected], u = state.units[selected];
    $('inspector').innerHTML = `<p class="eyebrow">PRACOVIŠTĚ 0${selected+1}</p><div class="inspector-heading"><h2>${m.name}</h2><span class="station-symbol" aria-hidden="true">${['▤','♨','▱'][selected]}</span></div><p class="inspector-desc">${['Razítka na věci, které se bez razítka bojí být hotové.','Nejdřív káva pro ostatní. Pak možná i pro tebe.','Krabice do krabic. Vrchol civilizace.'][selected]}</p><div class="task-summary"><span>DNEŠNÍ ZAKÁZKY</span><strong>${state.total[selected]-state.jobs[selected]} / ${state.total[selected]} hotovo</strong></div>${actionButton('manual',['Orazítkovat jeden papír','Uvařit kávu','Zabalit balíček'][selected],'30 min · bez součástek')}${selected === 2 && !E.reason(state,'prep') ? '<button class="action-btn" data-action="prep" id="action-prep"><span>Zabalit balíček na zítra, 30 min</span><span aria-hidden="true">↗</span></button>' : ''}${!u ? actionButton('build',`Postavit: ${m.helper}`,'60 min · 3 součástky','build')+ '<p class="helper-info">Pomocník udělá <strong>1 zakázku za 60 min</strong> i během jiné práce. Po 4 kusech se zasekne.</p>' : `<div class="helper-info ${u.jammed ? 'jammed' : ''}"><strong>${m.helper}${u.level ? ' + pojistka' : ''}</strong> · ${u.jammed ? 'zaseknuto' : !state.jobs[selected] ? 'hotovo, odpočívá' : 'v provozu'}<div class="wear-track" aria-label="Opotřebení ${u.wear} z ${E.limit(u)}">${Array.from({length:E.limit(u)},(_,j)=>`<span class="${j<u.wear?'worn':''}"></span>`).join('')}</div><div class="helper-foot"><span>${u.wear} / ${E.limit(u)} opotřebení</span><span>${u.jammed ? 'potřebuje servis' : `${E.limit(u)-u.wear} ks do poruchy`}</span></div></div>${actionButton('repair','Servis pomocníka','30 min · 1 součástka')}${!u.level ? actionButton('upgrade','Namontovat pojistku','60 min · 4 součástky · výdrž 8 ks') : '<p class="helper-info">Pojistka prodlužuje výdrž na 8 kusů. Servis vrací opotřebení na nulu.</p>'}`}`;
    $('offer').innerHTML = `<h3>NOEMA MÁ JEŠTĚ DROBNOST…</h3><p>„${E.OFFERS[state.day]}“</p><div class="offer-meta">+3 SOUČÁSTKY · +2 ZAKÁZKY</div><button id="contract" data-action="contract" ${E.reason(state,'contract') ? 'disabled' : ''}>${state.offered ? 'Přijato. Teď to ještě udělat.' : 'Tak dobře, beru to ↗'}</button>`;
    $('tidy-row').hidden = !working || !total || stopped;
    $('tidy').disabled = !!E.reason(state,'tidy');
    $('tidy').textContent = tidy ? 'Uklizeno ✓' : messy ? 'Uklidit znovu · 30 min' : 'Začít uklízet · 30 min';
    $('tidy-note').textContent = state.cleanPieces === 0 ? 'Ještě jeden kus můžeš dokončit bez dalšího úklidu.' : state.cleanPieces === 1 ? 'Jeden kus je hotový. Po dalším bude potřeba znovu uklidit.' : 'Počítá se ruční práce i stroje, už během úklidu. Jeden kus nevadí, druhý znamená nový úklid.';
    $('undo').disabled = !!E.reason(state,'undo');
    $('rollback-note').textContent = state.rewindUsed ? 'Dnešní návrat už padl. Další až zítra.' : 'Jednou za směnu vrátí poslední tah.';
    $('log').innerHTML = state.log.slice(0,3).map(l=>`<li class="${l.kind}"><time>${E.DAYS[l.day].slice(0,2).toUpperCase()} ${clock(l.tick)}</time>${esc(l.text)}</li>`).join('');
    if (focus && $(focus) && !$(focus).disabled) $(focus).focus({preventScroll:true});
  }
  function run(action) {
    const result = E.act(state, action, selected);
    if (result.error) { toast(result.error); return; }
    state = result.state; save(); render();
    beep(state.log[0].kind === 'jam' ? 'jam' : action);
    if (state.status === 'dayend') summary();
    else if (state.status === 'ended') ending();
  }
  function openModal(type, html) {
    if (!$('dialog').open) returnFocus = document.activeElement;
    modal = type; $('dialog-content').innerHTML = html;
    const heading = $('dialog-content').querySelector('h2');
    if (heading) heading.id = 'dialog-title';
    if (!$('dialog').open) $('dialog').showModal();
    $('dialog').scrollTop = 0;
    const focusTarget = $('dialog-content').querySelector('[autofocus], button');
    if (focusTarget) focusTarget.focus({preventScroll:true});
  }
  function closeModal() {
    modal = ''; $('dialog').close();
    if (returnFocus && returnFocus.isConnected) returnFocus.focus({preventScroll:true});
  }
  function intro() {
    openModal('intro', `<div class="dialog-art">${pondArt()}<span class="edition">VEGA · PADLA! v2</span></div><div class="dialog-body"><p class="eyebrow">${saved ? (state.status === 'ended' ? 'TVŮJ DOKONČENÝ TÝDEN' : 'TVŮJ ROZEHRANÝ TÝDEN') : 'PONDĚLÍ RÁNO · PLÁN NA PÁTEK'}</p><h2>V pátek <em>k rybníku.</em></h2><p>V pátek chceš strávit tři hodiny u rybníka. Jenže klíče od dílny máš ty a s poslední zakázkou tu obvykle býváš až do čtyř.</p><p>Na stole tě čekají papíry, káva a balíčky. Můžeš se do nich pustit ručně, nebo strávit hodinu montáží pomocníka. Ten se pak pustí do zakázek současně s tebou a zůstane i na další směny. V pátek chceš ve 13:00 zamknout. Než zamkneš, potřebuješ půl hodiny na úklid. Pomocníci při něm můžou ještě pracovat.</p><div class="dialog-actions"><button class="primary" data-dialog="start" autofocus>${saved ? (state.status === 'ended' ? 'Zpátky k pátku ↗' : 'Pokračovat v rozehraném týdnu ↗') : 'Odemknout dílnu ↗'}</button>${saved ? '<button class="secondary" data-dialog="new-confirm">Nový týden</button>' : ''}</div><div class="dialog-sub">5–10 MINUT · BEZ SPĚCHU · ${storageOK ? 'PRŮBĚŽNÉ UKLÁDÁNÍ' : 'UKLÁDÁNÍ NENÍ DOSTUPNÉ'}</div></div>`);
  }
  function help() {
    openModal('help', `<div class="dialog-body"><p class="eyebrow">PŘÍRUČKA K VOLNÉMU ČASU</p><h2>Jak mít <em>padla.</em></h2><ul class="help-list"><li>Začínáš v 08:00. Od pondělí do čtvrtka zamykáš nejpozději v 16:00, v pátek v 16:30. Čas běží pouze po akci. Kliknutím na pracoviště vybereš jeho ovládání.</li><li><strong>Ručně:</strong> 1 zakázka za 30 minut. <strong>Pomocník:</strong> montáž 60 minut a 3 součástky; potom 1 zakázka za 60 minut během jakékoli tvé práce či dohledu. Pracuje i vedle tebe na stejném pracovišti.</li><li>Po <strong>4 výstupech</strong> se pomocník zasekne. Servis (30 minut, 1 součástka) vynuluje opotřebení i rozpracovanou půlhodinu. Pojistka (60 minut, 4 součástky) navíc zvedne výdrž na 8 výstupů. Opravovaný pomocník během servisu stojí; ostatní běží.</li><li>Za dokončenou směnu dostaneš <strong>3 součástky</strong>. Noemina nepovinná drobnost přidá hned 3 součástky a 2 zakázky. Lze ji přijmout jednou denně.</li><li>Hotové zakázky? Stiskni <strong>„Padla. Jdu k rybníku“</strong>. Úklid trvá půl hodiny. Můžeš začít už během výroby. Od začátku úklidu smí vzniknout jedna dnešní zakázka (ručně nebo pomocníkem). Druhá zakázka znamená nový úklid. Máš-li hotovo a uklizeno, zamkneš ihned. Volno se počítá od zamčení do 16:00. Když začneš uklízet ve 12:30, zamkneš ve 13:00. Dohled nad stroji se jako volno nepočítá.</li><li>Jakmile jsou všechny dnešní balíčky hotové, najdeš v Balírně volbu „Zabalit balíček na zítra, 30 min“. Platí od pondělí do čtvrtka. Předáš ji ráno při otevření. Tahle příprava uklizenou dílnu znovu nezašpiní.</li><li>V 15:30 můžeš stisknout Padla i s nedodělky. Do čtvrtka se převedou na zítřek; v pátek zůstanou nesplněné. V pátek máš ještě na výběr poslední půlhodinu výroby do 16:00. Směnu vždy ukončíš ty. Máš-li hotovo a uklizeno, odcházíš hned; jinak zavírání zabere 30 minut. Přesčas se jako volno nepočítá. Stroje i opotřebení zůstávají. Ručně lze pracovat i se zaseknutým pomocníkem.</li><li><strong>Vyhraješ, když v pátek dokončíš úplně vše a odejdeš nejpozději ve 13:00.</strong> Dřívější volno je příjemný bonus, ale páteční plán nenahradí.</li><li><strong>Rollback</strong> vrátí jeden tah za směnu, včetně času a součástek. Uzavřenou směnu už nevrací.</li></ul><div class="help-keys">Klávesy: 1–3 pracoviště · M ručně · B stavět · S servis · U pojistka · W dohled · R návrat · E padla · H nápověda</div><button class="primary" data-dialog="resume" autofocus>Zpátky do dílny</button><p class="dialog-sub">Zvuk je volitelný. Ukládání je v tomto prohlížeči a této cestě k souboru.</p></div>`);
  }
  function cleanupReceipt() {
    return state.cleanPieces === 2 ? '<p>Koště předběhlo výrobu: po začátku úklidu přibyl druhý kus. Poslední půlhodina proto padla na nový úklid.</p>' : '';
  }
  function summary() {
    const r = state.records[state.day], next = E.JOBS[state.day+1];
    openModal('summary', `<div class="dialog-art">${pondArt(!r.remaining)}</div><div class="dialog-body"><p class="eyebrow">${E.DAYS[state.day].toUpperCase()} · ZAVŘENO</p><h2>${r.remaining ? 'Zvonek ano. <em>Hotovo ne.</em>' : r.free ? 'Tohle odpoledne <em>je tvoje.</em>' : 'Hotovo. <em>Právě včas.</em>'}</h2><p>${r.remaining ? `${r.remaining} zakázek zůstalo na stole. Zítra je najdeš přesně tam. Rollback navrhuje vrátit pojem „zítra“.` : r.free ? 'Za dveřmi už nic nepípá. Nepotřebuješ tohle volno investovat. Můžeš ho prostě mít.' : 'Dnešní zakázky jsou hotové. Příště si zkus nechat kus odpoledne pro sebe.'}</p>${cleanupReceipt()}<div class="result-stats"><div><strong>${duration(r.free)}</strong><span>dnešní volno</span></div><div><strong>${duration(state.free)}</strong><span>volno za týden</span></div><div><strong>+${r.bonus}</strong><span>součástky za směnu</span></div></div><p class="day-quote">Zítřejší objednávka: papíry (${next[0]}), káva (${next[1]}), balíčky (${next[2]})${r.remaining ? ` + ${r.remaining} nedodělků` : ''}.${state.parcelReady ? ' Jeden balíček už je zabalený.' : ''}<br>${state.units.some(Boolean) ? 'Ráno najdeš pomocníky tak, jak je dnes necháš, i s jejich opotřebením.' : 'Ráno bude dílna zase v ručním provozu.'}</p><button class="primary" data-dialog="next" autofocus>Další ráno: ${E.DAYS[state.day+1]} ↗</button></div>`);
  }
  function pondEnding() {
    const r = state.records[4];
    if (r.tick > 16) return {kind:'night', button:'Mezitím u rybníka ↗', title:'Kachny už <em>spí.</em>', text:'V dílně cvakl zámek. U vody se ani nepohnulo rákosí. Dvě kachny spí se zobákem pod křídlem a lavička zůstala prázdná.'};
    if (r.tick === 16) return {kind:'empty', button:'Pohled na prázdný rybník ↗', title:'Lavička zůstala <em>prázdná.</em>', text:'Zamkl jsi přesně ve čtyři. Na břehu nikdo nesedí. Dnes už na rybník nezbyla ani půlhodina.'};
    if (r.tick > 10 || r.remaining) return {kind:'solo', button:'Sednout si na chvíli k vodě ↗', title:'Ještě chvíli <em>u vody.</em>', text:'Na společný piknik už je pozdě. Klíče strčíš do kapsy a sedneš si sám na kraj lavičky. Chvíli sleduješ kruhy na vodě.'};
    return {kind:'picnic',button:'Jdu si to odpoledne užít ↗',title:'Tady už <em>nic nemusíš.</em>',text:''};
  }
  function fridayArt(kind) {
    return pondArt(kind === 'solo' || kind === 'picnic', kind === 'picnic', kind === 'night' || kind === 'empty' ? kind : 'day');
  }
  function ending() {
    const e = E.ending(state), friday = state.records[4], shore = pondEnding();
    openModal('ending', `<div class="dialog-art friday-pond">${fridayArt(shore.kind)}<span class="edition">${e.type === 'win' ? 'PÁTEČNÍ PLÁN SPLNĚN' : 'TÝDEN UZAVŘEN'}</span></div><div class="dialog-body"><p class="eyebrow">${e.subtitle.toUpperCase()}</p><h2 id="dialog-title">${e.title}</h2><p>${e.text}</p>${cleanupReceipt()}<div class="result-stats"><div><strong>${duration(friday.free)}</strong><span>páteční volno / cíl 3 h</span></div><div><strong>${duration(state.free)}</strong><span>opravdu volný čas</span></div><div><strong>${clock(friday.tick)}</strong><span>páteční odchod${friday.remaining ? ` · zbývá zakázek: ${friday.remaining}` : ''}</span></div></div><div class="week-results">${state.records.map(r=>`<div class="week-result">${E.DAYS[r.day].slice(0,2).toUpperCase()}<div class="bar"><span style="height:${Math.max(2,r.free/480*55)}px"></span></div>${duration(r.free)}</div>`).join('')}</div><div class="dialog-actions"><button class="primary" data-dialog="rest" autofocus>${shore.button}</button><button class="secondary" data-dialog="new">Zkusit jiný týden ↺</button></div></div>`);
    if (e.type === 'win') beep('win');
  }
  function rest() {
    const shore = pondEnding();
    openModal('rest', `<div class="dialog-art friday-pond">${fridayArt(shore.kind)}</div><div class="dialog-body"><p class="eyebrow">PÁTEK · ZAMČENO V ${clock(state.records[4].tick)}</p><h2 id="dialog-title">${shore.title}</h2>${shore.kind !== 'picnic' ? '<p>'+shore.text+'</p>' : fridayCrew() || '<p>Žádné zakázky. Žádné vylepšení lavičky.<br>Kachna má na všechno jedinou připomínku: kvák.</p>'}<div class="dialog-actions"><button class="secondary" data-dialog="results" autofocus>Výsledky týdne</button><button class="primary" data-dialog="new">Ještě jednu hru ↺</button></div><p class="dialog-sub">Nebo zavři kartu. To je taky dobrý konec.</p></div>`);
  }
  function confirmNew() {
    openModal('restart', '<div class="dialog-body"><p class="eyebrow">ČISTÝ STŮL</p><h2 id="dialog-title">Nové <em>pondělí?</em></h2><p>Rozehraný týden nahradí nová hra. Stejné zakázky, nová rozhodnutí.</p><div class="dialog-actions"><button class="secondary" data-dialog="resume" autofocus>Nechat si svůj týden</button><button class="primary" data-dialog="new">Začít od pondělí</button></div></div>');
  }
  function resume() {
    closeModal();
    if (state.status === 'dayend') summary();
    if (state.status === 'ended') ending();
  }
  function newGame() { state = E.fresh(); selected = 0; save(); closeModal(); render(); $('station-0').focus({preventScroll:true}); }
  document.addEventListener('click', event => {
    const selection = event.target.closest('[data-select]');
    if (selection) { selected = Number(selection.dataset.select); render(); return; }
    const action = event.target.closest('[data-action]');
    if (action && !action.disabled) { run(action.dataset.action); return; }
    const control = event.target.closest('[data-dialog]');
    if (!control) return;
    const value = control.dataset.dialog;
    if (value === 'start') { save(); resume(); }
    else if (value === 'resume') resume();
    else if (value === 'new-confirm') confirmNew();
    else if (value === 'new') newGame();
    else if (value === 'next') { closeModal(); run('next'); }
    else if (value === 'rest') rest();
    else if (value === 'results') ending();
  });
  $('tidy').onclick = () => run('tidy');
  $('wait').onclick = () => run('wait'); $('close').onclick = () => run('close'); $('undo').onclick = () => run('undo');
  $('help').onclick = help; $('restart').onclick = confirmNew;
  $('brand').onclick = event => { event.preventDefault(); help(); };
  $('sound').onclick = () => { sound = !sound; $('sound').textContent = `Zvuk: ${sound ? 'zap.' : 'vyp.'}`; $('sound').setAttribute('aria-pressed', String(sound)); if (sound) beep(); };
  $('dialog').addEventListener('cancel', event => { event.preventDefault(); if (modal === 'help' || modal === 'restart') resume(); });
  document.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || $('dialog').open) return;
    const key = event.key.toLowerCase();
    if (event.target.closest('[data-select]') && (key === 'enter' || key === ' ')) {
      if (event.target.closest('button')) return;
      event.preventDefault(); selected = Number(event.target.closest('[data-select]').dataset.select); render(); return;
    }
    if (['1','2','3'].includes(key)) { event.preventDefault(); selected = Number(key)-1; render(); $('station-'+selected).focus({preventScroll:true}); }
    else if (key === 'h') { event.preventDefault(); help(); }
    else {
      const action = { m:'manual', b:'build', s:'repair', u:'upgrade', w:'wait', r:'undo', e:'close' }[key];
      if (action) { event.preventDefault(); run(action); }
    }
  });
  render(); intro();
  // No network, background clock, analytics, or system integration.
})();
