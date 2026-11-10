'use strict';

/* ══════════════════════════════════════════════════════════
   合成系统（Minecraft 风格）
   - 工作台：3×3 摆放格 + 产物格，鼠标拿起 / 放下材料
   - 背包：2×2 摆放格（只能做小型配方）
   - 有形状的配方按 grid 摆放；无序配方把材料放进任意格子
   - 右侧「配方手册」（JEI 风格）可一键把材料摆进格子
   ══════════════════════════════════════════════════════════ */

const CRAFT_GRIDS = {
  table: { key:'table', size:3, cells:new Array(9).fill(null) },
  inv:   { key:'inv',   size:2, cells:new Array(4).fill(null) },
};
const MAX_STACK = 64;
let craftHeld = null;          // 鼠标上拿着的物品 {id,count}
let recipeBookPage = 0;
let recipeBookFilter = 'all';
let hoverCraftItem = null;     // {id,count} 用于物品提示框

/* 放回背包但不计入「采集数量」统计 */
function depositItem(id, n){
  if (!id || n <= 0) return;
  if (!(inv[id] > 0) && !inventoryOrder.includes(id)) inventoryOrder.push(id);
  inv[id] = (inv[id] || 0) + n;
  // 放回背包的物品留在背包里，由玩家自己决定放到哪一格
  if (typeof syncBagSlots === 'function') syncBagSlots();
  recalcEquipment();
}

function craftGrid(key){ return CRAFT_GRIDS[key] || CRAFT_GRIDS.table; }
function craftingGridKey(){ return panel === 'inventory' ? 'inv' : 'table'; }

/* ── 拿在手上的物品 ─────────────────────────── */
function heldStack(){ return craftHeld; }
function setHeld(id, count){
  if (!id || count <= 0){ craftHeld = null; return; }
  craftHeld = { id, count: Math.min(count, MAX_STACK) };
}
function clearHeld(){ craftHeld = null; }

/* 把鼠标上 / 合成格里的东西放回背包 */
function returnHeldToInventory(){
  if (!craftHeld) return;
  depositItem(craftHeld.id, craftHeld.count);
  craftHeld = null;
}
function returnCraftingItems(keys){
  const list = keys ? [].concat(keys) : ['table', 'inv'];
  for (const key of list){
    const grid = craftGrid(key);
    for (let i = 0; i < grid.cells.length; i++){
      const cell = grid.cells[i];
      if (cell && cell.count > 0) depositItem(cell.id, cell.count);
      grid.cells[i] = null;
    }
  }
  returnHeldToInventory();
  recalcEquipment();
}
function craftGridSnapshot(target){
  if (!target || typeof target !== 'object') return target;
  const out = target;
  for (const key in CRAFT_GRIDS){
    for (const cell of CRAFT_GRIDS[key].cells){
      if (!cell || cell.count <= 0) continue;
      out[cell.id] = (out[cell.id] || 0) + cell.count;
    }
  }
  if (craftHeld && craftHeld.count > 0) out[craftHeld.id] = (out[craftHeld.id] || 0) + craftHeld.count;
  return out;
}

/* 重开 / 读档时清空合成格，避免物品残留 */
function resetCraftingState(){
  for (const key in CRAFT_GRIDS) CRAFT_GRIDS[key].cells.fill(null);
  craftHeld = null;
  recipeBookPage = 0;
  recipeBookFilter = 'all';
  inventoryPage = 0;
}

/* 不在背包 / 合成界面时，把合成格和手上的物品放回背包 */
function craftReturnOrphans(){
  if (panel === 'inventory' || panel === 'craft') return;
  if (craftHeld) returnCraftingItems();
  else if (CRAFT_GRIDS.table.cells.some(Boolean) || CRAFT_GRIDS.inv.cells.some(Boolean)) returnCraftingItems();
}

