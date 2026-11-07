'use strict';

/* ══════════════════════════════════════════════════════════
   Minecraft 风格 UI 主题
   - 浅灰容器 + 黑色描边 + 立体高光（对应 2233 材质包里的 GUI 贴图）
   - 深色 MC 按钮、物品槽、状态条、提示框
   - 所有面板共用这套原语，保证整体风格统一
   ══════════════════════════════════════════════════════════ */

const UI_FONT = '"Yu Gothic UI","Meiryo","Noto Sans JP","Microsoft YaHei UI","Microsoft YaHei","Noto Sans SC",sans-serif';

const PAL = {
  // ── Minecraft 容器配色 ──
  guiBody:   '#c6c6c6',
  guiLight:  '#ffffff',
  guiShadow: '#555555',
  guiDark:   '#373737',
  guiSlot:   '#8b8b8b',
  guiSlotHi: '#ffffff',
  border:    '#000000',
  // 木头键名保留，语义改为 MC 描边灰阶
  woodDark:  '#000000',
  wood:      '#373737',
  woodMid:   '#555555',
  woodLight: '#8b8b8b',
  woodPale:  '#c6c6c6',
  // 面板 / 纸面
  cream:      '#c6c6c6',
  creamDark:  '#d8d8d8',
  creamShade: '#8b8b8b',
  paper:      '#c6c6c6',
  paperAlt:   '#b9b9b9',
  // 草绿（MC 深绿）
  leaf:      '#4f7a32',
  leafDark:  '#2f4d1d',
  leafLight: '#7fae55',
  // 金 / 经验
  gold:      '#e8b73a',
  goldDark:  '#9a7220',
  goldLight: '#ffe08a',
  // 状态
  hp:      '#b3202a', hpLight: '#e8443c', hpDark: '#6b1116',
  hunger:  '#a86a1e', hungerLight: '#e0a23c', hungerDark: '#5e3a10',
  sta:     '#2c6b8b', staLight: '#5cb6d8', staDark: '#163e52',
  xp:      '#5b8a2e', xpLight: '#8fc453',
  // 按钮
  btnGreen:  '#3f6b28', btnGreenLight:  '#5d8f3c', btnGreenDark:  '#1f3814',
  btnRed:    '#7a2a22', btnRedLight:    '#a03a2e', btnRedDark:    '#3f120e',
  btnBlue:   '#2c4a6b', btnBlueLight:   '#426a93', btnBlueDark:   '#15263a',
  btnGold:   '#6b521c', btnGoldLight:   '#8f6e2a', btnGoldDark:   '#382a0c',
  btnWood:   '#2f2f2f', btnWoodLight:   '#4a4a4a', btnWoodDark:   '#0f0f0f',
  btnStone:  '#4a4a4a', btnStoneLight:  '#6b6b6b', btnStoneDark:  '#1b1b1b',
  // 文字
  ink:       '#3f3f3f',
  inkSoft:   '#666666',
  inkLight:  '#8a8a8a',
  creamText: '#ffffff',
  white:     '#ffffff',
};

function setFont(size, bold){ ctx.font = (bold ? 'bold ' : '') + size + 'px ' + UI_FONT; }

/* 文本：默认加粗、顶对齐；只绘制一次，避免出现重影 */
function txt(str, x, y, o){
  o = o || {};
  setFont(o.size || 7, o.bold !== false);
  ctx.fillStyle = o.color || PAL.ink;
  ctx.textAlign = o.align || 'left';
  ctx.fillText(localizeGameText(str), x, y);
}

/* 数量数字：白色文字 + 一圈深色描边，不遮挡图标又看得清 */
function countText(str, right, bottom, size){
  str = String(str);
  const fontSize = size || 6;
  setFont(fontSize, true);
  ctx.textAlign = 'right';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText(str, right, bottom - fontSize);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(str, right, bottom - fontSize);
  ctx.textAlign = 'left';
  ctx.lineWidth = 1;
}

/* MC 容器窗口：黑边 + 白色高光 + 灰色阴影 + 浅灰底色 */
function mcWindow(x, y, w, h, o){
  o = o || {};
  R(x, y, w, h, PAL.border);
  R(x + 1, y + 1, w - 2, h - 2, o.highlight || PAL.guiLight);
  R(x + 2, y + 2, w - 2, h - 2, o.shadow || PAL.guiShadow);
  R(x + 2, y + 2, w - 4, h - 4, o.fill || PAL.guiBody);
  // 内部细描边
  R(x + 3, y + 3, w - 6, 1, 'rgba(255,255,255,0.55)');
  R(x + 3, y + h - 4, w - 6, 1, 'rgba(0,0,0,0.16)');
}

