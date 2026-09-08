window.JL = window.JL || {};
JL.CONFIG = {
  WIDTH:1280, HEIGHT:720, GROUND_Y:598, METERS_PER_PX:0.115,
  FIXED_DT:1/120, MAX_FRAME_DT:0.05,
  GRAVITY:900,
  PLAYER_RADIUS:28,
  LAUNCH:{minAngle:10,maxAngle:60,minSpeed:950,maxBonus:1450,powerExponent:2.05,perfectThreshold:.955,perfectMultiplier:1.10},
  AIR:{baseDrag:0.00075,highSpeedDrag:0.0000000022},
  GROUND:{defaultRetention:.70,diveRetention:.86,minRebound:105},
  CAMERA:{baseLead:.34,fastLead:.22,zoomMin:.80,zoomMax:1.0,verticalFollow:.34},
  BIOMES:[
    {m:0,name:'TREEHOUSE FOREST',sky1:'#85d5fb',sky2:'#d9f5ff',far:'#84ad8b',mid:'#4d8256',near:'#2b5d39',ground:'#6d431f'},
    {m:700,name:'DEEP JUNGLE',sky1:'#75c9ca',sky2:'#d6f3e9',far:'#6b9d76',mid:'#3e704a',near:'#204a30',ground:'#5e3a1b'},
    {m:1800,name:'JUNGLE RIVER',sky1:'#79d6e6',sky2:'#e1fbff',far:'#77a78c',mid:'#447960',near:'#245c4b',ground:'#73502b'},
    {m:3600,name:'ANCIENT RUINS',sky1:'#b8cec0',sky2:'#f0f4ed',far:'#83987c',mid:'#5d7256',near:'#384b3a',ground:'#6d624e'},
    {m:6500,name:'HIGH CANOPY',sky1:'#8cbfff',sky2:'#e2efff',far:'#8ab28a',mid:'#56895d',near:'#2e6840',ground:'#68522c'},
    {m:10000,name:'MYSTIC JUNGLE',sky1:'#897bdc',sky2:'#e3d7fa',far:'#7079a3',mid:'#4d5588',near:'#303762',ground:'#554468'}
  ]
};
JL.storage={
  get(k){try{return window.localStorage?localStorage.getItem(k):null}catch(e){return null}},
  set(k,v){try{if(window.localStorage)localStorage.setItem(k,v)}catch(e){}}
};
