import { useRef, useCallback } from 'react';

interface TooltipRow {
  label: string;
  value: string;
}

interface TooltipProps {
  id?: string;
  visible: boolean;
  title: string;
  rows: TooltipRow[];
  mouseX: number;
  mouseY: number;
}

export function Tooltip({ id, visible, title, rows, mouseX, mouseY }: TooltipProps) {
  const dims = useRef({ w: 200, h: 80 });

  const measureRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      dims.current = { w: el.offsetWidth, h: el.offsetHeight };
    }
  }, []);

  const x = Math.min(mouseX + 16, window.innerWidth - dims.current.w - 12);
  const y = Math.max(8, mouseY - dims.current.h / 2);

  return (
    <div
      ref={measureRef}
      id={id}
      role="tooltip"
      aria-live="polite"
      className={`tooltip${visible ? ' visible' : ''}`}
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      <span className="tt-title">{title}</span>
      {rows.map(row => (
        <div key={row.label} className="tt-row">
          <span>{row.label}</span>
          <span>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
