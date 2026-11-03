'use strict';

/* ══════════════════════════════════════════════════════════
   玩家行为
   ══════════════════════════════════════════════════════════ */
function useSelectedItem(){
  const id = hotbar[selectedHotbar];
  const it = ITEMS[id];
  const {x:wx,y:wy}=screenToWorld(mouse.x,mouse.y);
  const villager=villagers.find(entry=>Math.hypot(entry.x-wx,entry.y-wy)<18&&
    Math.hypot(entry.x-player.x,entry.y-player.y)<TILE*4);
  if(villager){openVillageTrade(villager);return;}
  const water=findRiverWaterAt(wx,wy);
  if(water){
    if(!(inv.emptyBottle>0)){showToast('需要空瓶才能从河流装水','#ffc080');return;}
    takeItem('emptyBottle',1);
    addItem('dirtyWater',1);
    showToast('已装入瓶装河水 · 可饮用或放入熔炉烧开','#a8e0ff');
    spawnParticles(water.x,water.y-3,'#83c7dc',5);
    return;
  }
  const animal=animals.find(entry=>Math.hypot(entry.x-wx,entry.y-wy)<18&&
    Math.hypot(entry.x-player.x,entry.y-player.y)<TILE*3);
  if(animal){
    if(animal.age<1){showToast('幼年动物还太小，先让它长大','#d8e0a0');return;}
    if(!['berry','wheat','carrot'].includes(id)||!(inv[id]>0)){
      showToast('手持浆果或作物喂养动物','#d8e0a0');return;
    }
    takeItem(id,1);
    animal.love=45;
    animal.breedCooldown=Math.max(0,animal.breedCooldown||0);
    spawnParticles(animal.x,animal.y-8,'#ffc7df',7);
    showToast('动物进入繁殖状态；附近同类也需要喂食','#ffc7df');
    if(window.PixelSurvivalAudio)PixelSurvivalAudio.play('feed',id);
    return;
  }
  const gate=placedBlocks.find(block=>block.type==='worldGate'&&
    Math.hypot(block.x-wx,block.y-wy)<TILE&&Math.hypot(block.x-player.x,block.y-player.y)<TILE*4);
  if(gate){activateWorldGate(gate);return;}
  const machine = machines.find(m => Math.hypot(m.x-wx,m.y-wy) < TILE &&
    Math.hypot(m.x-player.x,m.y-player.y) <= TILE*4);
  if (machine){ panel='machine'; selectedMachine=machine; machinePanelTab='input'; machinePanelPage=0; clearInput(); return; }
  const belt=belts.find(b=>Math.hypot(b.x-wx,b.y-wy)<TILE/2&&Math.hypot(b.x-player.x,b.y-player.y)<=TILE*4);
  if(belt){belt.dir=(belt.dir+1)%4;showToast('输送带方向已调整','#d5e0b0');return;}
  const ruin=ruins.find(r=>!r.opened&&Math.hypot(r.x-wx,r.y-wy)<TILE*1.5&&Math.hypot(r.x-player.x,r.y-player.y)<TILE*3);
  if(ruin){openRuin(ruin);return;}
  const tx=Math.floor(wx/FARM_TILE)*FARM_TILE+FARM_TILE/2, ty=Math.floor(wy/FARM_TILE)*FARM_TILE+FARM_TILE/2;
  const targetPlot=farmPlots.find(p=>p.x===tx&&p.y===ty);
  if(targetPlot&&targetPlot.crop&&targetPlot.growth>=1){farmAction(id&&ITEMS[id]&&ITEMS[id].kind==='seed'?id:null);return;}
  if (!it || !(inv[id] > 0)){ farmAction(null); return; }
  if (it.kind === 'food') useFood(id);
  else if (it.kind === 'seed') farmAction(id);
  else if (id === 'torch') placeTorch();
  else if (it.kind === 'placeable' && id !== 'torch') placeBlock(id);
}

function eatBest(){
  if (player.hp < player.maxHp * 0.55 && (inv.bandage || 0) > 0){ useFood('bandage'); return; }
  for (const id of ['cooked','berry','meat']){
    if ((inv[id] || 0) > 0){ useFood(id); return; }
  }
  showToast('没有食物了！', '#ff8080');
}

function useFood(id){
  if (G.gameOver || panel || !(inv[id] > 0)) return;
  const it = ITEMS[id];
  if (it.medicine){
    if (G.medicineCd>0){ showToast('药剂冷却中', '#ffc080'); return; }
    if (it.heal && player.hp>=player.maxHp){ showToast('生命已满，无需用药', '#a8e0ff'); return; }
    if (it.effect && G.effects[it.effect]>0){ showToast('同类增益仍在持续', '#a8e0ff'); return; }
    G.medicineCd=1;
    if(it.effect) G.effects[it.effect]=it.duration;
  }
  inv[id]--;
  if (inv[id] <= 0){
    delete inv[id];
    inventoryOrder = inventoryOrder.filter(itemId => itemId !== id);
    clearHotbarItem(id);
  }
  if(it.bottleReturn)addItem('emptyBottle',1);
  player.hunger = clamp(player.hunger + (it.hunger || 0), 0, player.maxHunger);
  player.thirst = clamp(player.thirst + (it.hydration || 0), 0, player.maxThirst);
  player.hp     = clamp(player.hp + (it.heal || 0), 0, player.maxHp);
  const parts = [];
  if(it.effect) parts.push(it.desc);
  if (it.hunger > 0) parts.push('+' + it.hunger + ' 饱食');
  if (it.hydration > 0) parts.push('+' + it.hydration + ' 水分');
  if (it.heal > 0)   parts.push('+' + it.heal + ' 生命');
  if (it.heal < 0)   parts.push(it.heal + ' 生命');
  showToast(it.name + '  ' + parts.join('  '), it.heal < 0 ? '#ff9090' : '#a8ffa8');
  if(window.PixelSurvivalAudio)PixelSurvivalAudio.play('eat',id);
  spawnParticles(player.x, player.y - 12, '#a0e0a0', 5);
  recalcEquipment();
}

