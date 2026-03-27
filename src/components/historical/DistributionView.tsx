import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Region, TierName } from '../../data/types';
import { TIER_ORDER_ASC, HISTORICAL_YEARS } from '../../data/tiers';
import { getHistorical } from '../../data';
import { VerticalBarChart } from '../VerticalBarChart';
import type { BarGroup } from '../BarChart';
import { Tooltip } from '../Tooltip';

const MIN_YEAR = HISTORICAL_YEARS[0];
const MAX_YEAR = HISTORICAL_YEARS[HISTORICAL_YEARS.length - 1];

function maxForYear(data: readonly { tier: TierName; percentages: Record<number, number | null> }[], year: number, activeTiers: Set<TierName>): number {
  let max = 0;
  for (const entry of data) {
    if (!activeTiers.has(entry.tier)) continue;
    const v = entry.percentages[year];
    if (v != null && v > max) max = v;
  }
  return max;
}

function computeMaxPct(rawMax: number): number {
  const yStep = rawMax <= 3 ? 0.5 : rawMax <= 6 ? 1 : rawMax <= 12 ? 2 : rawMax <= 20 ? 4 : 5;
  return Math.ceil(rawMax / yStep) * yStep || 1;
}

interface DistributionViewProps {
  region: Region;
  onViewChange: (view: 'distribution' | 'trend') => void;
}

