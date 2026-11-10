'use strict';

/* ══════════════════════════════════════════════════════════
   精灵绘制
   ══════════════════════════════════════════════════════════ */
function drawTree(t, x, y){
  const s = t.shake > 0 ? Math.sin(G.time * 30) * t.shake * 4 : 0;
  const sway = Math.sin(t.sway + G.time * 0.8) * 0.45;
  x = Math.round(x + s + sway); y = Math.round(y);
  R(x-9, y-3, 18, 4, 'rgba(0,0,0,0.28)');
  R(x-3, y-15, 6, 15, '#49301e');
  R(x-2, y-15, 2, 14, '#89613a');
  R(x+2, y-13, 1, 10, '#634326');
  R(x-11, y-23, 22, 12, '#183d2d');
  R(x-10, y-27, 20, 13, '#24583a');
  R(x-8, y-30, 16, 10, '#327447');
  R(x-5, y-32, 10, 7, '#438b51');
  R(x-3, y-31, 5, 3, '#65a961');
  R(x-10, y-22, 5, 3, '#438451');
  R(x+5, y-24, 4, 3, '#3c7b49');
  R(x-7, y-17, 4, 2, '#4d9354');
  R(x+2, y-19, 3, 2, '#72b563');
  R(x-12, y-20, 2, 4, '#244b34');
  R(x+10, y-21, 2, 4, '#1d4732');
}

function drawRock(r, x, y){
  x = Math.round(x); y = Math.round(y);
  R(x-9, y-3, 18, 4, 'rgba(0,0,0,0.22)');
  const c1 = r.ore ? ITEMS[r.ore].color : '#82828e';
  const c2 = r.ore ? ITEMS[r.ore].color2 : '#5c5c68';
  R(x-7, y-11, 14, 11, c2);
  R(x-6, y-14, 12, 5, r.ore ? c1 : '#6e6e7a');
  R(x-4, y-16, 8, 4, c1);
  R(x-3, y-16, 4, 2, r.ore ? '#ffe0a0' : '#b4b5c0');
  R(x-5, y-13, 3, 2, r.ore ? '#f0a060' : '#9697a2');
  R(x+2, y-11, 3, 2, r.ore ? c1 : '#70717d');
  R(x-5, y-5, 2, 2, r.ore ? c1 : '#666773');
  R(x-7, y-6, 14, 2, r.ore ? c2 : '#4a4a55');
  R(x-5, y-9, 2, 3, r.ore ? c1 : '#8a8a96');
  if (r.ore === 'copperOre'){
    R(x+2, y-12, 2, 3, '#f0b070');
    R(x-4, y-7, 3, 2, '#c86b3d');
  } else if (r.ore === 'crystal'){
    R(x+1, y-13, 2, 4, '#a0fff0');
    R(x-4, y-8, 2, 3, '#72d9d0');
  } else if (r.ore === 'ironOre'){
    R(x+2, y-12, 3, 3, '#e1e4e6');
    R(x-4, y-8, 3, 2, '#8b9298');
    R(x+1, y-5, 3, 2, '#c7cbd0');
  }
}

