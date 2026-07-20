// Zigbee2MQTT control over MQTT. Multiple Z2M instances share the broker, each
// with its own base_topic; we discover which one holds a device (by IEEE) from
// the retained `<base>/bridge/devices`, then rename via its bridge request.
const mqtt = require('mqtt');
const BROKER = process.env.MQTT_URL || 'mqtt://homeassistant.local:1883';

// Find {base, ieee, name} for an IEEE across all Z2M instances.
function findDevice(ieee) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(BROKER, { connectTimeout: 4000, reconnectPeriod: 0 });
    let found = null;
    const fin = (v, err) => { try { client.end(true); } catch {} err ? reject(err) : resolve(v); };
    const to = setTimeout(() => fin(found), 2500); // collect retained lists briefly
    client.on('connect', () => client.subscribe('+/bridge/devices'));
    client.on('error', (e) => { clearTimeout(to); fin(null, e); });
    client.on('message', (topic, payload) => {
      const base = topic.split('/')[0];
      let list; try { list = JSON.parse(payload.toString()); } catch { return; }
      for (const d of list) {
        if (String(d.ieee_address || '').toLowerCase() === ieee.toLowerCase()) {
          found = { base, ieee: d.ieee_address, name: d.friendly_name };
        }
      }
      if (found) { clearTimeout(to); fin(found); }
    });
  });
}

// Rename a Zigbee device in its Z2M instance (propagates to HA via discovery).
async function renameZigbee(ieee, newName) {
  const dev = await findDevice(ieee);
  if (!dev) throw new Error('device not found in any Z2M instance');
  await new Promise((resolve, reject) => {
    const client = mqtt.connect(BROKER, { connectTimeout: 4000, reconnectPeriod: 0 });
    const respTopic = `${dev.base}/bridge/response/device/rename`;
    const fin = (v, err) => { try { client.end(true); } catch {} err ? reject(err) : resolve(v); };
    const to = setTimeout(() => fin(true), 5000); // don't hang if no response
    client.on('connect', () => client.subscribe(respTopic, () => {
      client.publish(`${dev.base}/bridge/request/device/rename`, JSON.stringify({ from: dev.name, to: newName }));
    }));
    client.on('error', (e) => { clearTimeout(to); fin(null, e); });
    client.on('message', (t, p) => {
      let m; try { m = JSON.parse(p.toString()); } catch { return; }
      clearTimeout(to);
      if (m.status === 'ok') fin(true); else fin(null, new Error((m.error && m.error.message) || m.error || 'z2m rename failed'));
    });
  });
  return dev.base;
}

module.exports = { findDevice, renameZigbee };