/* ── 配方编译与匹配 ─────────────────────────── */
function recipeNeedTotal(need){
  let total = 0;
  for (const id in need) total += need[id];
  return total;
}
const COMPILED_RECIPES = new WeakMap();
function compileShaped(rec){
  if (!rec.grid || !rec.key) return null;
  if (COMPILED_RECIPES.has(rec)) return COMPILED_RECIPES.get(rec);
  const rows = rec.grid.map(row => row.split(''));
  // 去掉四周的空行 / 空列，得到图案真实大小
  let top = rows.length, bottom = -1, left = Infinity, right = -1;
  for (let r = 0; r < rows.length; r++){
    for (let c = 0; c < rows[r].length; c++){
      if (rows[r][c] === '.' || !rows[r][c]) continue;
      if (r < top) top = r;
      if (r > bottom) bottom = r;
      if (c < left) left = c;
      if (c > right) right = c;
    }
  }
  if (bottom < 0){ COMPILED_RECIPES.set(rec, null); return null; }
  const pattern = [];
  for (let r = top; r <= bottom; r++){
    const line = [];
    for (let c = left; c <= right; c++) line.push(rows[r][c] === '.' ? null : (rec.key[rows[r][c]] || null));
    pattern.push(line);
  }
  const result = pattern.some(line => line.some(id => !id))
    ? null
    : { rec, shaped:true, pattern, w:pattern[0].length, h:pattern.length };
  COMPILED_RECIPES.set(rec, result);
  return result;
}
function matchShaped(compiled, grid){
  const size = grid.size, cells = grid.cells;
  // 找出摆放内容的包围盒
  let top = size, bottom = -1, left = size, right = -1;
  for (let r = 0; r < size; r++){
    for (let c = 0; c < size; c++){
      if (!cells[r * size + c]) continue;
      if (r < top) top = r;
      if (r > bottom) bottom = r;
      if (c < left) left = c;
      if (c > right) right = c;
    }
  }
  if (bottom < 0) return false;
  if (bottom - top + 1 !== compiled.h || right - left + 1 !== compiled.w) return false;
  for (let r = 0; r < compiled.h; r++){
    for (let c = 0; c < compiled.w; c++){
      const cell = cells[(top + r) * size + (left + c)];
      const want = compiled.pattern[r][c];
      if (!cell || cell.id !== want || cell.count < 1) return false;
    }
  }
  return true;
}
function gridTotals(grid){
  const totals = {};
  for (const cell of grid.cells){
    if (!cell) continue;
    totals[cell.id] = (totals[cell.id] || 0) + cell.count;
  }
  return totals;
}
function sameTotals(totals, need){
  const keys = new Set([...Object.keys(totals), ...Object.keys(need)]);
  for (const id of keys) if ((totals[id] || 0) !== (need[id] || 0)) return false;
  return true;
}

/* 返回匹配到的配方；有形状的优先，其次是无序配方 */
function matchCraftRecipe(gridKey){
  const grid = craftGrid(gridKey);
  if (!grid.cells.some(Boolean)) return null;
  // 1) 有形状的配方：按图案摆放
  for (const rec of RECIPES){
    const compiled = compileShaped(rec);
    if (!compiled) continue;
    if (compiled.w > grid.size || compiled.h > grid.size) continue;
    if (matchShaped(compiled, grid)) return compiled;
  }
  const totals = gridTotals(grid);
  // 2) 无序配方：材料数量刚好匹配
  for (const rec of RECIPES){
    if (compileShaped(rec)) continue;
    if (sameTotals(totals, rec.need)) return { rec, shaped:false };
  }
  // 3) 无序配方：格子里放的是整组材料时，只要够用就按需求量消耗
  let best = null;
  for (const rec of RECIPES){
    if (compileShaped(rec)) continue;
    let total = 0, ok = true;
    for (const id in rec.need){
      total += rec.need[id];
      if ((totals[id] || 0) < rec.need[id]){ ok = false; break; }
    }
    if (!ok) continue;
    for (const id in totals){
      // 格子里不能有配方用不到的材料，否则容易误合成
      if (!(rec.need[id] > 0)){ ok = false; break; }
    }
    if (!ok) continue;
    if (!best || total > best.total) best = { rec, shaped:false, total };
  }
  return best;
}

/* 同一个配方是否会因为「已拥有」被拦下 */
function craftBlockedReason(rec){
  const it = ITEMS[rec.out];
  if (!it) return '未知物品';
  if (devModeEnabled && devIgnoreCraftRequirements) return '';
  if (G.tech < rec.tier) return '需要' + TECH_LEVELS[rec.tier].name;
  if (rec.table && !nearCraftingTable()) return '需要靠近工作台';
  if ((it.kind === 'weapon' || it.kind === 'armor' || it.kind === 'tool') && !it.firearm && (inv[rec.out] || 0) > 0)
    return '已拥有';
  return '';
}

/* 消耗一次合成所需的材料 */
function consumeCraftMatch(match, grid){
  if (match.shaped){
    for (const cell of grid.cells){
      if (!cell) continue;
      cell.count -= 1;
    }
    for (let i = 0; i < grid.cells.length; i++){
      if (grid.cells[i] && grid.cells[i].count <= 0) grid.cells[i] = null;
    }
    return;
  }
  const need = { ...match.rec.need };
  for (const cell of grid.cells){
    if (!cell) continue;
    const used = need[cell.id] || 0;
    if (used > 0){
      const take = Math.min(used, cell.count);
      cell.count -= take;
      need[cell.id] = used - take;
    }
  }
  for (let i = 0; i < grid.cells.length; i++){
    if (grid.cells[i] && grid.cells[i].count <= 0) grid.cells[i] = null;
  }
}

function giveCraftOutput(rec){
  addItem(rec.out, rec.count || 1);
  if (rec.out === 'woodSword') G.tutorialSword = true;
  if (rec.out === 'torch') G.tutorialTorch = true;
  if (window.PixelSurvivalAudio) PixelSurvivalAudio.play('craft', rec.out);
  if (window.PixelSurvivalModAPI) PixelSurvivalModAPI.emit('crafted', { id:rec.out, count:rec.count || 1 });
}

function developerCraftRecipe(rec){
  if(!devModeEnabled||!devIgnoreCraftRequirements||!rec||!ITEMS[rec.out]) return false;
  giveCraftOutput(rec);
  showToast('直接合成：'+ITEMS[rec.out].name+((rec.count||1)>1?' ×'+rec.count:''),'#7dffb0');
  spawnParticles(player.x,player.y-14,'#7dffb0',8);
  return true;
}