function drawPlacedBlock(block, x, y, wirePositions){
  const item = ITEMS[block.type];
  const left = Math.round(x - TILE/2), top = Math.round(y - TILE/2);
  if(block.type==='powerWire'){
    const directions=[[1,0],[-1,0],[0,1],[0,-1]];
    for(const [dx,dy] of directions){
      if(!wirePositions.has((block.x+dx*TILE)+','+(block.y+dy*TILE)))continue;
      if(dx)R(x+(dx>0?0:-8),y-2,8,4,'#c28b53');
      else R(x-2,y+(dy>0?0:-8),4,8,'#c28b53');
    }
    R(x-4,y-4,8,8,'#554738');R(x-2,y-2,4,4,'#e1b06d');
    return;
  }
  if(block.type==='ecoGarden'){
    R(left+1,top+7,TILE-2,7,'#705a3d');
    R(left+2,top+5,TILE-4,5,'#4e8d55');
    R(left+3,top+3,3,5,'#9bcb66');
    R(left+7,top+1,3,7,'#70a956');
    R(left+11,top+4,3,5,'#b3d773');
    R(left+7,top+3,2,2,'#e1e9a1');
    return;
  }
  if(block.type==='worldGate'){
    R(left+2,top+5,3,10,'#665b8e');
    R(left+11,top+5,3,10,'#665b8e');
    R(left+3,top+3,10,3,'#9f91ce');
    R(left+5,top+6,6,8,'rgba(190,166,255,0.68)');
    R(left+7,top+7,2,2,'#fff0c8');
    return;
  }
  if(typeof drawCustomTexture==='function'&&drawCustomTexture(ctx,block.type,left,top,TILE))return;
  R(left+1, top+1, TILE-2, TILE-2, item.color2);
  R(left+2, top+2, TILE-4, 3, item.color);
  R(left+2, top+5, 2, TILE-7, item.color);
  R(left+4, top+5, TILE-6, TILE-7, item.color2);
  R(left+5, top+6, TILE-8, 1, item.color);
  R(left+2, top+TILE-3, TILE-4, 1, 'rgba(0,0,0,0.35)');
}
function drawMachine(machine,x,y){
  const left=Math.round(x-8),top=Math.round(y-8);
  const type=MACHINE_TYPES[machine.type];
  if(typeof drawCustomTexture==='function'&&drawCustomTexture(ctx,type.blockItem,left,top,TILE))return;
  if(type.itemRouter){
    R(left+1,top+2,14,12,'#394b50');R(left+3,top+4,10,8,'#728c90');
    const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][machine.dir||0];
    if(dx>0){R(left+7,top+6,5,4,'#e1cf9c');R(left+10,top+4,2,2,'#e1cf9c');R(left+10,top+10,2,2,'#e1cf9c');}
    else if(dx<0){R(left+4,top+6,5,4,'#e1cf9c');R(left+4,top+4,2,2,'#e1cf9c');R(left+4,top+10,2,2,'#e1cf9c');}
    else if(dy>0){R(left+6,top+7,4,5,'#e1cf9c');R(left+4,top+10,2,2,'#e1cf9c');R(left+10,top+10,2,2,'#e1cf9c');}
    else{R(left+6,top+4,4,5,'#e1cf9c');R(left+4,top+4,2,2,'#e1cf9c');R(left+10,top+4,2,2,'#e1cf9c');}
  }else if(type.harvester){
    R(left+1,top+5,14,8,'#3b5439');R(left+2,top+3,12,7,'#73955b');
    R(left+4,top+4,2,5,'#d0c978');R(left+8,top+4,2,5,'#d0c978');R(left+12,top+4,2,5,'#d0c978');
    R(left+3,top+12,3,2,'#303a2d');R(left+11,top+12,3,2,'#303a2d');
  }else if(machine.type==='crusher'){
    R(left+1,top+2,14,12,'#3d474a');R(left+2,top+1,12,9,'#798187');
    R(left+4,top+4,8,2,'#c4cbd0');R(left+5,top+7,6,2,'#59636a');
    R(left+4,top+11,8,2,'#343c40');R(left+7,top+4,2,5,'#e1b06d');
  }else if(type.generator==='solar'){
    R(left,top+3,16,10,'#344d58');R(left+1,top+4,14,7,'#6e9a9d');
    for(let i=0;i<3;i++)R(left+2+i*4,top+5,1,5,'#405f68');
    R(left+2,top+12,12,2,'#777c72');R(left+7,top+1,2,3,'#d7c68c');
  }else if(type.generator==='fuel'){
    R(left+1,top+3,14,10,'#353b36');R(left+2,top+2,12,8,'#777c72');
    R(left+5,top+5,6,5,machine.fuel>0&&machine.power<type.capacity?'#e17b38':'#474c45');
    R(left+4,top,3,3,'#514f47');R(left+10,top+1,4,2,'#a4a08d');
    R(left+2,top+12,3,2,'#252b28');R(left+11,top+12,3,2,'#252b28');
  }else{
  R(left+1,top+2,14,12,'#42382f');R(left+2,top+1,12,10,'#8a6042');
  R(left+3,top+3,10,6,'#a9784d');R(left+5,top+4,6,4,machine.activeRecipe===null?'#514239':'#e17b38');
  R(left+2,top+10,3,3,'#554235');R(left+11,top+10,3,3,'#554235');
  R(left+5,top+12,6,1,'#c9a477');
  if(machine.activeRecipe!==null && Math.sin(G.time*10)>0)R(left+7,top+2,2,2,'#ffd77b');
  }
}
function drawBelt(belt,x,y){
  R(x-8,y-6,16,12,'#454a40');R(x-7,y-5,14,10,'#777a61');
  R(x-6,y-4,2,8,'#353a34');R(x+4,y-4,2,8,'#353a34');
  const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][belt.dir];
  R(x-dx*3-1,y-dy*3-1,3,3,'#d7c68c');
  R(x+dx*2-1,y+dy*2-1,3,3,'#d7c68c');
  if(dx)R(x+dx*5-1,y-1,2,2,'#efe5b5');
  else R(x-1,y+dy*5-1,2,2,'#efe5b5');
}
function drawRuin(ruin,x,y){
  R(x-11,y-4,22,10,ruin.opened?'#393a36':'#675d49');
  R(x-9,y-9,18,6,ruin.opened?'#47443a':'#82704f');
  R(x-7,y-12,14,4,ruin.opened?'#3e403a':'#a48b5d');
  R(x-5,y-2,3,5,'#282d2a');R(x+3,y-2,3,5,'#282d2a');
  if(!ruin.opened){R(x-2,y-5,4,3,'#e1bd73');R(x-1,y-5,2,4,'#433a2b');}
}
function drawBush(b, x, y){
  x = Math.round(x); y = Math.round(y);
  R(x-7, y-2, 14, 3, 'rgba(0,0,0,0.2)');
  R(x-6, y-8, 12, 6, '#2a5f2a');
  R(x-5, y-10, 10, 4, '#357a35');
  R(x-3, y-11, 6, 3, '#42914a');
  R(x-4, y-9, 3, 2, '#62a957');
  R(x+1, y-7, 3, 2, '#397849');
  R(x-7, y-6, 2, 2, '#347146');
  if (b.berries){
    R(x-4, y-8, 2, 2, '#d03050');
    R(x+1, y-9, 2, 2, '#d03050');
    R(x+2, y-5, 2, 2, '#e04060');
    R(x-2, y-5, 2, 2, '#e04060');
  }
}