function placeTorch(){
  if (!(inv.torch > 0)){ showToast('没有火把', '#ff8080'); return; }
  inv.torch--;
  if (inv.torch <= 0){
    delete inv.torch;
    inventoryOrder = inventoryOrder.filter(itemId => itemId !== 'torch');
    clearHotbarItem('torch');
  }
  torches.push({ x: player.x, y: player.y, t: 0 });
  spawnParticles(player.x, player.y - 8, '#ffb030', 8);
  showToast('火把已放置', '#ffd080');
  recalcEquipment();
}

function placeBlock(id){
  if (!(inv[id] > 0)){
    showToast('没有可放置的方块', '#ff8080');
    return;
  }
  const {x:wx,y:wy}=screenToWorld(mouse.x,mouse.y);
  const bx = Math.floor(wx / TILE) * TILE + TILE / 2;
  const by = Math.floor(wy / TILE) * TILE + TILE / 2;
  if (Math.hypot(bx - player.x, by - player.y) > TILE * 4){
    showToast('太远了，靠近一点再建造', '#ffb060');
    return;
  }
  if (Math.hypot(bx - player.x, by - player.y) < 14 ||
      placedBlocks.some(b => b.x === bx && b.y === by) ||
      machines.some(m => m.x === bx && m.y === by) ||
      belts.some(b => b.x === bx && b.y === by) ||
      ruins.some(r => Math.hypot(r.x-bx,r.y-by)<12) ||
      farmPlots.some(p => p.x === bx && p.y === by) ||
      trees.some(o => Math.hypot(o.x - bx, o.y - by) < o.r + 6) ||
      rocks.some(o => Math.hypot(o.x - bx, o.y - by) < o.r + 6) ||
      enemies.some(o => Math.hypot(o.x - bx, o.y - by) < o.r + 6)){
    showToast('这里放不下方块', '#ffb060');
    return;
  }
  if(ITEMS[id].powerWire){
    placedBlocks.push({x:bx,y:by,type:id,hp:3,r:7});
  } else if (ITEMS[id].beltType){
    const dx=bx-player.x,dy=by-player.y;
    belts.push({x:bx,y:by,dir:Math.abs(dx)>=Math.abs(dy)?(dx>=0?0:2):(dy>=0?1:3),timer:0});
  } else if (ITEMS[id].machineType){
    const type = MACHINE_TYPES[ITEMS[id].machineType];
    if (!type){ showToast('机器定义无效，无法放置', '#ff8080'); return; }
    const dx=bx-player.x,dy=by-player.y;
    machines.push({x:bx,y:by,type:ITEMS[id].machineType,hp:12,input:{},fuel:0,output:{},power:0,progress:0,activeRecipe:null,
      dir:Math.abs(dx)>=Math.abs(dy)?(dx>=0?0:2):(dy>=0?1:3)});
  } else {
    const properties=getStudioBlockProperties(id);
    const hardness=properties?properties.hardness:null;
    placedBlocks.push({ x:bx, y:by, type:id, hp:hardness|| (id === 'stoneBlock' ? 8 : 4), r:7 });
  }
  inv[id]--;
  if (inv[id] <= 0){
    delete inv[id];
    inventoryOrder = inventoryOrder.filter(itemId => itemId !== id);
    clearHotbarItem(id);
  }
  spawnParticles(bx, by - 4, ITEMS[id].color, 6);
  recalcEquipment();
}

function farmAction(seedId){
  const {x:wx,y:wy}=screenToWorld(mouse.x,mouse.y);
  const x = Math.floor(wx / FARM_TILE) * FARM_TILE + FARM_TILE/2;
  const y = Math.floor(wy / FARM_TILE) * FARM_TILE + FARM_TILE/2;
  if (Math.hypot(x-player.x,y-player.y) > FARM_TILE*4){ showToast('耕地/播种距离太远', '#ffb080'); return; }
  let plot = farmPlots.find(p=>p.x===x && p.y===y);
  if (!plot){
    if (placedBlocks.some(b=>b.x===x&&b.y===y) || machines.some(m=>m.x===x&&m.y===y) || belts.some(b=>b.x===x&&b.y===y) || trees.some(o=>Math.hypot(o.x-x,o.y-y)<o.r+3) || rocks.some(o=>Math.hypot(o.x-x,o.y-y)<o.r+3)) { showToast('这里无法耕作', '#ffb080'); return; }
    farmPlots.push({x,y,crop:null,growth:0,moisture:0.6});
    spawnParticles(x,y-2,'#9a7545',5); showToast('已开垦土地，再右键种子播种', '#d8c28a'); return;
  }
  if (plot.crop && plot.growth >= 1){
    const crop = plot.crop, cropDef = CROPS[crop];
    if (!cropDef){ showToast('作物定义不可用，无法收获', '#ff8080'); return; }
    const output = cropDef.output;
    const yieldCount=Math.ceil(cropDef.yield*(G.weather==='harvest'?1.5:getSeasonIndex()===2?1.15:1));
    addItem(output, yieldCount);
    const harvestSeed = cropDef.seedItem;
    const returnedSeed=G.farmTech>=3 && Math.random()<(FARM_TECH[2].seedReturnChance||0);
    addItem(harvestSeed,1+(returnedSeed?1:0));
    plot.crop=null; plot.growth=0; spawnParticles(x,y-5,cropDef.color,8);
    showToast('收获 '+ITEMS[output].name+' ×'+yieldCount+' · 种子 +'+(returnedSeed?2:1), '#a8efaa'); return;
  }
  if (plot.crop){ showToast('作物还没成熟 · '+Math.floor(plot.growth*100)+'%', '#d8e0a0'); return; }
  if (!seedId || !(inv[seedId]>0)){ showToast('先选择种子再右键播种', '#ffb080'); return; }
  const cropId = ITEMS[seedId].crop, cropDef = CROPS[cropId];
  if (!cropDef){ showToast('该种子没有有效作物定义', '#ff8080'); return; }
  takeItem(seedId,1); plot.crop=cropId; plot.growth=0;
  spawnParticles(x,y-4,'#9acb70',5); showToast('播种成功：'+cropDef.name, '#a8efaa');
}
function updateFarming(dt){
  const reductions=FARM_TECH.slice(0,G.farmTech||0).reduce((total,tech)=>total+(tech.growthReduction||0),0);
  const durationMultiplier=Math.max(0.45,1-reductions);
  const season=getSeasonIndex();
  if(SEASONS[season].crop===0||G.weather==='drought')return;
  const pollutionGrowth=G.pollution>=600?0.65:G.pollution>=300?0.82:1;
  const weatherGrowth=G.weather==='rain'?1.5:G.weather==='harvest'?1.25:1;
  for(const plot of farmPlots){
    const crop=CROPS[plot.crop];
    if(!crop||plot.growth>=1)continue;
    const daylight=G.dayTime>0.22&&G.dayTime<0.82?1:0.35;
    const nearbyWater=!!findRiverTileNear(plot.x,plot.y,TILE*5);
    plot.moisture=clamp((plot.moisture||0)+dt*((G.weather==='rain'?0.12:nearbyWater?0.025:-0.006)),0,1);
    const moisture=plot.moisture<0.18?0.35:0.65+plot.moisture*0.35;
    if(Math.random()<dt*0.18)
      plot.growth=Math.min(1,plot.growth+daylight*moisture*SEASONS[season].crop*
        weatherGrowth*pollutionGrowth/(crop.growthSeconds*durationMultiplier*0.18));
  }
}
function machineCapacityAllows(stock, contents){
  return Object.entries(contents).every(([id,count]) => (stock[id]||0)+count<=99);
}
function machineRecipeFor(machine){
  const type=MACHINE_TYPES[machine.type];
  return type && type.recipes.find(recipe=>recipe.id===machine.activeRecipe);
}
function buildPowerGrid(){
  const parent=new Map();
  const find=id=>{
    if(!parent.has(id))parent.set(id,id);
    const root=parent.get(id);
    if(root!==id)parent.set(id,find(root));
    return parent.get(id);
  };
  const join=(a,b)=>{
    const ra=find(a),rb=find(b);
    if(ra!==rb)parent.set(rb,ra);
  };
  const wireKey=(x,y)=>'w:'+x+','+y;
  const wireBlocks=placedBlocks.filter(block=>block.type==='powerWire');
  const wires=new Set(wireBlocks.map(block=>wireKey(block.x,block.y)));
  for(const block of wireBlocks){
    const key=wireKey(block.x,block.y);
    for(const [dx,dy] of [[TILE,0],[-TILE,0],[0,TILE],[0,-TILE]]){
      const neighbor=wireKey(block.x+dx,block.y+dy);
      if(wires.has(neighbor))join(key,neighbor);
    }
  }
  const machineNodes=machines.map((machine,index)=>{
    const node='m:'+index;
    find(node);
    for(const [dx,dy] of [[TILE,0],[-TILE,0],[0,TILE],[0,-TILE]]){
      const neighbor=wireKey(machine.x+dx,machine.y+dy);
      if(wires.has(neighbor))join(node,neighbor);
    }
    return node;
  });
  const connectedRoots=new Set();
  for(const wire of wires)connectedRoots.add(find(wire));
  return machineNodes.map(node=>connectedRoots.has(find(node))?find(node):null);
}
function machineCanStart(machine, recipe){
  const type=MACHINE_TYPES[machine.type];
  if(!type || !Object.entries(recipe.input).every(([id,count])=>(machine.input[id]||0)>=count) ||
     !machineCapacityAllows(machine.output,recipe.output))return false;
  const energy=recipe.energy||0;
  return type.fuelPerCraft>0
    ? machine.fuel>=type.fuelPerCraft || (energy>0&&machine.power>=energy)
    : energy===0 || machine.power>=energy;
}
function updateMachines(dt){
  for(const machine of machines){
    const type=MACHINE_TYPES[machine.type];
    if(!type.generator)continue;
    if(type.generator==='fuel'&&machine.power<type.capacity&&machine.fuel>0){
      machine.progress+=dt;
      while(machine.progress>=type.fuelInterval&&machine.fuel>0&&machine.power<type.capacity){
        machine.progress-=type.fuelInterval;machine.fuel--;
        machine.power=Math.min(type.capacity,machine.power+type.powerPerFuel);
      }
      if(machine.power>=type.capacity)machine.progress=0;
    }else if(type.generator==='solar'&&G.dayTime>=0.1&&G.dayTime<0.82){
      machine.power=Math.min(type.capacity,machine.power+type.powerRate*dt);
    }
  }
  const grid=buildPowerGrid();
  for(let generatorIndex=0;generatorIndex<machines.length;generatorIndex++){
    const generator=machines[generatorIndex];
    const type=MACHINE_TYPES[generator.type];
    if(!type.generator||generator.power<=0)continue;
    const consumers=machines.map((machine,index)=>({machine,index}))
      .filter(({machine,index})=>{
        if(MACHINE_TYPES[machine.type].generator||machine.power>=(MACHINE_TYPES[machine.type].capacity||100))return false;
        if(grid[generatorIndex]!==null&&grid[index]!==null)
          return grid[generatorIndex]===grid[index];
        return grid[generatorIndex]===null&&grid[index]===null&&
          Math.hypot(generator.x-machine.x,generator.y-machine.y)<=TILE*8;
      })
      .sort((a,b)=>Math.hypot(generator.x-a.machine.x,generator.y-a.machine.y)-
        Math.hypot(generator.x-b.machine.x,generator.y-b.machine.y));
    for(const {machine} of consumers){
      const transfer=Math.min(generator.power,dt*4,(MACHINE_TYPES[machine.type].capacity||100)-machine.power);
      generator.power-=transfer;machine.power+=transfer;
      if(generator.power<=0)break;
    }
  }
  for(const machine of machines){
    const type=MACHINE_TYPES[machine.type];
    if(!type)continue;
    if(type.generator)continue;
    if(type.harvester){
      machine.progress+=dt;
      while(machine.progress>=type.harvestInterval){
        const plot=farmPlots
          .filter(candidate=>candidate.crop&&candidate.growth>=1&&
            Math.hypot(candidate.x-machine.x,candidate.y-machine.y)<=type.range)
          .sort((a,b)=>Math.hypot(a.x-machine.x,a.y-machine.y)-Math.hypot(b.x-machine.x,b.y-machine.y))[0];
        if(!plot||machine.power<type.harvestEnergy){machine.progress=Math.min(machine.progress,type.harvestInterval);break;}
        const crop=CROPS[plot.crop];
        if(!crop){machine.progress=0;break;}
        const seedReturn=(G.farmTech||0)>=3&&Math.random()<(FARM_TECH[2].seedReturnChance||0);
        const yieldCount=Math.ceil(crop.yield*(G.weather==='harvest'?1.5:getSeasonIndex()===2?1.15:1));
        const contents={[crop.output]:yieldCount};
        if(seedReturn)contents[crop.seedItem]=1;
        if(!machineCapacityAllows(machine.output,contents)){machine.progress=Math.min(machine.progress,type.harvestInterval);break;}
        for(const [id,count] of Object.entries(contents))machine.output[id]=(machine.output[id]||0)+count;
        machine.power-=type.harvestEnergy;
        plot.crop=null;plot.growth=0;
        machine.progress-=type.harvestInterval;
        if(window.PixelSurvivalModAPI)PixelSurvivalModAPI.emit('cropHarvested',{crop:crop.output,count:crop.yield,x:plot.x,y:plot.y,automatic:true});
        showToast('自动收获 '+crop.name+' ×'+yieldCount,'#a8efaa');
      }
      continue;
    }
    if(type.itemRouter){
      machine.progress+=dt;
      while(machine.progress>=type.transferInterval){
        const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][machine.dir||0];
        const source=machines.find(candidate=>candidate!==machine&&candidate.x===machine.x-dx*TILE&&candidate.y===machine.y-dy*TILE);
        const target=machines.find(candidate=>candidate!==machine&&candidate.x===machine.x+dx*TILE&&candidate.y===machine.y+dy*TILE);
        if(machine.power<type.transferEnergy||!source||!target){
          machine.progress=Math.min(machine.progress,type.transferInterval);break;
        }
        const entry=Object.entries(source.output).find(([id,count])=>
          count>0&&machineAcceptsStoredItem(target,id));
        if(!entry){machine.progress=Math.min(machine.progress,type.transferInterval);break;}
        const [id]=entry;
        source.output[id]--;
        if(source.output[id]===0)delete source.output[id];
        storeMachineItem(target,id);
        machine.power-=type.transferEnergy;
        machine.progress-=type.transferInterval;
        if(window.PixelSurvivalModAPI)PixelSurvivalModAPI.emit('logisticsTransferred',{id,from:source.type,to:target.type});
      }
      continue;
    }
    if(machine.activeRecipe===null){
      const recipe=type.recipes.find(candidate=>machineCanStart(machine,candidate));
      if(!recipe)continue;
      for(const [id,count] of Object.entries(recipe.input)){
        machine.input[id]-=count;
        if(machine.input[id]===0)delete machine.input[id];
      }
      const energy=recipe.energy||0;
      if(energy>0&&machine.power>=energy)machine.power-=energy;
      else machine.fuel-=type.fuelPerCraft;
      machine.activeRecipe=recipe.id;
      machine.progress=0;
    }
    const recipe=machineRecipeFor(machine);
    if(!recipe)continue;
    machine.progress=Math.min(recipe.duration,machine.progress+dt);
    if(machine.progress>=recipe.duration){
      for(const [id,count] of Object.entries(recipe.output))machine.output[id]=(machine.output[id]||0)+count;
      machine.activeRecipe=null;
      machine.progress=0;
      if(window.PixelSurvivalModAPI)PixelSurvivalModAPI.emit('machineCrafted',{machine:machine.type,recipe:recipe.id,x:machine.x,y:machine.y,output:{...recipe.output}});
      if(window.PixelSurvivalAudio)PixelSurvivalAudio.play('machine',machine.type);
      showToast(recipe.name+' 完成', '#a8efaa');
    }
  }
}
function transferMachineInput(machine,id){
  if(!(inv[id]>0) || (machine.input[id]||0)>=99){showToast('背包中没有可投入的 '+ITEMS[id].name,'#ffb080');return;}
  takeItem(id,1);machine.input[id]=(machine.input[id]||0)+1;
}
function transferMachineFuel(machine){
  const type=MACHINE_TYPES[machine.type];
  if(!(inv[type.fuelItem]>0) || machine.fuel>=99){showToast('没有可投入的燃料','#ffb080');return;}
  takeItem(type.fuelItem,1);machine.fuel++;
}
function collectMachineOutput(machine,id){
  const count=machine.output[id]||0;
  if(!count)return;
  addItem(id,count);delete machine.output[id];
  showToast('取出 '+ITEMS[id].name+' ×'+count,'#a8e0ff');
}
function machineStatus(machine,type){
  if(type.generator==='fuel')return machine.power>=type.capacity
    ? '储能已满 · 电网/附近设备可用'
    : machine.fuel>0?'发电中 · '+Math.floor(machine.power)+' / '+type.capacity+' 能量'
      :'缺少燃料：'+ITEMS[type.fuelItem].name;
  if(type.generator==='solar')return G.dayTime>=0.1&&G.dayTime<0.82
    ?'日照发电 · '+Math.floor(machine.power)+' / '+type.capacity+' 能量'
      :'夜间待机 · '+Math.floor(machine.power)+' / '+type.capacity+' 能量';
  if(type.harvester){
    const crop=farmPlots.some(plot=>plot.crop&&plot.growth>=1&&
      Math.hypot(plot.x-machine.x,plot.y-machine.y)<=type.range);
    if(!crop)return '等待范围内的成熟作物 · 电量 '+Math.floor(machine.power);
    if(machine.power<type.harvestEnergy)return '缺少电力 · 连接电线或发电机';
    if(Object.values(CROPS).every(crop=>!machineCapacityAllows(machine.output,{[crop.output]:crop.yield})))
      return '产物缓存已满';
    return '自动收割中 · 电量 '+Math.floor(machine.power);
  }
  if(type.itemRouter){
    const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][machine.dir||0];
    const source=machines.find(candidate=>candidate!==machine&&candidate.x===machine.x-dx*TILE&&candidate.y===machine.y-dy*TILE);
    const target=machines.find(candidate=>candidate!==machine&&candidate.x===machine.x+dx*TILE&&candidate.y===machine.y+dy*TILE);
    if(!source||!target)return '等待前后连接机器';
    if(machine.power<type.transferEnergy)return '缺少电力 · 连接电线或发电机';
    if(!Object.keys(source.output).some(id=>machineAcceptsStoredItem(target,id)))return '等待可转运物品';
    return '物流转运中 · 电量 '+Math.floor(machine.power);
  }
  const recipe=machine.activeRecipe===null?type.recipes.find(candidate=>
    Object.entries(candidate.input).every(([id,count])=>(machine.input[id]||0)>=count)):machineRecipeFor(machine);
  if(machine.activeRecipe!==null)return recipe?'正在加工 '+recipe.name:'机器配方已失效';
  if(!recipe)return '等待输入材料';
  if(type.fuelPerCraft>0&&machine.fuel<type.fuelPerCraft&&
     !(recipe.energy>0&&machine.power>=recipe.energy))return '缺少燃料/电力 · 附近建造发电机';
  if(type.fuelPerCraft===0&&recipe.energy>0&&machine.power<recipe.energy)return '缺少电力 · 附近建造发电机';
  if(!machineCapacityAllows(machine.output,recipe.output))return '产物缓存已满';
  return '待机 · 即将开始';
}
function drawMachinePanel(){
  const machine=selectedMachine, type=machine&&MACHINE_TYPES[machine.type];
  if(!machine||!type){panel=null;selectedMachine=null;return;}
  const ui=type.ui||{};
  const paper=ui.background||PAL.paper,accent=ui.accent||PAL.wood,textColor=ui.text||'#5b4a32';
  uiButtons=[];
  ctx.fillStyle='rgba(18,11,6,0.8)'; ctx.fillRect(0,0,W,H);
  const x=88, y=42, w=304, h=186;
  uiPanel(x-3, y-3, w+6, h+6, {});
  uiPanel(x, y, w, h, { title:ui.title||type.name,fill:paper,wood:accent,woodMid:accent,
    accent,accentLight:accent,accentDark:accent });
  txt('右键 / ESC 关闭', x+w-12, y+12, { size:7, bold:true, color:'#e8dcc0', align:'right' });
  R(x+10, y+23, w-20, 1, PAL.creamShade);
  txt((ui.statusLabel||'状态')+'：'+machineStatus(machine,type)+' · '+Math.floor(machine.power||0)+' 能量', x+12, y+34, { size:7, bold:true, color:textColor });
  const inputIds=[...new Set([...type.recipes.flatMap(recipe=>Object.keys(recipe.input)),...Object.keys(machine.input)])];
  const expectedOutputs=type.harvester?Object.values(CROPS).map(crop=>crop.output):[];
  const outputIds=[...new Set([...type.recipes.flatMap(recipe=>Object.keys(recipe.output)),...expectedOutputs,...Object.keys(machine.output)])];
  const inputTabX=x+12,tabY=y+48,tabW=72,tabH=13;
  uiButton(inputTabX,tabY,tabW,tabH,(ui.inputLabel||'输入')+' '+inputIds.length,
    {kind:machinePanelTab==='input'?'green':'wood'});
  uiButtons.push({x:inputTabX,y:tabY,w:tabW,h:tabH,fn:()=>{machinePanelTab='input';machinePanelPage=0;}});
  const outputTabX=inputTabX+tabW+4;
  uiButton(outputTabX,tabY,tabW,tabH,(ui.outputLabel||'产物')+' '+outputIds.length,
    {kind:machinePanelTab==='output'?'blue':'wood'});
  uiButtons.push({x:outputTabX,y:tabY,w:tabW,h:tabH,fn:()=>{machinePanelTab='output';machinePanelPage=0;}});
  if(type.generator==='fuel'||type.fuelPerCraft>0){
    const fuelX=outputTabX+tabW+4;
    uiButton(fuelX,tabY,72,tabH,(ui.fuelLabel||'燃料')+' +1',{kind:'gold'});
    uiButtons.push({x:fuelX,y:tabY,w:72,h:tabH,fn:()=>transferMachineFuel(machine)});
  }
  const activeIds=machinePanelTab==='output'?outputIds:inputIds;
  const pageCount=Math.max(1,Math.ceil(activeIds.length/12));
  machinePanelPage=Math.max(0,Math.min(machinePanelPage,pageCount-1));
  if(pageCount>1){
    const pagerX=x+w-52;
    uiButton(pagerX,tabY,20,tabH,'‹',{kind:'wood',disabled:machinePanelPage===0});
    uiButtons.push({x:pagerX,y:tabY,w:20,h:tabH,fn:()=>{machinePanelPage=Math.max(0,machinePanelPage-1);}});
    uiButton(pagerX+24,tabY,20,tabH,'›',{kind:'wood',disabled:machinePanelPage===pageCount-1});
    uiButtons.push({x:pagerX+24,y:tabY,w:20,h:tabH,fn:()=>{machinePanelPage=Math.min(pageCount-1,machinePanelPage+1);}});
  }
  const displayedIds=activeIds.slice(machinePanelPage*12,machinePanelPage*12+12);
  const columnWidth=(w-32)/2,rowY=y+65;
  for(let index=0;index<displayedIds.length;index++){
    const id=displayedIds[index],column=Math.floor(index/6),row=index%6;
    const cellX=x+12+column*(columnWidth+8),cellY=rowY+row*16;
    const itemName=(ITEMS[id]||{}).name||id;
    const amount=machinePanelTab==='output'?(machine.output[id]||0):(machine.input[id]||0);
    uiPanel(cellX,cellY,columnWidth,14,{fill:paper,woodMid:accent});
    txt(itemName+' '+amount,cellX+4,cellY+4,{size:6,bold:true,color:textColor});
    const buttonX=cellX+columnWidth-39;
    if(machinePanelTab==='output'){
      uiButton(buttonX,cellY+1,36,12,'取出',{kind:amount>0?'blue':'wood'});
      uiButtons.push({x:buttonX,y:cellY+1,w:36,h:12,fn:()=>collectMachineOutput(machine,id)});
    }else{
      uiButton(buttonX,cellY+1,36,12,'投入 +1',{kind:'green'});
      uiButtons.push({x:buttonX,y:cellY+1,w:36,h:12,fn:()=>transferMachineInput(machine,id)});
    }
  }
  if(!displayedIds.length)
    txt(machinePanelTab==='input'?'此机器不需要输入材料':'暂无产物',x+w/2,y+78,{size:7,bold:true,color:textColor,align:'center'});
  if(pageCount>1)
    txt((machinePanelPage+1)+' / '+pageCount,x+w-12,y+h-38,{size:6,bold:true,color:textColor,align:'right'});
  if(type.itemRouter){
    const labels=['东','南','西','北'];
    const bx=x+w-70, by=y+h-38; uiButton(bx, by, 58, 14, '转向 '+labels[machine.dir||0], { kind:'green' });
    uiButtons.push({x:bx, y:by, w:58, h:14, fn:() => {machine.dir=((machine.dir||0)+1)%4;machine.progress=0;}});
  }
  const recipe=machineRecipeFor(machine);
  if(recipe){
    R(x+12, y+h-25, w-24, 6, '#17201d');
    R(x+13, y+h-24, Math.round((w-26)*machine.progress/recipe.duration), 4, '#d7a45e');
  }
  txt(ui.footer|| (type.generator
    ? type.generator==='fuel' ? '每份木头发电 '+type.powerPerFuel+' 能量' : '白天发电 '+Math.round(type.powerRate*60)+' 能量/分钟'
    : type.harvester ? '范围 '+Math.round(type.range/TILE)+' 格 · 每次收割耗电 '+type.harvestEnergy
      : type.itemRouter ? '转运间隔 '+type.transferInterval+' 秒 · 每件耗电 '+type.transferEnergy
        : '加工时间 '+(recipe?recipe.duration:type.recipes.length?type.recipes[0].duration:0)+' 秒 · 电力可代替燃料'), x+12, y+h-8, { size:6, bold:true, color:textColor });
}
function drawFarmPlot(p, sx, sy){
  R(sx-7,sy-5,14,10,'#765032'); R(sx-6,sy-4,12,2,'#9a7047');
  for(let i=0;i<3;i++) R(sx-5+i*5,sy+1,2,2,'#543b2a');
  if(!p.crop)return;
  const stage=p.growth<0.34?1:p.growth<0.68?2:3;
  R(sx-1,sy-5,2,5,'#477a39');
  if(stage>=2){R(sx-4,sy-5,4,2,'#4c9847');R(sx+1,sy-7,4,2,'#62a64b');}
  if(stage>=3){
    const color=(CROPS[p.crop]||{}).color||'#9acb70';
    R(sx-2,sy-3,4,4,color);R(sx-4,sy-6,3,2,'#73b64d');R(sx+1,sy-7,3,2,'#62a64b');
  }
}

