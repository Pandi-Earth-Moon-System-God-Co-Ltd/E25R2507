'use strict';

/* ══════════════════════════════════════════════════════════
   准星
   ══════════════════════════════════════════════════════════ */
function drawCrosshair(){
  if (!mouse.active || panel) return;
  const x = mouse.x, y = mouse.y;
  const c = 'rgba(255,244,210,0.85)';
  R(x-6, y, 3, 1, c);
  R(x+4, y, 3, 1, c);
  R(x, y-6, 1, 3, c);
  R(x, y+4, 1, 3, c);
  R(x-1, y-1, 3, 3, 'rgba(229,182,72,0.9)');
  R(x, y, 1, 1, '#fff6d8');
}
/* ══════════════════════════════════════════════════════════
   HUD：状态条
   ══════════════════════════════════════════════════════════ */
function drawBar(x, y, w, h, ratio, cDark, cLight, cTop){
  uiBar(x, y, w, h, ratio, { dark:cDark, light:cLight, top:cTop });
}

function drawStatusBars(){
  const p = player;
  uiPanel(4, 4, 108, 57, {});
  const bx = 16, bw = 56;
  iconHeart(6, 6);
  uiBar(bx, 7, bw, 8, p.hp/p.maxHp, { dark:PAL.hpDark, light:PAL.hpLight, top:'#ffb0a0' });
  iconFood(6, 17);
  uiBar(bx, 18, bw, 8, p.hunger/p.maxHunger, { dark:PAL.hungerDark, light:PAL.hungerLight, top:'#ffd060' });
  R(8,29,2,2,'#83c7dc'); R(6,31,6,6,'#83c7dc'); R(8,32,2,4,'#d7f4ff');
  uiBar(bx, 29, bw, 7, p.thirst/p.maxThirst, { dark:'#315b70', light:'#57aecb', top:'#c7f5ff' });
  iconBolt(6, 38);
  uiBar(bx, 39, bw, 7, p.stamina/p.maxStamina, { dark:PAL.staDark, light:PAL.staLight, top:'#b8ecff' });
  R(7,49,2,7,'#c7dad2'); R(8,47,1,2,'#c7dad2'); R(9,49,2,2,'#ea8170');
  uiBar(bx, 49, bw, 6, clamp((p.bodyTemp-30)/12,0,1),
    {dark:'#49666d',light:p.bodyTemp<34?'#86b7d2':'#70b78e',top:'#d8efd1'});

  const hpTxt = Math.ceil(p.hp)+'/'+p.maxHp;
  txt(hpTxt, 104, 8, { size:6, bold:true, color:'rgba(0,0,0,0.85)', align:'right' });
  txt(hpTxt, 103, 7, { size:6, bold:true, color:'#ffd0d0', align:'right' });
  const huTxt = Math.round(p.hunger)+'%';
  txt(huTxt, 104, 19, { size:6, bold:true, color:'rgba(0,0,0,0.85)', align:'right' });
  txt(huTxt, 103, 18, { size:6, bold:true, color:'#fff0bd', align:'right' });
  const thTxt = Math.round(p.thirst)+'%';
  txt(thTxt, 104, 30, { size:6, bold:true, color:'rgba(0,0,0,0.85)', align:'right' });
  txt(thTxt, 103, 29, { size:6, bold:true, color:'#c8f5ff', align:'right' });
  const stTxt = Math.round(p.stamina)+'%';
  txt(stTxt, 104, 40, { size:6, bold:true, color:'rgba(0,0,0,0.85)', align:'right' });
  txt(stTxt, 103, 39, { size:6, bold:true, color:'#c8ffff', align:'right' });
  const tempTxt=p.bodyTemp.toFixed(1)+'°';
  txt(tempTxt,104,49,{size:6,bold:true,color:'rgba(0,0,0,0.85)',align:'right'});
  txt(tempTxt,103,48,{size:6,bold:true,color:p.bodyTemp<34?'#a8d7f0':p.bodyTemp>39?'#ffc18a':'#d8efd1',align:'right'});
}

