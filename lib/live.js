'use strict';
// Live-state broadcaster (#push): instead of every browser polling HA on its
// own 10 s cycle, one server tick fetches HA once, and connected panels get
// the result pushed over SSE — but only when something actually changed. A
// quiet board costs the server a single /api/states call per tick and sends
// nothing to the clients.
//
// Payload shape matches what /api/live + /api/ha-status used to answer
// together: { states, automations, reachable } — the client applies it in one
// place (relay-actions.applyLive).

const ha = require('../ha');

const TICK_MS = Number(process.env.LIVE_TICK_MS) || 5000;   // HA fetch cadence
const HEARTBEAT_MS = 25000;                                  // SSE keepalive + dead-client detection
const MAX_CLIENTS = 16;                                      // SSE holds an fd each; cap the blast radius

const clients = new Set();
let timer = null;
let heartbeat = null;
let lastFingerprint = null;
let lastPayload = null;

function sseHead(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // nginx (and friends) must not buffer the stream or events queue forever
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
}

// ids: the entity_ids this panel wants. Returns false when the cap is hit.
function addClient(res, ids) {
  if (clients.size >= MAX_CLIENTS) return false;
  const client = { res, ids: new Set(ids) };
  clients.add(client);
  res.on('close', () => clients.delete(client));
  sseHead(res);
  start();
  // First push right away: one fresh fetch, sent to THIS client only, so a new
  // tab is never waiting up to a tick for its first board paint.
  push(client).catch(() => {});
  return true;
}

async function push(client) {
  const payload = await snapshot([...client.ids]);
  send(client, payload);
}

function send(client, payload) {
  try { client.res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch { clients.delete(client); }
}

async function snapshot(ids) {
  const { states, automations, reachable } = await ha.getStatesAndAutomations(ids);
  return { states, automations, reachable };
}

function start() {
  if (timer) return;
  timer = setInterval(tick, TICK_MS);
  heartbeat = setInterval(() => {
    for (const c of clients) {
      try { c.res.write(': ping\n\n'); } catch { clients.delete(c); }
    }
  }, HEARTBEAT_MS);
  timer.unref?.(); heartbeat.unref?.();
}

function stop() {
  clearInterval(timer); clearInterval(heartbeat);
  timer = heartbeat = null;
  lastFingerprint = null;
}

// One HA fetch per tick for everyone; push only on change.
async function tick() {
  if (!clients.size) { stop(); return; }
  const ids = new Set();
  for (const c of clients) for (const id of c.ids) ids.add(id);
  let payload;
  try {
    payload = await snapshot([...ids]);
  } catch { return; } // keep the previous payload; next tick retries
  const fingerprint = JSON.stringify(payload);
  if (fingerprint === lastFingerprint) return;
  lastFingerprint = fingerprint;
  lastPayload = payload;
  for (const c of [...clients]) send(c, payload);
}

// Used when a layout edit changes which entities exist — the ids a client
// opened the stream with may no longer match its board. Stateless: the payload
// carries the union anyway, so the client just reopens; this drops the cache
// so the new client's first push is fresh.
function invalidate() {
  lastFingerprint = null;
}

module.exports = { addClient, invalidate, _debug: { get size() { return clients.size; }, get last() { return lastPayload; } } };
