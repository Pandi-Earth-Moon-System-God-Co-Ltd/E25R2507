/* ══════════════════════════════════════════════════════════
   世界生成
   ══════════════════════════════════════════════════════════ */
function generateCustomWorld(mapDefinition){
  trees=[];rocks=[];bushes=[];waterSources=[];ruins=[];caveEntrances=[];
  worldTerrain=mapDefinition.terrain.slice();
  const seed=mapDefinition.seed>>>0;
  for(let index=0;index<MAP_W*MAP_H;index++){
    const tx=index%MAP_W,ty=Math.floor(index/MAP_W);
    const tile=MAP_TERRAIN[mapDefinition.terrain[index]];
    const color=tile.color;
    wctx.fillStyle=color;
    wctx.fillRect(tx*TILE,ty*TILE,TILE,TILE);
    const detail=hash2(tx*37+seed,ty*71+seed);
    if(tile.id==='water'){
      wctx.fillStyle='rgba(185,224,220,0.28)';
      wctx.fillRect(tx*TILE+3+Math.floor(detail*7),ty*TILE+5,5,1);
      continue;
    }
    if(tile.id==='cave'){
      wctx.fillStyle='rgba(30,27,29,0.28)';
      wctx.fillRect(tx*TILE+2,ty*TILE+3,4,2);
      if(detail>0.7)wctx.fillRect(tx*TILE+10,ty*TILE+11,3,2);
    }else if(tile.id==='snow'){
      wctx.fillStyle='rgba(255,255,255,0.32)';
      wctx.fillRect(tx*TILE+3,ty*TILE+4,4,1);
    }else if(detail>0.78){
      wctx.fillStyle='rgba(35,47,37,0.16)';
      wctx.fillRect(tx*TILE+4,ty*TILE+5,2,2);
    }
    const x=tx*TILE+TILE/2,y=ty*TILE+TILE/2;
    if(tile.id==='forest'&&detail>0.66){
      trees.push({x,y,hp:3,r:6,shake:0,sway:detail*6.28});
    }else if((tile.id==='stone'&&detail>0.79)||(tile.id==='cave'&&detail>0.72)||
      (tile.id==='desert'&&detail>0.96)||(tile.id==='snow'&&detail>0.94)){
      const oreRoll=hash2(tx*19+seed,ty*53+seed);
      const ore=tile.id==='cave'&&oreRoll>0.985?'crystal':
        tile.id==='cave'&&oreRoll>0.93?'ironOre':
        tile.id==='cave'&&oreRoll>0.86?'copperOre':null;
      rocks.push({x,y,hp:ore==='crystal'?7:ore?5:4,r:7,shake:0,ore});
    }else if(tile.id==='grass'&&detail>0.985){
      bushes.push({x,y,hp:2,r:5,shake:0,berries:true});
    }
  }
  for(const object of mapDefinition.objects||[]){
    const x=object.x*TILE+TILE/2,y=object.y*TILE+TILE/2;
    if(object.type==='tree')trees.push({x,y,hp:3,r:6,shake:0,sway:hash2(object.x+seed,object.y)*6.28});
    else if(object.type==='rock')rocks.push({x,y,hp:4,r:7,shake:0,ore:null});
    else if(object.type==='bush')bushes.push({x,y,hp:2,r:5,shake:0,berries:true});
    else if(object.type==='water'){
      const tileX=Math.floor(x/TILE),tileY=Math.floor(y/TILE),index=tileY*MAP_W+tileX;
      worldTerrain[index]=4;
      wctx.fillStyle=MAP_TERRAIN[4].color;
      wctx.fillRect(tileX*TILE,tileY*TILE,TILE,TILE);
      wctx.fillStyle='rgba(185,224,220,0.28)';
      wctx.fillRect(tileX*TILE+6,tileY*TILE+5,5,1);
    }
    else if(object.type==='chest')chests.push({x,y,open:false});
    else if(object.type==='ruin')ruins.push({x,y,opened:false});
    else if(object.type==='cave')caveEntrances.push({x,y:CAVE_LINE-TILE/2});
  }
  if(caveEntrances.length===0)caveEntrances.push({x:mapDefinition.spawn.x*TILE+TILE/2,y:CAVE_LINE-TILE/2});
}