/* 兼容旧接口：面板（可选标题）。标题改为 MC 深色标签 + 分隔线。 */
function uiPanel(x, y, w, h, o){
  o = o || {};
  const fill = o.fill || PAL.guiBody;
  const accent = o.accent;
  const compact = o.compact === true;
  R(x, y, w, h, PAL.border);
  if (fill === PAL.guiBody && !accent && !o.wood && !o.woodMid){
    mcWindow(x, y, w, h, { fill });
  } else {
    // 自定义底色的卡片：保留描边结构，但避免外圈过厚
    R(x + 1, y + 1, w - 2, h - 2, o.woodMid || PAL.guiShadow);
    R(x + 1, y + 1, w - 2, 1, 'rgba(255,255,255,0.35)');
    R(x + 2, y + 2, w - 4, h - 4, fill);
    if (!compact){
      R(x + 2, y + 2, w - 4, 1, 'rgba(255,255,255,0.22)');
      R(x + 2, y + h - 3, w - 4, 1, 'rgba(0,0,0,0.18)');
    }
  }
  if (o.title){
    const th = o.titleH || 13;
    const offset = accent ? 10 : 6;
    if (accent) R(x + 4, y + 4, 2, 7, accent);
    setFont(8, true);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillText(localizeGameText(o.title), x + offset + 1, y + 5);
    ctx.fillStyle = '#3f3f3f';
    ctx.fillText(localizeGameText(o.title), x + offset, y + 4);
    R(x + 4, y + th, w - 8, 1, 'rgba(0,0,0,0.28)');
    R(x + 4, y + th + 1, w - 8, 1, 'rgba(255,255,255,0.35)');
  }
}

/* MC 按钮：深色立体块，悬停变亮并加白描边 */
function uiButton(x, y, w, h, label, o){
  o = o || {};
  const kind = o.kind || 'wood';
  let base, light, dark, textCol;
  if (kind === 'green'){ base = PAL.btnGreen; light = PAL.btnGreenLight; dark = PAL.btnGreenDark; textCol = '#e9ffd9'; }
  else if (kind === 'red'){ base = PAL.btnRed; light = PAL.btnRedLight; dark = PAL.btnRedDark; textCol = '#ffe4e0'; }
  else if (kind === 'blue'){ base = PAL.btnBlue; light = PAL.btnBlueLight; dark = PAL.btnBlueDark; textCol = '#e2f2ff'; }
  else if (kind === 'gold'){ base = PAL.btnGold; light = PAL.btnGoldLight; dark = PAL.btnGoldDark; textCol = '#fff4cf'; }
  else if (kind === 'stone'){ base = PAL.btnStone; light = PAL.btnStoneLight; dark = PAL.btnStoneDark; textCol = '#f2f2f2'; }
  else { base = PAL.btnWood; light = PAL.btnWoodLight; dark = PAL.btnWoodDark; textCol = '#ffffff'; }
  const hover = !o.noHover && !o.disabled && mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
  if (o.disabled) ctx.globalAlpha = 0.55;
  R(x, y, w, h, dark);
  R(x, y, w, h - 1, base);
  R(x + 1, y + 1, w - 2, 1, light);
  R(x + 1, y + 1, 1, h - 3, light);
  R(x, y + h - 1, w, 1, dark);
  if (hover){
    R(x, y, w, 1, '#ffffff');
    R(x, y, 1, h, '#ffffff');
    R(x + w - 1, y, 1, h, '#ffffff');
    R(x, y + h - 1, w, 1, '#ffffff');
    R(x + 1, y + 1, w - 2, h - 2, 'rgba(255,255,255,0.12)');
  }
  setFont(o.size || 7, true);
  ctx.textAlign = 'center';
  ctx.fillStyle = o.textColor || textCol;
  ctx.fillText(localizeGameText(label), x + w / 2, y + Math.floor((h - 7) / 2));
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
  return hover;
}

