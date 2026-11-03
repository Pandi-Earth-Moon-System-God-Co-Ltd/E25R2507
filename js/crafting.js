'use strict';

/* ══════════════════════════════════════════════════════════
   合成面板
   ══════════════════════════════════════════════════════════ */
function upgradeFarmTech(){
  const level=G.farmTech||0, tech=FARM_TECH[level];
  if(!tech){showToast('农业科技已满级','#a8efaa');return;}
  for(const id in tech.cost){if((inv[id]||0)<tech.cost[id]){showToast('农业研究材料不足：'+ITEMS[id].name+' '+(inv[id]||0)+'/'+tech.cost[id],'#ffb080');return;}}
  for(const id in tech.cost)takeItem(id,tech.cost[id]);
  G.farmTech=level+1;showToast('农业研究完成：'+tech.name,'#a8efaa');spawnParticles(player.x,player.y-12,'#9acb70',10);
}

function drawTechPanel(){
  ctx.fillStyle='rgba(18,11,6,0.8)'; ctx.fillRect(0,0,W,H);
  const pw=408, ph=218, px=(W-pw)/2, py=(H-ph)/2;
  uiPanel(px-3, py-3, pw+6, ph+6, {});
  uiPanel(px, py, pw, ph, { title:'科技研究' });
  txt('T / ESC 关闭', px+pw-12, py+11, { size:7, bold:true, color:'#e8dcc0', align:'right' });
  txt('当前：'+TECH_LEVELS[G.tech].name+'　击杀 '+G.kills+'　存活第 '+G.day+' 天', px+12, py+27, { size:7, bold:true, color:'#7a6a4e' });
  const pageCount=Math.max(1,Math.ceil((TECH_LEVELS.length-1)/2));
  techPage=clamp(techPage,0,pageCount-1);
  for (let level=1+techPage*2; level<Math.min(TECH_LEVELS.length,3+techPage*2); level++){
    const tech=TECH_LEVELS[level];
    const cardX=px+12+(level-1)*194, cardY=py+41, cardW=184, cardH=132;
    const unlocked=G.tech>=level;
    const requirement=technologyRequirement(level);
    uiPanel(cardX, cardY, cardW, cardH, { fill: unlocked?'#efe6c4':PAL.paper, woodMid: unlocked?PAL.leaf:PAL.wood });
    txt(tech.name, cardX+12, cardY+10, { size:8, bold:true, color: unlocked?'#3c6630':'#8a6a2f' });
    txt('解锁：'+tech.unlock, cardX+10, cardY+32, { size:6, bold:true, color:'#6b5b42' });
    txt('生存到第 '+tech.day+' 天　'+(G.day>=tech.day?'✓':'未达成'), cardX+10, cardY+47, { size:6, bold:true, color: G.day>=tech.day?'#3c6630':'#b0563c' });
    txt('击败怪物 '+tech.kills+' 只　'+(G.kills>=tech.kills?'✓':'当前 '+G.kills), cardX+10, cardY+61, { size:6, bold:true, color: G.kills>=tech.kills?'#3c6630':'#b0563c' });
    let materialY=cardY+78;
    for (const id in tech.cost){
      const enough=unlocked||(inv[id]||0)>=tech.cost[id];
      drawItemIcon(ctx, id, cardX+9, materialY-2, 12);
      txt(ITEMS[id].name+'  '+(inv[id]||0)+'/'+tech.cost[id], cardX+26, materialY, { size:6, bold:true, color: enough?'#3c6630':'#b0563c' });
      materialY+=15;
    }
    const btnX=cardX+9, btnY=cardY+cardH-26, btnW=cardW-18;
    const label=unlocked?'已解锁':requirement.available?'研究进阶':'条件未满足';
    uiButton(btnX, btnY, btnW, 18, label, { kind: unlocked?'wood':requirement.available?'green':'wood', disabled: unlocked });
    if(!unlocked){
      uiButtons.push({ x:btnX, y:btnY, w:btnW, h:18, fn:upgradeTechnology });
    }
  }
  txt('科技页 '+(techPage+1)+'/'+pageCount+' · ←/→翻页', px+pw-12, py+27, { size:6, bold:true, color:'#7a6a4e', align:'right' });
  const farmY=py+ph-29, farmX=px+12, farmW=pw-24;
  const farmLv=G.farmTech||0, farmNext=FARM_TECH[farmLv];
  uiPanel(farmX, farmY, farmW, 14, { fill:PAL.paper, woodMid:PAL.wood });
  txt('农业科技 '+farmLv+'/'+FARM_TECH.length+' · '+(farmNext?farmNext.name+'：'+farmNext.desc:'已满级'), farmX+5, farmY+4, { size:6, bold:true, color:'#5b4a32' });
  if(farmNext){ const fx=farmX+farmW-65; uiButton(fx, farmY+1, 61, 12, '研究农业', { kind:'green' }); uiButtons.push({x:fx, y:farmY+1, w:61, h:12, fn:upgradeFarmTech}); }
  txt(G.bloodMoon ? '血月怪物更强、数量更多；击败血月骑士可获得血月核心' : '每逢第 7 天夜晚触发血月，血月骑士会掉落稀有核心', W/2, py+ph-10, { size:6, bold:true, color: G.bloodMoon?'#b0563c':'#7a6a4e', align:'center' });
}