function findRiverTileNear(x,y,range){
  if(G&&G.inCave)return null;
  const centerX=Math.floor(x/TILE),centerY=Math.floor(y/TILE);
  const radius=Math.ceil(range/TILE)+1;
  let nearest=null;
  const minY=G&&G.mapId?Math.max(0,centerY-radius):centerY-radius;
  const maxY=G&&G.mapId?Math.min(MAP_H-1,centerY+radius):centerY+radius;
  const minX=G&&G.mapId?Math.max(0,centerX-radius):centerX-radius;
  const maxX=G&&G.mapId?Math.min(MAP_W-1,centerX+radius):centerX+radius;
  for(let ty=minY;ty<=maxY;ty++){
    for(let tx=minX;tx<=maxX;tx++){
      if(getWorldTerrainIndex(tx,ty,'surface')!==4)continue;
      const distance=Math.hypot(tx*TILE+TILE/2-x,ty*TILE+TILE/2-y);
      if(distance<=range&&(!nearest||distance<nearest.distance))
        nearest={x:tx*TILE+TILE/2,y:ty*TILE+TILE/2,distance};
    }
  }
  return nearest;
}

function findRiverWaterAt(x,y,playerRange=TILE*3){
  const target=findRiverTileNear(x,y,TILE*0.8);
  return target&&Math.hypot(target.x-player.x,target.y-player.y)<=playerRange?target:null;
}

function worldChunkKey(cx,cy,layer){
  return layer+':'+cx+','+cy;
}

function worldChunkKeyAt(x,y,layer=G&&G.worldLayer||'surface'){
  return worldChunkKey(Math.floor(x/CHUNK_SIZE),Math.floor(y/CHUNK_SIZE),layer);
}

function getWorldTerrainIndex(tx,ty,layer=G&&G.worldLayer||'surface'){
  if(G&&G.mapId){
    if(tx<0||tx>=MAP_W||ty<0||ty>=MAP_H)return -1;
    return worldTerrain[ty*MAP_W+tx]||0;
  }
  const seed=activeWorldSeed;
  if(layer==='cave'){
    const geology=noise2(tx+seed*0.031,ty-seed*0.017,11);
    return geology>0.76?2:3;
  }
  const elevation=noise2(tx+seed*0.013,ty-seed*0.007,38);
  const moisture=noise2(tx+31+seed*0.021,ty-17,26);
  const temperature=noise2(tx-23,ty+seed*0.009,43);
  const riverY=Math.round(Math.sin(tx*0.055+seed)*18+noise2(tx+seed,seed,29)*12);
  const riverBand=Math.abs((((ty-riverY+40)%80)+80)%80-40);
  if(riverBand<=1&&Math.abs(tx)>4)return 4;
  if(elevation>0.8)return 2;
  if(temperature<0.24)return 6;
  if(moisture<0.25&&temperature>0.62)return 5;
  if(moisture>0.58)return 1;
  return 0;
}

