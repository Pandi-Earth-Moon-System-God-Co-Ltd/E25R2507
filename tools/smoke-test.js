'use strict';
/* eslint-disable no-console */
/*
 * 无浏览器冒烟测试：用最小 DOM / Canvas 桩加载全部游戏脚本，
 * 依次绘制标题、HUD、各个面板与第一人称渲染分支，捕获运行时异常。
 *
 *   node tools/smoke-test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/* ── Canvas 2D 桩 ─────────────────────────────── */
function makeContext(canvas) {
  const state = {
    canvas,
    font: '',
    fillStyle: '#000',
    strokeStyle: '#000',
    textAlign: 'left',
    textBaseline: 'top',
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: false,
  };
  const gradient = { addColorStop() {} };
  const real = {
    measureText(text) { return { width: String(text).length * 4.5 }; },
    createRadialGradient() { return gradient; },
    createLinearGradient() { return gradient; },
    createPattern() { return {}; },
    getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }; },
    putImageData() {},
    drawImage() {},
    setTransform() {},
    getContextAttributes() { return {}; },
  };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in real) return real[prop];
      if (prop in target) return target[prop];
      if (prop === 'then') return undefined;
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}

function makeCanvas(width = 480, height = 270) {
  const canvas = {
    width,
    height,
    style: {},
    nodeType: 1,
    tagName: 'CANVAS',
    getContext(type) {
      if (type === '2d') return (canvas._ctx || (canvas._ctx = makeContext(canvas)));
      return null; // WebGL 不可用 → 引擎退回 2.5D，测试不依赖 GL
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    requestPointerLock() {},
  };
  return canvas;
}

function makeElement(tag = 'div') {
  const el = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    className: '',
    style: {},
    dataset: {},
    children: [],
    textContent: '',
    innerHTML: '',
    files: [],
    value: '',
    hidden: false,
    _attrs: {},
    append(...nodes) { el.children.push(...nodes); },
    appendChild(node) { el.children.push(node); return node; },
    replaceChildren() { el.children.length = 0; },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    setAttribute(name, value) { el._attrs[name] = value; },
    getAttribute(name) { return el._attrs[name]; },
    removeAttribute(name) { delete el._attrs[name]; },
    querySelector(selector) { return findElement(el, selector); },
    querySelectorAll() { return []; },
    closest(selector) { return null; },
    focus() {},
    click() {},
    insertBefore(node) { el.children.push(node); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 20 }; },
  };
  if (tag === 'canvas') Object.assign(el, makeCanvas(64, 64));
  return el;
}

function walkElements(root, visit) {
  for (const child of root.children) {
    if (!child || typeof child !== 'object') continue;
    if (visit(child)) return true;
    if (child.children && walkElements(child, visit)) return true;
  }
  return false;
}

function findElement(root, selector) {
  let found = null;
  const nameMatch = /^\[name=["']?([^"'\]]+)["']?\]$/.exec(selector);
  walkElements(root, (node) => {
    if (nameMatch && node.name === nameMatch[1]) { found = node; return true; }
    if (selector.startsWith('.') && String(node.className || '').split(/\s+/).includes(selector.slice(1))) { found = node; return true; }
    if (/^[a-z0-9]+$/i.test(selector) && String(node.tagName).toLowerCase() === selector.toLowerCase()) { found = node; return true; }
    return false;
  });
  return found;
}

/* ── 全局环境 ─────────────────────────────────── */
const gameCanvas = makeCanvas(480, 270);
const elements = { game: gameCanvas, 'save-file-input': makeElement('input'), 'studio-file-input': makeElement('input'), 'game-studio': makeElement('div') };

class FakeImage {
  constructor() {
    this.complete = true;
    this.naturalWidth = 16;
    this.naturalHeight = 16;
    this.width = 16;
    this.height = 16;
    this._src = '';
  }
  set src(value) { this._src = value; }
  get src() { return this._src; }
  decode() { return Promise.resolve(); }
  addEventListener() {}
}

const storage = new Map();
const localStorage = {
  getItem(key) { return storage.has(String(key)) ? storage.get(String(key)) : null; },
  setItem(key, value) { storage.set(String(key), String(value)); },
  removeItem(key) { storage.delete(String(key)); },
  clear() { storage.clear(); },
  get length() { return storage.size; },
};

