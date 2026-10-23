# Limonade — Implementation Architecture

This document describes how to build the game in `specifications.md`. It covers the technical stack, the modules and their responsibilities, the data model, the simulation algorithms, the rendering approach with three.js, the kid‑friendly French interface, and the plan for building it.

---

## 1. Guiding principles

1. **The simulation core is separate from the display.** All game rules live in a pure TypeScript module (`core/`) with no DOM, no three.js, and no randomness it does not control. The 3D scene and the UI only *read* the state and *send* player actions.
2. **The whole simulation is deterministic.** Every random draw comes from a seeded random generator, so the same seed and the same decisions always give the same game. This makes testing, debugging, and balance tuning possible.
3. **Each day is simulated first, then animated.** When the stand opens, the core computes the full day as a list of timed events. The scene then replays those events as an animation. Rules and visuals can never disagree, and the player can skip the animation.
4. **All balance values come from configuration.** Numbers that affect balance are never written into the code. They are read from `config/game-config.json` and validated when the game starts (spec §10).
5. **The game is built for a 10‑year‑old.** It uses big buttons, icons before words, short French sentences, one decision per screen, and no typing. Steppers and sliders replace text fields.
6. **All player‑facing text is in French.** Strings are kept in a single dictionary, and numbers and money are formatted with `Intl` using the `fr-CA` locale. The currency is the **Canadian dollar (CAD)**, shown as `1,50 $`; temperatures are shown as `28 °C`.
7. **Profit is a core part of the game.** Each day, the game computes the real profit (« Bénéfice ») from the cost of the supplies actually used or lost, and shows it next to the change in cash. The game teaches the difference between the two.
8. **It is a static website with no backend.** It is built as plain files and served by **GitHub Pages** (§13). It makes no network calls once loaded.

---

## 2. Technical stack

| Concern | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) | Typed state and config, safer refactoring |
| Build / dev server | Vite | Fast, minimal setup, native TS, easy static deploy |
| 3D graphics | three.js | Requested; lightweight and well documented |
| UI layer | Plain DOM + CSS laid over the canvas (no framework) | Forms, steppers, and reports are easier to build in HTML than in WebGL, and the UI is small |
| Config validation | `zod` | Clear, readable error messages for invalid config (spec §10) |
| Tests | Vitest | Same toolchain as Vite; fast unit tests for the core |
| Lint / format | ESLint + Prettier | Consistency |
| Persistence | `localStorage` (optional autosave) | No backend needed |
| Hosting | GitHub Pages, deployed by GitHub Actions | Free static hosting next to the repository |

The game is a static single‑page web app with no server. All 3D models are built in code from three.js primitives, so there are no external model files to load. three.js and the fonts are bundled with the game rather than loaded from a CDN.

---

## 3. Project layout

