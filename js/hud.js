'use strict';

/* ══════════════════════════════════════════════════════════
   准星
   ══════════════════════════════════════════════════════════ */
function drawCrosshair(){
  if (!mouse.active || panel) return;
  const firstPerson = !!(window.Pixel3D && typeof Pixel3D.firstPerson === 'function' && Pixel3D.firstPerson());
  const x = firstPerson ? W / 2 : mouse.x;
  const y = firstPerson ? H / 2 : mouse.y;
  const c = 'rgba(255,255,255,0.85)';
  R(x-7, y, 5, 1, c);
  R(x+3, y, 5, 1, c);
  R(x, y-7, 1, 5, c);
  R(x, y+3, 1, 5, c);
  R(x, y, 1, 1, 'rgba(255,255,255,0.9)');
}
/* ══════════════════════════════════════════════════════════
   HUD：状态条
   ══════════════════════════════════════════════════════════ */
function drawBar(x, y, w, h, ratio, cDark, cLight, cTop){
  uiBar(x, y, w, h, ratio, { dark:cDark, light:cLight, top:cTop });
}

function drawStatusBars(){
  const p = player;
  // MC 风格：半透明深色条 + 白色描边
  R(4, 4, 108, 57, 'rgba(0,0,0,0.62)');
  R(5, 5, 106, 55, 'rgba(24,24,24,0.72)');
  R(5, 5, 106, 1, 'rgba(255,255,255,0.22)');
  const bx = 16, bw = 56;
  iconHeart(6, 6);
  uiBar(bx, 6, bw, 9, p.hp/p.maxHp, { dark:PAL.hpDark, light:PAL.hpLight, top:'#ffb0a0' });
  iconFood(6, 17);
  uiBar(bx, 17, bw, 9, p.hunger/p.maxHunger, { dark:PAL.hungerDark, light:PAL.hungerLight, top:'#ffd060' });
  R(8,29,2,2,'#83c7dc'); R(6,31,6,6,'#83c7dc'); R(8,32,2,4,'#d7f4ff');
  uiBar(bx, 28, bw, 8, p.thirst/p.maxThirst, { dark:'#315b70', light:'#57aecb', top:'#c7f5ff' });
  // 闪电（体力）
  R(9, 38, 2, 3, '#ffe066');
  R(7, 40, 4, 2, '#ffe066');
  R(7, 42, 2, 2, '#ffd23f');
  R(9, 44, 1, 1, '#ffd23f');
  uiBar(bx, 38, bw, 8, p.stamina/p.maxStamina, { dark:PAL.staDark, light:PAL.staLight, top:'#b8ecff' });
  R(7, 48, 1, 6, '#c7dad2');   // 管身
  R(10, 48, 1, 6, '#c7dad2');
  R(8, 48, 2, 6, '#2a3330');   // 管内
  R(8, 50, 2, 4, '#ea8170');   // 水银
  R(6, 53, 6, 4, '#c7dad2');   // 球泡
  R(7, 54, 4, 2, '#ea8170');   // 泡内水银
  uiBar(bx, 48, bw, 7, clamp((p.bodyTemp-30)/12,0,1),
    {dark:'#49666d',light:p.bodyTemp<34?'#86b7d2':'#70b78e',top:'#d8efd1'});

  const hpTxt = Math.ceil(p.hp)+'/'+p.maxHp;
  txt(hpTxt, 104, 7, { size:6, bold:true, color:'#ffd0d0', align:'right' });
  const huTxt = Math.round(p.hunger)+'%';
  txt(huTxt, 104, 18, { size:6, bold:true, color:'#fff0bd', align:'right' });
  const thTxt = Math.round(p.thirst)+'%';
  txt(thTxt, 104, 29, { size:6, bold:true, color:'#c8f5ff', align:'right' });
  const stTxt = Math.round(p.stamina)+'%';
  txt(stTxt, 104, 39, { size:6, bold:true, color:'#c8ffff', align:'right' });
  // 弓箭蓄力环：按住左键时在瞄准点出现
  if (p && p.chargeStart && typeof mouse !== 'undefined'){
    const weapon = ITEMS[p.weapon] || {};
    const need = (weapon.chargeTime || 1.1) * 1000;
    const ratio = Math.min(1, (performance.now() - p.chargeStart) / need);
    const cx = mouse.x, cy = mouse.y, radius = 15;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    ctx.strokeStyle = ratio >= 1 ? '#ffe066' : '#9fe4ff';
    ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio); ctx.stroke();
    if (ratio >= 1){
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(cx - 1, cy - 1, 3, 3);
    }
    ctx.restore();
  }
  const tempTxt=p.bodyTemp.toFixed(1)+'°';
  txt(tempTxt,103,48,{size:6,bold:true,color:p.bodyTemp<34?'#a8d7f0':p.bodyTemp>39?'#ffc18a':'#d8efd1',align:'right'});
}