function generateInfiniteChunk(cx,cy,layer){
  const treesInChunk=[],rocksInChunk=[],bushesInChunk=[],ruinsInChunk=[],chestsInChunk=[],entrancesInChunk=[];
  const xStart=cx*CHUNK_TILES,yStart=cy*CHUNK_TILES,seed=activeWorldSeed;
  for(let ly=0;ly<CHUNK_TILES;ly++)for(let lx=0;lx<CHUNK_TILES;lx++){
    const tx=xStart+lx,ty=yStart+ly,terrain=getWorldTerrainIndex(tx,ty,layer);
    const detail=hash2(tx*47+seed,ty*31-seed);
    const x=tx*TILE+TILE/2,y=ty*TILE+TILE/2;
    if(layer==='surface'){
      if(terrain===1&&detail<0.22)treesInChunk.push({x,y,hp:3,r:6,shake:0,sway:detail*6.28});
      else if(terrain===2&&detail<0.18)rocksInChunk.push({x,y,hp:4,r:7,shake:0,ore:null});
      else if(terrain===4)continue;
      else if((terrain===0||terrain===1)&&detail>0.985)bushesInChunk.push({x,y,hp:2,r:5,shake:0,berries:true});
      const landmark=hash2(tx+seed*13,ty-seed*7);
      if(Math.hypot(x-8,y-8)>96){
        if(landmark>0.9988)chestsInChunk.push({x,y,open:false});
        if(landmark<0.0007)ruinsInChunk.push({x,y,opened:false});
      }
      if(Math.hypot(x-8,y-8)<72)continue;
    }else if(terrain===2&&detail<0.26){
      const vein=hash2(tx*43+seed,ty*71-seed);
      const ore=vein>0.994?'crystal':Math.abs(ty)>80&&vein>0.72?'ironOre':vein>0.8?'copperOre':null;
      rocksInChunk.push({x,y,hp:ore==='crystal'?7:ore?5:4,r:7,shake:0,ore});
    }
  }
  if(hash2(cx+seed,cy-seed)>0.84){
    const tx=xStart+Math.floor(hash2(cx*7+seed,cy*11)*CHUNK_TILES);
    const ty=yStart+Math.floor(hash2(cx*13-seed,cy*3)*CHUNK_TILES);
    entrancesInChunk.push({x:tx*TILE+TILE/2,y:ty*TILE+TILE/2});
  }
  const key=worldChunkKey(cx,cy,layer);
  const animalsInChunk=[];
  if(layer==='surface'&&hash2(cx+seed*3,cy-seed)<0.18){
    const tx=xStart+Math.floor(hash2(cx+41,cy+seed)*CHUNK_TILES);
    const ty=yStart+Math.floor(hash2(cx-17,cy-seed)*CHUNK_TILES);
    if(getWorldTerrainIndex(tx,ty,'surface')!==4){
      const species=['chicken','sheep','boar'];
      animalsInChunk.push({x:tx*TILE+TILE/2,y:ty*TILE+TILE/2,
        type:species[Math.floor(hash2(tx,ty)*species.length)],age:1,hp:3,love:0,
        breedCooldown:0,moveTimer:0,direction:hash2(ty,tx)*Math.PI*2,
        wobble:hash2(tx+1,ty+1)*6.28});
    }
  }
  for(const entry of [treesInChunk,rocksInChunk,bushesInChunk,ruinsInChunk,chestsInChunk,entrancesInChunk,animalsInChunk])
    entry.forEach(object=>{object._chunkKey=key;});
  trees.push(...treesInChunk);rocks.push(...rocksInChunk);bushes.push(...bushesInChunk);
  ruins.push(...ruinsInChunk);chests.push(...chestsInChunk);caveEntrances.push(...entrancesInChunk);
  animals.push(...animalsInChunk);
}

function getWorldChunkEntityLists(){
  return {trees,rocks,bushes,pickups,ruins,chests,caveEntrances,animals,
    enemies,torches,placedBlocks,machines,belts,farmPlots,enemyShots};
}

function loadWorldChunk(key){
  const [layer,coords]=key.split(':');
  const [cx,cy]=coords.split(',').map(Number);
  generateInfiniteChunk(cx,cy,layer);
  const state=G.chunkStates&&G.chunkStates[key];
  if(!state)return;
  const lists=getWorldChunkEntityLists();
  for(const [name,objects] of Object.entries(state)){
    const list=lists[name];
    if(!list||!Array.isArray(objects))continue;
    for(let index=list.length-1;index>=0;index--)
      if(list[index]._chunkKey===key)list.splice(index,1);
    list.push(...objects.map(object=>({...object,_chunkKey:key})));
  }
  delete G.chunkStates[key];
}

function unloadWorldChunk(key){
  G.chunkStates=G.chunkStates||{};
  const state={};
  const lists=getWorldChunkEntityLists();
  for(const [name,list] of Object.entries(lists)){
    const leaving=list.filter(object=>object._chunkKey===key||
      !object._chunkKey&&worldChunkKeyAt(object.x,object.y,key.split(':')[0])===key);
    state[name]=leaving.map(object=>{const copy={...object};delete copy._chunkKey;return copy;});
    const leavingSet=new Set(leaving);
    for(let index=list.length-1;index>=0;index--)if(leavingSet.has(list[index]))list.splice(index,1);
  }
  G.chunkStates[key]=state;
}

