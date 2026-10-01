import { useEffect, useMemo, useState, useCallback } from 'react';
import { getQueue, getLastRun, getDaily, getSegments, getDataQuality, MOCK } from './api.js';
import { ISSUE, BAND, TREND, pct, num, date, dateTime } from './format.js';
import Chart from './Chart.jsx';

const REFRESH_MS = 30000;
const params = () => new URLSearchParams(window.location.search);
function setParam(k, v) {
  const p = params(); v ? p.set(k, v) : p.delete(k);
  window.history.replaceState(null, '', `${window.location.pathname}${p.toString() ? '?' + p : ''}`);
}

export default function App() {
  const [queue, setQueue] = useState([]);
  const [run, setRun] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(params().get('client'));
  const [view, setView] = useState(params().get('view') === 'data' ? 'data' : 'queue');
  const [filter, setFilter] = useState('all');
  const [showHealthy, setShowHealthy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    try {
      const [q, r] = await Promise.all([getQueue(), getLastRun()]);
      setQueue(q); setRun(r); setError(null); setUpdatedAt(new Date());
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, REFRESH_MS); return () => clearInterval(t); }, [load]);
  useEffect(() => { setParam('client', selected); }, [selected]);
  useEffect(() => { setParam('view', view === 'data' ? 'data' : null); }, [view]);

  // default selection: the top of the queue
  useEffect(() => { if (!selected && queue.length) setSelected(queue[0].client_id); }, [queue, selected]);

  const counts = useMemo(() => Object.fromEntries(Object.keys(BAND).map(b => [b, queue.filter(a => a.band === b).length])), [queue]);
  const recovered = queue.filter(a => a.recently_recovered);
  const rows = queue.filter(a => (showHealthy || a.band !== 'healthy') && (filter === 'all' || a.primary_issue === filter));
  const current = queue.find(a => a.client_id === selected);
  const asOf = queue[0]?.as_of_date;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="logo">◐</div>
          <div>
            <div className="title">Account Health</div>
            <div className="muted small">
              Scores as of <b>{date(asOf, true)}</b> (last day in the feed)
              {run && <> · last run {dateTime(run.finished_at || run.started_at)} <RunStatus run={run} /></>}
              {MOCK && <span className="pill mock">mock data</span>}
            </div>
          </div>
        </div>
        <nav className="tabs">
          <button className={view === 'queue' ? 'on' : ''} onClick={() => setView('queue')}>Today's queue</button>
          <button className={view === 'data' ? 'on' : ''} onClick={() => setView('data')}>Data & rules</button>
        </nav>
      </header>

      {error && <div className="banner error">Could not load data: {error}</div>}

      {view === 'data' ? <DataView run={run} /> : (
        <main className="split">
          <section className="left">
            <div className="summary">
              {['critical', 'warning', 'watch', 'healthy'].map(b => (
                <div key={b} className={`stat ${b}`}>
                  <div className="stat-n">{counts[b] ?? 0}</div>
                  <div className="stat-l">{BAND[b].label}</div>
                </div>
              ))}
              <div className="stat recovered">
                <div className="stat-n">{recovered.length}</div>
                <div className="stat-l">Recovered (4 wks)</div>
              </div>
            </div>

            <div className="toolbar">
              <div className="seg">
                <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All issues</button>
                {Object.entries(ISSUE).map(([k, v]) => (
                  <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)} title={v.hint}>
                    {v.short} <span className="count">{queue.filter(a => a.primary_issue === k && a.severity >= 40).length}</span>
                  </button>
                ))}
              </div>
              <label className="check"><input type="checkbox" checked={showHealthy} onChange={e => setShowHealthy(e.target.checked)} /> Show healthy</label>
            </div>

            <div className="queue">
              <div className="qhead">
                <span>#</span><span>Account</span><span>Problem</span><span>Why</span><span>Trend</span><span>Since</span>
              </div>
              {rows.map(a => (
                <button key={a.client_id} className={`qrow ${a.client_id === selected ? 'sel' : ''}`} onClick={() => setSelected(a.client_id)}>
                  <span className="rank">{a.priority}</span>
                  <span className="acct">
                    <span className="name">{a.client_name}</span>
                    <span className="muted small">{a.client_id} · {a.plan_tier} · {num(a.contracted_sends_per_day)}/day</span>
                  </span>
                  <span className="prob">
                    <span className={`chip ${a.band}`}>{BAND[a.band]?.label}</span>
                    {a.primary_issue && <span className="issue">{ISSUE[a.primary_issue]?.short}</span>}
                    {(a.secondary_issues || []).map(s => <span key={s} className="issue sec">+ {ISSUE[s]?.short}</span>)}
                  </span>
                  <span className="why">{a.band === 'healthy' ? <span className="muted">Within thresholds</span> : a.top_reason}</span>
                  <span className={`trend ${a.trend}`}>{TREND[a.trend]?.arrow} {TREND[a.trend]?.label}</span>
                  <span className="since small">{a.severity >= 40 ? (a.flagged_since_start_of_data ? 'start of data' : date(a.flagged_since)) : '–'}</span>
                </button>
              ))}
              {!rows.length && <div className="empty">Nothing matches this filter.</div>}
            </div>

            {recovered.length > 0 && (
              <div className="recovered-box">
                <div className="h3">Recovered in the last 4 weeks · no action needed</div>
                {recovered.map(a => (
                  <button key={a.client_id} className="link" onClick={() => setSelected(a.client_id)}>{a.client_name}</button>
                ))}
              </div>
            )}
            <div className="muted small foot">Auto-refreshes every 30s · updated {updatedAt ? updatedAt.toLocaleTimeString('en-GB') : '–'}</div>
          </section>

          <section className="right">
            {current ? <Detail a={current} /> : <div className="empty">Select an account.</div>}
          </section>
        </main>
      )}
    </div>
  );
}

