import { buySupplies, cartCost, type Cart } from '../../core/actions';
import { count, lemonsExpiringToday } from '../../core/inventory';
import type { GameState, SupplyId } from '../../core/types';
import { SUPPLIES } from '../../core/types';
import { money } from '../../i18n/format';
import { fr } from '../../i18n/fr';
import { actions, button, mascot, screenTitle, stepper, tutorialTip } from '../components';
import { lineChart } from '../components/lineChart';
import { h } from '../dom';
import type { Screen, ScreenContext } from './types';

/** Short explanations of today's notable price changes (spec §4). */
export function marketNewsLines(game: GameState): string[] {
  return game.marketNews.map(
    (n) =>
      fr.magasin.nouvelles[n.id] ??
      fr.magasin.nouvelleGenerique(fr.fournitures[n.supply].nom, n.direction === 'hausse'),
  );
}

function trend(game: GameState, supply: SupplyId): string {
  const before = game.previousPrices?.[supply];
  if (before === undefined) return '';
  const now = game.prices[supply];
  const icon =
    now > before
      ? fr.magasin.tendance.hausse
      : now < before
        ? fr.magasin.tendance.baisse
        : fr.magasin.tendance.stable;
  return `${icon} ${fr.magasin.hier(money(before))}`;
}

function supplyCard(ctx: ScreenContext, supply: SupplyId): HTMLElement {
  const game = ctx.game();
  const cfg = ctx.cfg;
  const cart = ctx.state.cart;
  const s = cfg.supplies[supply];
  const info = fr.fournitures[supply];
  const price = game.prices[supply];
  const packages = cart[supply] ?? 0;
  const otherCost = cartCost(game, { ...cart, [supply]: 0 });
  const maxPackages = Math.max(0, Math.floor((game.cash - otherCost) / price));
  const expiring = supply === 'lemons' ? lemonsExpiringToday(game.inventory, cfg) : 0;
  const history = [...game.history.map((d) => d.prices[supply]), price];

  return h(
    'article',
    { class: 'fourniture' },
    h(
      'header',
      { class: 'fourniture__entete' },
      h('span', { class: 'fourniture__icone', 'aria-hidden': 'true' }, info.icone),
      h(
        'div',
        null,
        h('h2', null, info.nom),
        h('small', null, fr.magasin.paquet(s.package_quantity, s.unit)),
      ),
      h(
        'div',
        { class: 'fourniture__prix' },
        h('strong', null, money(price)),
        h('small', null, trend(game, supply)),
      ),
    ),
    h(
      'p',
      { class: 'fourniture__stock' },
      fr.magasin.enStock(count(game.inventory, supply)),
      expiring > 0
        ? h('span', { class: 'avertissement' }, ` ${fr.magasin.pourrissent(expiring)}`)
        : null,
    ),
    stepper({
      id: `achat-${supply}`,
      label: `${info.nom} (paquets)`,
      icon: info.icone,
      value: packages,
      min: 0,
      max: Math.max(packages, maxPackages),
      hint: packages > 0 ? `= ${money(packages * price)}` : null,
      onChange: (n) => ctx.setCart({ ...cart, [supply]: n }),
    }),
    history.length > 1
      ? h(
          'details',
          { class: 'fourniture__historique' },
          h('summary', null, fr.magasin.evolution),
          lineChart(
            fr.magasin.evolution,
            [{ label: info.nom, color: 'var(--ciel)', values: history.map((c) => c / 100) }],
            (v) => money(Math.round(v * 100)),
            history.map((_, i) => `J${i + 1}`),
          ),
        )
      : null,
  );
}

export const MagasinScreen: Screen = {
  render(ctx) {
    const game = ctx.game();
    const cart: Cart = ctx.state.cart;
    const total = cartCost(game, cart);
    const empty = total === 0;
    const news = marketNewsLines(game);

    const buy = () => {
      const ok = ctx.act((g) => buySupplies(g, ctx.cfg, cart), fr.magasin.achatReussi);
      if (ok) {
        ctx.events.emit('purchase_confirmed', { cost: total });
        ctx.setCart({});
      }
    };

    return h(
      'section',
      { class: 'panneau' },
      screenTitle(fr.ecrans.magasin),
      tutorialTip(
        ctx,
        2,
        fr.tutoriel.magasin(
          2 * ctx.cfg.recipe.lemons_per_pitcher.default,
          2 * ctx.cfg.recipe.sugar_per_pitcher.default,
          2 * ctx.cfg.recipe.ice_per_pitcher.default,
          2 * ctx.cfg.recipe.servings_per_pitcher,
        ),
      ),
      news.length > 0
        ? h(
            'div',
            { class: 'nouvelles' },
            news.map((n) => h('p', null, n)),
          )
        : null,
      h(
        'div',
        { class: 'fournitures' },
        SUPPLIES.map((supply) => supplyCard(ctx, supply)),
      ),
      h(
        'div',
        { class: 'panier' },
        h('div', null, `${fr.magasin.total} : `, h('strong', null, money(total))),
        h('div', null, `${fr.magasin.caisse} : `, h('strong', null, money(game.cash))),
        button(`🛒 ${fr.magasin.acheter}`, buy, {
          large: true,
          disabled: empty || total > game.cash,
          focusKey: 'acheter',
        }),
        empty ? h('small', null, fr.magasin.panierVide) : null,
      ),
      mascot(fr.magasin.conseil),
      actions(
        button(fr.magasin.retourMeteo, () => ctx.goTo('meteo'), {
          variant: 'secondary',
          focusKey: 'vers-meteo',
        }),
        button(fr.magasin.vaALaRecette, () => ctx.goTo('recette'), {
          large: true,
          focusKey: 'vers-recette',
        }),
      ),
    );
  },
};
