import type { CloudState, SupplyId } from '../config/schema';

export type { CloudState, SupplyId };

/** Money in integer cents. Cost bases may hold fractional cents until they are reported. */
export type Cents = number;

export const SUPPLIES = ['lemons', 'sugar', 'ice', 'cups'] as const satisfies readonly SupplyId[];

/** Sky states from clearest to darkest. */
export const CLOUD_ORDER = [
  'soleil',
  'nuageux',
  'couvert',
] as const satisfies readonly CloudState[];

export const TIME_SLOTS = ['matin', 'midi', 'apres-midi', 'soir'] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

export type Phase = 'METEO' | 'MAGASIN' | 'RECETTE' | 'JOURNEE' | 'BILAN' | 'FIN';
export const PLANNING_PHASES: readonly Phase[] = ['METEO', 'MAGASIN', 'RECETTE'];

export interface Weather {
  temperatureC: number;
  cloud: CloudState;
  /** Consecutive slots affected by rain; empty when it stays dry. */
  rainSlots: TimeSlot[];
}

export type TrafficOutlook = 'faible' | 'moyenne' | 'forte';

export interface Forecast {
  temperatureC: number;
  cloud: CloudState;
  /** 0..1, rounded to 10 %. */
  rainChance: number;
  rainLikelySlot: TimeSlot | null;
  trafficOutlook: TrafficOutlook;
}

export interface LemonBatch {
  qty: number;
  ageDays: number;
  /** Cost per lemon. */
  unitCost: Cents;
}

export interface StockLine {
  qty: number;
  /** Weighted average cost per unit. */
  unitCost: Cents;
}

export interface Inventory {
  lemons: LemonBatch[];
  sugar: StockLine;
  ice: StockLine;
  cups: StockLine;
  /** Servings of prepared lemonade (kept overnight only if the config allows it). */
  lemonade: StockLine;
}

export type InventoryCounts = Record<SupplyId, number>;

export interface Recipe {
  lemons: number;
  sugar: number;
  ice: number;
}

export interface DayPlan {
  recipe: Recipe;
  pitchers: number;
  pricePerCup: Cents;
}

export type Prices = Record<SupplyId, Cents>;

export interface MarketNews {
  /** Event id from the config, e.g. RECOLTE_CITRONS. */
  id: string;
  supply: SupplyId;
  direction: 'hausse' | 'baisse';
}

export type TasteIssue =
  | 'PAS_ASSEZ_CITRON'
  | 'TROP_ACIDE'
  | 'PAS_ASSEZ_SUCRE'
  | 'TROP_SUCRE'
  | 'PAS_ASSEZ_FRAIS'
  | 'TROP_DE_GLACE';

export type DeclineReason = 'TROP_CHER' | 'PAS_BON' | 'PAS_SOIF';
export type MissReason = 'MANQUE_LIMONADE' | 'MANQUE_GOBELETS';

/** Timeline of one selling day; `t` goes from 0 (opening) to 1 (closing). */
export type DayEvent =
  | { t: number; type: 'visitor'; id: number; outcome: 'buy' }
  | { t: number; type: 'visitor'; id: number; outcome: 'decline'; reason: DeclineReason }
  | { t: number; type: 'visitor'; id: number; outcome: 'missed'; reason: MissReason }
  | { t: number; type: 'rain_start' }
  | { t: number; type: 'rain_stop' }
  | { t: number; type: 'sold_out'; what: 'limonade' | 'gobelets' };

export type FeedbackCode =
  | 'RUPTURE_LIMONADE'
  | 'RUPTURE_GOBELETS'
  | 'PRIX_TROP_ELEVE'
  | 'PRIX_BAS'
  | TasteIssue
  | 'DELICIEUX'
  | 'GASPILLAGE_LIMONADE'
  | 'CITRONS_POURRIS'
  | 'PLUIE';

export interface FeedbackItem {
  code: FeedbackCode;
  /** Number of customers or items concerned, when relevant. */
  count?: number;
  /** Moment of the day (0..1), e.g. when the stand ran out. */
  t?: number;
}

export interface DayRecord {
  day: number;
  forecast: Forecast;
  actual: Weather;
  prices: Prices;
  plan: DayPlan;
  quality: number;
  potentialCustomers: number;
  cupsSold: number;
  missedSales: number;
  declined: number;
  revenue: Cents;
  supplySpending: Cents;
  /** revenue − supplySpending. Not profit (spec §8). */
  cashChange: Cents;
  /** Cost of the servings and cups that were sold. */
  costOfGoodsUsed: Cents;
  /** Cost of discarded lemonade, melted ice and spoiled lemons. */
  wasteCost: Cents;
  /** revenue − costOfGoodsUsed − wasteCost (« Bénéfice »). */
  profit: Cents;
  servingsMade: number;
  waste: { servingsDiscarded: number; iceMelted: number; lemonsSpoiled: number };
  feedback: FeedbackItem[];
  cashAfter: Cents;
  inventoryAfter: InventoryCounts;
}

export interface GameState {
  seed: number;
  rngState: number;
  phase: Phase;
  day: number;
  totalDays: number;
  startingCash: Cents;
  /** Cost value of the starting inventory, for the end-of-game equation. */
  startingStockValue: Cents;
  cash: Cents;
  totalProfit: Cents;
  inventory: Inventory;
  prices: Prices;
  previousPrices: Prices | null;
  marketNews: MarketNews[];
  forecast: Forecast;
  /** Actual weather of the upcoming day; the UI must not show it before closing. */
  weatherHidden: Weather;
  plan: DayPlan;
  todaySpending: Cents;
  history: DayRecord[];
  /** Set while phase is JOURNEE or BILAN: the day just played. */
  currentDay: { record: DayRecord; events: DayEvent[] } | null;
  endReason: 'DERNIER_JOUR' | 'PLUS_POSSIBLE' | null;
}

export type ActionError =
  | 'PHASE_INVALIDE'
  | 'QUANTITE_INVALIDE'
  | 'ARGENT_INSUFFISANT'
  | 'RECETTE_INVALIDE'
  | 'PRIX_INVALIDE'
  | 'PICHETS_INVALIDES'
  | 'AUCUN_PICHET'
  | 'INGREDIENTS_INSUFFISANTS';

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: ActionError };
