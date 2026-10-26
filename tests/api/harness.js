'use strict';
// Test harness for the API suite: a throwaway MariaDB database per file, the
// real server booted as a child process against it, and a tiny Home Assistant
// stub. No Home Assistant, no MQTT, no production database — a clean clone can
// run everything (via scripts/test.sh api, which provides the MariaDB).
//
// Requires node_modules (express, mysql2) — unlike tests/unit, this suite runs
// with the installed dependencies.
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const mysql = require('mysql2/promise');

const ROOT = path.join(__dirname, '..', '..');

// The HA stub accepts exactly this password; anything else is a failed login.
const HA_PASSWORD = 'ha-stub-password';

// --- tiny Home Assistant stub: enough for login flows and reachability ---
function startHaStub() {
  const flows = new Map(); // flow_id -> attempts
  const s = http.createServer((req, res) => {
    const body = [];
    req.on('data', (c) => body.push(c));
    req.on('end', () => {
      const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      let payload = {};
      try { payload = JSON.parse(Buffer.concat(body).toString() || '{}'); } catch { /* junk is fine */ }
      const m = req.url.match(/^\/auth\/login_flow(?:\/([^/?]+))?/);
      if (req.method === 'POST' && req.url === '/auth/login_flow') {
        const id = `flow${flows.size + 1}`;
        flows.set(id, 0);
        return send(200, { type: 'form', flow_id: id, step_id: 'user' });
      }
      if (req.method === 'POST' && m && m[1]) {
        if (payload.password === HA_PASSWORD) return send(200, { type: 'create_entry', flow_id: m[1] });
        return send(200, { type: 'form', flow_id: m[1], step_id: 'form', errors: { base: 'Invalid auth' } });
      }
      if (req.method === 'DELETE' && m) return send(200, {});
      if (req.method === 'GET' && req.url === '/api/') return send(200, {});
      send(404, { message: 'not stubbed' });
    });
  });
  return new Promise((resolve) => s.listen(0, '127.0.0.1', () => resolve({ server: s, url: `http://127.0.0.1:${s.address().port}` })));
}

// --- the real server, booted as a child process against its own database ---
async function startApp({ dbPort, dbRootPassword, haUrl, dbname }) {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: dbPort, user: 'root', password: dbRootPassword });
  await conn.query(`DROP DATABASE IF EXISTS ${dbname}`);
  await conn.query(`CREATE DATABASE ${dbname}`);
  await conn.end();

  const port = 30000 + Math.floor(Math.random() * 10000);
  const proc = spawn('node', [path.join(ROOT, 'server.js')], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_HOST: '127.0.0.1', DB_PORT: String(dbPort), DB_USER: 'root',
      DB_PASSWORD: dbRootPassword, DB_NAME: dbname,
      HA_URL: haUrl,
      TZ: 'UTC',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stderr.on('data', (d) => process.stderr.write(`[server:${dbname}] ${d}`));
  // loud and fatal on boot is a feature; surface why instead of hanging
  proc.on('exit', (code) => { if (code) console.error(`[server:${dbname}] exited ${code}`); });

  const deadline = Date.now() + 20000;
  for (;;) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (r.ok) break;
    } catch { /* not up yet */ }
    if (Date.now() > deadline) throw new Error(`server on :${port} never became healthy`);
    await new Promise((r) => setTimeout(r, 150));
  }
  return { port, proc };
}

async function stopApp(handle, dbname, dbPort, dbRootPassword) {
  handle.proc.kill('SIGTERM');
  await new Promise((r) => { handle.proc.on('exit', r); setTimeout(r, 5000); });
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: dbPort, user: 'root', password: dbRootPassword });
  await conn.query(`DROP DATABASE IF EXISTS ${dbname}`);
  await conn.end();
}

// --- HTTP helpers ---
async function call(port, method, p, { body, cookie } = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${p}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* non-JSON answers are asserted via status */ }
  const full = res.headers.getSetCookie ? res.headers.getSetCookie()[0] : res.headers.get('set-cookie');
  return { status: res.status, body: json, text, setCookieHeader: full || null, cookie: full ? full.split(';')[0] : null };
}

// Login through the stubbed HA flow; returns the session cookie (or null).
async function login(port, username, password = HA_PASSWORD) {
  const r = await call(port, 'POST', '/api/login', { body: { username, password } });
  if (r.status !== 200) throw new Error(`login failed (${r.status}): ${r.text}`);
  return r.cookie;
}

module.exports = { HA_PASSWORD, startHaStub, startApp, stopApp, call, login };
