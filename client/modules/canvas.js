// Canvas & replay & cursors
export function setupCanvas(canvas) {
  const stage = canvas.parentElement;
  const dpr = () => window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');

  const cfg = { tool: 'brush', color: '#0ea5e9', width: 6 };
  const listeners = { onStart: null, onPoint: null, onEnd: null, onCursor: null };
  let ops = [];
  const cursors = new Map();

  let frames = 0, lastFpsAt = performance.now();
  const statHandlers = [];

  function setTool(t){ cfg.tool = t; }
  function setColor(c){ cfg.color = c; }
  function setWidth(w){ cfg.width = w; }

  function resize(){
    const { clientWidth, clientHeight } = stage;
    canvas.width = Math.floor(clientWidth * dpr());
    canvas.height = Math.floor(clientHeight * dpr());
    canvas.style.width = clientWidth + "px";
    canvas.style.height = clientHeight + "px";
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr(), dpr());
    replay();
  }

  function drawStroke(stroke) {
    const composite = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.save();
    ctx.globalCompositeOperation = composite;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;

    const pts = stroke.points;
    if (!pts || pts.length < 2) { ctx.restore(); return; }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i+1].x) / 2;
      const midY = (pts[i].y + pts[i+1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  }

  function clearCanvas(){ ctx.clearRect(0,0,canvas.width,canvas.height); }
  function replay(){ clearCanvas(); for (const s of ops) drawStroke(s); }
  function applyFullState(state){ ops = state.ops || []; replay(); }

  const inflight = new Map();
  function remoteStrokeStart(s){ inflight.set(s.id, { ...s, points: [s.points[0]] }); }
  function remoteStrokePoint(p){ const s = inflight.get(p.id); if (!s) return; s.points.push(p.point); drawStroke(s); }
  function remoteStrokeEnd(s){ inflight.delete(s.id); ops.push(s); drawStroke(s); }

  let drawing = false, current = null;
  const toCanvasPt = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
  };

  let queuedPoint = null, rafId = null;
  function scheduleSendPoint(){
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (queuedPoint && listeners.onPoint) listeners.onPoint({ id: current.id, point: queuedPoint });
      queuedPoint = null;
    });
  }

  function start(e){
    e.preventDefault();
    drawing = true;
    const touch = e.touches ? e.touches[0] : e;
    const p = toCanvasPt(touch);
    current = { id: genId(), userId: 'local', tool: cfg.tool, color: cfg.color, width: cfg.width, points: [p], ts: Date.now() };
    if (listeners.onStart) listeners.onStart({ ...current });
  }
  function move(e){
    if (!drawing) { sendCursor(e); return; }
    const touch = e.touches ? e.touches[0] : e;
    const p = toCanvasPt(touch);
    current.points.push(p);
    drawStroke(current);
    queuedPoint = p;
    scheduleSendPoint();
  }
  function end(){
    if (!drawing) return;
    drawing = false;
    if (listeners.onEnd) listeners.onEnd({ ...current });
    ops.push(current);
    current = null;
  }

  let cursorQueued = null, cursorRaf = null;
  function sendCursor(e){
    const touch = e.touches ? e.touches[0] : e;
    const p = toCanvasPt(touch);
    cursorQueued = { x: p.x, y: p.y };
    if (cursorRaf) return;
    cursorRaf = requestAnimationFrame(() => {
      cursorRaf = null;
      if (listeners.onCursor) listeners.onCursor({ x: cursorQueued.x, y: cursorQueued.y });
    });
  }

  function showRemoteCursor({ userId, x, y, color, name }){
    let node = cursors.get(userId);
    if (!node){
      node = document.createElement('div');
      node.className = 'cursor';
      stage.appendChild(node);
      cursors.set(userId, node);
    }
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    node.style.boxShadow = `0 0 0 2px ${color || '#333'} inset`;
    node.textContent = name ? `◉ ${name}` : '◉';
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive:false });
  canvas.addEventListener('touchmove', move, { passive:false });
  canvas.addEventListener('touchend', end);

  function tick(){
    frames++;
    const now = performance.now();
    if (now - lastFpsAt >= 1000){
      const fps = frames; frames = 0; lastFpsAt = now;
      statHandlers.forEach(h => h({ fps }));
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    api: { remoteStrokeStart, remoteStrokePoint, remoteStrokeEnd, applyFullState, replay, showRemoteCursor,
      onLocalEvents: (h) => { Object.assign(listeners, h); } },
    setTool, setColor, setWidth, onRenderStats: (h) => statHandlers.push(h), resize
  };
}
function genId(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }
