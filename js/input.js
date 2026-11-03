/* ══════════════════════════════════════════════════════════
   输入
   ══════════════════════════════════════════════════════════ */
function getMousePos(e){
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) / r.width  * W,
    y: (e.clientY - r.top ) / r.height * H,
  };
}

window.addEventListener('keydown', e => {
  if(e.repeat) return;
  if(e.code==='F1'||e.code==='F2')e.preventDefault();
  if (['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code) ||
      /^Digit[1-9]$/.test(e.code)) e.preventDefault();
  if (keys[e.code]) return;
  keys[e.code] = true;
  onKeyPress(e.code);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

canvas.addEventListener('mousemove', e => {
  const p = getMousePos(e);
  mouse.x = p.x; mouse.y = p.y;
  mouse.active = true;
});

canvas.addEventListener('mousedown', e => {
  const p = getMousePos(e);
  mouse.x = p.x; mouse.y = p.y;
  if (panel === 'inventory'){
    if (e.button !== 0) return;
    beginInventoryDrag(p.x, p.y);
    return;
  }
  if (e.button === 2){
    if (panel) return;
    const { x0, y0, n } = hotbarLayout();
    if (p.y >= y0 - 3 && p.y <= y0 + SLOT + 3 && p.x >= x0 - 3 &&
        p.x <= x0 + n * (SLOT + SLOT_GAP) - SLOT_GAP + 3) return;
    useSelectedItem();
    return;
  }
  if (e.button !== 0) return;

  if (hitUI(p.x, p.y)) return;   // 点中了界面
  if (panel || G.gameOver) return;
  mouse.down = true;
});

window.addEventListener('mouseup', e => {
  if (e.button === 0){
    mouse.down = false;
    if (panel === 'inventory'){
      const p = getMousePos(e);
      finishInventoryDrag(p.x, p.y);
    }
  }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (panel === 'craft'){ selectedRecipe = (selectedRecipe+(e.deltaY>0?1:-1)+RECIPES.length)%RECIPES.length; return; }
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

function inventorySlotAt(x, y){
  for (let i = uiButtons.length - 1; i >= 0; i--){
    const b = uiButtons[i];
    if (b.dragSlot === undefined && b.dragItem === undefined && b.dragEquipment === undefined &&
        !b.dragBag && !b.dragTrash) continue;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

function beginInventoryDrag(x, y){
  for(let i=uiButtons.length-1;i>=0;i--){
    const button=uiButtons[i];
    if(x>=button.x&&x<=button.x+button.w&&y>=button.y&&y<=button.y+button.h&&button.fn){
      button.fn();
      break;
    }
  }
  const slot = inventorySlotAt(x, y);
  if (!slot || slot.dragBag) inventoryDragSource = null;
  else if(slot.dragEquipment!==undefined){
    const id=player.equipment&&player.equipment[slot.dragEquipment];
    inventoryDragSource=id?{kind:'equipment',slot:slot.dragEquipment,id}:null;
  }else inventoryDragSource = slot.dragSlot !== undefined
    ? { kind:'hotbar', index:slot.dragSlot }
    : { kind:'bag', id:slot.dragItem };
}

function finishInventoryDrag(x, y){
  const source = inventoryDragSource;
  inventoryDragSource = null;
  if (!source) return;
  const target = inventorySlotAt(x, y);
  if (!target) return;

  if (target.dragTrash){
    discardInventoryItem(source);
  }else if(target.dragEquipment!==undefined){
    const id=source.kind==='hotbar'?hotbar[source.index]:source.id;
    const item=id&&ITEMS[id];
    if(item&&item.kind==='armor'&&(item.armorSlot||'chestplate')===target.dragEquipment){
      player.equipment[target.dragEquipment]=id;
      recalcEquipment();
    }
  } else if (source.kind === 'hotbar' && target.dragSlot !== undefined){
    const targetIndex = target.dragSlot;
    if (source.index === targetIndex){
      selectHotbar(targetIndex);
    } else {
      const item = hotbar[source.index];
      hotbar[source.index] = hotbar[targetIndex];
      hotbar[targetIndex] = item;
      selectHotbar(targetIndex);
    }
  } else if (target.dragSlot !== undefined && source.kind === 'bag'){
    assignHotbar(target.dragSlot, source.id);
  } else if (target.dragItem !== undefined && source.kind === 'hotbar'){
    assignHotbar(source.index, target.dragItem);
  } else if(source.kind==='equipment'&&target.dragSlot!==undefined){
    assignHotbar(target.dragSlot,source.id);
  } else if (target.dragBag && source.kind === 'hotbar'){
    hotbar[source.index] = null;
    selectHotbar(source.index);
  } else if (source.kind === 'bag' && target.dragItem !== undefined){
    const from = inventoryOrder.indexOf(source.id);
    const to = inventoryOrder.indexOf(target.dragItem);
    if (from >= 0 && to >= 0){
      inventoryOrder[from] = target.dragItem;
      inventoryOrder[to] = source.id;
    }
  }else if(source.kind==='equipment'&&(target.dragBag||target.dragItem!==undefined)){
    if(player.equipment[source.slot]===source.id){
      player.equipment[source.slot]=null;
      recalcEquipment();
    }
  }
}

function discardInventoryItem(source){
  const id = source.kind === 'hotbar' ? hotbar[source.index] : source.id;
  if (!id || !(inv[id] > 0)) return;
  delete inv[id];
  inventoryOrder = inventoryOrder.filter(itemId => itemId !== id);
  clearHotbarItem(id);
  if(source.kind==='equipment'&&player.equipment[source.slot]===id)player.equipment[source.slot]=null;
  recalcEquipment();
  showToast('已丢弃 ' + ITEMS[id].name, '#c8c8c8');
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

function onKeyPress(code){
  if(panel==='studio'){
    if(code==='Escape')closeGameStudio();
    return;
  }
  if(code==='F2'&&!G.gameOver){openGameStudio();return;}
  if(panel==='title'){
    if(code==='Enter'){
      if(titleMenuHasSave){panel=null;clearInput();}
      else startNewGameFromMenu();
    }else if(code==='KeyN')startNewGameFromMenu();
    else if(code==='KeyJ'||code==='F1')openGuidePanel('title');
    return;
  }
  if(panel==='machine'){
    if(code==='KeyK'){saveGame(true);return;}
    if(code==='Escape'){panel=null;selectedMachine=null;}
    return;
  }
  if(panel==='trade'){if(code==='Escape'){panel=null;selectedVillager=null;}return;}
  if(panel==='character'){
    if(code==='Escape'){panel=characterReturnPanel;characterReturnPanel=null;return;}
    return;
  }
  if(code==='KeyO' && !G.gameOver){
    clearInput();
    if(panel==='character'){panel=characterReturnPanel;characterReturnPanel=null;}
    else{characterReturnPanel=panel;panel='character';}
    return;
  }
  if(code==='KeyJ' || code==='F1'){
    if(!G.gameOver){
      clearInput();
      if(panel==='guide'){panel=guideReturnPanel;guideReturnPanel=null;}
      else openGuidePanel(panel);
    }
    return;
  }
  if(code==='KeyG' && !G.gameOver){clearInput();panel=panel==='ach'?null:'ach';return;}
  if(panel==='ach'){if(code==='Escape')panel=null;return;}
  if(code==='KeyN'&&!G.gameOver){clearInput();panel=panel==='skills'?null:'skills';return;}
  if(panel==='skills'){if(code==='Escape')panel=null;return;}
  if(panel==='saves'){if(code==='Escape'||code==='KeyP'){panel=savePanelReturn;return;}return;}
  if(panel==='guide'){if(code==='Escape'){panel=guideReturnPanel;guideReturnPanel=null;}return;}
  if(code==='KeyM' && !panel && !G.gameOver){showMap=!showMap;return;}
  if (code === 'KeyK'){ saveGame(true); return; }
  if (code === 'KeyB' && !G.gameOver){ clearInput(); panel = panel === 'growth' ? null : 'growth'; return; }
  if (panel === 'growth'){
    if (code === 'Escape'){ panel=null; return; }
    if (/^Digit[1-8]$/.test(code)) upgradeGrowth(Number(code.slice(-1))-1);
    return;
  }
  if (code === 'KeyP' && !G.gameOver){ clearInput(); panel = panel === 'pause' ? null : 'pause'; return; }
  if (code === 'KeyK'){ saveGame(true); return; }
  if (code === 'Escape'){
    if (panel === 'inventory' || panel === 'craft' || panel === 'tech' || panel === 'pause' || panel === 'saves' || panel === 'skills') { panel = null; return; }
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
    if (code === 'Tab' || code === 'KeyC'){ panel = null; return; }
    if (code === 'KeyT'){ panel = 'tech'; return; }
    if (code === 'ArrowDown'){ selectedRecipe = (selectedRecipe+1) % RECIPES.length; return; }
    if (code === 'ArrowUp'){ selectedRecipe = (selectedRecipe-1+RECIPES.length) % RECIPES.length; return; }
    if (code === 'Enter'){ craftRecipe(selectedRecipe); return; }
    return;
  }
  if (panel === 'tech'){
    if (code === 'KeyT' || code === 'KeyE' || code === 'Tab'){ panel = null; return; }
    if (code === 'ArrowRight'){techPage=Math.min(Math.max(0,Math.ceil((TECH_LEVELS.length-1)/2)-1),techPage+1);return;}
    if (code === 'ArrowLeft'){techPage=Math.max(0,techPage-1);return;}
    if (code === 'Enter') upgradeTechnology();
    return;
  }
  if (panel === 'inventory'){
    if (code === 'KeyC'){ panel = 'craft'; return; }
    if (code === 'KeyT'){ panel = 'tech'; return; }
    if (code === 'KeyE' || code === 'Tab'){ panel = null; return; }
    if (/^Digit[1-9]$/.test(code)){
      selectHotbar(Number(code.slice(-1)) - 1);
    }
    return;
  }
  if (code === 'KeyE'){
    panel = 'inventory';
    return;
  }
  if (code === 'KeyT'){
    panel = 'tech';
    return;
  }
  if (code === 'Tab' || code === 'KeyC'){
    panel = 'craft';
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
  if (code === 'KeyF'){ if(!tryUseCaveEntrance())eatBest(); return; }
  if (code === 'KeyQ'){ placeTorch(); return; }
  if (code === 'Space'){ doAttack(); }
}
