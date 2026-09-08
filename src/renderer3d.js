import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const JL=window.JL;
const S=.022, CHUNK_PX=1200;
const wX=x=>x*S, wY=y=>(JL.CONFIG.GROUND_Y-y)*S;
const mat=(color,o={})=>new THREE.MeshStandardMaterial({color,roughness:o.roughness??.82,metalness:o.metalness??.02,transparent:o.transparent??false,opacity:o.opacity??1,side:o.side??THREE.FrontSide,emissive:o.emissive??0x000000,emissiveIntensity:o.emissiveIntensity??0});
const shadow=root=>root.traverse?.(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;}});

export class Renderer3D{
  constructor(canvas){
    this.canvas=canvas;
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color('#8bd7ef');
    this.scene.fog=new THREE.FogExp2(0x88bba7,.0125);

    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
    this.renderer.setSize(innerWidth,innerHeight,false);
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.02;

    this.camera=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,.08,250);
    this.camera.position.set(7,5.5,18);
    this.cameraLook=new THREE.Vector3(7,2.1,0);
    this.cameraTarget=this.cameraLook.clone();
    this.cameraPos=this.camera.position.clone();

    this.composer=new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.23,.45,.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.root=new THREE.Group(); this.scene.add(this.root);
    this.terrainRoot=new THREE.Group(); this.encounterRoot=new THREE.Group(); this.fxRoot=new THREE.Group();
    this.root.add(this.terrainRoot,this.encounterRoot,this.fxRoot);
    this.chunkVisuals=new Map(); this.objectVisuals=new Map(); this.lastWorldSeed=null;

    this.playerRoot=new THREE.Group(); this.root.add(this.playerRoot);
    this.playerBones=new Map(); this.baseBoneQuats=new Map(); this.modelLoaded=false;
    this.fallback=this.createFallbackMonkey(); this.playerRoot.add(this.fallback);

