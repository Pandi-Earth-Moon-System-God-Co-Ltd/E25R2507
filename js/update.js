'use strict';

/* ══════════════════════════════════════════════════════════
   更新逻辑
   ══════════════════════════════════════════════════════════ */
function getDarkness(t){
  if (t < 0.46) return 0;
  if (t < 0.58) return (t - 0.46) / 0.12 * 0.84;
  if (t < 0.90) return 0.84;
  if (t < 1.00) return 0.84 * (1 - (t - 0.90) / 0.10);
  return 0;
}

function startDailyWeather(){
  const season=getSeasonIndex();
  const seasonDay=getSeasonDay();
  const scheduled={
    '0:2':'rain',
    '1:4':'heatwave',
    '1:6':'drought',
    '2:4':'harvest',
    '3:2':'blizzard',
  };
  let weather=scheduled[season+':'+seasonDay]||'clear';
  if(weather==='clear'){
    const roll=Math.random();
    if(season===0&&roll<0.16)weather='rain';
    else if(season===1&&roll<0.12)weather='heatwave';
    else if(season===2&&roll<0.2)weather='harvest';
    else if(season===3&&roll<0.25)weather='blizzard';
  }
  G.weather=weather;
  G.weatherTime=weather==='clear'?0:90;
}

function updatePollution(dt){
  let emission=0;
  for(const machine of machines){
    const type=MACHINE_TYPES[machine.type];
    if(type.generator==='fuel'&&machine.fuel>0&&machine.power<type.capacity)emission+=0.075;
    else if(machine.type==='copperFurnace'&&machine.activeRecipe!==null)emission+=0.035;
    else if(machine.type==='crusher'&&machine.activeRecipe!==null)emission+=0.025;
  }
  emission+=torches.length*0.0004;
  const treeAbsorption=trees.length*0.00012;
  const gardenAbsorption=placedBlocks.filter(block=>block.type==='ecoGarden').length*0.07;
  G.pollution=clamp((G.pollution||0)+(emission-treeAbsorption-gardenAbsorption)*dt,0,2000);

  G.treeGrowthTimer=Math.max(0,(G.treeGrowthTimer||0)-dt);
  if(G.worldLayer==='surface'&&getSeasonIndex()===0&&getEcology()>55&&trees.length<125&&G.treeGrowthTimer<=0){
    G.treeGrowthTimer=45;
    for(let attempt=0;attempt<12;attempt++){
      const x=!G.mapId?player.x+rnd(-180,180):rnd(20,WORLD_W-20);
      const y=!G.mapId?player.y+rnd(-180,180):rnd(20,WORLD_H*0.55);
      if(Math.hypot(x-player.x,y-player.y)<100)continue;
      const terrain=getWorldTerrainIndex(Math.floor(x/TILE),Math.floor(y/TILE),'surface');
      if(terrain!==0&&terrain!==1)continue;
      if(trees.some(tree=>Math.hypot(tree.x-x,tree.y-y)<35)||
         rocks.some(rock=>Math.hypot(rock.x-x,rock.y-y)<18)||
         bushes.some(bush=>Math.hypot(bush.x-x,bush.y-y)<16)||
         placedBlocks.some(block=>Math.hypot(block.x-x,block.y-y)<20)||
         farmPlots.some(plot=>Math.hypot(plot.x-x,plot.y-y)<20))continue;
      trees.push({x,y,hp:3,r:6,shake:0,sway:Math.random()*6.28,
        ...(!G.mapId?{_chunkKey:worldChunkKeyAt(x,y,G.worldLayer)}:{})});
      break;
    }
  }
}

function updateAnimals(dt){
  for(let i=animals.length-1;i>=0;i--){
    const animal=animals[i];
    animal.age=Math.min(1,(animal.age||0)+dt/900);
    animal.love=Math.max(0,(animal.love||0)-dt);
    animal.breedCooldown=Math.max(0,(animal.breedCooldown||0)-dt);
    animal.wobble=(animal.wobble||0)+dt*5;
    animal.moveTimer=(animal.moveTimer||0)-dt;
    if(animal.moveTimer<=0){
      animal.direction=hash2(Math.floor(G.time*3)+i,Math.floor(animal.x)) * Math.PI*2;
      animal.moveTimer=1.5+hash2(i,Math.floor(G.time))*3.5;
    }
    if(!Number.isFinite(animal.facing))animal.facing=Number.isFinite(animal.direction)?animal.direction:0;
    const turn=Math.atan2(Math.sin(animal.direction-animal.facing),Math.cos(animal.direction-animal.facing));
    animal.facing+=turn*Math.min(1,dt*4);
    animal.walking=false;
    if(animal.age>=1){
      const speed=animal.type==='chicken'?9:6;
      const nextX=animal.x+Math.cos(animal.facing)*speed*dt;
      const nextY=animal.y+Math.sin(animal.facing)*speed*dt;
      const withinMap=!G.mapId||(nextX>8&&nextX<WORLD_W-8&&nextY>8&&nextY<CAVE_LINE-TILE/2);
      if(withinMap&&getWorldTerrainIndex(Math.floor(nextX/TILE),Math.floor(nextY/TILE),'surface')!==4){
        animal.x=nextX;animal.y=nextY;animal.walking=true;
      }else animal.moveTimer=0;
    }
    if(animal.love<=0||animal.age<1||animal.breedCooldown>0)continue;
    const mate=animals.find((other,index)=>index!==i&&other.type===animal.type&&other.age>=1&&
      other.love>0&&other.breedCooldown<=0&&Math.hypot(other.x-animal.x,other.y-animal.y)<26);
    if(!mate||animals.length>=24)continue;
    animal.love=mate.love=0;
    animal.breedCooldown=mate.breedCooldown=300;
    animals.push({x:(animal.x+mate.x)/2,y:(animal.y+mate.y)/2,type:animal.type,age:0,hp:3,
      love:0,breedCooldown:0,moveTimer:1,direction:animal.direction,wobble:0});
    spawnParticles(animal.x,animal.y-8,'#ffc7df',10);
    showToast('动物繁殖成功 · 幼崽会在一段时间后长大','#ffc7df');
    if(window.PixelSurvivalAudio)PixelSurvivalAudio.play('breed');
  }
}

