'use strict';
/*
 * 端到端检查：用无头 Edge 真实点击背包 / 合成界面，验证
 *   1. 鼠标事件 → 面板点击分发
 *   2. 背包槽位与格子命中区域和 GUI 贴图对齐
 *   3. 拿起 / 放下材料、取出产物、材料放回背包
 *
 *   node tools/e2e-crafting.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = 9334;
const CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function findBrowser() {
  for (const candidate of CANDIDATES) if (fs.existsSync(candidate)) return candidate;
  throw new Error('未找到 Edge / Chrome');
}

async function main() {
  const browser = findBrowser();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-e2e-'));
  const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
  const child = spawn(browser, [
    '--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1440,810', '--hide-scrollbars', url,
  ], { stdio: 'ignore' });

  let target = null;
  for (let attempt = 0; attempt < 60 && !target; attempt++) {
    await sleep(300);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find(entry => entry.type === 'page' && entry.webSocketDebuggerUrl) || null;
    } catch (error) { /* 等待启动 */ }
  }
  if (!target) throw new Error('无法连接调试端口');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve } = pending.get(message.id);
      pending.delete(message.id);
      resolve(message);
    }
  });
  const send = (method, params) => new Promise(resolve => {
    const id = ++nextId;
    pending.set(id, { resolve });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  const evaluate = async expression => {
    const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    const result = reply.result || {};
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception;
      throw new Error((detail && detail.description) || result.exceptionDetails.text);
    }
    return result.result ? result.result.value : undefined;
  };

  await send('Runtime.enable');
  let ready = false;
  for (let attempt = 0; attempt < 40 && !ready; attempt++) {
    await sleep(250);
    try { ready = await evaluate('typeof render === "function" && typeof ITEMS === "object"'); } catch (error) { ready = false; }
  }
  if (!ready) throw new Error('游戏脚本未加载完成');

  let failures = 0;
  const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : ` 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`}`);
    if (!ok) failures++;
  };

  /* 把逻辑坐标换算成页面坐标后真实点击 */
  const clickAt = async (lx, ly) => {
    const point = await evaluate(`(() => {
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (${lx} / ${480}) * r.width, y: r.top + (${ly} / ${270}) * r.height };
    })()`);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button: 'left', clickCount: 1 });
    }
    await sleep(60);
  };
  const findSlot = async (expression) => evaluate(`(() => {
    const b = uiButtons.find(b => b.slot && (${expression}));
    return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null;
  })()`);

  /* 准备一个干净的状态：5 个木头，背包界面打开 */
  await evaluate(`(() => {
    reset();
    panel = 'inventory';
    inv = { wood: 5 };
    inventoryOrder = ['wood'];
    hotbar = Array(HOTBAR_SIZE).fill(null);
    recalcEquipment();
    render();
    return true;
  })()`);

  const woodSlot = await findSlot("b.slot.kind === 'bag' && b.slot.id === 'wood'");
  if (!woodSlot) throw new Error('没有找到木头所在的背包槽位');
  await clickAt(woodSlot.x, woodSlot.y);
  check('左键拿起木头', await evaluate('craftHeld && { id: craftHeld.id, count: craftHeld.count }'), { id: 'wood', count: 5 });

  const cell0 = await findSlot("b.slot.kind === 'grid' && b.slot.grid === 'inv' && b.slot.index === 0");
  if (!cell0) throw new Error('没有找到 2×2 合成格');
  await clickAt(cell0.x, cell0.y);
  check('放下材料后格子内容', await evaluate("craftGrid('inv').cells[0] && { id: craftGrid('inv').cells[0].id, count: craftGrid('inv').cells[0].count }"),
    { id: 'wood', count: 5 });
  check('手上已空', await evaluate('craftHeld'), null);

  const outputSlot = await findSlot("b.slot.kind === 'output'");
  if (!outputSlot) throw new Error('没有找到产物格');
  await clickAt(outputSlot.x, outputSlot.y);
  check('取出木板后的产出', await evaluate('({ plank: inv.plank || 0, rest: craftGrid("inv").cells[0] && craftGrid("inv").cells[0].count })'),
    { plank: 4, rest: 4 });

  /* 关闭界面后，剩余材料要回到背包 */
  await evaluate("panel = null; craftReturnOrphans();");
  check('关闭后材料回到背包', await evaluate('({ wood: inv.wood || 0, plank: inv.plank || 0 })'), { wood: 4, plank: 4 });
  check('合成格已清空', await evaluate("craftGrid('inv').cells.every(c => !c)"), true);

  /* 自由放置：点空格子把物品放到指定位置 */
  await evaluate(`(() => {
    reset();
    panel = 'inventory';
    inv = { wood: 4, plank: 2, stone: 3 };
    inventoryOrder = ['wood','plank','stone'];
    hotbar = Array(HOTBAR_SIZE).fill(null);
    bagSlots = Array(BAG_SLOTS).fill(null);
    bagSlots[0] = 'wood'; bagSlots[1] = 'plank'; bagSlots[2] = 'stone';
    recalcEquipment(); render(); return true;
  })()`);
  const bagWood = await findSlot("b.slot.kind === 'bag' && b.slot.id === 'wood'");
  const farSlot = await findSlot("b.slot.kind === 'bag' && !b.slot.id && b.slot.index === 20");
  if (!bagWood || !farSlot) throw new Error('没有找到背包槽位');
  await clickAt(bagWood.x, bagWood.y);
  await clickAt(farSlot.x, farSlot.y);
  check('物品放到指定空格', await evaluate("bagSlots[20] === 'wood' && bagSlots[0] === null"), true);
  check('拿起后仍能取回', await evaluate("(inv.wood||0) >= 1"), true);

  /* 拖动：从背包拖到合成格 */
  const bagPlank = await findSlot("b.slot.kind === 'bag' && b.slot.id === 'plank'");
  const craftCell = await findSlot("b.slot.kind === 'grid' && b.slot.grid === 'inv' && b.slot.index === 0");
  if (bagPlank && craftCell){
    const a = await evaluate(`(() => { const r = canvas.getBoundingClientRect(); return { x: r.left + (${bagPlank.x} / 480) * r.width, y: r.top + (${bagPlank.y} / 270) * r.height }; })()`);
    const b = await evaluate(`(() => { const r = canvas.getBoundingClientRect(); return { x: r.left + (${craftCell.x} / 480) * r.width, y: r.top + (${craftCell.y} / 270) * r.height }; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x, y: a.y, button: 'none' });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: a.x, y: a.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, button: 'left' });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await sleep(120);
    check('拖动到合成格生效', await evaluate("!!(craftGrid('inv').cells[0] && craftGrid('inv').cells[0].id === 'plank')"), true);
    check('拖动后手上已空', await evaluate('craftHeld'), null);
  }
  await evaluate("returnCraftingItems();");


  /* 工作台 3×3：按图案摆放木棍 */
  await evaluate(`(() => {
    reset();
    panel = 'craft';
    inv = { plank: 6 };
    inventoryOrder = ['plank'];
    hotbar = Array(HOTBAR_SIZE).fill(null);
    placedBlocks.push({ x: player.x + 10, y: player.y, type: 'craftingTable', hp: 10 });
    recalcEquipment();
    render();
    return true;
  })()`);
  const plankSlot = await findSlot("b.slot.kind === 'bag' && b.slot.id === 'plank'");
  const tableCell0 = await findSlot("b.slot.kind === 'grid' && b.slot.grid === 'table' && b.slot.index === 0");
  const tableCell3 = await findSlot("b.slot.kind === 'grid' && b.slot.grid === 'table' && b.slot.index === 3");
  if (!plankSlot || !tableCell0 || !tableCell3) throw new Error('没有找到工作台格子');
  await clickAt(plankSlot.x, plankSlot.y);
  await clickAt(tableCell0.x, tableCell0.y);   // 整组 6 个木板放进第一格
  check('3×3 第一格内容', await evaluate("craftGrid('table').cells[0] && craftGrid('table').cells[0].count"), 6);

  /* 用配方手册自动摆放木棍配方（2 木板竖排） */
  await evaluate("returnCraftingItems(); autoFillRecipe(RECIPES.find(r => r.out === 'stick')); render();");
  check('自动摆放木棍配方后匹配到木棍',
    await evaluate("(m => m && m.rec.out)(matchCraftRecipe('table'))"), 'stick');
  const craftOutput = await findSlot("b.slot.kind === 'output' && b.slot.grid === 'table'");
  await clickAt(craftOutput.x, craftOutput.y);
  check('取出木棍', await evaluate('({ stick: inv.stick || 0, plank: inv.plank || 0 })'), { stick: 4, plank: 4 });

  /* 装备护甲：背包里不应该再留一份 */
  await evaluate(`(() => {
    reset();
    panel = 'inventory';
    inv = { woodHelmet: 1 };
    inventoryOrder = ['woodHelmet'];
    hotbar = Array(HOTBAR_SIZE).fill(null);
    bagSlots = Array(BAG_SLOTS).fill(null);
    bagSlots[0] = 'woodHelmet';
    player.equipment = { helmet:null, chestplate:null, leggings:null, boots:null };
    recalcEquipment(); render(); return true;
  })()`);
  const helmetBag = await findSlot("b.slot.kind === 'bag' && b.slot.id === 'woodHelmet'");
  const helmetArmor = await findSlot("b.slot.kind === 'armor' && b.slot.slotId === 'helmet'");
  if (helmetBag && helmetArmor){
    await clickAt(helmetBag.x, helmetBag.y);
    await clickAt(helmetArmor.x, helmetArmor.y);
    check('护甲已穿到身上', await evaluate("player.equipment.helmet === 'woodHelmet'"), true);
    check('背包里不再有这件护甲', await evaluate("(inv.woodHelmet || 0) === 0"), true);
    check('背包槽位已清空', await evaluate("bagSlots.indexOf('woodHelmet') < 0"), true);
    await clickAt(helmetArmor.x, helmetArmor.y);
    check('卸下后回到背包', await evaluate("(inv.woodHelmet || 0) === 1 && !player.equipment.helmet"), true);
  }

  /* 创作工坊：打开 → 创建物品 → 关闭 */
  await evaluate("openGameStudio()");
  check('创作工坊已打开', await evaluate("!!document.querySelector('.ge-shell') && panel === 'studio'"), true);
  await evaluate(`(() => {
    GameEditor.state.tab = 'items';
    GameEditor.state.editing = null;
    GameEditor.state.draft = { id:'studio:e2e_item', name:'E2E 测试物品', desc:'端到端测试', kind:'material',
      color:'#b58cff', color2:'#644a8b' };
    renderGameStudio();
    GameEditor.save();
    return true;
  })()`);
  check('编辑器创建物品成功', await evaluate("!!ITEMS['studio:e2e_item']"), true);
  check('物品出现在内容列表', await evaluate("!!document.querySelector('.ge-item')"), true);
  await evaluate("closeGameStudio()");
  check('关闭编辑器回到游戏', await evaluate("panel !== 'studio'"), true);

  child.kill();
  await sleep(200);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (error) { /* ignore */ }
  if (failures) {
    console.error(`\n${failures} 项检查失败`);
    process.exit(1);
  }
  console.log('\n✓ 端到端检查通过：真实点击可以拿起 / 放下材料并取出产物');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
