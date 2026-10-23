# Balance

Run the simulator with `npm run balance` (options: `--games 2000`, `--days 14,30`, `--config other.json`, `--json`).

Five bots play the same seeded games:

| Bot | Plays like |
| --- | --- |
| `prudent` | default recipe and price, always 2 pitchers |
| `gourmand` | 2 $ a cup and 6 pitchers every day |
| `aleatoire` | random recipe, price and pitchers |
| `sans-meteo` | expert recipe and price, but plans for an average day |
| `malin` | expert recipe and price, sized from the forecast |

The two expert bots know the taste and demand model, so they show the upper range of what a child can learn to earn.

## Goals

These are checked on every run of the tests by `tests/balance.test.ts`:

- A sensible player ends well above the starting cash.
- Following the forecast clearly helps (`malin` beats `sans-meteo` by more than 5 %).
- Good play beats overpricing and overproducing (`malin` beats `gourmand` and wastes less).
- Careless play can lose money (`aleatoire` ends below the starting cash in at least 10 % of games).
- Days announced as busier really bring more visitors.

## First tuning (milestone 4)

Starting from the placeholder config, every bot got rich and `gourmand` won easily, because customers hardly reacted to price. The changes:

| Setting | Before | After | Why |
| --- | --- | --- | --- |
| `demand.purchase.price_sensitivity` | 2.5 | 4.5 | makes a fair price the best price; 2 $ cups now sell poorly |
| `demand.base_visitors_per_slot` | 15 | 8 | fewer customers, smaller fortunes |
| `demand.temperature_effect.factor_at_cold / at_hot` | 0.5 / 1.5 | 0.35 / 1.7 | weather matters more |
| `demand.rain_traffic_factor` | 0.3 | 0.2 | rain hurts more |
| `demand.traffic_outlook_thresholds` | 40 / 70 | 25 / 40 | matches the new visitor counts |
| `taste.weights` | 0.4 / 0.4 / 0.2 | 0.375 / 0.375 / 0.25 | ice matters a bit more |
| `taste.ideal_ice_per_pitcher_at_20c / at_35c` | 4 / 12 | 2 / 14 | ice should follow the temperature |

## Results (14 days, 20 $ at the start, 200 games per bot)

| Bot | Final cash p10 | Median | p90 | Ended early | Waste |
| --- | ---: | ---: | ---: | ---: | ---: |
| prudent | 115,90 $ | 132,40 $ | 142,05 $ | 0 % | 3 % |
| gourmand | 44,90 $ | 196,55 $ | 345,65 $ | 5 % | 67 % |
| aleatoire | 3,25 $ | 31,50 $ | 97,85 $ | 8 % | 43 % |
| sans-meteo | 234,45 $ | 318,90 $ | 377,65 $ | 0 % | 19 % |
| malin | 267,95 $ | 361,20 $ | 480,05 $ | 0 % | 16 % |

Traffic outlook against the visitors who actually came: « faible » 23 visitors on average (21 % of days), « moyenne » 34 (46 %), « forte » 45 (33 %).

These values still need playtesting with children (milestone 8).