function update(dt){
  // 任何界面打开时都释放鼠标（否则光标锁在游戏里退不出来）
  if (typeof panel !== 'undefined' && panel && typeof document !== 'undefined' &&
      document.pointerLockElement && document.exitPointerLock){
    document.exitPointerLock();
  }
  // 洞穴性能兜底：如果进洞后连续两帧卡顿超过 2 秒，自动送回地表
  if (G && G.inCave && typeof returnToSurface === 'function'){
    if (dt > 2){
      G.caveSlow = (G.caveSlow || 0) + 1;
      if (G.caveSlow >= 2){
        G.caveSlow = 0;
        returnToSurface();
        showToast('洞穴渲染过慢，已自动返回地表', '#ffc080');
      }
    } else G.caveSlow = 0;
  }
  G.time += dt;
  G.totalTime += dt;
  if(!panel||panel==='machine')updateMachines(dt);

  if (toast.t > 0) toast.t -= dt;
  if(G.weatherTime>0){
    G.weatherTime=Math.max(0,G.weatherTime-dt);
    if(G.weatherTime===0)G.weather='clear';
  }
  if (shake > 0) shake = Math.max(0, shake - dt * 24);

  // 面板打开 → 暂停世界
  if (panel){
    updateParticles(dt, true);
    return;
  }

  for (const c of chests){ if (!c.open && Math.hypot(c.x-player.x,c.y-player.y)<14) openChest(c); }
  checkAchievements();
  if (comboT > 0){ comboT -= dt; if (comboT <= 0) comboCount = 0; }
  airdropT -= dt;
  if (airdropT <= 0 && !G.gameOver){
    airdropT = 110 + rnd(0, 40);
    const a = rnd(0, Math.PI*2), d = rnd(50, 90);
    const ax=G.mapId?clamp(player.x+Math.cos(a)*d,20,WORLD_W-20):player.x+Math.cos(a)*d;
    const ay=G.mapId?clamp(player.y+Math.sin(a)*d,20,WORLD_H-20):player.y+Math.sin(a)*d;
    const loot = ['smallPotion','smallPotion','ammo','ammo','copperOre','crystal','bandage','berry','regenPotion','powerPotion'];
    for (let i=0;i<6;i++){
      dropPickup(ax+rnd(-8,8), ay+rnd(-8,8), loot[rndi(0,loot.length-1)]);
      pickups[pickups.length-1].life = 60;
    }
    spawnParticles(ax, ay-10, '#ffe070', 24);
    showToast('📦 补给空投降落在你附近！', '#ffe070');
  }

  G.dayTime += dt / G.dayLength;
  if (G.dayTime >= 1){
    G.dayTime -= 1;
    advanceGameDay();
  }
  if (G.day % Math.min(7,getYearLength()) === 0 && G.dayTime >= 0.46 && !G.bloodMoonWarning){
    G.bloodMoon = true;
    G.bloodMoonWarning = true;
    // 血月逐轮升级：第 1 次最温和，之后怪物更多、更凶
    G.bloodMoons = (G.bloodMoons || 0) + 1;
    G.bloodMoonLevel = Math.min(5, G.bloodMoons);
    const levelText = ['轻微', '明显', '强烈', '致命', '血月狂潮'][G.bloodMoonLevel - 1];
    showToast('血月降临（' + levelText + ' · 第 ' + G.bloodMoonLevel + ' 级）· 怪物更强、更密集', '#ff5b68');
    if (window.PixelSurvivalBloodMoon) window.PixelSurvivalBloodMoon.set(true);
    if (G.bloodMoonLevel >= 3) showToast('血月骑士即将出现，准备好武器与护甲', '#ff8b8b');
  }
  updatePollution(dt);
  const naturalDarkness = getDarkness(G.dayTime);
  if (G.bloodMoon && G.dayTime > 0.9 && naturalDarkness < 0.25){
    G.bloodMoon = false;
    if (window.PixelSurvivalBloodMoon) window.PixelSurvivalBloodMoon.set(false);
  }
  G.darkness = G.bloodMoon && naturalDarkness > 0.25
    ? Math.max(naturalDarkness, 0.93 + Math.min(0.05, (G.bloodMoonLevel || 1) * 0.01))
    : naturalDarkness;
  const inCave = G.worldLayer==='cave';
  if (inCave !== G.inCave){
    G.inCave = inCave;
    showToast(inCave ? '进入地下矿脉 · 装备镐子开采' : '回到地表', inCave ? '#8ff0df' : '#c8e0a0');
  }

  updateFarming(dt);
  updateAnimals(dt);
  updatePets(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updatePickups(dt);
  updateParticles(dt, false);
  updateTorches(dt);
  updateCamera(dt);
  updateSpawning(dt);
  if(!G.gameOver) updatePlayerBullets(dt);
}

function advanceGameDay(){
  G.day++;
  const oldSeason=getSeasonIndex(G.day-1);
  const newSeason=getSeasonIndex();
  if(newSeason!==oldSeason){
    showToast('新季节：'+SEASONS[newSeason].name+' · '+(newSeason===3?'农田停止生长，准备过冬':'留意天气与资源变化'),'#d8e6c0');
  }
  if((G.day-1)%getYearLength()===0){
    showToast('新的一年开始 · 世界生态 '+Math.round(getEcology())+'%','#a8e0ff');
  }
  startDailyWeather();
  if(window.PixelSurvivalModAPI) PixelSurvivalModAPI.emit('newDay',{day:G.day});
  G.bloodMoon = false;
  G.bloodMoonWarning = false;
  chests = chests.filter(c=>!c.open);
  if(chests.length<16){ addChest(); addChest(); }
  if(G.day%getYearLength()!==0){
    showToast(G.day%7===0
      ? '第 '+G.day+' 天 · 今夜将出现血月，做好准备！'
      : '第 '+G.day+' 天开始', G.day%7===0?'#ff8b8b':'#ffe680');
  }
}

function setDeveloperTime(dayTime){
  if(!devModeEnabled||!Number.isFinite(dayTime)) return;
  G.dayTime=clamp(dayTime,0,0.999);
  const hour=(G.dayTime*24+6)%24;
  showToast('已跳转到'+(hour<8?'清晨':hour<16?'白天':hour<20?'黄昏':'午夜'),'#a8e0ff');
}

function skipDeveloperDay(){
  if(!devModeEnabled) return;
  G.dayTime=0.02;
  advanceGameDay();
}

function playerMoveBlend(){
  return clamp(Math.hypot(player.vx || 0, player.vy || 0) / Math.max(1, player.speed || 84), 0, 1);
}

function updatePlayer(dt){
  const p = player;
  updateEffects(dt);
  updateCombat(dt);
  if (!Number.isFinite(p.jumpHeight)) p.jumpHeight = 0;
  if (!Number.isFinite(p.jumpVelocity)) p.jumpVelocity = 0;
  if (p.jumpHeight > 0 || p.jumpVelocity > 0){
    p.jumpVelocity -= 18 * dt;
    p.jumpHeight += p.jumpVelocity * dt;
    if (p.jumpHeight <= 0){
      p.jumpHeight = 0;
      p.jumpVelocity = 0;
    }
  }

  let mx = 0, my = 0;
  if (keys['KeyW'] || keys['ArrowUp'])    my--;
  if (keys['KeyS'] || keys['ArrowDown'])  my++;
  if (keys['KeyA'] || keys['ArrowLeft'])  mx--;
  if (keys['KeyD'] || keys['ArrowRight']) mx++;

  const len = Math.hypot(mx, my);
  const wantSprint = (keys['ShiftLeft'] || keys['ShiftRight']) && len > 0 && p.stamina > 8;
  p.sprinting = wantSprint;

  let spd = p.speed;
  if(G.weather==='rain')spd*=0.9;
  if(G.weather==='blizzard')spd*=0.72;
  if(getSeasonIndex()===3)spd*=0.9;
  if(isPlayerInWater(p.x,p.y))spd*=0.58;
  if (wantSprint){
    spd *= 1.55;
    p.stamina = Math.max(0, p.stamina - dt * 26);
  } else {
    p.stamina = Math.min(p.maxStamina, p.stamina + dt * (16+G.growth.ranks.endurance*2));
  }

  if (len > 0){
    mx /= len; my /= len;
    // 3D 模式下按镜头朝向移动（镜头可旋转，WASD 始终对应屏幕方向）
    if(window.Pixel3D&&Pixel3D.active()){
      const yaw=Pixel3D.cameraYaw();
      const cos=Math.cos(yaw),sin=Math.sin(yaw);
      const inputRight=mx,inputUp=-my;
      const worldX=cos*inputRight-sin*inputUp;
      const worldY=-sin*inputRight-cos*inputUp;
      mx=worldX; my=worldY;
    }
    p.walkPhase += dt * (wantSprint ? 6 : 4);
    p.facingAngle=Math.atan2(my,mx);
    if (mx !== 0) p.facing = mx > 0 ? 1 : -1;
  }

  // 瞄准
  const firstPerson = !!(window.Pixel3D && typeof Pixel3D.firstPerson === 'function' && Pixel3D.firstPerson());
  const cameraLocked = !!(window.Pixel3D && Pixel3D.active() && document.pointerLockElement === canvas);
  if (firstPerson || cameraLocked){
    // 锁定鼠标时，准星与相机朝向保持一致。
    mouse.x = W / 2; mouse.y = H / 2; mouse.active = true;
  }
  const cursorWorld=(window.Pixel3D&&Pixel3D.active())
    ?Pixel3D.aimPoint(mouse.x,mouse.y)
    :screenToWorld(mouse.x,mouse.y);
  mouse.wx=cursorWorld.x;
  mouse.wy=cursorWorld.y;
  if (mouse.active){
    const dx = mouse.wx - p.x, dy = mouse.wy - (p.y - 10);
    const dl = Math.hypot(dx, dy) || 1;
    p.aimX = dx/dl; p.aimY = dy/dl;
  } else if (len > 0){
    p.aimX = mx; p.aimY = my;
  }

  const accel = Math.min(1, dt * (len > 0 ? 20 : 24));
  p.vx += ((len > 0 ? mx * spd : 0) - p.vx) * accel;
  p.vy += ((len > 0 ? my * spd : 0) - p.vy) * accel;
  const wasInWater=isPlayerInWater(p.x,p.y);
  const previousX=p.x,previousY=p.y;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if(G.mapId){p.x=clamp(p.x,8,WORLD_W-8);p.y=clamp(p.y,8,WORLD_H-8);}
  else{p.x=clamp(p.x,-1e9,1e9);p.y=clamp(p.y,-1e9,1e9);}

  resolveCollisions(previousX,previousY);
  if(!wasInWater&&isPlayerInWater(p.x,p.y))
    showToast('正在涉水 · 移动速度降低','#9de9f0');

  if (p.atkCd > 0)     p.atkCd -= dt;
  if (p.swing > 0)     p.swing = Math.max(0, p.swing - dt);
  if (p.invuln > 0)    p.invuln -= dt;
  if (p.hurtFlash > 0) p.hurtFlash -= dt;

  // 饥饿
  const rules=G.rules||{};
  p.hunger -= dt * (wantSprint ? 0.32 : 0.2) * (rules.hungerRate===undefined?1:rules.hungerRate);
  const warmth=torches.some(torch=>Math.hypot(torch.x-p.x,torch.y-p.y)<46)?8:0;
  let climateOffset=SEASONS[getSeasonIndex()].temp;
  if(G.weather==='rain')climateOffset-=1;
  if(G.weather==='heatwave')climateOffset+=4;
  if(G.weather==='blizzard')climateOffset-=7;
  const ambientTemp=(G.inCave?30.5:G.darkness>0.3?33.2:36.5)+climateOffset;
  const targetTemp=clamp(ambientTemp+(ambientTemp<35?warmth:0),25,44);
  p.bodyTemp+=(targetTemp-p.bodyTemp)*Math.min(1,dt*0.035);
  const weatherThirst=G.weather==='heatwave'?1.8:G.weather==='rain'?0.8:1;
  p.thirst -= dt * ((wantSprint ? 0.38 : 0.23) * SEASONS[getSeasonIndex()].thirst * weatherThirst +
    (G.inCave ? 0.04 : 0) + (p.bodyTemp>39?0.18:0)) *
    (rules.thirstRate===undefined?1:rules.thirstRate);
  p.thirst = Math.max(0,p.thirst);
  if (p.hunger <= 0 && !(devModeEnabled&&devInvincible)){
    p.hunger = 0;
    p.hp -= dt * 3.2;
  }
  if (p.thirst <= 0 && !(devModeEnabled&&devInvincible)){
    p.hp -= dt * 2.4;
  }
  if(p.thirst<18) p.stamina=Math.min(p.stamina,Math.max(0,p.maxStamina*0.55));
  if(p.bodyTemp<34) p.stamina=Math.min(p.stamina,Math.max(0,p.maxStamina*0.6));
  if(!(devModeEnabled&&devInvincible)){
    if(p.bodyTemp<32) p.hp-=dt*1.8;
    if(p.bodyTemp>42) p.hp-=dt*0.6;
  }
  if(getSeasonIndex()===3)p.hunger-=dt*0.12;
  if(devModeEnabled&&devMaintainFullStatus){
    p.hp=p.maxHp;
    p.hunger=p.maxHunger;
    p.thirst=p.maxThirst;
    p.stamina=p.maxStamina;
  }
  if(devModeEnabled&&(devInvincible||devMaintainFullStatus)) p.hp=p.maxHp;
  else if (p.hp <= 0){ p.hp = 0; gameOver(); }

  // 连续攻击
  if ((mouse.down || (keys['Space'] && !(window.Pixel3D && Pixel3D.active()))) &&
      p.atkCd <= 0 && !G.gameOver){
    doAttack();
  }
}

function tryPlayerJump(){
  if (!player || G.gameOver || panel || !window.Pixel3D || !Pixel3D.active()) return;
  if (!Number.isFinite(player.jumpHeight)) player.jumpHeight = 0;
  if (player.jumpHeight > 0) return;
  player.jumpHeight = 0;
  player.jumpVelocity = 6.8;
}

function isPlayerInWater(x,y){
  return G.worldLayer==='surface'&&getWorldTerrainIndex(Math.floor(x/TILE),Math.floor(y/TILE),'surface')===4;
}

function isBlockedByCustomWater(x,y,allowWater=false){
  if(!G.mapId)return !allowWater&&G.worldLayer==='surface'&&
    getWorldTerrainIndex(Math.floor(x/TILE),Math.floor(y/TILE),'surface')===4;
  const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);
  if(tx<0||tx>=MAP_W||ty<0||ty>=MAP_H)return true;
  if(G&&G.inCave)return false;
  return !allowWater&&worldTerrain[ty*MAP_W+tx]===4;
}