```
limonade/
├─ index.html
├─ package.json / tsconfig.json / vite.config.ts   # vite base = '/limonade/'
├─ .github/workflows/
│  ├─ ci.yml                    # lint + test + build on every push / PR
│  └─ deploy.yml                # build + publish to GitHub Pages from main
├─ docs/epics/                  # epics planned separately (e.g. sound)
├─ public/
│  └─ fonts/                    # rounded, kid-friendly font (e.g. Baloo 2 / Fredoka)
├─ config/
│  └─ game-config.json          # all balance values (spec §10)
├─ src/
│  ├─ main.ts                   # bootstrap: load config → validate → start App
│  ├─ app/
│  │  ├─ App.ts                 # wires core ↔ UI ↔ scene, owns the screen flow
│  │  ├─ store.ts               # tiny observable store holding GameState
│  │  ├─ events.ts              # typed event bus (scene and sound listen to it)
│  │  └─ DayPlayer.ts           # replays the simulated day's events over ~30 s
│  ├─ config/
│  │  ├─ schema.ts              # zod schema + cross-field checks
│  │  └─ loadConfig.ts          # parse, validate, convert dollars → cents
│  ├─ core/                     # PURE simulation: no DOM, no three.js
│  │  ├─ types.ts               # GameState, DayRecord, events…
│  │  ├─ rng.ts                 # seeded PRNG (mulberry32) + helpers
│  │  ├─ weather.ts             # actual weather + forecast generation
│  │  ├─ market.ts              # dynamic supply prices + market events
│  │  ├─ inventory.ts           # stock with lemon batches (age, cost)
│  │  ├─ recipe.ts              # taste / quality score
│  │  ├─ preparation.ts         # pitchers → servings, shortage checks
│  │  ├─ demand.ts              # visitors and buying decisions
│  │  ├─ daySimulation.ts       # runs one selling day → DayResult + events
│  │  ├─ endOfDay.ts            # ice melt, lemonade discard, lemon spoilage
│  │  ├─ feedback.ts            # feedback codes (price / taste / stock)
│  │  ├─ accounting.ts          # cost of goods used, waste cost, profit
│  │  ├─ endConditions.ts       # last day reached or game impossible to continue
│  │  ├─ actions.ts             # buySupplies, setPlan, openStand, nextDay…
│  │  └─ game.ts                # createGame(config, seed), phase state machine
│  ├─ i18n/
│  │  ├─ fr.ts                  # every French string, keyed
│  │  └─ format.ts              # money, °C, percent, plurals (fr-CA)
│  ├─ scene/                    # three.js only; reads state, plays events
│  │  ├─ SceneManager.ts        # renderer, camera, resize, render loop
│  │  ├─ palette.ts             # shared colors / toon materials
│  │  ├─ World.ts               # ground, street, trees, house backdrop
│  │  ├─ Stand.ts               # stand, sign, pitcher (fill level), cup stack
│  │  ├─ SkyAndWeather.ts       # sky color, sun, clouds, rain, time of day
│  │  ├─ Customers.ts           # pooled low-poly characters + walk paths
│  │  ├─ Bubbles.ts             # emoji reaction bubbles above customers
│  │  ├─ (DayPlayer lives in app/: the scene and the HUD both follow its timeline)
│  │  └─ tween.ts               # small easing / tween helper
│  ├─ ui/
│  │  ├─ components/            # Button, Stepper, Slider, Card, Gauge, Modal, Mascot
│  │  ├─ hud/TopBar.ts          # Jour X/Y · Caisse · mini inventory (always visible)
│  │  └─ screens/
│  │     ├─ AccueilScreen.ts        # title, how to play, new game
│  │     ├─ MeteoScreen.ts          # forecast + expected traffic
│  │     ├─ MagasinScreen.ts        # shop: prices, trends, cart
│  │     ├─ RecetteScreen.ts        # recipe sliders, pitchers, selling price
│  │     ├─ JourneeScreen.ts        # live day: progress, sales, skip button
│  │     ├─ BilanScreen.ts          # end-of-day report + waste + feedback
│  │     ├─ HistoriqueScreen.ts     # per-day table + price history
│  │     ├─ FinScreen.ts            # final results, score, replay
│  │     └─ ErreurConfigScreen.ts   # readable config error
│  └─ styles/
│     └─ main.css
├─ tests/
│  ├─ core/*.test.ts
│  └─ config/*.test.ts
└─ tools/
   └─ balance-sim.ts            # headless bots playing N games to tune config
```

The `core/` folder must never import from `scene/`, `ui/`, or `app/`. ESLint enforces this with `import/no-restricted-paths`.

---

## 4. High-level data flow

```
            ┌───────────────┐   actions    ┌──────────────────────┐
  Player ──▶│      UI       │─────────────▶│  core (pure funcs)   │
            │ (DOM screens) │              │  state' = f(state,a) │
            └──────▲────────┘              └──────────┬───────────┘
                   │ subscribe                         │ new GameState
                   │                                   ▼
            ┌──────┴────────┐               ┌──────────────────────┐
            │     store     │◀──────────────│         App          │
            └──────┬────────┘               └──────────┬───────────┘
                   │ subscribe                         │ DayEvents (on open)
                   ▼                                   ▼
            ┌───────────────┐               ┌──────────────────────┐
            │  three.js     │◀──────────────│     DayPlayer        │
            │  scene        │  play events  │ (timeline, skip)     │
            └───────────────┘               └──────────────────────┘
```

- **Actions** are pure functions `(state, payload) → Result<GameState, ActionError>`. Invalid actions, such as buying more than you can afford or opening with no lemonade, return a typed error code. The UI turns that code into a French message.
- **The store** keeps the current `GameState` and notifies subscribers. Copying state is cheap because the state is small and serializable.
- **DayPlayer** takes the `DayEvent[]` produced by `openStand` and plays it back over about 30–45 seconds. It updates the scene and the HUD's live counters. "Passer ⏩" jumps to the end.

---

## 5. Game state machine

```
ACCUEIL ──nouvelle partie──▶ METEO ──▶ MAGASIN ──▶ RECETTE ──ouvrir──▶ JOURNEE ──▶ BILAN
   ▲                           ▲                                                 │
   │                           └──────────── jour suivant ───────────────────────┤
   │                                                                             ▼
   └─────────────────────────── rejouer ◀─────────────────────────────────── FIN
```

| Phase | Allowed actions | Notes |
| --- | --- | --- |
| `ACCUEIL` | `newGame(seed?)` | Short instructions from the mascot |
| `METEO` | `goTo(MAGASIN)` | Forecast stays pinned in the HUD for all later planning screens (spec §2) |
| `MAGASIN` | `buySupplies(cart)`, `goTo(RECETTE)`, `goTo(METEO)` | Many purchases are allowed; each is checked against cash |
| `RECETTE` | `setRecipe`, `setPitchers`, `setPrice`, `openStand`, back to `MAGASIN` | Shows shortages; warns when cups limit sales |
| `JOURNEE` | `skipAnimation` | Decisions are locked (spec §2) |
| `BILAN` | `nextDay`, `openHistory` | `nextDay` checks end conditions |
| `FIN` | `newGame` | Explains why the game ended early, if it did |

