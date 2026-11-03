'use strict';

/* ══════════════════════════════════════════════════════════
   Cozy UI 主题（Sprout Lands 风格）
   暖木 · 奶油 · 草绿 · 像素字体
   提供统一调色板与绘制原语，供各 UI 面板复用
   ══════════════════════════════════════════════════════════ */

const UI_FONT = '"Yu Gothic UI","Meiryo","Noto Sans JP","Microsoft YaHei UI","Microsoft YaHei","Noto Sans SC",sans-serif';

const PAL = {
  // 木头
  woodDark:  '#4a2f18',
  wood:      '#7a5231',
  woodMid:   '#9a683c',
  woodLight: '#b98953',
  woodPale:  '#d9b37a',
  // 奶油面板
  cream:      '#f3e4c2',
  creamDark:  '#fdf3d8',
  creamShade: '#d9c394',
  paper:      '#efe0ba',
  // 草绿
  leaf:      '#6ca24f',
  leafDark:  '#4a7a36',
  leafLight: '#93c26f',
  // 金
  gold:      '#e5b648',
  goldDark:  '#b8892c',
  goldLight: '#f7d98a',
  // 状态
  hp:      '#c8453c', hpLight: '#ef6a5b', hpDark: '#7c2520',
  hunger:  '#d9952c', hungerLight: '#f0b94d', hungerDark: '#8a5a16',
  sta:     '#3f8fb0', staLight: '#6cc4dd', staDark: '#245d78',
  xp:      '#8f74c9', xpLight: '#b99ce6',
  // 按钮
  btnGreen:  '#5c9446', btnGreenLight:  '#7db45f', btnGreenDark:  '#3c6630',
  btnRed:    '#a8443c', btnRedLight:    '#c96b5a', btnRedDark:    '#6e2a24',
  btnBlue:   '#3f7d96', btnBlueLight:   '#63a7c0', btnBlueDark:   '#275167',
  btnGold:   '#d9a73c', btnGoldLight:   '#f0c66a', btnGoldDark:   '#a87822',
  btnWood:   '#9a683c', btnWoodLight:   '#b98953', btnWoodDark:   '#6b4523',
  // 文字
  ink:       '#3c2b1a',
  inkSoft:   '#6b563a',
  creamText: '#fff7e0',
};

function setFont(size, bold){ ctx.font = (bold ? 'bold ' : '') + size + 'px ' + UI_FONT; }

/* 文本：默认加粗、顶对齐 */
function txt(str, x, y, o){
  o = o || {};
  setFont(o.size || 7, o.bold !== false);
  ctx.fillStyle = o.color || PAL.ink;
  ctx.textAlign = o.align || 'left';
  ctx.fillText(localizeGameText(str), x, y);
}

/* 木纹：在区域里撒少量深色像素点 */
function woodGrain(x, y, w, h, seed){
  const n = Math.max(2, Math.floor(w * h / 130));
  ctx.fillStyle = 'rgba(74,47,24,0.32)';
  for (let i = 0; i < n; i++){
    const gx = Math.round(x + 1 + hash2((seed + i * 7) | 0, (i * 13) | 0) * (w - 3));
    const gy = Math.round(y + 1 + hash2((seed + i * 31) | 0, (i * 17) | 0) * (h - 3));
    ctx.fillRect(gx, gy, 1, 1);
  }
}

/* 奶油木框面板 */
function uiPanel(x, y, w, h, o){
  o = o || {};
  const fill = o.fill || PAL.cream;
  R(x, y, w, h, PAL.woodDark);
  R(x + 1, y + 1, w - 2, h - 2, o.wood || PAL.wood);
  R(x + 2, y + 2, w - 4, h - 4, o.woodMid || PAL.woodMid);
  woodGrain(x + 1, y + 1, w - 2, h - 2, (x * 3 + y * 5) | 0);
  R(x + 3, y + 3, w - 6, h - 6, fill);
  R(x + 3, y + 3, w - 6, 1, PAL.creamDark);
  R(x + 3, y + 3, 1, h - 6, PAL.creamDark);
  R(x + 3, y + h - 4, w - 6, 1, PAL.creamShade);
  R(x + w - 4, y + 3, 1, h - 6, PAL.creamShade);
  if (o.title){
    const th = o.titleH || 13;
    R(x + 3, y + 3, w - 6, th, o.accent || PAL.leaf);
    R(x + 3, y + 3, w - 6, 1, o.accentLight || PAL.leafLight);
    R(x + 3, y + 3 + th - 1, w - 6, 1, o.accentDark || PAL.leafDark);
    txt(o.title, x + 8, y + 4, { size: 8, bold: true, color: PAL.creamText });
  }
}