function resolveCollisions(previousX,previousY){
  const p = player;
  if(G.mapId){
    const crossing=G.worldLayer==='cave'
      ?previousY>=CAVE_LINE&&p.y<CAVE_LINE
      :previousY<CAVE_LINE&&p.y>=CAVE_LINE;
    if(crossing){
      const nearEntrance=caveEntrances.some(entry=>Math.abs(entry.x-p.x)<TILE*1.35);
      if(nearEntrance){
        G.worldLayer=G.worldLayer==='cave'?'surface':'cave';
        G.inCave=G.worldLayer==='cave';
        showToast(G.inCave?'进入地下洞穴 · 留意黑暗中的威胁':'返回地表 · 整理收集到的矿物',G.inCave?'#9cc8a0':'#c8e0a0');
        if(window.PixelSurvivalAudio)PixelSurvivalAudio.play('cave');
      }else{
        p.y=previousY;
        p.vy=0;
      }
    }
  }else{
    p.x=clamp(p.x,-1e9,1e9);p.y=clamp(p.y,-1e9,1e9);
  }
  if(isBlockedByCustomWater(p.x,p.y,true)){
    const canRestoreX=!isBlockedByCustomWater(previousX,p.y,true);
    const canRestoreY=!isBlockedByCustomWater(p.x,previousY,true);
    if(canRestoreX){p.x=previousX;p.vx=0;}
    if(canRestoreY){p.y=previousY;p.vy=0;}
    if(!canRestoreX&&!canRestoreY){p.x=previousX;p.y=previousY;p.vx=0;p.vy=0;}
  }
  const lists = [trees, rocks, bushes];
  for (const list of lists){
    for (const o of list){
      if (Math.abs(o.x - p.x) > 28 || Math.abs(o.y - p.y) > 28) continue;
      const dx = p.x - o.x, dy = p.y - o.y;
      const d = Math.hypot(dx, dy);
      const rr = o.r + 5;
      if (d < rr && d > 0.01){
        const push = rr - d;
        p.x += dx/d * push;
        p.y += dy/d * push;
      }
    }
  }
  for (const block of placedBlocks){
    if(block.type==='powerWire')continue;
    const dx = p.x - block.x, dy = p.y - block.y;
    const overlapX = TILE/2 + 5 - Math.abs(dx);
    const overlapY = TILE/2 + 5 - Math.abs(dy);
    if (overlapX > 0 && overlapY > 0){
      if (overlapX < overlapY) p.x += Math.sign(dx || 1) * overlapX;
      else p.y += Math.sign(dy || 1) * overlapY;
    }
  }
  for(const machine of machines){
    const dx=p.x-machine.x,dy=p.y-machine.y;
    const overlapX=TILE/2+5-Math.abs(dx),overlapY=TILE/2+5-Math.abs(dy);
    if(overlapX>0&&overlapY>0){
      if(overlapX<overlapY)p.x+=Math.sign(dx||1)*overlapX;
      else p.y+=Math.sign(dy||1)*overlapY;
    }
  }
}

