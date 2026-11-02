/* Padla! — deterministic rules shared by the browser and the Node checks. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Padla = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 3;
  const DAYS = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek'];
  const JOBS = [[3, 3, 2], [3, 3, 3], [4, 3, 3], [4, 4, 3], [4, 4, 4]];
  const STATIONS = [
    { name: 'Razítkárna', short: 'Papíry', helper: 'Štemplík', color: '#efac65', noun: 'papír', plural: 'papíry', quip: 'POTVRZENO: papír existuje.' },
    { name: 'Kávovar', short: 'Káva', helper: 'Kofeínek', color: '#a9bfa4', noun: 'kávu', plural: 'kávy', quip: 'Káva uvařena. Kávovar je konečně vzhůru.' },
    { name: 'Balírna', short: 'Balíčky', helper: 'Krabík', color: '#a7bbd8', noun: 'balíček', plural: 'balíčky', quip: 'Zabaleno. Obsah: další menší krabička.' }
  ];
  const OFFERS = [
    'Dva papíry navíc. Jen drobná administrativa.',
    'Dvě kávy pro poradu o rušení porad.',
    'Dva balíčky. Prý náhradní díly k volnému času.',
    'Dva papíry k povolení nepotřebovat povolení.',
    'Ještě dvě kávy. To přece před víkendem stihneš.'
  ];
  const clone = x => JSON.parse(JSON.stringify(x));
  const left = s => s.jobs.reduce((a, b) => a + b, 0);
  const limit = unit => unit.level ? 8 : 4;
  const minutes = ticks => ticks * 30;
  function note(s, text, kind = 'info') {
    s.log.unshift({ text, kind, tick: s.tick, day: s.day });
    s.log = s.log.slice(0, 24);
  }
  function fresh() {
    return { version: VERSION, day: 0, tick: 0, status: 'playing', jobs: [...JOBS[0]], total: [...JOBS[0]],
      units: [null, null, null], cleanPieces: null, parcelReady: false, bolts: 6, free: 0, records: [], offered: false,
      rewindUsed: false, previous: null, last: 'start', produced: [0, 0, 0],
      log: [{ text: 'Noema: „Postav si pomocníky. A pak si hlavně dovol odejít.“', kind: 'info', tick: 0, day: 0 }] };
  }
  function reason(s, action, i = 0) {
    if (!s || s.version !== VERSION) return 'Neplatná hra.';
    if (action === 'next') return s.status === 'dayend' ? '' : 'Směna ještě neskončila.';
    if (action === 'undo') return s.status === 'playing' && s.previous && !s.rewindUsed ? '' : 'Rollback vrátí jeden tah za směnu, před jejím uzavřením.';
    if (s.status !== 'playing') return 'Tahle směna už skončila.';
    if (['manual', 'build', 'repair', 'upgrade'].includes(action) && (!Number.isInteger(i) || i < 0 || i > 2)) return 'Vyber pracoviště.';
    const u = s.units[i];
    if (action === 'close') return left(s) ? 'Nejdřív dokonči všechny dnešní zakázky.' : '';
    if (action === 'tidy') {
      if (s.cleanPieces !== null) return 'Dílna už je uklizená.';
      return left(s) ? '' : 'Stačí zavřít; úklid je v tom.';
    }
    if (action === 'prep') {
      if (s.day === 4) return 'Další směna už nebude.';
      if (left(s)) return 'Nejdřív dokonči dnešní objednávku.';
      return s.parcelReady ? 'Jeden balíček už čeká na ráno.' : '';
    }
    if (action === 'contract') return s.offered ? 'Jedna drobnost denně bohatě stačí.' : '';
    if (action === 'wait') return '';
    if (action === 'manual') return s.jobs[i] ? '' : 'Tady už je hotovo.';
    if (action === 'build') {
      if (u) return 'Pomocník už tu je.';
      if (s.bolts < 3) return 'Potřebuješ 3 součástky.';
      if (s.tick > 13) return 'Na montáž už před zavíráním nezbývá celá hodina.';
      return '';
    }
    if (action === 'repair' || action === 'upgrade') {
      if (!u) return 'Nejdřív postav pomocníka.';
      if (action === 'repair') {
        if (!u.wear) return 'Pomocník je jako nový.';
        return s.bolts < 1 ? 'Potřebuješ 1 součástku. Ruční práce funguje i bez ní.' : '';
      }
      if (u.level) return 'Pojistka už je namontovaná.';
      if (s.bolts < 4) return 'Potřebuješ 4 součástky.';
      if (s.tick > 13) return 'Na montáž už před zavíráním nezbývá celá hodina.';
      return '';
    }
    return 'Neznámá akce.';
  }
  function advance(s, ticks, stopped = -1) {
    for (let t = 0; t < ticks; t++) {
      s.tick++;
      s.units.forEach((u, i) => {
        if (!u || i === stopped || u.jammed || !s.jobs[i]) return;
        u.phase++;
        if (u.phase < 2) return;
        u.phase = 0;
        s.jobs[i]--;
        s.produced[i]++;
        u.wear++;
        note(s, `${STATIONS[i].helper}: −1 zakázka.`, 'auto');
        if (u.wear >= limit(u)) {
          u.jammed = true;
          note(s, `${STATIONS[i].helper} se zasekl. „Já jsem splnil počet splnění.“ Servis nebo ruční práce!`, 'jam');
        }
      });
    }
  }
  function finish(s) {
    const remaining = left(s);
    const time = remaining ? 0 : minutes(16 - s.tick);
    s.free += time;
    if (!remaining) s.bolts += 3;
    s.records.push({ day: s.day, free: time, tick: s.tick, remaining, carry: [...s.jobs], bonus: !remaining ? 3 : 0 });
    s.status = s.day === 4 ? 'ended' : 'dayend';
    s.previous = null;
    note(s, remaining ? `Padla. ${remaining} zakázek přechází dál. Zvonek to za tebe neudělá.` : `Zamčeno. ${time} minut opravdu pro tebe. Za hotovou směnu +3 součástky.`, remaining ? 'jam' : 'good');
  }
  function act(state, action, i = 0) {
    const error = reason(state, action, i);
    if (error) return { state, error };
    if (action === 'undo') {
      const s = clone(state.previous);
      s.rewindUsed = true; s.previous = null; s.last = 'undo';
      note(s, 'Rollback: „Vrátil jsem tah. Včerejší oběd zatím nechávám.“', 'good');
      return { state: s, error: '' };
    }
    const s = clone(state);
    s.previous = null;
    if (action === 'next') {
      s.day++; s.tick = 0; s.cleanPieces = null; s.status = 'playing'; s.offered = false; s.rewindUsed = false;
      s.jobs = JOBS[s.day].map((n, j) => n + s.jobs[j]);
      s.total = [...s.jobs];
      if (s.parcelReady) {
        s.jobs[2]--; s.parcelReady = false;
        note(s, 'Při otevření předáváš včera zabalenou zásilku. První dnešní balíček je odbavený.', 'good');
      }
      s.last = 'next'; s.produced = [0, 0, 0];
      note(s, `${DAYS[s.day]}. Nové zakázky dorazily. Opotřebení přes noc nezmizelo.`, 'info');
      return { state: s, error: '' };
    }
    s.previous = clone(state); s.previous.previous = null;
    s.last = action; s.produced = [0, 0, 0];
    if (action === 'manual') {
      s.jobs[i]--; note(s, `${STATIONS[i].quip} Ručně −1 zakázka.`, 'work');
      advance(s, 1);
    } else if (action === 'build') {
      s.bolts -= 3; advance(s, 2);
      s.units[i] = { wear: 0, phase: 0, level: 0, jammed: false };
      note(s, `${STATIONS[i].helper} nastupuje! 1 zakázka za hodinu, servis po 4 výstupech.`, 'good');
    } else if (action === 'repair') {
      s.bolts--; advance(s, 1, i);
      Object.assign(s.units[i], { wear: 0, phase: 0, jammed: false });
      note(s, `${STATIONS[i].helper} po servisu. Zase věří v budoucnost.`, 'good');
    } else if (action === 'upgrade') {
      s.bolts -= 4; advance(s, 2, i);
      Object.assign(s.units[i], { wear: 0, phase: 0, jammed: false, level: 1 });
      note(s, `${STATIONS[i].helper} má pojistku: výdrž 8 výstupů. Rychlost zůstává.`, 'good');
    } else if (action === 'prep') {
      advance(s, 1); s.parcelReady = true;
      note(s, 'Balíček na zítřek je zabalený. Předáš ho ráno při otevření.', 'work');
    } else if (action === 'tidy') {
      s.cleanPieces = 0;
      advance(s, 1);
      note(s, 'Dílna je uklizená. Počítají se i kusy dokončené během úklidu.', 'info');
    } else if (action === 'wait') {
      advance(s, 1); note(s, 'Půl hodiny dohledu. Volno se počítá až za zavřenými dveřmi.', 'info');
    } else if (action === 'contract') {
      const lane = s.day % 3;
      s.jobs[lane] += 2; s.total[lane] += 2; s.bolts += 3; s.offered = true;
      note(s, `Noemina drobnost přijata: +2 zakázky (${STATIONS[lane].short}), +3 součástky.`, 'work');
    }
    if (s.cleanPieces !== null) {
      s.cleanPieces += s.produced.reduce((a,b) => a+b, 0) + Number(action === 'manual' || action === 'prep');
      if (s.cleanPieces > 1) {
        s.cleanPieces = null;
        note(s, 'Druhý kus nechal na stole nepořádek. Před odchodem bude potřeba znovu uklidit.', 'info');
      }
    }
    if (action === 'close' || s.tick === 15) {
      if (s.cleanPieces === null || left(s)) s.tick++;
      finish(s);
    }
    return { state: s, error: '' };
  }
  function ending(s) {
    if (s.status !== 'ended') return null;
    const r = s.records[4];
    if (!r.remaining && r.free >= 180) return { type: 'win', title: 'Konečně nic nemusíš.', subtitle: 'Dílna má hotovo. Ty máš odpoledne.', text: 'Noema zavřela sešit s nápady. Rollback poprvé nic nevrátil. Kachna nepotřebuje roadmapu. Jen společnost.' };
    if (!r.remaining) return { type: 'almost', title: 'Hotovo. Ale za jak dlouho?', subtitle: 'Zakázky splněny. Rybník už čekat neuměl.', text: 'Na tři páteční hodiny to nevyšlo. Příště nech pomocníky pracovat souběžně s tebou a zkus odmítnout poslední „drobnost“.' };
    return { type: 'lost', title: 'Firma má tebe.', subtitle: 'A tvůj volný čas je stále v pořadníku.', text: 'Zakázky zůstaly na stole. Začni znovu: ruční práce zachrání zaseknutý stroj a nemusíš přijmout každou nabídku.' };
  }
  // Saves are untrusted input. Invalid or older saves never enter the renderer.
  function valid(s, nested = false) {
    const int = (x, min, max) => Number.isInteger(x) && x >= min && x <= max;
    const triple = a => Array.isArray(a) && a.length === 3 && a.every(x => int(x, 0, 100));
    if (!s || s.version !== VERSION || !int(s.day, 0, 4) || !int(s.tick, 0, 16) ||
      !['playing', 'dayend', 'ended'].includes(s.status) || !triple(s.jobs) || !triple(s.total) ||
      s.total.some((n, i) => n < s.jobs[i]) || !triple(s.produced) || !int(s.bolts, 0, 100) || !int(s.free, 0, 2400) ||
      (s.cleanPieces !== null && !int(s.cleanPieces, 0, 1)) || typeof s.parcelReady !== 'boolean' || (s.day === 4 && s.parcelReady) || typeof s.offered !== 'boolean' || typeof s.rewindUsed !== 'boolean' || typeof s.last !== 'string') return false;
    if ((s.status === 'playing' && s.tick >= 15) || (s.status === 'dayend' && s.day === 4) || (s.status === 'ended' && s.day !== 4)) return false;
    if (!Array.isArray(s.units) || s.units.length !== 3 || !s.units.every(u => u === null ||
      (u && int(u.level, 0, 1) && int(u.phase, 0, 1) && int(u.wear, 0, limit(u)) && typeof u.jammed === 'boolean' && u.jammed === (u.wear === limit(u))))) return false;
    if (!Array.isArray(s.records) || s.records.length !== s.day + (s.status === 'playing' ? 0 : 1) || !s.records.every((r, j) =>
      r && r.day === j && int(r.free, 0, 480) && int(r.tick, 0, 16) && int(r.remaining, 0, 300) && triple(r.carry) && int(r.bonus, 0, 3))) return false;
    if (!Array.isArray(s.log) || s.log.length > 24 || !s.log.every(l => l && typeof l.text === 'string' && l.text.length <= 500 &&
      ['info', 'auto', 'jam', 'good', 'work'].includes(l.kind) && int(l.tick, 0, 16) && int(l.day, 0, 4))) return false;
    if (s.previous !== null && (nested || !valid(s.previous, true) || s.previous.day !== s.day || s.previous.status !== 'playing')) return false;
    return true;
  }
  return { VERSION, DAYS, JOBS, STATIONS, OFFERS, fresh, act, reason, left, limit, ending, valid, minutes };
});
