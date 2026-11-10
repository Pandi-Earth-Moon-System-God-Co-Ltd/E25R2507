'use strict';

/* ══════════════════════════════════════════════════════════
   渲染主循环
   - 3D 模式：WebGL 体素引擎绘制世界 → 贴到 2D 画布 → 叠加 HUD
   - 2.5D 模式：保留原有等距像素绘制
   世界坐标 ↔ 屏幕坐标 的换算会自动跟随当前引擎
   ══════════════════════════════════════════════════════════ */
const ISO_X = 0.68, ISO_Y = 0.34;
let inventoryBackdrop = null;

function worldToScreen(x,y,height){
  if(window.Pixel3D && Pixel3D.active())return Pixel3D.project(x,y,height);
  const dx=x-player.x,dy=y-player.y;
  return {x:W/2+(dx-dy)*ISO_X,y:H/2+(dx+dy)*ISO_Y};
}

function screenToWorld(x,y){
  if(window.Pixel3D && Pixel3D.active())return Pixel3D.pick(x,y);
  const horizontal=(x-W/2)/ISO_X,vertical=(y-H/2)/ISO_Y;
  return {x:player.x+(horizontal+vertical)/2,y:player.y+(vertical-horizontal)/2};
}

function drawIsoTile(tx,ty,shakeX,shakeY){
  const wx=tx*TILE+TILE/2,wy=ty*TILE+TILE/2;
  const point=worldToScreen(wx,wy);
  const sx=point.x+shakeX,sy=point.y+shakeY;
  const halfW=TILE*ISO_X,halfH=TILE*ISO_Y;
  if(sx+halfW<-4||sx-halfW>W+4||sy+halfH+5<-4||sy-halfH>H+4)return;

  ctx.beginPath();
  ctx.moveTo(sx,sy-halfH);ctx.lineTo(sx+halfW,sy);
  ctx.lineTo(sx,sy+halfH);ctx.lineTo(sx-halfW,sy);
  ctx.closePath();
  ctx.fillStyle='rgba(20,25,22,0.42)';
  ctx.fill();

  const groundY=sy+3;
  ctx.beginPath();
  ctx.moveTo(sx-halfW,sy);ctx.lineTo(sx,sy+halfH);
  ctx.lineTo(sx,groundY+halfH);ctx.lineTo(sx-halfW,groundY);
  ctx.closePath();
  ctx.fillStyle='rgba(24,30,27,0.62)';ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx,sy+halfH);ctx.lineTo(sx+halfW,sy);
  ctx.lineTo(sx+halfW,groundY);ctx.lineTo(sx,groundY+halfH);
  ctx.closePath();
  ctx.fillStyle='rgba(12,18,16,0.46)';ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx,sy-halfH);ctx.lineTo(sx+halfW,sy);
  ctx.lineTo(sx,sy+halfH);ctx.lineTo(sx-halfW,sy);
  ctx.closePath();ctx.clip();
  if(G.mapId){
    ctx.drawImage(worldCv,tx*TILE,ty*TILE,TILE,TILE,
      sx-halfW,sy-halfH,TILE*ISO_X*2,TILE*ISO_Y*2);
  }else{
    const terrain=MAP_TERRAIN[Math.max(0,getWorldTerrainIndex(tx,ty,G.worldLayer))];
    ctx.fillStyle=terrain.color;ctx.fillRect(sx-halfW,sy-halfH,TILE*ISO_X*2,TILE*ISO_Y*2);
    const detail=hash2(tx*47+G.worldSeed,ty*31-G.worldSeed);
    if(terrain.id==='water'){
      ctx.fillStyle='rgba(185,224,220,0.42)';
      ctx.fillRect(sx-3+Math.floor(detail*5),sy-1,5,1);
    }else if(detail>0.76){
      ctx.fillStyle=G.worldLayer==='cave'?'rgba(220,205,170,0.22)':'rgba(31,47,38,0.16)';
      ctx.fillRect(sx-3,sy-2,2,2);
    }
  }
  ctx.restore();
}

