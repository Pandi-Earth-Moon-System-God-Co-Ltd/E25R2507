'use strict';
/*
 * 用无头 Edge + CDP 给游戏截图，便于检查 UI 效果（不需要安装额外依赖）。
 *
 *   node tools/screenshot.js            # 输出到 docs/ui-*.png
 *   node tools/screenshot.js --keep     # 保留浏览器进程
 *
 * 依赖：本机安装的 Microsoft Edge（Chromium）。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs');
const PORT = 9333;
const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

const SETUP = {
  title: `
    panel = 'title';
    titleMenuHasSave = true;
  `,
  inventory: `
    panel = 'inventory';
    bagSlots = Array(BAG_SLOTS).fill(null);
    inventoryPage = 0;
    inv.wood = 12; inv.plank = 34; inv.stick = 12; inv.stone = 21; inv.copperIngot = 8;
    inv.crystal = 4; inv.woodSword = 1; inv.woodHelmet = 1; inv.smallPotion = 3;
    inv.berry = 6; inv.ironIngot = 6; inv.craftingTable = 1; inv.coal = 5; inv.fiber = 9;
    inventoryOrder = ['wood','plank','stick','stone','copperIngot','crystal','woodSword','woodHelmet',
      'smallPotion','berry','ironIngot','craftingTable','coal','fiber'];
    hotbar = ['woodSword','smallPotion','wood','plank','stick','coal',null,null,null];
    player.equipment.helmet = 'woodHelmet';
    bagSlots[0]='stone'; bagSlots[1]='copperIngot'; bagSlots[2]='crystal'; bagSlots[3]='woodHelmet';
    bagSlots[4]='berry'; bagSlots[5]='ironIngot'; bagSlots[6]='craftingTable'; bagSlots[7]='fiber';
    bagSlots[9]='coal'; bagSlots[12]='torch'; bagSlots[18]='bread'; bagSlots[24]='carrot';
    recalcEquipment();
    mouse.x = 300; mouse.y = 150;
  `,
  craft: `
    panel = 'craft';
    G.tech = 1;
    placedBlocks.push({ x: player.x + 12, y: player.y + 6, type: 'craftingTable', hp: 12 });
    returnCraftingItems();
    const g = craftGrid('table').cells;
    g[0] = { id: 'plank', count: 4 }; g[1] = { id: 'plank', count: 4 };
    g[3] = { id: 'plank', count: 4 }; g[4] = { id: 'plank', count: 4 };
    inv.wood = 12; inv.plank = 34; inv.stick = 12; inv.stone = 21; inv.copperIngot = 8;
    inv.crystal = 4; inv.ironIngot = 6; inv.coal = 5; inv.fiber = 9; inv.berry = 6;
    inventoryOrder = ['wood','plank','stick','stone','copperIngot','crystal','ironIngot','coal','fiber','berry'];
    hotbar = ['plank','stick','wood',null,null,null,null,null,null];
    mouse.x = 150; mouse.y = 80;
  `,
  techLate: `
    panel = 'tech';
    G.tech = 3;
    G.day = 16;
    G.kills = 34;
    techPage = 1;
    clearInput();
  `,
  tech: `
    panel = 'tech';
    G.tech = 1; G.kills = 12; G.day = 9;
    mouse.x = 240; mouse.y = 140;
  `,
  pause: `
    panel = 'pause';
    mouse.x = 240; mouse.y = 200;
  `,
  settings: `
    panel = 'settings';
    mouse.x = 240; mouse.y = 160;
  `,
  skills: `
    panel = 'skills';
    G.skillXP = 120; G.unlockedSkills = ['spin','dash'];
    mouse.x = 240; mouse.y = 140;
  `,
  growth: `
    panel = 'growth';
    G.growth.points = 3; G.growth.level = 4;
    mouse.x = 240; mouse.y = 140;
  `,
  guide: `
    panel = 'guide'; guideReturnPanel = 'pause'; guidePage = 0;
    mouse.x = 240; mouse.y = 140;
  `,
  character: `
    panel = 'character'; characterReturnPanel = 'pause';
    mouse.x = 240; mouse.y = 140;
  `,
  saves: `
    panel = 'saves'; savePanelReturn = 'pause';
    mouse.x = 240; mouse.y = 140;
  `,
  ach: `
    panel = 'ach';
    G.ach = { first: true, day7: true };
    mouse.x = 240; mouse.y = 140;
  `,
  machine: `
    panel = 'machine';
    selectedMachine = { type:'copperFurnace', x:player.x+8, y:player.y, hp:20, dir:0,
      input:{ copperOre:4 }, output:{ copperIngot:2 }, fuel:3, progress:3, power:0, activeRecipe:'smeltCopper' };
    mouse.x = 240; mouse.y = 140;
  `,
  trade: `
    panel = 'trade';
    selectedVillager = { name:'阿禾', job:'农夫' };
    inv.coin = 24;
    mouse.x = 240; mouse.y = 140;
  `,
  game3d: `
    panel = null;
    if (window.PixelGfx) PixelGfx.set({ view: 'third' });
    mouse.x = 240; mouse.y = 135;
  `,
  village: `
    panel = null;
    if (window.PixelGfx) PixelGfx.set({ view: 'third', camera: 'top' });
    if (villagers.length){
      player.x = villagers[0].x; player.y = villagers[0].y + 34;
      player.vx = 0; player.vy = 0;
      updateWorldChunks();
      if (window.Pixel3D) Pixel3D.invalidate();
    }
    mouse.x = 240; mouse.y = 135;
  `,
  forest: `
    panel = null;
    if (window.PixelGfx) PixelGfx.set({ view: 'third', camera: 'iso' });
    if (trees.length){
      player.x = trees[0].x + 26; player.y = trees[0].y + 26;
      player.vx = 0; player.vy = 0;
      updateWorldChunks();
      if (window.Pixel3D) Pixel3D.invalidate();
    }
    mouse.x = 240; mouse.y = 135;
  `,
  caveMouth: `
    panel = null;
    if (window.PixelGfx) PixelGfx.set({ view: 'third', camera: 'iso' });
    if (caveEntrances.length){
      player.x = caveEntrances[0].x + 34; player.y = caveEntrances[0].y + 58;
      player.vx = 0; player.vy = 0;
      updateWorldChunks();
      if (window.Pixel3D) Pixel3D.invalidate();
    }
    mouse.x = 240; mouse.y = 135;
  `,
  mapTop: `
    panel = null;
    if (window.PixelGfx) PixelGfx.set({ view: 'third', camera: 'top' });
    if (window.Pixel3D) Pixel3D.zoom(1.5);
    mouse.x = 240; mouse.y = 135;
  `,
  game2d: `
    panel = null;
    if (window.PixelGfx) PixelGfx.set({ engine: '2d' });
    mouse.x = 240; mouse.y = 135;
  `,
  firstPersonTrees: `
    panel = null;
    if (trees.length){
      player.x = trees[0].x + 20; player.y = trees[0].y + 24;
      player.vx = 0; player.vy = 0;
      updateWorldChunks();
      if (window.Pixel3D) Pixel3D.invalidate();
    }
    if (window.PixelGfx) PixelGfx.set({ view: 'first' });
    if (window.Pixel3D) Pixel3D.setViewMode('first');
    mouse.x = 240; mouse.y = 135;
  `,
  firstPerson: `
    panel = null;
    if (window.PixelGfx) PixelGfx.set({ view: 'first' });
    if (window.Pixel3D) Pixel3D.setViewMode('first');
    if (window.Pixel3D && Pixel3D.look) Pixel3D.look(0, 0);
  `,
  studio: `
    panel = null;
    GameEditor.state.tab = 'wizard';
    GameEditor.state.editing = null;
    GameEditor.state.draft = {};
    GameEditor.state.wizard = { kind:'weapon', id:'studio:my_weapon', name:'秘银长剑', power:12, tier:2, more:true, range:22, desc:'挥砍时带出一道秘银光刃',
      output:{ id:'stoneDust', count:1 }, fuel:'coal', drop:'wood', enemyRate:1, seed:1,
      materials:[{ id:'ironIngot', count:2 },{ id:'stick', count:1 }] };
    renderGameStudio();
  `,
  studioBlocks: `
    panel = null;
    GameEditor.state.tab = 'blocks';
    GameEditor.state.draft = {};
    renderGameStudio();
  `,
  studioWorld: `
    panel = null;
    GameEditor.state.tab = 'maps';
    GameEditor.state.editing = null;
    GameEditor.state.draft = {};
    renderGameStudio();
  `,
  studioIndustry: `
    panel = null;
    GameEditor.state.tab = 'machines';
    GameEditor.state.editing = null;
    GameEditor.state.draft = {};
    renderGameStudio();
  `,
  studioSkills: `
    panel = null;
    GameEditor.state.tab = 'skills';
    GameEditor.state.draft = {};
    renderGameStudio();
  `,
  studioMods: `
    panel = null;
    GameEditor.state.tab = 'mods';
    renderGameStudio();
  `,
};

function findBrowser() {
  for (const candidate of EDGE_CANDIDATES) if (fs.existsSync(candidate)) return candidate;
  throw new Error('未找到 Edge / Chrome，无法截图');
}

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    const cdp = new CDP(ws);
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id && cdp.pending.has(message.id)) {
        const { resolve } = cdp.pending.get(message.id);
        cdp.pending.delete(message.id);
        resolve(message);
      } else if (message.method) cdp.events.push(message);
    });
    return cdp;
  }
  send(method, params) {
    const id = ++this.id;
    return new Promise(resolve => {
      this.pending.set(id, { resolve });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async evaluate(expression) {
    const reply = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, userGesture: true,
    });
    const result = reply.result || {};
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception && result.exceptionDetails.exception.description;
      throw new Error('页面脚本异常：' + (text || result.exceptionDetails.text));
    }
    return result.result ? result.result.value : undefined;
  }
}

async function main() {
  const browser = findBrowser();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-shot-'));
  const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
  const child = spawn(browser, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio',
    '--allow-file-access-from-files',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1440,810',
    '--hide-scrollbars',
    url,
  ], { stdio: 'ignore' });

  let targets = null;
  for (let attempt = 0; attempt < 60 && !targets; attempt++) {
    await sleep(300);
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await response.json();
      targets = list.filter(target => target.type === 'page' && target.webSocketDebuggerUrl);
      if (!targets.length) targets = null;
    } catch (error) { /* 还没启动好 */ }
  }
  if (!targets) throw new Error('无法连接浏览器调试端口');

  const cdp = await CDP.connect(targets[0].webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  let ready = false;
  for (let attempt = 0; attempt < 40 && !ready; attempt++) {
    await sleep(250);
    try { ready = await cdp.evaluate('typeof render === "function" && typeof ITEMS === "object"'); } catch (error) { ready = false; }
  }
  if (!ready) throw new Error('游戏脚本未加载完成');

  console.log('3D 可用：', await cdp.evaluate('!!(window.Pixel3D && Pixel3D.active())'));
  console.log('引擎：', await cdp.evaluate('window.PixelGfx ? PixelGfx.get().engine : "无"'));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const names = process.argv.includes('--only')
    ? [process.argv[process.argv.indexOf('--only') + 1]]
    : Object.keys(SETUP);
  for (const name of names) {
    if (!SETUP[name]) continue;
    try {
      await cdp.evaluate(`(() => {
        if (panel === 'title'){ /* 保持 */ }
        if (typeof reset === 'function' && !window.__shotInit){ reset(); window.__shotInit = true; }
        mouse.active = true;
        ${SETUP[name]}
        render();
        return true;
      })()`);
      await sleep(450);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(OUT_DIR, 'ui-' + name + '.png');
      fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
      console.log('已保存', path.relative(ROOT, file));
    } catch (error) {
      console.error('截图失败', name, error.message);
    }
  }

  if (!process.argv.includes('--keep')) {
    child.kill();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (error) { /* ignore */ }
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