function drawProgressHud(){
  const x = 118, y = 7;
  const title = '科技 ' + (G.tech + 1) + ' · ' + TECH_LEVELS[G.tech].name;
  R(x - 3, y - 1, 106, 20, 'rgba(0,0,0,0.72)');
  R(x - 3, y - 1, 106, 1, 'rgba(255,255,255,0.2)');
  R(x - 3, y - 1, 2, 20, G.bloodMoon ? '#d85069' : '#9a8450');
  txt(localizeGameText(title), x, y + 1, { size:6, bold:true, color:'#e5d8a8' });
  const eventText = G.bloodMoon ? '血月来袭！'
    : G.day % 7 === 0 ? '血月今夜降临' : '血月倒计时 ' + (7 - (G.day % 7)) + ' 天';
  txt(localizeGameText(eventText), x, y + 10, { size:6, bold:true, color: G.bloodMoon ? '#ff8b9b' : '#c1d0bb' });
  if (panel !== 'tech' && panel !== 'pause' && !G.gameOver){
    uiButtons.push({ x:x - 3, y:y - 1, w:106, h:20, fn:() => { panel = 'tech'; } });
  }
  if (G.bloodMoon){
    R(W/2 - 25, 7, 50, 13, 'rgba(65,12,24,0.88)');
    txt('血月', W/2, 9, { size:8, bold:true, color:'#ff8792', align:'center' });
  }
}

/* ══════════════════════════════════════════════════════════
   HUD：装备
   ══════════════════════════════════════════════════════════ */
function drawEquipment(){
  const x = 7, y = 46;
  const wep = player.weapon;
  const arm = player.armorId;

  // 武器槽
  R(x, y, 12, 12, 'rgba(0,0,0,0.55)');
  if (wep) drawItemIcon(ctx, wep, x+1, y+1, 10);
  R(x, y, 12, 12, 'rgba(120,150,200,0.22)');

  // 护甲槽
  R(x+15, y, 12, 12, 'rgba(0,0,0,0.55)');
  if (arm) drawItemIcon(ctx, arm, x+16, y+1, 10);
  R(x+15, y, 12, 12, 'rgba(120,150,200,0.22)');

  // 名称
  txt(wep ? ITEMS[wep].name : '徒手', x+29, y+1, { size:7, bold:true, color: wep ? '#ffe0a0' : '#9aa0b0' });
  txt(arm ? ITEMS[arm].name : '无护甲', x+29, y+8, { size:7, bold:true, color: arm ? '#b0d0ff' : '#9aa0b0' });
}

/* ══════════════════════════════════════════════════════════
   HUD：小地图
   ══════════════════════════════════════════════════════════ */
function drawMinimap(){
  const MW = 78, MH = 78;
  const mx = W - MW - 7, my = 7;
  R(mx - 3, my - 3, MW + 6, MH + 6, 'rgba(0,0,0,0.72)');
  R(mx - 2, my - 2, MW + 4, MH + 4, '#373737');
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
  R(mx, my + MH - 1, MW, 1, 'rgba(0,0,0,0.45)');
  R(mx + MW - 1, my, 1, MH, 'rgba(0,0,0,0.45)');
}

/* ══════════════════════════════════════════════════════════
   HUD：昼夜指示
   ══════════════════════════════════════════════════════════ */