function is3DView(){
  return !!(window.Pixel3D && Pixel3D.active() && panel!=='title');
}

function render(){
  if(panel!=='inventory'){
    inventoryBackdrop=null;
  }else if(inventoryBackdrop&&
      inventoryBackdrop.width===canvas.width&&inventoryBackdrop.height===canvas.height){
    ctx.drawImage(inventoryBackdrop,0,0,W,H);
    uiButtons=[];
    drawInventoryPanel();
    drawTooltip();
    return;
  }else{
    inventoryBackdrop=null;
  }

  // 两种引擎都需要随玩家位置装载/卸载区块（实体生成也依赖它）
  if(G&&!G.gameOver)updateWorldChunks();

  let rendered3D=false;
  if(is3DView()){
    try{
      rendered3D=Pixel3D.render()===true;
    }catch(error){
      console.error('[Pixel Survival] 3D 渲染异常，本次改用 2.5D 绘制',error);
      rendered3D=false;
    }
  }

  if(rendered3D){
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(Pixel3D.canvas(),0,0,W,H);
    drawWeatherOverlay();
    drawScreenFx();
    drawCombatFx();
    if(window.PixelSurvivalAnimations)PixelSurvivalAnimations.draw(ctx,W,H,G,player);
    drawWorldActionHint();
    drawCrosshair();
    drawHudAndPanels();
    drawTooltip();
    return;
  }

  renderWorld2D();
  drawScreenFx();
  drawCombatFx();
  if(window.PixelSurvivalAnimations)PixelSurvivalAnimations.draw(ctx,W,H,G,player);
  drawWorldActionHint();
  drawCrosshair();
  drawHudAndPanels();
  drawTooltip();
}

