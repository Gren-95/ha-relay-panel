// Notification watcher: alerts on offline sensors/relays or temp deviations.
const db = require('../db');
const ha = require('../ha');

const NOTIFY_SERVICES = (process.env.NOTIFY_SERVICE || '').split(',').map((s) => s.trim()).filter(Boolean);
const NOTIFY_INTERVAL = 60 * 1000; // check every 60s
const notifyAlerts = new Map(); // key -> timestamp of last alert

function notifyKey(rid, type) { return `${rid}:${type}`; }

async function sendNotifyAll(message, title) {
  for (const svc of NOTIFY_SERVICES) {
    ha.sendNotification(svc, message, title).catch(() => {});
  }
}

async function runNotifyCheck() {
  if (!NOTIFY_SERVICES.length) return;
  let layout;
  try { layout = await db.getLayout(); } catch { return; }
  const relays = (layout.relays || []).filter((r) => r.relay && r.sensor && r.bound);
  if (!relays.length) return;

  // Collect entity IDs and fetch live states
  const ids = new Set();
  for (const r of relays) { ids.add(r.relay); ids.add(r.sensor); }
  let live;
  try { live = await ha.getStates([...ids]); } catch { return; }

  for (const r of relays) {
    if (!r.notify) continue;
    const rl = live[r.relay] || {};
    const sn = live[r.sensor] || {};
    const threshold = Number(r.notify_deviation) || 5;
    const name = r.name || r.relay;

    // Relay offline
    if (rl.state === 'unavailable' || rl.state === 'unknown' || rl.missing) {
      const key = notifyKey(r.id, 'relay_offline');
      if (!notifyAlerts.has(key)) {
        notifyAlerts.set(key, Date.now());
        sendNotifyAll(
          `Relay "${name}" (${r.relay}) is offline/unreachable.`, 'Relay Panel').catch(() => {});
      }
    } else {
      // Relay recovered
      const key = notifyKey(r.id, 'relay_offline');
      if (notifyAlerts.has(key)) {
        notifyAlerts.delete(key);
        sendNotifyAll(
          `Relay "${name}" (${r.relay}) is back online.`, 'Relay Panel').catch(() => {});
      }
    }

    // Sensor offline
    if (sn.state === 'unavailable' || sn.state === 'unknown' || sn.missing) {
      const key = notifyKey(r.id, 'sensor_offline');
      if (!notifyAlerts.has(key)) {
        notifyAlerts.set(key, Date.now());
        sendNotifyAll(
          `Sensor "${name}" (${r.sensor}) is offline. Automatic control is paused.`, 'Relay Panel').catch(() => {});
      }
    } else {
      const key = notifyKey(r.id, 'sensor_offline');
      if (notifyAlerts.has(key)) {
        notifyAlerts.delete(key);
        sendNotifyAll(
          `Sensor "${name}" (${r.sensor}) is back online.`, 'Relay Panel').catch(() => {});
      }
    }

    // Temp deviation (only if relay and sensor are both online)
    if (r.temp != null && sn.state && !isNaN(parseFloat(sn.state)) &&
        rl.state !== 'unavailable' && rl.state !== 'unknown' && !rl.missing &&
        sn.state !== 'unavailable' && sn.state !== 'unknown' && !sn.missing) {
      const current = parseFloat(sn.state);
      const target = Number(r.temp);
      const diff = Math.abs(current - target);
      if (diff >= threshold) {
        const dir = current > target ? 'above' : 'below';
        const key = notifyKey(r.id, 'temp_' + dir);
        if (!notifyAlerts.has(key)) {
          // Clear opposite direction so a swing from above→below triggers a new alert
          notifyAlerts.delete(notifyKey(r.id, 'temp_' + (dir === 'above' ? 'below' : 'above')));
          notifyAlerts.set(key, Date.now());
          sendNotifyAll(
            `"${name}" is ${current.toFixed(1)}°C (target ${target}°C, off by ${diff.toFixed(1)}°C).`,
            'Relay Panel').catch(() => {});
        }
      } else {
        // Temp back in range — clear both directions
        ['temp_above', 'temp_below'].forEach((d) => notifyAlerts.delete(notifyKey(r.id, d)));
      }
    }
  }
}

// Start the polling loop (no-op if no notify services configured).
function startNotifyWatcher() {
  if (!NOTIFY_SERVICES.length) return;
  console.log(`notify watcher active: ${NOTIFY_SERVICES.join(', ')}`);
  (function loop() { runNotifyCheck().finally(() => setTimeout(loop, NOTIFY_INTERVAL)); })();
}

module.exports = { notifyAlerts, notifyKey, runNotifyCheck, startNotifyWatcher, NOTIFY_SERVICES };
