function randomColor(seed){
  let h = 0; for (let i=0;i<seed.length;i++) h = (h*31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h}, 70%, 45%)`;
}
module.exports = { randomColor };