/* 带立体感的木/彩按钮；返回是否悬停 */
function uiButton(x, y, w, h, label, o){
  o = o || {};
  const kind = o.kind || 'wood';
  let base, light, dark, textCol;
  if (kind === 'green'){ base = PAL.btnGreen; light = PAL.btnGreenLight; dark = PAL.btnGreenDark; textCol = '#efffe0'; }
  else if (kind === 'red'){ base = PAL.btnRed; light = PAL.btnRedLight; dark = PAL.btnRedDark; textCol = '#ffe0e0'; }
  else if (kind === 'blue'){ base = PAL.btnBlue; light = PAL.btnBlueLight; dark = PAL.btnBlueDark; textCol = '#e4f6ff'; }
  else if (kind === 'gold'){ base = PAL.btnGold; light = PAL.btnGoldLight; dark = PAL.btnGoldDark; textCol = '#fff7e0'; }
  else { base = PAL.btnWood; light = PAL.btnWoodLight; dark = PAL.btnWoodDark; textCol = '#fff1d0'; }
  const hover = !o.noHover && mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
  if (o.disabled){ ctx.globalAlpha = 0.5; }
  else if (hover){ base = light; }
  R(x, y, w, h, dark);
  R(x, y, w, h - 1, base);
  R(x, y, w, 1, light);
  R(x + 1, y + 1, 1, h - 2, light);
  R(x, y + h - 1, w, 1, dark);
  R(x + w - 1, y + 1, 1, h - 2, dark);
  txt(label, x + w / 2, y + Math.floor((h - 7) / 2), { size: o.size || 7, bold: true, color: o.textColor || textCol, align: 'center' });
  ctx.globalAlpha = 1;
  return hover;
}

/* 物品槽 */
function uiSlot(x, y, s, o){
  o = o || {};
  const selected = !!o.selected;
  const border = selected ? PAL.gold : (o.hover ? PAL.woodLight : PAL.woodMid);
  R(x, y, s, s, selected ? PAL.goldDark : PAL.woodDark);
  R(x + 1, y + 1, s - 2, s - 2, border);
  R(x + 2, y + 2, s - 4, s - 4, o.fill || '#2b2118');
  R(x + 2, y + 2, s - 4, 1, 'rgba(255,255,255,0.10)');
  R(x + 2, y + s - 3, s - 4, 1, 'rgba(0,0,0,0.45)');
  if (selected){
    R(x - 1, y - 1, s + 2, 1, PAL.goldLight);
    R(x - 1, y + s, s + 2, 1, PAL.goldDark);
    R(x - 1, y - 1, 1, s + 2, PAL.goldLight);
    R(x + s, y - 1, 1, s + 2, PAL.goldDark);
  }
}

/* 状态条 */
function uiBar(x, y, w, h, ratio, o){
  o = o || {};
  const cDark = o.dark, cLight = o.light, cTop = o.top;
  R(x - 1, y - 1, w + 2, h + 2, PAL.woodDark);
  R(x, y, w, h, '#1a120b');
  const fw = Math.round(w * clamp(ratio, 0, 1));
  if (fw > 0){
    R(x, y, fw, h, cDark);
    R(x, y, fw, Math.max(1, Math.ceil(h / 2)), cLight);
    if (cTop) R(x, y, fw, 1, cTop);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  for (let i = 1; i < 10; i++) ctx.fillRect(x + Math.round(w * i / 10), y, 1, h);
  R(x, y + h - 1, w, 1, 'rgba(0,0,0,0.3)');
}

/* 顶栏小芯片 */
function uiChip(x, y, w, h, label, o){
  o = o || {};
  const on = !!o.on;
  const hover = !o.noHover && mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
  R(x, y, w, h, on ? 'rgba(110,82,38,0.94)' : 'rgba(36,27,16,0.86)');
  R(x, y, w, 1, on ? PAL.gold : 'rgba(216,188,138,0.35)');
  R(x, y + h - 1, w, 1, 'rgba(0,0,0,0.4)');
  txt(label, x + w / 2, y + 3, { size: 7, bold: true, color: on ? '#ffe9a8' : (o.color || '#e7dcc0'), align: 'center' });
  return hover;
}

/* 关闭 × 按钮 */
function uiClose(x, y, fn, o){
  o = o || {};
  const s = o.s || 12;
  const hover = !o.noHover && mouse.x >= x && mouse.x <= x + s && mouse.y >= y && mouse.y <= y + s;
  R(x, y, s, s, hover ? '#b8443c' : '#8a4038');
  R(x, y, s, 1, '#d9857a');
  R(x, y + s - 1, s, 1, '#5a2620');
  txt('×', x + s / 2, y + 1, { size: 9, bold: true, color: '#fff0e0', align: 'center' });
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

/* Sprout Lands 官方调色板（暖暗 → 亮） */
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