/* 物品槽：MC 的凹槽效果 */
function uiSlot(x, y, s, o){
  o = o || {};
  const selected = !!o.selected;
  const hover = !!o.hover;
  R(x, y, s, s, PAL.guiDark);
  R(x + 1, y + 1, s - 2, s - 2, o.fill || PAL.guiSlot);
  R(x + 1, y + 1, s - 2, 1, 'rgba(0,0,0,0.42)');
  R(x + 1, y + 1, 1, s - 2, 'rgba(0,0,0,0.42)');
  R(x + 1, y + s - 2, s - 2, 1, 'rgba(255,255,255,0.30)');
  R(x + s - 2, y + 1, 1, s - 2, 'rgba(255,255,255,0.30)');
  if (hover) R(x + 2, y + 2, s - 4, s - 4, 'rgba(255,255,255,0.28)');
  if (selected) R(x + 2, y + 2, s - 4, s - 4, 'rgba(255,255,255,0.42)');
  if (selected || hover){
    R(x, y, s, 1, selected ? '#ffffff' : 'rgba(255,255,255,0.7)');
    R(x, y, 1, s, selected ? '#ffffff' : 'rgba(255,255,255,0.7)');
    R(x, y + s - 1, s, 1, 'rgba(0,0,0,0.45)');
    R(x + s - 1, y, 1, s, 'rgba(0,0,0,0.45)');
  }
}

/* 状态条 */
function uiBar(x, y, w, h, ratio, o){
  o = o || {};
  R(x - 1, y - 1, w + 2, h + 2, PAL.border);
  R(x, y, w, h, '#1a1a1a');
  const fw = Math.round(w * clamp(ratio, 0, 1));
  if (fw > 0){
    R(x, y, fw, h, o.dark);
    R(x, y, fw, Math.max(1, Math.ceil(h / 2)), o.light);
    if (o.top) R(x, y, fw, 1, o.top);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 1; i < 10; i++) ctx.fillRect(x + Math.round(w * i / 10), y, 1, h);
}

/* 顶栏小芯片 */
function uiChip(x, y, w, h, label, o){
  o = o || {};
  const on = !!o.on;
  const hover = !o.noHover && mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
  R(x, y, w, h, 'rgba(0,0,0,0.72)');
  R(x, y, w, 1, on ? PAL.gold : 'rgba(255,255,255,0.28)');
  R(x, y + h - 1, w, 1, 'rgba(0,0,0,0.5)');
  if (hover) R(x + 1, y + 1, w - 2, h - 2, 'rgba(255,255,255,0.08)');
  txt(label, x + w / 2, y + 3, { size: 7, bold: true, color: on ? '#ffe9a8' : (o.color || '#e7e7e7'), align: 'center' });
  return hover;
}

/* 关闭 × 按钮（MC 风格方形按钮） */
function uiClose(x, y, fn, o){
  o = o || {};
  const s = o.s || 12;
  uiButton(x, y, s, s, '×', { kind: 'red', size: 9 });
  if (fn) uiButtons.push({ x: x, y: y, w: s, h: s, fn: fn });
}

/* ── 小像素图标 ───────────────────────────── */
function iconHeart(x, y, c){
  const col = c || PAL.hpLight;
  ctx.fillStyle = col;
  ctx.fillRect(x + 1, y,     2, 1); ctx.fillRect(x + 5, y,     2, 1);
  ctx.fillRect(x,     y + 1, 8, 1);
  ctx.fillRect(x,     y + 2, 8, 1);
  ctx.fillRect(x,     y + 3, 8, 1);
  ctx.fillRect(x + 1, y + 4, 6, 1);
  ctx.fillRect(x + 2, y + 5, 4, 1);
  ctx.fillRect(x + 3, y + 6, 2, 1);
}
function iconFood(x, y, c){
  const col = c || PAL.hungerLight;
  ctx.fillStyle = col;
  ctx.fillRect(x + 1, y + 1, 2, 2); ctx.fillRect(x + 5, y + 1, 2, 2);
  ctx.fillRect(x + 3, y + 3, 2, 2); ctx.fillRect(x + 1, y + 5, 6, 2);
  ctx.fillStyle = '#4a7a36'; ctx.fillRect(x + 3, y, 2, 1);
}
function iconBolt(x, y, c){
  const col = c || PAL.staLight;
  ctx.fillStyle = col;
  ctx.fillRect(x + 4, y, 2, 2);
  ctx.fillRect(x + 2, y + 2, 4, 2);
  ctx.fillRect(x + 3, y + 4, 2, 2);
  ctx.fillRect(x + 2, y + 5, 4, 1);
}