function blockedByPlacedBlock(x, y, radius){
  return placedBlocks.some(block => block.type!=='powerWire'&&
    Math.abs(x - block.x) < TILE/2 + radius &&
    Math.abs(y - block.y) < TILE/2 + radius
  ) || machines.some(machine=>
    Math.abs(x-machine.x)<TILE/2+radius&&Math.abs(y-machine.y)<TILE/2+radius
  )||isBlockedByCustomWater(x,y);
}

function updateEnemies(dt){
  const dark = G.inCave?Math.max(G.darkness,0.72):G.darkness;
  for (let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];
    if (e.hitFlash > 0) e.hitFlash -= dt;
    e.wobble += dt * (e.fast ? 9 : e.type === 'brute' ? 3 : 6);
    e.dashT = Math.max(0, e.dashT - dt);

    if (dark < 0.15){
      e.burn += dt;
      if (e.burn > 2.5){
        spawnParticles(e.x, e.y-9, '#f0a030', 9);
        enemies.splice(i, 1);
        continue;
      }
    } else {
      e.burn = 0;
    }

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const ranged = e.type === 'spitter';
    if(!Number.isFinite(e.wanderAngle))e.wanderAngle=Math.random()*Math.PI*2;
    if(!Number.isFinite(e.wanderTimer))e.wanderTimer=rnd(1.5,4);
    if(typeof e.alerted!=='boolean')e.alerted=!!e.boss;
    const noticeRange=e.boss?280:ranged?TILE*11:e.fast?TILE*10:TILE*9;
    if(!e.alerted&&d<=noticeRange)e.alerted=true;

    if(!e.alerted){
      e.wanderTimer-=dt;
      if(e.wanderTimer<=0){
        e.wanderAngle+=rnd(-1.5,1.5);
        e.wanderTimer=rnd(1.5,4);
      }
      const wanderSpeed=e.speed*(e.fast?0.12:0.18);
      const wanderX=Math.cos(e.wanderAngle)*wanderSpeed*dt;
      const wanderY=Math.sin(e.wanderAngle)*wanderSpeed*dt;
      if(!blockedByPlacedBlock(e.x+wanderX,e.y+wanderY,e.r)){
        e.x+=wanderX;e.y+=wanderY;
      }else{
        e.wanderAngle+=Math.PI*rnd(0.65,1.35);
        e.wanderTimer=0.5;
      }
      if(G.mapId){e.x=clamp(e.x,8,WORLD_W-8);e.y=clamp(e.y,8,WORLD_H-8);}
      else{e.x=clamp(e.x,-1e9,1e9);e.y=clamp(e.y,-1e9,1e9);}
      continue;
    }

    e.dashCd-=dt;
    const chargeRange=e.fast?TILE*6:TILE*4;
    if(!ranged&&e.dashCd<=0&&e.dashT<=0&&d<=chargeRange){
      e.dashCd=e.type==='stalker'?3.2:4.2;
      e.dashT=e.type==='stalker'?0.55:0.42;
    }
    let moveFactor=e.dashT>0?(e.type==='stalker'?2.2:1.9):0.72;
    // 血月骑士：血量低于 30% 狂暴
    const enraged = e.type === 'bloodKnight' && e.maxHp > 0 && e.hp < e.maxHp * 0.3;
    if (enraged) moveFactor *= 1.5;
    const shouldMove = ranged ? (d > 118 || d < 58) : d > 15;
    // 蜘蛛：侧向绕行（正弦横移），不直冲而是找角度扑上来
    if (e.fast && !ranged && d > 26){
      const side = Math.sin((e.wobble || 0) * 0.7 + (e.x + e.y) * 0.01) * 0.85;
      const perpX = -dy / d, perpY = dx / d;
      const flank = e.speed * 0.55 * dt * side;
      const fx = perpX * flank, fy = perpY * flank;
      if (!blockedByPlacedBlock(e.x + fx, e.y + fy, e.r)){ e.x += fx; e.y += fy; }
    }
    if (shouldMove){
      const direction = ranged && d < 58 ? -1 : 1;
      const sp = e.speed * moveFactor * (1 + Math.sin(e.wobble) * 0.12);
      const stepX = dx/d * sp * dt * direction, stepY = dy/d * sp * dt * direction;
      if (!blockedByPlacedBlock(e.x + stepX, e.y + stepY, e.r)){
        e.x += stepX;
        e.y += stepY;
      } else {
        if (!blockedByPlacedBlock(e.x + stepX, e.y, e.r)) e.x += stepX;
        if (!blockedByPlacedBlock(e.x, e.y + stepY, e.r)) e.y += stepY;
      }
    }
    // 苦力怕：贴身后开始膨胀引信，1.5 秒后爆炸
    if (e.type === 'creeper'){
      if (d < 40){
        e.fuse = (e.fuse || 0) + dt;
        e.wobble = (e.wobble || 0) + dt * 22;
        if (e.fuse >= 1.5){
          const blast = 62;
          if (d < blast) hurtPlayer(e.damage * 2.4);
          // 爆炸掀掉周围的放置方块与耕地
          for (let b = placedBlocks.length - 1; b >= 0; b--){
            if (Math.hypot(placedBlocks[b].x - e.x, placedBlocks[b].y - e.y) < blast) placedBlocks.splice(b, 1);
          }
          for (let f = farmPlots.length - 1; f >= 0; f--){
            if (Math.hypot(farmPlots[f].x - e.x, farmPlots[f].y - e.y) < blast) farmPlots.splice(f, 1);
          }
          for (let k = 0; k < 14; k++){
            spawnParticles(e.x + rnd(-14, 14), e.y + rnd(-14, 14), '#d8f0a0', 1);
          }
          showToast('苦力怕爆炸！', '#ffb060');
          if (window.PixelSurvivalAudio) PixelSurvivalAudio.play('hurt');
          enemies.splice(i, 1);
          continue;
        }
      } else if (e.fuse){
        e.fuse = Math.max(0, e.fuse - dt * 2);
      }
    }
    // 血月骑士：周期性血爆 + 冲锋
    if (e.type === 'bloodKnight'){
      e.skillCd = (e.skillCd === undefined ? 4 : e.skillCd) - dt;
      if (e.skillCd <= 0 && d < 170){
        e.skillCd = 6.5;
        if (d < 96){
          hurtPlayer(e.damage * 1.8);
          showToast('血月骑士 · 血爆！', '#ff8b8b');
        } else {
          // 远距离：冲锋
          const lunge = Math.min(48, d - 20);
          e.x += dx / d * lunge;
          e.y += dy / d * lunge;
          showToast('血月骑士 · 冲锋！', '#ff8b8b');
        }
        for (let k = 0; k < 18; k++){
          spawnParticles(e.x + rnd(-24, 24), e.y - 9 + rnd(-24, 24), '#ff6b7a', 1);
        }
        if (window.PixelSurvivalAudio) PixelSurvivalAudio.play('hurt');
      }
    }
    if(G.mapId){e.x=clamp(e.x,8,WORLD_W-8);e.y=clamp(e.y,8,WORLD_H-8);}
    else{e.x=clamp(e.x,-1e9,1e9);e.y=clamp(e.y,-1e9,1e9);}

    e.atkCd -= dt;
    if (ranged && d < 150 && d > 42 && e.atkCd <= 0 && !G.gameOver){
      e.atkCd = (G.bloodMoon ? 1.65 : 2.35) * (enraged ? 0.5 : 1);
      const shotDx = player.x - e.x, shotDy = player.y - 9 - (e.y - 12);
      const shotLen = Math.hypot(shotDx, shotDy) || 1;
      enemyShots.push({
        x:e.x, y:e.y - 12, vx:shotDx/shotLen * 76, vy:shotDy/shotLen * 76,
        damage:e.damage, life:2.4, color:'#a9e77a'
      });
    } else if (!ranged && d < 19 && e.atkCd <= 0 && !G.gameOver){
      e.atkCd = e.type === 'runner' || e.type === 'stalker' ? 0.8 : 1.1;
      hurtPlayer(e.damage);
    }

    for (let j = i + 1; j < enemies.length; j++){
      const o = enemies[j];
      const ddx = o.x - e.x, ddy = o.y - e.y;
      const dd = Math.hypot(ddx, ddy);
      if (dd < 13 && dd > 0.01){
        const push = (13 - dd) * 0.5;
        e.x -= ddx/dd*push; e.y -= ddy/dd*push;
        o.x += ddx/dd*push; o.y += ddy/dd*push;
      }
    }
  }
  for (let i = enemyShots.length - 1; i >= 0; i--){
    const shot = enemyShots[i];
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (Math.hypot(player.x - shot.x, player.y - 9 - shot.y) < 9){
      hurtPlayer(shot.damage);
      spawnParticles(shot.x, shot.y, shot.color, 5);
      enemyShots.splice(i, 1);
    } else if (shot.life<=0||(G.mapId&&(shot.x<0||shot.y<0||shot.x>WORLD_W||shot.y>WORLD_H))||
      Math.abs(shot.x)>1e9||Math.abs(shot.y)>1e9){
      enemyShots.splice(i, 1);
    }
  }
}

