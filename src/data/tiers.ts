import type { TierName, TierConfig } from './types';

export const TIER_CONFIG: Record<TierName, TierConfig> = {
  IRON:        { color: '#817784', label: 'Iron' },
  BRONZE:      { color: '#D76339', label: 'Bronze' },
  SILVER:      { color: '#9E9A92', label: 'Silver' },
  GOLD:        { color: '#D78D39', label: 'Gold' },
  PLATINUM:    { color: '#3E9F8E', label: 'Platinum' },
  EMERALD:     { color: '#48AD5E', label: 'Emerald' },
  DIAMOND:     { color: '#56A9CD', label: 'Diamond' },
  MASTER:      { color: '#9770B7', label: 'Master' },
  GRANDMASTER: { color: '#A63160', label: 'Grandmaster' },
  CHALLENGER:  { color: '#D78D39', label: 'Challenger' },
};

/** Low to high — used for snapshot view */
export const TIER_ORDER_ASC: TierName[] = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
  'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER',
];

/** High to low — used for historical views */
export const TIER_ORDER_DESC: TierName[] = [...TIER_ORDER_ASC].reverse();

export const APEX_TIERS: Set<TierName> = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);

export const HISTORICAL_YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
