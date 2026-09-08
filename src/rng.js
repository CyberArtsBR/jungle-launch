window.JL = window.JL || {};
JL.RNG = class RNG{
  constructor(seed=1){ this.state=(seed>>>0)||1; }
  next(){ let x=this.state; x^=x<<13; x^=x>>>17; x^=x<<5; this.state=x>>>0; return this.state/4294967296; }
  range(a,b){ return a+(b-a)*this.next(); }
  int(a,b){ return Math.floor(this.range(a,b+1)); }
  pick(arr){ return arr[Math.floor(this.next()*arr.length)]; }
};
JL.hashSeed = function(input){
  let h=2166136261>>>0; const s=String(input);
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0;
};