The phase is stored in `GameState.phase`, so a saved game resumes on the correct screen.

---

## 6. Core data model (`core/types.ts`)

Money is stored as **integer cents** everywhere to avoid floating‑point errors. Config values written in dollars are converted once, at load time.

```ts
type Cents = number;
type SupplyId = 'lemons' | 'sugar' | 'ice' | 'cups';   // same ids as the config

interface GameState {
  seed: number;
  rngState: number;            // PRNG state, so the game can be saved and resumed
  phase: Phase;
  day: number;                 // 1-based
  totalDays: number;           // chosen at new game, 14..60
  cash: Cents;
  totalProfit: Cents;          // sum of DayRecord.profit
  inventory: Inventory;
  prices: Record<SupplyId, Cents>;           // today, per package
  previousPrices?: Record<SupplyId, Cents>;
  marketNews: MarketNewsCode[];              // e.g. 'RECOLTE_CITRONS', 'CANICULE_GLACE'
  forecast: Forecast;          // for the upcoming selling day
  weatherHidden: Weather;      // actual weather, never shown before closing
  plan: DayPlan;               // recipe, pitchers, price
  todaySpending: Cents;
  history: DayRecord[];
  endReason?: 'DERNIER_JOUR' | 'PLUS_POSSIBLE';
}

interface Inventory {
  lemonBatches: { qty: number; ageDays: number; unitCost: Cents }[]; // FIFO
  sugar: { qty: number; avgUnitCost: Cents };    // in sugar units (e.g. spoonfuls)
  ice:   { qty: number; avgUnitCost: Cents };    // cubes, melt at end of day
  cups:  { qty: number; avgUnitCost: Cents };
}

interface DayPlan {
  recipe: { lemons: number; sugar: number; ice: number }; // per pitcher
  pitchers: number;
  pricePerCup: Cents;
}

interface Weather {
  temperatureC: number;
  cloud: 'soleil' | 'nuageux' | 'couvert';
  rainSlots: TimeSlot[];       // subset of ['matin','midi','apres-midi','soir']
}

interface Forecast {
  temperatureC: number;        // expected value
  cloud: Weather['cloud'];
  rainChance: number;          // 0..1
  rainLikelySlot?: TimeSlot;
  trafficOutlook: 'faible' | 'moyenne' | 'forte';
}

interface DayRecord {          // one row of history (spec §8)
  day: number;
  forecast: Forecast;
  actual: Weather;
  prices: Record<SupplyId, Cents>;
  plan: DayPlan;
  potentialCustomers: number;
  cupsSold: number;
  missedSales: number;         // because lemonade or cups ran out
  revenue: Cents;
  supplySpending: Cents;
  cashChange: Cents;           // revenue − supplySpending (NOT profit)
  costOfGoodsUsed: Cents;      // cost of the servings and cups that were sold
  wasteCost: Cents;            // discarded lemonade + melted ice + spoiled lemons
  profit: Cents;               // revenue − costOfGoodsUsed − wasteCost  (« Bénéfice »)
  waste: { servingsDiscarded: number; iceMelted: number; lemonsSpoiled: number };
  feedback: FeedbackCode[];
  cashAfter: Cents;
  inventoryAfter: InventorySummary;
}
```

### Why lemons are stored in batches

Lemons spoil after a set number of days (spec §7), so each purchase is kept as a separate batch with its own age. Preparation uses the oldest lemons first (FIFO). At the end of the day every batch ages by one day, and batches at or past `spoilageDays` are thrown away and reported. Each batch also keeps its unit cost, which is what makes a true profit possible (see §7.8).

### Profit vs. cash change

Profit is a visible, central part of the game. Spec §8 forbids calling a cash change "profit", so the game shows two separate numbers:

| Label | Formula | What it teaches |
| --- | --- | --- |
| **Variation de caisse** | revenue − money spent at the shop today | "How much money is in my cash box compared with this morning?" |
| **Bénéfice** | revenue − cost of supplies used − cost of supplies lost | "Did today's selling actually earn money?" |

For example, buying 3 days of sugar on day 1 makes the cash change very negative, while the profit stays positive because only one day's sugar was used.

---

## 7. Simulation algorithms

All tunable numbers in this section come from config. The formulas are a starting shape to be balanced through playtesting (spec §11).

### 7.1 Random numbers (`rng.ts`)
- `mulberry32(seed)` returns `next(): number` in [0,1).
- Helpers: `range(a,b)`, `normal(mean, sd)` (Box–Muller), `chance(p)`, `pickWeighted`.
- The PRNG state lives in `GameState`, so saving and reloading gives the same results.

