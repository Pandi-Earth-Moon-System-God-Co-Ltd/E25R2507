/* ══════════════════════════════════════════════════════════
   自适应
   ══════════════════════════════════════════════════════════ */
function resize(){
  const viewport=window.visualViewport;
  const width=viewport?viewport.width:window.innerWidth;
  const height=viewport?viewport.height:window.innerHeight;
  const s=Math.min(Math.max(1,width)/W,Math.max(1,height)/H);
  canvas.style.width  = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
}
window.addEventListener('resize', resize);
if(window.visualViewport)window.visualViewport.addEventListener('resize',resize);

/* ══════════════════════════════════════════════════════════
   Mod API v1.4: definitions persist locally; third-party scripts are not sandboxed.
   Example: register seed/output items, then registerCrop('sample:turnip',
     {name:'Turnip',seedItem:'sample:turnipSeed',output:'sample:turnip',
      yield:2,growthSeconds:90,color:'#d08050'}).
   ══════════════════════════════════════════════════════════ */
function validateModId(id){
  if(typeof id!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{1,47}(?::[a-zA-Z][a-zA-Z0-9_-]{1,47})?$/.test(id)||id in Object.prototype)
    throw new Error('无效内容 ID（建议使用 namespace:name）');
}
function stableDefinition(value){
  if(Array.isArray(value))return value.map(stableDefinition);
  if(isRecord(value))return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableDefinition(value[key])]));
  return value;
}
function sameDefinition(a,b){
  return JSON.stringify(stableDefinition(a))===JSON.stringify(stableDefinition(b));
}
function validateItemMap(map,label){
  if(!isRecord(map)||!Object.keys(map).length)throw new Error(label+'不能为空');
  if(Object.keys(map).length>12)throw new Error(label+'最多支持 12 种物品');
  for(const [id,count] of Object.entries(map))if(!ITEMS[id]||!Number.isInteger(count)||count<1||count>99)
    throw new Error(label+'包含无效物品或数量');
}
function normalizeMachineRecipe(recipe){
  if(!recipe||typeof recipe!=='object'||typeof recipe.id!=='string'||
     !/^[a-zA-Z][a-zA-Z0-9_-]{1,47}$/.test(recipe.id)||
     typeof recipe.name!=='string'||!Number.isFinite(recipe.duration)||recipe.duration<=0||recipe.duration>3600||
     (recipe.energy!==undefined&&(!Number.isFinite(recipe.energy)||recipe.energy<0||recipe.energy>100)))
    throw new Error('机器配方定义无效');
  validateItemMap(recipe.input,'机器配方输入');
  validateItemMap(recipe.output,'机器配方产出');
  const normalized={id:recipe.id,name:recipe.name,input:{...recipe.input},output:{...recipe.output},
    duration:recipe.duration};
  if(recipe.energy)normalized.energy=recipe.energy;
  return normalized;
}
function normalizeMachineUi(ui){
  if(ui===undefined)return undefined;
  if(!isRecord(ui))throw new Error('机器界面定义无效');
  const normalized={};
  for(const key of ['title','statusLabel','inputLabel','outputLabel','fuelLabel','footer']){
    const value=ui[key];
    if(value!==undefined){
      if(typeof value!=='string'||value.length>48)throw new Error('机器界面文字无效：'+key);
      normalized[key]=value;
    }
  }
  for(const key of ['background','accent','text']){
    const value=ui[key];
    if(value!==undefined){
      if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw new Error('机器界面颜色无效：'+key);
      normalized[key]=value;
    }
  }
  return normalized;
}
function installMachineDefinition(id,definition){
  validateModId(id);
  if(!definition||typeof definition.name!=='string'||!ITEMS[definition.blockItem]||
     ITEMS[definition.blockItem].kind!=='placeable'||!ITEMS[definition.fuelItem]||
     !Number.isInteger(definition.fuelPerCraft)||definition.fuelPerCraft<1||definition.fuelPerCraft>99||
     !Array.isArray(definition.recipes)||!definition.recipes.length)throw new Error('机器定义无效');
  if(ITEMS[definition.blockItem].machineType&&ITEMS[definition.blockItem].machineType!==id)
    throw new Error('方块已绑定其他机器类型');
  const recipes=definition.recipes.map(normalizeMachineRecipe);
  if(new Set(recipes.map(recipe=>recipe.id)).size!==recipes.length)throw new Error('机器配方 ID 重复');
  const installed={name:definition.name,blockItem:definition.blockItem,fuelItem:definition.fuelItem,
    fuelPerCraft:definition.fuelPerCraft,recipes};
  if(definition.ui!==undefined)installed.ui=normalizeMachineUi(definition.ui);
  const prior=MACHINE_TYPES[id];
  if(prior&&!modDefinitions.machines[id])throw new Error('机器 ID 已存在：'+id);
  if(prior&&!sameDefinition(prior,installed))throw new Error('机器 ID 已注册且定义不同：'+id);
  MACHINE_TYPES[id]=installed;
  ITEMS[definition.blockItem].machineType=id;
  if(modDefinitions.items[definition.blockItem])modDefinitions.items[definition.blockItem].machineType=id;
  return installed;
}
function installMachineRecipe(machineId,recipe){
  const machine=MACHINE_TYPES[machineId];
  if(!machine)throw new Error('未知机器：'+machineId);
  const normalized=normalizeMachineRecipe(recipe);
  const prior=machine.recipes.find(item=>item.id===normalized.id);
  if(prior){
    if(JSON.stringify(prior)!==JSON.stringify(normalized))throw new Error('机器配方 ID 已注册且定义不同：'+normalized.id);
    return normalized.id;
  }
  machine.recipes.push(normalized);
  return normalized.id;
}
function installCropDefinition(id,definition){
  validateModId(id);
  if(!definition||typeof definition.name!=='string'||!ITEMS[definition.seedItem]||
     ITEMS[definition.seedItem].kind!=='seed'||!ITEMS[definition.output]||
     !Number.isFinite(definition.growthSeconds)||definition.growthSeconds<=0||definition.growthSeconds>86400||
     !Number.isInteger(definition.yield)||definition.yield<1||definition.yield>99||
     typeof definition.color!=='string'||!/^#[0-9a-f]{6}$/i.test(definition.color))
    throw new Error('作物定义无效');
  const prior=CROPS[id];
  if(prior&&!modDefinitions.crops[id])throw new Error('作物 ID 已存在：'+id);
  if(prior&&!sameDefinition(prior,definition))throw new Error('作物 ID 已注册且定义不同：'+id);
  if(ITEMS[definition.seedItem].crop&&ITEMS[definition.seedItem].crop!==id)throw new Error('种子已关联其他作物');
  CROPS[id]={...definition};
  ITEMS[definition.seedItem].crop=id;
  if(modDefinitions.items[definition.seedItem])modDefinitions.items[definition.seedItem].crop=id;
  return id;
}
const PixelSurvivalModAPI = {
  version:'1.4.0',
  registerItem(id,def){
    validateModId(id);
    if(!def||typeof def.name!=='string')throw new Error('物品定义无效');
    if(def.kind&&!['material','food','weapon','tool','armor','seed'].includes(def.kind))
      throw new Error('物品类型无效；建筑请使用 registerBlock');
    if(ITEMS[id]){
      if(modDefinitions.items[id]&&sameDefinition(modDefinitions.items[id],def))return id;
      throw new Error('物品 ID 已存在：'+id);
    }
    ITEMS[id]={kind:'material',icon:'crystal',color:'#b58cff',color2:'#644a8b',desc:'模组物品',...def};
    modDefinitions.items[id]={...def};
    persistModDefinitionsOrRollback(()=>{delete ITEMS[id];delete modDefinitions.items[id];});return id;
  },
  registerBlock(id,def){
    validateModId(id);
    if(!def||typeof def.name!=='string')throw new Error('方块定义无效');
    if(def.machineType)throw new Error('请先注册方块，再通过 registerMachine 绑定机器');
    if(modDefinitions.blocks[id]){
      const expected={kind:'placeable',icon:'block',color:'#8b8b8b',color2:'#555555',desc:'模组建筑方块',...def,kind:'placeable'};
      if(sameDefinition(modDefinitions.blocks[id],expected))return id;
      throw new Error('方块 ID 已注册且定义不同：'+id);
    }
    if(ITEMS[id])throw new Error('物品 ID 已存在：'+id);
    const item={kind:'placeable',icon:'block',color:'#8b8b8b',color2:'#555555',desc:'模组建筑方块',...def,kind:'placeable'};
    ITEMS[id]=item;modDefinitions.items[id]={...item};modDefinitions.blocks[id]={...item};
    persistModDefinitionsOrRollback(()=>{delete ITEMS[id];delete modDefinitions.items[id];delete modDefinitions.blocks[id];});return id;
  },
  registerCrop(id,definition){
    const previous=CROPS[id],seed=definition&&ITEMS[definition.seedItem];
    const previousCrop=seed&&seed.crop;
    const result=installCropDefinition(id,definition);
    modDefinitions.crops[id]={...CROPS[id]};
    persistModDefinitionsOrRollback(()=>{
      if(previous)CROPS[id]=previous;else delete CROPS[id];
      delete modDefinitions.crops[id];
      if(seed){if(previousCrop===undefined)delete seed.crop;else seed.crop=previousCrop;}
      if(seed&&modDefinitions.items[definition.seedItem]){
        if(previousCrop===undefined)delete modDefinitions.items[definition.seedItem].crop;
        else modDefinitions.items[definition.seedItem].crop=previousCrop;
      }
    });return result;
  },
  registerRecipe(recipe){
    if(!recipe||!ITEMS[recipe.out])throw new Error('配方必须引用已注册产物');
    validateItemMap(recipe.need,'配方材料');
    const tier=recipe.tier===undefined?0:recipe.tier;
    if(!Number.isInteger(tier)||tier<0||tier>=TECH_LEVELS.length)throw new Error('配方科技等级无效');
    const copy={...recipe,need:{...recipe.need},tier};
    copy.count=copy.count===undefined?1:copy.count;
    if(!Number.isInteger(copy.count)||copy.count<1||copy.count>99||copy.tier>=TECH_LEVELS.length)throw new Error('配方产出数量或科技等级无效');
    const duplicate=RECIPES.findIndex(r=>r.out===copy.out&&(r.count||1)===copy.count&&JSON.stringify(r.need)===JSON.stringify(copy.need));
    if(duplicate>=0)return duplicate;
    RECIPES.push(copy);modDefinitions.recipes.push(copy);
    persistModDefinitionsOrRollback(()=>{RECIPES.pop();modDefinitions.recipes.pop();});return RECIPES.length-1;
  },
  registerTechnology(tech){
    if(!tech||typeof tech.name!=='string'||typeof tech.unlock!=='string')throw new Error('科技定义无效');
    const existing=modDefinitions.techs.find(t=>t.name===tech.name);
    if(existing){
      const expected={day:1,kills:0,cost:{},...tech,cost:{...(tech.cost||{})}};
      if(sameDefinition(existing,expected))return TECH_LEVELS.findIndex(t=>t.name===tech.name);
      throw new Error('科技名称已注册且定义不同：'+tech.name);
    }
    if(TECH_LEVELS.some(t=>t.name===tech.name))throw new Error('科技名称已被核心内容使用：'+tech.name);
    const copy={day:1,kills:0,cost:{},...tech,cost:{...(tech.cost||{})}};
    if(!Number.isInteger(copy.day)||copy.day<1||!Number.isInteger(copy.kills)||copy.kills<0)throw new Error('科技条件无效');
    for(const [id,count] of Object.entries(copy.cost))if(!ITEMS[id]||!Number.isInteger(count)||count<1)throw new Error('科技消耗材料无效');
    TECH_LEVELS.push(copy);modDefinitions.techs.push(copy);
    persistModDefinitionsOrRollback(()=>{TECH_LEVELS.pop();modDefinitions.techs.pop();});return TECH_LEVELS.length-1;
  },
  configureSkillNode(id,definition){
    validateModId(id);
    const effects=['spin','dash','wave','ward','nova'];
    if(!definition||typeof definition.name!=='string'||!definition.name.trim()||definition.name.length>48||
       typeof definition.desc!=='string'||definition.desc.length>160||!effects.includes(definition.effect)||
       !Number.isInteger(definition.level)||definition.level<1||definition.level>99||
       !Number.isInteger(definition.xpCost)||definition.xpCost<0||definition.xpCost>9999||
       !Number.isInteger(definition.cost)||definition.cost<1||definition.cost>100||
       !Number.isFinite(definition.cd)||definition.cd<1||definition.cd>120||
       !Array.isArray(definition.requires)||definition.requires.length>5||
       definition.requires.some(required=>typeof required!=='string'||required===id))
      throw new Error('技能节点定义无效');
    const requires=[...new Set(definition.requires)];
    if(requires.some(required=>!SKILLS.some(skill=>skill.id===required)))
      throw new Error('技能前置节点必须是已注册技能');
    const reaches=(current,target,seen=new Set())=>{
      if(current===target)return true;
      if(seen.has(current))return false;
      seen.add(current);
      const currentSkill=SKILLS.find(skill=>skill.id===current);
      return (current===id?requires:currentSkill&&currentSkill.requires||[])
        .some(required=>reaches(required,target,seen));
    };
    if(requires.some(required=>reaches(required,id)))throw new Error('技能前置关系不能形成循环');
    const existing=SKILLS.find(skill=>skill.id===id);
    if(!existing&&SKILLS.length>=40)throw new Error('技能节点数量已达上限');
    const prior=existing?{...existing,requires:[...existing.requires]}:null;
    const definitionCopy={name:definition.name.trim(),desc:definition.desc,effect:definition.effect,
      level:definition.level,xpCost:definition.xpCost,cost:definition.cost,cd:definition.cd,requires};
    const previousIndex=modDefinitions.skillNodes.findIndex(skill=>skill.id===id);
    const previousDefinition=previousIndex>=0?modDefinitions.skillNodes[previousIndex]:null;
    const runtime=existing||{id,key:'',name:'',level:1,cost:20,cd:6,xpCost:0,requires:[],desc:'',effect:'spin'};
    Object.assign(runtime,{...definitionCopy,id});
    if(!existing)SKILLS.push(runtime);
    if(G&&G.skills&&G.skills[id]===undefined)G.skills[id]=0;
    if(previousIndex>=0)modDefinitions.skillNodes[previousIndex]=JSON.parse(JSON.stringify(runtime));
    else modDefinitions.skillNodes.push(JSON.parse(JSON.stringify(runtime)));
    persistModDefinitionsOrRollback(()=>{
      if(prior)Object.assign(runtime,prior);
      else SKILLS.splice(SKILLS.indexOf(runtime),1);
      if(previousDefinition)modDefinitions.skillNodes[previousIndex]=previousDefinition;
      else modDefinitions.skillNodes.pop();
    });
    return id;
  },
  registerMachine(id,definition){
    validateModId(id);
    installMachineDefinition(id,definition);
    modDefinitions.machines[id]={...MACHINE_TYPES[id],recipes:MACHINE_TYPES[id].recipes.map(recipe=>({...recipe,input:{...recipe.input},output:{...recipe.output}}))};
    persistModDefinitionsOrRollback(()=>{
      delete MACHINE_TYPES[id];delete modDefinitions.machines[id];
      delete ITEMS[definition.blockItem].machineType;
      if(modDefinitions.items[definition.blockItem])delete modDefinitions.items[definition.blockItem].machineType;
    });return id;
  },
  registerMachineRecipe(machineId,recipe){
    const previousCount=MACHINE_TYPES[machineId]&&MACHINE_TYPES[machineId].recipes.length;
    const result=installMachineRecipe(machineId,recipe);
    const added=MACHINE_TYPES[machineId].recipes.length>previousCount;
    const recorded=modDefinitions.machineRecipes.some(entry=>entry.machine===machineId&&entry.recipe.id===result);
    if(!recorded){
      modDefinitions.machineRecipes.push({machine:machineId,recipe:{...MACHINE_TYPES[machineId].recipes.find(item=>item.id===result)}});
    }
    persistModDefinitionsOrRollback(()=>{
      if(added)MACHINE_TYPES[machineId].recipes.pop();
      if(!recorded)modDefinitions.machineRecipes.pop();
    });return result;
  },
  on(event,fn){ if(typeof fn!=='function')throw new Error('事件监听器必须是函数'); (modHooks[event]||(modHooks[event]=[])).push(fn); return ()=>{modHooks[event]= (modHooks[event]||[]).filter(f=>f!==fn);}; },
  emit(event,payload){ for(const fn of (modHooks[event]||[])){try{fn(payload);}catch(err){console.error('[Pixel Survival Mod]',event,err);}} },
  addItem(id,count=1){ if(!ITEMS[id])throw new Error('未知物品：'+id); if(!Number.isInteger(count)||count<1)throw new Error('物品数量必须为正整数'); addItem(id,count); },
  getSnapshot(){ return JSON.parse(JSON.stringify({day:G.day,tech:G.tech,farmTech:G.farmTech||0,kills:G.kills,player:{hp:player.hp,maxHp:player.maxHp,hunger:player.hunger,x:player.x,y:player.y},inventory:inv,machines})); },
  save(){ return saveGame(true); },
};
Object.defineProperty(window,'PixelSurvivalModAPI',{value:PixelSurvivalModAPI,writable:false,configurable:false});
function persistModDefinitions(){
  try{localStorage.setItem(MOD_DEFS_KEY,JSON.stringify(modDefinitions));}
  catch(e){console.error('[Pixel Survival Mod] 无法保存模组定义',e);throw new Error('模组内容注册失败：本地存储不可用');}
}
function persistModDefinitionsOrRollback(rollback){
  try{persistModDefinitions();}catch(err){rollback();throw err;}
}
function restoreModDefinitions(){
  try{
    const saved=JSON.parse(localStorage.getItem(MOD_DEFS_KEY)||'null');if(!saved)return;
    if(saved.items&&isRecord(saved.items))for(const [id,def] of Object.entries(saved.items)){
      if(!ITEMS[id]&&def&&typeof def.name==='string')ITEMS[id]={kind:'material',icon:'crystal',color:'#b58cff',color2:'#644a8b',desc:'模组物品',...def};
      if(ITEMS[id]&&modDefinitions.items[id]===undefined)modDefinitions.items[id]={...def};
    }
    if(saved.blocks&&isRecord(saved.blocks))for(const [id,def] of Object.entries(saved.blocks)){
      if(ITEMS[id]&&ITEMS[id].kind==='placeable')modDefinitions.blocks[id]={...def};
    }
    if(saved.crops&&isRecord(saved.crops))for(const [id,def] of Object.entries(saved.crops)){
      try{installCropDefinition(id,def);modDefinitions.crops[id]={...CROPS[id]};}catch(err){console.warn('[Pixel Survival Mod] 作物恢复失败：'+id,err);}
    }
    if(saved.machines&&isRecord(saved.machines))for(const [id,def] of Object.entries(saved.machines)){
      try{installMachineDefinition(id,def);modDefinitions.machines[id]={...MACHINE_TYPES[id],recipes:MACHINE_TYPES[id].recipes.map(recipe=>({...recipe}))};}
      catch(err){console.warn('[Pixel Survival Mod] 机器恢复失败：'+id,err);}
    }
    if(Array.isArray(saved.machineRecipes))for(const entry of saved.machineRecipes){
      try{installMachineRecipe(entry.machine,entry.recipe);modDefinitions.machineRecipes.push({machine:entry.machine,recipe:{...entry.recipe}});}
      catch(err){console.warn('[Pixel Survival Mod] 机器配方恢复失败',err);}
    }
    if(Array.isArray(saved.recipes))for(const r of saved.recipes){
      if(r&&ITEMS[r.out]&&r.need&&Object.keys(r.need).every(id=>ITEMS[id])){
        const count=r.count||1;
        if(!RECIPES.some(x=>x.out===r.out&&(x.count||1)===count&&JSON.stringify(x.need)===JSON.stringify(r.need)))
          RECIPES.push({...r,need:{...r.need}});
        if(!modDefinitions.recipes.some(x=>x.out===r.out&&(x.count||1)===count&&JSON.stringify(x.need)===JSON.stringify(r.need)))
          modDefinitions.recipes.push({...r,need:{...r.need}});
      }
    }
    if(Array.isArray(saved.techs))for(const t of saved.techs){
      if(t&&typeof t.name==='string'&&!TECH_LEVELS.some(x=>x.name===t.name))TECH_LEVELS.push({...t,cost:{...(t.cost||{})}});
      if(t&&!modDefinitions.techs.some(x=>x.name===t.name))modDefinitions.techs.push({...t});
    }
    if(Array.isArray(saved.skillNodes)){
      const pending=saved.skillNodes.filter(node=>node&&typeof node.id==='string');
      while(pending.length){
        const index=pending.findIndex(node=>Array.isArray(node.requires)&&
          node.requires.every(id=>SKILLS.some(skill=>skill.id===id)));
        if(index<0){console.warn('[Game Studio] 技能节点恢复失败：存在无效或循环前置关系');break;}
        const [node]=pending.splice(index,1);
        try{PixelSurvivalModAPI.configureSkillNode(node.id,node);}
        catch(err){console.warn('[Game Studio] 技能节点恢复失败：'+node.id,err);}
      }
    }
    if(Array.isArray(saved.studioBlueprints))
      modDefinitions.studioBlueprints=saved.studioBlueprints.filter(entry=>entry&&typeof entry.id==='string'&&typeof entry.kind==='string');
    if(isRecord(saved.maps)&&typeof studioValidateMapDefinition==='function'){
      for(const [id,map] of Object.entries(saved.maps)){
        try{
          validateModId(id);
          studioValidateMapDefinition(id,map);
          modDefinitions.maps[id]=map;
        }catch(err){console.warn('[Game Studio] 地图恢复失败：'+id,err);}
      }
    }
    if(isRecord(saved.textures)&&typeof restoreStudioTextures==='function')restoreStudioTextures(saved.textures);
    if(isRecord(saved.assets)&&typeof studioRestoreAssets==='function')studioRestoreAssets(saved.assets);
    if(isRecord(saved.modInfo))modDefinitions.modInfo={...modDefinitions.modInfo,...saved.modInfo};
  }catch(e){console.error('[Pixel Survival Mod] 模组定义恢复失败',e);}
}