function drawAnimal(animal,x,y){
  const scale=animal.age<1?0.65:1;
  const gait=animal.walking?Math.sin(animal.wobble||0):0;
  const bob=animal.walking?Math.abs(gait)*0.3:Math.sin(animal.wobble||0)*0.15;
  const facing=projectedFacingAngle(animal.facing||animal.direction||0);
  const facingX=Math.round(Math.cos(facing)),facingY=Math.round(Math.sin(facing));
  const [headX,headY]=[
    [5,-11],[4,-9],[0,-8],[-4,-9],[-6,-11],[-4,-14],[0,-15],[4,-14],
  ][projectedFacingOctant(animal.facing||animal.direction||0)];
  ctx.save();
  ctx.translate(Math.round(x),Math.round(y+bob));
  ctx.scale(scale,scale);
  R(-8,1,16,3,'rgba(0,0,0,0.22)');
  const legOffsetX=Math.round(gait*facingX),legOffsetY=Math.round(gait*facingY);
  if(animal.type==='chicken'){
    R(-5,-10,10,9,'#e5dfc9');R(-4,-11,7,3,'#fff8e4');
    R(headX-2,headY,5,5,'#f1e7cf');R(headX+2,headY+2,3,2,'#d7a958');
    R(headX-1,headY,2,2,'#bf5b51');
    if(facingY>=0)R(headX+1,headY+2,1,1,'#302c29');
    R(-4+legOffsetX,-2+legOffsetY,2,4,'#c28b50');
    R(2-legOffsetX,-2-legOffsetY,2,4,'#c28b50');
  }else if(animal.type==='sheep'){
    R(-8,-11,16,10,'#eee8d8');R(-6,-14,12,5,'#fff9eb');
    R(headX-2,headY,6,6,'#a78e82');
    if(facingY>=0)R(headX+2,headY+2,2,2,'#322c2c');
    R(-5+legOffsetX,-2+legOffsetY,2,4,'#615348');
    R(3-legOffsetX,-2-legOffsetY,2,4,'#615348');
  }else{
    R(-8,-10,15,9,'#9b6157');R(-7,-12,12,4,'#bb7b69');
    R(headX-2,headY,6,6,'#86534c');R(headX+2,headY+2,4,3,'#62433d');
    if(facingY>=0)R(headX+1,headY+1,2,2,'#342b29');
    R(-5+legOffsetX,-2+legOffsetY,2,4,'#59403a');
    R(3-legOffsetX,-2-legOffsetY,2,4,'#59403a');
  }
  if(animal.love>0){
    const pulse=Math.sin(G.time*8)>0?1:0;
    R(3,-20-pulse,3,3,'#ef8195');R(6,-18-pulse,2,2,'#ef8195');
    R(4,-17-pulse,4,3,'#ef8195');R(5,-14-pulse,2,2,'#ef8195');
  }
  if(animal.tamed){
    R(-4,-5,8,2,'#e5b84f');
    R(2,-4,3,3,animal.mode==='stay'?'#d78355':'#f3db83');
  }
  ctx.restore();
}

