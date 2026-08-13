# CLAUDE.md

Instructions for Claude Code in this project.

## Git workflow

- Create feature branches: `feature/<issue-number>-<description>` (e.g. `feature/8-duplicate-relay`)
- Commit on the feature branch, then merge to master with `--no-ff`
- Push both master and the feature branch to GitHub
- Use the stash pattern: `git stash push -m "..."` → `git checkout -b feature/...` → `git stash pop` → `git add` → `git commit` → `git checkout master` → `git merge --no-ff` → `git push`
- Commit subject format: `feat:` or `fix:` prefix, include `(closes #N)` where applicable
- **Never** add `Co-Authored-By:` trailers to commits
- Git identity: `ristoq` / `kuntro.risto@gmail.com`
- Use `/usr/bin/gh` for GitHub CLI operations (e.g. viewing/creating issues)

## Build & deploy

- Production: `docker compose up -d --build relay-panel-web` (serves on port 8090 → 3000)
- Health check: `curl -s http://localhost:8090/api/health`
- Verify frontend changes: `curl -s http://localhost:8090/ | grep <element>`

## Architecture

- **Backend**: Node/Express (`server.js`) → Home Assistant REST + WebSocket (`ha.js`), optional MQTT (`z2m.js`)
- **Frontend**: Vanilla JS single page (`public/app.js`, `public/index.html`, `public/style.css`)
- **Database**: MariaDB (`db.js`) - single `panel` table with layout JSON, `panel_backup` with rolling 30 backups, `audit_log` with 1000-event retention
- No build step, no tests, no linting. Verify by deploying the container.
- Environment variables in `.env`, template in `.env.example`

## i18n

- English (default in HTML text) + Estonian (`TR.et` object in `app.js`)
- Add new strings to both `TR.et` (line ~6) and `EN` (line ~64) in `app.js`
- Use `data-i18n` attributes on HTML elements for static text, `t('key')` for dynamic text

## Activity log

- Page size: 15 entries
- Retention: 1000 newest events (auto-pruned after each insert)
- Actions logged: login, logout, relay.bind, relay.unbind, relay.delete, device.rename, switch.toggle, automation.pause, automation.resume, layout.save, layout.restore, automation.reapply, automation.prune, device.delete, area.delete
- CSV export available via download button in the panel footer

## Facility-map button (combo sensors)

- A sensor with both `sensor.<base>_temperature` and `sensor.<base>_humidity` is a **combo**
  sensor. `getEntities()` (ha.js) tags those with `combo: '<base>'`; temperature-only sensors
  are left untagged and get no button.
- `GET /api/config` (server.js) hands the client `kwsMapUrl` from the `KWS_MAP_URL` env var -
  the one place client-visible config is exposed. **No internal addresses in the repo**: every
  host lives in `.env`, and `.env.example` uses placeholders only.
- The button lives in the **history chart modal** (`#chart-modal-map`, next to CSV), not on the
  card - the card header is already crowded. `chart.js` builds `<KWS_MAP_URL>?sensor=HA%20<base>`
  in `openChartModal` and opens it in a new tab. Non-combo sensor or unset env → the button stays
  `hidden`. The map end (kws2, a separate app) resolves that identifier to its marker and flashes it.

## Notifications (issue #4)

- Server-side watcher polls HA every 60s via `runNotifyCheck()`
- Detects relay/sensor offline transitions and temperature deviations
- Sends via HA's `notify.<service>` API (configurable with `NOTIFY_SERVICE` env var)
- Per-relay: `notify` (bool) and `notify_deviation` (°C, default 5) fields on relay objects
- Debounce: `notifyAlerts` Map tracks already-alerted incidents, clears on recovery

## Board stacking order (click-to-front)

- A physical relay is ONE object on the board: the box plus the outputs pinned inside it by
  `reflowDeviceOutputs`. Click any part of it and the whole thing comes forward together.
- **Do not band by kind.** An earlier version gave boxes and cards separate z-ranges (all
  boxes under all cards); a raised board's box could then never rise above the neighbouring
  board's outputs, so every group came forward half-buried. That was the bug.
- The rendered z-index comes from `zStack()` - a depth-first walk of the containment tree,
  `area box, [device box, its outputs | loose card]…, next area box, …` - numbered
  `(i+1) * 10`. A container is emitted before its contents, so it always paints underneath
  them, and each group lands on consecutive levels: one contiguous band that moves as a unit.
- `z` on each object is only **click recency**, used to order siblings; it is not the
  z-index. `normalizeZ()` compacts it to 0..n-1 across the whole board (one shared number
  space - an area, a device box and a loose card can all be siblings) and calls `zRefresh()`,
  which caches the walk in `zMap` keyed by object identity. `zIndexOf(o)` reads that cache.
- Outputs inside a box are emitted in **array order**, not click order: they are pinned in a
  vertical stack and can never overlap each other, and `reflowDeviceOutputs` lays them out by
  array order. So `normalizeZ` must never reorder the `relays`/`devices`/`areas` arrays -
  only set `z`. Reordering would visually rearrange a board's outputs.
- `bringToFront` bumps two things at most: the object's top-level root (its area, else its
  device box, else itself) above its top-level siblings, and - when inside an area - the
  clicked box/card above that area's other children.
- `#canvas` must keep the `isolate` class: levels count up from the bottom of the board, so
  on a busy board they run straight through the range the overlays use (editor `z-20`,
  backdrop `z-[19]`, header `z-[21]`, modals `z-[50]`/`z-[60]`).
- Clicking anything calls `raise()` (board.js) from a **capture-phase** `pointerdown` -
  child controls stopPropagation, and raising must not `render()` (that would destroy the
  element about to capture the pointer), so it writes z-indexes into the DOM via `applyZ()`.
- Persisted through `PUT /api/layout/zorder` (debounced 600ms) - a separate endpoint on
  purpose: no backup snapshot, no `layout.save` audit entry, no version check.
