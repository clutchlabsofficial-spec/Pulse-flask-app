/* =====================================================================
   PULSE — smart flask companion  ·  clickable prototype
   ---------------------------------------------------------------------
   Everything the app shows is read from the two blocks below: DRINKS and
   state. index.html is an empty shell — no drink name, temperature or
   count is written into the markup anywhere.

   Change a number in `state` and it changes on every screen at once:
   the hero readout, the rings, the charts, the side panel, the copy.
   ===================================================================== */

'use strict';

/* ---------------------------------------------------------------------
   1 · THE DRINKS
   Target temperatures live here, nowhere else. Tapping a drink copies
   its `temp` into state.targetTemp, so the heating screen climbs to
   whatever this table says.
   --------------------------------------------------------------------- */

const DRINKS = [
  { id:'masala-chai',  name:'Masala Chai',  temp:205, serving:240, icon:'leaf',  color:'#ff8a3d', note:'Rolling boil — the spices need it' },
  { id:'pour-over',    name:'Pour-Over',    temp:202, serving:300, icon:'bean',  color:'#f2a65a', note:'Bloom thirty seconds, then spiral' },
  { id:'french-press', name:'French Press', temp:200, serving:320, icon:'press', color:'#e08a5b', note:'Coarse grind, four minutes, plunge' },
  { id:'oolong',       name:'Oolong',       temp:195, serving:220, icon:'leaf',  color:'#d9a441', note:'The second steep is the good one' },
  { id:'green-tea',    name:'Green Tea',    temp:175, serving:200, icon:'leaf',  color:'#7dd3a0', note:'Never boiling, or it turns bitter' },
  { id:'matcha',       name:'Matcha',       temp:165, serving:180, icon:'whisk', color:'#6fcf97', note:'Whisk until the foam holds a peak' },
  { id:'cocoa',        name:'Cocoa',        temp:150, serving:260, icon:'cup',   color:'#c98a6b', note:'Warm enough to drink straight away' },
  { id:'iced-mate',    name:'Iced Maté',    temp:42,  serving:350, icon:'snow',  color:'#5ec8f2', note:'Chill cycle — no ice, no dilution' }
];

/* ---------------------------------------------------------------------
   2 · THE STATE
   One object. Every screen is a pure function of it.
   --------------------------------------------------------------------- */

const state = {
  currentTemp: 96,              // °F in the flask right now
  targetTemp: 205,              // °F the coil is driving toward
  selectedDrink: 'masala-chai', // id from DRINKS
  status: 'idle',               // idle · heating · cooling · ready · purifying
  battery: 78,                  // %
  hydrationToday: 1180,         // ml
  hydrationGoal: 2400,          // ml
  volumeMl: 520,                // ml left in the flask
  capacityMl: 750,              // ml the flask holds
  recentDrinks: [
    { drink:'masala-chai', ml:240, minutesAgo:42,  temp:203 },
    { drink:'green-tea',   ml:200, minutesAgo:158, temp:174 },
    { drink:'pour-over',   ml:300, minutesAgo:331, temp:201 },
    { drink:'iced-mate',   ml:350, minutesAgo:488, temp:44  }
  ],
  history: [
    { day:'Thu',   ml:2260, cycles:5 },
    { day:'Fri',   ml:1980, cycles:4 },
    { day:'Sat',   ml:2610, cycles:6 },
    { day:'Sun',   ml:1740, cycles:3 },
    { day:'Mon',   ml:2420, cycles:5 },
    { day:'Tue',   ml:2050, cycles:4 },
    { day:'Today', ml:null, cycles:3, today:true }   // ml comes from hydrationToday
  ],
  uvCycles: 42,                 // lifetime UV-C purification cycles
  lastUvMinutesAgo: 26,         // since the last one finished
  unit: 'F'                     // F or C — flip it on the device screen
};

/* ---------------------------------------------------------------------
   3 · THE PHYSICS
   Thresholds the app reasons with. The SIP / POUR tag is computed from
   sipMax — it is never written down as a label.
   --------------------------------------------------------------------- */

const TUNING = {
  sipMax: 140,          // °F — at or above this, drinking from the lid scalds
  scaldHot: 185,        // °F — "serious" heat, used for the steam plume
  chilled: 60,          // °F — below this the flask reads as a cold drink
  ambient: 72,          // °F — room temperature everything drifts toward
  coilRate: 9.0,        // °F per second while the coil drives (demo speed)
  chillRate: 7.5,       // °F per second on the chill side (demo speed)
  driftRate: 2.4,       // °F per minute of passive loss when idle
  readyBand: 1.5,       // °F — within this of target counts as "at temperature"
  battPerDegree: 0.035, // % of battery spent per °F moved
  battPerUv: 1.8,       // % of battery spent per UV-C cycle
  uvSeconds: 4,         // how long one cycle runs in this prototype
  uvFreshFor: 240,      // minutes a cycle keeps the water certified
  uvLampMinutes: 6000,  // lamp life
  uvMinutesPerCycle: 1.5,
  refillTemp: 58        // °F of fresh water from the tap
};

/* runtime bookkeeping — animation only, not app data */
const runtime = {
  screen: 'home',
  stack: [],
  cycleFrom: null,
  uvElapsed: 0,
  raf: null,
  busy: false,
  lastTs: 0,
  toastTimer: null,
  minuteAcc: 0
};

/* ---------------------------------------------------------------------
   4 · HELPERS
   --------------------------------------------------------------------- */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.prototype.slice.call(root.querySelectorAll(sel));
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

function drinkById(id){ return DRINKS.find(d => d.id === id) || DRINKS[0]; }
function selected(){ return drinkById(state.selectedDrink); }

/* temperature is stored in °F and displayed in whatever state.unit says */
function toUnit(f){ return state.unit === 'C' ? (f - 32) * 5 / 9 : f; }
function fmtTemp(f){ return Math.round(toUnit(f)) + '°' + state.unit; }
function fmtTempBare(f){ return String(Math.round(toUnit(f))); }
function fmtMl(ml){ return Math.round(ml) + ' ml'; }
function fmtL(ml){ return (Math.round(ml / 10) / 100).toFixed(2) + ' L'; }

function fmtAgo(min){
  const m = Math.round(min);
  if (m <= 0) return 'just now';
  if (m < 60) return m + ' min ago';
  const h = Math.floor(m / 60), rest = m % 60;
  if (h < 24) return rest ? h + 'h ' + rest + 'm ago' : h + 'h ago';
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : d + ' days ago';
}

