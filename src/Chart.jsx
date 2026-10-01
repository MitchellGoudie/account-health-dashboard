// Single-metric timeline with a reference line, a band strip showing the account's status
// each day, and a marker where the current problem started. Hand-rolled SVG: no chart library.
import { useMemo, useState } from 'react';
import { date, pct, num } from './format.js';

const METRICS = {
  volume:   { tab: 'Volume', label: 'Sending vs contract', sub: '7-day average of daily sends as a share of the contracted volume',
              get: r => r.volume_usage_7d, ref: () => 1, refLabel: 'contract', fmt: v => pct(v, 0), floor: 0 },
  replies:  { tab: 'Replies', label: 'Reply rate vs target', sub: '10-day rolling reply rate',
              get: r => r.reply_rate_10d, ref: r => r.target_reply_rate, refLabel: 'target', fmt: v => pct(v, 1), floor: 0 },
  bounces:  { tab: 'Bounces', label: 'Bounce rate', sub: '7-day rolling bounce rate. Healthy is under 2%',
              get: r => r.bounce_rate_7d, ref: () => 0.02, refLabel: '2% healthy limit', fmt: v => pct(v, 1), floor: 0 },
  sends:    { tab: 'Sends', label: 'Daily sends', sub: 'Emails sent per sending day',
              get: r => r.sent, ref: r => r.contracted_sends_per_day, refLabel: 'contract', fmt: v => num(v), floor: 0 },
};
export const METRIC_FOR_ISSUE = { deliverability: 'bounces', dormancy: 'sends', volume: 'volume', engagement: 'replies' };

export default function Chart({ rows, primaryIssue, flaggedSince }) {
  const [metric, setMetric] = useState(METRIC_FOR_ISSUE[primaryIssue] || 'volume');
  const m = METRICS[metric];
  const [hover, setHover] = useState(null);

  const W = 720, H = 230, P = { l: 52, r: 16, t: 14, b: 44 };
  const pts = useMemo(() => rows.filter(r => m.get(r) != null), [rows, metric]);
  if (!rows.length) return <div className="empty">No daily data for this account.</div>;

  const refVal = m.ref(rows[rows.length - 1]);
  const rawMax = Math.max(refVal * 1.25, ...pts.map(r => Number(m.get(r)))) || 1;
  // round the axis up to a "nice" number so ticks read cleanly
  const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const maxY = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(k => k * mag).find(v => v >= rawMax);
  const x = i => P.l + (i / Math.max(rows.length - 1, 1)) * (W - P.l - P.r);
  const y = v => P.t + (1 - v / maxY) * (H - P.t - P.b - 12);
  const idx = new Map(rows.map((r, i) => [r.metric_date, i]));
  const path = pts.map((r, k) => `${k ? 'L' : 'M'}${x(idx.get(r.metric_date)).toFixed(1)},${y(Number(m.get(r))).toFixed(1)}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * maxY);
  const months = rows.map((r, i) => ({ i, d: r.metric_date })).filter((o, k, a) => k === 0 || o.d.slice(5, 7) !== a[k - 1].d.slice(5, 7));
  const flagIdx = flaggedSince ? idx.get(String(flaggedSince).slice(0, 10)) : undefined;
  const stripY = H - P.b + 6, stripH = 8, colW = (W - P.l - P.r) / Math.max(rows.length - 1, 1);

  return (
    <div className="chart">
      <div className="chart-head">
        <div>
          <div className="chart-title">{m.label}</div>
          <div className="muted small">{m.sub}</div>
        </div>
        <div className="seg">
          {Object.entries(METRICS).map(([k, v]) => (
            <button key={k} className={k === metric ? 'on' : ''} onClick={() => setMetric(k)}>{v.tab}</button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={m.label}
           onMouseLeave={() => setHover(null)}
           onMouseMove={e => {
             const b = e.currentTarget.getBoundingClientRect();
             const px = (e.clientX - b.left) / b.width * W;
             const i = Math.round((px - P.l) / (W - P.l - P.r) * (rows.length - 1));
             setHover(i >= 0 && i < rows.length ? i : null);
           }}>
        {ticks.map((t, k) => (
          <g key={k}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={P.l - 8} y={y(t) + 4} className="axis" textAnchor="end">{m.fmt(t)}</text>
          </g>
        ))}
        {months.map(o => <text key={o.d} x={x(o.i)} y={H - 8} className="axis">{date(o.d)}</text>)}
        {/* reference line */}
        <line x1={P.l} x2={W - P.r} y1={y(refVal)} y2={y(refVal)} className="ref" />
        <text x={W - P.r} y={y(refVal) - 5} className="axis ref-label" textAnchor="end">{m.refLabel}</text>
        {/* flagged since */}
        {flagIdx !== undefined && (
          <g>
            <rect x={x(flagIdx)} y={P.t} width={W - P.r - x(flagIdx)} height={H - P.t - P.b} className="flag-zone" />
            <line x1={x(flagIdx)} x2={x(flagIdx)} y1={P.t} y2={H - P.b} className="flag-line" />
            <text x={x(flagIdx) + 4} y={P.t + 11} className="axis flag-label">flagged {date(flaggedSince)}</text>
          </g>
        )}
        <path d={path} className="line" />
        {/* status strip: account band on each day */}
        {rows.map((r, i) => (
          <rect key={r.metric_date} x={x(i) - colW / 2} y={stripY} width={colW + 0.5} height={stripH}
                className={`strip ${r.band || 'none'}`} />
        ))}
        {hover != null && rows[hover] && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} className="hover-line" />
            {m.get(rows[hover]) != null && <circle cx={x(hover)} cy={y(Number(m.get(rows[hover])))} r="3.5" className="dot" />}
          </g>
        )}
      </svg>
      <div className="chart-foot small">
        {hover != null && rows[hover] ? (
          <span><b>{date(rows[hover].metric_date, true)}</b> · {m.label.toLowerCase()}: <b>{m.fmt(m.get(rows[hover]))}</b>
            {' '}· sent {num(rows[hover].sent)} · status {rows[hover].band || 'not scored'}</span>
        ) : (
          <span className="legend">
            <i className="sw critical" /> critical <i className="sw warning" /> warning <i className="sw watch" /> watch <i className="sw healthy" /> healthy
            <span className="muted"> · status strip shows the score on each day</span>
          </span>
        )}
      </div>
    </div>
  );
}