function updateWorldChunks(){
  if(!G||G.mapId)return;
  G.chunkStates=G.chunkStates||{};
  const cx=Math.floor(player.x/CHUNK_SIZE),cy=Math.floor(player.y/CHUNK_SIZE);
  const desired=new Set();
  for(let y=cy-ACTIVE_CHUNK_RADIUS;y<=cy+ACTIVE_CHUNK_RADIUS;y++)
    for(let x=cx-ACTIVE_CHUNK_RADIUS;x<=cx+ACTIVE_CHUNK_RADIUS;x++)
      desired.add(worldChunkKey(x,y,G.worldLayer||'surface'));
  for(const key of [...loadedChunkKeys])if(!desired.has(key)){unloadWorldChunk(key);loadedChunkKeys.delete(key);}
  for(const key of desired)if(!loadedChunkKeys.has(key)){loadWorldChunk(key);loadedChunkKeys.add(key);}
}

function generateWorld(mapDefinition=null,worldSeed=137){
  activeWorldSeed=Number.isInteger(worldSeed)?worldSeed:137;
  loadedChunkKeys=new Set();
  if(mapDefinition){
    chests=[];
    generateCustomWorld(mapDefinition);
    return;
  }
  trees=[];rocks=[];bushes=[];waterSources=[];ruins=[];caveEntrances=[];
  pickups=[];chests=[];animals=[];
  worldTerrain=[];
}

function tryUseCaveEntrance(){
  if(panel||G.gameOver)return false;
  if(!G.mapId){
    const entrance=caveEntrances
      .map(entry=>({entry,distance:Math.hypot(player.x-entry.x,player.y-entry.y)}))
      .sort((a,b)=>a.distance-b.distance)[0];
    if(!entrance||entrance.distance>TILE*2.5)return false;
    G.worldLayer=G.inCave?'surface':'cave';
    G.inCave=G.worldLayer==='cave';
    player.x=entrance.entry.x;player.y=entrance.entry.y;
    player.vx=0;player.vy=0;
    updateWorldChunks();
    showToast(G.inCave?'进入地下洞穴 · 留意黑暗中的威胁':'返回地表 · 整理收集到的矿物',
      G.inCave?'#9cc8a0':'#c8e0a0');
    if(window.PixelSurvivalAudio)PixelSurvivalAudio.play('cave');
    return true;
  }
  const entranceY=G.inCave?CAVE_LINE+TILE/2:CAVE_LINE-TILE/2;
  const entrance=caveEntrances
    .map(entry=>({entry,distance:Math.hypot(player.x-entry.x,player.y-entranceY)}))
    .sort((a,b)=>a.distance-b.distance)[0];
  if(!entrance||entrance.distance>TILE*2.5)return false;
  G.worldLayer=G.inCave?'surface':'cave';
  G.inCave=G.worldLayer==='cave';
  player.x=entrance.entry.x;
  player.y=G.inCave?CAVE_LINE+TILE/2:CAVE_LINE-TILE/2;
  player.vx=0;player.vy=0;
  showToast(G.inCave?'进入地下洞穴 · 留意黑暗中的威胁':'返回地表 · 整理收集到的矿物',
    G.inCave?'#9cc8a0':'#c8e0a0');
  if(window.PixelSurvivalAudio)PixelSurvivalAudio.play('cave');
  return true;
}

function spawnWildlife(){
  if(!G.mapId)return;
  animals=[];
  const species=['chicken','sheep','boar'];
  const seed=seedlessWorldOffset();
  for(let i=0;i<10;i++){
    const tx=5+Math.floor(hash2(i+73+seed,19)*46);
    const ty=4+Math.floor(hash2(i+31+seed,97)*24);
    const x=tx*TILE+TILE/2,y=ty*TILE+TILE/2,index=ty*MAP_W+tx;
    if(worldTerrain[index]===4||Math.hypot(x-player.x,y-player.y)<88||
      trees.some(tree=>Math.hypot(tree.x-x,tree.y-y)<14))continue;
    const type=species[i%species.length];
    animals.push({x,y,type,age:1,hp:3,love:0,breedCooldown:0,moveTimer:0,
      direction:hash2(tx,ty)*Math.PI*2,wobble:hash2(ty,tx)*6.28});
  }
}

function seedlessWorldOffset(){return G&&Number.isInteger(G.worldSeed)?G.worldSeed:137;}

