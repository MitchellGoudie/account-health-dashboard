// Data access. Reads only the dashboard views (the anon key cannot read raw tables).
// With no Supabase env vars set, falls back to local mock JSON for development.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const MOCK = !url || !key;
const sb = MOCK ? null : createClient(url, key, { auth: { persistSession: false } });

const cache = {};
async function mock(view) {
  if (!cache[view]) cache[view] = fetch(`/mock/${view}.json`).then(r => r.json());
  return cache[view];
}
async function q(build, view) {
  const { data, error } = await build(sb.from(view));
  if (error) throw new Error(`${view}: ${error.message}`);
  return data;
}

export async function getQueue() {
  if (MOCK) return (await mock('v_queue')).sort((a, b) => a.priority - b.priority);
  return q(t => t.select('*').order('priority'), 'v_queue');
}
export async function getLastRun() {
  if (MOCK) return (await mock('v_last_run'))[0] || null;
  return (await q(t => t.select('*').limit(1), 'v_last_run'))[0] || null;
}
export async function getDaily(clientId) {
  if (MOCK) return (await mock('v_client_daily')).filter(r => r.client_id === clientId);
  return q(t => t.select('*').eq('client_id', clientId).order('metric_date'), 'v_client_daily');
}
export async function getSegments(clientId) {
  if (MOCK) return (await mock('v_segments_latest')).filter(r => r.client_id === clientId);
  return q(t => t.select('*').eq('client_id', clientId), 'v_segments_latest');
}
export async function getDataQuality() {
  if (MOCK) return { issues: await mock('v_data_quality'), gaps: await mock('v_feed_gaps'), config: await mock('scoring_config') };
  const [issues, gaps, config] = await Promise.all([
    q(t => t.select('*'), 'v_data_quality'), q(t => t.select('*'), 'v_feed_gaps'),
    q(t => t.select('*').order('key'), 'scoring_config'),
  ]);
  return { issues, gaps, config };
}