/* 点击产物格：制作一次（Shift 连续制作） */
function takeCraftOutput(gridKey, all){
  const grid = craftGrid(gridKey);
  const match = matchCraftRecipe(gridKey);
  if (!match){
    showToast('摆放的材料还不能合成任何物品', '#ffc080');
    return;
  }
  const rec = match.rec;
  const blocked = craftBlockedReason(rec);
  if (blocked){
    showToast(blocked === '需要靠近工作台'
      ? '需要工作台：合成工作台（木板×4）后右键放置并靠近'
      : blocked === '已拥有' ? '已拥有 ' + ITEMS[rec.out].name : blocked, '#ffb080');
    if (blocked === '需要靠近工作台') shake = 2;
    return;
  }
  // 光标上拿着东西时，把产物放进手里（MC 行为）
  if (craftHeld){
    if (craftHeld.id !== rec.out){
      showToast('先把手中的物品放回背包再取出产物', '#ffc080');
      return;
    }
    if (craftHeld.count + (rec.count || 1) > MAX_STACK) return;
    consumeCraftMatch(match, grid);
    craftHeld.count += rec.count || 1;
    if (window.PixelSurvivalAudio) PixelSurvivalAudio.play('craft', rec.out);
    return;
  }
  if (!all){
    consumeCraftMatch(match, grid);
    giveCraftOutput(rec);
    showToast('制作成功：' + ITEMS[rec.out].name + ((rec.count || 1) > 1 ? ' ×' + rec.count : ''), '#7dffb0');
    spawnParticles(player.x, player.y - 14, '#7dffb0', 8);
    return;
  }
  // Shift 连续制作，直到材料不足或配方改变
  let made = 0;
  for (let i = 0; i < MAX_STACK; i++){
    const current = matchCraftRecipe(gridKey);
    if (!current || current.rec !== rec) break;
    if (craftBlockedReason(current.rec)) break;
    consumeCraftMatch(current, grid);
    giveCraftOutput(current.rec);
    made++;
  }
  if (made > 0){
    showToast('已连续制作 ' + made + ' 次：' + ITEMS[rec.out].name, '#7dffb0');
    spawnParticles(player.x, player.y - 14, '#7dffb0', 8);
  }
}

/* 一键把配方材料摆进格子（配方手册点击） */
function autoFillRecipe(rec){
  const gridKey = craftingGridKey();
  const grid = craftGrid(gridKey);
  const compiled = compileShaped(rec);
  if (compiled && (compiled.w > grid.size || compiled.h > grid.size)){
    showToast('这个配方需要工作台的 3×3 合成格', '#ffc080');
    return false;
  }
  returnCraftingItems([gridKey]);
  const required = {};
  if (compiled){
    for (const line of compiled.pattern){
      for (const id of line){
        if (id) required[id] = (required[id] || 0) + 1;
      }
    }
  } else {
    Object.assign(required, rec.need);
  }
  for (const id in required){
    if ((inv[id] || 0) < required[id]){
      showToast('材料不足：' + ITEMS[id].name + ' ' + (inv[id] || 0) + '/' + required[id], '#ff7070');
      return false;
    }
  }
  if (compiled){
    const offX = Math.floor((grid.size - compiled.w) / 2);
    const offY = Math.floor((grid.size - compiled.h) / 2);
    for (let r = 0; r < compiled.h; r++){
      for (let c = 0; c < compiled.w; c++){
        const id = compiled.pattern[r][c];
        if (!id) continue;
        takeItem(id, 1);
        grid.cells[(offY + r) * grid.size + (offX + c)] = { id, count:1 };
      }
    }
  } else {
    let index = 0;
    for (const id in required){
      const count = required[id];
      takeItem(id, count);
      grid.cells[index++] = { id, count };
    }
  }
  showToast('已摆放：' + ITEMS[rec.out].name, '#a8e0ff');
  return true;
}

/* ── 鼠标点击分发（背包 / 合成界面共用） ─────── */
function slotAt(x, y){
  // 点击容差：槽位四周各放宽 2px，小屏幕上更好点中
  for (let i = uiButtons.length - 1; i >= 0; i--){
    const b = uiButtons[i];
    if (!b.slot) continue;
    // 容差 2px：贴着格子边缘点也能命中
    if (x >= b.x - 2 && x <= b.x + b.w + 2 && y >= b.y - 2 && y <= b.y + b.h + 2) return b;
  }
  return null;
}
function buttonAt(x, y){
  for (let i = uiButtons.length - 1; i >= 0; i--){
    const b = uiButtons[i];
    if (b.slot) continue;
    // 容差 2px：贴着格子边缘点也能命中
    if (x >= b.x - 2 && x <= b.x + b.w + 2 && y >= b.y - 2 && y <= b.y + b.h + 2) return b;
  }
  return null;
}

function handlePanelClick(x, y, button, shift){
  const right = button === 2;
  const slotButton = slotAt(x, y);
  if (slotButton){
    clickItemSlot(slotButton.slot, right, !!shift);
    return;
  }
  const b = buttonAt(x, y);
  if (b && b.fn) b.fn();
}

