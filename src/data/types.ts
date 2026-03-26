export type TierName =
  | 'IRON' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'
  | 'EMERALD' | 'DIAMOND' | 'MASTER' | 'GRANDMASTER' | 'CHALLENGER';

export type Region = 'NA' | 'EU';

export interface SnapshotEntry {
  tier: TierName;
  bracket: string;      // "IV","III","II","I" or "0LP","100LP", etc.
  playerCount: number;
}

export interface HistoricalEntry {
  tier: TierName;
  division: string | null;  // null for Challenger/GM/Master
  label: string;            // "Diamond II", "Master", etc.
  percentages: Record<number, number | null>;  // year → pct, null = didn't exist
}

export interface TierConfig {
  color: string;
  label: string;
}