    this.aimLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(3,1,0)]),new THREE.LineBasicMaterial({color:0xffeb65,transparent:true,opacity:.9}));
    this.root.add(this.aimLine);
    this.launcher=this.createLauncher(); this.root.add(this.launcher);
    this.treehouse=this.createTreehouse(); this.root.add(this.treehouse);

    this.particlePositions=new Float32Array(3*240); this.particleColors=new Float32Array(3*240);
    this.particleGeometry=new THREE.BufferGeometry();
    this.particleGeometry.setAttribute('position',new THREE.BufferAttribute(this.particlePositions,3));
    this.particleGeometry.setAttribute('color',new THREE.BufferAttribute(this.particleColors,3));
    this.particleGeometry.setDrawRange(0,0);
    this.particlePoints=new THREE.Points(this.particleGeometry,new THREE.PointsMaterial({size:.13,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:.92,depthWrite:false,blending:THREE.AdditiveBlending}));
    this.fxRoot.add(this.particlePoints);

    this.trailPositions=new Float32Array(3*48); this.trailGeometry=new THREE.BufferGeometry();
    this.trailGeometry.setAttribute('position',new THREE.BufferAttribute(this.trailPositions,3)); this.trailGeometry.setDrawRange(0,0);
    this.trailPoints=new THREE.Points(this.trailGeometry,new THREE.PointsMaterial({color:0xffe68b,size:.16,sizeAttenuation:true,transparent:true,opacity:.24,depthWrite:false,blending:THREE.AdditiveBlending}));
    this.fxRoot.add(this.trailPoints);

    this.speedPositions=new Float32Array(3*2*72); this.speedGeometry=new THREE.BufferGeometry();
    this.speedGeometry.setAttribute('position',new THREE.BufferAttribute(this.speedPositions,3));
    this.speedMat=new THREE.LineBasicMaterial({color:0xeaf8ff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
    this.speedLines=new THREE.LineSegments(this.speedGeometry,this.speedMat); this.fxRoot.add(this.speedLines);

    this.addLights(); this.buildBackdrop(); this.cacheUI(); this.loadCharacter();
    addEventListener('resize',()=>this.resize());
  }

  cacheUI(){
    const $=id=>document.getElementById(id);
    this.ui={biome:$('biome'),distance:$('distance'),speed:$('speed'),best:$('best'),bananas:$('bananas'),boosts:$('boost-pips'),dive:$('dive-fill'),shield:$('shield'),upcoming:$('upcoming'),combo:$('combo'),banner:$('banner'),bannerTitle:$('banner-title'),bannerSub:$('banner-sub'),special:$('special'),specialFill:$('special-fill'),power:$('power-ui'),powerFill:$('power-fill'),powerValue:$('power-value'),menu:$('menu'),gameover:$('gameover'),finalDistance:$('final-distance'),finalStats:$('final-stats'),finalSeed:$('final-seed'),assetStatus:$('asset-status'),debug:$('debug')};
  }
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));this.renderer.setSize(innerWidth,innerHeight,false);this.composer.setSize(innerWidth,innerHeight);}
  addLights(){
    this.scene.add(new THREE.HemisphereLight(0xe8f8ff,0x2a3825,1.55));
    this.sun=new THREE.DirectionalLight(0xfff1cf,4.2);this.sun.position.set(-10,22,14);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-22;this.sun.shadow.camera.right=22;this.sun.shadow.camera.top=18;this.sun.shadow.camera.bottom=-10;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=70;this.sun.shadow.bias=-.00035;this.scene.add(this.sun);
    const rim=new THREE.DirectionalLight(0xb5e9ff,1.25);rim.position.set(12,9,-12);this.scene.add(rim);
  }
  buildBackdrop(){
    for(let layer=0;layer<3;layer++){const group=new THREE.Group(),geo=new THREE.ConeGeometry(5.5+layer*2,9+layer*2,6);for(let i=0;i<14;i++){const m=new THREE.Mesh(geo,mat(new THREE.Color(0x527864).offsetHSL(0,-.03,-layer*.05),{roughness:1}));m.scale.set(1.1+((i*17)%4)*.18,1,1);m.position.set(i*10-45,1.5,-36-layer*12);m.rotation.y=(i%2)*.55;group.add(m);}this.scene.add(group);}
  }
  createFallbackMonkey(){
    const g=new THREE.Group(),fur=mat(0x75401f),skin=mat(0xd6a071),red=mat(0xd94f3c);
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(.28,.52,7,12),fur);body.position.y=.05;g.add(body);
    const belly=new THREE.Mesh(new THREE.SphereGeometry(.21,18,14),skin);belly.scale.set(1,.8,.65);belly.position.set(.02,.03,.24);g.add(belly);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.31,20,16),fur);head.position.y=.61;g.add(head);
    const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.2,18,14),skin);muzzle.scale.set(1,.8,.58);muzzle.position.set(.06,.55,.25);g.add(muzzle);
    for(const s of [-1,1]){const ear=new THREE.Mesh(new THREE.SphereGeometry(.13,14,10),fur);ear.position.set(s*.28,.64,0);g.add(ear);const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.085,.42,6,10),fur);arm.position.set(s*.36,.15,0);arm.rotation.z=s*.42;g.add(arm);const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.36,6,10),fur);leg.position.set(s*.18,-.45,0);leg.rotation.z=s*.16;g.add(leg);}
    const band=new THREE.Mesh(new THREE.TorusGeometry(.25,.035,8,24,Math.PI*1.25),red);band.position.set(0,.72,.04);band.rotation.x=Math.PI/2;g.add(band);g.rotation.y=Math.PI/2;g.scale.setScalar(1.08);shadow(g);return g;
  }
  createLauncher(){
    const g=new THREE.Group(),wood=mat(0x6f3e20),rope=mat(0x8d5129),geo=new THREE.CylinderGeometry(.14,.2,2.3,10);
    const a=new THREE.Mesh(geo,wood),b=a.clone();a.position.set(-.55,1.1,0);b.position.set(.55,1.1,0);a.rotation.z=.12;b.rotation.z=-.12;g.add(a,b);
    const bg=new THREE.CylinderGeometry(.035,.035,1.3,8),l=new THREE.Mesh(bg,rope),r=l.clone();l.rotation.z=-.62;r.rotation.z=.62;l.position.set(-.22,1.7,0);r.position.set(.22,1.7,0);g.add(l,r);g.position.set(wX(255),.02,0);shadow(g);return g;
  }
  createTreehouse(){
    const g=new THREE.Group(),wood=mat(0x7a4826),leaf=mat(0x2f7b43);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.7,1,8.6,14),wood);trunk.position.set(-2.5,4,-5.5);g.add(trunk);
    for(let i=0;i<8;i++){const c=new THREE.Mesh(new THREE.IcosahedronGeometry(1.7+(i%3)*.35,1),leaf.clone());c.material.color.offsetHSL((i%2)*.015,.04,(i%3)*.025);c.position.set(-2.5+Math.sin(i*1.7)*1.8,7.4+Math.cos(i*1.3),-5.5+Math.sin(i*.8)*1.7);g.add(c);}
    const platform=new THREE.Mesh(new THREE.BoxGeometry(5.6,.35,4.4),wood);platform.position.set(-.8,4.7,-3.4);g.add(platform);
    const hut=new THREE.Mesh(new THREE.BoxGeometry(3.4,2.2,2.8),mat(0xc47c37));hut.position.set(-.8,6,-3.8);g.add(hut);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(2.7,1.8,4),mat(0x3b2b1b));roof.position.set(-.8,7.9,-3.8);roof.rotation.y=Math.PI/4;g.add(roof);g.position.x=wX(120);shadow(g);return g;
  }

  async loadCharacter(){
    try{
      const gltf=await new GLTFLoader().loadAsync('assets/models/professional.glb'),model=gltf.scene;
      model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),sc=1.48/Math.max(.001,size.y);
      model.scale.setScalar(sc);model.position.set(-center.x*sc,-center.y*sc,-center.z*sc);model.rotation.y=Math.PI/2;shadow(model);
      model.traverse(o=>{if(o.isBone){this.playerBones.set(o.name,o);this.baseBoneQuats.set(o.name,o.quaternion.clone());}});
      this.playerRoot.remove(this.fallback);this.playerRoot.add(model);this.playerModel=model;this.modelLoaded=true;
      this.ui.assetStatus.textContent=`GLB loaded • ${this.playerBones.size} rig bones • procedural flight posing`;this.ui.assetStatus.className='asset-status ok';
    }catch(e){console.warn('GLB unavailable; using fallback.',e);this.ui.assetStatus.textContent='GLB unavailable — using 3D fallback avatar';this.ui.assetStatus.className='asset-status warn';}
  }

  resetWorldVisuals(){for(const g of this.chunkVisuals.values())this.terrainRoot.remove(g);this.chunkVisuals.clear();for(const g of this.objectVisuals.values())this.encounterRoot.remove(g);this.objectVisuals.clear();}
  makeTerrainChunk(index,game){
    const x0=index*CHUNK_PX,steps=28,zF=7.6,zB=-14,biome=game.world.biomeAt(Math.max(0,(x0+CHUNK_PX/2-game.startX)*JL.CONFIG.METERS_PER_PX)),verts=[],idx=[];
    for(let i=0;i<=steps;i++){const px=x0+i/steps*CHUNK_PX,y=wY(game.world.groundAt(px));verts.push(wX(px),y,zB,wX(px),y,zF);}
    for(let i=0;i<steps;i++){const a=i*2,b=a+1,c=a+2,d=a+3;idx.push(a,b,c,b,d,c);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(idx);geo.computeVertexNormals();
    const group=new THREE.Group(),topColor=new THREE.Color(biome.near).lerp(new THREE.Color('#6f9c55'),.42),top=new THREE.Mesh(geo,mat(topColor,{roughness:1}));top.receiveShadow=true;group.add(top);

    const skirtV=[],skirtI=[];for(let i=0;i<=steps;i++){const px=x0+i/steps*CHUNK_PX,y=wY(game.world.groundAt(px));skirtV.push(wX(px),y,zF,wX(px),-5,zF);}for(let i=0;i<steps;i++){const a=i*2,b=a+1,c=a+2,d=a+3;skirtI.push(a,c,b,b,c,d);}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(skirtV,3));sg.setIndex(skirtI);sg.computeVertexNormals();const skirt=new THREE.Mesh(sg,mat(biome.ground,{roughness:1}));skirt.receiveShadow=true;group.add(skirt);

    const rng=new JL.RNG(JL.hashSeed(`${game.world.seed}|chunk|${index}`)),treeCount=17,fernCount=38,dummy=new THREE.Object3D();
    const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.23,3.5,7),mat(0x5a3924,{roughness:1}),treeCount);
    const crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.18,1),mat(new THREE.Color(biome.near).offsetHSL(0,.02,.035),{roughness:1}),treeCount);
    const ferns=new THREE.InstancedMesh(new THREE.ConeGeometry(.36,.8,7),mat(new THREE.Color(biome.mid).lerp(new THREE.Color('#5eaa55'),.25),{roughness:1,side:THREE.DoubleSide}),fernCount);
    trunks.castShadow=crowns.castShadow=true;
    for(let i=0;i<treeCount;i++){const px=index*CHUNK_PX+rng.range(0,CHUNK_PX),back=i<13,z=back?rng.range(-13,-3.4):rng.range(4.8,7.1),sc=back?rng.range(.8,1.7):rng.range(1.05,1.85),gy=wY(game.world.groundAt(px));dummy.position.set(wX(px),gy+1.75*sc,z);dummy.scale.setScalar(sc);dummy.rotation.set(0,rng.range(0,6.28),0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);dummy.position.y=gy+(3.4+rng.range(.2,1))*sc;dummy.scale.set(sc*rng.range(.9,1.25),sc*rng.range(.85,1.25),sc*rng.range(.9,1.2));dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);}
    for(let i=0;i<fernCount;i++){const px=index*CHUNK_PX+rng.range(0,CHUNK_PX),z=rng.range(-1.5,6.8),gy=wY(game.world.groundAt(px)),sc=rng.range(.45,1.15);dummy.position.set(wX(px),gy+.32*sc,z);dummy.scale.setScalar(sc);dummy.rotation.set(0,rng.range(0,6.28),rng.range(-.12,.12));dummy.updateMatrix();ferns.setMatrixAt(i,dummy.matrix);}
    group.add(trunks,crowns,ferns);return group;
  }
  ensureChunks(game){
    if(this.lastWorldSeed!==game.world.seed){this.lastWorldSeed=game.world.seed;this.resetWorldVisuals();}
    const center=Math.floor(game.player.x/CHUNK_PX),needed=new Set();for(let i=center-2;i<=center+4;i++){if(i<0)continue;needed.add(i);if(!this.chunkVisuals.has(i)){const g=this.makeTerrainChunk(i,game);this.chunkVisuals.set(i,g);this.terrainRoot.add(g);}}
    for(const [i,g] of this.chunkVisuals)if(!needed.has(i)){this.terrainRoot.remove(g);this.chunkVisuals.delete(i);}
  }

  createEncounterVisual(t){
    const g=new THREE.Group(),add=m=>{m.castShadow=true;g.add(m);return m;};
    if(t==='banana'){const m=add(new THREE.Mesh(new THREE.TorusGeometry(.23,.065,8,18,Math.PI*1.5),mat(0xf2cf35,{emissive:0x443300,emissiveIntensity:.25})));m.rotation.set(0,.4,-.45);}
    else if(t==='mushroom'){const s=add(new THREE.Mesh(new THREE.CylinderGeometry(.11,.16,.58,10),mat(0xe7dcc7)));s.position.y=.24;const c=add(new THREE.Mesh(new THREE.SphereGeometry(.38,18,10,0,Math.PI*2,0,Math.PI/2),mat(0xd94b3f)));c.position.y=.49;c.scale.y=.7;}
    else if(t==='gorilla'){const b=add(new THREE.Mesh(new THREE.CapsuleGeometry(.38,.65,6,10),mat(0x30383c)));b.position.y=.72;const h=add(new THREE.Mesh(new THREE.SphereGeometry(.34,16,14),mat(0x414a4e)));h.position.y=1.35;for(const s of [-1,1]){const a=add(new THREE.Mesh(new THREE.CapsuleGeometry(.13,.65,6,10),mat(0x30383c)));a.position.set(s*.47,.78,0);a.rotation.z=s*.42;}g.scale.setScalar(.92);}
    else if(t==='toucan'){const b=add(new THREE.Mesh(new THREE.SphereGeometry(.31,16,12),mat(0x172129)));b.scale.set(1.3,.8,.75);const beak=add(new THREE.Mesh(new THREE.ConeGeometry(.16,.8,8),mat(0xf0b936)));beak.rotation.z=-Math.PI/2;beak.position.x=.65;}
    else if(t==='jaguar'){const b=add(new THREE.Mesh(new THREE.CapsuleGeometry(.25,.88,6,10),mat(0xd79a2d)));b.rotation.z=Math.PI/2;b.position.y=.32;const h=add(new THREE.Mesh(new THREE.SphereGeometry(.27,16,12),mat(0xd79a2d)));h.position.set(.64,.43,0);g.scale.setScalar(.9);}
    else if(t==='sloth'){const br=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,1.5,8),mat(0x60402c));br.rotation.z=Math.PI/2;br.position.y=.65;g.add(br);const b=add(new THREE.Mesh(new THREE.CapsuleGeometry(.25,.45,6,10),mat(0x786551)));b.position.y=.1;}
    else if(t==='vine'){const curve=new THREE.CatmullRomCurve3([[-.45,-.5,0],[-.2,.45,.08],[.15,-.15,-.08],[.5,.7,0]].map(v=>new THREE.Vector3(...v)));add(new THREE.Mesh(new THREE.TubeGeometry(curve,24,.07,7,false),mat(0x3f974e)));}
    else if(t==='rock'){const r=add(new THREE.Mesh(new THREE.DodecahedronGeometry(.46,0),mat(0x737a77,{roughness:1})));r.scale.set(1.35,.65,1);r.rotation.set(.2,.5,.12);}
    else if(t==='puddle'){const p=new THREE.Mesh(new THREE.CircleGeometry(.72,30),new THREE.MeshStandardMaterial({color:0x4ec4dc,roughness:.25,transparent:true,opacity:.7}));p.rotation.x=-Math.PI/2;p.scale.y=.45;g.add(p);}
    else if(t==='turtle'){const s=add(new THREE.Mesh(new THREE.SphereGeometry(.38,16,10,0,Math.PI*2,0,Math.PI/2),mat(0x4b7945)));s.scale.y=.65;const h=add(new THREE.Mesh(new THREE.SphereGeometry(.13,12,9),mat(0x7fa769)));h.position.x=.42;}
    else if(t==='idol'){const i=add(new THREE.Mesh(new THREE.BoxGeometry(.55,1.05,.42),mat(0x73806f,{roughness:1,emissive:0x2f5b36,emissiveIntensity:.35})));i.position.y=.45;}
    return g;
  }
  syncEncounters(game){
    const active=new Set(game.world.objects);for(const o of game.world.objects){let g=this.objectVisuals.get(o);if(!g){g=this.createEncounterVisual(o.type);this.objectVisuals.set(o,g);this.encounterRoot.add(g);}g.position.set(wX(o.x),wY(o.y)+Math.sin(game.simTime*3+o.phase)*.035,0);g.rotation.y=Math.sin(o.phase)*.12;g.visible=!(o.hit&&o.type==='banana');}
    for(const [o,g] of this.objectVisuals)if(!active.has(o)){this.encounterRoot.remove(g);this.objectVisuals.delete(o);}
  }

  updatePlayer(game,dt){
    const p=game.player;this.playerRoot.position.set(wX(p.x),wY(p.y),0);this.playerRoot.rotation.z=THREE.MathUtils.lerp(this.playerRoot.rotation.z,game.state==='flight'?-p.rot*.72:0,1-Math.pow(.002,dt));this.playerRoot.scale.set(1+p.squash*.24,1-p.squash*.18,1+p.squash*.08);this.poseRig(game);
  }
  poseRig(game){
    if(!this.modelLoaded)return;const p=game.player,state=game.state,speed=JL.clamp((p.vx*JL.CONFIG.METERS_PER_PX)/300,0,1),wave=Math.sin(game.simTime*(4+speed*9));
    for(const [name,b] of this.playerBones){const q=this.baseBoneQuats.get(name);if(q)b.quaternion.copy(q);}
    const add=(name,x=0,y=0,z=0)=>{const b=this.playerBones.get(name);if(!b)return;b.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z,'XYZ')));};
    if(state==='aim'||state==='power'){add('mixamorig:Spine2',-.1);add('mixamorig:LeftArm',0,0,-1);add('mixamorig:RightArm',0,0,1);add('mixamorig:LeftForeArm',0,0,-.45);add('mixamorig:RightForeArm',0,0,.45);}
    else if(state==='flight'){const dive=p.diving?1:0;add('mixamorig:Spine2',-.12-.22*dive);add('mixamorig:Neck',.1+.1*speed);add('mixamorig:LeftArm',-.15,0,-1.15-.35*speed);add('mixamorig:RightArm',-.15,0,1.15+.35*speed);add('mixamorig:LeftForeArm',0,0,-.35-.12*wave);add('mixamorig:RightForeArm',0,0,.35+.12*wave);add('mixamorig:LeftUpLeg',.18+.2*wave);add('mixamorig:RightUpLeg',.18-.2*wave);add('mixamorig:LeftLeg',-.35-.13*wave);add('mixamorig:RightLeg',-.35+.13*wave);}
  }
  updateAim(game){this.launcher.visible=game.player.x<700;this.aimLine.visible=game.state==='aim';if(this.aimLine.visible){const a=game.aimAngle*Math.PI/180,s=new THREE.Vector3(wX(game.player.x),wY(game.player.y),.08),e=new THREE.Vector3(s.x+Math.cos(a)*4.1,s.y+Math.sin(a)*4.1,.08);this.aimLine.geometry.setFromPoints([s,e]);}}
  fxColor(k){return new THREE.Color(({banana:0xffdf55,water:0x76ddff,shield:0x8ceeff,mystic:0x89ffad,impact:0xffba49,special:0xffe75b,speed:0xdff7ff,leaf:0x66cc68,feather:0xf4efca,spore:0xffb38e,dust:0xd5b982})[k]||0xffffff);}
  updateFX(game){
    let n=Math.min(game.particles.length,240);for(let i=0;i<n;i++){const p=game.particles[i],j=i*3,c=this.fxColor(p.kind);this.particlePositions[j]=wX(p.x);this.particlePositions[j+1]=wY(p.y);this.particlePositions[j+2]=((i*17)%19-9)*.055;this.particleColors[j]=c.r;this.particleColors[j+1]=c.g;this.particleColors[j+2]=c.b;}this.particleGeometry.setDrawRange(0,n);this.particleGeometry.attributes.position.needsUpdate=true;this.particleGeometry.attributes.color.needsUpdate=true;
    n=Math.min(game.player.trail.length,48);for(let i=0;i<n;i++){const p=game.player.trail[i],j=i*3;this.trailPositions[j]=wX(p.x);this.trailPositions[j+1]=wY(p.y);this.trailPositions[j+2]=.12;}this.trailGeometry.setDrawRange(0,n);this.trailGeometry.attributes.position.needsUpdate=true;
    const sp=game.player.vx*JL.CONFIG.METERS_PER_PX,intensity=JL.clamp((sp-70)/240,0,1);this.speedMat.opacity=intensity*.3;this.speedLines.visible=intensity>.01;if(this.speedLines.visible){for(let i=0;i<72;i++){const j=i*6,phase=i*.61803398875%1,xx=wX(game.player.x)+((phase*31+game.simTime*11*(.35+intensity))%31)-11,yy=wY(game.player.y)+(((i*37)%29)/29-.5)*10,zz=((i*53)%23)/23*13-5,len=.6+intensity*3.2;this.speedPositions[j]=xx;this.speedPositions[j+1]=yy;this.speedPositions[j+2]=zz;this.speedPositions[j+3]=xx-len;this.speedPositions[j+4]=yy+.05;this.speedPositions[j+5]=zz;}this.speedGeometry.attributes.position.needsUpdate=true;}this.bloom.strength=.20+(game.specialWindow?.timer>0?.36:0)+JL.clamp(game.screenShake/30,0,.22);
  }
  updateCamera(game,dt){
    const p=game.player,sp=JL.clamp((p.vx*JL.CONFIG.METERS_PER_PX-50)/260,0,1),px=wX(p.x),py=wY(p.y);
    this.cameraTarget.set(px+THREE.MathUtils.lerp(2.4,5.6,sp),Math.max(2.3,py*.68+2.3),0);this.cameraPos.set(px+THREE.MathUtils.lerp(-1,1,sp),Math.max(5,py*.48+5.1),THREE.MathUtils.lerp(18.2,21.5,sp));
    const k=1-Math.pow(.001,dt);this.camera.position.lerp(this.cameraPos,k);this.cameraLook.lerp(this.cameraTarget,k);if(game.screenShake>0){const a=game.screenShake*.0035;this.camera.position.x+=Math.sin(game.simTime*91)*a;this.camera.position.y+=Math.sin(game.simTime*127)*a;}
    this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,46+sp*5,1-Math.pow(.003,dt));this.camera.updateProjectionMatrix();this.camera.lookAt(this.cameraLook);this.sun.position.x=px-8;this.sun.target.position.set(px,0,0);if(!this.sun.target.parent)this.scene.add(this.sun.target);
  }
  updateAtmosphere(game){const b=game.currentBiome(),sky=new THREE.Color(b.sky1).lerp(new THREE.Color(b.sky2),.42);this.scene.background.lerp(sky,.035);this.scene.fog.color.lerp(new THREE.Color(b.mid).lerp(sky,.55),.025);}
  updateUI(game){
    const u=this.ui,p=game.player,d=game.distance(),speed=Math.max(0,p.vx*JL.CONFIG.METERS_PER_PX);u.biome.textContent=game.currentBiome().name;u.distance.textContent=`${d.toFixed(1)} m`;u.speed.textContent=`${speed.toFixed(1)} m/s`;u.best.textContent=`${game.save.best.toFixed(1)} m`;u.bananas.textContent=String(game.save.bananas+p.runBananas);u.dive.style.width=`${p.dive}%`;u.shield.textContent=p.shield>0?`SHIELD ×${p.shield}`:'';
    [...u.boosts.children].forEach((el,i)=>el.classList.toggle('on',i<p.boosts));u.combo.textContent=p.combo>1?`COMBO ×${p.combo}`:'';u.combo.classList.toggle('hidden',p.combo<=1);
    const up=game.state==='flight'?game.world.objects.filter(o=>!o.hit&&o.type!=='banana'&&o.x>p.x).sort((a,b)=>a.x-b.x)[0]:null,dm=up?(up.x-p.x)*JL.CONFIG.METERS_PER_PX:999;u.upcoming.textContent=up&&dm<260?`${up.type.toUpperCase()} → ${Math.max(0,dm).toFixed(0)} m`:'';u.upcoming.classList.toggle('hidden',!(up&&dm<260));
    const show=game.banner.timer>0&&!['menu','gameover','paused'].includes(game.state);u.banner.classList.toggle('hidden',!show);if(show){u.bannerTitle.textContent=game.banner.text;u.bannerSub.textContent=game.banner.sub;}
    const special=game.specialWindow&&game.specialWindow.timer>0;u.special.classList.toggle('hidden',!special);if(special)u.specialFill.style.width=`${100*game.specialWindow.timer/game.specialWindow.max}%`;
    u.power.classList.toggle('hidden',game.state!=='power');if(game.state==='power'){u.powerFill.style.width=`${game.power*100}%`;const perf=game.power>=JL.CONFIG.LAUNCH.perfectThreshold;u.powerValue.textContent=perf?'PERFECT ZONE!':`${Math.round(game.power*100)}%`;u.powerValue.classList.toggle('perfect',perf);}
    u.menu.classList.toggle('active',game.state==='menu');u.gameover.classList.toggle('active',game.state==='gameover');
    if(game.state==='gameover'){u.finalDistance.textContent=`${d.toFixed(1)} m`;u.finalStats.innerHTML=`TOP SPEED <strong>${p.topSpeed.toFixed(1)} m/s</strong> • MAX HEIGHT <strong>${(p.maxHeight*JL.CONFIG.METERS_PER_PX).toFixed(1)} m</strong><br>BOUNCES <strong>${p.bounces}</strong> • ENCOUNTERS <strong>${p.encounters}</strong> • BANANAS <strong>${p.runBananas}</strong>`;u.finalSeed.textContent=`Seed ${game.seed}`;}
    u.debug.classList.toggle('hidden',!game.debug);if(game.debug)u.debug.textContent=`3D RENDERER / THREE r185\nFPS ${game.fps.toFixed(0)} • fixed 120 Hz\nvx ${p.vx.toFixed(1)} vy ${p.vy.toFixed(1)}\n3D ${wX(p.x).toFixed(2)}, ${wY(p.y).toFixed(2)}\nchunks ${this.chunkVisuals.size} • visuals ${this.objectVisuals.size}\nGLB rig ${this.modelLoaded?'YES':'fallback'}\nsurface ${game.world.surfaceAt(p.x).type}\nseed ${game.seed}`;
  }
  draw(game){
    const now=performance.now(),dt=this._lastDraw?Math.min(.05,(now-this._lastDraw)/1000):1/60;this._lastDraw=now;
    this.ensureChunks(game);this.syncEncounters(game);this.updatePlayer(game,dt);this.updateAim(game);this.updateFX(game);this.updateCamera(game,dt);this.updateAtmosphere(game);this.updateUI(game);this.composer.render();
  }
}