export function DistributionView({ region, onViewChange }: DistributionViewProps) {
  const [sliderValue, setSliderValue] = useState(MAX_YEAR);
  const [isDragging, setIsDragging] = useState(false);
  const activeTiers = useMemo(() => new Set(TIER_ORDER_ASC), []);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    title: string;
    rows: Array<{ label: string; value: string }>;
    x: number;
    y: number;
  }>({ visible: false, title: '', rows: [], x: 0, y: 0 });

  const sliderRef = useRef<HTMLDivElement>(null);
  const sliderValueRef = useRef(sliderValue);
  const animationRef = useRef<number | undefined>(undefined);
  const cleanupDragRef = useRef<(() => void) | null>(null);
  sliderValueRef.current = sliderValue;

  useEffect(() => () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    cleanupDragRef.current?.();
  }, []);

  const data = useMemo(() => getHistorical(region), [region]);

  const displayYear = Math.round(sliderValue);

  const scaleMax = useMemo(() => {
    let rawMax = 0;
    for (const year of HISTORICAL_YEARS) {
      const m = maxForYear(data, year, activeTiers);
      if (m > rawMax) rawMax = m;
    }
    return computeMaxPct(rawMax);
  }, [data, activeTiers]);

  // Interpolated bar groups driven by slider position
  const barGroups = useMemo((): BarGroup[] => {
    const yearLow = Math.floor(sliderValue);
    const yearHigh = Math.ceil(sliderValue);
    const t = yearHigh === yearLow ? 0 : sliderValue - yearLow;

    const tierMap = new Map<TierName, typeof data>();
    for (const entry of data) {
      if (!tierMap.has(entry.tier)) tierMap.set(entry.tier, []);
      tierMap.get(entry.tier)!.push(entry);
    }

    const result: BarGroup[] = [];

    for (const tier of TIER_ORDER_ASC) {
      if (!activeTiers.has(tier)) continue;
      const entries = tierMap.get(tier) ?? [];

      const hasLow = entries.some(e => e.percentages[yearLow] != null);
      const hasHigh = entries.some(e => e.percentages[yearHigh] != null);

      const rows = [...entries].reverse()
        .map(entry => {
          const vLow = entry.percentages[yearLow];
          const vHigh = entry.percentages[yearHigh];
          if (vLow == null && vHigh == null) return null;

          const pct = (vLow ?? 0) + ((vHigh ?? 0) - (vLow ?? 0)) * t;

          return {
            label: entry.division ?? '',
            value: pct,
            countText: '',
            shareText: `${pct.toFixed(2)}%`,
            topText: '',
          };
        })
        .filter((r): r is NonNullable<typeof r> => r != null);

      if (rows.length === 0) continue;

      let emergeFactor: number | undefined;
      if (!hasLow && hasHigh) emergeFactor = t;
      else if (hasLow && !hasHigh) emergeFactor = 1 - t;

      result.push({ tier, scaleMax, rows, emergeFactor });
    }

    return result;
  }, [data, sliderValue, activeTiers, scaleMax]);

  // --- Slider animation ---

  const animateToYear = useCallback((targetYear: number) => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    const startValue = sliderValueRef.current;
    if (startValue === targetYear) return;
    const startTime = performance.now();
    const duration = 375;

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setSliderValue(startValue + (targetYear - startValue) * eased);
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      }
    }
    // First step runs synchronously to avoid 1-frame stale position
    step(startTime);
    animationRef.current = requestAnimationFrame(step);
  }, []);

  // Horizontal padding on .year-slider extends the hit area beyond the track
  // so the thumb is fully grabbable at both poles. Ratio maps to the track, not
  // the outer div, so clicks in the padding zone clamp to the nearest endpoint.
  const SLIDER_PAD = 9;

  const getValueFromPointer = useCallback((clientX: number) => {
    const el = sliderRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const trackLeft = rect.left + SLIDER_PAD;
    const trackWidth = rect.width - SLIDER_PAD * 2;
    const ratio = Math.max(0, Math.min(1, (clientX - trackLeft) / trackWidth));
    return MIN_YEAR + ratio * (MAX_YEAR - MIN_YEAR);
  }, []);

  const handleSliderDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setIsDragging(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const value = getValueFromPointer(clientX);
    if (value != null) setSliderValue(value);

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const cx = 'touches' in moveEvent
        ? moveEvent.touches[0].clientX
        : moveEvent.clientX;
      const val = getValueFromPointer(cx);
      if (val != null) setSliderValue(val);
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
      cleanupDragRef.current = null;
    };

    const handleUp = () => {
      cleanup();
      setIsDragging(false);
      const nearest = Math.max(MIN_YEAR, Math.min(MAX_YEAR, Math.round(sliderValueRef.current)));
      animateToYear(nearest);
    };

    cleanupDragRef.current = cleanup;
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleUp);
  }, [getValueFromPointer, animateToYear]);

  // --- Tooltip ---

  const handleBarHover = useCallback(
    (tier: TierName, label: string, e: React.MouseEvent) => {
      const entry = data.find(
        d => d.tier === tier && (d.division ?? '') === label,
      );
      if (!entry) return;

      const sv = sliderValueRef.current;
      const yearLow = Math.floor(sv);
      const yearHigh = Math.ceil(sv);
      const t = yearHigh === yearLow ? 0 : sv - yearLow;
      const vLow = entry.percentages[yearLow] ?? 0;
      const vHigh = entry.percentages[yearHigh] ?? 0;
      const pct = vLow + (vHigh - vLow) * t;

      const nearest = Math.round(sv);
      const rows: Array<{ label: string; value: string }> = [
        { label: `${nearest} share`, value: `${pct.toFixed(2)}%` },
      ];

      const pctNearest = entry.percentages[nearest];
      if (pctNearest != null) {
        for (let y = nearest - 1; y >= MIN_YEAR; y--) {
          const prev = entry.percentages[y];
          if (prev != null) {
            const delta = pctNearest - prev;
            rows.push({
              label: `vs ${y}`,
              value: `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`,
            });
            break;
          }
        }
      }

      setTooltip({ visible: true, title: entry.label, rows, x: e.clientX, y: e.clientY });
    },
    [data],
  );

  const handleBarLeave = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false }));
  }, []);


  // --- Slider position ---

  const sliderPct = Math.max(0, Math.min(100, ((sliderValue - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100));

  return (
    <>
      <div className="controls">
        <span className="control-label">Year</span>
        <div className="year-pills">
          {HISTORICAL_YEARS.map(year => (
            <button
              key={year}
              className={`pill-btn${year === displayYear ? ' active' : ''}`}
              onClick={() => animateToYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div className="controls">
        <span className="control-label">View</span>
        <button className="pill-btn active" onClick={() => onViewChange('distribution')}>
          Distribution
        </button>
        <button className="pill-btn" onClick={() => onViewChange('trend')}>
          Trend
        </button>
      </div>

      <div className="chart-card">
        <VerticalBarChart
          groups={barGroups}
          scaleMax={scaleMax}
          tooltipId="chart-tooltip"
          onBarHover={handleBarHover}
          onBarLeave={handleBarLeave}
        />

        <div
          className={`year-slider${isDragging ? ' dragging' : ''}`}
          ref={sliderRef}
          onMouseDown={handleSliderDown}
          onTouchStart={handleSliderDown}
        >
          <div className="year-slider-track">
            <div className="year-slider-fill" style={{ width: `${sliderPct}%` }} />
            <div className="year-slider-thumb" style={{ left: `${sliderPct}%` }} />
          </div>
          <div className="year-slider-ticks">
            {HISTORICAL_YEARS.map(year => {
              const pct = ((year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;
              return (
                <div
                  key={year}
                  className={`year-slider-tick${year === displayYear ? ' active' : ''}`}
                  style={{ left: `${pct}%` }}
                >
                  <div className="year-slider-tick-mark" />
                  <span className="year-slider-tick-label">{year}</span>
                </div>
              );
            })}
          </div>
        </div>
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
