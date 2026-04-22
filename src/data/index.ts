import type { SnapshotEntry, HistoricalEntry, Region, TierName } from './types';
import { data as naSnapshot, updatedAt as naSnapshotUpdatedAt } from './generated/na-snapshot';
import { data as euSnapshot, updatedAt as euSnapshotUpdatedAt } from './generated/eu-snapshot';
import { data as naHistorical, updatedAt as naHistoricalUpdatedAt } from './generated/na-historical';
import { data as euHistorical, updatedAt as euHistoricalUpdatedAt } from './generated/eu-historical';
import { APEX_TIERS } from './tiers';

export type { SnapshotEntry, HistoricalEntry, Region, TierName };

export function getSnapshot(region: Region): SnapshotEntry[] {
  return region === 'NA' ? naSnapshot : euSnapshot;
}

export function getHistorical(region: Region): HistoricalEntry[] {
  return region === 'NA' ? naHistorical : euHistorical;
}

export function getSnapshotUpdatedAt(region: Region): string {
  return region === 'NA' ? naSnapshotUpdatedAt : euSnapshotUpdatedAt;
}

export function getHistoricalUpdatedAt(region: Region): string {
  return region === 'NA' ? naHistoricalUpdatedAt : euHistoricalUpdatedAt;
}

export function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Group snapshot entries by tier, sorting highest first (apex: LP desc, standard: I→IV) */
export function groupByTier(entries: SnapshotEntry[]): Map<TierName, SnapshotEntry[]> {
  const map = new Map<TierName, SnapshotEntry[]>();
  for (const entry of entries) {
    if (!map.has(entry.tier)) map.set(entry.tier, []);
    map.get(entry.tier)!.push(entry);
  }
  for (const tier of APEX_TIERS) {
    const group = map.get(tier);
    if (group) {
      group.sort((a, b) => parseInt(b.bracket) - parseInt(a.bracket));
    }
  }
  // Reverse standard tiers so I (highest) appears first
  for (const [tier, group] of map) {
    if (!APEX_TIERS.has(tier)) group.reverse();
  }
  return map;
}

/** Compute top% for each snapshot entry. Returns a Map keyed by "TIER__bracket" */
export function computeTopPercent(entries: SnapshotEntry[]): Map<string, number> {
  const total = entries.reduce((sum, e) => sum + e.playerCount, 0);

  // Sort high to low: Challenger highest LP first, down to Iron IV
  const tierRank: Record<string, number> = {
    CHALLENGER: 9, GRANDMASTER: 8, MASTER: 7, DIAMOND: 6,
    EMERALD: 5, PLATINUM: 4, GOLD: 3, SILVER: 2, BRONZE: 1, IRON: 0,
  };
  const divRank: Record<string, number> = { I: 3, II: 2, III: 1, IV: 0 };

  const sorted = [...entries].sort((a, b) => {
    const tierDiff = tierRank[b.tier] - tierRank[a.tier];
    if (tierDiff !== 0) return tierDiff;
    // Within same tier
    if (APEX_TIERS.has(a.tier)) {
      return parseInt(b.bracket) - parseInt(a.bracket);
    }
    return (divRank[b.bracket] ?? 0) - (divRank[a.bracket] ?? 0);
  });

  const result = new Map<string, number>();
  let cumulative = 0;
  for (const entry of sorted) {
    cumulative += entry.playerCount;
    result.set(`${entry.tier}__${entry.bracket}`, (cumulative / total) * 100);
  }
  return result;
}

/** Total player count */
export function totalPlayers(entries: SnapshotEntry[]): number {
  return entries.reduce((sum, e) => sum + e.playerCount, 0);
}

/** Total per tier */
export function tierTotals(entries: SnapshotEntry[]): Map<TierName, number> {
  const map = new Map<TierName, number>();
  for (const entry of entries) {
    map.set(entry.tier, (map.get(entry.tier) ?? 0) + entry.playerCount);
  }
  return map;
}