function RunStatus({ run }) {
  const ok = run.status === 'success';
  return <span className={`pill ${ok ? 'ok' : run.status === 'running' ? 'run' : 'bad'}`} title={run.error || ''}>{run.status}</span>;
}

function Detail({ a }) {
  const [daily, setDaily] = useState([]);
  const [segs, setSegs] = useState([]);
  useEffect(() => {
    let live = true;
    Promise.all([getDaily(a.client_id), getSegments(a.client_id)]).then(([d, s]) => { if (live) { setDaily(d); setSegs(s); } });
    return () => { live = false; };
  }, [a.client_id, a.as_of_date]);

  const m = a.metrics || {};
  const d = a.diagnosis;
  const scored = (a.reasons || []).filter(r => r.type !== 'context');
  const context = (a.reasons || []).filter(r => r.type === 'context');
  const flagged = a.severity >= 40;

  return (
    <div className="detail">
      <div className="d-head">
        <div>
          <div className="d-name">{a.client_name}</div>
          <div className="muted small">{a.client_id} · {a.plan_tier} · {a.industry} · contracted {num(a.contracted_sends_per_day)} sends/day · target reply rate {pct(m.target_reply_rate, 2)}</div>
        </div>
        <div className="d-chips">
          <span className={`chip big ${a.band}`}>{BAND[a.band]?.label} · {Number(a.severity).toFixed(0)}</span>
          <span className={`trend ${a.trend}`}>{TREND[a.trend]?.arrow} {TREND[a.trend]?.label}</span>
        </div>
      </div>

      {flagged && (
        <div className="started">
          <b>{ISSUE[a.primary_issue]?.label}</b>{' '}
          {a.flagged_since_start_of_data ? 'has been flagged since the start of the data (the problem predates the feed).' :
            <>flagged since <b>{date(a.flagged_since, true)}</b>{a.first_signs && a.first_signs < a.flagged_since && <> (first signs {date(a.first_signs)})</>}.</>}
          {a.trend === 'worsening' && ' Still getting worse.'}
          {a.trend === 'recovering' && ' Improving, keep watching.'}
        </div>
      )}
      {a.recently_recovered && <div className="started ok">Recovered: was flagged in the last 4 weeks, now back within thresholds.</div>}

      {d && flagged && (
        <div className="card diag">
          <div className="diag-h">{d.headline}</div>
          <p>{d.what_changed}</p>
          {d.check_first?.length > 0 && (<>
            <div className="h4">Check first</div>
            <ol>{d.check_first.map((c, i) => <li key={i}>{c}</li>)}</ol>
          </>)}
          <div className="muted small">
            {d.source === 'llm' ? `Written by Claude from the scored facts; every number checked against the data (confidence: ${d.confidence}).`
              : `Rule-based summary${d.reason ? ` (AI output not used: ${d.reason})` : ''}.`}
          </div>
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <div className="h3">Why it's flagged</div>
          {scored.length ? (
            <ul className="reasons">
              {scored.map((r, i) => (
                <li key={i}><span className={`dot ${r.type}`} /> {r.text}<span className="muted small"> · {ISSUE[r.type]?.short} {Number(r.score).toFixed(0)}</span></li>
              ))}
            </ul>
          ) : <div className="muted">Every signal is within its threshold.</div>}
          {context.length > 0 && <ul className="reasons ctx">{context.map((r, i) => <li key={i}>{r.text}</li>)}</ul>}
        </div>
        <div className="card">
          <div className="h3">Score by failure type</div>
          {['deliverability', 'dormancy', 'volume', 'engagement'].map(k => {
            const v = Number(a[`${k}_score`] || 0);
            return (
              <div key={k} className={`bar ${a.primary_issue === k && flagged ? 'primary' : ''}`}>
                <span className="bar-l">{ISSUE[k].short}</span>
                <span className="bar-t"><span className={`bar-f ${v >= 70 ? 'critical' : v >= 40 ? 'warning' : v >= 20 ? 'watch' : 'healthy'}`} style={{ width: `${Math.max(v, 1)}%` }} /></span>
                <span className="bar-v">{v.toFixed(0)}</span>
              </div>
            );
          })}
          <div className="muted small">0 = fine, 40+ = flagged, 70+ = critical. Primary issue follows root cause: deliverability, then dormancy, then volume, then engagement.</div>
        </div>
      </div>

      <div className="card">
        <Chart rows={daily} primaryIssue={a.primary_issue} flaggedSince={flagged ? a.flagged_since : null} />
      </div>

      <Segments segs={segs} issue={a.primary_issue} />
    </div>
  );
}

function Segments({ segs, issue }) {
  const [level, setLevel] = useState('variant');
  const byBounce = issue === 'deliverability';
  const campaigns = segs.filter(s => s.level === 'campaign');
  const declining = campaigns.filter(s => s.change_vs_baseline != null && s.change_vs_baseline <= -0.25).length;
  const list = segs.filter(s => s.level === level)
    .sort((x, y) => byBounce ? y.bounce_rate_cur - x.bounce_rate_cur : (y.replies_lost ?? -1e9) - (x.replies_lost ?? -1e9));

  return (
    <div className="card">
      <div className="chart-head">
        <div>
          <div className="h3">What's dragging it down</div>
          <div className="muted small">Last 10 sending days. {byBounce ? 'Sorted by bounce rate.' : 'Each segment vs its peers: variants vs the other variants in the same step, steps vs the same step in other campaigns, campaigns vs the rest of the account. "Replies lost" = what it would have got at its peers\' rate.'}</div>
        </div>
        <div className="seg">
          {['campaign', 'step', 'variant'].map(l => <button key={l} className={level === l ? 'on' : ''} onClick={() => setLevel(l)}>{l[0].toUpperCase() + l.slice(1)}s</button>)}
        </div>
      </div>
      {issue === 'engagement' && campaigns.length > 1 && declining === campaigns.length && (
        <div className="callout">Reply rate fell in <b>all {campaigns.length} campaigns</b> at once: likely the list or market, not one email.</div>
      )}
      {issue === 'dormancy' && <div className="callout">Sending has stopped across the account, so there is no recent campaign data to compare. Look at lead inventory and whether sequences have finished.</div>}
      {issue === 'deliverability' && <div className="callout">Bounces are high across every campaign: a mailbox or domain problem, not a campaign problem.</div>}
      <table className="tbl">
        <thead><tr><th>Campaign</th><th>Step</th><th>Variant</th><th className="r">Sent</th><th className="r">Reply rate</th><th className="r">Peers</th><th className="r">vs 4 wks ago</th><th className="r">Bounce</th><th className="r">Replies lost</th></tr></thead>
        <tbody>
          {list.slice(0, 8).map(s => (
            <tr key={`${s.campaign_id}-${s.step}-${s.variant}`} className={!byBounce && s.replies_lost > 5 ? 'drag' : ''}>
              <td>{s.campaign_name || s.campaign_id}</td>
              <td>{s.step || 'all'}</td>
              <td>{s.variant === '*' ? 'all' : s.variant}</td>
              <td className="r">{num(s.sent_cur)}</td>
              <td className="r">{pct(s.reply_rate_cur, 2)}</td>
              <td className="r muted">{pct(s.reply_rate_expected, 2)}</td>
              <td className={`r ${s.change_vs_baseline <= -0.25 ? 'neg' : s.change_vs_baseline >= 0.25 ? 'pos' : ''}`}>{s.change_vs_baseline == null ? '–' : `${s.change_vs_baseline > 0 ? '+' : ''}${(s.change_vs_baseline * 100).toFixed(0)}%`}</td>
              <td className={`r ${s.bounce_rate_cur > 0.05 ? 'neg' : ''}`}>{pct(s.bounce_rate_cur, 1)}</td>
              <td className="r"><b>{s.replies_lost == null ? '–' : Number(s.replies_lost).toFixed(0)}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!list.length && issue !== 'dormancy' && <div className="empty">No segments with enough sends (300+) in the window.</div>}
    </div>
  );
}

function DataView({ run }) {
  const [dq, setDq] = useState(null);
  useEffect(() => { getDataQuality().then(setDq); }, []);
  const files = run?.files || [];
  return (
    <main className="data">
      <div className="card">
        <div className="h3">Last pipeline run</div>
        {run ? (
          <div className="muted small">Run {String(run.run_id).slice(0, 8)} · {run.trigger_type} · started {dateTime(run.started_at)} · <RunStatus run={run} />{run.error && <> · {run.error}</>}</div>
        ) : <div className="muted">No runs yet.</div>}
        <table className="tbl">
          <thead><tr><th>File</th><th>Status</th><th className="r">Rows in</th><th className="r">Loaded</th><th className="r">Corrected</th><th className="r">Rejected</th><th className="r">Merged</th></tr></thead>
          <tbody>{files.map(f => (
            <tr key={f.file}><td>{f.file}</td><td>{f.status}</td><td className="r">{num(f.rows_in)}</td><td className="r">{num(f.rows_loaded)}</td>
              <td className="r">{num(f.rows_corrected)}</td><td className="r">{num(f.rows_rejected)}</td><td className="r">{num(f.rows_merged)}</td></tr>))}
          </tbody>
        </table>
        <div className="muted small">Loaded = rows in the clean tables. Rejected rows are quarantined with a reason, never loaded. Corrected rows are loaded after a logged fix.</div>
      </div>

      <div className="card">
        <div className="h3">What we found in the feed</div>
        <table className="tbl">
          <thead><tr><th>File</th><th>Issue</th><th>Action</th><th className="r">Rows</th><th>Example</th></tr></thead>
          <tbody>{(dq?.issues || []).sort((a, b) => b.rows_affected - a.rows_affected).map((i, k) => (
            <tr key={k}><td>{i.file_name}</td><td><code>{i.issue_code}</code></td><td><span className={`act ${i.action}`}>{i.action}</span></td>
              <td className="r">{num(i.rows_affected)}</td><td className="muted small">{i.example}</td></tr>))}
          </tbody>
        </table>
        {(dq?.gaps || []).length > 0 && (
          <div className="callout">Possible feed gaps (no rows at all, normal sending before and after): {dq.gaps.map(g => `${g.client_id} ${date(g.gap_start)} to ${date(g.gap_end)}`).join('; ')}. Scored as zero sends; confirm with the client.</div>
        )}
      </div>

      <div className="card">
        <div className="h3">Scoring rules</div>
        <div className="muted small">Every threshold lives in the <code>scoring_config</code> table, not in code. Each signal scores 0 at its "ok" point and 100 at its "bad" point, linearly in between.</div>
        <table className="tbl">
          <thead><tr><th>Setting</th><th className="r">Value</th><th>Meaning</th></tr></thead>
          <tbody>{(dq?.config || []).map(c => (
            <tr key={c.key}><td><code>{c.key}</code></td><td className="r">{c.value}</td><td className="small">{c.description}</td></tr>))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
