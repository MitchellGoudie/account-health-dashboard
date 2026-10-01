export const ISSUE = {
  deliverability: { label: 'Deliverability', short: 'Deliverability', hint: 'Emails bouncing or mailboxes unhealthy' },
  dormancy:       { label: 'Dormant',        short: 'Dormant',        hint: 'Sending has stopped or no new leads' },
  volume:         { label: 'Volume shortfall', short: 'Volume',       hint: 'Sending well below contract' },
  engagement:     { label: 'Engagement',     short: 'Engagement',     hint: 'Reply rate below target or decaying' },
};
export const BAND = {
  critical: { label: 'Critical', order: 1 }, warning: { label: 'Warning', order: 2 },
  watch: { label: 'Watch', order: 3 }, healthy: { label: 'Healthy', order: 4 },
};
export const TREND = {
  worsening:  { label: 'Getting worse', arrow: '↘' },
  recovering: { label: 'Recovering',    arrow: '↗' },
  stable:     { label: 'No change',     arrow: '→' },
  new:        { label: 'New',           arrow: '•' },
};
export const pct = (x, dp = 1) => (x == null || isNaN(x) ? '–' : `${(Number(x) * 100).toFixed(dp)}%`);
export const num = (x) => (x == null ? '–' : Math.round(Number(x)).toLocaleString('en-GB'));
export const date = (d, withYear = false) => d
  ? new Date(String(d).slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB',
      { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
  : '–';
export const dateTime = (d) => d
  ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '–';
export function daysBetween(a, b) {
  return Math.round((new Date(String(b).slice(0, 10)) - new Date(String(a).slice(0, 10))) / 86400000);
}
