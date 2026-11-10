'use strict';

/* ══════════════════════════════════════════════════════════
   物品图标
   - 优先使用 2233 材质包里的《我的世界》物品贴图
   - 自定义（Game Studio）贴图优先级最高
   - 材质包 / 自定义贴图都没有时退回程序化 16x16 图标
   ══════════════════════════════════════════════════════════ */
function drawItemIcon(c, id, x, y, size){
  const it = ITEMS[id];
  if (!it) return;
  if(typeof drawCustomTexture==='function'&&drawCustomTexture(c,id,x,y,size))return;
  if(window.MCTextures){
    // 方块类物品画成《我的世界》那种等距 3D 小方块
    // 格雷科技机器图标（铁块机身 + 机器正面）
    const gt = MCTextures.gtIcon ? MCTextures.gtIcon(id) : null;
    if (gt && gt.complete && gt.naturalWidth){
      const prevSmoothing=c.imageSmoothingEnabled;
      c.imageSmoothingEnabled=false;
      c.drawImage(gt,Math.round(x),Math.round(y),Math.round(size),Math.round(size));
      c.imageSmoothingEnabled=prevSmoothing;
      return;
    }
    const cube=MCTextures.blockIcon(id,size);
    if(cube){
      const prev=c.imageSmoothingEnabled;
      c.imageSmoothingEnabled=true;   // 2 倍渲染后平滑缩小，边缘更干净
      c.drawImage(cube,Math.round(x),Math.round(y),Math.round(size),Math.round(size));
      c.imageSmoothingEnabled=prev;
      return;
    }
    const img=MCTextures.itemIcon(id);
    if(img){
      const prev=c.imageSmoothingEnabled;
      c.imageSmoothingEnabled=false;
      c.drawImage(img,Math.round(x),Math.round(y),Math.round(size),Math.round(size));
      c.imageSmoothingEnabled=prev;
      return;
    }
  }
  drawFallbackItemIcon(c, id, x, y, size);
}

function drawFallbackItemIcon(c, id, x, y, size){
  const it = ITEMS[id];
  if (!it) return;
  const k = size / 16;
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  const c1 = it.color, c2 = it.color2;
  const f = (a,b,w,h,col) => { c.fillStyle = col; c.fillRect(a,b,w,h); };

  switch (it.icon){
    case 'gun':
      f(2,5,12,3,c2);f(3,4,11,3,c1);f(4,7,4,6,c2);f(5,8,2,4,'#887354');
      if(it.pellets>1){f(1,4,14,2,c1);f(9,7,4,2,'#9c753f');}break;
    case 'ammo':
      for(let i=0;i<3;i++){f(2+i*4,5,3,8,c2);f(2+i*4,5,2,6,c1);f(3+i*4,3,1,2,'#ece0bb');}break;
    case 'potion':
      f(6,1,4,3,'#c5aa75'); f(5,4,6,2,'#cde3e9');
      f(3,6,10,8,'#cde3e9'); f(4,8,8,5,c2); f(4,8,8,3,c1);
      f(4,6,2,3,'#ffffff'); f(6,9,1,3,'#ffe8ef'); break;
    case 'log':
      f(2, 5, 12, 6, c2);
      f(2, 5, 12, 2, c1);
      f(5, 4, 6, 8, c2);
      f(5, 4, 6, 2, c1);
      f(6, 7, 4, 1, '#3a2410');
      break;

    case 'rock':
      f(3, 6, 10, 7, c2);
      f(4, 4, 8, 4, c1);
      f(5, 3, 5, 2, '#b0b0be');
      f(4, 9, 8, 2, '#4a4a55');
      break;

    case 'fiber':
      f(4, 3, 2, 11, c2);
      f(7, 2, 2, 12, c1);
      f(10, 3, 2, 11, c2);
      f(2, 10, 3, 2, c1);
      f(11, 11, 3, 2, c1);
      break;

    case 'berry':
      f(4, 5, 4, 4, c1);
      f(9, 4, 4, 4, c1);
      f(6, 9, 4, 4, c1);
      f(4, 5, 2, 2, '#f07090');
      f(9, 4, 2, 2, '#f07090');
      f(6, 9, 2, 2, '#f07090');
      f(6, 2, 4, 2, '#4a8a30');
      break;

    case 'meat':
      f(3, 4, 9, 8, c2);
      f(4, 5, 7, 6, c1);
      f(5, 6, 3, 2, '#e88080');
      f(12, 7, 3, 2, '#e8e0d0');
      f(14, 6, 1, 4, '#e8e0d0');
      break;

    case 'band':
      f(3, 4, 10, 8, c2);
      f(4, 5, 8, 6, c1);
      f(6, 4, 2, 8, '#ffffff');
      f(4, 7, 8, 2, '#d0d0c0');
      break;

    case 'sword':
      f(11, 2, 2, 8, c1);          // 剑身
      f(11, 2, 1, 8, '#ffffff');
      f(8, 10, 7, 2, '#6b4423');    // 护手
      f(9, 12, 3, 3, c2);           // 剑柄
      break;

    case 'armor':
      f(4, 3, 8, 4, c1);
      f(3, 5, 10, 6, c2);
      f(4, 6, 8, 4, c1);
      f(7, 6, 2, 5, '#3a3a44');
      f(5, 4, 6, 1, '#ffffff');
      break;

    case 'torch':
      f(7, 7, 2, 8, '#6b4423');
      f(6, 5, 4, 3, '#a07020');
      f(6, 2, 4, 4, '#f0b030');
      f(7, 1, 2, 2, '#fff0a0');
      break;

    case 'copper':
      f(3, 7, 9, 6, c2);
      f(5, 4, 7, 6, c1);
      f(6, 3, 4, 2, '#ffc080');
      f(5, 8, 4, 3, '#f0a060');
      break;

    case 'crystal':
      f(6, 2, 4, 3, '#c0fff0');
      f(4, 5, 8, 6, c1);
      f(6, 11, 4, 3, c2);
      f(7, 4, 2, 7, '#d8fff8');
      break;

    case 'pickaxe':
      f(7, 6, 2, 9, c2);
      f(3, 4, 10, 2, c1);
      f(2, 5, 4, 2, c2);
      f(10, 5, 4, 2, c2);
      f(5, 6, 2, 2, c1);
      break;

    case 'block':
      f(2, 3, 12, 11, c2);
      f(3, 4, 10, 3, c1);
      f(3, 8, 2, 5, c1);
      f(6, 8, 7, 4, c2);
      f(4, 7, 8, 1, '#d8b080');
      break;

    case 'stick':
      f(7, 2, 2, 12, c2);
      f(8, 2, 2, 12, c1);
      f(9, 4, 1, 9, '#d9b37a');
      break;

    case 'coal':
      f(3, 5, 10, 8, c2);
      f(4, 4, 8, 6, c1);
      f(5, 5, 3, 2, '#6b6b70');
      f(9, 8, 3, 3, '#1d1d20');
      f(6, 9, 2, 2, '#141416');
      break;

    case 'seed':
      f(4, 8, 3, 3, c2);
      f(5, 7, 2, 2, c1);
      f(8, 5, 3, 3, c1);
      f(9, 6, 2, 2, '#f0e8b0');
      f(10, 9, 3, 3, c2);
      f(11, 10, 2, 2, '#e8dc9c');
      f(3, 3, 2, 4, '#6a9a40');
      break;
  }
  c.restore();
}
