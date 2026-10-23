# Lemonade Stand: Gameplay and Functional Specification

## Executive summary

Lemonade Stand is a single-player business simulation played over a series of summer days. The player starts with limited cash, buys ingredients and cups, chooses a recipe and selling price, and prepares lemonade for customers. Demand changes with weather, price, taste, and daily variation, while supply prices evolve over time. After each day the player reviews results and adjusts the next day's decisions. The objective is to finish with as much cash as possible while learning about pricing, demand, costs, inventory, waste, and uncertainty.

## 1. Objective and setup

The player operates one lemonade stand for a configured number of days. Final cash is the main score. The game starts with configured cash and either an empty or modest configured inventory. It gives brief instructions and shows the current day, cash, and inventory. The player can start a new game after completion.

Starting cash, inventory, game length, and other balance values are configurable. Exact values are not fixed by this specification.

## 2. Daily sequence

1. Review the weather forecast, inventory, and cash.
2. Review supply prices and purchase supplies.
3. Set the recipe, selling price, and number of pitchers to prepare.
4. Confirm the decisions and open the stand.
5. Watch customers visit and sales occur until the day ends or stock runs out.
6. Review results, waste, and remaining inventory; proceed to the next day or final results.

The forecast remains visible throughout planning. Once the stand opens, the day's decisions cannot be changed. The game displays the day, cash, and relevant inventory throughout play.

## 3. Weather and forecast

The game takes place in a summer season. Actual daily weather includes temperature, cloud cover, and whether and when rain affects the selling period. Weather evolves plausibly: conditions on consecutive days are related, while changes and occasional surprises remain possible.

Before buying or preparing, the player receives a forecast for the upcoming selling day with:

- Expected temperature and sky conditions.
- Chance of rain and, when relevant, the part of the day most likely to be affected.
- A plain-language estimate of expected customer traffic: low, moderate, or high.

The forecast is useful but imperfect: expected temperature and conditions generally guide decisions, but actual conditions may differ. A rain probability is not a guarantee. Actual weather influences traffic and interest in a cold drink. Hot, sunny weather generally encourages demand, while cool, rainy conditions generally reduce it; warm, cloudy days can still be good for sales.

The end-of-day report and history show forecast and actual weather together with traffic and sales, so the player can learn from their decisions.

## 4. Buying supplies

The shop offers lemons, sugar, ice, and cups in defined package quantities. Before confirming a purchase, the player sees the current price per package, package quantity, current inventory, selected quantities, total cost, and available cash. A purchase cannot exceed available cash. Confirmed purchases increase inventory and reduce cash.

The player may buy more than is needed for the current day. Stock can be useful later, but cash is tied up and some items spoil or melt.

### Dynamic prices

Prices can change each day. Every supply has a configured minimum and maximum purchase price, expressed per defined package. Prices must remain within those bounds. Typical changes are modest rather than large random daily jumps, although occasional events may cause more noticeable changes.

- Lemon prices can respond to harvests or shortages.
- Sugar prices generally change gradually.
- Ice prices can rise during hot spells when demand is higher.
- Cup prices are relatively stable but can change occasionally.

The shop shows today's price, the previous day's price when available, and whether it rose, fell, or stayed the same. A short supply update explains significant changes. The player can review price history.

Price bounds, usual rates of change, and event effects are configurable. Example price ranges are illustrative only; they are not prescribed game balance.

## 5. Recipe, preparation, and price

### Recipe

The player selects the amount of lemon, sugar, and ice used per pitcher. The recipe affects taste and customer satisfaction: insufficient lemon can taste weak, excess lemon can be sour, and too little or too much sugar can be unappealing. Ice can make lemonade more attractive, particularly in hot weather.

The ideal recipe is not disclosed as an exact formula. Customer feedback helps the player experiment. Recipe constraints, ingredient quantities, and pitcher yield are configurable.

### Preparation

The player selects the number of pitchers to prepare. Before confirmation, the game shows the ingredients required, available ingredients, servings produced, cups available, and any shortage. Preparation cannot exceed the available ingredients. Each sale requires one serving of prepared lemonade and one cup.

Preparing too little can cause missed sales. Preparing too much can cause waste. The player can choose a quantity even when available cups are fewer than the servings produced, but the game must show that cups limit possible sales.

