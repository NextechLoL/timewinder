import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import type { TierName } from '../data/types';
import { TIER_CONFIG } from '../data/tiers';
import type { BarGroup } from './BarChart';

export const VBAR_LAYOUT = {
  padding: { top: 8, right: 16, bottom: 56, left: 44 },
  height: 380,
  groupGap: 16,
  barGap: 2,
} as const;

const { padding: PADDING, height: HEIGHT, groupGap: GROUP_GAP, barGap: BAR_GAP } = VBAR_LAYOUT;

const SHORT_LABELS: Partial<Record<TierName, string>> = {
  GRANDMASTER: 'GM',
  CHALLENGER: 'Chall',
};

/** Per-bar emerge factor: center-out reveal for emerging tier groups. */
export function computeBarEf(ef: number, i: number, n: number): number {
  if (ef >= 1) return 1;
  const maxDist = (n - 1) / 2;
  const dist = Math.abs(i - (n - 1) / 2);
  return Math.max(0, Math.min(1, ef * (maxDist + 1) - dist));
}

interface BarLayout {
  tier: TierName;
  label: string;
  value: number;
  x: number;
  barW: number;
  barH: number;
  color: string;
  opacity: number;
}

interface GroupLayout {
  tier: TierName;
  centerX: number;
  opacity: number;
}

interface VerticalBarChartProps {
  groups: BarGroup[];
  scaleMax: number;
  chartRef?: React.Ref<HTMLDivElement>;
  onBarHover?: (tier: TierName, label: string, e: React.MouseEvent) => void;
  onBarLeave?: () => void;
}