function projectedFacingOctant(worldAngle){
  return ((Math.round(projectedDirectionAngle(worldAngle)/(Math.PI/4))%8)+8)%8;
}

function projectedDirectionAngle(worldAngle){
  const dx=Math.cos(worldAngle),dy=Math.sin(worldAngle);
  return Math.atan2((dx+dy)*ISO_Y,(dx-dy)*ISO_X);
}

function projectedFacingAngle(worldAngle){
  return projectedFacingOctant(worldAngle)*(Math.PI/4);
}

function drawPickup(p, x, y){
  const bob = Math.sin(p.t * 6) * 1.5;
  x = Math.round(x + (p.swing>0?Math.cos(p.attackAngle)*recoil*3:0));
  y = Math.round(y + bob + (p.swing>0?Math.sin(p.attackAngle)*recoil*2:0));
  R(x-2, y+2, 5, 2, 'rgba(0,0,0,0.25)');
  const it = ITEMS[p.type];
  if (it.icon === 'copper' || it.icon === 'crystal' || it.icon === 'pickaxe' || it.icon === 'block' || it.icon === 'rock'){
    drawItemIcon(ctx, p.type, x-6, y-8, 12);
    return;
  }
  const c1 = it.color, c2 = it.color2;
  if (p.type === 'wood'){
    R(x-4, y-4, 8, 4, c2); R(x-4, y-4, 8, 1, c1);
  } else if (p.type === 'stone'){
    R(x-4, y-4, 7, 5, c2); R(x-3, y-5, 5, 2, c1);
  } else if (p.type === 'fiber'){
    R(x-3, y-5, 2, 6, c2); R(x-1, y-6, 2, 7, c1); R(x+2, y-5, 2, 6, c2);
  } else if (p.type === 'berry'){
    R(x-3, y-4, 6, 5, c2); R(x-2, y-5, 4, 2, c1);
  } else {
    R(x-4, y-4, 8, 5, c2); R(x-3, y-5, 6, 2, c1); R(x-2, y-3, 2, 2, '#f0a0a0');
  }
}