function craftRecipe(idx){
  const rec = RECIPES[idx];
  const it = ITEMS[rec.out];

  if (G.tech < rec.tier){
    showToast('需要 ' + TECH_LEVELS[rec.tier].name + ' · 按 T 查看科技', '#ffc080');
    return;
  }

  // 装备类不可重复
  if ((it.kind === 'weapon' || it.kind === 'armor' || it.kind === 'tool') && (inv[rec.out] || 0) > 0){
    showToast('已拥有 ' + it.name, '#ffb060');
    return;
  }

  for (const k in rec.need){
    if ((inv[k] || 0) < rec.need[k]){
      showToast('材料不足：' + ITEMS[k].name + ' ' + (inv[k]||0) + '/' + rec.need[k], '#ff7070');
      shake = 2;
      return;
    }
  }
  for (const k in rec.need) takeItem(k, rec.need[k]);
  addItem(rec.out, rec.count || 1);
  if (rec.out === 'woodSword') G.tutorialSword = true;
  if (rec.out === 'torch') G.tutorialTorch = true;
  showToast('制作成功：' + it.name + ((rec.count || 1) > 1 ? ' ×' + rec.count : ''), '#7dffb0');
  if(window.PixelSurvivalAudio)PixelSurvivalAudio.play('craft',rec.out);
  if(window.PixelSurvivalModAPI) PixelSurvivalModAPI.emit('crafted',{id:rec.out,count:rec.count||1});
  spawnParticles(player.x, player.y - 14, '#7dffb0', 10);
}