### 7.2 Weather (`weather.ts`)
- **Temperature** follows a mean‑reverting walk so that consecutive days are related:
  `T(d) = T(d−1) + persistence·(Tmean − T(d−1)) + normal(0, sd)`, clamped to `[Tmin, Tmax]`. A small chance of a **surprise** (`surpriseChance`) adds a larger jump, such as a heat wave or a cool snap.
- **Cloud cover** is a 3‑state Markov chain (`soleil / nuageux / couvert`). Its transition matrix is set in config.
- **Rain**: the base probability depends on cloud cover. If it rains, choose 1–2 consecutive time slots out of 4.
- **Forecast**: generated from the *actual* weather plus noise:
  - `forecast.T = actual.T + normal(0, forecastTempSd)`
  - `forecast.cloud` matches the actual cloud cover with probability `forecastCloudAccuracy`
  - `rainChance` is a calibrated probability, so that "40 %" really means it rains about 40 % of the time on those days. The forecaster gets a hint about rain that is right with probability `cloud_accuracy`, then reports the Bayes posterior given the forecast sky's usual rain rate
  - `trafficOutlook` comes from running the expected‑traffic formula (§7.5) on the *forecast*, then applying the config thresholds.

### 7.3 Market prices (`market.ts`)
For each supply, every day:
`p' = clamp(p · (1 + normal(drift, volatility)), min, max)`
with a separate `volatility` per supply: sugar is low, cups are very low, lemons are medium, and ice is medium.
- **Events** (chance per day, from config): `RECOLTE_CITRONS` (lemons −X %), `PENURIE_CITRONS` (+X %), `CANICULE_GLACE` (ice +X % when temperature ≥ threshold), `PROMO_GOBELETS`. Each event produces a `MarketNewsCode` that the shop shows as a short sentence.
- Prices are rounded to 5 cents and always kept within `[min, max]`, as the spec requires.

### 7.4 Recipe quality (`recipe.ts`)
Taste is scored per pitcher as `quality ∈ [0,1]`:
- `lemonScore = bell(lemons, idealLemons, widthLemons)`
- `sugarScore = bell(sugar / lemons, idealSugarRatio, widthSugar)`. Sweetness is measured relative to sourness.
- `iceScore = bell(ice, idealIce(T), widthIce)`. The ideal amount of ice increases with temperature.
- `quality = wL·lemonScore + wS·sugarScore + wI·iceScore`

Each sub‑score also records a **direction** (`TROP_ACIDE`, `PAS_ASSEZ_CITRON`, `TROP_SUCRE`, `PAS_ASSEZ_SUCRE`, `PAS_ASSEZ_FRAIS`). Feedback uses these directions, but the formula itself is never shown (spec §5).

### 7.5 Demand (`demand.ts`)
The day is split into **4 time slots × N ticks**.
- **Visitors per slot**: `baseTraffic · weatherFactor(T, cloud) · (rainy slot ? rainFactor : 1) · lognormal(0, dailyVariation)`, drawn as a Poisson count.
  - `weatherFactor` rises smoothly with temperature, with a configured bonus for sun and penalty for heavy clouds. A warm cloudy day can therefore still sell well (spec §3).
- **Each visitor buys** with probability
  `P = sigmoid(k0 + kQ·quality + kT·heat(T) − kP·(price / referencePrice(T)) + noise)`.
  `referencePrice` is a little higher on hot days. Each visitor gets an individual noise value, so some customers spend more freely than others.
- If a visitor would buy but no servings or cups are left, it counts as a **missed sale** (`MANQUE_LIMONADE` or `MANQUE_GOBELETS`).

### 7.6 Day simulation (`daySimulation.ts`)
`runDay(state) → { result: DayRecord, events: DayEvent[] }`:
1. Take ingredients for the planned pitchers (lemons FIFO) and compute the number of servings.
2. Loop over slots and ticks, generate visitors, and decide whether each buys, declines (with a reason), or is missed.
3. Emit events such as `{ t, type: 'visitor_arrive' | 'buy' | 'decline' | 'missed' | 'rain_start' | 'rain_stop' | 'sold_out', reason?, emoji? }`.
4. Apply end of day (`endOfDay.ts`): ice melts, remaining lemonade is discarded, lemons age and spoil.
5. Build the `DayRecord` and feedback codes.

### 7.7 Feedback (`feedback.ts`)
At most **3 messages** are shown, ranked by importance. They are built from counts of decline reasons and recipe directions. Examples of mapped French strings:
- `PRIX_TROP_ELEVE` → « Beaucoup de clients trouvaient ça trop cher ! »
- `TROP_ACIDE` → « Ça pique ! C'était un peu trop acide. »
- `PAS_ASSEZ_FRAIS` → « Il faisait chaud… un peu plus de glaçons ? »
- `RUPTURE` → « Plus de limonade à 15 h : des clients sont repartis déçus. »
- `GASPILLAGE` → « Tu as jeté 6 verres de limonade. »