function drawZombie(e, x, y){
  x = Math.round(x); y = Math.round(y);
  const sway = Math.sin(e.wobble) * (e.fast ? 2.2 : 1.5);
  const flash = e.hitFlash > 0;
  const isKnight = e.type === 'bloodKnight';
  const isWarden=e.type==='caveWarden';
  const bodyColor = isWarden?'#67583d':isKnight ? '#693447' : e.type === 'spitter' ? '#526c48'
    : e.type === 'brute' ? '#4a5340' : '#4a6b3a';
  const headColor = isWarden?'#b59a62':isKnight ? '#bb5065' : e.type === 'spitter' ? '#91a85d'
    : e.type === 'brute' ? '#68704c' : '#7aa85a';

  R(x-(isKnight || isWarden || e.type === 'brute' ? 8 : 6), y-1, isKnight || isWarden || e.type === 'brute' ? 16 : 12, 3, 'rgba(0,0,0,0.25)');

  if (e.fast){
    // 快速僵尸：瘦小，暗绿
    R(x-3, y-5, 2, 5, '#22331f');
    R(x+1, y-5, 2, 5, '#22331f');
    R(x-4, y-12, 8, 7, flash ? '#d06060' : '#3d5a2f');
    R(x-6, y-12+sway, 2, 5, flash ? '#d08080' : '#5a7a3a');
    R(x+4, y-12-sway, 2, 5, flash ? '#d08080' : '#5a7a3a');
    R(x-3, y-18, 6, 6, flash ? '#e09090' : '#6a9450');
    R(x-3, y-19, 6, 2, '#2a3a1f');
    R(x-2, y-16, 2, 1, '#ff2020');
    R(x+1, y-16, 2, 1, '#ff2020');
  } else {
    R(x-4, y-5, 3, 5, '#2b3a2b');
    R(x+1, y-5, 3, 5, '#2b3a2b');
    const body = flash ? '#d08080' : bodyColor;
    const head = flash ? '#e09090' : headColor;
    R(x-5, y-12, 10, 7, body);
    R(x-5, y-12, 10, 1, flash ? '#f0a0a0' : '#79905b');
    R(x-8, y-12+sway, 3, 6, flash ? '#d08080' : '#6b8a4a');
    R(x+5, y-12-sway, 3, 6, flash ? '#d08080' : '#6b8a4a');
    R(x-4, y-19, 8, 7, head);
    R(x-4, y-20, 8, 2, isKnight ? '#5d263d' : isWarden?'#51452e':'#3a4a2a');
    R(x-3, y-17, 2, 2, '#d02020');
    R(x+1, y-17, 2, 2, '#d02020');
    R(x-1, y-14, 3, 1, '#2a3a2a');
    if (e.type === 'brute'){
      R(x-8, y-15, 5, 6, flash ? '#db9090' : '#697158');
      R(x+3, y-15, 5, 6, flash ? '#db9090' : '#697158');
      R(x-6, y-7, 12, 2, '#33392f');
    } else if (e.type === 'spitter'){
      R(x-2, y-12, 4, 2, '#b7d875');
      R(x+4, y-11, 3, 3, '#d0e681');
      R(x+6, y-10, 2, 2, '#a9e77a');
    } else if (isKnight){
      R(x-6, y-13, 3, 7, '#c15b70');
      R(x+3, y-13, 3, 7, '#c15b70');
      R(x-5, y-20, 2, 4, '#e8b866');
      R(x+3, y-20, 2, 4, '#e8b866');
      R(x-2, y-22, 4, 3, '#f08091');
    }else if(isWarden){
      R(x-7,y-14,4,7,flash?'#db9090':'#958052');
      R(x+3,y-14,4,7,flash?'#db9090':'#958052');
      R(x-5,y-23,2,4,'#e1bd73');R(x+3,y-23,2,4,'#e1bd73');
      R(x-2,y-17,4,2,'#f1d78f');
    }
  }

  // 血条（受伤时）
  if (e.hp < e.maxHp || isKnight || isWarden){
    const bw = isKnight||isWarden ? 20 : 14, bx = x - bw/2, by = y - (e.fast ? 24 : 26);
    R(bx-1, by-1, bw+2, 4, 'rgba(0,0,0,0.75)');
    R(bx, by, bw, 2, '#401818');
    R(bx, by, bw * clamp(e.hp/e.maxHp,0,1), 2, isKnight ? '#fa688a' : isWarden?'#d7b86d':'#e04040');
  }
  // 白天燃烧
  if (e.burn > 0.2 && Math.random() < 0.6){
    R(x + rnd(-5,5), y - rnd(8,22), 1, 2, Math.random()<0.5 ? '#f0a030' : '#f0d040');
  }
}