function updatePickups(dt){
  updateConveyors(dt);
  for (let i = pickups.length - 1; i >= 0; i--){
    const pk = pickups[i];
    pk.t += dt;
    pk.life -= dt;
    if (pk.life <= 0){ pickups.splice(i, 1); continue; }

    const dx = player.x - pk.x;
    const dy = (player.y - 6) - pk.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const belt=belts.find(b=>Math.hypot(b.x-pk.x,b.y-pk.y)<9);
    if(belt){
      const [bdx,bdy]=[[1,0],[0,1],[-1,0],[0,-1]][belt.dir];
      const targetX=belt.x+bdx*TILE,targetY=belt.y+bdy*TILE;
      const receiver=machines.find(machine=>machine.x===targetX&&machine.y===targetY);
      if(beltAt(targetX,targetY)||(receiver&&machineAcceptsPickup(receiver,pk.type))){
        pk.vx=0;pk.vy=0;
        continue;
      }
    }

    if (d < 52 && pk.t > 0.35){
      const pull = 280 * dt;
      pk.x += dx/d * pull;
      pk.y += dy/d * pull;
      if (d < 9){
        addItem(pk.type, 1);
        if(window.PixelSurvivalAudio)PixelSurvivalAudio.play('collect',pk.type);
        spawnText(pk.x, pk.y - 10, '+1 ' + ITEMS[pk.type].name,
          ITEMS[pk.type].kind === 'food' ? '#ffb0b0' : '#e8f0a0');
        pickups.splice(i, 1);
        continue;
      }
    } else {
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      pk.vx *= 0.9;
      pk.vy *= 0.9;
    }
  }
}
function beltAt(x,y){
  return belts.find(b=>Math.hypot(b.x-x,b.y-y)<2);
}
function machineAcceptsPickup(machine,id){
  const type=MACHINE_TYPES[machine.type];
  if((type.generator==='fuel'||type.fuelPerCraft>0)&&id===type.fuelItem&&machine.fuel<99)return true;
  return type.recipes.some(recipe=>recipe.input[id]&&
    (machine.input[id]||0)<99);
}
function machineAcceptsStoredItem(machine,id){
  return machineAcceptsPickup(machine,id);
}
function storeMachineItem(machine,id){
  const type=MACHINE_TYPES[machine.type];
  if((type.generator==='fuel'||type.fuelPerCraft>0)&&id===type.fuelItem&&machine.fuel<99){
    machine.fuel++;
  }else{
    machine.input[id]=(machine.input[id]||0)+1;
  }
}
function feedMachineFromConveyor(machine,id){
  storeMachineItem(machine,id);
}
function updateConveyors(dt){
  for(const belt of belts){
    belt.timer+=dt;
    if(belt.timer<0.5)continue;
    belt.timer%=0.5;
    const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][belt.dir];
    const targetX=belt.x+dx*TILE,targetY=belt.y+dy*TILE;
    const nextBelt=beltAt(targetX,targetY);
    const receiver=machines.find(machine=>machine.x===targetX&&machine.y===targetY);
    for(let i=pickups.length-1;i>=0;i--){
      const pickup=pickups[i];
      if(Math.hypot(pickup.x-belt.x,pickup.y-belt.y)>=8)continue;
      if(receiver&&machineAcceptsPickup(receiver,pickup.type)){
        feedMachineFromConveyor(receiver,pickup.type);
        pickups.splice(i,1);
        if(window.PixelSurvivalModAPI)PixelSurvivalModAPI.emit('conveyorDelivered',{id:pickup.type,machine:receiver.type});
      }else if(nextBelt){
        pickup.x=targetX;pickup.y=targetY;pickup.vx=0;pickup.vy=0;
      }
    }
  }
}

