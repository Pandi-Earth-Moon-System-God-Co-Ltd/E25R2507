/* ══════════════════════════════════════════════════════════
   输入
   ══════════════════════════════════════════════════════════ */
const orbitDrag = { active:false, x:0, y:0 };
let panelPressSlot = null;      // 背包界面按下的槽位，用于拖动放置
let inputLocked = true;         // F6 切换：屏蔽浏览器快捷键
let backGuardArmed = false;     // 是否已经塞入一条历史记录用来拦后退

/* 长按右键拖动、触控板滑动都会让浏览器后退，这里塞一条占位历史记录把它挡住 */
function armBackGuard(){
  if (!inputLocked || backGuardArmed) return;
  try{
    history.pushState({ pixelGuard:1 }, '', location.href);
    backGuardArmed = true;
  }catch(error){ /* file:// 下也可能被限制，忽略 */ }
}
window.addEventListener('popstate', () => {
  if (!inputLocked) return;
  try{ history.pushState({ pixelGuard:1 }, '', location.href); }catch(error){ /* ignore */ }
  showToast('已拦截浏览器后退 · 按 F6 可解锁输入', '#ffc080');
});
document.addEventListener('dragstart', event => {
  if (!isTextEntry(event.target)) event.preventDefault();
}, true);

function isTextEntry(target){
  return !!(target && target.closest && target.closest('input,textarea,select,[contenteditable="true"]'));
}

/* 右键菜单 / 鼠标侧键前进后退 / 中键自动滚动 都会误关页面，这里统一拦掉 */
document.addEventListener('contextmenu', event => {
  if (!isTextEntry(event.target)) event.preventDefault();
}, true);
document.addEventListener('auxclick', event => {
  if (event.button !== 0 && !isTextEntry(event.target)) event.preventDefault();
}, true);
document.addEventListener('mousedown', event => {
  if (event.button >= 1 && event.button !== 2 && !isTextEntry(event.target)) event.preventDefault();
}, true);
document.addEventListener('mouseup', event => {
  if (event.button >= 3 && !isTextEntry(event.target)) event.preventDefault();
}, true);

/* 输入锁定：阻止浏览器常用快捷键（Ctrl+W / Ctrl+T / Alt+← 等） */
window.addEventListener('keydown', event => {
  if (event.code === 'F6'){
    inputLocked = !inputLocked;
    showToast(inputLocked ? '输入已锁定 · 浏览器快捷键已屏蔽（F6 解锁）' : '输入已解锁 · 浏览器快捷键恢复', inputLocked ? '#9df0a8' : '#ffc080');
    return;
  }
  if (!inputLocked || isTextEntry(event.target)) return;
  const blocked = (event.ctrlKey || event.metaKey) &&
    ['KeyW','KeyT','KeyN','KeyR','KeyP','KeyS','KeyO','KeyD'].includes(event.code);
  const nav = event.altKey && ['ArrowLeft','ArrowRight'].includes(event.code);
  if (blocked || nav) event.preventDefault();
}, true);

function getMousePos(e){
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) / r.width  * W,
    y: (e.clientY - r.top ) / r.height * H,
  };
}

function firstPersonLocked(){
  return !!(window.Pixel3D && typeof Pixel3D.firstPerson === 'function' && Pixel3D.firstPerson());
}

window.addEventListener('keydown', e => {
  if(e.repeat) return;
  if(e.code==='F1'||e.code==='F2'||e.code==='F3'||e.code==='F5')e.preventDefault();
  if (['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code) ||
      /^Digit[1-9]$/.test(e.code)) e.preventDefault();
  if (keys[e.code]) return;
  keys[e.code] = true;
  onKeyPress(e.code);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

canvas.addEventListener('mousemove', e => {
  if (window.Pixel3D && Pixel3D.active() && document.pointerLockElement === canvas){
    mouse.x = W / 2; mouse.y = H / 2; mouse.active = true;
    return;
  }
  const p = getMousePos(e);
  mouse.x = p.x; mouse.y = p.y;
  mouse.active = true;
  if (orbitDrag.active && !panel && window.Pixel3D && Pixel3D.active() && !firstPersonLocked()){
    Pixel3D.orbitCamera(-(e.clientX - orbitDrag.x) * 0.008, (e.clientY - orbitDrag.y) * 0.006);
    orbitDrag.x = e.clientX; orbitDrag.y = e.clientY;
  }
});

/* 锁定鼠标后，第一人称与第三人称都使用相对移动控制视角。 */
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas || panel || !window.Pixel3D || !Pixel3D.active()) return;
  const dx = e.movementX || 0, dy = e.movementY || 0;
  if (firstPersonLocked() && typeof Pixel3D.look === 'function') Pixel3D.look(dx, dy);
  else if (typeof Pixel3D.orbitCamera === 'function') Pixel3D.orbitCamera(-dx * 0.0026, dy * 0.0022);
});

