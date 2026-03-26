import { describe, it, expect } from 'vitest';
import {
  TIER_ORDER_ASC,
  TIER_ORDER_DESC,
  APEX_TIERS,
  TIER_CONFIG,
  HISTORICAL_YEARS,
} from '../tiers';
import type { TierName } from '../types';

describe('TIER_ORDER_ASC', () => {
  it('starts with IRON and ends with CHALLENGER', () => {
    expect(TIER_ORDER_ASC[0]).toBe('IRON');
    expect(TIER_ORDER_ASC[TIER_ORDER_ASC.length - 1]).toBe('CHALLENGER');
  });

  it('contains all 10 tiers', () => {
    expect(TIER_ORDER_ASC.length).toBe(10);
  });

  it('is in correct ascending order', () => {
    const expected: TierName[] = [
      'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
      'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER',
    ];
    expect(TIER_ORDER_ASC).toEqual(expected);
  });
});

describe('TIER_ORDER_DESC', () => {
  it('is the exact reverse of TIER_ORDER_ASC', () => {
    const reversed = [...TIER_ORDER_ASC].reverse();
    expect(TIER_ORDER_DESC).toEqual(reversed);
  });

  it('starts with CHALLENGER and ends with IRON', () => {
    expect(TIER_ORDER_DESC[0]).toBe('CHALLENGER');
    expect(TIER_ORDER_DESC[TIER_ORDER_DESC.length - 1]).toBe('IRON');
  });
});

describe('APEX_TIERS', () => {
  it('contains exactly MASTER, GRANDMASTER, and CHALLENGER', () => {
    expect(APEX_TIERS.size).toBe(3);
    expect(APEX_TIERS.has('MASTER')).toBe(true);
    expect(APEX_TIERS.has('GRANDMASTER')).toBe(true);
    expect(APEX_TIERS.has('CHALLENGER')).toBe(true);
  });

  it('does not contain standard tiers', () => {
    const standardTiers: TierName[] = [
      'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND',
    ];
    for (const tier of standardTiers) {
      expect(APEX_TIERS.has(tier)).toBe(false);
    }
  });
});

describe('TIER_CONFIG', () => {
  it('has entries for all tiers in TIER_ORDER_ASC', () => {
    for (const tier of TIER_ORDER_ASC) {
      expect(TIER_CONFIG[tier]).toBeDefined();
    }
  });

  it('each entry has a color and label', () => {
    for (const tier of TIER_ORDER_ASC) {
      const config = TIER_CONFIG[tier];
      expect(config.color).toBeTruthy();
      expect(config.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(config.label).toBeTruthy();
      expect(typeof config.label).toBe('string');
    }
  });

  it('has labels matching tier names in title case', () => {
    expect(TIER_CONFIG.IRON.label).toBe('Iron');
    expect(TIER_CONFIG.BRONZE.label).toBe('Bronze');
    expect(TIER_CONFIG.SILVER.label).toBe('Silver');
    expect(TIER_CONFIG.GOLD.label).toBe('Gold');
    expect(TIER_CONFIG.PLATINUM.label).toBe('Platinum');
    expect(TIER_CONFIG.EMERALD.label).toBe('Emerald');
    expect(TIER_CONFIG.DIAMOND.label).toBe('Diamond');
    expect(TIER_CONFIG.MASTER.label).toBe('Master');
    expect(TIER_CONFIG.GRANDMASTER.label).toBe('Grandmaster');
    expect(TIER_CONFIG.CHALLENGER.label).toBe('Challenger');
  });
});

describe('HISTORICAL_YEARS', () => {
  it('is sorted in ascending order', () => {
    for (let i = 1; i < HISTORICAL_YEARS.length; i++) {
      expect(HISTORICAL_YEARS[i]).toBeGreaterThan(HISTORICAL_YEARS[i - 1]);
    }
  });

  it('contains consecutive years from 2019 to 2026', () => {
    expect(HISTORICAL_YEARS[0]).toBe(2019);
    expect(HISTORICAL_YEARS[HISTORICAL_YEARS.length - 1]).toBe(2026);
    expect(HISTORICAL_YEARS.length).toBe(8);
  });
});
