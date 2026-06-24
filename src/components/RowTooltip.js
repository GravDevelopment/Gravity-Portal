import { useState, useCallback, useEffect } from 'react';
import './RowTooltip.css';

const MARGIN = 12;

export function useRowTooltip() {
  const [tooltip, setTooltip] = useState(null);

  const show = useCallback((e, lines) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ anchorX: rect.left, anchorY: rect.bottom + 6, lines });
  }, []);

  const hide = useCallback(() => setTooltip(null), []);

  return { tooltip, show, hide };
}

export function RowTooltip({ tooltip }) {
  const [style, setStyle] = useState({});

  useEffect(() => {
    if (!tooltip) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = tooltip.anchorX;
    let top  = tooltip.anchorY;
    // Clamp right edge — estimate width 300px
    if (left + 300 + MARGIN > vw) left = vw - 300 - MARGIN;
    if (left < MARGIN) left = MARGIN;
    // Flip above if near bottom — estimate height 160px
    if (top + 160 + MARGIN > vh) top = tooltip.anchorY - 160 - 30;
    setStyle({ top, left });
  }, [tooltip]);

  if (!tooltip) return null;

  return (
    <div className="row-tooltip" style={style}>
      {tooltip.lines.map((line, i) => (
        <div key={i} className="row-tooltip-line">
          <span className="row-tooltip-label">{line.label}</span>
          <span className="row-tooltip-value">{line.value || '—'}</span>
        </div>
      ))}
    </div>
  );
}