function updateParticles(dt, paused){
  for (let i = particles.length - 1; i >= 0; i--){
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0){ particles.splice(i, 1); continue; }
    p.vy += 270 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
  }
  for (let i = texts.length - 1; i >= 0; i--){
    const t = texts[i];
    t.life -= dt;
    t.y -= 28 * dt;
    if (t.life <= 0) texts.splice(i, 1);
  }
  for (const list of [trees, rocks, bushes]){
    for (const o of list) if (o.shake > 0) o.shake -= dt;
  }
  if (!paused){
    for (let i = torches.length - 1; i >= 0; i--){
      torches[i].t += dt;
    }
  }
}

function updateTorches(dt){ /* 已在 updateParticles 处理动画 */ }

function updateCamera(dt){
  cam.x=player.x;
  cam.y=player.y;
  updateWorldChunks();
}

function updateSpawning(dt){
  if (G.gameOver) return;
  const enemyRate=G.rules&&Number.isFinite(G.rules.enemyRate)?G.rules.enemyRate:1;
  if(enemyRate<=0)return;
  if (G.day % getYearLength() === 0 && G.dayTime >= 0.5 && G.bossDay !== G.day && !enemies.some(e=>e.boss)){
    G.bossDay=G.day;spawnBoss(true);
  }else if (G.day % 5 === 0 && G.day % getYearLength() !== 0 && G.dayTime >= 0.5 && G.bossDay !== G.day && !enemies.some(e=>e.boss)){
    G.bossDay = G.day; spawnBoss();
  }
  for (const e of enemies){
    if (!e.boss) continue;
    e.sumT -= dt;
    if (e.sumT <= 0){ e.sumT = 9; spawnEnemy(); spawnEnemy(); spawnText(e.x, e.y-30, '召唤援军！', '#ff7890'); }
  }
  if (G.darkness > 0.25){
    spawnTimer -= dt;
    const maxE = Math.min(24, Math.ceil((3 + G.day * 2 + G.tech * 2 + (G.bloodMoon ? 8 : 0))*enemyRate));
    if (spawnTimer <= 0 && enemies.length < maxE){
      const bloodBoost = G.bloodMoon ? 0.9 + Math.min(5, G.bloodMoonLevel || 1) * 0.25 : 0;
      spawnTimer = Math.max(G.bloodMoon ? 0.3 : 0.55,
        2.8 - G.day * 0.18 - G.tech * 0.12 - bloodBoost) / enemyRate;
      spawnEnemy();
    }
  } else {
    if (spawnTimer < 1.0) spawnTimer = 1.0;
  }
}

