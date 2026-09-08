window.JL = window.JL || {};
JL.ENCOUNTERS = {
  banana:{r:20,good:true},
  mushroom:{r:38,good:true},
  gorilla:{r:44,good:true},
  toucan:{r:38,good:true,aerial:true},
  jaguar:{r:43,good:true},
  vine:{r:42,good:true},
  sloth:{r:42,bad:true},
  turtle:{r:36,good:true},
  rock:{r:38,good:true},
  puddle:{r:48,bad:true},
  idol:{r:42,good:true,rare:true}
};

JL.resolveEncounter = function(player,o,game){
  if(o.hit)return;
  o.hit=true;
  const now=game.simTime;
  const bad=JL.ENCOUNTERS[o.type]?.bad;

  if(o.type==='banana'){
    player.runBananas++;
    player.vx+=24;
    game.fxBurst(o.x,o.y,10,'banana');
    game.audioPulse('pickup');
    return;
  }

  if(bad && player.shield>0){
    player.shield--;
    game.showBanner('SHIELD SAVE!','Bad encounter blocked',.8);
    game.hitStop(.045);
    game.fxBurst(o.x,o.y,24,'shield');
    return;
  }

  player.encounters++;
  player.combo=player.comboTimer>0?player.combo+1:1;
  player.comboTimer=2.55;
  player.history.push({type:o.type,t:now});
  player.history=player.history.filter(h=>now-h.t<8).slice(-6);
  const comboMult=1+Math.min(player.combo-1,7)*.075;
  const vx=player.vx;

  switch(o.type){
    case 'gorilla': {
      const target=Math.max(vx*1.09,1650)*comboMult;
      player.vx=Math.min(3400,target);
      player.vy=Math.min(player.vy,-260);
      game.impact('GORILLA PUNCH!',`COMBO x${player.combo}`,o,14,'impact',.065);
      break;
    }
    case 'toucan': {
      player.vx=Math.max(vx,1250)+150;
      player.vy=Math.min(player.vy,-1020*comboMult);
      game.impact('TOUCAN LIFT!',`COMBO x${player.combo}`,o,8,'feather',.04);
      break;
    }
    case 'jaguar': {
      const target=Math.max(vx*1.12,2150)*comboMult;
      player.vx=Math.min(3900,target);
      player.vy=Math.min(player.vy,-120);
      game.impact('JAGUAR DASH!',`COMBO x${player.combo}`,o,12,'speed',.055);
      break;
    }
    case 'mushroom': {
      player.vy=Math.min(player.vy,-1120*comboMult);
      player.vx*=1.035;
      game.impact('MEGA BOUNCE!',`COMBO x${player.combo}`,o,9,'spore',.045);
      break;
    }
    case 'vine': {
      player.vx=Math.max(player.vx,1450)+260;
      player.vy=-1180;
      game.impact('VINE SLING!',`COMBO x${player.combo}`,o,9,'leaf',.045);
      break;
    }
    case 'rock': {
      player.vx=Math.max(player.vx,1150)+160;
      player.vy=Math.min(player.vy,-360);
      game.impact('ROCK RAMP!',`COMBO x${player.combo}`,o,7,'dust',.035);
      break;
    }
    case 'turtle': {
      player.shield=Math.min(2,player.shield+1);
      player.vy=Math.min(player.vy,-420);
      game.impact('TURTLE SHELL!','Next bad hit can be blocked',o,6,'shield',.035);
      break;
    }
    case 'sloth': {
      player.vx*=.64; player.vy*=.78;
      game.impact('SLOTH!','Momentum drained',o,5,'dust',.025);
      break;
    }
    case 'puddle': {
      player.vx*=.72; player.vy-=80;
      game.impact('SPLASH!','Water drag',o,6,'water',.025);
      break;
    }
    case 'idol': {
      game.specialWindow={type:'idol',timer:.72,max:.72,used:false};
      game.showBanner('ANCIENT SPECIAL!','PRESS BOOST NOW!',.72);
      game.hitStop(.035);
      game.fxBurst(o.x,o.y,30,'mystic');
      break;
    }
  }

  const seq=player.history.slice(-3).map(h=>h.type).join('>');
  if(seq==='toucan>gorilla>jaguar'){
    player.vx=Math.min(4300,Math.max(player.vx,3200));
    player.vy=Math.min(player.vy,-720);
    player.boosts=Math.min(3,player.boosts+1);
    player.history=[];
    game.showBanner('JUNGLE FURY!','TOUCAN → GORILLA → JAGUAR',1.8);
    game.hitStop(.12);
    game.screenShake=20;
    game.fxBurst(player.x,player.y,70,'special');
  }
};
