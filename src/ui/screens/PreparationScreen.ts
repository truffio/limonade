import { h } from '../dom';
import { pricePane } from '../panes/PricePane';
import { recipePane } from '../panes/RecipePane';
import { shopPane } from '../panes/ShopPane';
import { weatherPane } from '../panes/WeatherPane';
import type { Screen } from './types';

/**
 * Planning dashboard: independent panes around the 3D stand. The stock is
 * top left (rendered by App), the weather top right, and along the bottom:
 * recipe and pitchers, then the shop, then the price and opening the stand.
 */
export const PreparationScreen: Screen = {
  render(ctx) {
    return h(
      'div',
      { class: 'tableau' },
      weatherPane(ctx),
      h('div', { class: 'rangee' }, recipePane(ctx), shopPane(ctx), pricePane(ctx)),
    );
  },
};