function fmtCountdown(sec){
  const s = Math.max(0, Math.round(sec));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function fmtClock(date){
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  h = h % 12 === 0 ? 12 : h % 12;
  return h + ':' + m;
}

/* colour of the liquid, interpolated from the temperature itself */
function mix(a, b, t){
  const hex = (c) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const [ar, ag, ab] = hex(a), [br, bg, bb] = hex(b);
  const to = (x) => Math.round(x).toString(16).padStart(2, '0');
  return '#' + to(ar + (br - ar) * t) + to(ag + (bg - ag) * t) + to(ab + (bb - ab) * t);
}

/* a ramp with a near-neutral middle — blending blue straight into amber
   goes through a muddy green, which is not what lukewarm water looks like */
const TEMP_SCALE = [
  [32,  '#4fc3f7'],
  [70,  '#8ed4ef'],
  [110, '#d8ddde'],
  [140, '#f3cf9a'],
  [175, '#ffb765'],
  [212, '#ff6b35']
];

function tempColor(f){
  const stops = TEMP_SCALE;
  if (f <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++){
    if (f <= stops[i][0]){
      const [lo, loC] = stops[i - 1], [hi, hiC] = stops[i];
      return mix(loC, hiC, (f - lo) / (hi - lo));
    }
  }
  return stops[stops.length - 1][1];
}

/* ---------------------------------------------------------------------
   5 · DERIVED VALUES
   Nothing here is stored — it is all computed from `state` on demand.
   --------------------------------------------------------------------- */

const derive = {
  delta: () => state.targetTemp - state.currentTemp,

  /* the SIP / POUR tag: a comparison against TUNING.sipMax, not a label */
  sip(){
    const hot = state.currentTemp >= TUNING.sipMax;
    return hot
      ? { label:'POUR', tone:'pour',
          note:'Over ' + fmtTemp(TUNING.sipMax) + ' — pour into a cup, not the lid' }
      : { label:'SIP', tone:'sip',
          note:'Under ' + fmtTemp(TUNING.sipMax) + ' — safe straight from the lid' };
  },

  phase(){
    if (state.status === 'purifying') return 'purifying';
    if (state.status === 'heating' || state.status === 'cooling') return state.status;
    if (Math.abs(derive.delta()) <= TUNING.readyBand) return 'ready';
    return 'idle';
  },

  statusLine(){
    switch (derive.phase()){
      case 'heating':   return 'Heating to ' + fmtTemp(state.targetTemp) + ' for ' + selected().name;
      case 'cooling':   return 'Chilling to ' + fmtTemp(state.targetTemp) + ' for ' + selected().name;
      case 'purifying': return 'UV-C cycle running — lid locked';
      case 'ready':     return 'Holding ' + selected().name + ' at ' + fmtTemp(state.targetTemp);
      default:          return 'Idle — drifting toward ' + fmtTemp(TUNING.ambient);
    }
  },

  /* 0..1 progress of the current heat or chill run */
  cycleProgress(){
    const from = runtime.cycleFrom === null ? state.currentTemp : runtime.cycleFrom;
    const span = Math.abs(state.targetTemp - from);
    if (span < 0.5) return 1;
    return clamp(Math.abs(state.currentTemp - from) / span, 0, 1);
  },

  etaSeconds(){
    const rate = derive.delta() >= 0 ? TUNING.coilRate : TUNING.chillRate;
    return Math.abs(derive.delta()) / rate;
  },

  hydrationPct: () => clamp(state.hydrationToday / state.hydrationGoal, 0, 1),
  hydrationLeft: () => Math.max(0, state.hydrationGoal - state.hydrationToday),
  levelPct: () => clamp(state.volumeMl / state.capacityMl, 0, 1),

  servingMl(){ return Math.min(selected().serving, Math.round(state.volumeMl)); },
  canPour(){ return state.volumeMl >= 40 && state.status !== 'purifying'; },

  uvFresh: () => state.lastUvMinutesAgo <= TUNING.uvFreshFor,
  uvLampPct: () => clamp(1 - (state.uvCycles * TUNING.uvMinutesPerCycle) / TUNING.uvLampMinutes, 0, 1),
  uvCyclesLeft(){
    const left = TUNING.uvLampMinutes - state.uvCycles * TUNING.uvMinutesPerCycle;
    return Math.max(0, Math.floor(left / TUNING.uvMinutesPerCycle));
  },
  uvExpiresIn: () => Math.max(0, TUNING.uvFreshFor - state.lastUvMinutesAgo),

  /* how many full heat-ups the remaining battery is good for */
  batteryCycles(){
    const swing = Math.max(20, Math.abs(state.targetTemp - TUNING.ambient));
    return Math.max(0, Math.floor(state.battery / (swing * TUNING.battPerDegree)));
  },

  /* today's bar reads live from hydrationToday; the rest are logged days */
  dayMl: (row) => (row.today ? state.hydrationToday : row.ml),

  streak(){
    let n = 0;
    for (let i = state.history.length - 1; i >= 0; i--){
      if (derive.dayMl(state.history[i]) >= state.hydrationGoal) n++;
      else break;
    }
    return n;
  },

  weekAvg(){
    const vals = state.history.map(derive.dayMl);
    return vals.length ? sum(vals) / vals.length : 0;
  },

  drinksToday: () => state.recentDrinks.filter(r => r.minutesAgo < 60 * 16).length,

  /* the most-poured drink, counted from the log rather than stored */
  favourite(){
    const tally = {};
    state.recentDrinks.forEach(r => { tally[r.drink] = (tally[r.drink] || 0) + r.ml; });
    const best = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
    return best ? { drink: drinkById(best), ml: tally[best] } : null;
  }
};

/* ---------------------------------------------------------------------
   6 · ICONS
   --------------------------------------------------------------------- */

const ICONS = {
  flask:'<path d="M9.5 3h5"/><path d="M10 3v4.6c0 .7-.2 1.3-.5 1.9L8 12.1c-.4.7-.6 1.5-.6 2.3v4.2A2.4 2.4 0 0 0 9.8 21h4.4a2.4 2.4 0 0 0 2.4-2.4v-4.2c0-.8-.2-1.6-.6-2.3l-1.5-2.6c-.3-.6-.5-1.2-.5-1.9V3"/><path d="M7.6 14.6h8.8"/>',
  cup:'<path d="M4.5 7.5h11v6.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M15.5 9h1.8a2.6 2.6 0 0 1 0 5.2h-1.8"/><path d="M7.5 2.8v2M11 2.5v2.3M14.5 2.8v2"/>',
  drop:'<path d="M12 3.5c2.6 2.8 5.2 5.9 5.2 8.8A5.2 5.2 0 0 1 12 17.5a5.2 5.2 0 0 1-5.2-5.2C6.8 9.4 9.4 6.3 12 3.5z"/><path d="M9.7 12.6a2.4 2.4 0 0 0 2.3 2.3"/>',
  uv:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/>',
  shield:'<path d="M12 3l7 2.5v5.2c0 4.2-2.9 8-7 9.8-4.1-1.8-7-5.6-7-9.8V5.5z"/><path d="M9 12.2l2 2 4-4.2"/>',
  chart:'<path d="M5 20v-8M12 20V5M19 20v-5"/><path d="M3.5 20.5h17"/>',
  chevron:'<path d="M9 5l7 7-7 7"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  bolt:'<path d="M13 2.5 5.5 13.2H11l-1 8.3 7.6-10.8H12z"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  snow:'<path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8"/><path d="m9.4 4.4 2.6 2.4 2.6-2.4M9.4 19.6l2.6-2.4 2.6 2.4"/>',
  leaf:'<path d="M19.5 4.5c-9 0-14 3.5-14 9a5 5 0 0 0 5 5c5.5 0 9-5 9-14z"/><path d="M5.5 19.5 12 12"/>',
  bean:'<ellipse cx="12" cy="12" rx="5.4" ry="8.4" transform="rotate(-25 12 12)"/><path d="M9.2 5.9c2.2 3.4 2.2 8.9 0 12.3"/>',
  whisk:'<path d="M12 3.2v7.8"/><path d="M8.6 11.2h6.8l-.9 7.4a2.5 2.5 0 0 1-5 0z"/><path d="M12 3.2c-2 1.4-3 3.2-3 5.2M12 3.2c2 1.4 3 3.2 3 5.2"/>',
  press:'<path d="M7 8.2h10v10.3a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 18.5z"/><path d="M6 8.2h12M12 3v2.6M8.6 5.6h6.8"/><path d="M7.4 12.6h9.2"/>',
  clock:'<circle cx="12" cy="12" r="8.4"/><path d="M12 7.3V12l3.2 2"/>',
  bluetooth:'<path d="M7.5 7.5 16.5 16 12 20V4l4.5 4-9 8.5"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M18.9 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a1.9 1.9 0 1 1-3.8 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3.2a1.9 1.9 0 1 1 0-3.8h.2a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 2.7-1.1V3.2a1.9 1.9 0 1 1 3.8 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a1.9 1.9 0 1 1 0 3.8h-.2"/>',
  wifi:'<path d="M2.6 8.6a14 14 0 0 1 18.8 0"/><path d="M6 12a9 9 0 0 1 12 0"/><path d="M9.4 15.4a4.3 4.3 0 0 1 5.2 0"/><path d="M12 19h.01"/>',
  signal:'<path d="M3.5 18h.01M8 18v-4.4M13 18V9M18 18V4.4" stroke-width="2.3"/>',
  refill:'<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 3.6V8h-4.4"/>',
  power:'<path d="M12 3.4v8"/><path d="M7.2 6.3a7.5 7.5 0 1 0 9.6 0"/>',
  target:'<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="3.3"/>',
  flame:'<path d="M12 3s5 4.2 5 8.8a5 5 0 0 1-10 0C7 7.2 12 3 12 3z"/><path d="M12 20a2.6 2.6 0 0 0 2.6-2.6c0-1.6-2.6-3.6-2.6-3.6s-2.6 2-2.6 3.6A2.6 2.6 0 0 0 12 20z"/>'
};

function icon(name, size){
  const s = size || 20;
  return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
         'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ' +
         'aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
}

/* ---------------------------------------------------------------------
   7 · COMPONENTS
   --------------------------------------------------------------------- */

function ring(opts){
  const size = opts.size || 132;
  const stroke = opts.stroke || 10;
  const r = (size - stroke) / 2;
  const circ = (2 * Math.PI * r).toFixed(2);
  const cls = 'ring' + (opts.huge ? ' ring--huge' : '');
  return '<div class="' + cls + '" style="--ring-size:' + size + 'px">' +
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" ' +
        'stroke="rgba(255,255,255,.07)" stroke-width="' + stroke + '"/>' +
      '<circle class="ring__value" data-ring="' + opts.key + '" data-circ="' + circ + '" ' +
        'cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" ' +
        'stroke="' + (opts.color || 'var(--hot)') + '" stroke-width="' + stroke + '" stroke-linecap="round" ' +
        'stroke-dasharray="' + circ + '" stroke-dashoffset="' + circ + '" ' +
        'transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
    '</svg>' +
    '<div class="ring__inner">' + (opts.inner || '') + '</div>' +
  '</div>';
}

/* the flask: liquid height comes from volumeMl, colour from currentTemp */
function flaskArt(){
  return '<svg class="flask" data-flask viewBox="0 0 180 286" role="img" aria-label="Flask">' +
    '<defs>' +
      '<linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" data-grad="top" stop-color="#ffc46b"/>' +
        '<stop offset="1" data-grad="bottom" stop-color="#ff6b35"/>' +
      '</linearGradient>' +
      '<clipPath id="bodyClip">' +
        '<path d="M70 70 L70 84 C70 96 40 100 40 134 L40 244 C40 262 54 272 72 272 L108 272 C126 272 140 262 140 244 L140 134 C140 100 110 96 110 84 L110 70 Z"/>' +
      '</clipPath>' +
    '</defs>' +
    '<path class="steam" d="M78 40 c-7 -7 7 -12 0 -19 c-6 -6 4 -11 0 -15"/>' +
    '<path class="steam" d="M90 34 c-7 -7 7 -12 0 -19 c-6 -6 4 -11 0 -13"/>' +
    '<path class="steam" d="M102 40 c-7 -7 7 -12 0 -19 c-6 -6 4 -11 0 -15"/>' +
    '<path class="flask__shell" d="M70 70 L70 84 C70 96 40 100 40 134 L40 244 C40 262 54 272 72 272 L108 272 C126 272 140 262 140 244 L140 134 C140 100 110 96 110 84 L110 70 Z"/>' +
    '<g clip-path="url(#bodyClip)">' +
      '<rect class="flask__liquid" data-fill="liquid" x="34" y="150" width="112" height="200" fill="url(#liquid)"/>' +
    '</g>' +
    '<path class="flask__outline" d="M70 70 L70 84 C70 96 40 100 40 134 L40 244 C40 262 54 272 72 272 L108 272 C126 272 140 262 140 244 L140 134 C140 100 110 96 110 84 L110 70 Z"/>' +
    '<rect class="flask__cap" x="62" y="44" width="56" height="28" rx="10"/>' +
    '<path class="flask__gloss" d="M52 140 C52 116 60 108 62 106 L62 250 C56 246 52 238 52 230 Z"/>' +
    '<g class="frost">' +
      '<path d="M60 145v10M55.7 147.5l8.6 5M55.7 152.5l8.6-5"/>' +
      '<path d="M118 191v9M114.1 193.3l7.8 4.4M114.1 197.7l7.8-4.4"/>' +
      '<path d="M74 234v8M70.5 236l7 4M70.5 240l7-4"/>' +
    '</g>' +
  '</svg>';
}

function statTile(o){
  return '<button class="stat" data-act="go" data-arg="' + o.go + '">' +
    '<span class="stat__k">' + icon(o.icon, 13) + o.label + '</span>' +
    '<span class="stat__v"' + (o.live ? ' data-live="' + o.live + '"' : '') + '>' + (o.value || '') + '</span>' +
    '<span class="stat__s"' + (o.subLive ? ' data-live="' + o.subLive + '"' : '') + '>' + (o.sub || '') + '</span>' +
  '</button>';
}

function drinkRow(entry){
  const d = drinkById(entry.drink);
  return '<div class="row row--static">' +
    '<span class="row__glyph" style="color:' + d.color + '">' + icon(d.icon, 19) + '</span>' +
    '<span class="row__body"><b>' + d.name + '</b><small>' + fmtAgo(entry.minutesAgo) +
      ' · poured at ' + fmtTemp(entry.temp) + '</small></span>' +
    '<span class="row__meta">' + entry.ml + '<small>ml</small></span>' +
  '</div>';
}

function pageHead(title, sub, backTo){
  return '<header class="pagehead">' +
    (backTo ? '<button class="iconbtn" data-act="back">' + icon('back', 18) + '</button>' : '') +
    '<div><h1>' + title + '</h1><p>' + sub + '</p></div>' +
  '</header>';
}

function sipPill(){
  return '<div class="pill" data-tone="sip"><b data-live="sip.label"></b><span data-live="sip.note"></span></div>';
}

/* the button at the bottom of the home + heat screens, chosen by phase */
function primaryAction(){
  const phase = derive.phase();
  if (phase === 'purifying') return { act:'none', label:'UV-C cycle running…', cls:'btn--uv', disabled:true };
  if (phase === 'heating' || phase === 'cooling')
    return { act:'stopCycle', label:'Stop · <span data-live="eta"></span> left', cls:'btn--stop' };
  if (state.volumeMl < 40)
    return { act:'refill', label:'Refill the flask', cls:'btn--cool', icon:'refill' };
  if (phase === 'ready')
    return { act:'logSip', label:'Pour ' + fmtMl(derive.servingMl()), cls:'btn--aqua', icon:'drop' };
  const warming = derive.delta() >= 0;
  return {
    act:'startCycle',
    label:(warming ? 'Heat' : 'Chill') + ' to ' + fmtTemp(state.targetTemp),
    cls:warming ? 'btn--primary' : 'btn--cool',
    icon:warming ? 'flame' : 'snow'
  };
}

function primaryButton(wide){
  const a = primaryAction();
  return '<button class="btn ' + a.cls + (wide ? ' btn--wide' : '') + '" data-act="' + a.act + '"' +
    (a.disabled ? ' disabled' : '') + '>' +
    (a.icon ? icon(a.icon, 17) : '') + '<span>' + a.label + '</span></button>';
}

/* ---------------------------------------------------------------------
   8 · SCREENS
   Each one returns markup built from `state`. None of them contain a
   number that was typed twice.
   --------------------------------------------------------------------- */

const SCREENS = {};

/* ---- home ---------------------------------------------------------- */
SCREENS.home = {
  tabs:true,
  render(){
    const d = selected();
    return '' +
    '<header class="apphead">' +
      '<div>' +
        '<div class="apphead__brand">PULSE</div>' +
        '<div class="apphead__sub" data-live="device.line"></div>' +
      '</div>' +
      '<button class="chip" data-act="go" data-arg="device">' +
        icon('bluetooth', 14) + '<span data-live="battery.pct"></span>' +
      '</button>' +
    '</header>' +

    '<section class="hero">' +
      flaskArt() +
      '<div class="hero__read">' +
        '<div class="hero__temp" data-live="temp.current" data-color="temp"></div>' +
        '<div class="hero__status" data-live="status.line"></div>' +
        sipPill() +
      '</div>' +
    '</section>' +

    '<button class="row" data-act="go" data-arg="drinks" style="margin-top:14px">' +
      '<span class="row__glyph" style="color:' + d.color + '">' + icon(d.icon, 19) + '</span>' +
      '<span class="row__body"><b>' + d.name + '</b><small>' + d.note + '</small></span>' +
      '<span class="row__meta">' + fmtTemp(d.temp) + '<small>target</small></span>' +
      icon('chevron', 16) +
    '</button>' +

    '<div class="cta">' + primaryButton(true) + '</div>' +

    '<div class="grid3" style="margin-top:14px">' +
      statTile({ go:'hydrate', icon:'drop',  label:'Hydration', live:'hydration.pct',  subLive:'hydration.left' }) +
      statTile({ go:'uv',      icon:'shield',label:'UV-C',      live:'uv.state',       subLive:'uv.last' }) +
      statTile({ go:'stats',   icon:'chart', label:'Streak',    live:'stats.streak',   subLive:'stats.avg' }) +
    '</div>' +

    '<div class="sectitle">Recent pours<span data-live="recent.total"></span></div>' +
    (state.recentDrinks.length
      ? state.recentDrinks.slice(0, 3).map(drinkRow).join('')
      : '<div class="empty">Nothing poured yet today.</div>') +

    '<p class="note" data-live="note.home"></p>';
  }
};

/* ---- drinks -------------------------------------------------------- */
SCREENS.drinks = {
  tabs:true,
  render(){
    return '' +
    pageHead('Drinks', 'Tap one — the flask retargets and starts the cycle') +
    '<div class="drinks">' +
      DRINKS.map(d => {
        const on = d.id === state.selectedDrink;
        return '<button class="drink' + (on ? ' is-on' : '') + '" style="--accent:' + d.color + '" ' +
          'data-act="pickDrink" data-arg="' + d.id + '">' +
          '<span class="drink__on">' + icon('check', 13) + '</span>' +
          '<span class="drink__ic">' + icon(d.icon, 19) + '</span>' +
          '<span class="drink__name">' + d.name + '</span>' +
          '<span class="drink__temp">' + fmtTemp(d.temp) + '</span>' +
          '<span class="drink__note">' + d.note + '</span>' +
        '</button>';
      }).join('') +
    '</div>' +
    '<p class="note">Each card carries its own target. Selecting one writes it into ' +
      '<code>state.targetTemp</code>, so the next cycle climbs to that number and no other.</p>';
  }
};

/* ---- heat (pushed) ------------------------------------------------- */
SCREENS.heat = {
  tabs:false,
  full:true,
  render(){
    const d = selected();
    return '' +
    pageHead(d.name, 'Target ' + fmtTemp(d.temp) + ' · ' + d.note, true) +

    '<div style="margin:18px 0 6px">' +
      ring({
        key:'cycle', size:248, stroke:14, huge:true, color:tempColor(state.currentTemp),
        inner:'<div class="ring__big" data-live="temp.current" data-color="temp"></div>' +
              '<div class="ring__sub" data-live="cycle.sub"></div>'
      }) +
    '</div>' +

    '<div style="text-align:center;margin:10px 0 18px">' +
      '<div class="hero__status" data-live="status.line"></div>' +
    '</div>' +

    '<div class="grid3" style="margin-bottom:14px">' +
      '<div class="stat" style="cursor:default"><span class="stat__k">' + icon('target', 13) + 'Target</span>' +
        '<span class="stat__v" data-live="temp.target"></span>' +
        '<span class="stat__s">' + d.name + '</span></div>' +
      '<div class="stat" style="cursor:default"><span class="stat__k">' + icon('clock', 13) + 'Left</span>' +
        '<span class="stat__v" data-live="eta"></span>' +
        '<span class="stat__s" data-live="cycle.rate"></span></div>' +
      '<div class="stat" style="cursor:default"><span class="stat__k">' + icon('bolt', 13) + 'Battery</span>' +
        '<span class="stat__v" data-live="battery.pct"></span>' +
        '<span class="stat__s" data-live="battery.cost"></span></div>' +
    '</div>' +

    '<div style="display:flex;justify-content:center;margin-bottom:14px">' + sipPill() + '</div>' +

    '<div class="cta">' +
      primaryButton(true) +
      '<button class="btn btn--ghost" data-act="go" data-arg="drinks">' + icon('cup', 17) + '</button>' +
    '</div>' +

    '<p class="note" data-live="note.heat"></p>';
  }
};

/* ---- hydrate ------------------------------------------------------- */
SCREENS.hydrate = {
  tabs:true,
  render(){
    const d = selected();
    return '' +
    pageHead('Hydration', 'Everything you have poured today') +

    '<div class="card" style="text-align:center;padding:22px 16px 18px">' +
      ring({
        key:'hydration', size:186, stroke:13, color:'var(--aqua)',
        inner:'<div class="ring__big" data-live="hydration.today"></div>' +
              '<div class="ring__sub" data-live="hydration.of"></div>'
      }) +
      '<div style="margin-top:14px;font-size:12.5px;color:var(--muted)" data-live="hydration.verdict"></div>' +
    '</div>' +

    '<div class="sectitle">Log a pour</div>' +
    '<div class="grid3">' +
      [120, 240, 350].map(ml =>
        '<button class="stat" data-act="addWater" data-arg="' + ml + '" style="text-align:center">' +
          '<span class="stat__v" style="font-size:19px">+' + ml + '</span>' +
          '<span class="stat__s">ml</span>' +
        '</button>'
      ).join('') +
    '</div>' +

    '<button class="row" data-act="logSip" style="margin-top:11px">' +
      '<span class="row__glyph" style="color:' + d.color + '">' + icon(d.icon, 19) + '</span>' +
      '<span class="row__body"><b>Pour ' + d.name + '</b>' +
        '<small data-live="flask.left"></small></span>' +
      '<span class="row__meta">' + derive.servingMl() + '<small>ml</small></span>' +
    '</button>' +

    '<button class="row" data-act="refill">' +
      '<span class="row__glyph" style="color:var(--cool)">' + icon('refill', 19) + '</span>' +
      '<span class="row__body"><b>Refill the flask</b>' +
        '<small>Fresh water lands at ' + fmtTemp(TUNING.refillTemp) + '</small></span>' +
      '<span class="row__meta">' + state.capacityMl + '<small>ml</small></span>' +
    '</button>' +

    '<div class="sectitle">Today’s log<span data-live="recent.total"></span></div>' +
    (state.recentDrinks.length
      ? state.recentDrinks.map(drinkRow).join('')
      : '<div class="empty">Nothing logged yet.</div>');
  }
};

/* ---- uv ------------------------------------------------------------ */
SCREENS.uv = {
  tabs:true,
  render(){
    return '' +
    pageHead('UV-C Purify', 'Sterilise the water and the lid seal') +

    '<div class="card" data-uvcard style="text-align:center;padding:10px 16px 20px">' +
      '<div class="uvstage">' +
        '<div class="uvstage__glow"></div>' +
        '<div class="uvsweep"></div>' +
        ring({
          key:'uv', size:172, stroke:12, color:'var(--uv)',
          inner:'<div class="ring__big" style="font-size:34px" data-live="uv.big"></div>' +
                '<div class="ring__sub" data-live="uv.small"></div>'
        }) +
      '</div>' +
      '<div style="font-size:12.5px;color:var(--muted)" data-live="uv.verdict"></div>' +
      '<div class="cta">' +
        '<button class="btn btn--uv btn--wide" data-act="runUv"' +
          (state.status === 'purifying' ? ' disabled' : '') + '>' +
          icon('uv', 17) + '<span data-live="uv.button"></span></button>' +
      '</div>' +
    '</div>' +

    '<div class="grid2">' +
      '<div class="stat" style="cursor:default"><span class="stat__k">' + icon('shield', 13) + 'Lifetime</span>' +
        '<span class="stat__v" data-live="uv.cycles"></span>' +
        '<span class="stat__s">cycles run</span></div>' +
      '<div class="stat" style="cursor:default"><span class="stat__k">' + icon('power', 13) + 'Lamp</span>' +
        '<span class="stat__v" data-live="uv.lamp"></span>' +
        '<span class="stat__s" data-live="uv.lampSub"></span></div>' +
    '</div>' +

    '<div class="card" style="margin-top:12px">' +
      '<div class="card__head"><span class="card__title">Certification</span></div>' +
      '<div class="row row--static" style="margin:0 0 10px">' +
        '<span class="row__glyph" style="color:var(--uv)">' + icon('clock', 19) + '</span>' +
        '<span class="row__body"><b data-live="uv.last"></b>' +
          '<small>Water stays certified for ' + TUNING.uvFreshFor / 60 + ' hours</small></span>' +
      '</div>' +
      '<div class="row row--static" style="margin:0">' +
        '<span class="row__glyph" style="color:var(--aqua)">' + icon('bolt', 19) + '</span>' +
        '<span class="row__body"><b data-live="uv.cost"></b>' +
          '<small>Draw per cycle, measured at the cell</small></span>' +
      '</div>' +
    '</div>' +

    '<p class="note" data-live="note.uv"></p>';
  }
};

/* ---- stats --------------------------------------------------------- */
SCREENS.stats = {
  tabs:true,
  render(){
    const max = Math.max(state.hydrationGoal * 1.2, ...state.history.map(derive.dayMl));
    const fav = derive.favourite();
    return '' +
    pageHead('Stats', 'Seven days of pours, straight from the log') +

    '<div class="card">' +
      '<div class="card__head">' +
        '<span class="card__title">Millilitres per day</span>' +
        '<span class="card__title" style="color:var(--aqua)" data-live="stats.today"></span>' +
      '</div>' +
      '<div class="chart">' +
        '<div class="chart__goal" style="bottom:' + (state.hydrationGoal / max * 100) + '%">' +
          '<span>Goal ' + state.hydrationGoal + ' ml</span></div>' +
        '<div class="chart__bars">' +
          state.history.map(row => {
            const ml = derive.dayMl(row);
            const h = clamp(ml / max, 0, 1) * 100;
            const cls = 'bar' + (row.today ? ' is-today' : '') + (ml >= state.hydrationGoal ? ' is-over' : '');
            return '<div class="' + cls + '"><span class="bar__fill" style="height:' + h + '%"></span></div>';
          }).join('') +
        '</div>' +
        '<div class="chart__labels">' +
          state.history.map(row =>
            '<span class="' + (row.today ? 'is-today' : '') + '">' + row.day + '</span>'
          ).join('') +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="grid2">' +
      '<div class="stat" style="cursor:default"><span class="stat__k">' + icon('chart', 13) + 'Daily avg</span>' +
        '<span class="stat__v" data-live="stats.avgMl"></span><span class="stat__s">ml across the week</span></div>' +
      '<div class="stat" style="cursor:default"><span class="stat__k">' + icon('check', 13) + 'Streak</span>' +
        '<span class="stat__v" data-live="stats.streak"></span><span class="stat__s">days at goal</span></div>' +
      '<div class="stat" style="cursor:default"><span class="stat__k">' + icon('flame', 13) + 'Heat cycles</span>' +
        '<span class="stat__v">' + sum(state.history.map(r => r.cycles)) + '</span><span class="stat__s">this week</span></div>' +
      '<div class="stat" style="cursor:default"><span class="stat__k">' + icon('shield', 13) + 'UV-C</span>' +
        '<span class="stat__v" data-live="uv.cycles"></span><span class="stat__s">lifetime cycles</span></div>' +
    '</div>' +

    (fav
      ? '<div class="sectitle">Most poured</div>' +
        '<div class="row row--static">' +
          '<span class="row__glyph" style="color:' + fav.drink.color + '">' + icon(fav.drink.icon, 19) + '</span>' +
          '<span class="row__body"><b>' + fav.drink.name + '</b><small>' + fav.drink.note + '</small></span>' +
          '<span class="row__meta">' + fav.ml + '<small>ml logged</small></span>' +
        '</div>'
      : '') +

    '<div class="sectitle">Full log<span data-live="recent.total"></span></div>' +
    (state.recentDrinks.length
      ? state.recentDrinks.map(drinkRow).join('')
      : '<div class="empty">The log is empty.</div>');
  }
};

/* ---- device (pushed) ----------------------------------------------- */
SCREENS.device = {
  tabs:false,
  full:true,
  render(){
    return '' +
    pageHead('Flask', 'Paired over Bluetooth LE', true) +

    '<div class="card">' +
      '<div class="card__head"><span class="card__title">Battery</span>' +
        '<span class="card__title" data-live="battery.pct"></span></div>' +
      '<div class="meter"><span class="meter__fill" data-fill="battery"></span></div>' +
      '<div style="margin-top:11px;font-size:12px;color:var(--muted)" data-live="battery.detail"></div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="card__head"><span class="card__title">Units</span></div>' +
      '<div class="seg">' +
        ['F', 'C'].map(u =>
          '<button class="' + (state.unit === u ? 'is-on' : '') + '" data-act="setUnit" data-arg="' + u + '">' +
            'Degrees ' + u + '</button>'
        ).join('') +
      '</div>' +
      '<div style="margin-top:11px;font-size:12px;color:var(--muted)" data-live="unit.detail"></div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="card__head"><span class="card__title">Thresholds</span></div>' +
      '<div class="row row--static" style="margin:0 0 10px">' +
        '<span class="row__glyph" style="color:var(--hot)">' + icon('flame', 19) + '</span>' +
        '<span class="row__body"><b>Sip limit</b><small>Above this the app says pour, not sip</small></span>' +
        '<span class="row__meta" data-live="tuning.sipMax"></span>' +
      '</div>' +
      '<div class="row row--static" style="margin:0 0 10px">' +
        '<span class="row__glyph" style="color:var(--cool)">' + icon('snow', 19) + '</span>' +
        '<span class="row__body"><b>Chilled below</b><small>Frost shows on the flask</small></span>' +
        '<span class="row__meta" data-live="tuning.chilled"></span>' +
      '</div>' +
      '<div class="row row--static" style="margin:0">' +
        '<span class="row__glyph" style="color:var(--muted)">' + icon('clock', 19) + '</span>' +
        '<span class="row__body"><b>Room temperature</b><small>What an idle flask drifts toward</small></span>' +
        '<span class="row__meta" data-live="tuning.ambient"></span>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="card__head"><span class="card__title">Hardware</span></div>' +
      '<div class="kv" style="font-size:12px">' +
        '<div><dt>Capacity</dt><dd>' + state.capacityMl + ' ml</dd></div>' +
        '<div><dt>In the flask</dt><dd data-live="flask.volume"></dd></div>' +
        '<div><dt>Firmware</dt><dd>2.4.1</dd></div>' +
        '<div><dt>Serial</dt><dd>PLS-0042-KX</dd></div>' +
      '</div>' +
    '</div>' +

    '<button class="btn btn--ghost btn--wide" data-act="reset">' + icon('refill', 17) +
      '<span>Reset the prototype</span></button>' +

    '<p class="note">Every figure above is read from the same <code>state</code> object the ' +
      'rest of the app renders from.</p>';
  }
};

const TABS = [
  { id:'home',    label:'Flask',   icon:'flask' },
  { id:'drinks',  label:'Drinks',  icon:'cup' },
  { id:'hydrate', label:'Hydrate', icon:'drop' },
  { id:'uv',      label:'Purify',  icon:'uv' },
  { id:'stats',   label:'Stats',   icon:'chart' }
];

/* ---------------------------------------------------------------------
   9 · LIVE BINDINGS
   Values that change while you watch. Screens mark a slot with
   data-live="key" and paint() fills it every frame — no re-render, so
   animations and scroll position survive.
   --------------------------------------------------------------------- */

function fmtRate(){
  const r = state.unit === 'C' ? TUNING.coilRate * 5 / 9 : TUNING.coilRate;
  return r.toFixed(1) + '°/sec';
}

const LIVE = {
  'clock': () => fmtClock(new Date()),

  'temp.current': () => fmtTemp(state.currentTemp),
  'temp.target':  () => fmtTemp(state.targetTemp),
  'status.line':  () => derive.statusLine(),
  'eta': () => fmtCountdown(derive.etaSeconds()),

  'sip.label': () => derive.sip().label,
  'sip.note':  () => derive.sip().note,

  'cycle.sub': () => {
    const phase = derive.phase();
    if (phase === 'heating' || phase === 'cooling')
      return Math.round(derive.cycleProgress() * 100) + '% to ' + fmtTemp(state.targetTemp);
    if (phase === 'ready') return 'at target';
    return 'target ' + fmtTemp(state.targetTemp);
  },
  'cycle.rate': () => fmtRate(),

  'battery.pct': () => Math.round(state.battery) + '%',
  'battery.cost': () => '-' + (Math.abs(derive.delta()) * TUNING.battPerDegree).toFixed(1) + '% this run',
  'battery.detail': () => 'About ' + derive.batteryCycles() + ' more heat-ups to ' +
    fmtTemp(state.targetTemp) + ', or ' + Math.floor(state.battery / TUNING.battPerUv) + ' UV-C cycles.',

  'device.line': () => 'Vacuum flask · ' + (derive.uvFresh() ? 'water certified' : 'purify due'),

  'hydration.pct':  () => Math.round(derive.hydrationPct() * 100) + '%',
  'hydration.left': () => derive.hydrationLeft() > 0 ? derive.hydrationLeft() + ' ml to go' : 'goal met',
  'hydration.today':() => String(Math.round(state.hydrationToday)),
  'hydration.of':   () => 'of ' + state.hydrationGoal + ' ml',
  'hydration.verdict': () => {
    const left = derive.hydrationLeft();
    if (left <= 0) return 'Goal cleared — ' + fmtL(state.hydrationToday) + ' logged today.';
    const pours = Math.ceil(left / selected().serving);
    return left + ' ml to go — about ' + pours + (pours === 1 ? ' more pour' : ' more pours') +
      ' of ' + selected().name + '.';
  },

  'flask.left': () => Math.round(state.volumeMl) + ' ml left · ' +
    Math.floor(state.volumeMl / selected().serving) + ' more pours this size',
  'flask.volume': () => Math.round(state.volumeMl) + ' ml',

  'uv.big': () => state.status === 'purifying'
    ? Math.round(clamp(runtime.uvElapsed / TUNING.uvSeconds, 0, 1) * 100) + '%'
    : (state.lastUvMinutesAgo < 60
        ? state.lastUvMinutesAgo + 'm'
        : Math.floor(state.lastUvMinutesAgo / 60) + 'h'),
  'uv.small': () => state.status === 'purifying' ? 'purifying' : 'since last cycle',
  'uv.state': () => derive.uvFresh() ? 'OK' : 'DUE',
  'uv.last':  () => 'Last cycle ' + fmtAgo(state.lastUvMinutesAgo),
  'uv.cycles':() => String(state.uvCycles),
  'uv.lamp':  () => Math.round(derive.uvLampPct() * 100) + '%',
  'uv.lampSub': () => '~' + derive.uvCyclesLeft() + ' cycles left',
  'uv.cost':  () => TUNING.battPerUv + '% of the cell per cycle',
  'uv.button':() => state.status === 'purifying'
    ? 'Purifying… ' + fmtCountdown(TUNING.uvSeconds - runtime.uvElapsed)
    : 'Run a UV-C cycle',
  'uv.verdict': () => {
    if (state.status === 'purifying') return 'Hold the flask upright until the lamp stops.';
    if (!derive.uvFresh()) return 'Certification lapsed ' + fmtAgo(state.lastUvMinutesAgo - TUNING.uvFreshFor) + ' — run a cycle.';
    const left = derive.uvExpiresIn();
    return 'Certified for another ' + Math.floor(left / 60) + 'h ' + (left % 60) + 'm.';
  },

  'stats.streak': () => String(derive.streak()),
  'stats.avg':    () => Math.round(derive.weekAvg()) + ' ml avg',
  'stats.avgMl':  () => String(Math.round(derive.weekAvg())),
  'stats.today':  () => 'Today ' + Math.round(state.hydrationToday) + ' ml',

  'recent.total': () => state.recentDrinks.length + ' pours · ' +
    sum(state.recentDrinks.map(r => r.ml)) + ' ml',

  'tuning.sipMax':  () => fmtTemp(TUNING.sipMax),
  'tuning.chilled': () => fmtTemp(TUNING.chilled),
  'tuning.ambient': () => fmtTemp(TUNING.ambient),
  'unit.detail': () => 'Targets are stored in Fahrenheit and converted on the way out, so ' +
    selected().name + ' reads ' + fmtTemp(selected().temp) + '.',

  'note.home': () => 'The tag flips at ' + fmtTemp(TUNING.sipMax) + '. The flask is at ' +
    fmtTemp(state.currentTemp) + ', so it reads ' + derive.sip().label + '.',
  'note.heat': () => 'The coil moves ' + fmtRate() + '. This run costs about ' +
    (Math.abs(derive.delta()) * TUNING.battPerDegree).toFixed(1) + '% of the cell.',
  'note.uv': () => 'One cycle burns ' + TUNING.uvMinutesPerCycle + ' minutes of lamp life and keeps ' +
    'the water certified for ' + TUNING.uvFreshFor / 60 + ' hours.',

  /* raw stored values, for the inspector beside the phone */
  'raw.currentTemp': () => Math.round(state.currentTemp * 10) / 10 + '',
  'raw.targetTemp':  () => String(state.targetTemp),
  'raw.selectedDrink': () => state.selectedDrink,
  'raw.status':      () => state.status,
  'raw.battery':     () => Math.round(state.battery * 10) / 10 + '',
  'raw.hydration':   () => Math.round(state.hydrationToday) + ' / ' + state.hydrationGoal,
  'raw.volume':      () => Math.round(state.volumeMl) + ' / ' + state.capacityMl,
  'raw.recent':      () => String(state.recentDrinks.length),
  'raw.uvCycles':    () => String(state.uvCycles),
  'raw.lastUv':      () => String(state.lastUvMinutesAgo)
};

const RINGS = {
  cycle: () => derive.cycleProgress(),
  hydration: () => derive.hydrationPct(),
  uv: () => state.status === 'purifying'
    ? clamp(runtime.uvElapsed / TUNING.uvSeconds, 0, 1)
    : clamp(derive.uvExpiresIn() / TUNING.uvFreshFor, 0, 1)
};

const RING_COLORS = {
  cycle: () => tempColor(state.currentTemp)
};

function paint(){
  $$('[data-live]').forEach(node => {
    const fn = LIVE[node.getAttribute('data-live')];
    if (!fn) return;
    const value = fn();
    if (node.textContent !== value) node.textContent = value;
  });

  $$('[data-ring]').forEach(node => {
    const key = node.getAttribute('data-ring');
    const fn = RINGS[key];
    if (!fn) return;
    const circ = parseFloat(node.getAttribute('data-circ'));
    node.style.strokeDashoffset = (circ * (1 - clamp(fn(), 0, 1))).toFixed(2);
    if (RING_COLORS[key]) node.setAttribute('stroke', RING_COLORS[key]());
  });

  const warm = tempColor(state.currentTemp);

  $$('[data-color="temp"]').forEach(node => { node.style.color = warm; });

  $$('[data-fill="liquid"]').forEach(node => {
    const top = 272 - derive.levelPct() * 168;
    node.setAttribute('y', top.toFixed(1));
    node.setAttribute('height', (300 - top).toFixed(1));
  });

  $$('[data-grad="top"]').forEach(n => n.setAttribute('stop-color', mix(warm, '#ffffff', 0.22)));
  $$('[data-grad="bottom"]').forEach(n => n.setAttribute('stop-color', warm));

  $$('[data-fill="battery"]').forEach(node => {
    node.style.width = clamp(state.battery, 0, 100) + '%';
    node.style.background = state.battery <= 15
      ? 'var(--rose)'
      : (node.classList.contains('meter__fill') ? 'linear-gradient(90deg,var(--hot),var(--hot-2))' : 'var(--text)');
  });

  const tag = derive.sip();
  $$('[data-tone]').forEach(node => node.setAttribute('data-tone', tag.tone));

  $$('[data-flask]').forEach(node => {
    node.classList.toggle('is-steaming', state.currentTemp >= TUNING.scaldHot);
    node.classList.toggle('is-frosted', state.currentTemp <= TUNING.chilled);
  });

  $$('[data-uvcard]').forEach(node =>
    node.classList.toggle('is-purifying', state.status === 'purifying'));

  $$('[data-tab]').forEach(node =>
    node.classList.toggle('is-active', node.getAttribute('data-tab') === runtime.screen));
}

/* ---------------------------------------------------------------------
   10 · ROUTER — 250ms slide, matching --slide in style.css
   --------------------------------------------------------------------- */

const TAB_ORDER = TABS.map(t => t.id);
const SLIDE_MS = 250;

function chrome(){
  const bar = $('.tabbar');
  if (bar) bar.classList.toggle('is-hidden', !SCREENS[runtime.screen].tabs);
}

function buildScreen(name){
  const el = document.createElement('div');
  el.className = 'screen' + (SCREENS[name].full ? ' screen--full' : '');
  el.innerHTML = SCREENS[name].render();
  return el;
}

function navigate(to, mode){
  if (!SCREENS[to] || runtime.busy) return;
  if (to === runtime.screen) { render(); return; }

  let dir;
  if (mode === 'back') dir = -1;
  else if (mode === 'push') dir = 1;
  else {
    const from = TAB_ORDER.indexOf(runtime.screen);
    const dest = TAB_ORDER.indexOf(to);
    dir = (from === -1 || dest === -1) ? 1 : (dest > from ? 1 : -1);
  }

  const stack = $('.stack');
  const leaving = $('.screen', stack);
  const entering = buildScreen(to);

  entering.classList.add(dir > 0 ? 'from-right' : 'from-left');
  stack.appendChild(entering);
  runtime.screen = to;
  chrome();
  paint();

  void entering.offsetWidth;            /* commit the start position */
  runtime.busy = true;

  entering.classList.add('is-sliding');
  entering.classList.remove('from-right', 'from-left');
  entering.classList.add('at-rest');
  if (leaving){
    leaving.classList.add('is-sliding', dir > 0 ? 'to-left' : 'to-right');
  }

  setTimeout(() => {
    if (leaving) leaving.remove();
    entering.classList.remove('is-sliding');
    runtime.busy = false;
  }, SLIDE_MS);
}

function push(to){
  if (to === runtime.screen) { render(); return; }
  runtime.stack.push(runtime.screen);
  navigate(to, 'push');
}

function back(){
  const previous = runtime.stack.pop() || 'home';
  navigate(previous, 'back');
}

/* redraw the current screen in place, keeping scroll */
function render(){
  const current = $('.screen', $('.stack'));
  if (!current) return;
  const offset = current.scrollTop;
  current.innerHTML = SCREENS[runtime.screen].render();
  current.scrollTop = offset;
  chrome();
  paint();
}

function toast(message){
  const el = $('.toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-up');
  clearTimeout(runtime.toastTimer);
  runtime.toastTimer = setTimeout(() => el.classList.remove('is-up'), 1900);
}

/* ---------------------------------------------------------------------
   11 · ACTIONS
   Every tap in the app lands here. Each one edits `state` and nothing
   else — the screens catch up on their own.
   --------------------------------------------------------------------- */

function phaseFor(delta){
  if (Math.abs(delta) <= TUNING.readyBand) return 'ready';
  return delta > 0 ? 'heating' : 'cooling';
}

function pour(ml){
  const amount = Math.min(ml, Math.round(state.volumeMl));
  if (amount < 20){ toast('Flask is empty — refill it'); return; }
  state.volumeMl = Math.max(0, state.volumeMl - amount);
  state.hydrationToday += amount;
  state.recentDrinks.unshift({
    drink: state.selectedDrink,
    ml: amount,
    minutesAgo: 0,
    temp: Math.round(state.currentTemp)
  });
  if (state.recentDrinks.length > 8) state.recentDrinks.length = 8;
  render();
  toast('Poured ' + fmtMl(amount) + ' · ' + derive.sip().label);
}

const ACTIONS = {
  none(){},

  go(to){
    /* jumping to a tab ends whatever was pushed on top of it */
    if (SCREENS[to] && SCREENS[to].tabs) runtime.stack.length = 0;
    navigate(to);
  },

  back(){ back(); },

  /* the target temperature is copied out of DRINKS, never typed */
  pickDrink(id){
    const d = drinkById(id);
    state.selectedDrink = d.id;
    state.targetTemp = d.temp;
    runtime.cycleFrom = state.currentTemp;
    state.status = phaseFor(derive.delta());
    startLoop();
    push('heat');
    toast(d.name + ' · target ' + fmtTemp(d.temp));
  },

  startCycle(){
    if (Math.abs(derive.delta()) <= TUNING.readyBand){ state.status = 'ready'; render(); return; }
    runtime.cycleFrom = state.currentTemp;
    state.status = phaseFor(derive.delta());
    startLoop();
    render();
  },

  stopCycle(){
    state.status = Math.abs(derive.delta()) <= TUNING.readyBand ? 'ready' : 'idle';
    runtime.cycleFrom = null;
    render();
    toast('Cycle stopped at ' + fmtTemp(state.currentTemp));
  },

  logSip(){ pour(derive.servingMl()); },

  addWater(ml){ pour(parseInt(ml, 10)); },

  refill(){
    state.volumeMl = state.capacityMl;
    state.currentTemp = TUNING.refillTemp;
    state.status = Math.abs(derive.delta()) <= TUNING.readyBand ? 'ready' : 'idle';
    runtime.cycleFrom = null;
    render();
    toast('Filled to ' + fmtMl(state.capacityMl) + ' at ' + fmtTemp(TUNING.refillTemp));
  },

  runUv(){
    if (state.status === 'purifying') return;
    state.status = 'purifying';
    runtime.uvElapsed = 0;
    startLoop();
    render();
  },

  setUnit(u){
    if (state.unit === u) return;
    state.unit = u;
    render();
    toast('Showing degrees ' + u);
  },

  reset(){ window.location.reload(); }
};

/* ---------------------------------------------------------------------
   12 · THE LOOP
   Heating, chilling and UV run here. Nothing else touches currentTemp.
   --------------------------------------------------------------------- */

function startLoop(){
  if (runtime.raf !== null) return;
  runtime.lastTs = performance.now();
  runtime.raf = requestAnimationFrame(loop);
}

function loop(ts){
  const dt = Math.min(0.08, (ts - runtime.lastTs) / 1000);
  runtime.lastTs = ts;
  let running = false;

  if (state.status === 'heating' || state.status === 'cooling'){
    const delta = derive.delta();
    const rate = state.status === 'cooling' ? TUNING.chillRate : TUNING.coilRate;
    const step = rate * dt;
    state.battery = clamp(state.battery - step * TUNING.battPerDegree, 0, 100);

    if (Math.abs(delta) <= step){
      state.currentTemp = state.targetTemp;
      finishCycle();
    } else {
      state.currentTemp += Math.sign(delta) * step;
      running = true;
    }
  } else if (state.status === 'purifying'){
    runtime.uvElapsed += dt;
    if (runtime.uvElapsed >= TUNING.uvSeconds) finishUv();
    else running = true;
  }

  paint();
  runtime.raf = running ? requestAnimationFrame(loop) : null;
}

function finishCycle(){
  state.status = 'ready';
  runtime.cycleFrom = null;
  render();
  toast(selected().name + ' is at ' + fmtTemp(state.targetTemp) + ' · ' + derive.sip().label);
}

function finishUv(){
  state.uvCycles += 1;
  state.lastUvMinutesAgo = 0;
  state.battery = clamp(state.battery - TUNING.battPerUv, 0, 100);
  state.status = Math.abs(derive.delta()) <= TUNING.readyBand ? 'ready' : 'idle';
  runtime.uvElapsed = 0;
  render();
  toast('Water certified · cycle ' + state.uvCycles);
}

/* one tick a second: passive heat loss, and the clock on every log entry */
function slowTick(){
  if (state.status === 'idle' || state.status === 'ready'){
    const gap = TUNING.ambient - state.currentTemp;
    if (Math.abs(gap) > 0.25){
      state.currentTemp += Math.sign(gap) * Math.min(Math.abs(gap), TUNING.driftRate / 60);
      if (state.status === 'ready' && Math.abs(derive.delta()) > TUNING.readyBand){
        state.status = 'idle';
        render();
      }
    }
  }

  runtime.minuteAcc += 1;
  if (runtime.minuteAcc >= 60){
    runtime.minuteAcc = 0;
    state.lastUvMinutesAgo += 1;
    state.recentDrinks.forEach(entry => { entry.minutesAgo += 1; });
    render();
  }

  paint();
}

/* ---------------------------------------------------------------------
   13 · CHROME + THE INSPECTOR BESIDE THE PHONE
   --------------------------------------------------------------------- */

function statusBar(){
  return '<div class="statusbar">' +
    '<span data-live="clock"></span>' +
    '<span class="statusbar__right">' +
      icon('signal', 15) + icon('wifi', 15) +
      '<span class="statusbar__batt">' +
        '<i class="batt"><i class="batt__fill" data-fill="battery"></i></i>' +
        '<span data-live="battery.pct"></span>' +
      '</span>' +
    '</span>' +
  '</div>';
}

function tabBar(){
  return '<nav class="tabbar">' +
    TABS.map(t =>
      '<button class="tab" data-tab="' + t.id + '" data-act="go" data-arg="' + t.id + '">' +
        icon(t.icon, 22) + '<span>' + t.label + '</span>' +
      '</button>'
    ).join('') +
  '</nav>';
}

function inspectorRow(label, key){
  return '<div><dt>' + label + '</dt><dd data-live="' + key + '"></dd></div>';
}

function panelMarkup(){
  return '' +
  '<div class="panel__head">' +
    '<div class="panel__title">PULSE</div>' +
    '<p class="panel__lede">Companion app for the PULSE vacuum flask. ' +
      'A clickable mock — no backend, no framework, no build step.</p>' +
  '</div>' +

  '<div class="panel__block">' +
    '<h4>live state</h4>' +
    '<dl class="kv">' +
      inspectorRow('currentTemp', 'raw.currentTemp') +
      inspectorRow('targetTemp', 'raw.targetTemp') +
      inspectorRow('selectedDrink', 'raw.selectedDrink') +
      inspectorRow('status', 'raw.status') +
      inspectorRow('battery', 'raw.battery') +
      inspectorRow('hydration', 'raw.hydration') +
      inspectorRow('volumeMl', 'raw.volume') +
      inspectorRow('recentDrinks', 'raw.recent') +
      inspectorRow('uvCycles', 'raw.uvCycles') +
      inspectorRow('lastUvMinutesAgo', 'raw.lastUv') +
    '</dl>' +
  '</div>' +

  '<div class="panel__block">' +
    '<h4>try it</h4>' +
    '<ul>' +
      '<li>Pick a drink — the flask climbs to <em>that</em> target, not a fixed one.</li>' +
      '<li>Pick the iced one from a hot flask and it chills instead.</li>' +
      '<li>Watch the tag flip from POUR to SIP as it crosses the limit.</li>' +
      '<li>Pour until the flask runs dry, then refill it.</li>' +
      '<li>Switch to <code>°C</code> on the flask screen — every number follows.</li>' +
    '</ul>' +
  '</div>' +

  '<div class="panel__block">' +
    '<h4>how it is wired</h4>' +
    '<p class="panel__lede" style="font-size:12px">Nothing is written into the HTML. ' +
      'Every screen is rendered from one <code>state</code> object and one ' +
      '<code>DRINKS</code> array at the top of <code>script.js</code>. ' +
      'Change a number there and it changes everywhere at once.</p>' +
  '</div>';
}

function fitPhone(){
  const panelWidth = window.innerWidth > 1060 ? 292 + 56 : 0;
  const scale = Math.min(
    1,
    (window.innerHeight - 64) / 868,
    (window.innerWidth - panelWidth - 48) / 414
  );
  $('#phone').style.setProperty('--scale', Math.max(0.42, scale).toFixed(3));
}

/* ---------------------------------------------------------------------
   14 · BOOT
   --------------------------------------------------------------------- */

function boot(){
  const viewport = $('#viewport');
  viewport.innerHTML =
    statusBar() +
    '<div class="stack"></div>' +
    tabBar() +
    '<div class="toast"></div>' +
    '<div class="homebar"></div>';

  $('.stack').appendChild(buildScreen(runtime.screen));
  $('#panel').innerHTML = panelMarkup();

  document.addEventListener('click', (event) => {
    const hit = event.target.closest ? event.target.closest('[data-act]') : null;
    if (!hit || hit.disabled) return;
    const action = ACTIONS[hit.getAttribute('data-act')];
    if (action) action(hit.getAttribute('data-arg'));
  });

  window.addEventListener('resize', fitPhone);

  fitPhone();
  chrome();
  paint();
  setInterval(slowTick, 1000);

  /* handy while demoing: `state.hydrationGoal = 3000; PULSE.render()` */
  window.PULSE = { state, DRINKS, TUNING, derive, render, paint, navigate };
}

document.addEventListener('DOMContentLoaded', boot);