function drawProgressHud(){
  const x = 118, y = 7;
  const title = '科技 ' + (G.tech + 1) + ' · ' + TECH_LEVELS[G.tech].name;
  R(x - 3, y - 1, 106, 20, 'rgba(12,20,19,0.76)');
  R(x - 3, y - 1, 2, 20, G.bloodMoon ? '#d85069' : '#9a8450');
  ctx.font = 'bold 6px '+UI_FONT;
  ctx.fillStyle = '#e5d8a8';
  ctx.fillText(localizeGameText(title), x, y + 1);
  ctx.fillStyle = G.bloodMoon ? '#ff8b9b' : '#c1d0bb';
  const eventText = G.bloodMoon ? '血月来袭！'
    : G.day % 7 === 0 ? '血月今夜降临' : '血月倒计时 ' + (7 - (G.day % 7)) + ' 天';
  ctx.fillText(localizeGameText(eventText), x, y + 10);
  if (panel !== 'tech' && panel !== 'pause' && !G.gameOver){
    uiButtons.push({ x:x - 3, y:y - 1, w:106, h:20, fn:() => { panel = 'tech'; } });
  }
  if (G.bloodMoon){
    const label = '血月';
    ctx.font = 'bold 8px '+UI_FONT;
    ctx.textAlign = 'center';
    R(W/2 - 25, 7, 50, 13, 'rgba(65,12,24,0.88)');
    ctx.fillStyle = '#ff8792';
    ctx.fillText(localizeGameText(label), W/2, 9);
    ctx.textAlign = 'left';
  }
}

/* ══════════════════════════════════════════════════════════
   HUD：装备
   ══════════════════════════════════════════════════════════ */
function drawEquipment(){
  const x = 7, y = 46;
  const wep = player.weapon;
  const arm = player.armorId;

  ctx.font = 'bold 7px '+UI_FONT;

  // 武器槽
  R(x, y, 12, 12, 'rgba(0,0,0,0.55)');
  if (wep) drawItemIcon(ctx, wep, x+1, y+1, 10);
  R(x, y, 12, 12, 'rgba(120,150,200,0.22)');

  // 护甲槽
  R(x+15, y, 12, 12, 'rgba(0,0,0,0.55)');
  if (arm) drawItemIcon(ctx, arm, x+16, y+1, 10);
  R(x+15, y, 12, 12, 'rgba(120,150,200,0.22)');

  // 名称
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillText(localizeGameText(wep ? ITEMS[wep].name : '徒手'), x+30, y+2);
  ctx.fillStyle = wep ? '#ffe0a0' : '#9aa0b0';
  ctx.fillText(localizeGameText(wep ? ITEMS[wep].name : '徒手'), x+29, y+1);

  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillText(localizeGameText(arm ? ITEMS[arm].name : '无护甲'), x+30, y+9);
  ctx.fillStyle = arm ? '#b0d0ff' : '#9aa0b0';
  ctx.fillText(localizeGameText(arm ? ITEMS[arm].name : '无护甲'), x+29, y+8);
}

/* ══════════════════════════════════════════════════════════
   HUD：小地图
   ══════════════════════════════════════════════════════════ */
