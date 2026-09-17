/* =====================================================================
   PULSE — smart flask companion  ·  clickable prototype
   ---------------------------------------------------------------------
   Everything the app shows is read from the two blocks below: DRINKS and
   state. index.html is an empty shell — no drink name, temperature or
   count is written into the markup anywhere.

   The flask only heats. Every target sits above room temperature, and a
   flask left alone drifts back down toward it on its own.

   No artwork is drawn in this file. Photographs are dropped into
   images/ and images/drinks/; until they exist every picture slot
   falls back to a bordered placeholder of its own accord.
   ===================================================================== */

'use strict';

/* ---------------------------------------------------------------------
   1 · THE DRINKS
   Target temperatures live here, nowhere else. Tapping a drink copies
   its `temp` into state.targetTemp, so the heating screen climbs to
   whatever this table says. The image filename comes from the id, so a
   new drink looks for its own photo with no other edit.
   --------------------------------------------------------------------- */

const DRINKS = [
  {
    id: 'honey-lemon',
    name: 'Honey lemon',
    temp: 140,
    howToMake: 'Half a lemon squeezed into hot water. Two spoons of honey, stirred until it runs clear.',
    goesWellWith: 'Buttered toast, ginger biscuits, a sore throat.'
  },
  {
    id: 'hot-chocolate',
    name: 'Hot chocolate',
    temp: 165,
    howToMake: 'Three spoons of cocoa into hot milk. Whisk hard or it clumps at the bottom.',
    goesWellWith: 'Marshmallows, shortbread, a cold morning.'
  },
  {
    id: 'green-tea',
    name: 'Green tea / matcha',
    temp: 175,
    howToMake: 'Never boiling. Steep leaf two minutes; whisk matcha until the foam holds a peak.',
    goesWellWith: 'Mochi, salted almonds, anything lightly sweet.'
  },
  {
    id: 'oolong',
    name: 'Oolong',
    temp: 190,
    howToMake: 'Rinse the leaves once and pour that off. Steep three minutes — the second steep is the good one.',
    goesWellWith: 'Dumplings, roasted nuts, dark chocolate.'
  },
  {
    id: 'instant-coffee',
    name: 'Instant coffee',
    temp: 195,
    howToMake: 'One heaped spoon per cup. A splash of cold water first stops it clumping.',
    goesWellWith: 'Buttered toast, Parle-G, a long drive.'
  },
  {
    id: 'masala-chai',
    name: 'Black tea / masala chai',
    temp: 205,
    howToMake: '1:1 milk to water. Steep 4 minutes. Add sugar to taste.',
    goesWellWith: 'Biscuits, rusk, samosa.'
  }
];

/* ---------------------------------------------------------------------
   2 · THE STATE
   One object. Every screen is a pure function of it.
   --------------------------------------------------------------------- */

