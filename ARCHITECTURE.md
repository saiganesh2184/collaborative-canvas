\# 🧱 Architecture



This document explains \*\*data flow\*\*, the \*\*WebSocket protocol\*\*, the \*\*undo/redo logic\*\*, \*\*performance decisions\*\*, and \*\*conflict resolution\*\*.



---



\## 🔄 Data Flow Diagram



\[Mouse/Touch Input]

│

▼

\[Canvas Engine (client/modules/canvas.js)]

├─ local prediction: draw immediately

├─ rAF-batched point emit

└─ cursor broadcast

│

▼

\[Socket.io Client (client/modules/websocket.js)]

│

▼

\[Socket.io Server (server/server.js)]

│

▼

\[Rooms (server/rooms.js) + DrawingState (server/state.js)]

├─ append strokes to op-log

├─ global undo/redo by moving active pointer

└─ broadcast snapshots + live events

▲

└──────────────(state / stroke:\* / cursor / roster / latency)──────────────





\*\*Authoritative state lives on the server.\*\* Clients draw optimistically while streaming points, and reconcile on server snapshots.



---



\## 🔌 WebSocket Protocol



\### Client → Server

\- `join { room }` – join/create a room.

\- `request:state { room }` – ask for authoritative active strokes.

\- `stroke:start { room, stroke }` – begin stroke:  

&nbsp; `stroke = { id, tool:'brush'|'eraser', color, width, points:\[{x,y}], ts }`

\- `stroke:point { room, point }` – live points while drawing:  

&nbsp; `point = { id, point:{x,y} }`

\- `stroke:end { room, stroke }` – finalize; server appends to op-log.

\- `cursor { room, cursor:{x,y} }` – live cursor broadcast.

\- `undo { room }` / `redo { room }` – global operations.

\- `clear { room }` – clear history for room.

\- `ping:client` – latency heartbeat.



\### Server → Client

\- `welcome { user, userCount, roster }`

\- `roster \[users]` – who’s online in room.

\- `state { ops }` – \*\*authoritative\*\* active strokes to render.

\- `stroke:start` / `stroke:point` / `stroke:end` – live stroke streaming.

\- `cursor { userId, x, y, color, name }`

\- `latency <ms>`



> After \*\*undo/redo/clear\*\*, the server emits a fresh \*\*`state`\*\* snapshot. Clients redraw from this to stay consistent.



---



\## ↩️ Global Undo/Redo Strategy



\*\*Model:\*\* append-only `ops\[]` + integer `activeCount` pointer.



\- \*\*Add stroke\*\*: `ops.push(stroke)`, `activeCount = ops.length`, clear redo stack.

\- \*\*Undo\*\*: if `activeCount > 0` → `activeCount--`, push index to `undone\[]`.

\- \*\*Redo\*\*: pop from `undone\[]`, set `activeCount` accordingly.

\- \*\*Broadcast\*\*: on undo/redo/clear

&nbsp; ```js

&nbsp; io.to(room).emit('state', { ops: ops.slice(0, activeCount) });

---



\## ⚡ Performance Decisions



\- \*\*rAF batching of points\*\* — reduces flood of move events to one per frame.

\- \*\*Client-side prediction\*\* — strokes appear instantly before the server echoes them.

\- \*\*Curve smoothing\*\* — quadratic Bézier midpoints produce smooth strokes.

\- \*\*HiDPI-aware resize\*\* — uses `devicePixelRatio` for crisp rendering.

\- \*\*Replay only on structural changes\*\* — clear/replay only on undo/redo/clear/state.



\*\*Scaling plan:\*\*

\- Throttle point frequency under load.

\- Persist operation logs to disk or Redis.

\- Use socket.io clustering for 1000+ users.



---



\## ⚔️ Conflict Resolution



\- \*\*Overlapping strokes\*\* → resolved by draw order (later strokes appear on top).

\- \*\*Eraser tool\*\* → uses `destination-out` to remove existing pixels.

\- \*\*Simultaneous drawing\*\* → each stroke has a unique ID, order fixed on `stroke:end`.

\- \*\*Global undo/redo\*\* → affects most recent stroke globally.



---



\## 🧩 File Responsibilities



| File | Role |

|------|------|

| `client/modules/canvas.js` | Canvas drawing, smoothing, replay, cursors |

| `client/modules/websocket.js` | Socket connection, ping/latency |

| `client/main.js` | UI controls, room join, event wiring |

| `server/state.js` | Operation log + global undo/redo |

| `server/rooms.js` | Room and user management |

| `server/server.js` | Express + Socket.io server logic |

| `server/util.js` | Deterministic color per user |



---



\*\*Summary:\*\*  

This architecture uses a \*\*server-authoritative model\*\* with client-side prediction for instant feedback.  

Undo/redo are global for simplicity and deterministic consistency across all users.