function depositHeld(){
  if (!craftHeld) return false;
  depositItem(craftHeld.id, craftHeld.count);
  craftHeld = null;
  recalcEquipment();
  return true;
}

function clickItemSlot(slot, right, shift){
  const key = craftingGridKey();
  const grid = craftGrid(slot.grid || key);

  if (slot.kind === 'output'){
    takeCraftOutput(slot.grid || key, !!shift);
    return;
  }

  if (slot.kind === 'trash'){
    if (craftHeld){
      const { id, count } = craftHeld;
      delete inv[id];
      inventoryOrder = inventoryOrder.filter(itemId => itemId !== id);
      clearHotbarItem(id);
      const slot = bagSlots.indexOf(id);
      if (slot >= 0) bagSlots[slot] = null;
      craftHeld = null;
      recalcEquipment();
      showToast('已丢弃 ' + ITEMS[id].name + ' ×' + count, '#c8c8c8');
    }
    return;
  }

  if (slot.kind === 'armor'){
    const equipped = player.equipment && player.equipment[slot.slotId];
    if (craftHeld){
      const item = ITEMS[craftHeld.id];
      const target = item && item.kind === 'armor' && (item.armorSlot || 'chestplate') === slot.slotId;
      if (!target){
        const label = (EQUIPMENT_ARMOR_SLOTS.find(s => s.id === slot.slotId) || {}).label || '防具';
        showToast('这个物品不能放进「' + label + '」槽位', '#ffc080');
        return;
      }
      // 装备：手上的护甲直接穿到身上，不留在背包里（避免出现两份）
      const previous = player.equipment[slot.slotId];
      const armorId = craftHeld.id;
      const extra = craftHeld.count - 1;
      craftHeld = null;
      if (extra > 0) depositItem(armorId, extra);
      player.equipment[slot.slotId] = armorId;
      if (previous && previous !== armorId) depositItem(previous, 1);
      recalcEquipment();
      showToast('已装备 ' + ITEMS[armorId].name, '#a8e0ff');
      return;
    }
    if (equipped){
      player.equipment[slot.slotId] = null;
      depositItem(equipped, 1);
      recalcEquipment();
      showToast('已卸下 ' + ITEMS[equipped].name, '#c8c8c8');
    }
    return;
  }

  if (slot.kind === 'bag' || slot.kind === 'hotbar'){
    const id = slot.kind === 'bag' ? slot.id : hotbar[slot.index];
    if (craftHeld){
      // 拿着的物品放到点中的格子：空格子→放到这个位置，已有物品→交换
      const held = craftHeld.id;
      if (id === held){ depositHeld(); return; }
      depositHeld();
      if (slot.kind === 'bag'){
        if (!id){ moveBagItemTo(held, slot.index === undefined ? 0 : slot.index); }
        else swapBagItems(held, id);
      }else{
        placeInHotbar(held, slot.index);
      }
      return;
    }
    if (!id) return;
    const have = inv[id] || 0;
    if (have <= 0) return;
    const take = right ? Math.min(Math.ceil(have / 2), MAX_STACK) : Math.min(have, MAX_STACK);
    takeItem(id, take);
    setHeld(id, take);
    recalcEquipment();
    return;
  }

  if (slot.kind === 'grid'){
    const index = slot.index;
    const cell = grid.cells[index];
    if (craftHeld){
      if (!cell){
        grid.cells[index] = right ? { id:craftHeld.id, count:1 } : { id:craftHeld.id, count:craftHeld.count };
        craftHeld.count -= right ? 1 : craftHeld.count;
        if (craftHeld.count <= 0) craftHeld = null;
      } else if (cell.id === craftHeld.id){
        const room = MAX_STACK - cell.count;
        if (room <= 0) return;
        const move = right ? Math.min(1, room) : Math.min(craftHeld.count, room);
        cell.count += move;
        craftHeld.count -= move;
        if (craftHeld.count <= 0) craftHeld = null;
      } else if (!right){
        // 交换
        const previous = { ...cell };
        grid.cells[index] = { id:craftHeld.id, count:craftHeld.count };
        setHeld(previous.id, previous.count);
      }
      return;
    }
    if (!cell) return;
    if (right){
      const half = Math.ceil(cell.count / 2);
      setHeld(cell.id, half);
      cell.count -= half;
      if (cell.count <= 0) grid.cells[index] = null;
    } else {
      setHeld(cell.id, cell.count);
      grid.cells[index] = null;
    }
    return;
  }
}

