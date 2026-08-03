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
// Uses a single MQTT connection for both discovery and rename — issue #49.
async function renameZigbee(ieee, newName) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(BROKER, { connectTimeout: 4000, reconnectPeriod: 0 });
    let dev = null;
    const fin = (v, err) => { try { client.end(true); } catch {} err ? reject(err) : resolve(v); };
    const to = setTimeout(() => {
      if (dev) fin(dev.base); else fin(null, new Error('device not found in any Z2M instance'));
    }, 8000);

    client.on('error', (e) => { clearTimeout(to); fin(null, e); });

    // Phase 1: discover the device across all Z2M instances
    client.on('connect', () => client.subscribe('+/bridge/devices'));
    client.on('message', function onDevices(topic, payload) {
      if (dev) return; // already found, waiting for rename response
      const base = topic.split('/')[0];
      let list; try { list = JSON.parse(payload.toString()); } catch { return; }
      for (const d of list) {
        if (String(d.ieee_address || '').toLowerCase() === ieee.toLowerCase()) {
          dev = { base, name: d.friendly_name }; break;
        }
      }
      if (!dev) return;
      // Phase 2: publish rename request and listen for response
      client.removeListener('message', onDevices);
      const respTopic = `${dev.base}/bridge/response/device/rename`;
      client.subscribe(respTopic);
      client.publish(`${dev.base}/bridge/request/device/rename`, JSON.stringify({ from: dev.name, to: newName }));
      client.on('message', (t, p) => {
        if (t !== respTopic) return; // #62 — ignore stray retained messages from phase 1
        let m; try { m = JSON.parse(p.toString()); } catch { return; }
        clearTimeout(to);
        if (m.status === 'ok') fin(dev.base); else fin(null, new Error((m.error && m.error.message) || m.error || 'z2m rename failed'));
      });
    });
  });
}

module.exports = { findDevice, renameZigbee };
