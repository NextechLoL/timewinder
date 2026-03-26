import { describe, it, expect, vi } from 'vitest';
import type { SnapshotEntry, TierName } from '../types';

// Mock the generated data modules so tests don't depend on CSV conversion
vi.mock('../generated/na-snapshot', () => ({ data: [] }));
vi.mock('../generated/eu-snapshot', () => ({ data: [] }));
vi.mock('../generated/na-historical', () => ({ data: [] }));
vi.mock('../generated/eu-historical', () => ({ data: [] }));

import { groupByTier, computeTopPercent, totalPlayers, tierTotals } from '../index';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function snap(tier: TierName, bracket: string, playerCount: number): SnapshotEntry {
  return { tier, bracket, playerCount };
}

/* ------------------------------------------------------------------ */
/*  groupByTier                                                       */
/* ------------------------------------------------------------------ */

describe('groupByTier', () => {
  it('returns an empty map for an empty array', () => {
    const result = groupByTier([]);
    expect(result.size).toBe(0);
  });

  it('groups entries by tier', () => {
    const entries: SnapshotEntry[] = [
      snap('GOLD', 'IV', 100),
      snap('GOLD', 'III', 80),
      snap('SILVER', 'I', 50),
    ];
    const result = groupByTier(entries);
    expect(result.size).toBe(2);
    expect(result.get('GOLD')!.length).toBe(2);
    expect(result.get('SILVER')!.length).toBe(1);
  });

  it('sorts apex tier entries by LP descending', () => {
    const entries: SnapshotEntry[] = [
      snap('CHALLENGER', '100', 5),
      snap('CHALLENGER', '500', 2),
      snap('CHALLENGER', '250', 3),
    ];
    const result = groupByTier(entries);
    const challengers = result.get('CHALLENGER')!;
    expect(challengers.map((e) => e.bracket)).toEqual(['500', '250', '100']);
  });

  it('sorts MASTER and GRANDMASTER by LP descending', () => {
    const entries: SnapshotEntry[] = [
      snap('MASTER', '0', 50),
      snap('MASTER', '200', 10),
      snap('GRANDMASTER', '300', 5),
      snap('GRANDMASTER', '700', 2),
    ];
    const result = groupByTier(entries);
    expect(result.get('MASTER')!.map((e) => e.bracket)).toEqual(['200', '0']);
    expect(result.get('GRANDMASTER')!.map((e) => e.bracket)).toEqual(['700', '300']);
  });

  it('reverses standard tier entries so division I appears first', () => {
    // Standard tiers are inserted in IV→I order (typical CSV order)
    const entries: SnapshotEntry[] = [
      snap('GOLD', 'IV', 200),
      snap('GOLD', 'III', 150),
      snap('GOLD', 'II', 100),
      snap('GOLD', 'I', 50),
    ];
    const result = groupByTier(entries);
    const gold = result.get('GOLD')!;
    // After reverse, I should be first
    expect(gold.map((e) => e.bracket)).toEqual(['I', 'II', 'III', 'IV']);
  });

  it('handles a mix of apex and standard tiers', () => {
    const entries: SnapshotEntry[] = [
      snap('IRON', 'IV', 300),
      snap('IRON', 'III', 250),
      snap('CHALLENGER', '100', 5),
      snap('CHALLENGER', '400', 2),
      snap('DIAMOND', 'IV', 80),
      snap('DIAMOND', 'I', 20),
    ];
    const result = groupByTier(entries);

    // Apex: LP descending
    expect(result.get('CHALLENGER')!.map((e) => e.bracket)).toEqual(['400', '100']);

    // Standard: reversed (I first)
    expect(result.get('IRON')!.map((e) => e.bracket)).toEqual(['III', 'IV']);
    expect(result.get('DIAMOND')!.map((e) => e.bracket)).toEqual(['I', 'IV']);
  });

  it('handles a single entry', () => {
    const entries: SnapshotEntry[] = [snap('MASTER', '150', 10)];
    const result = groupByTier(entries);
    expect(result.size).toBe(1);
    expect(result.get('MASTER')!.length).toBe(1);
    expect(result.get('MASTER')![0].bracket).toBe('150');
  });
});

/* ------------------------------------------------------------------ */
/*  computeTopPercent                                                 */
/* ------------------------------------------------------------------ */

