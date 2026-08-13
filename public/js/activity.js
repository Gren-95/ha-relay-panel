import { $, esc, setMsg, api } from './core.js';
import { t, fmtAgo } from './i18n.js';
import { closeEditor } from './editor.js';
import { closeDeviceEditor } from './device-editor.js';
import { closeBulkEdit } from './bulk.js';
import { closePresets } from './presets.js';
import { positionResizeHandles } from './resize.js';

// ---- activity log ----
const activity = { page: 1, total: 0, perPage: 15 };

function openActivityLog(page) {
  page = page || 1;
  closeEditor(); closeDeviceEditor(); closeBulkEdit(); closePresets();
  activity.page = page;
  $('#activity-editor').classList.remove('hidden');
  requestAnimationFrame(positionResizeHandles);
  loadActivity(page);
}

async function exportActivityCSV() {
  try {
    const data = await api(`/api/activity-log?page=1&per_page=1000`);
    if (!data.entries || !data.entries.length) return;
    const csvEscape = (v) => String(v == null ? '' : v).replace(/"/g, '""');
    const header = 'timestamp,actor,action,detail';
    const csv = header + '\n' + data.entries.map((e) =>
      `"${csvEscape(new Date(e.created_at).toISOString())}","${csvEscape(e.actor || '')}","${csvEscape(t('act_' + e.action.replace('.','_')) || e.action)}","${csvEscape(JSON.stringify(e.detail || {}))}"`
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'activity-log.csv';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch {}
}

function closeActivityLog() {
  $('#activity-editor').classList.add('hidden');
  $('#act-list').innerHTML = '';
}

async function loadActivity(page) {
  page = page || activity.page;
  $('#act-msg').textContent = '';
  try {
    const data = await api(`/api/activity-log?page=${page}&per_page=${activity.perPage}`);
    activity.page = data.page;
    activity.total = data.total;
    renderActivity(data.entries, data.total, data.page);
  } catch (e) {
    setMsg($('#act-msg'), e.message, 'err');
  }
}

function renderActivity(entries, total, page) {
  const list = $('#act-list');
  list.innerHTML = '';
  const totalPages = Math.ceil(total / activity.perPage) || 1;
  $('#act-page-info').textContent = `${page} / ${totalPages}`;
  $('#act-prev').classList.toggle('hidden', page <= 1);
  $('#act-next').classList.toggle('hidden', page >= totalPages);

  if (!entries || !entries.length) {
    list.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--muted)">${t('no_events')}</div>`;
    return;
  }
  entries.forEach((e) => {
    const icon = actionIcon(e.action);
    const time = fmtTime(e.created_at);
    const actor = e.actor || 'anonymous';
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2.5 px-2.5 py-2 bg-surface-2 border-[1.5px] border-border rounded-[10px] text-[.9rem]';
    row.innerHTML =
      `<div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[.9rem] ${icon.cls}"><i class="bi ${icon.icon}"></i></div>` +
      `<div class="flex-1 min-w-0"><div class="font-semibold">${esc(t('act_' + e.action.replace('.','_'))) || esc(e.action)}</div>` +
      `<div class="text-muted text-[.8rem]">${esc(actor)}${formatDetail(e.action, e.detail) ? ' · ' + formatDetail(e.action, e.detail) : ''}</div></div>` +
      `<div class="text-muted text-[.75rem] shrink-0 text-right whitespace-nowrap">${esc(time)}</div>`;
    list.appendChild(row);
  });
}

function formatDetail(action, d) {
  if (!d || !Object.keys(d).length) return '';
  switch (action) {
    case 'relay.delete': return esc(d.name || d.rid || '');
    case 'device.delete': return esc(d.name || d.device_id || '');
    case 'area.delete': return esc(d.name || '');
    case 'relay.bind': return `${esc(d.relay || '')} · ${esc(d.sensor || '')} · ${d.mode === 'above' ? 'cool' : 'heat'} ${d.temp}°C`;
    case 'relay.unbind': return esc(d.name || d.rid || '');
    case 'switch.toggle': return `${esc(d.entity_id || '')} → ${esc(d.action || '')}`;
    case 'device.rename': return `${esc(d.entity_id || '')} → ${esc(d.new_name || '')}`;
    case 'layout.save': return `${d.relays || 0} relays, ${d.areas || 0} areas, ${d.devices || 0} devices`;
    case 'layout.restore': return `backup #${d.backup_id || '?'}`;
    case 'automation.reapply': return `${d.count || 0} automation${d.count === 1 ? '' : 's'}`;
    case 'automation.prune': return esc((d.removed || []).join(', '));
    case 'automation.pause':
    case 'automation.resume': return esc(d.rid || '');
    default: return '';
  }
}

function actionIcon(action) {
  const C = {
    green: 'bg-[#dcfce7] text-[#16a34a]', gray: 'bg-[#f3f4f6] text-[#6b7280]',
    red: 'bg-[#fef2f2] text-[#dc2626]', blue: 'bg-[#eff6ff] text-[#2563eb]',
    sky: 'bg-[#f0f9ff] text-[#0284c7]', yellow: 'bg-[#fefce8] text-[#ca8a04]',
    amber: 'bg-[#fef3c7] text-[#d97706]', amber2: 'bg-[#fffbeb] text-[#d97706]',
  };
  const m = {
    'login':               { icon: 'bi-box-arrow-in-right', cls: C.green },
    'logout':              { icon: 'bi-box-arrow-right',    cls: C.gray },
    'relay.bind':          { icon: 'bi-link-45deg',         cls: C.green },
    'relay.unbind':        { icon: 'bi-link',               cls: C.red },
    'switch.toggle':       { icon: 'bi-power',              cls: C.blue },
    'device.rename':       { icon: 'bi-pencil',             cls: C.sky },
    'layout.save':         { icon: 'bi-floppy',             cls: C.yellow },
    'layout.restore':      { icon: 'bi-arrow-counterclockwise', cls: C.amber },
    'automation.reapply':  { icon: 'bi-arrow-repeat',       cls: C.gray },
    'automation.prune':    { icon: 'bi-eraser',             cls: C.red },
    'automation.pause':    { icon: 'bi-pause-fill',         cls: C.amber2 },
    'automation.resume':   { icon: 'bi-play-fill',          cls: C.green },
    'relay.delete':        { icon: 'bi-trash',              cls: C.red },
    'device.delete':       { icon: 'bi-trash',              cls: C.red },
    'area.delete':         { icon: 'bi-trash',              cls: C.red },
  };
  return m[action] || { icon: 'bi-circle', cls: C.gray };
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts + (ts.endsWith('Z') ? '' : 'Z'));
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 86400000) return fmtAgo(diff);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// wiring for the activity-log panel
export function initActivity() {
$('#act-close').addEventListener('click', closeActivityLog);
$('#act-prev').addEventListener('click', () => { if (activity.page > 1) loadActivity(activity.page - 1); });
$('#act-next').addEventListener('click', () => loadActivity(activity.page + 1));
$('#act-csv').addEventListener('click', exportActivityCSV);
}

export { openActivityLog, exportActivityCSV, closeActivityLog, loadActivity, renderActivity,
  formatDetail, actionIcon, fmtTime };