const errors = [];
const sandbox = {
  console: {
    log: (...args) => console.log(...args),
    warn: (...args) => console.warn('[warn]', ...args),
    error: (...args) => { errors.push(args.map(String).join(' ')); console.error('[error]', ...args); },
    info: () => {},
  },
  document: {
    getElementById(id) { return elements[id] || (elements[id] = makeElement('div')); },
    createElement(tag) { return makeElement(tag); },
    createTextNode(text) { return { textContent: text }; },
    addEventListener() {},
    removeEventListener() {},
    body: makeElement('body'),
    hidden: false,
    pointerLockElement: null,
    exitPointerLock() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  },
  window: null,
  localStorage,
  performance: { now: () => Date.now() },
  requestAnimationFrame() { return 1; },
  cancelAnimationFrame() {},
  Image: FakeImage,
  Audio: class { constructor(src){ this.src=src; this.volume=0; this.paused=true; } play(){ return Promise.resolve(); } pause(){} cloneNode(){ return new this.constructor(this.src); } },
  Blob: class { constructor(parts) { this.parts = parts; } },
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  FileReader: class { readAsDataURL() {} },
  navigator: { language: 'zh-CN', userAgent: 'node' },
  setTimeout, clearTimeout, setInterval, clearInterval,
  Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error, TypeError, Map, Set, WeakMap, Promise,
  Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array, Float32Array, Float64Array, Uint8ClampedArray,
  ArrayBuffer, DataView, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, escape, unescape,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.addEventListener = () => {};
sandbox.removeEventListener = () => {};
sandbox.innerWidth = 960;
sandbox.innerHeight = 540;
sandbox.devicePixelRatio = 1;
sandbox.AudioContext = undefined;
sandbox.webkitAudioContext = undefined;
sandbox.document.documentElement = makeElement('html');
sandbox.document.body = makeElement('body');
sandbox.document.addEventListener = () => {};
sandbox.document.removeEventListener = () => {};
vm.createContext(sandbox);

const scripts = [
  'js/core.js', 'js/theme.js', 'js/mc-textures.js', 'js/localization-ja.js', 'js/graphics.js',
  'js/world.js', 'js/input.js', 'js/player.js', 'js/pets.js', 'js/update.js', 'js/sprites.js',
  'js/item-icons.js', 'js/render3d.js', 'js/render.js', 'js/hud.js', 'js/tooltip.js',
  'js/crafting.js', 'js/panels.js', 'js/guns.js', 'js/skills.js', 'js/village.js', 'js/growth.js',
  'js/save.js', 'js/loop.js', 'js/mod-api.js', 'js/studio.js', 'js/editor.js', 'js/title-screen.js', 'mods/sample-effects.js', 'js/mc-sounds.js', 'assets/music/ambient.js',
  'js/settings-panel.js', 'assets/animations/world-effects.js', 'js/startup.js',
];

let loaded = 0;
for (const rel of scripts) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  try {
    vm.runInContext(code, sandbox, { filename: rel });
    loaded++;
  } catch (error) {
    errors.push(`${rel}: ${error.stack}`);
    console.error(`✗ ${rel}\n${error.stack}`);
  }
}
console.log(`已加载 ${loaded}/${scripts.length} 个脚本`);

/* ── 场景检查 ─────────────────────────────────── */
vm.runInContext(`
  window.__t = {
    get G(){ return G; },
    get player(){ return player; },
    get inv(){ return inv; },
    get mouse(){ return mouse; },
    get panel(){ return panel; },
    set panel(v){ panel = v; },
    get uiButtons(){ return uiButtons; },
    get ITEMS(){ return ITEMS; },
    get RECIPES(){ return RECIPES; },
    get CRAFT_GRIDS(){ return CRAFT_GRIDS; },
    get ctx2d(){ return ctx; },
    get craftHeld(){ return craftHeld; },
    set craftHeld(v){ craftHeld = v; },
    get hoverCraftItem(){ return hoverCraftItem; },
    set hoverCraftItem(v){ hoverCraftItem = v; },
    get hoverSlot(){ return hoverSlot; },
    set hoverSlot(v){ hoverSlot = v; },
    get STUDIO_MODULES(){ return STUDIO_MODULES; },
    set studioTab(v){ studioTab = v; },
    get selectedMachine(){ return selectedMachine; },
    set selectedMachine(v){ selectedMachine = v; },
    get selectedVillager(){ return selectedVillager; },
    set selectedVillager(v){ selectedVillager = v; },
    set nearCraftingTable(v){ nearCraftingTable = v; },
    get craftGrid(){ return craftGrid; },
    get autoFillRecipe(){ return autoFillRecipe; },
    get matchCraftRecipe(){ return matchCraftRecipe; },
    get takeCraftOutput(){ return takeCraftOutput; },
    get returnCraftingItems(){ return returnCraftingItems; },
    get resetCraftingState(){ return resetCraftingState; },
    get handlePanelClick(){ return handlePanelClick; },
    get drawTooltip(){ return drawTooltip; },
    get drawItemIcon(){ return drawItemIcon; },
    get renderGameStudio(){ return renderGameStudio; },
    get MCTextures(){ return window.MCTextures; },
    get Pixel3D(){ return window.Pixel3D; },
    get PixelGfx(){ return window.PixelGfx; },
  };
`, sandbox);
const T = sandbox.__t;
const ctx = sandbox;
function run(label, fn) {
  try {
    fn();
  } catch (error) {
    errors.push(`${label}: ${error.stack}`);
    console.error(`✗ ${label}\n${error.stack}`);
  }
}

