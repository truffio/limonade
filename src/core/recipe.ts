import type { GameConfig } from '../config/schema';
import { lerpClamped } from './rng';
import type { Recipe, TasteIssue } from './types';

type TasteConfig = GameConfig['taste'];

/** Below this sub-score, the ingredient is worth a feedback message. */
const ISSUE_THRESHOLD = 0.7;

/** Bell curve: 1 at the ideal, falling off with distance measured in tolerances. */
function bell(value: number, ideal: number, tolerance: number): number {
  const d = (value - ideal) / tolerance;
  return Math.exp(-(d * d) / 2);
}

export function idealIce(temperatureC: number, cfg: TasteConfig): number {
  return lerpClamped(
    temperatureC,
    20,
    35,
    cfg.ideal_ice_per_pitcher_at_20c,
    cfg.ideal_ice_per_pitcher_at_35c,
  );
}

export interface TasteResult {
  /** 0..1, never shown to the player as a number (spec §5). */
  quality: number;
  /** Worst problems first, only those below the issue threshold. */
  issues: TasteIssue[];
}

/** Scores a recipe for a given temperature; ice matters more on hot days. */
export function tasteRecipe(recipe: Recipe, temperatureC: number, cfg: TasteConfig): TasteResult {
  const lemonScore = bell(recipe.lemons, cfg.ideal_lemons_per_pitcher, cfg.lemon_tolerance);

  // Sweetness only makes sense relative to sourness.
  const sugarPerLemon = recipe.lemons > 0 ? recipe.sugar / recipe.lemons : recipe.sugar;
  const sugarScore = bell(sugarPerLemon, cfg.ideal_sugar_per_lemon, cfg.sugar_tolerance);

  const iceIdeal = idealIce(temperatureC, cfg);
  const iceScore = bell(recipe.ice, iceIdeal, cfg.ice_tolerance);

  const w = cfg.weights;
  const quality = w.lemon * lemonScore + w.sugar * sugarScore + w.ice * iceScore;

  const candidates: [number, TasteIssue][] = [
    [lemonScore, recipe.lemons < cfg.ideal_lemons_per_pitcher ? 'PAS_ASSEZ_CITRON' : 'TROP_ACIDE'],
    [sugarScore, sugarPerLemon < cfg.ideal_sugar_per_lemon ? 'PAS_ASSEZ_SUCRE' : 'TROP_SUCRE'],
    [iceScore, recipe.ice < iceIdeal ? 'PAS_ASSEZ_FRAIS' : 'TROP_DE_GLACE'],
  ];
  const issues = candidates
    .filter(([score]) => score < ISSUE_THRESHOLD)
    .sort((a, b) => a[0] - b[0])
    .map(([, issue]) => issue);

  return { quality, issues };
}
