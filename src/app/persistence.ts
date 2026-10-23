import type { GameState } from '../core/types';

/**
 * Autosave and preferences in localStorage (ARCHITECTURE.md §12). Every
 * project page on <owner>.github.io shares the same storage, so keys are prefixed.
 * Storage can be missing or full (private mode): every access is guarded and the
 * game simply plays without saving.
 */
const SAVE_KEY = 'limonade.save.v1';
const PREFERENCES_KEY = 'limonade.preferences.v1';
export const SAVE_VERSION = 1;

interface SaveFile {
  version: number;
  /** A save made with different balance values would not make sense: it is ignored. */
  configFingerprint: string;
  savedAt: string;
  game: GameState;
}

export interface Preferences {
  /** Show Citronnelle's step-by-step tips on the first day. */
  conseils: boolean;
}

const DEFAULT_PREFERENCES: Preferences = { conseils: true };

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Short, stable hash (djb2) of a JSON value. */
export function fingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

function looksLikeGame(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Partial<GameState>;
  return (
    typeof g.day === 'number' &&
    typeof g.totalDays === 'number' &&
    typeof g.cash === 'number' &&
    typeof g.phase === 'string' &&
    Array.isArray(g.history) &&
    typeof g.inventory === 'object' &&
    g.inventory !== null
  );
}

export function saveGame(game: GameState, configFingerprint: string): void {
  const file: SaveFile = {
    version: SAVE_VERSION,
    configFingerprint,
    savedAt: new Date().toISOString(),
    game,
  };
  try {
    storage()?.setItem(SAVE_KEY, JSON.stringify(file));
  } catch {
    // Full or blocked storage: keep playing without a save.
  }
}

export function loadGame(configFingerprint: string): GameState | null {
  try {
    const raw = storage()?.getItem(SAVE_KEY);
    if (!raw) return null;
    const file = JSON.parse(raw) as Partial<SaveFile>;
    if (file.version !== SAVE_VERSION || file.configFingerprint !== configFingerprint) return null;
    if (!looksLikeGame(file.game) || file.game.phase === 'FIN') return null;
    return file.game;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function loadPreferences(): Preferences {
  try {
    const raw = storage()?.getItem(PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return { conseils: typeof parsed.conseils === 'boolean' ? parsed.conseils : true };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(preferences: Preferences): void {
  try {
    storage()?.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences are a convenience; ignore failures.
  }
}