function drawMinimap(){
  const MW = 78, MH = 78;
  const mx = W - MW - 7, my = 7;
  uiPanel(mx-3, my-3, MW+6, MH+6, {});
  const mapPoint=(x,y)=>{
    if(G.mapId)return {x:mx+x/WORLD_W*MW,y:my+y/WORLD_H*MH};
    const tileSize=MW/31;
    return {x:mx+MW/2+(x-player.x)/TILE*tileSize,
      y:my+MH/2+(y-player.y)/TILE*tileSize};
  };
  if(G.mapId)ctx.drawImage(worldCv,0,0,WORLD_W,WORLD_H,mx,my,MW,MH);
  else{
    const centerX=Math.floor(player.x/TILE),centerY=Math.floor(player.y/TILE);
    const cell=MW/31;
    for(let ty=centerY-15;ty<=centerY+15;ty++)for(let tx=centerX-15;tx<=centerX+15;tx++){
      const terrain=MAP_TERRAIN[Math.max(0,getWorldTerrainIndex(tx,ty,G.worldLayer))];
      ctx.fillStyle=terrain.color;
      ctx.fillRect(mx+(tx-centerX+15)*cell,my+(ty-centerY+15)*cell,Math.ceil(cell),Math.ceil(cell));
    }
  }
  if (G.darkness > 0.08){
    ctx.fillStyle = 'rgba(8,14,48,' + (G.darkness * 0.72) + ')';
    ctx.fillRect(mx, my, MW, MH);
  }
  for (const t of torches){
    const point=mapPoint(t.x,t.y);
    if(point.x>=mx&&point.x<=mx+MW&&point.y>=my&&point.y<=my+MH)
      R(point.x-1,point.y-1,2,2,'#ffb030');
  }
  for (const e of enemies){
    const point=mapPoint(e.x,e.y);
    if(point.x>=mx&&point.x<=mx+MW&&point.y>=my&&point.y<=my+MH)
      R(point.x-1,point.y-1,2,2,e.type==='bloodKnight'?'#ff77a0':'#ff4040');
  }
  const {x:px,y:py}=mapPoint(player.x,player.y);
  R(px-2, py-2, 5, 5, 'rgba(120,255,120,0.28)');
  R(px-1, py-1, 3, 3, '#60ff60');
  R(px, py, 1, 1, '#ffffff');
  ctx.strokeStyle = 'rgba(90,60,30,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + 0.5, my + 0.5, MW - 1, MH - 1);
  ctx.lineWidth = 1;
}

/* ══════════════════════════════════════════════════════════
   HUD：昼夜指示
   ══════════════════════════════════════════════════════════ */
function drawDayNight(){
  const cx = W - 22, cy = 100;
  const r = 9;

  R(cx - r - 1, cy - r - 1, r*2+2, r*2+2, 'rgba(4,6,14,0.85)');

  // 进度环
  ctx.strokeStyle = 'rgba(90,110,150,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // 太阳/月亮位置
  const ang = G.dayTime * Math.PI * 2 - Math.PI/2;
  const ox = cx + Math.cos(ang) * r;
  const oy = cy + Math.sin(ang) * r;

  const isNight = G.darkness > 0.3;
  if (isNight){
    R(ox-2, oy-2, 5, 5, G.bloodMoon ? '#ff6578' : '#dfe6ff');
    R(ox-1, oy-2, 4, 5, G.bloodMoon ? '#571c32' : '#101830');
  } else {
    R(ox-2, oy-2, 5, 5, '#ffd24a');
    R(ox-1, oy-1, 3, 3, '#fff0a0');
  }

  ctx.lineWidth = 1;
}

/* ══════════════════════════════════════════════════════════
   HUD：快捷栏
   ══════════════════════════════════════════════════════════ */
const SLOT = 24, SLOT_GAP = 2;

function hotbarLayout(){
  const n = HOTBAR_SIZE;
  const totalW = n * SLOT + (n - 1) * SLOT_GAP;
  const x0 = Math.round((W - totalW) / 2);
  const y0 = panel === 'inventory' ? H - SLOT - 49 : H - SLOT - 7;
  return { x0, y0, totalW, n };
}

