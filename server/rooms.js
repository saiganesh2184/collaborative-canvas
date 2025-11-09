const { DrawingState } = require('./state');
const { randomColor } = require('./util');

class Rooms {
  constructor(){ this.map = new Map(); }

  ensure(room){
    if (!this.map.has(room)) this.map.set(room, { state: new DrawingState(), users: new Map() });
    return this.map.get(room);
  }

  addUser(room, socketId){
    const r = this.ensure(room);
    const user = { id: socketId, name: socketId.slice(0,6), color: randomColor(socketId) };
    r.users.set(socketId, user);
    return user;
  }

  getUser(room, id){ return this.ensure(room).users.get(id); }
  removeUser(room, id){ this.ensure(room).users.delete(id); }
  roster(room){ return Array.from(this.ensure(room).users.values()); }

  pushOp(room, op){ this.ensure(room).state.push(op); }
  undo(room){ this.ensure(room).state.undo(); }
  redo(room){ this.ensure(room).state.redo(); }
  clear(room){ this.ensure(room).state.clear(); }
  getState(room){ return this.ensure(room).state.snapshot(); }
}

module.exports = { Rooms };