/* ── 通用绘制 ───────────────────────────────── */
function drawSlotItem(id, count, x, y, size){
  if (!id) return;
  drawItemIcon(ctx, id, x, y, size);
  if (count > 1){
    countText(count > MAX_STACK ? MAX_STACK : count, x + size - 1, y + size - 1);
  }
}
function slotHover(x, y, size){
  return mouse.x >= x && mouse.x <= x + size && mouse.y >= y && mouse.y <= y + size;
}
function paintSlotHover(x, y, size){
  R(x, y, size, size, 'rgba(255,255,255,0.34)');
}
function registerGridSlots(grid, originX, originY, cellSize, step){
  for (let i = 0; i < grid.cells.length; i++){
    const r = Math.floor(i / grid.size), c = i % grid.size;
    const x = originX + c * step, y = originY + r * step;
    uiButtons.push({ x, y, w:cellSize, h:cellSize, slot:{ kind:'grid', grid:grid.key, index:i } });
    if (slotHover(x, y, cellSize)){
      paintSlotHover(x, y, cellSize);
      const cell = grid.cells[i];
      if (cell) hoverCraftItem = { id:cell.id, count:cell.count };
    }
    const cell = grid.cells[i];
    if (cell) drawSlotItem(cell.id, cell.count, x, y, cellSize);
  }
}

/* ── 2×2 背包合成格（背包界面复用） ─────────── */
function drawInventoryCraftGrid(x, y){
  const grid = craftGrid('inv');
  registerGridSlots(grid, x, y, 16, 18);
  // 箭头（容器贴图已带，这里只标记位置）
  const match = matchCraftRecipe('inv');
  const outX = x + 56, outY = y + 10;
  uiButtons.push({ x:outX - 1, y:outY - 1, w:18, h:18, slot:{ kind:'output', grid:'inv' } });
  if (match){
    drawSlotItem(match.rec.out, match.rec.count || 1, outX, outY, 16);
    if (slotHover(outX - 1, outY - 1, 18)) hoverCraftItem = { id:match.rec.out, count:match.rec.count || 1 };
  }
  if (slotHover(outX - 1, outY - 1, 18)) paintSlotHover(outX, outY, 16);
}

/* ── 工作台：3×3 合成界面 ───────────────────── */
const CRAFT_PANEL = { x:16, y:52, w:176, h:166 };
const RECIPE_BOOK = { x:200, y:16, w:264, h:238 };
let craftBookScroll = 0;

function recipeBookList(){
  const list = [];
  for (const rec of RECIPES){
    if (!ITEMS[rec.out]) continue;
    if (recipeBookFilter === 'ready' && craftBlockedReason(rec)) continue;
    if (recipeBookFilter === 'tool' && !['weapon', 'tool', 'armor'].includes(ITEMS[rec.out].kind)) continue;
    if (recipeBookFilter === 'build' && !['placeable', 'material'].includes(ITEMS[rec.out].kind)) continue;
    list.push(rec);
  }
  return list;
}

function drawRecipeBook(){
  const bx = RECIPE_BOOK.x, by = RECIPE_BOOK.y, bw = RECIPE_BOOK.w, bh = RECIPE_BOOK.h;
  mcWindow(bx, by, bw, bh);
  txt('配方手册', bx + 8, by + 6, { size:8, bold:true, color:'#404040' });
  txt(devModeEnabled&&devIgnoreCraftRequirements?'点击配方直接合成':'点击配方自动摆放材料',
  bx + bw - 8, by + 7, { size:6, bold:true, color:'#666666', align:'right' });

  const filters = [['all', '全部'], ['ready', '可制作'], ['tool', '装备'], ['build', '建筑']];
  filters.forEach(([id, label], index) => {
    const fx = bx + 8 + index * 46, fy = by + 17;
    uiButton(fx, fy, 42, 12, label, { kind:recipeBookFilter === id ? 'green' : 'stone', size:6 });
    uiButtons.push({ x:fx, y:fy, w:42, h:12, fn:() => { recipeBookFilter = id; recipeBookPage = 0; craftBookScroll = 0; } });
  });

  // 开启开发者合成时也列出尚未解锁的配方。
  const allRecipes = recipeBookList();
  const list = devModeEnabled&&devIgnoreCraftRequirements
    ? allRecipes
    : allRecipes.filter(rec => (rec.tier || 0) <= (G.tech || 0));
  const lockedCount = allRecipes.length - list.length;
  const rows = 10;
  const pages = Math.max(1, Math.ceil(list.length / rows));
  recipeBookPage = clamp(recipeBookPage, 0, pages - 1);
  const start = recipeBookPage * rows;
  const rowH = 16, listTop = by + 33;
  if (lockedCount > 0){
    txt('另有 ' + lockedCount + ' 条配方需要更高科技（按 T 研究）', bx + 8, by + bh - 11,
      { size:6, bold:true, color:'#8a6a2f' });
  }

  for (let i = 0; i < rows && start + i < list.length; i++){
    const rec = list[start + i];
    const y = listTop + i * rowH;
    const enough = devModeEnabled&&devIgnoreCraftRequirements || (() => {
      const compiled = compileShaped(rec);
      if (!compiled) {
        for (const id in rec.need) if ((inv[id] || 0) < rec.need[id]) return false;
        return true;
      }
      // 形状配方按格子统计
      const required = {};
      let fits = compiled.w <= 3 && compiled.h <= 3;
      for (const line of compiled.pattern) for (const id of line) if (id) required[id] = (required[id] || 0) + 1;
      for (const id in required) if ((inv[id] || 0) < required[id]) return false;
      return fits;
    })();
    const hover = mouse.y >= y - 1 && mouse.y <= y + rowH - 2 && mouse.x >= bx + 4 && mouse.x <= bx + bw - 4;
    if (hover) R(bx + 4, y - 1, bw - 8, rowH - 1, 'rgba(255,255,255,0.18)');
    if (!enough) R(bx + 4, y - 1, bw - 8, rowH - 1, 'rgba(0,0,0,0.12)');
    drawItemIcon(ctx, rec.out, bx + 7, y, 14);
    txt(ITEMS[rec.out].name, bx + 24, y + 4, { size:7, bold:true, color: enough ? '#2f2f2f' : '#767676' });
    const needText = Object.entries(rec.need)
      .map(([id, count]) => ITEMS[id] ? ITEMS[id].name + '×' + count : id).join(' ');
    txt(needText, bx + 76, y + 4, { size:6, bold:true, color: enough ? '#4a4a4a' : '#8a8a8a' });
    if (rec.table) txt('台', bx + bw - 10, y + 4, { size:6, bold:true, color:'#8a6a2f', align:'right' });
    uiButtons.push({ x:bx + 4, y:y - 1, w:bw - 8, h:rowH - 1, fn:() => {
      if(devModeEnabled&&devIgnoreCraftRequirements) developerCraftRecipe(rec);
      else if (autoFillRecipe(rec)) recipeBookPage = recipeBookPage;
    } });
  }
  if (!list.length) txt('没有符合条件的配方', bx + bw / 2, by + 80, { size:7, bold:true, color:'#666666', align:'center' });

  const pagerY = by + bh - 32;
  uiButton(bx + 8, pagerY, 20, 13, '‹', { kind:'stone', size:8 });
  uiButtons.push({ x:bx + 8, y:pagerY, w:20, h:13, fn:() => { recipeBookPage = Math.max(0, recipeBookPage - 1); } });
  uiButton(bx + bw - 28, pagerY, 20, 13, '›', { kind:'stone', size:8 });
  uiButtons.push({ x:bx + bw - 28, y:pagerY, w:20, h:13, fn:() => { recipeBookPage = Math.min(pages - 1, recipeBookPage + 1); } });
  txt((recipeBookPage + 1) + ' / ' + pages + ' · 滚轮翻页', bx + bw / 2, pagerY + 4,
    { size:6, bold:true, color:'#4a4a4a', align:'center' });

  // 底部说明
  const tech = TECH_LEVELS[G.tech] || TECH_LEVELS[0];
  txt('科技：' + tech.name + ' · ' + (nearCraftingTable() ? '已连接工作台' : '附近没有工作台'),
    bx + 8, pagerY + 16, { size:6, bold:true, color: nearCraftingTable() ? '#2f6b2f' : '#8a3a2a' });
}