function spawnEnemy(){
  const a = Math.random() * Math.PI * 2;
  const d = 240 + Math.random() * 80;
  const x=G.mapId?clamp(player.x+Math.cos(a)*d,20,WORLD_W-20):player.x+Math.cos(a)*d;
  const y=G.mapId
    ?G.inCave?clamp(player.y+Math.sin(a)*d,CAVE_LINE+TILE,WORLD_H-20)
      :clamp(player.y+Math.sin(a)*d,20,CAVE_LINE-TILE)
    :player.y+Math.sin(a)*d;

  const roll = Math.random();
  let type = 'shambler';
  const deepCave=G.inCave&&!G.mapId&&Math.abs(Math.floor(player.y/TILE))>80||
    G.mapId&&player.y>=WORLD_H*0.76;
  // 血月等级越高：血月骑士 / 骷髅 / 蜘蛛的比例越大
  const bm = G.bloodMoon ? Math.min(5, G.bloodMoonLevel || 1) : 0;
  if(deepCave&&G.day>=3&&roll<0.18)type='caveWarden';
  else if (bm && roll < 0.05 + bm * 0.045) type = 'bloodKnight';
  // 洞穴里骷髅/蜘蛛更多，形成远程+绕后的组合
  else if (G.inCave && G.day >= 2 && roll < 0.30) type = 'spitter';
  else if (G.inCave && G.day >= 3 && roll < 0.46) type = 'stalker';
  else if (G.day >= 5 && roll < 0.2 + bm * 0.03) type = 'brute';
  else if (G.day >= 3 && roll < 0.38 + bm * 0.06) type = 'spitter';
  else if (G.day >= 4 && roll < 0.58 + bm * 0.06) type = 'stalker';
  else if (roll < Math.min(0.88, 0.32 + G.day * 0.045 + bm * 0.05)) type = 'runner';
  // 苦力怕：第 3 天起有一定概率替代普通僵尸
  if (type === 'shambler' && G.day >= 3 && Math.random() < 0.28 + (G.bloodMoon ? (G.bloodMoonLevel || 1) * 0.06 : 0)) type = 'creeper';
  const fast = type === 'runner' || type === 'stalker';
  const hpBase = type === 'caveWarden'?38:type === 'bloodKnight' ? 34 : type === 'brute' ? 24 : type === 'spitter' ? 9 : type === 'creeper' ? 10 : fast ? 7 : 12;
  const pollutionMultiplier=G.pollution>=600?1.35:G.pollution>=300?1.2:1;
  const hp = (hpBase + G.day * (type === 'bloodKnight'||type==='caveWarden' ? 3 : 1.4))*pollutionMultiplier;

  enemies.push({
    x, y,
    hp, maxHp: hp,
    speed: type==='caveWarden'?26+G.day*.5:type === 'bloodKnight' ? 34 + G.day * 0.8
      : type === 'brute' ? 21 + G.day * 0.45
      : type === 'spitter' ? 28 + G.day * 0.55
      : fast ? rnd(46, 58) + G.day : rnd(26, 36) + G.day * 1.1,
    r: type==='caveWarden'?10:type === 'bloodKnight' ? 9 : type === 'brute' ? 9 : fast ? 5 : 7,
    damage: (type==='caveWarden'?13:type === 'bloodKnight' ? 12 : type === 'brute' ? 10 : type === 'spitter' ? 4 : fast ? 5 : 7) + G.day * 0.45,
    atkCd: rnd(0.4, 1.4), dashCd:rnd(1.2, 3), dashT:0,
    hitFlash: 0, wobble: Math.random() * 10, burn: 0,
    fast, type,...(!G.mapId?{_chunkKey:worldChunkKeyAt(x,y,G.worldLayer)}:{}),
  });
  if (G.day >= 2 && type !== 'bloodKnight' && Math.random() < Math.min(0.18, 0.05 + G.day * 0.01)){
    const el = enemies[enemies.length-1];
    el.elite = true; el.hp *= 2.6; el.maxHp = el.hp; el.damage *= 1.3; el.speed *= 1.1; el.r += 1;
  }
}