run('reset + 首帧', () => {
  ctx.reset();
  ctx.panel = 'title';
  ctx.render();
});

const panels = ['title', 'pause', 'inventory', 'craft', 'tech', 'character', 'saves', 'growth', 'skills', 'ach', 'guide', 'settings', 'machine', 'trade'];
for (const name of panels) {
  run(`面板 ${name}`, () => {
    if (name === 'machine') {
      T.panel = 'machine';
      T.selectedMachine = { type: 'copperFurnace', x: 100, y: 100, input: { copperOre: 3 }, output: { copperIngot: 1 }, fuel: 2, progress: 1, power: 0, dir: 0, activeRecipe: null, hp: 100 };
    } else if (name === 'trade') {
      T.panel = 'trade';
      T.selectedVillager = { name: '阿禾', job: '农夫' };
    } else {
      T.panel = name;
    }
    T.mouse.x = 240;
    T.mouse.y = 135;
    for (let frame = 0; frame < 3; frame++) ctx.render();
  });
}

run('科技线：六个时代与机器', () => {
  const info = vm.runInContext(`(() => {
    const levels = TECH_LEVELS.map(level => level.name);
    const machines = ['arcFurnace','electrolyzer','centrifuge','highCompressor'].map(id => {
      const type = MACHINE_TYPES[id];
      return id + ':' + (type ? type.recipes.length : 0);
    });
    return { levels, machines, blocks: ['arcFurnace','electrolyzer','centrifuge','highCompressor']
      .every(id => ITEMS[id] && ITEMS[id].machineType === id) };
  })()`, sandbox);
  if (info.levels.length !== 6) throw new Error('科技等级数量不对：' + info.levels.join('／'));
  if (!info.blocks) throw new Error('新机器的方块物品没有注册');
  for (const line of info.machines) if (line.endsWith(':0')) throw new Error('机器没有配方：' + line);
  if (vm.runInContext("RECIPES.filter(r => r.tier === 4 || r.tier === 5).length", sandbox) < 4)
    throw new Error('高等级机器缺少合成配方');
});

run('合成：每个配方都能自动摆放并匹配', () => {
  T.panel = 'craft';
  T.G.tech = vm.runInContext('TECH_LEVELS.length - 1', sandbox);
  T.nearCraftingTable = () => true;
  const recipes = T.RECIPES.slice();
  for (const rec of recipes) {
    if (!rec.out || !T.ITEMS[rec.out]) continue;
    for (const id of Object.keys(rec.need)) if (!(T.inv[id] > 0)) T.inv[id] = 64;
    T.inv[rec.out] = 0;
    if (!T.autoFillRecipe(rec)) continue;
    const match = T.matchCraftRecipe('table');
    if (!match) throw new Error('自动摆放后无法匹配配方：' + rec.out);
    T.takeCraftOutput('table', false);
    if ((T.inv[rec.out] || 0) <= 0) throw new Error('配方未能产出：' + rec.out);
    T.returnCraftingItems();
  }
});

run('合成：2×2 背包格', () => {
  T.panel = 'inventory';
  T.inv.wood = 10;
  T.craftGrid('inv').cells[0] = { id: 'wood', count: 1 };
  if (!T.matchCraftRecipe('inv')) throw new Error('2×2 无法识别木板配方');
  T.returnCraftingItems();
});

run('点击所有槽位（背包 + 合成）', () => {
  T.panel = 'inventory';
  T.inv.wood = 8; T.inv.plank = 8; T.inv.berry = 5; T.inv.woodHelmet = 1;
  ctx.render();
  for (const button of T.uiButtons.slice()) {
    if (!button.slot) continue;
    T.handlePanelClick(button.x + 1, button.y + 1, 0, false);
    T.handlePanelClick(button.x + 1, button.y + 1, 2, false);
  }
  T.returnCraftingItems();
  T.panel = 'craft';
  T.nearCraftingTable = () => true;
  ctx.render();
  for (const button of T.uiButtons.slice()) {
    if (!button.slot) continue;
    T.handlePanelClick(button.x + 1, button.y + 1, 0, false);
  }
  T.returnCraftingItems();
});

