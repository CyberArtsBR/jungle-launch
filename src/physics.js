window.JL = window.JL || {};
JL.clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
JL.lerp=(a,b,t)=>a+(b-a)*t;
JL.mag=(x,y)=>Math.hypot(x,y);
JL.segmentCircleHit=function(ax,ay,bx,by,cx,cy,r){
  const abx=bx-ax, aby=by-ay, acx=cx-ax, acy=cy-ay;
  const d=abx*abx+aby*aby;
  let t=d>0?(acx*abx+acy*aby)/d:0; t=JL.clamp(t,0,1);
  const px=ax+abx*t, py=ay+aby*t;
  const dx=px-cx, dy=py-cy;
  return dx*dx+dy*dy<=r*r;
};
JL.Player = class Player{
  constructor(x,y){ this.reset(x,y); }
  reset(x,y){
    Object.assign(this,{x,y,px:x,py:y,vx:0,vy:0,r:JL.CONFIG.PLAYER_RADIUS,rot:0,boosts:3,dive:100,diving:false,
      combo:0,comboTimer:0,history:[],runBananas:0,maxHeight:0,topSpeed:0,bounces:0,encounters:0,shield:0,trail:[],squash:0,limb:0,alive:true});
  }
  launch(angleDeg,power){
    const L=JL.CONFIG.LAUNCH, rad=angleDeg*Math.PI/180;
    const shaped=Math.pow(power,L.powerExponent);
    let speed=L.minSpeed+shaped*L.maxBonus;
    const perfect=power>=L.perfectThreshold;
    if(perfect) speed*=L.perfectMultiplier;
    this.vx=Math.cos(rad)*speed; this.vy=-Math.sin(rad)*speed;
    return {speed,perfect};
  }
  boost(){ if(this.boosts<=0)return false; this.boosts--; this.vx+=210; this.vy-=540; this.diving=false; this.squash=.32; return true; }
  diveNow(){ if(this.dive<30)return false; this.dive-=32; this.vx+=110; this.vy+=720; this.diving=true; this.squash=.28; return true; }
  step(dt,world){
    this.px=this.x; this.py=this.y;
    this.comboTimer=Math.max(0,this.comboTimer-dt); if(this.comboTimer===0)this.combo=0;
    this.dive=JL.clamp(this.dive+dt*16,0,100);
    this.vy+=JL.CONFIG.GRAVITY*dt;
    const speed=Math.hypot(this.vx,this.vy);
    const drag=JL.CONFIG.AIR.baseDrag+JL.CONFIG.AIR.highSpeedDrag*speed*speed;
    this.vx*=Math.max(0,1-drag*dt*60);
    this.vy*=Math.max(0,1-drag*.12*dt*60);
    this.x+=this.vx*dt; this.y+=this.vy*dt;
    this.rot += (Math.atan2(this.vy,Math.max(1,this.vx))-this.rot)*Math.min(1,dt*7);
    this.maxHeight=Math.max(this.maxHeight,JL.CONFIG.GROUND_Y-this.y);
    this.topSpeed=Math.max(this.topSpeed,Math.max(0,this.vx*JL.CONFIG.METERS_PER_PX));
    this.squash=Math.max(0,this.squash-dt*1.5); this.limb+=dt*JL.clamp(this.vx/170,2,11);
    this.trail.push({x:this.x,y:this.y,t:1}); if(this.trail.length>40)this.trail.shift(); this.trail.forEach(p=>p.t-=dt*1.9);

    const gy=world.groundAt(this.x), surface=world.surfaceAt(this.x);
    if(this.y+this.r>=gy && this.vy>0){
      this.y=gy-this.r;
      const impact=this.vy;
      const shallow=Math.abs(this.vy)/(Math.abs(this.vx)+1)<.34;
      let retention=this.diving?JL.CONFIG.GROUND.diveRetention:JL.CONFIG.GROUND.defaultRetention;
      retention*=surface.bounce;
      if(shallow) retention*=.82;
      this.vy=-impact*retention;
      let horizontalRetention=surface.friction;
      if(this.diving){ this.vx*=1.09; this.vx+=Math.min(180,impact*.12); }
      else this.vx*=horizontalRetention;
      this.diving=false; this.bounces++; this.squash=JL.clamp(impact/850,.15,.48);
      if(Math.abs(this.vy)<JL.CONFIG.GROUND.minRebound) this.vy=-Math.max(JL.CONFIG.GROUND.minRebound,this.vx*.065);
      return {groundImpact:true,impact,surface,shallow};
    }
    return null;
  }
};
