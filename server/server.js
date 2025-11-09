// server/server.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Rooms } = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// Serve static client
app.use('/client', express.static(path.join(__dirname, '..', 'client')));
app.get('/', (_, res) => res.redirect('/client/index.html'));

const rooms = new Rooms();

io.on('connection', (socket) => {
  let currentRoom = null;

  // Join room
  socket.on('join', ({ room }) => {
    if (currentRoom) socket.leave(currentRoom);
    currentRoom = room || 'lobby';
    socket.join(currentRoom);
    rooms.addUser(currentRoom, socket.id);

    io.to(currentRoom).emit('roster', rooms.roster(currentRoom));
    socket.emit('welcome', {
      user: rooms.getUser(currentRoom, socket.id),
      userCount: rooms.roster(currentRoom).length,
      roster: rooms.roster(currentRoom),
    });
  });

  // Send full state on request
  socket.on('request:state', ({ room }) => {
    socket.emit('state', rooms.getState(room));
  });

  // Live stroke streaming
  socket.on('stroke:start', ({ room, stroke }) => {
    socket.to(room).emit('stroke:start', stroke);
  });

  // IMPORTANT: forward the point payload as-is
  socket.on('stroke:point', ({ room, point }) => {
    socket.to(room).emit('stroke:point', point);
  });

  socket.on('stroke:end', ({ room, stroke }) => {
    rooms.pushOp(room, { ...stroke, userId: socket.id });
    io.to(room).emit('stroke:end', { ...stroke, userId: socket.id });
  });

  // Cursor broadcast
  socket.on('cursor', ({ room, cursor }) => {
    const u = rooms.getUser(room, socket.id);
    if (!u) return;
    socket.to(room).emit('cursor', {
      userId: socket.id,
      x: cursor.x,
      y: cursor.y,
      color: u.color,
      name: u.name,
    });
  });

  // Global undo/redo: broadcast the new authoritative state
  socket.on('undo', ({ room }) => {
    rooms.undo(room);
    io.to(room).emit('state', rooms.getState(room));
  });

  socket.on('redo', ({ room }) => {
    rooms.redo(room);
    io.to(room).emit('state', rooms.getState(room));
  });

  // Clear: also broadcast the (empty) state
  socket.on('clear', ({ room }) => {
    rooms.clear(room);
    io.to(room).emit('state', rooms.getState(room));
  });

  // Latency ping
  socket.on('ping:client', () => socket.emit('ping:server'));
  socket.on('latency', (ms) => io.to(currentRoom).emit('latency', ms));

  // Disconnect
  socket.on('disconnect', () => {
    if (!currentRoom) return;
    rooms.removeUser(currentRoom, socket.id);
    io.to(currentRoom).emit('roster', rooms.roster(currentRoom));
  });
});

server.listen(PORT, () => console.log(`Server at http://localhost:${PORT}`));
