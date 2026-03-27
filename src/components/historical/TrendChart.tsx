import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { Region, TierName } from '../../data/types';
import type { HistoricalEntry } from '../../data/types';
import { TIER_ORDER_DESC, TIER_CONFIG, HISTORICAL_YEARS, APEX_TIERS } from '../../data/tiers';
import { getHistorical } from '../../data';
import { TierFilterPills } from '../TierFilterPills';
import { Tooltip } from '../Tooltip';

const PADDING = { top: 24, right: 24, bottom: 44, left: 52 };
const HEIGHT = 440;

interface LineData {
  entry: HistoricalEntry;
  color: string;
  points: Array<{ x: number; y: number; value: number; yearIndex: number }>;
  pathD: string;
}

/** Aggregate divisions into one entry per tier (for non-apex tiers) */
function groupByTierEntries(entries: HistoricalEntry[]): HistoricalEntry[] {
  const result: HistoricalEntry[] = [];
  const tierMap = new Map<TierName, HistoricalEntry[]>();

  for (const entry of entries) {
    if (APEX_TIERS.has(entry.tier)) {
      result.push(entry);
    } else {
      if (!tierMap.has(entry.tier)) tierMap.set(entry.tier, []);
      tierMap.get(entry.tier)!.push(entry);
    }
  }

  for (const [tier, divEntries] of tierMap) {
    const percentages: Record<number, number | null> = {};
    for (const year of HISTORICAL_YEARS) {
      let sum: number | null = null;
      for (const e of divEntries) {
        const val = e.percentages[year];
        if (val != null) sum = (sum ?? 0) + val;
      }
      percentages[year] = sum;
    }
    result.push({
      tier,
      division: null,
      label: TIER_CONFIG[tier].label,
      percentages,
    });
  }

  return result;
}

function buildLines(
  entries: HistoricalEntry[],
  activeTiers: Set<TierName>,
  width: number,
  maxPct: number,
): LineData[] {
  const cW = width - PADDING.left - PADDING.right;
  const cH = HEIGHT - PADDING.top - PADDING.bottom;
  const xScale = (i: number) => PADDING.left + (i / (HISTORICAL_YEARS.length - 1)) * cW;
  const yScale = (v: number) => PADDING.top + cH - (v / maxPct) * cH;

  const lines: LineData[] = [];

  for (const entry of entries) {
    if (!activeTiers.has(entry.tier)) continue;
    const color = TIER_CONFIG[entry.tier].color;
    const points: LineData['points'] = [];

    HISTORICAL_YEARS.forEach((_, i) => {
      const val = entry.percentages[HISTORICAL_YEARS[i]];
      if (val != null) {
        points.push({ x: xScale(i), y: yScale(val), value: val, yearIndex: i });
      }
    });

    if (points.length < 2) continue;

    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');

    lines.push({ entry, color, points, pathD });
  }

  return lines;
}

interface TrendChartProps {
  region: Region;
  onViewChange: (view: 'distribution' | 'trend') => void;
}