### Selling price

The player chooses a price per cup before opening. Higher prices can discourage customers even though they earn more per sale; lower prices may attract customers but reduce revenue per cup. Prices and valid input limits are expressed in the game's configured currency and units.

## 6. Running the stand

When the player confirms the plan, the stand opens. Potential customers arrive during the simulated day. The number of visitors varies with actual weather and daily variation. A visitor's willingness to buy is influenced by selling price and lemonade quality, as well as weather and variation.

Each successful sale consumes one serving and one cup and adds the cup price to cash. Sales stop when the day's selling period ends or when lemonade or cups are exhausted. Customers who would have bought after a stockout count as missed sales. The game shows the day's progress, sales, and cash updating as the stand operates.

Demand should be understandable over several days without making every day's outcome certain. The precise balance and strength of each influence are configurable.

## 7. Inventory and waste

Purchased supplies and prepared lemonade are tracked separately.

- Sugar and cups carry over to later days.
- Lemons carry over until they reach their configured spoilage age.
- Unused ice melts at the end of the day.
- Prepared lemonade remaining at closing is discarded.

The player is informed of supplies that spoil or are discarded. Ingredient use is deducted when lemonade is prepared; cups are deducted when a sale occurs. The game retains enough inventory information to apply lemon spoilage consistently.

## 8. Daily results and history

At closing, the player can review:

| Measure | Meaning |
| --- | --- |
| Forecast and actual weather | Conditions expected and experienced during the day. |
| Potential customers | Visitors considered during the selling period. |
| Cups sold and missed sales | Sales completed and customers unable to buy because lemonade or cups ran out. |
| Revenue | Cups sold multiplied by the selling price. |
| Supply spending | Cash spent on supplies that day. |
| Daily cash change | Revenue minus that day's supply spending. |
| Remaining cash and inventory | Cash and usable supplies after closing and spoilage. |
| Waste | Unsold lemonade and supplies that spoiled or melted. |
| Feedback | Useful comments on price and taste. |

Daily cash change is not necessarily accounting profit: purchases may be used on later days. The game must not label cash change as profit without accounting for the cost of supplies actually consumed.

History retains the player's decisions and daily outcomes, including weather and supply prices, for review during the game. Feedback helps the player understand results without revealing a guaranteed winning strategy.

## 9. End of game

The game ends after the configured final day. It can also end earlier if the player cannot make and sell lemonade with available inventory and cannot afford the purchases needed to do so. The game explains an early ending.

Final results show starting and final cash, total revenue, total supply spending, cups sold, unsold lemonade discarded, missed sales, and a day-by-day summary of decisions and results. Final cash is the main score. The player may start a new game.

## 10. Configuration

Game constants and balance parameters are defined in a JSON configuration file. This includes at least:

- Starting cash, starting inventory, game duration, and currency.
- Supply package quantities and units; starting prices, minimum and maximum prices, typical price changes, and event effects.
- Pitcher yield, serving size, recipe quantities, and valid ranges.
- Lemon spoilage duration and the treatment of ice and prepared lemonade.
- Weather ranges, day-to-day persistence, rain behavior, and forecast uncertainty.
- Baseline traffic, weather and price effects, recipe satisfaction, customer variation, and traffic outlook thresholds.

Each configured quantity needs a clear unit, such as currency per package, ingredients per pitcher, cups per pitcher, temperature in degrees Celsius, probability from 0 to 1, or duration in days. The configuration must be internally consistent: for example, supply minimum prices cannot exceed maximum prices, probabilities must be valid, and package quantities must be positive. Invalid configuration should produce a clear explanation.

The following is an illustrative fragment, not a complete configuration or a required set of prices:

```json
{
  "supplies": {
    "lemons": {
      "package_quantity": 6,
      "unit": "lemons",
      "minimum_price_per_package": 2.00,
      "maximum_price_per_package": 5.00
    }
  }
}
```

## 11. Open balance decisions

Initial cash, the duration of a game, exact package sizes and prices, recipe ranges, spoilage durations, forecast accuracy, and demand sensitivity remain to be chosen and adjusted through playtesting. Their values should support a fair game in which the player can learn from feedback and make meaningful choices.