function drawPlayer(x, y){
  const p = player;
  const appearance=p.appearance||DEFAULT_PLAYER_APPEARANCE;
  const skin=PLAYER_CUSTOMIZATION.skin[appearance.skin]||PLAYER_CUSTOMIZATION.skin[0];
  const hair=PLAYER_CUSTOMIZATION.hairColor[appearance.hairColor]||PLAYER_CUSTOMIZATION.hairColor[0];
  const outfit=PLAYER_CUSTOMIZATION.outfit[appearance.outfit]||PLAYER_CUSTOMIZATION.outfit[0];
  const eyes=PLAYER_CUSTOMIZATION.eyes[appearance.eyes]||PLAYER_CUSTOMIZATION.eyes[0];
  const gait = playerMoveBlend();
  const moving = gait > 0.01;
  const stride = Math.sin(p.walkPhase * 2.5) * gait;
  const idleBreath = Math.sin(G.time * 3) * 0.45 * (1 - gait);
  const bob = Math.abs(stride) * 0.7 + idleBreath;
  const legSwing = stride * 2;
  const attackT = p.swing > 0 ? 1 - p.swing / ATTACK_ANIM_DURATION : -1;
  const recoil = attackT >= 0 ? Math.sin(Math.min(1, attackT) * Math.PI) : 0;
  const bodyAngle=projectedFacingAngle(p.facingAngle||0);
  const direction=projectedFacingOctant(p.facingAngle||0);
  const bareAttackSide=p.swing>0&&!p.toolId&&!p.weapon
    ?(Math.cos(projectedDirectionAngle(p.attackAngle))>=0?1:-1):0;
  const faceX=Math.round(Math.cos(bodyAngle)),faceY=Math.round(Math.sin(bodyAngle));
  const legOffsetX=stride*2*faceX,legOffsetY=stride*1.5*faceY;

  x = Math.round(x + (p.swing>0?Math.cos(p.attackAngle)*recoil*3:0));
  y = Math.round(y + bob + (p.swing>0?Math.sin(p.attackAngle)*recoil*2:0));

  if (p.invuln > 0 && Math.floor(p.invuln * 24) % 2 === 0){
    ctx.globalAlpha = 0.45;
  }

  R(x-8 - recoil, y-1, 16 + recoil * 2, 3, 'rgba(0,0,0,0.32)');
  if(typeof drawCustomPlayerSprite==='function'&&drawCustomPlayerSprite(ctx,x,y)){
    drawHeldItem(x,y,gait,stride,attackT,0);
    ctx.globalAlpha=1;
    return;
  }

  // Boots and moving legs
  R(x-5 + legOffsetX, y-7 + legOffsetY, 4, 5, outfit.shadow);
  R(x+1 - legOffsetX, y-7 - legOffsetY, 4, 5, outfit.shadow);
  R(x-6 + legOffsetX, y-3 + legOffsetY, 5, 2, '#171d26');
  R(x+1 - legOffsetX, y-3 - legOffsetY, 5, 2, '#171d26');
  R(x-4 + legOffsetX, y-7 + legOffsetY, 2, 3, outfit.trim);
  R(x+2 - legOffsetX, y-7 - legOffsetY, 2, 3, outfit.trim);

  const backFacing=direction>=5;
  const packSide=direction===0||direction===1||direction===7?-1:1;
  const packX=backFacing?x-3:x+packSide*7;
  const drawBackAccessory=()=>{
    if(appearance.back===0){
      R(packX,y-18,6,10,'#59402a');
      R(packX,y-18,6,2,'#8a6840');
      R(packX+1,y-14,4,1,'#c49a58');
      R(packX+2,y-11,2,1,'#c49a58');
    }else if(appearance.back===2){
      R(packX-1,y-18,8,10,'#694354');
      R(packX,y-15,6,6,'#a86668');
    }
  };
  if(!backFacing)drawBackAccessory();

  // Coat and shoulders
  R(x-7, y-17, 14, 10, outfit.base);
  R(x-6, y-18, 12, 2, outfit.light);
  R(x-6, y-9, 12, 2, outfit.shadow);
  R(x-2, y-17, 4, 8, outfit.trim);
  if(appearance.outfitStyle===1){
    R(x-6,y-16,3,7,outfit.light);R(x+3,y-16,3,7,outfit.light);
    R(x-3,y-16,6,6,'#d7c6a0');R(x-2,y-14,4,3,'#59645c');
    R(x-1,y-17,2,7,outfit.trim);
  }else if(appearance.outfitStyle===2){
    R(x-7,y-8,3,3,outfit.base);R(x+4,y-8,3,3,outfit.base);
    R(x-6,y-8,2,2,outfit.light);R(x+4,y-8,2,2,outfit.light);
    R(x-6,y-11,12,2,'#765334');R(x-1,y-11,2,2,'#d6b66e');
    R(x-5,y-16,1,1,'#e6d5aa');R(x+4,y-16,1,1,'#e6d5aa');
    R(x-5,y-13,1,1,'#e6d5aa');R(x+4,y-13,1,1,'#e6d5aa');
  }else{
    R(x-6, y-11, 12, 2, '#765334');
    R(x-1, y-11, 2, 2, '#d6b66e');
    R(x-5,y-16,2,1,'rgba(255,255,255,0.28)');
  }
  if(backFacing)drawBackAccessory();

  // Free arm swings opposite the legs; the weapon arm is animated around its shoulder.
  const armSwing = moving ? stride * 1.5 : 0;
  if(bareAttackSide!==-1){
    R(x-9, y-16 + armSwing, 3, 7, outfit.base);
    R(x-9, y-11 + armSwing, 3, 2, skin.shadow);
    R(x-9, y-9 + armSwing, 3, 2, skin.base);
  }

  // Head, hair and face
  R(x-5, y-27, 10, 10, skin.base);
  R(x-5, y-28, 10, 4, hair.color);
  R(x-6, y-25, 2, 5, hair.color);
  R(x+4, y-25, 2, 5, hair.color);
  R(x-4, y-27, 8, 2, hair.light);
  if(appearance.hairStyle===1){
    R(x-4,y-24,5,2,hair.color);R(x+1,y-25,4,2,hair.color);
  }else if(appearance.hairStyle===2){
    R(x-6,y-23,2,7,hair.color);R(x+4,y-23,2,7,hair.color);
    R(x-5,y-18,2,2,hair.light);
  }else if(appearance.hairStyle===3){
    R(x-3,y-30,6,3,hair.color);R(x-1,y-31,3,2,hair.light);
    R(x-5,y-24,3,2,hair.color);
  }
  const eyeShiftX=faceX,eyeShiftY=faceY<0?-1:faceY>0?1:0;
  if(direction!==5&&direction!==6&&direction!==7){
    R(x-3+eyeShiftX,y-22+eyeShiftY,2,2,eyes.color);
    R(x+2+eyeShiftX,y-22+eyeShiftY,2,2,eyes.color);
    R(x-3+eyeShiftX,y-22+eyeShiftY,1,1,eyes.shine);
    R(x+2+eyeShiftX,y-22+eyeShiftY,1,1,eyes.shine);
    R(x-1+eyeShiftX,y-19+eyeShiftY,3,1,skin.shadow);
  }else{
    R(x-5,y-23,10,3,hair.color);
    R(x-3,y-24,6,2,hair.light);
  }
  if(appearance.faceDetail===1){
    R(x-4+eyeShiftX,y-20+eyeShiftY,1,1,'#925d43');R(x-2+eyeShiftX,y-20+eyeShiftY,1,1,'#925d43');
    R(x+3+eyeShiftX,y-20+eyeShiftY,1,1,'#925d43');
  }else if(appearance.faceDetail===2){
    R(x+1,y-24,1,2,'#a94e4a');R(x+2,y-23,2,1,'#a94e4a');
  }else if(appearance.faceDetail===3){
    R(x-4+eyeShift,y-23,4,3,'rgba(176,216,218,0.4)');
    R(x+1+eyeShift,y-23,4,3,'rgba(176,216,218,0.4)');
    R(x-1+eyeShift,y-22,2,1,'#b7d8da');
    R(x-5+eyeShift,y-22,1,1,'#d2ece8');R(x+5+eyeShift,y-22,1,1,'#d2ece8');
  }

  if(appearance.hat===1){
    R(x-6,y-29,12,3,'#76513a');R(x-7,y-27,14,2,'#b88a55');
    R(x-2,y-30,4,2,'#d7b777');
  }else if(appearance.hat===2){
    R(x-7,y-27,2,8,outfit.shadow);R(x+5,y-27,2,8,outfit.shadow);
    R(x-6,y-29,12,3,outfit.base);R(x-4,y-30,8,2,outfit.light);
  }else if(appearance.hat===3){
    R(x-6,y-25,12,2,'#a33f4b');R(x-2,y-25,4,2,'#e27a69');
  }

  // Equipped armor overlays the coat without hiding the silhouette.
  if (p.armorId){
    const armor = ITEMS[p.armorId];
    R(x-7, y-17, 14, 7, armor.color2);
    R(x-6, y-17, 12, 2, armor.color);
    R(x-5, y-14, 10, 2, armor.color);
    R(x-8, y-16, 2, 5, armor.color2);
    R(x+6, y-16, 2, 5, armor.color2);
    R(x-2, y-16, 4, 6, armor.color2);
  }

  drawHeldItem(x, y, gait, stride, attackT,0);

  ctx.globalAlpha = 1;

  // 与成长范围一致的像素刀光；第二击反向，第三击重击。
  if (p.swing > 0 && !(p.weapon && ITEMS[p.weapon].firearm)){
    const t=clamp(attackT,0,1), direction=p.combo===2?-1:1;
    const head=p.attackAngle+direction*(-0.95+t*1.9);
    const radius=p.range+4;
    for(let j=0;j<14;j++){
      const a=head-direction*j*0.075;
      const alpha=(1-j/14)*Math.sin(t*Math.PI);
      for(let ring=0;ring<(p.combo===3?3:2);ring++){
        const rad=radius-ring*2;
        const pos=worldToScreen(p.x+Math.cos(a)*rad,p.y+Math.sin(a)*rad);
        R(pos.x-1,pos.y-11,3,3,'rgba('+(p.combo===3?'255,178,86,':'235,249,255,')+alpha+')');
      }
    }
  }

}

