// Socket.io wrapper with latency ping
export function connectWS({ room }){
  const socket = io({ transports:['websocket'] });

  socket.on('connect', () => { socket.emit('join', { room }); });

  let lastPing = 0;
  setInterval(() => { lastPing = Date.now(); socket.emit('ping:client'); }, 2000);
  socket.on('ping:server', () => socket.emit('latency', Date.now() - lastPing));

  return socket;
}