function technologyRequirement(level){
  const tech = TECH_LEVELS[level];
  if (!tech) return { available:false, missing:['全部科技已研究'] };
  const missing = [];
  if (G.day < tech.day) missing.push('第 ' + tech.day + ' 天（当前第 ' + G.day + ' 天）');
  if (G.kills < tech.kills) missing.push('击败怪物 ' + G.kills + '/' + tech.kills);
  for (const id in tech.cost){
    if ((inv[id] || 0) < tech.cost[id]){
      missing.push(ITEMS[id].name + ' ' + (inv[id] || 0) + '/' + tech.cost[id]);
    }
  }
  return { available:missing.length === 0, missing };
}

function upgradeTechnology(){
  const nextLevel = G.tech + 1;
  const tech = TECH_LEVELS[nextLevel];
  if (!tech){
    showToast('已达到最高科技等级', '#a8fff0');
    return;
  }
  const requirement = technologyRequirement(nextLevel);
  if (!requirement.available){
    showToast('进阶条件未满足：' + requirement.missing[0], '#ffb080');
    return;
  }
  for (const id in tech.cost) takeItem(id, tech.cost[id]);
  G.tech = nextLevel;
  showToast('科技升级：' + tech.name, '#9fffe0');
  spawnParticles(player.x, player.y - 14, '#72d9d0', 18);
}