describe('computeTopPercent', () => {
  it('returns an empty map for an empty array', () => {
    const result = computeTopPercent([]);
    expect(result.size).toBe(0);
  });

  it('computes cumulative top percent from highest tier down', () => {
    const entries: SnapshotEntry[] = [
      snap('CHALLENGER', '500', 10),
      snap('DIAMOND', 'I', 40),
      snap('GOLD', 'I', 50),
    ];
    const result = computeTopPercent(entries);
    // Total = 100
    // Challenger 500 is first: 10/100 = 10%
    expect(result.get('CHALLENGER__500')).toBeCloseTo(10);
    // Diamond I next: (10+40)/100 = 50%
    expect(result.get('DIAMOND__I')).toBeCloseTo(50);
    // Gold I last: (10+40+50)/100 = 100%
    expect(result.get('GOLD__I')).toBeCloseTo(100);
  });

  it('orders same-tier standard divisions correctly (I before II before III before IV)', () => {
    const entries: SnapshotEntry[] = [
      snap('SILVER', 'IV', 40),
      snap('SILVER', 'III', 30),
      snap('SILVER', 'II', 20),
      snap('SILVER', 'I', 10),
    ];
    const result = computeTopPercent(entries);
    // Total = 100
    // I first: 10% cumulative
    expect(result.get('SILVER__I')).toBeCloseTo(10);
    // II: 30%
    expect(result.get('SILVER__II')).toBeCloseTo(30);
    // III: 60%
    expect(result.get('SILVER__III')).toBeCloseTo(60);
    // IV: 100%
    expect(result.get('SILVER__IV')).toBeCloseTo(100);
  });

  it('orders apex tiers by LP descending within the same tier', () => {
    const entries: SnapshotEntry[] = [
      snap('MASTER', '0', 50),
      snap('MASTER', '200', 30),
      snap('MASTER', '100', 20),
    ];
    const result = computeTopPercent(entries);
    // Total = 100
    // 200 LP first: 30%
    expect(result.get('MASTER__200')).toBeCloseTo(30);
    // 100 LP next: 50%
    expect(result.get('MASTER__100')).toBeCloseTo(50);
    // 0 LP last: 100%
    expect(result.get('MASTER__0')).toBeCloseTo(100);
  });

  it('correctly orders tiers from highest to lowest', () => {
    const entries: SnapshotEntry[] = [
      snap('IRON', 'IV', 50),
      snap('CHALLENGER', '900', 5),
      snap('GRANDMASTER', '600', 10),
      snap('GOLD', 'I', 35),
    ];
    const result = computeTopPercent(entries);
    // Total = 100
    // Challenger first: 5%
    expect(result.get('CHALLENGER__900')).toBeCloseTo(5);
    // Grandmaster: 15%
    expect(result.get('GRANDMASTER__600')).toBeCloseTo(15);
    // Gold I: 50%
    expect(result.get('GOLD__I')).toBeCloseTo(50);
    // Iron IV: 100%
    expect(result.get('IRON__IV')).toBeCloseTo(100);
  });

  it('handles a single entry as 100%', () => {
    const entries: SnapshotEntry[] = [snap('BRONZE', 'II', 999)];
    const result = computeTopPercent(entries);
    expect(result.get('BRONZE__II')).toBeCloseTo(100);
  });
});

/* ------------------------------------------------------------------ */
/*  totalPlayers                                                      */
/* ------------------------------------------------------------------ */

describe('totalPlayers', () => {
  it('returns 0 for an empty array', () => {
    expect(totalPlayers([])).toBe(0);
  });

  it('sums all player counts', () => {
    const entries: SnapshotEntry[] = [
      snap('GOLD', 'I', 100),
      snap('GOLD', 'II', 200),
      snap('SILVER', 'I', 50),
    ];
    expect(totalPlayers(entries)).toBe(350);
  });

  it('returns the count for a single entry', () => {
    expect(totalPlayers([snap('IRON', 'IV', 42)])).toBe(42);
  });
});

/* ------------------------------------------------------------------ */
/*  tierTotals                                                        */
/* ------------------------------------------------------------------ */

describe('tierTotals', () => {
  it('returns an empty map for an empty array', () => {
    const result = tierTotals([]);
    expect(result.size).toBe(0);
  });

  it('sums player counts per tier', () => {
    const entries: SnapshotEntry[] = [
      snap('GOLD', 'I', 100),
      snap('GOLD', 'II', 200),
      snap('SILVER', 'I', 50),
      snap('SILVER', 'IV', 70),
    ];
    const result = tierTotals(entries);
    expect(result.get('GOLD')).toBe(300);
    expect(result.get('SILVER')).toBe(120);
  });

  it('handles a single tier', () => {
    const entries: SnapshotEntry[] = [
      snap('MASTER', '100', 20),
      snap('MASTER', '200', 30),
    ];
    const result = tierTotals(entries);
    expect(result.size).toBe(1);
    expect(result.get('MASTER')).toBe(50);
  });

  it('handles a single entry', () => {
    const result = tierTotals([snap('CHALLENGER', '900', 5)]);
    expect(result.size).toBe(1);
    expect(result.get('CHALLENGER')).toBe(5);
  });
});
