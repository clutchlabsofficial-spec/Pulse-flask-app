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
  screen climbs to **that** target. Pick the iced one from a hot flask and it
  chills instead of heating.
- The **SIP / POUR** tag is a comparison against `TUNING.sipMax`, not a label.
  It flips on its own as the temperature crosses the threshold.
- The liquid colour, the steam and the frost come from `currentTemp`.
  The battery drains per degree moved. The chart's last bar is `hydrationToday`.

`TUNING` holds the thresholds the app reasons with — the sip limit, room
temperature, coil rate, UV cycle length and lamp life. Heating and chilling
rates are accelerated so a cycle is watchable in a few seconds.

### Screens

Flask (home), Drinks, Heating, Hydration, UV-C Purify, Stats, and a device
screen with a °F/°C toggle. Tapping slides between them in 250 ms.
