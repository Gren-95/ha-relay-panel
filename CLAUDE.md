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
- **Database**: MariaDB (`db.js`) — single `panel` table with layout JSON, `panel_backup` with rolling 30 backups, `audit_log` with 1000-event retention
- No build step, no tests, no linting. Verify by deploying the container.
- Environment variables in `.env`, template in `.env.example`

## i18n

- English (default in HTML text) + Estonian (`TR.et` object in `app.js`)
- Add new strings to both `TR.et` (line ~6) and `EN` (line ~64) in `app.js`
- Use `data-i18n` attributes on HTML elements for static text, `t('key')` for dynamic text

## Activity log

- Page size: 15 entries
- Retention: 1000 newest events (auto-pruned after each insert)
- Actions logged: login, logout, relay.bind, relay.unbind, relay.delete, device.rename, switch.toggle, automation.pause, automation.resume, layout.save, layout.restore, automation.reapply, device.delete, area.delete
- CSV export available via download button in the panel footer

## Notifications (issue #4)

- Server-side watcher polls HA every 60s via `runNotifyCheck()`
- Detects relay/sensor offline transitions and temperature deviations
- Sends via HA's `notify.<service>` API (configurable with `NOTIFY_SERVICE` env var)
- Per-relay: `notify` (bool) and `notify_deviation` (°C, default 5) fields on relay objects
- Debounce: `notifyAlerts` Map tracks already-alerted incidents, clears on recovery