export function TrendChart({ region, onViewChange }: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [activeTiers, setActiveTiers] = useState<Set<TierName>>(
    () => new Set(TIER_ORDER_DESC),
  );
  const [grouped, setGrouped] = useState(true);
  const [highlightedLabel, setHighlightedLabel] = useState<string | null>(null);
  const [soloLabel, setSoloLabel] = useState<string | null>(null);
  const [crosshairX, setCrosshairX] = useState<number | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    title: string;
    rows: Array<{ label: string; value: string }>;
    x: number;
    y: number;
  }>({ visible: false, title: '', rows: [], x: 0, y: 0 });

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  const rawData = useMemo(() => getHistorical(region), [region]);
  const data = useMemo(
    () => (grouped ? groupByTierEntries(rawData) : rawData),
    [rawData, grouped],
  );

  // Compute Y axis max
  const maxPct = useMemo(() => {
    let raw = 0;
    for (const entry of data) {
      if (!activeTiers.has(entry.tier)) continue;
      for (const year of HISTORICAL_YEARS) {
        const val = entry.percentages[year];
        if (val != null && val > raw) raw = val;
      }
    }
    const step = raw <= 6 ? 1 : raw <= 12 ? 2 : raw <= 20 ? 4 : 5;
    return Math.ceil(raw / step) * step;
  }, [data, activeTiers]);

  const lines = useMemo(
    () => buildLines(data, activeTiers, width, maxPct),
    [data, activeTiers, width, maxPct],
  );

  // Y-axis gridlines
  const yStep = maxPct <= 6 ? 1 : maxPct <= 12 ? 2 : maxPct <= 20 ? 4 : 5;
  const yTicks: number[] = [];
  for (let v = 0; v <= maxPct; v += yStep) yTicks.push(v);

  const cW = width - PADDING.left - PADDING.right;
  const cH = HEIGHT - PADDING.top - PADDING.bottom;
  const yScale = (v: number) => PADDING.top + cH - (v / maxPct) * cH;
  const xScale = (i: number) => PADDING.left + (i / (HISTORICAL_YEARS.length - 1)) * cW;

  const activeLabel = soloLabel ?? highlightedLabel;

  const handleLineEnter = useCallback(
    (label: string) => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
        leaveTimer.current = null;
      }
      if (!soloLabel) setHighlightedLabel(label);
    },
    [soloLabel],
  );

  const handleLineMove = useCallback(
    (line: LineData, e: React.MouseEvent<SVGPathElement>) => {
      const svg = e.currentTarget.closest('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (width / rect.width);

      // Find nearest year
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (const p of line.points) {
        const d = Math.abs(p.x - mx);
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = p.yearIndex;
        }
      }

      setCrosshairX(xScale(nearestIdx));

      const val = line.entry.percentages[HISTORICAL_YEARS[nearestIdx]];
      const rows: Array<{ label: string; value: string }> = [
        {
          label: String(HISTORICAL_YEARS[nearestIdx]),
          value: val != null ? `${val.toFixed(2)}%` : 'N/A',
        },
      ];

      // Delta vs previous year
      if (val != null) {
        for (let i = nearestIdx - 1; i >= 0; i--) {
          const prev = line.entry.percentages[HISTORICAL_YEARS[i]];
          if (prev != null) {
            const delta = val - prev;
            const sign = delta >= 0 ? '+' : '';
            rows.push({
              label: `vs ${HISTORICAL_YEARS[i]}`,
              value: `${sign}${delta.toFixed(2)}%`,
            });
            break;
          }
        }
      }

      setTooltip({
        visible: true,
        title: line.entry.label,
        rows,
        x: e.clientX,
        y: e.clientY,
      });
    },
    [width, xScale],
  );

  const handleLineLeave = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => {
      leaveTimer.current = null;
      if (!soloLabel) setHighlightedLabel(null);
      setCrosshairX(null);
      setTooltip(prev => ({ ...prev, visible: false }));
    }, 70);
  }, [soloLabel]);

  const handleLineClick = useCallback(
    (label: string) => {
      setSoloLabel(prev => (prev === label ? null : label));
      setHighlightedLabel(null);
    },
    [],
  );

  const toggleTier = useCallback((tier: TierName) => {
    setActiveTiers(prev => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
    setSoloLabel(null);
    setHighlightedLabel(null);
  }, []);

  const showAllTiers = useCallback(() => {
    setActiveTiers(prev =>
      prev.size === TIER_ORDER_DESC.length ? new Set() : new Set(TIER_ORDER_DESC),
    );
    setSoloLabel(null);
    setHighlightedLabel(null);
  }, []);

  return (
    <>
      <TierFilterPills
        tierOrder={TIER_ORDER_DESC}
        activeTiers={activeTiers}
        onToggle={toggleTier}
        onShowAll={showAllTiers}
      />

      <div className="controls">
        <span className="control-label">View</span>
        <button className="pill-btn" onClick={() => onViewChange('distribution')}>
          Distribution
        </button>
        <button className="pill-btn active" onClick={() => onViewChange('trend')}>
          Trend
        </button>
        <div className="control-divider" />
        <span className="control-label">Grouping</span>
        <button
          className={`pill-btn${grouped ? ' active' : ''}`}
          onClick={() => { setGrouped(true); setSoloLabel(null); setHighlightedLabel(null); }}
        >
          By Tier
        </button>
        <button
          className={`pill-btn${!grouped ? ' active' : ''}`}
          onClick={() => { setGrouped(false); setSoloLabel(null); setHighlightedLabel(null); }}
        >
          By Division
        </button>
      </div>

      <div className="chart-card" ref={containerRef}>
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          style={{ height: HEIGHT }}
          className="trend-svg"
          role="img"
          aria-label="Rank distribution trends over time"
        >
          
          {/* Y gridlines + labels */}
          {yTicks.map(v => {
            const y = yScale(v);
            return (
              <g key={v} aria-hidden="true">
                <line
                  x1={PADDING.left}
                  x2={PADDING.left + cW}
                  y1={y}
                  y2={y}
                  stroke={v === 0 ? 'rgba(39,31,42,0.25)' : 'rgba(39,31,42,0.08)'}
                  strokeWidth={1}
                />
                <text
                  x={PADDING.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={10}
                  fontFamily="Inter, system-ui"
                  fill="rgba(39,31,42,0.4)"
                >
                  {v}%
                </text>
              </g>
            );
          })}

          {/* X axis labels + vertical gridlines */}
          {HISTORICAL_YEARS.map((year, i) => {
            const x = xScale(i);
            return (
              <g key={year} aria-hidden="true">
                <line
                  x1={x}
                  x2={x}
                  y1={PADDING.top}
                  y2={PADDING.top + cH}
                  stroke="rgba(39,31,42,0.06)"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={PADDING.top + cH + 22}
                  textAnchor="middle"
                  fontSize={11}
                  fontFamily="Inter, system-ui"
                  fontWeight={600}
                  fill="rgba(39,31,42,0.5)"
                >
                  {year}
                </text>
              </g>
            );
          })}

          {/* Lines + dots */}
          {lines.map(line => {
            const isDimmed =
              activeLabel != null && line.entry.label !== activeLabel;
            const isHighlighted =
              activeLabel != null && line.entry.label === activeLabel;

            return (
              <g key={line.entry.label}>
                <path
                  d={line.pathD}
                  className={`trend-line${isDimmed ? ' dimmed' : ''}${isHighlighted ? ' highlighted' : ''}`}
                  stroke={line.color}
                  aria-label={line.entry.label}
                  aria-describedby="chart-tooltip"
                />
                {line.points.map(p => (
                  <circle
                    key={p.yearIndex}
                    cx={p.x}
                    cy={p.y}
                    r={isHighlighted ? 4 : 2.5}
                    fill={line.color}
                    className={`trend-dot${isDimmed ? ' dimmed' : ''}${isHighlighted ? ' highlighted' : ''}`}
                  />
                ))}
                {/* Hit area for hover/click */}
                <path
                  d={line.pathD}
                  className="trend-hit-area"
                  aria-describedby="chart-tooltip"
                  onMouseEnter={() => handleLineEnter(line.entry.label)}
                  onMouseMove={e => handleLineMove(line, e)}
                  onMouseLeave={handleLineLeave}
                  onClick={() => handleLineClick(line.entry.label)}
                />
              </g>
            );
          })}

          {/* Crosshair */}
          {crosshairX != null && (
            <line
              className="crosshair"
              x1={crosshairX}
              x2={crosshairX}
              y1={PADDING.top}
              y2={PADDING.top + cH}
            />
          )}
        </svg>
      </div>

      <Tooltip
        id="chart-tooltip"
        visible={tooltip.visible}
        title={tooltip.title}
        rows={tooltip.rows}
        mouseX={tooltip.x}
        mouseY={tooltip.y}
      />
    </>
  );
}