function drawCraftPanel(){
  hoverCraftItem = null;
  ctx.fillStyle = 'rgba(12,10,8,0.72)'; ctx.fillRect(0,0,W,H);
  const px = CRAFT_PANEL.x, py = CRAFT_PANEL.y, pw = CRAFT_PANEL.w, ph = CRAFT_PANEL.h;
  drawMcContainer('craftingTable', px, py, pw, ph);
  mcContainerTitle('合成台', px + 8, py + 6);
  txt('E / ESC 关闭', px + pw - 8, py + 7, { size:6, bold:true, color:'#555555', align:'right' });
  drawRecipeBook();

  // 3×3 格子
  const grid = craftGrid('table');
  registerGridSlots(grid, px + 30, py + 17, 16, 18);

  // 产物
  const match = matchCraftRecipe('table');
  const outX = px + 123, outY = py + 34;
  uiButtons.push({ x:outX - 4, y:outY - 4, w:24, h:24, slot:{ kind:'output', grid:'table' } });
  if (slotHover(outX - 4, outY - 4, 24)) paintSlotHover(outX - 4, outY - 4, 24);
  if (match){
    const blocked = craftBlockedReason(match.rec);
    ctx.globalAlpha = blocked ? 0.55 : 1;
    drawSlotItem(match.rec.out, match.rec.count || 1, outX, outY, 16);
    ctx.globalAlpha = 1;
    if (slotHover(outX - 4, outY - 4, 24)) hoverCraftItem = { id:match.rec.out, count:match.rec.count || 1 };
  }

  drawCraftPlayerInventory(px, py, pw);

  // 状态提示（画在窗口下方的深色条上，避免压住快捷栏）
  R(px, py + ph + 4, pw, 11, 'rgba(0,0,0,0.62)');
  let statusText = '把材料放进 3×3 格子，或点击右侧配方';
  let statusColor = '#e7e7e7';
  if (!nearCraftingTable()){
    statusText = '附近没有工作台 · 合成台类配方不可制作';
    statusColor = '#ffb080';
  } else if (match){
    const blocked = craftBlockedReason(match.rec);
    statusText = blocked ? blocked : '点击产物取走 · Shift 连续制作';
    statusColor = blocked ? '#ffb080' : '#9df0a8';
  }
  txt(statusText, px + pw / 2, py + ph + 6, { size:6, bold:true, color:statusColor, align:'center' });
  drawHeldStack();
}