/* Sprout Lands 官方调色板（保留给世界绘制使用） */
const SPR = {
  red:    ['#713970','#8a4a70','#a35b70','#af6776','#bd757e','#d99a9a','#e8b5ac','#f3d8c5'],
  brown:  ['#6b4b5b','#865161','#a16159','#ba7c54','#d79e61','#eeba77','#f2cf8c','#f7ebaa'],
  olive:  ['#795e53','#957a4b','#b09643','#bfa954','#d4c169','#eae178','#eeee9b','#f3f2c0'],
  green:  ['#566560','#67835c','#78a158','#8db15d','#a4c263','#c0d470','#d2e077','#e8eeaa'],
  teal:   ['#505e77','#5f7a79','#6e967c','#82a884','#97bb8e','#aed499','#c2e09a','#dff0bb'],
  blue:   ['#4a588e','#577297','#658ca1','#7ba6b4','#8cbfc2','#9bd4c3','#b1e0be','#d6f1cd'],
  indigo: ['#4c468b','#555793','#5f699c','#7180b1','#8599c7','#92b2d4','#99c5de','#cbe0de'],
  purple: ['#504086','#5c4e92','#685d9e','#766daa','#867fb8','#a09dd4','#bcafde','#ddd5de'],
  violet: ['#583f83','#694a87','#7b568c','#90689f','#a77bb3','#c89dd1','#d8b1e0','#ebd6e0'],
  tan:    ['#754c60','#90625d','#aa7959','#b68962','#c49a6c','#dcb98a','#e8cfa6','#f3e5c2'],
  earth:  ['#645552','#7b6762','#8c7369','#9d866f','#b2a486','#c4bc93','#ded9ab','#f0efb9'],
  grey:   ['#353738','#474a4b','#545959','#6b7470','#818b83','#9da89a','#c1c8b9','#dce0d2'],
  white:  '#f3f4e7',
  black:  '#000000',
};

/* ══════════════════════════════════════════════════════════
   Minecraft 容器贴图（来自 2233 材质包）
   ══════════════════════════════════════════════════════════ */
const MC_GUI = {
  furnace: { key:'gui/container/furnace', w:176, h:166 },
  blast_furnace: { key:'gui/container/blast_furnace', w:176, h:166 },
  smoker: { key:'gui/container/smoker', w:176, h:166 },
  inventory:      { key:'gui/container/inventory',      w:176, h:166 },
  craftingTable:  { key:'gui/container/crafting_table', w:176, h:166 },
  generic54:      { key:'gui/container/generic_54',     w:176, h:222 },
};

/* 绘制容器贴图；贴图未就绪时用 mcWindow 兜底，避免首帧空白 */
function drawMcContainer(name, x, y, w, h){
  const spec = MC_GUI[name];
  const img = spec && window.MCTextures ? MCTextures.image(spec.key) : null;
  if (img){
    ctx.drawImage(img, 0, 0, spec.w, spec.h, x, y, w || spec.w, h || spec.h);
    return true;
  }
  mcWindow(x, y, w || (spec ? spec.w : 176), h || (spec ? spec.h : 166));
  return false;
}

/* 容器标题：MC 里标题画在窗口内左上角，深灰字 */
function mcContainerTitle(text, x, y){
  txt(text, x, y, { size: 8, bold: true, color: '#404040' });
}

/* ══════════════════════════════════════════════════════════
   MC 菜单背景：平铺浅泥土贴图 + 暗色遮罩（只生成一次）
   ══════════════════════════════════════════════════════════ */
let mcBackdropCanvas = null;
let mcBackdropHadTexture = false;
function buildMcBackdrop(){
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const img = window.MCTextures ? MCTextures.image('gui/light_dirt_background') : null;
  mcBackdropHadTexture = !!img;
  if (img){
    for (let y = 0; y < H; y += 16){
      for (let x = 0; x < W; x += 16){
        g.drawImage(img, 0, 0, img.naturalWidth || 16, img.naturalHeight || 16, x, y, 16, 16);
      }
    }
  }else{
    g.fillStyle = '#4a3a2c';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  }
  mcBackdropCanvas = cv;
  return cv;
}

/* 半透明暗色遮罩 + MC 泥土背景；alpha 越大越暗 */
function drawMcBackdrop(alpha){
  const a = alpha === undefined ? 0.62 : alpha;
  const hasTexture = !!(window.MCTextures && MCTextures.image('gui/light_dirt_background'));
  if (!mcBackdropCanvas || (hasTexture && !mcBackdropHadTexture)) buildMcBackdrop();
  if (mcBackdropCanvas) ctx.drawImage(mcBackdropCanvas, 0, 0, W, H);
  ctx.fillStyle = 'rgba(6,6,8,' + a + ')';
  ctx.fillRect(0, 0, W, H);
}

/* 单纯的暗色遮罩（保留世界画面） */
function dimWorld(alpha){
  ctx.fillStyle = 'rgba(8,8,10,' + (alpha === undefined ? 0.7 : alpha) + ')';
  ctx.fillRect(0, 0, W, H);
}
