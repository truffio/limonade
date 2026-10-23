import rawConfig from '../../config/game-config.json';
import type { Cart } from '../../src/core/actions';
import { buySupplies, finishDay, nextDay, openStand, setPlan } from '../../src/core/actions';
import { loadConfig } from '../../src/config/loadConfig';
import type { GameConfig } from '../../src/config/schema';
import { maxPitchers } from '../../src/core/preparation';
import type { ActionResult, GameState } from '../../src/core/types';

/** The shipped config, validated (money in cents). Pass a function to tweak a copy. */
export function testConfig(change?: (cfg: GameConfig) => void): GameConfig {
  const result = loadConfig(rawConfig);
  if (!result.ok) throw new Error('default config is invalid');
  const cfg = structuredClone(result.config);
  change?.(cfg);
  return cfg;
}

export function unwrap(result: ActionResult): GameState {
  if (!result.ok) throw new Error(`action failed: ${result.error}`);
  return result.state;
}

/**
 * A simple, sensible strategy used to drive whole games in tests: buys what
 * one day needs for a few pitchers, keeps the default recipe and price.
 */
export function playSimpleDay(state: GameState, cfg: GameConfig, pitchers = 3): GameState {
  const r = state.plan.recipe;
  const need = (units: number, supply: keyof Cart) =>
    Math.max(0, Math.ceil(units / cfg.supplies[supply].package_quantity));
  const have = (supply: 'sugar' | 'ice' | 'cups') => state.inventory[supply].qty;
  const lemons = state.inventory.lemons.reduce((s, b) => s + b.qty, 0);
  const servings = pitchers * cfg.recipe.servings_per_pitcher;
  const cart: Cart = {
    lemons: need(r.lemons * pitchers - lemons, 'lemons'),
    sugar: need(r.sugar * pitchers - have('sugar'), 'sugar'),
    ice: need(r.ice * pitchers - have('ice'), 'ice'),
    cups: need(servings - have('cups'), 'cups'),
  };

  let s = state;
  const bought = buySupplies(s, cfg, cart);
  if (bought.ok) s = bought.state;
  const affordable = Math.max(1, Math.min(pitchers, maxPitchers(s.inventory, r, cfg)));
  s = unwrap(setPlan(s, cfg, { ...s.plan, pitchers: affordable }));
  const opened = openStand(s, cfg);
  // Not even one pitcher possible: return the planning state unchanged; callers stop there.
  if (!opened.ok) return s;
  s = unwrap(finishDay(opened.state));
  return unwrap(nextDay(s, cfg));
}