function doAttack(){
  if(panel || G.gameOver) return;
  const p = player;
  if(p.weapon && ITEMS[p.weapon].firearm && !p.toolId){ shootGun(); return; }
  if (p.atkCd > 0 || p.stamina < 6) return;
  p.combo = p.comboWindow>0 ? p.combo%3+1 : 1;
  p.comboWindow = 0.85;
  p.attackAngle = Math.atan2(p.aimY,p.aimX);
  const attackDamage = Math.round(p.damage*(p.combo===3?1.5:1));
  p.atkCd = p.atkSpeed;
  p.swing = ATTACK_ANIM_DURATION;
  p.stamina = Math.max(0, p.stamina - 6);

  const ax = p.aimX, ay = p.aimY;
  const gatherRange = p.toolId ? 17 : (p.weapon ? ITEMS[p.weapon].range : 15);
  const hx = p.x + ax * gatherRange;
  const hy = (p.y - 10) + ay * gatherRange;
  const hitR = 15;

  let hitAny = false;
  let hitEnemy = false;
  const aimAngle = Math.atan2(ay, ax);

  for (let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];
    const dx = e.x - p.x, dy = (e.y - 9) - (p.y - 10);
    const d = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const angleDiff = Math.atan2(Math.sin(angle - aimAngle), Math.cos(angle - aimAngle));
    if (d < p.range + e.r + 5 && Math.abs(angleDiff) < 0.9){
      e.hp -= attackDamage;
      e.hitFlash = 0.16;
      const kx = e.x - p.x, ky = e.y - p.y;
      const kl = Math.hypot(kx, ky) || 1;
      e.x += kx/kl * 11;
      e.y += ky/kl * 11;
      spawnParticles(e.x, e.y - 9, '#d84848', 8);
      spawnText(e.x, e.y - 22, '-' + attackDamage, p.combo===3?'#ffb56a':'#ffdd55');
      hitAny = true;
      hitEnemy = true;
      if (e.hp <= 0) killEnemy(e, i);
    }
  }

  for(let i=animals.length-1;i>=0;i--){
    const animal=animals[i];
    const dx=animal.x-p.x,dy=animal.y-p.y,d=Math.hypot(dx,dy);
    const angleDiff=Math.atan2(Math.sin(Math.atan2(dy,dx)-aimAngle),Math.cos(Math.atan2(dy,dx)-aimAngle));
    if(d>p.range+9||Math.abs(angleDiff)>=0.9)continue;
    animal.hp=(animal.hp||3)-attackDamage;
    spawnParticles(animal.x,animal.y-6,'#d7cba2',5);
    if(animal.hp<=0){
      for(let count=0;count<(animal.type==='chicken'?1:2);count++)dropPickup(animal.x,animal.y-5,'meat');
      if(animal.type==='chicken'&&Math.random()<0.45)dropPickup(animal.x,animal.y-7,'fiber');
      animals.splice(i,1);
      showToast('获得生肉 · 注意野生动物需要繁殖才能恢复','#e6c6a0');
    }
    hitAny=true;
    break;
  }

  if (hitResource(trees,  hx, hy, hitR, 'wood'))  hitAny = true;
  if (hitResource(rocks,  hx, hy, hitR, 'stone', p.miningPower)) hitAny = true;
  if (hitResource(bushes, hx, hy, hitR, 'fiber')) hitAny = true;
  if (hitPlacedBlock(hx, hy, hitR, p.miningPower)) hitAny = true;

  if (hitAny) shake = Math.max(shake, hitEnemy ? 3 : 1.5);

  spawnParticles(hx + rnd(-6,6), hy + rnd(-6,6), 'rgba(255,255,255,0.55)', 2);
  if(window.PixelSurvivalAudio)PixelSurvivalAudio.play('attack',p.weapon||p.toolId||'');
}

