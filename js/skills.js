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
/* ══════════════════════════════════════════════════════════
   自定义技能效果：给会写 JS 的同事用
     registerSkillEffect('myEffect', { name:'我的效果', cast(ctx){ … } })
   ctx = { skill, angle, damage, player, enemies, particles, hit }
   ══════════════════════════════════════════════════════════ */
const CUSTOM_SKILL_EFFECTS = Object.create(null);
function registerSkillEffect(id, definition){
  if (typeof id !== 'string' || !/^[a-z][a-z0-9_]{1,31}$/i.test(id))
    throw new Error('技能效果 ID 需以字母开头，只能包含字母/数字/下划线');
  if (!definition || typeof definition.name !== 'string' || typeof definition.cast !== 'function')
    throw new Error('技能效果需要 name（字符串）和 cast（函数）');
  const entry = { id, name:definition.name, cast:definition.cast };
  CUSTOM_SKILL_EFFECTS[id] = entry;
  if (typeof SKILL_EFFECTS !== 'undefined' && !SKILL_EFFECTS.some(effect => effect.id === id))
    SKILL_EFFECTS.push({ id, name:definition.name });
  return entry;
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
  const sp=skill.effectParams||{};
  const dmgMul=Number(sp.damageMul)>0?Number(sp.damageMul):(effect==='spin'?1.6:effect==='nova'?3:2.2);
  const damage=Math.round(player.damage*dmgMul*(1+G.growth.ranks.mastery*.12));
  player.stamina-=skill.cost;
  G.skills[id]=skill.cd*(1-G.growth.ranks.mastery*.06);
  const customEffect = CUSTOM_SKILL_EFFECTS[effect];
  if (customEffect){
    try{
      customEffect.cast({
        skill, angle, damage, player, enemies,
        particles: (x, y, color, count) => spawnParticles(x, y, color, count || 4),
        hit: (enemy, index) => skillDamageEnemy(enemy, index, damage, angle),
      });
    }catch(error){
      console.error('[技能] 自定义效果执行失败：' + effect, error);
      showToast('技能效果出错：' + error.message, '#ff9090');
    }
    return true;
  }
  if(effect==='dash'||effect==='nova'){ specialSkill(effect,angle,damage); }
  else if(effect==='ward'){
    G.wardTime=Number(sp.duration)>0?Number(sp.duration):4; player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.1);
    spawnParticles(player.x,player.y-10,'#89d9ff',16);
  }else if(effect==='orbit'){
    const radius=Number(sp.reach)>0?Math.max(24,Number(sp.reach)*0.35):46;
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2+angle;
      spawnParticles(player.x+Math.cos(a)*radius, player.y-10+Math.sin(a)*radius, '#9fd0ff', 2);
    }
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i], dist=Math.hypot(e.x-player.x, e.y-9-(player.y-10));
      if(dist<=radius+e.r+12) skillDamageEnemy(e,i,damage,Math.atan2(e.y-9-(player.y-10),e.x-player.x));
    }
  }else if(effect==='chain'){
    const targets=enemies.map((e,index)=>({e,index,d:Math.hypot(e.x-player.x,e.y-player.y)}))
      .filter(t=>t.d<240).sort((a,b)=>a.d-b.d).slice(0,3);
    for(const t of targets) spawnParticles(t.e.x,t.e.y-9,'#c9a4ff',7);
    for(let k=targets.length-1;k>=0;k--){
      const idx=enemies.indexOf(targets[k].e);
      if(idx>=0) skillDamageEnemy(targets[k].e,idx,Math.round(damage*0.7),angle);
    }
    if(!targets.length) showToast('范围内没有可以连锁的目标','#ffc080');
  }else if(effect==='heal'){
    const amount=Math.round(player.maxHp*.25);
    player.hp=Math.min(player.maxHp,player.hp+amount);
    for(let i=0;i<14;i++) spawnParticles(player.x+(Math.random()-.5)*18,player.y-10+(Math.random()-.5)*18,'#a8ffb0',1);
    showToast('治疗 +'+amount+' 生命','#a8ffb0');
  }else{
    player.swing=ATTACK_ANIM_DURATION;player.attackAngle=angle;player.combo=3;
    player.atkCd=Math.max(player.atkCd,.3); player.comboWindow=0;
    const reach=Number(sp.reach)>0?Number(sp.reach):(effect==='spin'?player.range+40:160+G.growth.ranks.reach*3);
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
/* 技能快捷键：Z X V B（显示在技能格里，避免玩家不知道按什么） */
const SKILL_KEYS = ['Z', 'X', 'V', 'G'];

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
    txt(SKILL_KEYS[i],x+2,y+2,{size:6,bold:true,color:ready?'#f2e6a8':'#a89878'});
    txt(String(i+1),x+size-3,y+2,{size:5,bold:true,color:'#8a8a8a',align:'right'});
    txt(skill?skill.name.slice(0,4):'＋',x+size/2,y+12,{size:6,bold:true,color:ready?'#d8f3c8':'#c9bb9c',align:'center'});
    if(skill&&cd>0)txt(Math.ceil(cd)+'s',x+size/2,y+21,{size:5,color:'#c8ddf5',align:'center'});
    if(!panel)uiButtons.push({x,y,w:size,h:size,fn:()=>skill?castSkill(id):(panel='skills')});
  }
  if(!panel)uiButtons.push({x:startX,y:startY-11,w:size*2+gap,h:9,fn:()=>{panel='skills';clearInput();}});
  R(startX,startY-11,size*2+gap,9,'rgba(18,19,17,0.85)');
  txt('技能 '+SKILL_KEYS.join('/')+' · 技能树 N · XP '+(G.skillXP||0),startX+size+gap/2,startY-9,{size:5,bold:true,color:'#e6d49d',align:'center'});
}
function unlockSkill(id){
  const skill=SKILLS.find(entry=>entry.id===id);
  if(!skill||G.unlockedSkills.includes(id))return;
  if(G.growth.level<skill.level){showToast('需要角色等级 Lv.'+skill.level,'#ffc080');return;}
  if(!skill.requires.every(required=>G.unlockedSkills.includes(required))){showToast('先解锁前置技能','#ffc080');return;}
  if(G.skillXP<skill.xpCost){showToast('技能经验不足：需要 '+skill.xpCost+' XP','#ffc080');return;}
  // 跨阶段材料：还需要电路板之类的零件
  for(const [itemId,need] of Object.entries(skill.itemCost||{})){
    if((inv[itemId]||0)<need){showToast('还需要 '+(ITEMS[itemId]||{name:itemId}).name+' ×'+need,'#ffc080');return;}
  }
  G.skillXP-=skill.xpCost;
  for(const [itemId,need] of Object.entries(skill.itemCost||{}))takeItem(itemId,need);
  G.unlockedSkills.push(id);
  const empty=G.skillSlots.indexOf(null);if(empty>=0)G.skillSlots[empty]=id;
  showToast('已解锁 '+skill.name,'#b9e9ff');saveGame();
}
function equipSkill(id,slot){
  if(!G.unlockedSkills.includes(id)||!Number.isInteger(slot)||slot<0||slot>=4)return;
  G.skillSlots=G.skillSlots.map((current,index)=>index===slot?id:current===id?null:current);
}
function drawSkillTreePanel(){
  drawMcBackdrop(0.66);
  uiPanel(46,18,388,234,{title:'技能树 · 消耗战斗获得的技能经验解锁',accent:PAL.xp});
  txt('技能经验 '+G.skillXP+' XP  ·  解锁需要经验 + 电路板  ·  装备后按 '+SKILL_KEYS.join('/')+' 释放',58,39,{size:6,bold:true,color:'#555555'});
  const pageCount=Math.max(1,Math.ceil(SKILLS.length/6));
  skillTreePage=clamp(skillTreePage,0,pageCount-1);
  if(pageCount>1){
    txt((skillTreePage+1)+'/'+pageCount,392,39,{size:6,bold:true,color:'#555555',align:'center'});
    uiButton(374,36,12,11,'‹',{kind:'stone',size:7});
    uiButtons.push({x:374,y:36,w:12,h:11,fn:()=>{skillTreePage=Math.max(0,skillTreePage-1);}});
    uiButton(398,36,12,11,'›',{kind:'stone',size:7});
    uiButtons.push({x:398,y:36,w:12,h:11,fn:()=>{skillTreePage=Math.min(pageCount-1,skillTreePage+1);}});
  }
  const slotX=58,slotY=52;
  for(let i=0;i<4;i++){
    const x=slotX+i*42,id=G.skillSlots[i],skill=SKILLS.find(entry=>entry.id===id),selected=(G.skillLoadoutSlot||0)===i;
    uiButton(x,slotY,38,19,(i+1)+' '+(skill?skill.name:'空'),{kind:selected?'green':'stone',size:5});
    uiButtons.push({x,y:slotY,w:38,h:19,fn:()=>{G.skillLoadoutSlot=i;drawSkillTreePanel();}});
  }
  SKILLS.slice(skillTreePage*6,skillTreePage*6+6).forEach((skill,index)=>{
    const col=index%2,row=Math.floor(index/2),x=58+col*184,y=80+row*51;
    const unlocked=G.unlockedSkills.includes(skill.id);
    uiPanel(x,y,174,44,{fill:unlocked?'#c4d6a6':'#b9b9b9'});
    txt(skill.name+' · Lv.'+skill.level+' · '+skill.xpCost+' XP',x+6,y+5,{size:6,bold:true,color:unlocked?'#2f4d1d':'#3f3f3f'});
    ctx.save();
    ctx.beginPath();
    ctx.rect(x+5, y+14, 116, 10);
    ctx.clip();
    txt(skill.desc,x+6,y+16,{size:5,color:'#555555'});
    ctx.restore();
    const action=unlocked?'装备':'解锁';
    uiButton(x+124,y+26,46,14,action,{kind:unlocked?'green':'gold',size:6});
    uiButtons.push({x:x+124,y:y+26,w:46,h:14,fn:()=>{
      if(unlocked){equipSkill(skill.id,G.skillLoadoutSlot||0);drawSkillTreePanel();}
      else unlockSkill(skill.id);
    }});
  });
  txt('N / Esc 关闭',W-62,H-15,{size:6,bold:true,color:'#e7e7e7'});
}