function drawHotbar(){
  const { x0, y0, n } = hotbarLayout();
  hoverSlot = -1;
  const barW = n * SLOT + (n-1) * SLOT_GAP;
  uiPanel(x0 - 6, y0 - 6, barW + 12, SLOT + 12, {});
  R(x0 - 6, y0 - 3, barW + 12, 1, PAL.goldDark);
  uiButtons.push({ x: x0 - 6, y: y0 - 6, w: barW + 12, h: SLOT + 12, fn: null });

  for (let i = 0; i < n; i++){
    const id = hotbar[i];
    const sx = x0 + i * (SLOT + SLOT_GAP);
    const sy = y0;
    const count = id ? inv[id] || 0 : 0;
    if (mouse.x >= sx && mouse.x <= sx + SLOT && mouse.y >= sy && mouse.y <= sy + SLOT) hoverSlot = i;
    const selected = selectedHotbar === i;
    uiSlot(sx, sy, SLOT, { selected: selected, hover: hoverSlot === i });
    if (id && count > 0) drawItemIcon(ctx, id, sx + 3, sy + 3, 18);
    else if (id){ ctx.globalAlpha = 0.22; drawItemIcon(ctx, id, sx + 3, sy + 3, 18); ctx.globalAlpha = 1; }
    txt(String(i + 1), sx + 3, sy + 2, { size:6, bold:true, color: selected ? '#fff1a8' : 'rgba(255,255,255,0.72)' });
    if (count > 0){
      const t = count > 99 ? '99+' : String(count);
      txt(t, sx + SLOT - 2, sy + SLOT - 9, { size:6, bold:true, color:'#ffffff', align:'right' });
    }
    uiButtons.push({
      x: sx - 1, y: sy - 1, w: SLOT + 2, h: SLOT + 2,
      fn: () => selectHotbar(i),
      ...(panel === 'inventory' ? { dragSlot: i } : {})
    });
  }
}