let lockGraceUntil = 0;   // 关面板后的宽限期，这段时间不自动弹暂停
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) return;
  if (performance.now() < lockGraceUntil) return;
  if (firstPersonLocked() && !panel && !G.gameOver){
    clearInput();
    panel = 'pause';
    showToast('已释放鼠标 · 点击画面可继续第一人称', '#a8e0ff');
  }
});

canvas.addEventListener('mousedown', e => {
  const p = getMousePos(e);
  mouse.x = p.x; mouse.y = p.y;
  if (firstPersonLocked()){
    mouse.x = W / 2; mouse.y = H / 2;
  }
  if (e.button === 1){
    e.preventDefault();
    if (panel) return;
    if (window.Pixel3D && Pixel3D.active() && !firstPersonLocked()){
      orbitDrag.active = true;
      orbitDrag.x = e.clientX; orbitDrag.y = e.clientY;
    }
    return;
  }
  armBackGuard();
  if (panel === 'inventory' || panel === 'craft' || panel === 'machine'){
    e.preventDefault();
    panelPressSlot = slotAt(p.x, p.y);
    handlePanelClick(p.x, p.y, e.button, e.shiftKey);
    return;
  }
  if (e.button === 2){
    if (panel) return;
    if (firstPersonLocked()){
      if (document.pointerLockElement !== canvas){ requestFirstPersonLock(); return; }
      useSelectedItem();
      return;
    }
    const { x0, y0, n } = hotbarLayout();
    if (p.y >= y0 - 3 && p.y <= y0 + SLOT + 3 && p.x >= x0 - 3 &&
        p.x <= x0 + n * (SLOT + SLOT_GAP) - SLOT_GAP + 3) return;
    useSelectedItem();
    return;
  }
  if (e.button !== 0) return;

  if (hitUI(p.x, p.y)) return;   // 点中了界面
  if (panel || G.gameOver) return;
  // 仅在游戏画面点击时锁定，避免打开界面时抢走鼠标。
  if (window.Pixel3D && Pixel3D.active() && document.pointerLockElement !== canvas &&
      typeof requestFirstPersonLock === 'function'){
    requestFirstPersonLock();
  }
  if (firstPersonLocked()){
    if (document.pointerLockElement !== canvas){ requestFirstPersonLock(); return; }
    mouse.down = true;
    return;
  }
  mouse.down = true;
});

window.addEventListener('mouseup', e => {
  if (e.button === 1){ orbitDrag.active = false; }
  if (e.button === 0){
    mouse.down = false;
    if (typeof player !== 'undefined' && player){
      player.chargeStart = 0; player.chargeRatio = 0; player.chargeStage = -1;
    }
    if (window.Pixel3D && typeof Pixel3D.zoom === 'function') Pixel3D.zoom(1);
  }
  if ((panel === 'inventory' || panel === 'craft' || panel === 'machine') && panelPressSlot){
    const p = getMousePos(e);
    const releaseSlot = slotAt(p.x, p.y);
    const same = releaseSlot && releaseSlot.x === panelPressSlot.x && releaseSlot.y === panelPressSlot.y;
    if (releaseSlot && !same && craftHeld) clickItemSlot(releaseSlot.slot, e.button === 2, false);
    panelPressSlot = null;
  }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (panel === 'craft'){
    recipeBookPage = Math.max(0, recipeBookPage + (e.deltaY > 0 ? 1 : -1));
    return;
  }
  if (panel === 'inventory'){
    inventoryPage = Math.max(0, inventoryPage + (e.deltaY > 0 ? 1 : -1));
    return;
  }
  if (e.shiftKey && !panel && window.Pixel3D && Pixel3D.active() && !firstPersonLocked()){
    Pixel3D.zoom(e.deltaY > 0 ? 1.06 : 0.94);
    return;
  }
  if (panel && panel !== 'inventory') return;
  selectHotbar((selectedHotbar + (e.deltaY > 0 ? 1 : -1) + HOTBAR_SIZE) % HOTBAR_SIZE);
}, { passive: false });

