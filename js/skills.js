'use strict';


/* 主动技能与战斗表现 */
let skillTreePage=0;
function migrateCombat(s){
  if(s.version<4){s.G.skills={spin:0,wave:0,ward:0,dash:0,nova:0};s.G.wardTime=0;}
  if(s.G.skills)SKILLS.forEach(k=>{if(s.G.skills[k.id]===undefined)s.G.skills[k.id]=0;});
  if(!Number.isInteger(s.G.skillXP))s.G.skillXP=Math.max(0,(s.G.growth.level-1)*15);
  if(!Array.isArray(s.G.unlockedSkills))s.G.unlockedSkills=['spin'];
  if(!Array.isArray(s.G.skillSlots))s.G.skillSlots=['spin',null,null,null];
  if(!Number.isInteger(s.G.skillLoadoutSlot))s.G.skillLoadoutSlot=0;
  if(s.G.unlockedSkills.some(id=>!SKILLS.some(skill=>skill.id===id))||
     s.G.skillSlots.some(id=>id!==null&&!SKILLS.some(skill=>skill.id===id))||
     s.G.skillLoadoutSlot<0||s.G.skillLoadoutSlot>=4)
    throw new Error('技能经验、快捷槽或解锁数据无效');
  s.G.unlockedSkills=[...new Set(s.G.unlockedSkills.filter(id=>SKILLS.some(skill=>skill.id===id)))];
  if(!s.G.unlockedSkills.includes('spin'))s.G.unlockedSkills.unshift('spin');
  s.G.skillSlots=Array.from({length:4},(_,index)=>{
    const id=s.G.skillSlots[index];
    return s.G.unlockedSkills.includes(id)?id:null;
  });
  if(!s.G.skills || SKILLS.some(k=>!Number.isFinite(s.G.skills[k.id]) || s.G.skills[k.id]<0 || s.G.skills[k.id]>k.cd) ||
     !Number.isFinite(s.G.wardTime) || s.G.wardTime<0 || s.G.wardTime>4 ||
     !Number.isInteger(s.G.skillXP)||s.G.skillXP<0) throw new Error('技能冷却或经验数据无效');
  // 中断挥砍表现，避免把一次攻击在读取后再次结算。
  s.player.swing=0;s.player.combo=0;s.player.comboWindow=0;s.player.attackAngle=Math.atan2(s.player.aimY,s.player.aimX);
}
function updateCombat(dt){
  player.comboWindow=Math.max(0,player.comboWindow-dt);
  for(const skill of SKILLS) G.skills[skill.id]=Math.max(0,G.skills[skill.id]-dt);
  G.wardTime=Math.max(0,G.wardTime-dt);
  for(const fx of combatFx) fx.life-=dt;
  combatFx=combatFx.filter(fx=>fx.life>0);
}
function skillDamageEnemy(e,index,damage,angle){
  e.hp-=damage;e.hitFlash=.22;
  if(G.mapId){e.x=clamp(e.x+Math.cos(angle)*9,8,WORLD_W-8);e.y=clamp(e.y+Math.sin(angle)*9,8,WORLD_H-8);}
  else{e.x=clamp(e.x+Math.cos(angle)*9,-1e9,1e9);e.y=clamp(e.y+Math.sin(angle)*9,-1e9,1e9);}
  spawnText(e.x,e.y-24,'-'+damage,'#9aeaff');
  spawnParticles(e.x,e.y-10,'#a4ecff',7);
  if(e.hp<=0)killEnemy(e,index);
}
function castSkill(id){
  if(panel || G.gameOver) return false;
  const skill=SKILLS.find(k=>k.id===id);
  if(!skill)return false;
  if(!G.unlockedSkills.includes(id)){showToast('技能尚未解锁 · 按 N 打开技能树','#ffc080');return false;}
  if(G.growth.level<skill.level){showToast(skill.name+'需要 Lv.'+skill.level,'#ffc080');return false;}
  if(G.skills[id]>0){showToast(skill.name+'冷却 '+Math.ceil(G.skills[id])+'秒','#ffc080');return false;}
  if(player.stamina<skill.cost){showToast('体力不足：需要'+skill.cost,'#ffc080');return false;}
  const angle=Math.atan2(player.aimY,player.aimX);
  const effect=skill.effect||id;
  const damage=Math.round(player.damage*(effect==='spin'?1.6:effect==='nova'?3:2.2)*(1+G.growth.ranks.mastery*.12));
  player.stamina-=skill.cost;
  G.skills[id]=skill.cd*(1-G.growth.ranks.mastery*.06);
  if(effect==='dash'||effect==='nova'){ specialSkill(effect,angle,damage); }
  else if(effect==='ward'){
    G.wardTime=4; player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.1);
    spawnParticles(player.x,player.y-10,'#89d9ff',16);
  }else{
    player.swing=ATTACK_ANIM_DURATION;player.attackAngle=angle;player.combo=3;
    player.atkCd=Math.max(player.atkCd,.3); player.comboWindow=0;
    const reach=effect==='spin'?player.range+40:160+G.growth.ranks.reach*3;
    combatFx.push({id:effect,x:player.x,y:player.y-10,angle,reach,life:.35,max:.35});
    // 剑气瞬间贯穿直线上的敌人，特效展示同一命中区域。
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i],dx=e.x-player.x,dy=e.y-9-(player.y-10);
      const along=dx*Math.cos(angle)+dy*Math.sin(angle);
      const side=Math.abs(-dx*Math.sin(angle)+dy*Math.cos(angle));
      const hit=effect==='spin'?Math.hypot(dx,dy)<=reach+e.r:along>=0 && along<=reach+e.r && side<=15+e.r;
      if(hit)skillDamageEnemy(e,i,damage,effect==='spin'?Math.atan2(dy,dx):angle);
    }
    harvestArea((x,y,r)=>{
      const dx=x-player.x,dy=y-(player.y-10);
      if(effect==='spin') return Math.hypot(dx,dy)<=reach+r;
      const along=dx*Math.cos(angle)+dy*Math.sin(angle),side=Math.abs(-dx*Math.sin(angle)+dy*Math.cos(angle));
      return along>=0&&along<=reach+r&&side<=18+r;
    }, effect==='spin'?2:3);
    shake=Math.max(shake,4);
  }
  showToast(skill.name+'！','#b9e9ff');return true;
}
function harvestArea(test, amt, seen){
  const mp = player.miningPower || 0;
  for (const [list,type] of [[trees,'wood'],[rocks,'stone'],[bushes,'fiber']]){
    for (let i=list.length-1;i>=0;i--){
      const o=list[i];
      if (seen && seen.has(o)) continue;
      const cy=o.y-(type==='wood'?10:type==='stone'?7:5);
      if (!test(o.x,cy,o.r)) continue;
      if (type==='stone' && o.ore && mp<1) continue;
      if (seen) seen.add(o);
      o.hp -= type==='stone' ? amt*Math.max(1,mp) : amt;
      o.shake = 0.15;
      spawnParticles(o.x,cy,o.ore?ITEMS[o.ore].color:type==='wood'?'#8a5a30':type==='stone'?'#9a9aa6':'#6a9a40',5);
      if (o.hp<=0){
        if (type==='wood'){
          const n=rndi(2,4); for(let k=0;k<n;k++) dropPickup(o.x,o.y-6,'wood');
          if (Math.random()<0.35) dropPickup(o.x,o.y-6,'fiber');
        } else if (type==='stone' && o.ore){
          const c=o.ore==='crystal'?1:rndi(2,4);
          for(let k=0;k<c;k++) dropPickup(o.x,o.y-4,o.ore);
          dropPickup(o.x,o.y-4,'stone');
        } else if (type==='stone'){
          const n=rndi(2,3); for(let k=0;k<n;k++) dropPickup(o.x,o.y-4,'stone');
        } else {
          const n=rndi(1,2); for(let k=0;k<n;k++) dropPickup(o.x,o.y-4,'fiber');
          if (Math.random()<0.75) dropPickup(o.x,o.y-4,'berry');
        }
        list.splice(i,1);
      }
    }
  }
}
function specialSkill(id,angle,damage){
  const hitSet=new Set(), dashSeen=new Set();
  if(id==='dash'){
    player.invuln=Math.max(player.invuln,.5);
    for(let i=0;i<12;i++){
      const nx=G.mapId?clamp(player.x+Math.cos(angle)*8,8,WORLD_W-8):player.x+Math.cos(angle)*8;
      const ny=G.mapId?clamp(player.y+Math.sin(angle)*8,8,WORLD_H-8):player.y+Math.sin(angle)*8;
      if(blockedByPlacedBlock(nx,ny,5)) break;
      player.x=nx; player.y=ny;
      harvestArea((x,y,r)=>Math.hypot(x-player.x,y-(player.y-8))<20+r,1,dashSeen);
      for(let j=enemies.length-1;j>=0;j--){
        const e=enemies[j];
        if(!hitSet.has(e) && Math.hypot(e.x-player.x,e.y-player.y)<20+e.r){hitSet.add(e);skillDamageEnemy(e,j,Math.round(damage*.55),angle);}
      }
    }
    spawnParticles(player.x,player.y-8,'#bfe8ff',14);
  } else {
    combatFx.push({id:'spin',x:player.x,y:player.y-10,angle:0,reach:130,life:.45,max:.45});
    for(let j=enemies.length-1;j>=0;j--){
      const e=enemies[j],dx=e.x-player.x,dy=e.y-player.y;
      if(Math.hypot(dx,dy)<=130+e.r) skillDamageEnemy(e,j,Math.round(damage*1.36),Math.atan2(dy,dx));
    }
    harvestArea((x,y,r)=>Math.hypot(x-player.x,y-(player.y-10))<=130+r,4);
    shake=Math.max(shake,8);
    spawnParticles(player.x,player.y-6,'#ffd9a0',22);
  }
}
function drawCombatFx(){
  for(const b of playerBullets){const pos=worldToScreen(b.x,b.y);R(pos.x-1,pos.y-1,3,2,'#ffe7a0');}
  for(const fx of combatFx){
    const t=1-fx.life/fx.max,alpha=(1-t)*.85;
    if(fx.id==='muzzle'){
      const pos=worldToScreen(fx.x,fx.y);R(pos.x-2,pos.y-2,5,5,'#fff4bf');
      continue;
    }
    if(fx.id==='spin'){
      for(let i=0;i<70;i++){
        const a=i/70*Math.PI*2+t*3;
        const rad=fx.reach*(.85+.15*t);
        const pos=worldToScreen(fx.x+Math.cos(a)*rad,fx.y+Math.sin(a)*rad);
        R(pos.x,pos.y,3,3,'rgba(150,226,255,'+alpha+')');
      }
    }else{
      for(let d=0;d<fx.reach;d+=3){
        const side=Math.sin(d*.18-t*6)*5;
        const pos=worldToScreen(fx.x+Math.cos(fx.angle)*d-Math.sin(fx.angle)*side,
          fx.y+Math.sin(fx.angle)*d+Math.cos(fx.angle)*side);
        R(pos.x,pos.y,4,4,'rgba(163,239,255,'+alpha+')');
      }
    }
  }
  if(G.wardTime>0){
    for(let i=0;i<24;i++){
      const a=i/24*Math.PI*2+G.time;
      const pos=worldToScreen(player.x+Math.cos(a)*15,player.y+Math.sin(a)*18);
      R(pos.x,pos.y-12,2,3,'#95daff');
    }
  }
}
function drawSkillHud(){
  if(G.gameOver) return;
  const size=31,gap=3,startX=W-size*2-gap-7,startY=H-size*2-gap-38;
  for(let i=0;i<4;i++){
    const x=startX+(i%2)*(size+gap),y=startY+Math.floor(i/2)*(size+gap);
    const id=G.skillSlots[i],skill=SKILLS.find(entry=>entry.id===id),cd=skill?(G.skills[id]||0):0;
    const ready=!!skill&&G.unlockedSkills.includes(id)&&cd<=0&&player.stamina>=skill.cost;
    R(x,y,size,size,ready?'rgba(58,86,54,0.94)':'rgba(18,19,17,0.9)');
    R(x,y,size,1,ready?PAL.leafLight:'rgba(216,188,138,0.42)');
    R(x,y+size-1,size,1,'rgba(0,0,0,0.55)');
    if(cd>0)R(x,y+size-3,size*clamp(cd/(skill.cd*(1-G.growth.ranks.mastery*.06)),0,1),2,'#6a95c4');
    txt(String(i+1),x+2,y+2,{size:5,bold:true,color:'#dac58e'});
    txt(skill?skill.name.slice(0,4):'＋',x+size/2,y+12,{size:6,bold:true,color:ready?'#d8f3c8':'#c9bb9c',align:'center'});
    if(skill&&cd>0)txt(Math.ceil(cd)+'s',x+size/2,y+21,{size:5,color:'#c8ddf5',align:'center'});
    if(!panel)uiButtons.push({x,y,w:size,h:size,fn:()=>skill?castSkill(id):(panel='skills')});
  }
  if(!panel)uiButtons.push({x:startX,y:startY-11,w:size*2+gap,h:9,fn:()=>{panel='skills';clearInput();}});
  R(startX,startY-11,size*2+gap,9,'rgba(18,19,17,0.85)');
  txt('技能树 N · XP '+(G.skillXP||0),startX+size+gap/2,startY-9,{size:5,bold:true,color:'#e6d49d',align:'center'});
}
function unlockSkill(id){
  const skill=SKILLS.find(entry=>entry.id===id);
  if(!skill||G.unlockedSkills.includes(id))return;
  if(G.growth.level<skill.level){showToast('需要角色等级 Lv.'+skill.level,'#ffc080');return;}
  if(!skill.requires.every(required=>G.unlockedSkills.includes(required))){showToast('先解锁前置技能','#ffc080');return;}
  if(G.skillXP<skill.xpCost){showToast('技能经验不足：需要 '+skill.xpCost+' XP','#ffc080');return;}
  G.skillXP-=skill.xpCost;G.unlockedSkills.push(id);
  const empty=G.skillSlots.indexOf(null);if(empty>=0)G.skillSlots[empty]=id;
  showToast('已解锁 '+skill.name,'#b9e9ff');saveGame();
}
function equipSkill(id,slot){
  if(!G.unlockedSkills.includes(id)||!Number.isInteger(slot)||slot<0||slot>=4)return;
  G.skillSlots=G.skillSlots.map((current,index)=>index===slot?id:current===id?null:current);
}
function drawSkillTreePanel(){
  ctx.fillStyle='rgba(12,18,16,0.88)';ctx.fillRect(0,0,W,H);
  uiPanel(46,18,388,234,{title:'技能树 · 消耗战斗获得的技能经验解锁',accent:PAL.xp});
  txt('技能经验 '+G.skillXP+' XP  ·  选择下方槽位，再点击已解锁技能装备',58,39,{size:6,bold:true,color:'#5d513d'});
  const pageCount=Math.max(1,Math.ceil(SKILLS.length/6));
  skillTreePage=clamp(skillTreePage,0,pageCount-1);
  if(pageCount>1){
    txt((skillTreePage+1)+'/'+pageCount,392,39,{size:5,color:'#cdddc4',align:'center'});
    uiButtons.push({x:378,y:36,w:12,h:12,fn:()=>{skillTreePage=Math.max(0,skillTreePage-1);}});
    uiButtons.push({x:398,y:36,w:12,h:12,fn:()=>{skillTreePage=Math.min(pageCount-1,skillTreePage+1);}});
    txt('‹',384,38,{size:7,bold:true,color:'#493b2b',align:'center'});
    txt('›',404,38,{size:7,bold:true,color:'#493b2b',align:'center'});
  }
  const slotX=58,slotY=52;
  for(let i=0;i<4;i++){
    const x=slotX+i*42,id=G.skillSlots[i],skill=SKILLS.find(entry=>entry.id===id),selected=(G.skillLoadoutSlot||0)===i;
    uiPanel(x,slotY,38,19,{fill:selected?'#c9d99e':'#d9c89f',woodMid:selected?PAL.leaf:PAL.wood});
    txt((i+1)+': '+(skill?skill.name:'空'),x+3,slotY+6,{size:5,bold:true,color:'#493b2b'});
    uiButtons.push({x,y:slotY,w:38,h:19,fn:()=>{G.skillLoadoutSlot=i;drawSkillTreePanel();}});
  }
  SKILLS.slice(skillTreePage*6,skillTreePage*6+6).forEach((skill,index)=>{
    const col=index%2,row=Math.floor(index/2),x=58+col*184,y=80+row*51;
    const unlocked=G.unlockedSkills.includes(skill.id);
    uiPanel(x,y,174,44,{fill:unlocked?'#dce4c3':'#d8c9a7',woodMid:unlocked?PAL.leaf:PAL.wood});
    txt(skill.name+' · Lv.'+skill.level+' · '+skill.xpCost+' XP',x+6,y+5,{size:6,bold:true,color:'#443827'});
    txt(skill.desc,x+6,y+16,{size:5,color:'#5d513d'});
    const action=unlocked?'装备':'解锁';
    uiPanel(x+126,y+27,42,13,{fill:unlocked?'#c9ddae':'#e3ce94',woodMid:unlocked?PAL.leaf:PAL.wood});
    txt(action,x+147,y+31,{size:5,bold:true,color:unlocked?'#36704a':'#6a5732',align:'center'});
    uiButtons.push({x:x+126,y:y+27,w:42,h:13,fn:()=>{
      if(unlocked){equipSkill(skill.id,G.skillLoadoutSlot||0);drawSkillTreePanel();}
      else unlockSkill(skill.id);
    }});
  });
  txt('N / Esc 关闭',W-62,H-15,{size:5,color:'#c8b997'});
}
