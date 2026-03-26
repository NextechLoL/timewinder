import type { TierName } from '../data/types';
import { TIER_CONFIG } from '../data/tiers';

interface TierFilterPillsProps {
  tierOrder: TierName[];
  activeTiers: Set<TierName>;
  onToggle: (tier: TierName) => void;
  onShowAll: () => void;
  tierCounts?: Map<TierName, number>;
}

export function TierFilterPills({
  tierOrder,
  activeTiers,
  onToggle,
  onShowAll,
  tierCounts,
}: TierFilterPillsProps) {
  const allActive = activeTiers.size === tierOrder.length;
  const noneActive = activeTiers.size === 0;

  return (
    <div className="tier-pills" role="group" aria-label="Tier filter">
      <span className="control-label">Tier</span>
      <button
        className={`tier-pill${allActive ? ' active' : ''}`}
        style={allActive ? { background: '#271F2A' } : undefined}
        onClick={onShowAll}
        aria-pressed={allActive}
      >
        <span
          className="tier-dot"
          style={allActive ? undefined : { background: '#271F2A', opacity: noneActive ? 0.2 : 0.35 }}
        />
        All Tiers
      </button>

      {tierOrder.map(tier => {
        const cfg = TIER_CONFIG[tier];
        const isActive = activeTiers.has(tier);
        const count = tierCounts?.get(tier);

        return (
          <button
            key={tier}
            className={`tier-pill${isActive ? ' active' : ''}`}
            style={isActive ? { background: cfg.color } : undefined}
            onClick={() => onToggle(tier)}
            aria-pressed={isActive}
          >
            <span
              className="tier-dot"
              style={isActive ? undefined : { background: cfg.color }}
            />
            {cfg.label}
            {count != null && (
              <span className="tier-pill-count">
                {count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