/* ── 2.5D 世界 ────────────────────────────────────── */
function renderWorld2D(){
  const sh = shake;
  const shakeX=sh>0.1?rnd(-sh,sh):0,shakeY=sh>0.1?rnd(-sh,sh):0;
  ctx.fillStyle=G.inCave?'#302e2c':'#304a32';ctx.fillRect(0,0,W,H);
  const playerTileX=Math.floor(player.x/TILE),playerTileY=Math.floor(player.y/TILE);
  const minTileX=G.mapId?Math.max(0,playerTileX-25):playerTileX-25;
  const maxTileX=G.mapId?Math.min(MAP_W,playerTileX+26):playerTileX+26;
  const minTileY=G.mapId?Math.max(0,playerTileY-25):playerTileY-25;
  const maxTileY=G.mapId?Math.min(MAP_H,playerTileY+26):playerTileY+26;
  for(let depth=minTileX+minTileY;depth<maxTileX+maxTileY-2;depth++){
    const firstX=Math.max(minTileX,depth-maxTileY+1);
    const lastX=Math.min(maxTileX-1,depth-minTileY);
    for(let tx=lastX;tx>=firstX;tx--)drawIsoTile(tx,depth-tx,shakeX,shakeY);
  }
  if(G.inCave){
    ctx.fillStyle='rgba(23,18,24,0.22)';ctx.fillRect(0,0,W,H);
  }

  for(const entrance of caveEntrances){
    const pos=worldToScreen(entrance.x,entrance.y);
    if(pos.x<-20||pos.x>W+20||pos.y<-20||pos.y>H+20)continue;
    const pulse=0.65+0.25*Math.sin(G.time*3+entrance.x);
    R(pos.x-8+shakeX,pos.y-4+shakeY,16,8,'#25251e');
    R(pos.x-5+shakeX,pos.y-5+shakeY,10,5,G.inCave?'#9cc8a0':'#b88c57');
    R(pos.x-3+shakeX,pos.y-5+shakeY,6,4,'rgba(127,203,160,'+pulse+')');
  }

  for (const fp of farmPlots){
    const pos=worldToScreen(fp.x,fp.y);
    if(pos.x>-20&&pos.x<W+20&&pos.y>-20&&pos.y<H+20)drawFarmPlot(fp,pos.x+shakeX,pos.y+shakeY);
  }

  // 火把地面
  for (const t of torches){
    const pos=worldToScreen(t.x,t.y),sx=pos.x+shakeX,sy=pos.y+shakeY;
    if (sx < -30 || sx > W+30 || sy < -30 || sy > H+30) continue;
    R(sx-2, sy-6, 4, 8, '#5a3a1e');
    R(sx-1, sy-9, 2, 4, '#f0b030');
    R(sx-1, sy-11, 2, 2, '#fff0a0');
    const fl = Math.sin(t.t * 12) * 1;
    R(sx-2, sy-8+fl, 1, 1, '#ff8020');
  }
  // 实体排序
  const drawables = [];
  const wirePositions=new Set(placedBlocks.filter(block=>block.type==='powerWire')
    .map(block=>block.x+','+block.y));
  const inView = o => {
    const pos=worldToScreen(o.x,o.y);
    return pos.x>-50&&pos.x<W+50&&pos.y>-80&&pos.y<H+80;
  };

  for (const t of trees)   if (inView(t)) drawables.push({ y: t.y, k:'tree',   o:t });
  for (const r of rocks)   if (inView(r)) drawables.push({ y: r.y, k:'rock',   o:r });
  for (const b of bushes)  if (inView(b)) drawables.push({ y: b.y, k:'bush',   o:b });
  for (const p of pickups) if (inView(p)) drawables.push({ y: p.y, k:'pickup', o:p });
  for (const b of placedBlocks) if (inView(b)) drawables.push({ y:b.y, k:'block', o:b });
  for (const m of machines) if (inView(m)) drawables.push({y:m.y,k:'machine',o:m});
  for (const b of belts) if (inView(b)) drawables.push({y:b.y,k:'belt',o:b});
  for (const r of ruins) if (inView(r)) drawables.push({y:r.y,k:'ruin',o:r});
  for(const house of villageHouses)if(inView(house))drawables.push({y:house.y-8,k:'villageHouse',o:house});
  for(const villager of villagers)if(inView(villager))drawables.push({y:villager.y,k:'villager',o:villager});
  for (const e of enemies) if (inView(e)) drawables.push({ y: e.y, k:'enemy',  o:e });
  for (const a of animals) if (inView(a)) drawables.push({ y:a.y,k:'animal',o:a });
  for (const pet of pets) if (inView(pet)) drawables.push({ y:pet.y,k:'pet',o:pet });
  for (const c of chests) if (inView(c)) drawables.push({ y: c.y, k:'chest', o:c });
  drawables.push({ y: player.y, k:'player', o: player });

  drawables.sort((a,b)=>(a.o.x+a.o.y)-(b.o.x+b.o.y));

  for (const d of drawables){
    const pos=worldToScreen(d.o.x,d.o.y);
    const sx=pos.x+shakeX,sy=pos.y+shakeY;
    switch (d.k){
      case 'tree':   drawTree(d.o, sx, sy); break;
      case 'rock':   drawRock(d.o, sx, sy); break;
      case 'bush':   drawBush(d.o, sx, sy); break;
      case 'pickup': drawPickup(d.o, sx, sy); break;
      case 'block':  drawPlacedBlock(d.o, sx, sy, wirePositions); break;
      case 'machine':drawMachine(d.o,sx,sy);break;
      case 'belt':drawBelt(d.o,sx,sy);break;
      case 'ruin':drawRuin(d.o,sx,sy);break;
      case 'villageHouse':drawVillageHouse(d.o,sx,sy);break;
      case 'villager':drawVillager(d.o,sx,sy);break;
      case 'chest': {
        const c=d.o;
        if(!c.open){
          R(sx-6,sy-8,12,8,'#8a5a30');R(sx-6,sy-11,12,4,'#a8743c');R(sx-1,sy-11,2,11,'#e0c050');R(sx-1,sy-6,2,2,'#fff6c0');
          if(Math.sin(G.time*4+c.x)>0.6) R(sx+5,sy-14,2,2,'#fff6c0');
        } else {
          R(sx-6,sy-8,12,8,'#6b4423');R(sx-5,sy-8,10,3,'#2a1c10');R(sx-6,sy-14,12,3,'#a8743c');
        }
        break;
      }
      case 'enemy':  drawZombie(d.o, sx, sy);
        if (d.o.boss){
          const bp = 0.5 + 0.5*Math.sin(G.time*5);
          R(sx-13,sy-1,26,3,bp>0.5?'#ff4060':'#a02040');
          R(sx-6,sy-34,12,3,'#ff4060'); R(sx-6,sy-37,3,3,'#ff4060'); R(sx+3,sy-37,3,3,'#ff4060');
        }
        if (d.o.elite){
          const pulse = 0.5 + 0.5*Math.sin(G.time*6);
          R(sx-7,sy-1,14,2,pulse>0.5?'#ffd34a':'#c89a20');
          R(sx-4,sy-28,8,2,'#ffd34a'); R(sx-4,sy-30,2,2,'#ffd34a'); R(sx-1,sy-31,2,3,'#ffd34a'); R(sx+2,sy-30,2,2,'#ffd34a');
        }
        break;
      case 'animal':drawAnimal(d.o,sx,sy);break;
      case 'pet':drawAnimal(d.o,sx,sy);break;
      case 'player': drawPlayer(sx, sy); break;
    }
  }

  // 粒子
  for (const p of particles){
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    const pos=worldToScreen(p.x,p.y),px=pos.x+shakeX,py=pos.y+shakeY;
    R(px,py,p.size,p.size,p.color);
    if(p.size===3){
      R(px+1,py-1,1,1,'rgba(255,255,255,0.78)');
      R(px-1,py+1,1,1,p.color);
    }
  }
  ctx.globalAlpha = 1;

  // 光照 / 天气
  drawLighting();
  drawWeatherOverlay();
  drawDistanceFog();
}

