# Pulse-flask-app
It's an app for pulse flask bottle

## Companion app prototype

A clickable phone mockup of the companion app for the PULSE vacuum flask:
a smart flask that heats or chills a drink to a per-drink target temperature,
purifies its own water with a UV-C lamp, and logs what you drink.

### Running it

Open `index.html` in a browser. There is no build step, no package manager and
no backend — plain HTML, CSS and vanilla JavaScript, three files:

| File | What it holds |
| --- | --- |
| `index.html` | An empty shell. No copy, no numbers, no drink names. |
| `style.css` | Phone frame, screens, rings, transitions. |
| `script.js` | The state, the drinks, and every screen. |
| `images/` | Your photographs. Empty in the repo. |

### Photographs

Nothing in the app is drawn. Every picture is an `<img>` pointing into
`images/`, and the folder ships empty:

| Drop in | Shows up as |
| --- | --- |
| `images/bottle.png` | The flask on the home screen, 3:4, 180px wide |
| `images/drinks/<id>.jpg` | That drink's card (56px square) and detail hero (3:2) |

The filename comes from the drink's `id`, so adding a drink to `DRINKS`
looks for its photo with no other edit. Until a file exists its slot keeps
the exact same box and shows a hairline border with its own label instead —
no broken-image icon and no layout shift. Add the file and it simply
appears.

The app draws inside a 390 × 844 phone frame centred on the page, with a live
state inspector beside it on wide screens.

### One state object

Everything on screen is rendered from two blocks at the top of `script.js`:
a `DRINKS` array and a single `state` object.

```js
state = { currentTemp, targetTemp, selectedDrink, status, battery,
          hydrationToday, hydrationGoal, volumeMl, capacityMl,
          recentDrinks, history, uvCycles, lastUvMinutesAgo, unit }
```

Change a number there and it changes on every screen at once — no other edits.
Set `hydrationGoal` to 3600 and the ring, the remaining-millilitres copy, the
goal line on the chart and the streak all move together.

Values are computed rather than written down:

- Tapping a drink copies that drink's `temp` into `targetTemp`, so the heating
  screen climbs to **that** target and no other.
- The **SIP / POUR** mode is a comparison against `TUNING.lockTrip`, not a
  label. At or above it the lid is mechanically locked and the flask can only
  be poured out; below it the lid opens and you drink straight from it. Every
  drink carries the same computed tag, and the live one flips on its own as
  the flask crosses the threshold.
- The battery drains per degree climbed. The chart's last bar is
  `hydrationToday`. The LED ring reads `status` and `currentTemp`.

The flask only heats. Every target sits above room temperature, the coil only
ever climbs, and a flask left alone drifts back down toward room temperature
on its own. `TUNING` holds the thresholds the app reasons with — the lid lock,
room temperature, coil rate, UV cycle length and lamp life. The coil rate is
accelerated so a cycle is watchable in a few seconds.

### Palette

Six values, and red is a signal rather than a surface — it is the LED ring,
the active tab, and the temperature readout once the lid has locked.

| | |
| --- | --- |
| `#212529` | app background |
| `#343a40` | cards, borders |
| `#6c757d` | secondary text |
| `#dee2e6` | primary text |
| `#f8f9fa` | emphasis text |
| `#d62828` | LED ring, active state, hot indicator |

### Screens

Flask (home), Drinks, a drink detail screen carrying how to make it and what
it goes with, Heating, Hydration, UV-C Purify, Stats, and a device screen with
a °F/°C toggle. Tapping slides between them in 250 ms.