### 7.8 Accounting (`accounting.ts`)
- **Prepared lemonade is a stock line**: preparing moves the ingredient cost (lemons FIFO, sugar and ice at average cost) into servings of lemonade.
- **Cost of goods used**: the cost of each serving sold plus each cup sold.
- **Waste cost**: lemonade discarded at closing, ice that melted unused, and lemon batches that spoiled.
- **Profit** = revenue − cost of goods used − waste cost. Sugar and cups left in stock are not counted, because they can still be used later.
- **Average unit costs** (sugar, ice, cups) are updated as a weighted average after each purchase. Lemons keep their per‑batch cost.
- The game totals `totalProfit` over the whole game. Stock bought and still owned lowers cash but not profit, so **final cash = starting cash + total profit − (stock value now − stock value at the start)**. The end screen shows this equation in kid‑friendly words.
- Tests check that the books always balance: `cashChange` summed over all days equals final cash − starting cash.

### 7.9 End conditions (`endConditions.ts`)
- `day > totalDays` gives `DERNIER_JOUR`.
- Early end gives `PLUS_POSSIBLE` when the player **cannot produce at least one sellable serving with a cup**, using current stock plus whatever cash can buy at today's prices. The check uses the minimum valid recipe and the cheapest way to complete the missing items. The end screen explains why in French.

---

## 8. Configuration (`config/game-config.json`)

The file has one section per spec §10 area. Every value has an explicit unit in its key name or in a `unit` field.

The real file is [`config/game-config.json`](config/game-config.json), and the schema in `src/config/schema.ts` is the reference for every key. It has these sections:

| Section | Contents | Units |
| --- | --- | --- |
| `game` | currency (`CAD`), locale (`fr-CA`), game length (`days.default/min/max`), starting cash and inventory | dollars, days, items |
| `supplies.lemons/sugar/ice/cups` | package quantity, starting/min/max price per package, daily volatility and drift | items per package, dollars per package, fraction per day |
| `market_events` | id, affected supply, chance per day, price multiplier, optional minimum temperature | probability 0–1, multiplier, °C |
| `spoilage` | lemon spoilage age, whether ice melts and leftover lemonade is discarded | days, booleans |
| `recipe` | servings per pitcher, min/max/default lemons, sugar and ice per pitcher, max pitchers, selling price range and step | items per pitcher, dollars per cup |
| `taste` | ideal amounts and tolerances, ideal ice at 20 °C and 35 °C, weights | items per pitcher, items per lemon, fractions summing to 1 |
| `weather` | temperature mean/min/max/persistence/sd, surprises, cloud transition matrix, rain chance by cloud, forecast accuracy | °C, probabilities |
| `demand` | visitors per slot, daily variation, rain and temperature effects, purchase model, reference price, traffic outlook thresholds | visitors, multipliers, dollars per cup |

Keys use English `snake_case`, following the spec's example. Supply ids are `lemons`, `sugar`, `ice`, `cups`, and cloud states are `soleil`, `nuageux`, `couvert`.

**Validation (`src/config/schema.ts`)** uses zod 4 with its French locale for types and ranges, `strictObject` so a misspelled key is reported instead of ignored, and `superRefine` for checks that span several fields:
- `min_price ≤ starting_price ≤ max_price`, and the minimum price is greater than 0
- every probability is in [0,1], and each row of the Markov matrix sums to 1 (±1e‑6)
- package quantities and servings per pitcher are positive integers
- for each recipe range, `min ≤ default ≤ max`
- temperatures satisfy `min < mean < max`
- money has at most 2 decimals, and selling prices are multiples of the price step
- taste weights sum to 1, and traffic thresholds satisfy `moyenne < forte`
- the currency code and locale work with `Intl`
- game length: `days.min ≥ 14`, `days.max ≤ 60`, and `days.min ≤ days.default ≤ days.max`. These bounds are fixed in the schema; the config can only narrow them.

If validation fails, the game shows `ErreurConfigScreen` with a readable list, for example *« supplies.lemons.minimum_price_per_package : le prix minimum (6,00 $) est supérieur au prix maximum (5,00 $) »*. All problems are listed at once, and the same list is logged to the console. These messages are for whoever edits the config. They are written in French to match the rest of the game.

Loading converts every money value from dollars to integer cents. The current values are **placeholders**. `tools/balance-sim.ts` is used to tune them (§14).

The config file is **bundled when the game is built** (`import config from '../config/game-config.json'`) and still validated when the game starts. To change balance, edit the JSON, commit it, and let GitHub Actions redeploy. Nothing is fetched at runtime.

---

## 9. three.js scene design