function drawDayNight(){
  const cx = W - 22, cy = 100;
  const r = 9;

  R(cx - r - 1, cy - r - 1, r*2+2, r*2+2, 'rgba(0,0,0,0.78)');

  // 进度环
  ctx.strokeStyle = 'rgba(150,150,150,0.5)';
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
   HUD：快捷栏（Minecraft 风格）
   ══════════════════════════════════════════════════════════ */
const SLOT = 20, SLOT_GAP = 0;

function hotbarLayout(){
  const n = HOTBAR_SIZE;
  const totalW = n * SLOT + (n - 1) * SLOT_GAP;
  const x0 = Math.round((W - totalW) / 2);
  const y0 = H - SLOT - 6;
  return { x0, y0, totalW, n };
}

function drawHotbar(){
  const { x0, y0, n } = hotbarLayout();
  hoverSlot = -1;
  const barW = n * SLOT + (n-1) * SLOT_GAP;
  // MC 快捷栏：深色半透明底 + 白色描边
  R(x0 - 2, y0 - 2, barW + 4, SLOT + 4, 'rgba(0,0,0,0.62)');
  R(x0 - 1, y0 - 1, barW + 2, SLOT + 2, 'rgba(26,26,26,0.62)');
  R(x0 - 1, y0 - 1, barW + 2, 1, 'rgba(255,255,255,0.18)');
  uiButtons.push({ x: x0 - 2, y: y0 - 2, w: barW + 4, h: SLOT + 4, fn: null });

  for (let i = 0; i < n; i++){
    const id = hotbar[i];
    const sx = x0 + i * (SLOT + SLOT_GAP);
    const sy = y0;
    const count = id ? inv[id] || 0 : 0;
    if (mouse.x >= sx && mouse.x <= sx + SLOT && mouse.y >= sy && mouse.y <= sy + SLOT) hoverSlot = i;
    const selected = selectedHotbar === i;
    R(sx + 1, sy + 1, SLOT - 2, SLOT - 2, 'rgba(0,0,0,0.16)');
    R(sx + 1, sy + 1, SLOT - 2, 1, 'rgba(0,0,0,0.42)');
    R(sx + 1, sy + 1, 1, SLOT - 2, 'rgba(0,0,0,0.42)');
    R(sx + 1, sy + SLOT - 2, SLOT - 2, 1, 'rgba(255,255,255,0.16)');
    R(sx + SLOT - 2, sy + 1, 1, SLOT - 2, 'rgba(255,255,255,0.16)');
    if (id && count > 0) drawItemIcon(ctx, id, sx + 2, sy + 2, 16);
    else if (id){ ctx.globalAlpha = 0.28; drawItemIcon(ctx, id, sx + 2, sy + 2, 16); ctx.globalAlpha = 1; }
    if (count > 0){
      countText(count > 64 ? 64 : count, sx + SLOT - 2, sy + SLOT - 2);
    }
    if (selected){
      R(sx, sy, SLOT, 1, '#ffffff');
      R(sx, sy + SLOT - 1, SLOT, 1, '#ffffff');
      R(sx, sy, 1, SLOT, '#ffffff');
      R(sx + SLOT - 1, sy, 1, SLOT, '#ffffff');
    }
    uiButtons.push({ x: sx, y: sy, w: SLOT, h: SLOT, fn: () => selectHotbar(i) });
  }
}

/* ══════════════════════════════════════════════════════════
   HUD：第一人称手持物品
   ══════════════════════════════════════════════════════════ */
function drawFirstPersonHand(){
  const p = player;
  const appearance = p.appearance || DEFAULT_PLAYER_APPEARANCE;
  const outfit = PLAYER_CUSTOMIZATION.outfit[appearance.outfit] || PLAYER_CUSTOMIZATION.outfit[0];
  const skin = PLAYER_CUSTOMIZATION.skin[appearance.skin] || PLAYER_CUSTOMIZATION.skin[0];
  const id = hotbar[selectedHotbar];
  const gait = playerMoveBlend();
  const stride = Math.sin(p.walkPhase * 0.16) * gait;
  const attackT = p.swing > 0 ? 1 - p.swing / ATTACK_ANIM_DURATION : -1;
  const attackPhase = attackT >= 0 ? Math.sin(clamp(attackT, 0, 1) * Math.PI * 2) : 0;
  const isWeaponOrTool = !!(id && ITEMS[id] && ['weapon', 'tool'].includes(ITEMS[id].kind));
  const scale = clamp(H / 270, 0.75, 1.6);
  const length = 150 * scale;
  const width = 42 * scale;
  const bob = (stride * 1.2 + Math.sin(G.time * 2.4) * 0.5 * (1 - gait)) * scale;
  const jump = Math.min(9, (p.jumpHeight || 0) * 3) * scale;
  const x = W + 8 * scale;
  const y = H + 8 * scale + bob - jump;
  const swingAngle = clamp(stride * 0.2 + attackPhase, -1, 1) * Math.PI / 9;
  const rotation = -1 + swingAngle;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#171717';
  ctx.fillRect(-width / 2, -length, width, length);
  ctx.fillStyle = outfit.shadow;
  ctx.fillRect(-width / 2 + scale, -length + scale, width - 2 * scale, length - scale);
  ctx.fillStyle = outfit.base;
  ctx.fillRect(-width / 2 + 2 * scale, -length + scale, width - 5 * scale, length - 2 * scale);
  ctx.fillStyle = outfit.light || outfit.base;
  ctx.fillRect(-width / 2 + 2 * scale, -length + scale, 6 * scale, length - 5 * scale);
  ctx.fillStyle = skin.shadow;
  ctx.fillRect(-width / 2 + scale, -length, width - 2 * scale, 20 * scale);
  ctx.fillStyle = skin.base;
  ctx.fillRect(-width / 2 + 2 * scale, -length + scale, width - 4 * scale, 18 * scale);
  ctx.fillStyle = skin.light || skin.base;
  ctx.fillRect(-width / 2 + 2 * scale, -length + scale, 9 * scale, 12 * scale);
  if (id && ITEMS[id]){
    const item = ITEMS[id];
    const itemSize = (isWeaponOrTool ? 90 : 64) * scale;
    const grip = item.firearm ? { x:0.38, y:0.65 } : item.icon === 'sword' ? { x:0.66, y:0.84 } : { x:0.5, y:0.82 };
    ctx.save();
    const itemLift = ((isWeaponOrTool ? 20 : 0) + (item.icon === 'sword' ? 35 : 0)) * scale;
    const swordOffsetX = item.icon === 'sword' ? 15 * scale : 0;
    const swordOffsetY = item.icon === 'sword' ? 10 * scale : 0;
    ctx.translate(
      -Math.sin(rotation) * itemLift + Math.cos(rotation) * swordOffsetX + Math.sin(rotation) * swordOffsetY,
      -length + 8 * scale - Math.cos(rotation) * itemLift - Math.sin(rotation) * swordOffsetX + Math.cos(rotation) * swordOffsetY
    );
    ctx.rotate(-0.25);
    drawItemIcon(ctx, id, -grip.x * itemSize, -grip.y * itemSize, itemSize);
    ctx.restore();
  }
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════
   背包：Minecraft 原版物品栏 GUI
   ══════════════════════════════════════════════════════════ */
const INVENTORY_PANEL = { x:152, y:52, w:176, h:166 };

function drawInventoryPanel(){
  hoverCraftItem = null;
  ctx.fillStyle = 'rgba(12,10,8,0.72)';
  ctx.fillRect(0, 0, W, H);

  const px = INVENTORY_PANEL.x, py = INVENTORY_PANEL.y, pw = INVENTORY_PANEL.w, ph = INVENTORY_PANEL.h;
  drawMcContainer('inventory', px, py, pw, ph);

  // 四个防具槽
  EQUIPMENT_ARMOR_SLOTS.forEach((slot, index) => {
    const x = px + 8, y = py + 8 + index * 18;
    const id = player.equipment && player.equipment[slot.id];
    uiButtons.push({ x, y, w:16, h:16, slot:{ kind:'armor', slotId:slot.id } });
    if (slotHover(x, y, 16)){
      paintSlotHover(x, y, 16);
      if (id) hoverCraftItem = { id, count:1 };
    }
    if (id) drawItemIcon(ctx, id, x, y, 16);
  });

  drawInventoryPlayerPreview(px + 26, py + 8, 50, 64);

  // 2×2 合成
  drawInventoryCraftGrid(px + 98, py + 18);

  // 背包 3×9 + 快捷栏
  const bag = drawBagSlots(px + 8, py + 84, 3, 9, 18);
  drawHotbarRow(px + 8, py + 142, 18);

  // 分页按钮
  if (bag.pages > 1){
    const pagerX = px + pw - 58, pagerY = py + 6;
    uiButton(pagerX, pagerY, 12, 9, '‹', { kind:'stone', size:7 });
    uiButtons.push({ x:pagerX, y:pagerY, w:12, h:9, fn:() => { inventoryPage = Math.max(0, inventoryPage - 1); } });
    uiButton(pagerX + 30, pagerY, 12, 9, '›', { kind:'stone', size:7 });
    uiButtons.push({ x:pagerX + 30, y:pagerY, w:12, h:9, fn:() => { inventoryPage = Math.min(bag.pages - 1, inventoryPage + 1); } });
    txt((inventoryPage + 1) + '/' + bag.pages, pagerX + 21, pagerY + 1,
      { size:6, bold:true, color:'#404040', align:'center' });
  }

  // 垃圾桶（窗口右侧）
  const trashX = px + pw + 10, trashY = py + ph - 28;
  txt('丢弃', trashX + 9, trashY - 10, { size:6, bold:true, color:'#e7e7e7', align:'center' });
  uiButtons.push({ x:trashX, y:trashY, w:18, h:18, slot:{ kind:'trash' } });
  uiSlot(trashX, trashY, 18, {});
  // 简易垃圾桶图标
  R(trashX + 4, trashY + 5, 10, 2, '#6b6b6b');
  R(trashX + 5, trashY + 8, 8, 7, '#6b6b6b');
  R(trashX + 7, trashY + 10, 1, 4, '#3f3f3f');
  R(trashX + 10, trashY + 10, 1, 4, '#3f3f3f');
  if (slotHover(trashX, trashY, 18)) paintSlotHover(trashX, trashY, 18);

  // 底部提示
  R(px, py + ph + 4, pw, 11, 'rgba(0,0,0,0.62)');
  txt('左键拿起整组 · 右键拿一半 · C 合成台 · T 科技', px + pw / 2, py + ph + 6,
    { size:6, bold:true, color:'#e7e7e7', align:'center' });

  // 手中的物品
  drawHeldStack();
}

/* 背包里的角色预览（MC 原版会在这里显示玩家模型） */
function drawInventoryPlayerPreview(x, y, w, h){
  const livePlayer = player;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  try{
    ctx.translate(x + w / 2, y + h - 4);
    ctx.scale(1.45, 1.45);
    player = { ...livePlayer, x:0, y:0, swing:0, walkPhase:0, invuln:0, attackAngle:0 };
    drawPlayer(0, 0);
  }catch(error){
    /* 预览失败不影响背包使用 */
  }finally{
    player = livePlayer;
    ctx.restore();
  }
}

/* ── 通用：鼠标上拿着的物品 ─────────────────── */
function drawHeldStack(){
  if (!craftHeld) return;
  const x = Math.round(mouse.x - 8), y = Math.round(mouse.y - 8);
  ctx.globalAlpha = 0.92;
  drawItemIcon(ctx, craftHeld.id, x, y, 16);
  if (craftHeld.count > 1){
    countText(craftHeld.count, x + 15, y + 15);
  }
  ctx.globalAlpha = 1;
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
  R(bx, by, bw, 18, 'rgba(0,0,0,0.72)');
  R(bx, by, bw, 1, 'rgba(255,255,255,0.22)');
  ctx.globalAlpha = a;
  txt(toast.text, W/2, by + 3, { size:9, bold:true, color: toast.color, align:'center' });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

/* ══════════════════════════════════════════════════════════
   HUD：底部操作提示
   ══════════════════════════════════════════════════════════ */
function drawHints(){
  if (panel) return;
  const fp = !!(window.Pixel3D && typeof Pixel3D.firstPerson === 'function' && Pixel3D.firstPerson());
  const is3D = !!(window.Pixel3D && Pixel3D.active());
  const hint = is3D
    ? localizeGameText(fp
      ? 'WASD移动 · 鼠标转视角 · 空格跳跃 · 左键攻击 · 右键使用 · F5第三人称 · ESC暂停'
      : 'WASD移动/Shift冲刺 · 点击后鼠标转视角 · 中键拖动 · 空格跳跃 · 左键攻击 · F5第一人称 · M地图')
    : localizeGameText('WASD移动/Shift冲刺 · 左键攻击 · 右键使用 · E背包 · C合成 · F5第一人称 · M地图');
  ctx.font = 'bold 6px '+UI_FONT;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillText(hint, W/2+1, H - 64);
  ctx.fillStyle = 'rgba(235,235,235,0.9)';
  ctx.fillText(hint, W/2, H - 65);
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
  R(x,sy,width,12,'rgba(0,0,0,0.82)');
  R(x,sy,width,1,'rgba(255,255,255,0.25)');
  txt(nearby.text,x+width/2,sy+3,{size:6,bold:true,color:'#fff0bd',align:'center'});
}
