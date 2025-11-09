import { setupCanvas } from './modules/canvas.js';
import { connectWS } from './modules/websocket.js';

const canvasEl = document.getElementById('canvas');
const ui = {
  brushBtn: document.getElementById('tool-brush'),
  eraserBtn: document.getElementById('tool-eraser'),
  color: document.getElementById('color'),
  width: document.getElementById('width'),
  undo: document.getElementById('undo'),
  redo: document.getElementById('redo'),
  clear: document.getElementById('clear'),
  roomInput: document.getElementById('room-input'),
  joinRoom: document.getElementById('join-room'),
  users: document.getElementById('user-list'),
  latency: document.getElementById('latency'),
  fps: document.getElementById('fps'),
  usersCount: document.getElementById('users'),
  roomLabel: document.getElementById('room'),
};

const state = { room: 'lobby', user: null };
const { api: canvasApi, setTool, setColor, setWidth, onRenderStats, resize } = setupCanvas(canvasEl);

function selectTool(tool) {
  setTool(tool);
  ui.brushBtn.classList.toggle('active', tool === 'brush');
  ui.eraserBtn.classList.toggle('active', tool === 'eraser');
}
function setActiveWidthButton(w) {
  document.querySelectorAll('.width-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.w) === w);
  });
}

ui.brushBtn.onclick = () => selectTool('brush');
ui.eraserBtn.onclick = () => selectTool('eraser');
ui.color.oninput = (e) => setColor(e.target.value);
ui.width.oninput = (e) => setWidth(Number(e.target.value));
ui.undo.onclick = () => ws.emit('undo', { room: state.room });
ui.redo.onclick = () => ws.emit('redo', { room: state.room });
ui.clear.onclick = () => ws.emit('clear', { room: state.room });
ui.joinRoom.onclick = () => joinRoom(ui.roomInput.value.trim() || 'lobby');
// Quick width buttons
document.querySelectorAll('.width-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const w = Number(btn.dataset.w);
    setWidth(w);
    setActiveWidthButton(w);
  });
});

// Initialize highlight to match the slider's default value
setActiveWidthButton(Number(ui.width.value));


window.addEventListener('resize', resize);
window.addEventListener('keydown', (e) => {
  const z = e.key.toLowerCase() === 'z';
  const y = e.key.toLowerCase() === 'y';
  const meta = e.ctrlKey || e.metaKey;
  if (meta && z) { e.preventDefault(); ws.emit('undo', { room: state.room }); }
  if (meta && y) { e.preventDefault(); ws.emit('redo', { room: state.room }); }
  if (e.key.toLowerCase() === 'b') selectTool('brush');
  if (e.key.toLowerCase() === 'e') selectTool('eraser');
});

let ws;
function joinRoom(room) {
  if (ws) ws.disconnect();
  state.room = room;
  ui.roomLabel.textContent = `room:${room}`;
  ws = connectWS({ room });

  ws.on('welcome', (payload) => {
    state.user = payload.user;
    ui.usersCount.textContent = `users:${payload.userCount}`;
    renderUsers(payload.roster);
  });

  ws.on('roster', (roster) => { renderUsers(roster); ui.usersCount.textContent = `users:${roster.length}`; });
  ws.on('latency', (ms) => ui.latency.textContent = `latency:${ms}ms`);

  ws.on('stroke:start', (s) => canvasApi.remoteStrokeStart(s));
  ws.on('stroke:point', (p) => canvasApi.remoteStrokePoint(p));
  ws.on('stroke:end', (s) => canvasApi.remoteStrokeEnd(s));

  ws.on('cursor', (c) => canvasApi.showRemoteCursor(c));
  ws.on('state', (full) => canvasApi.applyFullState(full));
  ws.on('op:undone', () => canvasApi.replay());
  ws.on('op:redone', () => canvasApi.replay());
  ws.on('cleared', () => canvasApi.applyFullState({ ops: [] }));

  canvasApi.onLocalEvents({
    onStart: (stroke) => ws.emit('stroke:start', { room, stroke }),
    onPoint: (pt) => ws.emit('stroke:point', { room, point: pt }),
    onEnd: (stroke) => ws.emit('stroke:end', { room, stroke }),
    onCursor: (cur) => ws.emit('cursor', { room, cursor: cur }),
  });

  ws.emit('request:state', { room });
}

function renderUsers(roster) {
  ui.users.innerHTML = '';
  roster.forEach(u => {
    const div = document.createElement('div');
    div.className = 'user';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = u.color;
    const name = document.createElement('span');
    name.textContent = u.name || u.id.slice(0,6);
    div.appendChild(dot); div.appendChild(name);
    ui.users.appendChild(div);
  });
}

onRenderStats(({ fps }) => ui.fps.textContent = `fps:${fps}`);
selectTool('brush');
joinRoom('lobby');
