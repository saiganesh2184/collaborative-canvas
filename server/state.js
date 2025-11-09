// Global op-log with pointer-based undo/redo
class DrawingState {
  constructor(){
    this.ops = [];
    this.activeCount = 0;
    this.undone = [];
  }
  push(op){
    this.ops.push(op);
    this.activeCount = this.ops.length;
    this.undone = [];
  }
  undo(){
    if (this.activeCount <= 0) return;
    this.activeCount--;
    this.undone.push(this.activeCount);
  }
  redo(){
    if (this.undone.length === 0) return;
    const idx = this.undone.pop();
    if (idx === this.activeCount) this.activeCount++;
    else this.activeCount = Math.max(this.activeCount, idx + 1);
  }
  clear(){ this.ops = []; this.activeCount = 0; this.undone = []; }
  snapshot(){ return { ops: this.ops.slice(0, this.activeCount) }; }
}
module.exports = { DrawingState };