function hitResource(list, hx, hy, hitR, type, miningPower){
  for (let i = list.length - 1; i >= 0; i--){
    const o = list[i];
    const cy = o.y - (type === 'wood' ? 10 : type === 'stone' ? 7 : 5);
    if (Math.hypot(o.x - hx, cy - hy) < hitR + o.r){
      if (type === 'stone' && o.ore && miningPower < 1){
        if (o.ore) showToast('需要镐子才能开采矿脉', '#ffd080');
        return false;
      }
      o.hp -= type === 'stone' ? Math.max(1, miningPower) : 1;
      o.shake = 0.15;
      const hitColor = o.ore ? ITEMS[o.ore].color :
        type === 'wood' ? '#8a5a30' : type === 'stone' ? '#9a9aa6' : '#6a9a40';
      spawnParticles(o.x, cy, hitColor, 4);
      if (o.ore) spawnText(o.x, cy - 8, o.hp + '耐久', ITEMS[o.ore].color);

      if (o.hp <= 0){
        if (type === 'wood'){
          const n = rndi(2, 4);
          for (let k=0;k<n;k++) dropPickup(o.x, o.y-6, 'wood');
          if (Math.random() < 0.35) dropPickup(o.x, o.y-6, 'fiber');
        } else if (type === 'stone' && o.ore){
          const count = o.ore === 'crystal' ? 1 : rndi(2, 4);
          for (let k=0;k<count;k++) dropPickup(o.x, o.y-4, o.ore);
          dropPickup(o.x, o.y-4, 'stone');
        } else if (type === 'stone'){
          const n = rndi(2, 3);
          for (let k=0;k<n;k++) dropPickup(o.x, o.y-4, 'stone');
        } else {
          const n = rndi(1, 2);
          for (let k=0;k<n;k++) dropPickup(o.x, o.y-4, 'fiber');
          if (Math.random() < 0.75) dropPickup(o.x, o.y-4, 'berry');
        }
        list.splice(i, 1);
      }
      return true;
    }
  }
  return false;
}

function hitPlacedBlock(hx, hy, hitR, miningPower){
  for(let i=belts.length-1;i>=0;i--){
    const belt=belts[i];
    if(Math.hypot(belt.x-hx,belt.y-hy)>hitR+7)continue;
    dropPickup(belt.x,belt.y,'conveyorBelt');
    belts.splice(i,1);
    showToast('输送带已回收','#c8e0ff');
    return true;
  }
  for(let i=machines.length-1;i>=0;i--){
    const machine=machines[i];
    if(Math.hypot(machine.x-hx,machine.y-hy)>hitR+7)continue;
    machine.hp-=Math.max(1,miningPower);
    spawnParticles(machine.x,machine.y,ITEMS[MACHINE_TYPES[machine.type].blockItem].color,4);
    if(machine.hp>0)return true;
    const blockItem=MACHINE_TYPES[machine.type].blockItem;
    dropPickup(machine.x,machine.y,blockItem);
    for(const [id,count] of Object.entries(machine.input))for(let n=0;n<count;n++)dropPickup(machine.x,machine.y-3,id);
    const activeRecipe=machineRecipeFor(machine);
    if(activeRecipe)for(const [id,count] of Object.entries(activeRecipe.input))for(let n=0;n<count;n++)dropPickup(machine.x,machine.y-3,id);
    for(let n=0;n<machine.fuel;n++)dropPickup(machine.x,machine.y-3,MACHINE_TYPES[machine.type].fuelItem);
    for(const [id,count] of Object.entries(machine.output))for(let n=0;n<count;n++)dropPickup(machine.x,machine.y-3,id);
    machines.splice(i,1);
    if(selectedMachine===machine){selectedMachine=null;panel=null;}
    showToast('机器已拆除，库存已掉落回收','#c8e0ff');
    return true;
  }
  for (let i = placedBlocks.length - 1; i >= 0; i--){
    const block = placedBlocks[i];
    if (Math.hypot(block.x - hx, block.y - hy) > hitR + block.r) continue;
    block.hp -= Math.max(1, miningPower);
    spawnParticles(block.x, block.y, ITEMS[block.type].color, 4);
    if (block.hp <= 0){
      const properties=getStudioBlockProperties(block.type);
      const drop=properties&&ITEMS[properties.drop]?properties.drop:block.type;
      dropPickup(block.x, block.y, drop);
      placedBlocks.splice(i, 1);
      showToast('方块已回收', '#c8e0ff');
    }
    return true;
  }
  return false;
}