/* ── 光影氛围：日光暖色 / 夜晚冷色 + 暗角 ─────────── */
/* 第一人称洞穴：头顶的岩顶 + 钟乳石 */
function drawCaveCeiling(){
  const top = Math.round(H * 0.2);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, top);
  for (let x = W; x >= 0; x -= 12){
    ctx.lineTo(x, top + Math.sin(x * 0.07) * 5 + Math.sin(x * 0.19) * 3);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(9,8,7,0.94)';
  ctx.fill();
  for (let i = 0; i < 9; i++){
    const x = 20 + i * (W - 40) / 8;
    const h = 8 + (i % 3) * 7;
    ctx.beginPath();
    ctx.moveTo(x - 5, top - 2); ctx.lineTo(x + 5, top - 2); ctx.lineTo(x, top + h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(13,12,10,0.95)';
    ctx.fill();
  }
}

function drawLightGrade(){
  if(!G)return;
  const day = 1 - clamp(G.darkness, 0, 1);
  if (day > 0.02){
    ctx.fillStyle = 'rgba(255,206,140,' + (0.06 * day) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  if (day < 0.98){
    ctx.fillStyle = 'rgba(80,110,190,' + (0.12 * (1 - day)) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  // 血月：整体压一层暗红
  if (G.bloodMoon){
    ctx.fillStyle = 'rgba(172,28,44,0.14)';
    ctx.fillRect(0, 0, W, H);
  }
  if (!lightGradeCache || lightGradeCache.width !== W){
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const gradient = g.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, H * 0.92);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.30)');
    g.fillStyle = gradient;
    g.fillRect(0, 0, W, H);
    lightGradeCache = cv;
  }
  ctx.drawImage(lightGradeCache, 0, 0, W, H);
  const inCave = clamp(G.darkness, 0, 1);
  if (inCave > 0.02){
    ctx.fillStyle = 'rgba(6,10,22,' + (0.22 * inCave) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}
let lightGradeCache = null;

/* ── 屏幕叠加效果（两种引擎共用） ─────────────────── */
function mobKind(enemy){
  if (enemy.type === 'bloodKnight') return 'bloodKnight';
  if (enemy.type === 'creeper') return 'creeper';
  if (enemy.type === 'caveWarden') return 'skeleton';
  if (enemy.fast) return 'spider';
  if (enemy.type === 'spitter') return 'creeper';
  return 'zombie';
}
/* 怪物：用 MC 皮肤的 UV 部件（头/身/臂/腿）拼出来 */
function drawMobSprites(){
  if (!window.MCTextures || !MCTextures.mobSprite || typeof worldToScreen !== 'function') return false;
  let drew = 0;
  for (const enemy of enemies){
    if (!enemy || enemy.dead) continue;
    const kind = mobKind(enemy);
    let head = MCTextures.mobSprite(kind, 'head');
    let body = MCTextures.mobSprite(kind, 'body');
    let arm = MCTextures.mobSprite(kind, 'arm'), leg = MCTextures.mobSprite(kind, 'leg');
    if (!head || !head.complete){ head = MCTextures.mobSprite('zombie','head'); body = MCTextures.mobSprite('zombie','body'); arm = MCTextures.mobSprite('zombie','arm'); leg = MCTextures.mobSprite('zombie','leg'); }
    if (!head || !head.complete || !head.naturalWidth) continue;
    if (!body || !body.complete || !arm || !arm.complete || !leg || !leg.complete) continue;
    const pos = worldToScreen(enemy.x, enemy.y);
    if (pos.x < -40 || pos.x > W + 40 || pos.y < -70 || pos.y > H + 40) continue;
    // 透视缩放：离得越近越大（原来是固定尺寸，靠近时显得越来越小）
    const baseSize = enemy.boss ? 15 : enemy.fast ? 9 : 11;
    const distTiles = Math.hypot(enemy.x - player.x, enemy.y - player.y) / TILE;
    const distScale = Math.max(0.5, Math.min(2.4, 3.6 / Math.max(1.2, distTiles)));
    const s = baseSize * distScale;
    const x = pos.x - s / 2, y = pos.y + 1;
    const flash = enemy.hitFlash > 0;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(leg, x + s * 0.14, y - s * 0.95, s * 0.36, s * 0.95);
    ctx.drawImage(leg, x + s * 0.50, y - s * 0.95, s * 0.36, s * 0.95);
    ctx.drawImage(body, x, y - s * 1.95, s, s * 1.05);
    ctx.drawImage(arm, x - s * 0.22, y - s * 1.9, s * 0.26, s * 0.95);
    ctx.drawImage(arm, x + s * 0.96, y - s * 1.9, s * 0.26, s * 0.95);
    ctx.drawImage(head, x + s * 0.08, y - s * 2.75, s * 0.84, s * 0.84);
    if (flash){
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#ff8080';
      ctx.fillRect(x - s * 0.3, y - s * 2.9, s * 1.6, s * 2.95);
    }
    ctx.restore();
    drew++;
  }
  window.MOB_SPRITES_OK = drew > 0;
  return drew > 0;
}

function drawScreenFx(){
  // 任何一层特效出错都不能拖垮 HUD：逐层 try/catch
  try { if (G && G.inCave && document.pointerLockElement === canvas) drawCaveCeiling(); } catch (error) { console.error('[FX] 洞穴岩顶', error); }
  try { drawMobSprites(); } catch (error) { console.error('[FX] 怪物精灵', error); }
  try { drawLightGrade(); } catch (error) { console.error('[FX] 光影', error); }
  const sh = shake;
  const shakeX=sh>0.3?rnd(-sh,sh):0,shakeY=sh>0.3?rnd(-sh,sh):0;
  // 受伤红晕
  if (player.hurtFlash > 0){
    ctx.fillStyle = 'rgba(190,20,20,' + (player.hurtFlash * 0.5) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  // 低血量脉动
  const hpRatio = player.hp / player.maxHp;
  if (hpRatio < 0.3 && !G.gameOver){
    const pulse = 0.12 + 0.1 * Math.sin(performance.now() / 220);
    const gradient = ctx.createRadialGradient(W/2, H/2, H*0.32, W/2, H/2, H*0.78);
    gradient.addColorStop(0, 'rgba(180,20,20,0)');
    gradient.addColorStop(1, 'rgba(180,20,20,' + pulse + ')');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }
  // 浮动文字
  ctx.font = 'bold 8px '+UI_FONT;
  ctx.textAlign = 'center';
  for (const t of texts){
    ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
    const pos=worldToScreen(t.x,t.y);
    ctx.fillStyle = '#000';
    ctx.fillText(localizeGameText(t.text), pos.x+shakeX+1, pos.y+shakeY+1);
    ctx.fillStyle = t.color;
    ctx.fillText(localizeGameText(t.text), pos.x+shakeX, pos.y+shakeY);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

/* ── HUD 与面板（两种引擎共用） ───────────────────── */
function drawHudAndPanels(){
  uiButtons = [];
  if(window.Pixel3D && typeof Pixel3D.firstPerson==='function' && Pixel3D.firstPerson()) drawFirstPersonHand();
  drawStatusBars();
  drawCompactHud();
  drawSkillHud();
  drawTutorial();
  if(showMap) drawMinimap();
  if(panel!=='inventory'&&panel!=='craft') drawHotbar();
  drawHints();
  drawToast();

  if(panel==='inventory'){
    inventoryBackdrop=document.createElement('canvas');
    inventoryBackdrop.width=canvas.width;
    inventoryBackdrop.height=canvas.height;
    inventoryBackdrop.getContext('2d').drawImage(canvas,0,0);
  }

  // 面板
  if (panel === 'craft') drawCraftPanel();
  if (panel === 'tech') drawTechPanel();
  if (panel === 'inventory'){
    uiButtons = [];
    drawInventoryPanel();
  }
  if (panel === 'pause') drawPausePanel();
  if (panel === 'character'){ uiButtons=[]; drawCharacterPanel(); }
  if (panel === 'saves') drawSavePanel();
  if (panel === 'growth'){ uiButtons=[]; drawGrowthPanel(); }
  if (panel === 'skills'){ uiButtons=[]; drawSkillTreePanel(); }
  if (panel === 'ach'){ uiButtons=[]; drawAchPanel(); }
  if (panel === 'guide'){ uiButtons=[]; drawGuidePanel(); }
  if (panel === 'machine') drawMachinePanel();
  if (panel === 'trade') drawTradePanel();
  if (panel === 'settings'){ uiButtons=[]; drawSettingsPanel(); }
  if (panel === 'developer'){ uiButtons=[]; drawDeveloperPanel(); }

  if (G.gameOver) drawGameOver();
  if (panel === 'title') drawMainMenu();
}

function drawDistanceFog(){
  const settings=window.PixelGfx?PixelGfx.get().fog:(window.PixelSurvivalAudio?PixelSurvivalAudio.getSettings().fog:0);
  const level=settings||0;
  if(!level)return;
  const maximum=[0,0.12,0.24,0.38][level]||0;
  const color=G.inCave?'72,70,78':'111,145,124';
  const gradient=ctx.createRadialGradient(W/2,H/2,80,W/2,H/2,290);
  gradient.addColorStop(0,'rgba('+color+',0)');
  gradient.addColorStop(0.55,'rgba('+color+','+(maximum*0.18)+')');
  gradient.addColorStop(1,'rgba('+color+','+maximum+')');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
}

function drawWeatherOverlay(){
  if(G.weather==='rain'||G.weather==='blizzard'){
    const snow=G.weather==='blizzard';
    const density=window.PixelGfx?Math.max(0.4,PixelGfx.particleFactor()):1;
    const count=Math.round((snow?30:42)*density);
    for(let i=0;i<count;i++){
      const x=(i*67+Math.floor(G.time*(snow?13:90)))%W;
      const y=(i*43+Math.floor(G.time*(snow?22:150)))%H;
      if(snow)R(x,y,2,2,'rgba(226,239,244,0.72)');
      else R(x,y,1,5,'rgba(160,205,225,0.55)');
    }
    if(!snow){ctx.fillStyle='rgba(84,127,150,0.08)';ctx.fillRect(0,0,W,H);}
  }else if(G.weather==='heatwave'){
    ctx.fillStyle='rgba(232,163,76,0.08)';ctx.fillRect(0,0,W,H);
    for(let i=0;i<5;i++){
      const y=(i*59+G.time*9)%H;
      R(0,y,W,1,'rgba(255,224,151,0.08)');
    }
  }else if(G.weather==='drought'){
    ctx.fillStyle='rgba(188,151,94,0.1)';ctx.fillRect(0,0,W,H);
  }
  if(G.pollution>=600){
    ctx.fillStyle='rgba(102,61,103,'+(Math.min(0.13,(G.pollution-600)/12000))+')';
    ctx.fillRect(0,0,W,H);
  }
}

/* ══════════════════════════════════════════════════════════
   光照（2.5D）
   ══════════════════════════════════════════════════════════ */
function drawLighting(){
  const d = G.inCave ? Math.max(G.darkness, 0.72) : G.darkness;
  if (d <= 0.01){
    // 白天也有极轻微的暖色
    return;
  }

  lctx.clearRect(0, 0, W, H);
  lctx.fillStyle = 'rgba(8,12,40,' + d + ')';
  lctx.fillRect(0, 0, W, H);

  lctx.globalCompositeOperation = 'destination-out';

  // 玩家光圈
  const playerPos=worldToScreen(player.x,player.y);
  const px=playerPos.x;
  const py=playerPos.y-10;
  const grad = lctx.createRadialGradient(px, py, 6, px, py, 112);
  grad.addColorStop(0,    'rgba(0,0,0,1)');
  grad.addColorStop(0.42, 'rgba(0,0,0,0.68)');
  grad.addColorStop(1,    'rgba(0,0,0,0)');
  lctx.fillStyle = grad;
  lctx.fillRect(0, 0, W, H);

  // 火把光圈
  for (const t of torches){
    const torchPos=worldToScreen(t.x,t.y),tx=torchPos.x,ty=torchPos.y-6;
    if (tx < -120 || tx > W + 120 || ty < -120 || ty > H + 120) continue;
    const flick = 1 + Math.sin(t.t * 9) * 0.07;
    const g = lctx.createRadialGradient(tx, ty, 4, tx, ty, 78 * flick);
    g.addColorStop(0,   'rgba(0,0,0,0.95)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.55)');
    g.addColorStop(1,   'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.fillRect(tx - 90, ty - 90, 180, 180);
  }

  // 敌人微光
  for (const e of enemies){
    const enemyPos=worldToScreen(e.x,e.y),ex=enemyPos.x,ey=enemyPos.y-9;
    if (ex < -30 || ex > W + 30) continue;
    const g2 = lctx.createRadialGradient(ex, ey, 0, ex, ey, 24);
    g2.addColorStop(0, 'rgba(0,0,0,0.45)');
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g2;
    lctx.fillRect(ex - 24, ey - 24, 48, 48);
  }

  lctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(lightCv, 0, 0, W, H);

  if(torches.length){
    ctx.globalCompositeOperation='screen';
    for(const torch of torches){
      const torchPos=worldToScreen(torch.x,torch.y),tx=torchPos.x,ty=torchPos.y-6;
      if(tx<-84||tx>W+84||ty<-84||ty>H+84)continue;
      const pulse=0.88+Math.sin(torch.t*7)*0.08;
      const glow=ctx.createRadialGradient(tx,ty,2,tx,ty,58*pulse);
      glow.addColorStop(0,'rgba(255,191,96,0.2)');
      glow.addColorStop(0.45,'rgba(235,132,62,0.075)');
      glow.addColorStop(1,'rgba(235,132,62,0)');
      ctx.fillStyle=glow;ctx.fillRect(tx-60,ty-60,120,120);
    }
    ctx.globalCompositeOperation='source-over';
  }

  // 夜晚蓝色调
  if (d > 0.3){
    ctx.fillStyle = 'rgba(30,50,120,' + (d * 0.14) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}
