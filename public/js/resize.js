import { $ } from './core.js';

// ---- resizable sidebar ----
function initResizeHandles() {
  document.querySelectorAll('.editor').forEach((el) => {
    if (el.querySelector('.editor-resize')) return;
    const h = document.createElement('div');
    h.className = 'editor-resize fixed w-[6px] cursor-ew-resize z-[5] pointer-events-auto active:bg-[rgba(59,110,245,.15)]';
    h.dataset.target = el.id;
    el.appendChild(h);
  });
}

function positionResizeHandles() {
  document.querySelectorAll('.editor-resize').forEach((h) => {
    const editor = h.closest('.editor');
    if (!editor || editor.classList.contains('hidden')) { h.style.display = 'none'; return; }
    const r = editor.getBoundingClientRect();
    h.style.display = '';
    h.style.top = r.top + 'px';
    h.style.left = r.left + 'px';
    h.style.height = r.height + 'px';
  });
}

function setEditorWidth(w) { try { localStorage.setItem('rp-editor-w', w); } catch {} }
function getEditorWidth() { try { return parseInt(localStorage.getItem('rp-editor-w')) || 400; } catch { return 400; } }

// wiring: create + position the editor resize handles and the drag behaviour
export function initResize() {
initResizeHandles();

window.addEventListener('scroll', positionResizeHandles, { passive: true });
window.addEventListener('resize', positionResizeHandles);

let resizeState = null;
document.addEventListener('mousedown', (e) => {
  if (!e.target.classList.contains('editor-resize')) return;
  const editor = e.target.closest('.editor');
  if (!editor) return;
  resizeState = { editor, startX: e.clientX, startW: editor.offsetWidth };
  e.preventDefault();
});
document.addEventListener('mousemove', (e) => {
  if (!resizeState) return;
  const dx = resizeState.startX - e.clientX;
  const w = Math.max(280, Math.min(800, resizeState.startW + dx));
  resizeState.editor.style.width = w + 'px';
  positionResizeHandles();
  if (resizeState.editor.id === 'editor') setEditorWidth(w);
});
document.addEventListener('mouseup', () => { resizeState = null; });

const editorWidth = getEditorWidth();
$('#editor').style.width = editorWidth + 'px';
}

export { initResizeHandles, positionResizeHandles, setEditorWidth, getEditorWidth };