/* 背包 + 快捷栏（合成界面里的 3×9 + 1×9） */
function drawCraftPlayerInventory(px, py, pw){
  const bag = drawBagSlots(px + 8, py + 84, 3, 9, 18);
  drawHotbarRow(px + 8, py + 142, 18);
  if (bag.pages > 1){
    const pagerY = py + 71;
    uiButton(px + 138, pagerY, 11, 9, '‹', { kind:'stone', size:7 });
    uiButtons.push({ x:px + 138, y:pagerY, w:11, h:9, fn:() => { inventoryPage = Math.max(0, inventoryPage - 1); } });
    uiButton(px + 158, pagerY, 11, 9, '›', { kind:'stone', size:7 });
    uiButtons.push({ x:px + 158, y:pagerY, w:11, h:9, fn:() => { inventoryPage = Math.min(bag.pages - 1, inventoryPage + 1); } });
    txt((inventoryPage + 1) + '/' + bag.pages, px + 154, pagerY + 1,
      { size:6, bold:true, color:'#404040', align:'center' });
  }
}

function bagItemList(){
  return inventoryOrder.filter((id, index) =>
    inventoryOrder.indexOf(id) === index && (inv[id] || 0) > 0 && !hotbar.includes(id));
}
let inventoryPage = 0;

/* 把物品放进背包的指定格子（被占用时交换） */
function moveBagItemTo(id, absoluteIndex){
  syncBagSlots();
  const from = bagSlots.indexOf(id);
  if (from < 0) return;
  const target = Math.max(0, Math.min(BAG_SLOTS - 1, Math.round(absoluteIndex)));
  if (from === target) return;
  const displaced = bagSlots[target];
  bagSlots[target] = id;
  bagSlots[from] = displaced || null;
  syncBagSlots();
  recalcEquipment();
}

/* 交换背包里两个物品的位置 */
function swapBagItems(idA, idB){
  syncBagSlots();
  const a = bagSlots.indexOf(idA), b = bagSlots.indexOf(idB);
  if (a < 0 || b < 0) return;
  bagSlots[a] = idB; bagSlots[b] = idA;
  syncBagSlots();
  recalcEquipment();
}

/* 把物品放进快捷栏指定格 */
function placeInHotbar(id, index){
  if (index < 0 || index >= HOTBAR_SIZE) return;
  const previous = hotbar[index];
  const from = hotbar.indexOf(id);
  if (from === index) return;
  hotbar[index] = id;
  if (from >= 0 && from !== index) hotbar[from] = previous && previous !== id ? previous : null;
  syncBagSlots();
  recalcEquipment();
}

function drawBagSlots(originX, originY, rows, cols, step){
  syncBagSlots();
  const perPage = rows * cols;
  const pages = BAG_SLOT_PAGES;
  inventoryPage = clamp(inventoryPage, 0, pages - 1);
  const offset = inventoryPage * perPage;
  for (let i = 0; i < perPage; i++){
    const r = Math.floor(i / cols), c = i % cols;
    const x = originX + c * step, y = originY + r * step;
    const index = offset + i;
    const id = bagSlots[index] || null;
    uiButtons.push({ x, y, w:16, h:16, slot:{ kind:'bag', id, index } });
    if (slotHover(x, y, 16) && id){
      paintSlotHover(x, y, 16);
      hoverCraftItem = { id, count:inv[id] || 0 };
    }
    if (id) drawSlotItem(id, inv[id] || 0, x, y, 16);
  }
  return { pages, page:inventoryPage };
}

function drawHotbarRow(originX, originY, step){
  for (let i = 0; i < HOTBAR_SIZE; i++){
    const x = originX + i * step, y = originY;
    const id = hotbar[i];
    uiButtons.push({ x, y, w:16, h:16, slot:{ kind:'hotbar', index:i } });
    if (slotHover(x, y, 16)){
      paintSlotHover(x, y, 16);
      if (id && (inv[id] || 0) > 0) hoverCraftItem = { id, count:inv[id] || 0 };
    }
    if (id && (inv[id] || 0) > 0) drawSlotItem(id, inv[id] || 0, x, y, 16);
    else if (id){ ctx.globalAlpha = 0.3; drawItemIcon(ctx, id, x, y, 16); ctx.globalAlpha = 1; }
  }
}

/* ── 科技面板（保留原有内容） ───────────────── */
function upgradeFarmTech(){
  const level=G.farmTech||0, tech=FARM_TECH[level];
  if(!tech){showToast('农业科技已满级','#a8efaa');return;}
  for(const id in tech.cost){if((inv[id]||0)<tech.cost[id]){showToast('农业研究材料不足：'+ITEMS[id].name+' '+(inv[id]||0)+'/'+tech.cost[id],'#ffb080');return;}}
  for(const id in tech.cost)takeItem(id,tech.cost[id]);
  G.farmTech=level+1;showToast('农业研究完成：'+tech.name,'#a8efaa');spawnParticles(player.x,player.y-12,'#9acb70',10);
}