function drawCraftPanel(){
  ctx.fillStyle='rgba(18,11,6,0.74)'; ctx.fillRect(0,0,W,H);
  const PW=384, PH=214;
  const px=(W-PW)/2, py=(H-PH)/2;
  uiPanel(px-3, py-3, PW+6, PH+6, {});
  uiPanel(px, py, PW, PH, { title:'物品合成' });
  txt('TAB关闭  滚轮/↑↓选择  ENTER制作', px+PW-10, py+10, { size:7, bold:true, color:'#e8dcc0', align:'right' });
  R(px+8, py+22, PW-16, 1, PAL.creamShade);

  const listX=px+8, listY=py+27, listW=168, itemH=13;
  const visibleRecipes=12;
  const maxStart=Math.max(0, RECIPES.length-visibleRecipes);
  const firstRecipe=clamp(selectedRecipe-visibleRecipes+1, 0, maxStart);

  for (let row=0; row<visibleRecipes && firstRecipe+row<RECIPES.length; row++){
    const i=firstRecipe+row;
    const rec=RECIPES[i];
    const it=ITEMS[rec.out];
    const iy=listY+row*(itemH+1);
    const sel=i===selectedRecipe;
    let canMake=G.tech>=rec.tier;
    for (const k in rec.need){
      if ((inv[k]||0)<rec.need[k]){ canMake=false; break; }
    }
    R(listX, iy, listW, itemH, sel?'#c9b078':'#e3d4ac');
    if(sel) R(listX, iy, 2, itemH, PAL.gold);
    drawItemIcon(ctx, rec.out, listX+3, iy+1, 12);
    txt(it.name, listX+21, iy+2, { size:7, bold:true, color: G.tech<rec.tier?'#9a8a6a':canMake?(sel?'#3c2b1a':'#5b4a32'):'#a09a8a' });
    R(listX+listW-7, iy+5, 3, 3, G.tech<rec.tier?'#d2a653':canMake?'#4a7a36':'#a09a8a');
    uiButtons.push({ x:listX, y:iy, w:listW, h:itemH, fn:() => { selectedRecipe=i; } });
  }

  const dx=px+186, dy=py+28, dw=PW-194, dh=PH-40;
  uiPanel(dx, dy, dw, dh, { fill:PAL.paper, woodMid:PAL.wood });
  const rec=RECIPES[selectedRecipe];
  const it=ITEMS[rec.out];
  uiSlot(dx+12, dy+12, 32, {});
  drawItemIcon(ctx, rec.out, dx+16, dy+16, 24);
  txt(it.name, dx+53, dy+12, { size:10, bold:true, color:'#3c2b1a' });
  setFont(7, true);
  let descLine='', descRow=0;
  for(const ch of it.desc){
    if(ctx.measureText(descLine+ch).width>dw-65 && descLine){
      txt(descLine, dx+53, dy+26+descRow*9, { size:7, bold:true, color:'#8a7a5a' }); descRow++; descLine='';
    }
    descLine+=ch;
  }
  txt(descLine, dx+53, dy+26+descRow*9, { size:7, bold:true, color:'#8a7a5a' });

  txt('所需材料', dx+12, dy+54, { size:7, bold:true, color:'#5b4a32' });
  let allOk=true;
  const tierUnlocked=G.tech>=rec.tier;
  if(!tierUnlocked) allOk=false;
  const ingredients=Object.entries(rec.need);
  const columnWidth=(dw-24)/2;
  for(let index=0;index<ingredients.length;index++){
    const [k,need]=ingredients[index];
    const column=index%2,row=Math.floor(index/2);
    const x=dx+12+column*columnWidth,y=dy+66+row*12;
    const have=inv[k]||0, ok=have>=need;
    if(!ok) allOk=false;
    drawItemIcon(ctx, k, x, y, 10);
    const countText=have+'/'+need;
    txt(ITEMS[k].name, x+12, y+1, { size:6, bold:true, color: ok?'#3c6630':'#b0563c' });
    txt(countText, x+columnWidth-2, y+1, { size:6, bold:true, color: ok?'#3c6630':'#b0563c', align:'right' });
  }
  if(!tierUnlocked){
    txt('需要 '+TECH_LEVELS[rec.tier].name+' · 按 T 研究', dx+12, dy+54, { size:6, bold:true, color:'#b0563c', align:'right' });
  }

  const btnW=dw-24, btnH=20;
  const btnX=dx+12, btnY=dy+dh-btnH-10;
  const alreadyOwn=(it.kind==='weapon'||it.kind==='armor'||it.kind==='tool')&&(inv[rec.out]||0)>0;
  const enabled=allOk&&!alreadyOwn&&tierUnlocked;
  uiButton(btnX, btnY, btnW, btnH, alreadyOwn?'已 拥 有':!tierUnlocked?'科技未解锁':(allOk?'点 击 制 作':'材 料 不 足'), { kind: enabled?'green':'wood', disabled: !enabled });
  if(enabled){
    uiButtons.push({ x:btnX, y:btnY, w:btnW, h:btnH, fn:() => craftRecipe(selectedRecipe) });
  }
  for (const b of uiButtons){
    if (mouse.x>=b.x && mouse.x<=b.x+b.w && mouse.y>=b.y && mouse.y<=b.y+b.h){
      if (b.w===listW){ R(b.x, b.y, b.w, b.h, 'rgba(255,255,255,0.06)'); }
    }
  }
}