function selectHotbar(index){
  selectedHotbar = index;
  recalcEquipment();
}

function assignHotbar(index, id){
  if (index < 0 || index >= HOTBAR_SIZE || !(inv[id] > 0)) return;
  const existingIndex = hotbar.indexOf(id);
  const displaced = hotbar[index];
  if (existingIndex >= 0 && existingIndex !== index){
    hotbar[existingIndex] = displaced;
  }
  hotbar[index] = id;
  selectHotbar(index);
}

function hitUI(mx, my){
  for (let i = uiButtons.length - 1; i >= 0; i--){
    const b = uiButtons[i];
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h){
      if (b.fn) b.fn();
      return true;
    }
  }
  return false;
}

/* ── 第一人称视角切换（F5） ─────────────────── */
function requestFirstPersonLock(){
  if (!canvas.requestPointerLock){
    showToast('浏览器不支持鼠标锁定 · 可用中键拖动旋转视角', '#ffc080');
    return;
  }
  try{
    const result = canvas.requestPointerLock();
    if (result && typeof result.catch === 'function'){
      result.catch(error => {
        console.warn('[Pixel Survival] 鼠标锁定失败', error);
        showToast('鼠标锁定失败 · 请点击画面重试', '#ffc080');
      });
    }
  }catch(error){
    console.warn('[Pixel Survival] 鼠标锁定失败', error);
    showToast('鼠标锁定失败 · 请点击画面重试', '#ffc080');
  }
}
function toggleFirstPersonView(){
  if (!window.PixelGfx || typeof Pixel3D.setViewMode !== 'function') return;
  const next = PixelGfx.get().view === 'first' ? 'third' : 'first';
  if (next === 'first' && !(window.Pixel3D && Pixel3D.active())){
    showToast('第一人称需要 3D 体素渲染', '#ffb080');
    return;
  }
  PixelGfx.set({ view: next }, { toast: next === 'first' ? '第一人称视角 · 鼠标转动视角' : '第三人称视角' });
  if (next === 'first') requestFirstPersonLock();
  else if (document.exitPointerLock) document.exitPointerLock();
  clearInput();
}
function syncPointerLock(){
  if (!document.pointerLockElement && firstPersonLocked() && !panel) requestFirstPersonLock();
}