run('第一人称视角切换（无 WebGL 时自动回退第三人称）', () => {
  T.panel = null;
  if (T.Pixel3D.active()) throw new Error('测试桩不应有 WebGL');
  T.PixelGfx.set({ view: 'first' });
  if (T.PixelGfx.get().view !== 'third') throw new Error('无 3D 时应回退第三人称');
  T.Pixel3D.setViewMode('first');
  if (T.Pixel3D.viewMode() !== 'first') throw new Error('setViewMode 未生效');
  if (T.Pixel3D.firstPerson()) throw new Error('无 3D 时 firstPerson 应为 false');
  T.Pixel3D.look(20, -10);
  const look = T.Pixel3D.lookState();
  if (!Number.isFinite(look.yaw) || !Number.isFinite(look.pitch)) throw new Error('视角状态无效');
  T.Pixel3D.setViewMode('third');
  if (T.Pixel3D.viewMode() !== 'third') throw new Error('第三人称未生效');
});

run('存档往返（含合成格物品）', () => {
  T.panel = 'craft';
  T.inv.wood = 5;
  T.craftGrid('table').cells[0] = { id: 'wood', count: 3 };
  const before = T.inv.wood;
  if (!ctx.saveGame(true)) throw new Error('保存失败');
  if (!ctx.hasSavedGame(0)) throw new Error('存档不存在');
  T.resetCraftingState();
  if (!ctx.loadGame(0)) throw new Error('读档失败');
  if ((T.inv.wood || 0) < before) throw new Error('合成格里的物品没有写进存档');
});

run('物品图标 / 提示框', () => {
  for (const id of Object.keys(T.ITEMS)) {
    if (!T.MCTextures.itemIcon(id) && !T.ITEMS[id].icon) throw new Error('缺少图标：' + id);
    T.drawItemIcon(T.ctx2d, id, 0, 0, 16);
  }
  T.panel = 'inventory';
  T.hoverCraftItem = { id: 'woodSword', count: 1 };
  T.drawTooltip();
  T.hoverCraftItem = null;
  T.panel = null;
  T.hoverSlot = 0;
  T.drawTooltip();
});

run('创作工坊：每个模块都能保存', () => {
  T.panel = null;
  const result = vm.runInContext(`(() => {
    const tabs = ['items','blocks','machines','skills','maps','blueprints'];
    const out = [];
    for (const tab of tabs){
      GameEditor.state.tab = tab;
      GameEditor.state.editing = null;
      GameEditor.state.draft = {};
      renderGameStudio();
      GameEditor.state.draft.id = 'studio:smoke_' + tab;
      GameEditor.state.draft.name = '冒烟 ' + tab;
      GameEditor.save();
      out.push(tab + '=' + (GameEditor.state.error || 'ok'));
    }
    return out;
  })()`, sandbox);
  for (const line of result){
    if (!line.endsWith('=ok')) throw new Error('保存失败：' + line);
  }
  const checks = vm.runInContext(`({
    item: !!modDefinitions.items['studio:smoke_items'],
    block: !!modDefinitions.blocks['studio:smoke_blocks'],
    machine: !!modDefinitions.machines['studio:smoke_machines'],
    skill: SKILLS.some(skill => skill.id === 'studio:smoke_skills'),
    map: !!modDefinitions.maps['studio:smoke_maps'],
    blueprint: modDefinitions.studioBlueprints.some(b => b.id === 'studio:smoke_blueprints')
  })`, sandbox);
  for (const [key, value] of Object.entries(checks)) if (!value) throw new Error('内容没有写入内容库：' + key);
  vm.runInContext("GameEditor.state.tab='media'; renderGameStudio(); GameEditor.state.tab='character'; renderGameStudio(); GameEditor.state.tab='mods'; renderGameStudio();", sandbox);
});

/* ── 汇总 ─────────────────────────────────────── */
if (errors.length) {
  console.error(`\n${errors.length} 个问题：`);
  for (const error of errors) console.error(' - ' + String(error).split('\n')[0]);
  process.exit(1);
}
console.log('✓ 冒烟测试通过：脚本加载、面板绘制、合成、存档、视角切换、Game Studio 均无异常');
