import { gameConfigSchema, type GameConfig } from './schema';

export interface ConfigIssue {
  /** Location in the JSON file, e.g. `supplies.lemons.minimum_price_per_package`. */
  path: string;
  message: string;
}

export type ConfigResult = { ok: true; config: GameConfig } | { ok: false; issues: ConfigIssue[] };

/** Validates raw JSON and converts money from dollars to cents (ARCHITECTURE.md §8). */
export function loadConfig(raw: unknown): ConfigResult {
  const parsed = gameConfigSchema.safeParse(raw);
  if (parsed.success) return { ok: true, config: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: formatPath(issue.path),
      message: issue.message,
    })),
  };
}

export function formatPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const key of path) {
    if (typeof key === 'number') out += `[${key}]`;
    else out += out ? `.${String(key)}` : String(key);
  }
  return out;
}

/** One readable line, e.g. « supplies.lemons.minimum_price_per_package : le prix minimum… ». */
export function describeIssue(issue: ConfigIssue): string {
  return issue.path ? `${issue.path} : ${issue.message}` : issue.message;
}
