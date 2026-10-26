'use strict';
// The migration runner's pure part, plus sanity on the baseline file itself.
// (Applying migrations needs a real MariaDB; that is covered by booting the
// app, not by unit tests.)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { plan, MIGRATIONS_DIR } = require('../../lib/migrate');

test('plan: returns pending files in order, skips applied and non-sql', () => {
  const files = ['0001_baseline.sql', '0002_add_index.sql', '0010_x.sql', 'README.md'];
  assert.deepEqual(plan(files, []), ['0001_baseline.sql', '0002_add_index.sql', '0010_x.sql']);
  assert.deepEqual(plan(files, ['0001_baseline.sql']), ['0002_add_index.sql', '0010_x.sql']);
  assert.deepEqual(plan(files, ['0001_baseline.sql', '0002_add_index.sql', '0010_x.sql']), []);
});

test('plan: an applied name is skipped even if the file list is unordered', () => {
  assert.deepEqual(plan(['0002_b.sql', '0001_a.sql'], ['0001_a.sql']), ['0002_b.sql']);
});

test('baseline: one file, and it defines every app table plus the seed row', () => {
  const files = fs.readdirSync(MIGRATIONS_DIR).sort();
  assert.equal(files[0], '0001_baseline.sql', 'the baseline is first');
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, '0001_baseline.sql'), 'utf8');
  for (const t of ['panel', 'panel_backup', 'sessions', 'audit_log', 'settings']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${t}\\b`), `${t} is in the baseline`);
  }
  assert.match(sql, /INSERT IGNORE INTO panel/);
});
