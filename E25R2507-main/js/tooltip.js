'use strict';

/* ══════════════════════════════════════════════════════════
   物品提示框（Minecraft 风格）
   - 悬停背包 / 合成格 / 快捷栏中的物品时显示名称、说明与操作提示
   - 深紫色半透明底 + 紫色渐变描边 + 白色物品名
   ══════════════════════════════════════════════════════════ */
function tooltipActionHint(it, id){
  if (it.kind === 'tool') return '左键挥镐采矿';
  if (it.kind === 'placeable' && id !== 'torch') return '右键在附近放置';
  if (it.kind === 'armor') return it.armorSlot ? '拖到对应防具槽位穿戴' : '拖到胸甲槽位穿戴';
  if (it.kind === 'weapon') return it.firearm ? '右键开枪 · 消耗弹药' : '数字键 / 滚轮切换武器';
  if (it.kind === 'food') return it.medicine ? 'H 快速使用' : '右键食用';
  if (id === 'torch') return '选中后按 Q 放置';
  if (it.kind === 'seed') return '右键开垦后的农田播种';
  return '数字键 / 滚轮选择';
}
function tooltipStatLine(it){
  if (it.kind === 'weapon' && it.firearm) return '伤害 ' + it.dmg + ' × ' + (it.pellets || 1) + ' · 射程 ' + it.gunRange;
  if (it.kind === 'weapon') return '攻击力 +' + it.dmg + ' · 距离 ' + it.range;
  if (it.kind === 'tool') return '采集效率 ' + it.mine + ' · 冷却 ' + it.cd + 's';
  if (it.kind === 'armor') return '减伤 ' + Math.round((it.def || 0) * 100) + '%';
  if (it.kind === 'food'){
    const parts = [];
    if (it.hunger) parts.push('饱食 +' + it.hunger);
    if (it.hydration) parts.push('水分 +' + it.hydration);
    if (it.heal) parts.push('生命 ' + (it.heal > 0 ? '+' : '') + it.heal);
    return parts.join(' · ');
  }
  return '';
}

function wrapTooltipText(text, maxWidth, size){
  setFont(size, true);
  const lines = [];
  let line = '';
  for (const ch of String(text)){
    if (ch === '\n'){ lines.push(line); line = ''; continue; }
    if (ctx.measureText(line + ch).width > maxWidth && line){
      lines.push(line);
      line = ch;
    } else line += ch;
  }
  if (line) lines.push(line);
  return lines;
}

function drawHoveredItemTooltip(){
  let id = null, count = 0, source = '';
  if (panel === 'inventory' || panel === 'craft'){
    if (hoverCraftItem){ id = hoverCraftItem.id; count = hoverCraftItem.count; source = 'panel'; }
  } else if (!panel && hoverSlot >= 0){
    id = hotbar[hoverSlot];
    count = id ? (inv[id] || 0) : 0;
    source = 'hotbar';
  }
  if (!id || !ITEMS[id]) return;
  if (craftHeld && craftHeld.id === id && source === 'panel') return;
  drawMcTooltip(id, count);
}

function drawMcTooltip(id, count){
  const it = ITEMS[id];
  const lines = [];
  lines.push({ text: it.name, color: count > 0 ? '#ffffff' : '#9a9a9a' });
  const stat = tooltipStatLine(it);
  if (stat) lines.push({ text: stat, color: '#b8b8ff' });
  if (it.desc){
    for (const part of wrapTooltipText(it.desc, 156, 7)) lines.push({ text: part, color: '#a8a8a8' });
  }
  if (count > 0) lines.push({ text: '数量 ' + count, color: '#8a8a8a' });
  lines.push({ text: tooltipActionHint(it, id), color: '#6f6f9f' });

  setFont(7, true);
  let maxW = 0;
  for (const line of lines) maxW = Math.max(maxW, ctx.measureText(localizeGameText(line.text)).width);
  const pw = Math.min(W - 8, Math.ceil(maxW) + 12);
  const ph = lines.length * 10 + 6;
  let px = mouse.x + 12;
  let py = mouse.y - ph - 8;
  if (px + pw > W - 2) px = mouse.x - pw - 8;
  px = clamp(px, 2, W - pw - 2);
  py = clamp(py, 2, H - ph - 2);

  // MC 提示框：紫色渐变描边 + 深色底
  R(px - 1, py - 1, pw + 2, ph + 2, 'rgba(0,0,0,0.55)');
  R(px, py, pw, ph, '#24005e');
  R(px + 1, py + 1, pw - 2, ph - 2, 'rgba(16,0,16,0.96)');
  R(px, py, pw, 1, '#5a28ff');
  R(px, py + ph - 1, pw, 1, '#2b0a6b');
  R(px, py, 1, ph, '#3c1496');
  R(px + pw - 1, py, 1, ph, '#3c1496');

  for (let i = 0; i < lines.length; i++){
    txt(lines[i].text, px + 6, py + 4 + i * 10, { size:7, bold:true, color:lines[i].color });
  }
}

function drawTooltip(){
  drawHoveredItemTooltip();
}
