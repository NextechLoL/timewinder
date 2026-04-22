import { useState, useMemo, useCallback } from 'react';
import type { Region, TierName } from '../../data/types';
import { TIER_ORDER_DESC, TIER_CONFIG, APEX_TIERS } from '../../data/tiers';
import {
  getSnapshot,
  getSnapshotUpdatedAt,
  formatUpdatedAt,
  groupByTier,
  computeTopPercent,
  totalPlayers,
} from '../../data';
import { BarChart } from '../BarChart';
import type { BarGroup } from '../BarChart';
import { TierFilterPills } from '../TierFilterPills';
import { Tooltip } from '../Tooltip';

type ScaleMode = 'global' | 'local';

function fmtTopPct(pct: number): string {
  if (pct < 0.01) return `Top ${pct.toFixed(4)}%`;
  if (pct < 0.1) return `Top ${pct.toFixed(3)}%`;
  return `Top ${pct.toFixed(2)}%`;
}

interface SnapshotViewProps {
  region: Region;
}

export function SnapshotView({ region }: SnapshotViewProps) {
  const [scaleMode, setScaleMode] = useState<ScaleMode>('local');
  const [activeTiers, setActiveTiers] = useState<Set<TierName>>(
    () => new Set(APEX_TIERS),
  );
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    title: string;
    rows: Array<{ label: string; value: string }>;
    x: number;
    y: number;
  }>({ visible: false, title: '', rows: [], x: 0, y: 0 });

  const data = useMemo(() => getSnapshot(region), [region]);
  const grouped = useMemo(() => groupByTier(data), [data]);
  const topPct = useMemo(() => computeTopPercent(data), [data]);
  const total = useMemo(() => totalPlayers(data), [data]);
  const updatedAt = useMemo(
    () => formatUpdatedAt(getSnapshotUpdatedAt(region)),
    [region],
  );

  const globalMax = useMemo(
    () => Math.max(...data.map(e => e.playerCount)),
    [data],
  );

  const barGroups = useMemo((): BarGroup[] => {
    return TIER_ORDER_DESC.filter(tier => activeTiers.has(tier))
      .map(tier => {
        const entries = grouped.get(tier) ?? [];
        const tierTotal = entries.reduce((sum, e) => sum + e.playerCount, 0);

        const refMax = scaleMode === 'global' ? globalMax : tierTotal;

        return {
          tier,
          scaleMax: refMax,
          rows: entries.map(entry => {
            const key = `${tier}__${entry.bracket}`;
            const top = topPct.get(key) ?? 0;
            const share = (entry.playerCount / total) * 100;

            return {
              label: entry.bracket,
              value: entry.playerCount,
              countText: entry.playerCount.toLocaleString(),
              shareText: `${share.toFixed(2)}%`,
              topText: fmtTopPct(top),
            };
          }),
        };
      });
  }, [activeTiers, grouped, topPct, total, globalMax, scaleMode, data]);

  const handleBarHover = useCallback(
    (tier: TierName, label: string, e: React.MouseEvent) => {
      const entry = (grouped.get(tier) ?? []).find(r => r.bracket === label);
      if (!entry) return;
      const key = `${tier}__${label}`;
      const top = topPct.get(key) ?? 0;
      const share = (entry.playerCount / total) * 100;

      setTooltip({
        visible: true,
        title: `${TIER_CONFIG[tier].label} ${label}`,
        rows: [
          { label: 'Players', value: entry.playerCount.toLocaleString() },
          { label: 'Top %', value: fmtTopPct(top) },
          { label: 'Share of ladder', value: `${share.toFixed(3)}%` },
        ],
        x: e.clientX,
        y: e.clientY,
      });
    },
    [grouped, topPct, total],
  );

  const handleBarLeave = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false }));
  }, []);

  const toggleTier = useCallback((tier: TierName) => {
    setActiveTiers(prev => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }, []);

  const showAllTiers = useCallback(() => {
    setActiveTiers(prev =>
      prev.size === TIER_ORDER_DESC.length ? new Set() : new Set(TIER_ORDER_DESC),
    );
  }, []);

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          Ladder Distribution ({region === 'EU' ? 'EUW' : 'NA'})
        </div>
        <div className="total-badge">{total.toLocaleString()} players total</div>
      </div>
      <div className="page-sub">Updated {updatedAt}</div>

      <TierFilterPills
        tierOrder={TIER_ORDER_DESC}
        activeTiers={activeTiers}
        onToggle={toggleTier}
        onShowAll={showAllTiers}
      />

      <div className="controls">
        <span className="control-label">Bar Scale</span>
        <button
          className={`pill-btn${scaleMode === 'local' ? ' active' : ''}`}
          onClick={() => setScaleMode('local')}
        >
          Per Tier
        </button>
        <button
          className={`pill-btn${scaleMode === 'global' ? ' active' : ''}`}
          onClick={() => setScaleMode('global')}
        >
          Global
        </button>
      </div>

      <div className="chart-card">
        <BarChart
          groups={barGroups}
          scaleMode={scaleMode}
          onBarHover={handleBarHover}
          onBarLeave={handleBarLeave}
        />
      </div>

      <Tooltip
        visible={tooltip.visible}
        title={tooltip.title}
        rows={tooltip.rows}
        mouseX={tooltip.x}
        mouseY={tooltip.y}
      />
    </>
  );
}
