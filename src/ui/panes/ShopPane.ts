import { buySupplies, cartCost, type Cart } from '../../core/actions';
import { lemonsExpiringToday } from '../../core/inventory';
import type { GameState, SupplyId } from '../../core/types';
import { SUPPLIES } from '../../core/types';
import { money } from '../../i18n/format';
import { fr } from '../../i18n/fr';
import { button, stepper } from '../components';
import { h } from '../dom';
import type { ScreenContext } from '../screens/types';
import { pane, tutorialHint } from './common';

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

/** One line per supply: name and package, price and trend, stock, and how many packages to buy. */
function supplyRow(ctx: ScreenContext, supply: SupplyId): HTMLElement {
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

  return h(
    'li',
    { class: 'achat', 'data-supply': supply },
    h('span', { class: 'achat__icone', 'aria-hidden': 'true' }, info.icone),
    h(
      'div',
      { class: 'achat__nom', title: fr.magasin.paquet(s.package_quantity, s.unit) },
      h('strong', null, info.nom),
      h('small', null, fr.magasin.paquet(s.package_quantity, s.unit)),
      expiring > 0
        ? h('small', { class: 'avertissement' }, fr.magasin.pourrissent(expiring))
        : null,
    ),
    h(
      'div',
      { class: 'achat__prix' },
      h('strong', null, money(price)),
      h('small', null, trend(game, supply)),
    ),
    stepper({
      id: `achat-${supply}`,
      label: `${info.nom} (paquets)`,
      value: packages,
      min: 0,
      max: Math.max(packages, maxPackages),
      compact: true,
      onChange: (n) => ctx.setCart({ ...cart, [supply]: n }),
    }),
    h('span', { class: 'achat__ligne' }, packages > 0 ? money(packages * price) : ''),
  );
}

/** Buying supplies, on its own (#50): no recipe controls here. */
export function shopPane(ctx: ScreenContext): HTMLElement {
  const game = ctx.game();
  const cart: Cart = ctx.state.cart;
  const total = cartCost(game, cart);
  const empty = total === 0;
  const r = ctx.cfg.recipe;

  const buy = () => {
    const ok = ctx.act((g) => buySupplies(g, ctx.cfg, cart), fr.magasin.achatReussi);
    if (ok) {
      ctx.events.emit('purchase_confirmed', { cost: total });
      ctx.setCart({});
    }
  };

  return pane(
    'magasin',
    fr.volets.magasin,
    tutorialHint(
      ctx,
      2,
      fr.tutoriel.magasin(
        2 * r.lemons_per_pitcher.default,
        2 * r.sugar_per_pitcher.default,
        2 * r.ice_per_pitcher.default,
        2 * r.servings_per_pitcher,
      ),
    ),
    h(
      'ul',
      { class: 'achats' },
      SUPPLIES.map((supply) => supplyRow(ctx, supply)),
    ),
    h(
      'div',
      { class: 'panier' },
      h(
        'div',
        { class: 'panier__totaux' },
        empty
          ? h('small', null, fr.magasin.panierVide)
          : h('span', null, `${fr.magasin.total} : `, h('strong', null, money(total))),
        h('span', null, `${fr.magasin.caisse} : `, h('strong', null, money(game.cash))),
      ),
      button(`🛒 ${fr.magasin.acheter}`, buy, {
        disabled: empty || total > game.cash,
        focusKey: 'acheter',
      }),
    ),
  );
}
