window.JL = window.JL || {};
(() => {
  'use strict';
  const canvas=document.getElementById('game');

  class SFX{
    constructor(){this.ctx=null;this.enabled=true;}
    ensure(){if(!this.enabled)return null;if(!this.ctx){try{this.ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){this.enabled=false;}}if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume();return this.ctx;}
    pulse(kind='ui'){
      const a=this.ensure();if(!a)return;const o=a.createOscillator(),g=a.createGain();let f=280,d=.06,type='sine';
      if(kind==='pickup'){f=760;d=.045;type='triangle';}else if(kind==='launch'){f=135;d=.13;type='sawtooth';}else if(kind==='impact'){f=90;d=.08;type='square';}else if(kind==='special'){f=520;d=.18;type='triangle';}else if(kind==='boost'){f=360;d=.08;type='sawtooth';}
      o.type=type;o.frequency.setValueAtTime(f,a.currentTime);if(kind==='launch'||kind==='impact')o.frequency.exponentialRampToValueAtTime(Math.max(45,f*.55),a.currentTime+d);
      g.gain.setValueAtTime(.0001,a.currentTime);g.gain.exponentialRampToValueAtTime(.08,a.currentTime+.008);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+d);
      o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+d+.01);
    }
  }

  class Game{
    constructor(){
      this.renderer=new JL.Renderer(canvas);this.sfx=new SFX();
      this.save={best:+(JL.storage.get('jungleLaunchBest')||0),bananas:+(JL.storage.get('jungleLaunchBananas')||0)};
      this.startX=280;this.seed=JL.hashSeed(Date.now());this.runSerial=0;this.rngVisual=new JL.RNG(this.seed^0xa341316c);
      this.world=new JL.World(this.seed);this.player=new JL.Player(this.startX,JL.CONFIG.GROUND_Y-78);
      this.camera={x:500,y:360,zoom:1};this.state='menu';this.prevState='flight';this.aimAngle=26;this.aimDir=1;this.power=.5;this.powerDir=1;
      this.banner={text:'',sub:'',timer:0};this.screenShake=0;this.freezeTimer=0;this.specialWindow=null;this.particles=[];this.accumulator=0;this.last=performance.now();this.simTime=0;this.debug=false;this.fps=60;this.lastBiome='TREEHOUSE FOREST';this.recordAnnounced=false;this.touchStartY=null;
      this.bindInput();requestAnimationFrame(t=>this.frame(t));
    }
    newSeed(){this.runSerial++;return JL.hashSeed(`${Date.now()}-${this.runSerial}-${this.seed}`);}
    beginRun(newSeed=true){
      if(newSeed)this.seed=this.newSeed();
      this.world.reset(this.seed);this.rngVisual=new JL.RNG(this.seed^0xa341316c);this.player.reset(this.startX,JL.CONFIG.GROUND_Y-78);this.world.spawnAhead(this.player,this.startX,5200);
      this.camera={x:500,y:360,zoom:1};this.state='aim';this.aimAngle=26;this.aimDir=1;this.power=.50;this.powerDir=1;this.banner={text:'AIM',sub:'Click / SPACE to lock launch angle',timer:1.8};this.screenShake=0;this.freezeTimer=0;this.specialWindow=null;this.particles=[];this.accumulator=0;this.simTime=0;this.lastBiome=this.currentBiome().name;this.recordAnnounced=false;
    }
    distance(){return Math.max(0,(this.player.x-this.startX)*JL.CONFIG.METERS_PER_PX);}
    currentBiome(){return this.world.biomeAt(this.distance());}
    showBanner(text,sub,timer=.85){this.banner={text,sub,timer};}
    hitStop(sec){this.freezeTimer=Math.max(this.freezeTimer,sec);}
    audioPulse(kind){this.sfx.pulse(kind);}
    fxBurst(x,y,n,kind){for(let i=0;i<n;i++)this.particles.push({x,y,vx:this.rngVisual.range(-280,280),vy:this.rngVisual.range(-360,80),life:this.rngVisual.range(.35,1.1),s:this.rngVisual.range(2.5,9),kind});}
    impact(text,sub,o,shake,kind,freeze){this.showBanner(text,sub,.88);this.screenShake=Math.max(this.screenShake,shake);this.hitStop(freeze);this.fxBurst(o.x,o.y,26,kind);this.sfx.pulse('impact');}
    activateSpecial(){
      if(!this.specialWindow||this.specialWindow.timer<=0||this.specialWindow.used)return false;
      this.specialWindow.used=true;this.specialWindow.timer=0;
      this.player.vx=Math.min(4500,Math.max(this.player.vx*1.18,3300));this.player.vy=Math.min(this.player.vy,-820);this.player.boosts=Math.min(3,this.player.boosts+1);
      this.showBanner('ANCIENT BLAST!','Perfect reaction — massive launch',1.45);this.hitStop(.11);this.screenShake=18;this.fxBurst(this.player.x,this.player.y,70,'mystic');this.sfx.pulse('special');return true;
    }
    primary(){
      this.sfx.ensure();
      if(this.specialWindow&&this.specialWindow.timer>0){this.activateSpecial();return;}
      if(this.state==='menu'){this.beginRun(true);return;}
      if(this.state==='aim'){this.state='power';this.showBanner('POWER','Hit the red PERFECT zone for maximum launch',1.3);return;}
      if(this.state==='power'){
        const result=this.player.launch(this.aimAngle,this.power);this.state='flight';this.screenShake=result.perfect?11:6;this.fxBurst(this.player.x,this.player.y,30,'dust');this.sfx.pulse('launch');
        if(result.perfect){this.hitStop(.10);this.showBanner('PERFECT LAUNCH!',`${Math.round(result.speed*JL.CONFIG.METERS_PER_PX)} m/s initial speed`,1.45);}else this.showBanner('GO!',`${Math.round(result.speed*JL.CONFIG.METERS_PER_PX)} m/s launch`,1.0);
        return;
      }
      if(this.state==='flight'&&this.player.boost()){this.showBanner('AIR BOOST!',`${this.player.boosts} boost${this.player.boosts===1?'':'s'} left`,.62);this.screenShake=Math.max(this.screenShake,6);this.fxBurst(this.player.x-10,this.player.y+10,18,'speed');this.sfx.pulse('boost');return;}
      if(this.state==='gameover'){this.beginRun(true);return;}
    }
    dive(){if(this.state==='flight'&&this.player.diveNow()){this.screenShake=Math.max(this.screenShake,5);this.fxBurst(this.player.x,this.player.y,16,'water');this.sfx.pulse('boost');}}
    finish(){
      if(this.state!=='flight')return;this.state='gameover';const d=this.distance();if(d>this.save.best){this.save.best=d;JL.storage.set('jungleLaunchBest',d.toFixed(2));}this.save.bananas+=this.player.runBananas;JL.storage.set('jungleLaunchBananas',String(this.save.bananas));this.specialWindow=null;
    }
    updateMenu(dt){
      if(this.state==='aim'){this.aimAngle+=this.aimDir*44*dt;if(this.aimAngle>JL.CONFIG.LAUNCH.maxAngle){this.aimAngle=JL.CONFIG.LAUNCH.maxAngle;this.aimDir=-1;}if(this.aimAngle<JL.CONFIG.LAUNCH.minAngle){this.aimAngle=JL.CONFIG.LAUNCH.minAngle;this.aimDir=1;}}
      if(this.state==='power'){this.power+=this.powerDir*1.20*dt;if(this.power>1){this.power=1;this.powerDir=-1;}if(this.power<.06){this.power=.06;this.powerDir=1;}}
      if(this.banner.timer>0)this.banner.timer=Math.max(0,this.banner.timer-dt);
    }
    fixedStep(dt){
      if(this.state!=='flight')return;
      this.simTime+=dt;
      if(this.specialWindow){this.specialWindow.timer=Math.max(0,this.specialWindow.timer-dt);if(this.specialWindow.timer===0&&!this.specialWindow.used){this.showBanner('SPECIAL MISSED','Normal flight continues',.7);this.specialWindow=null;}}
      const impact=this.player.step(dt,this.world);
      if(impact&&impact.groundImpact){this.screenShake=Math.max(this.screenShake,JL.clamp(impact.impact/95,3,14));this.fxBurst(this.player.x,this.world.groundAt(this.player.x)-3,Math.min(28,Math.max(8,(impact.impact/50)|0)),impact.surface.type==='water'?'water':'dust');if(impact.surface.type==='rock'&&impact.impact>450)this.showBanner('ROCK SKIP!','Hard surface keeps momentum',.55);}

      for(const o of this.world.objects){
        if(o.hit)continue;
        if(o.x<this.player.px-120||o.x>this.player.x+140)continue;
        if(JL.segmentCircleHit(this.player.px,this.player.py,this.player.x,this.player.y,o.x,o.y,this.player.r+o.r+6))JL.resolveEncounter(this.player,o,this);
      }
      this.world.spawnAhead(this.player,this.startX,5200);this.world.cleanup(this.camera.x);
      this.updateCamera(dt);this.updateParticles(dt);

      const biome=this.currentBiome().name;if(biome!==this.lastBiome){this.lastBiome=biome;this.showBanner(biome,'NEW BIOME',1.4);this.fxBurst(this.player.x,this.player.y,34,'leaf');}
      if(!this.recordAnnounced&&this.save.best>0&&this.distance()>this.save.best){this.recordAnnounced=true;this.showBanner('NEW RECORD!',`${this.distance().toFixed(1)} m and climbing`,1.2);this.fxBurst(this.player.x,this.player.y,38,'banana');this.sfx.pulse('special');}

      const gy=this.world.groundAt(this.player.x);
      if(this.player.x>this.startX+700&&this.player.vx<95&&this.player.y>=gy-this.player.r-4&&Math.abs(this.player.vy)<140)this.finish();
      if(this.player.y>JL.CONFIG.HEIGHT+850)this.finish();
    }
    updateCamera(dt){
      const speed=Math.max(0,this.player.vx*JL.CONFIG.METERS_PER_PX);const s=JL.clamp((speed-60)/220,0,1);const targetZoom=JL.lerp(JL.CONFIG.CAMERA.zoomMax,JL.CONFIG.CAMERA.zoomMin,s);this.camera.zoom=JL.lerp(this.camera.zoom,targetZoom,1-Math.pow(.0008,dt));
      const lead=JL.lerp(JL.CONFIG.CAMERA.baseLead,JL.CONFIG.CAMERA.fastLead,s);const targetX=this.player.x+(0.5-lead)*JL.CONFIG.WIDTH/this.camera.zoom;this.camera.x=JL.lerp(this.camera.x,targetX,1-Math.pow(.0007,dt));
      const altitude=JL.CONFIG.GROUND_Y-this.player.y;const t=JL.clamp((altitude-100)/420,0,1);const targetY=JL.lerp(360,this.player.y+20,t);this.camera.y=JL.lerp(this.camera.y,targetY,1-Math.pow(.0012,dt));
    }
    updateParticles(dt){for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.kind==='leaf'||p.kind==='feather'?180:500)*dt;p.vx*=Math.pow(.985,dt*60);}this.particles=this.particles.filter(p=>p.life>0);this.screenShake=Math.max(0,this.screenShake-dt*25);}
    frame(now){
      let dt=Math.min(JL.CONFIG.MAX_FRAME_DT,(now-this.last)/1000||0);this.last=now;this.fps=this.fps*.9+(dt>0?1/dt:60)*.1;this.updateMenu(dt);
      if(this.state!=='paused'){
        if(this.freezeTimer>0){this.freezeTimer=Math.max(0,this.freezeTimer-dt);this.updateParticles(dt*.15);}
        else{this.accumulator+=dt;let guard=0;while(this.accumulator>=JL.CONFIG.FIXED_DT&&guard++<12){this.fixedStep(JL.CONFIG.FIXED_DT);this.accumulator-=JL.CONFIG.FIXED_DT;if(this.freezeTimer>0){this.accumulator=0;break;}}}
      }
      this.renderer.draw(this);requestAnimationFrame(t=>this.frame(t));
    }
    bindInput(){
      window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(['Space','KeyW','ArrowUp'].includes(e.code))this.primary();if(['ShiftLeft','ShiftRight','KeyS','ArrowDown'].includes(e.code))this.dive();if(e.code==='KeyP'){if(this.state==='paused')this.state=this.prevState||'flight';else if(!['menu','gameover'].includes(this.state)){this.prevState=this.state;this.state='paused';}}if(e.code==='KeyR')this.beginRun(false);if(e.code==='F2'){e.preventDefault();this.debug=!this.debug;}});
      canvas.addEventListener('pointerdown',e=>{this.sfx.ensure();this.touchStartY=e.clientY;if(e.pointerType==='touch')return;if(e.button===2){this.dive();return;}this.primary();});
      canvas.addEventListener('pointerup',e=>{if(e.pointerType==='touch'){const dy=this.touchStartY==null?0:e.clientY-this.touchStartY;if(dy>55)this.dive();else this.primary();}this.touchStartY=null;});
      canvas.addEventListener('contextmenu',e=>e.preventDefault());
    }
  }

  window.game=new Game();
})();
