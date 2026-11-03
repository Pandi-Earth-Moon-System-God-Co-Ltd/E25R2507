'use strict';


/* 药剂、经验与永久成长 */
function newGrowth(){
  return {level:1,xp:0,points:0,ranks:Object.fromEntries(GROWTH.map(b=>[b.id,0]))};
}
function xpNeeded(level){ return 25+(level-1)*15; }
function migrateGrowth(s){
  if(s.version===2){
    s.G.growth=newGrowth(); s.G.effects={regen:0,power:0,haste:0}; s.G.medicineCd=0;
    return;
  }
  if(s.version===3){ s.G.growth.ranks.reach=0; s.G.growth.ranks.mastery=0; }
  const g=s.G.growth, e=s.G.effects;
  if(!g || !g.ranks || !e || !Number.isInteger(g.level) || g.level<1 ||
     !Number.isInteger(g.xp) || g.xp<0 || g.xp>=xpNeeded(g.level) ||
     !Number.isInteger(g.points) || g.points<0 ||
     GROWTH.some(b=>!Number.isInteger(g.ranks[b.id]) || g.ranks[b.id]<0 || g.ranks[b.id]>b.cap) ||
     !['regen','power','haste'].every(k=>Number.isFinite(e[k]) && e[k]>=0 && e[k]<=45) ||
     !Number.isFinite(s.G.medicineCd) || s.G.medicineCd<0 || s.G.medicineCd>1) throw new Error('Invalid growth');
}
function gainExperience(amount){
  const g=G.growth;
  g.xp+=amount;
  G.skillXP=(G.skillXP||0)+amount;
  let levels=0;
  while(g.xp>=xpNeeded(g.level)){
    g.xp-=xpNeeded(g.level); g.level++; g.points++; levels++;
  }
  if(levels) showToast('升级至 Lv.'+g.level+'！按 B 选择成长增益；技能经验 +'+amount+' XP', '#e7c0ff');
}
function upgradeGrowth(index){
  if(G.gameOver) return;
  const b=GROWTH[index],g=G.growth;
  if(!b || g.points<1 || g.ranks[b.id]>=b.cap){ showToast('需要成长点或已达到上限', '#ffc080'); return; }
  g.points--; g.ranks[b.id]++; recalcEquipment();
  if(b.id==='vitality') player.hp=Math.min(player.maxHp,player.hp+15);
  if(b.id==='endurance') player.stamina=Math.min(player.maxStamina,player.stamina+10);
  showToast(b.name+'提升至 '+g.ranks[b.id]+' 级', '#a5efb2');
  clearInput(); saveGame();
}
function useHealing(){
  if(G.gameOver || panel) return;
  if(player.hp>=player.maxHp){showToast('生命已满', '#a8e0ff'); return;}
  const missing=player.maxHp-player.hp;
  const available=['bandage','smallPotion','largePotion'].filter(id=>inv[id]>0);
  available.sort((a,b)=>ITEMS[a].heal-ITEMS[b].heal);
  const id=available.find(id=>ITEMS[id].heal>=missing)||available[available.length-1];
  if(id) useFood(id);
  else if(inv.regenPotion>0 && !G.effects.regen) useFood('regenPotion');
  else showToast('没有可用回血道具：按 C 合成', '#ff9090');
}
function updateEffects(dt){
  const e=G.effects;
  const healing=Math.min(dt,e.regen)*3;
  const passive=player.hunger>20 ? G.growth.ranks.regeneration*0.15*dt : 0;
  player.hp=Math.min(player.maxHp,player.hp+healing+passive);
  let expired=false;
  for(const id of ['regen','power','haste']){
    if(e[id]>0){e[id]=Math.max(0,e[id]-dt); if(!e[id]) expired=true;}
  }
  G.medicineCd=Math.max(0,G.medicineCd-dt);
  if(expired) recalcEquipment();
}
function drawGrowthHud(){
  const g=G.growth, x=7,y=96;
  R(x,y,133,32,'rgba(8,18,18,0.78)');
  ctx.font='bold 7px '+UI_FONT; ctx.fillStyle=g.points?'#f3d28b':'#c5b4e9';ctx.textAlign='left';
  ctx.fillText(localizeGameText('Lv.'+g.level+'  经验 '+g.xp+'/'+xpNeeded(g.level)+'  B 成长'),x+4,y+4);
  R(x+4,y+14,125,3,'#302b41');R(x+4,y+14,125*g.xp/xpNeeded(g.level),3,'#b68ce8');
  ctx.font='6px '+UI_FONT;ctx.fillStyle='#b6c6bf';
  ctx.fillText(localizeGameText('成长点 '+g.points+' · H 回血 · 药水 '+(inv.smallPotion||0)+'/'+(inv.largePotion||0)),x+4,y+21);
  if(!panel && !G.gameOver) uiButtons.push({x,y,w:133,h:32,fn:()=>{clearInput();panel='growth';}});
  const labels={regen:'再生',power:'力量',haste:'疾行'};
  let y2=132;
  for(const id of Object.keys(labels)) if(G.effects[id]>0){
    R(7,y2,79,11,'rgba(15,25,30,0.85)');ctx.fillStyle=id==='regen'?'#8eefa9':id==='power'?'#ffc287':'#92d4ff';
    ctx.fillText(localizeGameText(labels[id]+' '+Math.ceil(G.effects[id])+'秒'),11,y2+2);y2+=13;
  }
}
function drawGrowthPanel(){
  ctx.fillStyle='rgba(18,11,6,0.85)'; ctx.fillRect(0,0,W,H);
  uiPanel(46, 25, 388, 220, { title:'成长与增益  Lv.'+G.growth.level, accent:PAL.xp });
  txt('经验 '+G.growth.xp+'/'+xpNeeded(G.growth.level)+'   可用成长点 '+G.growth.points+'   B / Esc 关闭', 58, 52, { size:7, bold:true, color:'#8a6a3a' });
  GROWTH.forEach((b, i)=>{
    const x=58+(i%2)*184, y=68+Math.floor(i/2)*33;
    const rank=G.growth.ranks[b.id], enabled=G.growth.points>0 && rank<b.cap;
    uiPanel(x, y, 176, 29, { fill: enabled?PAL.cream:PAL.paper, woodMid: enabled?PAL.leaf:PAL.wood });
    txt((i+1)+'. '+b.name+'  '+rank+'/'+b.cap, x+8, y+5, { size:8, bold:true, color: enabled?'#3c6630':'#6b5b42' });
    txt(b.desc, x+8, y+18, { size:6, bold:true, color:'#7a6a4e' });
    uiButtons.push({x, y, w:176, h:29, fn:() => upgradeGrowth(i)});
  });
  txt('当前攻击 '+player.damage+' · 距离 '+player.range+' · 成长按 1–8 或点击', 58, 206, { size:7, bold:true, color:'#7a6a4e' });
  txt('成长永久保留至本局结束；药剂同类不叠加，暂停停止计时', 58, 218, { size:7, bold:true, color:'#7a6a4e' });
  uiClose(384, 34, () => { clearInput(); panel=null; });
}