function drawInventoryPanel(){
  ctx.fillStyle = 'rgba(20,12,6,0.72)';
  ctx.fillRect(0, 0, W, H);

  const pw = 420, ph = 220;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  uiPanel(px - 3, py - 3, pw + 6, ph + 6, {});
  uiPanel(px, py, pw, ph, { fill: PAL.paper, woodMid: PAL.wood });

  txt('物品栏与装备', px + 12, py + 9, { size:10, bold:true, color:'#426044' });
  txt('E / ESC 关闭', px + pw - 12, py + 13, { size:7, bold:true, color:'#756449', align:'right' });
  R(px + 8, py + 25, pw - 16, 1, PAL.creamShade);

  txt('装备', px + 12, py + 35, { size:7, bold:true, color:PAL.inkSoft });
  txt('物品', px + 80, py + 35, { size:7, bold:true, color:PAL.inkSoft });

  const bagItems = inventoryOrder.filter((id, index) =>
    inventoryOrder.indexOf(id) === index && (inv[id] || 0) > 0 && !hotbar.includes(id)
  );
  const cols = 9, cell = 22, gap = 2;
  const gridX = px + 80;
  const gridY = py + 42;
  const gridRows = 4;

  for (let i = 0; i < cols * gridRows; i++){
    const col = i % cols, row = Math.floor(i / cols);
    const sx = gridX + col * (cell + gap), sy = gridY + row * (cell + gap);
    const id = bagItems[i];
    uiSlot(sx, sy, cell, {});
    if (id){
      drawItemIcon(ctx, id, sx + 2, sy + 2, 18);
      txt(String(inv[id]), sx + cell - 2, sy + cell - 7, { size:6, bold:true, color:'#ffffff', align:'right' });
      uiButtons.push({ x:sx, y:sy, w:cell, h:cell, dragItem:id });
    } else {
      uiButtons.push({ x:sx, y:sy, w:cell, h:cell, dragBag:true });
    }
  }

  EQUIPMENT_ARMOR_SLOTS.forEach((slot, index) => {
    const column=index%2,row=Math.floor(index/2);
    const sx=px+10+column*38,sy=py+46+row*36;
    const id=player.equipment&&player.equipment[slot.id];
    uiSlot(sx, sy, 25, {});
    if (id){
      drawItemIcon(ctx, id, sx + 3, sy + 3, 18);
    }
    txt(slot.label,sx+12,sy+27,{size:6,bold:true,color:id?PAL.ink:PAL.inkSoft,align:'center'});
    uiButtons.push({x:sx,y:sy,w:25,h:25,dragEquipment:slot.id});
  });

  const previewX = px + 32, previewY = py + 119;
  uiPanel(previewX, previewY, 29, 58, { fill:'rgba(52,66,59,0.6)', woodMid:'#5c6a55' });
  R(previewX + 10, previewY + 6, 9, 10, '#d6a77a');
  R(previewX + 9, previewY + 5, 11, 3, '#70492e');
  R(previewX + 7, previewY + 17, 15, 17, '#4d79a8');
  R(previewX + 4, previewY + 18, 4, 14, '#d6a77a');
  R(previewX + 21, previewY + 18, 4, 14, '#d6a77a');
  R(previewX + 8, previewY + 34, 6, 17, '#34384b');
  R(previewX + 15, previewY + 34, 6, 17, '#34384b');
  R(previewX + 6, previewY + 50, 8, 3, '#242424');
  R(previewX + 15, previewY + 50, 8, 3, '#242424');

  txt('快捷栏', px + 12, py + 181, { size:7, bold:true, color:'#e8dcc0' });
  txt('1–9 选择', px + 12, py + 188, { size:6, bold:true, color:PAL.inkSoft });

  drawHotbar();

  const craftX = px + 302, craftY = py + 37;
  txt('制作', craftX, craftY, { size:7, bold:true, color:'#e8dcc0' });
  const craftCell = 16, craftGap = 2;
  for (let row = 0; row < 2; row++){
    for (let col = 0; col < 2; col++){
      uiSlot(craftX + col * (craftCell + craftGap), craftY + 9 + row * (craftCell + craftGap), craftCell, {});
    }
  }
  txt('→', craftX + 39, craftY + 30, { size:8, bold:true, color:PAL.inkSoft });
  const recipe = RECIPES[selectedRecipe];
  const outputX = craftX + 51, outputY = craftY + 13;
  uiSlot(outputX, outputY, 24, {});
  if (recipe) drawItemIcon(ctx, recipe.out, outputX + 3, outputY + 3, 18);
  txt(recipe ? ITEMS[recipe.out].name : '', outputX + 12, outputY + 31, { size:6, bold:true, color:'#e8dcc0', align:'center' });
  uiButtons.push({ x:outputX - 2, y:outputY - 2, w:28, h:36, fn:() => craftRecipe(selectedRecipe) });
  R(craftX, py + 81, 108, 1, PAL.creamShade);
  txt('点击产物快速制作', craftX, py + 90, { size:6, bold:true, color:PAL.inkSoft });
  txt('C 配方 · T 科技', craftX, py + 100, { size:6, bold:true, color:PAL.inkSoft });

  const trashX = px + pw - 39, trashY = py + 124;
  uiPanel(trashX - 5, trashY - 5, 38, 38, { fill:'#e3d4ac', woodMid:PAL.wood });
  R(trashX + 5, trashY + 4, 18, 20, '#a7ab91');
  R(trashX + 3, trashY + 1, 22, 3, '#d0c28e');
  R(trashX + 9, trashY - 2, 10, 3, '#d0c28e');
  R(trashX + 9, trashY + 8, 2, 12, '#4d5a50');
  R(trashX + 16, trashY + 8, 2, 12, '#4d5a50');
  txt('垃圾桶', trashX + 14, trashY + 39, { size:6, bold:true, color:PAL.inkSoft, align:'center' });
  uiButtons.push({ x:trashX - 5, y:trashY - 5, w:38, h:42, dragTrash:true });

  txt('拖动物品整理 · 防具放入对应槽 · 拖到垃圾桶丢弃', W/2, py + ph - 10, { size:6, bold:true, color:'#756449', align:'center' });
  if(inventoryDragSource){
    const id=inventoryDragSource.kind==='hotbar'
      ?hotbar[inventoryDragSource.index]:inventoryDragSource.id;
    if(id&&inv[id]>0){
      ctx.save();
      ctx.globalAlpha=0.82;
      R(mouse.x-12,mouse.y-12,24,24,'rgba(12,18,16,0.82)');
      drawItemIcon(ctx,id,mouse.x-10,mouse.y-10,20);
      ctx.restore();
    }
  }
}