### 9.1 Visual style for a 10‑year‑old
- **Low‑poly, chunky, toy‑like** objects built only from primitives (boxes, cylinders, spheres, cones). There are no textures, which keeps everything crisp on any screen.
- **Flat, bright colors** using `MeshToonMaterial` with a 3‑step gradient map, which gives a cartoon look. A thick black outline is optional (inverted‑hull technique).
- **A limited palette** in `palette.ts`: lemon yellow `#FFD93D`, leaf green `#6BCB77`, sky blue `#4D96FF`, coral `#FF6B6B`, cream `#FFF8E7`, wood `#C68B59`.
- **A fixed, friendly camera**: a slightly elevated 3/4 view of the stand at a sidewalk corner, using `PerspectiveCamera` with a narrow field of view (≈ 35°). The camera gives a gentle intro zoom when the day opens, and the player has no camera controls.
- **Soft lighting**: one `HemisphereLight` and one `DirectionalLight` (the sun). Simple blob shadows (dark transparent circles) are used instead of shadow maps, which keeps it fast and readable.

### 9.2 Scene contents

| Object | What it shows |
| --- | --- |
| **Stand** (`Stand.ts`) | Wooden counter, striped yellow/white awning, and a chalkboard sign showing the **price** (a `CanvasTexture` with French text such as « Limonade 1,20 $ ») |
| **Pitcher** | Glass cylinder whose lemonade level drops as servings are sold |
| **Cup stack** | Stack height scales with cups remaining |
| **Lemon crate, sugar bag, ice box** | Small props whose fill level shows stock, so the kid can *see* inventory |
| **Sky** (`SkyAndWeather.ts`) | Background color moves from morning to noon to evening. The sun follows an arc during the day |
| **Clouds** | Clusters of white spheres drifting by. Their number depends on cloud cover |
| **Rain** | `InstancedMesh` of falling drops plus puddle decals. The sky turns grey during rainy slots |
| **Customers** (`Customers.ts`) | Pooled low‑poly characters (capsule body, sphere head, random shirt color, hat on sunny days, umbrella in rain) walking along the sidewalk |
| **Reaction bubbles** (`Bubbles.ts`) | Sprites with emoji above heads: 😋 bought and liked it, 😐 bought but meh, 💸 too expensive, 😢 sold out, 🍋 too sour, 🧊 wants ice |
| **Coin pop** | A small "+1,20 $" floats up on each sale (DOM overlay projected from 3D) |

### 9.3 How the day plays (`DayPlayer.ts`)
- The day's events are mapped to a timeline of about 30–45 s. Each event triggers a short animation: walk in, stop at the stand, show a bubble, then either take a cup (pitcher level drops, coin pop) or walk away.
- The HUD clock (« 10 h », « 14 h »…), cups sold, and cash all update as events play.
- Speed controls: « ▶ » normal, « ⏩ x2 », and « Passer » (jump to the end of the day).
- On other screens (méteo, magasin, recette) the scene stays visible behind the UI cards, idle and lightly animated (clouds drifting, awning swaying), and its weather follows the **forecast**.

### 9.4 Performance and resources
- Customers come from a fixed pool (e.g. 12 objects) that is reused. Geometries and materials are shared.
- Rain uses one `InstancedMesh`.
- `renderer.setPixelRatio(min(devicePixelRatio, 2))`. The scene resizes with the window, and the layout adapts to tablets.
- The render loop stops when the browser tab is hidden.
- `SceneManager.dispose()` frees GPU resources when a new game starts.

---

## 10. UI / UX for a 10-year-old (DOM layer)

### 10.1 General rules
- **One main decision per screen**, with a big green **« Suivant ➜ »** button at the bottom.
- **No typing anywhere.** Quantities use **steppers** (big « − » / « + » buttons). The price uses a stepper in 5‑cent steps, plus quick buttons such as « 0,50 $ / 1 $ / 1,50 $ ».
- **Icons before words**: 🍋 citrons, 🍬 sucre, 🧊 glaçons, 🥤 gobelets, 💰 caisse, ☀️⛅☁️🌧️ météo.
- Large rounded font (Fredoka / Baloo 2), minimum 18 px body text and 24 px headers, high contrast, and big touch targets (≥ 48 px).
- **A mascot, « Citronnelle »** (a smiling lemon), gives short tips in a speech bubble. The first day works as a guided tutorial, and later the tips can be turned off.
- Colors carry meaning: green for good or affordable, orange for a warning, red for impossible. A text label always comes with the color.
- Invalid actions are **prevented** rather than reported afterwards. For example, the « Acheter » button is disabled and shows « Pas assez d'argent ! ».

### 10.2 Always-visible top bar (spec §2)
`📅 Jour 3 / 14   💰 12,40 $   📈 Bénéfice : +4,80 $   🍋 8  🍬 15  🧊 0  🥤 30   ☀️ 29 °C (prévision)`

The total profit is shown green when positive and red when negative, always with a + or − sign so color is never the only clue.

### 10.3 Screens