function killEnemy(e, idx){
  enemies.splice(idx, 1);
  G.kills++;
  comboCount = comboT > 0 ? comboCount + 1 : 1; comboT = 4;
  if (comboCount >= 3) gainExperience(Math.min(10, Math.floor(comboCount / 2)));
  if (comboCount >= 5 && comboCount % 5 === 0){
    dropPickup(e.x-6,e.y-6,'ammo'); dropPickup(e.x+6,e.y-6,'ammo');
    showToast('连杀 ×'+comboCount+'！获得额外弹药', '#ffd060');
  }
  if (Math.random() < 0.12) dropPickup(e.x,e.y-4,'ammo');
  if (e.boss){
    G.bossKills=(G.bossKills||0)+1; gainExperience(200);
    for(let i=0;i<3;i++){dropPickup(e.x,e.y-8,'bloodCore');dropPickup(e.x,e.y-8,'largePotion');}
    for(let i=0;i<4;i++) dropPickup(e.x,e.y-8,'crystal');
    for(let i=0;i<8;i++) dropPickup(e.x,e.y-8,'ammo');
    shake=10; showToast('巨像守卫被击败！','#ffe070'); spawnText(e.x,e.y-40,'巨像陨落！','#ffe070');
  }
  if (e.elite){
    G.eliteKills=(G.eliteKills||0)+1;
    gainExperience(40);
    dropPickup(e.x,e.y-6,'crystal'); dropPickup(e.x,e.y-6,'copperOre'); dropPickup(e.x,e.y-6,'copperOre');
    dropPickup(e.x,e.y-6,'ammo'); dropPickup(e.x,e.y-6,'largePotion');
    spawnText(e.x, e.y-32, '精英击败！', '#ffe070');
    showToast('精英怪倒下，掉落稀有战利品！', '#ffe070');
  }
  gainExperience(e.type === 'bloodKnight' ? 50 : e.type === 'brute' ? 20 : 10);
  if (Math.random() < 0.14) dropPickup(e.x,e.y-4,'smallPotion');
  if (e.type === 'bloodKnight') dropPickup(e.x,e.y-4,'largePotion');
  const deathColor = e.type === 'bloodKnight' ? '#fa688a' : e.type === 'spitter' ? '#a9e77a' : '#4a6b3a';
  spawnParticles(e.x, e.y-9, deathColor, e.type === 'bloodKnight' ? 22 : 12);
  spawnParticles(e.x, e.y-9, '#8a2a2a', 7);
  dropPickup(e.x, e.y-4, 'meat');
  if (Math.random() < 0.5) dropPickup(e.x, e.y-4, 'fiber');
  if (Math.random() < 0.22) dropPickup(e.x, e.y-4, 'berry');
  if (e.type === 'bloodKnight'){
    dropPickup(e.x, e.y-8, 'bloodCore');
    dropPickup(e.x, e.y-8, 'bloodCore');
    spawnText(e.x, e.y-25, '骑士陨落！', '#ff7890');
  } else {
    spawnText(e.x, e.y-20, '击杀!', '#ffd060');
  }
  if(e.type==='caveWarden'){
    dropPickup(e.x,e.y-5,'relicShard');dropPickup(e.x,e.y-5,'ironOre');
    spawnText(e.x,e.y-34,'遗迹守卫','#dbb978');
  }
  if(e.annualBoss){
    G.annualBossDefeated=true;
    for(let i=0;i<4;i++)dropPickup(e.x+rnd(-8,8),e.y-8,'relicShard');
    showToast('年度巨像已陨落！遗迹碎片可用于建造世界之门','#d9c8ff');
  }
  if(e.finalBoss){
    G.victory=true;
    G.gameOver=true;
    G.overT=0;
    panel=null;
    showToast('世界核心已恢复！你完成了远征。','#d9c8ff');
    saveGame();
  }
}

function hurtPlayer(dmg){
  if (player.invuln > 0 || G.gameOver) return;
  const real = dmg * (1 - player.armor) * (1-G.growth.ranks.guard*0.04) * (G.wardTime>0?0.5:1);
  player.hp -= real;
  player.invuln = 0.55;
  player.hurtFlash = 0.4;
  shake = 5;
  spawnParticles(player.x, player.y-10, '#d04040', 6);
  spawnText(player.x, player.y-24, '-' + Math.round(real), '#ff5555');
  if (player.hp <= 0){ player.hp = 0; gameOver(); }
}

function gameOver(){
  if (G.gameOver) return;
  G.gameOver = true;
  G.overT = 0;
  saveGame();
  shake = 9;
  panel = null;
}

/* ══════════════════════════════════════════════════════════
   拾取物 / 粒子 / 文字
   ══════════════════════════════════════════════════════════ */
function dropPickup(x, y, type){
  pickups.push({
    x, y, type, t: 0, life: 26,
    vx: rnd(-40, 40), vy: rnd(-55, -15),
  });
}

function spawnParticles(x, y, color, n){
  for (let i=0;i<n;i++){
    const life=rnd(0.3,0.75);
    particles.push({
      x, y,
      vx: rnd(-80, 80), vy: rnd(-130, -30),
      life, max:life,
      color, size: Math.random() < 0.12 ? 3 : Math.random() < 0.5 ? 1 : 2,
    });
  }
}

function spawnText(x, y, text, color){
  texts.push({ x, y, text, color, life: 0.95, max: 0.95 });
}
