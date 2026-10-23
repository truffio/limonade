import type { GameConfig } from '../src/config/schema';
import { playGame, STRATEGIES } from './bots';

export interface StrategyStats {
  strategy: string;
  days: number;
  games: number;
  finalCash: { p10: number; median: number; p90: number; mean: number };
  totalProfitMedian: number;
  earlyEndRate: number;
  stuckRate: number;
  wasteRate: number;
  serviceRate: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i] ?? 0;
}

export function simulate(cfg: GameConfig, games: number, days: number): StrategyStats[] {
  return STRATEGIES.map((strategy) => {
    const cash: number[] = [];
    const profit: number[] = [];
    let early = 0;
    let stuck = 0;
    let made = 0;
    let discarded = 0;
    let sold = 0;
    let wanted = 0;
    for (let g = 0; g < games; g++) {
      const result = playGame(cfg, strategy, 1000 + g, days);
      const s = result.state;
      cash.push(s.cash);
      profit.push(s.totalProfit);
      if (s.endReason === 'PLUS_POSSIBLE') early++;
      if (result.stuck) stuck++;
      for (const d of s.history) {
        made += d.servingsMade;
        discarded += d.waste.servingsDiscarded;
        sold += d.cupsSold;
        wanted += d.cupsSold + d.missedSales;
      }
    }
    cash.sort((a, b) => a - b);
    profit.sort((a, b) => a - b);
    return {
      strategy: strategy.name,
      days,
      games,
      finalCash: {
        p10: percentile(cash, 0.1),
        median: percentile(cash, 0.5),
        p90: percentile(cash, 0.9),
        mean: cash.reduce((a, b) => a + b, 0) / games,
      },
      totalProfitMedian: percentile(profit, 0.5),
      earlyEndRate: early / games,
      stuckRate: stuck / games,
      wasteRate: made > 0 ? discarded / made : 0,
      serviceRate: wanted > 0 ? sold / wanted : 0,
    };
  });
}

/** Does the traffic outlook match the visitors who actually came? */
export function outlookCheck(cfg: GameConfig, games: number, days: number) {
  const malin = STRATEGIES.find((s) => s.name === 'malin');
  if (!malin) throw new Error('malin strategy missing');
  const byOutlook = new Map<string, number[]>();
  for (let g = 0; g < games; g++) {
    for (const d of playGame(cfg, malin, 5000 + g, days).state.history) {
      const list = byOutlook.get(d.forecast.trafficOutlook) ?? [];
      list.push(d.potentialCustomers);
      byOutlook.set(d.forecast.trafficOutlook, list);
    }
  }
  const total = [...byOutlook.values()].reduce((n, l) => n + l.length, 0);
  return (['faible', 'moyenne', 'forte'] as const).map((outlook) => {
    const list = byOutlook.get(outlook) ?? [];
    return {
      outlook,
      share: total > 0 ? list.length / total : 0,
      meanVisitors: list.length > 0 ? list.reduce((a, b) => a + b, 0) / list.length : 0,
    };
  });
}
