'use strict';

/* ══════════════════════════════════════════════════════════
   Tooltip
   ══════════════════════════════════════════════════════════ */
function drawTooltip(){
  if (panel || hoverSlot < 0) return;
  const id = hotbar[hoverSlot];
  if (!id) return;
  const it = ITEMS[id];
  const count = inv[id] || 0;
  const action = it.kind === 'tool'
    ? '左键挥镐采矿'
    : it.kind === 'placeable' && id !== 'torch'
      ? '右键在附近放置'
      : it.kind === 'armor'
        ? it.armorSlot ? '背包中拖到对应防具槽位穿戴' : '背包中拖到胸甲槽位穿戴'
        : it.kind === 'weapon'
          ? '数字键/滚轮切换装备'
        : it.kind === 'food' || id === 'torch' ? '右键使用' : '数字键/滚轮选择';
  const lines = [it.name, it.desc, action];
  if (count === 0) lines.push('（尚未拥有）');

  setFont(8, true);
  let maxW = 0;
  for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
  const pw = maxW + 14, ph = lines.length * 11 + 8;
  let pxx = mouse.x - pw/2;
  let pyy = mouse.y - ph - 14;
  pxx = clamp(pxx, 4, W - pw - 4);
  pyy = clamp(pyy, 4, H - ph - 4);

  uiPanel(pxx, pyy, pw, ph, {});
  for (let i = 0; i < lines.length; i++){
    txt(lines[i], pxx + 7, pyy + 4 + i * 11, {
      size:8, bold:true,
      color: i === 0 ? (count > 0 ? '#3c2b1a' : '#8a7a5a')
        : i === 1 ? '#6b5b42'
        : i === 2 ? '#2f6b8c' : '#8a7a5a'
    });
  }
}