function onKeyPress(code){
  if(panel==='studio'){
    if(code==='Escape')closeGameStudio();
    return;
  }
  if(code==='F2'&&!G.gameOver){openGameStudio();return;}
  if(code==='F5' && !G.gameOver && (!panel || panel==='pause')){
    toggleFirstPersonView();
    return;
  }
  if(panel==='title'){
    if(code==='Enter'){
      if(titleMenuHasSave){panel=null;lockGraceUntil=performance.now()+900;clearInput();syncPointerLock();}
      else startNewGameFromMenu();
    }else if(code==='KeyN')startNewGameFromMenu();
    else if(code==='KeyJ'||code==='F1')openGuidePanel('title');
    else if(code==='KeyL'||code==='F3')openSettingsPanel('title');
    return;
  }
  if(panel==='settings'){
    if(code==='Escape'||code==='KeyL'||code==='F3'){closeSettingsPanel();syncPointerLock();}
    return;
  }
  if(panel==='machine'){
    if(code==='Escape'){panel=null;selectedMachine=null;}
    return;
  }
  if(panel==='trade'){if(code==='Escape'){panel=null;selectedVillager=null;}return;}
  if(panel==='character'){
    if(code==='Escape'){panel=characterReturnPanel;characterReturnPanel=null;syncPointerLock();return;}
    return;
  }
  if(code==='KeyJ' || code==='F1'){
    if(!G.gameOver){
      clearInput();
      if(panel==='guide'){panel=guideReturnPanel;guideReturnPanel=null;syncPointerLock();}
      else openGuidePanel(panel);
    }
    return;
  }
  if(panel==='ach'){if(code==='Escape'){panel=null;lockGraceUntil=performance.now()+900;syncPointerLock();}return;}
  if(code==='KeyN'&&!G.gameOver){clearInput();panel=panel==='skills'?null:'skills';return;}
  if(panel==='skills'){if(code==='Escape'){panel=null;lockGraceUntil=performance.now()+900;syncPointerLock();}return;}
  if(panel==='saves'){if(code==='Escape'||code==='KeyP'){panel=savePanelReturn;syncPointerLock();}return;}
  if(panel==='guide'){if(code==='Escape'){panel=guideReturnPanel;guideReturnPanel=null;syncPointerLock();}return;}
  if(code==='KeyM' && !panel && !G.gameOver){showMap=!showMap;return;}
  if (panel === 'growth'){
    if (code === 'Escape'){ panel=null; syncPointerLock(); return; }
    if (/^Digit[1-8]$/.test(code)) upgradeGrowth(Number(code.slice(-1))-1);
    return;
  }
  if (code === 'Escape'){
    if (panel === 'inventory'){ returnCraftingItems(['inv']); panel = null; lockGraceUntil = performance.now() + 900; syncPointerLock(); return; }
    if (panel === 'craft'){ returnCraftingItems(['table']); panel = null; lockGraceUntil = performance.now() + 900; syncPointerLock(); return; }
    if (panel === 'tech' || panel === 'pause' || panel === 'saves' || panel === 'skills') { panel = null; lockGraceUntil = performance.now() + 900; syncPointerLock(); return; }
    if (!G.gameOver) { panel = 'pause'; return; }
  }
  if (G.gameOver){
    if (code === 'KeyR') requestRestart();
    return;
  }
  if (panel === 'pause'){
    if (code === 'KeyR') requestRestart();
    return;
  }
  if (panel === 'craft'){
    if (code === 'Tab' || code === 'KeyC' || code === 'KeyE'){ returnCraftingItems(['table']); panel = code === 'KeyE' ? 'inventory' : null; return; }
    if (code === 'KeyT'){ returnCraftingItems(['table']); panel = 'tech'; return; }
    if (code === 'ArrowDown' || code === 'ArrowRight'){ recipeBookPage++; return; }
    if (code === 'ArrowUp' || code === 'ArrowLeft'){ recipeBookPage = Math.max(0, recipeBookPage - 1); return; }
    if (code === 'Enter'){ takeCraftOutput('table', false); return; }
    return;
  }
  if (panel === 'tech'){
    if (code === 'KeyT' || code === 'KeyE' || code === 'Tab'){ panel = null; lockGraceUntil = performance.now() + 900; syncPointerLock(); return; }
    if (code === 'ArrowRight'){techPage=Math.min(Math.max(0,Math.ceil((TECH_LEVELS.length-1)/2)-1),techPage+1);return;}
    if (code === 'ArrowLeft'){techPage=Math.max(0,techPage-1);return;}
    if (code === 'Enter') upgradeTechnology();
    return;
  }
  if (panel === 'inventory'){
    if (code === 'KeyC'){ returnCraftingItems(['inv']); panel = 'craft'; return; }
    if (code === 'KeyT'){ returnCraftingItems(['inv']); panel = 'tech'; return; }
    if (code === 'KeyE' || code === 'Tab'){ returnCraftingItems(['inv']); panel = null; lockGraceUntil = performance.now() + 900; syncPointerLock(); return; }
    if (/^Digit[1-9]$/.test(code)){
      selectHotbar(Number(code.slice(-1)) - 1);
    }
    return;
  }
  if (code === 'KeyB' && !G.gameOver && !panel){
    clearInput(); panel = 'growth'; return;
  }
  if (code === 'KeyE'){
    panel = 'inventory';
    if (document.exitPointerLock) document.exitPointerLock();
    return;
  }
  if (code === 'KeyT'){
    panel = 'tech';
    return;
  }
  if (code === 'Tab' || code === 'KeyC'){
    panel = 'craft';
    if (document.exitPointerLock) document.exitPointerLock();
    return;
  }
  if (/^Digit[1-9]$/.test(code)){
    const digit = Number(code.slice(-1));
    selectHotbar(digit - 1);
    return;
  }
  if (code === 'KeyZ'){ castSkill('spin'); return; }
  if (code === 'KeyX'){ castSkill('wave'); return; }
  if (code === 'KeyV'){ castSkill('ward'); return; }
  if (code === 'KeyY'){ castSkill('dash'); return; }
  if (code === 'KeyU'){ castSkill('nova'); return; }
  if (code === 'KeyH'){ useHealing(); return; }
  if (code === 'KeyF'){ if(G.inCave){ returnToSurface(); return; } tryUseCaveEntrance(); return; }
  if (code === 'KeyQ'){ placeTorch(); return; }
  if (code === 'Space'){
    if (window.Pixel3D && Pixel3D.active()) tryPlayerJump();
    else doAttack();
  }
}