function getAttackSwingOffset(attackT, combo){
  let swingOffset;
  if(attackT<0.24){
    swingOffset=-1.05*(attackT/0.24);
  }else if(attackT<0.76){
    const t=(attackT-0.24)/0.52;
    const eased=t*t*(3-2*t);
    swingOffset=-1.05+eased*1.92;
  }else{
    const t=(attackT-0.76)/0.24;
    const eased=t*t*(3-2*t);
    swingOffset=0.87*(1-eased);
  }
  return combo===2?-swingOffset:swingOffset;
}

function drawHeldItem(x, y, gait, stride, attackT,bodyAngle=0){
  const p = player;
  const moving = gait > 0.01;
  const appearance=p.appearance||DEFAULT_PLAYER_APPEARANCE;
  const outfit=PLAYER_CUSTOMIZATION.outfit[appearance.outfit]||PLAYER_CUSTOMIZATION.outfit[0];
  const skin=PLAYER_CUSTOMIZATION.skin[appearance.skin]||PLAYER_CUSTOMIZATION.skin[0];
  const itemId = p.toolId || p.weapon;
  if (!itemId){
    if(attackT>=0){
      const attackAngle=projectedDirectionAngle(p.attackAngle)+getAttackSwingOffset(attackT,p.combo);
      const attackSide=Math.cos(projectedDirectionAngle(p.attackAngle))>=0?1:-1;
      ctx.save();
      ctx.translate(x+attackSide*5,y-15);
      ctx.rotate(attackAngle-Math.PI/2);
      ctx.fillStyle=outfit.base;
      ctx.fillRect(-2,0,4,6);
      ctx.fillStyle=skin.shadow;
      ctx.fillRect(-2,5,4,2);
      ctx.fillStyle=skin.base;
      ctx.fillRect(-2,7,4,3);
      ctx.restore();
      return;
    }
    const armSwing = moving ? -stride * 1.5 : 0;
    R(x+6, y-16 + armSwing, 3, 7, outfit.base);
    R(x+6, y-11 + armSwing, 3, 2, skin.shadow);
    R(x+6, y-9 + armSwing, 3, 2, skin.base);
    return;
  }

  const item = ITEMS[itemId];
  const aimWorldAngle=item.firearm?Math.atan2(p.aimY,p.aimX):
    p.swing>0?p.attackAngle:Math.atan2(p.aimY,p.aimX);
  const aimAngle=projectedDirectionAngle(aimWorldAngle)-bodyAngle;
  let swingOffset = stride * 0.12 + Math.sin(G.time * 2.4) * 0.035 * (1 - gait);
  if (attackT >= 0) swingOffset=getAttackSwingOffset(attackT,p.combo);
  if(item.firearm) swingOffset=0;
  const shoulderX = x + 5, shoulderY = y - 15;
  const rotation = aimAngle + Math.PI/2 + swingOffset;
  ctx.save();
  ctx.translate(shoulderX, shoulderY);
  ctx.rotate(rotation);
  ctx.fillStyle = '#315a70';
  ctx.fillRect(-2, 0, 4, 6);
  ctx.fillStyle = '#b4774e';
  ctx.fillRect(-2, 4, 4, 2);
  ctx.fillStyle = '#e8b987';
  ctx.fillRect(-2, 6, 4, 3);

  if(item.firearm){
    const recoil=p.atkCd>item.cd-.1?2:0;
    ctx.fillStyle=item.color2;ctx.fillRect(-3,1+recoil,6,7);
    ctx.fillStyle=item.color;ctx.fillRect(-2,-10+recoil,4,item.pellets>1?17:13);
    ctx.fillStyle='#18252b';ctx.fillRect(-1,-11+recoil,2,2);
    ctx.fillStyle='#e1d5b0';ctx.fillRect(-1,-5+recoil,1,5);
  }else if (p.toolId){
    ctx.fillStyle = item.color2;
    ctx.fillRect(-1,-10,2,24);
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.moveTo(-2,-10);
    ctx.lineTo(1,-12);
    ctx.lineTo(7,-10);
    ctx.lineTo(5,-8);
    ctx.lineTo(1,-9);
    ctx.lineTo(-1,-7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f2d29a';
    ctx.fillRect(2,-10,3,1);
  } else {
    ctx.fillStyle = item.color2;
    ctx.fillRect(-1, 5, 2, 5);
    ctx.fillStyle = item.color;
    ctx.fillRect(-2, -13, 4, 18);
    ctx.fillStyle = '#fff0c8';
    ctx.fillRect(-1, -12, 1, 15);
    ctx.fillStyle = item.color2;
    ctx.fillRect(-5, 3, 10, 2);
  }
  ctx.restore();
}
