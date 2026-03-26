import type { TierName } from '../data/types';
import { TIER_CONFIG } from '../data/tiers';

export interface BarRow {
  label: string;
  value: number;
  countText: string;
  shareText: string;
  topText: string;
}

export interface BarGroup {
  tier: TierName;
  rows: BarRow[];
  scaleMax: number;
  emergeFactor?: number;
}

interface BarChartProps {
  groups: BarGroup[];
  scaleMode?: 'global' | 'local';
  onBarHover?: (tier: TierName, label: string, e: React.MouseEvent) => void;
  onBarLeave?: () => void;
}

export function BarChart({ groups, scaleMode = 'global', onBarHover, onBarLeave }: BarChartProps) {
  return (
    <div role="list" aria-label="Rank distribution by tier">
      {groups.map(group => {
        const cfg = TIER_CONFIG[group.tier];

        return (
          <div key={group.tier} className="tier-group" role="listitem">
            <div className="tier-group-header">
              <div className="tier-group-label" style={{ color: cfg.color }}>
                {cfg.label}
              </div>
              {scaleMode === 'local' && (
                <div className="scale-badge">Tier scale</div>
              )}
              <div className="tier-group-line" />
            </div>

            {group.rows.map(row => {
              const barWidth = group.scaleMax > 0
                ? (row.value / group.scaleMax) * 100
                : 0;

              return (
                <div
                  key={row.label}
                  className="bar-row"
                  aria-label={`${row.label}: ${row.countText} players, ${row.shareText} share, ${row.topText}`}
                  onMouseMove={e => onBarHover?.(group.tier, row.label, e)}
                  onMouseLeave={onBarLeave}
                >
                  <div className="rank-label">{row.label}</div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${barWidth}%`, background: cfg.color }}
                    />
                  </div>
                  <div className="bar-stats">
                    <span className="bar-stat">{row.countText}</span>
                    <span className="bar-stat">{row.shareText}</span>
                    <span className="bar-stat">{row.topText}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