| Screen | Content |
| --- | --- |
| **Accueil** | Title « Ma Super Limonade ! », mascot, « Nouvelle partie », « Comment jouer ? » (3 illustrated cards). New game asks « Combien de jours d'été ? » with quick buttons (14 / 30 / 45 / 60) plus a stepper, limited to the config range and set to 14 by default |
| **Météo** | Big weather card: icon, « 29 °C », « Risque de pluie : 30 % (plutôt l'après‑midi) », traffic outlook as three faces (« Peu de monde / Du monde / Beaucoup de monde ! »). The mascot reminds the player: « La météo peut se tromper ! » |
| **Magasin** | One card per supply: icon, « Paquet de 6 citrons », price with trend arrow (🔺 / 🔻 / ➖ with yesterday's price), stock owned, a stepper for packages, and the line total. A news banner explains big changes (« 🍋 Belle récolte : les citrons sont moins chers ! »). Cart total compared with cash, and an « Acheter » button. A 📈 mini price-history chart per supply opens in a modal |
| **Recette** | Three big sliders with pictures (🍋 / 🍬 / 🧊 per pitcher). A cartoon pitcher fills and changes color as the recipe changes; no score is shown. A pitchers stepper and a « Ce qu'il te faut / Ce que tu as » checklist with ✅ / ❌. A warning « ⚠️ Tu n'as que 20 gobelets : tu ne pourras vendre que 20 verres. » Price stepper with a live **« Un verre te coûte environ 0,38 $ à fabriquer »** hint next to the selling price, so the kid sees the margin per cup. Big « Ouvrir le stand ! » button |
| **Journée** | Mostly the 3D scene. Small overlay: day clock progress bar, « Verres vendus : 12 », live cash, speed buttons |
| **Bilan** | Big figures: « Clients venus », « Verres vendus », « Clients déçus » (missed sales), « Recette du jour », « Dépenses au magasin », « Variation de caisse ». The **« Bénéfice du jour »** is the headline of the screen: a large number with a simple stacked bar showing « Ventes − Coût des verres vendus − Gaspillage = Bénéfice ». A « Pourquoi ce n'est pas pareil que la caisse ? » ❓ button explains with the mascot. Then « Gaspillage » (🗑️ verres jetés, 🧊 glaçons fondus, 🍋 citrons pourris), « Prévu vs Réel » weather side by side, up to 3 mascot feedback messages, and the buttons « Historique » and « Jour suivant ➜ » |
| **Historique** | A simple table with one row per day (météo prévue/réelle, prix, recette, verres vendus, bénéfice, caisse), plus small line charts of cash, profit per day, and supply prices (lightweight SVG drawn by hand, no chart library) |
| **Fin** | Score « 💰 Tu termines avec 48,20 $ ! », then **« 📈 Bénéfice total : +28,20 $ »** with the kid‑friendly equation « Caisse de départ + Bénéfice = Caisse finale + Stock qu'il te reste ». Also the totals summary (spec §9), best day by profit, the day‑by‑day table, a fun, gender‑neutral title by score (« Graine de citronnier », « As du stand », « Pro de la limonade », « Star de la limonade »), the early‑end explanation if needed, and « Rejouer » |

### 10.4 Vocabulary (consistent French terms)

| Concept | French label |
| --- | --- |
| Cash | Caisse |
| Supplies / shop | Fournitures / Magasin |
| Pitcher | Pichet |
| Serving / cup sold | Verre |
| Cups (inventory) | Gobelets |
| Selling price | Prix du verre |
| Missed sales | Clients déçus |
| Daily cash change | Variation de caisse |
| Profit | Bénéfice |
| Cost per cup | Coût d'un verre |
| Waste | Gaspillage |
| Forecast / actual | Prévision / Réel |
| Traffic outlook | Affluence prévue : faible / moyenne / forte |

---

## 11. Internationalisation

- `i18n/fr.ts` exports one typed object of keys, so the compiler catches a missing key. It includes templated functions for plurals, such as `verres(n)`, which returns « 1 verre » or « 3 verres ».
- `format.ts` provides:
  - `money(cents)` using `Intl.NumberFormat('fr-CA', { style: 'currency', currency })`
  - `temp(c)` → « 28 °C »
  - `percent(p)` → « 30 % » (French uses a narrow no‑break space before % and $)
  - `hour(slot, tick)` → « 14 h »
- Core code returns **codes** only (`FeedbackCode`, `ActionError`, `MarketNewsCode`), never sentences. Adding another language later would only need one more dictionary.

---

## 12. Persistence

Implemented in `src/app/persistence.ts`:

- After every state change, the game is autosaved to `localStorage` (`limonade.save.v1`), wrapped in try/catch so private mode or a full disk never breaks the game.
- On start, if a save exists, Accueil offers « ▶ Continuer la partie (jour X / Y) ». The 🏠 button in the top bar returns to Accueil with the game saved.
- A day interrupted during its replay resumes on its report: the day was already simulated, only the animation is lost.
- The save includes the seed and the PRNG state, so loading a game resumes exactly where it stopped.
- All storage keys start with `limonade.`, because every project page on `<owner>.github.io` shares the same `localStorage`.
- Saves include a version number and a fingerprint of the config. A save from another version or another config is ignored, and a finished game is not offered for resuming.
- Preferences (`limonade.preferences.v1`) remember whether Citronnelle's first-day tips are on.

---

## 13. Hosting on GitHub Pages (static, no backend)

- **Output**: `vite build` writes plain static files to `dist/`: `index.html`, plus JS, CSS, and fonts with hashed filenames.
- **URL**: a project page at `https://<owner>.github.io/limonade/`, so `vite.config.ts` sets `base: '/limonade/'`. All asset paths go through Vite, so they respect the base path.
- **No routing**: screens are app state, not URLs. Every visit loads `index.html`, so Pages never returns a 404 for a deep link, and no `404.html` redirect workaround is needed.
- **No runtime network calls**: config, fonts, and three.js are all bundled. There is no analytics, no tracking, and no cookies, which suits a game for children.
- **CI** (`.github/workflows/ci.yml`): on every push and pull request, run `npm ci`, then lint, type‑check, `vitest run`, and `vite build`.
- **Deploy** (`.github/workflows/deploy.yml`): on push to `main`, build and publish with `actions/upload-pages-artifact` and `actions/deploy-pages`. In the repository settings, the Pages source must be set to **GitHub Actions**.
- **Branches**: day‑to‑day work happens on `dev`. A merge into `main` deploys the game.
- **Preview locally**: `npm run build && npm run preview` serves `dist/` at the same base path as Pages.

---

## 14. Testing and balancing

**Unit tests (Vitest)**
- `rng`: the same seed always gives the same sequence.
- `weather`: temperature stays in bounds, consecutive days are correlated, and rain frequency matches the config over many samples.
- `market`: prices never leave `[min, max]`, and events apply correctly.
- `inventory`: lemons are used FIFO, spoil at exactly `spoilageDays`, and ice is zero after the end of day.
- `preparation`: preparation cannot exceed available ingredients, and the cup‑limit warning works.
- `daySimulation`: sales ≤ min(servings, cups), every sale uses exactly 1 serving and 1 cup, revenue = sold × price, and missed sales are counted only after a stockout.
- `actions`: purchases cannot exceed cash, and plan changes are rejected once the stand is open.
- `endConditions`: the early end is detected when no stock remains and there is no cash.
- `accounting`: profit = revenue − goods used − waste on hand‑computed examples, and over a full seeded game, starting cash + Σ cash change = final cash.
- `config/schema`: each invalid case gives the expected readable message.
- **Seeded snapshot test**: one full scripted game with a fixed seed gives a stable final cash.

**Balance tool (`tools/balance-sim.ts`)**
This tool runs thousands of headless games with simple bot strategies (« prudent », « gourmand », « aléatoire », « malin » which follows the forecast). It runs for 14, 30, and 60‑day games and reports the distribution of final cash and profit, how often early endings happen, and waste rates. It is used to tune the config so that:
- a sensible player ends well above the starting cash,
- careless play is possible but makes less,
- following the forecast clearly helps, but not every time.

---

## 15. Implementation plan (milestones)

1. **Setup**: Vite + TS + three.js + Vitest + ESLint, folder structure, empty screens, CI workflow, and the GitHub Pages deploy workflow, so a "Hello limonade" page is live from day one.
2. **Config**: JSON file, zod schema, loader, error screen, and tests.
3. **Core simulation**: rng → weather → market → inventory → recipe → demand → daySimulation → endOfDay → accounting → endConditions, each with tests. The game is then fully playable from tests or the console.
4. **Balance tool**: first round of tuning.
5. **UI flow**: HUD + all screens with the French strings, working against the core with the 3D canvas still a plain background.
6. **3D scene**: world + stand + inventory props, then sky and weather, then customers and bubbles, then the DayPlayer.
7. **Polish**: mascot tutorial, animations and transitions, responsive tablet layout, autosave.
8. **Playtest with kids**: watch and adjust wording, then rebalance the config.

**Sound** is a separate epic, now done: [`docs/epics/EPIC-son.md`](docs/epics/EPIC-son.md). `src/audio/AudioManager.ts` only listens: `DayPlayer` and the UI publish typed events (`sale`, `missed`, `rain_start`, `button_click`, `day_end`…) on a small event bus (`app/events.ts`), so the sound module can later subscribe to them without changing game code.

---

## 16. Decisions and open points

**Decided**
- Currency: Canadian dollar (CAD), `fr-CA` formatting (`1,50 $`).
- Game length: the player chooses from 14 to 60 days, with 14 as the default (§8, §10.3).
- Profit: a visible, central part of the game (§6, §7.8, §10).
- Hosting: static site on GitHub Pages, no backend (§13).
- Sound: handled in its own epic.

**Still open**
- Unit sizes: sugar is counted in « cuillères » and ice in « glaçons ».
- Device target: desktop and tablet in landscape are assumed. Phone portrait would need a different layout.
