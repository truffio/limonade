/**
 * Balance simulator (ARCHITECTURE.md §14): bots play many games with the
 * config and the report shows whether good play pays and careless play doesn't.
 *
 *   npm run balance                      # 500 games per strategy and length
 *   npm run balance -- --games 2000 --days 14,30
 *   npm run balance -- --config path/to/other-config.json
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { describeIssue, loadConfig } from '../src/config/loadConfig';
import type { StrategyStats } from './stats';
import { outlookCheck, simulate } from './stats';
import { STRATEGIES } from './bots';

const dollars = (cents: number) => (cents / 100).toFixed(2).padStart(8);
const pct = (x: number) => `${Math.round(x * 100)} %`.padStart(6);

function printTable(stats: StrategyStats[], startingCash: number): void {
  console.log(
    `\n${stats[0]?.days ?? '?'} jours — départ ${dollars(startingCash).trim()} $ — ${stats[0]?.games ?? 0} parties par stratégie`,
  );
  console.log(
    'stratégie     caisse p10  médiane    p90   bénéfice méd.  fin tôt  gaspillage  servis',
  );
  for (const s of stats) {
    console.log(
      [
        s.strategy.padEnd(12),
        dollars(s.finalCash.p10),
        dollars(s.finalCash.median),
        dollars(s.finalCash.p90),
        dollars(s.totalProfitMedian).padStart(13),
        pct(s.earlyEndRate).padStart(8),
        pct(s.wasteRate).padStart(11),
        pct(s.serviceRate).padStart(7),
      ].join(' '),
    );
  }
}

function main(): void {
  const { values } = parseArgs({
    options: {
      games: { type: 'string', default: '500' },
      days: { type: 'string', default: '14,30,60' },
      config: { type: 'string', default: 'config/game-config.json' },
      json: { type: 'boolean', default: false },
    },
  });
  const raw: unknown = JSON.parse(readFileSync(values.config, 'utf-8'));
  const loaded = loadConfig(raw);
  if (!loaded.ok) {
    console.error(loaded.issues.map(describeIssue).join('\n'));
    process.exit(1);
  }
  const games = Number(values.games);
  const lengths = values.days.split(',').map(Number);
  const all = lengths.map((days) => simulate(loaded.config, games, days));
  if (values.json) {
    console.log(JSON.stringify(all.flat(), null, 2));
    return;
  }
  console.log('Stratégies :');
  for (const s of STRATEGIES) console.log(`  ${s.name.padEnd(12)} ${s.description}`);
  for (const stats of all) printTable(stats, loaded.config.game.starting_cash);

  console.log('\nAffluence prévue → clients réellement venus (stratégie malin)');
  for (const row of outlookCheck(loaded.config, Math.min(games, 300), 14)) {
    console.log(
      `  ${row.outlook.padEnd(8)} ${pct(row.share)} des jours, ${row.meanVisitors.toFixed(1)} clients en moyenne`,
    );
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  main();
}
