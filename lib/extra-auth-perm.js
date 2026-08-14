/*
 * Optional authorisation gate for the second sign-in provider (see extra-auth.js).
 *
 * Authenticating proves who someone is; it does not say they may drive this panel. A
 * site that keeps a permissions table can point EXTRA_AUTH_PERM_QUERY at it, and a
 * verified account is only let in when that query returns a row for it.
 *
 * The QUERY ITSELF lives in .env, not here. That is the whole design: this repo is
 * public and the schema behind it is not, so the panel knows only "run this statement
 * with the username bound; a row means yes". No table names, no column names, no access
 * keys, no permission values in the source - and any site with a different schema is
 * supported by writing a different statement rather than patching this file.
 *
 * Exactly one `?` placeholder, bound to the username. Everything else the statement
 * needs is a literal the operator writes into their own query.
 *
 * FAILS CLOSED. If the database is unreachable, the statement is malformed, or the
 * query times out, the sign-in is refused - a gate that opens when it breaks is not a
 * gate. Home Assistant sign-ins are unaffected, so an outage here never locks the panel.
 */
const mysql = require('mysql2/promise');

const QUERY_MS = 5000;

const enabled = () => !!(process.env.EXTRA_AUTH_PERM_QUERY
  && process.env.EXTRA_AUTH_PERM_DB_HOST
  && process.env.EXTRA_AUTH_PERM_DB_USER);

let pool = null;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.EXTRA_AUTH_PERM_DB_HOST,
      port: Number(process.env.EXTRA_AUTH_PERM_DB_PORT) || 3306,
      user: process.env.EXTRA_AUTH_PERM_DB_USER,
      password: process.env.EXTRA_AUTH_PERM_DB_PASSWORD || '',
      database: process.env.EXTRA_AUTH_PERM_DB_NAME || undefined,
      connectionLimit: 2,          // this runs once per sign-in, not per request
      connectTimeout: 5000,        // a remote outage must fail fast, not hang the login
      waitForConnections: true,
    });
  }
  return pool;
}

// Split out so the tests can stand in for it without a database (see api.query below).
async function query(sql, params) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

async function allows(username) {
  if (!enabled()) return { ok: true };            // no gate configured — nothing to check
  const sql = process.env.EXTRA_AUTH_PERM_QUERY;
  const holes = (sql.match(/\?/g) || []).length;
  if (holes !== 1) {
    console.error(`extra-auth-perm: EXTRA_AUTH_PERM_QUERY must contain exactly one "?" (found ${holes}) — refusing`);
    return { ok: false, error: 'Permission check is misconfigured.' };
  }
  try {
    const rows = await Promise.race([
      api.query(sql, [username]),
      new Promise((_, rej) => setTimeout(() => rej(new Error('permission query timed out')), QUERY_MS)),
    ]);
    if (Array.isArray(rows) && rows.length > 0) return { ok: true };
    return { ok: false, error: 'This account is not permitted to use the relay panel.' };
  } catch (e) {
    // The message can name a host or a table, so it goes to the log and not to a browser.
    console.error('extra-auth-perm: permission check failed:', e.message);
    return { ok: false, error: 'Permission could not be verified. Try again later.' };
  }
}

// `allows` calls api.query rather than query directly, so a test can swap in a stub.
const api = { enabled, allows, query };
module.exports = api;