const state = {
  currentTemp: 96,              // °F in the flask right now
  targetTemp: 205,              // °F the coil is driving toward
  selectedDrink: 'masala-chai', // id from DRINKS
  status: 'idle',               // idle · heating · ready · purifying
  battery: 78,                  // %
  hydrationToday: 1180,         // ml
  hydrationGoal: 2400,          // ml
  volumeMl: 520,                // ml left in the flask
  capacityMl: 750,              // ml the flask holds
  recentDrinks: [
    { drink:'masala-chai',    ml:240, minutesAgo:42,  temp:203 },
    { drink:'green-tea',      ml:200, minutesAgo:158, temp:174 },
    { drink:'instant-coffee', ml:300, minutesAgo:331, temp:194 },
    { drink:'honey-lemon',    ml:260, minutesAgo:488, temp:139 }
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
  unit: 'F'                     // F or C — flip it on the flask screen
};

/* ---------------------------------------------------------------------
   3 · THE PHYSICS
   Thresholds the app reasons with. The SIP / POUR mode is computed from
   lockTrip — it is never written down as a label.
   --------------------------------------------------------------------- */

const TUNING = {
  lockTrip: 145,        // °F — at or above this the lid locks: pour, don't sip
  ambient: 72,          // °F — room temperature everything drifts toward
  coilRate: 9.0,        // °F per second while the coil drives (demo speed)
  driftRate: 2.4,       // °F per minute of passive loss when idle
  readyBand: 1.5,       // °F — within this of target counts as "at temperature"
  battPerDegree: 0.035, // % of battery spent per °F of climb
  battPerUv: 1.8,       // % of battery spent per UV-C cycle
  uvSeconds: 4,         // how long one cycle runs in this prototype
  uvFreshFor: 240,      // minutes a cycle keeps the water certified
  uvLampMinutes: 6000,  // lamp life
  uvMinutesPerCycle: 1.5,
  refillTemp: 58,       // °F of fresh water from the tap
  serving: 240,         // ml poured by one tap
  minPour: 20,          // ml — below this there is nothing left to pour
  emptyBelow: 40,       // ml — under this the app asks you to refill
  minSwing: 20          // °F — floor used when estimating heat-ups left
};

/* ---------------------------------------------------------------------
   3b · THE DIALS
   Everything else that used to be typed into the middle of a screen.
   Copy, sizes, file paths, timings and the phone shell all live here, so
   any of it can be changed in one place without hunting through markup.
   --------------------------------------------------------------------- */

const CONFIG = {
  brand: 'PULSE',

  device: {
    kind: 'Vacuum flask',
    link: 'Bluetooth LE',
    firmware: '2.4.1',
    serial: 'PLS-0042-KX'
  },

  /* where the photographs live. The drink file is dir + id + ext. */
  images: {
    bottle: 'images/bottle.png',
    bottleLabel: 'render',
    drinkDir: 'images/drinks/',
    drinkExt: '.jpg'
  },

  pourPresets: [120, 240, 350],   // the quick-add buttons on Hydration
  homeRecent: 3,                  // pours listed on the flask screen
  logLimit: 8,                    // how many pours the log keeps
  chartHeadroom: 1.2,             // top of the chart, as a multiple of goal

  rings: {
    cycle:     { size: 236, thick: 12 },
    hydration: { size: 180, thick: 11 },
    uv:        { size: 172, thick: 11 }
  },

  motion: {
    slide: 250,        // ms — screen transition, mirrored into CSS
    toast: 1900,       // ms — how long a toast stays up
    tween: 0.3,        // 0..1 — how fast a changed number catches up
    maxFrame: 0.08     // s — largest step one animation frame may take
  },

  clock: {
    tickMs: 1000,      // the slow tick
    ticksPerMinute: 60 // ticks before the log ages by a minute
  },

  phone: {
    width: 390,        // the screen inside the frame
    height: 844,
    bezel: 12,
    margin: 64,        // breathing room around the phone on the page
    gutter: 48,
    panelWidth: 292,   // the inspector beside it
    panelGap: 56,
    panelBreakpoint: 1060,
    minScale: 0.42
  },

  copy: {
    drinks:  { title:'Drinks',      sub:'Tap one for how to make it, then heat' },
    hydrate: { title:'Hydration',   sub:'Everything you have poured today' },
    uv:      { title:'UV-C Purify', sub:'Sterilise the water and the lid seal' },
    stats:   { title:'Stats',       sub:'Seven days of pours, straight from the log' },
    device:  { title:'Flask',       sub:'Paired over ' }   // + device.link
  }
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
  minuteAcc: 0,
  bind: null
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

/* escape anything that lands in an attribute we build by hand */
function esc(s){
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------------------------------------------------------------------
   5 · DERIVED VALUES
   Nothing here is stored — it is all computed from `state` on demand.
   --------------------------------------------------------------------- */

const derive = {
  delta: () => state.targetTemp - state.currentTemp,

  /* The two modes. At or above lockTrip the lid is mechanically locked,
     so the flask can only be poured out; below it the lid opens and you
     can drink straight from it. A comparison, never a stored label. */
  modeAt(temp){
    return temp >= TUNING.lockTrip
      ? { tag:'POUR', locked:true,
          note:'Lid locks at ' + fmtTemp(TUNING.lockTrip) + ' — pour into a cup' }
      : { tag:'SIP', locked:false,
          note:'Under ' + fmtTemp(TUNING.lockTrip) + ' — drink straight from the lid' };
  },
  mode(){ return derive.modeAt(state.currentTemp); },
  drinkMode(d){ return derive.modeAt(d.temp); },

  phase(){
    if (state.status === 'purifying') return 'purifying';
    if (state.status === 'heating') return 'heating';
    if (Math.abs(derive.delta()) <= TUNING.readyBand) return 'ready';
    return 'idle';
  },

  /* above target with no way to force it down — it settles on its own */
  settling: () => derive.delta() < -TUNING.readyBand,

  statusLine(){
    switch (derive.phase()){
      case 'heating':   return 'Heating to ' + fmtTemp(state.targetTemp) + ' for ' + selected().name;
      case 'purifying': return 'UV-C cycle running — lid held shut';
      case 'ready':     return 'Holding ' + selected().name + ' at ' + fmtTemp(state.targetTemp);
      default:
        return derive.settling()
          ? 'Above target — settling toward ' + fmtTemp(TUNING.ambient)
          : 'Idle — drifting toward ' + fmtTemp(TUNING.ambient);
    }
  },

  /* 0..1 progress of the current heat run */
  cycleProgress(){
    const from = runtime.cycleFrom === null ? state.currentTemp : runtime.cycleFrom;
    const span = Math.abs(state.targetTemp - from);
    if (span < 0.5) return 1;
    return clamp(Math.abs(state.currentTemp - from) / span, 0, 1);
  },

  etaSeconds: () => Math.max(0, derive.delta()) / TUNING.coilRate,

  /* what the LED ring on the bottle is doing */
  led(){
    if (state.status === 'purifying' || state.status === 'heating') return 'pulsing';
    return state.currentTemp >= TUNING.lockTrip ? 'on' : 'off';
  },

  hydrationPct: () => clamp(state.hydrationToday / state.hydrationGoal, 0, 1),
  hydrationLeft: () => Math.max(0, state.hydrationGoal - state.hydrationToday),
  levelPct: () => clamp(state.volumeMl / state.capacityMl, 0, 1),

  servingMl(){ return Math.min(TUNING.serving, Math.round(state.volumeMl)); },

  uvFresh: () => state.lastUvMinutesAgo <= TUNING.uvFreshFor,
  uvLampPct: () => clamp(1 - (state.uvCycles * TUNING.uvMinutesPerCycle) / TUNING.uvLampMinutes, 0, 1),
  uvCyclesLeft(){
    const left = TUNING.uvLampMinutes - state.uvCycles * TUNING.uvMinutesPerCycle;
    return Math.max(0, Math.floor(left / TUNING.uvMinutesPerCycle));
  },
  uvExpiresIn: () => Math.max(0, TUNING.uvFreshFor - state.lastUvMinutesAgo),

  /* how many full heat-ups the remaining battery is good for */
  batteryCycles(){
    const swing = Math.max(TUNING.minSwing, state.targetTemp - TUNING.ambient);
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

  /* the most-poured drink, counted from the log rather than stored */
  favourite(){
    const tally = {};
    state.recentDrinks.forEach(r => { tally[r.drink] = (tally[r.drink] || 0) + r.ml; });
    const best = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
    return best ? { drink: drinkById(best), ml: tally[best] } : null;
  }
};

/* ---------------------------------------------------------------------
   6 · PICTURE SLOTS
   Real photographs, dropped into images/ by hand. Nothing is drawn.
   While a file is missing the slot keeps its exact shape and shows a
   bordered placeholder instead, so the layout never shifts and no
   broken-image symbol appears. Add the file and it simply shows up.
   --------------------------------------------------------------------- */

function shot(kind, src, alt, fallback){
  return '<div class="shot shot--' + kind + '" data-fallback="' + esc(fallback) + '">' +
    '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" onerror="imgFail(this)">' +
  '</div>';
}

function bottleShot(){
  return '<div class="bottle">' +
    shot('bottle', CONFIG.images.bottle, CONFIG.brand + ' Flask', CONFIG.images.bottleLabel) +
    '<div class="led" data-led></div>' +
  '</div>';
}

function drinkShot(d, kind){
  return shot(kind, CONFIG.images.drinkDir + d.id + CONFIG.images.drinkExt, '', d.name);
}

/* the img cannot render, so take it out and let the slot show its label */
function imgFail(img){
  img.style.display = 'none';
  if (img.parentNode) img.parentNode.classList.add('is-empty');
}

/* ---------------------------------------------------------------------
   7 · COMPONENTS
   --------------------------------------------------------------------- */

function ring(o){
  const size = CONFIG.rings[o.key] || { size:160, thick:11 };
  /* the opening value is written inline so a redraw picks up where the
     ring already was, instead of sweeping round from zero */
  const start = RINGS[o.key] ? clamp(RINGS[o.key](), 0, 1).toFixed(4) : 0;
  return '<div class="ring" data-ring="' + o.key + '" ' +
    'style="--size:' + size.size + 'px;--thick:' + size.thick + 'px;--pct:' + start + '">' +
    '<div class="ring__face"></div>' +
    '<div class="ring__inner">' + (o.inner || '') + '</div>' +
  '</div>';
}

function modeTag(mode, live){
  const attrs = live ? ' data-mode' : '';
  return '<span class="tag' + (mode.locked ? ' tag--locked' : '') + '"' + attrs + '>' +
    '<b' + (live ? ' data-live="mode.tag"' : '') + '>' + mode.tag + '</b>' +
  '</span>';
}

function statTile(o){
  const tag = o.go ? 'button' : 'div';
  const act = o.go ? ' data-act="go" data-arg="' + o.go + '"' : '';
  return '<' + tag + ' class="stat' + (o.go ? '' : ' stat--flat') + '"' + act + '>' +
    '<span class="stat__k">' + o.label + '</span>' +
    '<span class="stat__v"' + (o.live ? ' data-live="' + o.live + '"' : '') + '>' + (o.value || '') + '</span>' +
    '<span class="stat__s"' + (o.subLive ? ' data-live="' + o.subLive + '"' : '') + '>' + (o.sub || '') + '</span>' +
  '</' + tag + '>';
}

function logRow(entry){
  const d = drinkById(entry.drink);
  return '<div class="row row--static">' +
    drinkShot(d, 'thumb') +
    '<span class="row__body"><b>' + d.name + '</b><small>' + fmtAgo(entry.minutesAgo) +
      ' · poured at ' + fmtTemp(entry.temp) + '</small></span>' +
    '<span class="row__meta">' + entry.ml + '<small>ml</small></span>' +
  '</div>';
}

function pageHead(title, sub, backTo){
  return '<header class="pagehead">' +
    (backTo ? '<button class="backbtn" data-act="back" aria-label="Back">Back</button>' : '') +
    '<div><h1>' + title + '</h1><p>' + sub + '</p></div>' +
  '</header>';
}

function block(label, body){
  return '<section class="block">' +
    '<h3 class="block__label">' + label + '</h3>' +
    '<p class="block__body">' + body + '</p>' +
  '</section>';
}

/* the button at the bottom of the flask and heating screens, by phase */
function primaryAction(){
  const phase = derive.phase();
  if (phase === 'purifying')
    return { act:'none', label:'UV-C cycle running', cls:'btn--ghost', disabled:true };
  if (phase === 'heating')
    return { act:'stopCycle', label:'Stop · <span data-live="eta"></span> left', cls:'btn--stop' };
  if (state.volumeMl < TUNING.emptyBelow)
    return { act:'refill', label:'Refill the flask', cls:'btn--primary' };
  if (derive.delta() > TUNING.readyBand)
    return { act:'startCycle', label:'Heat to ' + fmtTemp(state.targetTemp), cls:'btn--primary' };
  return { act:'logSip', label:'Pour ' + fmtMl(derive.servingMl()), cls:'btn--primary' };
}

/* the detail screen's button: the coil only climbs, so it says so */
function detailButton(d){
  const gap = d.temp - state.currentTemp;
  if (gap > TUNING.readyBand)
    return '<button class="btn btn--primary btn--wide" data-act="heatSelected">Heat to ' +
      fmtTemp(d.temp) + '</button>';
  if (Math.abs(gap) <= TUNING.readyBand)
    return '<button class="btn btn--primary btn--wide" data-act="go" data-arg="home">Already at ' +
      fmtTemp(d.temp) + '</button>';
  return '<button class="btn btn--ghost btn--wide" data-act="none" disabled>Flask is above ' +
    fmtTemp(d.temp) + ' — it settles on its own</button>';
}

function primaryButton(){
  const a = primaryAction();
  return '<button class="btn ' + a.cls + ' btn--wide" data-act="' + a.act + '"' +
    (a.disabled ? ' disabled' : '') + '>' + a.label + '</button>';
}

/* ---------------------------------------------------------------------
   8 · SCREENS
   Each one returns markup built from `state`. None of them contain a
   number that was typed twice.
   --------------------------------------------------------------------- */

const SCREENS = {};

/* ---- flask (home) -------------------------------------------------- */
SCREENS.home = {
  tabs:true,
  render(){
    const d = selected();
    return '' +
    '<header class="apphead">' +
      '<div>' +
        '<div class="apphead__brand">' + CONFIG.brand + '</div>' +
        '<div class="apphead__sub" data-live="device.line"></div>' +
      '</div>' +
      '<button class="chip" data-act="go" data-arg="device">' +
        '<span data-live="battery.pct"></span>' +
      '</button>' +
    '</header>' +

    bottleShot() +

    '<section class="readout">' +
      '<div class="readout__temp" data-live="temp.current" data-hot></div>' +
      '<div class="readout__status" data-live="status.line"></div>' +
      '<div class="lockline" data-mode>' +
        modeTag(derive.mode(), true) +
        '<span data-live="mode.note"></span>' +
      '</div>' +
    '</section>' +

    '<button class="row" data-act="openDrink" data-arg="' + d.id + '">' +
      drinkShot(d, 'thumb') +
      '<span class="row__body"><b>' + d.name + '</b><small>' + d.goesWellWith + '</small></span>' +
      '<span class="row__meta">' + fmtTemp(d.temp) + '<small>target</small></span>' +
    '</button>' +

    '<div class="cta">' + primaryButton() + '</div>' +

    '<div class="grid3">' +
      statTile({ go:'hydrate', label:'Hydration', live:'hydration.pct', subLive:'hydration.left' }) +
      statTile({ go:'uv',      label:'UV-C',      live:'uv.state',      subLive:'uv.last' }) +
      statTile({ go:'stats',   label:'Streak',    live:'stats.streak',  subLive:'stats.avg' }) +
    '</div>' +

    '<div class="sectitle">Recent pours<span data-live="recent.total"></span></div>' +
    (state.recentDrinks.length
      ? state.recentDrinks.slice(0, CONFIG.homeRecent).map(logRow).join('')
      : '<div class="empty">Nothing poured yet today.</div>') +

    '<p class="note" data-live="note.home"></p>';
  }
};

/* ---- drinks -------------------------------------------------------- */
SCREENS.drinks = {
  tabs:true,
  render(){
    return '' +
    pageHead(CONFIG.copy.drinks.title, CONFIG.copy.drinks.sub) +
    '<div class="drinks">' +
      DRINKS.map(d => {
        const on = d.id === state.selectedDrink;
        const mode = derive.drinkMode(d);
        return '<button class="drink' + (on ? ' is-on' : '') + '" ' +
          'data-act="openDrink" data-arg="' + d.id + '">' +
          drinkShot(d, 'card') +
          '<span class="drink__body">' +
            '<span class="drink__name">' + d.name + '</span>' +
            '<span class="drink__temp">' + fmtTemp(d.temp) + '</span>' +
          '</span>' +
          modeTag(mode) +
        '</button>';
      }).join('') +
    '</div>' +
    '<p class="note">Every target sits above room temperature, so the coil only ever climbs. ' +
      'Anything at or over <span data-live="tuning.lockTrip"></span> locks the lid, so it is poured rather than sipped.</p>';
  }
};

/* ---- drink detail (pushed) ----------------------------------------- */
SCREENS.detail = {
  tabs:false,
  full:true,
  render(){
    const d = selected();
    const mode = derive.drinkMode(d);
    return '' +
    pageHead(d.name, 'Target ' + fmtTemp(d.temp), true) +
    drinkShot(d, 'hero') +

    '<div class="detailbar">' +
      '<span class="detailbar__temp">' + fmtTemp(d.temp) + '</span>' +
      modeTag(mode) +
      '<span class="detailbar__note">' + mode.note + '</span>' +
    '</div>' +

    block('How to make', d.howToMake) +
    block('Goes well with', d.goesWellWith) +

    '<div class="cta">' + detailButton(d) + '</div>' +
    '<p class="note" data-live="note.detail"></p>';
  }
};

/* ---- heating (pushed) ---------------------------------------------- */
SCREENS.heat = {
  tabs:false,
  full:true,
  render(){
    const d = selected();
    return '' +
    pageHead(d.name, 'Target ' + fmtTemp(d.temp), true) +

    '<div class="ringwrap">' +
      ring({
        key:'cycle',
        inner:'<div class="ring__big" data-live="temp.current" data-hot></div>' +
              '<div class="ring__sub" data-live="cycle.sub"></div>'
      }) +
    '</div>' +

    '<div class="readout__status readout__status--mid" data-live="status.line"></div>' +

    '<div class="grid3">' +
      statTile({ label:'Target',  live:'temp.target',  sub:d.name }) +
      statTile({ label:'Left',    live:'eta',          subLive:'cycle.rate' }) +
      statTile({ label:'Battery', live:'battery.pct',  subLive:'battery.cost' }) +
    '</div>' +

    '<div class="lockline lockline--mid" data-mode>' +
      modeTag(derive.mode(), true) +
      '<span data-live="mode.note"></span>' +
    '</div>' +

    '<div class="cta">' + primaryButton() + '</div>' +
    '<p class="note" data-live="note.heat"></p>';
  }
};

/* ---- hydrate ------------------------------------------------------- */
SCREENS.hydrate = {
  tabs:true,
  render(){
    const d = selected();
    return '' +
    pageHead(CONFIG.copy.hydrate.title, CONFIG.copy.hydrate.sub) +

    '<div class="card card--center">' +
      ring({
        key:'hydration',
        inner:'<div class="ring__big" data-live="hydration.today"></div>' +
              '<div class="ring__sub" data-live="hydration.of"></div>'
      }) +
      '<p class="card__note" data-live="hydration.verdict"></p>' +
    '</div>' +

    '<div class="sectitle">Log a pour</div>' +
    '<div class="grid3">' +
      CONFIG.pourPresets.map(ml =>
        '<button class="stat stat--action" data-act="addWater" data-arg="' + ml + '">' +
          '<span class="stat__v">+' + ml + '</span><span class="stat__s">ml</span>' +
        '</button>'
      ).join('') +
    '</div>' +

    '<button class="row" data-act="logSip">' +
      drinkShot(d, 'thumb') +
      '<span class="row__body"><b>Pour ' + d.name + '</b><small data-live="flask.left"></small></span>' +
      '<span class="row__meta">' + derive.servingMl() + '<small>ml</small></span>' +
    '</button>' +

    '<button class="row" data-act="refill">' +
      '<span class="row__body"><b>Refill the flask</b>' +
        '<small>Fresh water lands at ' + fmtTemp(TUNING.refillTemp) + '</small></span>' +
      '<span class="row__meta">' + state.capacityMl + '<small>ml</small></span>' +
    '</button>' +

    '<div class="sectitle">Today’s log<span data-live="recent.total"></span></div>' +
    (state.recentDrinks.length
      ? state.recentDrinks.map(logRow).join('')
      : '<div class="empty">Nothing logged yet.</div>');
  }
};

/* ---- purify -------------------------------------------------------- */
SCREENS.uv = {
  tabs:true,
  render(){
    return '' +
    pageHead(CONFIG.copy.uv.title, CONFIG.copy.uv.sub) +

    '<div class="card card--center" data-uvcard>' +
      ring({
        key:'uv',
        inner:'<div class="ring__big" data-live="uv.big"></div>' +
              '<div class="ring__sub" data-live="uv.small"></div>'
      }) +
      '<p class="card__note" data-live="uv.verdict"></p>' +
      '<div class="cta">' +
        '<button class="btn btn--primary btn--wide" data-act="runUv"' +
          (state.status === 'purifying' ? ' disabled' : '') + '>' +
          '<span data-live="uv.button"></span></button>' +
      '</div>' +
    '</div>' +

    '<div class="grid2">' +
      statTile({ label:'Lifetime', live:'uv.cycles', sub:'cycles run' }) +
      statTile({ label:'Lamp',     live:'uv.lamp',   subLive:'uv.lampSub' }) +
    '</div>' +

    '<div class="sectitle">Certification</div>' +
    '<div class="row row--static">' +
      '<span class="row__body"><b data-live="uv.last"></b>' +
        '<small>Water stays certified for ' + TUNING.uvFreshFor / 60 + ' hours</small></span>' +
    '</div>' +
    '<div class="row row--static">' +
      '<span class="row__body"><b data-live="uv.cost"></b>' +
        '<small>Draw per cycle, measured at the cell</small></span>' +
    '</div>' +

    '<p class="note" data-live="note.uv"></p>';
  }
};

/* ---- stats --------------------------------------------------------- */
SCREENS.stats = {
  tabs:true,
  render(){
    const max = Math.max(state.hydrationGoal * CONFIG.chartHeadroom, ...state.history.map(derive.dayMl));
    const fav = derive.favourite();
    return '' +
    pageHead(CONFIG.copy.stats.title, CONFIG.copy.stats.sub) +

    '<div class="card">' +
      '<div class="card__head">' +
        '<span class="card__title">Millilitres per day</span>' +
        '<span class="card__title card__title--hi" data-live="stats.today"></span>' +
      '</div>' +
      '<div class="chart">' +
        '<div class="chart__goal" style="bottom:' + (state.hydrationGoal / max * 100) + '%">' +
          '<span>Goal ' + state.hydrationGoal + ' ml</span></div>' +
        '<div class="chart__bars">' +
          state.history.map(row => {
            const ml = derive.dayMl(row);
            const h = clamp(ml / max, 0, 1) * 100;
            return '<div class="bar' + (row.today ? ' is-today' : '') + '">' +
              '<span class="bar__fill" style="height:' + h + '%"></span></div>';
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
      statTile({ label:'Daily avg',   live:'stats.avgMl', sub:'ml across the week' }) +
      statTile({ label:'Streak',      live:'stats.streak', sub:'days at goal' }) +
      statTile({ label:'Heat cycles', value:String(sum(state.history.map(r => r.cycles))), sub:'this week' }) +
      statTile({ label:'UV-C',        live:'uv.cycles',   sub:'lifetime cycles' }) +
    '</div>' +

    (fav
      ? '<div class="sectitle">Most poured</div>' +
        '<div class="row row--static">' +
          drinkShot(fav.drink, 'thumb') +
          '<span class="row__body"><b>' + fav.drink.name + '</b><small>' + fav.drink.goesWellWith + '</small></span>' +
          '<span class="row__meta">' + fav.ml + '<small>ml logged</small></span>' +
        '</div>'
      : '') +

    '<div class="sectitle">Full log<span data-live="recent.total"></span></div>' +
    (state.recentDrinks.length
      ? state.recentDrinks.map(logRow).join('')
      : '<div class="empty">The log is empty.</div>');
  }
};

/* ---- device (pushed) ----------------------------------------------- */
SCREENS.device = {
  tabs:false,
  full:true,
  render(){
    return '' +
    pageHead(CONFIG.copy.device.title, CONFIG.copy.device.sub + CONFIG.device.link, true) +

    '<div class="card">' +
      '<div class="card__head"><span class="card__title">Battery</span>' +
        '<span class="card__title" data-live="battery.pct"></span></div>' +
      '<div class="meter"><span class="meter__fill" data-fill="battery"></span></div>' +
      '<p class="card__note" data-live="battery.detail"></p>' +
    '</div>' +

    '<div class="card">' +
      '<div class="card__head"><span class="card__title">Units</span></div>' +
      '<div class="seg">' +
        ['F', 'C'].map(u =>
          '<button class="' + (state.unit === u ? 'is-on' : '') + '" data-act="setUnit" data-arg="' + u + '">' +
            'Degrees ' + u + '</button>'
        ).join('') +
      '</div>' +
      '<p class="card__note" data-live="unit.detail"></p>' +
    '</div>' +

    '<div class="card">' +
      '<div class="card__head"><span class="card__title">Thresholds</span></div>' +
      '<div class="kv">' +
        '<div><dt>Lid lock trips at</dt><dd data-live="tuning.lockTrip"></dd></div>' +
        '<div><dt>Room temperature</dt><dd data-live="tuning.ambient"></dd></div>' +
        '<div><dt>Coil rate</dt><dd data-live="cycle.rate"></dd></div>' +
        '<div><dt>Drift when idle</dt><dd data-live="tuning.drift"></dd></div>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="card__head"><span class="card__title">Hardware</span></div>' +
      '<div class="kv">' +
        '<div><dt>Capacity</dt><dd>' + state.capacityMl + ' ml</dd></div>' +
        '<div><dt>In the flask</dt><dd data-live="flask.volume"></dd></div>' +
        '<div><dt>Firmware</dt><dd>' + CONFIG.device.firmware + '</dd></div>' +
        '<div><dt>Serial</dt><dd>' + CONFIG.device.serial + '</dd></div>' +
      '</div>' +
    '</div>' +

    '<button class="btn btn--ghost btn--wide" data-act="reset">Reset the prototype</button>' +
    '<p class="note">Every figure above is read from the same <code>state</code> object the ' +
      'rest of the app renders from.</p>';
  }
};

const TABS = [
  { id:'home',    label:'Flask' },
  { id:'drinks',  label:'Drinks' },
  { id:'hydrate', label:'Hydrate' },
  { id:'uv',      label:'Purify' },
  { id:'stats',   label:'Stats' }
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

  'mode.tag':  () => derive.mode().tag,
  'mode.note': () => derive.mode().note,

  'cycle.sub': () => {
    if (derive.phase() === 'heating')
      return Math.round(derive.cycleProgress() * 100) + '% to ' + fmtTemp(state.targetTemp);
    if (derive.phase() === 'ready') return 'at target';
    if (derive.settling()) return 'above ' + fmtTemp(state.targetTemp);
    return 'target ' + fmtTemp(state.targetTemp);
  },
  'cycle.rate': () => fmtRate(),

  'battery.pct': () => Math.round(state.battery) + '%',
  'battery.cost': () => '-' + (Math.max(0, derive.delta()) * TUNING.battPerDegree).toFixed(1) + '% this run',
  'battery.detail': () => 'About ' + derive.batteryCycles() + ' more heat-ups to ' +
    fmtTemp(state.targetTemp) + ', or ' + Math.floor(state.battery / TUNING.battPerUv) + ' UV-C cycles.',

  'device.line': () => CONFIG.device.kind + ' · ' + (derive.uvFresh() ? 'water certified' : 'purify due'),

  'hydration.pct':  () => Math.round(derive.hydrationPct() * 100) + '%',
  'hydration.left': () => derive.hydrationLeft() > 0 ? derive.hydrationLeft() + ' ml to go' : 'goal met',
  'hydration.today':() => String(Math.round(state.hydrationToday)),
  'hydration.of':   () => 'of ' + state.hydrationGoal + ' ml',
  'hydration.verdict': () => {
    const left = derive.hydrationLeft();
    if (left <= 0) return 'Goal cleared — ' + fmtL(state.hydrationToday) + ' logged today.';
    const pours = Math.ceil(left / TUNING.serving);
    return left + ' ml to go — about ' + pours + (pours === 1 ? ' more pour' : ' more pours') + '.';
  },

  'flask.left': () => Math.round(state.volumeMl) + ' ml left · ' +
    Math.floor(state.volumeMl / TUNING.serving) + ' more pours this size',
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

  'tuning.lockTrip': () => fmtTemp(TUNING.lockTrip),
  'tuning.ambient':  () => fmtTemp(TUNING.ambient),
  'tuning.drift':    () => (state.unit === 'C' ? TUNING.driftRate * 5 / 9 : TUNING.driftRate).toFixed(1) + '°/min',
  'unit.detail': () => 'Targets are stored in Fahrenheit and converted on the way out, so ' +
    selected().name + ' reads ' + fmtTemp(selected().temp) + '.',

  'note.home': () => 'The lid trips at ' + fmtTemp(TUNING.lockTrip) + '. The flask is at ' +
    fmtTemp(state.currentTemp) + ', so it reads ' + derive.mode().tag + '.',
  'note.detail': () => selected().name + ' holds at ' + fmtTemp(selected().temp) + ', which is ' +
    (derive.drinkMode(selected()).locked ? 'above' : 'below') + ' the ' +
    fmtTemp(TUNING.lockTrip) + ' lid lock.',
  'note.heat': () => 'The coil moves ' + fmtRate() + '. This run costs about ' +
    (Math.max(0, derive.delta()) * TUNING.battPerDegree).toFixed(1) + '% of the cell.',
  'note.uv': () => 'One cycle burns ' + TUNING.uvMinutesPerCycle + ' minutes of lamp life and keeps ' +
    'the water certified for ' + TUNING.uvFreshFor / 60 + ' hours.',

  /* raw stored values, for the inspector beside the phone */
  'raw.currentTemp': () => String(Math.round(state.currentTemp * 10) / 10),
  'raw.targetTemp':  () => String(state.targetTemp),
  'raw.selectedDrink': () => state.selectedDrink,
  'raw.status':      () => state.status,
  'raw.battery':     () => String(Math.round(state.battery * 10) / 10),
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

/* Numbers that should glide to a new value rather than jump to it. The
   displayed figure is kept here rather than on the node, so it survives a
   redraw and carries on from where it was. */
const TWEENS = {
  'temp.current':    { get: () => state.currentTemp,    fmt: (n) => fmtTemp(n) },
  'hydration.today': { get: () => state.hydrationToday, fmt: (n) => String(Math.round(n)) }
};
const tweenAt = {};
let tweenRaf = null;

function scheduleTween(){
  if (tweenRaf !== null) return;
  tweenRaf = requestAnimationFrame(() => { tweenRaf = null; paint(); });
}

/* paint() runs on every animation frame, so the node lookups are done once
   per redraw instead of once per frame */
function rebind(){
  runtime.bind = {
    live:   $$('[data-live]'),
    rings:  $$('[data-ring]'),
    hot:    $$('[data-hot]'),
    mode:   $$('[data-mode]'),
    tags:   $$('.tag[data-mode]'),
    led:    $$('[data-led]'),
    batt:   $$('[data-fill="battery"]'),
    uvcard: $$('[data-uvcard]'),
    tabs:   $$('[data-tab]')
  };
}

function paint(){
  if (!runtime.bind) rebind();
  const b = runtime.bind;
  let moving = false;

  b.live.forEach(node => {
    const key = node.getAttribute('data-live');
    const tween = TWEENS[key];

    if (tween){
      const target = tween.get();
      let at = tweenAt[key];
      if (at === undefined || Math.abs(target - at) < 0.4) at = target;
      else { at += (target - at) * CONFIG.motion.tween; moving = true; }
      tweenAt[key] = at;
      const shown = tween.fmt(at);
      if (node.textContent !== shown) node.textContent = shown;
      return;
    }

    const fn = LIVE[key];
    if (!fn) return;
    const value = fn();
    if (node.textContent !== value) node.textContent = value;
  });

  b.rings.forEach(node => {
    const fn = RINGS[node.getAttribute('data-ring')];
    if (fn) node.style.setProperty('--pct', clamp(fn(), 0, 1).toFixed(4));
  });

  /* red is a signal: the readout turns red only once the lid has locked */
  const hot = state.currentTemp >= TUNING.lockTrip;
  b.hot.forEach(node => node.classList.toggle('is-hot', hot));
  b.mode.forEach(node => node.classList.toggle('is-locked', hot));
  b.tags.forEach(node => node.classList.toggle('tag--locked', hot));

  const led = derive.led();
  b.led.forEach(node => {
    node.classList.toggle('is-on', led !== 'off');
    node.classList.toggle('is-pulsing', led === 'pulsing');
  });

  b.batt.forEach(node => { node.style.width = clamp(state.battery, 0, 100) + '%'; });

  b.uvcard.forEach(node =>
    node.classList.toggle('is-purifying', state.status === 'purifying'));

  b.tabs.forEach(node =>
    node.classList.toggle('is-active', node.getAttribute('data-tab') === runtime.screen));

  if (moving) scheduleTween();
}

/* ---------------------------------------------------------------------
   10 · ROUTER — 250ms slide, matching --slide in style.css
   --------------------------------------------------------------------- */

const TAB_ORDER = TABS.map(t => t.id);
const SLIDE_MS = CONFIG.motion.slide;

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
  rebind();
  paint();

  void entering.offsetWidth;            /* commit the start position */
  runtime.busy = true;

  entering.classList.add('is-sliding', 'is-entering');
  entering.classList.remove('from-right', 'from-left');
  entering.classList.add('at-rest');
  if (leaving) leaving.classList.add('is-sliding', dir > 0 ? 'to-left' : 'to-right');

  setTimeout(() => {
    if (leaving) leaving.remove();
    entering.classList.remove('is-sliding', 'is-entering');
    runtime.busy = false;
    rebind();
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
  rebind();
  paint();
}

function toast(message){
  const el = $('.toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-up');
  clearTimeout(runtime.toastTimer);
  runtime.toastTimer = setTimeout(() => el.classList.remove('is-up'), CONFIG.motion.toast);
}

/* ---------------------------------------------------------------------
   11 · ACTIONS
   Every tap in the app lands here. Each one edits `state` and nothing
   else — the screens catch up on their own.
   --------------------------------------------------------------------- */

function pour(ml){
  const amount = Math.min(ml, Math.round(state.volumeMl));
  if (amount < TUNING.minPour){ toast('Flask is empty — refill it'); return; }
  state.volumeMl = Math.max(0, state.volumeMl - amount);
  state.hydrationToday += amount;
  state.recentDrinks.unshift({
    drink: state.selectedDrink,
    ml: amount,
    minutesAgo: 0,
    temp: Math.round(state.currentTemp)
  });
  if (state.recentDrinks.length > CONFIG.logLimit) state.recentDrinks.length = CONFIG.logLimit;
  render();
  toast('Poured ' + fmtMl(amount) + ' · ' + derive.mode().tag);
}

function beginHeat(){
  const delta = derive.delta();
  if (delta > TUNING.readyBand){
    runtime.cycleFrom = state.currentTemp;
    state.status = 'heating';
    startLoop();
    return true;
  }
  if (Math.abs(delta) <= TUNING.readyBand){
    state.status = 'ready';
    render();
    toast('Already at ' + fmtTemp(state.targetTemp));
    return false;
  }
  /* above the target: the coil cannot bring it down, so say so plainly */
  state.status = 'idle';
  render();
  toast('Above ' + fmtTemp(state.targetTemp) + ' — it settles on its own');
  return false;
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
  openDrink(id){
    const d = drinkById(id);
    state.selectedDrink = d.id;
    state.targetTemp = d.temp;
    push('detail');
  },

  heatSelected(){
    if (beginHeat()){
      push('heat');
      toast(selected().name + ' · heating to ' + fmtTemp(state.targetTemp));
    }
  },

  startCycle(){ if (beginHeat()) render(); },

  stopCycle(){
    state.status = derive.delta() <= TUNING.readyBand ? 'ready' : 'idle';
    runtime.cycleFrom = null;
    render();
    toast('Cycle stopped at ' + fmtTemp(state.currentTemp));
  },

  logSip(){ pour(derive.servingMl()); },

  addWater(ml){ pour(parseInt(ml, 10)); },

  refill(){
    state.volumeMl = state.capacityMl;
    state.currentTemp = TUNING.refillTemp;
    state.status = derive.delta() <= TUNING.readyBand ? 'ready' : 'idle';
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
   The coil only ever climbs. Heat loss is passive and lives in slowTick.
   --------------------------------------------------------------------- */

function startLoop(){
  if (runtime.raf !== null) return;
  runtime.lastTs = performance.now();
  runtime.raf = requestAnimationFrame(loop);
}

function loop(ts){
  const dt = Math.min(CONFIG.motion.maxFrame, (ts - runtime.lastTs) / 1000);
  runtime.lastTs = ts;
  let running = false;

  if (state.status === 'heating'){
    const delta = derive.delta();
    const step = TUNING.coilRate * dt;
    state.battery = clamp(state.battery - step * TUNING.battPerDegree, 0, 100);
    if (delta <= step){
      state.currentTemp = state.targetTemp;
      finishCycle();
    } else {
      state.currentTemp += step;
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
  toast(selected().name + ' is at ' + fmtTemp(state.targetTemp) + ' · ' + derive.mode().tag);
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
  if (runtime.minuteAcc >= CONFIG.clock.ticksPerMinute){
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
    '<span class="statusbar__right"><span data-live="battery.pct"></span></span>' +
  '</div>';
}

function tabBar(){
  return '<nav class="tabbar">' +
    TABS.map(t =>
      '<button class="tab" data-tab="' + t.id + '" data-act="go" data-arg="' + t.id + '">' +
        t.label +
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
    '<div class="panel__title">' + CONFIG.brand + '</div>' +
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
      '<li>Watch the tag flip from POUR to SIP as the flask drops under the lid lock.</li>' +
      '<li>Honey lemon is the only drink that stays under the lock.</li>' +
      '<li>Pour until the flask runs dry, then refill it.</li>' +
      '<li>Switch to <code>°C</code> on the flask screen — every number follows.</li>' +
    '</ul>' +
  '</div>' +

  '<div class="panel__block">' +
    '<h4>pictures</h4>' +
    '<p class="panel__lede">Every picture slot is an <code>&lt;img&gt;</code> pointing at ' +
      '<code>images/</code>. With the folder empty each one shows its own label instead. ' +
      'Drop in <code>bottle.png</code> and <code>drinks/&lt;id&gt;.jpg</code> and they appear ' +
      'with no code change.</p>' +
  '</div>' +

  '<div class="panel__block">' +
    '<h4>how it is wired</h4>' +
    '<p class="panel__lede">Nothing is written into the HTML. ' +
      'Every screen is rendered from one <code>state</code> object and one ' +
      '<code>DRINKS</code> array at the top of <code>script.js</code>. ' +
      'Change a number there and it changes everywhere at once.</p>' +
  '</div>';
}

/* CONFIG is the only place these are written down; CSS reads them here */
function applyShell(){
  const ph = CONFIG.phone;
  const root = document.documentElement.style;
  root.setProperty('--ph-w', ph.width + 'px');
  root.setProperty('--ph-h', ph.height + 'px');
  root.setProperty('--ph-bezel', ph.bezel + 'px');
  root.setProperty('--panel-w', ph.panelWidth + 'px');
  root.setProperty('--panel-gap', ph.panelGap + 'px');
  root.setProperty('--slide', CONFIG.motion.slide + 'ms');
}

function fitPhone(){
  const ph = CONFIG.phone;
  const frameW = ph.width + ph.bezel * 2;
  const frameH = ph.height + ph.bezel * 2;
  const beside = window.innerWidth > ph.panelBreakpoint ? ph.panelWidth + ph.panelGap : 0;
  const scale = Math.min(
    1,
    (window.innerHeight - ph.margin) / frameH,
    (window.innerWidth - beside - ph.gutter) / frameW
  );
  $('#phone').style.setProperty('--scale', Math.max(ph.minScale, scale).toFixed(3));
  document.body.classList.toggle('is-narrow', window.innerWidth <= ph.panelBreakpoint);
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
  rebind();

  document.addEventListener('click', (event) => {
    const hit = event.target.closest ? event.target.closest('[data-act]') : null;
    if (!hit || hit.disabled) return;
    const action = ACTIONS[hit.getAttribute('data-act')];
    if (action) action(hit.getAttribute('data-arg'));
  });

  window.addEventListener('resize', fitPhone);

  applyShell();
  fitPhone();
  chrome();
  paint();
  setInterval(slowTick, CONFIG.clock.tickMs);

  /* handy while demoing: `state.hydrationGoal = 3000; PULSE.render()` */
  window.PULSE = { state, DRINKS, TUNING, CONFIG, derive, render, paint, navigate, applyShell, fitPhone };
}

document.addEventListener('DOMContentLoaded', boot);
