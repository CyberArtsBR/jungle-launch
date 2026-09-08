window.JL = window.JL || {};
JL.World = class World{
  constructor(seed){ this.reset(seed); }
  reset(seed){
    this.seed=seed>>>0; this.rng=new JL.RNG(this.seed); this.objects=[]; this.spawnX=760; this.terrainPatches=[]; this.lastTypes=[];
    this.decorSeed=new JL.RNG(this.seed^0x9e3779b9);
    this.generateTerrain(16000);
  }
  metersAt(x,startX){ return Math.max(0,(x-startX)*JL.CONFIG.METERS_PER_PX); }
  biomeAt(m){ let b=JL.CONFIG.BIOMES[0]; for(const s of JL.CONFIG.BIOMES)if(m>=s.m)b=s; return b; }
  groundAt(x){ return JL.CONFIG.GROUND_Y + Math.sin(x*.0030)*10 + Math.sin(x*.0081)*5 + Math.sin(x*.0009+1.7)*12; }
  generateTerrain(maxMeters){
    const endPx=maxMeters/JL.CONFIG.METERS_PER_PX;
    let x=1000;
    while(x<endPx){
      x+=this.rng.range(900,1800);
      const roll=this.rng.next();
      let type='dirt';
      if(roll<.18)type='mud'; else if(roll<.34)type='rock'; else if(roll<.44)type='water'; else if(roll<.55)type='moss';
      const len=this.rng.range(180,430);
      this.terrainPatches.push({x1:x,x2:x+len,type}); x+=len;
    }
  }
  surfaceAt(x){
    let type='dirt';
    for(const p of this.terrainPatches){ if(x>=p.x1&&x<=p.x2){type=p.type;break;} if(p.x1>x)break; }
    if(type==='mud')return {type,bounce:.58,friction:.77};
    if(type==='water')return {type,bounce:.48,friction:.69};
    if(type==='rock')return {type,bounce:1.08,friction:.985};
    if(type==='moss')return {type,bounce:.90,friction:.94};
    return {type,bounce:1,friction:.955};
  }
  nextSpacing(speedMps){
    const reactionPx=JL.clamp(speedMps*8.8,300,920);
    return reactionPx*this.rng.range(.75,1.14);
  }
  chooseType(m,speedMps){
    const r=this.rng.next();
    let table;
    if(m<700) table=[['banana',.18],['mushroom',.18],['gorilla',.17],['toucan',.13],['turtle',.10],['rock',.08],['sloth',.06],['jaguar',.07],['vine',.03]];
    else if(m<1800) table=[['banana',.14],['mushroom',.12],['gorilla',.14],['toucan',.13],['jaguar',.12],['vine',.12],['sloth',.08],['turtle',.07],['rock',.05],['idol',.03]];
    else if(m<3600) table=[['banana',.13],['toucan',.12],['jaguar',.11],['puddle',.12],['turtle',.09],['gorilla',.10],['mushroom',.08],['sloth',.08],['vine',.08],['rock',.06],['idol',.03]];
    else table=[['banana',.12],['toucan',.12],['jaguar',.13],['gorilla',.12],['mushroom',.09],['vine',.11],['turtle',.07],['sloth',.07],['rock',.08],['puddle',.05],['idol',.04]];
    if(this.lastTypes.slice(-2).some(t=>t==='sloth'||t==='puddle')) table=table.filter(([t])=>t!=='sloth'&&t!=='puddle');
    let total=table.reduce((a,b)=>a+b[1],0), acc=0, rr=r*total;
    for(const [type,w] of table){ acc+=w; if(rr<=acc){ this.lastTypes.push(type); this.lastTypes=this.lastTypes.slice(-4); return type; } }
    return 'banana';
  }
  spawnAhead(player,startX,lookAhead=4700){
    const speed=Math.max(30,player.vx*JL.CONFIG.METERS_PER_PX);
    while(this.spawnX<player.x+lookAhead){
      this.spawnX+=this.nextSpacing(speed);
      const m=this.metersAt(this.spawnX,startX);
      const type=this.chooseType(m,speed);
      const def=JL.ENCOUNTERS[type];
      let y=this.groundAt(this.spawnX)-30;
      if(type==='toucan') y=this.rng.range(290,455);
      else if(type==='banana') y=this.rng.range(235,500);
      else if(type==='vine') y=this.groundAt(this.spawnX)-84;
      else if(type==='sloth') y=this.groundAt(this.spawnX)-106;
      else if(type==='puddle'||type==='rock') y=this.groundAt(this.spawnX)-12;
      else if(type==='idol') y=this.groundAt(this.spawnX)-45;
      this.objects.push({type,x:this.spawnX,y,r:def.r,hit:false,phase:this.rng.range(0,Math.PI*2)});

      if(type!=='banana'&&this.rng.next()<.18){
        const n=this.rng.int(3,6), arc=this.rng.range(30,90);
        for(let i=1;i<=n;i++){
          const bx=this.spawnX+i*54, by=y-40-Math.sin((i/(n+1))*Math.PI)*arc;
          this.objects.push({type:'banana',x:bx,y:by,r:JL.ENCOUNTERS.banana.r,hit:false,phase:this.rng.range(0,6)});
        }
        this.spawnX+=n*54;
      }
    }
  }
  cleanup(cameraX){ this.objects=this.objects.filter(o=>o.x>cameraX-520); }
};