function drawTechPanel(){
  drawMcBackdrop(0.62);
  const pw=408, ph=218, px=(W-pw)/2, py=(H-ph)/2;
  uiPanel(px, py, pw, ph, { title:'科技研究' });
  txt('T / ESC 关闭', px+pw-10, py+10, { size:7, bold:true, color:'#555555', align:'right' });
  txt('当前：'+TECH_LEVELS[G.tech].name+'　击杀 '+G.kills+'　存活第 '+G.day+' 天', px+12, py+27, { size:7, bold:true, color:'#555555' });
  const pageCount=Math.max(1,Math.ceil((TECH_LEVELS.length-1)/2));
  techPage=clamp(techPage,0,pageCount-1);
  for (let level=1+techPage*2; level<Math.min(TECH_LEVELS.length,3+techPage*2); level++){
    const tech=TECH_LEVELS[level];
    const cardX=px+12+(level-1-techPage*2)*194, cardY=py+41, cardW=184, cardH=132;
    const unlocked=G.tech>=level;
    const requirement=technologyRequirement(level);
    uiPanel(cardX, cardY, cardW, cardH, { fill: unlocked?'#cfe0bd':'#bdbdbd' });
    txt(tech.name, cardX+12, cardY+10, { size:8, bold:true, color: unlocked?'#2f4d1d':'#5a5a5a' });
    txt('解锁：'+tech.unlock, cardX+10, cardY+32, { size:6, bold:true, color:'#555555' });
    txt('生存到第 '+tech.day+' 天　'+(G.day>=tech.day?'✓':'未达成'), cardX+10, cardY+47, { size:6, bold:true, color: G.day>=tech.day?'#2f6b2f':'#8a3a2a' });
    txt('击败怪物 '+tech.kills+' 只　'+(G.kills>=tech.kills?'✓':'当前 '+G.kills), cardX+10, cardY+61, { size:6, bold:true, color: G.kills>=tech.kills?'#2f6b2f':'#8a3a2a' });
    let materialY=cardY+78;
    for (const id in tech.cost){
      const enough=unlocked||(inv[id]||0)>=tech.cost[id];
      drawItemIcon(ctx, id, cardX+9, materialY-2, 12);
      txt(ITEMS[id].name+'  '+(inv[id]||0)+'/'+tech.cost[id], cardX+26, materialY, { size:6, bold:true, color: enough?'#2f6b2f':'#8a3a2a' });
      materialY+=15;
    }
    const btnX=cardX+9, btnY=cardY+cardH-26, btnW=cardW-18;
    const label=unlocked?'已解锁':requirement.available?'研究进阶':'条件未满足';
    uiButton(btnX, btnY, btnW, 18, label, { kind: unlocked?'stone':requirement.available?'green':'stone', disabled: unlocked });
    if(!unlocked){
      uiButtons.push({ x:btnX, y:btnY, w:btnW, h:18, fn:upgradeTechnology });
    }
  }
  txt('科技页 '+(techPage+1)+'/'+pageCount+' · ←/→翻页', px+pw-12, py+27, { size:6, bold:true, color:'#555555', align:'right' });
  const farmY=py+ph-29, farmX=px+12, farmW=pw-24;
  const farmLv=G.farmTech||0, farmNext=FARM_TECH[farmLv];
  uiPanel(farmX, farmY, farmW, 14, { fill:'#bdbdbd' });
  txt('农业科技 '+farmLv+'/'+FARM_TECH.length+' · '+(farmNext?farmNext.name+'：'+farmNext.desc:'已满级'), farmX+5, farmY+4, { size:6, bold:true, color:'#3f3f3f' });
  if(farmNext){ const fx=farmX+farmW-65; uiButton(fx, farmY+1, 61, 12, '研究农业', { kind:'green' }); uiButtons.push({x:fx, y:farmY+1, w:61, h:12, fn:upgradeFarmTech}); }
  // 未解锁配方一览（按时代统计）
  const lockedByTier = {};
  for (const rec of RECIPES){
    const tier = rec.tier || 0;
    if (tier > G.tech) lockedByTier[tier] = (lockedByTier[tier] || 0) + 1;
  }
  const lockedTiers = Object.keys(lockedByTier).map(Number).sort((a, b) => a - b);
  let lockedText = '所有配方都已解锁';
  if (lockedTiers.length){
    const nextTier = lockedTiers[0];
    const names = RECIPES.filter(rec => (rec.tier || 0) === nextTier)
      .slice(0, 4).map(rec => (ITEMS[rec.out] || {}).name || rec.out);
    const total = lockedByTier[nextTier];
    lockedText = '下一解锁 · ' + TECH_LEVELS[nextTier].name + '：' + names.join('、') +
      (total > names.length ? '…' : '') + '（共 ' + total + ' 条）';
    if (lockedTiers.length > 1) lockedText += ' · 另有 ' + (lockedTiers.length - 1) + ' 个时代未解锁';
  }
  txt(lockedText, W/2, py+ph-38,
    { size:6, bold:true, color: lockedTiers.length ? '#8a6a2f' : '#2f6b2f', align:'center' });
  txt(G.bloodMoon ? '血月怪物更强、数量更多；击败血月骑士可获得血月核心' : '每逢第 7 天夜晚触发血月，血月骑士会掉落稀有核心', W/2, py+ph-10, { size:6, bold:true, color: G.bloodMoon?'#8a3a2a':'#555555', align:'center' });
}