/* ══════════════════════════════════════════════════════════
   HUD：提示条
   ══════════════════════════════════════════════════════════ */
function drawToast(){
  if (toast.t <= 0) return;
  const a = clamp(toast.t / 0.55, 0, 1);
  ctx.globalAlpha = a;
  setFont(9, true);
  ctx.textAlign = 'center';
  const tw = ctx.measureText(localizeGameText(toast.text)).width;
  const bw = tw + 18, bx = Math.round(W/2 - bw/2), by = 44;
  uiPanel(bx, by, bw, 18, {});
  txt(toast.text, W/2, by + 3, { size:9, bold:true, color: toast.color, align:'center' });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

/* ══════════════════════════════════════════════════════════
   HUD：底部操作提示
   ══════════════════════════════════════════════════════════ */
function drawHints(){
  if (panel) return;
  const hint = localizeGameText('WASD移动/Shift冲刺 · 左键攻击 · 右键使用 · E背包 · C制作 · F洞穴/进食 · J帮助 · M地图');
  ctx.font = 'bold 6px '+UI_FONT;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillText(hint, W/2+1, H - 66);
  ctx.fillStyle = 'rgba(230,235,245,0.9)';
  ctx.fillText(hint, W/2, H - 67);
  ctx.textAlign = 'left';
}

function drawWorldActionHint(){
  if (panel || G.gameOver) return;
  const river=findRiverTileNear(player.x,player.y,TILE*3);
  const nearby = [
    ...caveEntrances.map(entry=>{
      const targetY=G.inCave?CAVE_LINE+TILE/2:CAVE_LINE-TILE/2;
      return {object:{x:entry.x,y:targetY},distance:Math.hypot(entry.x-player.x,targetY-player.y),
        text:G.inCave?'F 返回地表':'F 进入地下洞穴'};
    }),
    ...machines.map(object => ({object, distance:Math.hypot(object.x-player.x,object.y-player.y), text:'右键打开机器 · '+MACHINE_TYPES[object.type].name})),
    ...villagers.map(object=>({object,distance:Math.hypot(object.x-player.x,object.y-player.y),text:'右键与村民交易 · 金币 '+(inv.coin||0)})),
    ...ruins.filter(object => !object.opened).map(object => ({object, distance:Math.hypot(object.x-player.x,object.y-player.y), text:'右键探索遗迹'})),
    ...(river?[{object:river,distance:river.distance,text:inv.emptyBottle>0?'右键河流装水 · 熔炉烧开可恢复更多':'需要空瓶才能装水'}]:[]),
    ...placedBlocks.filter(object=>object.type==='worldGate').map(object=>({object,distance:Math.hypot(object.x-player.x,object.y-player.y),
      text:'右键挑战世界核心 · 需荧晶时代与巨像战绩'})),
  ].filter(entry => entry.distance <= TILE*4)
    .sort((a,b) => a.distance-b.distance)[0];
  if (!nearby) return;

  const pos=worldToScreen(nearby.object.x,nearby.object.y);
  const sx=pos.x;
  const sy=pos.y-24;
  if (sx < 20 || sx > W-20 || sy < 18 || sy > H-50) return;
  ctx.font = 'bold 6px '+UI_FONT;
  const width = Math.min(W-16,ctx.measureText(localizeGameText(nearby.text)).width+10);
  const x = clamp(sx-width/2,8,W-width-8);
  R(x,sy,width,12,'rgba(12,18,16,0.88)');
  R(x,sy,width,1,'rgba(229,216,168,0.55)');
  txt(nearby.text,x+width/2,sy+3,{size:6,bold:true,color:'#fff0bd',align:'center'});
}