/* ══════════════════════════════════════════════════════════
   初始化 / 重置
   ══════════════════════════════════════════════════════════ */
function addChest(first){
  for(let k=0;k<20;k++){
    const x=!G.mapId?player.x+rnd(-180,180):rnd(40,WORLD_W-40);
    const y=!G.mapId?player.y+rnd(-180,180):rnd(40,WORLD_H-40);
    if(first && Math.hypot(x-player.x,y-player.y)<90) continue;
    chests.push({x,y,open:false,...(!G.mapId?{_chunkKey:worldChunkKeyAt(x,y,G.worldLayer)}:{})}); return;
  }
}
function openChest(c){
  c.open=true; G.chestsOpened=(G.chestsOpened||0)+1;
  const table=[['wood',6],['stone',6],['fiber',4],['copperOre',4],['ammo',12],['smallPotion',2],['bandage',2],['berry',4],['water',2],['crystal',2],['regenPotion',1],['powerPotion',1],['hastePotion',1]];
  for(let i=0;i<4;i++){
    const t=table[rndi(0,table.length-1)];
    for(let j=0;j<Math.max(1,Math.ceil(t[1]/(t[1]>4?3:1)));j++){dropPickup(c.x+rnd(-6,6),c.y-6,t[0]);pickups[pickups.length-1].life=45;}
  }
  if(Math.random()<0.08 && !(inv.shotgun>0)){dropPickup(c.x,c.y-8,'shotgun');pickups[pickups.length-1].life=60;}
  gainExperience(15);
  spawnParticles(c.x,c.y-8,'#ffe070',20);
  showToast('📦 打开了宝箱！','#ffe070');
}
function openRuin(ruin){
  if(ruin.opened)return;
  ruin.opened=true;
  addItem('relicShard',2);
  addItem('ironOre',rndi(3,5));
  if(Math.random()<0.65)addItem('crystal',1);
  if(Math.random()<0.35)addItem('copperIngot',1);
  gainExperience(35);
  spawnParticles(ruin.x,ruin.y-8,'#dbb978',18);
  showToast('遗迹已探索：回收古代合金与矿石','#ffe080');
  if(window.PixelSurvivalModAPI)PixelSurvivalModAPI.emit('ruinExplored',{x:ruin.x,y:ruin.y});
}
function spawnBoss(annual=false){
  const a=Math.random()*Math.PI*2, d=220;
  const hp=240+G.day*30+(annual?240:0);
  const x=G.mapId?clamp(player.x+Math.cos(a)*d,20,WORLD_W-20):player.x+Math.cos(a)*d;
  const y=G.mapId?clamp(player.y+Math.sin(a)*d,20,WORLD_H-20):player.y+Math.sin(a)*d;
  enemies.push({x,y,
    hp,maxHp:hp,speed:26+G.day*.5,r:12,damage:18+G.day,atkCd:1,dashCd:2,dashT:0,hitFlash:0,wobble:0,burn:0,
    fast:false,type:'brute',boss:true,annualBoss:annual,sumT:6,
    ...(!G.mapId?{_chunkKey:worldChunkKeyAt(x,y,G.worldLayer)}:{})});
  shake=Math.max(shake,7);
  showToast(annual?'⚠ 年度巨像苏醒！击败它获取遗迹核心':'⚠ 巨像守卫降临！击败它获得稀有战利品','#ff6a80');
}
function spawnFinalBoss(gate){
  if(!gate)return;
  if(enemies.some(enemy=>enemy.finalBoss))return;
  const hp=1100+G.day*12;
  const x=G.mapId?clamp(gate.x+120,20,WORLD_W-20):gate.x+120;
  const y=G.mapId?clamp(gate.y+100,20,WORLD_H-20):gate.y+100;
  enemies.push({x,y,
    hp,maxHp:hp,speed:30+G.day*.3,r:14,damage:24+G.day*.35,atkCd:1,dashCd:2,dashT:0,
    hitFlash:0,wobble:0,burn:0,fast:false,type:'brute',boss:true,finalBoss:true,sumT:5,
    ...(!G.mapId?{_chunkKey:worldChunkKeyAt(x,y,G.worldLayer)}:{})});
  shake=Math.max(shake,9);
  showToast('世界核心苏醒！击败守护者，完成远征！','#d9c8ff');
}
function activateWorldGate(gate){
  if(G.tech<2){showToast('需要先研究荧晶时代','#ffb080');return;}
  if((G.bossKills||0)<1){showToast('先击败一次巨像守卫，取得核心共鸣','#ffb080');return;}
  if(G.victory){showToast('世界核心已恢复，远征已经完成','#a8efaa');return;}
  if(enemies.some(enemy=>enemy.boss)){showToast('先解决当前的首领威胁','#ffb080');return;}
  spawnFinalBoss(gate);
}
function reset(mapDefinition=null){
  const worldSeed=mapDefinition?mapDefinition.seed:rndi(1,2147483646);
  generateWorld(mapDefinition,worldSeed);
  chests=mapDefinition?chests:[];
  pickups = []; enemies = []; animals=[]; pets=[]; particles = []; texts = []; torches = []; placedBlocks = []; machines = []; belts = []; farmPlots = [];
  enemyShots = []; combatFx = []; playerBullets = []; showMap = false;

  const rules=mapDefinition&&mapDefinition.rules||{};
  inv = { berry: rules.startingFood===undefined?3:rules.startingFood,
    emptyBottle:rules.startingWater===undefined?2:rules.startingWater,coin:12,smallPotion:2,pistol:1,ammo:24,
    carrotSeed:2,wheatSeed:2 };
  inventoryOrder = Object.keys(inv).filter(id=>inv[id]>0);
  hotbar = Array(HOTBAR_SIZE).fill(null);
  hotbar[0] = 'berry'; hotbar[1] = 'emptyBottle'; hotbar[2] = 'smallPotion'; hotbar[3] = 'pistol';
  hotbar[4] = 'carrotSeed'; hotbar[5] = 'wheatSeed';
  player = {
    x: mapDefinition?((mapDefinition.spawn.x+0.5)*TILE):TILE/2,
    y: mapDefinition?((mapDefinition.spawn.y+0.5)*TILE):TILE/2,
    vx: 0, vy: 0,
    hp: 100, maxHp: 100,
    hunger: 100, maxHunger: 100, thirst:100, maxThirst:100, bodyTemp:36.5,
    stamina: 100, maxStamina: 100,
    speed: 84,
    aimX: 0, aimY: 1,
    atkCd: 0, swing: 0, combo:0, comboWindow:0, attackAngle:Math.PI/2,
    damage: 2, range: BASE_MELEE_REACH, atkSpeed: 0.36,
    armor: 0,
    weapon: null, armorId: null,
    equipment:{helmet:null,chestplate:null,leggings:null,boots:null},
    walkPhase: 0, invuln: 0, facing: 1, hurtFlash: 0,
    sprinting: false, appearance:newPlayerAppearance(),
  };
  cam = { x: player.x - W/2, y: player.y - H/2 };
  G = {
    time: 0, dayTime: 0.02, day: 1, dayLength:rules.dayLength||600,worldSeed,
    worldLayer:mapDefinition&&player.y>=CAVE_LINE?'cave':'surface',
    mapId:mapDefinition?mapDefinition.id:null,
    mapSnapshot:mapDefinition?JSON.parse(JSON.stringify(mapDefinition)):null,
    rules:{seasonDays:rules.seasonDays||8,hungerRate:rules.hungerRate===undefined?1:rules.hungerRate,
      thirstRate:rules.thirstRate===undefined?1:rules.thirstRate,
      enemyRate:rules.enemyRate===undefined?1:rules.enemyRate},
    kills: 0, gathered: 0, gameOver: false, darkness: 0,
    pollution:0,weather:'clear',weatherTime:0,treeGrowthTimer:45,victory:false,annualBossDefeated:false,
    overT: 0, totalTime: 0, inCave:!!(mapDefinition&&player.y>=CAVE_LINE), tech: 0,chunkStates:{},
    bloodMoon: false, bloodMoonWarning: false,
    growth:newGrowth(), skills:Object.fromEntries(SKILLS.map(skill=>[skill.id,0])),
    skillXP:0,unlockedSkills:['spin'],skillSlots:['spin',null,null,null],skillLoadoutSlot:0,
    wardTime:0, effects:{regen:0,power:0,haste:0}, medicineCd:0,
    tutorialWood: 0, tutorialSword: false, tutorialTorch: false, tutorialDone: [false,false,false,false], farmTech:0, energy:0,
  };
  if(mapDefinition)spawnWildlife();
  else updateWorldChunks();
  generateVillage();
  spawnTimer = 0; shake = 0;
  panel = null; characterReturnPanel=null; selectedRecipe = 0;
  selectedMachine = null;
  selectedHotbar = 0;
  inventoryDragSource = null;
  toast = { text:'', t:0, color:'#ffe680' };
  recalcEquipment();
  showToast('收集食物与清水维持状态 · 对准河流右键取水 · J查看帮助', '#a8e0ff');
}