export function VerticalBarChart({ groups, scaleMax, chartRef, onBarHover, onBarLeave }: VerticalBarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chartW = width - PADDING.left - PADDING.right;
  const chartH = HEIGHT - PADDING.top - PADDING.bottom;
  const chartBottom = PADDING.top + chartH;

  const yStep = scaleMax <= 3 ? 0.5 : scaleMax <= 6 ? 1 : scaleMax <= 12 ? 2 : scaleMax <= 20 ? 4 : 5;
  const maxPct = Math.ceil(scaleMax / yStep) * yStep || 1;

  const { bars, groupLabels } = useMemo(() => {
    if (groups.length === 0) return { bars: [] as BarLayout[], groupLabels: [] as GroupLayout[] };

    // Compute effective bar count and total gap space to derive bar width.
    // bw is sized so bars + gaps fill chartW exactly — established bars
    // naturally grow as emerging bars contract, eliminating layout snaps.
    let sumBarEf = 0;
    let totalGaps = 0;
    for (let gi = 0; gi < groups.length; gi++) {
      const ef = groups[gi].emergeFactor ?? 1;
      const n = groups[gi].rows.length;
      for (let i = 0; i < n; i++) {
        const bef = computeBarEf(ef, i, n);
        sumBarEf += bef;
        if (i < n - 1) {
          totalGaps += BAR_GAP * Math.min(bef, computeBarEf(ef, i + 1, n));
        }
      }
      if (gi < groups.length - 1) totalGaps += GROUP_GAP * ef;
    }
    const bw = sumBarEf > 0
      ? Math.max(6, Math.min(32, (chartW - totalGaps) / sumBarEf))
      : 0;

    const barsOut: BarLayout[] = [];
    const labelsOut: GroupLayout[] = [];
    let x = PADDING.left;

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const ef = group.emergeFactor ?? 1;
      const n = group.rows.length;
      const groupStartX = x;
      const cfg = TIER_CONFIG[group.tier];

      for (let i = 0; i < n; i++) {
        const row = group.rows[i];
        const barEf = computeBarEf(ef, i, n);
        const effectiveBw = bw * barEf;
        const rawH = maxPct > 0 ? (row.value / maxPct) * chartH : 0;
        const barH = barEf > 0 ? rawH * barEf : 0;
        barsOut.push({
          tier: group.tier,
          label: row.label,
          value: row.value,
          x,
          barW: effectiveBw,
          barH,
          color: cfg.color,
          opacity: barEf,
        });
        x += effectiveBw;
        if (i < n - 1) {
          const nextBarEf = computeBarEf(ef, i + 1, n);
          x += BAR_GAP * Math.min(barEf, nextBarEf);
        }
      }

      const groupEndX = x;
      if (gi < groups.length - 1) x += GROUP_GAP * ef;
      labelsOut.push({
        tier: group.tier,
        centerX: (groupStartX + groupEndX) / 2,
        opacity: ef,
      });
    }

    return { bars: barsOut, groupLabels: labelsOut };
  }, [groups, chartW, chartH, maxPct]);

  const setRefs = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    if (typeof chartRef === 'function') chartRef(el);
    else if (chartRef) chartRef.current = el;
  }, [chartRef]);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    const tier = target.dataset?.tier as TierName | undefined;
    const label = target.dataset?.label;
    if (tier && label != null) {
      onBarHover?.(tier, label, e);
    } else {
      onBarLeave?.();
    }
  }, [onBarHover, onBarLeave]);

  const yTicks: number[] = [];
  for (let v = 0; v <= maxPct; v += yStep) yTicks.push(v);

  return (
    <div ref={setRefs}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        style={{ height: HEIGHT }}
        className="vbar-svg"
        role="img"
        aria-labelledby="vbar-title"
        onMouseMove={handleSvgMouseMove}
        onMouseLeave={onBarLeave}
      >
        <title id="vbar-title">Rank distribution chart</title>
        {/* Y gridlines + labels */}
        {yTicks.map(v => {
          const y = chartBottom - (v / maxPct) * chartH;
          return (
            <g key={v} aria-hidden="true">
              <line
                x1={PADDING.left}
                x2={PADDING.left + chartW}
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
                {v % 1 === 0 ? v : v.toFixed(1)}%
              </text>
            </g>
          );
        })}

        {/* Hit-area rects (invisible, extend above short bars for easier hover) */}
        {bars.map(bar => {
          const minHitH = 24;
          const hitH = Math.max(bar.barH, minHitH);
          return (
            <rect
              key={`hit_${bar.tier}_${bar.label}`}
              data-tier={bar.tier}
              data-label={bar.label}
              x={bar.x}
              y={chartBottom - hitH}
              width={bar.barW}
              height={hitH}
              fill="transparent"
            />
          );
        })}

        {/* Bars */}
        {bars.map(bar => (
          <rect
            key={`${bar.tier}_${bar.label}`}
            className="vbar-bar"
            data-tier={bar.tier}
            data-label={bar.label}
            x={bar.x}
            y={chartBottom - bar.barH}
            width={bar.barW}
            height={bar.barH}
            fill={bar.color}
            rx={2}
            aria-label={`${TIER_CONFIG[bar.tier].label} ${bar.label}: ${bar.value.toFixed(2)}%`}
          />
        ))}

        {/* Division labels below bars */}
        {bars.map(bar =>
          bar.label ? (
            <text
              key={`div_${bar.tier}_${bar.label}`}
              x={bar.x + bar.barW / 2}
              y={chartBottom + 14}
              textAnchor="middle"
              fontSize={9}
              fontWeight={600}
              fontFamily="Inter, system-ui"
              fill="rgba(39,31,42,0.45)"
              opacity={bar.opacity}
            >
              {bar.label}
            </text>
          ) : null,
        )}

        {/* Tier group labels */}
        {groupLabels.map(gl => {
          const cfg = TIER_CONFIG[gl.tier];
          return (
            <text
              key={`tier_${gl.tier}`}
              x={gl.centerX}
              y={chartBottom + 32}
              textAnchor="middle"
              fontSize={12}
              fontWeight={700}
              fontFamily="'Bebas Neue', system-ui"
              letterSpacing={0.5}
              fill={cfg.color}
              opacity={gl.opacity}
            >
              {(SHORT_LABELS[gl.tier] ?? cfg.label).toUpperCase()}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