function recalcEquipment(){
  let bestW = null;
  const equipmentSlots=EQUIPMENT_ARMOR_SLOTS.map(slot=>slot.id);
  if(!player.equipment||typeof player.equipment!=='object')
    player.equipment={helmet:null,chestplate:null,leggings:null,boots:null};
  for (const id in inv){
    if (inv[id] <= 0) continue;
    const it = ITEMS[id];
    if (it.kind === 'weapon' && !it.firearm && (!bestW || it.dmg > ITEMS[bestW].dmg)) bestW = id;
  }
  const selected = hotbar[selectedHotbar];
  if (selected && inv[selected] > 0){
    if (ITEMS[selected].kind === 'weapon') bestW = selected;
  }
  for(const slot of equipmentSlots){
    const id=player.equipment[slot];
    if(!id||inv[id]<=0||!ITEMS[id]||ITEMS[id].kind!=='armor'||
       (ITEMS[id].armorSlot||'chestplate')!==slot)player.equipment[slot]=null;
  }
  const armorIds=equipmentSlots.map(slot=>player.equipment[slot]).filter(Boolean);
  const tool = selected && inv[selected] > 0 && ITEMS[selected].kind === 'tool' ? selected : null;
  player.weapon  = bestW;
  player.armorId = player.equipment.chestplate;
  player.damage = Math.round(((bestW ? ITEMS[bestW].dmg : 2) + G.growth.ranks.power*2) * (G.effects.power > 0 ? 1.3 : 1));
  player.range = BASE_MELEE_REACH + (bestW ? ITEMS[bestW].range-15 : 0) + G.growth.ranks.reach*3;
  player.atkSpeed= tool ? ITEMS[tool].cd : bestW ? ITEMS[bestW].cd : 0.36;
  player.armor   = Math.min(0.9,armorIds.reduce((total,id)=>total+ITEMS[id].def,0));
  player.toolId = tool;
  player.miningPower = tool ? ITEMS[tool].mine : 0;
  player.maxHp = 100 + G.growth.ranks.vitality*15;
  player.maxStamina = 100 + G.growth.ranks.endurance*10;
  player.speed = 84 * (1+G.growth.ranks.agility*0.04) * (G.effects.haste>0?1.25:1);
  player.hp = Math.min(player.hp,player.maxHp);
  player.stamina = Math.min(player.stamina,player.maxStamina);
}

function showToast(text, color){
  toast.text = text;
  toast.color = color || '#ffe680';
  toast.t = 2.2;
}

function addItem(id, n){
  n = n || 1;
  if (id === 'wood') G.tutorialWood += n;
  if (!(inv[id] > 0) && !inventoryOrder.includes(id)) inventoryOrder.push(id);
  inv[id] = (inv[id] || 0) + n;
  if (!hotbar.includes(id)){
    const emptySlot = hotbar.indexOf(null);
    if (emptySlot >= 0) hotbar[emptySlot] = id;
  }
  G.gathered += n;
  recalcEquipment();
  if(window.PixelSurvivalModAPI) PixelSurvivalModAPI.emit('itemAdded',{id,n,total:inv[id]});
}

function takeItem(id, n){
  if ((inv[id] || 0) < n) return false;
  inv[id] -= n;
  if (inv[id] <= 0){
    delete inv[id];
    inventoryOrder = inventoryOrder.filter(itemId => itemId !== id);
    clearHotbarItem(id);
  }
  recalcEquipment();
  return true;
}

function clearHotbarItem(id){
  for (let i = 0; i < hotbar.length; i++){
    if (hotbar[i] === id) hotbar[i] = null;
  }
}
